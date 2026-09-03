import { $ } from "bun";
const BB = `${process.env.HOME}/.aztec/current/node_modules/.bin/bb`;
const proof = new Uint8Array(await Bun.file("target/out/proof").arrayBuffer());
const n = proof.length / 32;
console.log("proof bytes:", proof.length, "fields:", n);
async function verify(bytes: Uint8Array) {
  await Bun.write("target/out/proof_mut", bytes);
  const r = await $`${BB} verify -p target/out/proof_mut -i target/out/public_inputs -k target/vk/vk --scheme ultra_honk -t noir-recursive-no-zk`.nothrow().quiet();
  return { ok: r.exitCode === 0, out: (r.stdout.toString() + r.stderr.toString()).trim().split("\n").slice(-1)[0] };
}
const base = await verify(proof);
console.log("unmodified verifies:", base.ok, "|", base.out);
if (!base.ok) process.exit(1);
const free: number[] = [];
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const m = proof.slice(); m[i*32 + 31] ^= 1;   // flip lowest bit of field i (big-endian)
  const r = await verify(m);
  if (r.ok) free.push(i);
  if (i % 50 === 49) console.log(`checked ${i+1}/${n}, free so far: ${free.length}, ${((Date.now()-t0)/1000).toFixed(0)}s`);
}
console.log("UNCONSTRAINED field indices (verify still passes after 1-bit flip):", JSON.stringify(free));
console.log("count:", free.length, "of", n);
