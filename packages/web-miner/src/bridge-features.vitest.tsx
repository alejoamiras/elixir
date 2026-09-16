// The guided path and the everyday bridge as the screens show them: the migration card's three
// moments, the activity list's rows and offers, the arrival's one tap, the two sheets' reviews and
// the taking-long dialog — each over a journal in the store and a session whose bridge is a stub.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { WagmiProvider } from 'wagmi';
import type { Crossing } from '../../bridge/src/journal.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { wagmiConfigFor } from './bridge/eth';
import { ActivityList, type RowActions } from './features/ActivityList';
import { SendAheadDialog } from './features/dialogs/SendAhead';
import { ToEthereumDialog } from './features/dialogs/ToEthereum';
import { MigrationCard, moment } from './features/MigrationCard';
import { shortAddress } from './lib/format';
import { BalanceTile } from './routes/Wallet';
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

const actions = (): RowActions => ({
  claimL1: vi.fn(),
  forward: vi.fn(),
  redeem: vi.fn(),
  again: vi.fn(),
  settings: vi.fn(),
});
const list = (session: Session, on: RowActions = actions()) => (
  <ActivityList session={session} account="0xabc" on={on} wins={null} />
);

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
  miner: `0x${'0a'.repeat(20)}` as const,
  registryIndex: 0n,
  paused: false,
  pausedUntil: 0n,
  headroom: 500n * ONE,
  deadline: (1n << 256n) - 1n,
  flipAt: 0n,
  afterNextAt: 0n,
  pausedSeconds: 0n,
  retireSent: false,
  depositsClosed: false,
};

/** The dialogs that ask the wallet render under wagmi; nothing is connected. */
const wagmi = wagmiConfigFor({ chainId: 31337, rpcUrl: 'http://127.0.0.1:9' });
const queries = new QueryClient();
const withWagmi = (ui: ReactNode) => (
  <WagmiProvider config={wagmi}>
    <QueryClientProvider client={queries}>{ui}</QueryClientProvider>
  </WagmiProvider>
);

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

describe('the activity list', () => {
  test('one row per crossing, deposits included; a proven withdrawal offers its claim, a held send-ahead the redeem, and the forward only on the version it lands on', () => {
    const { session } = stubSession();
    const on = actions();
    const ready = crossing({ id: 'r', state: 'ready', txHash: `0x${'11'.repeat(32)}` });
    const held = crossing({ id: 'h', kind: 2, state: 'held', createdAt: NOW - 120_000 });
    mount(list(session, on), (s) =>
      s.set(journalAtom, [
        held,
        ready,
        crossing({ id: 'd', kind: 3, state: 'deposited', createdAt: NOW - 180_000 }),
      ]),
    );
    // Newest first, whichever way it crosses.
    expect(screen.getAllByTestId('crossing')).toHaveLength(3);
    expect(screen.getAllByTestId('crossing-word').map((w) => w.textContent)).toEqual([
      'ready to claim',
      'held for the next version',
      'crossing to Aztec',
    ]);
    // The count under the header is the rows waiting for the user: the same reading the badge takes.
    expect(screen.getByTestId('activity').textContent).toContain('1 waiting for you');
    // Each row carries its stations: a proven withdrawal waits for its holder's claim.
    const stations = [
      ...(screen.getAllByTestId('crossing')[0] as HTMLElement).querySelectorAll(
        '[data-slot="trail"] [data-state]',
      ),
    ];
    expect(stations.map((s) => s.textContent)).toEqual([
      '✓ sent',
      'a block',
      '✓ reached Ethereum',
      'claim on Ethereum',
    ]);
    expect(stations.map((s) => s.getAttribute('data-state'))).toEqual(['done', 'todo', 'done', 'on']);
    fireEvent.click(screen.getByTestId('row-claim-l1'));
    expect(on.claimL1).toHaveBeenCalledWith(ready);
    expect(screen.queryByTestId('row-forward')).toBeNull();
    fireEvent.click(screen.getByTestId('row-redeem'));
    expect(on.redeem).toHaveBeenCalledWith(held);
  });

  test('a held send-ahead is forwarded only from the version it lands on', () => {
    const { session } = stubSession();
    const on = actions();
    const held = crossing({ id: 'h', kind: 2, state: 'held' });
    const store = mount(list(session, on), (s) => s.set(journalAtom, [held]));
    expect(screen.queryByTestId('row-forward')).toBeNull();
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
    expect(screen.queryByTestId('row-forward')).toBeNull();
    vi.stubEnv('VITE_ROLLUP_VERSION', '6');
    act(() => store.set(bridgeAtom, { ...flipped, readAt: NOW + 1 }));
    fireEvent.click(screen.getByTestId('row-forward'));
    expect(on.forward).toHaveBeenCalledWith(held);
    vi.stubEnv('VITE_ROLLUP_VERSION', '5');
  });
});

