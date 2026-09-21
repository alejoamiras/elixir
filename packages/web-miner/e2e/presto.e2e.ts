// The miner against the run's headless Presto (tools/localnet/src/presto.ts): native proving shown and
// proven, a claim whose winner came from Presto, the billboard when nothing answers — with the
// 1280/1440 renders of each state. The old Presto's update row is the replay lane's.

import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page, test } from './fixtures.ts';
import { bootPage, pageUrl, run } from './helpers.ts';

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
  await expect(page.getByTestId('rate-line')).toContainText('✦ presto');
  // The epoch tile's power row is Presto's while the Worker proves natively: no slider in the cockpit.
  await expect(page.getByTestId('presto-row')).toContainText('proving on this machine');
  await expect(page.getByRole('slider')).toHaveCount(0);
  await render(page, 'native');
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('phase')).toHaveText(/^idle/, { timeout: 60_000 });
  await auth.remove();
});

test('a win Presto proved is verified in the browser before it shows, then claimed through Presto too; both proofs went over the wire', async ({
  page,
}) => {
  const r = run();
  test.skip(!r.prestoUrl, 'presto-server is not installed on this machine');
  const proveUrl = `${r.prestoUrl}/prove/ultra-honk`;
  const proves: number[] = [];
  // The claim's own proof (the private kernel, `chonk`) goes from the page to `/prove`.
  const txProves: number[] = [];
  page.on('response', (res) => {
    if (res.request().method() !== 'POST') return;
    if (res.url() === proveUrl) proves.push(res.status());
    if (res.url() === `${r.prestoUrl}/prove`) txProves.push(res.status());
  });
  // The server's log is the run's, and an earlier spec has already proved through it: only what it
  // gains from here on is this test's evidence.
  const logFile = r.prestoHome ? resolve(r.prestoHome, 'server.log') : null;
  const logRead = () => (logFile ? readFileSync(logFile, 'utf8') : '');
  const logBefore = logRead().length;
  await bootPage(page, pageUrl(r, { presto: 'on' }));
  const proverless = await page.evaluate(() => window.yacana?.proverless === true);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('native')).toBeVisible({ timeout: 3 * 60_000 });
  // The easy target wins every other proof: the win was verified in WASM before it showed, then claimed.
  // The claim line names Presto once the steps are transmitted; the transaction's proof came back 200.
  // A proverless build proves no transaction: nothing goes to `/prove`, the line skips to the node.
  if (!proverless)
    await expect(page.getByTestId('ledger')).toContainText('claiming: proving through Presto ✦', {
      timeout: 5 * 60_000,
    });
  await expect(page.getByTestId('ledger')).toContainText(/minted in block/, { timeout: 10 * 60_000 });
  expect(txProves).toEqual(proverless ? [] : [200]);
  const prover = await page.evaluate(() => window.yacana?.controller()?.lastClaim?.prover);
  expect(prover).toBe('presto');
  // The HTTP evidence, independent of the Worker's own messages: a 200 on the route as Playwright saw
  // it from the Worker, or, where it sees no Worker traffic, a proof the server finished during it.
  const sinceStart = logRead().slice(logBefore);
  expect(proves.includes(200) || /UltraHonk prove finished.*ok\S*=\S*true/.test(sinceStart)).toBe(true);
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('phase')).toHaveText(/^idle/, { timeout: 60_000 });
});

test('Presto gone mid-proof: the claim’s transmit fails, the browser finishes it, nothing is sent twice', async ({
  page,
}) => {
  const r = run();
  test.skip(!r.prestoUrl, 'presto-server is not installed on this machine');
  // The mining proofs still go to Presto; the claim's transmit is cut at the socket, as a Presto that
  // died mid-proof would cut it. The SDK must not re-send the private inputs.
  let attempts = 0;
  await page.route(`${r.prestoUrl}/prove`, (route) => {
    attempts += 1;
    return route.abort('connectionreset');
  });
  await bootPage(page, pageUrl(r, { presto: 'on' }));
  const proverless = await page.evaluate(() => window.yacana?.proverless === true);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('native')).toBeVisible({ timeout: 3 * 60_000 });
  // A proverless build never transmits: the claim mints with nothing to cut.
  if (!proverless)
    await expect(page.getByTestId('ledger')).toContainText('claiming: proving in your browser, about 20 s', {
      timeout: 5 * 60_000,
    });
  await expect(page.getByTestId('ledger')).toContainText(/minted in block/, { timeout: 10 * 60_000 });
  expect(attempts).toBe(proverless ? 0 : 1);
  // The header's suffix is the Worker's, which never lost Presto.
  await expect(page.getByTestId('native')).toBeVisible();
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
  // Nothing asks Presto before Start mining: no billboard, no row on the cockpit's ready.
  await expect(page.getByTestId('cockpit')).toBeVisible();
  await expect(billboard).toHaveCount(0);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await expect(billboard).toBeVisible({ timeout: 60_000 });
  await expect(billboard.getByText('Fast proofs')).toBeVisible();
  // The element resolves its `href` through `new URL()`, which spells the origin with a trailing slash.
  await expect(billboard.getByRole('link', { name: 'Get Presto' })).toHaveAttribute(
    'href',
    /^https:\/\/presto\.build\/?$/,
  );
  await expect(page.getByTestId('presto-notice')).toHaveCount(0);
  await render(page, 'billboard');
  await expect(page.getByTestId('rate-line')).toBeVisible({ timeout: 3 * 60_000 });
  await expect(page.getByTestId('rate-line')).not.toContainText('presto');
  await expect(page.getByTestId('native')).toHaveCount(0);
  await expect(page.getByRole('slider')).toBeEnabled();
  await page.getByTestId('stop').click();
  await auth.remove();
});
