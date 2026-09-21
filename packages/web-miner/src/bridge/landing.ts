// What waits for an account on the version it just signed into: send-aheads forwarded from an
// earlier version and deposits from Ethereum, both found by the secret hash the account's master
// derives — under the source version's labels for the former, this version's for the latter —
// against the portal's events. Nothing is claimed here: each is a card with a Claim on it.
import type { EthAddress } from '@aztec/foundation/eth-address';
import { advance, type Crossing, crossingId, destinationOf, type Facts } from '@yacana/bridge/journal';
import { deriveCrossingSecrets } from '@yacana/bridge/secrets';
import { leafIdOf } from '@yacana/bridge/signatures';
import type { Hex } from 'viem';
import type { PortalReader } from './eth.ts';
import { SCAN_WINDOW } from './store.ts';

export interface ArrivalCandidate {
  kind: 2 | 3;
  /** The version whose labels derived the secret: the source of a send-ahead, the destination of a deposit. */
  version: bigint;
  index: number;
  secretHash: Hex;
}

const hex32 = (v: { toString(): string }): Hex => v.toString() as Hex;

/**
 * The secret hashes this master may have committed to: the `window` indices from `from` under
 * each earlier version (send-aheads) and under this one (deposits). The session walks windows up
 * to its bound; only this version's chain can say where the account's indices end.
 */
export async function arrivalCandidates(
  master: Uint8Array,
  scope: { chainId: bigint; portal: EthAddress },
  versions: { sources: bigint[]; current: bigint },
  window = SCAN_WINDOW,
  from = 0,
): Promise<ArrivalCandidate[]> {
  const out: ArrivalCandidate[] = [];
  const under = async (version: bigint, kind: 2 | 3) => {
    for (let index = from; index < from + window; index++) {
      const s = await deriveCrossingSecrets(master, { ...scope, version }, index);
      out.push({ kind, version, index, secretHash: hex32(s.secretHash).toLowerCase() as Hex });
    }
  };
  for (const v of versions.sources) await under(v, 2);
  await under(versions.current, 3);
  return out;
}

export type Arrivals = Awaited<ReturnType<PortalReader['arrivals']>>;

/** The event describes a fact the reducer applies to a record that has not reached it yet. */
type Arrival =
  | { forwarded: NonNullable<Facts['forwarded']> }
  | { deposited: NonNullable<Facts['deposited']> };

/** One of this account's crossings the portal's events answer: the record as if new, and the fact. */
export interface Arrived {
  id: string;
  amount: bigint;
  fact: Arrival;
  /** The version the message is in the Inbox of; with the Inbox index it names the message. */
  destination: string;
  /** A forwarded send's leaf on its source version: the one name a witnessed send answers to. */
  leaf?: { epoch: bigint; leafId: bigint };
  /** The record for a journal that does not hold it: created now, the event already applied. */
  crossing(now: number): Crossing;
}

const inboxOf = (a: Arrived): string =>
  'forwarded' in a.fact ? a.fact.forwarded.inboxIndex : a.fact.deposited.inboxIndex;

/**
 * Whether the arrival is the message the stored row stands for. A row that knows its message (an
 * Inbox index on a destination) is that message and no other; a witnessed send is its leaf; a
 * send not yet witnessed is known by its amount alone (fixed at the burn), so another amount under
 * its index is another device's send; a deposit still waiting on the wallet is whatever Ethereum
 * answers for its index.
 */
export function sameMessage(stored: Crossing, a: Arrived): boolean {
  if (stored.inboxIndex !== undefined)
    return stored.inboxIndex === inboxOf(a) && destinationOf(stored) === a.destination;
  if (stored.kind !== 2) return true;
  if (stored.witness && a.leaf) {
    const w = stored.witness;
    return (
      BigInt(w.epoch) === a.leaf.epoch &&
      leafIdOf({ path: w.path, leafIndex: BigInt(w.leafIndex) }) === a.leaf.leafId
    );
  }
  return stored.amount === a.amount.toString();
}

/** The states a record can be in before the portal's event reached it; a later one is not moved back. */
const BEFORE_ARRIVAL = new Set<Crossing['state']>([
  'proving',
  'sent',
  'proven-pending',
  'witnessed',
  'paused',
  'headroom',
  'ready',
  'held',
  'not-registered',
]);

/**
 * The arrival applied to the record as stored: one that has not reached the event learns it
 * through the reducer — a deposit the wallet answered after the page closed moves on from
 * `proving`, at the amount Ethereum saw — and one further along (claimed, say) is left alone.
 */
export function landed(stored: Crossing | undefined, a: Arrived, now: number): Crossing {
  if (!stored) return a.crossing(now);
  if (!sameMessage(stored, a)) return stored;
  // A deposit that gave itself up is revived by its event: Ethereum had it after all.
  const given = stored.kind === 3 && stored.state === 'dropped';
  if (!given && !BEFORE_ARRIVAL.has(stored.state)) return stored;
  const record =
    stored.state === 'proving' || given
      ? { ...stored, state: 'proving' as const, amount: a.amount.toString() }
      : stored;
  return advance(record, { now, ...a.fact });
}

/**
 * A message under an index the journal already holds for another message (two devices of one
 * account derived the same index): its own row, keyed by the message, so nothing that arrived is
 * hidden behind the first. Undefined when the arrival is the stored message.
 */
export function twinOf(stored: Crossing, a: Arrived, now: number): Crossing | undefined {
  if (sameMessage(stored, a)) return undefined;
  const twin = a.crossing(now);
  return { ...twin, id: `${twin.id}:${a.destination}:${inboxOf(a)}` };
}

/** The candidates the portal's events answer. Only sends into `current` are arrivals here. */
export function matchArrivals(
  arrivals: Arrivals,
  candidates: ArrivalCandidate[],
  scope: { chainId: string; portal: Hex; current: bigint },
): Arrived[] {
  const bySecret = new Map(candidates.map((c) => [`${c.kind}:${c.secretHash.toLowerCase()}`, c]));
  const found: Arrived[] = [];
  const push = (c: ArrivalCandidate, amount: bigint, fact: Arrival, leaf?: Arrived['leaf']) => {
    const base = {
      kind: c.kind,
      chainId: scope.chainId,
      portal: scope.portal,
      version: c.version.toString(),
      index: c.index,
    };
    const id = crossingId(base);
    found.push({
      id,
      amount,
      fact,
      destination: 'forwarded' in fact ? fact.forwarded.target : c.version.toString(),
      ...(leaf ? { leaf } : {}),
      crossing: (now) =>
        advance(
          {
            ...base,
            id,
            amount: amount.toString(),
            state: 'proving',
            createdAt: now,
            updatedAt: now,
            ethAddress: `0x${'00'.repeat(20)}`,
          },
          { now, ...fact },
        ),
    });
  };
  for (const f of arrivals.forwarded) {
    const c = bySecret.get(`2:${f.secretHash.toLowerCase()}`);
    if (c && c.version === f.source && f.target === scope.current)
      push(
        c,
        f.amount,
        { forwarded: { txHash: f.txHash, inboxIndex: f.inboxIndex.toString(), target: f.target.toString() } },
        { epoch: f.epoch, leafId: f.leafId },
      );
  }
  for (const d of arrivals.deposited) {
    const c = bySecret.get(`3:${d.secretHash.toLowerCase()}`);
    if (c && c.version === d.version)
      push(c, d.amount, { deposited: { txHash: d.txHash, inboxIndex: d.inboxIndex.toString() } });
  }
  return found;
}
