// The log a bug report can carry: the tail of the in-memory log, shortened. It names this account's claims
// (transaction hashes, blocks) and the node; it is a shortened log, not a proof that error text holds no secrets.

const MAX_LINES = 200;
const MAX_LINE = 400;
const MAX_BYTES = 16_384;
const LONG_HEX = /0x[0-9a-fA-F]{40,}/g;
// A URL runs to whitespace, a quote or a closing paren; a bracketed IPv6 host (`user:x@[::1]:8080`) is
// kept whole, but a `]` that closes nothing is a wrapper's and ends the match, so `[https://…]` still parses.
const URL_LIKE = /https?:\/\/(?:[^\s'"`()[\]]|\[[0-9a-f:.]+\])+/gi;

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

const bytes = (s: string): number => new TextEncoder().encode(s).length;

/** Cuts `s` so that it, plus the ellipsis, fits in `max` UTF-8 bytes. */
const cutBytes = (s: string, max: number): string => {
  if (bytes(s) <= max) return s;
  const buf = new TextEncoder().encode(s).slice(0, max - 3);
  return `${new TextDecoder().decode(buf).replace(/\uFFFD+$/, '')}…`;
};

export function diagnostics(log: readonly string[]): string {
  const lines = log
    .slice(-MAX_LINES)
    .map((l) => l.replace(URL_LIKE, bareUrl).replace(LONG_HEX, shortHex))
    .map((l) => cutBytes(l, MAX_LINE));
  const out = lines.join('\n');
  if (bytes(out) <= MAX_BYTES) return out;
  const tail = new TextEncoder().encode(out);
  const kept = new TextDecoder().decode(tail.slice(tail.length - (MAX_BYTES - 3))).replace(/^\uFFFD+/, '');
  return `…${kept}`;
}
