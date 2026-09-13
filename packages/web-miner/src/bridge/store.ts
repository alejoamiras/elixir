// The journal on this device: IndexedDB `yacana-bridge`, every crossing under the account that
// made it — named by the master's fingerprint, so the same records show under any account class —
// and, per version, the next crossing index. The index is read and taken inside the transaction
// that writes the crossing, so two tabs (or two clicks) never derive the same secrets; a reserved
// index whose crossing later failed is never reused (its secrets may have reached a log).
import type { Hex } from 'viem';
import type { Crossing } from '../../../bridge/src/journal.ts';

export const BRIDGE_DB = 'yacana-bridge';
const CROSSINGS = 'crossings';
const INDICES = 'indices';

export interface JournalScope {
  chainId: string;
  portal: Hex;
  /** The master's fingerprint (keys/classes.ts). */
  owner: string;
}

type Row = Crossing & { scope: string };

export const scopeKey = (s: JournalScope): string => `${s.chainId}:${s.portal.toLowerCase()}:${s.owner}`;

const open = (name: string): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(CROSSINGS, { keyPath: 'id' }).createIndex('scope', 'scope');
      req.result.createObjectStore(INDICES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const request = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const committed = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    tx.onerror = () => reject(tx.error);
  });

const strip = ({ scope: _scope, ...c }: Row): Crossing => c;

export interface BridgeStore {
  list(): Promise<Crossing[]>;
  get(id: string): Promise<Crossing | undefined>;
  put(c: Crossing): Promise<void>;
  /** Read-modify-write in one transaction; `f` sees the stored record, not a stale one. */
  update(id: string, f: (c: Crossing) => Crossing): Promise<Crossing>;
  /**
   * The next index of `version`, taken and written together with the crossing `make` builds for
   * it. `seed` runs only when this device has never reserved on the version: the chain's own count
   * of the account's exits there (a scan), so a fresh device continues where the last one stopped.
   */
  create(version: string, seed: () => Promise<number>, make: (index: number) => Crossing): Promise<Crossing>;
  /** The next index this device would hand out for `version`, or undefined before the first reservation. */
  nextIndex(version: string): Promise<number | undefined>;
}

export function openBridgeStore(scope: JournalScope, dbName = BRIDGE_DB): BridgeStore {
  const scoped = scopeKey(scope);
  const counterKey = (version: string) => `${scoped}:${version}`;
  const withDb = async <T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> => {
    const db = await open(dbName);
    try {
      return await fn(db);
    } finally {
      db.close();
    }
  };
  const readCounter = (db: IDBDatabase, version: string) =>
    request(
      db.transaction(INDICES, 'readonly').objectStore(INDICES).get(counterKey(version)) as IDBRequest<
        { next: number } | undefined
      >,
    );
  return {
    list: () =>
      withDb(async (db) =>
        (
          (await request(
            db.transaction(CROSSINGS, 'readonly').objectStore(CROSSINGS).index('scope').getAll(scoped),
          )) as Row[]
        ).map(strip),
      ),
    get: (id) =>
      withDb(async (db) => {
        const row = (await request(db.transaction(CROSSINGS, 'readonly').objectStore(CROSSINGS).get(id))) as
          | Row
          | undefined;
        return row && row.scope === scoped ? strip(row) : undefined;
      }),
    put: (c) =>
      withDb(async (db) => {
        const tx = db.transaction(CROSSINGS, 'readwrite');
        tx.objectStore(CROSSINGS).put({ ...c, scope: scoped } satisfies Row);
        await committed(tx);
      }),
    update: (id, f) =>
      withDb(async (db) => {
        const tx = db.transaction(CROSSINGS, 'readwrite');
        const store = tx.objectStore(CROSSINGS);
        const row = (await request(store.get(id))) as Row | undefined;
        if (!row || row.scope !== scoped) throw new Error(`no crossing ${id} in this journal`);
        const next = f(strip(row));
        store.put({ ...next, scope: scoped } satisfies Row);
        await committed(tx);
        return next;
      }),
    create: (version, seed, make) =>
      withDb(async (db) => {
        // The seed is fetched outside the transaction (a transaction cannot wait on the network),
        // then the counter is read again inside it: a tab that reserved meanwhile wins.
        const seeded = (await readCounter(db, version)) ? undefined : await seed();
        const tx = db.transaction([INDICES, CROSSINGS], 'readwrite');
        const indices = tx.objectStore(INDICES);
        const counter = (await request(indices.get(counterKey(version)))) as { next: number } | undefined;
        const index = counter?.next ?? seeded ?? 0;
        const crossing = make(index);
        indices.put({ next: index + 1 }, counterKey(version));
        tx.objectStore(CROSSINGS).put({ ...crossing, scope: scoped } satisfies Row);
        await committed(tx);
        return crossing;
      }),
    nextIndex: (version) => withDb(async (db) => (await readCounter(db, version))?.next),
  };
}

/** The window of candidate indices a scan looks at before it decides the account has no more exits. */
export const SCAN_WINDOW = 20;

/**
 * The account's next unused index on a version, from the chain: the exit log is queried by the tags
 * of `SCAN_WINDOW` indices at a time until a whole window is silent; the answer is one past the
 * last index seen. `used(indices)` says which of the indices have a log.
 */
export async function scanNextIndex(
  used: (indices: number[]) => Promise<boolean[]>,
  window = SCAN_WINDOW,
): Promise<number> {
  let last = -1;
  for (let from = 0; ; from += window) {
    const indices = Array.from({ length: window }, (_, i) => from + i);
    const hits = await used(indices);
    const seen = indices.filter((_, i) => hits[i]);
    if (seen.length === 0) return last + 1;
    last = seen[seen.length - 1] as number;
  }
}
