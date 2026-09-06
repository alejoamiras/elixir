// What a page fetches from its own origin to read epochs: the committed storage layouts and the
// slot table's chunks, both copied under `public/` by the app's prebuild.
import {
  type Layouts,
  layoutsFromJson,
  type SlotLoader,
  slotTableFromJson,
} from '../../../miner-core/src/reader.ts';

export const fetchLayouts = async (): Promise<Layouts> =>
  layoutsFromJson(await (await fetch(`${import.meta.env.BASE_URL}layouts.json`)).text());

/** One fetch per chunk, cached for the page's life; the chunk is checked before it is trusted. */
export const chunkLoader = (): SlotLoader => {
  const cache = new Map<number, Promise<ReturnType<typeof slotTableFromJson>>>();
  return (chunk) => {
    let p = cache.get(chunk);
    if (!p) {
      p = fetch(`${import.meta.env.BASE_URL}slots/${chunk}.json`).then(async (r) => {
        if (!r.ok) throw new Error(`slot chunk ${chunk}: ${r.status}`);
        return slotTableFromJson(await r.text(), chunk);
      });
      cache.set(chunk, p);
      p.catch(() => cache.delete(chunk));
    }
    return p;
  };
};
