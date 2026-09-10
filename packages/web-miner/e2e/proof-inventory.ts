// The suite's inventory: each spec file's test titles and the browser transaction proofs a pass
// necessarily makes. The meter fails a passing test under its floor or off the list; the runner and
// the merge compare executed titles against it; a unit test holds it to the sources. Titles are the
// identity, so they must be unique across files (the unit test asserts it). No imports: bun and
// Playwright's loader both read this file.

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

/** Spec file → test title → the browser proofs a pass necessarily made (a floor: the easy target keeps winning). */
export const INVENTORY: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  'miner.e2e.ts': {
    'first visit creates an account, mines at the easy target, claims and shows the balance': 2,
    'a poisoned CRS cache is purged before proving': 1,
    'three power changes keep mining, the ledger grows, memory stays bounded': 0,
    'a prover crash surfaces as an error and mining restarts on the next start': 0,
    'the pop-out draws with the page fonts and its own loop': 0,
  },
  'passkey.e2e.ts': {
    'a passkey account: create, mine, claim, reload with one touch, the balance follows the account': 1,
    'a known account whose passkey is gone does not open; the record stays': 0,
  },
  // The reverted claim, then the one that mints, after the first.
  'states.e2e.ts': {
    'the node going away pauses mining after a minute; its return resumes it': 0,
    'a lost race: the claim reverts, the chain view is rebuilt, the next claim mints, the balance survives': 3,
  },
  // One claim, two transfers.
  'withdraw.e2e.ts': {
    'withdraw: private to a second key on this device, public to an address': 3,
  },
  'words.e2e.ts': {
    'a words account: create, quiz, mine, sign out, restore, same address': 0,
  },
  'opening.e2e.ts': {
    'a cancel mid-opening returns to signed out; the account opens on the next try': 0,
  },
  'switch.e2e.ts': {
    'a live switch A → B while mining, a claim after it, and the banner on a dead node': 1,
  },
  // The real-proving canary: a tampered claim refused at proving, the same ticket minting untampered.
  'canary.e2e.ts': {
    'a claim with a bound public input altered fails at proving; the same ticket untampered mints': 1,
  },
  // The claim is the page's, whichever prover found the ticket.
  'presto.e2e.ts': {
    'through Presto: the pill says ✦ presto after the first native proof, and power is Presto’s': 0,
    'a win Presto proved is verified in the browser before it shows, then claimed; the proof went over the wire': 1,
    'nothing answers: the billboard invites the install and the browser proves without the suffix': 0,
  },
};

export const SPEC_FILES: readonly string[] = Object.keys(INVENTORY);

/** The replay lane's tests (`e2e/replay/*.replay.ts`); sharded + `MOVED_TO_REPLAY` is the suite's original nineteen. */
export const REPLAYED: Readonly<Record<string, readonly string[]>> = {
  'dialog-geometry.replay.ts': ['the sign-in screens and their error state fit the dialog at 720 px tall'],
  'signed-out.replay.ts': [
    'a malformed RPC payload is rejected, not acted on',
    'an old Presto answers: the update row, and Retry re-asks',
    'the public epoch poll reads again from the recording, and nothing else',
  ],
};
export const MOVED_TO_REPLAY: readonly string[] = [
  'the sign-in screens and their error state fit the dialog at 720 px tall',
  'a malformed RPC payload is rejected, not acted on',
  'an old Presto answers: the update row, and Retry re-asks',
];

/** Title → floor, over every file. */
export const EXPECTED_PROOFS: Readonly<Record<string, number>> = Object.assign(
  {},
  ...Object.values(INVENTORY),
) as Record<string, number>;

/** The titles the given spec files hold; a file outside the inventory throws. */
export function titlesOf(files: readonly string[]): string[] {
  return files.flatMap((f) => {
    const titles = INVENTORY[f];
    if (!titles) throw new Error(`${f} is not in the inventory (e2e/proof-inventory.ts)`);
    return Object.keys(titles);
  });
}

export const wellFormed = (p: ProofEvent): boolean => Number.isFinite(p.durationMs) && p.durationMs > 0;

/**
 * Why a passed test's meter does not satisfy the inventory, or null when it does. Under a proverless
 * build the floors do not apply and any proof event at all means the build proved after all.
 */
export function proofShortfall(title: string, meter: ProofMeter, proverless = false): string | null {
  const expected = EXPECTED_PROOFS[title];
  if (expected === undefined) return `"${title}" is not in the proof inventory (e2e/proof-inventory.ts)`;
  if (proverless)
    return meter.proofs.length
      ? `"${title}": ${meter.proofs.length} proof event(s) from a build that was to skip proving`
      : null;
  const good = meter.proofs.filter(wellFormed).length;
  const malformed = meter.proofs.length - good;
  if (malformed > 0)
    return `"${title}": ${malformed} proof event(s) without a positive duration — the collector is reading the wrong thing`;
  if (good < expected)
    return `"${title}": ${good} browser proof event(s) seen, ${expected} expected — the prover's console events did not reach the meter`;
  return null;
}
