// What the page fetches besides its bundle: the slot table and the storage layouts.
import { resolve } from 'node:path';
import { copySlots } from '../../site/scripts/copy-slots.ts';

console.log(await copySlots(resolve(import.meta.dir, '../public')));
