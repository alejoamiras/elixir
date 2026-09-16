import { cleanup, render } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ClaimSlot, slotState } from './features/ClaimSlot';
import { initial, type MinerState } from './lib/reducer';
import { pillStatus } from './lib/status';
import { Mine } from './routes/Mine';
import { bootAtom, epochAtom, minerAtom, nowAtom, rulesAtom } from './state';

afterEach(cleanup);
// jsdom has no matchMedia; the score loop's reduced-motion hook reads it.
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);

// The M1 frame's placement, as classes: the computed grid is asserted in the browser (miner.e2e.ts).
describe('the cockpit grid', () => {
  test('loop and ledger over three columns, the rail two rows, the KPIs a row of three tiles', () => {
    const { container } = render(<Mine controller={() => undefined} />);
    const cockpit = container.querySelector('[data-testid=cockpit]') as HTMLElement;
    expect(cockpit.className).toContain('xl:grid-cols-[1fr_1fr_1fr_300px]');
    expect(cockpit.className).toContain('gap-[14px]');
    expect(cockpit.className).toContain('items-start');
    const tiles = Array.from(cockpit.children) as HTMLElement[];
    expect(tiles).toHaveLength(4);
    expect(tiles[0]?.className).toContain('xl:col-span-3');
    // The loop tile holds no claim stepper: the claim lives in the rail's slot.
    expect(tiles[0]?.querySelector('[data-testid=claim-stepper]')).toBeNull();
    expect(tiles[0]?.querySelector('[data-slot=score-loop]')?.getAttribute('data-calm')).toBe('true');
    // The rail is a column: the claim slot first, the epoch tile under it.
    expect(tiles[1]?.className).toContain('xl:row-span-2');
    expect(tiles[1]?.getAttribute('data-testid')).toBe('rail');
    expect(tiles[1]?.firstElementChild?.getAttribute('data-testid')).toBe('claim-slot');
    expect(tiles[1]?.firstElementChild?.textContent).toContain('no claim in flight');
    expect(tiles[2]?.getAttribute('data-testid')).toBe('kpi-tiles');
    expect(tiles[2]?.querySelectorAll('[data-slot=tile]')).toHaveLength(3);
    // The last cell is a stack below xl and dissolves into the grid at xl (`contents`).
    expect(tiles[3]?.className).toContain('xl:contents');
    expect(tiles[3]?.firstElementChild?.className).toContain('xl:col-span-3');
    expect(tiles[3]?.lastElementChild?.textContent).toContain('balance');
    expect(tiles[3]?.lastElementChild?.textContent).not.toContain('key');
  });

  test('renders the chain before any account: the epoch tile from the atoms alone, no session', () => {
    const store = createStore();
    const nowSec = Math.floor(Date.now() / 1000);
    store.set(epochAtom, {
      epoch: 38n,
      seed: 7n,
      target: 1n << 122n,
      openedAt: BigInt(nowSec - 120),
      claims: 3,
    });
    store.set(rulesAtom, {
      N: 4,
      EXPECTED_EPOCH_SECONDS: 300n,
      T_MAX: 1200n,
      REWARD: 4_000_000_000_000_000_000n,
    });
    store.set(nowAtom, Date.now());
    const { getByTestId, getByText } = render(
      <Provider store={store}>
        <Mine controller={() => undefined} />
      </Provider>,
    );
    expect(getByTestId('epoch').textContent).toBe('38');
    expect(getByTestId('epoch-claims').textContent).toContain('3 of 4');
    // Signed out: the loop's header names the tile, the balance tile says what fills it, the KPIs what starts it.
    expect(getByText('your proofs')).toBeInTheDocument();
    expect(getByText('Your balance shows once you log in.')).toBeInTheDocument();
    expect(getByText('starts with mining')).toBeInTheDocument();
    expect(getByText('the bar is 64.0 · about 64 proofs per win')).toBeInTheDocument();
    expect(getByText('anyone can close it')).toBeInTheDocument();
    expect(getByText('next bar if it closed now')).toBeInTheDocument();
  });
});

const MINTED = {
  block: 73_162,
  txHash: `0x${'0c'.repeat(32)}`,
  nullifier: '0xn',
  noteHash: '0xh',
  noteHashes: 1,
  claims: [1, 2] as [number, number],
  at: 100_000,
};

const withMiner = (patch: Partial<MinerState>, now: number) => {
  const store = createStore();
  store.set(minerAtom, { ...initial, ...patch });
  store.set(nowAtom, now);
  return render(
    <Provider store={store}>
      <ClaimSlot />
    </Provider>,
  );
};

