# Phase 1 lessons · arc 1 · miner

## P1.1 Shell width, tile and token fidelity (2026-09-06)

- The three shells go to `max-w-[1120px]` (the binder's outer canvas) with the inset applied once (`p-4 md:p-5`,
  the binder's 20 px; the landing keeps horizontal padding only, its frames carry their own).
- Tokens: a `text-label` size (11.5 px / lh 1) for the `eyebrow` utility; `label-mono` (tile headers, KPI labels)
  moves from `ink-2` to the binder's dimmer `ink-3`; the tile radius from `rounded-lg` (10) to 8 px; the tile
  padding to `px-[18px] py-4`; the `TileHeader` aside to `ink-4`; the KPI unit to `ink-3` and the `md` value's
  line-height to 1.1. Every surface inherits; the Vitest suites of all four packages stayed green (ui 29 with the
  new `tile.vitest.tsx`, web-miner 33, web-stats 13, web-landing 10).
- Renders (`scripts/render-surfaces.ts`, a Bun static server per app on OS-assigned ports + Playwright's Chromium,
  `.run-state/renders-p11/`): the stats page and the landing sit correctly in the wider frame with the dimmer labels;
  the miner's key screen stretches its card to the full 1080 px, which the binder's half-frame key card (540) does
  not: capped in P1.2 with the cockpit. A production build refuses key creation off `yacana.network`, so the
  cockpit / wallet / settings renders need the e2e build (`--keys`), done in P1.2.

Gate: `bun run lint` ✓ · `bun run --cwd packages/ui typecheck` ✓ · `bun run test:components` ui 29 / web-miner 33 /
web-stats 13 / web-landing 10 ✓ · the renders reviewed (stats, landing, key screen at 1280 and 1440).

LESSONS_FILE=implementations-plan/yacana-fidelity/lessons/phase-1.md

## P1.2 The M1 cockpit grid (2026-09-06)

- `Mine.tsx` is the M1 frame from `xl`: `grid-cols-[1fr_1fr_1fr_300px]`, gap 14, the loop and the ledger over
  three columns, the rail `row-span-2`, the three KPI tiles a row of their own (`KpiTiles` in `LoopTile.tsx`,
  `Kpi size="lg"` each), the key tile under the rail. The key tile is the rewritten `WalletCard`: the balance as
  a `lg` KPI with the unit beside it, Withdraw / Receive routing to the wallet, the address, the method and the
  claim count on one row.
- Two things the frame does not say, decided on the renders: `items-start` on the grid, because the ledger is a
  log and stretched to the rail's height otherwise (a 300-px-tall empty tile at 1440); and between `md` and `xl`
  the ledger and the key tile share one wrapper (`contents` at `xl`), so at 1024 the rail sits beside a stack of
  the two instead of leaving the key tile alone in a row. The 1024 block is the plan's "900–1280 two-column"
  case; judged in the arc review.
- The `balance` test id now carries the number only (the unit is the KPI's unit span): `miner`, `passkey` and
  `states` assert `'4'` / `'8'` instead of `/^4 tYACA$/`. The first full E2E run failed one spec on exactly that,
  a stale `tYACA` regex in `states.e2e.ts`'s balance-for-claims helper (the app was right: "16 for 4 claims");
  fixed and the suite rerun on the final tree.
- The spec the plan names `shell.vitest.tsx` is `cockpit.vitest.tsx`: the placement as classes (jsdom has no
  layout, and no `matchMedia`, which the score loop's reduced-motion hook reads: stubbed). The computed grid is
  asserted in `miner.e2e.ts`: four tracks at the default viewport, two at 1024, back to four at 1440.
- Renders from the E2E server (`scripts/render-cockpit.ts`, a production build refuses keys off
  `yacana.network`): `.run-state/renders-p12/` at 1440 / 1280 / 1024, the wallet and settings screens too. The
  key screen is capped at 640 (`KeyScreen.tsx`), the binder's half frame.

Gate: `bun run lint` ✓ · web-miner `tsc -b` ✓ · `bun run --cwd packages/web-miner test:components` 34 ✓ · `bun test
packages/web-miner` 54 ✓ · `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` 11 passed (12.4 m) on the
final tree, after the stale-regex fix ✓ · the cockpit renders at 1440 / 1280 / 1024 reviewed against M1 (the 390 render
is the desktop-only guard the miner shows on phones, by design).

LESSONS_FILE=implementations-plan/yacana-fidelity/lessons/phase-1.md
