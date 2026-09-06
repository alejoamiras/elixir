// The slot table the stats and landing pages read epochs through: the map slots of `epochs[e]`
// and `claims[e]` for every epoch under TABLE_EPOCHS, 512 per JSON chunk, derived once here (bb.js
// Poseidon2) so no page ships WASM for a hash it can look up.
//   bun packages/miner-core/scripts/gen-slots.ts [out-dir]   (default: packages/miner-core/generated/slots)
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHUNK, slotTableToJson, TABLE_EPOCHS } from '../src/reader.ts';
import { deriveSlotTable, LAYOUTS_PATH, loadLayouts } from '../src/slots.ts';

export const DEFAULT_OUT = resolve(import.meta.dir, '../generated/slots');
/** Written next to the chunks: the layout they were derived from, so a stale table is detected. */
const STAMP = '.layout.json';

/** True when `out` holds every chunk derived from the current layout fixture. */
export async function slotsCurrent(out = DEFAULT_OUT): Promise<boolean> {
  const stamp = Bun.file(resolve(out, STAMP));
  if (!(await stamp.exists())) return false;
  if ((await stamp.text()) !== (await Bun.file(LAYOUTS_PATH).text())) return false;
  for (let c = 0; c < TABLE_EPOCHS / CHUNK; c++)
    if (!(await Bun.file(resolve(out, `${c}.json`)).exists())) return false;
  return true;
}

export async function generateSlots(out = DEFAULT_OUT): Promise<number> {
  const layout = (await loadLayouts()).miner;
  mkdirSync(out, { recursive: true });
  const chunks = TABLE_EPOCHS / CHUNK;
  for (let c = 0; c < chunks; c++)
    writeFileSync(resolve(out, `${c}.json`), slotTableToJson(await deriveSlotTable(layout, c)));
  writeFileSync(resolve(out, STAMP), await Bun.file(LAYOUTS_PATH).text());
  return chunks;
}

if (import.meta.main) {
  const out = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT;
  const t0 = performance.now();
  const chunks = await generateSlots(out);
  console.log(
    `${chunks} chunks of ${CHUNK} epochs in ${out} (${((performance.now() - t0) / 1000).toFixed(1)} s)`,
  );
}
