// The node as a setting: what a pasted URL must be, how a candidate is checked before it is used,
// and the one handle every holder of the node keeps so the node can change under them.
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { makeFetch } from '@aztec/foundation/json-rpc/client';
import {
  assertDeployment,
  assertTimestamp,
  type ExpectedDeployment,
  type StorageLayout,
} from '../../../miner-core/src/reader.ts';
import type { SiteMode } from '../config.ts';
import { allowCandidate } from './node-guard.ts';

export type Node = ReturnType<typeof createAztecNodeClient>;

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/;

/** https only in production (a local http node in e2e and dev builds); no credentials, no fragment. */
export function parseNodeUrl(text: string, mode: SiteMode): URL {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    throw new Error('not a URL');
  }
  if (url.username || url.password) throw new Error('a node URL cannot carry credentials');
  if (url.hash) throw new Error('a node URL cannot carry a fragment');
  const localHttp = url.protocol === 'http:' && LOCAL_HOST.test(url.hostname) && mode !== 'production';
  if (url.protocol !== 'https:' && !localHttp) throw new Error('a node must be reached over https');
  return url;
}

/** A client that fails in one deadline: the SDK's default retries retryable failures three times. */
export const nodeClient = (url: string): Node => createAztecNodeClient(url, {}, makeFetch([], false));

export interface NodeProbe {
  chainId: bigint;
  rollupVersion: bigint;
  rollupAddress: string;
  block: number;
  /** Seconds between the latest block's timestamp and now; how far behind the node is. */
  blockAgeS: number;
  latencyMs: number;
}

/**
 * The deployment check plus the node's tip and its latency, through a lease on the guard so a
 * candidate can be probed while another node is the page's. The same call is the boot's check.
 */
export async function probeNode(
  url: string,
  expected: ExpectedDeployment,
  minerLayout: StorageLayout,
  deadlineMs = 10_000,
  make: (url: string) => Node = nodeClient,
): Promise<NodeProbe> {
  const release = allowCandidate(url, deadlineMs);
  try {
    const node = make(url);
    const t0 = performance.now();
    await assertDeployment(node, expected, minerLayout);
    const data = await node.getBlockData('latest');
    if (!data) throw new Error('the node has no latest block');
    const latencyMs = performance.now() - t0;
    const g = data.header.globalVariables;
    const at = Number(assertTimestamp('the latest block', BigInt(g.timestamp)));
    return {
      chainId: expected.chainId,
      rollupVersion: expected.rollupVersion,
      rollupAddress: expected.rollupAddress,
      block: Number(g.blockNumber),
      blockAgeS: Math.max(0, Math.round(Date.now() / 1000 - at)),
      latencyMs,
    };
  } finally {
    release();
  }
}

export interface SwitchableNode {
  node: Node;
  /** Points every holder of `node` at `url`; a call already in flight finishes on the client it started on. */
  use(url: string): void;
  current(): string;
}

/**
 * One handle over the current SDK client: every property read forwards to the client of that
 * moment, functions bound to it. The wallet, the controller and the pollers keep the handle, so
 * "Use this node" changes what is behind it without rebuilding them.
 */
export function switchableNode(url: string, make: (url: string) => Node = nodeClient): SwitchableNode {
  let currentUrl = url;
  let client = make(url);
  const node = new Proxy({} as Node, {
    get(_, prop) {
      const value = Reflect.get(client as object, prop) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value;
    },
    has: (_, prop) => prop in (client as object),
  });
  return {
    node,
    use(next) {
      if (next === currentUrl) return;
      currentUrl = next;
      client = make(next);
    },
    current: () => currentUrl,
  };
}
