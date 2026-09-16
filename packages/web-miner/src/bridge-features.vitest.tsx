// The guided path and the everyday bridge as the screens show them: the migration card's three
// moments, the activity list's rows and offers, the arrival's one tap, and the dialogs under wagmi —
// each over a journal in the store and a session whose bridge is a stub.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { type ReactNode, StrictMode } from 'react';
import { anvil } from 'viem/chains';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createConfig, http, mock, WagmiProvider } from 'wagmi';
import { connect } from 'wagmi/actions';
import type { Crossing } from '../../bridge/src/journal.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { wagmiConfigFor } from './bridge/eth';
import { ActivityList, type RowActions } from './features/ActivityList';
import { ClaimDialog } from './features/dialogs/Claim';
import { FromEthereumDialog } from './features/dialogs/FromEthereum';
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

/**
 * A wallet that is connected: wagmi's mock connector on anvil's chain id, one account, no RPC behind
 * it. The provider reconnects on mount, and the mock stays connected through that only when told to.
 */
const PAYER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const;
const connected = createConfig({
  chains: [anvil],
  connectors: [mock({ accounts: [PAYER], features: { reconnect: true } })],
  transports: { [anvil.id]: http('http://127.0.0.1:9') },
});
const withConnected = (ui: ReactNode) => (
  <WagmiProvider config={connected}>
    <QueryClientProvider client={queries}>{ui}</QueryClientProvider>
  </WagmiProvider>
);
/** The bridge's record naming that chain, so the mock wallet sits on the right network. */
const onAnvil = () =>
  vi.stubEnv(
    'VITE_BRIDGE',
    JSON.stringify({
      chainId: '31337',
      portal: PORTAL,
      yaca: `0x${'ca'.repeat(20)}`,
      registry: `0x${'ee'.repeat(20)}`,
      operators: `0x${'01'.repeat(20)}`,
      l1RpcUrl: 'http://127.0.0.1:9',
    }),
  );
beforeAll(async () => {
  await connect(connected, { connector: connected.connectors[0] as (typeof connected.connectors)[number] });
});

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
  vi.useRealTimers();
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

/** The upgrade card's fixtures: an announced V1 two days out, the card, three send-aheads (one undone). */
const announce = () =>
  vi.stubEnv(
    'VITE_MIGRATION',
    JSON.stringify({
      toIndex: '1',
      announcedAt: '1800000000',
      expectedFlipAt: String(NOW / 1000 + 2 * 86_400),
    }),
  );
const card = (onSendAhead = () => {}, onHow = () => {}) => (
  <MigrationCard onSendAhead={onSendAhead} onHow={onHow} />
);
const sends = [
  crossing({ id: 'a', kind: 2, state: 'held', amount: (4n * ONE).toString() }),
  crossing({ id: 'b', kind: 2, state: 'sent', amount: (2n * ONE).toString() }),
  crossing({ id: 'c', kind: 2, state: 'dropped', amount: (9n * ONE).toString() }),
];

