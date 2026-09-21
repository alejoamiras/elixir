//   bun implementations-plan/monorepo-layout/bundle-compare.ts <baseline dist> <dist> <baseline modules dir> <modules dir> [old=new …]
// Regression evidence for a build whose JavaScript may be re-mangled, not proof of equivalence:
// the same files once content hashes leave their names, everything but JavaScript byte-identical
// after hashed names are normalised inside it, no local path in any script, and the same modules in
// every page and Worker. `old=new` maps a moved folder's module ids. JavaScript deltas are printed.
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';

const [baseDistArg, distArg, baseMods, mods, ...maps] = process.argv.slice(2);
if (!baseDistArg || !distArg || !baseMods || !mods) throw new Error('usage: see the first line');
const [baseDist, dist] = [resolve(baseDistArg), resolve(distArg)];

const HASH = /-[A-Za-z0-9_-]{8}(?=\.[a-z0-9]+\b)/g;
const TEXT = /\.(html|css|json|txt|svg|webmanifest)$|(^|\/)_(headers|redirects)$/;
const findings: string[] = [];

/** Files by their name without content hashes; chunks that share a stem (`lazy-*.js`) share a group. */
function groups(root: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const e of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!e.isFile()) continue;
    const f = relative(root, join(e.parentPath, e.name));
    const name = f.replace(HASH, '-HASH');
    out.set(name, [...(out.get(name) ?? []), f]);
  }
  return out;
}

const bytes = (root: string, f: string, name: string): Buffer =>
  TEXT.test(name)
    ? Buffer.from(readFileSync(join(root, f), 'utf8').replace(HASH, '-HASH'))
    : readFileSync(join(root, f));

// This machine's paths may never appear. Generic prefixes do, inside upstream artifacts that carry
// their builder's paths, so for those each path is held against the baseline's: a path the baseline's
// scripts of that name do not carry is a finding, whatever else fell away.
const own = [homedir(), resolve('.')];
const PATHS = /(?:\/(?:mnt|Users|home)\/|\b(?:packages|apps|protocol|tools)\/)[\w@.+/-]+/g;
const pathsIn = (side: Buffer[]): Set<string> =>
  new Set(side.flatMap((b) => b.toString('utf8').match(PATHS) ?? []));
const jsDeltas: string[] = [];

/** Drops one of `from` for each equal buffer in `other`: two copies against one leave one over. */
function unmatched(from: Buffer[], other: Buffer[]): Buffer[] {
  const pool = [...other];
  return from.filter((a) => {
    const i = pool.findIndex((b) => a.equals(b));
    if (i >= 0) pool.splice(i, 1);
    return i < 0;
  });
}

// Paths are read over the whole group, so a chunk with no partner of its size is still read.
function compareScripts(name: string, was: Buffer[], now: Buffer[]): void {
  const bySize = (x: Buffer, y: Buffer): number => x.length - y.length;
  const left = unmatched(was, now).sort(bySize);
  const right = unmatched(now, was).sort(bySize);
  for (let i = 0; i < Math.max(left.length, right.length); i++)
    jsDeltas.push(`${name}: ${left[i]?.length ?? 'none'} → ${right[i]?.length ?? 'none'}`);
  const known = pathsIn(was);
  for (const p of pathsIn(now)) if (!known.has(p)) findings.push(`a path the baseline lacks in ${name}: ${p}`);
  for (const b of now)
    for (const leak of own) if (b.includes(leak)) findings.push(`this machine's path in ${name}`);
}

const before = groups(baseDist);
const after = groups(dist);
for (const name of before.keys()) if (!after.has(name)) findings.push(`file gone: ${name}`);
for (const [name, files] of after) {
  const old = before.get(name);
  if (!old) {
    findings.push(`file new: ${name}`);
    continue;
  }
  if (old.length !== files.length) findings.push(`${name}: ${old.length} → ${files.length} files`);
  const was = old.map((f) => bytes(baseDist, f, name));
  const now = files.map((f) => bytes(dist, f, name));
  if (name.endsWith('.js')) compareScripts(name, was, now);
  else if (now.some((b) => !was.some((a) => a.equals(b)))) findings.push(`not JavaScript and differs: ${name}`);
}

const moved = maps.map((m) => m.split('=') as [string, string]);
const remap = (id: string): string =>
  moved.reduce((s, [o, n]) => (s.startsWith(`${o}/`) ? n + s.slice(o.length) : s), id);
const ids = (dir: string, file: string, map: boolean): Set<string> =>
  new Set(
    readFileSync(join(dir, file), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((id) => (map ? remap(id) : id)),
  );
const reports = [...new Set([...readdirSync(baseMods), ...readdirSync(mods)])].sort();
// No report is a build that ran without the reporter, not a build with nothing in it.
if (!reports.length) findings.push('no module report on either side');
// Every page and at least one Worker: a pair of trimmed report folders must not agree their way through.
for (const page of ['web-landing', 'web-miner', 'web-stats'])
  if (!reports.includes(`${page}.txt`)) findings.push(`no module report for ${page}`);
if (!reports.some((r) => r.includes('.worker.'))) findings.push('no module report for any Worker');
for (const file of reports) {
  let a: Set<string>;
  let b: Set<string>;
  try {
    a = ids(baseMods, file, true);
    b = ids(mods, file, false);
  } catch {
    findings.push(`module report missing on one side: ${file}`);
    continue;
  }
  if (!a.size || !b.size) findings.push(`${file}: an empty module report`);
  for (const id of a) if (!b.has(id)) findings.push(`${file}: module gone: ${id}`);
  for (const id of b) if (!a.has(id)) findings.push(`${file}: module new: ${id}`);
  console.log(`${file}: ${b.size} modules`);
}

const total = [...after.values()].reduce((n, f) => n + f.length, 0);
console.log(`${total} files; JavaScript re-emitted with different bytes: ${jsDeltas.length}`);
for (const d of jsDeltas) console.log(`  ${d}`);
if (findings.length) {
  console.log(`FINDINGS (${findings.length}):`);
  for (const f of findings) console.log(`  ${f}`);
  process.exit(1);
}
console.log('no findings');