describe('what arrives', () => {
  test('a claimable arrival claims on one tap; a deposit the wallet never sent is offered again; nothing crossing says so', async () => {
    const { session, bridge } = stubSession();
    const on = actions();
    const claimable = crossing({ id: 'c', kind: 3, state: 'claimable', inboxIndex: '7' });
    const dropped = crossing({ id: 'x', kind: 3, state: 'dropped', createdAt: NOW - 120_000 });
    mount(list(session, on), (s) =>
      s.set(journalAtom, [
        claimable,
        crossing({
          id: 'f',
          kind: 2,
          version: '4',
          state: 'forwarded',
          target: '5',
          createdAt: NOW - 180_000,
        }),
        dropped,
        crossing({ id: 's', kind: 3, state: 'proving', createdAt: NOW - 240_000 }),
      ]),
    );
    expect(screen.getAllByTestId('crossing-word').map((w) => w.textContent)).toEqual([
      'ready to claim',
      'not sent',
      'arriving',
      'waiting for your wallet',
    ]);
    const claim = screen.getAllByTestId('row-claim');
    expect(claim).toHaveLength(1);
    fireEvent.click(claim[0] as HTMLElement);
    await waitFor(() => expect(bridge.claim).toHaveBeenCalledWith(claimable));
    fireEvent.click(screen.getByTestId('row-again'));
    expect(on.again).toHaveBeenCalledWith(dropped);
    cleanup();
    mount(list(session));
    expect(screen.getByTestId('nothing-crossing').textContent).toContain('Nothing crossing yet.');
  });
});

