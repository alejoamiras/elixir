# Phase 4 — The claim

Arc 3 (`polish-mine`, stacks on `polish-account`). Started 2026-09-15. Commits `a461c88` (the build) and
`f29b8ab` (the stale verdict from the chain; the gate's spec fixes).

## What was built

- **One clock from the win (§9.2.20).** `ClaimProgress.wonAt` is set once at `winner`/`retry`; the loop tile's
  header carries ui's `ClaimChip` (`claiming · proving · 12 s` → `sent` → `in a block`), the seconds counted
  from the win across the steps; Stop pressed meanwhile marks the state `stopping` (`stopping · claim
  finishing · 61 s`, Stop spent). `controller.stop()` now dispatches `stop` during a claim too, after setting
  `stopAfterClaim`; the reducer keeps the phase and sets the mark.
- **The claim on its win line.** `ClaimProgress.lineId` points at the last win's ledger line; the reducer
  annotates that line (`LedgerLine.claim: ClaimNote`) with the step (the sent step's expiry for the countdown),
  then the outcome. `claim-copy.ts` turns the note into the canvas sentences (`winNote`), ticking on
  `nowAtom`; ui's `ProofLine` win lines take a `note` and an `action` the ledger answers by id. The expired
  and failed cards are gone: the line says it.
- **The seven outcomes** (`miner-core/claim-failure.ts` rewritten): minted ("minted in block N · 4 tYACA,
  privately", the settlement suffix once the bridge session reads it); reverted with the cause verified
  (stale — "the epoch closed first" — when the chain's open epoch moved past the claimed one or the message
  says "stale claim"; another reason quoted when the message gives one); refused at simulation ("epoch is not open": nothing sent, nothing paid, mining continues — the
  controller resumes); expired (the TTL from the send: "no block took it in 10 min"); delivery blocked (the
  wait learnt when `paused` lands: "claims wait for Ethereum's finality, about 38 min"); other ("claim failed:
  <first line> · mining paused" with **Retry**); discarded ("not claimed: the epoch closed before the claim
  went out", the win against a closed epoch).
- **Retry (§9.1.14).** An unclassified failure retains the ticket (`retained` with the tx hash when one was
  sent); `retryPendingClaim()` reconciles first — a sent claim found in a block by `getTxReceipt` is minted,
  never sent twice — else re-submits from idle. The ledger's Retry link and the canary's control share it.
- **The banners.** A lost race is a banner under the header: "A claim reverted: someone closed the epoch
  first. Re-syncing…" for the stale case, the brief's plain "Re-syncing this account from the chain; mining
  resumes in about a minute." for any other revert; the pause names its clock ("Mining resumes about 16:48")
  and drops "Use another account" (§9.2.12).
- **Settlement.** `ClaimRecord` keeps `txHash`, `nullifier`, `settled`; the bridge session's refresh settles at
  most eight pending mining claims per pass on the crossing's two readings: the block's checkpoint proven →
  `settled` ("· final"); the nullifier gone from a node past the block → `pruned` ("pruned: its epoch was
  never proven"). Without a bridge session the ✓ stays pending and the legend says "final once its epoch is
  proven".

## Decisions taken while building

- **Outcomes live on the win line; no ✗ doubles them.** The ✗ line is the fallback for a win that came without
  its attempt line (the fake-worker unit tests dispatch `winner` alone).
- **The delivery-blocked line learns its wait late.** The controller's pause lands after the recovery; the line
  reads "re-syncing, about a minute" until `paused` brings `waitMinutes`. The alternative (guessing the
  finality window at failure time) would print a number the controller has not computed.
- **Other reverts get the brief's plain banner**, the stale one the canvas's "someone closed the epoch first":
  the cause is verified, never assumed (see the chain verdict below).
- **Reconcile only when a hash exists**; covered by inspection and the recovery test's retained path, not a
  node-level unit test (the receipt read needs a node).
- **Pruned is a sentence, not a re-offer.** A closed epoch is never eligible again; the line says why.
- **The sent step's countdown uses the transaction's own expiry** (`expiresAt` from the send), so the isolated
  network's 30-minute TTL reads "drops in 29:34", production's ten minutes "9:41".
- **A stale revert is verified on the chain, not in the message.** The first chain run printed "didn't land: it
  reverted (unknown)": on Aztec 5.2.0 a mined revert's receipt carries no reason, so aztec.js writes
  "Reason: unknown" and the miner's "stale claim" never reaches the page. `revertCause` now yields no reason for
  that, and the controller decides `stale` by reading the open epoch after the revert (`epochClosedSince`:
  moved past the claimed one, the epoch closed first); the reducer takes the controller's verdict over the
  message (`failed.stale`). The line reads "didn't land: it reverted" when neither says anything.

## The gate

- Fast layers: lint clean; `bun test` 342 pass; ui Vitest 67; web-miner Vitest 103.
- Spec fixes found by the gate: the minted line's block link carries the screen-reader suffix "(opens in a new
  tab)" between the number and the separator, so `/minted in block [\d,]+ · 4 tYACA/` never matched
  (miner and canary specs); `run-suite.ts` passed Playwright bare file names, which are unanchored regexes —
  `states.e2e.ts` also ran `bridge-states.e2e.ts` in the chain shard (the run then failed "not a bridge-mode
  run" and the inventory check flagged it) — the patterns are now `/e2e/<file>$`.
- The chain shard's lost-race test needs the compiled work circuit (`packages/work-circuit/target/`, the burst
  miner's artifact); a fresh worktree has none: `bun run --cwd packages/work-circuit compile` (bytecode and
  ABI identical to the committed artifact).
- **Never run two web-miner e2e runs in parallel from one worktree.** They share `e2e/.dist` (rebuilt with
  `--emptyOutDir` at each start) and `e2e/.run.json`; a second run's build replaced the proverless bundle under
  the first (the meter then failed a passkey test for proving), and an interrupted run's teardown removed the
  other's run file and preview (withdraw and words failed for it). The reruns were then taken one at a time.
- Runs, each alone, on `f29b8ab` — green 2026-09-16:
  - `chain` proverless: 6 passed (6.9 min; the lost race 1.6 min, the line "didn't land: the epoch closed
    first", the banner "someone closed the epoch first").
  - `cockpit` proverless: 7 passed (5.0 min).
  - `canary` real: 4 passed (5.1 min; proving 53.6 s). The run before it failed `withdraw` once at the wallet's
    second Send: the button was clicked (focused) and the sheet never opened, while a full `bun test` was
    hammering the same machine — a re-open during the sheet's exit animation is the suspect; not reproduced
    alone. The P5 edits were already in the tree for this last canary (its build was taken after they landed).
- Earlier runs on `a461c88`: `cockpit` 6/7 (the regex) then 7/7; `canary` 4/4; `chain` blocked by the shard
  overlap and the missing circuit, then 5/6 on the "(unknown)" line.
