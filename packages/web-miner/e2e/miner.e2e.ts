import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { type E2eRun, RUN_FILE } from './run.ts';

const run = (): E2eRun => JSON.parse(readFileSync(RUN_FILE, 'utf8')) as E2eRun;
const pageUrl = (r: E2eRun, extra: Record<string, string> = {}) =>
  `${r.baseURL}/?${new URLSearchParams({ node: r.nodeUrl, miner: r.miner, token: r.token, ...extra })}`;

const BOOT_MS = 8 * 60_000; // CRS verification, wallet + PXE boot, bb.js init

async function bootPage(page: Page, url: string): Promise<void> {
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  await page.goto(url);
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
}

test('first visit creates an account, mines at the easy target, claims and shows the balance', async ({
  page,
}) => {
  const r = run();
  await bootPage(page, pageUrl(r));
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  await expect(page.getByTestId('balance')).toHaveText(/^0 tELX$/);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  // The easy target wins every other proof; the claim is then proved in-page and mined.
  await expect(page.getByTestId('phase')).toHaveText('claiming', { timeout: 5 * 60_000 });
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await expect(page.getByTestId('balance')).toHaveText(/^4 tELX$/);
  await expect(page.getByTestId('epoch-claims')).toHaveText('1 / 4');
  await expect(page.getByTestId('log')).toContainText('claim mined in block');
  // Mining resumes on its own after a claim; stop it cleanly.
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('phase')).toHaveText('idle');
  // Second visit: the persisted account signs again and its notes are still there.
  const account = await page.getByTestId('account').getAttribute('title');
  await page.reload();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  expect(await page.getByTestId('account').getAttribute('title')).toBe(account);
  await expect(page.getByTestId('balance')).toHaveText(/^4 tELX$/);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await expect(page.getByTestId('balance')).toHaveText(/^8 tELX$/);
  await page.getByTestId('stop').click();
});

test('a poisoned CRS cache is purged before proving', async ({ page }) => {
  const r = run();
  // bb.js prefers its idb-keyval cache (32 MiB of uncompressed G1 points) over any download; fill it
  // with zeros before the page runs. Proving with it would fail; the page must purge it.
  await page.addInitScript(() => {
    if ((window as { __poisoned?: boolean }).__poisoned) return;
    (window as { __poisoned?: boolean }).__poisoned = true;
    const req = indexedDB.open('keyval-store', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keyval');
    req.onsuccess = () => {
      const tx = req.result.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put(new Uint8Array(2 ** 19 * 64), 'g1Data');
      tx.objectStore('keyval').put(new Uint8Array(128), 'g2Data');
    };
  });
  await bootPage(page, pageUrl(r));
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await page.getByTestId('stop').click();
});

test('a lying cross-check node stops the miner before any work is wasted', async ({ page }) => {
  const r = run();
  // A second "node" that proxies the real one and lies only about public storage (batched or not).
  await page.route('http://127.0.0.1:1/**', async (route) => {
    const upstream = await route.fetch({ url: r.nodeUrl });
    const body = (await upstream.json()) as unknown;
    const request = route.request().postDataJSON() as { method: string } | { method: string }[];
    const lie = (res: { result?: unknown }, req: { method: string }) =>
      req.method.endsWith('getPublicStorageAt')
        ? { ...res, result: `0x${'ff'.repeat(16).padStart(64, '0')}` }
        : res;
    const json = Array.isArray(body)
      ? body.map((res, i) =>
          lie(res as { result?: unknown }, (request as { method: string }[])[i] ?? { method: '' }),
        )
      : lie(body as { result?: unknown }, request as { method: string });
    await route.fulfill({ json });
  });
  await page.goto(pageUrl(r, { crossCheck: 'http://127.0.0.1:1' }));
  await expect(page.getByTestId('boot-error')).toContainText('nodes disagree', { timeout: BOOT_MS });
  await expect(page.getByTestId('start')).toBeDisabled();
});

test('a malformed RPC payload is rejected, not acted on', async ({ page }) => {
  const r = run();
  await page.route('http://127.0.0.1:1/**', (route) =>
    route.fulfill({ json: { jsonrpc: '2.0', id: 1, result: { not: 'a field' } } }),
  );
  await page.goto(pageUrl(r, { crossCheck: 'http://127.0.0.1:1' }));
  await expect(page.getByTestId('boot-error')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('start')).toBeDisabled();
});

test('a prover crash surfaces as an error and mining restarts on the next start', async ({ page }) => {
  const r = run();
  await bootPage(page, pageUrl(r));
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await page.evaluate(() => window.elixir?.crashProver());
  await expect(page.getByTestId('miner-error')).toContainText('worker');
  await expect(page.getByTestId('phase')).toHaveText('idle');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await expect(page.getByTestId('tickets')).not.toHaveText('0', { timeout: 2 * 60_000 });
  await page.getByTestId('stop').click();
});
