// The whole migration through the page, on the upgrade rig (`bun run rig -- browser`), one stage per
// run of this file: on V5 a words account mines, exits, deposits, sends ahead twice and saves its
// recovery file; on V5 after the flip the migration card says mining has ended; on V6 the same words
// restore the account, the recovery file brings the held send-aheads, one is forwarded from the page
// with the holder's signature and claimed, the other redeemed to Ethereum. Real proving throughout;
// the rig does between stages what Yacana does by hand (settle, forward, flip, retire, redeploy).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Hex } from 'viem';
import { control } from './control-client.ts';
import { expect, type Page, test } from './fixtures.ts';
import { connectTestWallet, installL1Wallet } from './helpers/l1-wallet.ts';
import { BOOT_MS, pageUrl, run, shot } from './helpers.ts';

// On a failure, the page's own bridge log lines: what the session saw that the screen did not say.
test.afterEach(async ({ page }, info) => {
  if (info.status === 'passed') return;
  const lines = await page.evaluate(() => window.yacana?.log().slice(-40) ?? []).catch(() => [] as string[]);
  for (const l of lines) console.log(`[page log] ${l}`);
});

interface Handoff {
  words: string[];
  account: string;
  recovery: string;
}

const stage = process.env.RIG_STAGE ?? '';
const handoffDir = process.env.RIG_HANDOFF ?? '';
const handoffFile = () => join(handoffDir, 'handoff.json');
const readHandoff = (): Handoff => JSON.parse(readFileSync(handoffFile(), 'utf8')) as Handoff;

const readWords = async (page: Page): Promise<string[]> =>
  (await page.getByTestId('words-grid').locator('li').allTextContents()).map((t) =>
    t.replace(/^\d+/, '').trim(),
  );

/** The sign-in dialog, opened from the cockpit when it is not already showing. */
async function keyScreen(page: Page): Promise<void> {
  await expect(page.getByTestId('cockpit')).toBeVisible({ timeout: BOOT_MS });
  const screen = page.getByTestId('key-screen');
  if (!(await screen.isVisible())) await page.getByTestId('sign-in-balance').click();
  await expect(screen).toBeVisible({ timeout: 10_000 });
}

async function createWordsAccount(page: Page): Promise<{ words: string[]; account: string }> {
  await keyScreen(page);
  await page.getByTestId('start-create').click();
  await page.getByTestId('use-words').click();
  const words = await readWords(page);
  await page.getByTestId('written').check();
  await page.getByTestId('quiz-3').fill(words[2] as string);
  await page.getByTestId('quiz-7').fill(words[6] as string);
  await page.getByTestId('quiz-11').fill(words[10] as string);
  await page.getByTestId('words-done').click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  return { words, account: (await page.getByTestId('account').getAttribute('title')) ?? '' };
}

async function restoreWords(page: Page, words: string[]): Promise<string> {
  await keyScreen(page);
  await page.getByTestId('start-login').click();
  await page.getByTestId('restore-words').click();
  await page.getByTestId('words-input').fill(words.join(' '));
  await page.getByTestId('words-open').click();
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  return (await page.getByTestId('account').getAttribute('title')) ?? '';
}

const rigRun = () => {
  const r = run();
  if (!r.bridge) throw new Error('bridge.e2e.ts runs on the rig only: bun run rig -- browser');
  return { r, bridge: r.bridge, ctl: control(r.bridge.controlUrl) };
};

const rows = (page: Page, kind: 1 | 2) => page.locator(`[data-testid=crossing][data-kind="${kind}"]`);

