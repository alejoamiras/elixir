import { expect, test } from './fixtures.ts';
import {
  BOOT_MS,
  dialogOverflow,
  dialogOverflowWithRight,
  logOpening,
  pageUrl,
  run,
  virtualAuthenticator,
} from './helpers.ts';

/**
 * The page first: a new visitor gets the live cockpit and no dialog; Start mining opens it with the
 * intent. A cancel mid-opening returns to the signed-out cockpit with the account staged and the
 * intent forgotten; the next open reaches the account on one PXE and stays idle. Then the intent
 * kept: a Start mining that opens the stored account starts mining by itself, once.
 */
test('page first; a cancel mid-opening forgets the intent, a Start mining that opens the account spends it', async ({
  page,
}) => {
  test.setTimeout(12 * 60_000);
  // The impossible target: the intent's mining must not win (a claim would take Stop away).
  const r = run();
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  await virtualAuthenticator(page);
  await page.goto(pageUrl(r, { miner: r.hardMiner, token: r.hardToken }));
  await expect(page.getByTestId('cockpit')).toBeVisible({ timeout: BOOT_MS });
  // No dialog on arrival: the epoch is already there, from public storage, at full contrast.
  await expect(page.getByTestId('epoch')).not.toBeEmpty({ timeout: BOOT_MS });
  await expect(page.getByTestId('key-screen')).toHaveCount(0);
  expect(await page.getByTestId('cockpit').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await expect(page.getByTestId('sign-in-mine')).toHaveText('Start mining');
  await page.getByTestId('sign-in-mine').click();
  await expect(page.getByTestId('key-screen')).toBeVisible();
  await page.getByTestId('start-create').click();
  await page.getByTestId('consent').check();
  await page.getByTestId('create-passkey').click();

  // Opening: the checklist names the ceremony done, the footer carries the intent; Cancel enables once
  // the ceremony is over, and the header pill reads "opening".
  const cancel = page.getByTestId('opening-cancel');
  await expect(cancel).toBeEnabled({ timeout: BOOT_MS });
  await expect(page.getByTestId('opening')).toContainText('Passkey confirmed');
  await expect(page.getByTestId('opening')).toContainText('Mining starts when this finishes.');
  await expect(page.getByTestId('phase')).toHaveText(/opening/i, { timeout: 60_000 });
  // The checklist inside the 440 px dialog, at the narrowest desktop: no sideways scroll, in it or the page.
  const desktop = page.viewportSize();
  await page.setViewportSize({ width: 900, height: 720 });
  const over = await dialogOverflow(page);
  expect(over.page).toBeLessThanOrEqual(0);
  expect(over.inner).toBeLessThanOrEqual(0);
  // A reason far longer than any the page writes wraps in its cell instead of widening the dialog.
  const long = 'the node stopped answering '.repeat(5).trim();
  await expect(page.locator('[data-state=active] [data-slot=step-right]')).toBeVisible({ timeout: 60_000 });
  expect(await dialogOverflowWithRight(page, long)).toBeLessThanOrEqual(0);
  if (desktop) await page.setViewportSize(desktop);
  await cancel.click();

  // Back to signed out with the account staged before the wallet opened: Welcome offers it, not a new create.
  await expect(page.getByTestId('open-key')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('start-create')).toHaveCount(0);
  await expect(page.getByTestId('phase')).not.toHaveText(/opening/i);

  // The next open reaches the account: one PXE, no second one from the cancelled attempt; the cancel
  // forgot the intent, so nothing mines.
  await page.getByTestId('open-key').click();
  await expect(page.getByTestId('opening')).toContainText('You can start mining when this finishes.');
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('phase')).toHaveText('idle');
  await logOpening(page);

  // A device with an account: Welcome on arrival. Dismissed, Start mining reopens it with the intent,
  // and the opened account mines by itself; a stop is then a stop.
  await page.reload();
  await expect(page.getByTestId('open-key')).toBeVisible({ timeout: BOOT_MS });
  await page.getByTestId('not-now').click();
  await expect(page.getByTestId('key-screen')).toHaveCount(0);
  await page.getByTestId('sign-in-mine').click();
  await page.getByTestId('open-key').click();
  await expect(page.getByTestId('phase')).toHaveText('mining', { timeout: BOOT_MS });
  await logOpening(page);
  await page.getByTestId('stop').click();
  await expect(page.getByTestId('phase')).toHaveText('idle');
});
