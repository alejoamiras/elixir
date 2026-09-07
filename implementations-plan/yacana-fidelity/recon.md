# Recon — yacana-fidelity

Read-only sweep of `origin/main` (`9197fee`) against the interface binder (the v3 studies, `yacana-ux-v2.html` in the
session scratchpad; frames M1 cockpit, A1 observatory, L2 landing sections). One explorer, ten capabilities. The
binder's measurements below were extracted from its CSS and markup, not eyeballed.

## Reuse map

| capability | existing code | verdict |
|---|---|---|
| Page shells / containers | `web-miner/src/App.tsx` (`max-w-3xl` = 768), `web-stats/src/App.tsx` and `web-landing/src/App.tsx` (`max-w-5xl` = 1024), `web-landing/src/sections/Bar.tsx` (52 px bar, matches the binder's `.top`) | **adapt**: the binder's canvas is 1120; `1120` appears nowhere in the code |
| Miner cockpit grid | `web-miner/src/routes/Mine.tsx`: `xl:grid-cols-[minmax(0,1fr)_320px]`, tiles `LoopTile`, `RailTile`, `LedgerTile`, `WalletCard` | **adapt**: the binder's M1 body is `grid-template-columns: 1fr 1fr 1fr 300px; gap: 14px` with the loop spanning `1/4`, the epoch+power tile `grid-row: span 2` in column 4, three KPI tiles in row 2, the ledger `1/4` in row 3, the key tile in the last cell; the tiles map 1:1 to the existing components |
| Tokens / type scale | `ui/src/theme.css`, `tokens.ts` | **reuse**: palette identical; `Kpi` `md` = binder `.num` (22 px), `lg` = `.big` (40 px); `Button` `uv` = `.btn.uv`, `lg` 48 px, `sm` 30 px; **adapt** two drifts: `eyebrow` is 11 px / lh 1.3 vs the binder's 11.5 px / lh 1; tile labels use `ink-2` vs the binder's `fg-3` |
| UI primitives | `Tile`, `TileHeader(aside)`, `KvRow`, `Kpi`, `Badge`, `Button`, `StatusPill`, `ScoreLoop(height, hero)`, `EpochRail`, `PowerSlider`, `ProofLedger`, `Marks`, `Stepper`, `Sheet` | **reuse**: no new props needed; `ScoreLoop`'s `hero` prop exists and is unused; heights per frame: cockpit loop 230, landing hero 250, demo 200 (product: 180 / 200 default) |
| Charts | `web-stats/src/charts/{frame,index}.tsx`: hand-rolled SVG, `Emission` / `Difficulty` / `Duration` / `Retarget`, `data-slot` bars/points/lines/halo | **build new** on Observable Plot; the test contract (`[data-slot=bar]` counts, four halos page-wide, `role=img` names) is renegotiated, see below |
| Observable Plot / D3 | absent everywhere (node_modules, every package.json, bun.lock) | **build new**: `@observablehq/plot@0.6.17` (2025-02-14, 3 direct deps: `d3@7.9.0`, `interval-tree-1d`, `isoformat`; 42 packages installed under the 7-day min-age in a scratch project); declared in `web-stats/package.json` like every other runtime dep |
| CSP | `site/src/headers.ts`: `style-src 'self' 'unsafe-inline'` (Radix, Sonner) | **reuse**: Plot sets `style` attributes and injects no `<style>` / `innerHTML` (its `src/` was grepped); `script-src 'self'` unaffected; no policy change |
| Tooltip / motion | `ui/src/hooks/use-reduced-motion.ts` (`useReducedMotion`, `useDocumentHidden`), `RISE_MS` 420 / `FLASH_MS` 900 (binder's numbers), the strip's 240 ms slide-in | **reuse** the hook and timings; **build new**: no tooltip primitive exists (`radix-ui` is installed but only Dialog and Sheet are wrapped) — Plot's own `tip` / `pointer` marks cover chart tooltips without a Radix wrapper; no count-up exists |
| Screenshot gate | none: no `toHaveScreenshot` anywhere, no `snapshotDir`; `web-landing/scripts/og-card.ts` is the one Playwright screenshot (a build script; its PNG is committed) | **build new**: on the stats E2E's mocked-node path only (the one deterministic fixture); the miner and landing E2E drive live proving and block time |
| Landing sections | `web-landing/src/sections/*.tsx`, `copy.ts` (`SECTIONS` in the binder's order), `Section.tsx` (generic `py-14 md:py-20` shell) | **adapt**: ids, order and test ids already match; the per-frame grids do not (hero `1fr 1.1fr` at `56px 36px 44px`, money `1fr 1.25fr` at `32px 36px`, chain `1fr 1fr`, live `repeat(4,1fr) 1.4fr` at `28px 36px` in one row, ask centred at `44px 36px`); `Live.tsx` carries a second hand-rolled SVG sparkline |
| Stats composition | `web-stats/src/routes/Stats.tsx` (stacked column), `Observatory.tsx` (`md:grid-cols-3`, six tiles in two rows) | **adapt**: the binder's A1 body is `repeat(6, 1fr); gap: 14px`: six KPI tiles in one row, the strip `span 4` beside the detail `span 2`, four charts `span 3`, the table full width, the closing tiles `span 3`; every test id the suites use already exists |

## Chart test contract today

- `stats.vitest.tsx`: `Duration` renders 8 `[data-slot=bar]`, the first `fill-warn`, one `[data-slot=halo]` when selected, `role=img` named `/8 closed epochs/`; `Retarget` bars `fill-ink-3` / `fill-uv`; `Emission` one `[data-slot=line]`; `Difficulty` 9 `[data-slot=point]`.
- `stats.e2e.ts`: `chart-duration` has 8 bars; `[data-slot=halo]` count is 4 page-wide.
- Plot's SVG carries no per-datum `data-*`; the plan replaces these with figure-level test ids plus `aria-label` text ("8 closed epochs", "epoch 3 selected") and a `data-count` attribute the wrapper sets from the data it plotted.

## Conventions to match

- `*.vitest.tsx` for RTL specs, `*.test.ts` for pure logic (both runners), `*.e2e.ts` for Playwright; Biome's cognitive ≤ 15 and ≤ 80 lines apply to `*.vitest.tsx` too (the override matches only `*.test.*`).
- Cross-package imports relative (`../../../ui/src/index.ts`); runtime deps in the consuming package.
- `data-testid` for what tests query by name, `data-slot` for repeatable structure.
- File-opening comment states intent and trade-off in one or two sentences; nothing about plans or phases.

## Collision / dedup risks

1. Two SVG chart implementations if only web-stats moves to Plot: the landing's `Sparkline` in `Live.tsx` is the second. Decision: the landing's sparkline stays hand-rolled (12 points, no interaction, and the landing must not ship Plot's 150 KB for one line) and is restyled to the binder's 44 px.
2. `ScoreLoop` is canvas and stays canvas; Plot never touches it.
3. Per-datum `data-slot` on Plot output: renegotiated, above.
4. The mocked-node E2E freezes storage slots but not the block timestamp or `Date.now()`: the screenshot gate freezes the clock with Playwright's `page.clock` and masks the freshness line.
5. Rail width 300 (binder) vs 320 (product), loop heights 230 / 250 / 200 (binder) vs 180 / 200 (product): the binder's numbers win, once.

## Absence trails

- Plot / D3: `node_modules/@observablehq`, `node_modules/d3*`, `bun.lock` and every `package.json` for `observablehq` / `"d3`: none.
- Tooltip / popover / hovercard: `packages/**/*.ts(x)`: none.
- Screenshot assertions: `toHaveScreenshot|toMatchSnapshot|screenshot(` under `packages/*/e2e`, `packages/*/tests`, the four `playwright.config.ts`: none beyond `og-card.ts`.
- `1120` in the three apps' `src/`: none.
- Count-up / number tween: none.
