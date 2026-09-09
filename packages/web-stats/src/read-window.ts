import { DEFAULT_LIMITS, type EpochRow, readEpochs, readLottery } from '../../miner-core/src/reader.ts';
import { type Reader, WINDOW } from './chain';
import type { Lottery } from './state';

/** Beat two's rows: `[from, to]` read with the row after `to` (if any) so the last one closes, then cut back. */
export async function readWindowRows(r: Reader, from: number, to: number, open: number): Promise<EpochRow[]> {
  const rows = await readEpochs(r.node, r.miner, { from, to: Math.min(open, to + 1) }, r.load, {
    limits: { ...DEFAULT_LIMITS, maxEpochs: WINDOW + 1 },
  });
  return rows.slice(0, to - from + 1);
}

export const readLotteryOf = (r: Reader): Promise<Lottery> => readLottery(r.node, r.miner, r.minerLayout);
