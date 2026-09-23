# P4 · Classify, record, reconcile, schedule — lessons

## What changed
- `claim-failure.ts`: `anchor-pruned` (the node's "… possibly a reorg has occurred"), `lost` (`NO_EFFECTS`, the
  text `chain.ts` throws and the classifier reads), `landed-elsewhere` (a nullifier already in the tree).
- `claim-check.ts` (new): `fate`, `mintedBy`, `carrier` (the nullifier's block read with its transactions),
  `absentAt`, `canMint` (open epoch and retirement read from the miner's slots at a tip; an open epoch behind the
  ticket's is `unknown`, never closed), `checkpointedAt`. Every read that cannot answer says `unknown`.
- The controller keeps a record per failed win (`fore`, the one mining waits on; `watches`, wins that can no longer
  mint whose sends may still land or revert). Sends are recorded as they leave (the wallet's turn hook), each with
  its own expiry. One check at a time, in the plan's order: landed → reverted → the ticket's lifetime at `latest`
  → not minted only at `checkpointed` → a live send waits → an attempt. `adopted` settles a recorded win beside
  whatever the claim in hand is doing.
- The reducer owns the schedule (`recovery`, `retry-in`, `check`, `resume`): 5 s before the second attempt, 30 s
  before the third, then the three-tries line with Retry; checks 15 s apart, 60 s after five. Stop holds (no
  attempt, no resume, Retry stays); Start and Retry are one more attempt after a check; the page's own restarts
  leave a waiting win alone. `attemptScheduled` puts Stop on the cockpit and the mini window, and the pill says
  claiming.
- The lines of the canvas's Recover A, "not claimed: … before the claim landed" once something was sent.

## Facts
- The owner's two messages classify as `anchor-pruned` and `lost` (the fixtures carry them as the ledger showed them,
  hashes shortened there).
- **The plan's inference 3 was wrong.** A replay of a landed claim never reaches `sendTx`: the node's public
  simulation refuses it first, with `C++ simulation failed: AVM simulation failed: [R_NULLIFIER_INSERTION]
  UNRECOVERABLE ERROR! Nullifier collision: Attempted to emit duplicate siloed nullifier 0x2f59…` (captured from
  `live.test.ts`'s replay on the isolated network, which now asserts the classification). The classifier matches
  that and the validator's `Existing nullifier` (`Invalid tx: ${reason}`, `server.js:733` of the pinned node).
- The pinned node's receipt builder (`node_tx_receipt.js`) attaches the effect to every mined receipt asked for it;
  a tx it does not know is `DroppedTxReceipt('Tx dropped by P2P node')`. So "no effects" means the block was pruned
  between `waitForTx`'s poll and the effect read: the send is then pending, dropped or mined again elsewhere.
- The node's JSON-RPC client batches calls (`namespaceMethods: 'aztec'`): the e2e fault rewrites one element of a
  batch answer (`faultOnce` in `e2e/fixtures.ts`).
- `waitForTx`'s 1 s initial delay makes each minted attempt in `recovery.bun.test.ts` cost a second; the suite
  runs 35 cases in about 32 s, and three reruns (105) passed.

## Found on the self-review, fixed before the gate
- A win whose three attempts were all refused before sending (nothing sent), once its epoch closed at `latest`,
  was left "checking the chain for your claim" with nothing watching it: `letGo` now watches it, sent or not, until
  the checkpointed tip decides.
- A watched win's revert ran the revert recovery, whose rebuild then resumed mining the user had stopped:
  `revertOf` resumes only where mining would have gone on (it ran, or it waited on this win without a Stop), waits
  for the claim in flight first, and leaves the win for the next check if a switch or dispose came meanwhile.
- The resume after a released win started on the epoch atom, up to 10 s stale: it now reads first, and a Stop
  meanwhile wins.
- `start()` after `dispose()` could still dispatch into the shared store: refused.
- A switch or dispose landing during `notMinted`'s awaits dropped the check's verdict (the stale guard) after the
  controller had already let the win go: the reducer kept waiting on a win nobody held, so Start and Retry did
  nothing until a reload. A verdict that releases the win now reaches the reducer whatever came meanwhile (its
  resume is still guarded: deferred by the switch's pause, refused after dispose). The spec holds the
  checkpointed read, switches under it, and fails without the fix.
- The first shard run was stopped after the two new chain titles passed (pruned anchor 30.3 s, lost effects
  29.9 s) to take this fix; the gate below is on the fixed tree.

## Shards on 5445851
chain 14/14 (the two new titles 40.8 s and 34.3 s), cockpit 7/7, bridge 1/1, canary 4/5: the tamper case's
regex still expected the old log line `claim failed (other)`; P4 writes `claim failed (other, attempt 1)`. The
new canary title (pruned anchor under the real prover) passed in 49.0 s.

## Codex (arc 2)
Session `01a0cfc6-da16-7d22-9f35-737f9ae715d5`, effort `high`.

**Round 1**: six material, two minor; each checked against the code, each fixed with a spec that fails with
the fix reverted (8/8 in a mutation run).
1. A pause that came while a check read did not stop the attempt the check found due (`blocked` was read
   only when the check began): `checked` carries `blocked`, and the attempt waits for `unblocked`.
2. A Stop during a watched win's revert recovery was undone by the rebuild (the phase was `mining`, so
   `stopAfterClaim` stayed down): every Stop sets it. Found beside it: the revert's epoch read sat between
   the claim wait and the failure, so a win found in that gap would claim beside the rebuild; the read now
   comes first, and a pause defers the revert as a switch does.
3. The resume after a released win started on the closed epoch when its read failed: it waits for a good
   read (the next poll's), unless a Stop came between.
4. A switch during a watched win's checkpointed read consumed the watch without its line, which then said
   "checking" forever: the decision and its line go out together or not at all.
5. Liveness read the browser clock, so a clock ahead sent the win again beside a pending send: the latest
   block's time decides. A send the wallet did not see has no expiry and stays live while pending (the old
   fallback, browser time plus the TTL, could be early).
6. Space started an attempt where the button said Stop: `offersStop` is the one predicate for both.
7. (minor) Reads past their deadline outlived the drain: tracked in `inflightRead`.
8. (minor) Two comments rewritten.

Found by the new switch spec: `boot.ts` calls `endSwitch()` and `release('switch')` back to back, and the
second's check was swallowed by the first (blocked) one still settling, so after a switch nothing re-armed
the recovery. A check asked for while one runs now runs once after it.

## Gate
