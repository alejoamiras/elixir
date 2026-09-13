// The state lists as drawn, rendered over a made-up journal: every word a crossing can lead with,
// the arrivals in every state, the old app once something was sent and once the version is quiet,
// the taking-long dialog and the old-tab bar. With `GALLERY_DIR` set, each render's markup is
// written there to be screenshotted under the built stylesheet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Crossing } from '../../bridge/src/journal.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { TAKING_LONG_AFTER_MS } from './bridge/copy';
import { ArrivalCard } from './features/ArrivalCard';
import { BridgeTile } from './features/BridgeTile';
import { MigrationCard } from './features/MigrationCard';
import { OldApp } from './features/OldApp';
import { OldTabNotice } from './features/OldTabNotice';
import { TakingLongDialog } from './features/TakingLongDialog';
import type { MasterRecord } from './keys/store';
import type { Session } from './session';
import { balanceAtom, bootAtom, bridgeAtom, journalAtom, nowAtom } from './state';

const ONE = 10n ** BigInt(PARAMS.DECIMALS);
const PORTAL = `0x${'ab'.repeat(20)}` as const;
const HOLDER = '0x9f3A5c1E7b2D4f6A8c0E1b3D5f7A9c1E3b5D21c0' as const;
const TX = `0x${'7e'.repeat(32)}` as const;
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 8, 11, 19, 30);
const SECONDS = Math.floor(NOW / 1000);
const HOUR = 3600;

