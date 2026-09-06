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
