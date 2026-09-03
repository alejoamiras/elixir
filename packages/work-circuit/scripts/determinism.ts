// Native determinism check: prove the same witness N times and require byte-identical proofs.
//   bun packages/work-circuit/scripts/determinism.ts [--runs 10] [crate]

import { resolve } from 'node:path';
import { $ } from 'bun';
import { BB, workCircuitRoot } from './toolchain.ts';

const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const runs = runsIdx >= 0 ? Number(args[runsIdx + 1]) : 10;
const crate = args.find((a, i) => !a.startsWith('--') && i !== runsIdx + 1) ?? 'elixir_work';

const root = workCircuitRoot;
const bytecode = resolve(root, 'target', `${crate}.json`);
const witness = resolve(root, 'target', `${crate}.gz`);
const out = resolve(root, 'target', `${crate}-det`);
await $`aztec-nargo execute --package ${crate}`.cwd(root).quiet();
await $`${BB} write_vk -b ${bytecode} --scheme ultra_honk -t noir-recursive-no-zk -o ${out}`
  .cwd(root)
  .quiet();

const hashes = new Set<string>();
for (let i = 0; i < runs; i++) {
  await $`${BB} prove -b ${bytecode} -w ${witness} -k ${out}/vk --scheme ultra_honk -t noir-recursive-no-zk -o ${out}`
    .cwd(root)
    .quiet();
  const proof = await Bun.file(`${out}/proof`).arrayBuffer();
  hashes.add(new Bun.CryptoHasher('sha256').update(proof).digest('hex'));
}
const [hash] = hashes;
console.log(`${crate}: ${runs} native proves → ${hashes.size} distinct proof(s); sha256 ${hash}`);
if (hashes.size !== 1) process.exit(1);
