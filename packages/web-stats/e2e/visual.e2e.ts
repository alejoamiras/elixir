import { readFileSync } from 'node:fs';
import { expect, type Page, type Route, test } from '@playwright/test';

const here = new URL('.', import.meta.url).pathname;
const run = JSON.parse(readFileSync(`${here}.visual.json`, 'utf8')) as {
  baseURL: string;
  nodeOrigin: string;
};
const recorded = JSON.parse(readFileSync(`${here}visual-rpc.json`, 'utf8')) as Record<string, unknown>;
const WIDTHS = [1280, 1440, 1024, 390];
/** Before the recorded block: the page's clock is then the block's, and the freshness reads "0 s ago". */
const FIXED_TIME = new Date('2020-01-01T00:00:00Z');

interface Call {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: unknown[];
}

const key = (c: Call) => `${c.method} ${JSON.stringify(c.params ?? [])}`;

/** Every JSON-RPC call answered from the recording; anything else the page asks for is a failure. */
function replay(page: Page): { unexpected: string[] } {
  const unexpected: string[] = [];
  const app = new URL(run.baseURL).origin;
  void page.route(
    () => true,
    async (route: Route) => {
      const url = new URL(route.request().url());
      if (url.origin === app) return route.continue();
      if (url.origin !== run.nodeOrigin) {
        unexpected.push(url.href);
        return route.abort();
      }
      const body = route.request().postDataJSON() as Call | Call[];
      const calls = Array.isArray(body) ? body : [body];
      const answers = calls.map((c) => ({ jsonrpc: '2.0', id: c.id, result: recorded[key(c)] }));
      const missing = calls.filter((c) => recorded[key(c)] === undefined).map(key);
      if (missing.length) {
        unexpected.push(...missing);
        return route.abort();
      }
      await route.fulfill({ json: Array.isArray(body) ? answers : answers[0] });
    },
  );
  return { unexpected };
}

for (const width of WIDTHS) {
  test(`the observatory at ${width}`, async ({ page }) => {
    const net = replay(page);
    await page.clock.setFixedTime(FIXED_TIME);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${run.baseURL}/`);
    await expect(page.getByTestId('table').locator('tbody tr')).toHaveCount(9);
    await expect(page.getByTestId('freshness')).toContainText('0 s ago');
    await page.evaluate(() => document.fonts.ready);
    expect(net.unexpected).toEqual([]);
    await expect(page).toHaveScreenshot(`stats-${width}.png`, { fullPage: true });
    // A request the capture itself provoked lands here.
    expect(net.unexpected).toEqual([]);
  });
}
