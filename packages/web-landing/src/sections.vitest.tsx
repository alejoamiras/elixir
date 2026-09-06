import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { App } from './App';
import { copy, SECTIONS } from './copy';
import type { Live } from './live';
import { countdown } from './sections/Launch';

afterEach(cleanup);

let mobile = false;
beforeEach(() => {
  // jsdom has no matchMedia; the page decides mobile from it.
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: mobile && q.includes('max-width'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal('navigator', { ...navigator, hardwareConcurrency: 8 });
});

const live: Live = {
  rows: [
    {
      epoch: 0,
      target: 1n << 122n,
      openedAt: 1000,
      claims: 4,
      duration: 300,
      retarget: 1,
      closedBy: 'claims',
    },
    {
      epoch: 1,
      target: 1n << 122n,
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

describe('the landing', () => {
  test('the seven sections in order, each with its heading; the demo and the live strip on the chain', () => {
    render(
      <App live={{ phase: 'ready', live, unreachable: false }} launch={{ phase: 'loading' }} miner="0x01" />,
    );
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
    expect(screen.getByTestId('live-epoch').textContent).toBe('1 of 4');
    expect(screen.getByTestId('live-minted').textContent).toBe('16');
    expect(screen.getByTestId('demo-caption').textContent).toContain('epoch 1');
    expect((screen.getByTestId('prove') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('footer-line').textContent).toContain(copy.footer.line);
  });

  test('without the chain the demo waits; on a phone there is no demo, only the share button', () => {
    render(<App live={{ phase: 'loading' }} launch={{ phase: 'loading' }} miner="0x01" />);
    expect((screen.getByTestId('prove') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(copy.demo.needsChain)).toBeTruthy();
    cleanup();
    mobile = true;
    render(
      <App live={{ phase: 'ready', live, unreachable: false }} launch={{ phase: 'loading' }} miner="0x01" />,
    );
    expect(screen.queryByTestId('demo')).toBeNull();
    expect(screen.queryByTestId('hero-prove')).toBeNull();
    expect(screen.getByTestId('share')).toBeTruthy();
    mobile = false;
  });

  test('launch mode: the hero is the lottery with the countdown and the reveals', () => {
    vi.stubEnv('VITE_LAUNCH_MODE', '1');
    vi.useFakeTimers({ now: 1_000_000 * 1000 });
    try {
      render(
        <App
          live={{ phase: 'ready', live, unreachable: false }}
          launch={{
            phase: 'ready',
            launch: {
              genesis: { target: 1n, seed: 0n, launchAt: 1_000_000 + 3661 },
              lottery: { mix: 7n, reveals: 14 },
            },
          }}
          miner="0x01"
        />,
      );
      expect(screen.getByTestId('launch')).toBeTruthy();
      expect(screen.queryByTestId('demo')).toBeNull();
      expect(screen.getByTestId('launch-countdown').textContent).toBe('01:01:01');
      expect(screen.getByTestId('launch-reveals').textContent).toBe('14');
      expect(screen.getByTestId('launch-commit').getAttribute('href')).toContain('deployments.md');
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
    expect(countdown(90_061)).toBe('1 d 01:01:01');
    expect(countdown(-5)).toBe('00:00:00');
  });
});
