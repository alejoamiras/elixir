// The state lists as drawn, rendered over a made-up journal: every word a crossing can lead with,
// what arrives in every state, the old app once something was sent and once the version is quiet,
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
import { ActivityList } from './features/ActivityList';
import { MigrationCard } from './features/MigrationCard';
import { OldApp } from './features/OldApp';
import { OldTabNotice } from './features/OldTabNotice';
import type { MasterRecord } from './keys/store';
import { BalanceTile } from './routes/Wallet';
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
const on = { claimL1: () => {}, forward: () => {}, redeem: () => {}, again: () => {}, settings: () => {} };
const list = <ActivityList session={session} account="0xacc" on={on} wins={null} />;

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
    const at = (m: number) => ({ createdAt: NOW - m * MINUTE, updatedAt: NOW - m * MINUTE });
    const { container } = mount(list, (s) =>
      s.set(journalAtom, [
        crossing('proving', { state: 'proving', ...at(1) }),
        crossing('sent', { state: 'sent', txHash: TX, ...at(2) }),
        crossing('pending', { state: 'proven-pending', ...settled, ...at(3) }),
        crossing('witnessed', { state: 'witnessed', ...settled, ...at(4) }),
        crossing('ready', { state: 'ready', ...settled, ...at(5) }),
        crossing('minted', { state: 'minted-l1', ...settled, l1TxHash: TX, ...at(6) }),
        crossing('paused', { state: 'paused', ...settled, ...at(7) }),
        crossing('headroom', { state: 'headroom', ...settled, ...at(8) }),
        crossing('closed', { state: 'closed', ...settled, ...at(9) }),
        crossing('lost', { state: 'never-proven', ...settled, amount: (4n * ONE).toString(), ...at(10) }),
        crossing('held', { kind: 2, state: 'held', ...settled, ...at(11) }),
        crossing('unregistered', { kind: 2, state: 'not-registered', ...settled, ...at(12) }),
        crossing('redeemed', { kind: 2, state: 'minted-l1', ...settled, l1TxHash: TX, ...at(13) }),
      ]),
    );
    expect(screen.getAllByTestId('crossing')).toHaveLength(13);
    expect(words()).toEqual([
      'proving · 60 s',
      'sent',
      'reaching Ethereum',
      'reached Ethereum',
      'ready to claim',
      'claimed',
      'paused',
      'waiting for the limit',
      'last day passed',
      'undone',
      'held for the next version',
      'waiting for Yacana',
      'redeemed',
    ]);
    expect(container.textContent).not.toMatch(/relayer/i);
    // Every money-loss row says what happened to the money; no row says "safe".
    expect(container.textContent).not.toMatch(/\bsafe\b/i);
    keep('journal-states', container.innerHTML);
  });

  test('a silent RPC is said on the balance tile; a send-ahead that needs the upgrade read says so on its row', () => {
    const { container } = mount(
      <>
        <BalanceTile
          balance={8n * ONE}
          claims={1}
          onSend={() => {}}
          onToEthereum={() => {}}
          onDeposit={() => {}}
          onSettings={() => {}}
        />
        {list}
      </>,
      (s) => {
        s.set(bridgeAtom, {
          verdict: { kind: 'unknown' },
          standing,
          readAt: NOW - 6 * MINUTE,
          rpcFailing: true,
        });
        s.set(journalAtom, [
          crossing('ready', { state: 'ready', ...settled }),
          crossing('held', { kind: 2, state: 'held', ...settled, createdAt: NOW - 40 * MINUTE }),
        ]);
      },
    );
    expect(screen.getByTestId('money-reason').textContent).toContain("Ethereum RPC isn't answering");
    expect(words()).toEqual(['ready to claim', "can't read the upgrade"]);
    expect(screen.getByTestId('row-settings')).toBeTruthy();
    keep('journal-rpc-silent', container.innerHTML);
  });
});

