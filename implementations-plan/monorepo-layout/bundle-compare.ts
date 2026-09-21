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
// their builder's paths, so for those only a rise against the baseline counts.
const own = [homedir(), resolve('.')];
const generic = ['/mnt/', '/Users/', '/home/', 'packages/', 'apps/', 'protocol/', 'tools/'];
const count = (text: string, needle: string): number => text.split(needle).length - 1;
const jsDeltas: string[] = [];

function compareScripts(name: string, was: Buffer[], now: Buffer[]): void {
  const left = was.filter((a) => !now.some((b) => a.equals(b))).sort((x, y) => x.length - y.length);
  const right = now.filter((b) => !was.some((a) => a.equals(b))).sort((x, y) => x.length - y.length);
  for (const [i, b] of right.entries()) {
    const a = left[i];
    if (!a) continue;
    const d = b.length - a.length;
    jsDeltas.push(`${name}: ${a.length} → ${b.length} (${d >= 0 ? '+' : ''}${d})`);
    const [textA, textB] = [a.toString('utf8'), b.toString('utf8')];
    for (const g of generic)
      if (count(textB, g) > count(textA, g))
        findings.push(`"${g}" ${count(textA, g)} → ${count(textB, g)} times in ${name}`);
  }
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
for (const file of [...new Set([...readdirSync(baseMods), ...readdirSync(mods)])].sort()) {
  let a: Set<string>;
  let b: Set<string>;
  try {
    a = ids(baseMods, file, true);
    b = ids(mods, file, false);
  } catch {
    findings.push(`module report missing on one side: ${file}`);
    continue;
  }
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
