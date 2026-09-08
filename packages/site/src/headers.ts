// The one security policy of the origin: relaxing anything here for one app relaxes it for the
// miner and its vault on the same origin. Cloudflare applies the rendered `_headers` and the
// preview server sends the same map; `e2e` adds the local node origins the isolated network uses
// and `dev` (Vite's dev server) is looser still, and says where.
export interface HeaderPolicy {
  /** `production` is what ships; `e2e` admits local nodes; `dev` also admits the dev server's inline scripts. */
  mode: 'production' | 'e2e' | 'dev';
}

const LOCAL = ['http://127.0.0.1:*', 'http://localhost:*'];

/**
 * `connect-src https:`: the node is a user setting, so the policy cannot name it. What bounds a
 * page's requests to its own origin and the chosen node is the fetch guard the apps install
 * (packages/site/src/browser/node-guard.ts), in code, in the page and in the prover Worker.
 */
export function contentSecurityPolicy(p: HeaderPolicy): string {
  const dev = p.mode === 'dev';
  const connect = ["'self'", 'data:', 'https:', ...(p.mode === 'production' ? [] : LOCAL)];
  return [
    "default-src 'self'",
    // WASM only; React refresh injects inline scripts in dev, the built bundle has none.
    `script-src 'self' 'wasm-unsafe-eval'${dev ? " 'unsafe-inline'" : ''}`,
    "script-src-attr 'none'",
    "worker-src 'self' blob:",
    `connect-src ${connect.join(' ')}`,
    "img-src 'self' data:",
    // Radix and Sonner set inline styles and inject a <style> element: 'unsafe-inline' stays.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    // CSP3's WebRTC directive: enforced where a browser implements it, emitted regardless.
    "webrtc 'block'",
  ].join('; ');
}

export const headerMap = (p: HeaderPolicy): Record<string, string> => ({
  // A plain-http load has no crypto.subtle and no COOP: after one https visit the browser never
  // tries http again. The edge's Always-Use-HTTPS redirect covers the first visit.
  ...(p.mode !== 'dev' && { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': contentSecurityPolicy(p),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
});

/** The `_headers` file Cloudflare reads: one block for every path. */
export const renderHeaders = (p: HeaderPolicy): string =>
  `/*\n${Object.entries(headerMap(p))
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')}\n`;
