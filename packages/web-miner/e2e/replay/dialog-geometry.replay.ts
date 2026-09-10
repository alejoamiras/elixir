import { BOOT_MS, virtualAuthenticator } from '../helpers.ts';
import { expect, type Page, test } from './fixtures.ts';

/**
 * The sign-in dialog is 480 px wide and the page needs 900 px to be a desktop, so the window is
 * 900 × 720: what is checked is the dialog's own box — no horizontal overflow in the page or inside
 * it, its bottom inside the viewport, and the screen's primary reachable by the dialog's scroll.
 */
async function fits(page: Page, primary: string) {
  const box = await page.evaluate(() => {
    const d = document.querySelector('[data-testid=sign-in]') as HTMLElement;
    const r = d.getBoundingClientRect();
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      inner: d.scrollWidth - d.clientWidth,
      width: Math.round(r.width),
      bottom: r.bottom,
    };
  });
  expect(box.page).toBeLessThanOrEqual(0);
  expect(box.inner).toBeLessThanOrEqual(0);
  expect(box.width).toBe(480);
  expect(box.bottom).toBeLessThanOrEqual(720);
  const button = page.getByTestId(primary);
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeInViewport();
}

test('the sign-in screens and their error state fit the dialog at 720 px tall', async ({ page, replay }) => {
  await page.setViewportSize({ width: 900, height: 720 });
  await virtualAuthenticator(page); // no credential on it: "I already have a passkey" fails, honestly
  await page.goto(replay.url());
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await fits(page, 'create-passkey');

  // The error state: the failed restore's alert on the same screen.
  await page.getByTestId('restore-passkey').click();
  await expect(page.getByTestId('key-error')).toBeVisible({ timeout: 30_000 });
  await fits(page, 'create-passkey');

  // The twelve words: the backup grid, then the quiz under it.
  await page.getByTestId('use-words').click();
  await expect(page.getByTestId('words-backup')).toBeVisible();
  await fits(page, 'words-done');
  await page.getByTestId('written').check();
  await expect(page.getByTestId('quiz')).toBeVisible();
  await fits(page, 'words-done');

  // The restore screen, with its host alert.
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await page.getByTestId('restore-words').click();
  await expect(page.getByTestId('words-restore')).toBeVisible();
  await fits(page, 'words-open');
});
