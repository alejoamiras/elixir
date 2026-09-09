// Shared by the specs: the run record, page URLs, and the mocked node that answers the miner's
// storage from the fixture and forwards everything else to the real node.
import { readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { type E2eRun, MOCK_FILE, RUN_FILE } from './run.ts';

export const MOCK_NODE_ORIGIN = 'http://127.0.0.1:1';

export const run = (): E2eRun => JSON.parse(readFileSync(RUN_FILE, 'utf8')) as E2eRun;

export const pageUrl = (r: E2eRun, path = '', extra: Record<string, string> = {}) => {
  const url = new URL(`${r.baseURL}${path}`);
  url.searchParams.set('node', extra.node ?? r.nodeUrl);
  url.searchParams.set('miner', r.miner);
  url.searchParams.set('token', r.token);
  for (const [k, v] of Object.entries(extra)) if (k !== 'node') url.searchParams.set(k, v);
  return url.toString();
};

interface RpcCall {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: unknown[];
}

/**
 * A JSON-RPC node at MOCK_NODE_ORIGIN: a `getPublicStorageAt` of a slot in `.mock.json` answers
 * from it, every other call (the fixed slots included) goes to the real node with its id intact,
 * so the deployment check, genesis and the block reads stay real. `delayMs` holds every answer
 * that long: a slow node, for the skeleton.
 */
export async function mockNode(page: Page, r: E2eRun, opts: { delayMs?: number } = {}): Promise<void> {
  const storage = JSON.parse(readFileSync(MOCK_FILE, 'utf8')) as Record<string, Record<string, string>>;
  const answer = (c: RpcCall): unknown | undefined => {
    if (c.method !== 'aztec_getPublicStorageAt') return undefined;
    const [, contract, slot] = c.params as [unknown, string, string];
    return (storage[contract] ?? storage[contract.toLowerCase()])?.[slot];
  };
  const forwardTo = async (
    route: Route,
    calls: RpcCall[],
    batch: boolean,
  ): Promise<{ id: RpcCall['id'] }[]> => {
    if (!calls.length) return [];
    const res = await route.fetch({
      url: r.nodeUrl,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      postData: JSON.stringify(batch ? calls : calls[0]),
    });
    const json = (await res.json()) as { id: RpcCall['id'] } | { id: RpcCall['id'] }[];
    return Array.isArray(json) ? json : [json];
  };
  await page.route(
    (url) => url.origin === MOCK_NODE_ORIGIN,
    async (route: Route) => {
      const body = route.request().postDataJSON() as RpcCall | RpcCall[];
      const calls = Array.isArray(body) ? body : [body];
      const results = new Map<RpcCall['id'], unknown>();
      const forward: RpcCall[] = [];
      for (const c of calls) {
        const local = answer(c);
        if (local === undefined) forward.push(c);
        else results.set(c.id, { jsonrpc: '2.0', id: c.id, result: local });
      }
      for (const item of await forwardTo(route, forward, Array.isArray(body))) results.set(item.id, item);
      if (opts.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      const out = calls.map((c) => results.get(c.id));
      await route.fulfill({ json: Array.isArray(body) ? out : out[0] });
    },
  );
}
