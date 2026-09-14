// The last balance this origin saw for an account on a version, sealed under the master the way
// the vault seals its records — so the build for the next version can say "you still had N on V5,
// last seen on D" to the same person and to nobody else. Written on every balance read; the key
// names the chain, the rollup, the token and the account, so versions never overwrite each other.
import { hkdf } from '../../../miner-core/src/keys/derive.ts';

const INFO = 'yacana.snapshot.v1';

export interface SnapshotScope {
  chainId: string;
  rollupVersion: string;
  token: string;
  account: string;
}

export const snapshotKey = (s: SnapshotScope): string =>
  `yacana.balance.v1.${s.chainId}.${s.rollupVersion}.${s.token}.${s.account}`;

export interface BalanceSnapshot {
  balance: bigint;
  at: number;
}

const te = new TextEncoder();
const td = new TextDecoder();

const base64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b));
const fromBase64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFor(master: Uint8Array): Promise<CryptoKey> {
  const bytes = await hkdf(master, INFO, 32);
  return crypto.subtle.importKey('raw', bytes as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** The page's localStorage; null where there is none (a worker, a test), so callers can say so explicitly. */
const storage = (): Storage | null => globalThis.localStorage ?? null;

/** AES-GCM under the master's snapshot key, the storage key as AAD; a refused write is silent. */
export async function saveBalanceSnapshot(
  master: Uint8Array,
  scope: SnapshotScope,
  snapshot: BalanceSnapshot,
  store: Storage | null = storage(),
): Promise<void> {
  if (!store) return;
  const key = snapshotKey(scope);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: te.encode(key) },
    await keyFor(master),
    te.encode(JSON.stringify({ balance: snapshot.balance.toString(), at: snapshot.at })),
  );
  try {
    store.setItem(key, JSON.stringify({ iv: base64(iv), ct: base64(new Uint8Array(ct)) }));
  } catch {
    /* private mode or quota: the snapshot is a convenience */
  }
}

/** The snapshot under this master, or null when there is none or it belongs to another master. */
export async function readBalanceSnapshot(
  master: Uint8Array,
  scope: SnapshotScope,
  store: Storage | null = storage(),
): Promise<BalanceSnapshot | null> {
  const key = snapshotKey(scope);
  const raw = store?.getItem(key);
  if (!raw) return null;
  try {
    const { iv, ct } = JSON.parse(raw) as { iv: string; ct: string };
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv) as BufferSource, additionalData: te.encode(key) },
      await keyFor(master),
      fromBase64(ct) as BufferSource,
    );
    const { balance, at } = JSON.parse(td.decode(pt)) as { balance: string; at: number };
    return { balance: BigInt(balance), at };
  } catch {
    return null;
  }
}
