import { expect, type Page, test } from '@playwright/test';
import { BOOT_MS, bootPage, pageUrl, run } from './helpers.ts';

const openKey = async (page: Page, address: string) => {
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  const short = `${address.slice(0, 8)}…${address.slice(-4)}`;
  await page.locator('[data-slot=tile]', { hasText: short }).getByTestId('open-key').click();
  // The route survives the reload; the key tile lives on Mine.
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
};

test('withdraw: private to a second key on this device, public to an address', async ({ page }) => {
  const r = run();
  // Key A (passkey) mines one claim: 4 tYACA.
  await bootPage(page, pageUrl(r));
  const a = (await page.getByTestId('account').getAttribute('title')) ?? '';
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await page.getByTestId('stop').click();

  // Key B (words, not backed up) on the same device; it names A as a sender so it can find A's notes.
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await page.getByTestId('create-new-key').click();
  await page.getByTestId('use-words').click();
  await page.getByTestId('words-skip').click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  const b = (await page.getByTestId('account').getAttribute('title')) ?? '';
  expect(b).not.toBe(a);
  await page.getByRole('link', { name: 'Wallet' }).click();
  await page.getByTestId('sender').fill(a);
  await page.getByTestId('add-sender').click();
  await expect(page.getByText('added')).toBeVisible();

  // Back on A: 1 tYACA privately to B (known recipient: no warning), 1 tYACA publicly to B.
  await page.reload();
  await openKey(page, a);
  await page.getByRole('link', { name: 'Wallet' }).click();
  await page.getByTestId('withdraw').click();
  await page.getByTestId('withdraw-to').fill(b);
  await page.getByTestId('withdraw-amount').fill('1');
  await page.getByTestId('withdraw-review').click();
  await expect(page.getByTestId('withdraw-send')).toHaveText('Send privately');
  await expect(page.getByTestId('unknown-recipient')).toHaveCount(0);
  await page.getByTestId('withdraw-send').click();
  await expect(page.getByTestId('withdraw-sent')).toBeVisible({ timeout: 10 * 60_000 });
  // The receipt links the block and the transaction on the explorer (the e2e build points at the testnet host).
  await expect(page.getByTestId('sent-block')).toHaveAttribute('href', /\/blocks\/\d+$/);
  await expect(page.getByTestId('sent-tx')).toHaveAttribute('href', /\/tx-effects\/0x[0-9a-f]{64}$/);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('wallet-balance')).toHaveText('3', { timeout: 60_000 });

  await page.getByTestId('withdraw').click();
  await page.getByTestId('withdraw-to').fill(b);
  await page.getByTestId('withdraw-amount').fill('1');
  await page.getByRole('radio', { name: /Publicly/ }).click();
  await page.getByTestId('withdraw-review').click();
  await expect(page.getByTestId('public-warning')).toContainText('This will be public.');
  await expect(page.getByTestId('withdraw-send')).toHaveText('Send publicly');
  await page.getByTestId('withdraw-send').click();
  await expect(page.getByTestId('withdraw-sent')).toBeVisible({ timeout: 10 * 60_000 });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('wallet-balance')).toHaveText('2', { timeout: 60_000 });
  // The public balance is read by the page itself (the token's public storage, through the node).
  const publicB = await page.evaluate((owner) => window.yacana?.session.publicBalance(owner).then(String), b);
  expect(publicB).toBe(String(10n ** 18n));

  // B sees the private transfer once its key is open again.
  await page.reload();
  await openKey(page, b);
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByTestId('wallet-balance')).toHaveText('1', { timeout: 3 * 60_000 });
});
