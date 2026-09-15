# Round 3 — the targeted round on v4/v4.1, after the owner's picks (2026-09-15)

Scope: only what changed after the owner's review (§7 Picked, §10): the Presto banners, the claiming chip and the
missed-claim line, the tiered node row, hold-to-sign-out, the Settings slider line, the checksum error. Both
reviewers were asked to check the new copy against the code before judging the boards. Codex (session
`01a0a555…`, round 4 with the v4.1 renders attached) and a Fable reviewer (`fable-3.md`) both said **REVISE**;
every finding was checked against the code and v4.2 applies them as below.

## Codex, round 4 (five findings, all verified)

| # | Sev | Finding | Checked | Verdict · v4.2 |
|---|---|---|---|---|
| 1 | medium | "A claim that misses" was assigned "the epoch closed first"; the code has five failure classes and a revert is not proof of a race. | `claim-failure.ts`: `reverted` / `expired` / `delivery-blocked` / `other`; `controller.ts` `claimFailed`. Confirmed. | **accept**. One line per class (§5.3, board ClaimOutcomes); the stale-epoch sentence only for `reverted`; `other` shows the error's first line with Retry. |
| 2 | medium | MinePrestoBlocked promised the browser but disabled Start mining; Retry only retried Presto. | `boards_mine.py` drew `uv sm dis`; `startMining()` starts at once and probes beside it. Confirmed. | **accept**. Start never waits for the probe; the board is the live cockpit under its banner (§9.2.13). |
| 3 | medium | `healthy` had no freshness condition: a prompt node with an old tip passed. | `node.ts` `probeNode` measures block age and latency, rejects nothing. Confirmed. | **accept**. `healthy` needs a tip under a minute old; `behind · 4 min` otherwise, and it pauses mining (§5.7, §9.2.19). |
| 4 | low | Presto copy beyond its evidence: "installed" from a browser refusal; an update for a malformed answer; no Retry on the bad-report probe; "its speed is set in the Presto app". | `presto.ts` `causeText`/`statusText`/`noticeFor`. Confirmed. | **accept**. Rewritten to the code's lines; the Presto row says "proving on this machine · About Presto ↗"; the slider line "This slider affects browser proving only". |
| 5 | low | §5.8 said "releasing cancels"; after the fill, the release confirms. | `HoldButton`: completion arms, the release confirms, early release cancels. Confirmed. | **accept**. "Releasing before it fills cancels, releasing after it fills signs out." |

## Fable, round 3 (thirteen findings)

| # | Sev | Finding | Checked | Verdict · v4.2 |
|---|---|---|---|---|
| 1 | high | Start mining disabled under the blocked banner. | As Codex 2. | **accept** (as above). |
| 2 | high | Five claim outcomes, and the recovery states of the deleted ClaimSlot had no home; `other` halts mining on a raw string; a win discarded before its claim has no line. | `claimFailed`: `expired` resumes, `reverted` rebuilds, `delivery-blocked` after a rebuild pauses until finality, `other` returns without resuming; `'discard'` logs only. Confirmed. | **accept, in part**. A line per outcome and the two banners (recovering; claims paused until finality); `other` is defect §9.1.14. Not "Use another account": one slot per browser (§9.2.12). |
| 3 | medium | Chip and row collapsed the three steps and dropped the TTL. | `ClaimStatus.tsx` proving → sent ("drops in m:ss if not included") → waiting. Confirmed. | **accept**. Both carry the step; one clock from the win (§9.2.20). |
| 4 | medium | 6A keyed on `active` flaps on a transient refusal. | `presto-prover.ts` reports `wasm, sticky:false` per refusal; `controller.ts` sets `active` on every message. Confirmed. | **accept**. The swap follows the sticky state (§9.2.18). |
| 5 | medium | No `behind` state; a stale node mines a closed epoch until the claim fails at simulation. | As Codex 3. | **accept**. `behind` pauses mining; the throttled row says the offline pause comes after a minute. |
| 6 | medium | 5B removed the only path for voice control and switch access; sign out (`location.reload()`) cuts a claim off. | `session.ts` sign-out reloads; `HoldButton` keyboard hold works. Confirmed. | **accept, flagged for the owner**. The click path appears after a hold released early (board SignOutHoldAfter), never at rest; the hold waits for a claim (SignOutHoldClaiming). The owner picked 5B without the line: this is the accessibility exception, theirs to veto. |
| 7 | medium | Settings' Presto row said "not installed" before any probe; encryption off reads as absent. | `prestoAtom.status` is null until the probe. Confirmed. | **accept**. "checked when you start mining", then "not found" / "connected ✦" / the banner's reason. |
| 8 | medium | Invented facts in PrestoReasons (downloading, permission-blocked, malformed, cooldown). | As Codex 4; `prove()` awaits the download. Confirmed. | **accept**. |
| 9 | low | "Open Presto ↗" opens nothing. | `PrestoBanner.tsx` links presto.build; no URL scheme. Confirmed. | **accept**. "About Presto ↗". |
| 10 | low | The checksum error counted words. | — | **accept**. "These 12 words don't form a valid phrase. Check each word, and their order, against what you saved." |
| 11 | low | A power change under Presto rebuilds the prover for nothing. | `controller.ts` `reconfigure` compares threads and the endpoint only. Confirmed. | **accept**. Defect §9.1.15. |
| 12 | low | The idle ledger says epoch 11 under a tile on epoch 12. | Boards. | **accept**. |
| 13 | low | Stop during a claim gives no feedback. | `stop()` sets `stopAfterClaim` only. Confirmed. | **accept**. `stopping · claim finishing · 61 s`, Stop dimmed. |

## What v4.2 is

Boards: ClaimOutcomes (new), SignOutHoldAfter and SignOutHoldClaiming (new), MinePrestoBlocked (live under its
banner), MineMining and MineIdle (the chip's step, the ledger on epoch 12), MinePresto (the row without the speed
claim), PrestoReasons, Settings, NodeStates (`behind`), WordsLogInChecksum. Brief: the v4.2 paragraph, §5.3,
§5.7, §5.8, §9.1.14–15, §9.2.13 and 18–21, §10's third table. 95 artboards, up from 92.

Not re-reviewed after this: the blueprint's own dual audit reads the brief and the canvas next.