describe('the migration card', () => {
  test('quiet: nothing; announced: the fact and the day, the button with the balance, How it works', () => {
    expect(moment(null, false)).toBe('quiet');
    const { container } = render(<Provider store={createStore()}>{card()}</Provider>);
    expect(container.innerHTML).toBe('');
    cleanup();
    announce();
    const onSendAhead = vi.fn();
    const onHow = vi.fn();
    mount(card(onSendAhead, onHow), (s) => s.set(balanceAtom, 3n * ONE));
    const el = screen.getByTestId('migration-card');
    expect(el.dataset.moment).toBe('announced');
    expect(el.textContent).toContain('Aztec upgrades to V1 around Jan 17.');
    expect(el.textContent).toContain('then stops without notice; send ahead before it does.');
    expect(el.textContent).not.toMatch(/safe|lost/);
    fireEvent.click(screen.getByTestId('send-ahead'));
    expect(onSendAhead).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('send-ahead').textContent).toBe(`Send 3 ${PARAMS.TOKEN_SYMBOL} ahead`);
    fireEvent.click(screen.getByTestId('send-ahead-how'));
    expect(onHow).toHaveBeenCalledTimes(1);
  });

  test('sent: the sum as the title, the stations at the least advanced send, what was mined since', () => {
    announce();
    mount(card(), (s) => {
      s.set(balanceAtom, ONE);
      s.set(journalAtom, sends);
    });
    const el = screen.getByTestId('migration-card');
    expect(el.dataset.moment).toBe('announced');
    expect(screen.getByTestId('sent-ahead-status').textContent).toBe(`6 ${PARAMS.TOKEN_SYMBOL} sent ahead.`);
    const stations = Array.from(el.querySelectorAll('[data-slot=trail] [data-state]'));
    expect(stations.map((e) => (e as HTMLElement).dataset.state)).toEqual([
      'done',
      'on',
      'todo',
      'todo',
      'todo',
    ]);
    expect(el.textContent).toContain(`1 ${PARAMS.TOKEN_SYMBOL} mined since`);
    expect(screen.getByTestId('send-ahead').textContent).toBe(`Send 1 ${PARAMS.TOKEN_SYMBOL} ahead`);
  });

  test('flipped: mining has ended here; the chip says what Ethereum last accepted, and stopped only from the record', () => {
    const flipped = (proof: BridgeView['proof']) => (s: ReturnType<typeof createStore>) => {
      s.set(bridgeAtom, {
        verdict: { kind: 'flipped', by: ['registry'] },
        standing,
        readAt: NOW,
        rpcFailing: false,
        proof,
      });
      s.set(balanceAtom, ONE);
      s.set(journalAtom, sends);
    };
    const chip = () => screen.getByTestId('proof-chip');
    mount(card(), flipped('unknown'));
    expect(screen.getByTestId('migration-card').dataset.moment).toBe('flipped');
    expect(screen.getByTestId('flipped-alert').textContent).toBe(
      'Mining has ended on V5. Send what’s left ahead.',
    );
    expect(chip().textContent).toBe('checking');
    expect(screen.getByTestId('sent-ahead-status').textContent).toBe(
      // A held send is still crossing: it lands only once forwarded and claimed.
      `6 ${PARAMS.TOKEN_SYMBOL} sent ahead · 2 still crossing`,
    );
    cleanup();
    mount(card(), flipped({ at: BigInt(NOW / 1000 - 12 * 60), checkpoint: 9n, block: 1n }));
    expect(chip().textContent).toBe('V5 proved an epoch 12 min ago');
    expect(chip().dataset.tone).toBe('ok');
    cleanup();
    mount(card(), flipped({ at: BigInt(NOW / 1000 - 3 * 3600), checkpoint: 9n, block: 1n }));
    expect(chip().textContent).toBe('no proof from V5 for 3.0 h');
    expect(chip().dataset.tone).toBe('warn');
    cleanup();
    // The record's stop outranks a fresh proof: "stopped" never comes from an age, and an age never from a stop.
    vi.stubEnv('VITE_LIFECYCLE', JSON.stringify({ stoppedProvingAt: String(NOW / 1000 - 86_400) }));
    mount(card(), flipped({ at: BigInt(NOW / 1000 - 60), checkpoint: 9n, block: 1n }));
    expect(chip().textContent).toBe('V5 stopped proving · Jan 14');
    expect(chip().dataset.tone).toBe('bad');
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

  test('from Ethereum: a paused bridge holds the form with the same reason as the Wallet button', () => {
    onAnvil();
    const { session } = stubSession();
    mount(withConnected(<FromEthereumDialog session={session} open onOpenChange={() => {}} />), (store) =>
      store.set(bridgeAtom, {
        verdict: { kind: 'before' },
        standing: { ...standing, paused: true, pausedUntil: 1_800_500_000n },
        readAt: NOW,
        rpcFailing: false,
      }),
    );
    expect(screen.getByTestId('eth-account').textContent).toContain(shortAddress(PAYER));
    expect(screen.getByTestId('deposit-off').textContent).toContain('The bridge is paused until');
    fireEvent.change(screen.getByTestId('deposit-amount'), { target: { value: '1' } });
    expect((screen.getByTestId('deposit-go') as HTMLButtonElement).disabled).toBe(true);
  });

  test('from Ethereum: a dialog taken down while the gas is priced never deposits; one that stays locks at once', async () => {
    onAnvil();
    let price: ((f: { balance: bigint; cost: bigint; enough: boolean }) => void) | undefined;
    const payerFunds = vi.fn(() => new Promise((r) => (price = r)));
    const deposit = vi.fn(() => new Promise<never>(() => {}));
    const session = { bridge: { payerFunds, deposit } } as unknown as Session;
    const dialog = () => withConnected(<FromEthereumDialog session={session} open onOpenChange={() => {}} />);
    mount(dialog());
    fireEvent.change(screen.getByTestId('deposit-amount'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('deposit-go'));
    await waitFor(() => expect(payerFunds).toHaveBeenCalledTimes(1));
    // The Wallet unmounts the dialog on close rather than rendering it closed.
    cleanup();
    await act(async () => price?.({ balance: 1n, cost: 0n, enough: true }));
    expect(deposit).not.toHaveBeenCalled();
    // Kept open, the same answer locks the dialog before the flow has said anything.
    mount(dialog());
    fireEvent.change(screen.getByTestId('deposit-amount'), { target: { value: '1' } });
    fireEvent.click(screen.getByTestId('deposit-go'));
    await waitFor(() => expect(payerFunds).toHaveBeenCalledTimes(2));
    await act(async () => price?.({ balance: 1n, cost: 0n, enough: true }));
    await waitFor(() => expect(deposit).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('deposit-waiting')).toBeDefined();
    expect(screen.queryByLabelText('Close')).toBeNull();
  });
});

/** A proven exit ready for its claim, and the session the claim dialog needs. */
const exit = () => crossing({ state: 'ready', witness: undefined, epoch: '3' });
const claimSession = (payerFunds: ReturnType<typeof vi.fn>, selfForward: ReturnType<typeof vi.fn>) =>
  ({ bridge: { payerFunds, selfForward, redeem: vi.fn() } }) as unknown as Session;
const enough = (yes: boolean) => ({ balance: 1n, cost: yes ? 0n : 2n, enough: yes });

describe('the claim dialog', () => {
  test('no ETH holds the button and is read again until a top-up; the wallet asked locks the dialog; done retitles it', async () => {
    onAnvil();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The wallet stays empty until the test tops it up: the clock runs, and a slow run must not let a
    // re-read flip the state before the first one is seen.
    let topped = false;
    const payerFunds = vi.fn(async () => enough(topped));
    let release: (() => void) | undefined;
    const selfForward = vi.fn(() => new Promise<void>((r) => (release = r)));
    mount(
      withConnected(
        <ClaimDialog
          session={claimSession(payerFunds, selfForward)}
          crossing={exit()}
          action="forward"
          onOpenChange={() => {}}
        />,
      ),
    );
    await waitFor(() => expect(screen.getByTestId('payer-no-eth')).toBeDefined());
    expect(screen.getByTestId('payer-no-eth').textContent).toContain('has no anvil ETH for the gas');
    expect((screen.getByTestId('forward-go') as HTMLButtonElement).disabled).toBe(true);
    // Five seconds later the balance is read again: the top-up re-arms the button.
    topped = true;
    await act(() => vi.advanceTimersByTimeAsync(5_100));
    await waitFor(() => expect(screen.queryByTestId('payer-no-eth')).toBeNull());
    expect((screen.getByTestId('forward-go') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('forward-go'));
    await waitFor(() => expect(screen.getByTestId('claim-progress')).toBeDefined());
    expect(screen.getByTestId('claim-progress').textContent).toContain('Confirm in Mock Connector');
    // Locked while the wallet is asked: no close, no disconnect.
    expect(screen.queryByLabelText('Close')).toBeNull();
    expect(screen.queryByTestId('eth-disconnect')).toBeNull();
    expect(selfForward).toHaveBeenCalledTimes(1);
    act(() => release?.());
    await waitFor(() => expect(screen.getByTestId('forward-done')).toBeDefined());
    expect(screen.getByTestId('forward-dialog').textContent).toContain('Claimed.');
  });

  test('the wallet saying no is a red step with Try again, and nothing is claimed — under Strict Mode too', async () => {
    onAnvil();
    const payerFunds = vi.fn().mockResolvedValue(enough(true));
    const selfForward = vi.fn(() =>
      Promise.reject(
        Object.assign(new Error('User rejected the request.'), { name: 'UserRejectedRequestError' }),
      ),
    );
    mount(
      <StrictMode>
        {withConnected(
          <ClaimDialog
            session={claimSession(payerFunds, selfForward)}
            crossing={exit()}
            action="forward"
            onOpenChange={() => {}}
          />,
        )}
      </StrictMode>,
    );
    await waitFor(() => expect((screen.getByTestId('forward-go') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('forward-go'));
    await waitFor(() => expect(screen.getByText('Try again')).toBeDefined());
    expect(selfForward).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('claim-progress').textContent).toContain('Mock Connector rejected it');
    expect(screen.getByTestId('claim-progress').textContent).toContain('Nothing was claimed');
    expect(screen.queryByLabelText('Close')).not.toBeNull();
  });
});

describe('the claim dialog, crossing to crossing', () => {
  test('what one claim reached never titles the next', async () => {
    onAnvil();
    const payerFunds = vi.fn().mockResolvedValue(enough(true));
    const selfForward = vi.fn(() => Promise.resolve());
    const dialog = (crossing: Crossing) =>
      withConnected(
        <ClaimDialog
          session={claimSession(payerFunds, selfForward)}
          crossing={crossing}
          action="forward"
          onOpenChange={() => {}}
        />,
      );
    const store = createStore();
    store.set(nowAtom, NOW);
    store.set(bridgeAtom, { verdict: { kind: 'before' }, standing, readAt: NOW, rpcFailing: false });
    const { rerender } = render(<Provider store={store}>{dialog(exit())}</Provider>);
    await waitFor(() => expect((screen.getByTestId('forward-go') as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId('forward-go'));
    await waitFor(() => expect(screen.getByTestId('forward-dialog').textContent).toContain('Claimed.'));
    rerender(
      <Provider store={store}>{dialog(crossing({ id: 'another', index: 1, state: 'ready' }))}</Provider>,
    );
    expect(screen.getByTestId('forward-dialog').textContent).toContain('Claim 2 YACA on Ethereum.');
    expect(screen.queryByTestId('forward-done')).toBeNull();
  });
});
