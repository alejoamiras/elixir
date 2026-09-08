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
  await expect(page.getByTestId('freshness-block')).toHaveAttribute('href', /\/blocks\/\d+$/);
  await expect(page).toHaveTitle('Yacana · Stats');
  // 112 claims × 4 over the fixture's 31 epochs; epoch 30 open with 1 claim at difficulty 1.
  await expect(page.getByTestId('minted')).toHaveText('448');
  await expect(page.getByTestId('open-claims')).toHaveText('1');
  await expect(page.getByTestId('difficulty')).toHaveText('1.0');
  await expect(page.getByTestId('network-rate')).toContainText('≈');
  await expect(page.getByTestId('epoch-ring')).toBeAttached();
  await expect(page.getByTestId('since-opened')).toHaveText('+0');
  await expect(page.locator('main')).toHaveAttribute('data-settled', '1');
  await expect(page.getByTestId('strip').getByRole('option')).toHaveCount(31);
  const rows = page.getByTestId('table').locator('tbody tr');
  await expect(rows).toHaveCount(31);
  await expect(page.getByTestId('table-count')).toHaveText('31 of 31');
  // The table scrolls inside the tile under a header that stays; the escape hatch is named as such.
  const scroll = page.getByTestId('table-scroll');
  const head = page.getByTestId('table').locator('thead');
  const headY = (await head.boundingBox())?.y;
  expect(await scroll.evaluate((el) => el.scrollHeight > el.clientHeight && el.clientHeight <= 460)).toBe(
    true,
  );
  await scroll.evaluate((el) => el.scrollTo(0, 300));
  expect(await scroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect((await head.boundingBox())?.y).toBeCloseTo(headY as number, 0);
  await expect(rows.filter({ hasText: 'the escape hatch' })).toHaveCount(3);
  await expect(page.getByTestId('table')).not.toContainText('roll()');
  await scroll.evaluate((el) => el.scrollTo(0, 0));
  // The lead chart alone on its row at 200 px, the three small multiples at 110.
  expect(
    await page
      .getByTestId('stats')
      .evaluate((el) =>
        Array.from(el.querySelectorAll('[data-slot=chart]')).map((c) => (c as HTMLElement).offsetHeight),
      ),
  ).toEqual([200, 110, 110, 110]);
  // The open epoch is selected by default; a click selects a closed one and the URL follows.
  await expect(page.getByTestId('detail')).toContainText('epoch 30');
  await expect(page.getByTestId('detail-open-for')).toHaveText(/^\d+:\d\d$/);
  await page.getByTestId('strip').getByRole('option', { name: 'epoch 0' }).click();
  await expect(page).toHaveURL(/epoch=0/);
  await expect(page.getByTestId('detail')).toContainText('epoch 0');
  await expect(page.getByTestId('detail-closed-by')).toHaveText('closed by the escape hatch');
  await expect(page.getByTestId('sentence')).toContainText('through the escape hatch');
  await expect(page.getByTestId('sentence')).toContainText('the next epoch was eased ×4.00');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/epoch=1/);
  await expect(page.getByTestId('sentence')).toContainText('4 claims in');
  const durationChart = page.getByTestId('chart-duration');
  await expect(durationChart.locator('g.claims rect, g.roll rect')).toHaveCount(30);
  // Every chart carries the selection (epoch 1 is closed): one halo shape in each.
  for (const chart of ['chart-emission', 'chart-difficulty', 'chart-duration', 'chart-retarget'])
    await expect(page.getByTestId(chart).locator('g.halo rect, g.halo circle')).toHaveCount(1);
  // Epoch 0's 26 136 s is a true bar: its top sits above the 20-minute rule of the log axis (a cap
  // at T_MAX would leave it on the rule), painted with the theme's warn colour, so the variables
  // reach the marks.
  await expect(durationChart.locator('g.roll rect').first()).toHaveAttribute(
    'aria-label',
    'epoch 0: 26136 s, closed by the escape hatch',
  );
  expect(
    await durationChart.evaluate((el) => {
      const bar = el.querySelector('g.roll rect') as SVGRectElement;
      const rules = Array.from(el.querySelectorAll('g.rule line'));
      const hatch = Math.min(...rules.map((r) => r.getBoundingClientRect().top));
      const probe = document.createElement('i');
      probe.style.color = 'var(--warn)';
      document.body.append(probe);
      const warn = getComputedStyle(probe).color;
      probe.remove();
      return {
        rules: rules.length,
        above: bar.getBoundingClientRect().top < hatch - 4,
        warn: getComputedStyle(bar).fill === warn,
      };
    }),
  ).toEqual({ rules: 2, above: true, warn: true });
  // Hovering a known point of the difficulty line names its epoch in the tip.
  const difficultyChart = page.getByTestId('chart-difficulty');
  const dot = (await difficultyChart.locator('g.point circle[aria-label^="epoch 4:"]').boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
  await expect(difficultyChart.locator('[aria-label="tip"]')).toContainText('epoch 4');
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
    // Every chart is drawn at its container's width, never at the unmeasured fallback.
    await expect
      .poll(() =>
        grid.evaluate((el) =>
          Array.from(el.querySelectorAll('[data-slot=chart]')).map((c) => {
            const svg = c.querySelector('svg');
            return svg
              ? Math.round(svg.getBoundingClientRect().width - c.getBoundingClientRect().width)
              : null;
          }),
        ),
      )
      .toEqual([0, 0, 0, 0]);
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
  expect(text.split('\n')).toHaveLength(32);
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
  // The Verify chips link the explorer's pages for this deployment.
  await expect(page.getByTestId('chip-miner')).toHaveAttribute(
    'href',
    new RegExp(`/contracts/instances/${r.miner}$`),
  );
  await expect(page.getByTestId('chip-class')).toHaveAttribute(
    'href',
    new RegExp(`/contracts/classes/${r.minerClassId}/versions/1$`),
  );
  await page.getByRole('link', { name: 'Verify' }).click();
  await expect(page).toHaveTitle('Yacana · Verify');
  await expect(page.getByTestId('verify-miner')).toHaveText(r.miner);
  await expect(page.getByTestId('verify-token')).toHaveText(r.token);
  await expect(page.getByTestId('verify-miner-class')).toHaveText(r.minerClassId);
  await expect(page.getByTestId('verify-token-class')).toHaveText(r.tokenClassId);
  await expect(page.getByTestId('verify-vk')).toHaveText(/^0x[0-9a-f]{64}$/);
  await expect(page.getByTestId('verify-genesis-target')).toHaveText(`0x${(1n << 127n).toString(16)}`);
  await expect(page.getByTestId('reproduce')).toContainText('bun run epoch:stats');
  expect(heavy).toEqual([]);
});
