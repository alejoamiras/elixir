// Renders the miner's keyed screens (cockpit, wallet, settings) from a running e2e server, at the
// widths the binder is judged at. Needs packages/web-miner/e2e/.run.json (an e2e run in progress
// or a server left up): a production build refuses keys off the production host.
//   bun scripts/render-cockpit.ts <out dir> [widths, default 1280,1440,1024]
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const repo = resolve(import.meta.dir, '..');
const out = resolve(process.argv[2] ?? resolve(repo, '.run-state/renders'));
const widths = (process.argv[3] ?? '1280,1440,1024').split(',').map(Number);
mkdirSync(out, { recursive: true });

const run = JSON.parse(readFileSync(resolve(repo, 'packages/web-miner/e2e/.run.json'), 'utf8')) as {
  baseURL: string;
  nodeUrl: string;
  miner: string;
  token: string;
};
const url = new URL(run.baseURL);
url.searchParams.set('node', run.nodeUrl);
url.searchParams.set('miner', run.miner);
url.searchParams.set('token', run.token);

const shot = (page: Page, name: string, width: number) =>
  page.screenshot({ path: resolve(out, `${name}-${width}.png`), fullPage: true, type: 'png' });

const browser = await chromium.launch();
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(url.toString());
    await page.getByTestId('use-words').click({ timeout: 120_000 });
    await page.getByTestId('words-skip').click();
    await page.getByTestId('start').waitFor({ state: 'visible', timeout: 8 * 60_000 });
    await page.getByTestId('start').click();
    await page.getByTestId('phase').filter({ hasText: 'mining' }).waitFor({ timeout: 60_000 });
    // A few proofs so the loop, the rate and the ledger carry real numbers.
    await page.waitForTimeout(25_000);
    await shot(page, 'miner-cockpit', width);
    await page.getByTestId('stop').click();
    await page.getByRole('link', { name: 'Wallet' }).click();
    await page.waitForTimeout(1500);
    await shot(page, 'miner-wallet', width);
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.waitForTimeout(800);
    await shot(page, 'miner-settings', width);
    await context.close();
    console.log(`rendered ${width}`);
  }
} finally {
  await browser.close();
}
console.log(out);
