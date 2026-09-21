// The versioned origin, on the rig (`bun run rig -- origin`): the apex's app on `localhost` and the
// old role's build on `v5.localhost`, the same deployment behind both. One virtual authenticator:
// the passkey made on the apex restores the same account on the versioned origin, which creates
// nothing and mines nothing — it is there to move what is left.
import { expect, test } from './fixtures.ts';
import { BOOT_MS, bootPage, pageUrl, run, shot } from './helpers.ts';

// On a failure, the page's own log lines: what the session saw that the screen did not say.
test.afterEach(async ({ page }, info) => {
  if (info.status === 'passed') return;
  const lines = await page.evaluate(() => window.yacana?.log().slice(-40) ?? []).catch(() => [] as string[]);
  for (const l of lines) console.log(`[page log] ${l}`);
});

test('the versioned origin: the same passkey restores the apex’s account there, creates nothing, and mines nothing', async ({
  page,
}) => {
  const r = run();
  const old = process.env.RIG_OLD_BASE_URL;
  if (!old) throw new Error('origin.e2e.ts runs on the rig only: bun run rig -- origin');
  // The apex: a passkey account, its address.
  await bootPage(page, pageUrl(r));
  const account = (await page.getByTestId('account').getAttribute('title')) ?? '';
  expect(account).toMatch(/^0x/);
  await expect(page.getByTestId('start')).toBeEnabled();
  await expect(page.getByTestId('retired')).toHaveCount(0);

  // The versioned origin, same authenticator (the RP ID is the apex's): restore only, and the same account.
  await page.goto(pageUrl({ ...r, baseURL: old }));
  await expect(page.getByTestId('cockpit')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('retired')).toBeVisible();
  await expect(page.getByTestId('retired')).toContainText('Send what’s still here ahead.');
  await expect(page.getByTestId('start')).toHaveCount(0);
  // The old origin's header: Send ahead and the apex's Stats, no Wallet, no mining status.
  await expect(page.getByRole('link', { name: 'Send ahead' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Wallet' })).toHaveCount(0);
  await expect(page.getByTestId('phase')).toHaveCount(0);
  // No account on this origin, so no dialog on arrival; the tile's button opens it on Log in.
  const screen = page.getByTestId('key-screen');
  await expect(screen).toBeHidden();
  await shot(page, 'old-app-signed-out');
  await page.getByTestId('sign-in-mine').click();
  await expect(screen).toBeVisible();
  await expect(page.getByTestId('start-create')).toHaveCount(0);
  await expect(page.getByTestId('create-passkey')).toHaveCount(0);
  await expect(page.getByTestId('host-note')).toContainText('restored here, not created');
  await shot(page, 'old-app-sign-in');
  await page.getByTestId('restore-passkey').click();
  await expect(page.getByTestId('key-error').or(page.getByTestId('account'))).toBeVisible({
    timeout: BOOT_MS,
  });
  await expect(page.getByTestId('key-error')).toHaveCount(0);
  await expect(page.getByTestId('account')).toBeVisible();
  expect(await page.getByTestId('account').getAttribute('title')).toBe(account);
  // Signed in: the card with the way out, the live chip reading Ethereum, the rows with no forward.
  await expect(page.getByTestId('old-card')).toHaveAttribute('data-state', 'still-here');
  await expect(page.getByTestId('send-ahead')).toContainText('Send ahead to');
  // The chip is the scan of Ethereum's accepted proofs finished, whatever it found: never "checking" for good.
  await expect(page.getByTestId('proof-chip')).not.toHaveText('checking', { timeout: 60_000 });
  await expect(page.getByTestId('activity')).toBeVisible();
  await shot(page, 'old-app');
});
