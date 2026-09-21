// The consent record under the storage it cannot control: two tabs on one storage, a lock that
// orders their writes, a storage that throws on read or on write, and the revoke the page acts on
// before it has committed.
import { describe, expect, test } from 'bun:test';
import {
  CONSENT_KEY,
  type ConsentDeps,
  type ConsentLock,
  createConsent,
  isConsented,
  NO_CONSENT,
  parseConsent,
} from '../src/presto-consent.ts';

/**
 * One origin's localStorage as several tabs see it: a write in one tab reaches the others' `storage`
 * listeners (never its own), as the browser does it.
 */
function origin(opts: { failWrites?: boolean; failReads?: boolean } = {}) {
  const map = new Map<string, string>();
  const tabs = new Set<{ listeners: Set<(key: string | null) => void> }>();
  return {
    map,
    tab(): ConsentDeps & { events: number } {
      const me = { listeners: new Set<(key: string | null) => void>() };
      tabs.add(me);
      const deps: ConsentDeps & { events: number } = {
        events: 0,
        storage: {
          getItem(key) {
            if (opts.failReads) throw new Error('read refused');
            return map.get(key) ?? null;
          },
          setItem(key, value) {
            if (opts.failWrites) throw new Error('quota');
            map.set(key, value);
            for (const other of tabs) if (other !== me) for (const cb of other.listeners) cb(key);
          },
        },
        onStorage(cb) {
          const counted = (key: string | null) => {
            deps.events++;
            cb(key);
          };
          me.listeners.add(counted);
          return () => me.listeners.delete(counted);
        },
      };
      return deps;
    },
  };
}

/** A lock whose granted callbacks run only when the test says, in the order it says. */
function heldLock() {
  const queue: Array<() => Promise<unknown>> = [];
  const lock: ConsentLock = (_name, fn) =>
    new Promise((resolve, reject) => {
      queue.push(() => fn().then(resolve, reject));
    });
  return {
    lock,
    get pending() {
      return queue.length;
    },
    /** Runs the i-th waiting callback to completion. */
    async run(i: number) {
      const [cb] = queue.splice(i, 1);
      await cb?.();
    },
  };
}

const stored = (map: Map<string, string>) => parseConsent(map.get(CONSENT_KEY) ?? null);

