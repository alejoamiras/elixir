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
// Anywhere in a word, so `./packages/x` and `DIR=packages/x` are seen too.
const NAMES_FOLDER = new RegExp(`(^|[^A-Za-z0-9_.-])(${ROOTS.join('|')})/`);
const inWorkspaceRoot = (token: string): boolean => NAMES_FOLDER.test(token);
const plain = (word: string): string => word.replace(/^\.\//, '');
/** A tracked file, or a folder that holds one. */
const exists = (path: string): boolean => {
  const p = path.replace(/\/+$/, '');
  return files.some((f) => f === p || f.startsWith(`${p}/`));
};

interface Step {
  if?: string;
  'continue-on-error'?: boolean;
  /** The `if` of the job the step belongs to. */
  jobIf?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
  'working-directory'?: string;
}
interface Job {
  if?: string;
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
    steps: jobs.flatMap((j) => (j.steps ?? []).map((st) => ({ ...st, jobIf: j.if }))),
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
  return out.map(plain);
}

/** A checked-in path must exist; a folder a command writes into need not, but its workspace must. */
function commandProblems(where: string, words: string[]): string[] {
  const read = pathArguments(words);
  const said = words.join(' ');
  const script = words[0] === 'bun' && words[1]?.endsWith('.ts') ? plain(words[1]) : undefined;
  const missing = read.filter(
    (p) => !exists(script && p !== script ? p.split('/').slice(0, 2).join('/') : p),
  );
  const unread = words.filter((w) => inWorkspaceRoot(w) && !read.includes(plain(w)));
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

// The one condition a gated job carries; any other `if`, on the job or the step, may be false.
const CHANGES_GATE = "needs.changes.outputs.relevant == 'true'";
const alwaysRuns = (s: Step): boolean =>
  s.if === undefined && !s['continue-on-error'] && (s.jobIf === undefined || s.jobIf === CHANGES_GATE);

/** The commands of a step that run and whose failure fails it: none after an `exit`, none before `||`. */
function gating(s: Step): string[][] {
  if (!alwaysRuns(s)) return [];
  const lines = (s.run ?? '').split('\n');
  const stop = lines.findIndex((l) => /(^|;|&&)\s*exit\b/.test(l));
  return (stop < 0 ? lines : lines.slice(0, stop)).filter((l) => !l.includes('||')).flatMap(commands);
}

const testInvocations = (w: Workflow): string[][] =>
  w.steps
    .flatMap(gating)
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
// A page reads the portal's generated ABI and nothing else of it: the Solidity and the Foundry tests
// cannot change what a page does without changing the ABI, which CI regenerates and diffs.
const WATCHED_NARROWLY: Record<string, string> = { 'packages/portal': 'packages/portal/abi/**' };

/** The whole folder, or the one listed narrower glob for a dependency. */
function covers(filter: string[], dir: string, own: boolean): boolean {
  if (filter.includes(`${dir}/**`)) return true;
  const narrow = WATCHED_NARROWLY[dir];
  return !own && narrow !== undefined && filter.includes(narrow);
}

/** Run as a whole, a workspace is watched as a whole; run file by file, those files are. */
function filterGaps(w: Workflow): string[] {
  // `bun test <paths>`, and a workspace's Vitest run, which tests the whole of it.
  const components = w.steps
    .flatMap(gating)
    .filter((c) => c.includes('test:components') && c.includes('--cwd'))
    .map((c) => c[c.indexOf('--cwd') + 1] ?? '');
  const args = [...testInvocations(w).flat(), ...components];
  const watched = (a: string): boolean => w.filter.some((g) => !g.startsWith('!') && new Glob(g).match(a));
  return all
    .filter((ws) => args.some((a) => a === ws.dir || a.startsWith(`${ws.dir}/`)))
    .flatMap((t) => {
      const whole = args.includes(t.dir);
      const files = whole ? [] : args.filter((a) => a.startsWith(`${t.dir}/`) && !watched(a));
      const folders = [...closure(t)].filter((need) => !covers(w.filter, need.dir, whole && need === t));
      return [
        ...files.map((a) => `${w.file}: runs ${a}, which no filter glob matches`),
        ...folders.map((need) => `${w.file}: runs ${t.dir}'s tests, filter lacks ${need.dir}/**`),
      ];
    });
}

/** Whether the Vitest config of the file's workspace picks the file up: an invocation alone does not. */
function vitestIncludes(f: string): boolean {
  const dir = all.find((w) => f.startsWith(`${w.dir}/`))?.dir;
  if (!dir || !exists(`${dir}/vitest.config.ts`)) return false;
  const config = readFileSync(join(repo, dir, 'vitest.config.ts'), 'utf8');
  const include = /include:\s*\[([^\]]*)\]/.exec(config)?.[1] ?? '';
  const globs = [...include.matchAll(/['"]([^'"]+)['"]/g)].map((m) => new Glob(m[1] ?? ''));
  return globs.some((g) => g.match(f.slice(dir.length + 1)));
}

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

  test('every test file runs in a pull-request workflow, under the runner it is written for', () => {
    const lanes = workflows.filter((w) => w.pullRequest);
    const bunArgs = lanes.flatMap(testInvocations);
    // Vitest runs through a workspace's `test:components`, or the root script over all of them.
    const vitestDirs = lanes
      .flatMap((w) => w.steps.flatMap(gating))
      .filter((c) => c.includes('test:components'))
      .map((c) => (c.includes('--cwd') ? (c[c.indexOf('--cwd') + 1] ?? '') : ''));
    const runs = (f: string): boolean =>
      /^import .* from 'vitest';$/m.test(readFileSync(join(repo, f), 'utf8'))
        ? vitestDirs.some((d) => d === '' || f.startsWith(`${d}/`)) && vitestIncludes(f)
        : bunArgs.some((args) => args.length === 0 || args.some((a) => f.includes(a)));
    const orphans = files
      .filter((f) => /\.(test|spec|vitest)\.tsx?$/.test(f) && !NOT_IN_A_PR_LANE.some((x) => x.test(f)))
      .filter((f) => !runs(f));
    expect(orphans).toEqual([]);
  });

  test('a filter takes nothing but documentation back out', () => {
    const taken = workflows.flatMap((w) =>
      w.filter
        .filter((g) => g.startsWith('!'))
        .flatMap((g) => files.filter((f) => !f.endsWith('.md') && new Glob(g.slice(1)).match(f)).slice(0, 1))
        .map((f) => `${w.file}: an exclusion takes out ${f}`),
    );
    expect(taken).toEqual([]);
  });

  test("a workflow's filter names every workspace whose tests it runs, and what those depend on", () => {
    const gaps = workflows.filter((w) => w.filter.length).flatMap(filterGaps);
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
