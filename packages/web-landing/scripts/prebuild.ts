// What the page fetches besides its bundle: the slot table and the storage layouts (the hero's live
// numbers); under public/, gitignored. The landing carries no prover, so no CRS and no circuit.
import { resolve } from 'node:path';
import { copySlots } from '@yacana/site/scripts/copy-slots';

console.log(await copySlots(resolve(import.meta.dir, '../public')));
