import { describe, expect, test } from 'bun:test';
import { EthAddress } from '@aztec/foundation/eth-address';
import type { Crossing } from '../../bridge/src/journal.ts';
import { deriveCrossingSecrets } from '../../bridge/src/secrets.ts';
import type { Arrivals, Arrived } from '../src/bridge/landing.ts';
import { arrivalCandidates, landed, matchArrivals, twinOf } from '../src/bridge/landing.ts';

const PORTAL = `0x${'be'.repeat(20)}` as const;
const master = new Uint8Array(32).map((_, i) => i);
const scope = { chainId: 31337n, portal: EthAddress.fromString(PORTAL) };
const hash = async (version: bigint, index: number) =>
  (await deriveCrossingSecrets(master, { ...scope, version }, index)).secretHash.toString() as `0x${string}`;

describe('the landing scan', () => {
  test('candidates are the window of indices under each source version and this one', async () => {
    const c = await arrivalCandidates(master, scope, { sources: [5n], current: 6n }, 3);
    expect(c.map((x) => `${x.kind}:${x.version}:${x.index}`)).toEqual([
      '2:5:0',
      '2:5:1',
      '2:5:2',
      '3:6:0',
      '3:6:1',
      '3:6:2',
    ]);
    expect(c[1]?.secretHash).toBe(await hash(5n, 1));
  });

  test("the portal's events pick out this master's crossings, in the state the event puts them in", async () => {
    const candidates = await arrivalCandidates(master, scope, { sources: [5n], current: 6n }, 3);
    const arrivals: Arrivals = {
      forwarded: [
        {
          secretHash: await hash(5n, 1),
          source: 5n,
          target: 6n,
          amount: 7n,
          inboxIndex: 41n,
          txHash: '0xf1',
        },
        // Someone else's send-ahead, and one of ours forwarded from a version we did not ask about.
        {
          secretHash: `0x${'aa'.repeat(32)}`,
          source: 5n,
          target: 6n,
          amount: 1n,
          inboxIndex: 42n,
          txHash: '0xf2',
        },
        {
          secretHash: await hash(4n, 0),
          source: 4n,
          target: 6n,
          amount: 1n,
          inboxIndex: 43n,
          txHash: '0xf3',
        },
      ],
      deposited: [
        { secretHash: await hash(6n, 0), version: 6n, amount: 3n, inboxIndex: 44n, txHash: '0xd1' },
        // A deposit into another version under our label is not ours here.
        { secretHash: await hash(6n, 2), version: 5n, amount: 3n, inboxIndex: 45n, txHash: '0xd2' },
      ],
    };
    const here = { chainId: '31337', portal: PORTAL, current: 6n };
    const arrived = matchArrivals(arrivals, candidates, here);
    const found = arrived.map((a) => a.crossing(1_000));
    expect(found.map((c) => [c.kind, c.version, c.index, c.state, c.inboxIndex, c.amount])).toEqual([
      [2, '5', 1, 'forwarded', '41', '7'],
      [3, '6', 0, 'deposited', '44', '3'],
    ]);
    expect(found[0]?.target).toBe('6');
    const [send, dep] = arrived as [Arrived, Arrived];
    // A crossing the journal knows keeps its own record, however far along.
    const claimed: Crossing = { ...(found[0] as Crossing), state: 'minted-l2', claimTxHash: '0xc' };
    expect(landed(claimed, send, 2_000)).toBe(claimed);
    // A deposit the wallet answered after the page closed is still `proving` in the journal, at the amount
    // last asked: the event moves it on, at the amount Ethereum saw.
    const unanswered: Crossing = {
      ...(found[1] as Crossing),
      state: 'proving',
      amount: '9',
      inboxIndex: undefined,
      l1TxHash: undefined,
    };
    expect(landed(unanswered, dep, 3_000)).toMatchObject({
      state: 'deposited',
      amount: '3',
      inboxIndex: '44',
      l1TxHash: '0xd1',
      updatedAt: 3_000,
    });
    // Two devices of one account derived the same index: the second message under it is its own
    // row, keyed by its message, and the stored row keeps the message it already holds.
    const [other] = matchArrivals(
      {
        forwarded: [],
        deposited: [
          { secretHash: await hash(6n, 0), version: 6n, amount: 3n, inboxIndex: 77n, txHash: '0xd9' },
        ],
      },
      candidates,
      here,
    ) as [Arrived];
    const stored = landed(unanswered, dep, 3_000);
    expect(twinOf(stored, other, 4_000)).toMatchObject({
      id: `${stored.id}:6:77`,
      inboxIndex: '77',
      state: 'deposited',
      l1TxHash: '0xd9',
    });
    expect(twinOf(stored, dep, 4_000)).toBeUndefined();
    expect(twinOf(unanswered, other, 4_000)).toBeUndefined();
    // A held send's amount was fixed at its burn: a forwarded message of another amount under its
    // index is another device's send, left where it is and given its own row.
    const held: Crossing = {
      ...(found[0] as Crossing),
      state: 'held',
      inboxIndex: undefined,
      target: undefined,
      l1TxHash: undefined,
    };
    expect(landed(held, send, 5_000)).toMatchObject({ state: 'forwarded', inboxIndex: '41' });
    const [nine] = matchArrivals(
      {
        forwarded: [{ ...arrivals.forwarded[0], amount: 9n, inboxIndex: 52n, txHash: '0xf9' } as never],
        deposited: [],
      },
      candidates,
      here,
    ) as [Arrived];
    expect(landed(held, nine, 5_000)).toBe(held);
    expect(twinOf(held, nine, 5_000)).toMatchObject({
      id: `${held.id}:6:52`,
      amount: '9',
      state: 'forwarded',
    });
    // A send forwarded into another version is not an arrival here.
    const elsewhere = matchArrivals(arrivals, candidates, { ...here, current: 7n });
    expect(elsewhere.map((a) => a.crossing(1).kind)).toEqual([3]);
    // The next window starts where this one ended.
    const later = await arrivalCandidates(master, scope, { sources: [], current: 6n }, 3, 3);
    expect(later.map((x) => x.index)).toEqual([3, 4, 5]);
  });
});
