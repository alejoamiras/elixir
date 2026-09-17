// The Wallet's one reading of the journal, pure: every crossing appears once whichever way it goes,
// the count of rows waiting for the user is the count of rows offering a tap, a finished row folds
// rather than vanishing, and a money button that is off says why. `VITE_ROLLUP_VERSION` is set
// before the modules load: under bun `import.meta.env` is `process.env`.
process.env.VITE_ROLLUP_VERSION = '5';
process.env.VITE_VERSION_INDEX = '0';

import { describe, expect, test } from 'bun:test';
import { type Crossing, FADE_AFTER_MS } from '../../bridge/src/journal.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { TAKING_LONG_AFTER_MS } from '../src/bridge/copy.ts';
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
const env = { ownVersion: '5', chainId: '11155111' };

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
    // The badge counts the deposit's Claim and the exit's Claim on Ethereum; the held send-ahead
    // offers its redeem as a quiet link beside Yacana's own forward, not as a need.
    expect(a.rows.map((r) => r.line.action?.kind)).toEqual([undefined, 'claim', 'claim-l1', undefined]);
    expect(a.rows[0]?.line.also?.kind).toBe('redeem');
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
    // Bridge again is the user's call; Settings is not the row's need.
    expect(a.needsUser).toBe(1);
    // An RPC gone silent after a good read keeps the last verdict on the view, but the rows that
    // turn on it say they cannot read it.
    const silent = activity([held], { ...view, rpcFailing: true }, NOW, {}, env);
    expect(silent.rows[0]?.line.chip.word).toBe("can't read the upgrade");
  });

  test('an urgent claim counts however red its chip; an arrival on another version is claimed there, not here', () => {
    const urgent = crossing('u', { state: 'ready', witness: undefined });
    const a = activity([urgent], { ...view, deadline: { kind: 'any-day' } }, NOW, {}, env);
    expect(a.rows[0]?.line.chip.word).toBe('could close any day');
    expect(a.rows[0]?.line.action?.kind).toBe('claim-l1');
    expect(a.needsUser).toBe(1);
    // A deposit into the version before: the page names only this build and the canonical.
    const old = crossing('d', { kind: 3, version: '4', state: 'claimable', inboxIndex: '1' });
    const b = activity([old], { ...view, canonical: { version: 5n, index: 5n } }, NOW, {}, env);
    expect(b.rows[0]?.line.chip.word).toBe('claim on another version');
    expect(b.rows[0]?.line.action).toBeUndefined();
    expect(b.needsUser).toBe(0);
  });

  test("a crossing from another version is read under that version's deadline and pause, not this build's", () => {
    const heldOnV6 = crossing('k', { kind: 2, state: 'held', version: '5', witness: undefined });
    const v6 = { ...view, canonical: { version: 6n, index: 6n }, deadline: { kind: 'no-flip' as const } };
    const withV5 = {
      ...v6,
      versions: {
        '5': {
          standing: { ...standing, paused: true, pausedUntil: 1_800_100_000n },
          deadline: { kind: 'any-day' as const },
        },
      },
    };
    const a = activity([heldOnV6], withV5, NOW, {}, { ...env, ownVersion: '6' });
    expect(a.rows[0]?.line.chip.word).toBe('could close any day');
    expect(a.rows[0]?.deadline).toBe('until the next Aztec upgrade, which could land any day');
    // Without V5's own reading nothing is assumed: the row falls back to the open-ended phrase.
    const b = activity([heldOnV6], v6, NOW, {}, { ...env, ownVersion: '6' });
    expect(b.rows[0]?.line.chip.word).toBe('held for V6');
    expect(b.rows[0]?.deadline).toBe('while the bridge is open');
  });

  test('a send-ahead from the last version is held for the canonical, by name, before it is forwarded', () => {
    const held = crossing('k', { kind: 2, state: 'held' });
    const a = activity([held], { ...view, canonical: { version: 6n, index: 6n } }, NOW, {}, env);
    expect(a.rows[0]?.line.chip.word).toBe('held for V6');
    expect(a.rows[0]?.direction).toBe('→ V6');
  });

  test('a held send-ahead is longer than usual only once its destination exists: never before the flip', () => {
    const old = crossing('k', { kind: 2, state: 'held', updatedAt: NOW - TAKING_LONG_AFTER_MS - 1 });
    const registered = { ...view, targetRegisteredAt: BigInt(Math.floor(NOW / 1000)) - 7n * 3600n };
    const before = activity([old], { ...registered, canonical: { version: 5n, index: 5n } }, NOW, {}, env);
    expect(before.rows[0]?.line.chip.word).toBe('held for the next version');
    const after = activity([old], { ...registered, canonical: { version: 6n, index: 6n } }, NOW, {}, env);
    expect(after.rows[0]?.line.chip.word).toBe('longer than usual');
  });

  test('a finished row folds after its week and is never dropped; a claim in flight reads as claiming', () => {
    const old = crossing('old', {
      state: 'minted-l1',
      updatedAt: NOW - FADE_AFTER_MS - 1,
      l1TxHash: `0x${'22'.repeat(32)}`,
    });
    const fresh = crossing('fresh', { kind: 3, state: 'claimable', inboxIndex: '1', createdAt: NOW - 500 });
    const a = activity(
      [old, fresh],
      view,
      NOW,
      {},
      {
        ...env,
        claiming: new Map([['fresh', NOW - 12_000]]),
      },
    );
    expect(a.rows.map((r) => [r.c.id, r.collapsed])).toEqual([
      ['fresh', false],
      ['old', true],
    ]);
    expect(a.rows[0]?.line.chip.word).toBe('claiming · 12 s');
    expect(a.rows[0]?.line.sentence).toBe('Claiming privately, about 20 s.');
    expect(a.rows[0]?.line.progress).toBeCloseTo(0.6);
    expect(a.rows[0]?.line.action).toBeUndefined();
    expect(a.needsUser).toBe(0);
    expect(a.rows[1]?.line.sentence).toBe('2 YACA at 0x709979…79C8.');
    // Through Presto the promise and the bar are Presto's; a claim still to tap promises the same.
    const p = activity([fresh], view, NOW, {}, { ...env, prover: 'presto' });
    expect(p.rows[0]?.line.sentence).toBe(
      'Arrived. Claim it into your private balance: one tap, about 5 s, no fee.',
    );
    const q = activity(
      [fresh],
      view,
      NOW,
      {},
      { ...env, prover: 'presto', claiming: new Map([['fresh', NOW - 3_000]]) },
    );
    expect(q.rows[0]?.line.sentence).toBe('Claiming privately, about 5 s.');
    expect(q.rows[0]?.line.progress).toBeCloseTo(0.6);
    // The row whose proof answered keeps its answer over the page's promise.
    const r = activity(
      [fresh],
      view,
      NOW,
      {},
      {
        ...env,
        prover: 'presto',
        claiming: new Map([['fresh', NOW - 3_000]]),
        provers: new Map([['fresh', 'wasm']]),
      },
    );
    expect(r.rows[0]?.line.sentence).toBe('Claiming privately, about 20 s.');
    // A claim that failed is ready again: its next proof is promised, the last answer is not read.
    const back = activity(
      [fresh],
      view,
      NOW,
      {},
      { ...env, prover: 'presto', provers: new Map([['fresh', 'wasm']]) },
    );
    expect(back.rows[0]?.line.sentence).toContain('about 5 s');
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
