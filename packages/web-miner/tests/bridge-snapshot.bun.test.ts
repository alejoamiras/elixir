import { describe, expect, test } from 'bun:test';
import { readBalanceSnapshot, saveBalanceSnapshot, snapshotKey } from '../src/bridge/snapshot.ts';

const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  };
};
const master = new Uint8Array(32).map((_, i) => i);
const scope = { chainId: '11155111', rollupVersion: '5', token: '0x0t', account: '0x0a' };

describe('the balance snapshot', () => {
  test('round-trips under its master, is opaque at rest, and opens for nobody else', async () => {
    const store = memory();
    await saveBalanceSnapshot(master, scope, { balance: 48n * 10n ** 18n, at: 1_000 }, store);
    const raw = store.map.get(snapshotKey(scope)) as string;
    expect(raw).not.toContain('48');
    expect(await readBalanceSnapshot(master, scope, store)).toEqual({ balance: 48n * 10n ** 18n, at: 1_000 });
    expect(await readBalanceSnapshot(new Uint8Array(32).fill(9), scope, store)).toBeNull();
    // Another version's key is another snapshot; a key with nothing under it is null.
    expect(await readBalanceSnapshot(master, { ...scope, rollupVersion: '6' }, store)).toBeNull();
    // The same ciphertext under another key does not open: the key is the AAD.
    store.setItem(snapshotKey({ ...scope, rollupVersion: '6' }), raw);
    expect(await readBalanceSnapshot(master, { ...scope, rollupVersion: '6' }, store)).toBeNull();
    // A later write wins.
    await saveBalanceSnapshot(master, scope, { balance: 8n, at: 2_000 }, store);
    expect(await readBalanceSnapshot(master, scope, store)).toEqual({ balance: 8n, at: 2_000 });
  });

  test('no storage, no snapshot, no error', async () => {
    await saveBalanceSnapshot(master, scope, { balance: 1n, at: 1 }, null);
    expect(await readBalanceSnapshot(master, scope, null)).toBeNull();
  });
});
