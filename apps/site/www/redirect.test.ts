import { describe, expect, test } from 'bun:test';
import { redirect } from './redirect.ts';

describe('www redirect', () => {
  test('301 to the apex over https, path and query kept, HSTS set', () => {
    const r = redirect(new Request('http://www.yacana.network/mine/wallet?node=x#frag'));
    expect(r.status).toBe(301);
    expect(r.headers.get('Location')).toBe('https://yacana.network/mine/wallet?node=x#frag');
    expect(r.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
    expect(redirect(new Request('https://www.yacana.network/')).headers.get('Location')).toBe(
      'https://yacana.network/',
    );
  });
});
