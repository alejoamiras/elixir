import { describe, expect, test } from 'bun:test';
import { contentSecurityPolicy, headerMap, renderHeaders } from './headers.ts';

const directives = (csp: string) =>
  Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1).join(' ')]));

describe('headers', () => {
  test('the production policy, directive by directive', () => {
    const d = directives(contentSecurityPolicy({ mode: 'production' }));
    expect(d).toEqual({
      'default-src': "'self'",
      'script-src': "'self' 'wasm-unsafe-eval'",
      'script-src-attr': "'none'",
      'worker-src': "'self' blob:",
      'connect-src': "'self' data: https:",
      'img-src': "'self' data:",
      'style-src': "'self' 'unsafe-inline'",
      'font-src': "'self'",
      'frame-src': "'none'",
      'frame-ancestors': "'none'",
      'object-src': "'none'",
      'base-uri': "'none'",
      'form-action': "'none'",
      webrtc: "'block'",
    });
    const h = headerMap({ mode: 'production' });
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(headerMap({ mode: 'dev' })['Strict-Transport-Security']).toBeUndefined();
    expect(headerMap({ mode: 'e2e' })['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(h['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    expect(h['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(h['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(), payment=()');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('no-referrer');
  });

  test('production names no origin and no plaintext form; the guard bounds the node in code', () => {
    const d = directives(contentSecurityPolicy({ mode: 'production' }));
    expect(d['connect-src']).toBe("'self' data: https:");
    expect(d['connect-src']).not.toMatch(/http:|\*|localhost|127\.0\.0\.1/);
  });

  test('e2e adds the local node forms and nothing else; dev also admits inline scripts', () => {
    const prod = directives(contentSecurityPolicy({ mode: 'production' }));
    const e2e = directives(contentSecurityPolicy({ mode: 'e2e' }));
    const dev = directives(contentSecurityPolicy({ mode: 'dev' }));
    expect(e2e['connect-src']).toBe("'self' data: https: http://127.0.0.1:* http://localhost:*");
    expect(e2e['script-src']).toBe(prod['script-src']);
    expect(dev['connect-src']).toBe(e2e['connect-src']);
    expect(dev['script-src']).toBe("'self' 'wasm-unsafe-eval' 'unsafe-inline'");
    const rest = (d: Record<string, string>) => {
      const { 'script-src': _s, 'connect-src': _c, ...r } = d;
      return r;
    };
    expect(rest(e2e)).toEqual(rest(prod));
    expect(rest(dev)).toEqual(rest(prod));
  });

  test('_headers is one block for every path with the same map', () => {
    const text = renderHeaders({ mode: 'production' });
    expect(text.startsWith('/*\n  Strict-Transport-Security: max-age=31536000; includeSubDomains\n')).toBe(
      true,
    );
    expect(text.split('\n').filter((l) => l.startsWith('  ')).length).toBe(8);
  });
});
