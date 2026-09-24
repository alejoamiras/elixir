// The miner's one Stats runtime, per endpoint pair, for the page's life. A node switch disposes it the
// moment it begins, shown or not, so nothing it started lands after the guard moves; the switch's end,
// whatever it kept, brings a fresh one: started at once if Stats shows, at its next showing if not.
import type { StatsRuntime } from '@yacana/stats-view/runtime';
import { normaliseEndpoint } from '@yacana/web-kit/browser/node-guard';
import type { Transport } from '@yacana/web-kit/browser/node-health';
import type { createStore } from 'jotai';
import { type Endpoints, endpointsAtom } from '../state';

type Store = ReturnType<typeof createStore>;

export interface StatsHost {
  /** Stats is showing until the returned call; the runtime runs while any showing holds. */
  show(): () => void;
  runtime(): StatsRuntime | undefined;
}

/**
 * Whether hosted reads hold: a claim is out, the node is anything but ok, or the guard is not on their
 * node yet. Not merely a cooldown: past its deadline the next request through is its recovery, and that
 * must be one of the page's own, or the page's requests meanwhile get the synthetic answer.
 */
export const hostedBusy = (
  claiming: boolean,
  transport: Transport,
  guardNode: string | null,
  node: string,
): boolean => claiming || transport.kind !== 'ok' || guardNode !== normaliseEndpoint(node);

/** Resolves once `busy()` is false, asked now and every `everyMs` after; rejects once `gone` aborts. */
export function whenFree(busy: () => boolean, gone: AbortSignal, everyMs = 1000): Promise<void> {
  if (gone.aborted) return Promise.reject(gone.reason);
  if (!busy()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const end = () => {
      clearInterval(timer);
      gone.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      end();
      reject(gone.reason);
    };
    const timer = setInterval(() => {
      if (busy()) return;
      end();
      resolve();
    }, everyMs);
    gone.addEventListener('abort', onAbort);
  });
}

/** `make` gets a signal that aborts when its runtime is disposed: whatever it holds back gives up then. */
export function createStatsHost(
  store: Store,
  make: (e: Endpoints, gone: AbortSignal) => StatsRuntime,
): StatsHost {
  let current: { key: string; runtime: StatsRuntime; gone: AbortController } | undefined;
  let showing = 0;
  const follow = () => {
    const e = store.get(endpointsAtom);
    const key = e && !e.switching ? `${e.nodeUrl} ${e.ethRpcUrl}` : undefined;
    if (key === current?.key && key !== undefined) return;
    current?.gone.abort();
    current?.runtime.dispose();
    const gone = new AbortController();
    current = e && key !== undefined ? { key, runtime: make(e, gone.signal), gone } : undefined;
    if (showing > 0) current?.runtime.start();
  };
  store.sub(endpointsAtom, follow);
  follow();
  return {
    show() {
      showing++;
      current?.runtime.start();
      return () => {
        if (--showing === 0) current?.runtime.stop();
      };
    },
    runtime: () => current?.runtime,
  };
}
