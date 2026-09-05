// CHAIN_LEN sweep on the native bb: gates, witness, VK, timed proves and a verify per crate.
// Writes target/sweep.json and prints a markdown table labelled with this machine.
//   bun packages/work-circuit/scripts/sweep.ts [--runs N] [crate…]

import { cpus, hostname } from 'node:os';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { $ } from 'bun';
import { BB, workCircuitRoot } from './toolchain.ts';

const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const runs = runsIdx >= 0 ? Number(args[runsIdx + 1]) : 3;
const crates = args.filter((a, i) => !a.startsWith('--') && (runsIdx < 0 || i !== runsIdx + 1));
const targets = crates.length ? crates : ['sweep_1024', 'yacana_work', 'sweep_4096'];

interface Result {
  crate: string;
  acirOpcodes: number;
  circuitSize: number;
  witnessMs: number;
  vkMs: number;
  proveMs: number[];
  verifyOk: boolean;
  proofBytes: number;
}

const timed = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
  const t0 = performance.now();
  const out = await fn();
  return [out, performance.now() - t0];
};

async function measure(crate: string): Promise<Result> {
  const root = workCircuitRoot;
  const bytecode = resolve(root, 'target', `${crate}.json`);
  const out = resolve(root, 'target', crate);
  const gatesJson = await $`${BB} gates -b ${bytecode} --scheme ultra_honk`.cwd(root).quiet().json();
  const fn = gatesJson.functions[0];
  const [, witnessMs] = await timed(() => $`aztec-nargo execute --package ${crate}`.cwd(root).quiet());
  const witness = resolve(root, 'target', `${crate}.gz`);
  const [, vkMs] = await timed(() =>
    $`${BB} write_vk -b ${bytecode} --scheme ultra_honk -t noir-recursive-no-zk -o ${out}`.cwd(root).quiet(),
  );
  const proveMs: number[] = [];
  for (let i = 0; i < runs; i++) {
    const [, ms] = await timed(() =>
      $`${BB} prove -b ${bytecode} -w ${witness} -k ${out}/vk --scheme ultra_honk -t noir-recursive-no-zk -o ${out}`
        .cwd(root)
        .quiet(),
    );
    proveMs.push(ms);
  }
  const verify =
    await $`${BB} verify -p ${out}/proof -i ${out}/public_inputs -k ${out}/vk --scheme ultra_honk -t noir-recursive-no-zk`
      .cwd(root)
      .nothrow()
      .quiet();
  const proofBytes = (await Bun.file(`${out}/proof`).arrayBuffer()).byteLength;
  return {
    crate,
    acirOpcodes: fn.acir_opcodes,
    circuitSize: fn.circuit_size,
    witnessMs,
    vkMs,
    proveMs,
    verifyOk: verify.exitCode === 0,
    proofBytes,
  };
}

const results: Result[] = [];
for (const crate of targets) results.push(await measure(crate));
const machine = `${hostname()} · ${cpus()[0]?.model ?? 'cpu'} × ${cpus().length}`;
await Bun.write(
  resolve(workCircuitRoot, 'target', 'sweep.json'),
  JSON.stringify({ machine, runs, results }, null, 2),
);
const fmt = (ms: number) => (ms / 1000).toFixed(2);
console.log(`Machine: ${machine}; ${runs} proves per crate (min / median)\n`);
console.log(
  '| crate | ACIR opcodes | circuit size | witness s | vk s | prove s (min / median) | proof bytes | verify |',
);
console.log('|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const sorted = [...r.proveMs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  console.log(
    `| ${r.crate} | ${r.acirOpcodes} | ${r.circuitSize} | ${fmt(r.witnessMs)} | ${fmt(r.vkMs)} | ${fmt(sorted[0] ?? 0)} / ${fmt(median)} | ${r.proofBytes} | ${r.verifyOk ? 'ok' : 'FAIL'} |`,
  );
}
if (results.some((r) => !r.verifyOk)) process.exit(1);
