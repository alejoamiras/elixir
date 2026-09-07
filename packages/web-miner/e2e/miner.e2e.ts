import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { BOOT_MS, bootPage, pageUrl, passKeyScreen, run } from './helpers.ts';

// RSS of the browser's process tree, sampled from `ps`; Playwright's Chromium is the one whose
// command line carries its temporary profile directory. `peakMiB` is the highest sample, `nowMiB`
// the latest: a leak shows in the steady state, a peak also counts the old backend's memory before
// the collector returns it.
function rssWatcher(): { peakMiB: () => number; nowMiB: () => number; stop: () => void } {
  let peak = 0;
  let now = 0;
  const sample = () => {
    try {
      const rows = execSync('ps -eo pid=,ppid=,rss=,args=', { encoding: 'utf8' }).split('\n');
      const roots = rows
        .filter((l) => l.includes('playwright_chromiumdev_profile'))
        .map((l) => Number(l.trim().split(/\s+/)[0]));
      const byParent = new Map<number, number[]>();
      const rss = new Map<number, number>();
      for (const l of rows) {
        const [pid, ppid, kb] = l.trim().split(/\s+/).map(Number) as [number, number, number];
        rss.set(pid, kb);
        byParent.set(ppid, [...(byParent.get(ppid) ?? []), pid]);
      }
      const seen = new Set<number>();
      let total = 0;
      const stack = [...roots];
      while (stack.length) {
        const p = stack.pop() as number;
        if (seen.has(p)) continue;
        seen.add(p);
        total += rss.get(p) ?? 0;
        stack.push(...(byParent.get(p) ?? []));
      }
      now = total;
      peak = Math.max(peak, total);
    } catch {
      /* ps hiccup */
    }
  };
  const timer = setInterval(sample, 500);
  const mib = (kb: number) => Math.round(kb / 1024);
  return {
    peakMiB: () => mib(peak),
    nowMiB: () => {
      sample();
      return mib(now);
    },
    stop: () => clearInterval(timer),
  };
}

/** Collects garbage in the page and lets the process tree settle before a memory sample. */
async function settled(page: Page, memory: { nowMiB: () => number }): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.detach();
  await page.waitForTimeout(3000);
  return memory.nowMiB();
}

test('first visit creates an account, mines at the easy target, claims and shows the balance', async ({
  page,
}) => {
  const r = run();
  const memory = rssWatcher();
  await bootPage(page, pageUrl(r));
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  await expect(page.getByTestId('balance')).toHaveText('0');
  await expect(page.getByTestId('balance').locator('xpath=..')).toHaveText(/^0\s*tYACA$/);
  // The M1 frame at 1280 (the default viewport) and 1440: 1080 wide, three equal tracks and the
  // 300-px rail; between md and xl two equal columns, the rail beside the stacked ledger and key tile.
  const cockpit = page.getByTestId('cockpit');
  const tracks = () => cockpit.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  const width = () => cockpit.evaluate((el) => el.getBoundingClientRect().width);
  expect(await tracks()).toBe('246px 246px 246px 300px');
  expect(await width()).toBe(1080);
  await page.setViewportSize({ width: 1024, height: 900 });
  const half = `${(((await width()) - 14) / 2).toString()}px`;
  expect(await tracks()).toBe(`${half} ${half}`);
  expect(
    await cockpit.evaluate((el) => {
      const [, rail, , stack] = Array.from(el.children).map((c) => c.getBoundingClientRect());
      return rail && stack && rail.top === stack.top && rail.right <= stack.left;
    }),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await tracks()).toBe('246px 246px 246px 300px');
  expect(await width()).toBe(1080);
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  // The easy target wins every other proof; the claim is then proved in-page and mined.
  await expect(page.getByTestId('phase')).toHaveText('claiming', { timeout: 5 * 60_000 });
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await expect(page.getByTestId('balance')).toHaveText('4');
  await expect(page.getByTestId('epoch-claims')).toHaveText('1 of 4');
  await expect(page.getByTestId('ledger')).toContainText('minted, privately');
  // Mining resumes on its own after a claim; stop it cleanly.
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('phase')).toHaveText('idle');
  // Second visit: the persisted account signs again and its notes are still there.
  const account = await page.getByTestId('account').getAttribute('title');
  await page.reload();
  await passKeyScreen(page);
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  expect(await page.getByTestId('account').getAttribute('title')).toBe(account);
  await expect(page.getByTestId('balance')).toHaveText('4');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await expect(page.getByTestId('balance')).toHaveText('8');
  await page.getByTestId('stop').click();
  memory.stop();
  console.log(`peak browser process-tree RSS: ${memory.peakMiB()} MiB`);
  writeFileSync(
    new URL('./.peak-rss.json', import.meta.url).pathname,
    JSON.stringify({ peakMiB: memory.peakMiB() }),
  );
  expect(memory.peakMiB()).toBeGreaterThan(0);
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

// The page is pointed at a mock origin (allowlisted by the e2e build) that answers nonsense.
test('a malformed RPC payload is rejected, not acted on', async ({ page }) => {
  const r = run();
  await page.route('http://127.0.0.1:1/**', (route) =>
    route.fulfill({ json: { jsonrpc: '2.0', id: 1, result: { not: 'a field' } } }),
  );
  await page.goto(pageUrl(r, { node: 'http://127.0.0.1:1' }));
  await expect(page.getByTestId('boot-error')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('key-screen')).toHaveCount(0);
});

// Power changes rebuild bb.js in place; the job resumes at its next nonce. The process tree must
// not keep the old backends: growth above 300 MiB over three rebuilds means a leak (then the
// fallback is a Worker respawn per change).
test('three power changes keep mining, the ledger grows, memory stays bounded', async ({ page }) => {
  const r = run();
  // The hard deployment: no win, so no claim proof (≈ 2 GB on its own) muddies the measurement.
  await bootPage(page, pageUrl(r, { miner: r.hardMiner, token: r.hardToken }));
  const memory = rssWatcher();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  const lines = () => page.getByTestId('ledger').locator('[data-slot=proof-line]');
  await expect(lines()).not.toHaveCount(0, { timeout: 3 * 60_000 });
  const baseline = await settled(page, memory);
  const slider = page.getByRole('slider');
  const max = Number(await slider.getAttribute('max'));
  for (const threads of [Math.max(1, Math.ceil(max / 2)), 1, max]) {
    const before = await lines().count();
    await slider.fill(String(threads));
    await expect(page.getByText(new RegExp(`^${threads} threads?`))).toBeVisible();
    // Attempts keep landing on the rebuilt backend (a claim in between is fine: mining resumes).
    await expect
      .poll(async () => (await lines().count()) - before, { timeout: 5 * 60_000 })
      .toBeGreaterThanOrEqual(2);
  }
  await expect(page.getByTestId('phase')).not.toHaveText('idle');
  const after = await settled(page, memory);
  await page.getByTestId('stop').click();
  memory.stop();
  console.log(
    `RSS baseline ${baseline} MiB, after three rebuilds ${after} MiB (peak ${memory.peakMiB()} MiB)`,
  );
  expect(after - baseline).toBeLessThanOrEqual(300);
});

test('a prover crash surfaces as an error and mining restarts on the next start', async ({ page }) => {
  const r = run();
  await bootPage(page, pageUrl(r));
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await page.evaluate(() => window.yacana?.crashProver());
  await expect(page.getByTestId('miner-error')).toContainText('worker');
  await expect(page.getByTestId('phase')).toHaveText('idle');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await expect(page.getByTestId('tickets')).not.toHaveText('0', { timeout: 2 * 60_000 });
  await page.getByTestId('stop').click();
});
