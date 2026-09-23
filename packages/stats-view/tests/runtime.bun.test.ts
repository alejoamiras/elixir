// The instance's lifecycle over fake sources: what it may start while stopped, yielding or disposed,
// and what it publishes. The guard's slots and its quiet scope are read off the realm, where the guard keeps them.
import { afterEach, describe, expect, test } from 'bun:test';
import type { EpochRow, Node } from '@yacana/miner-core/reader';
import type { Connection } from '@yacana/web-kit/browser/connection';
import { Glob } from 'bun';
import { createStore } from 'jotai';
import type { PublicClient } from 'viem';
import type { BridgeSnapshot } from '../src/bridge-beat';
import type { Reader } from '../src/chain';
import { createStatsRuntime, type StatsRuntime, type StatsSources } from '../src/runtime';
import { bridgeAtom, type Fixed, fixedAtom, historyAtom, statusAtom } from '../src/state';

interface GuardView {
  quiet: number;
  endpoint: string | null;
  ethRpc: string | null;
}
const guard = (): GuardView | undefined =>
  (globalThis as unknown as Record<symbol, GuardView | undefined>)[Symbol.for('yacana.node-guard')];

const connection = (nodeUrl: string): Connection => ({
  nodeUrl,
  ethRpcUrl: 'http://127.0.0.1:1/',
  miner: '0x01',
  token: '0x02',
  firstEpoch: 0,
});

/** A read the test lets land when it chooses. */
function later<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const fixedOf = (open: number, tag: number): Fixed =>
  ({
    open,
    block: { number: tag, timestamp: 1000 },
    supply: BigInt(tag),
    genesis: { target: 1n, seed: 0n, launchAt: 0 },
  }) as unknown as Fixed;
const row = (epoch: number): EpochRow =>
  ({ epoch, target: 1n, openedAt: epoch * 300, claims: 4 }) as unknown as EpochRow;

/** Sources that log every read they start; each answers at once unless the test holds it. */
function fakes(tag = 1, open = 60) {
  const log: string[] = [];
  const hold: {
    open?: ReturnType<typeof later<Reader>>;
    fixed?: ReturnType<typeof later<Fixed>>;
    bridge?: ReturnType<typeof later<BridgeSnapshot>>;
  } = {};
  const quietRows: boolean[] = [];
  const sources: StatsSources = {
    open: async () => {
      log.push('open');
      return hold.open ? hold.open.promise : ({} as Reader);
    },
    reads: () => ({
      fixed: async () => {
        log.push('fixed');
        return hold.fixed ? hold.fixed.promise : fixedOf(open, tag);
      },
      rows: async (from, to) => {
        log.push(`rows ${from}-${to}`);
        quietRows.push((guard()?.quiet ?? 0) > 0);
        return Array.from({ length: to - from + 1 }, (_, i) => row(from + i));
      },
      lottery: async () => ({ mix: 0n, reveals: 0 }),
    }),
    bridge: () => async () => {
      log.push('bridge');
      return hold.bridge ? hold.bridge.promise : ({ tag } as unknown as BridgeSnapshot);
    },
  };
  return { log, hold, quietRows, sources };
}

const made: StatsRuntime[] = [];
afterEach(() => {
  for (const r of made.splice(0)) r.dispose();
});

function make(
  f: ReturnType<typeof fakes>,
  o: { fill?: boolean; yieldTo?: () => boolean; store?: ReturnType<typeof createStore>; node?: string } = {},
) {
  const store = o.store ?? createStore();
  const rt = createStatsRuntime(
    {
      store,
      connection: connection(o.node ?? 'http://127.0.0.1:2/'),
      node: {} as Node,
      eth: {} as PublicClient,
      fill: o.fill ?? false,
      yieldTo: o.yieldTo,
    },
    f.sources,
  );
  made.push(rt);
  return { rt, store };
}

const pause = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function until(ok: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out');
    await pause(10);
  }
}
const count = (log: string[], what: string) => log.filter((l) => l === what).length;

