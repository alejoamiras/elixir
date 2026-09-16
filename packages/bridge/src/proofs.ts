// When Ethereum last accepted a proof of a version: the timestamp of the block the Rollup's latest
// `L2ProofVerified` is in. The moment this page noticed a checkpoint move says nothing about when
// the proof landed, so the event is the only source. The chain is longer than one `eth_getLogs`
// allows, so the scan is spread over refreshes — newest-first to an event, forward from it after
// that, its progress kept either way. `unknown` means the scan is unfinished or its floor is only a
// guess; `none` is an absence, and only an exact floor can prove one.
import { RollupAbi } from '@aztec/l1-artifacts/RollupAbi';
import type { Hex, PublicClient } from 'viem';
import { LOG_WINDOW, type LogClient } from './logs.ts';

export interface ProvenAt {
  /** Unix seconds of the block the proof was verified in. */
  at: bigint;
  checkpoint: bigint;
  block: bigint;
}

export type ProofReading = ProvenAt | 'unknown' | 'none';

export interface ProofReader {
  latestProvenAt(): Promise<ProofReading>;
}

export type ProofClient = LogClient & Pick<PublicClient, 'getBlock' | 'getBlockNumber'>;

export interface ProofFloor {
  block: bigint;
  /** Whether nothing below `block` can hold an event. A guess bounds the search; it never proves `none`. */
  exact: boolean;
}

export interface ProofScan {
  rollup: Hex;
  floor: () => Promise<ProofFloor>;
  /** `eth_getLogs` calls per `latestProvenAt`. */
  budget?: number;
  /** Blocks re-read around a known event each call: a reorg can drop it. */
  overlap?: bigint;
}

type Log = { blockNumber: bigint; logIndex: number; args: { checkpointNumber: bigint } };

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

/** The window ending at `hi`, never reaching below the floor. */
const windowOf = (hi: bigint, floor: bigint) => (hi - LOG_WINDOW + 1n > floor ? hi - LOG_WINDOW + 1n : floor);

/** The chain reads the scan makes: a window of the Rollup's proof events, and one event's time. */
const chainReads = (client: ProofClient, rollup: Hex) => ({
  logs: (fromBlock: bigint, toBlock: bigint) =>
    client.getContractEvents({
      address: rollup,
      abi: RollupAbi,
      eventName: 'L2ProofVerified',
      fromBlock,
      toBlock,
      // Only logs whose data decodes in full: an event with a missing field is no event.
      strict: true,
    }) as Promise<readonly Log[]>,
  provenAt: async (log: Log): Promise<ProvenAt> => ({
    at: (await client.getBlock({ blockNumber: log.blockNumber })).timestamp,
    checkpoint: log.args.checkpointNumber,
    block: log.blockNumber,
  }),
});

export function proofReader(client: ProofClient, scan: ProofScan): ProofReader {
  const budget = scan.budget ?? 4;
  const overlap = scan.overlap ?? 12n;
  /** The newest event found so far: a real event, even while the scan above it is unfinished. */
  let known: ProvenAt | undefined;
  /** Every block up to here has been read for something newer than `known`. */
  let scannedTo = 0n;
  /** The backward walk's next upper bound, and the head it started from: blocks above that head are unread. */
  let cursor: bigint | undefined;
  let searchedFrom: bigint | undefined;

  const { logs, provenAt } = chainReads(client, scan.rollup);

  const forget = () => {
    known = undefined;
    scannedTo = 0n;
    cursor = undefined;
    searchedFrom = undefined;
  };

  /** The known event re-read around itself: gone from there means a reorg took it. One call. */
  const confirm = async (k: ProvenAt, floor: bigint, head: bigint): Promise<boolean> => {
    // A head below the event's own block is a chain that no longer reaches it: nothing to re-read.
    if (k.block > head) return false;
    const lo = k.block > overlap ? k.block - overlap : 0n;
    const hi = k.block + overlap < head ? k.block + overlap : head;
    const top = newest(await logs(lo < floor ? floor : lo, hi));
    if (!top) return false;
    if (top.blockNumber >= k.block) known = await provenAt(top);
    if (hi > scannedTo) scannedTo = hi;
    return true;
  };

  /** Forward to the head under `spend` calls, keeping the progress: a newer event replaces the known one. */
  const forward = async (from: bigint, head: bigint, spend: number): Promise<void> => {
    let lo = from;
    for (let spent = 0; lo <= head && spent < spend; spent++) {
      const hi = lo + LOG_WINDOW - 1n < head ? lo + LOG_WINDOW - 1n : head;
      const top = newest(await logs(lo, hi));
      if (top) known = await provenAt(top);
      scannedTo = hi;
      lo = hi + 1n;
    }
  };

  /** Blocks that did not exist when the walk started: the newest event may be among them. */
  const catchUp = async (head: bigint): Promise<boolean> => {
    if (searchedFrom === undefined || head <= searchedFrom) return false;
    await forward(searchedFrom + 1n, head, budget);
    searchedFrom = head;
    return known !== undefined;
  };

  /** A head that retreated took blocks with it: progress above it is progress over nothing. */
  const clampTo = (head: bigint) => {
    if (scannedTo > head) scannedTo = head;
    if (searchedFrom !== undefined && searchedFrom > head) searchedFrom = head;
  };

  /** The walk found its event: everything above it was read on the way down and held nothing newer. */
  const take = async (top: Log): Promise<ProvenAt> => {
    known = await provenAt(top);
    scannedTo = searchedFrom ?? known.block;
    cursor = undefined;
    return known;
  };

  /** The walk reached the floor: an absence, but only a floor that is exact can prove one. */
  const exhausted = (floor: ProofFloor): ProofReading => {
    cursor = undefined;
    return floor.exact ? 'none' : 'unknown';
  };

  /** Newest-first to the floor under the budget; the cursor carries the walk into the next call. */
  const walkDown = async (floor: ProofFloor, head: bigint): Promise<ProofReading> => {
    let hi = cursor !== undefined && cursor < head ? cursor : head;
    for (let spent = 0; spent < budget; spent++) {
      if (hi < floor.block) return exhausted(floor);
      const lo = windowOf(hi, floor.block);
      const top = newest(await logs(lo, hi));
      if (top) return take(top);
      hi = lo - 1n;
    }
    cursor = hi;
    return 'unknown';
  };

  const backward = async (floor: ProofFloor, head: bigint): Promise<ProofReading> => {
    if (await catchUp(head)) return known as ProvenAt;
    searchedFrom ??= head;
    return walkDown(floor, head);
  };

  return {
    async latestProvenAt() {
      const [head, floor] = await Promise.all([client.getBlockNumber({ cacheTime: 0 }), scan.floor()]);
      if (floor.block > head) return 'unknown';
      clampTo(head);
      if (known) {
        if (await confirm(known, floor.block, head)) {
          await forward(scannedTo + 1n, head, budget - 1);
          return known as ProvenAt;
        }
        forget();
      }
      return backward(floor, head);
    },
  };
}
