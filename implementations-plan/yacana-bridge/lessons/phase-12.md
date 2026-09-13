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

Passed on 08c3aec (2026-09-13), every run on the homelab, each e2e on its own isolated network:

| check | result |
|---|---|
| `bun run lint` | clean (biome 570 files, package.json sorted) |
| typecheck (`tsc --noEmit`, every package) | clean |
| `bun run test:components` | ui 55 · landing 14 · miner 93 (incl. `gallery.vitest.tsx`) · stats 83 |
| `bun test` on the stats beat | 8/8 (the sampler's bound, the build's card, the share on Ethereum) |
| `bun run --cwd packages/web-stats test:visual` | 8/8 on the recorded node + portal fixture, `/bridge` at 1280 / 1440 / 1024 / 390 |
| stats e2e | 6/6 (1.2 min) |
| landing e2e | 4/4 (45 s) |
| site e2e (`wrangler dev`) | 3/3 (58 s) |
| `E2E_PROVERLESS=1 E2E_SHARD=bridge` miner e2e | 1/1 (`bridge-states.e2e.ts`, 98 s) |
| `bun run rig -- browser` | 3/3 (V5 3.4 min real proving · V5 after the flip 13 s · V6 55 s) |
| `bun run rig -- origin` | 1/1 (24 s) |
| the branch preview | https://bridge-fidelity-yacana.alejo-amiras.workers.dev (`/mine/`, `/stats/bridge`, `/faq`), pictures in `fidelity.md` |

Runs before the fixes that failed and why: the rig's V6 stage (the held sheet's "…", fixed 3322135), the
origin case twice (no `account` on the old app, fixed d1099c4); the first pictures (the grid spans,
3322135). The visual baselines were re-captured three times as the review changed the page's words and
the version comparison (f658b19, 84e9970).

## Lessons

- **A green Vitest and a green e2e said nothing about the layout.** The first full-page pictures of the rig's
  browser case showed the migration card and the arrival card each squeezed into one grid column, a word per
  line: `TileBoundary`'s `className` dresses only its fallback, never the healthy child, so the cards (which
  used to be `Tile`s carrying their own spans) had no span at all once they became `HeroCard`s. Every
  assertion passed because words and testids were all there. The cards now carry their span themselves
  (3322135). Rule kept: a fidelity pass is not done until the built screen has been *looked at* at the
  spec's width; the `E2E_SHOTS` hooks make that a by-product of the gate.
- **The rig's V6 stage is the only run that opens the held sheet.** The forward/redeem sheet mounted the
  wallet picker without the YACA balance it shows (`WalletPicker` gained a `yaca` prop in P12.2 and only the
  deposit sheet passed it), so the redeem's figure stayed "…" and the stage failed at
  `yaca-balance` = `0.5`. The proverless shard never reaches that sheet; the Vitest stubs never read a
  balance. Fixed in 3322135 by reading it the way the deposit sheet does.
- **The origin case had never run on this branch.** `OldApp` replaced `Retired` in P12.3 without the
  `account` chip the spec (and a holder checking the address) needs; the case spent its 8-minute boot budget
  waiting for `account` on a page that was signed in. Two runs looked like a WebAuthn hang until the ARIA
  snapshot Playwright keeps (`test-results/*/error-context.md`) showed the still-here tile. Read the snapshot
  before theorising. Fixed in d1099c4 (the chip under every signed-in moment).
- **A sheet slides in over 200 ms; a screenshot taken on the next tick is half a sheet.** `shot()` waits
  400 ms before the picture. The pictures are documentation, not assertions, so the wait costs nothing in
  the gate's semantics.
- **Production builds take nothing from the process environment.** To picture the announcement bars, the
  landing's e2e second build (`.dist-claim`, `VITE_MIGRATION` set) and a stats build under
  `YACANA_SITE_MODE=e2e` were served statically and screenshotted; `--mode e2e` alone does nothing, the
  site mode is its own variable.
- **Versions read as "V1821665230" on testnet.** The canvas says V5/V6 (Aztec's registry index); the copy
  everywhere says `V${VITE_ROLLUP_VERSION}`, which on Aztec 5.x is the rollup's version *number*, and the
  migration block names the next version by registry index (`toIndex`), so one sentence can read "Aztec V1
  is expected … a deposit lands on V1821665230". Not changed here (it predates this arc and is a naming
  decision: index vs number, or a short name in the record); listed as an open pick in the report.

## Consults

## Arc 5 fix loop (plan.md §10 steps 2–3)

Codex session `01a09c51-76e7-7e71-8448-83d6f3bc84f5` (GPT-6 Astra, `high`, read-only; files in
`~/.cache/tmp/codex-MaAX52eN`), over `git diff bridge-stats-docs...HEAD` at d1099c4 with plan §6 P12, §7,
§8, the arc map, the adversarial ask and both rules verbatim.

- **Round 1** — verdict "request changes": 13 findings, all verified in the code, all accepted (b56d4e9).
  Real bugs: the old app called the version quiet on one undone send and hid the balance behind a partial
  send; the taking-long dialog navigated under itself; "proven · safe" on any one proven send; the stats
  page's share on Ethereum divided by minted-plus-itself, an unread forwarding history read as "nothing
  forwarded yet", every non-canonical version card showed zeros without a read (and after a flip the old
  build's supply landed on the canonical card), the coins chart clipped Ethereum's holdings to the epochs
  held, the block sampler read 121 blocks for 240, the "goes quiet" phase was renamed by the retire message,
  "never refused" contradicted the frozen cap. Accessibility: the exit sheet's sent state dropped the
  dialog's title element. Copy: "a fresh wallet pairs nothing" promised what it cannot. Comments: the FAQ
  copy's header named the plan; the hero card's doc narrated its JSX; "as drawn" headers dropped.
  Kept against the finding: the canvas's "days later · nothing can leave" detail for the not-yet-flipped
  phase (it describes going quiet, which is what the phase is). The refreshed visual baseline then showed
  every bar dashed: the fix compared a bigint version with the build's string (e8419a9, with a unit test
  pinning the build's card). A picture caught what 81 passing specs did not, twice in one day.
- **Round 2** — "request changes": 6 findings, 5 accepted. The unclipped coins chart broke its own
  invariant (`ethereum > total` drew a grey area labelled 40 over a total of 4): the chart now draws only
  over a complete, gapless run of this version's epochs against this version's own flows, and says how
  many epochs are held until then. The share on Ethereum divided one pool of YACA by one version's mint:
  stated only while one version has minted. The taking-long dialog remembered one dismissal, so two slow
  crossings kept it over the wallet: a cumulative set, all dismissed on leaving. The quiet heading now says
  the deadline passed, not that the rollup stopped proving. The tiles' header comment lost its inventory.
  Rejected with reason: judging "exits closed" by the device clock (the page has no chain time in its
  bridge view, the deadline is months after the flip, every other clock on the page is the device's; the
  L1 timestamp would be arc-3 code).
- **Round 3 (the hard stop)** — two findings, both accepted, and the rejection above reversed: codex
  pointed at `session.bridge.reader.blockTime()`, already there since arc 3, so the old app now reads
  Ethereum's latest block time with every standing and leaves the way open while that clock is unread —
  the portal, not the device's clock, refuses a late exit. The per-version filter on the coins chart was
  the wrong fix: a send ahead lands on the next version without a claim there, so once two versions have
  minted no version's epochs and flows add up to a balance; the chart is drawn only while one version has
  minted, and the tile says so. The loop ends here per plan §10 (three rounds); nothing is left open from
  the review.
