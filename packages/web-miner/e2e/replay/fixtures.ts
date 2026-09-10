// The replay specs' `test`: every request the page makes is routed — the app's own origin passes,
// the recorded node answers from recording.json, origins a test allows pass — and anything else,
// a recorded key included that the recording lacks, is refused and fails the test at its end.
import { readFileSync } from 'node:fs';
import { test as base, type Page, type Route } from '@playwright/test';
import {
  RECORDING_FILE,
  REPLAY_NODE_ORIGIN,
  REPLAY_RUN_FILE,
  type Recording,
  type ReplayRun,
  rpcKey,
} from './run.ts';

interface RpcCall {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: unknown[];
}

export interface Replay {
  run: ReplayRun;
  recording: Recording;
  /** Lets requests to `origin` through to the network (a fake Presto the test itself serves). */
  allow(origin: string): void;
  /** How many recorded answers of `method` were served so far. */
  served(method: string): number;
  /** The page URL with the query the test needs; `presto` defaults to off. */
  url(query?: Record<string, string>): string;
}

export const test = base.extend<{ replay: Replay }>({
  replay: [
    async ({ page }, use) => {
      const run = JSON.parse(readFileSync(REPLAY_RUN_FILE, 'utf8')) as ReplayRun;
      const recording = JSON.parse(readFileSync(RECORDING_FILE, 'utf8')) as Recording;
      const app = new URL(run.baseURL).origin;
      const allowed = new Set<string>();
      const unexpected: string[] = [];
      const hits = new Map<string, number>();
      const answer = (route: Route) => {
        const body = route.request().postDataJSON() as RpcCall | RpcCall[];
        const calls = Array.isArray(body) ? body : [body];
        const missing = calls.map(rpcKey).filter((k) => !(k in recording.answers));
        if (missing.length) {
          unexpected.push(...missing.map((k) => `${REPLAY_NODE_ORIGIN} ${k}`));
          return route.abort();
        }
        for (const c of calls) hits.set(c.method, (hits.get(c.method) ?? 0) + 1);
        const out = calls.map((c) => ({ jsonrpc: '2.0', id: c.id, result: recording.answers[rpcKey(c)] }));
        return route.fulfill({ json: Array.isArray(body) ? out : out[0] });
      };
      await page.route(
        () => true,
        (route) => {
          const url = new URL(route.request().url());
          if (url.origin === app || allowed.has(url.origin)) return route.continue();
          if (url.origin === REPLAY_NODE_ORIGIN) return answer(route);
          unexpected.push(url.href);
          return route.abort();
        },
      );
      await use({
        run,
        recording,
        allow: (origin) => allowed.add(origin),
        served: (method) => hits.get(method) ?? 0,
        url: (query = {}) => `${run.baseURL}/?${new URLSearchParams({ presto: 'off', ...query })}`,
      });
      if (unexpected.length) throw new Error(`requests outside the recording:\n${unexpected.join('\n')}`);
    },
    { auto: true },
  ],
});

export type { Page as ReplayPage } from '@playwright/test';
export { expect, type Page } from '@playwright/test';
