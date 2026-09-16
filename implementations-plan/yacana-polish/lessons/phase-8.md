# Phase 8 — The Wallet (arc 5, `polish-wallet`)

## Build

- `packages/ui`: `bridge-types.ts` gains `ChipTone`, `RowAction` and `RowLine` (the chip, one sentence, the
  trail, one `action` with an optional disabled reason, an optional `also` link and `note`); `status-chip.tsx`
  re-exports the tone from there. `activity-row.tsx` (new): `ActivityRow` — the amount with its unit and
  direction in small mono, the chip and the time on the right, the sentence, the inline trail, one button
  (uv when the row waits on the user, outline otherwise), the `also` link with its note, the last error, and
  a `Details` disclosure for the links; `collapsed` folds everything but the first line. `data-state` is the
  chip's tone, the border is uv on `ok`. `header.tsx`: `HeaderTab.count` → a uv `Badge` (`tab-count`).
  `JournalCard` and `journal-card.tsx` gone.
- `packages/bridge/src/portal-reader.ts`: `pausedUntil` moves from `VersionFlows` to `VersionStanding` (it is
  read from `versionInfo` with the rest of the standing, and the Wallet's reason needs it beside `paused`).
- `web-miner/src/bridge/copy.ts` rewritten around `rowLine(c, facts): RowLine` — one exhaustive
  `LINES: Record<RowState, Line>` from the §5.4 table, every state × kind, deposits included; the facts
  (`RowFacts`) are the version and target names, the flip, the deadline reading, `takingLong`, `pausedUntil`,
  `mayForward`, `verdictUnknown`, `claiming`, the money in the unit it lands in, the counterpart address, the
  chain and the wallet's name. `deadlinePhrase`, `dayOf`, `stamp`, `chainName`, `whoOf` beside it;
  `revertLine(e, c, facts)` renders a portal refusal as that row's own state. A K2 whose state needs the
  upgrade verdict while it is unknown reads "can't read the upgrade" with Settings as its action.
- `web-miner/src/bridge/rows.ts` (new): `activity(journal, view, now, rowStates, env)` → every crossing as a
  row, newest first, with the count of rows waiting on the user (the rows whose chip tone is `ok`), and
  `moneyStanding(view, version, next)` → which money buttons are off and the one reason under them (silent
  RPC > unregistered > deposits closed > paused, the pause dated from `pausedUntil`). The count, the row's
  action and the button's reason come from this one file.
- `web-miner/src/bridge/env.ts`: `isContinuation()`, `nextVersionName(canonical)`; `session.ts`: a pruned
  claim keeps its `claimTxHash` when the record goes back to `claimable`.
- `features/ActivityList.tsx` (new): `useActivity(claiming)` over the journal, the view and `rowStatesAtom`;
  `ActivityList` — the tile (`activity`), the rows (`journal`), the empty state ("Nothing crossing yet." with
  the continuation's hint), the recovery file's save and load; the private claim of a deposit or a forwarded
  send-ahead is made in the list itself (`claiming` / a failed claim's error beside the row's button); the
  other actions (`claim-l1`, `forward`, `redeem`, `again`, `settings`) go up to the Wallet.
- `routes/Wallet.tsx`: the balance tile's buttons read `moneyStanding` (`money-reason`, `money-settings`);
  the wins as a row with a toggle (`wins-row`) opening the list (`wins-list`); the sheets in `MoneySheets`;
  `ActivityList` wired — `again` resumes a dropped deposit, reopens the exit sheet for a K1, goes to Mine for
  a K2. `routes/Mine.tsx`: `ArrivalCard` out of the guided path. `BridgeTile.tsx`, `ArrivalCard.tsx` deleted.
  `lib/tabs.ts`: `minerTabs(route, go, stats, waiting)`; `App.tsx` feeds the Wallet tab `useActivity().needsUser`.
- `DepositSheet.tsx`: `explain(e, c, flipped, pausedUntil)` builds the facts for `revertLine`.
- `TakingLongDialog.tsx` deleted with its mount in `App.tsx` and its two specs: "longer than usual" is the
  row's own state now (§9.3.2), with the forward and the redeem on the row; the predicate `takingLong` stays
  pure in `copy.ts`.
- Specs: ui `bridge-primitives.vitest` ('the activity row': the parts, the action, Details; the disabled
  reason, the `also` link, the fold); `bridge-features.vitest` ('the activity list', 'what arrives', 'the
  balance tile'); `gallery.vitest` (the journal words, the silent RPC through the balance tile and "can't read
  the upgrade", the arrivals, 'what was sent ahead'); `tests/activity-rows.bun.test.ts` (new, pure: one row
  per crossing newest first with the count equal to the rows with a tap, the hashless send reading as the
  refresh says, the fold after a week, the money reasons in their order). `bridge-states.e2e.ts` and the
  rig's `bridge.e2e.ts` read the rows (`crossing-word`, `row-claim`, `row-claim-l1`, `row-forward`,
  `row-redeem`, `activity`); the rig's held chip is `/^held for V\d+$/` so the spec never assumes a version
  number.
- `CLAUDE.md` (ui and web-miner rows), `docs/bridge.md` ("from its row in the Wallet's activity").

## Decisions and departures

- `RowLine` lives in `packages/ui`'s `bridge-types.ts` rather than the plan's `DeadlineReading` on the
  props: the row renders what the line says and nothing else, so the ui primitive needs the whole shape and
  the web-miner needs no second copy (the plan's audit already flagged `RowLine`/`ActivityRowProps`
  duplicated; one type, one owner).
- A held send-ahead that can be forwarded gets `Forward to V6` as its button and "or redeem it on Ethereum"
  as the `also` link with "as YACA, {deadline}." as the note; one that cannot (the old origin, before the
  flip) gets Redeem as the button only when the deadline is the day's or the wait is long, otherwise the same
  link. The §5.4 table names both ways; the row shows one button, so the second way is a link.
- `pausedUntil` on `VersionStanding`, not `VersionFlows`: the standing is what the Wallet reads at every
  refresh; the flows are the stats page's.
- A claim the node pruned goes back to `claimable` with its `claimTxHash` kept: the row's Details still
  links the attempt, and the sentence says the claim did not land rather than pretending it was never made.
- A K3 in `proving` has no action: the deposit is the wallet's to confirm, and the row says so ("Confirm the
  deposit in <wallet>"); its `again` appears only once the record is `dropped`.
- The private claim runs in the list (a deposit's and a forwarded send-ahead's), not in the Wallet: it needs
  no dialog (P9's five are the L1 ones), and the row is where its `claiming` chip and its error belong.
- The wins are a row with a toggle and a tile below it, not a tile alone: the Wallet's first screen is the
  balance and the activity; the claims are a record the user opens.
- The e2e's intermediate before `settle()` is any station past `sent`: the isolated network proves on its own
  cadence, and the run showed `sent` → `reached Ethereum` → `ready to claim` with `reaching Ethereum` never
  rendered. Pinning one station there was timing, not behaviour; the chip's words are covered by the pure
  test and the rig's spec asserts the stations that `settle()` and `forward()` produce.

## Gate (2026-09-16)

| layer | result |
|---|---|
| lint, typechecks (ui, web-miner, site, web-stats, web-landing) | clean |
| `bun test packages/bridge packages/web-miner packages/ui` | 258 pass, 3 skip |
| `test:components` (ui 69, web-miner 107) | green |
| `bridge` shard, proverless (the injected wallet) | 1/1 (3.5 min); two runs before it were the spec's to fix, below |
| replay (`test:replay`) | 4 pass (42 s) |
| `bun run rig -- browser` (the rig's `bridge.e2e.ts`) | green on the third run (V5 3.0 min · the flip 12 s · V6 1.2 min); the two before it, below |

The shard's two runs before the green one were the spec's: the first pinned `reaching Ethereum` before
`settle()` (above); the second asked for one `dropped` deposit where the list now keeps two — the one the
wallet refused and the one retired by the warp — so the spec asserts both read "not sent". Neither was a
behaviour change: the old card showed the retired one only because it showed one deposit at a time.

The rig's `browser` case took three runs, two of them the spec's and one the code's. (1) On V6 a restored
send-ahead read `held for the next version`: `rows.ts` named a K2's target from the announced upgrade alone,
while on the continuation the canonical is already the version after the crossing's own — `targetOf` now
names the canonical once it is another than the crossing's version, the announced upgrade before that, and
the pure test pins it (`held for V6`, `→ V6`). The gallery's announced fixture reads `held for V1` for the
same reason (its `toIndex` is 1). (2) `filter({ hasText: /^held for V\d+$/ })` on the row matched the row's
whole text against an anchored regex, so the redeem click waited out the stage's 45 minutes; the filter is
on the chip now. (3) Green.

Pass criteria: every crossing appears once (`activity()` maps the journal, sorted, no filter; the pure test
lists four kinds of row and the e2e keeps a K1, two K2 and a K3 in one list); count, action and reason agree
(the count is the rows whose chip is `ok`, which is the tone that gives the row its uv button; the reasons
come from the same file as the rows).
