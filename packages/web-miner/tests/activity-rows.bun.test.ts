// The Wallet's one reading of the journal, pure: every crossing appears once whichever way it goes,
// the count of rows waiting for the user is the count of rows offering a tap, a finished row folds
// rather than vanishing, and a money button that is off says why. `VITE_ROLLUP_VERSION` is set
// before the modules load: under bun `import.meta.env` is `process.env`.
process.env.VITE_ROLLUP_VERSION = '5';
process.env.VITE_VERSION_INDEX = '0';

import { describe, expect, test } from 'bun:test';
import { type Crossing, FADE_AFTER_MS } from '../../bridge/src/journal.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { activity, moneyStanding } from '../src/bridge/rows.ts';
import type { BridgeView } from '../src/state.ts';

const ONE = 10n ** BigInt(PARAMS.DECIMALS);
const PORTAL = `0x${'ab'.repeat(20)}` as const;
const NOW = 1_800_000_000_000;

const crossing = (id: string, patch: Partial<Crossing>): Crossing => ({
  id,
  kind: 1,
  chainId: '11155111',
  portal: PORTAL,
  version: '5',
  index: 0,
  amount: (2n * ONE).toString(),
  state: 'proving',
  createdAt: NOW - 60_000,
  updatedAt: NOW - 60_000,
  ethAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  ...patch,
});

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
const view: BridgeView = { verdict: { kind: 'before' }, standing, readAt: NOW, rpcFailing: false };
const env = { ownVersion: '5', chainId: '11155111', wallet: 'Rabby' };

describe('the activity reading', () => {
  test('one row per crossing, newest first, whichever way it goes; the count is the rows with a tap', () => {
    const journal = [
      crossing('exit', { state: 'ready', createdAt: NOW - 3_000 }),
      crossing('ahead', { kind: 2, state: 'held', createdAt: NOW - 1_000 }),
      crossing('deposit', { kind: 3, state: 'claimable', inboxIndex: '3', createdAt: NOW - 2_000 }),
      crossing('sent', { state: 'sent', txHash: `0x${'11'.repeat(32)}`, createdAt: NOW - 4_000 }),
    ];
    const a = activity(journal, view, NOW, {}, env);
    expect(a.rows.map((r) => r.c.id)).toEqual(['ahead', 'deposit', 'exit', 'sent']);
    expect(a.rows.map((r) => r.line.chip.word)).toEqual([
      'held for the next version',
      'ready to claim',
      'ready to claim',
      'sent',
    ]);
    // Two rows offer a tap, and those are exactly the two the badge counts.
    expect(
      a.rows.filter((r) => r.line.action && r.line.chip.tone === 'ok').map((r) => r.line.action?.kind),
    ).toEqual(['claim', 'claim-l1']);
    expect(a.needsUser).toBe(2);
    // The amount is printed in the unit of the side it starts on; the sentence names where it lands.
    expect(a.rows[1]?.unit).toBe('YACA');
    expect(a.rows[2]?.unit).toBe(PARAMS.TOKEN_SYMBOL);
    expect(a.rows[1]?.direction).toBe('→ here · from 0x709979…79C8');
  });

  test("a hashless send reads as the refresh says, not as the record does; a K2 that needs the upgrade read says it can't", () => {
    const hashless = crossing('h', { state: 'proving' });
    const held = crossing('k', { kind: 2, state: 'held' });
    const a = activity(
      [hashless, held],
      { ...view, verdict: { kind: 'unknown' } },
      NOW,
      { h: 'unfinished' },
      env,
    );
    expect(a.rows.map((r) => r.line.chip.word)).toEqual(["didn't finish", "can't read the upgrade"]);
    expect(a.rows[0]?.line.action?.label).toBe('Bridge again');
    expect(a.rows[1]?.line.action?.kind).toBe('settings');
    expect(a.needsUser).toBe(0);
  });

  test('a send-ahead from the last version is held for the canonical, by name, before it is forwarded', () => {
    const held = crossing('k', { kind: 2, state: 'held' });
    const a = activity([held], { ...view, canonical: { version: 6n, index: 6n } }, NOW, {}, env);
    expect(a.rows[0]?.line.chip.word).toBe('held for V6');
    expect(a.rows[0]?.direction).toBe('→ V6');
  });

  test('a finished row folds after its week and is never dropped; a claim in flight reads as claiming', () => {
    const old = crossing('old', {
      state: 'minted-l1',
      updatedAt: NOW - FADE_AFTER_MS - 1,
      l1TxHash: `0x${'22'.repeat(32)}`,
    });
    const fresh = crossing('fresh', { kind: 3, state: 'claimable', inboxIndex: '1', createdAt: NOW - 500 });
    const a = activity([old, fresh], view, NOW, {}, { ...env, claiming: 'fresh' });
    expect(a.rows.map((r) => [r.c.id, r.collapsed])).toEqual([
      ['fresh', false],
      ['old', true],
    ]);
    expect(a.rows[0]?.line.chip.word).toBe('claiming');
    expect(a.rows[0]?.line.action).toBeUndefined();
    expect(a.needsUser).toBe(0);
    expect(a.rows[1]?.line.sentence).toBe('2 YACA at 0x709979…79C8.');
  });
});

describe('why a money button is off', () => {
  test('a silent RPC beats everything; unregistered stops both; closed deposits and a pause stop deposits alone', () => {
    expect(moneyStanding({ ...view, rpcFailing: true }, 'V5', 'V6')).toMatchObject({
      off: new Set(['to-ethereum', 'deposit']),
      settings: true,
    });
    expect(
      moneyStanding({ ...view, standing: { ...standing, registered: false } }, 'V5', 'V6'),
    ).toMatchObject({
      off: new Set(['to-ethereum', 'deposit']),
      reason: 'Bridging opens once Yacana registers V5 on Ethereum, at launch.',
    });
    expect(
      moneyStanding({ ...view, standing: { ...standing, depositsClosed: true } }, 'V5', 'V6'),
    ).toMatchObject({
      off: new Set(['deposit']),
      reason:
        'Deposits into V5 are closed for good. Bridge from Ethereum on V6, at yacana.network, once it opens.',
    });
    const paused = moneyStanding(
      {
        ...view,
        standing: { ...standing, paused: true, pausedUntil: BigInt(Math.floor(NOW / 1000) + 4 * 86_400) },
      },
      'V5',
      'V6',
    );
    expect([...paused.off]).toEqual(['deposit']);
    expect(paused.reason).toStartWith('The bridge is paused until ');
    expect(paused.reason).toEndWith('A bridge to Ethereum can start now; its claim waits.');
    expect(moneyStanding(view, 'V5', 'V6')).toEqual({ off: new Set() });
  });
});
