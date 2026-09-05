// Prints the significant byte width of each proof field, 50 per line: commitment limbs are
// ≤ 17 bytes, scalars are full 32-byte fields, so transcript phase boundaries are visible.
//   bun packages/work-circuit/scripts/proof-shape.ts <proof file>
const path = process.argv[2];
if (!path) throw new Error('usage: proof-shape.ts <proof file>');
const p = new Uint8Array(await Bun.file(path).arrayBuffer());
const n = p.length / 32;
let out = '';
for (let i = 0; i < n; i++) {
  const f = p.subarray(i * 32, i * 32 + 32);
  let lz = 0;
  while (lz < 32 && f[lz] === 0) lz++;
  out += (32 - lz).toString(36) + (i % 50 === 49 ? '\n' : '');
}
console.log(`${n} fields\n${out}`);

export {};
