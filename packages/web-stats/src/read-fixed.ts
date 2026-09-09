import { readGenesis, readOpenEpochNumber, readTotalSupply } from '../../miner-core/src/reader.ts';
import { latestBlock, type Reader } from './chain';
import type { Fixed } from './state';

/** Beat one: the open epoch's number and the latest block, with the supply and the genesis (fixed slots). */
export async function readFixed(r: Reader): Promise<Fixed> {
  const [open, block, supply, genesis] = await Promise.all([
    readOpenEpochNumber(r.node, r.miner, r.minerLayout),
    latestBlock(r.node),
    readTotalSupply(r.node, r.token, r.tokenLayout),
    readGenesis(r.node, r.miner, r.minerLayout),
  ]);
  return { open, block, supply, genesis, readAt: Date.now() };
}
