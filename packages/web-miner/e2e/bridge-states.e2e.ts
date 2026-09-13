// The everyday bridge through the page on a bridge-mode run (the portal on the network's anvil, the
// run's control server for what Yacana does by hand), with the injected test wallet answering from
// Node: an exit to Ethereum forwarded and minted as YACA; a deposit through the wallet picker whose
// wallet starts on the wrong chain, refuses once, is left open once (a reload recovers the crossing
// from the journal), changes account mid-flow, then lands and is claimed on the arrival card.
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { control } from './control-client.ts';
import { expect, type Page, test } from './fixtures.ts';
import { installL1Wallet, WALLET_NAME } from './helpers/l1-wallet.ts';
import { BOOT_MS, bootPage, pageUrl, run } from './helpers.ts';

/** Anvil account 4: another account the wallet can switch to. */
const OTHER_KEY: Hex = '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a';
// On a failure, the page's own bridge log lines: what the session saw that the screen did not say.
test.afterEach(async ({ page }, info) => {
  if (info.status === 'passed') return;
  const lines = await page
    .evaluate(
      () =>
        window.yacana
          ?.log()
          .filter((l) => /bridge|portal|witness/i.test(l))
          .slice(-25) ?? [],
    )
    .catch(() => [] as string[]);
  for (const l of lines) console.log(`[page log] ${l}`);
});

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-4)}`;

const openKey = async (page: Page, address: string) => {
  await expect(page.getByTestId('key-screen')).toBeVisible({ timeout: BOOT_MS });
  await page
    .locator('[data-slot=tile]', { hasText: short(address) })
    .getByTestId('open-key')
    .click();
  await page.getByRole('link', { name: 'Mine' }).click();
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
};

test('the bridge through the page: an exit forwarded and minted; a deposit through the picker on the wrong chain, refused once, left open once, its account changed, then landed and claimed', async ({
  page,
}) => {
  const r = run();
  const bridge = r.bridge;
  if (!bridge) throw new Error('not a bridge-mode run: E2E_BRIDGE=1 or E2E_SHARD=bridge');
  const ctl = control(bridge.controlUrl);
  // The wallet starts on mainnet's id: the first deposit must ask it to switch.
  const l1 = await installL1Wallet(page.context(), {
    rpcUrl: bridge.l1RpcUrl,
    privateKey: bridge.holderKey as Hex,
    chainId: 1,
  });
  await bootPage(page, pageUrl(r));
  const account = (await page.getByTestId('account').getAttribute('title')) ?? '';

  // One claim at the easy target: 4 tYACA to bridge.
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await page.getByTestId('stop').click();
  await page.getByRole('link', { name: 'Wallet' }).click();
  await expect(page.getByTestId('bridge-tile')).toContainText('exit headroom');

  // To Ethereum: 1 tYACA to the holder; the card follows it to Ethereum once the epoch is settled and forwarded.
  await page.getByTestId('to-ethereum').click();
  await page.getByTestId('exit-amount').fill('1');
  await page.getByTestId('exit-to').fill(l1.address);
  await page.getByTestId('exit-review').click();
  await expect(page.getByTestId('exit-public')).toContainText('This will be public on Ethereum.');
  await page.getByTestId('exit-send').click();
  await expect(page.getByTestId('exit-sent')).toBeVisible({ timeout: 10 * 60_000 });
  await page.getByRole('button', { name: 'Done' }).click();
  const exit = page.locator('[data-testid=crossing][data-kind="1"]');
  await expect(exit.getByTestId('crossing-word')).toHaveText('proving to Ethereum', { timeout: 60_000 });
  await expect(page.getByTestId('wallet-balance')).toHaveText('3', { timeout: 60_000 });
  await ctl.settle();
  await expect(exit.getByTestId('crossing-word')).toHaveText('ready', { timeout: 3 * 60_000 });
  await expect(exit).toContainText('Yacana forwards exits by hand');
  expect((await ctl.forward()).forwarded).toBe(1);
  await expect(exit.getByTestId('crossing-word')).toHaveText('on Ethereum', { timeout: 60_000 });

  // Deposit: the picker lists the test wallet by name; connected, the row shows the YACA the forward minted.
  await page.getByTestId('deposit').click();
  await page.getByTestId('wallet-option').filter({ hasText: WALLET_NAME }).click();
  await expect(page.getByTestId('eth-account')).toContainText(short(l1.address));
  await expect(page.getByTestId('yaca-balance')).toHaveText('1', { timeout: 30_000 });

  // Wrong chain: switched on the way; the approval refused: the sheet returns to its form with the reason.
  l1.rejectNext('transaction');
  await page.getByTestId('deposit-amount').fill('0.5');
  await page.getByTestId('deposit-go').click();
  await expect(page.getByTestId('deposit-error')).toContainText('User rejected the request.', {
    timeout: 60_000,
  });
  expect(l1.calls('wallet_switchEthereumChain')).toBe(1);
  expect(l1.calls('eth_sendTransaction')).toBe(1);

  // A prompt left open: the sheet waits on the wallet; the page must be reloaded to get past it.
  l1.holdNext('transaction');
  await page.getByTestId('deposit-go').click();
  await expect(page.getByTestId('deposit-go')).toHaveText('Waiting for your wallet · approve…');
  await expect.poll(() => l1.holdsArmed()).toBe(0);
  await page.reload();
  await openKey(page, account);
  await page.getByRole('link', { name: 'Wallet' }).click();
  const stuck = page.locator('[data-testid=arrival][data-state="proving"]');
  await expect(stuck).toHaveCount(1, { timeout: 60_000 });
  await expect(stuck).toContainText('Waiting for your Ethereum wallet');
  await stuck.getByTestId('arrival-resume').click();
  await expect(page.getByTestId('deposit-amount')).toHaveValue(/^0\.5/);
  await page.getByTestId('wallet-option').filter({ hasText: WALLET_NAME }).click();

  // An account change mid-flow: the sheet shows whoever the wallet says now.
  await l1.setAccount(OTHER_KEY);
  await expect(page.getByTestId('eth-account')).toContainText(short(privateKeyToAccount(OTHER_KEY).address));
  await l1.setAccount(bridge.holderKey as Hex);
  await expect(page.getByTestId('eth-account')).toContainText(short(l1.address));

  // The deposit goes out under the same crossing: an approval, the deposit, the Deposited event.
  await page.getByTestId('deposit-go').click();
  await expect(page.getByTestId('deposit-done')).toBeVisible({ timeout: 2 * 60_000 });
  expect(l1.calls('eth_sendTransaction')).toBe(4);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('[data-testid=arrival]')).toHaveCount(1);
  await expect(page.locator('[data-testid=arrival]')).toHaveAttribute('data-state', 'deposited', {
    timeout: 60_000,
  });

  // The Inbox serves the message a few checkpoints later; the arrival card's one tap claims it privately.
  await ctl.nudge();
  await expect(page.getByTestId('arrival-claim')).toHaveText('Claim', { timeout: 3 * 60_000 });
  await page.getByTestId('arrival-claim').click();
  await expect(page.locator('[data-testid=arrival]')).toHaveCount(0, { timeout: 10 * 60_000 });
  await expect(page.getByTestId('wallet-balance')).toHaveText('3.5', { timeout: 2 * 60_000 });
});
