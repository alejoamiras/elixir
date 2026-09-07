// Renders the three apps' standalone builds at the widths the binder is judged at, for the fidelity
// reviews: serves each `dist` on an OS-assigned localhost port, screenshots every surface, exits.
//   bun scripts/render-surfaces.ts <out dir> [widths, default 1280,1440,1024,390] [--keys]
// The pages read the public testnet through their own config. A production build refuses keys off
// the production host, so the miner's cockpit, wallet and settings render only with `--keys`
// against an e2e build served the same way (a throwaway words key in this browser only).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const repo = resolve(import.meta.dir, '..');
const out = resolve(process.argv[2] ?? resolve(repo, '.run-state/renders'));
const widths = (process.argv[3] ?? '1280,1440,1024,390').split(',').map(Number);
const keys = process.argv.includes('--keys');
mkdirSync(out, { recursive: true });

const APPS = { landing: 'web-landing', miner: 'web-miner', stats: 'web-stats' } as const;

/** Static file server for one app's `dist` with the SPA fallback, on an OS-assigned port. */
function serve(name: keyof typeof APPS) {
  const dist = resolve(repo, 'packages', APPS[name], 'dist');
  return Bun.serve({
    hostname: 'localhost',
    port: 0,
    async fetch(req) {
      let path: string;
      try {
        path = decodeURIComponent(new URL(req.url).pathname);
      } catch {
        return new Response('bad path', { status: 400 });
      }
      const target = resolve(dist, `.${path}`);
      const file = Bun.file(target);
      const served = target.startsWith(`${dist}/`) && !path.endsWith('/') && (await file.exists());
      const body = served ? file : Bun.file(resolve(dist, 'index.html'));
      return new Response(body, {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        },
      });
    },
  });
}

const shot = (page: Page, name: string, width: number) =>
  page.screenshot({ path: resolve(out, `${name}-${width}.png`), fullPage: true, type: 'png' });

const settle = (page: Page, text: string) =>
  page.getByText(text).first().waitFor({ state: 'visible', timeout: 60_000 });

const servers = { landing: serve('landing'), miner: serve('miner'), stats: serve('stats') };
const browser = await chromium.launch();
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`http://localhost:${servers.landing.port}/`);
    await settle(page, 'the bar is live from the chain').catch(() => {});
    await shot(page, 'landing', width);
    await page.goto(`http://localhost:${servers.stats.port}/`);
    await settle(page, 'epochs, newest first').catch(() => {});
    await shot(page, 'stats', width);
    await page.goto(`http://localhost:${servers.miner.port}/`);
    if (width < 900) {
      await page.waitForTimeout(1500);
      await shot(page, 'miner-phone', width);
    } else {
      await settle(page, 'Use twelve words instead');
      await shot(page, 'miner-key-screen', width);
    }
    if (keys && width >= 900) {
      await page.getByTestId('use-words').click();
      await page.getByTestId('words-skip').click();
      await settle(page, 'Start mining');
      await page.waitForTimeout(3000);
      await shot(page, 'miner-cockpit', width);
      await page.getByRole('link', { name: 'Wallet' }).click();
      await page.waitForTimeout(1000);
      await shot(page, 'miner-wallet', width);
      await page.getByRole('link', { name: 'Settings' }).click();
      await page.waitForTimeout(500);
      await shot(page, 'miner-settings', width);
    }
    await context.close();
    console.log(`rendered ${width}`);
  }
} finally {
  await browser.close();
  for (const s of Object.values(servers)) s.stop(true);
}
console.log(out);
