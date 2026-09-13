// The bridge page's poll: the portal read over the Ethereum RPC every `POLL_MS`, into its atom. A
// deployment without a portal has nothing to read; a read that fails keeps the last snapshot on
// the page and says the RPC is not answering.
import type { createStore } from 'jotai';
import { portalReader } from '../../bridge/src/portal-reader.ts';
import type { BridgeRecord } from '../../bridge/src/record.ts';
import type { Connection } from '../../site/src/browser/connection.ts';
import { ethRpcClient } from '../../site/src/browser/eth-rpc.ts';
import { setEthRpcEndpoint } from '../../site/src/browser/node-guard.ts';
import { readBridge } from './bridge-beat';
import { POLL_MS } from './chain';
import { bridgeAtom } from './state';

const ETH_RPC_DEADLINE_MS = 10_000;

export const bridgeRecord = (): BridgeRecord | null =>
  import.meta.env.VITE_BRIDGE ? (JSON.parse(import.meta.env.VITE_BRIDGE) as BridgeRecord) : null;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Reads once now and every poll after; returns the stop. */
export function startBridge(store: ReturnType<typeof createStore>, connection: Connection): () => void {
  const record = bridgeRecord();
  if (!record) {
    store.set(bridgeAtom, { phase: 'none' });
    return () => {};
  }
  setEthRpcEndpoint(connection.ethRpcUrl, ETH_RPC_DEADLINE_MS);
  const reader = portalReader(ethRpcClient(connection.ethRpcUrl), {
    portal: record.portal as `0x${string}`,
    registry: record.registry as `0x${string}`,
    deployBlock: BigInt(record.deployBlock ?? 0),
  });
  let reading = false;
  const read = async () => {
    if (reading) return;
    reading = true;
    try {
      const snapshot = await readBridge(reader);
      store.set(bridgeAtom, { phase: 'ready', snapshot, unreachable: false });
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
