// The vault: IndexedDB `yacana-keys`, one record per master. What is at rest depends on the mode:
// a passkey key in the default mode stores only metadata (the master is re-derived from the PRF on
// every open); a words key, or a passkey key that "stays open on this device", stores the master
// sealed with AES-GCM under a non-extractable device key kept in the same database. Every open,
// in every mode, re-derives account 0 and fails closed unless it equals the stored address.
import { getSchnorrInitializerlessAccountContractAddress } from '@aztec/accounts/schnorr';
import { deriveAccountFields } from '../../../miner-core/src/keys/derive.ts';

export interface MasterRecord {
  v: 1;
  id: string;
  method: 'passkey' | 'words';
  createdAt: number;
  /** base64url of the credential's raw id (passkey keys). */
  credentialId?: string;
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

async function withStore<T>(
  name: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await request(fn(db.transaction(name, mode).objectStore(name)));
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

/** Deletes the record; the PXE namespace is shared and goes only with "forget everything on this device". */
export const forgetMaster = (id: string): Promise<unknown> =>
  withStore(RECORDS, 'readwrite', (s) => s.delete(id));

/** The device key never leaves the browser's key store; the browser serialises it to the profile. */
async function deviceKey(): Promise<CryptoKey> {
  const existing = await withStore(
    DEVICE,
    'readonly',
    (s) => s.get(DEVICE_KEY) as IDBRequest<CryptoKey | undefined>,
  );
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  await withStore(DEVICE, 'readwrite', (s) => s.put(key, DEVICE_KEY));
  return key;
}

const aad = (r: Pick<MasterRecord, 'v' | 'method' | 'id'>): BufferSource =>
  new TextEncoder().encode(`yacana-key:${r.v}:${r.method}:${r.id}`);

/** AES-GCM-256, a fresh 96-bit IV per write, the record's identity as AAD. */
export async function sealMaster(
  master: Uint8Array,
  record: Pick<MasterRecord, 'v' | 'method' | 'id'>,
): Promise<NonNullable<MasterRecord['sealed']>> {
  if (master.length !== 32) throw new Error('a master is 32 bytes');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(record) },
    await deviceKey(),
    master as BufferSource,
  );
  return { iv, ct: new Uint8Array(ct) };
}

async function unseal(record: MasterRecord): Promise<Uint8Array> {
  if (!record.sealed) throw new Error('this key is not stored on this device');
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

/**
 * The master for `record`: the one supplied (freshly derived from a PRF or a phrase) or the sealed
 * one. Either way the address it derives must be the record's, or nothing opens.
 */
export async function openMaster(record: MasterRecord, supplied?: Uint8Array): Promise<Uint8Array> {
  const master = supplied ?? (await unseal(record));
  const derived = await addressOf(master, record.account.index);
  if (derived !== record.account.address)
    throw new Error(
      `this ${record.method === 'passkey' ? 'passkey' : 'phrase'} opens a different key than the one on this device`,
    );
  return master;
}

/** Convenience mode on: seal and store. Off: drop the ciphertext; a touch per open from here on. */
export async function setStayOpen(
  record: MasterRecord,
  master: Uint8Array,
  stayOpen: boolean,
): Promise<MasterRecord> {
  const next: MasterRecord = { ...record, askEveryOpen: !stayOpen };
  if (stayOpen) next.sealed = await sealMaster(master, record);
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
