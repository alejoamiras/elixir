import { describe, expect, test } from 'bun:test';
import { advance, type Crossing, crossingId } from '../../bridge/src/journal.ts';
import { type FactReads, factsFor } from '../src/bridge/facts.ts';

const PORTAL = `0x${'be'.repeat(20)}` as const;
const base = { kind: 2 as const, chainId: '31337', portal: PORTAL, version: '5', index: 0 };
const crossing = (state: Crossing['state'], patch: Partial<Crossing> = {}): Crossing => ({
  ...base,
  id: crossingId(base),
  amount: '7',
  state,
  createdAt: 0,
  updatedAt: 0,
  ethAddress: `0x${'22'.repeat(20)}`,
  txHash: '0xt',
  ...patch,
});

/** Every source answers (its default or the test's) and counts its calls, so a reading's cost is visible. */
const reads = (over: Partial<FactReads> = {}) => {
  const calls: string[] = [];
  const defaults: FactReads = {
    tx: async () => ({ status: 'mined', block: 3, epoch: '2' }),
    epochOfBlock: async () => '2',
    proofDeadline: async () => 900n,
    epochProven: async () => false,
    witness: async () => undefined,
    portal: async () => ({ paused: false, hasHeadroom: true, canonicalIsNewer: false }),
    forwarded: async () => undefined,
    redeemed: async () => undefined,
    messageReady: async () => false,
    claimed: async () => undefined,
    l1Tx: async () => undefined,
    nowSeconds: async () => 1_000n,
  };
  const r = Object.fromEntries(
    (Object.keys(defaults) as (keyof FactReads)[]).map((name) => [
      name,
      name === 'nowSeconds'
        ? defaults.nowSeconds
        : (...args: unknown[]) => {
            calls.push(name);
            return ((over[name] ?? defaults[name]) as (...a: unknown[]) => unknown)(...args);
          },
    ]),
  ) as unknown as FactReads;
  return { r, calls };
};

describe('the facts a reading gathers', () => {
  test('a record still proving asks the node about its transaction and nothing else', async () => {
    const { r, calls } = reads();
    const f = await factsFor(r, crossing('sent'), 5);
    expect(f.tx).toEqual({ status: 'mined', block: 3, epoch: '2' });
    expect(calls).toEqual(['tx']);
    expect(advance(crossing('sent'), f).state).toBe('proven-pending');
  });

  test('an epoch awaiting its proof asks the rollup; past the deadline unproven it is pruned; proven it fetches the witness', async () => {
    const { r, calls } = reads();
    const f = await factsFor(r, crossing('proven-pending', { epoch: '2' }), 5);
    expect(f).toMatchObject({ proofDeadline: '900', epochProven: false, epochPruned: true });
    expect(calls).toEqual(['proofDeadline', 'epochProven']);
    expect(advance(crossing('proven-pending', { epoch: '2' }), f).state).toBe('never-proven');
    const proven = reads({ epochProven: async () => true, witness: async () => ({ epoch: '2' }) as never });
    const g = await factsFor(proven.r, crossing('proven-pending', { epoch: '2', proofDeadline: '900' }), 5);
    expect(g.witness).toBeDefined();
    expect(proven.calls).toEqual(['epochProven', 'witness']);
    // The send recorded the block alone: the epoch is read once and kept on the record.
    const late = reads();
    const h = await factsFor(late.r, crossing('proven-pending', { block: 3 }), 5);
    expect(h.epoch).toBe('2');
    expect(late.calls).toEqual(['epochOfBlock', 'proofDeadline', 'epochProven']);
    expect(advance(crossing('proven-pending', { block: 3 }), h).epoch).toBe('2');
  });

  test("a deposit is settled by its receipt or given up by Ethereum's clock past its deadline, never by the device's", async () => {
    const waiting = crossing('proving', { kind: 3, txHash: undefined, expiresAt: '1200' });
    // Before the deadline with no hash: the wallet may still answer; nothing is read but the clock.
    const { r, calls } = reads();
    const f = await factsFor(r, waiting, 99_999_999);
    expect(f).toEqual({ now: 99_999_999 });
    expect(calls).toEqual([]);
    // Past the deadline: nothing the wallet sent can land, whatever the device's clock says.
    const expired = { ...waiting, expiresAt: '900' };
    expect(advance(expired, await factsFor(r, expired, 5)).state).toBe('dropped');
    // A hash in hand: the receipt decides — the message it made, or a revert that spent the gas.
    const sent = { ...waiting, l1TxHash: '0xd1' as const };
    const mined = reads({ l1Tx: async () => ({ status: 'mined', inboxIndex: '9' }) });
    const g = await factsFor(mined.r, sent, 5);
    expect(g.deposited).toEqual({ txHash: '0xd1', inboxIndex: '9' });
    expect(advance(sent, g)).toMatchObject({ state: 'deposited', inboxIndex: '9' });
    expect(mined.calls).toEqual(['l1Tx']);
    const reverted = reads({ l1Tx: async () => ({ status: 'reverted' }) });
    expect(advance(sent, await factsFor(reverted.r, sent, 5)).state).toBe('dropped');
    // Unmined and before the deadline: still waiting.
    expect(advance(sent, await factsFor(r, sent, 5))).toBe(sent);
    // A receipt the RPC would not read is not an absence: past the deadline it still says nothing,
    // or a broken or lying RPC would have the page burn the same coins again.
    const dead = reads({ l1Tx: async () => 'unreadable' });
    const late = { ...sent, expiresAt: '900' };
    expect(advance(late, await factsFor(dead.r, late, 5))).toBe(late);
    // The same deadline with a definite "no such receipt" does end it.
    expect(advance(late, await factsFor(r, late, 5)).state).toBe('dropped');
  });

  test('a witnessed leaf asks the portal only until an event answers for it', async () => {
    const held = crossing('held', { witness: {} as never });
    const { r, calls } = reads();
    expect((await factsFor(r, held, 5)).portal).toBeDefined();
    expect(calls).toEqual(['forwarded', 'redeemed', 'portal']);
    const done = reads({ forwarded: async () => ({ txHash: '0xf', inboxIndex: '1', target: '6' }) });
    const f = await factsFor(done.r, held, 5);
    expect(f.portal).toBeUndefined();
    expect(done.calls).toEqual(['forwarded']);
    expect(advance(held, f).state).toBe('forwarded');
  });

  test('a forwarded crossing asks the destination whether the message is there, then whether it was claimed', async () => {
    const forwarded = crossing('forwarded', { inboxIndex: '1' });
    const { r, calls } = reads();
    await factsFor(r, forwarded, 5);
    expect(calls).toEqual(['messageReady']);
    const ready = reads({ messageReady: async () => true });
    const f = await factsFor(ready.r, forwarded, 5);
    expect(ready.calls).toEqual(['messageReady', 'claimed']);
    expect(advance(forwarded, f).state).toBe('claimable');
    const claimable = reads({ claimed: async () => ({ txHash: '0xc', block: 9 }) });
    expect(advance(crossing('claimable'), await factsFor(claimable.r, crossing('claimable'), 5)).state).toBe(
      'minted-l2',
    );
  });
});
