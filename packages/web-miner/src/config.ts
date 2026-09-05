// Where the page connects. The build carries the deployment (packages/site); the user may pick
// another allowlisted node, persisted in localStorage; e2e builds may pin everything by query.
export interface Connection {
  nodeUrl: string;
  miner: string;
  token: string;
}

export interface Expected {
  chainId: bigint;
  rollupVersion: bigint;
  minerClassId: string;
  tokenClassId: string;
}

const KEY = 'yacana.connection';

const defaults: Connection = {
  nodeUrl: import.meta.env.VITE_AZTEC_NODE_URL,
  miner: import.meta.env.VITE_YACANA_MINER,
  token: import.meta.env.VITE_YACANA_TOKEN,
};

/** The build's deployment identity, checked against the node at boot. */
export const expectedDeployment = (): Expected => ({
  chainId: BigInt(import.meta.env.VITE_CHAIN_ID),
  rollupVersion: BigInt(import.meta.env.VITE_ROLLUP_VERSION),
  minerClassId: import.meta.env.VITE_YACANA_MINER_CLASS,
  tokenClassId: import.meta.env.VITE_YACANA_TOKEN_CLASS,
});

/**
 * A crafted link must not point a production page at another deployment on the allowed node;
 * only an e2e build on localhost honours the query.
 */
export const queryOverridesAllowed = (hostname = globalThis.location?.hostname): boolean =>
  import.meta.env.VITE_E2E_QUERY_OVERRIDES === '1' && hostname === 'localhost';

const fromQuery = (): Partial<Connection> => {
  if (!queryOverridesAllowed()) return {};
  const q = new URLSearchParams(globalThis.location?.search ?? '');
  const pick = (k: string) => q.get(k) ?? undefined;
  return {
    ...(pick('node') && { nodeUrl: pick('node') }),
    ...(pick('miner') && { miner: pick('miner') }),
    ...(pick('token') && { token: pick('token') }),
  } as Partial<Connection>;
};

const fromStorage = (): Partial<Connection> => {
  try {
    const stored = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? '{}') as Partial<Connection>;
    // Only the node is a user setting; the deployment is the build's.
    return stored.nodeUrl ? { nodeUrl: stored.nodeUrl } : {};
  } catch {
    return {};
  }
};

export const loadConnection = (): Connection => ({ ...defaults, ...fromStorage(), ...fromQuery() });

export const saveConnection = (c: Pick<Connection, 'nodeUrl'>): void => {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ nodeUrl: c.nodeUrl }));
  } catch {
    /* private mode: settings live for the session only */
  }
};

/** The query string wins over storage, so an E2E page can never pick up a stale saved node. */
export const isPinnedByQuery = (): boolean => Object.keys(fromQuery()).length > 0;

/** Node origins this build's CSP lets the page reach; a node outside fails at boot, not with an opaque fetch. */
export const allowedNodeOrigins = (): string[] => [
  ...new Set(
    import.meta.env.VITE_ALLOWED_NODE_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((u) => new URL(u).origin),
  ),
];

const isLocal = (origin: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);

/** The configured node URL when the CSP would block it, or null. */
export const disallowedNodeUrl = (c: Connection): string | null => {
  let origin: string;
  try {
    origin = new URL(c.nodeUrl).origin;
  } catch {
    return c.nodeUrl;
  }
  if (allowedNodeOrigins().includes(origin)) return null;
  if (import.meta.env.DEV && isLocal(origin)) return null;
  return c.nodeUrl;
};
