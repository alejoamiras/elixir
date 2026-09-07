import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { type E2eRun, RUN_FILE } from './run.ts';

const run = (): E2eRun => JSON.parse(readFileSync(RUN_FILE, 'utf8')) as E2eRun;

const pageUrl = (r: E2eRun) => {
  const url = new URL(r.baseURL);
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
  const allowed = new Set([new URL(r.baseURL).origin, new URL(r.nodeUrl).origin]);
  return { heavy, foreign: () => [...origins].filter((o) => !allowed.has(o)) };
}

/** The frame's grid tracks, in px. */
const tracks = (page: Page, id: string) =>
  page
    .locator(`#${id}`)
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[console] ${m.text().slice(0, 300)}`));
});

test('the argument in order, the live strip from the chain, nothing of the prover before the click', async ({
  page,
}) => {
  const r = run();
  const net = watch(page, r);
  await page.goto(pageUrl(r));
  const ids = await page.locator('main > section').evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(['hero', 'money', 'chain', 'how', 'live', 'verify', 'ask']);
  await expect(page.getByTestId('live-minted')).toHaveText('0');
  await expect(page.getByTestId('live-epoch')).toHaveText('0 of 4');
  await expect(page.getByTestId('demo-caption')).toContainText('epoch 0');
  await expect(page.getByTestId('footer-line')).toContainText(
    'no trackers, no cookies, no requests except to the Aztec node you choose',
  );
  // The L2 frames at 1280 and 1440: the hero's 1fr 1.1fr, the live strip's four numbers and the
  // 1.4fr sparkline column in one row, the ask centred in its frame.
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const hero = await tracks(page, 'hero');
    expect(hero).toHaveLength(2);
    expect((hero[1] as number) / (hero[0] as number)).toBeCloseTo(1.1, 2);
    const live = await tracks(page, 'live');
    expect(live).toHaveLength(5);
    expect((live[4] as number) / (live[0] as number)).toBeCloseTo(1.4, 2);
    expect(
      await page.locator('#ask h2').evaluate((h) => {
        const frame = (h.closest('section') as Element).getBoundingClientRect();
        const box = h.getBoundingClientRect();
        return Math.abs((box.left + box.right) / 2 - (frame.left + frame.right) / 2) <= 1;
      }),
    ).toBe(true);
  }
  expect(page.url().startsWith(r.baseURL)).toBe(true);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  expect(net.heavy).toEqual([]);
  expect(net.foreign()).toEqual([]);
});

test('"Prove one now" proves W against the open epoch: real step times, a score, no request elsewhere', async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  const r = run();
  const net = watch(page, r);
  await page.goto(pageUrl(r));
  const prove = page.getByTestId('prove');
  await expect(prove).toBeEnabled();
  await prove.click();
  await expect(page.getByTestId('demo-steps')).toBeVisible();
  await expect(page.getByTestId('demo-result')).toBeVisible({ timeout: 4 * 60_000 });
  const steps = page.getByTestId('demo-steps').locator('li[data-done="1"]');
  await expect(steps).toHaveCount(4);
  const times = await steps.locator('span:last-child').allTextContents();
  for (const t of times) expect(t).toMatch(/^\d+\.\d s$/);
  // The proof itself is seconds, not milliseconds: a real UltraHonk proof of W was made.
  const proofMs = Number((times[2] as string).replace(' s', '')) * 1000;
  expect(proofMs).toBeGreaterThan(300);
  const score = Number(await page.getByTestId('demo-score').textContent());
  expect(score).toBeGreaterThanOrEqual(1);
  expect(net.heavy.length).toBeGreaterThan(0);
  expect(net.foreign()).toEqual([]);
  await expect(prove).toHaveText('Prove another');
});

test('a phone reads, shares the miner link and mines nothing', async ({ page }) => {
  const r = run();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl(r));
  await expect(page.getByTestId('share')).toBeVisible();
  await expect(page.getByTestId('demo')).toHaveCount(0);
  await expect(page.getByTestId('hero-prove')).toHaveCount(0);
  await expect(page.getByTestId('live-epoch')).toHaveText('0 of 4');
});
