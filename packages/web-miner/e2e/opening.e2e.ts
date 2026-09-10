import { expect, test } from './fixtures.ts';
import { BOOT_MS, run, virtualAuthenticator } from './helpers.ts';

/**
 * A cancel mid-opening returns to the signed-out cockpit with the saved account, and the next open
 * reaches the account on one PXE. The ceremony (the passkey prompt) is over before Cancel enables;
 * the cancel lands during the account's own work (the long notes step).
 */
test('a cancel mid-opening returns to signed out; the account opens on the next try', async ({ page }) => {
  test.setTimeout(12 * 60_000);
  const r = run();
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  await virtualAuthenticator(page);
  await page.goto(`${r.baseURL}/`);
  await expect(page.getByTestId('cockpit')).toBeVisible({ timeout: BOOT_MS });
  // The sign-in opens over the dull cockpit; the epoch is already there, from public storage.
  await expect(page.getByTestId('epoch')).not.toBeEmpty({ timeout: BOOT_MS });
  await page.getByTestId('consent').check();
  await page.getByTestId('create-passkey').click();

  // Opening: Cancel enables once the ceremony is over, and the header pill reads "opening".
  const cancel = page.getByTestId('opening-cancel');
  await expect(cancel).toBeEnabled({ timeout: BOOT_MS });
  await expect(page.getByTestId('phase')).toHaveText(/opening/i, { timeout: 60_000 });
  await cancel.click();

  // Back to signed out with the saved account (the record was written before the wallet opened).
  await expect(page.getByTestId('open-key')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('phase')).not.toHaveText(/opening/i);

  // The next open reaches the account: one PXE, no second one from the cancelled attempt.
  await page.getByTestId('open-key').click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('phase')).toHaveText(/idle|mining/i);
});