test('on V5: a words account mines one claim, exits to Ethereum (forwarded and minted), deposits through the picker and claims, and sends ahead twice', async ({
  page,
}) => {
  test.skip(stage !== 'v5', 'the rig runs this stage first');
  const { r, bridge, ctl } = rigRun();
  const l1 = await installL1Wallet(page.context(), {
    rpcUrl: bridge.l1RpcUrl,
    privateKey: bridge.holderKey as Hex,
    chainId: Number(bridge.chainId),
  });
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  await page.goto(pageUrl(r));
  const { words, account } = await createWordsAccount(page);

  // One claim: 4 tYACA.
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 15 * 60_000 });
  await page.getByTestId('stop').click();
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByTestId('nothing-crossing')).toBeVisible();
  await shot(page, 'wallet');

  // Bridge 1 to the holder: settled, the holder claims it on Ethereum from the card with the test wallet.
  await page.getByTestId('to-ethereum').click();
  await page.getByTestId('exit-amount').fill('1');
  await page.getByTestId('exit-to').fill(l1.address);
  await shot(page, 'to-ethereum');
  await page.getByTestId('exit-review').click();
  await expect(page.getByTestId('exit-public')).toBeVisible();
  await shot(page, 'to-ethereum-review');
  await page.getByTestId('exit-send').click();
  await expect(page.getByTestId('exit-sent')).toBeVisible({ timeout: 10 * 60_000 });
  await shot(page, 'to-ethereum-sent');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('wallet-balance')).toHaveText('3', { timeout: 60_000 });
  await shot(page, 'wallet-crossing');
  await ctl.settle();
  await expect(rows(page, 1).getByTestId('crossing-word')).toHaveText('ready to claim', {
    timeout: 3 * 60_000,
  });
  await shot(page, 'journal-ready');
  await rows(page, 1).getByTestId('claim-ethereum').click();
  await connectTestWallet(page);
  await expect(page.getByTestId('forward-go')).toBeVisible();
  await shot(page, 'claim-sheet');
  await page.getByTestId('forward-go').click();
  await expect(page.getByTestId('forward-done')).toBeVisible({ timeout: 2 * 60_000 });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(rows(page, 1).getByTestId('crossing-word')).toHaveText('claimed', { timeout: 60_000 });
  await shot(page, 'journal-claimed');

  // Deposit 0.5 back through the picker; the arrival card claims it.
  await page.getByTestId('deposit').click();
  // The wallet that claimed is still connected: the sheet opens on its row, not on the picker.
  await connectTestWallet(page);
  await shot(page, 'from-ethereum');
  await expect(page.getByTestId('yaca-balance')).toHaveText('1', { timeout: 30_000 });
  await page.getByTestId('deposit-amount').fill('0.5');
  await expect(page.getByTestId('deposit-preflip')).toBeVisible();
  await shot(page, 'from-ethereum-preflip');
  await page.getByTestId('deposit-go').click();
  await expect(page.getByTestId('deposit-done')).toBeVisible({ timeout: 2 * 60_000 });
  await shot(page, 'from-ethereum-sent');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('[data-testid=arrival]')).toHaveCount(1);
  await shot(page, 'arrival-on-its-way');
  await ctl.nudge();
  await expect(page.getByTestId('arrival-claim')).toHaveText('Claim', { timeout: 3 * 60_000 });
  await shot(page, 'arrival-claimable');
  await page.getByTestId('arrival-claim').click();
  // Landed, the row stays on the card as minted, with nothing left to press.
  await expect(page.locator('[data-testid=arrival][data-state=minted-l2]')).toHaveCount(1, {
    timeout: 10 * 60_000,
  });
  await expect(page.getByTestId('arrival-claim')).toHaveCount(0);
  await expect(page.getByTestId('wallet-balance')).toHaveText('3.5', { timeout: 2 * 60_000 });
  await shot(page, 'arrival-landed');

  // Two send-aheads of 1 from the migration card's sheet (the card shows on an announced migration).
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('migration-card')).toHaveAttribute('data-moment', 'announced');
  await shot(page, 'mine-announced');
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('send-ahead').click();
    await page.getByTestId('ahead-amount').fill('1');
    if (i === 0) await shot(page, 'commit-sheet');
    await page.getByTestId('ahead-review').click();
    await expect(page.getByTestId('ahead-privacy')).toContainText('The amount is public on Ethereum.');
    if (i === 0) await shot(page, 'commit-review');
    await page.getByTestId('ahead-send').click();
    await expect(page.getByTestId('ahead-sent')).toBeVisible({ timeout: 10 * 60_000 });
    if (i === 0) await shot(page, 'committed-sheet');
    await page.getByRole('button', { name: 'Done' }).click();
  }
  await expect(page.getByTestId('sent-ahead-status')).toContainText('2 tYACA sent ahead · 2 still crossing');
  await shot(page, 'mine-committed');
  // Settled, both are held on Ethereum: their witnesses are in the journal, and in the recovery file.
  await ctl.settle();
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(rows(page, 2).getByTestId('crossing-word')).toHaveText(
    ['held on Ethereum', 'held on Ethereum'],
    {
      timeout: 3 * 60_000,
    },
  );
  await expect(rows(page, 2).first()).toContainText('you can too, or redeem it on Ethereum');
  await shot(page, 'wallet-held');
  mkdirSync(handoffDir, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('recovery-save').click(),
  ]);
  const recovery = join(handoffDir, 'recovery.json');
  await download.saveAs(recovery);
  expect(existsSync(recovery)).toBe(true);
  writeFileSync(handoffFile(), JSON.stringify({ words, account, recovery } satisfies Handoff));
});

