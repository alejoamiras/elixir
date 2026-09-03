// Ticket-cost measurements from bb's phase timers (`bb prove --bench_out`), N proves of W:
//  (a) early abort — the ticket hashes the whole proof including KZG:W, the last transcript entry,
//      so the digest is computable only once construct_proof has finished; the "abort point" cost
//      is construct_proof itself and the remainder is serialisation. Reported as a ratio.
//  (b) phase shares an attacker re-proving the SAME witness through the 4 disabled sumcheck rows
//      can skip (witness generation, trace construction, the four wire MSMs) versus what it must
//      redo (z_perm, sumcheck, Gemini/Shplonk, KZG). Their sum bounds that attack's cost from below;
//      it is not an executed attack.
//   bun packages/work-circuit/scripts/ticket-cost.ts [--runs 5] [crate]
import { mkdirSync } from 'node:fs';
import { cpus, hostname } from 'node:os';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { $ } from 'bun';
import { BB, workCircuitRoot } from './toolchain.ts';

const args = process.argv.slice(2);
const runsIdx = args.indexOf('--runs');
const runs = runsIdx >= 0 ? Number(args[runsIdx + 1]) : 5;
const crate = args.find((a, i) => !a.startsWith('--') && i !== runsIdx + 1) ?? 'elixir_work';
const root = workCircuitRoot;
const bytecode = resolve(root, 'target', `${crate}.json`);
const witness = resolve(root, 'target', `${crate}.gz`);
const vk = resolve(root, 'target', crate, 'vk');
const out = resolve(root, 'target', `${crate}-bench`);
mkdirSync(out, { recursive: true });

// bench_out is a flat map of timer name → nanoseconds (children are included in their parents).
type Bench = Record<string, number>;
const samples: { wallMs: number; bench: Bench }[] = [];
for (let i = 0; i < runs; i++) {
  const t0 = performance.now();
  await $`${BB} prove -b ${bytecode} -w ${witness} -k ${vk} --scheme ultra_honk -t noir-recursive-no-zk -o ${out} --bench_out ${out}/bench.json`
    .cwd(root)
    .quiet();
  const wallMs = performance.now() - t0;
  samples.push({ wallMs, bench: await Bun.file(`${out}/bench.json`).json() });
}
const ms = (key: string) => {
  const v = samples.map((s) => (s.bench[key] ?? 0) / 1e6).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)] ?? 0;
};
const wall = samples.map((s) => s.wallMs).sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 0;

const constructProof = ms('UltraProver::construct_proof');
const createCircuit = ms('create_circuit');
const proverInstance = ms('ProverInstance(Circuit&)');
const wireCommits = ms('OinkProver::commit_to_wires');
const lookupCommits =
  ms('OinkProver::commit_to_lookup_counts_and_w4') + ms('OinkProver::commit_to_logderiv_inverses');
const zPerm = ms('OinkProver::compute_grand_product_polynomial') + ms('OinkProver::commit_to_z_perm');
const sumcheck = ms('sumcheck.prove');
const pcs = ms('UltraProver::execute_pcs') || ms('ShpleminiProver::prove') + ms('KZG::compute_opening_proof');
const oink = ms('OinkProver::prove');
const proveEnd = createCircuit + proverInstance + constructProof; // digest computable here
// Everything after the wire commitments is downstream of fresh Fiat–Shamir challenges (beta, gamma,
// eta, alpha, rho…), so z_perm, sumcheck and the PCS must be redone. The attacker-favourable floor
// also treats the w_4/lookup commitment block as skippable.
const skippable = createCircuit + proverInstance + wireCommits;
const attackFloor = proveEnd - skippable;
const attackFloorFavourable = attackFloor - lookupCommits;

const pct = (x: number, of = proveEnd) => `${((100 * x) / of).toFixed(1)} %`;
const s = (x: number) => `${(x / 1000).toFixed(3)} s`;
const machine = `${hostname()} · ${cpus()[0]?.model ?? 'cpu'} × ${cpus().length}`;
console.log(`Machine: ${machine}; ${crate}; median of ${runs} native proves (bb phase timers)\n`);
console.log('| phase | median | share of prove |');
console.log('|---|---|---|');
for (const [name, v] of [
  ['create_circuit (witness → circuit)', createCircuit],
  ['ProverInstance (trace, permutation polys)', proverInstance],
  ['construct_proof', constructProof],
  ['  OinkProver::prove (all commitments)', oink],
  ['    commit_to_wires (w_l, w_r, w_o)', wireCommits],
  ['    lookup counts/tags/w_4/inverses commits', lookupCommits],
  ['    z_perm grand product + commit', zPerm],
  ['  sumcheck.prove', sumcheck],
  ['  PCS (Gemini + Shplonk + KZG)', pcs],
  ['prove (create_circuit + instance + construct_proof)', proveEnd],
  ['bb prove wall clock incl. I/O and serialisation', wall],
] as const) {
  console.log(`| ${name} | ${s(v)} | ${pct(v)} |`);
}
console.log(
  `\n(a) early abort: digest computable at ${pct(proveEnd, proveEnd)} of prove (${pct(proveEnd, wall)} of wall clock)`,
);
console.log(
  `(b) same-witness re-proof: skip create_circuit + ProverInstance + commit_to_wires = ${pct(skippable)}; must redo z_perm + sumcheck + PCS (+ w_4/lookup commits) ≥ ${pct(attackFloor)} of an honest prove, ${pct(attackFloorFavourable)} if the w_4/lookup block is also skipped — an estimate from honest-prover phase timers, not an executed re-derivation`,
);
await Bun.write(
  `${out}/ticket-cost.json`,
  JSON.stringify(
    {
      machine,
      crate,
      runs,
      wall,
      createCircuit,
      proverInstance,
      constructProof,
      oink,
      wireCommits,
      lookupCommits,
      zPerm,
      sumcheck,
      pcs,
      proveEnd,
      skippable,
      attackFloor,
      attackFloorFavourable,
    },
    null,
    2,
  ),
);
