// The replay specs' `test`: the browser context's HTTP and WebSocket traffic is routed — the app
// passes, the recorded node answers from the recording, allowed origins pass, the rest is refused
// and fails the test at its end. A test's own `page.route` runs first: `fulfill()` and `continue()`
// there bypass this, `fallback()` reaches it. A spawned worker is recorded as a failure: this page
// spawns none signed out.
import { readFileSync } from 'node:fs';
import { test as base, type Route } from '@playwright/test';
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
  /** Changes what a recorded key answers from now on. */
  override(key: string, result: unknown): void;
  /** The page URL with the query the test needs; `presto` defaults to off. */
  url(query?: Record<string, string>): string;
}

export const test = base.extend<{ replay: Replay }>({
  replay: [
    async ({ page }, use) => {
      const run = JSON.parse(readFileSync(REPLAY_RUN_FILE, 'utf8')) as ReplayRun;
      const recording = JSON.parse(readFileSync(RECORDING_FILE, 'utf8')) as Recording;
      const answers = { ...recording.answers };
      const app = new URL(run.baseURL).origin;
      const allowed = new Set<string>();
      const unexpected: string[] = [];
      const answer = async (route: Route) => {
        const body = route.request().postDataJSON() as RpcCall | RpcCall[];
        const calls = Array.isArray(body) ? body : [body];
        const missing = calls.map(rpcKey).filter((k) => !(k in answers));
        if (missing.length) {
          unexpected.push(...missing.map((k) => `${REPLAY_NODE_ORIGIN} ${k}`));
          return route.abort();
        }
        const out = calls.map((c) => ({ jsonrpc: '2.0', id: c.id, result: answers[rpcKey(c)] }));
        await route.fulfill({ json: Array.isArray(body) ? out : out[0] });
      };
      const context = page.context();
      await context.route(
        () => true,
        (route) => {
          const url = new URL(route.request().url());
          if (url.origin === app || allowed.has(url.origin)) return route.continue();
          if (url.origin === REPLAY_NODE_ORIGIN) return answer(route);
          unexpected.push(url.href);
          return route.abort();
        },
      );
      await context.routeWebSocket(
        () => true,
        (ws) => {
          unexpected.push(`websocket ${ws.url()}`);
          ws.close();
        },
      );
      page.on('worker', (w) => unexpected.push(`worker ${w.url()}`));
      await use({
        run,
        recording,
        allow: (origin) => allowed.add(origin),
        override: (key, result) => {
          answers[key] = result;
        },
        url: (query = {}) => `${run.baseURL}/?${new URLSearchParams({ presto: 'off', ...query })}`,
      });
      // Nothing the pages do while they go away can land after the check.
      await context.close();
      if (unexpected.length) throw new Error(`requests outside the recording:\n${unexpected.join('\n')}`);
    },
    { auto: true },
  ],
});

export { expect, type Page } from '@playwright/test';
