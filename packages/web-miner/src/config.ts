// Where the page connects. Build-time defaults come from VITE_* (docs/deployments.md for the
// public testnet); the query string overrides them for E2E runs against an isolated network;
// user edits persist in localStorage.
export interface Connection {
  nodeUrl: string;
  /** Optional second node used only to cross-check epoch parameters (a lying RPC wastes work). */
  crossCheckUrl: string;
  miner: string;
  token: string;
}

const KEY = 'elixir.connection';

const defaults: Connection = {
  nodeUrl: import.meta.env.VITE_AZTEC_NODE_URL ?? 'https://v5.testnet.rpc.aztec-labs.com',
  crossCheckUrl: import.meta.env.VITE_AZTEC_CROSS_CHECK_URL ?? '',
  miner: import.meta.env.VITE_ELIXIR_MINER ?? '',
  token: import.meta.env.VITE_ELIXIR_TOKEN ?? '',
};

const fromQuery = (): Partial<Connection> => {
  const q = new URLSearchParams(globalThis.location?.search ?? '');
  const pick = (k: string) => q.get(k) ?? undefined;
  return {
    ...(pick('node') && { nodeUrl: pick('node') }),
    ...(pick('crossCheck') && { crossCheckUrl: pick('crossCheck') }),
    ...(pick('miner') && { miner: pick('miner') }),
    ...(pick('token') && { token: pick('token') }),
  } as Partial<Connection>;
};

const fromStorage = (): Partial<Connection> => {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') as Partial<Connection>;
  } catch {
    return {};
  }
};

export const loadConnection = (): Connection => ({ ...defaults, ...fromStorage(), ...fromQuery() });

export const saveConnection = (c: Connection): void => {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(c));
  } catch {
    /* private mode: settings live for the session only */
  }
};

/** The query string wins over storage, so an E2E page can never pick up a stale saved node. */
export const isPinnedByQuery = (): boolean => Object.keys(fromQuery()).length > 0;

/**
 * Node origins this build may talk to. The production CSP (`public/_headers`) is static, so a
 * node outside this list would fail at boot with an opaque fetch error; the list is checked first
 * and shown in the Network card. Dev builds additionally accept local nodes.
 */
export const allowedNodeOrigins = (): string[] => {
  const configured = (import.meta.env.VITE_ALLOWED_NODE_ORIGINS ?? defaults.nodeUrl)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((u) => new URL(u).origin);
  return [...new Set(configured)];
};

const isLocal = (origin: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);

/** The first configured URL the CSP would block, or null when every one is allowed. */
export const firstDisallowedUrl = (c: Connection): string | null => {
  for (const url of [c.nodeUrl, c.crossCheckUrl].filter(Boolean)) {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return url;
    }
    if (allowedNodeOrigins().includes(origin)) continue;
    if (import.meta.env.DEV && isLocal(origin)) continue;
    return url;
  }
  return null;
};
