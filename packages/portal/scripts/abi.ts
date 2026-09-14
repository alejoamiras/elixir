// Copies the built ABIs into abi/ so consumers (the bridge client, stats) read a committed file
// and CI fails on drift between the sources and what was committed.
//   bun scripts/abi.ts
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
mkdirSync(resolve(root, 'abi'), { recursive: true });
for (const [name, file] of [
  ['YacanaPortal', 'YacanaPortal.sol/YacanaPortal.json'],
  ['YACA', 'YACA.sol/YACA.json'],
] as const) {
  const built = (await Bun.file(resolve(root, 'out', file)).json()) as { abi: unknown[] };
  await Bun.write(resolve(root, 'abi', `${name}.json`), `${JSON.stringify(built.abi, null, 2)}\n`);
}
console.log('portal ABIs written to abi/');
