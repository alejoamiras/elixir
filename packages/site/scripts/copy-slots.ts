// The slot table and the storage layouts a page reads epochs through: the chunks are generated
// into miner-core's gitignored `generated/slots` when missing, stale or damaged, then copied under
// <public>/slots next to a copy of the committed layouts.
//   bun packages/site/scripts/copy-slots.ts <public dir>
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_OUT, generateSlots, STAMP, slotsCurrent } from '../../miner-core/scripts/gen-slots.ts';
import { CHUNK, TABLE_EPOCHS } from '../../miner-core/src/reader.ts';
import { LAYOUTS_PATH } from '../../miner-core/src/slots.ts';

export async function copySlots(publicDir: string): Promise<string> {
  const slots = resolve(publicDir, 'slots');
  if (!(await slotsCurrent(DEFAULT_OUT))) await generateSlots(DEFAULT_OUT);
  rmSync(slots, { recursive: true, force: true });
  mkdirSync(slots, { recursive: true });
  cpSync(DEFAULT_OUT, slots, { recursive: true, filter: (src) => !src.endsWith(STAMP) });
  cpSync(LAYOUTS_PATH, resolve(publicDir, 'layouts.json'));
  return `slots: ${TABLE_EPOCHS / CHUNK} chunks and both layouts in ${publicDir}`;
}

if (import.meta.main) {
  const publicDir = process.argv[2];
  if (!publicDir) throw new Error('usage: copy-slots.ts <public dir>');
  console.log(await copySlots(resolve(publicDir)));
}