describe('the record', () => {
  test('a foreign or partial value is no consent', () => {
    expect(parseConsent(null)).toEqual(NO_CONSENT);
    expect(parseConsent('{"used":true}')).toEqual(NO_CONSENT);
    expect(parseConsent('{"used":"yes","rev":1}')).toEqual(NO_CONSENT);
    expect(parseConsent('{"used":true,"rev":-1}')).toEqual(NO_CONSENT);
    expect(parseConsent('nonsense')).toEqual(NO_CONSENT);
    expect(parseConsent('{"used":true,"rev":2}')).toEqual({ used: true, rev: 2 });
  });

  test('consent is a verified proof here, or a click at the current revision', () => {
    expect(isConsented({ used: true, rev: 3 }, null)).toBe(true);
    expect(isConsented({ used: false, rev: 3 }, 3)).toBe(true);
    expect(isConsented({ used: false, rev: 3 }, 2)).toBe(false);
    expect(isConsented({ used: false, rev: 3 }, null)).toBe(false);
  });

  test('a promotion at a stale revision is refused; a revoke from false still moves the revision', async () => {
    const o = origin();
    const c = createConsent(o.tab());
    expect(c.read()).toEqual(NO_CONSENT);
    await c.revoke();
    expect(c.read()).toEqual({ used: false, rev: 1 });
    await c.promote(0);
    expect(c.read().used).toBe(false);
    await c.promote(1);
    expect(c.read()).toEqual({ used: true, rev: 1 });
    expect(stored(o.map)).toEqual({ used: true, rev: 1 });
    // Unchanged records are the same object, as a React external store needs.
    expect(c.read()).toBe(c.read());
  });

  test('however the lock orders a promotion against a revoke, nothing stays remembered', async () => {
    for (const order of [
      [0, 1],
      [1, 0],
    ]) {
      const o = origin();
      const held = heldLock();
      const c = createConsent({ ...o.tab(), lock: held.lock });
      const promotion = c.promote(0);
      const revoke = c.revoke();
      expect(held.pending).toBe(2);
      await held.run(order[0] as number);
      await held.run(0);
      await Promise.all([promotion, revoke]);
      expect(c.read()).toEqual({ used: false, rev: 1 });
      expect(stored(o.map)).toEqual({ used: false, rev: 1 });
    }
  });

  test('another tab’s commit reaches a subscriber; its own writes notify it directly', async () => {
    const o = origin();
    const a = createConsent(o.tab());
    const bDeps = o.tab();
    const b = createConsent(bDeps);
    let seenByB = 0;
    const off = b.subscribe(() => seenByB++);
    await a.promote(0);
    expect(seenByB).toBe(1);
    expect(b.read()).toEqual({ used: true, rev: 0 });
    // A revoke in B turns A's `used` false at A's next read, no message needed.
    await b.revoke();
    expect(a.read()).toEqual({ used: false, rev: 1 });
    expect(seenByB).toBe(4); // the latch going up, the commit, the latch dropping
    off();
    await a.revoke();
    expect(seenByB).toBe(4);
  });

  test('from the call until the commit, a revoke already reads as no consent', async () => {
    const o = origin();
    o.map.set(CONSENT_KEY, JSON.stringify({ used: true, rev: 4 }));
    const held = heldLock();
    const c = createConsent({ ...o.tab(), lock: held.lock });
    expect(c.read().used).toBe(true);
    const revoke = c.revoke();
    // A revision no page holds yet: a click at the old one no longer consents, and a Look made now captures a new one.
    expect(c.read()).toEqual({ used: false, rev: 5 });
    expect(isConsented(c.read(), 4)).toBe(false);
    expect(c.read()).toBe(c.read());
    expect(stored(o.map).used).toBe(true); // storage has not moved yet
    let settled = false;
    void c.settled().then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await held.run(0);
    await revoke;
    await c.settled();
    expect(settled).toBe(true);
    expect(c.read()).toEqual({ used: false, rev: 5 });
  });
});

describe('when storage fails', () => {
  test('a read that throws: this page decides from memory and keeps deciding there', async () => {
    const o = origin({ failReads: true });
    const c = createConsent(o.tab());
    expect(c.read()).toEqual(NO_CONSENT);
    await c.promote(0);
    expect(c.read()).toEqual({ used: true, rev: 0 });
    await c.revoke();
    expect(c.read()).toEqual({ used: false, rev: 1 });
  });

  test('writes that throw: the page keeps its decision, and the other tab sees and hears nothing', async () => {
    const o = origin({ failWrites: true });
    o.map.set(CONSENT_KEY, JSON.stringify({ used: true, rev: 2 }));
    const a = createConsent(o.tab());
    const bDeps = o.tab();
    const b = createConsent(bDeps);
    b.subscribe(() => {});
    await a.revoke();
    expect(a.read()).toEqual({ used: false, rev: 3 });
    expect(b.read()).toEqual({ used: true, rev: 2 });
    expect(bDeps.events).toBe(0);
    // Storage becoming writable again does not bring the old record back into A.
    o.map.set(CONSENT_KEY, JSON.stringify({ used: true, rev: 9 }));
    expect(a.read()).toEqual({ used: false, rev: 3 });
    await a.promote(3);
    expect(a.read()).toEqual({ used: true, rev: 3 });
  });

  test('no storage at all is memory from the start', async () => {
    const c = createConsent({ storage: null });
    await c.promote(0);
    expect(c.read()).toEqual({ used: true, rev: 0 });
  });
});
