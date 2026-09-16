// When Ethereum last accepted a proof of a version: the block timestamp of the Rollup's latest
// `L2ProofVerified`, read through the RPC. The moment this page noticed a checkpoint move proves
// nothing about when the proof landed, so the event is the only source. The scan runs newest-first
// from the L1 head under a request budget per call and resumes from its cursor, so a cold start on
// a quiet rollup never monopolises a refresh; an incomplete scan is `unknown`, never "no proof".
import { RollupAbi } from '@aztec/l1-artifacts/RollupAbi';
import type { Hex, PublicClient } from 'viem';
import { LOG_WINDOW, type LogClient } from './logs.ts';

export interface ProvenAt {
  /** Unix seconds of the block the proof was verified in. */
  at: bigint;
  checkpoint: bigint;
  block: bigint;
}

/** `unknown`: the scan is not finished; `none`: the floor reached without an event. */
export type ProofReading = ProvenAt | 'unknown' | 'none';

export interface ProofReader {
  latestProvenAt(): Promise<ProofReading>;
}

export type ProofClient = LogClient & Pick<PublicClient, 'getBlock' | 'getBlockNumber'>;

export interface ProofScan {
  rollup: Hex;
  /** The block the version's rollup was born at, or the earliest one worth scanning: below it there is no event. */
  floor: () => Promise<bigint>;
  /** `eth_getLogs` calls per `latestProvenAt`. */
  budget?: number;
  /** Blocks re-read behind a known event at each call: a reorg can drop it. */
  overlap?: bigint;
}

const scanWindow = (client: LogClient, rollup: Hex, fromBlock: bigint, toBlock: bigint) =>
  client.getContractEvents({
    address: rollup,
    abi: RollupAbi,
    eventName: 'L2ProofVerified',
    fromBlock,
    toBlock,
    strict: true,
  });

export function proofReader(client: ProofClient, scan: ProofScan): ProofReader {
  const budget = scan.budget ?? 4;
  const overlap = scan.overlap ?? 12n;
  let known: ProvenAt | undefined;
  /** The block below the last window a backward scan read; the next call continues from it. */
  let cursor: bigint | undefined;
  const provenAt = async (log: {
    args: { checkpointNumber: bigint };
    blockNumber: bigint;
  }): Promise<ProvenAt> => ({
    at: (await client.getBlock({ blockNumber: log.blockNumber })).timestamp,
    checkpoint: log.args.checkpointNumber,
    block: log.blockNumber,
  });
  const newest = <T extends { blockNumber: bigint; logIndex: number }>(logs: readonly T[]): T | undefined =>
    logs.reduce<T | undefined>(
      (best, l) =>
        !best ||
        l.blockNumber > best.blockNumber ||
        (l.blockNumber === best.blockNumber && l.logIndex > best.logIndex)
          ? l
          : best,
      undefined,
    );

  /** Forward from `from` to the head under the budget: the newest event met, and whether the head was reached. */
  const forward = async (from: bigint, head: bigint): Promise<{ found?: ProvenAt; complete: boolean }> => {
    let found: ProvenAt | undefined;
    let spent = 0;
    for (let lo = from; lo <= head; lo += LOG_WINDOW) {
      if (spent++ >= budget) return { found, complete: false };
      const hi = lo + LOG_WINDOW - 1n < head ? lo + LOG_WINDOW - 1n : head;
      const top = newest(await scanWindow(client, scan.rollup, lo, hi));
      if (top) found = await provenAt(top);
    }
    return { found, complete: true };
  };

  /** Over the blocks since the known event, less the overlap: a newer event replaces it; none at all means a reorg took it. */
  const advance = async (head: bigint, floor: bigint): Promise<ProofReading> => {
    const k = known as ProvenAt;
    const behind = k.block > overlap ? k.block - overlap : 0n;
    const { found, complete } = await forward(behind < floor ? floor : behind, head);
    if (found) known = found;
    else if (complete) {
      known = undefined;
      cursor = undefined;
      return 'unknown';
    }
    return known ?? k;
  };

  /** Backward from the cursor (or the head) to the floor, one window at a time under the budget. */
  const search = async (head: bigint, floor: bigint): Promise<ProofReading> => {
    let hi = cursor ?? head;
    for (let spent = 0; spent < budget; spent++) {
      if (hi < floor) {
        cursor = undefined;
        return 'none';
      }
      const lo = hi - LOG_WINDOW + 1n > floor ? hi - LOG_WINDOW + 1n : floor;
      const top = newest(await scanWindow(client, scan.rollup, lo, hi));
      if (top) {
        known = await provenAt(top);
        cursor = undefined;
        return known;
      }
      hi = lo - 1n;
    }
    cursor = hi;
    return 'unknown';
  };

  return {
    async latestProvenAt() {
      const [head, floor] = await Promise.all([client.getBlockNumber({ cacheTime: 0 }), scan.floor()]);
      return known ? advance(head, floor) : search(head, floor);
    },
  };
}
