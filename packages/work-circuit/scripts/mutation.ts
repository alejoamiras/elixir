// Native mutation tests on the fixture proof: every single field, random multi-field
// combinations, wrong public inputs, wrong VK, and a ZK-flavour proof against the non-ZK
// verifier. Every case must fail `bb verify`; the unmodified proof must pass.
//   bun packages/work-circuit/scripts/mutation.ts [--combos 50] [--seed 1]
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { $ } from 'bun';
import { BB, workCircuitRoot } from './toolchain.ts';

const args = process.argv.slice(2);
const opt = (name: string, dflt: number) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const combos = opt('--combos', 50);
let seed = opt('--seed', 1) >>> 0;
const rand = () => {
  // xorshift32: reproducible combinations without a dependency
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 2 ** 32;
};

const root = workCircuitRoot;
const fixtures = resolve(root, 'fixtures', 'yacana_work');
const scratch = resolve(root, 'target', 'mutation');
mkdirSync(scratch, { recursive: true });
const proof = new Uint8Array(await Bun.file(`${fixtures}/proof`).arrayBuffer());
const publicInputs = new Uint8Array(await Bun.file(`${fixtures}/public_inputs`).arrayBuffer());
const n = proof.length / 32;

async function verify(p: Uint8Array, pi = publicInputs, vk = `${fixtures}/vk`): Promise<boolean> {
  await Bun.write(`${scratch}/proof`, p);
  await Bun.write(`${scratch}/public_inputs`, pi);
  const r =
    await $`${BB} verify -p ${scratch}/proof -i ${scratch}/public_inputs -k ${vk} --scheme ultra_honk -t noir-recursive-no-zk`
      .cwd(root)
      .nothrow()
      .quiet();
  return r.exitCode === 0;
}
const flip = (p: Uint8Array, i: number, bit = 0): Uint8Array => {
  const m = p.slice();
  const byte = i * 32 + 31 - (bit >> 3);
  m[byte] = (m[byte] ?? 0) ^ (1 << (bit & 7));
  return m;
};

if (!(await verify(proof))) throw new Error('fixture proof does not verify');
const t0 = Date.now();
const survivors: number[] = [];
for (let i = 0; i < n; i++) if (await verify(flip(proof, i))) survivors.push(i);
console.log(
  `single-field (lowest bit) flips: ${n} tried, ${survivors.length} still verify ${JSON.stringify(survivors)} — ${((Date.now() - t0) / 1000).toFixed(0)} s`,
);

const comboSurvivors: number[][] = [];
for (let c = 0; c < combos; c++) {
  const k = 2 + Math.floor(rand() * 7);
  const idx = new Set<number>();
  while (idx.size < k) idx.add(Math.floor(rand() * n));
  let m: Uint8Array = proof;
  for (const i of idx) m = flip(m, i, Math.floor(rand() * 254));
  if (await verify(m)) comboSurvivors.push([...idx]);
}
console.log(
  `multi-field flips (2–8 fields, random bits): ${combos} tried, ${comboSurvivors.length} still verify ${JSON.stringify(comboSurvivors)}`,
);

const wrongPi = publicInputs.slice();
wrongPi[wrongPi.length - 1] ^= 1; // the circuit's output field
const wrongPiOk = await verify(proof, wrongPi);
const wrongVkOk = await verify(proof, publicInputs, resolve(root, 'target', 'sweep_1024', 'vk'));
console.log(`wrong public inputs verifies: ${wrongPiOk}; wrong VK (sweep_1024) verifies: ${wrongVkOk}`);

// ZK-flavour proof (verifier target noir-recursive) checked with the non-ZK verifier target.
const zkDir = resolve(root, 'target', 'yacana_work-zk');
await $`${BB} write_vk -b ${root}/target/yacana_work.json --scheme ultra_honk -t noir-recursive -o ${zkDir}`
  .cwd(root)
  .quiet();
await $`${BB} prove -b ${root}/target/yacana_work.json -w ${root}/target/yacana_work.gz -k ${zkDir}/vk --scheme ultra_honk -t noir-recursive -o ${zkDir}`
  .cwd(root)
  .quiet();
// A bit flip in a commitment limb yields an invalid point encoding, which says nothing about the
// transcript binding that commitment. Replace whole points with other VALID points instead: the
// BN254 generator (1, 2) and the proof's own points moved to another slot.
const G1 = [1n, 0n, 2n, 0n];
const setPoint = (p: Uint8Array, slot: number, limbs: bigint[]): Uint8Array => {
  const m = p.slice();
  for (const [k, v] of limbs.entries())
    m.set(Buffer.from(v.toString(16).padStart(64, '0'), 'hex'), (slot + k) * 32);
  return m;
};
const pointAt = (p: Uint8Array, slot: number): bigint[] =>
  [0, 1, 2, 3].map((k) =>
    BigInt(`0x${Buffer.from(p.subarray((slot + k) * 32, (slot + k + 1) * 32)).toString('hex')}`),
  );
const validPointCases: Record<string, Uint8Array> = {
  'io P0 := G1': setPoint(proof, 0, G1),
  // W has no inner recursion, so its pairing inputs are points at infinity (all-zero limbs).
  'io P0 := W_L': setPoint(proof, 0, pointAt(proof, 8)),
  'oink W_L := G1': setPoint(proof, 8, G1),
  'oink W_L := W_R': setPoint(proof, 8, pointAt(proof, 12)),
  'gemini FOLD_1 := G1': setPoint(proof, 281, G1),
  'gemini FOLD_1 := FOLD_2': setPoint(proof, 281, pointAt(proof, 285)),
  'shplonk Q := KZG W': setPoint(proof, 402, pointAt(proof, 406)),
  'kzg W := G1': setPoint(proof, 406, G1),
};
const validPointSurvivors: string[] = [];
for (const [name, m] of Object.entries(validPointCases)) if (await verify(m)) validPointSurvivors.push(name);
console.log(
  `valid-point substitutions: ${Object.keys(validPointCases).length} tried, ${validPointSurvivors.length} still verify ${JSON.stringify(validPointSurvivors)}`,
);

const zkProof = new Uint8Array(await Bun.file(`${zkDir}/proof`).arrayBuffer());
const zkAgainstNonZk = await verify(zkProof);
const zkAgainstNonZkOwnVk = await verify(zkProof, publicInputs, `${zkDir}/vk`);
console.log(
  `ZK proof (${zkProof.length / 32} fields) with non-ZK verifier: vs W_VK ${zkAgainstNonZk}; vs its own ZK vk ${zkAgainstNonZkOwnVk}`,
);

const bad =
  survivors.length ||
  comboSurvivors.length ||
  validPointSurvivors.length ||
  wrongPiOk ||
  wrongVkOk ||
  zkAgainstNonZk ||
  zkAgainstNonZkOwnVk;
await Bun.write(
  `${scratch}/results.json`,
  JSON.stringify(
    {
      n,
      survivors,
      combos,
      comboSurvivors,
      wrongPiOk,
      wrongVkOk,
      zkFields: zkProof.length / 32,
      zkAgainstNonZk,
      zkAgainstNonZkOwnVk,
    },
    null,
    2,
  ),
);
if (bad) process.exit(1);
