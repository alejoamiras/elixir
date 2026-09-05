// The one security policy of the origin. Cloudflare Pages applies the rendered `_headers`; the
// dev and preview servers send the same map, so nothing runs under a looser policy than it ships with.
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
    // Radix and Sonner set inline styles and inject a <style> element; narrowing to
    // style-src-attr would break them (audited on 5.2.0 / sonner 2).
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

/** The `_headers` file Cloudflare Pages reads: one block for every path. */
export const renderHeaders = (p: HeaderPolicy): string =>
  `/*\n${Object.entries(headerMap(p))
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n')}\n`;
