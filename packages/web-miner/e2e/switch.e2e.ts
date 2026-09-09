import { expect, test } from '@playwright/test';
import { BOOT_MS, run } from './helpers.ts';

const stats = async (proxy: string) => (await (await fetch(`${proxy}/__stats`)).json()) as { count: number };
const setMode = (proxy: string, mode: 'ok' | 'down') =>
  fetch(`${proxy}/__mode`, { method: 'POST', body: JSON.stringify({ mode }) });

/**
 * The live node switch between two distinct endpoints (two proxies in front of the isolated node),
 * under an open words account while mining: the rebuild shows, the session survives, a claim lands
 * on the new node, the old node sees nothing more; a node that stops serving raises the banner and
 * the switch back clears it.
 */
test('a live switch A → B while mining, a claim after it, and the banner on a dead node', async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  const r = run();
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  // The page starts on A through the saved setting, not the query pin (a pin would disable the tile).
  await page.addInitScript(
    (nodeUrl) => localStorage.setItem('yacana.connection', JSON.stringify({ nodeUrl })),
    r.proxyA,
  );
  await page.goto(`${r.baseURL}/`);
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await page.getByTestId('use-words').click();
  await page.getByTestId('words-skip').click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  expect((await stats(r.proxyA)).count).toBeGreaterThan(0);
  expect((await stats(r.proxyB)).count).toBe(0);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText(/mining/, { timeout: 60_000 });

  // Settings → the tile shows A in use; B checks out and takes over without a reload.
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByTestId('node-in-use')).toContainText(new URL(r.proxyA).host);
  await expect(page.getByTestId('node-health')).toContainText('this deployment ✓', { timeout: 60_000 });
  await page.getByTestId('node-url').fill(r.proxyB);
  await page.getByTestId('node-check').click();
  await expect(page.getByTestId('node-check-result')).toContainText('the miner and the token are there', {
    timeout: 60_000,
  });
  const before = (await stats(r.proxyA)).count;
  await page.getByTestId('node-use').click();
  await expect(page.getByTestId('node-check-result')).toContainText('in use', { timeout: 5 * 60_000 });
  await expect(page.getByTestId('node-in-use')).toContainText(new URL(r.proxyB).host);
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('yacana.connection') ?? '{}'));
  expect(new URL(saved.nodeUrl).href).toBe(new URL(r.proxyB).href);

  // The session survived the switch (no reload, the same account) and mining carries on, on B.
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible();
  await expect(page.getByTestId('phase')).toHaveText(/mining/, { timeout: 3 * 60_000 });
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  const after = (await stats(r.proxyA)).count;
  expect(after - before).toBeLessThanOrEqual(2); // what was in flight at the switch, nothing since
  expect((await stats(r.proxyB)).count).toBeGreaterThan(20);

  // B stops serving: the banner names it; back to A and the banner goes.
  await setMode(r.proxyB, 'down');
  const banner = page.getByTestId('node-banner');
  await expect(banner).toBeVisible({ timeout: 60_000 });
  await expect(banner).toHaveAttribute('data-kind', /silent|throttled|stale/);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByTestId('node-url').fill(r.proxyA);
  await page.getByTestId('node-check').click();
  await expect(page.getByTestId('node-check-result')).toContainText('the miner and the token are there', {
    timeout: 60_000,
  });
  await page.getByTestId('node-use').click();
  await expect(page.getByTestId('node-check-result')).toContainText('in use', { timeout: 5 * 60_000 });
  await expect(page.getByTestId('node-banner')).toHaveCount(0, { timeout: 60_000 });
});
