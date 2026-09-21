import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'bun:test';
import { entropyOf, masterFromMnemonic } from '@yacana/miner-core/keys/mnemonic';
import type { AccountClasses } from '../src/keys/classes.ts';
import {
  addressOf,
  assertNoLegacyWalletDb,
  currentAddress,
  DB_NAME,
  findRecordFor,
  forgetMaster,
  getRecord,
  listRecords,
  type MasterRecord,
  openAccount,
  openMaster,
  openPhrase,
  putRecord,
  seal,
  setStayOpen,
} from '../src/keys/store.ts';

const master = new Uint8Array(32).map((_, i) => i);
const other = new Uint8Array(32).fill(5);
const PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

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
    const r = { ...(await record('passkey')), askEveryOpen: false };
    // Two first-time writers race for the device key: both ciphertexts must open afterwards.
    const [a, b] = await Promise.all([seal(master, r), seal(master, r)]);
    expect(a.iv).toHaveLength(12);
    expect(a.iv).not.toEqual(b.iv);
    expect(a.ct).not.toEqual(b.ct);
    expect(a.ct).toHaveLength(32 + 16);
    expect(new Uint8Array(await openMaster({ ...r, sealed: a }))).toEqual(master);
    expect(new Uint8Array(await openMaster({ ...r, sealed: b }))).toEqual(master);
    // Same bytes under another id or method: the AAD refuses them.
    await expect(openMaster({ ...r, id: 'passkey-2', sealed: a })).rejects.toThrow();
    await expect(openMaster({ ...r, method: 'words', sealed: a })).rejects.toThrow();
    await expect(seal(new Uint8Array(16), r)).rejects.toThrow(/32 bytes/);
  });

  test('a words key seals its entropy: the master derives from it and the phrase comes back', async () => {
    const m = new Uint8Array(await masterFromMnemonic(PHRASE));
    const r = await record('words', m);
    const words = { ...r, sealed: await seal(entropyOf(PHRASE), r) };
    expect(words.sealed.ct).toHaveLength(16 + 16);
    expect(new Uint8Array(await openMaster(words))).toEqual(m);
    expect(await openPhrase(words)).toBe(PHRASE);
    await expect(openPhrase(await record('passkey'))).rejects.toThrow(/not a twelve-words account/);
    await expect(setStayOpen(words, m, false)).rejects.toThrow(/always sealed/);
  });

  test('every mode re-derives account 0 and fails closed on a mismatch', async () => {
    const passkey = await record('passkey');
    expect(new Uint8Array(await openMaster(passkey, master))).toEqual(master);
    await expect(openMaster(passkey, other)).rejects.toThrow(/different account/);
    const stayOpen = await setStayOpen(passkey, master, true);
    expect(stayOpen.sealed).toBeDefined();
    expect(new Uint8Array(await openMaster(stayOpen))).toEqual(master);
    const wrong = { ...stayOpen, account: { ...stayOpen.account, address: await addressOf(other, 0) } };
    await expect(openMaster(wrong)).rejects.toThrow(/different account/);
    await expect(openMaster(passkey)).rejects.toThrow(/not stored/);
  });

  test('a master the record cannot use is zeroed: a mismatch, or an address that cannot be derived', async () => {
    const passkey = await record('passkey');
    const wrongOwner = new Uint8Array(other);
    await expect(openMaster(passkey, wrongOwner)).rejects.toThrow(/different account/);
    expect(Array.from(wrongOwner)).toEqual(Array.from(new Uint8Array(32)));
    const malformed = { ...passkey, account: { ...passkey.account, index: -1 as 0 } };
    const leaked = new Uint8Array(master);
    await expect(openMaster(malformed, leaked)).rejects.toThrow();
    expect(Array.from(leaked)).toEqual(Array.from(new Uint8Array(32)));
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

  /** A master that is not `master`; fresh each time, since a refused open zeroes what it was handed. */
  const stranger = () => new Uint8Array(32).fill(5);

  /** Two classes that derive distinguishable addresses from any master: `<class>:<first byte>`. */
  const classes = (currentId: string, previousId: string): AccountClasses => {
    const under = (id: string) => async (m: Uint8Array) => `${id}:${m[0]}`;
    return {
      current: { id: currentId, addressOf: under(currentId) },
      previous: { id: previousId, addressOf: under(previousId) },
    };
  };

  test('an existing sealed record opens under an unchanged class and gains its fingerprint and address', async () => {
    const same = classes('c1', 'c1');
    const legacy: MasterRecord = { ...(await record('passkey')), account: { address: 'c1:0', index: 0 } };
    legacy.sealed = await seal(master, legacy);
    await putRecord(legacy);
    const opened = await openAccount(legacy, undefined, same);
    expect(new Uint8Array(opened.master)).toEqual(master);
    expect(opened.record.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(opened.record.account.addresses).toEqual({ c1: 'c1:0' });
    expect((await getRecord(legacy.id))?.fingerprint).toBe(opened.record.fingerprint);
    // Opened again: nothing new to write, the same object comes back.
    expect((await openAccount(opened.record, undefined, same)).record).toBe(opened.record);
    expect(currentAddress(opened.record, 'c1')).toBe('c1:0');
    expect(currentAddress(opened.record, 'c2')).toBe('c1:0');
  });

  test('under a changed class, a legacy record migrates only when the old class agrees; a wrong phrase is refused', async () => {
    const changed = classes('c2', 'c1');
    const legacy: MasterRecord = { ...(await record('passkey')), account: { address: 'c1:0', index: 0 } };
    await expect(openAccount(legacy, stranger(), changed)).rejects.toThrow(/different account/);
    const migrated = await openAccount(legacy, master, changed);
    expect(migrated.record.account.address).toBe('c1:0');
    expect(migrated.record.account.addresses).toEqual({ c2: 'c2:0' });
    expect(migrated.record.fingerprint).toBeDefined();
    expect(currentAddress(migrated.record, 'c2')).toBe('c2:0');
    // With the fingerprint on record, a later class change migrates by it, and a wrong master is still refused.
    const third = classes('c3', 'c2');
    expect((await openAccount(migrated.record, master, third)).record.account.addresses).toEqual({
      c2: 'c2:0',
      c3: 'c3:0',
    });
    const forged = { ...migrated.record, account: { ...migrated.record.account, address: 'c1:5' } };
    await expect(openAccount(forged, stranger(), third)).rejects.toThrow(/different account/);
  });

  test('a restore finds its record by the current address, a recorded one, the fingerprint, or the legacy address', async () => {
    const legacy: MasterRecord = {
      ...(await record('passkey')),
      id: 'legacy',
      account: { address: 'c1:0', index: 0 },
    };
    const fresh: MasterRecord = {
      ...(await record('words')),
      id: 'fresh',
      fingerprint: 'not-this-one',
      account: { address: 'c2:9', index: 0 },
    };
    const records = [fresh, legacy];
    expect((await findRecordFor(records, master, classes('c1', 'c0')))?.id).toBe('legacy');
    expect((await findRecordFor(records, master, classes('c2', 'c1')))?.id).toBe('legacy');
    expect(await findRecordFor(records, stranger(), classes('c2', 'c1'))).toBeUndefined();
    const migrated = (await openAccount(legacy, master, classes('c2', 'c1'))).record;
    expect((await findRecordFor([fresh, migrated], master, classes('c3', 'c2')))?.id).toBe('legacy');
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
