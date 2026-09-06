import { spawn } from 'node:child_process';
import { expect, type Page, test } from '@playwright/test';
import { bootPage, pageUrl, run } from './helpers.ts';

const nodeOrigin = (url: string) => new URL(url).origin;

test('the node going away pauses mining after a minute; its return resumes it', async ({ page }) => {
  const r = run();
  const origin = nodeOrigin(r.nodeUrl);
  // The impossible target: a win during the outage would end in a failed claim, not a pause.
  await bootPage(page, pageUrl(r, { miner: r.hardMiner, token: r.hardToken }));
  await page.getByTestId('start').click();
  await expect(page.getByTestId('tickets')).not.toHaveText('0', { timeout: 3 * 60_000 });
  // Every call to the node fails from here; the prover, which never talks to it, keeps going.
  const dead = (url: URL) => url.origin === origin;
  await page.route(dead, (route) => route.abort('connectionrefused'));
  await expect(page.getByTestId('notice-offline')).toBeVisible({ timeout: 2 * 60_000 });
  await expect(page.getByTestId('phase')).toHaveText('paused');
  await page.unroute(dead);
  await expect(page.getByTestId('notice-offline')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await page.getByTestId('stop').click();
});

/** A second miner that closes the open epoch; resolves once it has. */
const closeEpochFromOutside = (r: ReturnType<typeof run>): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn('bun', ['e2e/burst.ts'], {
      cwd: new URL('..', import.meta.url).pathname,
      env: { ...process.env, AZTEC_NODE_URL: r.nodeUrl, YACANA_MINER: r.miner, YACANA_TOKEN: r.token },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d: Buffer) => console.log(`[burst] ${String(d).trim()}`));
    child.stderr.on('data', (d: Buffer) => {
      const text = String(d);
      if (!/ INFO: | WARN: /.test(text)) console.log(`[burst!] ${text.trim().slice(0, 2000)}`);
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`burst exited ${code}`))));
  });

const lastClaim = (page: Page) => page.evaluate(() => window.yacana?.controller()?.lastClaim ?? null);

/** The balance and the session's claim count as one string, read in one go. */
const balanceForClaims = (page: Page) =>
  page.evaluate(() => {
    const text = (id: string) => document.querySelector(`[data-testid=${id}]`)?.textContent ?? '';
    return `${text('balance')} for ${text('claims')} claims`;
  });

test('a lost race: the claim reverts, the chain view is rebuilt, the next claim mints, the balance survives', async ({
  page,
}) => {
  test.setTimeout(30 * 60_000);
  const r = run();
  const origin = nodeOrigin(r.nodeUrl);
  await bootPage(page, pageUrl(r));
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await expect(page.getByTestId('balance')).toHaveText(/^4 tYACA$/);
  // A first contact: tx hash, ticket, delivery and handshake nullifiers; the mint's and the handshake's notes.
  const first = await lastClaim(page);
  console.log(`[effects] first claim: ${JSON.stringify(first)}`);
  expect(first?.nullifiers).toContain(first?.ticketNullifier);
  expect(first?.nullifiers).toHaveLength(4);
  expect(first?.noteHashes).toHaveLength(2);
  await expect(page.getByTestId('minted')).toContainText(/claims \d+ → \d+/);

  // The next claim's send is held at the wire until another miner has closed its epoch, so the
  // transaction is real and reverts in public ("stale claim") when it finally lands.
  let release: () => void = () => {};
  const held = new Promise<void>((res) => {
    release = res;
  });
  let closing: Promise<void> | undefined;
  await page.route(
    (url) => url.origin === origin,
    async (route) => {
      if (!closing && (route.request().postData() ?? '').includes('aztec_sendTx')) {
        closing = closeEpochFromOutside(r).finally(release);
        await held;
      }
      await route.continue();
    },
  );
  await expect(page.getByTestId('claim-stepper')).toBeVisible({ timeout: 10 * 60_000 });
  await expect(page.getByTestId('notice-reverted')).toBeVisible({ timeout: 15 * 60_000 });
  await closing;
  await expect(page.getByTestId('phase')).toHaveText('mining', { timeout: 5 * 60_000 });
  await expect(page.getByText('chain view rebuilt')).toBeVisible();
  // At the easy target the next claims come fast: the balance is checked against the claim count,
  // which only holds if the note minted before the reset came back with the rebuilt view.
  await expect(page.getByTestId('claims')).not.toHaveText(/^[01]$/, { timeout: 10 * 60_000 });
  await expect.poll(() => balanceForClaims(page), { timeout: 60_000 }).toMatch(/^\d+ tYACA for \d+ claims$/);
  const [, balance, claims] = /^(\d+) tYACA for (\d+) claims$/.exec(await balanceForClaims(page)) ?? [];
  expect(Number(balance)).toBe(4 * Number(claims));
  // No handshake this time: the rebuilt view still knows the recipient; one note, the mint's.
  const later = await lastClaim(page);
  console.log(`[effects] a claim after the rebuild: ${JSON.stringify(later)}`);
  expect(later?.nullifiers).toContain(later?.ticketNullifier);
  expect(later?.noteHashes).toHaveLength(1);
});
