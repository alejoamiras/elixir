// What names a folder outside the type system: CI filters and commands, the root manifest, path
// literals, Tailwind sources. Each fails silently when a folder moves: a filter glob that matches
// nothing skips the pipeline, `bun test a b` passes when `a` is gone, `git diff --exit-code <stale>`
// exits 0. Everything here holds on the tree as it is, so it can land before any move it guards.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Glob, YAML } from 'bun';
import {
  readManifest,
  repo,
  resolveRelative,
  SCRIPT,
  tracked,
  type Workspace,
  workspaces,
} from './workspace-graph.ts';

const files = await tracked();
const all = workspaces(files);
const ROOTS = ['packages', 'apps', 'protocol', 'tools'];
const inWorkspaceRoot = (token: string): boolean => ROOTS.some((r) => token.startsWith(`${r}/`));
/** A tracked file, or a folder that holds one. */
const exists = (path: string): boolean => {
  const p = path.replace(/\/+$/, '');
  return files.some((f) => f === p || f.startsWith(`${p}/`));
};

interface Step {
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
  'working-directory'?: string;
}
interface Job {
  uses?: string;
  with?: { filters?: string };
  steps?: Step[];
}
interface Workflow {
  file: string;
  pullRequest: boolean;
  filter: string[];
  steps: Step[];
  jobs: Job[];
}

const ciDir = (dir: string): string[] => readdirSync(join(repo, dir)).map((f) => `${dir}/${f}`);
const workflows: Workflow[] = ciDir('.github/workflows').map((file) => {
  const doc = YAML.parse(readFileSync(join(repo, file), 'utf8')) as {
    on?: Record<string, unknown>;
    jobs?: Record<string, Job>;
  };
  const jobs = Object.values(doc.jobs ?? {});
  const filter = jobs.flatMap((j) =>
    j.with?.filters ? ((YAML.parse(j.with.filters) as { relevant?: string[] }).relevant ?? []) : [],
  );
  return {
    file,
    pullRequest: 'pull_request' in (doc.on ?? {}),
    filter,
    steps: jobs.flatMap((j) => j.steps ?? []),
    jobs,
  };
});
const actionSteps: Step[] = ciDir('.github/actions').flatMap(
  (dir) =>
    (YAML.parse(readFileSync(join(repo, dir, 'action.yml'), 'utf8')) as { runs: { steps: Step[] } }).runs
      .steps,
);

/** One shell command per `&&`, `;`, `|` or line, as words with their quotes removed. */
const commands = (run: string): string[][] =>
  run
    .split(/\n|&&|;|\|/)
    .map((c) =>
      c
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/^["']?\$\(|\)+["']?$/g, '').replace(/^['"]|['"]$/g, '')),
    )
    .filter((c) => c[0]);

