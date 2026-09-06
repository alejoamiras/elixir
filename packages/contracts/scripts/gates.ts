// Gate counts of the spike's private functions under Chonk (Mega circuits): extracts each function's
// bytecode from the contract artifact into a program-shaped JSON and runs `bb gates --scheme chonk`.
//   bun packages/contracts/scripts/gates.ts [fn…]
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { $ } from 'bun';
import { BB } from '../../work-circuit/scripts/toolchain.ts';

const root = resolve(import.meta.dir, '..');

const artifact = await Bun.file(resolve(root, 'target', 'yacana_spike-YacanaSpike.json')).json();
const wanted = process.argv.slice(2);
const fns = artifact.functions.filter(
  (f: { name: string; custom_attributes?: string[] }) =>
    (wanted.length ? wanted.includes(f.name.replace('__aztec_nr_internals__', '')) : true) &&
    f.custom_attributes?.some((a: string) => a.includes('private')),
);
const outDir = resolve(root, 'target', 'fns');
mkdirSync(outDir, { recursive: true });
console.log('| private function | ACIR opcodes | circuit size (chonk) |');
console.log('|---|---|---|');
for (const f of fns) {
  const name = f.name.replace('__aztec_nr_internals__', '');
  const file = join(outDir, `${name}.json`);
  await Bun.write(
    file,
    JSON.stringify({
      noir_version: artifact.noir_version,
      hash: f.hash ?? 0,
      abi: f.abi,
      bytecode: f.bytecode,
      debug_symbols: f.debug_symbols ?? '',
      file_map: {},
      names: [name],
      brillig_names: [],
    }),
  );
  const gates = await $`${BB} gates -b ${file} --scheme chonk`.quiet().json();
  const g = gates.functions[0];
  console.log(`| ${name} | ${g.acir_opcodes} | ${g.circuit_size} |`);
}
