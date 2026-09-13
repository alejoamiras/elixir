// The guided path and the everyday bridge as the screens show them: the migration card's three
// moments, the bridge tile's lines and offers, the arrival card's one tap, the two sheets' reviews
// and the taking-long dialog — each over a journal in the store and a session whose bridge is a stub.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Crossing } from '../../bridge/src/journal.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { TAKING_LONG_AFTER_MS } from './bridge/copy';
import { ArrivalCard } from './features/ArrivalCard';
import { BridgeTile } from './features/BridgeTile';
import { MigrationCard, moment } from './features/MigrationCard';
import { SendAheadSheet } from './features/SendAheadSheet';
import { TakingLongDialog } from './features/TakingLongDialog';
import { ToEthereumSheet } from './features/ToEthereumSheet';
import type { Session } from './session';
import { type BridgeView, balanceAtom, bridgeAtom, journalAtom, nowAtom } from './state';

const ONE = 10n ** BigInt(PARAMS.DECIMALS);
const PORTAL = `0x${'ab'.repeat(20)}` as const;
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;
const NOW = 1_800_000_000_000;

const crossing = (patch: Partial<Crossing>): Crossing => ({
  id: `31337:${PORTAL}:5:1:0`,
  kind: 1,
  chainId: '31337',
  portal: PORTAL,
  version: '5',
  index: 0,
  amount: (2n * ONE).toString(),
  state: 'proving',
  createdAt: NOW - 60_000,
  updatedAt: NOW - 60_000,
  ethAddress: RECIPIENT,
  ...patch,
});

/** A session whose bridge records every call and resolves at once. */
const stubSession = () => {
  const bridge = {
    selfForward: vi.fn(() => Promise.resolve()),
    claim: vi.fn(() => Promise.resolve()),
    exitToL1: vi.fn(() => Promise.resolve()),
    sendAhead: vi.fn(() => Promise.resolve()),
  };
  return { session: { bridge } as unknown as Session, bridge };
};

const standing = {
  registered: true,
  paused: false,
  headroom: 500n * ONE,
  deadline: (1n << 256n) - 1n,
  flipAt: 0n,
  retireSent: false,
  depositsClosed: false,
};

const mount = (ui: ReactNode, setup: (store: ReturnType<typeof createStore>) => void = () => {}) => {
  const store = createStore();
  store.set(nowAtom, NOW);
  store.set(bridgeAtom, { verdict: { kind: 'before' }, standing, readAt: NOW, rpcFailing: false });
  setup(store);
  render(<Provider store={store}>{ui}</Provider>);
  return store;
};

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.stubEnv('VITE_ROLLUP_VERSION', '5');
  vi.stubEnv('VITE_MIGRATION', '');
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

describe('the migration card', () => {
  test('quiet: nothing; announced: the send button carries the balance and the loss line stands', () => {
    expect(moment(null, false)).toBe('quiet');
    const { container } = render(
      <Provider store={createStore()}>
        <MigrationCard onSendAhead={() => {}} />
      </Provider>,
    );
    expect(container.innerHTML).toBe('');
    cleanup();
    vi.stubEnv(
      'VITE_MIGRATION',
      JSON.stringify({
        toIndex: '1',
        announcedAt: '1800000000',
        expectedFlipAt: String(NOW / 1000 + 2 * 86_400),
      }),
    );
    const onSendAhead = vi.fn();
    mount(<MigrationCard onSendAhead={onSendAhead} />, (s) => s.set(balanceAtom, 3n * ONE));
    const card = screen.getByTestId('migration-card');
    expect(card.dataset.moment).toBe('announced');
    expect(card.textContent).toContain('In about 2.0 d');
    expect(card.textContent).toContain('Anything still on V5 when it goes quiet is lost.');
    fireEvent.click(screen.getByTestId('send-ahead'));
    expect(onSendAhead).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('send-ahead').textContent).toBe(`Send 3 ${PARAMS.TOKEN_SYMBOL} ahead`);
  });

  test('flipped: mining has ended here; what was sent ahead is summed, with what was mined since', () => {
    mount(<MigrationCard onSendAhead={() => {}} />, (s) => {
      s.set(bridgeAtom, {
        verdict: { kind: 'flipped', by: ['registry'] },
        standing,
        readAt: NOW,
        rpcFailing: false,
      });
      s.set(balanceAtom, ONE);
      s.set(journalAtom, [
        crossing({ id: 'a', kind: 2, state: 'held', amount: (4n * ONE).toString() }),
        crossing({ id: 'b', kind: 2, state: 'minted-l2', amount: (2n * ONE).toString() }),
        crossing({ id: 'c', kind: 2, state: 'dropped', amount: (9n * ONE).toString() }),
      ]);
    });
    expect(screen.getByTestId('migration-card').dataset.moment).toBe('flipped');
    expect(screen.getByTestId('flipped-alert').textContent).toContain('Mining has ended on V5.');
    expect(screen.getByTestId('sent-ahead-status').textContent).toBe(
      `6 ${PARAMS.TOKEN_SYMBOL} sent ahead · 1 still crossing · 1 ${PARAMS.TOKEN_SYMBOL} mined since — send those too`,
    );
  });
});

