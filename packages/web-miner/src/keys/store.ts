// The vault: IndexedDB `yacana-keys`, one record per master. What is at rest depends on the mode:
// a passkey key in the default mode stores only metadata (the master is re-derived from the PRF on
// every open); a passkey key that "stays open on this device" stores the master, and a words key
// its phrase's entropy (so the words can be shown again), sealed with AES-GCM under a
// non-extractable device key kept in the same database. Every open, in every mode, re-derives
// account 0 and fails closed unless it equals the stored address.
import { getSchnorrInitializerlessAccountContractAddress } from '@aztec/accounts/schnorr';
import { deriveAccountFields } from '../../../miner-core/src/keys/derive.ts';
import { masterFromMnemonic, phraseFromEntropy } from '../../../miner-core/src/keys/mnemonic.ts';

export interface MasterRecord {
  v: 1;
  id: string;
  method: 'passkey' | 'words';
  createdAt: number;
  /** base64url of the credential's raw id (passkey keys). */
  credentialId?: string;
  /** Passkey keys: the 32-byte master. Words keys: the 16 bytes of bip39 entropy. */
  sealed?: { iv: Uint8Array; ct: Uint8Array };
  /** Passkey keys: one touch per open, nothing sealed. */
  askEveryOpen: boolean;
  /** Words keys: the quiz passed. Passkey keys have no backup by design. */
  backedUp: boolean;
  account: { address: string; index: 0 };
}

export const DB_NAME = 'yacana-keys';
const RECORDS = 'records';
const DEVICE = 'device';
const DEVICE_KEY = 'aes-gcm';

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(RECORDS, { keyPath: 'id' });
      req.result.createObjectStore(DEVICE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const request = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

/** A write resolves once its transaction committed: a request's success is not yet durable. */
async function withStore<T>(
  name: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    const tx = db.transaction(name, mode);
    const result = await request(fn(tx.objectStore(name)));
    if (mode === 'readwrite')
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
        tx.onerror = () => reject(tx.error);
      });
    return result;
  } finally {
    db.close();
  }
}

export const listRecords = (): Promise<MasterRecord[]> =>
  withStore(RECORDS, 'readonly', (s) => s.getAll() as IDBRequest<MasterRecord[]>);
export const getRecord = (id: string): Promise<MasterRecord | undefined> =>
  withStore(RECORDS, 'readonly', (s) => s.get(id) as IDBRequest<MasterRecord | undefined>);
export const putRecord = (r: MasterRecord): Promise<unknown> =>
  withStore(RECORDS, 'readwrite', (s) => s.put(r));

/** Deletes the record only: the PXE namespace is shared by every key and keeps its notes and secrets. */
export const forgetMaster = (id: string): Promise<unknown> =>
  withStore(RECORDS, 'readwrite', (s) => s.delete(id));

/**
 * The device key never leaves the browser's key store; the browser serialises it to the profile.
 * Two tabs may race to create it: `add` refuses a second one, and the loser reads the winner's,
 * so every ciphertext on the device is under the same key.
 */
async function deviceKey(): Promise<CryptoKey> {
  const read = () =>
    withStore(DEVICE, 'readonly', (s) => s.get(DEVICE_KEY) as IDBRequest<CryptoKey | undefined>);
  const existing = await read();
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  try {
    await withStore(DEVICE, 'readwrite', (s) => s.add(key, DEVICE_KEY));
    return key;
  } catch (e) {
    if ((e as { name?: string }).name !== 'ConstraintError') throw e;
    const winner = await read();
    if (!winner) throw e;
    return winner;
  }
}

const aad = (r: Pick<MasterRecord, 'v' | 'method' | 'id'>): BufferSource =>
  new TextEncoder().encode(`yacana-key:${r.v}:${r.method}:${r.id}`);

const SECRET_BYTES: Record<MasterRecord['method'], number> = { passkey: 32, words: 16 };

/** AES-GCM-256, a fresh 96-bit IV per write, the record's identity as AAD. */
export async function seal(
  secret: Uint8Array,
  record: Pick<MasterRecord, 'v' | 'method' | 'id'>,
): Promise<NonNullable<MasterRecord['sealed']>> {
  if (secret.length !== SECRET_BYTES[record.method])
    throw new Error(`a ${record.method} account's secret is ${SECRET_BYTES[record.method]} bytes`);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(record) },
    await deviceKey(),
    secret as BufferSource,
  );
  return { iv, ct: new Uint8Array(ct) };
}

async function unseal(record: MasterRecord): Promise<Uint8Array> {
  if (!record.sealed) throw new Error('this account is not stored on this device');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: record.sealed.iv as BufferSource, additionalData: aad(record) },
    await deviceKey(),
    record.sealed.ct as BufferSource,
  );
  return new Uint8Array(pt);
}

export const addressOf = async (master: Uint8Array, index: 0): Promise<string> => {
  const f = await deriveAccountFields(master, index);
  return (await getSchnorrInitializerlessAccountContractAddress(f.signingKey, f.salt, f.secret)).toString();
};

/** A words key's phrase, from the sealed entropy; only on the device that created or restored it. */
export async function openPhrase(record: MasterRecord): Promise<string> {
  if (record.method !== 'words') throw new Error('not a twelve-words account');
  return phraseFromEntropy(await unseal(record));
}

/**
 * The master for `record`: the one supplied (freshly derived from a PRF or a phrase) or the sealed
 * one (a words key's, derived from its sealed entropy). Either way the address it derives must be
 * the record's, or nothing opens.
 */
export async function openMaster(record: MasterRecord, supplied?: Uint8Array): Promise<Uint8Array> {
  const master =
    supplied ??
    (record.method === 'words' ? await masterFromMnemonic(await openPhrase(record)) : await unseal(record));
  const derived = await addressOf(master, record.account.index);
  if (derived !== record.account.address) {
    master.fill(0); // a master nobody will hold: not left in memory behind the error
    throw new Error(
      `this ${record.method === 'passkey' ? 'passkey' : 'phrase'} opens a different account than the one on this device`,
    );
  }
  return master;
}

/** Convenience mode on: seal and store. Off: drop the ciphertext; a touch per open from here on. */
export async function setStayOpen(
  record: MasterRecord,
  master: Uint8Array,
  stayOpen: boolean,
): Promise<MasterRecord> {
  if (record.method !== 'passkey') throw new Error('a twelve-words account is always sealed');
  const next: MasterRecord = { ...record, askEveryOpen: !stayOpen };
  if (stayOpen) next.sealed = await seal(master, record);
  else delete next.sealed;
  await putRecord(next);
  return next;
}

export const base64url = (b: Uint8Array): string =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
export const fromBase64url = (s: string): Uint8Array =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** Developer hygiene: an interim wallet database must never be silently reused or deleted. */
export async function assertNoLegacyWalletDb(): Promise<void> {
  const dbs = (await indexedDB.databases?.()) ?? [];
  const legacy = dbs.map((d) => d.name ?? '').filter((n) => n.startsWith('yacana-wallet-'));
  if (legacy.length)
    throw new Error(`unexpected wallet database ${legacy.join(', ')}: delete it by hand before continuing`);
}
