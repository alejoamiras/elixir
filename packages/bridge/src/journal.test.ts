import { describe, expect, test } from 'bun:test';
import { advance, type Crossing, crossingId, type Facts, rowState } from './journal.ts';
import type { ArchivedExit } from './witness.ts';

const PORTAL = `0x${'be'.repeat(20)}` as const;
const witness: ArchivedExit = {
  version: '5',
  index: 0,
  kind: 2,
  amount: '7',
  aux: `0x${'11'.repeat(32)}`,
  recipientOrRedeemKey: `0x${'22'.repeat(20)}`,
  txHash: `0x${'33'.repeat(32)}`,
  epoch: '3',
  numCheckpointsInEpoch: 1,
  leafIndex: '0',
  path: [],
};

const fresh = (kind: Crossing['kind'], index = 0): Crossing => {
  const c = {
    kind,
    chainId: '31337',
    portal: PORTAL,
    version: '5',
    index,
    amount: '7',
    state: 'proving' as const,
    createdAt: 1_000,
    updatedAt: 1_000,
    ethAddress: `0x${'22'.repeat(20)}` as const,
  };
  return { ...c, id: crossingId(c) };
};

/** Walks a record through a list of facts, returning every state it went through. */
const walk = (c: Crossing, steps: Omit<Facts, 'now'>[]): [Crossing, string[]] => {
  const states: string[] = [];
  let now = 2_000;
  let cur = c;
  for (const f of steps) {
    cur = advance(cur, { now, ...f });
    states.push(cur.state);
    now += 1_000;
  }
  return [cur, states];
};

