// Everything the page reads, in the order the plan draws: the deployment check, the open epoch,
// the slot chunks the window needs, the rows, then supply, genesis and lottery. Every read goes
// through miner-core's reader; nothing here touches a wallet.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import {
  assertDeployment,
  DEFAULT_LIMITS,
  type EpochRow,
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
  slotTableFromJson,
} from '../../miner-core/src/reader.ts';
import { type Connection, expectedDeployment } from '../../site/src/browser/connection.ts';
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

/** The storage layouts the prebuild extracted from the artifacts: all the page needs of them. */
async function layouts(): Promise<{ miner: StorageLayout; token: StorageLayout }> {
  const raw = (await (await fetch(`${import.meta.env.BASE_URL}layouts.json`)).json()) as Record<
    'miner' | 'token',
    Record<string, string>
  >;
  const toLayout = (o: Record<string, string>): StorageLayout =>
    Object.fromEntries(Object.entries(o).map(([name, slot]) => [name, { slot: Fr.fromString(slot) }]));
  return { miner: toLayout(raw.miner), token: toLayout(raw.token) };
}

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

/** The boot check, then the artifacts the reads need. */
export async function openReader(connection: Connection): Promise<Reader> {
  const node = createAztecNodeClient(connection.nodeUrl);
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
 * The poll: the open epoch, its row (and the previous one, which may just have closed), the
 * supply and the block. Closes since the last read come in as the new tail, up to WINDOW of them.
 */
export async function pollChain(r: Reader, chain: Chain): Promise<Chain> {
  const [open, block, supply] = await Promise.all([
    readOpenEpochNumber(r.node, r.miner, r.minerLayout),
    latestBlock(r.node),
    readTotalSupply(r.node, r.token, r.tokenLayout),
  ]);
  const from = Math.min(chain.open, open) - 1;
  const fresh = await window(r, Math.max(0, from), open, open);
  const kept = chain.rows.filter((row) => row.epoch < Math.max(0, from));
  return { ...chain, rows: linkRows([...kept, ...fresh]), open, supply, block, readAt: Date.now() };
}
