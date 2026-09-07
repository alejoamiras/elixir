// The log a bug report can carry: the tail of the in-memory log, shortened. It names this account's claims
// (transaction hashes, blocks) and the node; it is a shortened log, not a proof that error text holds no secrets.

const MAX_LINES = 200;
const MAX_LINE = 400;
const MAX_BYTES = 16_384;
const LONG_HEX = /0x[0-9a-fA-F]{40,}/g;
const URL_LIKE = /https?:\/\/[^\s'"`)\]]+/g;

const shortHex = (h: string): string => `${h.slice(0, 6)}…${h.slice(-4)}`;

/** Strips credentials and queries from a URL, keeping origin and path; leaves unparsable text alone. */
const bareUrl = (u: string): string => {
  try {
    const parsed = new URL(u);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return u;
  }
};

export function diagnostics(log: readonly string[]): string {
  const lines = log
    .slice(-MAX_LINES)
    .map((l) => l.replace(URL_LIKE, bareUrl).replace(LONG_HEX, shortHex))
    .map((l) => (l.length > MAX_LINE ? `${l.slice(0, MAX_LINE)}…` : l));
  let out = lines.join('\n');
  if (out.length > MAX_BYTES) out = `…${out.slice(out.length - MAX_BYTES)}`;
  return out;
}
