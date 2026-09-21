//   bun implementations-plan/monorepo-layout/codemod.ts --emit-exports   every workspace's `exports` from the import graph
//   bun implementations-plan/monorepo-layout/codemod.ts --emit-deps      every importer's `workspace:*` entries, production imports in `dependencies`
//   bun implementations-plan/monorepo-layout/codemod.ts [--dry] [--bare-only]   rewrite cross-workspace specifiers through those maps (only `@yacana/x/src/y.ts` ones with --bare-only)
// A relative specifier, or an `@yacana/x/src/y.ts` one, whose target another workspace owns becomes
// `@yacana/<owner>/<subpath>` by reverse lookup in the owner's `exports`. Nothing is guessed: a target
// with no entry is reported and the run fails. Run `bun run lint:fix` afterwards: Biome re-sorts.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isProduction,
  isRelative,
  ownerOf,
  repo,
  resolveRelative,
  SCRIPT,
  type Specifier,
  specifiersOf,
  tracked,
  type Workspace,
  workspaces,
} from '../../scripts/workspace-graph.ts';

const emit = process.argv.includes('--emit-exports');
const dry = process.argv.includes('--dry');
const bareOnly = process.argv.includes('--bare-only');

// Vite bundles a config and lets the ambient Node import every bare specifier; nothing pins a Node
// that strips types, so the files a config loads at build time keep reaching each other by path.
const CONFIG_TIME = new Set([
  'packages/web-landing/vite.config.ts → packages/site/src/vite-base.ts',
  'packages/web-miner/vite.config.ts → packages/site/src/vite-base.ts',
  'packages/web-stats/vite.config.ts → packages/site/src/vite-base.ts',
  'packages/site/src/vite-base.ts → packages/ui/src/mark.ts',
]);

const all = await tracked();
const ws = workspaces(all);
const byName = new Map(ws.map((w) => [w.name, w]));
const files = all.filter((f) => (SCRIPT.test(f) || f.endsWith('.css')) && !f.startsWith('implementations-plan/'));

/** `src/keys/derive.ts` → `./keys/derive`; `src/index.ts` → `.`; outside `src`, the folder stays in the name. */
function subpathOf(owner: Workspace, target: string): string {
  const inside = target.slice(owner.dir.length + 1);
  const named = inside.startsWith('src/') ? inside.slice(4) : inside;
  const bare = named.replace(/(?<!\.d)\.(ts|tsx|mts|mjs)$/, '');
  return bare === 'index' ? '.' : `./${bare}`;
}

interface Edge {
  file: string;
  specifier: Specifier;
  owner: Workspace;
  target: string;
  query: string;
}

