// What the page fetches besides its bundle: the slot table (generated into miner-core's gitignored
// `generated/slots` when missing or derived from another layout, copied under `public/slots`) and
// the committed storage layouts.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_OUT, generateSlots, slotsCurrent } from '../../miner-core/scripts/gen-slots.ts';
import { CHUNK, TABLE_EPOCHS } from '../../miner-core/src/reader.ts';
import { LAYOUTS_PATH } from '../../miner-core/src/slots.ts';

const publicDir = resolve(import.meta.dir, '../public');
const slots = resolve(publicDir, 'slots');
if (!(await slotsCurrent(DEFAULT_OUT))) await generateSlots(DEFAULT_OUT);
rmSync(slots, { recursive: true, force: true });
mkdirSync(slots, { recursive: true });
cpSync(DEFAULT_OUT, slots, { recursive: true, filter: (src) => !src.endsWith('.layout.json') });
cpSync(LAYOUTS_PATH, resolve(publicDir, 'layouts.json'));
console.log(`slots: ${TABLE_EPOCHS / CHUNK} chunks and both layouts in public/`);
