// What a failed claim means, from the error the SDK throws. The distinction decides the recovery.
// After a claim reverted in public (a stale claim), the PXE keeps a pending note-delivery index
// for a sequence nullifier that never landed, and every later claim's constrained delivery asserts
// it ("unknown nullifier") until the reverted tx is FINALIZED on L1 (tens of minutes). An expiry
// means nothing happened; anything else is shown as is.
export type ClaimFailure = 'reverted' | 'expired' | 'delivery-blocked' | 'other';

// aztec.js `waitForTx`: "Transaction 0x… was dropped. Reason: …" and
// "Transaction 0x… reverted: app_logic_reverted. Reason: …"; the stuck delivery index surfaces as
// a nullifier read failure at simulation.
const EXPIRED = /\bwas dropped\b|\bexpired\b|\binclude_by_timestamp\b/i;
const REVERTED = /\breverted\b|_reverted\b/i;
const DELIVERY_BLOCKED = /unknown nullifier|Nullifier read request/i;

export const claimFailureMessage = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).split('\n')[0] ?? '';

export function classifyClaimFailure(e: unknown): ClaimFailure {
  const m = e instanceof Error ? e.message : String(e);
  if (DELIVERY_BLOCKED.test(m)) return 'delivery-blocked';
  if (EXPIRED.test(m)) return 'expired';
  if (REVERTED.test(m)) return 'reverted';
  return 'other';
}

export const CLAIM_FAILURE_COPY: Record<ClaimFailure, { title: string; body: string }> = {
  reverted: {
    title: 'claim reverted',
    body: 'Someone closed the epoch first. Your claim landed after it closed. The sponsor paid the fee; your proof is unspent. You lost a race with another miner. Re-syncing this key from the chain…',
  },
  'delivery-blocked': {
    title: 'claim reverted',
    body: 'A claim from this key reverted earlier and its note delivery is stuck. You lost a race with another miner. Re-syncing this key from the chain…',
  },
  expired: {
    title: 'claim expired',
    body: 'The claim took longer than its time-to-live and was dropped. Nothing was paid, nothing was minted. This happens on a slow device or a congested network. Mining continues.',
  },
  other: { title: 'claim failed', body: '' },
};

/** Seconds until an L2 block is final on L1, from the rollup's constants: the pause after a failed reset. */
export const finalitySeconds = (c: {
  slotDuration: number;
  epochDuration: number;
  proofSubmissionEpochs: number;
}): number => (c.proofSubmissionEpochs + 1) * c.epochDuration * c.slotDuration;