describe('the balance tile', () => {
  test('a silent RPC turns both bridge buttons off and says why, with Settings one tap away', () => {
    const onSettings = vi.fn();
    // The balance tile offers the bridge only on a build that carries a portal.
    vi.stubEnv(
      'VITE_BRIDGE',
      JSON.stringify({
        chainId: '31337',
        portal: PORTAL,
        yaca: `0x${'ca'.repeat(20)}`,
        registry: `0x${'ee'.repeat(20)}`,
        operators: `0x${'01'.repeat(20)}`,
        l1RpcUrl: 'http://rpc.test',
      }),
    );
    mount(
      <BalanceTile
        balance={ONE}
        claims={1}
        onSend={() => {}}
        onToEthereum={() => {}}
        onDeposit={() => {}}
        onSettings={onSettings}
      />,
      (s) => s.set(bridgeAtom, { verdict: { kind: 'unknown' }, standing, readAt: NOW, rpcFailing: true }),
    );
    expect((screen.getByTestId('to-ethereum') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('deposit') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('withdraw') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('money-reason').textContent).toContain("The Ethereum RPC isn't answering");
    fireEvent.click(screen.getByTestId('money-settings'));
    expect(onSettings).toHaveBeenCalled();
  });

  test('a pause stops deposits and only warns on the rest; closed deposits say where to go instead', () => {
    vi.stubEnv(
      'VITE_BRIDGE',
      JSON.stringify({
        chainId: '31337',
        portal: PORTAL,
        yaca: PORTAL,
        registry: PORTAL,
        operators: PORTAL,
        l1RpcUrl: 'http://rpc.test',
      }),
    );
    const tile = (
      <BalanceTile
        balance={ONE}
        claims={1}
        onSend={() => {}}
        onToEthereum={() => {}}
        onDeposit={() => {}}
        onSettings={() => {}}
      />
    );
    mount(tile, (s) =>
      s.set(bridgeAtom, {
        verdict: { kind: 'before' },
        standing: { ...standing, paused: true, pausedUntil: BigInt(Math.floor(NOW / 1000) + 86_400 * 4) },
        readAt: NOW,
        rpcFailing: false,
      }),
    );
    expect((screen.getByTestId('deposit') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('to-ethereum') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('money-reason').textContent).toMatch(
      /^The bridge is paused until \w{3} \d+: deposits wait/,
    );
    cleanup();
    mount(tile, (s) =>
      s.set(bridgeAtom, {
        verdict: { kind: 'before' },
        standing: { ...standing, depositsClosed: true },
        readAt: NOW,
        rpcFailing: false,
      }),
    );
    expect((screen.getByTestId('deposit') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('money-reason').textContent).toContain('closed for good');
  });
});

describe('the balance tile after a typed login', () => {
  test('an empty balance carries the mistyped-word hint; a funded one does not; a stored open never does', () => {
    const tile = (balance: bigint, typedWords?: boolean) => (
      <BalanceTile
        balance={balance}
        claims={0}
        typedWords={typedWords}
        onSend={() => {}}
        onToEthereum={() => {}}
        onDeposit={() => {}}
        onSettings={() => {}}
      />
    );
    mount(tile(0n, true));
    expect(screen.getByTestId('empty-hint').textContent).toContain(
      'A mistyped word opens a different, empty account',
    );
    cleanup();
    mount(tile(ONE, true));
    expect(screen.queryByTestId('empty-hint')).toBeNull();
    cleanup();
    mount(tile(0n));
    expect(screen.queryByTestId('empty-hint')).toBeNull();
  });
});

describe('the dialogs', () => {
  test('to Ethereum: a bad address is refused under its field; a pasted one carries its warning; the send goes through the bridge', async () => {
    const { session, bridge } = stubSession();
    mount(withWagmi(<ToEthereumDialog session={session} balance={5n * ONE} open onOpenChange={() => {}} />));
    fireEvent.change(screen.getByTestId('exit-amount'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('exit-to'), { target: { value: '0x1234' } });
    fireEvent.click(screen.getByTestId('exit-send'));
    expect(screen.getByTestId('to-refusal').textContent).toBe(
      'Not an Ethereum address: 42 characters, starting with 0x.',
    );
    fireEvent.change(screen.getByTestId('exit-to'), { target: { value: RECIPIENT } });
    expect(screen.getByTestId('exit-pasted').textContent).toContain("A bridge can't be recalled");
    const dialog = screen.getByTestId('to-ethereum-dialog');
    expect(dialog.textContent).toContain(`the amount and ${shortAddress(RECIPIENT)}; not this account`);
    expect(screen.getByTestId('exit-send').textContent).toBe(`Bridge 2 ${PARAMS.TOKEN_SYMBOL}`);
    fireEvent.click(screen.getByTestId('exit-send'));
    await waitFor(() => expect(screen.getByTestId('exit-sent')).toBeDefined());
    expect(bridge.exitToL1).toHaveBeenCalledWith(2n * ONE, RECIPIENT);
  });

  test('send ahead: the whole balance by default, more than it refused under the field, the rows say where it waits and lands', async () => {
    const { session, bridge } = stubSession();
    mount(<SendAheadDialog session={session} balance={3n * ONE} open onOpenChange={() => {}} />);
    const input = screen.getByTestId('ahead-amount') as HTMLInputElement;
    expect(Number(input.value)).toBe(3);
    fireEvent.change(input, { target: { value: '4' } });
    expect(screen.getByTestId('amount-refusal').textContent).toBe('More than your balance.');
    expect((screen.getByTestId('ahead-send') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: '1.5' } });
    const dialog = screen.getByTestId('send-ahead-dialog');
    expect(dialog.textContent).toContain('held on Ethereum; Yacana forwards it into');
    expect(dialog.textContent).toContain('you claim it, one tap');
    expect(dialog.textContent).not.toMatch(/arrives by itself|relayer/i);
    fireEvent.click(screen.getByTestId('ahead-send'));
    await waitFor(() => expect(screen.getByTestId('ahead-sent')).toBeDefined());
    expect(bridge.sendAhead).toHaveBeenCalledWith(15n * 10n ** BigInt(PARAMS.DECIMALS - 1));
  });
});
