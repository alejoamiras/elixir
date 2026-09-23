import { dialogOverflow, openDialog, virtualAuthenticator } from '../helpers.ts';
import { expect, type Page, test } from './fixtures.ts';

/**
 * The account dialog is 440 px wide and the page needs 900 px to be a desktop, so the window is
 * 900 × 720: what is checked is the dialog's own box — no horizontal overflow in the page or inside
 * it, its bottom inside the viewport, and the screen's primary reachable by the dialog's scroll.
 */
async function fits(page: Page, primary: string) {
  const over = await dialogOverflow(page);
  const box = await page.evaluate(() => {
    const r = (document.querySelector('[data-testid=sign-in]') as HTMLElement).getBoundingClientRect();
    return { width: Math.round(r.width), bottom: r.bottom };
  });
  expect(over.page).toBeLessThanOrEqual(0);
  expect(over.inner).toBeLessThanOrEqual(0);
  expect(box.width).toBe(440);
  expect(box.bottom).toBeLessThanOrEqual(720);
  const button = page.getByTestId(primary);
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeInViewport();
}

test('the account screens and their notes fit the dialog at 720 px tall', async ({ page, replay }) => {
  await page.setViewportSize({ width: 900, height: 720 });
  await virtualAuthenticator(page); // no credential on it: a log in with a passkey fails, honestly
  await page.goto(replay.url());
  await openDialog(page);
  await fits(page, 'start-create');

  await page.getByTestId('start-create').click();
  await fits(page, 'create-passkey');
  await page.getByTestId('back').click();
  await page.getByTestId('start-login').click();
  await fits(page, 'restore-passkey');
  await page.getByTestId('restore-passkey').click();
  await expect(page.getByTestId('key-error')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('key-error')).toContainText("Sign-in didn't complete.");
  await fits(page, 'restore-passkey');
  await page.getByTestId('restore-words').click();
  await expect(page.getByTestId('words-restore')).toBeVisible();
  await fits(page, 'words-open');

  await page.reload();
  await openDialog(page);
  await page.getByTestId('start-create').click();
  await page.getByTestId('use-words').click();
  await expect(page.getByTestId('words-backup')).toBeVisible();
  await fits(page, 'words-done');
  await page.getByTestId('written').check();
  await expect(page.getByTestId('quiz')).toBeVisible();
  await fits(page, 'words-done');
});
