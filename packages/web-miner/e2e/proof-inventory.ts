// What each test must have proved in the browser, by title. The meter (fixtures.ts) counts the
// prover's `client-ivc-proof-generation` events off the page console; a passing test that shows
// fewer well-formed events than listed here fails, and a title missing from the list fails too, so
// a collector that silently stops seeing events cannot hide behind zeros. Keep it free of imports:
// bun's unit tests and Playwright's Node loader both read it.

export interface ProofEvent {
  /** The prover's own duration for the proof; NaN when the event carried none. */
  durationMs: number;
  at: number;
}
export interface SendRecord {
  startedAt: number;
  endedAt: number;
}
export interface ProofMeter {
  proofs: ProofEvent[];
  /** Every `aztec_sendTx` round trip the page made. */
  sends: SendRecord[];
}

/** The minimum number of browser transaction proofs each test completes when it passes. */
export const EXPECTED_PROOFS: Readonly<Record<string, number>> = {
  // miner.e2e.ts
  'first visit creates an account, mines at the easy target, claims and shows the balance': 2,
  'a poisoned CRS cache is purged before proving': 1,
  'a malformed RPC payload is rejected, not acted on': 0,
  'three power changes keep mining, the ledger grows, memory stays bounded': 0,
  'a prover crash surfaces as an error and mining restarts on the next start': 0,
  'the pop-out draws with the page fonts and its own loop': 0,
  // passkey.e2e.ts
  'a passkey account: create, mine, claim, reload with one touch, the balance follows the account': 1,
  'a known account whose passkey is gone does not open; the record stays': 0,
  // states.e2e.ts: the reverted claim, then the one that mints, after the first
  'the node going away pauses mining after a minute; its return resumes it': 0,
  'a lost race: the claim reverts, the chain view is rebuilt, the next claim mints, the balance survives': 3,
  // withdraw.e2e.ts: one claim, two transfers
  'withdraw: private to a second key on this device, public to an address': 3,
  // words.e2e.ts, opening.e2e.ts, dialog-geometry.e2e.ts: the impossible target or no mining at all
  'a words account: create, quiz, mine, sign out, restore, same address': 0,
  'a cancel mid-opening returns to signed out; the account opens on the next try': 0,
  'the sign-in screens and their error state fit the dialog at 720 px tall': 0,
  // switch.e2e.ts
  'a live switch A → B while mining, a claim after it, and the banner on a dead node': 1,
  // presto.e2e.ts: the claim is the page's, whichever prover found the ticket
  'through Presto: the pill says ✦ presto after the first native proof, and power is Presto’s': 0,
  'a win Presto proved is verified in the browser before it shows, then claimed; the proof went over the wire': 1,
  'nothing answers: the billboard invites the install and the browser proves without the suffix': 0,
  'an old Presto answers: the update row, and Retry re-asks': 0,
};

export const wellFormed = (p: ProofEvent): boolean => Number.isFinite(p.durationMs) && p.durationMs > 0;

/** Why a passed test's meter does not satisfy the inventory, or null when it does. */
export function proofShortfall(title: string, meter: ProofMeter): string | null {
  const expected = EXPECTED_PROOFS[title];
  if (expected === undefined) return `"${title}" is not in the proof inventory (e2e/proof-inventory.ts)`;
  const good = meter.proofs.filter(wellFormed).length;
  const malformed = meter.proofs.length - good;
  if (malformed > 0)
    return `"${title}": ${malformed} proof event(s) without a positive duration — the collector is reading the wrong thing`;
  if (good < expected)
    return `"${title}": ${good} browser proof event(s) seen, ${expected} expected — the prover's console events did not reach the meter`;
  return null;
}