describe('the arrivals, every state', () => {
  test('sends from an earlier version and deposits show as they come, claimable ones with the tap', () => {
    const from4 = { kind: 2 as const, version: '4', target: '5', ...settled, l1TxHash: TX };
    const at = (m: number) => ({ createdAt: NOW - m * MINUTE });
    const { container } = mount(list, (s) =>
      s.set(journalAtom, [
        crossing('forwarded', { ...from4, state: 'forwarded', ...at(1) }),
        crossing('claimable', { ...from4, state: 'claimable', inboxIndex: '7', ...at(2) }),
        crossing('landed', {
          ...from4,
          state: 'minted-l2',
          claimBlock: 1_204,
          updatedAt: NOW - 2 * MINUTE,
          ...at(3),
        }),
        crossing('unanswered', { kind: 3, state: 'proving', amount: (12n * ONE).toString(), ...at(4) }),
        crossing('deposited', {
          kind: 3,
          state: 'deposited',
          l1TxHash: TX,
          amount: (12n * ONE).toString(),
          ...at(5),
        }),
        crossing('arriving', {
          kind: 3,
          state: 'claimable',
          inboxIndex: '9',
          amount: (12n * ONE).toString(),
          ...at(6),
        }),
      ]),
    );
    expect(words()).toEqual([
      'arriving',
      'ready to claim',
      'claimed',
      'waiting for your wallet',
      'crossing to Aztec',
      'ready to claim',
    ]);
    expect(screen.getAllByTestId('row-claim')).toHaveLength(2);
    // A deposit's amount is what left Ethereum; its sentence, what lands here.
    expect(screen.getAllByTestId('crossing')[3]?.textContent).toContain('12 YACA');
    expect(screen.getAllByTestId('crossing')[2]?.textContent).toContain(
      `8 ${PARAMS.TOKEN_SYMBOL} in your balance`,
    );
    keep('arrival-states', container.innerHTML);
  });
});

describe('what was sent ahead', () => {
  test('from the card that sent it: proving, undone, held, arrived', () => {
    vi.stubEnv(
      'VITE_MIGRATION',
      JSON.stringify({
        toIndex: '1',
        announcedAt: String(SECONDS - 3 * 86_400),
        expectedFlipAt: String(SECONDS + 2 * 86_400),
      }),
    );
    const { container } = mount(
      <>
        <MigrationCard onSendAhead={() => {}} />
        {list}
      </>,
      (s) => {
        s.set(balanceAtom, 6n * ONE);
        s.set(journalAtom, [
          crossing('unproven', {
            kind: 2,
            state: 'proven-pending',
            ...settled,
            amount: (48n * ONE).toString(),
            createdAt: NOW - MINUTE,
          }),
          crossing('undone', {
            kind: 2,
            state: 'never-proven',
            ...settled,
            amount: (48n * ONE).toString(),
            createdAt: NOW - 2 * MINUTE,
          }),
          crossing('slow', {
            kind: 2,
            state: 'held',
            ...settled,
            createdAt: NOW - 3 * MINUTE,
            updatedAt: NOW - TAKING_LONG_AFTER_MS - MINUTE,
          }),
          crossing('arrived', {
            kind: 2,
            state: 'minted-l2',
            ...settled,
            target: '6',
            createdAt: NOW - 4 * MINUTE,
            updatedAt: NOW - 2 * MINUTE,
          }),
        ]);
      },
    );
    expect(screen.getByTestId('migration-card').dataset.moment).toBe('announced');
    expect(screen.getByTestId('sent-ahead-status').textContent).toContain('sent ahead');
    // Announced, the upgrade has a name and the held row waits for it by that name.
    expect(words()).toEqual(['reaching Ethereum', 'undone', 'held for V1', 'claimed']);
    expect(screen.getAllByTestId('row-redeem')).toHaveLength(1);
    expect(screen.getAllByTestId('row-again')).toHaveLength(1);
    expect(screen.getByTestId('row-again').textContent).toBe('Send ahead again');
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

  test('once the last day has passed: what is lost, and what was safe', async () => {
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
    expect(screen.getByTestId('retired').textContent).toContain(
      'V5’s last day has passed. Nothing can leave.',
    );
    keep('old-app-quiet', container.innerHTML);
  });
});

describe('the old-tab bar', () => {
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