// The slot's four states by precedence, and the ten-second freshness the pill shares (no fake timers: `now` is passed).
describe('the claim slot', () => {
  test('idle is a dashed placeholder; a claim in flight shows the stepper; a fresh mint its ✓ with the block linked', () => {
    expect(withMiner({}, 0).getByTestId('claim-slot').textContent).toContain('no claim in flight');
    cleanup();
    const claim = {
      step: 'sent' as const,
      wonAt: 37_600,
      since: 50_000,
      done: [12_400],
      lineId: 1,
      txHash: '0xab',
    };
    const inFlight = withMiner({ phase: 'claiming', claim }, 60_000);
    expect(inFlight.getByTestId('claim-slot').getAttribute('data-state')).toBe('claim');
    expect(inFlight.queryByTestId('claim-stepper')).not.toBeNull();
    cleanup();
    const fresh = withMiner({ minted: MINTED }, 105_000);
    expect(fresh.getByTestId('claim-slot').getAttribute('data-state')).toBe('minted');
    expect(fresh.getByTestId('minted').textContent).toContain('block 73,162');
    expect(fresh.getByRole('link', { name: /block 73,162/ }).getAttribute('href')).toContain('/blocks/73162');
  });

  test('the ✓ fades after ten seconds, its marks sit under Details, and the pill follows the same clock', () => {
    const stale = withMiner({ minted: MINTED }, 110_001);
    expect(stale.getByTestId('claim-slot').textContent).toContain('no claim in flight');
    cleanup();
    const fresh = withMiner({ minted: MINTED }, 105_000);
    expect(fresh.getByTestId('minted-details').textContent).toContain('Details');
    expect(slotState({ ...initial, minted: MINTED }, 105_000)).toBe('minted');
    expect(slotState({ ...initial, minted: MINTED }, 110_000)).toBe('idle');
    expect(pillStatus({ ...initial, minted: MINTED }, 105_000)).toBe('minted');
    expect(pillStatus({ ...initial, minted: MINTED }, 110_000)).toBe('idle');
  });
});

describe('the start and stop buttons', () => {
  test('Stop stays on the cockpit while a claim is in flight', () => {
    const store = createStore();
    store.set(bootAtom, {
      phase: 'ready',
      account: '0xacc',
      threads: 1,
      record: {
        v: 1,
        id: 'k',
        method: 'words',
        createdAt: 0,
        askEveryOpen: false,
        backedUp: true,
        account: { address: '0xacc', index: 0 },
      },
    });
    store.set(minerAtom, {
      ...initial,
      phase: 'claiming',
      claim: { step: 'sent', wonAt: 19_000, since: 50_000, done: [12_400], lineId: 1, txHash: '0xab' },
      ledger: [
        {
          id: 1,
          kind: 'win',
          time: '00:00:19',
          n: 12,
          score: 2.8,
          proveMs: 3610,
          claim: { step: 'sent', expiresAt: 660 },
        },
      ],
    });
    store.set(nowAtom, 60_000);
    const { getByTestId } = render(
      <Provider store={store}>
        <Mine controller={() => undefined} />
      </Provider>,
    );
    expect(getByTestId('stop').getAttribute('title')).toContain('does not resume');
    // The chip: the step and one clock from the win; the ledger's win line the same step with its countdown.
    expect(getByTestId('claim-chip').textContent).toBe('claiming · sent · 41 s');
    expect(getByTestId('ledger').textContent).toContain(
      'a win · claiming: sent to the node · drops in 10:00 if no block takes it',
    );
    cleanup();
    store.set(minerAtom, { ...store.get(minerAtom), stopping: true });
    const stopping = render(
      <Provider store={store}>
        <Mine controller={() => undefined} />
      </Provider>,
    );
    expect(stopping.getByTestId('claim-chip').textContent).toBe('stopping · claim finishing · 41 s');
    expect((stopping.getByTestId('stop') as HTMLButtonElement).disabled).toBe(true);
  });

  test('a lost race is a banner under the header, no way out but time; a paused account names its clock', () => {
    const store = createStore();
    store.set(nowAtom, 60_000);
    store.set(minerAtom, {
      ...initial,
      phase: 'recovering',
      notice: {
        kind: 'reverted',
        title: 'lost a race',
        body: 'Re-syncing this account from the chain; mining resumes in about a minute.',
      },
    });
    const { getByTestId, queryByTestId } = render(
      <Provider store={store}>
        <Mine controller={() => undefined} />
      </Provider>,
    );
    expect(getByTestId('notice-reverted').textContent).toContain('Re-syncing this account');
    expect(queryByTestId('fresh-key')).toBeNull();
    expect(getByTestId('claim-slot').textContent).toContain('no claim in flight');
    cleanup();
    store.set(minerAtom, {
      ...initial,
      notice: {
        kind: 'paused',
        title: 'claims paused',
        body: 'Mining resumes about 16:48.',
        until: 60_000 + 38 * 60_000,
      },
    });
    const paused = render(
      <Provider store={store}>
        <Mine controller={() => undefined} />
      </Provider>,
    );
    expect(paused.getByTestId('notice-paused').textContent).toContain('in 38 min');
  });
});
