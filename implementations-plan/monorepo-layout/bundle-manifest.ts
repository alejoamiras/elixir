//   bun implementations-plan/monorepo-layout/bundle-manifest.ts <dist dir> <out file>
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const [distArg, outArg] = process.argv.slice(2);
if (!distArg || !outArg) throw new Error('usage: bundle-manifest.ts <dist dir> <out file>');
const dist = resolve(distArg);

const files = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile())
  .map((e) => relative(dist, join(e.parentPath, e.name)))
  .sort();
if (files.length === 0) throw new Error(`${distArg} holds no files`);

const lines: string[] = [];
for (const f of files) {
  const bytes = await Bun.file(join(dist, f)).arrayBuffer();
  const sha = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
  lines.push(`${sha}  ${String(bytes.byteLength).padStart(10)}  ${f}`);
}
await Bun.write(outArg, `${lines.join('\n')}\n`);
console.log(`${files.length} files → ${outArg}`);
