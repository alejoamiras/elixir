// The slot table's derivation: Poseidon2 through bb.js, so only the generator and the Bun-side
// readers import this; a page fetches the generated chunks instead.
import { Fr } from '@aztec/aztec.js/fields';
import { deriveStorageSlotInMap } from '@aztec/stdlib/hash';
import { CHUNK, fixedSlot, type SlotTable, type StorageLayout } from './reader.ts';

export async function deriveSlotTable(layout: StorageLayout, chunk: number): Promise<SlotTable> {
  const first = chunk * CHUNK;
  const key = (e: number) => ({ toField: () => new Fr(e) });
  const epochs: Fr[] = [];
  const claims: Fr[] = [];
  for (let e = first; e < first + CHUNK; e++) {
    epochs.push(await deriveStorageSlotInMap(fixedSlot(layout, 'epochs'), key(e)));
    claims.push(await deriveStorageSlotInMap(fixedSlot(layout, 'claims'), key(e)));
  }
  return { first, epochs, claims };
}
