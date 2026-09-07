import { expect, test } from '@playwright/test';
import { MOCK_NODE_ORIGIN, mockNode, pageUrl, run } from './helpers.ts';

test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[console] ${m.text().slice(0, 300)}`));
});

test('the captured history through a mocked node: deterministic numbers, selection, the CSV', async ({
  page,
}) => {
  const r = run();
  await mockNode(page, r);
  await page.goto(pageUrl(r, '', { node: MOCK_NODE_ORIGIN }));
  await expect(page.getByTestId('freshness')).toContainText('block');
  // 28 claims × 4 over the fixture's eight closed epochs; epoch 8 open with 0 claims.
  await expect(page.getByTestId('minted')).toHaveText('112');
  await expect(page.getByTestId('open-claims')).toHaveText('0');
  await expect(page.getByTestId('difficulty')).toHaveText('25.2');
  await expect(page.getByTestId('network-rate')).toContainText('≈');
  await expect(page.getByTestId('strip').getByRole('option')).toHaveCount(9);
  await expect(page.getByTestId('table').locator('tbody tr')).toHaveCount(9);
  // The open epoch is selected by default; a click selects a closed one and the URL follows.
  await expect(page.getByTestId('detail')).toContainText('epoch 8');
  await page.getByTestId('strip').getByRole('option', { name: 'epoch 0' }).click();
  await expect(page).toHaveURL(/epoch=0/);
  await expect(page.getByTestId('detail')).toContainText('epoch 0');
  await expect(page.getByTestId('detail-closed-by')).toHaveText('closed by roll()');
  await expect(page.getByTestId('sentence')).toContainText('the next epoch was eased ×4.00');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/epoch=1/);
  await expect(page.getByTestId('sentence')).toContainText('4 claims in');
  const durationChart = page.getByTestId('chart-duration');
  await expect(durationChart.locator('g.claims rect, g.roll rect')).toHaveCount(8);
  // Every chart carries the selection (epoch 1 is closed): one halo shape each.
  await expect(page.locator('g.halo rect, g.halo circle')).toHaveCount(4);
  // Epoch 0's 26 136 s is a true bar on a log axis whose ticks reach 10 000 s, painted with the
  // theme's warn colour: the variables reach the marks.
  await expect(durationChart.locator('g.roll rect')).toHaveAttribute(
    'aria-label',
    'epoch 0: 26136 s, closed by roll()',
  );
  await expect(durationChart.locator('[aria-label="y-axis tick label"]')).toContainText('10000 s');
  expect(
    await durationChart.locator('g.roll rect').evaluate((el) => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--warn)';
      document.body.append(probe);
      const warn = getComputedStyle(probe).color;
      probe.remove();
      return getComputedStyle(el).fill === warn;
    }),
  ).toBe(true);
  // Hovering the difficulty line shows the epoch under the pointer.
  const difficultyChart = page.getByTestId('chart-difficulty');
  const box = (await difficultyChart.boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(difficultyChart.locator('[aria-label="tip"]')).toContainText('difficulty');
  // The A1 frame at 1280 (the default viewport) and 1440: 1080 wide, six equal tracks, the strip
  // beside the detail.
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const grid = page.getByTestId('stats');
    expect(await grid.evaluate((el) => el.getBoundingClientRect().width)).toBe(1080);
    const tracks = await grid.evaluate((el) =>
      getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat),
    );
    expect(tracks).toHaveLength(6);
    expect(Math.max(...tracks) - Math.min(...tracks)).toBeLessThanOrEqual(0.5);
    expect(
      await grid.evaluate((el) => {
        const strip = (el.querySelector('[data-testid=strip]') as Element).closest(
          '[data-slot=tile]',
        ) as Element;
        const detail = el.querySelector('[data-testid=detail]') as Element;
        const [s, d] = [strip.getBoundingClientRect(), detail.getBoundingClientRect()];
        return s.right <= d.left && Math.abs(s.top - d.top) <= 1;
      }),
    ).toBe(true);
  }
  // The CSV download is the table.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-csv').click(),
  ]);
  const text = await (await download.createReadStream())
    .toArray()
    .then((c) => Buffer.concat(c).toString('utf8'));
  expect(text.split('\n')[0]).toBe('epoch,openedAt,claims,duration,retarget,closedBy,target');
  expect(text.split('\n')).toHaveLength(10);
  expect(text).toContain('0,1788626340,0,26136,4,roll,');
  await expect(page.getByTestId('not-here')).toContainText(
    'A site that shows a miner count or a leaderboard is guessing',
  );
});

test('a deep link selects an epoch; the calculator answers from the network rate', async ({ page }) => {
  const r = run();
  await mockNode(page, r);
  await page.goto(pageUrl(r, '', { node: MOCK_NODE_ORIGIN, epoch: '4' }));
  await expect(page.getByTestId('detail')).toContainText('epoch 4');
  await expect(page.getByTestId('strip').getByRole('option', { name: 'epoch 4' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByTestId('calculator').click();
  await page.getByTestId('calc-rate').fill('60');
  await expect(page.getByTestId('calc-share')).not.toHaveText('0.0%');
});

test('live on the isolated deployment: epoch 0 renders, ?epoch=0 selects it, Verify matches the run', async ({
  page,
}) => {
  const r = run();
  // The read path ships no prover: nothing of bb.js, no WASM, is fetched to render the page.
  const heavy: string[] = [];
  page.on('request', (req) => {
    if (/barretenberg|\.wasm(\?|$)/.test(req.url())) heavy.push(req.url());
  });
  await page.goto(pageUrl(r));
  await expect(page.getByTestId('freshness')).toContainText('block');
  await expect(page.getByTestId('minted')).toHaveText('0');
  await expect(page.getByTestId('open-claims')).toHaveText('0');
  await expect(page.getByTestId('strip').getByRole('option')).toHaveCount(1);
  await expect(page.getByTestId('detail')).toContainText('epoch 0');
  await expect(page.getByTestId('detail-closed-by')).toHaveText('open');
  await expect(page.getByTestId('node')).toContainText(new URL(r.nodeUrl).host);
  await page.goto(pageUrl(r, '', { epoch: '0' }));
  await expect(page.getByTestId('detail')).toContainText('epoch 0');
  await page.getByRole('link', { name: 'Verify' }).click();
  await expect(page.getByTestId('verify-miner')).toHaveText(r.miner);
  await expect(page.getByTestId('verify-token')).toHaveText(r.token);
  await expect(page.getByTestId('verify-miner-class')).toHaveText(r.minerClassId);
  await expect(page.getByTestId('verify-token-class')).toHaveText(r.tokenClassId);
  await expect(page.getByTestId('verify-vk')).toHaveText(/^0x[0-9a-f]{64}$/);
  await expect(page.getByTestId('verify-genesis-target')).toHaveText(`0x${(1n << 127n).toString(16)}`);
  await expect(page.getByTestId('reproduce')).toContainText('bun run epoch:stats');
  expect(heavy).toEqual([]);
});
