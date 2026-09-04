// bb.js fetches its CRS from Aztec's CDN with no integrity check. The page answers those fetches
// itself from /crs, after the whole asset's sha256 matched the pinned value; the CSP blocks the
// CDN hosts, so an unintercepted request fails loudly instead of trusting transport security.
// Import first in every context that creates a Barretenberg instance (page and Worker).
import lock from '../crs.lock.json';

const HOSTS = new Set(lock.hosts);
const files = lock.files as Record<string, { bytes: number; sha256: string }>;
const verified = new Map<string, Promise<Uint8Array>>();

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

function load(name: string): Promise<Uint8Array> {
  let p = verified.get(name);
  if (!p) {
    p = (async () => {
      const pin = files[name];
      if (!pin) throw new Error(`crs: ${name} is not pinned`);
      const res = await originalFetch(`/crs/${name}`);
      if (!res.ok) throw new Error(`crs: /crs/${name} → HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
      if (bytes.length !== pin.bytes || digest !== pin.sha256)
        throw new Error(`crs: ${name} does not match its pin (${bytes.length} bytes, sha256 ${digest})`);
      return bytes;
    })();
    verified.set(name, p);
  }
  return p;
}

const originalFetch = globalThis.fetch.bind(globalThis);

function requestedRange(init: RequestInit | undefined, total: number): [number, number] {
  const header = new Headers(init?.headers).get('range');
  const m = header?.match(/^bytes=(\d+)-(\d+)?$/);
  if (!m) return [0, total];
  const start = Number(m[1]);
  const end = m[2] === undefined ? total : Math.min(total, Number(m[2]) + 1);
  return [start, end];
}

async function serve(url: URL, init: RequestInit | undefined): Promise<Response> {
  const name = url.pathname.slice(1);
  const bytes = await load(name);
  const [start, end] = requestedRange(init, bytes.length);
  if (end > bytes.length) throw new Error(`crs: ${name} asked for ${end} bytes, pinned ${bytes.length}`);
  const partial = start !== 0 || end !== bytes.length;
  return new Response(bytes.slice(start, end), {
    status: partial ? 206 : 200,
    headers: partial ? { 'Content-Range': `bytes ${start}-${end - 1}/${bytes.length}` } : {},
  });
}

globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(href, globalThis.location?.href);
  return HOSTS.has(url.origin) ? serve(url, init) : originalFetch(input, init);
};

/** Verifies and caches every pinned file; call at boot so a bad asset fails before any proving. */
export const preloadPinnedCrs = (): Promise<Uint8Array[]> => Promise.all(Object.keys(files).map(load));
