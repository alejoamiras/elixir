// The live strip's reads: the open epoch with its seed (the demo proves against it), the twelve
// epochs before it, the supply and the block; genesis and the lottery in launch mode. One deadline
// per request and no transport retries, like the stats page; a failure keeps the last numbers.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { makeFetch } from '@aztec/foundation/json-rpc/client';
import {
  assertDeployment,
  DEFAULT_LIMITS,
  type EpochRow,
  epochExists,
  expectedFromStrings,
  linkRows,
  type Node,
  readEpochs,
  readGenesis,
  readLottery,
  readOpenEpochNumber,
  readTotalSupply,
  type SlotLoader,
  type StorageLayout,
} from '../../miner-core/src/reader.ts';
import { type Connection, expectedDeployment } from '../../site/src/browser/connection.ts';
import { boundNodeRequests } from '../../site/src/browser/node-deadline.ts';
import { chunkLoader, fetchLayouts } from '../../site/src/browser/slots.ts';

/** Closed epochs shown before the open one. */
export const HISTORY = 12;
export const POLL_MS = 60_000;

export interface Reader {
  node: Node;
  miner: AztecAddress;
  token: AztecAddress;
  minerLayout: StorageLayout;
  tokenLayout: StorageLayout;
  load: SlotLoader;
}

export interface Live {
  /** Ascending, contiguous, the open epoch last (with its seed); empty when `historyError` says why. */
  rows: EpochRow[];
  historyError?: string;
  open: number;
  supply: bigint;
  block: { number: number; timestamp: number };
  readAt: number;
}

export interface Launch {
  genesis: { target: bigint; seed: bigint; launchAt: number };
  lottery: { mix: bigint; reveals: number };
}

export async function openReader(connection: Connection): Promise<Reader> {
  boundNodeRequests(connection.nodeUrl, DEFAULT_LIMITS.timeoutMs);
  const node = createAztecNodeClient(connection.nodeUrl, {}, makeFetch([], false));
  const layout = await fetchLayouts();
  const expected = expectedDeployment();
  await assertDeployment(
    node,
    expectedFromStrings({
      chainId: expected.chainId.toString(),
      rollupVersion: expected.rollupVersion.toString(),
      miner: connection.miner,
      minerClassId: expected.minerClassId,
      token: connection.token,
      tokenClassId: expected.tokenClassId,
    }),
    layout.miner,
  );
  return {
    node,
    miner: AztecAddress.fromStringUnsafe(connection.miner),
    token: AztecAddress.fromStringUnsafe(connection.token),
    minerLayout: layout.miner,
    tokenLayout: layout.token,
    load: chunkLoader(),
  };
}

const latestBlock = async (node: Node): Promise<Live['block']> => {
  const data = await node.getBlockData('latest');
  if (!data) throw new Error('the node has no latest block');
  return {
    number: Number(data.header.globalVariables.blockNumber),
    timestamp: Number(data.header.globalVariables.timestamp),
  };
};

/** The open epoch's read runs beside the history's lanes; together they stay within the default bound. */
const HISTORY_LIMITS = { ...DEFAULT_LIMITS, concurrency: DEFAULT_LIMITS.concurrency - 1 };

/** The seed is a fourth read; only the open epoch needs it, so the history goes without. */
async function readRows(r: Reader, open: number): Promise<EpochRow[]> {
  const from = Math.max(0, open - HISTORY);
  const [history, current] = await Promise.all([
    from < open
      ? readEpochs(r.node, r.miner, { from, to: open - 1 }, r.load, { limits: HISTORY_LIMITS })
      : Promise.resolve([]),
    readEpochs(r.node, r.miner, { from: open, to: open }, r.load, { withSeed: true }),
  ]);
  // Linked as one list: the last history row closes against the open epoch.
  return linkRows([...history, ...current]);
}

/** The fixed slots publish even when the rows cannot be read (a chunk that did not load, a lying node). */
export async function readLive(r: Reader): Promise<Live> {
  const [open, block, supply] = await Promise.all([
    readOpenEpochNumber(r.node, r.miner, r.minerLayout),
    latestBlock(r.node),
    readTotalSupply(r.node, r.token, r.tokenLayout),
  ]);
  const fixed = { open, supply, block, readAt: Date.now() };
  try {
    return { ...fixed, rows: await readRows(r, open) };
  } catch (e) {
    return { ...fixed, rows: [], historyError: e instanceof Error ? e.message : String(e) };
  }
}

export const readLaunch = async (r: Reader): Promise<Launch> => {
  const [genesis, lottery] = await Promise.all([
    readGenesis(r.node, r.miner, r.minerLayout),
    readLottery(r.node, r.miner, r.minerLayout),
  ]);
  return { genesis, lottery };
};

/** Whether `launch()` has opened epoch 0. */
export const readLaunched = (r: Reader): Promise<boolean> => epochExists(r.node, r.miner, 0, r.load);
