// Links into the block explorer for the values the pages show. Pure: the base URL is build-time
// config, every identifier is validated before it becomes a path segment, and an invalid one
// yields no link (the caller renders plain text) rather than a malformed URL. A node can only
// ever steer a link to a well-formed page for a value it reported.

const HEX32 = /^0x[0-9a-f]{64}$/;

/** The base URL, or `undefined` when links are switched off (`VITE_EXPLORER_URL=off` or unset). */
export const explorerBase = (raw: string | undefined): string | undefined => {
  if (!raw || raw === 'off') return undefined;
  const url = new URL(raw);
  return url.origin;
};

const hex32 = (v: string): string | undefined => (HEX32.test(v.toLowerCase()) ? v.toLowerCase() : undefined);
const count = (n: number | bigint): string | undefined => {
  if (typeof n === 'number' && !Number.isSafeInteger(n)) return undefined;
  const v = typeof n === 'bigint' ? n : BigInt(n);
  return v > 0n ? v.toString() : undefined;
};

export interface Explorer {
  /** A deployed contract by address (the miner, the token). */
  instance(address: string): string | undefined;
  /** A contract class by id; the yacana classes are version 1. */
  classVersion(id: string, version?: number): string | undefined;
  /** An account by address. */
  address(address: string): string | undefined;
  /** A block by number. */
  block(n: number | bigint): string | undefined;
  /** A transaction by hash (its public effects: nullifiers, note hashes, storage writes). */
  tx(hash: string): string | undefined;
}

export function explorer(base: string | undefined): Explorer {
  const at = (path: string, ...parts: (string | undefined)[]): string | undefined =>
    base && parts.every((p) => p !== undefined)
      ? `${base}${path}${parts.map((p) => `/${encodeURIComponent(p as string)}`).join('')}`
      : undefined;
  return {
    instance: (a) => at('/contracts/instances', hex32(a)),
    classVersion: (id, v = 1) => {
      const ver = count(v);
      return ver === undefined ? undefined : at('/contracts/classes', hex32(id), 'versions', ver);
    },
    address: (a) => at('/address', hex32(a)),
    block: (n) => at('/blocks', count(n)),
    tx: (h) => at('/tx-effects', hex32(h)),
  };
}
