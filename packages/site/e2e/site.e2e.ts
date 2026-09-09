import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { type E2eRun, RUN_FILE } from './run.ts';

const run = (): E2eRun => JSON.parse(readFileSync(RUN_FILE, 'utf8')) as E2eRun;
/** The smallest file of the pinned CRS the miner fetches from `/crs` (`crs.lock.json`). */
const CRS_FILE = 'g2.dat';

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
  expect(build).toMatchObject({ mode: 'e2e', rpId: 'localhost', nodeOrigin: new URL(r.nodeUrl).origin });
  expect(build.commit).toMatch(/^[0-9a-f]{40}$/);

  const headersOf = async (path: string) => {
    const res = await request.get(`${r.baseURL}${path}`);
    expect(res.status(), path).toBe(200);
    return Object.fromEntries(POLICY.map((h) => [h, res.headers()[h]]));
  };
  const reference = await headersOf('/');
  for (const h of POLICY) expect(reference[h], h).toBeTruthy();
  // The node is a setting the policy cannot name: any https origin, the local forms only in this e2e build.
  const csp = reference['content-security-policy'] as string;
  expect(csp).toContain("connect-src 'self' data: https: http://127.0.0.1:* http://localhost:*");
  expect(csp).toContain("webrtc 'block'");
  expect(csp).not.toContain(new URL(r.nodeUrl).origin);
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

test('the landing serves no prover; the miner still does', async ({ page, request }) => {
  const r = run();
  // The landing's HTML and its assets name nothing of bb.js or a WASM binary.
  const html = await (await request.get(`${r.baseURL}/`)).text();
  expect(html).not.toMatch(/barretenberg|\.wasm/);
  const heavy: string[] = [];
  page.on('request', (req) => {
    if (/barretenberg|\.wasm(\?|$)/.test(req.url())) heavy.push(req.url());
  });
  await page.goto(`${r.baseURL}/${query(r)}`);
  await expect(page.getByTestId('hero-live')).toBeVisible();
  await expect(page.getByTestId('live-epoch')).toHaveText('0 of 4');
  await expect(page.getByTestId('ledger-public')).toContainText('—');
  expect(heavy).toEqual([]);
  // The miner's CRS is still there at the origin's root.
  const crs = await request.get(`${r.baseURL}/crs/${CRS_FILE}`);
  expect(crs.status()).toBe(200);
  expect((await crs.body()).length).toBe(128);
});
