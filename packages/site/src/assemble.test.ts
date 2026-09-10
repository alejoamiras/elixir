import { describe, expect, test } from 'bun:test';
import { relative } from 'node:path';
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

  test('a mode that is not one of the three is refused before anything is built', async () => {
    await expect(assemble('/tmp/never-written', { YACANA_SITE_MODE: 'Production' })).rejects.toThrow(
      /YACANA_SITE_MODE="Production"/,
    );
  });

  test('an e2e build can land neither in the production directory nor on Cloudflare', async () => {
    await expect(assemble(PRODUCTION_OUT, { YACANA_SITE_MODE: 'e2e' })).rejects.toThrow(
      /production builds only/,
    );
    // The same directory by a relative spelling is still the production directory.
    await expect(
      assemble(relative(process.cwd(), PRODUCTION_OUT), { YACANA_SITE_MODE: 'e2e' }),
    ).rejects.toThrow(/production builds only/);
    await expect(assemble('/tmp/never-written', { YACANA_SITE_MODE: 'e2e', CF_PAGES: '1' })).rejects.toThrow(
      /production builds only/,
    );
  });

  test('build.json says what was built and nothing more', () => {
    const c = {
      mode: 'production',
      sourceCommit: 'abc',
      rpId: 'yacana.network',
      nodeUrl: 'https://node.example',
    } as SiteConfig;
    expect(buildRecord(c)).toEqual({
      mode: 'production',
      commit: 'abc',
      nodeOrigin: 'https://node.example',
      rpId: 'yacana.network',
    });
  });
});
