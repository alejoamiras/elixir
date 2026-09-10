// The one place real client proving is shown to be real: on this build the PXE proves, and a claim
// whose proof no longer matches one of its bound public inputs is refused at proving — simulation
// cannot tell (the recursive verifier is a black box to the ACVM), and a proverless build would
// send it for the local network, which verifies nothing, to mint. The same ticket then mints
// untampered, so nothing but the tamper explains the refusal.
import { expect, test } from './fixtures.ts';
import { bootPage, pageUrl, run } from './helpers.ts';

test('a claim with a bound public input altered fails at proving; the same ticket untampered mints', async ({
  page,
}) => {
  const r = run();
  await bootPage(page, pageUrl(r));
  expect(await page.evaluate(() => window.yacana?.proverless)).toBe(false);
  await page.evaluate(() => window.yacana?.tamperNextClaim());
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claim-slot')).toHaveAttribute('data-state', 'notice', {
    timeout: 10 * 60_000,
  });
  const log = await page.evaluate(() => window.yacana?.log() ?? []);
  const failure = log.find((l) => l.includes('claim failed'));
  console.log(`[canary] ${failure}`);
  // Refused by the prover, not by the epoch, the target or the node: the kind is `other`, the
  // message the prover's, and nothing was minted.
  expect(failure).toMatch(/claim failed \(other\)/);
  expect(failure).toMatch(/prov|verif|ClientIVC|circuit/i);
  expect(failure).not.toMatch(/epoch is not open|ticket above target|reverted|expired/);
  expect(log.some((l) => l.includes('a bound public input altered'))).toBe(true);
  await expect(page.getByTestId('claims')).toHaveText('0');

  // The positive control: mining again at the easy target, the next (untampered) claim mints.
  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await expect(page.getByTestId('balance')).toHaveText('4');
  await page.getByTestId('stop').click();
});
