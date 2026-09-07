import { expect, test } from '@playwright/test';
import { BOOT_MS, bootPage, pageUrl, run, virtualAuthenticator } from './helpers.ts';

const HEX64 = /0x[0-9a-f]{64}/gi;

/** Every record of the vault, as JSON, read from inside the page. */
const vault = (page: Parameters<typeof bootPage>[0]) =>
  page.evaluate(
    () =>
      new Promise<{ records: Record<string, unknown>[]; databases: string[] }>((resolve, reject) => {
        const req = indexedDB.open('yacana-keys');
        req.onerror = () => reject(req.error);
        req.onsuccess = async () => {
          const db = req.result;
          const all = db.transaction('records', 'readonly').objectStore('records').getAll();
          all.onsuccess = async () => {
            db.close();
            const databases = (await indexedDB.databases()).map((d) => d.name ?? '');
            resolve({
              records: JSON.parse(JSON.stringify(all.result)) as Record<string, unknown>[],
              databases,
            });
          };
        };
      }),
  );

test('a passkey key: create, mine, claim, reload with one touch, the balance follows the key', async ({
  page,
}) => {
  const r = run();
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  const auth = await virtualAuthenticator(page);
  await page.goto(pageUrl(r));
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('create-passkey')).toBeDisabled();
  await page.getByTestId('consent').check();
  await page.getByTestId('create-passkey').click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  const account = (await page.getByTestId('account').getAttribute('title')) ?? '';
  expect(account).toMatch(/^0x[0-9a-f]{64}$/);

  // At rest: one record with metadata only; no interim wallet database; the PXE store exists.
  const { records, databases } = await vault(page);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({
    v: 1,
    method: 'passkey',
    askEveryOpen: true,
    account: { address: account, index: 0 },
  });
  expect(records[0]?.sealed).toBeUndefined();
  expect((JSON.stringify(records[0]).match(HEX64) ?? []).filter((h) => h !== account)).toEqual([]);
  expect(databases.filter((n) => n.startsWith('yacana-wallet-'))).toEqual([]);
  expect(databases.some((n) => n.startsWith('yacana-pxe-'))).toBe(true);
  expect(
    (await auth.cdp.send('WebAuthn.getCredentials', { authenticatorId: auth.id })).credentials,
  ).toHaveLength(1);

  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await expect(page.getByTestId('balance')).toHaveText('4');
  await page.getByTestId('stop').click();

  // Second visit: Welcome back, one touch, same key, same balance.
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await expect(page.getByTestId('key-address')).toHaveText(`${account.slice(0, 8)}…${account.slice(-4)}`);
  await page.getByTestId('open-key').click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  expect(await page.getByTestId('account').getAttribute('title')).toBe(account);
  await expect(page.getByTestId('balance')).toHaveText('4');

  // Convenience mode: the sealed master opens without any authenticator; switching back drops it.
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Stay open on this device' }).click();
  await expect.poll(async () => (await vault(page)).records[0]?.sealed).toBeDefined();
  await auth.remove();
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await page.getByTestId('open-key').click();
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  expect(await page.getByTestId('account').getAttribute('title')).toBe(account);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('switch', { name: 'Stay open on this device' }).click();
  await expect.poll(async () => (await vault(page)).records[0]?.sealed).toBeUndefined();
});

test('a known key whose passkey is gone does not open; the record stays', async ({ page }) => {
  const r = run();
  const auth = await bootPage(page, pageUrl(r));
  const account = (await page.getByTestId('account').getAttribute('title')) ?? '';
  // The authenticator loses its credential (a reset device): the touch cannot produce the master.
  await auth.cdp.send('WebAuthn.clearCredentials', { authenticatorId: auth.id });
  await page.reload();
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await page.getByTestId('open-key').click();
  await expect(page.getByTestId('key-error')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('account')).toHaveCount(0);
  expect((await vault(page)).records.map((x) => (x.account as { address: string }).address)).toEqual([
    account,
  ]);
});
