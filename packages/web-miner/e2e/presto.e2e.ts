// The miner against the run's headless Presto (scripts/run/presto.ts): native proving shown and
// proven, a claim whose winner came from Presto, the billboard when nothing answers, the update row
// when an old Presto answers — with the 1280/1440 renders of each state.

import { mkdirSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { BOOT_MS, bootPage, pageUrl, run } from './helpers.ts';

const RENDERS = resolve(import.meta.dirname, '.renders');
mkdirSync(RENDERS, { recursive: true });

async function render(page: Page, name: string): Promise<void> {
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(RENDERS, `${name}-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

test('through Presto: the pill says ✦ presto after the first native proof, and power is Presto’s', async ({
  page,
}) => {
  const r = run();
  test.skip(!r.prestoUrl, 'presto-server is not installed on this machine');
  // The hard deployment: no win, so the render is of mining, never of a claim in flight.
  const auth = await bootPage(page, pageUrl(r, { presto: 'on', miner: r.hardMiner, token: r.hardToken }));
  await expect(page.getByTestId('presto-billboard')).toHaveCount(0);
  await expect(page.getByTestId('presto-notice')).toHaveCount(0);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText(/^mining/);
  // Native only once a native proof came back, never on construction.
  await expect(page.getByTestId('native')).toBeVisible({ timeout: 3 * 60_000 });
  await expect(page.getByTestId('phase')).toHaveAttribute('data-prover', 'presto');
  await expect(page.getByTestId('rate-line')).toContainText('native');
  await expect(page.getByRole('slider')).toBeDisabled();
  await expect(page.getByTestId('power-caption')).toContainText('speed setting');
  await render(page, 'native');
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('phase')).toHaveText(/^idle/, { timeout: 60_000 });
  await auth.remove();
});

test('a win Presto proved is verified in the browser before it shows, then claimed; the proof went over the wire', async ({
  page,
}) => {
  const r = run();
  test.skip(!r.prestoUrl, 'presto-server is not installed on this machine');
  const proveUrl = `${r.prestoUrl}/prove/ultra-honk`;
  const proves: number[] = [];
  page.on('response', (res) => {
    if (res.request().method() === 'POST' && res.url() === proveUrl) proves.push(res.status());
  });
  // The server's log is the run's, and an earlier spec has already proved through it: only what it
  // gains from here on is this test's evidence.
  const logFile = r.prestoHome ? resolve(r.prestoHome, 'server.log') : null;
  const logRead = () => (logFile ? readFileSync(logFile, 'utf8') : '');
  const logBefore = logRead().length;
  await bootPage(page, pageUrl(r, { presto: 'on' }));
  await page.getByTestId('start').click();
  await expect(page.getByTestId('native')).toBeVisible({ timeout: 3 * 60_000 });
  // The easy target wins every other proof: the win was verified in WASM before it showed, then claimed.
  await expect(page.getByTestId('claim-slot')).toHaveAttribute('data-state', 'minted', {
    timeout: 10 * 60_000,
  });
  const prover = await page.evaluate(() => window.yacana?.controller()?.lastClaim?.prover);
  expect(prover).toBe('presto');
  // The HTTP evidence, independent of the Worker's own messages: a 200 on the route as Playwright saw
  // it from the Worker, or, where it sees no Worker traffic, a proof the server finished during it.
  const sinceStart = logRead().slice(logBefore);
  expect(proves.includes(200) || /UltraHonk prove finished.*ok\S*=\S*true/.test(sinceStart)).toBe(true);
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('phase')).toHaveText(/^idle/, { timeout: 60_000 });
});

test('nothing answers: the billboard invites the install and the browser proves without the suffix', async ({
  page,
}) => {
  const r = run();
  // The run's claimed, never-listened-on loopback port: the probe fails as it does for any absent Presto.
  const auth = await bootPage(
    page,
    pageUrl(r, { presto: String(r.closedPort), miner: r.hardMiner, token: r.hardToken }),
  );
  const billboard = page.getByTestId('presto-billboard');
  await expect(billboard).toBeVisible({ timeout: 60_000 });
  await expect(billboard.getByText('Fast proofs')).toBeVisible();
  // The element resolves its `href` through `new URL()`, which spells the origin with a trailing slash.
  await expect(billboard.getByRole('link', { name: 'Get Presto' })).toHaveAttribute(
    'href',
    /^https:\/\/presto\.build\/?$/,
  );
  await expect(page.getByTestId('presto-notice')).toHaveCount(0);
  await render(page, 'billboard');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await expect(page.getByTestId('rate-line')).toContainText('threads', { timeout: 3 * 60_000 });
  await expect(page.getByTestId('native')).toHaveCount(0);
  await expect(page.getByRole('slider')).toBeEnabled();
  await page.getByTestId('stop').click();
  await auth.remove();
});

/** An old Presto: answers health without the UltraHonk route; the second answer has it. */
function oldPresto(): Promise<{ server: Server; port: number; upgrade: () => void }> {
  let schemes = ['chonk'];
  const server = createServer((req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-private-network', 'true');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    if (req.url?.startsWith('/health')) {
      res.setHeader('content-type', 'application/json');
      return void res.end(JSON.stringify({ status: 'ok', api_version: 1, schemes, version: '1.0.0' }));
    }
    res.writeHead(404).end();
  });
  return new Promise((ok) =>
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      ok({
        server,
        port,
        upgrade: () => {
          schemes = ['chonk', 'ultra_honk'];
        },
      });
    }),
  );
}

test('an old Presto answers: the update row, and Retry re-asks', async ({ page }) => {
  const r = run();
  const fake = await oldPresto();
  try {
    await page.goto(pageUrl(r, { presto: String(fake.port) }));
    await expect(page.getByTestId('cockpit')).toBeVisible({ timeout: BOOT_MS });
    const notice = page.getByTestId('presto-notice');
    await expect(notice).toContainText('needs an update', { timeout: 60_000 });
    await expect(page.getByTestId('presto-billboard')).toHaveCount(0);
    await page.getByTestId('not-now').click();
    await render(page, 'row');
    fake.upgrade();
    await page.getByTestId('presto-retry').click();
    await expect(notice).toHaveCount(0, { timeout: 30_000 });
  } finally {
    fake.server.close();
  }
});