const crossing = (id: string, patch: Partial<Crossing>): Crossing => ({
  id,
  kind: 1,
  chainId: '11155111',
  portal: PORTAL,
  version: '5',
  index: 0,
  amount: (8n * ONE).toString(),
  state: 'proving',
  createdAt: NOW - 38 * MINUTE,
  updatedAt: NOW - 38 * MINUTE,
  ethAddress: HOLDER,
  ...patch,
});
const settled = {
  txHash: TX,
  block: 1_204,
  epoch: '412',
  proofDeadline: String(SECONDS + 3 * HOUR + 10 * 60),
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
const session = {
  bridge: { claim: () => Promise.resolve(), reader: { blockTime: () => Promise.resolve(BigInt(SECONDS)) } },
} as unknown as Session;
const ready: MasterRecord = {
  v: 1,
  id: 'k',
  method: 'words',
  createdAt: NOW,
  askEveryOpen: false,
  backedUp: true,
  account: { address: '0xacc', index: 0 },
};

const OUT = process.env.GALLERY_DIR;
const keep = (name: string, html: string) => {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.html`), html);
};

const mount = (ui: ReactNode, setup: (store: ReturnType<typeof createStore>) => void = () => {}) => {
  const store = createStore();
  store.set(nowAtom, NOW);
  store.set(bridgeAtom, { verdict: { kind: 'before' }, standing, readAt: NOW, rpcFailing: false });
  setup(store);
  return render(<Provider store={store}>{ui}</Provider>);
};

const words = () => screen.getAllByTestId('crossing-word').map((w) => w.textContent);

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubEnv('VITE_ROLLUP_VERSION', '5');
  vi.stubEnv('VITE_MIGRATION', '');
  vi.stubEnv('VITE_RP_ID', 'yacana.network');
  vi.stubEnv(
    'VITE_BRIDGE',
    JSON.stringify({
      chainId: '11155111',
      portal: PORTAL,
      yaca: `0x${'ca'.repeat(20)}`,
      registry: `0x${'ee'.repeat(20)}`,
      operators: `0x${'01'.repeat(20)}`,
      l1RpcUrl: 'http://rpc.test',
    }),
  );
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

describe('the journal, every state', () => {
  test('an exit and a send-ahead in each state lead with their word, and nothing promises a relayer', () => {
    const tile = (
      <BridgeTile
        session={session}
        account="0xacc"
        onDeposit={() => {}}
        onForward={() => {}}
        onRedeem={() => {}}
      />
    );
    const { container } = mount(tile, (s) =>
      s.set(journalAtom, [
        crossing('proving', { state: 'proving' }),
        crossing('sent', { state: 'sent', txHash: TX }),
        crossing('pending', { state: 'proven-pending', ...settled }),
        crossing('witnessed', { state: 'witnessed', ...settled }),
        crossing('ready', { state: 'ready', ...settled }),
        crossing('minted', { state: 'minted-l1', ...settled, l1TxHash: TX }),
        crossing('paused', { state: 'paused', ...settled }),
        crossing('headroom', { state: 'headroom', ...settled }),
        crossing('closed', { state: 'closed', ...settled }),
        crossing('lost', { state: 'never-proven', ...settled, amount: (4n * ONE).toString() }),
        crossing('held', { kind: 2, state: 'held', ...settled }),
        crossing('unregistered', { kind: 2, state: 'not-registered', ...settled }),
        crossing('redeemed', { kind: 2, state: 'minted-l1', ...settled, l1TxHash: TX }),
      ]),
    );
    expect(screen.getAllByTestId('crossing')).toHaveLength(13);
    expect(words()).toEqual([
      'proving',
      'sent',
      'proving to Ethereum',
      'proven',
      'ready',
      'on Ethereum',
      'paused',
      'waiting for headroom',
      'closed',
      'undone',
      'held on Ethereum',
      'waiting for Yacana',
      'redeemed',
    ]);
    expect(container.textContent).not.toMatch(/relayer|within the hour/i);
    keep('journal-states', container.innerHTML);
  });

  test('a silent RPC is said on the tile, not on the crossing', () => {
    const tile = (
      <BridgeTile
        session={session}
        account="0xacc"
        onDeposit={() => {}}
        onForward={() => {}}
        onRedeem={() => {}}
      />
    );
    const { container } = mount(tile, (s) => {
      s.set(bridgeAtom, {
        verdict: { kind: 'before' },
        standing,
        readAt: NOW - 6 * MINUTE,
        rpcFailing: true,
      });
      s.set(journalAtom, [crossing('ready', { state: 'ready', ...settled })]);
    });
    expect(screen.getByTestId('bridge-tile').textContent).toContain('Ethereum RPC silent');
    keep('journal-rpc-silent', container.innerHTML);
  });
});

describe('the arrivals, every state', () => {
  test('sends from an earlier version and deposits show as they come, claimable ones with the tap', () => {
    const from4 = { kind: 2 as const, version: '4', target: '5', ...settled, l1TxHash: TX };
    const { container } = mount(<ArrivalCard session={session} onResume={() => {}} />, (s) =>
      s.set(journalAtom, [
        crossing('forwarded', { ...from4, state: 'forwarded' }),
        crossing('claimable', { ...from4, state: 'claimable', inboxIndex: '7' }),
        crossing('landed', { ...from4, state: 'minted-l2', claimBlock: 1_204, updatedAt: NOW - 2 * MINUTE }),
        crossing('unanswered', { kind: 3, state: 'proving', amount: (12n * ONE).toString() }),
        crossing('deposited', { kind: 3, state: 'deposited', l1TxHash: TX, amount: (12n * ONE).toString() }),
        crossing('arriving', {
          kind: 3,
          state: 'claimable',
          inboxIndex: '9',
          amount: (12n * ONE).toString(),
        }),
      ]),
    );
    expect(screen.getAllByTestId('arrival')).toHaveLength(6);
    expect(screen.getAllByTestId('arrival-claim')).toHaveLength(2);
    expect(screen.getAllByTestId('arrival-resume')).toHaveLength(1);
    expect(screen.getByTestId('arrival-card').textContent).toContain('landed');
    expect(screen.getByTestId('arrival-card').textContent).toContain('on its way');
    keep('arrival-states', container.innerHTML);
  });

  test('what was sent ahead, from the card that sent it: proving, undone, held, arrived', () => {
    vi.stubEnv(
      'VITE_MIGRATION',
      JSON.stringify({
        toIndex: '1',
        announcedAt: String(SECONDS - 3 * 86_400),
        expectedFlipAt: String(SECONDS + 2 * 86_400),
      }),
    );
    const tile = (
      <BridgeTile
        session={session}
        account="0xacc"
        onDeposit={() => {}}
        onForward={() => {}}
        onRedeem={() => {}}
      />
    );
    const { container } = mount(
      <>
        <MigrationCard onSendAhead={() => {}} />
        {tile}
      </>,
      (s) => {
        s.set(balanceAtom, 6n * ONE);
        s.set(journalAtom, [
          crossing('unproven', {
            kind: 2,
            state: 'proven-pending',
            ...settled,
            amount: (48n * ONE).toString(),
          }),
          crossing('undone', { kind: 2, state: 'never-proven', ...settled, amount: (48n * ONE).toString() }),
          crossing('slow', {
            kind: 2,
            state: 'held',
            ...settled,
            updatedAt: NOW - TAKING_LONG_AFTER_MS - MINUTE,
          }),
          crossing('arrived', {
            kind: 2,
            state: 'minted-l2',
            ...settled,
            target: '6',
            updatedAt: NOW - 2 * MINUTE,
          }),
        ]);
      },
    );
    expect(screen.getByTestId('migration-card').dataset.moment).toBe('announced');
    expect(screen.getByTestId('sent-ahead-status').textContent).toContain('sent ahead');
    expect(words()).toEqual(['proving to Ethereum', 'undone', 'held on Ethereum']);
    expect(screen.getAllByTestId('redeem')).toHaveLength(1);
    keep('sent-ahead-states', container.innerHTML);
  });
});

describe('the old app', () => {
  const old = (setup: (store: ReturnType<typeof createStore>) => void) => {
    vi.stubEnv('VITE_APP_ROLE', 'old');
    return mount(<OldApp session={session} />, (s) => {
      s.set(bootAtom, { phase: 'ready', account: '0xacc', threads: 1, record: ready });
      setup(s);
    });
  };

  test('once something was sent: its stations, with the proof deadline', () => {
    const { container } = old((s) => {
      s.set(balanceAtom, 0n);
      s.set(journalAtom, [
        crossing('sent', { kind: 2, state: 'proven-pending', ...settled, amount: (48n * ONE).toString() }),
      ]);
    });
    expect(screen.getByTestId('old-sent').textContent).toContain('48');
    expect(screen.getByTestId('old-sent').textContent).toMatch(/by \d\d:\d\d/);
    keep('old-app-sent', container.innerHTML);
  });

  test('once exits closed: what is lost, and what was safe', async () => {
    const { container } = old((s) => {
      s.set(bridgeAtom, {
        verdict: { kind: 'flipped', by: ['registry', 'retired'] },
        standing: { ...standing, deadline: BigInt(SECONDS - HOUR), flipAt: BigInt(SECONDS - 4 * 86_400) },
        readAt: NOW,
        rpcFailing: false,
      });
      s.set(balanceAtom, 3n * ONE);
      s.set(journalAtom, [
        crossing('safe', { kind: 2, state: 'held', ...settled, amount: (48n * ONE).toString() }),
      ]);
    });
    await waitFor(() => expect(screen.getByTestId('old-quiet').textContent).toContain('cannot leave'));
    expect(screen.getByTestId('retired').textContent).toContain('V5’s exits have closed. Nothing can leave.');
    keep('old-app-quiet', container.innerHTML);
  });
});

describe('the dialog and the bar', () => {
  test('a send held for longer than usual asks, with the call to forward it from anywhere', () => {
    mount(<TakingLongDialog onSettings={() => {}} onWallet={() => {}} />, (s) =>
      s.set(journalAtom, [
        crossing('slow', {
          kind: 2,
          state: 'held',
          ...settled,
          witness: undefined,
          updatedAt: NOW - TAKING_LONG_AFTER_MS - 2 * HOUR * 1000,
        }),
      ]),
    );
    expect(screen.getByTestId('taking-long').textContent).toContain('Yacana forwards by hand');
    keep('taking-long', document.body.innerHTML);
  });

  test('a tab behind a redeploy says so, with the old app one link away', async () => {
    vi.stubEnv('VITE_OLD_APP_ORIGIN', 'https://v5.yacana.network');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ miner: '0xdef', rollupVersion: '6' }))),
    );
    const { container } = render(<OldTabNotice miner="0xabc" rollupVersion="5" />);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(screen.getByTestId('old-tab').textContent).toContain('This tab is behind.'));
    expect(screen.getByTestId('old-tab').textContent).toContain('sent ahead from the old app');
    keep('old-tab', container.innerHTML);
  });
});
