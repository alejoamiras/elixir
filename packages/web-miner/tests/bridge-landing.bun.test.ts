import { describe, expect, test } from 'bun:test';
import { EthAddress } from '@aztec/foundation/eth-address';
import type { Crossing } from '../../bridge/src/journal.ts';
import { deriveCrossingSecrets } from '../../bridge/src/secrets.ts';
import type { Arrivals } from '../src/bridge/landing.ts';
import { arrivalCandidates, matchArrivals } from '../src/bridge/landing.ts';

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
    const found = matchArrivals(arrivals, candidates, [], here, 1_000);
    expect(found.map((c) => [c.kind, c.version, c.index, c.state, c.inboxIndex, c.amount])).toEqual([
      [2, '5', 1, 'forwarded', '41', '7'],
      [3, '6', 0, 'deposited', '44', '3'],
    ]);
    expect(found[0]?.target).toBe('6');
    // A crossing the journal knows keeps its own record, however far along.
    const claimed: Crossing = { ...(found[0] as Crossing), state: 'minted-l2', claimTxHash: '0xc' };
    const again = matchArrivals(arrivals, candidates, [claimed], here, 2_000);
    expect(again[0]).toBe(claimed);
    // A deposit the wallet answered after the page closed is still `proving` in the journal: the event moves it on.
    const unanswered: Crossing = {
      ...(found[1] as Crossing),
      state: 'proving',
      inboxIndex: undefined,
      l1TxHash: undefined,
    };
    const answered = matchArrivals(arrivals, candidates, [unanswered], here, 3_000);
    expect(answered[1]).toMatchObject({
      state: 'deposited',
      inboxIndex: '44',
      l1TxHash: '0xd1',
      updatedAt: 3_000,
    });
    // A send forwarded into another version is not an arrival here.
    const elsewhere = matchArrivals(arrivals, candidates, [], { ...here, current: 7n }, 1_000);
    expect(elsewhere.map((c) => c.kind)).toEqual([3]);
    // The next window starts where this one ended.
    const later = await arrivalCandidates(master, scope, { sources: [], current: 6n }, 3, 3);
    expect(later.map((x) => x.index)).toEqual([3, 4, 5]);
  });
});
