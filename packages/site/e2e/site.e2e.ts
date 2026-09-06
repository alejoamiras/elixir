import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { type E2eRun, RUN_FILE } from './run.ts';

const run = (): E2eRun => JSON.parse(readFileSync(RUN_FILE, 'utf8')) as E2eRun;

const query = (r: E2eRun) =>
  `?${new URLSearchParams({ node: r.nodeUrl, miner: r.miner, token: r.token }).toString()}`;

const POLICY = [
  'strict-transport-security',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'content-security-policy',
  'permissions-policy',
  'x-content-type-options',
  'referrer-policy',
];

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[console] ${m.text().slice(0, 300)}`));
});

test('one origin, three apps: every path serves its app under the same headers; build.json says e2e', async ({
  page,
  request,
}) => {
  const r = run();
  const build = await (await request.get(`${r.baseURL}/build.json`)).json();
  expect(build).toMatchObject({ mode: 'e2e', rpId: 'localhost', nodeOrigins: [new URL(r.nodeUrl).origin] });
  expect(build.commit).toMatch(/^[0-9a-f]{40}$/);

  const headersOf = async (path: string) => {
    const res = await request.get(`${r.baseURL}${path}`);
    expect(res.status(), path).toBe(200);
    return Object.fromEntries(POLICY.map((h) => [h, res.headers()[h]]));
  };
  const reference = await headersOf('/');
  for (const h of POLICY) expect(reference[h], h).toBeTruthy();
  expect(reference['content-security-policy']).toContain(new URL(r.nodeUrl).origin);
  for (const path of [
    '/mine/wallet',
    '/stats?epoch=0',
    '/verify',
    '/slots/0.json',
    '/artifacts/yacana_work.json',
  ])
    expect(await headersOf(path), path).toEqual(reference);

  await page.goto(`${r.baseURL}/${query(r)}`);
  await expect(page.getByTestId('hero')).toBeVisible();
  await expect(page.getByTestId('live-epoch')).toHaveText('0 of 4');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

  await page.goto(`${r.baseURL}/mine/wallet${query(r)}`);
  // The miner boots to its key screen (no key on this profile yet) under the /mine/wallet path.
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: 2 * 60_000 });
  await expect(page.getByTestId('phase')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/mine/wallet');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

  await page.goto(`${r.baseURL}/stats${query(r)}&epoch=0`);
  await expect(page.getByTestId('detail')).toContainText('epoch 0');
  await page.goto(`${r.baseURL}/verify${query(r)}`);
  await expect(page.getByTestId('verify')).toBeVisible();
  await expect(page.getByTestId('verify-miner')).toHaveText(r.miner);
});

test('the demo proves on the assembled origin', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const r = run();
  await page.goto(`${r.baseURL}/${query(r)}`);
  const prove = page.getByTestId('prove');
  await expect(prove).toBeEnabled();
  await prove.click();
  await expect(page.getByTestId('demo-result')).toBeVisible({ timeout: 4 * 60_000 });
  expect(Number(await page.getByTestId('demo-score').textContent())).toBeGreaterThanOrEqual(1);
});
