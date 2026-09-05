import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'bun:test';
import {
  addressOf,
  assertNoLegacyWalletDb,
  DB_NAME,
  forgetMaster,
  listRecords,
  type MasterRecord,
  openMaster,
  putRecord,
  sealMaster,
  setStayOpen,
} from '../src/keys/store.ts';

const master = new Uint8Array(32).map((_, i) => i);
const other = new Uint8Array(32).fill(5);

const reset = () =>
  new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase(DB_NAME);
    r.onsuccess = () => resolve();
    r.onerror = () => resolve();
  });

async function record(method: MasterRecord['method'], m = master): Promise<MasterRecord> {
  return {
    v: 1,
    id: `${method}-1`,
    method,
    createdAt: 0,
    askEveryOpen: method === 'passkey',
    backedUp: false,
    account: { address: await addressOf(m, 0), index: 0 },
  };
}

describe('vault', () => {
  beforeEach(reset);

  test('seal: fresh IV per write; the ciphertext is bound to the record identity', async () => {
    const r = await record('words');
    const a = await sealMaster(master, r);
    const b = await sealMaster(master, r);
    expect(a.iv).toHaveLength(12);
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ct).not.toEqual(b.ct);
    expect(a.ct).toHaveLength(32 + 16);
    expect(new Uint8Array(await openMaster({ ...r, sealed: a }))).toEqual(master);
    // Same bytes under another id or method: the AAD refuses them.
    await expect(openMaster({ ...r, id: 'words-2', sealed: a })).rejects.toThrow();
    await expect(openMaster({ ...r, method: 'passkey', sealed: a })).rejects.toThrow();
  });

  test('every mode re-derives account 0 and fails closed on a mismatch', async () => {
    const passkey = await record('passkey');
    expect(new Uint8Array(await openMaster(passkey, master))).toEqual(master);
    await expect(openMaster(passkey, other)).rejects.toThrow(/different key/);
    const stayOpen = await setStayOpen(passkey, master, true);
    expect(stayOpen.sealed).toBeDefined();
    expect(new Uint8Array(await openMaster(stayOpen))).toEqual(master);
    const wrong = { ...stayOpen, account: { ...stayOpen.account, address: await addressOf(other, 0) } };
    await expect(openMaster(wrong)).rejects.toThrow(/different key/);
    const words = { ...(await record('words')), sealed: await sealMaster(master, await record('words')) };
    expect(new Uint8Array(await openMaster(words))).toEqual(master);
    await expect(openMaster(passkey)).rejects.toThrow(/not stored/);
  });

  test('switching convenience mode off deletes the ciphertext; forget removes the record', async () => {
    const r = await record('passkey');
    const on = await setStayOpen(r, master, true);
    expect((await listRecords())[0]?.sealed).toBeDefined();
    const off = await setStayOpen(on, master, false);
    expect(off.sealed).toBeUndefined();
    expect(off.askEveryOpen).toBe(true);
    expect((await listRecords())[0]?.sealed).toBeUndefined();
    await forgetMaster(r.id);
    expect(await listRecords()).toEqual([]);
  });

  test('a stray interim wallet database is refused, not deleted', async () => {
    await expect(assertNoLegacyWalletDb()).resolves.toBeUndefined();
    await new Promise<void>((resolve) => {
      const r = indexedDB.open('yacana-wallet-1-2-0xabc', 1);
      r.onsuccess = () => {
        r.result.close();
        resolve();
      };
    });
    await expect(assertNoLegacyWalletDb()).rejects.toThrow(/yacana-wallet-1-2-0xabc/);
    expect((await indexedDB.databases()).some((d) => d.name === 'yacana-wallet-1-2-0xabc')).toBe(true);
    await putRecord(await record('words'));
  });
});
