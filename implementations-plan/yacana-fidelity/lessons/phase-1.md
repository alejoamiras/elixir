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

## Arc 1 codex loop (2026-09-07)

Session `01a07935-a7c8-75b0-aae1-6eeb4a793181` (`/codex xhigh`, read-only, a new session over `git diff
9197fee..HEAD` with the plan, the recon, the arc map and the four renders beside the binder frame).

**Round 1** — nine findings, all verified against the code before acting:

1. *Blocking, accepted.* `scripts/render-surfaces.ts`: `decodeURIComponent` before `resolve(dist, …)` let
   `/..%2f..%2fREADME.md` escape `dist` (a localhost render server, but still). The resolved path must stay
   under `dist`; malformed encoding is a 400.
2. *Should-fix, accepted with a different fix.* The binder's `fg-3` (.40) and `fg-4` (.22) over the tiles are
   3.5:1 and 1.9:1; the labels, units and hints went from `ink-2` (7.2:1) to them, an AA regression every
   surface inherits. Codex proposed keeping `ink-2` for essential small text; that gives up the binder's
   hierarchy, the owner's complaint. Instead `ink-3` goes to .50 (light .60): 4.9:1 on the tiles with the same
   ordering (ink > ink-2 .64 > ink-3 .50 > ink-4 .22); header asides take `ink-3`; `ink-4` stays only for
   pending steps and word indices. The KPI sub takes the hint tone (`ink-3`) as the binder draws it.
3. *Should-fix, accepted for the miner and the stats.* The shells carried `p-4 md:p-5`, so the 52-px bar sat
   20 px down with its rule inset. Now the bar is the frame's top row (`px-4 md:px-5`, full-width rule) and a
   body div carries the inset once. The landing keeps its `px` until P2.1 moves the inset into the bar and the
   frames' own paddings (the frames are that phase).
4. *Should-fix, accepted.* The loop tile's header was the bordered status pill; M1's is the plain mono label.
   Now "live · one dot per proof" while mining, the phase name otherwise, the red pill only for a page-side
   pause; the "s per proof" readout inherits the aside tone.
5. *Should-fix, accepted.* The rail: M1's header is "epoch N" with "opened HH:MM:SS" opposite, then six rows;
   ours had a sans header, a separate "opened" row (seven) and an elapsed strip M1 does not draw. `EpochRail`
   takes an `aside`, loses `progress` and the strip; the power readout takes the aside tone.
6. *Should-fix, accepted.* "~7 s" put the unit in the 40-px value; split into value and `unit` (`nextWin`).
7. *Should-fix, accepted.* The E2E asserted "four tracks, ≤ 1080 wide" then nothing after the switch back to
   1440. Now: the exact tracks `246px 246px 246px 300px` and width 1080 at 1280 and 1440; two equal columns at
   1024 with the rail beside the ledger / key stack (bounding boxes). `render-cockpit.ts` waits for the mining
   state after the first mint instead of a fixed delay (the previous renders all showed "claiming").
8. *Should-fix, accepted.* `states.e2e.ts`'s balance parse failed open: a non-matching second read gave
   `NaN === NaN`. The match is now required; `miner.e2e.ts` asserts the unit beside the balance.
9. *Nit, accepted.* Narrating comments dropped (`Mine.tsx`, `LoopTile.tsx` ×2, `WalletCard.tsx`,
   `tile.vitest.tsx`); the `text-label` comment no longer claims tile labels are 11.5 px.

Fast gates after the round: `bun run lint` ✓ · `tsc` ui / web-miner / web-stats ✓ · `test:components` ui 29 /
web-miner 34 / web-landing 10 / web-stats 13 ✓ · `bun test packages/web-miner` 54 ✓.

E2E after round 1: the first run failed only the memory spec ("baseline 2255 MiB, after three rebuilds 3295") — the
cockpit renders were being taken from the same E2E server at that moment, and the spec's RSS watcher roots its process
tree on every `playwright_chromiumdev_profile` on the host, so the render browser (mining and proving a claim) was
summed in. A clean rerun with nothing beside it: 11 passed (11.2 m), baseline 1284 MiB → 1438 after three rebuilds.
Rule for the arc boundaries: render first or after, never during the memory spec.

**Round 2** (resumed, over `ed2da7e..dd96169`): one should-fix, one nit. Codex confirmed the contrast numbers
(dark raised / panel 4.79:1 / 4.73:1; light 4.89:1 / 4.75:1), the traversal fix, the insets, the plain loop header,
the six-row rail, the unit slot, the fail-closed parse and the mining-state captures.
1. *Should-fix, accepted.* The desktop assertions proved the tracks and the width but not the placement: dropping
   the rail's `xl:order-none` would have moved it under the other tiles with every assertion still green. Now
   `placed()` checks the boxes at 1280 and 1440: the rail right of the loop on the same top, the KPI row and the
   ledger under the loop and as wide, the key tile under the rail on its left edge.
2. *Nit, accepted.* The `nextWin` comment gave an impossible example ("~1.8 min": `duration` rounds minutes);
   deleted.
   The canvas's `--ink-3` fallback in `score-loop.tsx` follows the token (.5). Gates after round 2: `bun run lint` ✓ ·
   `tsc` web-miner ✓ · ui Vitest 29 ✓ · the miner E2E 11 passed (11.2 m, baseline 1284 → 1444 MiB) ✓.