test('on V5 after the flip: the migration card says mining has ended and what is left can still be sent ahead', async ({
  page,
}) => {
  test.skip(stage !== 'v5-flipped', 'the rig runs this stage after the flip');
  const { r } = rigRun();
  const { words, account, recovery } = readHandoff();
  await page.goto(pageUrl(r));
  expect(await restoreWords(page, words)).toBe(account);
  const card = page.getByTestId('migration-card');
  await expect(card).toHaveAttribute('data-moment', 'flipped', { timeout: 2 * 60_000 });
  // The rig's rollup version is whatever the network minted: the copy names it, the spec does not assume it.
  await expect(page.getByTestId('flipped-alert')).toContainText(/Mining has ended on V\d+\./);
  await expect(card).toContainText(/Anything still on V\d+ when it goes quiet is lost\./);
  await expect(page.getByTestId('send-ahead')).toBeEnabled();
  await shot(page, 'mine-flipped');
  // A fresh browser knows nothing of what was sent: the recovery file brings the journal, and the card its sum.
  await expect(page.getByTestId('sent-ahead-status')).toHaveCount(0);
  await page.getByRole('link', { name: 'Wallet' }).click();
  // The landing scan already found the deposit in the Inbox, and the nullifier tree says it was claimed:
  // no arrival card offers it again, and the file restores only the three the chain cannot name.
  await expect(page.getByTestId('arrival-claim')).toHaveCount(0);
  await page.getByTestId('recovery-input').setInputFiles(recovery);
  await expect(page.getByTestId('recovery-note')).toContainText('3 crossings restored');
  await shot(page, 'wallet-flipped');
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('sent-ahead-status')).toContainText('2 tYACA sent ahead');
  await shot(page, 'mine-flipped-restored');
});

test('on V6: the same words restore the account, the recovery file brings the held send-aheads, one is forwarded from the page with the holder’s signature and claimed, the other redeemed to Ethereum', async ({
  page,
}) => {
  test.skip(stage !== 'v6', 'the rig runs this stage on the new version');
  const { r, bridge, ctl } = rigRun();
  const { words, account, recovery } = readHandoff();
  const l1 = await installL1Wallet(page.context(), {
    rpcUrl: bridge.l1RpcUrl,
    privateKey: bridge.holderKey as Hex,
    chainId: Number(bridge.chainId),
  });
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  await page.goto(pageUrl(r));
  expect(await restoreWords(page, words)).toBe(account);
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByTestId('bridge-tile')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('migration-card')).toHaveCount(0);

  // A new device knows nothing: the recovery file brings both send-aheads, still held on Ethereum.
  await page.getByTestId('recovery-input').setInputFiles(recovery);
  // Every crossing of the account: the exit, the deposit and both send-aheads, the latter still held.
  await expect(page.getByTestId('recovery-note')).toContainText('4 crossings restored');
  await expect(rows(page, 2)).toHaveCount(2);
  await expect(rows(page, 2).getByTestId('crossing-word')).toHaveText(
    ['held on Ethereum', 'held on Ethereum'],
    {
      timeout: 2 * 60_000,
    },
  );

  await shot(page, 'v6-wallet-held');

  // The first, forwarded into V6 by the holder: the redeem key signs, the wallet pays; then claimed here.
  await rows(page, 2).first().getByTestId('forward-myself').click();
  await connectTestWallet(page);
  await expect(page.getByTestId('forward-go')).toBeVisible();
  await shot(page, 'forward-sheet');
  await page.getByTestId('forward-go').click();
  await expect(page.getByTestId('forward-done')).toBeVisible({ timeout: 2 * 60_000 });
  await shot(page, 'forward-done');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('[data-testid=arrival][data-state="forwarded"]')).toHaveCount(1, {
    timeout: 60_000,
  });
  await shot(page, 'v6-arriving');
  await ctl.nudge();
  await expect(page.getByTestId('arrival-claim')).toHaveText('Claim', { timeout: 3 * 60_000 });
  await shot(page, 'v6-claimable');
  await page.getByTestId('arrival-claim').click();
  await expect(page.locator('[data-testid=arrival][data-state=minted-l2]')).toHaveCount(1, {
    timeout: 10 * 60_000,
  });
  await expect(page.getByTestId('arrival-claim')).toHaveCount(0);
  await expect(page.getByTestId('wallet-balance')).toHaveText('1', { timeout: 2 * 60_000 });
  await shot(page, 'v6-arrived');

  // The second, redeemed to Ethereum for the connected account instead.
  await rows(page, 2).filter({ hasText: 'held on Ethereum' }).getByTestId('redeem').click();
  await expect(page.getByTestId('yaca-balance')).toHaveText('0.5', { timeout: 30_000 });
  await shot(page, 'redeem-sheet');
  await page.getByTestId('redeem-go').click();
  await expect(page.getByTestId('redeem-done')).toBeVisible({ timeout: 2 * 60_000 });
  await expect(page.getByTestId('yaca-balance')).toHaveText('1.5', { timeout: 30_000 });
  await shot(page, 'redeem-done');
  await page.getByRole('button', { name: 'Done' }).click();
  // The claimed one left the tile (it is minted here); the redeemed one stays a week.
  await expect(rows(page, 2).getByTestId('crossing-word')).toHaveText(['redeemed'], { timeout: 60_000 });
  await shot(page, 'v6-wallet-redeemed');
  expect(l1.calls('eth_sendTransaction')).toBe(2);
});
