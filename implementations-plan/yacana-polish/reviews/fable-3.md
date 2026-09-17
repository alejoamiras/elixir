# Fable round 3 — the v4/v4.1 changes after the owner's picks (2026-09-15)

Scope: §5.3, §5.7, §5.8, §7 Picked, §10; the render-v5 boards and the generators' copy, checked against the sources named per finding.

## High

**1 · MinePrestoBlocked: Start mining is disabled under the blocked banner.** `boards_mine.py` draws `presto-blocked` with `btn("Start mining", "uv sm dis")`. §5.3 says every fallback keeps mining in the browser; today `startMining()` starts at once and probes in the background (the probe's deadline is 60 s). As drawn, a browser permission for Presto gates the core action. Fix: Start never waits on the probe; the board is the live cockpit under the banner.

**2 · "claim didn't land: the epoch closed first" is one of five outcomes, and the recovery states the deleted ClaimSlot carried have no home.** `classifyClaimFailure`: `reverted` (fits `record_claim`'s "stale claim", but the sponsor paid and the page enters `recovering` — chain view rebuilt, mining paused a minute — then `paused` until L1 finality if still blocked, with "Use another account"); `expired` (`CLAIM_TTL_SECONDS` 600: dropped, nothing paid); `delivery-blocked`; `other`, which `halt`s mining with the raw error. Before any of that, `reducer.winner()` discards a win whose job's epoch changed (a log line): the chart draws the ring, the ledger says nothing. Fix: a ledger row per class — reverted "claim didn't land: the epoch closed first · re-syncing, about a minute"; expired "claim dropped: too slow for its 10-min window · nothing paid"; discarded "★ a win · epoch 12 had closed · not claimed"; other "claim failed · <message>", mining stopped — and recovering/paused as a banner under the header in the node's shape ("resumes in ~N min", **Use another account**). §9.1: `other` halting on a raw string is a defect.

## Medium

**3 · The claim row and chip collapse three steps and drop the TTL.** `ClaimProgress.step` is proving → sent (`ttlDetail` "drops in 9:48 if not included") → waiting ("in a block · syncing the note"). "claiming, about 20 s" is the proving estimate; inclusion adds a block and the sync, so at 45 s the row contradicts the chip's clock, and the one signal that a sent claim can still drop is gone. Fix: row and chip carry the step — "proving the claim · 12 s" → "sent · in a block by 9:48 or it drops" → "in a block · syncing".

**4 · 6A keyed on `active` flaps.** `presto-prover.ts` reports `wasm, sticky:false` on each transient refusal (up to three), `controller.ts` sets `active: m.kind` on every prover message, and `noticeFor` shows nothing without a sticky reason: the row ↔ slider swap changes the epoch tile's height on one busy witness, unexplained. Fix: the swap follows the sticky state (`selected === 'presto' && !fallbackReason`); only the pill's ✦ follows `active`.

**5 · The node chip has no `behind` state.** `healthy` derives from the transport (ok / 429 / silent). A node answering promptly with an old tip (syncing, stalled, forked) reads `healthy`, the age in grey on line 3; reads succeed, so the miner mines a closed epoch and the claim fails at simulation ("epoch is not open" → `other` → halt). Fix: chip `behind · 9 min` when `blockAgeS` > 60 s (the App banner's `stale` threshold), line 2 "its last block is 9 min old · mining paused"; §9.1: no such pause exists today. The throttled row: after 60 s of failed reads the controller pauses (`offline`) — add "mining pauses if it lasts a minute".

**6 · 5B removes the path `HoldButton`'s contract requires** ("the gesture is never the only path"). Keyboard hold works; voice control and switch access dispatch a click, so those users cannot sign out. Fix: keep the picked screen; reveal "Sign out with a click" after a cancelled hold. Also `session.forget` is `location.reload()`: a claim in flight is cut off, which "Mining stops." undersells — dim the hold while `phase === 'claiming'` with "a win is being claimed · 12 s".

**7 · Settings' Presto row says "not installed" before any probe.** With the probe at Start mining, `prestoAtom.status` is null until then; and under HTTPS-only an installed Presto with encryption off reads as absent (`acceleratorUrls`). Fix: "checked when you start mining" before a probe; "not found" after, never "not installed"; "connected" once native proved.

**8 · Invented facts in PrestoReasons.** `downloading`: "Proving in the browser until then" — `prove()` awaits `generateProof` through the download; the first proof waits (today's copy is right) and the rate stalls. `permission-blocked`: "Presto is installed, but…" — the browser refused the fetch; installation is unknown. `malformed-response`: "retry when Presto is updated" — not a version cause; keep the code's line. `cooldown`: Retry fails inside the SDK's cooldown — "then retry in a minute".

## Low

**9 · "Open Presto ↗"**: nothing in the repo opens the app (no URL scheme; the banner links to presto.build). "presto.build ↗" unless the SDK has a scheme.
**10 · WordsLogInChecksum "one is off"**: a checksum failure says the phrase is invalid, not how many words nor that the order is right. "at least one word, or the order, is off".
**11 · Settings slider under Presto**: each change runs `reconfigure`, a prover rebuild for nothing while native. §9.2: store the value, apply at the next WASM build.
**12 · MineSignedOut / MineIdle**: the ledger says "epoch 11 opened" under a tile with epoch 12 open.
**13 · Stop during a claim**: `stop()` only sets `stopAfterClaim`; the header gives no feedback. "Stopping after the claim", dimmed.

**REVISE** — APPROVE once 1–5 are in the brief and the boards, with 6–8 folded into the copy and §9.
