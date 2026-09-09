// Where the page connects. The build carries the deployment (packages/site); the user may pick
// another node, persisted in localStorage and shared by the three apps; e2e builds may pin
// everything by query. A node is only ever used after it passed the deployment check.
export interface Connection {
  nodeUrl: string;
  miner: string;
  token: string;
}

export interface Expected {
  chainId: bigint;
  rollupVersion: bigint;
  rollupAddress: string;
  minerClassId: string;
  tokenClassId: string;
}

const KEY = 'yacana.connection';

const defaults: Connection = {
  nodeUrl: import.meta.env.VITE_AZTEC_NODE_URL,
  miner: import.meta.env.VITE_YACANA_MINER,
  token: import.meta.env.VITE_YACANA_TOKEN,
};

/** The build's default node: what "Use the default node" restores. */
export const defaultNodeUrl = (): string => defaults.nodeUrl;

/** Back to the build's node and a fresh boot: the way out of a saved node that does not answer. */
export const restoreDefaultNode = (): void => {
  // Reload only once the default is saved: a browser that refused the write would otherwise reload
  // straight back into the broken saved node. The banner stays up until the write can land.
  if (saveConnection({ nodeUrl: defaults.nodeUrl })) location.reload();
};

/** The miner's Node settings, from any of the three apps on the one origin. */
export const NODE_SETTINGS_HREF = '/mine/settings/';

/** The build's deployment identity, checked against the node at boot and before any switch. */
export const expectedDeployment = (): Expected => ({
  chainId: BigInt(import.meta.env.VITE_CHAIN_ID),
  rollupVersion: BigInt(import.meta.env.VITE_ROLLUP_VERSION),
  rollupAddress: import.meta.env.VITE_ROLLUP_ADDRESS,
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

/** False when the browser refused the write (quota, private mode): the caller must not act as if it held. */
export const saveConnection = (c: Pick<Connection, 'nodeUrl'>): boolean => {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ nodeUrl: c.nodeUrl }));
    return globalThis.localStorage?.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

/** The query string wins over storage, so an E2E page can never pick up a stale saved node. */
export const isPinnedByQuery = (): boolean => Object.keys(fromQuery()).length > 0;
