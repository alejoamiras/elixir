// bb.js fetches its CRS from Aztec's CDN with no integrity check. The page answers those fetches
// itself from /crs, after the whole asset's sha256 matched the pinned value. The node guard (loaded
// first) is the backstop: this wrapper sits over it, so a CRS request that slips past here reaches
// an endpoint that is neither the page nor the node and is rejected, never trusting transport
// security. Import right after the guard in every context that creates a Barretenberg instance.
import { delMany } from 'idb-keyval';
import lock from '../../site/crs.lock.json';

const HOSTS = new Set(lock.hosts);
const files = lock.files as Record<string, { bytes: number; sha256: string }>;
const verified = new Map<string, Promise<Uint8Array>>();

const TOTAL_BYTES = Object.values(files).reduce((n, f) => n + f.bytes, 0);

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

export interface CrsProgress {
  loaded: number;
  total: number;
  done: boolean;
  error?: string;
}

/**
 * Streams a pinned asset into a buffer of exactly its pinned size, reporting bytes as they land, and
 * checks the whole against the pin at the end: a wrong hash can only be known after the download; a
 * body longer than the pin fails the moment it overflows, never buffered whole.
 */
export async function streamVerified(
  res: Response,
  pin: { bytes: number; sha256: string },
  name: string,
  onBytes: (n: number) => void,
): Promise<Uint8Array> {
  if (!res.ok) throw new Error(`crs: /crs/${name} → HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error(`crs: ${name} came without a body`);
  const out = new Uint8Array(pin.bytes);
  let at = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (at + value.length > pin.bytes) {
      await reader.cancel();
      throw new Error(`crs: ${name} is longer than its pin (${pin.bytes} bytes)`);
    }
    out.set(value, at);
    at += value.length;
    onBytes(value.length);
  }
  const digest = hex(await crypto.subtle.digest('SHA-256', out.subarray(0, at)));
  if (at !== pin.bytes || digest !== pin.sha256)
    throw new Error(`crs: ${name} does not match its pin (${at} bytes, sha256 ${digest})`);
  return out;
}

let progress: CrsProgress = { loaded: 0, total: TOTAL_BYTES, done: false };
let onProgress: ((p: CrsProgress) => void) | undefined;
const report = (patch: Partial<CrsProgress>) => {
  progress = { ...progress, ...patch };
  onProgress?.(progress);
};

function load(name: string): Promise<Uint8Array> {
  let p = verified.get(name);
  if (!p) {
    p = (async () => {
      const pin = files[name];
      if (!pin) throw new Error(`crs: ${name} is not pinned`);
      const res = await originalFetch(`/crs/${name}`);
      return streamVerified(res, pin, name, (n) => report({ loaded: progress.loaded + n }));
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

// Bun's `fetch` type carries extras (`preconnect`) a browser's does not; the page only calls it.
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(href, globalThis.location?.href);
  return HOSTS.has(url.origin) ? serve(url, init) : originalFetch(input, init);
}) as typeof globalThis.fetch;

let crsRun: Promise<void> | undefined;

/**
 * Loads and verifies every pinned asset, with byte progress, from the first moment the page runs:
 * off the preflight's path, so the chain shows while the keys come down. One run per context; a bad
 * pin leaves it failed (only a reload retries) and the failure is in the progress and in `crsReady`.
 */
export function startCrs(listen?: (p: CrsProgress) => void): Promise<void> {
  if (listen) {
    onProgress = listen;
    listen(progress);
  }
  crsRun ??= (async () => {
    try {
      await purgeCrsCache();
      await Promise.all(Object.keys(files).map(load));
      report({ loaded: TOTAL_BYTES, done: true });
    } catch (e) {
      report({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  })();
  return crsRun;
}

/** The proving keys, verified: what the wallet's and the prover's start wait for. */
export const crsReady = (): Promise<void> => startCrs();

/**
 * bb.js serves the CRS from its own IndexedDB cache (idb-keyval keys) before it ever fetches, so
 * a stale or tampered cache would bypass the pins. Dropping it makes every load go through
 * `serve`; bb.js re-caches the decompressed form it derives from those verified bytes.
 */
export const purgeCrsCache = (): Promise<void> => delMany(['g1Data', 'g2Data', 'grumpkinG1DataV2']);