/**
 * What is still armed when `fn` returns: intervals not cleared, timeouts neither fired nor cleared. The
 * spec's own waits are awaited inside `fn`, so they have fired by then.
 */
async function armedDuring(fn: () => Promise<void>): Promise<{ intervals: number; timeouts: number }> {
  const intervals = new Set<unknown>();
  const timeouts = new Set<unknown>();
  const real = { si: setInterval, ci: clearInterval, st: setTimeout, ct: clearTimeout };
  Object.assign(globalThis, {
    setInterval: (cb: () => void, ms?: number) => {
      const t = real.si(cb, ms);
      intervals.add(t);
      return t;
    },
    clearInterval: (t: ReturnType<typeof setInterval>) => {
      intervals.delete(t);
      real.ci(t);
    },
    setTimeout: (cb: () => void, ms?: number) => {
      const t = real.st(() => {
        timeouts.delete(t);
        cb();
      }, ms);
      timeouts.add(t);
      return t;
    },
    clearTimeout: (t: ReturnType<typeof setTimeout>) => {
      timeouts.delete(t);
      real.ct(t);
    },
  });
  try {
    await fn();
  } finally {
    Object.assign(globalThis, {
      setInterval: real.si,
      clearInterval: real.ci,
      setTimeout: real.st,
      clearTimeout: real.ct,
    });
  }
  return { intervals: intervals.size, timeouts: timeouts.size };
}
const NOTHING = { intervals: 0, timeouts: 0 };

