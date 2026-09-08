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
  /** The HTTP status once the body landed, or how the request died; reported once per request. */
  status: number | 'timeout' | 'network';
  latencyMs: number;
  /** The `Retry-After` header when the browser lets the page read it (it is not CORS-safelisted). */
  retryAfter: string | null;
}

interface GuardState {
  /** The context's fetch under the guard; re-pointed when the guard is re-armed over a test's fake. */
  original: typeof globalThis.fetch;
  guarded: typeof globalThis.fetch;
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

function report(
  s: GuardState,
  endpoint: string,
  startedAt: number,
  status: NodeRequestOutcome['status'],
  retryAfter: string | null = null,
) {
  const o: NodeRequestOutcome = {
    endpoint,
    startedAt,
    status,
    latencyMs: performance.now() - startedAt,
    retryAfter,
  };
  for (const fn of s.listeners) fn(o);
}

const died = (e: unknown): 'timeout' | 'network' =>
  e instanceof DOMException && e.name === 'TimeoutError' ? 'timeout' : 'network';

/**
 * A node can send `200` headers and stall the body, and the SDK reads the body after `fetch`
 * resolves: the outcome is reported once the body has landed (or died), through a pass-through
 * stream, so a recovery is not declared on headers alone.
 */
function reportOnBody(s: GuardState, endpoint: string, startedAt: number, res: Response): Response {
  if (!res.body) {
    report(s, endpoint, startedAt, res.status, res.headers.get('retry-after'));
    return res;
  }
  let done = false;
  const settle = (status: NodeRequestOutcome['status']) => {
    if (done) return;
    done = true;
    report(s, endpoint, startedAt, status, res.headers.get('retry-after'));
  };
  const observed = new TransformStream<Uint8Array, Uint8Array>({
    flush: () => settle(res.status),
  });
  const body = res.body.pipeThrough(observed);
  // A body that errors (the deadline, a reset) reports the death; the reader sees the error as before.
  const reader = body.getReader();
  const relay = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done: end } = await reader.read();
        if (end) controller.close();
        else controller.enqueue(value);
      } catch (e) {
        settle(died(e));
        controller.error(e);
      }
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return new Response(relay, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function nodeRequest(
  s: GuardState,
  endpoint: string,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<Response> {
  const synthetic = s.gate?.(endpoint);
  if (synthetic) return synthetic;
  const startedAt = performance.now();
  try {
    const res = await s.original(input, withDeadline(input, init, s.deadlineMs));
    return reportOnBody(s, endpoint, startedAt, res);
  } catch (e) {
    report(s, endpoint, startedAt, died(e));
    throw e;
  }
}

/**
 * Installs the guard over the context's current `fetch`; runs once at import. Called again (a
 * test that swapped `fetch` for a fake), it re-points the one guard at the new fetch instead of
 * stacking a second one.
 */
export function installNodeGuard(): void {
  const existing = (globalThis as Realm)[MARK];
  if (existing) {
    if (globalThis.fetch !== existing.guarded) existing.original = globalThis.fetch.bind(globalThis);
    globalThis.fetch = existing.guarded;
    return;
  }
  const s: GuardState = {
    original: globalThis.fetch.bind(globalThis),
    guarded: globalThis.fetch,
    endpoint: null,
    deadlineMs: 120_000,
    candidates: new Map(),
    listeners: new Set(),
    gate: null,
  };
  s.guarded = ((input: RequestInfo | URL, init?: RequestInit) => {
    const href = hrefOf(input);
    if (/^(data|blob):/i.test(href)) return s.original(input, init);
    const url = new URL(href, globalThis.location?.href);
    if (url.origin === globalThis.location?.origin) return s.original(input, init);
    const endpoint = normaliseEndpoint(url.href);
    if (endpoint === s.endpoint) return nodeRequest(s, endpoint, input, init);
    const lease = s.candidates.get(endpoint);
    if (lease !== undefined) return s.original(input, withDeadline(input, init, lease));
    return Promise.reject(
      new Error(`blocked endpoint ${url.origin}${url.pathname}: not this page, its node or a candidate`),
    );
  }) as typeof globalThis.fetch;
  (globalThis as Realm)[MARK] = s;
  globalThis.fetch = s.guarded;
}

if (!(globalThis as Realm)[MARK]) installNodeGuard();
