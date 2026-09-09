import {
  readGenesis,
  readOpenEpochNumber,
  readTotalSupply,
  TABLE_EPOCHS,
} from '../../miner-core/src/reader.ts';
import { latestBlock, type Reader } from './chain';
import type { Fixed } from './state';

/** An open epoch the slot table can address; anything else (a lying node) is refused before it is walked. */
export function assertOpenEpoch(open: number): number {
  if (!Number.isSafeInteger(open) || open < 0 || open >= TABLE_EPOCHS)
    throw new Error(`the node reports open epoch ${open}: not an epoch this deployment can have`);
  return open;
}

/** Beat one: the open epoch's number and the latest block, with the supply and the genesis (fixed slots). */
export async function readFixed(r: Reader): Promise<Fixed> {
  const [open, block, supply, genesis] = await Promise.all([
    readOpenEpochNumber(r.node, r.miner, r.minerLayout),
    latestBlock(r.node),
    readTotalSupply(r.node, r.token, r.tokenLayout),
    readGenesis(r.node, r.miner, r.minerLayout),
  ]);
  return { open: assertOpenEpoch(open), block, supply, genesis, readAt: Date.now() };
}
