// The miner's one Stats runtime, per endpoint pair, for the page's life. A node switch disposes it the
// moment it begins, shown or not, so nothing it started lands after the guard moves; the switch's end,
// whatever it kept, brings a fresh one: started at once if Stats shows, at its next showing if not.
import type { StatsRuntime } from '@yacana/stats-view/runtime';
import type { createStore } from 'jotai';
import { type Endpoints, endpointsAtom } from '../state';

type Store = ReturnType<typeof createStore>;

export interface StatsHost {
  /** Stats is showing until the returned call; the runtime runs while any showing holds. */
  show(): () => void;
  runtime(): StatsRuntime | undefined;
}

export function createStatsHost(store: Store, make: (e: Endpoints) => StatsRuntime): StatsHost {
  let current: { key: string; runtime: StatsRuntime } | undefined;
  let showing = 0;
  const follow = () => {
    const e = store.get(endpointsAtom);
    const key = e && !e.switching ? `${e.nodeUrl} ${e.ethRpcUrl}` : undefined;
    if (key === current?.key && key !== undefined) return;
    current?.runtime.dispose();
    current = e && key !== undefined ? { key, runtime: make(e) } : undefined;
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
