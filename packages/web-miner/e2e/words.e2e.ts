import { expect, type Page, test } from '@playwright/test';
import { BOOT_MS, pageUrl, run } from './helpers.ts';

/** The twelve words as shown, read once from the grid before it is hidden. */
const readWords = async (page: Page): Promise<string[]> =>
  (await page.getByTestId('words-grid').locator('li').allTextContents()).map((t) =>
    t.replace(/^\d+/, '').trim(),
  );

test('a words key: create, quiz, mine, forget, restore, same address', async ({ page }) => {
  const r = run();
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  // The impossible target: this spec needs proofs, never a claim (a win would take the Stop button away).
  await page.goto(pageUrl(r, { miner: r.hardMiner, token: r.hardToken }));
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await page.getByTestId('use-words').click();
  const words = await readWords(page);
  expect(words).toHaveLength(12);
  // The checkbox replaces the words with dots in the DOM; the quiz refuses paste and wrong words.
  await page.getByTestId('written').check();
  expect((await readWords(page)).every((w) => w === '••••••')).toBe(true);
  await page.getByTestId('quiz-3').fill('wrong');
  await expect(page.getByTestId('words-done')).toBeDisabled();
  await page.getByTestId('quiz-3').fill(words[2] as string);
  await page.getByTestId('quiz-7').fill(words[6] as string);
  await page.getByTestId('quiz-11').fill(`  ${(words[10] as string).toUpperCase()} `);
  await page.getByTestId('words-done').click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  const account = (await page.getByTestId('account').getAttribute('title')) ?? '';

  await page.getByTestId('start').click();
  await expect(page.getByTestId('phase')).toHaveText('mining');
  await expect(page.getByTestId('tickets')).not.toHaveText('0', { timeout: 3 * 60_000 });
  await page.getByTestId('stop').click();

  // Backed up: the wallet shows no nudge. Forget needs the last four characters.
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByText('twelve words · backed up')).toBeVisible();
  await expect(page.getByTestId('forget-key')).toBeDisabled();
  await page.getByTestId('forget-confirm').fill(account.slice(-4));
  await page.getByTestId('forget-key').click();
  // The session ends with a reload onto a device that knows no key.
  await expect(page.getByTestId('create-passkey')).toBeVisible({ timeout: BOOT_MS });

  // Restore on a device that knows no key: hostname banner, paste allowed, same address.
  await page.getByTestId('restore-words').click();
  await expect(page.getByTestId('host-banner')).toContainText('localhost');
  await page.getByTestId('words-input').fill(words.join(' '));
  await page.getByTestId('words-open').click();
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  expect(await page.getByTestId('account').getAttribute('title')).toBe(account);

  // A second words key, backup skipped: the wallet nudges, and after a reopen the same words can
  // still be written down (the entropy is sealed on the device), which clears the nudge.
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await page.getByTestId('create-new-key').click();
  await page.getByTestId('use-words').click();
  const second = await readWords(page);
  await page.getByTestId('words-skip').click();
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  const skipped = (await page.getByTestId('account').getAttribute('title')) ?? '';
  expect(skipped).not.toBe(account);
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  const short = `${skipped.slice(0, 8)}…${skipped.slice(-4)}`;
  await page.locator('[data-slot=tile]', { hasText: short }).getByTestId('open-key').click();
  await page.getByRole('link', { name: 'Wallet' }).click();
  await page.getByTestId('back-up-now').click();
  expect(await readWords(page)).toEqual(second);
  await page.getByTestId('written').check();
  await page.getByTestId('quiz-3').fill(second[2] as string);
  await page.getByTestId('quiz-7').fill(second[6] as string);
  await page.getByTestId('quiz-11').fill(second[10] as string);
  await page.getByTestId('words-done').click();
  await expect(page.getByText('twelve words · backed up')).toBeVisible();
});
