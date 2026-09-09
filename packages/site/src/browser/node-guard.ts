// The page's own bound on where it talks: the policy admits any https origin so the node can be
// a setting, and this interceptor refuses in code everything that is not the page's origin, the
// node in use, the accelerator's fixed URLs or a candidate under check. Installed once per context (page and prover Worker)
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
  /** Optional work (the stats page's background fill): the health store never opens a cooldown on it. */
  quiet: boolean;
}

interface GuardState {
  /** The context's fetch under the guard; re-pointed when the guard is re-armed over a test's fake. */
  original: typeof globalThis.fetch;
  guarded: typeof globalThis.fetch;
  endpoint: string | null;
  deadlineMs: number;
  /** Leased candidates by endpoint: overlapping probes each hold the lease until the last releases it. */
  candidates: Map<string, { deadlineMs: number; owners: number }>;
  /** The local accelerator's exact URLs (health and prove routes): admitted for the session, never reported. */
  accelerators: Set<string> | null;
  acceleratorDeadlineMs: number;
  /** Requests in flight under `quietNodeReads`. */
  quiet: number;
  listeners: Set<(o: NodeRequestOutcome) => void>;
  /** A synthetic answer for the endpoint while it is on a cooldown; null lets the request through. */
  gate: ((endpoint: string) => Response | null) | null;
}

// The state hangs off the realm, not off `fetch`: later interceptors (`pinned-crs`) wrap the guard,
// and the guard must still be reachable through them.
const MARK = Symbol.for('yacana.node-guard');
type Realm = typeof globalThis & { [MARK]?: GuardState };

/** origin + path + query, exactly as the SDK posts it (`/rpc` and `/rpc/` can be two nodes); no fragment. */
export function normaliseEndpoint(url: string): string {
  const u = new URL(url);
  return `${u.origin}${u.pathname}${u.search}`;
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
  const endpoint = url === null ? null : normaliseEndpoint(url);
  // A node at an accelerator URL would take its requests (deadline, gate, reporting) and vice versa.
  if (endpoint !== null && s.accelerators?.has(endpoint))
    throw new Error(`node ${endpoint} is one of the accelerator's URLs`);
  s.endpoint = endpoint;
  s.deadlineMs = deadlineMs;
};

export const currentNodeEndpoint = (): string | null => state().endpoint;

/**
 * The accelerator's URLs, exactly (the SDK's health and prove routes on its host and ports): each
 * passes with the deadline and no redirects and is never reported — the health store, the quiet
 * scope and the candidate leases do not see it. Null clears the set.
 */
export function setAcceleratorEndpoints(urls: readonly string[] | null, deadlineMs: number): void {
  const s = state();
  if (urls === null) {
    s.accelerators = null;
    return;
  }
  const set = new Set(urls.map(normaliseEndpoint));
  if (s.endpoint !== null && set.has(s.endpoint))
    throw new Error(`accelerator URL ${s.endpoint} is the node's endpoint`);
  s.accelerators = set;
  s.acceleratorDeadlineMs = deadlineMs;
}

/** A probe's lease: its requests pass and are not reported; the endpoint stays admitted until its last holder releases. */
export function allowCandidate(url: string, deadlineMs: number): () => void {
  const s = state();
  const endpoint = normaliseEndpoint(url);
  const held = s.candidates.get(endpoint);
  if (held) held.owners++;
  else s.candidates.set(endpoint, { deadlineMs, owners: 1 });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const lease = s.candidates.get(endpoint);
    if (lease && --lease.owners <= 0) s.candidates.delete(endpoint);
  };
}

