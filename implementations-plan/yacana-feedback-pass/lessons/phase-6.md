# Phase 6 — Settings, the memory on screen, and the proof

## What shipped

- Settings › Mining: the card first (`usePresto(session)` is the one reading, shared with the rail), the slider
  after it, `disabled` while Presto is remembered or proving with the sentence naming whose speed setting decides
  and what the threads are still for. `prestoWords` and `PrestoRow` are gone with their spec.
- `presto.e2e.ts` consents through the card: every existing title clicks Look for Presto first; three titles are
  new (`proof-inventory.ts` has their floors: 0, 0, 1).

## The gate (2026-09-21)

Fast layers: `FAST[p6a] ALL-GREEN` (lint, both typechecks, `bun test`, components, replay 9). Then
`E2E_PROVERLESS=0 E2E_SHARD=chain …`: `GATE[p6-chain] EXIT=0`, **12/12** (presto 7, states 3, switch 2), no
title skipped. The breakdown's evidence for the plan's three pass conditions:

| title | proofs | on Presto | reading |
|---|---|---|---|
| no request reaches Presto before the click … again resuming on open | 0 | — | the server log gained nothing and the context saw no request to Presto's port across load → sign-in → Start → first proof, then the resume-on-open reload |
| remembered: a reload opens on "used last time" and Start goes native with no click | 0 | — | under `granted` + the record: no request before Start, `native` after it, the card `proving` |
| a win Presto proved … both proofs went over the wire | 1 | 1 · 6.7 s | the transaction proof went to Presto after consent |
| use the browser: the next claim is proved in the page | 2 | — | 20.5 s of in-page proving; the claim after the click has `prover: 'wasm'`, no `/prove` POST after it |

## What the plan said and what shipped differently

- The "use the browser" title asserts the *claim's* prover (`lastClaim.prover === 'wasm'`, polled) rather than
  "the next mint": a claim Presto had in flight at the click may land first, and that is correct behaviour, not a
  leak — its proof left before the choice.
- The zero-requests witness is two-fold on purpose: Playwright does not report every Worker fetch, so the server
  log's growth is the evidence and `context.on('request')` the corroboration.
- The e2e's permission grant is `local-network-access` on the page's origin; on this Chromium the split
  `loopback-network` descriptor reads it as granted (as `lna.replay.ts` recorded).
- The inventory's count test grows by the three consent titles.

## Arc 2's codex loop (session 01a0c543-ad8f-7ba1-beae-fd006dd6a53a, GPT-6 Astra at high)

Started after the fast layers, while the chain shard ran (remote compute; the shard's result reached the loop
before round 2). **Round 1** — verdict "changes required: three material consent races", each reproduced by codex
with doubles against the real code, and each confirmed here by reading the orderings:

| # | Finding | Verdict | Why |
|---|---|---|---|
| 1 | A remembered tab's first probe still out; another tab revokes; the tab has nothing native to tear down, so `onConsentChange` moves nothing and the late answer installs the endpoint with consent false | **accepted** | True: `onConsentChange` only withdrew when `consentRev`, `status` or an endpoint stood. `probe()` now drops its answer unless consent still holds. Regression test with two tabs on the storage double; fails without the recheck |
| 2 | A Look waiting on a promotion's lock resumes after "use the browser" and captures the revision the pending revoke is about to move; revision equality reads as consent until the revoke commits (indefinitely under a held lock) | **accepted** | True on two counts: the wait was not cancellable and the latch kept `rev`. `lookForPresto` drops when the generation moved under its wait; the latched `read()` returns the record the revoke will write (`used: false, rev + 1`) for any record, so no held revision can equal it. Regression test with a queueing lock; fails without the gen check |
| 3 | A revoke during sign-in (after `startSession` built a native controller, before the session adopted it) reaches no controller; the adopted one mines natively with consent false | **accepted** | True: `withdrawNative` reads `this.controller`, undefined until adoption. `adoptController` revokes on adoption when consent is gone. **No unit test**: the adoption sits inside the sign-in path with a real wallet; stated to codex in round 2 |
| 4 (nit) | `verifyWin`'s doc did not name the invariant the identity short-cut rests on; the `Actions` comment narrated | **accepted** | One sentence added; one comment deleted |

Codex's independent checks of what I asked it to break (first-proof verification on locally built public inputs,
fresh proof buffers, the SDK's bounded health responses, the wallet prover born local, no dependency change) all
passed. Fix commit: 589425b. Fast layers on it: green (`FAST[p6fix2]`).

**Round 2** (resumed, on the fix diff) — verdict, quoted: "no new material findings". Three minors, all taken:
the adoption case *can* be unit-tested — `session-open.bun.test.ts` already injects the start step, so the
regression now lives there (the record revoked while the account opens, the adopted controller's log reads
`['revoke', 'start-local']`; fails without `adoptController`'s check); `adopt`'s doc comment had ended up above
the new helper; and the revoke's doc overclaimed — a subscriber sees the revision pass 1 → 2 → 1 during one
revoke (the write notifies before `finally` drops the latch), so `read()` is not always "the record the revoke
will write"; it is "a revision no page holds yet", which is the property that matters. Fix commit: 6453c07. Codex
confirmed the orderings I asked it to break in round 2 (a `storage` event during the attempt, a Look during
adoption, memory-authoritative consent under a pending revoke) and that the projected revision breaks no
consumer (`promote` compares the stored revision on purpose). Loop converged at round 2 of 3.

Rule for later: **a race review needs the machine's queues, not its states.** The unit suite covered every state
of the consent machine and none of the three races; all three were an await (`settled()`, the probe, the opening)
with a revoke landing inside it. When a design has "everything reads one function", the review question is
"what did each caller read *before* its await, and is it still true after?".

## Re-gate on the arc's final tree (2026-09-21, at 6453c07)

The fixes touch the session's consent paths the Presto suite drives, so the arc's gate ran again as written:
`FAST[p6final] ALL-GREEN`; `E2E_PROVERLESS=0 E2E_SHARD=chain …` → `GATE[p6-chain2] EXIT=0`, 12/12, the
seven Presto titles among them, no title skipped.
