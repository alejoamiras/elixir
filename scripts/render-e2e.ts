// Renders a surface from its running e2e server (an e2e run in progress, or a server left up) at the
// widths the binder is judged at: the landing on the isolated network's numbers; the miner's keyed
// screens (cockpit, wallet, settings), which a production build refuses off the production host.
//   bun scripts/render-e2e.ts landing|miner <out dir> [widths, default 1280,1440,1024]
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const repo = resolve(import.meta.dir, '..');
const app = process.argv[2] === 'landing' ? 'landing' : 'miner';
const out = resolve(process.argv[3] ?? resolve(repo, '.run-state/renders'));
const widths = (process.argv[4] ?? '1280,1440,1024').split(',').map(Number);
mkdirSync(out, { recursive: true });

const run = JSON.parse(readFileSync(resolve(repo, `packages/web-${app}/e2e/.run.json`), 'utf8')) as {
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

async function landing(page: Page, width: number) {
  await page.getByTestId('live-epoch').filter({ hasText: ' of ' }).waitFor({ timeout: 60_000 });
  // A few cadence dots on the loop.
  await page.waitForTimeout(6000);
  await shot(page, 'landing', width);
}

async function miner(page: Page, width: number) {
  await page.getByTestId('use-words').click({ timeout: 120_000 });
  await page.getByTestId('words-skip').click();
  await page.getByTestId('start').waitFor({ state: 'visible', timeout: 8 * 60_000 });
  await page.getByTestId('start').click();
  const phase = page.getByTestId('phase');
  await phase.filter({ hasText: /^mining$/ }).waitFor({ timeout: 60_000 });
  // Mining again after the first mint: the loop, the rate and the ledger carry real numbers.
  await phase.filter({ hasText: 'claiming' }).waitFor({ timeout: 5 * 60_000 });
  await phase.filter({ hasText: /^mining$/ }).waitFor({ timeout: 10 * 60_000 });
  await shot(page, 'miner-cockpit', width);
  await page.getByTestId('stop').click();
  await page.getByRole('link', { name: 'Wallet' }).click();
  await page.waitForTimeout(1500);
  await shot(page, 'miner-wallet', width);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForTimeout(800);
  await shot(page, 'miner-settings', width);
}

const browser = await chromium.launch();
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(url.toString());
    try {
      await (app === 'landing' ? landing : miner)(page, width);
    } catch (e) {
      // What the page showed when the wait ran out, next to the renders.
      await shot(page, `${app}-failed`, width);
      throw e;
    }
    await context.close();
    console.log(`rendered ${width}`);
  }
} finally {
  await browser.close();
}
console.log(out);
