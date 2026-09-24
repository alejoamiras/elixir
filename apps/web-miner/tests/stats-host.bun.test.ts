// The hosted Stats runtime's life over fake runtimes: a node switch disposes it the moment it begins,
// shown or hidden; its end brings a fresh one, started at once if Stats shows, at the next showing if not.
// And when hosted reads hold, request by request.
import { describe, expect, test } from 'bun:test';
import type { StatsRuntime } from '@yacana/stats-view/runtime';
import { createStore } from 'jotai';
import { createStatsHost, hostedBusy, whenFree } from '../src/routes/stats-host';
import { type Endpoints, endpointsAtom } from '../src/state';

const A: Endpoints = { nodeUrl: 'http://a/', ethRpcUrl: 'http://rpc/', switching: false };
const B: Endpoints = { ...A, nodeUrl: 'http://b/' };

/** Each runtime made, with the endpoints it was made for, the signal it was given and the calls it got. */
function hosted(first: Endpoints) {
  const store = createStore();
  store.set(endpointsAtom, first);
  const made: { e: Endpoints; gone: AbortSignal; calls: string[] }[] = [];
  const host = createStatsHost(store, (e, gone) => {
    const calls: string[] = [];
    made.push({ e, gone, calls });
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
    // What a runtime holds back gives up with its dispose, not with a hide.
    expect(made.map((m) => m.gone.aborted)).toEqual([true, false]);
  });
});

describe('when hosted reads hold', () => {
  const ok = { kind: 'ok', latencyMs: 5 } as const;
  const cooling = {
    kind: 'throttled',
    retryAt: Date.now() + 60_000,
    status: 429,
    backoffMs: 60_000,
  } as const;
  // The deadline passed and no recovery is out: the next request through the gate would be it.
  const recoverable = { ...cooling, retryAt: Date.now() - 1 };

  test('while a claim is out, while the node is anything but ok, and until the guard is on their node', () => {
    const cases: [boolean, Parameters<typeof hostedBusy>[1], string | null][] = [
      [false, ok, 'http://a/'],
      [true, ok, 'http://a/'],
      [false, cooling, 'http://a/'],
      [false, recoverable, 'http://a/'],
      [false, ok, null],
      [false, ok, 'http://b/'],
    ];
    expect(cases.map(([claim, t, guard]) => hostedBusy(claim, t, guard, 'http://a'))).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  test('a request waits its turn: at once when free, on the check after it frees, never once disposed', async () => {
    const gone = new AbortController();
    await whenFree(() => false, gone.signal, 5);
    let busy = true;
    let through = false;
    const waiting = whenFree(() => busy, gone.signal, 5).then(() => {
      through = true;
    });
    await Bun.sleep(20);
    expect(through).toBe(false);
    busy = false;
    await waiting;
    busy = true;
    const held = whenFree(() => busy, gone.signal, 5);
    gone.abort();
    await expect(held).rejects.toThrow();
    await expect(whenFree(() => false, gone.signal, 5)).rejects.toThrow();
  });
});
