// What waits for an account on the version it just signed into: send-aheads forwarded from an
// earlier version and deposits from Ethereum, both found by the secret hash the account's master
// derives — under the source version's labels for the former, this version's for the latter —
// against the portal's events. Nothing is claimed here: each is a card with a Claim on it.
import type { EthAddress } from '@aztec/foundation/eth-address';
import type { Hex } from 'viem';
import { advance, type Crossing, crossingId, type Facts } from '../../../bridge/src/journal.ts';
import { deriveCrossingSecrets } from '../../../bridge/src/secrets.ts';
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
 * each earlier version (send-aheads) and under this one (deposits). A scan walks windows until one
 * answers nothing, as the exit scan does: an account's reservations do not stop at twenty.
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
 * The candidates the portal's events answer, as crossings in the state the event puts them in.
 * A crossing the journal holds keeps its record and learns the event through the reducer: a
 * deposit the wallet answered after the page closed moves on from `proving`; one already claimed
 * stays claimed. Only sends into `current` are arrivals here.
 */
export function matchArrivals(
  arrivals: Arrivals,
  candidates: ArrivalCandidate[],
  journal: Crossing[],
  scope: { chainId: string; portal: Hex; current: bigint },
  now: number,
): Crossing[] {
  const known = new Map(journal.map((c) => [c.id, c]));
  const bySecret = new Map(candidates.map((c) => [`${c.kind}:${c.secretHash.toLowerCase()}`, c]));
  const found: Crossing[] = [];
  const push = (c: ArrivalCandidate, amount: bigint, fact: Arrival) => {
    const base = {
      kind: c.kind,
      chainId: scope.chainId,
      portal: scope.portal,
      version: c.version.toString(),
      index: c.index,
    };
    const id = crossingId(base);
    const held = known.get(id);
    const record: Crossing = held ?? {
      ...base,
      id,
      amount: amount.toString(),
      state: 'proving',
      createdAt: now,
      updatedAt: now,
      ethAddress: `0x${'00'.repeat(20)}`,
    };
    found.push(BEFORE_ARRIVAL.has(record.state) ? advance(record, { now, ...fact }) : record);
  };
  for (const f of arrivals.forwarded) {
    const c = bySecret.get(`2:${f.secretHash.toLowerCase()}`);
    if (c && c.version === f.source && f.target === scope.current)
      push(c, f.amount, {
        forwarded: { txHash: f.txHash, inboxIndex: f.inboxIndex.toString(), target: f.target.toString() },
      });
  }
  for (const d of arrivals.deposited) {
    const c = bySecret.get(`3:${d.secretHash.toLowerCase()}`);
    if (c && c.version === d.version)
      push(c, d.amount, { deposited: { txHash: d.txHash, inboxIndex: d.inboxIndex.toString() } });
  }
  return found;
}
