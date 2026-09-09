// What the user's Start and the row's Retry do about Presto, through the real probe against a fake
// whose answer this suite releases by hand: bringing native back after the Worker gave it up, and
// dropping whatever a Stop made irrelevant while the probe was still out.
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createStore } from 'jotai';
import { type PrestoEndpoint, prestoAtom } from '../src/presto.ts';
import { Session } from '../src/session.ts';
import { bootAtom } from '../src/state.ts';

/** A Presto that answers `/health` only when this suite says so, and says when it was asked. */
function heldPresto() {
  let release: (() => void) | undefined;
  let arrived: (() => void) | undefined;
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch() {
      arrived?.();
      if (release) await new Promise<void>((r) => (release = r));
      return Response.json({
        status: 'ok',
        api_version: 1,
        schemes: ['chonk', 'ultra_honk'],
        version: '1.1.1',
        aztec_version: '5.2.0',
        bb_available: true,
      });
    },
  });
  const endpoint: PrestoEndpoint = {
    host: '127.0.0.1',
    port: Number(server.port),
    httpsPort: Number(server.port),
    httpsOnly: false,
  };
  return {
    server,
    endpoint,
    /**
     * From here on `/health` waits. Returns the request's arrival and the release: the caller can be
     * sure the probe is out before it acts, and that it is over before it asserts.
     */
    hold() {
      release = () => {};
      const request = new Promise<void>((r) => (arrived = r));
      return {
        request,
        answer() {
          const r = release;
          release = undefined;
          r?.();
        },
      };
    },
  };
}

interface Recorded {
  threads: number;
  presto: PrestoEndpoint | null;
  force: boolean;
}

/** The controller as the session uses it for Presto, with its Stop counter. */
function fakeController(presto: PrestoEndpoint | null) {
  const calls: Recorded[] = [];
  let stops = 0;
  let current = presto;
  return {
    calls,
    stop: () => stops++,
    controller: {
      start() {},
      get stopCount() {
        return stops;
      },
      get currentThreads() {
        return 4;
      },
      get currentPresto() {
        return current;
      },
      reconfigure(threads: number, next: PrestoEndpoint | null = current, o?: { force?: boolean }) {
        current = next;
        calls.push({ threads, presto: next, force: o?.force === true });
      },
    } as never,
  };
}

let fake: ReturnType<typeof heldPresto>;
beforeAll(() => {
  fake = heldPresto();
});
afterAll(() => fake.server.stop(true));

function harness() {
  const store = createStore();
  const session = new Session(store, { nodeUrl: 'x', miner: 'm', token: 't' } as never, {
    preflightImpl: async () => {
      store.set(bootAtom, { phase: 'signedOut', records: [] });
      return { publicEpoch: { start() {}, stop: async () => {} }, presto: fake.endpoint } as never;
    },
  });
  return { store, session };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

/** Resolves when the probe's answer has landed in the atom — the write `reprobePresto` continues from. */
const probeAnswered = (store: ReturnType<typeof createStore>): Promise<void> => {
  const before = store.get(prestoAtom).probedAt;
  return new Promise((resolve) => {
    const stop = store.sub(prestoAtom, () => {
      if (store.get(prestoAtom).probedAt === before) return;
      stop();
      resolve();
    });
  });
};

describe('Start and Retry against Presto', () => {
  test('a Start after the Worker gave up on native forces the rebuild an unchanged config would skip', async () => {
    const { store, session } = harness();
    await session.ready;
    const c = fakeController(fake.endpoint);
    session.controller = c.controller;
    store.set(prestoAtom, (s) => ({ ...s, selected: 'presto', active: 'wasm', fallbackReason: 'denied' }));
    session.startMining();
    await settle();
    expect(c.calls).toEqual([{ threads: 4, presto: fake.endpoint, force: true }]);
    // With nothing stuck, the same Start leaves the warm backend alone.
    store.set(prestoAtom, (s) => ({ ...s, fallbackReason: undefined }));
    c.calls.length = 0;
    session.startMining();
    await settle();
    expect(c.calls).toEqual([{ threads: 4, presto: fake.endpoint, force: false }]);
  });

  test('a Stop while the probe is out withdraws it: neither Start nor Retry acts on the answer', async () => {
    const { store, session } = harness();
    await session.ready;
    for (const act of [() => session.startMining(), () => void session.retryPresto()]) {
      const c = fakeController(fake.endpoint);
      session.controller = c.controller;
      const held = fake.hold();
      act();
      // The probe is demonstrably out (Presto has the request) when the Stop lands.
      await held.request;
      c.stop();
      const answered = probeAnswered(store);
      held.answer();
      // And demonstrably over — the answer is in the atom — when the absence of a rebuild is asserted.
      await answered;
      await settle();
      expect(c.calls).toEqual([]);
    }
  });
});
