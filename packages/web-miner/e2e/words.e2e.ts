import { expect, type Page, test } from './fixtures.ts';
import { BOOT_MS, holdThrough, openDialog, pageUrl, run } from './helpers.ts';

/** The twelve words as shown, read once from the grid before it is hidden. */
const readWords = async (page: Page): Promise<string[]> =>
  (await page.getByTestId('words-grid').locator('li').allTextContents()).map((t) =>
    t.replace(/^\d+/, '').trim(),
  );

const quiz = async (page: Page, words: string[]) => {
  await page.getByTestId('quiz-3').fill(words[2] as string);
  await page.getByTestId('quiz-7').fill(words[6] as string);
  await page.getByTestId('quiz-11').fill(words[10] as string);
};

test('a words account: create, quiz, mine, sign out, restore, same address', async ({ page }) => {
  const r = run();
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  // The impossible target: this spec needs proofs, never a claim (a win would take the Stop button away).
  await page.goto(pageUrl(r, { miner: r.hardMiner, token: r.hardToken }));
  await openDialog(page);
  await page.getByTestId('start-create').click();
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

  // Backed up: the account tile shows no nudge. Sign out is a hold: releasing early does nothing but
  // reveal the click path; holding through the fill and releasing signs out.
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByText('backed up')).toBeVisible();
  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('sign-out-dialog')).toContainText(
    'Your 12 words log you back in. Your balance stays with the account.',
  );
  await expect(page.getByTestId('sign-out-click')).toHaveCount(0);
  const hold = page.getByTestId('sign-out-hold');
  const box = (await hold.boundingBox()) as { x: number; y: number; width: number; height: number };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.getByTestId('sign-out-dialog')).toBeVisible();
  await expect(page.getByTestId('sign-out-click')).toBeVisible();
  await holdThrough(page, 'sign-out-hold');
  // The session ends with a reload onto a device that holds no account: the cockpit, the Start screen on the click.
  await openDialog(page);
  await expect(page.getByTestId('start-create')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mine with an account.' })).toBeVisible();

  // Log in with the words: the hostname line, paste allowed, the same address.
  await page.getByTestId('start-login').click();
  await page.getByTestId('restore-words').click();
  await expect(page.getByTestId('host-banner')).toContainText('localhost');
  await page.getByTestId('words-input').fill(words.join(' '));
  await expect(page.getByTestId('words-under')).toHaveText('12 of 12');
  await page.getByTestId('words-open').click();
  // Nothing was claimed, so the balance is empty: after a typed login the tile says what that can mean.
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByTestId('wallet-balance')).toHaveText('0', { timeout: BOOT_MS });
  await expect(page.getByTestId('empty-hint')).toContainText(
    'A mistyped word opens a different, empty account',
  );
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  expect(await page.getByTestId('account').getAttribute('title')).toBe(account);

  // One account per browser: a second one is not offered while this one is stored. "Use a different
  // account" on Welcome goes through Sign out; then a words account with the backup skipped.
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('start-create')).toHaveCount(0);
  await page.getByTestId('use-other').click();
  await expect(page.getByTestId('sign-out-dialog')).toBeVisible();
  await holdThrough(page, 'sign-out-hold');
  await expect(page.getByTestId('start-create')).toBeVisible();
  await page.getByTestId('start-create').click();
  await page.getByTestId('use-words').click();
  const second = await readWords(page);
  await page.getByTestId('words-skip').click();
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  const skipped = (await page.getByTestId('account').getAttribute('title')) ?? '';
  expect(skipped).not.toBe(account);

  // Not backed up: sign-out is refused until the words are confirmed; the account tile nudges; after a
  // reopen the same words can still be written down (the entropy is sealed on the device).
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('key-address')).toHaveAttribute('title', skipped);
  await page.getByTestId('open-key').click();
  await page.getByRole('link', { name: 'Wallet' }).click();
  await page.getByTestId('sign-out').click();
  await expect(page.getByTestId('sign-out-dialog')).toContainText('they are not backed up yet');
  await expect(page.getByTestId('sign-out-hold')).toHaveCount(0);
  await page.getByTestId('back-up-first').click();
  expect(await readWords(page)).toEqual(second);
  await page.getByTestId('written').check();
  await quiz(page, second);
  await page.getByTestId('words-done').click();
  // The backup started from the dialog returns to it, now eligible. A click no hold produced (voice
  // control, switch access) reveals the click path, which signs out too; the device then holds no
  // account (the first was replaced when this one opened), so the reload lands on Start.
  await expect(page.getByTestId('sign-out-dialog')).toBeVisible();
  await expect(page.getByTestId('sign-out-hold')).toBeVisible();
  await page.getByTestId('sign-out-hold').dispatchEvent('click');
  await page.getByTestId('sign-out-click').click();
  await expect(page.getByRole('heading', { name: 'Mine with an account.' })).toBeVisible({
    timeout: BOOT_MS,
  });
});
