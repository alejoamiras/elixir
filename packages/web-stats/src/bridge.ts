// The bridge page's poll: the portal read over the Ethereum RPC every `POLL_MS`, into its atom,
// with the extras the page draws (YACA's supply, every crossing's event with its block's time). A
// deployment without a portal has nothing to read; a read that fails keeps the last snapshot on
// the page and says the RPC is not answering; extras that fail leave the sentences standing.
import type { createStore } from 'jotai';
import type { Hex, PublicClient } from 'viem';
import { scanLogs } from '../../bridge/src/logs.ts';
import { yacaAbi, yacanaPortalAbi } from '../../bridge/src/portal.ts';
import { portalReader } from '../../bridge/src/portal-reader.ts';
import type { BridgeRecord } from '../../bridge/src/record.ts';
import type { Connection } from '../../site/src/browser/connection.ts';
import { ethRpcClient } from '../../site/src/browser/eth-rpc.ts';
import { setEthRpcEndpoint } from '../../site/src/browser/node-guard.ts';
import { type BridgeExtras, type FlowEvent, readBridge, sampleBlocks } from './bridge-beat';
import { POLL_MS } from './chain';
import { bridgeAtom } from './state';

const ETH_RPC_DEADLINE_MS = 10_000;
/** Blocks whose time is read; the rest are placed between their neighbours. */
const BLOCK_TIMES = 120;

export const bridgeRecord = (): BridgeRecord | null =>
  import.meta.env.VITE_BRIDGE ? (JSON.parse(import.meta.env.VITE_BRIDGE) as BridgeRecord) : null;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface RawEvent {
  kind: FlowEvent['kind'];
  version: bigint;
  amount: bigint;
  block: bigint;
}

/** The time of every block in `blocks`: read for at most BLOCK_TIMES of them, the others placed between the read ones. */
async function blockTimes(client: PublicClient, blocks: bigint[]): Promise<Map<bigint, number>> {
  const sorted = [...new Set(blocks)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const picked = sampleBlocks(sorted, BLOCK_TIMES);
  const read = new Map<bigint, number>();
  await Promise.all(
    picked.map(async (b) => read.set(b, Number((await client.getBlock({ blockNumber: b })).timestamp))),
  );
  const out = new Map<bigint, number>();
  for (const b of sorted) {
    const known = read.get(b);
    if (known !== undefined) {
      out.set(b, known);
      continue;
    }
    const before = picked.filter((p) => p < b).at(-1) as bigint;
    const after = picked.find((p) => p > b) as bigint;
    const [t0, t1] = [read.get(before) as number, read.get(after) as number];
    out.set(b, Math.round(t0 + ((t1 - t0) * Number(b - before)) / Number(after - before)));
  }
  return out;
}

async function readExtras(client: PublicClient, record: BridgeRecord): Promise<BridgeExtras> {
  const portal = { address: record.portal as Hex, abi: yacanaPortalAbi };
  const fromBlock = BigInt(record.deployBlock ?? 0);
  const toBlock = await client.getBlockNumber({ cacheTime: 0 });
  const [yacaSupply, forwarded, deposited, redeemed] = await Promise.all([
    client.readContract({ address: record.yaca as Hex, abi: yacaAbi, functionName: 'totalSupply' }),
    scanLogs(client, { ...portal, eventName: 'Forwarded', fromBlock, toBlock }),
    scanLogs(client, { ...portal, eventName: 'Deposited', fromBlock, toBlock }),
    scanLogs(client, { ...portal, eventName: 'Redeemed', fromBlock, toBlock }),
  ]);
  const raw: RawEvent[] = [
    ...forwarded.map((l) => ({
      kind: (l.args.kind === 2 ? 'send' : 'exit') as FlowEvent['kind'],
      version: l.args.version,
      amount: l.args.amount,
      block: l.blockNumber,
    })),
    ...deposited.map((l) => ({
      kind: 'deposit' as const,
      version: l.args.version,
      amount: l.args.amount,
      block: l.blockNumber,
    })),
    ...redeemed.map((l) => ({
      kind: 'redeem' as const,
      version: l.args.version,
      amount: l.args.amount,
      block: l.blockNumber,
    })),
  ];
  const times = await blockTimes(
    client,
    raw.map((e) => e.block),
  );
  const events = raw
    .map((e) => ({ kind: e.kind, version: e.version, amount: e.amount, at: times.get(e.block) ?? 0 }))
    .sort((a, b) => a.at - b.at);
  const forwards = events.filter((e) => e.kind !== 'deposit');
  return { yacaSupply, events, lastForwardAt: forwards.length ? (forwards.at(-1) as FlowEvent).at : null };
}

/** Reads once now and every poll after; returns the stop. */
export function startBridge(store: ReturnType<typeof createStore>, connection: Connection): () => void {
  const record = bridgeRecord();
  if (!record) {
    store.set(bridgeAtom, { phase: 'none' });
    return () => {};
  }
  setEthRpcEndpoint(connection.ethRpcUrl, ETH_RPC_DEADLINE_MS);
  const client = ethRpcClient(connection.ethRpcUrl);
  const reader = portalReader(client, {
    portal: record.portal as Hex,
    registry: record.registry as Hex,
    deployBlock: BigInt(record.deployBlock ?? 0),
  });
  let reading = false;
  const read = async () => {
    if (reading) return;
    reading = true;
    try {
      const snapshot = await readBridge(reader);
      const extras = await readExtras(client, record).catch(() => undefined);
      store.set(bridgeAtom, {
        phase: 'ready',
        snapshot: extras ? { ...snapshot, extras } : snapshot,
        unreachable: false,
      });
    } catch (e) {
      const held = store.get(bridgeAtom);
      store.set(
        bridgeAtom,
        held.phase === 'ready' ? { ...held, unreachable: true } : { phase: 'error', message: message(e) },
      );
    } finally {
      reading = false;
    }
  };
  void read();
  const timer = setInterval(() => void read(), POLL_MS);
  return () => clearInterval(timer);
}
