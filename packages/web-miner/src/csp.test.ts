// The production CSP and the build's node allowlist must agree, or a node the UI accepts fails at
// boot with an opaque fetch error. Both live in files, so this checks the files.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const here = (p: string) => new URL(p, import.meta.url).pathname;
const headers = readFileSync(here('../public/_headers'), 'utf8');
const env = readFileSync(here('../.env.production'), 'utf8');
const envValue = (key: string) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim() ?? '';

describe('production CSP', () => {
  const csp = headers.match(/Content-Security-Policy:\s*(.+)/)?.[1] ?? '';
  const connect = csp.match(/connect-src ([^;]+)/)?.[1]?.split(/\s+/) ?? [];

  test('connect-src lists exactly the allowed node origins, self and data: (bb.js loads its WASM as a data URI)', () => {
    const allowed = (envValue('VITE_ALLOWED_NODE_ORIGINS') || envValue('VITE_AZTEC_NODE_URL'))
      .split(',')
      .map((u) => new URL(u.trim()).origin);
    expect(new Set(connect)).toEqual(new Set(["'self'", 'data:', ...allowed]));
  });

  test('the CRS CDN hosts and wildcards are absent', () => {
    expect(connect.some((s) => s.includes('*') || s.includes('crs.aztec'))).toBe(false);
  });

  test('scripts run without inline code or eval beyond WASM', () => {
    expect(csp).toMatch(/script-src 'self' 'wasm-unsafe-eval';/);
    expect(headers).toMatch(/Cross-Origin-Embedder-Policy: require-corp/);
    expect(headers).toMatch(/Cross-Origin-Opener-Policy: same-origin/);
  });
});
