/**
 * Bounds every request a page makes to the node's origin (a wallet's PXE included): the SDK's
 * transport sets no deadline of its own. A caller's own signal (in `init` or on a `Request`) keeps
 * cancelling alongside it; other origins are untouched.
 */
export function boundNodeRequests(nodeUrl: string, ms: number): void {
  const origin = new URL(nodeUrl).origin;
  const fetch = globalThis.fetch.bind(globalThis);
  const bounded = (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (new URL(href, location.href).origin !== origin) return fetch(input, init);
    const own = init?.signal ?? (input instanceof Request ? input.signal : null);
    const deadline = AbortSignal.timeout(ms);
    return fetch(input, { ...init, signal: own ? AbortSignal.any([own, deadline]) : deadline });
  };
  // Bun's `fetch` type carries extras (`preconnect`) a browser's does not; the page only calls it.
  globalThis.fetch = bounded as typeof globalThis.fetch;
}
