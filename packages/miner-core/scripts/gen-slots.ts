// The slot table the stats and landing pages read epochs through: the map slots of `epochs[e]`
// and `claims[e]` for every epoch under TABLE_EPOCHS, 512 per JSON chunk, derived once here (bb.js
// Poseidon2) so no page ships WASM for a hash it can look up.
//   bun packages/miner-core/scripts/gen-slots.ts [out-dir]   (default: packages/miner-core/generated/slots)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHUNK, slotTableToJson, TABLE_EPOCHS } from '../src/reader.ts';
import { deriveSlotTable, LAYOUTS_PATH, loadLayouts } from '../src/slots.ts';

export const DEFAULT_OUT = resolve(import.meta.dir, '../generated/slots');
/** Written next to the chunks: the layout they were derived from and a digest of each. */
export const STAMP = '.stamp.json';
type Stamp = { layout: string; sha256: string[] };
const CHUNKS = TABLE_EPOCHS / CHUNK;
const sha256 = (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex');

/** True when `out` holds every chunk, intact, derived from the current layout fixture. */
export async function slotsCurrent(out = DEFAULT_OUT): Promise<boolean> {
  let stamp: Partial<Stamp>;
  try {
    stamp = JSON.parse(await Bun.file(resolve(out, STAMP)).text()) as Partial<Stamp>;
  } catch {
    return false;
  }
  if (typeof stamp !== 'object' || stamp === null) return false;
  if (stamp.layout !== (await Bun.file(LAYOUTS_PATH).text())) return false;
  if (!Array.isArray(stamp.sha256) || stamp.sha256.length !== CHUNKS) return false;
  for (let c = 0; c < CHUNKS; c++) {
    const chunk = Bun.file(resolve(out, `${c}.json`));
    if (!(await chunk.exists()) || sha256(await chunk.text()) !== stamp.sha256[c]) return false;
  }
  return true;
}

export async function generateSlots(out = DEFAULT_OUT): Promise<number> {
  const layout = (await loadLayouts()).miner;
  mkdirSync(out, { recursive: true });
  const stamp: Stamp = { layout: await Bun.file(LAYOUTS_PATH).text(), sha256: [] };
  for (let c = 0; c < CHUNKS; c++) {
    const text = slotTableToJson(await deriveSlotTable(layout, c));
    writeFileSync(resolve(out, `${c}.json`), text);
    stamp.sha256.push(sha256(text));
  }
  writeFileSync(resolve(out, STAMP), JSON.stringify(stamp));
  return CHUNKS;
}

if (import.meta.main) {
  const out = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT;
  const t0 = performance.now();
  const chunks = await generateSlots(out);
  console.log(
    `${chunks} chunks of ${CHUNK} epochs in ${out} (${((performance.now() - t0) / 1000).toFixed(1)} s)`,
  );
}
