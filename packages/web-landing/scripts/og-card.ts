// Renders public/og.html to public/og.png (1200 × 630, the Open Graph card) with the repo's
// Playwright Chromium; the PNG is committed so the build needs no browser.
//   bun packages/web-landing/scripts/og-card.ts
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const publicDir = resolve(import.meta.dir, '../public');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(resolve(publicDir, 'og.html')).href);
  await page.screenshot({ path: resolve(publicDir, 'og.png'), type: 'png' });
  console.log(`og-card: ${resolve(publicDir, 'og.png')}`);
} finally {
  await browser.close();
}
