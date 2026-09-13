# Phase 12 — the fidelity pass (arc 5, branch `bridge-fidelity` on `bridge-stats-docs`)

Why: the owner opened the arc-4 preview (2026-09-13) and found the bridge sheets, the migration and arrival cards
and `/stats/bridge` unlike the "Yacana Bridge Take Two" canvas. True: the screens carried the canvas's content,
copy and flow, not its composition. No gate had compared a built screen with an artboard, and the codex loops
reviewed code, not artboards. The canvas is now in the repo (`../canvas/`), the comparison in `../fidelity.md`.

## What landed

- **P12.1** — `packages/ui`: `HeroCard`, `Trail` (chips / inline), `JournalCard`, `AmountBlock` + `MaxChip`,
  `Note`, `Timeline`, `StackedBar`; the `Stepper` gains `warn`; the types in `bridge-types.ts` so the pages'
  pure modules build them without the components. One spec (`bridge-primitives.vitest.tsx`). `fidelity.md`.
- **P12.2** — the miner's everyday bridge: `ToEthereumSheet` (form / review / sent with the burn's block from the
  journal), `DepositSheet` (the wallet as one row, the figure with the YACA there as its max, the stations, the
  pre-flip warning, "On its way." with the deposit's transaction), `BridgeTile` (journal cards on
  `trailOf`/`whoOf`/`stamp` in `bridge/copy.ts`, "nothing crossing", the foot with the deposit, the recovery
  file and the contracts), `BalanceTile` with Send · To Ethereum and the deposit link; `AmountInput`; the sheet
  primitive on the ground colour with a 16 px gap.
- **P12.3** — the guided path: `MigrationCard` as three hero cards (announced / sent / flipped),
  `SendAheadSheet` (the figure → the drawn review with the stations, the two notes, Send / Not now → "Sent
  ahead." + save a recovery file), `ArrivalCard` as one hero per origin with a row per arrival and its own tap
  (`arrival-claim` only where claimable; `arrival-state` otherwise), `TakingLongDialog` (two columns; the
  forward call to paste for an exit, from `forward-call.ts`), `OldTabNotice` as the bar, `OldApp` (the
  versioned origin's one page: signed-out / still-here / sent / quiet) in place of `Retired`, the key screen's
  restore-only variant as drawn, the header's version stamp.
- **P12.4** — `/stats/bridge`: `BridgeKpis` (six tiles on `kpisOf`/`figuresOf`), `BridgePhases` on the
  `Timeline` (five phases: launched · announced · canonical · goes quiet · exits close), `BridgeCoins` (the
  Plot chart on `coinsSeries`), the version cards with `StackedBar` (`whereOf`), `BridgeTurnstile`, the keys and
  rules panel; the beat's extras (`readExtras` in `bridge.ts`: YACA's supply, Forwarded / Deposited / Redeemed
  with their blocks' times, at most 120 blocks read and the rest placed between them) and the miner's two
  counters in beat one (`readMinerFlows`; `readSlot` exported from miner-core). The announcement bars (stats,
  landing). The FAQ in three sections (`faq-copy.ts`) with the panels as a strip.
- **The visual gate** — `visual-setup.ts record` deploys the portal on the run's anvil when it has one,
  registers, and records the Ethereum RPC's answers beside the node's (`MOCK_ETH_ORIGIN`); the spec replays
  both origins and captures `/bridge` at the four widths.

## Gate

(the P12 gate of plan.md §6, reported here when it passes)

## Lessons

## Consults

## Arc 5 fix loop (plan.md §10 steps 2–3)
