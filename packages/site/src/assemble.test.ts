import { describe, expect, test } from 'bun:test';
import { assemble, buildRecord, PRODUCTION_OUT, REDIRECTS } from './assemble.ts';
import type { SiteConfig } from './config.ts';

describe('assembly', () => {
  test('the rewrites are exact sources to directory targets: no splat, no .html', () => {
    expect(REDIRECTS).toEqual([
      '/mine/wallet /mine/ 200',
      '/mine/settings /mine/ 200',
      '/stats/verify /stats/ 200',
      '/verify /stats/ 200',
    ]);
    for (const rule of REDIRECTS) expect(rule).toMatch(/^\/[a-z/]+ \/(mine|stats)\/ 200$/);
  });

  test('an e2e build can land neither in the production directory nor on Cloudflare', async () => {
    await expect(assemble(PRODUCTION_OUT, { YACANA_SITE_MODE: 'e2e' })).rejects.toThrow(
      /production builds only/,
    );
    await expect(assemble('/tmp/never-written', { YACANA_SITE_MODE: 'e2e', CF_PAGES: '1' })).rejects.toThrow(
      /production builds only/,
    );
  });

  test('build.json says what was built and nothing more', () => {
    const c = {
      mode: 'production',
      sourceCommit: 'abc',
      allowedNodeOrigins: ['https://node.example'],
      rpId: 'yacana.network',
      nodeUrl: 'https://node.example',
    } as SiteConfig;
    expect(buildRecord(c)).toEqual({
      mode: 'production',
      commit: 'abc',
      nodeOrigins: ['https://node.example'],
      rpId: 'yacana.network',
    });
  });
});
