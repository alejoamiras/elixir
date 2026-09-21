// What this browser profile remembers about Presto: that it proved here once (verified by the page)
// and how many times the user has taken that back. Its own storage key, never a settings field, so
// no unrelated settings write from a stale tab can carry consent back; per profile, not per account,
// like the browser permission it mirrors. An older build never reads the key.

export const CONSENT_KEY = 'yacana.presto';

export interface ConsentRecord {
  /** Presto produced a proof here that the page verified itself. */
  used: boolean;
  /**
   * Bumped by every revoke, even from `used: false`: a revoke must be visible to a tab whose
   * consent is only a click (`consentRev`), and to any tab through the `storage` event.
   */
  rev: number;
}

export const NO_CONSENT: ConsentRecord = { used: false, rev: 0 };

/** The two Web Storage calls the record needs; `localStorage` in the browser, a Map in tests. */
export interface ConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Runs `fn` while holding `name` against every other tab; `navigator.locks` in the browser. */
export type ConsentLock = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

export interface ConsentDeps {
  /** null: no storage at all; the record lives in this page's memory. */
  storage: ConsentStorage | null;
  /** Absent: unlocked read-modify-write (the residual race is two tabs acting within one task). */
  lock?: ConsentLock;
  /** What other tabs commit: the browser's `storage` event, delivered with its key (null on `clear`). */
  onStorage?: (cb: (key: string | null) => void) => () => void;
}

export interface Consent {
  /** The record as this page must act on it: fresh from storage, except where memory took over. */
  read(): ConsentRecord;
  /** `used: true`, only if the record's `rev` is still `atRev`: a revoke since then wins. */
  promote(atRev: number): Promise<void>;
  /**
   * `used: false` and `rev + 1`. From the call until the write commits `read()` already says
   * `used: false`, whatever storage holds: nothing may act on the old record meanwhile.
   */
  revoke(): Promise<void>;
  /** Resolves once every write issued so far has landed, in storage or in memory. */
  settled(): Promise<void>;
  /** Called after every change this page can see: its own writes and other tabs' commits. */
  subscribe(cb: () => void): () => void;
}

export function parseConsent(raw: string | null): ConsentRecord {
  try {
    const v: unknown = JSON.parse(raw ?? 'null');
    if (v && typeof v === 'object') {
      const { used, rev } = v as Record<string, unknown>;
      if (typeof used === 'boolean' && typeof rev === 'number' && Number.isInteger(rev) && rev >= 0)
        return { used, rev };
    }
  } catch {
    /* foreign value */
  }
  return NO_CONSENT;
}

/**
 * Presto may be transmitted to: it has proved here before, or this page's Look was made at the
 * record's current revision (a revoke anywhere since then moved it).
 */
export const isConsented = (r: ConsentRecord, consentRev: number | null): boolean =>
  r.used || (consentRev !== null && consentRev === r.rev);

const unlocked: ConsentLock = (_name, fn) => fn();

export function createConsent(deps: ConsentDeps): Consent {
  const lock = deps.lock ?? unlocked;
  const listeners = new Set<() => void>();
  let unsubStorage: (() => void) | undefined;
  // Once memory holds the record, storage is never read again this page: a value this page could
  // not persist (or could not read) must not be replaced by an older one that later reads fine.
  let memory: ConsentRecord | null = deps.storage ? null : NO_CONSENT;
  let revoking = 0;
  // Parsed once per raw value so an unchanged record is the same object (`useSyncExternalStore`).
  let parsed: { raw: string | null; record: ConsentRecord } = { raw: null, record: NO_CONSENT };
  let latched: { of: ConsentRecord; record: ConsentRecord } | undefined;
  let tail: Promise<unknown> = Promise.resolve();

  const notify = () => {
    for (const cb of listeners) cb();
  };

  const stored = (): ConsentRecord => {
    if (memory) return memory;
    let raw: string | null;
    try {
      raw = (deps.storage as ConsentStorage).getItem(CONSENT_KEY);
    } catch {
      memory = NO_CONSENT;
      return memory;
    }
    if (raw !== parsed.raw) parsed = { raw, record: parseConsent(raw) };
    return parsed.record;
  };

  const write = (next: ConsentRecord) => {
    const raw = JSON.stringify(next);
    if (!memory) {
      try {
        (deps.storage as ConsentStorage).setItem(CONSENT_KEY, raw);
        parsed = { raw, record: next };
        return;
      } catch {
        /* memory takes over below */
      }
    }
    memory = next;
  };

  const mutate = (fn: (r: ConsentRecord) => ConsentRecord | null): Promise<void> => {
    const run = lock(CONSENT_KEY, async () => {
      const next = fn(stored());
      if (!next) return;
      write(next);
      notify();
    });
    tail = Promise.allSettled([tail, run]);
    return run;
  };

  return {
    read() {
      const r = stored();
      if (revoking === 0 || !r.used) return r;
      if (latched?.of !== r) latched = { of: r, record: { ...r, used: false } };
      return latched.record;
    },
    promote: (atRev) => mutate((r) => (r.rev === atRev && !r.used ? { used: true, rev: r.rev } : null)),
    revoke() {
      revoking++;
      notify();
      return mutate((r) => ({ used: false, rev: r.rev + 1 })).finally(() => {
        revoking--;
        notify();
      });
    },
    settled: () => tail.then(() => undefined),
    subscribe(cb) {
      listeners.add(cb);
      if (listeners.size === 1 && deps.onStorage)
        unsubStorage = deps.onStorage((key) => {
          if ((key === null || key === CONSENT_KEY) && !memory) notify();
        });
      return () => {
        listeners.delete(cb);
        if (listeners.size > 0) return;
        unsubStorage?.();
        unsubStorage = undefined;
      };
    },
  };
}

const browserStorage = (): ConsentStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // a SecurityError on access: same as no storage
  }
};

export const browserConsentDeps = (): ConsentDeps => ({
  storage: browserStorage(),
  lock: globalThis.navigator?.locks
    ? (name, fn) => navigator.locks.request(name, () => fn()) as Promise<never>
    : undefined,
  onStorage:
    typeof globalThis.addEventListener === 'function'
      ? (cb) => {
          const on = (e: Event) => cb((e as StorageEvent).key);
          addEventListener('storage', on);
          return () => removeEventListener('storage', on);
        }
      : undefined,
});

/** The page's record; every context of the page (the rail, Settings, the session) reads this one. */
export const consent: Consent = createConsent(browserConsentDeps());