describe('the stats runtime', () => {
  test('never points the guard: no source names a setter, and a life leaves both slots as they were', async () => {
    const root = `${import.meta.dir}/../src`;
    for await (const file of new Glob('**/*.{ts,tsx}').scan({ cwd: root }))
      expect(await Bun.file(`${root}/${file}`).text(), file).not.toMatch(/set(Node|EthRpc)Endpoint/);
    const before = { node: guard()?.endpoint, eth: guard()?.ethRpc };
    const f = fakes();
    const { rt, store } = make(f);
    rt.start();
    await until(() => store.get(statusAtom).phase === 'ready' && store.get(bridgeAtom).phase === 'ready');
    await rt.poll();
    expect({ node: guard()?.endpoint, eth: guard()?.ethRpc }).toEqual(before);
  });

  test('fill: false never reads quietly; fill: true reads only its pages quietly', async () => {
    const hosted = fakes();
    const a = make(hosted, { fill: false });
    a.rt.start();
    await until(() => a.store.get(historyAtom) !== null);
    await a.rt.poll();
    expect(hosted.quietRows.length).toBeGreaterThan(0);
    expect(hosted.quietRows).not.toContain(true);
    const pub = fakes();
    const b = make(pub, { fill: true });
    b.rt.start();
    await until(() => pub.quietRows.includes(true));
    expect(pub.quietRows[0]).toBe(false);
  });

  test('while yieldTo holds nothing reads; a window asked for meanwhile is read once it clears', async () => {
    let yielding = false;
    const f = fakes();
    const { rt, store } = make(f, { yieldTo: () => yielding });
    rt.start();
    await until(() => store.get(statusAtom).phase === 'ready');
    const booted = f.log.length;
    yielding = true;
    const poll = rt.poll();
    const asked = rt.showWindow({ from: 0, to: 11 });
    await pause(1200);
    expect(f.log.slice(booted)).toEqual([]);
    yielding = false;
    await Promise.all([poll, asked]);
    expect(f.log.slice(booted)).toContain('fixed');
    expect(f.log.slice(booted).some((l) => l.startsWith('rows 0-'))).toBe(true);
  });

  test('a boot that waits on yieldTo reads nothing; stopped there it leaves nothing armed, and start resumes it', async () => {
    let yielding = true;
    const f = fakes();
    const { rt, store } = make(f, { yieldTo: () => yielding });
    const left = await armedDuring(async () => {
      rt.start();
      await pause(1200);
      rt.stop();
    });
    expect([left, f.log, store.get(fixedAtom)]).toEqual([NOTHING, [], null]);
    yielding = false;
    rt.start();
    await until(() => store.get(statusAtom).phase === 'ready');
    expect([count(f.log, 'open'), count(f.log, 'fixed') > 0, f.log.includes('bridge')]).toEqual([
      1,
      true,
      true,
    ]);
  });

  test('start and stop are idempotent; stop leaves nothing armed and start picks the cadence up', async () => {
    const f = fakes();
    const { rt, store } = make(f);
    const left = await armedDuring(async () => {
      rt.start();
      rt.start();
      await until(() => store.get(statusAtom).phase === 'ready');
      rt.stop();
      rt.stop();
    });
    expect(left).toEqual(NOTHING);
    const reads = count(f.log, 'fixed');
    rt.start();
    await until(() => count(f.log, 'fixed') > reads);
  });

  test("stop during the boot's reads arms nothing when they land; start resumes the boot", async () => {
    const f = fakes();
    f.hold.fixed = later<Fixed>();
    const { rt, store } = make(f);
    const left = await armedDuring(async () => {
      rt.start();
      await until(() => f.log.includes('fixed'));
      rt.stop();
      f.hold.fixed?.resolve(fixedOf(60, 1));
      await pause();
      await pause();
    });
    expect(left).toEqual(NOTHING);
    f.hold.fixed = undefined;
    rt.start();
    await until(() => store.get(statusAtom).phase === 'ready');
    expect(count(f.log, 'open')).toBe(1);
  });

  test('after dispose, a delayed boot, a late poll and a late bridge read publish nothing', async () => {
    const f = fakes();
    f.hold.open = later<Reader>();
    f.hold.bridge = later<BridgeSnapshot>();
    const { rt, store } = make(f);
    rt.start();
    await until(() => f.log.includes('open') && f.log.includes('bridge'));
    rt.dispose();
    f.hold.open.resolve({} as Reader);
    f.hold.bridge.resolve({} as BridgeSnapshot);
    await pause();
    expect([store.get(fixedAtom), store.get(statusAtom).phase, store.get(bridgeAtom).phase]).toEqual([
      null,
      'loading',
      'loading',
    ]);
    rt.start();
    await rt.poll();
    await pause();
    expect(store.get(fixedAtom)).toBeNull();
  });

  test('A → B → A: each instance starts from nothing and a disposed one never writes over the next', async () => {
    const store = createStore();
    const a = fakes(1);
    const first = make(a, { store, node: 'http://a/' });
    first.rt.start();
    await until(() => store.get(fixedAtom)?.block.number === 1);
    a.hold.fixed = later<Fixed>();
    const late = first.rt.poll();
    await until(() => count(a.log, 'fixed') === 2);
    first.rt.dispose();
    const b = make(fakes(2), { store, node: 'http://b/' });
    expect(store.get(fixedAtom)).toBeNull();
    b.rt.start();
    await until(() => store.get(fixedAtom)?.block.number === 2);
    a.hold.fixed.resolve(fixedOf(60, 1));
    await late;
    expect(store.get(fixedAtom)?.block.number).toBe(2);
    b.rt.dispose();
    const again = make(fakes(3), { store, node: 'http://a/' });
    again.rt.start();
    await until(() => store.get(fixedAtom)?.block.number === 3);
  });

  test("StrictMode's double effect: start, stop, start boots once and arms one of each timer", async () => {
    const f = fakes();
    const { rt, store } = make(f);
    const left = await armedDuring(async () => {
      rt.start();
      rt.stop();
      rt.start();
      await until(() => store.get(statusAtom).phase === 'ready');
    });
    expect(count(f.log, 'open')).toBe(1);
    // The clock, the poll's cadence and the bridge's.
    expect(left.intervals).toBe(3);
  });
});
