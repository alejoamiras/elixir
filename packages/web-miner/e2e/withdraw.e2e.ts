import { expect, type Page, test } from './fixtures.ts';
import { BOOT_MS, bootPage, holdThrough, openDialog, pageUrl, run, signOut } from './helpers.ts';

/** The twelve words as shown, read once from the grid before it is hidden. */
const readWords = async (page: Page): Promise<string[]> =>
  (await page.getByTestId('words-grid').locator('li').allTextContents()).map((t) =>
    t.replace(/^\d+/, '').trim(),
  );

const opened = async (page: Page): Promise<string> => {
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  return (await page.getByTestId('account').getAttribute('title')) ?? '';
};

/** From the Start screen: log in with the passkey the device's authenticator holds. */
const logInWithPasskey = async (page: Page): Promise<string> => {
  await page.getByTestId('start-login').click();
  await page.getByTestId('restore-passkey').click();
  return opened(page);
};

/** From the Start screen: log in with a phrase. */
const logInWithWords = async (page: Page, words: string[]): Promise<string> => {
  await page.getByTestId('start-login').click();
  await page.getByTestId('restore-words').click();
  await page.getByTestId('words-input').fill(words.join(' '));
  await page.getByTestId('words-open').click();
  return opened(page);
};

test('withdraw: private to a second key on this device, public to an address', async ({ page }) => {
  const r = run();
  // Key A (passkey) mines one claim: 4 tYACA.
  await bootPage(page, pageUrl(r));
  const a = (await page.getByTestId('account').getAttribute('title')) ?? '';
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await page.getByTestId('stop').click();

  // Key B (words, not backed up) on the same device: one account per browser, so A signs out first
  // (its passkey brings it back). Nothing registers A as a sender on B: the delivery handshake of a
  // first contact is what lets B find A's notes.
  await signOut(page);
  await page.getByTestId('start-create').click();
  await page.getByTestId('use-words').click();
  const bWords = await readWords(page);
  await page.getByTestId('words-skip').click();
  const b = await opened(page);
  expect(b).not.toBe(a);
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByTestId('sender')).toHaveCount(0);

  // Back on A: B is not backed up, so its sign-out goes through the backup first; then A logs in.
  await page.getByTestId('sign-out').click();
  await page.getByTestId('back-up-first').click();
  await page.getByTestId('written').check();
  await page.getByTestId('quiz-3').fill(bWords[2] as string);
  await page.getByTestId('quiz-7').fill(bWords[6] as string);
  await page.getByTestId('quiz-11').fill(bWords[10] as string);
  await page.getByTestId('words-done').click();
  await expect(page.getByTestId('sign-out-hold')).toBeVisible();
  await holdThrough(page, 'sign-out-hold');
  await openDialog(page);
  await expect(page.getByTestId('start-login')).toBeVisible();
  expect(await logInWithPasskey(page)).toBe(a);
  await page.getByRole('link', { name: 'Wallet' }).click();
  await page.getByTestId('withdraw').click();
  await page.getByTestId('withdraw-to').fill(b);
  // Leaving the address runs the probe (B is an account the chain knows: no note); one screen, the
  // button carries the amount and the mode.
  await page.getByTestId('withdraw-amount').fill('1');
  await expect(page.getByTestId('withdraw-send')).toHaveText(/^Send 1 \S+ privately$/);
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
  await expect(page.getByTestId('public-warning')).toContainText('This will be public.');
  await expect(page.getByTestId('withdraw-send')).toHaveText(/^Send 1 \S+ publicly$/);
  await page.getByTestId('withdraw-send').click();
  await expect(page.getByTestId('withdraw-sent')).toBeVisible({ timeout: 10 * 60_000 });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('wallet-balance')).toHaveText('2', { timeout: 60_000 });
  // The public balance is read by the page itself (the token's public storage, through the node).
  const publicB = await page.evaluate((owner) => window.yacana?.session.publicBalance(owner).then(String), b);
  expect(publicB).toBe(String(10n ** 18n));

  // B sees the private transfer once its words open it again, with no sender ever registered.
  await signOut(page);
  expect(await logInWithWords(page, bWords)).toBe(b);
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByTestId('wallet-balance')).toHaveText('1', { timeout: 3 * 60_000 });
  await expect(page.getByTestId('empty-hint')).toHaveCount(0);
});
