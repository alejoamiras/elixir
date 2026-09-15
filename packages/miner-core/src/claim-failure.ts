// What a failed claim means, from the error the SDK throws. The distinction decides the recovery.
// After a claim reverted in public (a stale claim), the PXE keeps a pending note-delivery index
// for a sequence nullifier that never landed, and every later claim's constrained delivery asserts
// it ("unknown nullifier") until the reverted tx is FINALIZED on L1 (tens of minutes). An expiry
// means nothing happened; a refusal at simulation was never sent or paid; anything else is shown as is.
export type ClaimFailure = 'reverted' | 'refused' | 'expired' | 'delivery-blocked' | 'other';

// The node refuses or evicts an expired claim with the validator's "Invalid expiration timestamp"
// (`@aztec/stdlib` error_texts); aztec.js `waitForTx` reports "Transaction 0x… was dropped.
// Reason: …" and "Transaction 0x… reverted: app_logic_reverted. Reason: …". A drop for any other
// reason (a duplicate nullifier, an invalid proof) is not an expiry. The stuck delivery index
// surfaces as a nullifier read failure at simulation. The miner's "epoch is not open" is its
// private check (`main.nr`), failed at simulation before anything was proved or sent.
const EXPIRED = /Invalid expiration timestamp|\bexpired\b|\binclude_by_timestamp\b/i;
const REVERTED = /\breverted\b|_reverted\b/i;
const REFUSED = /epoch is not open/i;
const DELIVERY_BLOCKED = /unknown nullifier|Nullifier read request/i;
/** The miner's public check (`main.nr`): the epoch closed between the send and the block. */
const STALE = /stale claim/i;

export const claimFailureMessage = (e: unknown): string =>
  (e instanceof Error ? e.message : String(e)).split('\n')[0] ?? '';

export function classifyClaimFailure(e: unknown): ClaimFailure {
  const m = e instanceof Error ? e.message : String(e);
  if (DELIVERY_BLOCKED.test(m)) return 'delivery-blocked';
  if (EXPIRED.test(m)) return 'expired';
  if (REFUSED.test(m)) return 'refused';
  if (REVERTED.test(m)) return 'reverted';
  return 'other';
}

/**
 * Why a claim reverted, verified from the message: `stale` for the miner's own "stale claim" (the
 * epoch closed first), else the reason after the SDK's "Reason:" (or the whole first line).
 */
export function revertCause(message: string): { stale: true } | { stale: false; reason: string } {
  if (STALE.test(message)) return { stale: true };
  const reason = /Reason:\s*(.+)$/.exec(message.split('\n')[0] ?? '')?.[1]?.trim();
  return { stale: false, reason: reason || claimFailureMessage(message) };
}

/** Seconds until an L2 block is final on L1, from the rollup's constants: the pause after a failed reset. */
export const finalitySeconds = (c: {
  slotDuration: number;
  epochDuration: number;
  proofSubmissionEpochs: number;
}): number => (c.proofSubmissionEpochs + 1) * c.epochDuration * c.slotDuration;