/** Runs `fn` with its node requests marked optional: their outcomes reach the store flagged `quiet`. */
export async function quietNodeReads<T>(fn: () => Promise<T>): Promise<T> {
  const s = state();
  s.quiet++;
  try {
    return await fn();
  } finally {
    s.quiet--;
  }
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

/** What a request was when it started; the outcome carries it, however late the body lands. */
interface Started {
  endpoint: string;
  startedAt: number;
  quiet: boolean;
}

function report(
  s: GuardState,
  r: Started,
  status: NodeRequestOutcome['status'],
  retryAfter: string | null = null,
) {
  const o: NodeRequestOutcome = {
    endpoint: r.endpoint,
    startedAt: r.startedAt,
    status,
    latencyMs: performance.now() - r.startedAt,
    retryAfter,
    quiet: r.quiet,
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
function reportOnBody(s: GuardState, r: Started, res: Response): Response {
  if (!res.body) {
    report(s, r, res.status, res.headers.get('retry-after'));
    return res;
  }
  let done = false;
  const settle = (status: NodeRequestOutcome['status']) => {
    if (done) return;
    done = true;
    report(s, r, status, res.headers.get('retry-after'));
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
    // A consumer that cancels the body before it ends did not get a complete answer: report it as a
    // failure once (so a recovery's lock is released without declaring the node healthy on headers
    // alone), then cancel the underlying reader.
    cancel: (reason) => {
      settle(died(reason));
      return reader.cancel(reason);
    },
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
  // Quiet is decided at the start: a reader that gave up on this request (its own deadline) may
  // have left `quietNodeReads` before the body lands, and the outcome still belongs to optional work.
  const r: Started = { endpoint, startedAt: performance.now(), quiet: s.quiet > 0 };
  try {
    const res = await s.original(input, withDeadline(input, init, s.deadlineMs));
    return reportOnBody(s, r, res);
  } catch (e) {
    report(s, r, died(e));
    throw e;
  }
}

/**
 * Installs the guard over the context's current `fetch`, once, at import. A repeated call is a
 * no-op: it neither re-captures `original` (the current fetch may be a wrapper that forwards back
 * here — the CRS interceptor — and would recurse) nor touches `globalThis.fetch` (that would drop
 * such a wrapper). Tests arm the guard over a fake through `setOriginalFetch`.
 */
export function installNodeGuard(): void {
  if ((globalThis as Realm)[MARK]) return;
  const s: GuardState = {
    original: globalThis.fetch.bind(globalThis),
    guarded: globalThis.fetch,
    endpoint: null,
    deadlineMs: 120_000,
    candidates: new Map(),
    accelerators: null,
    acceleratorDeadlineMs: 300_000,
    quiet: 0,
    listeners: new Set(),
    gate: null,
  };
  s.guarded = ((input: RequestInfo | URL, init?: RequestInit) => {
    const href = hrefOf(input);
    if (/^(data|blob):/i.test(href)) return s.original(input, init);
    const url = new URL(href, globalThis.location?.href);
    // The node, the accelerator and a candidate are classified before the page's own origin: a node
    // served from it still gets the deadline, the gate and the reporting.
    const endpoint = normaliseEndpoint(url.href);
    if (endpoint === s.endpoint) return nodeRequest(s, endpoint, input, init);
    if (s.accelerators?.has(endpoint))
      return s.original(input, withDeadline(input, init, s.acceleratorDeadlineMs));
    const lease = s.candidates.get(endpoint);
    if (lease) return s.original(input, withDeadline(input, init, lease.deadlineMs));
    if (url.origin === globalThis.location?.origin) return s.original(input, init);
    return Promise.reject(
      new Error(
        `blocked endpoint ${url.origin}${url.pathname}: not this page, its node, its accelerator or a candidate`,
      ),
    );
  }) as typeof globalThis.fetch;
  (globalThis as Realm)[MARK] = s;
  globalThis.fetch = s.guarded;
}

/** Tests only: point the guard's pass-through at a fake network and arm the guard over it. */
export function setOriginalFetch(fetchImpl: typeof globalThis.fetch): void {
  const s = (globalThis as Realm)[MARK];
  if (!s) return;
  s.original = fetchImpl;
  globalThis.fetch = s.guarded;
}

if (!(globalThis as Realm)[MARK]) installNodeGuard();
