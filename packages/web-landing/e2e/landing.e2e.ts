import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { type E2eRun, RUN_FILE } from './run.ts';

const run = (): E2eRun => JSON.parse(readFileSync(RUN_FILE, 'utf8')) as E2eRun;
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/example-claim.json', import.meta.url), 'utf8'),
) as {
  block: number;
  txHash: string;
  epoch: number;
  claims: [number, number];
};

const pageUrl = (r: E2eRun, base = r.baseURL) => {
  const url = new URL(base);
  url.searchParams.set('node', r.nodeUrl);
  url.searchParams.set('miner', r.miner);
  url.searchParams.set('token', r.token);
  return url.toString();
};

/** Every request the page makes, by origin; the prover's chunks and WASM flagged. */
function watch(page: Page, r: E2eRun) {
  const origins = new Set<string>();
  const heavy: string[] = [];
  page.on('request', (req) => {
    origins.add(new URL(req.url()).origin);
    if (/barretenberg|\.wasm(\?|$)/.test(req.url())) heavy.push(req.url());
  });
  const allowed = new Set([new URL(r.baseURL).origin, new URL(r.claimURL).origin, new URL(r.nodeUrl).origin]);
  return { heavy, foreign: () => [...origins].filter((o) => !allowed.has(o)) };
}

/** The frame's grid tracks, in px. */
const tracks = (page: Page, id: string) =>
  page
    .locator(`#${id}`)
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

async function expectFrames(page: Page) {
  expect(await page.locator('#hero').evaluate((el) => el.getBoundingClientRect().width)).toBe(1120);
  const hero = await tracks(page, 'hero');
  expect(hero).toHaveLength(2);
  expect((hero[1] as number) / (hero[0] as number)).toBeCloseTo(1.1, 2);
  expect(sum(hero)).toBeCloseTo(1120 - 2 * 36 - 30, 0);
  // The tile sits in the hero's right track and its chart spans the tile.
  const tile = await page.getByTestId('hero-live').boundingBox();
  const chart = await page.getByTestId('hero-chart').boundingBox();
  expect(tile && chart && chart.width > tile.width - 40 && chart.height >= 90).toBe(true);
  const ask = await page.locator('#ask').evaluate((el) => {
    const heading = el.querySelector('h2') as HTMLElement;
    const row = heading.nextElementSibling as HTMLElement;
    const frame = el.getBoundingClientRect();
    const first = (row.firstElementChild as Element).getBoundingClientRect();
    const last = (row.lastElementChild as Element).getBoundingClientRect();
    const box = heading.getBoundingClientRect();
    return {
      align: getComputedStyle(heading).textAlign,
      offset: Math.abs((box.left + box.right) / 2 - (frame.left + frame.right) / 2),
      slack: Math.abs(first.left - frame.left - (frame.right - last.right)),
    };
  });
  expect(ask.align).toBe('center');
  expect(ask.offset).toBeLessThanOrEqual(1);
  expect(ask.slack).toBeLessThanOrEqual(1);
}

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[console] ${m.text().slice(0, 300)}`));
});

test('the argument in order, the hero tile from the chain, the ledger empty, nothing of the prover ever', async ({
  page,
}) => {
  const r = run();
  const net = watch(page, r);
  await page.goto(pageUrl(r));
  const ids = await page.locator('main > section').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(['hero', 'money', 'chain', 'how', 'verify', 'ask']);
  await expect(page.getByTestId('live-minted')).toHaveText('0');
  await expect(page.getByTestId('live-epoch')).toHaveText('0 of 4');
  await expect(page.getByTestId('live-block').getByRole('link')).toHaveAttribute('href', /\/blocks\/\d+$/);
  await expect(page.getByTestId('hero-chart')).toBeVisible();
  await expect(page.getByTestId('hero-chart')).toContainText('epoch 0 · open · 0 of 4');
  await expect(page.getByTestId('hero-caption')).toContainText('every epoch so far');
  // No recorded claim on this deployment: the public tile shows its labels with dashes and no block chip.
  await expect(page.getByTestId('ledger-public')).toContainText('a nullifier');
  await expect(page.getByTestId('ledger-public')).toContainText('—');
  await expect(page.getByTestId('ledger-block')).toHaveCount(0);
  await expect(page.getByTestId('ledger-public').getByRole('link')).toHaveCount(0);
  await expect(page.getByTestId('ledger-private').getByRole('link')).toHaveCount(0);
  // Verify: the deployment's own addresses open on the explorer; one button.
  await expect(page.getByTestId('chip-miner')).toHaveAttribute(
    'href',
    new RegExp(`/contracts/instances/${r.miner}$`),
  );
  await expect(page.getByTestId('chip-token')).toHaveAttribute(
    'href',
    new RegExp(`/contracts/instances/${r.token}$`),
  );
  await expect(page.getByTestId('chip-class')).toHaveAttribute(
    'href',
    /\/contracts\/classes\/0x[0-9a-f]{64}\/versions\/1$/,
  );
  await expect(page.getByTestId('verify-source')).toHaveAttribute(
    'href',
    'https://github.com/alejoamiras/elixir',
  );
  await expect(page.locator('#verify').getByRole('link')).toHaveCount(5);
  await expect(page.getByTestId('footer-line')).toContainText(
    'no trackers, no cookies, no requests except to the Aztec node you choose',
  );
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectFrames(page);
  }
  expect(page.url().startsWith(r.baseURL)).toBe(true);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  expect(net.heavy).toEqual([]);
  expect(net.foreign()).toEqual([]);
});

test('with a recorded claim the ledger shows its block, hashes and counter, each linked to the explorer', async ({
  page,
}) => {
  const r = run();
  const net = watch(page, r);
  await page.goto(pageUrl(r, r.claimURL));
  await expect(page.getByTestId('live-epoch')).toHaveText('0 of 4');
  await expect(page.getByTestId('ledger-block')).toHaveAttribute(
    'href',
    new RegExp(`/blocks/${fixture.block}$`),
  );
  await expect(page.getByTestId('ledger-block')).toContainText(`block ${fixture.block}`);
  for (const id of ['ledger-nullifier', 'ledger-note-hash'])
    await expect(page.getByTestId(id)).toHaveAttribute('href', new RegExp(`/tx-effects/${fixture.txHash}$`));
  await expect(page.getByTestId('ledger-claims')).toHaveText(`${fixture.claims[0]} → ${fixture.claims[1]}`);
  await expect(page.getByTestId('ledger-public')).toContainText(`claims in epoch ${fixture.epoch}`);
  await expect(page.getByTestId('ledger-public')).toContainText('the sponsor');
  expect(net.heavy).toEqual([]);
  expect(net.foreign()).toEqual([]);
});

test('a phone reads, shares the miner link and mines nothing', async ({ page }) => {
  const r = run();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl(r));
  await expect(page.getByTestId('share')).toBeVisible();
  await expect(page.getByTestId('hero-live')).toHaveCount(0);
  await expect(page.getByTestId('hero-mine')).toHaveCount(0);
  await expect(page.getByTestId('ledger-public')).toBeVisible();
});
