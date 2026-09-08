// The page's own bound on where it talks: the policy admits any https origin so the node can be
// a setting, and this interceptor refuses in code everything that is not the page's origin, the
// node in use or a candidate under check. Installed once per context (page and prover Worker)
// before `pinned-crs`, whose fall-through it is, so an unpinned CRS host fails here instead of
// reaching the network. `data:` and `blob:` loads are not network requests (bb.js carries its
// WASM as `data:` URLs) and pass untouched.
export interface NodeRequestOutcome {
  /** The normalised endpoint the request went to. */
  endpoint: string;
  startedAt: number;
  status: number | 'timeout' | 'network';
  latencyMs: number;
}

interface GuardState {
  endpoint: string | null;
  deadlineMs: number;
  candidates: Map<string, number>;
  listeners: Set<(o: NodeRequestOutcome) => void>;
  /** A synthetic answer for the endpoint while it is on a cooldown; null lets the request through. */
  gate: ((endpoint: string) => Response | null) | null;
}

// The state hangs off the realm, not off `fetch`: later interceptors (`pinned-crs`) wrap the guard,
// and the guard must still be reachable through them.
const MARK = Symbol.for('yacana.node-guard');
type Realm = typeof globalThis & { [MARK]?: GuardState };

/** origin + path (no trailing slash) + query: the SDK posts to the URL as given, so equality is the match. */
export function normaliseEndpoint(url: string): string {
  const u = new URL(url);
  const path = u.pathname.replace(/\/+$/, '');
  return `${u.origin}${path}${u.search}`;
}

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** What the PXE view marker and the history cache key a node by: two paths on one origin are two nodes. */
export const endpointFingerprint = async (url: string): Promise<string> =>
  hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normaliseEndpoint(url))));

const state = (): GuardState => {
  const s = (globalThis as Realm)[MARK];
  if (!s) throw new Error('node guard is not installed in this context');
  return s;
};

export const setNodeEndpoint = (url: string | null, deadlineMs: number): void => {
  const s = state();
  s.endpoint = url === null ? null : normaliseEndpoint(url);
  s.deadlineMs = deadlineMs;
};

export const currentNodeEndpoint = (): string | null => state().endpoint;

/** A probe's lease: its requests pass and are not reported; the release ends it. */
export function allowCandidate(url: string, deadlineMs: number): () => void {
  const s = state();
  const endpoint = normaliseEndpoint(url);
  s.candidates.set(endpoint, deadlineMs);
  return () => void s.candidates.delete(endpoint);
}

export function onNodeResponse(fn: (o: NodeRequestOutcome) => void): () => void {
  const s = state();
  s.listeners.add(fn);
  return () => void s.listeners.delete(fn);
}

export const setNodeGate = (gate: GuardState['gate']): void => {
  state().gate = gate;
};

const hrefOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const withDeadline = (input: RequestInfo | URL, init: RequestInit | undefined, ms: number): RequestInit => {
  const own = init?.signal ?? (input instanceof Request ? input.signal : null);
  const deadline = AbortSignal.timeout(ms);
  // A redirect could carry the request past the check; the caller's `follow` does not override this.
  return { ...init, redirect: 'error', signal: own ? AbortSignal.any([own, deadline]) : deadline };
};

function report(s: GuardState, endpoint: string, startedAt: number, status: NodeRequestOutcome['status']) {
  const o: NodeRequestOutcome = { endpoint, startedAt, status, latencyMs: performance.now() - startedAt };
  for (const fn of s.listeners) fn(o);
}

async function nodeRequest(
  s: GuardState,
  original: typeof globalThis.fetch,
  endpoint: string,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<Response> {
  const synthetic = s.gate?.(endpoint);
  if (synthetic) return synthetic;
  const startedAt = performance.now();
  try {
    const res = await original(input, withDeadline(input, init, s.deadlineMs));
    report(s, endpoint, startedAt, res.status);
    return res;
  } catch (e) {
    report(
      s,
      endpoint,
      startedAt,
      e instanceof DOMException && e.name === 'TimeoutError' ? 'timeout' : 'network',
    );
    throw e;
  }
}

/**
 * Installs the guard over the context's current `fetch`. Runs once at import; a test that swaps
 * `fetch` for a fake first calls it again so the guard sits over the fake.
 */
export function installNodeGuard(): void {
  const original = globalThis.fetch.bind(globalThis);
  const s: GuardState = {
    endpoint: null,
    deadlineMs: 120_000,
    candidates: new Map(),
    listeners: new Set(),
    gate: null,
  };
  const guarded = ((input: RequestInfo | URL, init?: RequestInit) => {
    const href = hrefOf(input);
    if (/^(data|blob):/i.test(href)) return original(input, init);
    const url = new URL(href, globalThis.location?.href);
    if (url.origin === globalThis.location?.origin) return original(input, init);
    const endpoint = normaliseEndpoint(url.href);
    if (endpoint === s.endpoint) return nodeRequest(s, original, endpoint, input, init);
    const lease = s.candidates.get(endpoint);
    if (lease !== undefined) return original(input, withDeadline(input, init, lease));
    return Promise.reject(
      new Error(`blocked endpoint ${url.origin}${url.pathname}: not this page, its node or a candidate`),
    );
  }) as typeof globalThis.fetch;
  (globalThis as Realm)[MARK] = s;
  globalThis.fetch = guarded;
}

if (!(globalThis as Realm)[MARK]) installNodeGuard();
