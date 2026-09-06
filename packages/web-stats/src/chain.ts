// Everything the page reads: the deployment check, the open epoch, the slot chunks the window
// needs, the rows, then supply, genesis and lottery; all through miner-core's reader, no wallet.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { makeFetch } from '@aztec/foundation/json-rpc/client';
import {
  assertDeployment,
  DEFAULT_LIMITS,
  type EpochRow,
  expectedFromStrings,
  type Layouts,
  layoutsFromJson,
  linkRows,
  type Node,
  readEpochs,
  readGenesis,
  readLottery,
  readOpenEpochNumber,
  readTotalSupply,
  type SlotLoader,
  type StorageLayout,
  slotTableFromJson,
} from '../../miner-core/src/reader.ts';
import { type Connection, expectedDeployment } from '../../site/src/browser/connection.ts';
import { boundNodeRequests } from '../../site/src/browser/node-deadline.ts';
import type { Chain } from './state';

/** Epochs per read: the first window and every "load older". */
export const WINDOW = 48;

export interface Reader {
  node: Node;
  miner: AztecAddress;
  token: AztecAddress;
  minerLayout: StorageLayout;
  tokenLayout: StorageLayout;
  load: SlotLoader;
}

/** The committed storage layouts, copied to `public/` by the prebuild. */
const layouts = async (): Promise<Layouts> =>
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

/** The boot check, then the layouts the reads need. */
export async function openReader(connection: Connection): Promise<Reader> {
  // A read the reader gave up on ends with it: one deadline per request, no transport retries
  // (the SDK's default would keep an abandoned read alive through three more attempts).
  boundNodeRequests(connection.nodeUrl, DEFAULT_LIMITS.timeoutMs);
  const node = createAztecNodeClient(connection.nodeUrl, {}, makeFetch([], false));
  const layout = await layouts();
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

const latestBlock = async (node: Node): Promise<Chain['block']> => {
  const data = await node.getBlockData('latest');
  if (!data) throw new Error('the node has no latest block');
  return {
    number: Number(data.header.globalVariables.blockNumber),
    timestamp: Number(data.header.globalVariables.timestamp),
  };
};

/** The rows of `[from, to]`, with the row after `to` (if any) so the last one closes. */
async function window(r: Reader, from: number, to: number, open: number): Promise<EpochRow[]> {
  const rows = await readEpochs(r.node, r.miner, { from, to: Math.min(open, to + 1) }, r.load, {
    limits: { ...DEFAULT_LIMITS, maxEpochs: WINDOW + 1 },
  });
  return rows.slice(0, to - from + 1);
}

/** The first read: the open epoch and the WINDOW epochs up to it, plus the fixed slots. */
export async function readChain(
  r: Reader,
  onStep: (step: string) => void,
): Promise<{ chain: Chain; historyError?: string }> {
  onStep('reading the open epoch');
  const [open, block] = await Promise.all([
    readOpenEpochNumber(r.node, r.miner, r.minerLayout),
    latestBlock(r.node),
  ]);
  onStep(`reading epochs ${Math.max(0, open - WINDOW + 1)} to ${open}`);
  let rows: EpochRow[] = [];
  let historyError: string | undefined;
  try {
    rows = await window(r, Math.max(0, open - WINDOW + 1), open, open);
  } catch (e) {
    // Beyond the table, or a chunk that did not load: the tiles that need no map slot still show.
    historyError = e instanceof Error ? e.message : String(e);
  }
  onStep('reading supply, genesis and the lottery');
  const [supply, genesis, lottery] = await Promise.all([
    readTotalSupply(r.node, r.token, r.tokenLayout),
    readGenesis(r.node, r.miner, r.minerLayout),
    readLottery(r.node, r.miner, r.minerLayout),
  ]);
  return {
    chain: { rows, open, supply, genesis, lottery, block, readAt: Date.now() },
    ...(historyError && { historyError }),
  };
}

/** "Load older": the WINDOW epochs before the oldest one held, joined to it. */
export async function readOlder(r: Reader, chain: Chain): Promise<Chain> {
  const oldest = chain.rows[0]?.epoch ?? chain.open;
  if (oldest === 0) return chain;
  const older = await window(r, Math.max(0, oldest - WINDOW), oldest - 1, chain.open);
  return { ...chain, rows: linkRows([...older, ...chain.rows]) };
}

/**
 * The poll: the open epoch, the supply and the block, then the rows from the last one held (it
 * may just have closed) to the open epoch. More closes than a window since the last read replace
 * the history with the newest window instead of leaving a gap; a history read that fails keeps
 * the rows held and still publishes the fixed slots.
 */
export async function pollChain(r: Reader, chain: Chain): Promise<{ chain: Chain; historyError?: string }> {
  const [open, block, supply] = await Promise.all([
    readOpenEpochNumber(r.node, r.miner, r.minerLayout),
    latestBlock(r.node),
    readTotalSupply(r.node, r.token, r.tokenLayout),
  ]);
  const next = { ...chain, open, supply, block, readAt: Date.now() };
  const from = Math.max(0, Math.min(chain.open, open) - 1, open - WINDOW + 1);
  try {
    const fresh = await window(r, from, open, open);
    const kept = chain.rows.filter((row) => row.epoch < from);
    const contiguous = kept.length === 0 || (kept[kept.length - 1] as EpochRow).epoch === from - 1;
    return { chain: { ...next, rows: linkRows(contiguous ? [...kept, ...fresh] : fresh) } };
  } catch (e) {
    return { chain: next, historyError: e instanceof Error ? e.message : String(e) };
  }
}