/** The words of a command that a supported form reads as checked-in paths. */
function pathArguments(words: string[]): string[] {
  const out: string[] = [];
  const cwd = words.indexOf('--cwd');
  if (cwd >= 0 && words[cwd + 1]) out.push(words[cwd + 1] as string);
  const [a, b] = words;
  if (a === 'bun' && b === 'test') out.push(...words.slice(2).filter((w) => !w.startsWith('-')));
  // A script and whatever it is handed: `bun <path>.ts <folder>`.
  else if (a === 'bun' && b?.endsWith('.ts'))
    out.push(...words.slice(1).filter((w) => !w.startsWith('-') && w.includes('/')));
  else if (a === 'bash' && b && !b.startsWith('$')) out.push(b);
  else if (a === 'git' && b === 'diff') out.push(...words.slice(2).filter((w) => !w.startsWith('-')));
  // `jq <filter> <file>`, alone or inside a command substitution (`x=$(jq … file)`).
  const jq = words.findIndex((w) => /(^|\()jq$/.test(w));
  if (jq >= 0) out.push(...words.slice(jq + 1).filter((w) => w.includes('/')));
  return out;
}

/** A checked-in path must exist; a folder a command writes into need not, but its workspace must. */
function commandProblems(where: string, words: string[]): string[] {
  const read = pathArguments(words);
  const said = words.join(' ');
  const script = words[0] === 'bun' && words[1]?.endsWith('.ts') ? words[1] : undefined;
  const missing = read.filter(
    (p) => !exists(script && p !== script ? p.split('/').slice(0, 2).join('/') : p),
  );
  const unread = words.filter((w) => inWorkspaceRoot(w) && !read.includes(w));
  return [
    ...missing.map((p) => `${where}: ${p} does not exist (${said})`),
    ...unread.map((w) => `${where}: unsupported form names ${w} (${said})`),
  ];
}

function stepProblems(where: string, s: Step): string[] {
  const out = commands(s.run ?? '').flatMap((words) => commandProblems(where, words));
  const dir = s['working-directory'];
  if (dir && !exists(dir)) out.push(`${where}: working-directory ${dir} does not exist`);
  if (s.uses?.startsWith('./') && !exists(s.uses.slice(2)))
    out.push(`${where}: uses ${s.uses} does not exist`);
  // An uploaded report does not exist in a clean checkout; the workspace that writes it does.
  const uploaded = s.uses?.includes('upload-artifact') ? String(s.with?.path ?? '').split('\n') : [];
  for (const p of uploaded.map((x) => x.trim()).filter(inWorkspaceRoot)) {
    const owner = p.split('/').slice(0, 2).join('/');
    if (!exists(owner)) out.push(`${where}: artifact path ${p} is under ${owner}, which does not exist`);
  }
  return out;
}

const testInvocations = (w: Workflow): string[][] =>
  w.steps
    .flatMap((s) => commands(s.run ?? ''))
    .filter((c) => c[0] === 'bun' && c[1] === 'test')
    .map((c) => c.slice(2).filter((x) => !x.startsWith('-')));

/** The workspace and everything it needs in production, through `dependencies`. */
function closure(w: Workspace, seen = new Set<Workspace>()): Set<Workspace> {
  if (seen.has(w)) return seen;
  seen.add(w);
  for (const name of Object.keys(w.manifest.dependencies ?? {})) {
    const dep = all.find((x) => x.name === name);
    if (dep) closure(dep, seen);
  }
  return seen;
}
const covers = (filter: string[], dir: string): boolean =>
  filter.some((g) => !g.startsWith('!') && g.startsWith(`${dir}/`));

// Suites that need a network the pull-request lanes do not boot: the rig's cases run through
// `bun run rig`, the rest skip without their environment and run in the e2e workflow.
const NOT_IN_A_PR_LANE = [/^packages\/harness\/tests\//];

describe('workflows', () => {
  test('every filter glob matches a tracked file', () => {
    const dead = workflows.flatMap((w) =>
      w.filter
        .filter((g) => !g.startsWith('!') && !files.some((f) => new Glob(g).match(f)))
        .map((g) => `${w.file}: ${g}`),
    );
    expect(dead).toEqual([]);
  });

  test('every path a command names exists, in a form this guard can read', () => {
    const problems = [
      ...workflows.flatMap((w) => [
        ...w.steps.flatMap((s) => stepProblems(w.file, s)),
        ...w.jobs
          .filter((j) => j.uses?.startsWith('./') && !exists(j.uses.slice(2)))
          .map((j) => `${w.file}: uses ${j.uses}`),
      ]),
      ...actionSteps.flatMap((s) => stepProblems('.github/actions', s)),
    ];
    expect(problems).toEqual([]);
  });

  test('every bun:test file runs in a pull-request workflow', () => {
    const invocations = workflows.filter((w) => w.pullRequest).flatMap(testInvocations);
    const orphans = files
      .filter((f) => /\.test\.ts$/.test(f) && !NOT_IN_A_PR_LANE.some((x) => x.test(f)))
      .filter((f) => !invocations.some((args) => args.length === 0 || args.some((a) => f.includes(a))));
    expect(orphans).toEqual([]);
  });

  test("a workflow's filter names every workspace whose tests it runs, and what those depend on", () => {
    const gaps: string[] = [];
    for (const w of workflows.filter((x) => x.filter.length)) {
      const tested = new Set(
        all.filter((ws) =>
          testInvocations(w)
            .flat()
            .some((a) => a === ws.dir || a.startsWith(`${ws.dir}/`)),
        ),
      );
      for (const t of tested)
        for (const need of closure(t))
          if (!covers(w.filter, need.dir))
            gaps.push(`${w.file}: runs ${t.dir}'s tests, filter lacks ${need.dir}/**`);
    }
    expect([...new Set(gaps)]).toEqual([]);
  });

  test('the toolchain lanes require the toolchain and watch its resolver', () => {
    const problems: string[] = [];
    for (const name of ['contracts', 'work-circuit', 'portal', 'harness']) {
      const w = workflows.find((x) => x.file.endsWith(`/${name}.yml`));
      const step = w?.steps.find((s) => s.run?.includes('scripts/run/toolchain.test.ts'));
      if (!step) problems.push(`${name}.yml does not run scripts/run/toolchain.test.ts`);
      else if (!step.env?.YACANA_REQUIRE_TOOLCHAIN)
        problems.push(`${name}.yml: the toolchain test may skip (no YACANA_REQUIRE_TOOLCHAIN)`);
      // The resolver, not only its test: a change to how the pin is read must run the lane.
      if (w && !w.filter.some((g) => !g.startsWith('!') && new Glob(g).match('scripts/run/toolchain.ts')))
        problems.push(`${name}.yml: the filter does not watch scripts/run/toolchain.ts`);
    }
    expect(problems).toEqual([]);
  });

  test('the header, guard and config suites run in a pull-request lane that watches their folder', () => {
    const critical = files.filter((f) => /\/(headers|node-guard|config)\.test\.ts$/.test(f));
    expect(critical.length).toBeGreaterThanOrEqual(3);
    const unwatched = critical.filter(
      (f) =>
        !workflows.some(
          (w) =>
            w.pullRequest &&
            testInvocations(w).some((args) => args.some((a) => f.includes(a))) &&
            w.filter.some((g) => !g.startsWith('!') && new Glob(g).match(f)),
        ),
    );
    expect(unwatched).toEqual([]);
  });
});

describe('the root manifest', () => {
  const root = readManifest('.') as ReturnType<typeof readManifest> & { scripts: Record<string, string> };

  test('the workspaces globs cover exactly the workspace manifests', () => {
    const globs = (root.workspaces ?? []).map((g) => new Glob(`${g}/package.json`));
    const manifests = files.filter(
      (f) => /^[^/]+\/[^/]+\/package\.json$/.test(f) && ROOTS.some((r) => f.startsWith(`${r}/`)),
    );
    expect(manifests.filter((m) => !globs.some((g) => g.match(m)))).toEqual([]);
    expect(
      (root.workspaces ?? []).filter((g) => !files.some((f) => new Glob(`${g}/package.json`).match(f))),
    ).toEqual([]);
  });

  test('every folder a script names exists', () => {
    const missing = Object.entries(root.scripts).flatMap(([name, script]) =>
      commands(script).flatMap((words) => {
        const named = [...pathArguments(words), ...words.filter(inWorkspaceRoot)];
        const filter = words.indexOf('--filter');
        const glob = filter >= 0 ? (words[filter + 1] ?? '').replace(/^\.\//, '') : '';
        const dead = glob && !all.some((w) => new Glob(glob).match(w.dir)) ? [glob] : [];
        return [...named.filter((p) => !p.includes('*') && !exists(p)), ...dead].map((p) => `${name}: ${p}`);
      }),
    );
    expect(missing).toEqual([]);
  });
});

describe('sources', () => {
  // Two segments only, and only a literal that starts with them: a constructed path is not seen
  // here, and fails loudly on its own.
  const LITERAL = new RegExp(`(['"\`])((?:${ROOTS.join('|')})/[a-z][a-z0-9-]*)(?:/[^'"\`\\n]*)?\\1`, 'g');
  // The guards' own fixtures name folders that need not exist.
  const FIXTURES = [/^scripts\/(layout|boundaries)\.test\.ts$/, /^implementations-plan\//];

  test('a path literal that starts with a workspace folder names one that exists', () => {
    const stale = files
      .filter((f) => SCRIPT.test(f) && !FIXTURES.some((x) => x.test(f)))
      .flatMap((f) =>
        [...readFileSync(join(repo, f), 'utf8').matchAll(LITERAL)]
          .filter((m) => !exists(m[2] ?? ''))
          .map((m) => `${f}: ${m[0]}`),
      );
    expect(stale).toEqual([]);
  });

  test('every Tailwind @source path exists', () => {
    const missing = files
      .filter((f) => f.endsWith('.css'))
      .flatMap((f) =>
        [...readFileSync(join(repo, f), 'utf8').matchAll(/@source\s+["'](\.[^"']+)["']/g)]
          .filter((m) => !resolveRelative(f, m[1] ?? '') && !exists(join(dirname(f), m[1] ?? '')))
          .map((m) => `${f}: ${m[1]}`),
      );
    expect(missing).toEqual([]);
  });
});
