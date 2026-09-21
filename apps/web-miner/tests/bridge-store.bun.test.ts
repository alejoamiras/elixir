import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'bun:test';
import type { Crossing } from '@yacana/bridge/journal';
import { crossingId, UNKNOWN_ETH } from '@yacana/bridge/journal';
import { type Arrived, landed } from '../src/bridge/landing.ts';
import { BRIDGE_DB, openBridgeStore, scanNextIndex } from '../src/bridge/store.ts';

const PORTAL = `0x${'be'.repeat(20)}` as const;
const scope = { chainId: '31337', portal: PORTAL, owner: 'fp-a' };

const reset = () =>
  new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(BRIDGE_DB);
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
  });

const make =
  (version = '5') =>
  (index: number): Crossing => {
    const c = {
      kind: 2 as const,
      chainId: '31337',
      portal: PORTAL,
      version,
      index,
      amount: '1',
      state: 'proving' as const,
      createdAt: 1,
      updatedAt: 1,
      ethAddress: `0x${'22'.repeat(20)}` as const,
    };
    return { ...c, id: crossingId(c) };
  };

describe('the bridge journal store', () => {
  beforeEach(reset);

  test('two concurrent sends and two tabs take distinct indices past twenty prior exits', async () => {
    const tabA = openBridgeStore(scope);
    const tabB = openBridgeStore(scope);
    let seeds = 0;
    const seed = async () => {
      seeds++;
      return 25; // the chain says this account made exits 0..24 on the version
    };
    const [a, b] = await Promise.all([tabA.create('5', seed, make()), tabA.create('5', seed, make())]);
    const c = await tabB.create('5', seed, make());
    expect([a.index, b.index, c.index].sort((x, y) => x - y)).toEqual([25, 26, 27]);
    expect(await tabB.nextIndex('5')).toBe(28);
    // The seed ran only while no counter existed; a second version has its own count.
    expect(seeds).toBeLessThanOrEqual(2);
    expect((await tabA.create('6', async () => 0, make('6'))).index).toBe(0);
    expect((await tabA.list()).map((x) => x.index).sort((x, y) => x - y)).toEqual([0, 25, 26, 27]);
  });

  test('journals are per account and portal; update sees the stored record', async () => {
    const mine = openBridgeStore(scope);
    const theirs = openBridgeStore({ ...scope, owner: 'fp-b' });
    const c = await mine.create('5', async () => 0, make());
    expect(await theirs.list()).toEqual([]);
    expect(await theirs.get(c.id)).toBeUndefined();
    await expect(theirs.update(c.id, (x) => x)).rejects.toThrow(/no crossing/);
    // The other account's first crossing has the same id; both journals keep their own.
    const d = await theirs.create('5', async () => 0, make());
    expect(d.id).toBe(c.id);
    expect((await mine.list()).map((x) => x.id)).toEqual([c.id]);
    expect((await theirs.list()).map((x) => x.id)).toEqual([d.id]);
    // A crossing adopted at index 4 moves the counter past it; a lower one does not move it back,
    // and one the journal holds is stored as `apply` says over the stored record.
    const four = make()(4);
    expect(await mine.adopt(four, (x) => x)).toEqual({ crossing: four, added: true });
    expect(await mine.nextIndex('5')).toBe(5);
    const two = make()(2);
    await mine.adopt(two, (x) => x);
    expect(await mine.nextIndex('5')).toBe(5);
    const held = await mine.adopt({ ...two, state: 'held' }, (x) => ({ ...x, state: 'sent' }));
    expect(held).toEqual({ crossing: { ...two, state: 'sent' }, added: false });
    expect((await mine.get(two.id))?.state).toBe('sent');
    expect((await mine.create('5', async () => 0, make())).index).toBe(5);
    const updated = await mine.update(c.id, (x) => ({ ...x, state: 'sent', txHash: '0x1' }));
    expect(updated.state).toBe('sent');
    expect((await mine.get(c.id))?.txHash).toBe('0x1');
    await mine.put({ ...updated, state: 'dropped' });
    expect((await mine.get(c.id))?.state).toBe('dropped');
  });

  test("a deposit's event fills in the depositor on the record as stored, not as the scan last saw it", async () => {
    const mine = openBridgeStore(scope);
    const depositor = `0x${'d0'.repeat(20)}` as const;
    const base = { ...make('6')(0), kind: 3 as const };
    const k3 = { ...base, id: crossingId(base), inboxIndex: '44', l1TxHash: '0xd1' as const };
    // The journal is further along than the scan's picture of the deposit, and holds the placeholder.
    await mine.put({ ...k3, state: 'minted-l2', claimTxHash: '0xc', ethAddress: UNKNOWN_ETH });
    const dep: Arrived = {
      id: k3.id,
      amount: 1n,
      fact: { deposited: { txHash: '0xd1', inboxIndex: '44' } },
      destination: '6',
      sender: depositor,
      crossing: () => ({ ...k3, state: 'deposited', ethAddress: depositor }),
    };
    const { crossing, added } = await mine.adopt(dep.crossing(9), (stored) => landed(stored, dep, 9));
    expect(added).toBe(false);
    expect(crossing).toMatchObject({ state: 'minted-l2', claimTxHash: '0xc', ethAddress: depositor });
    expect(await mine.get(k3.id)).toEqual(crossing);
  });

  test('a version-1 journal keyed by id alone comes through the upgrade', async () => {
    const legacy = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(BRIDGE_DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('crossings', { keyPath: 'id' }).createIndex('scope', 'scope');
        req.result.createObjectStore('indices');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const row = { ...make()(0), scope: `31337:${PORTAL}:fp-a` };
    const tx = legacy.transaction('crossings', 'readwrite');
    tx.objectStore('crossings').put(row);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    legacy.close();
    expect((await openBridgeStore(scope).list()).map((c) => c.id)).toEqual([row.id]);
    expect(await openBridgeStore({ ...scope, owner: 'fp-b' }).list()).toEqual([]);
  });

  test('the scan stops at the first silent window and answers one past the last index seen', async () => {
    const asked: number[][] = [];
    const usedUpTo = (n: number) => async (indices: number[]) => {
      asked.push(indices);
      return indices.map((i) => i < n);
    };
    expect(await scanNextIndex(usedUpTo(0))).toBe(0);
    expect(await scanNextIndex(usedUpTo(25))).toBe(25);
    expect(await scanNextIndex(usedUpTo(20))).toBe(20);
    // 25 used: windows 0–19 (hits), 20–39 (hits up to 24), 40–59 (silent).
    expect(asked.slice(1, 4).map((w) => w[0])).toEqual([0, 20, 40]);
    // A gap inside a window does not end the scan: 0..4 and 30 used → 31.
    expect(await scanNextIndex(async (indices) => indices.map((i) => i < 5 || i === 30))).toBe(31);
  });
});