/** The workspace file a specifier names when another workspace owns it; undefined for everything else. */
function crossTarget(file: string, s: Specifier): { owner: Workspace; target: string } | undefined {
  const path = s.text.replace(/[?#].*$/, '');
  let target: string | undefined;
  if (isRelative(path)) target = resolveRelative(file, path);
  else {
    const m = /^(@yacana\/[a-z-]+)(?:\/(.+))?$/.exec(path);
    const pkg = m?.[1] ? byName.get(m[1]) : undefined;
    if (!pkg) return undefined;
    const sub = m?.[2] ? `./${m[2]}` : '.';
    const mapped = pkg.manifest.exports?.[sub] ?? (sub === '.' ? pkg.manifest.main : undefined);
    target = mapped ? join(pkg.dir, mapped) : join(pkg.dir, m?.[2] ?? '');
  }
  if (!target) return undefined;
  const owner = ownerOf(target, ws);
  if (!owner || owner === ownerOf(file, ws)) return undefined;
  return { owner, target };
}

const edges: Edge[] = [];
for (const file of files) {
  const source = readFileSync(join(repo, file), 'utf8');
  for (const specifier of specifiersOf(file, source)) {
    // The apps' references to the site's ambient types stay paths until that file has a package to live in.
    if (specifier.kind === 'reference') continue;
    const cross = crossTarget(file, specifier);
    if (!cross || CONFIG_TIME.has(`${file} → ${cross.target}`)) continue;
    const query = /[?#].*$/.exec(specifier.text)?.[0] ?? '';
    edges.push({ file, specifier, ...cross, query });
  }
}

if (emit) {
  for (const w of ws) {
    const wanted = new Map<string, string>(Object.entries(w.manifest.exports ?? {}));
    if (w.manifest.main && !wanted.has('.')) wanted.set('.', `./${w.manifest.main.replace(/^\.\//, '')}`);
    for (const e of edges.filter((x) => x.owner === w)) {
      const [sub, to] = [subpathOf(w, e.target), `./${e.target.slice(w.dir.length + 1)}`];
      const held = wanted.get(sub);
      if (held && held !== to) throw new Error(`${w.name}: ${sub} would name both ${held} and ${to}`);
      wanted.set(sub, to);
    }
    if (wanted.size === 0) continue;
    const path = join(repo, w.dir, 'package.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const exportsMap = Object.fromEntries([...wanted].sort(([a], [b]) => a.localeCompare(b)));
    const next: Record<string, unknown> = {};
    const anchor = 'main' in manifest ? 'main' : 'type';
    for (const [k, v] of Object.entries(manifest)) {
      if (k === 'exports') continue;
      next[k] = v;
      if (k === anchor) next.exports = exportsMap;
    }
    if (!dry) writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`${w.name}: ${wanted.size} subpaths`);
  }
  process.exit(0);
}

if (process.argv.includes('--emit-deps')) {
  // The root manifest is an importer too: files no workspace owns (the root scripts) count against it.
  const importers = new Map<string, Map<string, boolean>>();
  for (const e of edges) {
    const dir = ownerOf(e.file, ws)?.dir ?? '.';
    const needs = importers.get(dir) ?? new Map<string, boolean>();
    needs.set(e.owner.name, (needs.get(e.owner.name) ?? false) || (dir !== '.' && isProduction(e.file)));
    importers.set(dir, needs);
  }
  const sorted = (o: Record<string, string>) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  for (const [dir, needs] of [...importers].sort(([a], [b]) => a.localeCompare(b))) {
    const path = join(repo, dir, 'package.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Record<string, string> | undefined>;
    const deps = { ...manifest.dependencies };
    const dev = { ...manifest.devDependencies };
    for (const [name, production] of needs) {
      delete deps[name];
      delete dev[name];
      (production ? deps : dev)[name] = 'workspace:*';
    }
    if (Object.keys(deps).length) manifest.dependencies = sorted(deps);
    if (Object.keys(dev).length) manifest.devDependencies = sorted(dev);
    if (!dry) writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
    const list = [...needs].map(([n, p]) => `${n.slice(8)}${p ? '' : ' (dev)'}`);
    console.log(`${dir}: ${list.sort().join(', ')}`);
  }
  process.exit(0);
}

const unresolved: string[] = [];
const rewrites = new Map<string, { s: Specifier; to: string }[]>();
for (const e of edges) {
  if (bareOnly && isRelative(e.specifier.text)) continue;
  const want = `./${e.target.slice(e.owner.dir.length + 1)}`;
  const sub = Object.entries(e.owner.manifest.exports ?? {}).find(([, v]) => v === want)?.[0];
  if (!sub) {
    unresolved.push(`${e.file}: ${e.specifier.text} → ${e.target} has no entry in ${e.owner.name}'s exports`);
    continue;
  }
  const to = `${e.owner.name}${sub === '.' ? '' : sub.slice(1)}${e.query}`;
  if (to !== e.specifier.text) rewrites.set(e.file, [...(rewrites.get(e.file) ?? []), { s: e.specifier, to }]);
}

let count = 0;
for (const [file, list] of rewrites) {
  let source = readFileSync(join(repo, file), 'utf8');
  for (const { s, to } of list.sort((a, b) => b.s.start - a.s.start)) {
    source = source.slice(0, s.start) + to + source.slice(s.end);
    count++;
  }
  if (!dry) writeFileSync(join(repo, file), source);
}
console.log(`${count} specifiers in ${rewrites.size} files${dry ? ' (dry run)' : ''}; unresolved ${unresolved.length}`);
for (const u of unresolved) console.log(`  ${u}`);
if (unresolved.length) process.exit(1);
