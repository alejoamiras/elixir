# Phase 4 — presets, the activity row, and arc 1's boundary

## The row: a send-ahead is two rows in two places

The board drew three kinds (to Ethereum, from Ethereum, sent ahead) and the first implementation mapped the
journal's `kind` 1/2/3 straight onto them. Every spec was green. The rendered gallery (the spec keeps its HTML
under `GALLERY_DIR`; a scratch script screenshots it under the built CSS) showed a send-ahead **arriving** on V5
from V4 as "Sent ahead to V5 · −8 tYACA", directly above its own sentence "8 tYACA in your balance". The same
journal record is money out on the version that sent it and money in on the version it lands on. `arrivesHere`
(`kind 2 ∧ version ≠ own ∧ target = own`) now reads it as `in`, "From another version", with a plus.

Second time in two phases that a screenshot found what the specs could not. The specs asserted what I had
decided the row should say; only the picture put the title next to the sentence that contradicted it.

## Smaller things

- The deposit's amount used to print in `YACA` (the side it starts on). D8·A: "the unit that reaches or leaves
  this balance", so every row prints the profile's token symbol. `L1_SYMBOL` stays: a sentence about what was
  minted on Ethereum still needs it.
- `whoOf` is gone from `copy.ts`; the row's other party is `senderOf` in `rows.ts` (not `partyOf`, which feeds
  sentences and has different rules for a redeem).
- Complexity budgets bit twice: `ActivityRow` reached 16 once the head grew (extracted `RowHead`), and the
  gallery's `describe('the old app')` callback passed 80 lines with one more test (its helpers moved to module
  scope).
- F4's presets: the grid's column count follows the merged presets (`repeat(n, 1fr)`), so two presets that
  share a value are one wide button, not a gap.

## Gate: arc 1's e2e (2026-09-21, at 67977bf)

Fast: lint 0 · typecheck 0 · web-miner typecheck 0 · `bun test` 0 fail · components 0 · replay 4 passed.
`YACANA_APP_ROLE=old bun run site:build` exit 0 · `E2E_PROVERLESS=1` shards: cockpit 7 passed (6.7 min), chain
9 passed (8.4 min, `presto.e2e.ts` included: the headless Presto is installed), bridge 1 passed (3.8 min) ·
`bun run rig -- browser origin`: 4 pass, 0 fail in 519 s. `bridge.e2e.ts` asserts the strings now: the deposit
dialog ends on "Deposit sent", the row is titled "From Ethereum" with `+0.5 …`.

The rig's step returned sooner than I expected, so I read its log before believing its exit code: four Playwright
cases, each with its own network boot, all executed. (Phase 1's lesson, applied.)

## Arc 1's codex loop (session 01a0c4a8-027b-7952-aa39-8192ee0faf82, GPT-6 Astra at high)

**Round 1** — verdict "material findings". Each checked against the code and the plan before acting:

| # | Finding | Verdict | Why |
|---|---|---|---|
| 1 | The hover card is placed by React renders only; a resize or the scrolling window moves the tick without one, and an aged-out proof keeps its card | **accepted** | True: `drawn.current` changed, nothing re-rendered. Every frame drawn now places the card (`placeCard`), and hides it past the plot's left edge. Regression: resize, then age-out |
| 2 | Deposit trails still begin "sent from your wallet" (plan §3.3 promises "deposit sent") | **accepted** | I changed the dialog's step in P1 and missed the two trails in `copy.ts`. Also wrong in fact for a deposit found from another device |
| 3 | A failed band drops its duration (plan §2: "DIDN'T LAND · 41 s") | **accepted** | One line; asserted |
| 4 | Three comments no longer true or on the wrong function | **accepted** | `barCaption`'s doc, `ActivityRow`'s doc, `dialogOverflow`'s doc |

Codex confirmed the four inferences I asked it to break (span transitions, `arrivesHere`, the depositor heal) and
found no new dependency, credential or privilege surface. Fix commit: d5d902c.

**Round 2** (resumed, on the fix diff) — verdict, quoted: "no new material findings". One minor: the new
regression re-rendered the component to move the tick, so React's own layout effect placed the card and the
test proved nothing about a redraw React never asked for. Fixed in 8d253e0: the test resizes and ages the proof
out through the still frame's captured `ResizeObserver` callback; checked by removing the placement from the
draw path (the test fails without it). Codex's independent checks of what I had asked it to break (a hover
changing between a draw and `after`, the pop-out's `win`, unmount with a frame queued, `hidden` against the
element's classes) all passed. Loop converged at round 2 of 3.

## Re-gate on the arc's final tree (2026-09-21, at 8d253e0)

The fixes touched the chart (cockpit) and the rows' words (bridge, the rig's browser case), so those ran again:
fast layers all green; `E2E_PROVERLESS=1` cockpit 7 passed (5.9 min), bridge 1 passed (4.0 min); `bun run rig
-- browser` 3 pass, 0 fail (each case its own network boot, read from the log). The chain shard and the rig's
origin case were not rerun: nothing in the fix diff reaches them (the presto/states/switch specs and the old
origin's page share none of the changed files).
