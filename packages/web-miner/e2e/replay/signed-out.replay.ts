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

// A node origin of its own, apart from the recording's. The page route runs before the fixture's
// context route and fulfills, so the garbage never reaches the network or the accounting; the
// count proves the page got it, rather than a refused connection producing the same boot error.
const NONSENSE_NODE = 'http://127.0.0.1:2';

test('a malformed RPC payload is rejected, not acted on', async ({ page, replay }) => {
  let answered = 0;
  await page.route(`${NONSENSE_NODE}/**`, (route) => {
    answered += 1;
    return route.fulfill({ json: { jsonrpc: '2.0', id: 1, result: { not: 'a field' } } });
  });
  await page.goto(replay.url({ node: NONSENSE_NODE }));
  await expect(page.getByTestId('boot-error')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('key-screen')).toHaveCount(0);
  expect(answered).toBeGreaterThan(0);
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
  const shown = await page.getByTestId('epoch-claims').textContent();
  const claims = Number(/^(\d+) of/.exec(shown ?? '')?.[1]);
  expect(Number.isInteger(claims)).toBe(true);
  // The next poll comes 30 s after the first. Its claims read now answers one more; the count on
  // the tile can only change if that read was made, parsed and published — a stopped timer, a hung
  // read or a swallowed error all leave the old number, and the log carries the error.
  replay.override(replay.recording.claimsKey, `0x${(claims + 1).toString(16).padStart(64, '0')}`);
  await expect(page.getByTestId('epoch-claims')).toHaveText(new RegExp(`^${claims + 1} of`), {
    timeout: 45_000,
  });
  const log = await page.evaluate(() => {
    if (!window.yacana) throw new Error('the page exposes no e2e hooks');
    return window.yacana.log();
  });
  expect(log.filter((l) => l.includes('public epoch:'))).toEqual([]);
});
