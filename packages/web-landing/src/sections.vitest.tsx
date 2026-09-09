import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { EpochRow } from '../../miner-core/src/reader.ts';
import type { ExampleClaim } from '../../site/src/config.ts';
import { App } from './App';
import { copy, SECTIONS } from './copy';
import type { Live } from './live';
import { BarChart, shown } from './sections/BarChart';
import { LedgerPublic } from './sections/Chain';
import { countdown, launchPhase } from './sections/Launch';

const recorded = JSON.parse(
  (await import('../../../deployments/testnet.example-claim.json?raw')).default,
) as ExampleClaim;

afterEach(cleanup);

let mobile = false;
beforeEach(() => {
  // jsdom has no matchMedia; the page decides mobile from it.
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: mobile && q.includes('max-width'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

const live: Live = {
  rows: [
    {
      epoch: 0,
      target: 1n << 122n,
      openedAt: 1000,
      claims: 4,
      duration: 300,
      // The target fell to a quarter at the close: the difficulty went ×4.
      retarget: 0.25,
      closedBy: 'claims',
    },
    {
      epoch: 1,
      target: 1n << 120n,
      openedAt: 1300,
      claims: 1,
      seed: 5n,
      duration: null,
      retarget: null,
      closedBy: null,
    },
  ],
  open: 1,
  supply: 16n * 10n ** 18n,
  block: { number: 10, timestamp: 1360 },
  readAt: 0,
};
const ready = { phase: 'ready' as const, live, unreachable: false };
const loading = { phase: 'loading' as const };

describe('the landing', () => {
  test('the six sections in order, each with its heading; the hero tile reads the chain', () => {
    render(<App live={ready} launch={loading} />);
    const ids = Array.from(document.querySelectorAll('main > section')).map((s) => s.id);
    expect(ids).toEqual([...SECTIONS]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(copy.hero.headline);
    for (const h of [
      copy.money.heading,
      copy.chain.heading,
      copy.how.heading,
      copy.verify.heading,
      copy.ask.heading,
    ])
      expect(screen.getByRole('heading', { name: h })).toBeTruthy();
    const tile = screen.getByTestId('hero-live');
    expect(tile.querySelectorAll('[data-slot=kpi]')).toHaveLength(4);
    expect(tile.querySelector('[data-slot=status-pill]')?.textContent).toBe(copy.hero.live);
    expect(screen.getByTestId('live-block').querySelector('a')?.getAttribute('href')).toBe(
      'https://testnet.aztecscan.xyz/blocks/10',
    );
    expect(screen.getByTestId('live-minted').textContent).toBe('16');
    expect(screen.getByText('4 claims · by browsers')).toBeTruthy();
    expect(screen.getByTestId('live-open').textContent).toBe('1');
    expect(screen.getByTestId('live-epoch').textContent).toBe('1 of 4');
    expect(screen.getByText('open 1 min · expected 5 min')).toBeTruthy();
    expect(screen.getByText(copy.hero.barSub)).toBeTruthy();
    expect(screen.getByTestId('hero-caption').textContent).toBe(copy.hero.captionShort);
    expect(screen.getByText(copy.hero.allStats).getAttribute('href')).toBe('/stats/');
    expect(screen.getByTestId('footer-line').textContent).toContain(copy.footer.line);
  });

  test('the diet: no live strip, no demo, linked Verify chips and one button, the money lede, no rules list', () => {
    render(<App live={ready} launch={loading} />);
    expect(screen.queryByTestId('live')).toBeNull();
    expect(document.querySelector('[data-testid^=demo]')).toBeNull();
    // The test record's class id and commit are stubs, not hashes: those chips stay plain text.
    expect(screen.getByTestId('verify-chips').querySelectorAll('a[href]')).toHaveLength(2);
    expect(screen.getByTestId('chip-miner').getAttribute('href')).toContain('/contracts/instances/0x0000');
    expect(screen.getByTestId('verify-source').getAttribute('href')).toBe(
      'https://github.com/alejoamiras/elixir',
    );
    expect(screen.getByTestId('money-lede').textContent).toBe(copy.money.lede);
    expect(screen.queryByTestId('money-rules')).toBeNull();
  });

  test("the money table drops the last row's rule from the tbody: the selector reaches its cells, no cell says last:", () => {
    render(<App live={ready} launch={loading} />);
    const tbody = screen.getByTestId('money-table').querySelector('tbody') as HTMLElement;
    expect(tbody.className).toContain('[&>tr:last-child>td]:border-b-0');
    const cells = tbody.querySelectorAll(':scope > tr:last-child > td');
    expect(cells).toHaveLength(copy.money.table.columns.length + 1);
    expect(tbody.querySelectorAll('[class*="last:"]')).toHaveLength(0);
    for (const td of tbody.querySelectorAll('td')) expect(td.className).toContain('border-b');
  });
});

describe('the hero tile and the ledger', () => {
  test('the bar chart: a step per epoch, a dot per accepted claim spread across it, the open epoch named', () => {
    const { container } = render(<BarChart rows={live.rows} open={1} />);
    expect(container.querySelectorAll('circle')).toHaveLength(5);
    const xs = Array.from(container.querySelectorAll('circle[data-claim="0"]')).map((c) =>
      Number(c.getAttribute('cx')),
    );
    expect(xs).toHaveLength(4);
    expect(new Set(xs).size).toBe(4);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(230);
    expect(container.textContent).toContain('epoch 1 · open · 1 of 4');
    // The y axis: powers of four from 1, at most four of them, the top one above the highest bar (256).
    const yTicks = Array.from(container.querySelectorAll('text[text-anchor="end"]'))
      .map((t) => Number(t.textContent))
      .filter((n) => Number.isFinite(n));
    expect(yTicks[0]).toBe(1);
    expect(yTicks.length).toBeLessThanOrEqual(4);
    expect(yTicks.every((n) => Number.isInteger(Math.log2(n) / 2))).toBe(true);
    expect(Math.max(...yTicks)).toBeGreaterThanOrEqual(256);
    // Only the last six epochs are drawn, whatever the history holds.
    const many: EpochRow[] = Array.from({ length: 12 }, (_, i) => ({
      ...(live.rows[0] as EpochRow),
      epoch: i,
    }));
    expect(shown(many).map((r) => r.epoch)).toEqual([6, 7, 8, 9, 10, 11]);
  });

  test('the ledger shows the recorded claim with its links; without one, dashes and no block chip', () => {
    render(<App live={ready} launch={loading} />);
    // The test setup defines no example claim: the public tile keeps its labels, the private one its dashes.
    const pub = screen.getByTestId('ledger-public');
    expect(pub.textContent).toContain(copy.chain.ledger.nullifier);
    expect(screen.queryByTestId('ledger-block')).toBeNull();
    expect(pub.querySelectorAll('a')).toHaveLength(0);
    const priv = screen.getByTestId('ledger-private');
    for (const row of copy.chain.ledger.rows) expect(priv.textContent).toContain(row);
    expect(priv.textContent).toContain(copy.chain.ledger.handshake);
    expect(priv.querySelectorAll('a')).toHaveLength(0);
    cleanup();
    render(<LedgerPublic x={recorded} />);
    expect(screen.getByTestId('ledger-block').getAttribute('href')).toBe(
      `https://testnet.aztecscan.xyz/blocks/${recorded.block}`,
    );
    for (const id of ['ledger-nullifier', 'ledger-note-hash'])
      expect(screen.getByTestId(id).getAttribute('href')).toBe(
        `https://testnet.aztecscan.xyz/tx-effects/${recorded.txHash}`,
      );
    expect(screen.getByTestId('ledger-claims').textContent).toBe(
      `${recorded.claims[0]} → ${recorded.claims[1]}`,
    );
    expect(screen.getByText(copy.chain.ledger.claims(recorded.epoch))).toBeTruthy();
    expect(screen.getByText(copy.chain.ledger.sponsor)).toBeTruthy();
  });

  test('a failed history read keeps the open epoch and says why; on a phone there is no tile, only the share button', () => {
    const partial: Live = { ...live, rows: [], historyError: 'chunk 3 did not load' };
    render(<App live={{ ...ready, live: partial }} launch={loading} />);
    expect(screen.getByTestId('live-open').textContent).toBe('1');
    expect(screen.queryByTestId('live-epoch')).toBeNull();
    expect(screen.queryByTestId('hero-chart')).toBeNull();
    expect(screen.getByTestId('live-history-error').textContent).toContain('chunk 3 did not load');
    cleanup();
    render(<App live={loading} launch={loading} />);
    expect(screen.getByTestId('live-minted').textContent).toBe('—');
    expect(screen.getAllByText(copy.hero.loading).length).toBeGreaterThan(0);
    cleanup();
    mobile = true;
    render(<App live={ready} launch={loading} />);
    expect(screen.queryByTestId('hero-live')).toBeNull();
    expect(screen.getByTestId('share')).toBeTruthy();
    mobile = false;
  });
});

describe('the launch week', () => {
  test('launch mode: the hero is the lottery with the countdown and the reveals', () => {
    vi.stubEnv('VITE_LAUNCH_MODE', '1');
    vi.useFakeTimers({ now: 1_000_000 * 1000 });
    const launch = {
      phase: 'ready' as const,
      launch: {
        genesis: { target: 1n, seed: 0n, launchAt: 1_000_000 + 3661 },
        lottery: { mix: 7n, reveals: 14 },
      },
      unreachable: false,
    };
    try {
      render(<App live={{ phase: 'unlaunched' }} launch={launch} />);
      expect(screen.getByTestId('launch')).toBeTruthy();
      expect(screen.queryByTestId('hero-live')).toBeNull();
      expect(screen.getByTestId('launch-phase').textContent).toBe('reveals begin in');
      expect(screen.getByTestId('launch-countdown').textContent).toBe('01:01:01');
      expect(screen.getByTestId('launch-reveals').textContent).toBe('14');
      expect(screen.getByTestId('launch-commit').getAttribute('href')).toContain('deployments.md');
      cleanup();
      // Epoch 0 exists: open, whatever the clock says.
      render(<App live={ready} launch={launch} />);
      expect(screen.getByTestId('launch-phase').textContent).toBe('epoch 0 is open');
      expect(screen.getByTestId('launch-countdown').textContent).toBe('epoch 1');
      expect(screen.queryByTestId('launch-unreachable')).toBeNull();
      cleanup();
      render(<App live={{ phase: 'unlaunched' }} launch={{ ...launch, unreachable: true }} />);
      expect(screen.getByTestId('launch-unreachable')).toBeTruthy();
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
    expect(countdown(90_061)).toBe('1 d 01:01:01');
    expect(countdown(-5)).toBe('00:00:00');
    expect(launchPhase(99, 100, 600, false)).toBe('commit');
    expect(launchPhase(100, 100, 600, false)).toBe('reveal');
    expect(launchPhase(699, 100, 600, false)).toBe('reveal');
    expect(launchPhase(700, 100, 600, false)).toBe('launch');
    expect(launchPhase(0, 100, 600, true)).toBe('open');
  });
});
