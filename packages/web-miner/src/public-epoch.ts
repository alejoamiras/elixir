// The epoch the cockpit shows before an account is open: read from public storage through the slot
// table (the stats page's path, no account and no simulation) and written to `epochAtom` until the
// controller's first read takes the atom over. A write is dropped once the poll is stopped, or when
// the atom already holds a newer epoch, so a late public read can never overwrite fresher claims.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { createStore } from 'jotai';
import { readEpochs, readOpenEpochNumber } from '../../miner-core/src/reader.ts';
import { markRead } from '../../site/src/browser/node-health.ts';
import { chunkLoader } from '../../site/src/browser/slots.ts';
import type { EpochInfo } from './lib/reducer';
import { epochAtom } from './state';

type Store = ReturnType<typeof createStore>;
type ReaderArgs = Parameters<typeof readOpenEpochNumber>;

export const PUBLIC_EPOCH_POLL_MS = 30_000;

export interface PublicEpochPoll {
  /** Reads at once, then every interval; a no-op while running. */
  start(): void;
  /** The handover: nothing already out lands after this. */
  stop(): void;
  /** One read now (the one in flight, if any); resolves when it settled. */
  tick(): Promise<void>;
}

/** The open epoch's public facts, the way the stats page reads them. */
export function publicEpochReader(
  node: ReaderArgs[0],
  miner: AztecAddress,
  layout: ReaderArgs[2],
  load = chunkLoader(),
): () => Promise<EpochInfo> {
  return async () => {
    const open = await readOpenEpochNumber(node, miner, layout);
    const [row] = await readEpochs(node, miner, { from: open, to: open }, load, { withSeed: true });
    if (!row || row.seed === undefined) throw new Error(`epoch ${open} is beyond the slot table`);
    return {
      epoch: BigInt(open),
      seed: row.seed,
      target: row.target,
      openedAt: BigInt(row.openedAt),
      claims: row.claims,
    };
  };
}

export function startPublicEpoch(
  store: Store,
  read: () => Promise<EpochInfo>,
  opts: { intervalMs?: number; log?: (line: string) => void } = {},
): PublicEpochPoll {
  let timer: ReturnType<typeof setInterval> | undefined;
  let inflight: Promise<void> | undefined;
  // Bumped by start and stop: a read that was out across either writes nothing.
  let generation = 0;
  const run = async (gen: number) => {
    try {
      const info = await read();
      if (gen !== generation) return;
      const prev = store.get(epochAtom);
      if (prev && info.epoch < prev.epoch) return;
      store.set(epochAtom, info);
      markRead();
    } catch (e) {
      opts.log?.(`public epoch: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const tick = (): Promise<void> => {
    if (!timer) return Promise.resolve();
    if (!inflight)
      inflight = run(generation).finally(() => {
        inflight = undefined;
      });
    return inflight;
  };
  return {
    start() {
      if (timer) return;
      generation++;
      timer = setInterval(() => void tick(), opts.intervalMs ?? PUBLIC_EPOCH_POLL_MS);
      void tick();
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
      generation++;
    },
    tick,
  };
}
