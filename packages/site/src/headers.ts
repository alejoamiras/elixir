// The one security policy of the origin: relaxing anything here for one app relaxes it for the
// miner and its vault on the same origin. Cloudflare applies the rendered `_headers` and the
// preview server sends the same map; only `dev` (Vite's dev server) is looser, and says where.
export interface HeaderPolicy {
  /** Node origins the pages may call; `connect-src` is exactly these plus self and data:. */
  nodeOrigins: string[];
  /** `dev` admits the dev server's inline scripts and local nodes; everything else is production. */
  mode: 'production' | 'dev';
}

const LOCAL = ['http://127.0.0.1:*', 'http://localhost:*'];

export function contentSecurityPolicy(p: HeaderPolicy): string {
  const dev = p.mode === 'dev';
  const connect = ["'self'", 'data:', ...p.nodeOrigins, ...(dev ? LOCAL : [])];
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
  ].join('; ');
}

export const headerMap = (p: HeaderPolicy): Record<string, string> => ({
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
