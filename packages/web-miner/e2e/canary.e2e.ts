// The one place real client proving is shown to be real: on this build the PXE proves, and a claim
// whose proof no longer matches one of its bound public inputs is refused at proving — simulation
// cannot tell (the recursive verifier is a black box to the ACVM), and a proverless build would
// send it for the local network, which verifies nothing, to mint. The page's next claim, on the
// same build, epoch and account, then mints: the build proves and the network mints what proves.
import { expect, test } from './fixtures.ts';
import { bootPage, pageUrl, run } from './helpers.ts';

/** What the embedded PXE says when ClientIVC refuses the claim's proof; nothing else counts. */
const REFUSED_AT_PROVING = /Failed to verify the generated proof/;

test('a claim with a bound public input altered is refused at proving before it is sent; the next claim mints', async ({
  page,
}) => {
  const r = run();
  let sends = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && (req.postData() ?? '').includes('aztec_sendTx')) sends += 1;
  });
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
  expect(log.some((l) => l.includes('a bound public input altered'))).toBe(true);
  expect(failure).toMatch(/claim failed \(other\)/);
  expect(failure).toMatch(REFUSED_AT_PROVING);
  expect(failure).not.toMatch(
    /Circuit execution failed|assertion failed|epoch is not open|ticket above target|reverted|expired/,
  );
  expect(sends).toBe(0);
  await expect(page.getByTestId('claims')).toHaveText('0');

  await page.getByTestId('start').click();
  await expect(page.getByTestId('claims')).toHaveText('1', { timeout: 10 * 60_000 });
  await expect(page.getByTestId('balance')).toHaveText('4');
  expect(sends).toBe(1);
  await page.getByTestId('stop').click();
});
