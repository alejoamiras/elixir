// The signed-out page from the recording: a node that answers nonsense, an old Presto's row, and
// the public epoch poll reading again from the same recording.
import { mkdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { BOOT_MS } from '../helpers.ts'; // also declares window.yacana for the specs
import { expect, type Page, test } from './fixtures.ts';

const RENDERS = resolve(import.meta.dirname, '../.renders');
mkdirSync(RENDERS, { recursive: true });

async function render(page: Page, name: string): Promise<void> {
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: resolve(RENDERS, `${name}-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
}

// A node origin of its own, so the garbage never meets the recording's handler.
const NONSENSE_NODE = 'http://127.0.0.1:2';

test('a malformed RPC payload is rejected, not acted on', async ({ page, replay }) => {
  replay.allow(NONSENSE_NODE);
  await page.route(`${NONSENSE_NODE}/**`, (route) =>
    route.fulfill({ json: { jsonrpc: '2.0', id: 1, result: { not: 'a field' } } }),
  );
  await page.goto(replay.url({ node: NONSENSE_NODE }));
  await expect(page.getByTestId('boot-error')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('key-screen')).toHaveCount(0);
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

test('an old Presto answers: the update row, and Retry re-asks', async ({ page, replay }) => {
  const fake = await oldPresto();
  // The SDK reaches the fake over HTTPS first (refused), then plaintext; both are the fake's origin by port.
  replay.allow(`https://127.0.0.1:${fake.port}`);
  replay.allow(`http://127.0.0.1:${fake.port}`);
  try {
    await page.goto(replay.url({ presto: String(fake.port) }));
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

test('the public epoch poll reads again from the recording, and nothing else', async ({ page, replay }) => {
  await page.goto(replay.url());
  await expect(page.getByTestId('cockpit')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('epoch-claims')).toHaveText(/\d+ of \d+/);
  // A poll is five storage reads (the open epoch, its three params, its claims); the next one comes
  // 30 s after the first. Served twice is a completed second read, not a timer that merely fired.
  const afterFirst = replay.served('aztec_getPublicStorageAt');
  await expect
    .poll(() => replay.served('aztec_getPublicStorageAt'), { timeout: 45_000 })
    .toBeGreaterThanOrEqual(afterFirst + 5);
  await expect(page.getByTestId('epoch-claims')).toHaveText(/\d+ of \d+/);
  // A read that failed is swallowed into the page's log, never thrown: the log must not hold one.
  const log = await page.evaluate(() => window.yacana?.log() ?? []);
  expect(log.filter((l) => l.includes('public epoch:'))).toEqual([]);
});