describe('the crossing journal', () => {
  test('an exit to Ethereum: proving → sent → in a block → witnessed → ready → minted on Ethereum', () => {
    const [done, states] = walk(fresh(1), [
      { tx: { status: 'pending' } },
      { tx: { status: 'mined', block: 12, epoch: '3' }, proofDeadline: '5000' },
      { epochProven: false },
      { epochProven: true, witness: { ...witness, kind: 1 } },
      { portal: { paused: false, hasHeadroom: true, deadlinePassed: false } },
      { forwarded: { txHash: '0xf1', inboxIndex: '0', target: '5' } },
    ]);
    expect(states).toEqual(['sent', 'proven-pending', 'proven-pending', 'witnessed', 'ready', 'minted-l1']);
    expect(done).toMatchObject({ block: 12, epoch: '3', proofDeadline: '5000', l1TxHash: '0xf1' });
    // Final: nothing moves it again.
    expect(advance(done, { now: 9_000, tx: { status: 'dropped' } })).toBe(done);
  });

  test('a send-ahead: held until the next version is registered, then forwarded, claimable, minted there', () => {
    const [, states] = walk(fresh(2), [
      { tx: { status: 'mined', block: 1, epoch: '3' } },
      { epochProven: true, witness },
      { portal: { paused: false, hasHeadroom: true, canonicalIsNewer: false } },
      { portal: { hasHeadroom: true, canonicalIsNewer: true, canonicalRegistered: false } },
      { portal: { hasHeadroom: true, canonicalIsNewer: true, canonicalRegistered: true } },
      { forwarded: { txHash: '0xf2', inboxIndex: '41', target: '6' } },
      { messageReady: true },
      { claimed: { txHash: '0xc1', block: 30 } },
    ]);
    expect(states).toEqual([
      'proven-pending',
      'witnessed',
      'held',
      'not-registered',
      'held',
      'forwarded',
      'claimable',
      'minted-l2',
    ]);
  });

  test('a send-ahead redeemed instead is minted on Ethereum; a paused or capped portal holds a leaf; a passed deadline closes it', () => {
    const witnessed = walk(fresh(2), [
      { tx: { status: 'mined', block: 1, epoch: '3' } },
      { epochProven: true, witness },
    ])[0];
    expect(advance(witnessed, { now: 5, redeemed: { txHash: '0xr' } })).toMatchObject({
      state: 'minted-l1',
      l1TxHash: '0xr',
    });
    expect(advance(witnessed, { now: 5, portal: { paused: true } }).state).toBe('paused');
    expect(advance(witnessed, { now: 5, portal: { hasHeadroom: false } }).state).toBe('headroom');
    const closed = advance(witnessed, { now: 5, portal: { deadlinePassed: true } });
    expect(closed.state).toBe('closed');
    expect(advance(closed, { now: 6, forwarded: { txHash: '0x1', inboxIndex: '1', target: '6' } })).toBe(
      closed,
    );
    // Paused is not final: the next read moves it on.
    expect(
      advance(advance(witnessed, { now: 5, portal: { paused: true } }), {
        now: 6,
        portal: { paused: false, hasHeadroom: true, canonicalIsNewer: true, canonicalRegistered: true },
      }).state,
    ).toBe('held');
  });

  test('a dropped transaction and a pruned epoch end the record; the portal is not consulted without a witness', () => {
    expect(advance(fresh(1), { now: 5, tx: { status: 'dropped' } }).state).toBe('dropped');
    const [pruned, states] = walk(fresh(2), [
      { tx: { status: 'mined', block: 1, epoch: '3' }, proofDeadline: '4000' },
      { epochPruned: true },
    ]);
    expect(states).toEqual(['proven-pending', 'never-proven']);
    expect(advance(pruned, { now: 9, epochProven: true, witness })).toBe(pruned);
    const inBlock = walk(fresh(1), [{ tx: { status: 'mined', block: 1, epoch: '3' } }])[0];
    expect(advance(inBlock, { now: 9, portal: { paused: true } }).state).toBe('proven-pending');
  });

  test('a deposit: deposited on Ethereum, claimable on Aztec, minted; an error rides along until cleared', () => {
    const [done, states] = walk(fresh(3), [
      { deposited: { txHash: '0xd', inboxIndex: '9' } },
      { error: 'the sponsor is unavailable' },
      { messageReady: true, error: null },
      { claimed: { txHash: '0xc', block: 8 } },
    ]);
    expect(states).toEqual(['deposited', 'deposited', 'claimable', 'minted-l2']);
    expect(done.error).toBeUndefined();
    expect(done).toMatchObject({ inboxIndex: '9', claimTxHash: '0xc' });
  });

  test('a send without a hash is checking until the node in use covers its window past the expiry; a late log moves it on', () => {
    const lost = { ...fresh(1), expiresAt: '500', anchorBlock: 40 };
    const covered = { sourceTipAt: 600n, covered: true };
    expect(rowState(lost, covered)).toBe('unfinished');
    // Reloaded before the hash was written: no expiry to measure against.
    expect(rowState(fresh(1), covered)).toBe('checking');
    // The node's history does not reach the anchor block, or it is behind the expiry, or it has no tip.
    expect(rowState(lost, { sourceTipAt: 600n, covered: false })).toBe('checking');
    expect(rowState(lost, { sourceTipAt: 500n, covered: true })).toBe('checking');
    expect(rowState(lost, { sourceTipAt: null, covered: true })).toBe('checking');
    // A deposit's waiting is the wallet's, not the node's; a record with a hash reads as its state.
    expect(rowState({ ...fresh(3), expiresAt: '500' }, covered)).toBe('proving');
    expect(rowState({ ...lost, txHash: '0xab' }, covered)).toBe('proving');
    const found = advance(lost, { now: 9, tx: { status: 'mined', block: 41, epoch: '3', txHash: '0xab' } });
    expect(found.state).toBe('proven-pending');
    expect(rowState(found, covered)).toBe('proven-pending');
  });

  test('unchanged facts return the same object', () => {
    const c = fresh(1);
    expect(advance(c, { now: 5 })).toBe(c);
    expect(crossingId(c)).toBe(`31337:${PORTAL}:5:1:0`);
  });
});
