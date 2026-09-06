import { describe, expect, test } from 'bun:test';
import { contentSecurityPolicy, headerMap, renderHeaders } from './headers.ts';

const node = 'https://v5.testnet.rpc.aztec-labs.com';
const directives = (csp: string) =>
  Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1).join(' ')]));

describe('headers', () => {
  test('the production policy, directive by directive', () => {
    const d = directives(contentSecurityPolicy({ nodeOrigins: [node], mode: 'production' }));
    expect(d).toEqual({
      'default-src': "'self'",
      'script-src': "'self' 'wasm-unsafe-eval'",
      'script-src-attr': "'none'",
      'worker-src': "'self' blob:",
      'connect-src': `'self' data: ${node}`,
      'img-src': "'self' data:",
      'style-src': "'self' 'unsafe-inline'",
      'font-src': "'self'",
      'frame-src': "'none'",
      'frame-ancestors': "'none'",
      'object-src': "'none'",
      'base-uri': "'none'",
      'form-action': "'none'",
    });
    const h = headerMap({ nodeOrigins: [node], mode: 'production' });
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(headerMap({ nodeOrigins: [node], mode: 'dev' })['Strict-Transport-Security']).toBeUndefined();
    expect(h['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    expect(h['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(h['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('no-referrer');
  });

  test('connect-src is exactly the configured origins; no wildcard, no CRS host', () => {
    const d = directives(
      contentSecurityPolicy({ nodeOrigins: [node, 'https://other.example'], mode: 'production' }),
    );
    expect(d['connect-src']).toBe(`'self' data: ${node} https://other.example`);
    expect(d['connect-src']).not.toMatch(/\*|crs\./);
  });

  test('dev admits inline scripts and local nodes, nothing else', () => {
    const prod = directives(contentSecurityPolicy({ nodeOrigins: [node], mode: 'production' }));
    const dev = directives(contentSecurityPolicy({ nodeOrigins: [node], mode: 'dev' }));
    expect(dev['script-src']).toBe("'self' 'wasm-unsafe-eval' 'unsafe-inline'");
    expect(dev['connect-src']).toBe(`'self' data: ${node} http://127.0.0.1:* http://localhost:*`);
    const { 'script-src': _s, 'connect-src': _c, ...restDev } = dev;
    const { 'script-src': _ps, 'connect-src': _pc, ...restProd } = prod;
    expect(restDev).toEqual(restProd);
  });

  test('_headers is one block for every path with the same map', () => {
    const text = renderHeaders({ nodeOrigins: [node], mode: 'production' });
    expect(text.startsWith('/*\n  Strict-Transport-Security: max-age=31536000; includeSubDomains\n')).toBe(
      true,
    );
    expect(text.split('\n').filter((l) => l.startsWith('  ')).length).toBe(8);
  });
});
