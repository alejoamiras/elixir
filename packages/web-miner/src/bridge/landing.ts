// What waits for an account on the version it just signed into: send-aheads forwarded from an
// earlier version and deposits from Ethereum, both found by the secret hash the account's master
// derives — under the source version's labels for the former, this version's for the latter —
// against the portal's events. Nothing is claimed here: each is a card with a Claim on it.
import type { EthAddress } from '@aztec/foundation/eth-address';
import type { Hex } from 'viem';
import { type Crossing, crossingId } from '../../../bridge/src/journal.ts';
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
 * The secret hashes this master may have committed to: `window` indices under each earlier version
 * (send-aheads) and under this one (deposits).
 */
export async function arrivalCandidates(
  master: Uint8Array,
  scope: { chainId: bigint; portal: EthAddress },
  versions: { sources: bigint[]; current: bigint },
  window = SCAN_WINDOW,
): Promise<ArrivalCandidate[]> {
  const out: ArrivalCandidate[] = [];
  const under = async (version: bigint, kind: 2 | 3) => {
    for (let index = 0; index < window; index++) {
      const s = await deriveCrossingSecrets(master, { ...scope, version }, index);
      out.push({ kind, version, index, secretHash: hex32(s.secretHash).toLowerCase() as Hex });
    }
  };
  for (const v of versions.sources) await under(v, 2);
  await under(versions.current, 3);
  return out;
}

export type Arrivals = Awaited<ReturnType<PortalReader['arrivals']>>;

/**
 * The candidates the portal's events answer, as crossings in the state the event puts them in;
 * those the journal already holds keep their record (a claim may be further along).
 */
export function matchArrivals(
  arrivals: Arrivals,
  candidates: ArrivalCandidate[],
  journal: Crossing[],
  scope: { chainId: string; portal: Hex },
  now: number,
): Crossing[] {
  const known = new Map(journal.map((c) => [c.id, c]));
  const bySecret = new Map(candidates.map((c) => [`${c.kind}:${c.secretHash.toLowerCase()}`, c]));
  const found: Crossing[] = [];
  const push = (c: ArrivalCandidate, patch: Partial<Crossing>, state: Crossing['state']) => {
    const base = {
      kind: c.kind,
      chainId: scope.chainId,
      portal: scope.portal,
      version: c.version.toString(),
      index: c.index,
    };
    const id = crossingId(base);
    found.push(
      known.get(id) ?? {
        ...base,
        id,
        amount: '0',
        state,
        createdAt: now,
        updatedAt: now,
        ethAddress: `0x${'00'.repeat(20)}`,
        ...patch,
      },
    );
  };
  for (const f of arrivals.forwarded) {
    const c = bySecret.get(`2:${f.secretHash.toLowerCase()}`);
    if (c && c.version === f.source)
      push(
        c,
        {
          amount: f.amount.toString(),
          target: f.target.toString(),
          inboxIndex: f.inboxIndex.toString(),
          l1TxHash: f.txHash,
        },
        'forwarded',
      );
  }
  for (const d of arrivals.deposited) {
    const c = bySecret.get(`3:${d.secretHash.toLowerCase()}`);
    if (c && c.version === d.version)
      push(
        c,
        { amount: d.amount.toString(), inboxIndex: d.inboxIndex.toString(), l1TxHash: d.txHash },
        'deposited',
      );
  }
  return found;
}
