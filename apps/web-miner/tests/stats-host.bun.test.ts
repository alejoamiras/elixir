// The hosted Stats runtime's life over fake runtimes: a node switch disposes it the moment it begins,
// shown or hidden; its end brings a fresh one, started at once if Stats shows, at the next showing if not.
import { describe, expect, test } from 'bun:test';
import type { StatsRuntime } from '@yacana/stats-view/runtime';
import { createStore } from 'jotai';
import { createStatsHost } from '../src/routes/stats-host';
import { type Endpoints, endpointsAtom } from '../src/state';

const A: Endpoints = { nodeUrl: 'http://a/', ethRpcUrl: 'http://rpc/', switching: false };
const B: Endpoints = { ...A, nodeUrl: 'http://b/' };

/** Each runtime made, with the endpoints it was made for and the calls it got. */
function hosted(first: Endpoints) {
  const store = createStore();
  store.set(endpointsAtom, first);
  const made: { e: Endpoints; calls: string[] }[] = [];
  const host = createStatsHost(store, (e) => {
    const calls: string[] = [];
    made.push({ e, calls });
    return {
      start: () => void calls.push('start'),
      stop: () => void calls.push('stop'),
      dispose: () => void calls.push('dispose'),
      showWindow: async () => {},
      poll: async () => {},
    } satisfies StatsRuntime;
  });
  const switchTo = (e: Endpoints) => {
    store.set(endpointsAtom, { ...e, switching: true });
    store.set(endpointsAtom, e);
  };
  return { store, made, host, switchTo };
}

describe('the hosted stats runtime', () => {
  test('a switch disposes it the moment it begins, shown or hidden', () => {
    for (const shown of [true, false]) {
      const { store, made, host } = hosted(A);
      if (shown) host.show();
      store.set(endpointsAtom, { ...A, switching: true });
      expect(
        made.map((m) => m.calls.at(-1)),
        String(shown),
      ).toEqual(['dispose']);
      expect(host.runtime()).toBeUndefined();
    }
  });

  test('its end brings a fresh one (a new node, the same pair, a rollback), started only while shown', () => {
    const { made, host, switchTo } = hosted(A);
    const hide = host.show();
    switchTo(B);
    switchTo(B);
    hide();
    switchTo(A);
    expect(made.map((m) => [m.e.nodeUrl, m.calls])).toEqual([
      ['http://a/', ['start', 'dispose']],
      ['http://b/', ['start', 'dispose']],
      ['http://b/', ['start', 'stop', 'dispose']],
      ['http://a/', []],
    ]);
    host.show();
    expect(made.at(-1)?.calls).toEqual(['start']);
  });

  test('an RPC change makes a fresh one at once; the same pair again keeps it; the last showing stops it', () => {
    const { store, made, host } = hosted(A);
    const first = host.show();
    const second = host.show();
    store.set(endpointsAtom, { ...A });
    store.set(endpointsAtom, { ...A, ethRpcUrl: 'http://rpc-2/' });
    first();
    expect(made.map((m) => m.calls)).toEqual([['start', 'start', 'dispose'], ['start']]);
    second();
    expect(made.at(-1)?.calls).toEqual(['start', 'stop']);
  });
});