describe('the bridge tile', () => {
  test('a ready exit offers the holder’s own forward; a held send-ahead the redeem, and the forward once a later version is registered; deposits are not its rows', () => {
    const { session } = stubSession();
    const onRedeem = vi.fn();
    const onForward = vi.fn();
    const ready = crossing({ id: 'r', state: 'ready', txHash: `0x${'11'.repeat(32)}` });
    const held = crossing({ id: 'h', kind: 2, state: 'held' });
    const tile = (
      <BridgeTile
        session={session}
        account="0xabc"
        onToEthereum={() => {}}
        onDeposit={() => {}}
        onForward={onForward}
        onRedeem={onRedeem}
      />
    );
    const store = mount(tile, (s) =>
      s.set(journalAtom, [ready, held, crossing({ id: 'd', kind: 3, state: 'deposited' })]),
    );
    expect(screen.getAllByTestId('crossing')).toHaveLength(2);
    expect(screen.getAllByTestId('crossing-word').map((w) => w.textContent)).toEqual([
      'ready',
      'held on Ethereum',
    ]);
    expect(screen.getAllByTestId('forward-myself')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('forward-myself'));
    expect(onForward).toHaveBeenCalledWith(ready);
    fireEvent.click(screen.getByTestId('redeem'));
    expect(onRedeem).toHaveBeenCalledWith(held);
    expect(screen.getByTestId('bridge-tile').textContent).toContain('exit headroom 500');
    // The Registry names V6. This V5 page still offers no forward of the held send-ahead — it lands on
    // V6, and only V6's page, whose record names the miner it must reach, lets the holder forward it.
    const flipped: BridgeView = {
      verdict: { kind: 'flipped', by: ['registry'] },
      standing,
      canonical: { version: 6n, index: 1n },
      readAt: NOW,
      rpcFailing: false,
    };
    act(() => store.set(bridgeAtom, flipped));
    expect(screen.getAllByTestId('forward-myself')).toHaveLength(1);
    vi.stubEnv('VITE_ROLLUP_VERSION', '6');
    act(() => store.set(bridgeAtom, { ...flipped, readAt: NOW + 1 }));
    expect(screen.getAllByTestId('forward-myself')).toHaveLength(2);
    vi.stubEnv('VITE_ROLLUP_VERSION', '5');
  });

  test('a silent RPC holds back new exits and says so', () => {
    const { session } = stubSession();
    mount(
      <BridgeTile
        session={session}
        account="0xabc"
        onToEthereum={() => {}}
        onDeposit={() => {}}
        onForward={() => {}}
        onRedeem={() => {}}
      />,
      (s) => s.set(bridgeAtom, { verdict: { kind: 'unknown' }, standing, readAt: NOW, rpcFailing: true }),
    );
    expect((screen.getByTestId('to-ethereum') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('bridge-tile').textContent).toContain('new exits wait');
  });
});

describe('the arrival card', () => {
  test('a claimable arrival claims on one tap; one still crossing only says so; a deposit the wallet never answered is offered again', async () => {
    const { session, bridge } = stubSession();
    const onResume = vi.fn();
    const claimable = crossing({ id: 'c', kind: 3, state: 'claimable', inboxIndex: '7' });
    const stuck = crossing({ id: 's', kind: 3, state: 'proving' });
    mount(<ArrivalCard session={session} onResume={onResume} />, (s) =>
      s.set(journalAtom, [claimable, crossing({ id: 'f', kind: 2, state: 'forwarded', target: '6' }), stuck]),
    );
    const buttons = screen.getAllByTestId('arrival-claim');
    expect(buttons.map((b) => b.textContent)).toEqual(['Claim', 'arrived']);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(buttons[0] as HTMLElement);
    await waitFor(() => expect(bridge.claim).toHaveBeenCalledWith(claimable));
    fireEvent.click(screen.getByTestId('arrival-resume'));
    expect(onResume).toHaveBeenCalledWith(stuck);
  });

  test('nothing arriving: no card', () => {
    const { session } = stubSession();
    const { container } = render(
      <Provider store={createStore()}>
        <ArrivalCard session={session} />
      </Provider>,
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('the sheets', () => {
  test('to Ethereum: a bad address is refused at review; the review says what is public; the send goes through the bridge', async () => {
    const { session, bridge } = stubSession();
    mount(<ToEthereumSheet session={session} balance={5n * ONE} open onOpenChange={() => {}} />);
    fireEvent.change(screen.getByTestId('exit-amount'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('exit-to'), { target: { value: '0x1234' } });
    fireEvent.click(screen.getByTestId('exit-review'));
    expect(screen.getByTestId('to-ethereum-error').textContent).toContain('not an Ethereum address');
    fireEvent.change(screen.getByTestId('exit-to'), { target: { value: RECIPIENT } });
    fireEvent.click(screen.getByTestId('exit-review'));
    expect(screen.getByTestId('exit-public').textContent).toContain('This will be public on Ethereum.');
    fireEvent.click(screen.getByTestId('exit-send'));
    await waitFor(() => expect(screen.getByTestId('exit-sent')).toBeDefined());
    expect(bridge.exitToL1).toHaveBeenCalledWith(2n * ONE, RECIPIENT);
  });

  test('send ahead: the whole balance by default, more than it refused, the review names where it waits and lands', async () => {
    const { session, bridge } = stubSession();
    mount(<SendAheadSheet session={session} balance={3n * ONE} open onOpenChange={() => {}} />);
    const input = screen.getByTestId('ahead-amount') as HTMLInputElement;
    expect(Number(input.value)).toBe(3);
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('ahead-review'));
    expect(screen.getByTestId('send-ahead-error').textContent).toContain('more than the balance');
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.click(screen.getByTestId('ahead-review'));
    const sheet = screen.getByTestId('send-ahead-sheet');
    expect(sheet.textContent).toContain('held for this account alone');
    expect(sheet.textContent).toContain('a tap on the arrival card');
    expect(sheet.textContent).not.toMatch(/arrives by itself|relayer/i);
    fireEvent.click(screen.getByTestId('ahead-send'));
    await waitFor(() => expect(screen.getByTestId('ahead-sent')).toBeDefined());
    expect(bridge.sendAhead).toHaveBeenCalledWith(15n * 10n ** BigInt(PARAMS.DECIMALS - 1));
  });
});

describe('taking long', () => {
  test('a held crossing older than the stated age opens the dialog once; a fresh one does not', () => {
    const onSettings = vi.fn();
    const store = mount(<TakingLongDialog onSettings={onSettings} />, (s) =>
      s.set(journalAtom, [
        crossing({ id: 'h', kind: 2, state: 'held', updatedAt: NOW - TAKING_LONG_AFTER_MS - 1 }),
      ]),
    );
    expect(screen.getByTestId('taking-long').textContent).toContain('Redeem it to Ethereum');
    expect(screen.getByTestId('taking-long').textContent).not.toMatch(/relayer|bot/i);
    fireEvent.click(screen.getByRole('button', { name: 'Understood' }));
    expect(screen.queryByTestId('taking-long')).toBeNull();
    act(() => store.set(journalAtom, [crossing({ id: 'r', state: 'ready', updatedAt: NOW - 1000 })]));
    expect(screen.queryByTestId('taking-long')).toBeNull();
  });
});
