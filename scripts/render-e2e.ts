// Renders a surface from its running e2e server (an e2e run in progress, or a server left up) at the
// widths the binder is judged at: the landing on the isolated network's numbers; the stats on the
// captured history through the E2E's mocked node; the miner's keyed screens (cockpit, wallet,
// settings with the node tile checking a second node, then the same page and the cockpit under a
// rate-limiting node), which a production build refuses off the production host.
//   bun scripts/render-e2e.ts landing|stats|miner <out dir> [widths, default 1280,1440,1024]
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { MOCK_NODE_ORIGIN, mockNode, pageUrl } from '../packages/web-stats/e2e/helpers.ts';

const repo = resolve(import.meta.dir, '..');
const APPS = ['landing', 'stats', 'miner'] as const;
const app = APPS.find((a) => a === process.argv[2]) ?? 'miner';
const out = resolve(process.argv[3] ?? resolve(repo, '.run-state/renders'));
const widths = (process.argv[4] ?? '1280,1440,1024').split(',').map(Number);
mkdirSync(out, { recursive: true });

const run = JSON.parse(readFileSync(resolve(repo, `packages/web-${app}/e2e/.run.json`), 'utf8')) as {
  baseURL: string;
  /** The landing's second build, with the fixture claim: the ledger's populated state is the one to show. */
  claimURL?: string;
  nodeUrl: string;
  miner: string;
  token: string;
  minerClassId: string;
  tokenClassId: string;
  chainId: string;
  rollupVersion: string;
  /** The miner run's two forwarding proxies (`packages/web-miner/e2e/node-proxy.ts`). */
  proxyA?: string;
  proxyB?: string;
  vitePid?: number;
  vitePids?: number[];
  runId: string;
};
const url = new URL(app === 'landing' && run.claimURL ? run.claimURL : run.baseURL);
url.searchParams.set('node', run.nodeUrl);
url.searchParams.set('miner', run.miner);
url.searchParams.set('token', run.token);

const shot = (page: Page, name: string, width: number) =>
  page.screenshot({ path: resolve(out, `${name}-${width}.png`), fullPage: true, type: 'png' });

async function landing(page: Page, width: number) {
  await page.getByTestId('live-epoch').filter({ hasText: ' of ' }).waitFor({ timeout: 60_000 });
  await page.getByTestId('hero-chart').waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await shot(page, 'landing', width);
}

async function stats(page: Page, width: number) {
  const statsRun = { ...run, vitePid: run.vitePid ?? 0 };
  await mockNode(page, statsRun);
  await page.goto(pageUrl(statsRun, '', { node: MOCK_NODE_ORIGIN }));
  await page.getByTestId('table').locator('tbody tr').nth(30).waitFor({ timeout: 60_000 });
  await page.locator('main[data-settled="1"]').waitFor({ timeout: 10_000 });
  // Every chart drawn at its container's width (the observer's measurement can lag under load).
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('[data-slot=chart]')).every((c) => {
        const svg = c.querySelector('svg');
        return !!svg && Math.abs(svg.getBoundingClientRect().width - c.getBoundingClientRect().width) < 1;
      }),
    undefined,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(300);
  await shot(page, 'stats', width);
}

const setMode = (proxy: string, mode: 'ok' | 'throttled') =>
  fetch(`${proxy}/__mode`, { method: 'POST', body: JSON.stringify({ mode }) });

async function miner(page: Page, width: number) {
  const { proxyA, proxyB } = run;
  if (!proxyA || !proxyB) throw new Error('the miner run has no proxies: rerun e2e/run-setup.ts');
  // On A through the saved setting, not the query pin: a pinned page disables the node tile.
  await page.addInitScript(
    (nodeUrl) => localStorage.setItem('yacana.connection', JSON.stringify({ nodeUrl })),
    proxyA,
  );
  await page.goto(`${run.baseURL}/`);
  // Signed out: the dull cockpit behind the sign-in, both on the public chain.
  await page.getByTestId('sign-in').waitFor({ timeout: 120_000 });
  await page.getByTestId('epoch').filter({ hasText: /\d/ }).waitFor({ timeout: 120_000 });
  await page.waitForTimeout(400);
  await shot(page, 'miner-signed-out', width);
  // Watching: the same cockpit with the sign-in dismissed.
  await page.getByTestId('not-now').click();
  await page.getByTestId('sign-in').waitFor({ state: 'detached', timeout: 10_000 });
  await page.waitForTimeout(300);
  await shot(page, 'miner-watching', width);
  await page.getByTestId('sign-in-mine').click();
  await page.getByTestId('use-words').click({ timeout: 120_000 });
  await page.getByTestId('words-skip').click();
  // Opening: the step list and the bar while the account comes up.
  await page.getByTestId('opening').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(400);
  await shot(page, 'miner-opening', width);
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
  await page.getByTestId('node-health').filter({ hasText: 'this deployment' }).waitFor({ timeout: 60_000 });
  await page.getByTestId('node-url').fill(proxyB);
  await page.getByTestId('node-check').click();
  await page
    .getByTestId('node-check-result')
    .filter({ hasText: 'the token are there' })
    .waitFor({ timeout: 60_000 });
  await shot(page, 'miner-settings', width);
  // A starts rate-limiting: the banner over the page, the tile's health line naming the 429.
  await setMode(proxyA, 'throttled');
  try {
    await page.getByTestId('node-banner').waitFor({ timeout: 60_000 });
    await page
      .getByTestId('node-health')
      .filter({ hasText: /429|rate/ })
      .waitFor({ timeout: 30_000 });
    await shot(page, 'miner-settings-throttled', width);
    await page.getByRole('link', { name: 'Mine' }).click();
    await page.getByTestId('node-banner').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await shot(page, 'miner-banner', width);
  } finally {
    await setMode(proxyA, 'ok');
  }
}

const browser = await chromium.launch();
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    if (app === 'landing') await page.goto(url.toString());
    try {
      await { landing, stats, miner }[app](page, width);
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
