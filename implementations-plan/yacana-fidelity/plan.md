---
plan: yacana-fidelity
tier: light
driver: claude-code
code_review: off
eli5_mode: artifact
budget: recon 1 agent · code-review off · codex xhigh (the owner's standing preference for this repo) fix loops until clean, hard stop 3 rounds per arc · a final cross-arc pass
created: 2026-09-06
---

# yacana-fidelity — the three surfaces to the binder's frames

The first implementation (`yacana-surfaces`) shipped the binder's tokens and components but not its page compositions:
the miner's cockpit sits in a 768-px column instead of the M1 frame's 1120-px four-column grid, the landing's seven
sections are generically stacked instead of the L2 frames, the stats page is a single stacked column instead of the A1
six-column dashboard. This plan makes the frames the spec, replaces the stats charts with Observable Plot (hover
tooltips, annotations, transitions on poll), and adds a screenshot-comparison gate so the pages cannot drift again.

Design source of truth: the v3 interface binder (`yacana-ux-v2.html`, session scratchpad; the measurements are copied
into this plan so a fresh session needs no scratchpad). Recon: `recon.md`. Live-vs-binder screenshots that started
this: the scratchpad's `shots/`.

## Success criterion

Each surface, at 1280 and 1440 px, matches its binder frame in layout, proportions, type scale, spacing and button
colour (deviations listed in `lessons/` with the reason); the stats charts are Plot-based with tooltips, annotations and
poll transitions; a screenshot gate holds the stats page to committed baselines; every existing gate still passes; each
surface ships as its own PR with 1280/1440 screenshots beside the binder frame; codex converges per arc.

## Owner's answers (Phase 0)

- Charts: **Observable Plot / D3**.
- Fidelity: **frames are the spec**, with judgment where a frame is unachievable or does not make sense; discuss such
  cases with codex.
- Miner scope: **the cockpit** (loop, rail, KPIs, ledger, key tile); the key screen, words flow, wallet and settings keep
  their layouts (they get the wider shell).
- `code_review`: **off**.
- Hardening: none scheduled (no new trust boundary; the one new dependency is covered in Security).

## The binder's measurements (the spec)

Canvas 1120 px (`.mk{width:1120px}`), tiles `padding: 16px 18px; radius: 8px`, tile headers `h5` = mono 11 px / 500 /
tracking .12em / uppercase / `fg-3`, with a right-aligned `.r` hint in `fg-4`; KPI label `.l` same as `h5`; `.num` 22 px
/ 600 / −.02em / lh 1.1; `.big` 40 px / 600 / −.03em / lh 1; unit `small` .45em `fg-3` 6 px left; `.eyebrow` mono 11.5 px
/ 500 / .14em / lh 1 / `uv-2`; `h1` 44 px / lh 1.05 / −.025em; `h2` 30 px / lh 1.1 / −.02em; `.hero-h` 56 px (50 in the
hero frame) / lh 1.02 / −.03em; body 15 px; `.sub` 19 px / lh 1.45 / max 46ch; `.hint` 12.5 px `fg-3`; buttons 38 px
(`lg` 48 / 15 px, `sm` 30 / 12.5 px), `.btn.uv` purple = the product's `uv` variant; the top bar 52 px with `padding: 0
20px`; the frame body `padding: 20px`.

**M1 cockpit** (`.body`): `grid-template-columns: 1fr 1fr 1fr 300px; gap: 14px`. Row 1: the loop tile `grid-column: 1/4`
(header "live · one dot per proof" left, "3.26 s per proof" + Stop right; canvas `data-h="230"`); the epoch tile
`grid-row: span 2` in column 4 (header "epoch 22 · opened 03:31:12", four segments, six `kv` rows, then "power · 11
threads · 18.4 / min" and the slider with three labels, then the hint). Row 2: three KPI tiles (`rate` 18.4
proofs/min, `next win, at this rate` ~1.8 min, `best this epoch` 29.8 of 33.1, each with a hint). Row 3: the ledger
`grid-column: 1/4` ("proofs · newest first · ★ win · ✓ minted · ✗ failed · ── epoch", a mono log), the key tile in the
last cell ("your key · private balance", 12.00 YACA big, Withdraw + Receive, the address and "passkey, synced"). Bar:
brand · Mine · Wallet · Settings · env pill "TESTNET · FEES SPONSORED" · status pill "MINING". Responsive note (binder):
≥ 1280 as drawn; 900–1280 the rail drops under the numbers as a two-column block; phones: no mining.

**A1 observatory** (`.body`): `grid-template-columns: repeat(6, 1fr); gap: 14px`. Row 1: six KPI tiles (`minted` 344
YACA "86 claims × 4 · 0 premine"; `epoch 22` 2 of 4 claims "open 3 min · expected 5"; `difficulty` 33.1 "×0.96 at the
last close"; `claims / hour` 43 of 48 "schedule: 4 per 300 s"; `network` ≈ 0.30 proofs/s "median of 6 epochs · ≈ one
laptop"; `last claim` 2 min ago "escape hatch in 16 min"), `.num` size. Row 2: the strip tile `span 4` (header "epochs
since launch" + legend, the strip 64 px, the hint line with the selected chip right) beside the detail tile `span 2`
(header "epoch 14 · 02:40:12 → 03:01:48", three inline KPIs claims / duration / difficulty→next, the sentence, two
chips). Rows 3–4: four chart tiles `span 3`, header + `.r` caption, 170 px: `emission` "cumulative, against the
schedule"; `difficulty` "per epoch, log scale" with the "÷4 escape hatch · epoch 14" annotation; `epoch duration`
"bars; amber = closed by the escape hatch" with `T_MAX 1200 s · anyone may roll` and `expected 300 s` lines; the
fourth is `retarget at each close` (the plan's decision ledger replaced "time between claims", which needs block
scanning). Row 5: the table full width ("epochs · newest first · CSV · JSON"). Row 6: `what is not here` `span 3` with
a violet border beside `verify` `span 3` (chips + the reproduce command). Bar: brand · Stats · Verify · Miner ↗ · env
pill · "block 184,221 · 12 s ago".

**L2 landing** (seven frames, each one screen at 1120): hero `grid-template-columns: 1fr 1.1fr; gap: 30px; padding:
56px 36px 44px`, left column centred (`.hero-h` 50 px, `.sub`, the two `lg` buttons with `uv` primary, the hint), right
the demo tile `padding: 14px 16px` (live pill + "live from the chain", canvas `data-h="250"`, the caption); money
`padding: 32px 36px; grid 1fr 1.25fr; gap 36px` (`.sec` + 30 px heading + `.rule` rows `118px 1fr` left, the `cmp4`
table right); chain `grid 1fr 1fr; gap 40px` (heading + body + three chips left, the holding paragraph + three
`kv`-style rows right); how `padding 32px 36px`, three tiles `1fr 1fr 1fr; gap 16px`, the docs link; live `padding
28px 36px; grid repeat(4, 1fr) 1.4fr; gap 16px; align-items: end` (four `.big` KPIs and the 44 px sparkline with "difficulty
since launch · all stats →" in one row, no heading); verify `grid 1fr 1fr` (heading + body left, chips + three `sm`
buttons right); ask `padding 44px 36px`, centred, 36 px heading, `uv` + outline `lg` buttons; footer `padding 18px 20px`.

## Architecture & Implementation

**Shells.** 1120 is the **outer** frame width: the three `App.tsx`s use `max-w-[1120px]` with no horizontal
padding of their own; the bar and each page body apply the binder's inset once (`px-5` on the bar, the body's
`p-5`, the landing frames' own paddings). Tailwind v4 arbitrary values, no new tokens. The miner's `Mine.tsx` grid becomes
`grid-cols-[1fr_1fr_1fr_300px] gap-[14px]` from `xl` (1280) with the binder's spans (`col-span-3`, `row-span-2`); below
`xl` and above `md` a two-column block (loop + KPIs, then the rail beside the ledger), per the binder's responsive note.

**Tiles.** `Tile` gets the binder's `padding: 16px 18px` (today `p-4`); `TileHeader` renders `h5`-style mono labels in
`ink-3` with the `aside` in `ink-4`; `Kpi` keeps its sizes (they match) and takes the label tone, the unit tone
(`ink-3`) and the `md` line-height (1.1). The token drifts in `theme.css`: `eyebrow` → 11.5 px / lh 1, `label-mono` →
`ink-3`, the tile radius → 8 px. Every surface inherits.

**Miner cockpit (arc 1).** `LoopTile` splits into the loop tile (header, `ScoreLoop height={230}`) and three
`Kpi size="lg"` tiles (the binder's `.big`) placed by the grid; `RailTile` keeps `EpochRail` + `PowerSlider` and takes
`row-span-2`; `LedgerTile` and `WalletCard` fill row 3. The header's "3.26 s per proof" is the existing rate readout
moved into the tile header aside. The key tile's Withdraw and Receive buttons **navigate to the wallet route** (the
sheet and the address already live there); no transaction logic is duplicated. No behaviour change: the controller,
reducer and E2E test ids are untouched. The stats' `VerifyTile` reuses the Verify route's record formatting
(`shortHash`, the launched-at stamp) rather than a second formatter.

**Landing (arc 2).** `Section.tsx` becomes a thin frame wrapper (the section element, its id and test id, the
binder's padding, a bottom rule) that renders its children only; each section composes its own grid and places its
own eyebrow and heading (the money and verify frames put them in the left column, which a preset cannot do). The
sections keep their ids and test ids. `Hero.tsx` uses the `1fr 1.1fr` grid, `hero-h` at 50 px, purple `uv`
primary, `ScoreLoop height={250} hero`; `Chain.tsx` gets the three footprint chips (the `Marks` component's chip style)
under the heading; `Live.tsx` becomes the one-row strip (four `Kpi size="lg"` + a 44-px sparkline) without a heading;
`Ask.tsx` centres. Copy is unchanged except what the frames name differently (none found).

**Stats (arc 3).** `Stats.tsx` becomes the six-column grid with the binder's spans; `Observatory` renders six `Kpi`
tiles at `.num` size in one row (the calculator link stays in the network tile); `Detail` gets the three inline KPIs;
the closing row pairs `NotHere` (violet border) with a compact `Verify` tile (chips + the reproduce command, linking the
full Verify route).

**Charts on Observable Plot.** `web-stats/src/charts/plot.tsx`: one `useChart(spec)` hook that owns the container
(measures its width with a `ResizeObserver`), builds `Plot.plot(spec(width, rows, selected))` on every data change,
replaces the previous SVG, and cleans up on unmount; `charts/specs.ts` owns data, scales and marks. Plot's SVG
hard-codes `font-family="system-ui"` and a light `--plot-background`, so the theme goes through Plot's own `style`
option: `fontFamily: 'var(--font-mono)'`, `color: 'var(--ink-2)'`, `'--plot-background': 'var(--panel)'` (the
tooltip's fill), and every mark's `fill` / `stroke` as a CSS variable (`var(--uv)`, `var(--warn)`, `var(--ink-3)`);
Plot passes them through untouched (probed), so the charts follow `ThemeProvider` and the light palette with no
token copying.
Hover: `Plot.tip` with `Plot.pointerX` on each chart (the epoch, claims, duration, difficulty, retarget), `Plot.crosshair`
on the difficulty line. Annotations: `Plot.ruleY` + `Plot.text` for `expected` and `T_MAX` on the duration chart,
`Plot.ruleX` + `Plot.text` at every `roll()` close on the difficulty chart, placed at the successor epoch's
boundary and labelled with the **observed** retarget from the row (`×4.00 escape hatch · epoch N`, or the actual
ratio when the target saturated at `U128_MAX` and the easing was less: the binder's "÷4" is the usual case, not a
rule). Selection: a `Plot.dot` / `Plot.rectY` halo mark on the selected epoch. **Chart semantics**: the
duration chart keeps real durations on a **log y scale** with an explicit, labelled baseline (`y1: 10`, `y2:
duration`; Plot's implicit zero baseline draws nothing on a log scale, probed) and the axis starting at 10 s; a
duration below the baseline or not a finite positive is drawn as a hollow marker at the baseline with an `ariaLabel`
saying so (an omitted bar cannot explain itself); the fixture's 26 136-second epoch 0 stays a true bar; `T_MAX` is a
rule, never a cap: rolling is allowed after it, not forced; the emission chart's x is **elapsed time from the
oldest loaded row** (the binder's axis), the schedule line from the same origin, so the loaded window is explicit in
the caption; difficulty is a **step line** (constant within an epoch, the binder's drawing); retarget bars grow from a
**baseline of 1** (`y1: 1`), violet below, grey above. **Poll transitions**: `Plot.plot()` returns fresh nodes, so a
keyed per-mark tween is not available; the hook **redraws** on every input change (rows, selection, container width) and **animates** only when the
set of epochs changed (a close or an open, not a claim count, never the freshness tick): the figure has an explicit
height (the spec's), the outgoing SVG is `aria-hidden` with `pointer-events: none`, fades out over 240 ms while the
new one fades in, and is removed on the transition's end, on interruption by the next redraw, and on unmount;
under `useReducedMotion` the swap is instant. **Per-datum test hooks**: every data mark carries Plot's `ariaLabel` channel (`epoch 3: 4 claims, 300 s`); the
mark's `className` is a constant on its enclosing `<g>` (probed), so the roll bars are a separate `barY` mark with
`className: 'roll'` beside the `claims` bars, the halo its own mark (`halo`), the difficulty points `point`; the tests
count the labelled `rect` / `circle` children of those groups, not the groups. `frame.tsx` is deleted. Plot is loaded with the stats page only
(a `bun run site:build` listing in the lessons proves the landing's chunks are unchanged).

**Screenshot gate (arc 3, last phase).** A **fixture-only** runner with its own config, build and server, no
node and no global setup: `web-stats/playwright.visual.config.ts` (`testMatch: visual.e2e.ts`, no `globalSetup`,
`snapshotPathTemplate` without a platform suffix, `updateSnapshots: 'none'` under `CI`) and `e2e/visual-setup.ts`
(Bun): a **stats-only** `vite build` in e2e mode into `e2e/.visual-dist` with the fixture's deployment record and a
fixed `VITE_SOURCE_COMMIT` (the site config gains that override for e2e builds, today it reads Cloudflare / GitHub
variables or `git`), the committed layouts fixture and only chunk 0 of the slot table copied in (no 512-chunk
generation, no CRS, no artifacts), `vite preview` on a registry-claimed port (lane 4, the stats lane) owned by the
runner and torn down by it. `visual.e2e.ts` routes **every** JSON-RPC call to recorded answers (the fixture's storage
slots, one block header with a fixed timestamp, the deployment check) and **fails on any unexpected request**; it pins
every other visible input: `page.clock.setFixedTime` at the fixture's block time (`nowSec = max(block.timestamp, now)`
is then fixed), viewport 1280×900 and 1440×900 at DPR 1, `locale: 'en-US'`, `document.fonts.ready` awaited,
`animations: 'disabled'`, `caret: 'hide'`, full-page capture at 1280 and 1440 plus a 1024 (two-column) and a 390
(phone) capture; `maxDiffPixels: 0` and `threshold: 0` (Playwright's `threshold` is a perceived-colour tolerance per
pixel, not anti-aliasing slack; at 0 a token-colour change fails); no masks. **Rendering environment**: the frozen
lockfile pins Playwright and with it the Chromium build, but system libraries move, so the baselines are recorded and
checked in the same pinned image, `mcr.microsoft.com/playwright:v<pinned>-noble`, in CI **and** locally (`bun run
--cwd packages/web-stats test:visual` runs the spec inside that container through `docker run` with the package
mounted; Docker is on the homelab); a Playwright or image upgrade regenerates the baselines in a reviewed PR. A
missing baseline fails. **Proof the gate bites** (P3.3's gate): three deliberate regressions (a tile's padding off by
2 px, a tone swapped from `ink-3` to `ink-2`, a chart mark's colour) each fail the spec before the baselines are
committed. **Enforcement**: the spec runs in `web-stats.yml`'s PR gate (the Playwright image as the job container;
benchmarked in P3.3 to fit the 15-minute job: the stats-only build is seconds, the two captures under a minute) and
uploads expected / actual / diff images as a workflow artifact on failure, so a PR cannot merge past a changed page
without a baseline diff in the review; baseline updates are `test:visual -- --update-snapshots` inside the same
image. Whether the first baseline is faithful is decided by the arc-3 codex review against the binder frame; the
gate then holds that state. The miner and landing get no pixel gate (live proving,
live block time); their fidelity is held by the PR screenshots, the arc reviews, and **browser-side layout assertions**
in their E2E specs (computed `grid-template-columns` and container widths at 1280 and 1440; jsdom cannot lay out).

**Trade-offs.** (1) The chart tests count Plot's real marks through the `ariaLabel` / `className` channels (rendered
bars, points, the halo, the amber `roll` class); tooltip behaviour is asserted in Playwright, where Plot's SVG
geometry exists, not in jsdom. (2) The landing keeps its 12-point hand-rolled sparkline rather than pulling Plot into
a page whose E2E asserts nothing heavy loads before the click. (3) A responsive two-column block between 900 and
1280 (loop + KPIs on top, the rail beside the ledger below), the binder's own note; the exact composition is judged on
screenshots in the arc-1 review and recorded in the lessons. (4) Whole-figure cross-fade instead of per-mark tweens:
Plot re-creates its nodes on every render, so interpolation would mean a second charting layer; the binder itself asks
for quiet refresh motion.

**File-level change map.** Modified: `ui/src/theme.css`, `ui/src/components/{tile,kpi}.tsx`; `web-miner/src/App.tsx`,
`routes/Mine.tsx`, `features/{LoopTile,RailTile,LedgerTile}.tsx`, `components/WalletCard.tsx`, `shell.vitest.tsx`;
`web-landing/src/App.tsx`, `sections/{Section,Hero,Money,Chain,Live,Verify,Ask,Demo}.tsx`, `sections.vitest.tsx`;
`web-stats/src/App.tsx`, `routes/Stats.tsx`, `features/{Observatory,Strip,Detail,NotHere}.tsx`, `charts/index.tsx`,
`stats.vitest.tsx`, `e2e/stats.e2e.ts`, `playwright.config.ts`, `package.json`; `.gitignore`. Added:
`web-stats/src/charts/plot.tsx`, `web-stats/src/charts/specs.ts`, `web-stats/e2e/visual.e2e.ts` + its snapshots dir,
`web-stats/e2e/visual-setup.ts`, `web-stats/playwright.visual.config.ts`, `web-stats/e2e/visual-rpc.json` (the
recorded answers), `web-stats/src/features/VerifyTile.tsx`, `implementations-plan/yacana-fidelity/shots/<arc>/`.
Modified also: `site/src/config.ts` (`VITE_SOURCE_COMMIT` override in e2e mode), `.github/workflows/web-stats.yml`.
Deleted: `web-stats/src/charts/frame.tsx`.

## Phases

### Arc 1 · miner (`fidelity-miner`)

**P1.1 Shell width, tile and token fidelity.** ✓ Goal: the three `App.tsx` shells at 1120 (outer) with the inset
applied once; `Tile` padding 16/18 and radius 8; `TileHeader` and `Kpi` labels in `ink-3` with `ink-4` asides, unit
tone `ink-3`, `md` line-height 1.1; `eyebrow` 11.5/1. Tests: a ui Vitest spec asserts the tile classes; the miner shell
spec asserts the 1120 max width. Because the shared primitives change, every surface is rendered at 1280 and 1440
(miner cockpit, key screen, wallet, settings; landing; stats) into the scratchpad and eyeballed before the gate.
Gate: `bun run lint` · `bun run --cwd packages/ui typecheck` · `bun run test:components` (ui, web-miner, web-stats,
web-landing all green: the token change reaches every surface) · the six renders reviewed. Layers: lint · component.

**P1.2 The M1 cockpit grid.** ✓ Goal: `Mine.tsx` on `1fr 1fr 1fr 300px / 14px` from `xl` with the binder's spans and the
two-column block below it; the loop tile with the binder's header and `height={230}`; the three `lg` KPI tiles; the rail
`row-span-2`; the ledger and key tile (Withdraw / Receive → the wallet route) in row 3. Tests: `shell.vitest.tsx`
asserts each tile's span classes; `miner.e2e.ts` gains a layout assertion (computed `grid-template-columns` of the
cockpit at 1280 and 1440, and the two-column block at 1024); the existing controller/reducer specs unchanged.
Gate: `bun run lint` · web-miner `tsc -b` · `bun run --cwd packages/web-miner test:components` · `bun test
packages/web-miner` · `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` (11 specs: the cockpit's test
ids are the E2E's handles). Layers: lint · component · e2e-isolated.

**Arc 1 boundary**: 1280/1440 screenshots of `/mine/` beside the M1 frame into the PR body; the codex loop; then
`gh stack add fidelity-landing`.

### Arc 2 · landing (`fidelity-landing`)

**P2.1 The seven frames.** Goal: `Section` as the thin frame wrapper; hero, money, chain (with the chips, labelled
illustrative), how, live (one row, no heading, 44-px sparkline, "recent epochs" wording), verify, ask (centred) and
the footer to the binder's paddings and ratios; `uv` primary buttons; `ScoreLoop height={250} hero` in the hero; below
`md` the frames stack, never seven viewport-height screens. Tests: `sections.vitest.tsx` asserts the section order
(unchanged) and the chain chips; `landing.e2e.ts` gains the layout assertions (hero and live grid templates at 1280
and 1440, the ask's centring).
Gate: `bun run lint` · web-landing `tsc -b` · `bun run --cwd packages/web-landing test:components` · `bun run e2e:agent
-- bun run --cwd packages/web-landing test:e2e` (3 specs, incl. "nothing heavy before the click"). Layers: lint ·
component · e2e-isolated.

**Arc 2 boundary**: screenshots of `/` at 1280/1440 beside the L2 frames; the codex loop; `gh stack add fidelity-stats`.

### Arc 3 · stats (`fidelity-stats`)

**P3.1 The A1 grid.** Goal: `Stats.tsx` on `repeat(6, 1fr) / 14px` with the binder's spans from `xl`, two rows of
three KPIs below it; the strip beside the detail (three inline KPIs); the table; `NotHere` beside the new `VerifyTile`
(the Verify route's formatting reused). Charts still the SVG ones. Tests: `stats.vitest.tsx` asserts the span
classes; `stats.e2e.ts` gains the grid-template assertion at 1280 and 1440; existing assertions unchanged.
Gate: `bun run lint` · web-stats `tsc -b` · `bun run --cwd packages/web-stats test:components`. Layers: lint · component.

**P3.2 Charts on Observable Plot.** Goal: `@observablehq/plot@0.6.17` in `web-stats`; `charts/plot.tsx` (`useChart`:
container, resize, replace, cleanup, the whole-figure cross-fade on row-set changes, reduced motion) and
`charts/specs.ts` (the four specs with the semantics above: log durations with `T_MAX` and `expected` rules, elapsed-time
emission, step-line difficulty with roll annotations, retarget from a baseline of 1; domain guards); `charts/index.tsx`
rewired; `frame.tsx` deleted; the theme through Plot's `style` and explicit mark colours. Tests: `stats.vitest.tsx`
counts real marks through `ariaLabel` / `className` (8 duration bars, the first with class `roll`; 9 difficulty points;
one `halo` when selected; none when the open epoch is "selected" on a closed-only chart); `e2e/stats.e2e.ts` asserts
the four halos as `.halo` marks, hovers the difficulty line and reads the tip's text, and checks the duration bar for
epoch 0 renders at its true 26 136 s (the log scale's tick labels include 10 000 s).
Gate: `bun run lint` · web-stats `tsc -b` · `bun run --cwd packages/web-stats test:components` · `bun run e2e:agent --
bun run --cwd packages/web-stats test:e2e` · `bun run site:build` (the Plot chunk lands only under `/stats/`; the
landing's bundle unchanged: asserted by `ls dist/assets` sizes in the lessons). Layers: lint · component ·
e2e-isolated.

**P3.3 The screenshot gate.** Goal: the fixture-only runner (`playwright.visual.config.ts`, `visual-setup.ts`
with the stats-only e2e build, the recorded RPC answers, the owned port and teardown), `visual.e2e.ts` (fixed clock,
fixed record and commit, fonts awaited, animations off, full page at 1280 / 1440 / 1024 / 390, zero tolerance,
unexpected requests fail), the `test:visual` script running inside the pinned Playwright image; baselines committed;
`.gitignore` carve-out; `web-stats.yml` runs the spec in that image with `updateSnapshots: 'none'` and uploads the
diff images on failure; the README's "update the baselines" line.
Gate: three deliberate regressions (padding, tone, mark colour) each fail the spec, then the baselines are recorded
and `bun run --cwd packages/web-stats test:visual` passes twice without `--update-snapshots` · a clean-checkout timing
of the visual job under 15 minutes in the lessons · `bun run lint` · `bun run lint:actions`. Layers: lint · e2e
(fixture). The arc-3 PR's CI run is the same-image check (Inference 2).

**Arc 3 boundary**: screenshots of `/stats/` at 1280/1440 beside A1; the codex loop; then the final cross-arc pass.

## Validation layers

lint/typecheck (Biome, `tsc -b` per app) · component (Vitest + RTL, `*.vitest.tsx`) · unit (`bun test`) · e2e-isolated
(Playwright on the isolated local network through `bun run e2e:agent`). No testnet layer: nothing here touches chain
behaviour. The screenshot gate is part of the e2e-isolated layer.

## Security & Adversarial Considerations

- **Threat model**: the one new attack surface is a dependency, and it is **wallet-origin code**. `/stats/` shares
  the origin with `/mine/`: the vault (`yacana-keys` IndexedDB) and the PXE store are reachable by any script on that
  origin, the sealed words / convenience-mode masters can be decrypted by the device key from that same database
  (non-extractable stops export, not use), and the CSP admits the node, so a compromised Plot release could sign and
  send a transaction from a sealed key (passkey keys in the default mode have no secret at rest and are not
  exposed). The impact is therefore a wallet compromise, not a mislabelled chart. The mitigations reduce probability,
  not impact: `@observablehq/plot` and its tree (34 packages, all Observable / d3 maintained) enter under the 7-day
  min-age (every version here is a year or more old), the frozen lockfile, `bun audit` in CI, a `bun.lock` diff
  reviewed in the PR; **the owner accepts this risk explicitly** (Ask 1 below); the roadmap records "move `/stats/`
  and `/` to a separate origin (`stats.yacana.network`) before mainnet" as the structural fix, since the binder's
  own site map already used separate hosts. d3-dsv's object parser needs `unsafe-eval` and is never imported; the
  emitted bundle graph is checked in the lessons.
- **CSP unchanged**: Plot sets inline `style` attributes and injects one `<style>` element (both already allowed for
  Radix and Sonner by `style-src 'unsafe-inline'`); its `tip` and `text` marks render text nodes, never markup. The
  E2E's header assertions and `headers.test.ts` stay as they are.
- **Inputs**: the reader bounds each field, not their order: the chart specs guard their domains (durations and
  retargets that are not finite positives are dropped from scales and the tooltip says so), and tooltip text is built
  from numbers, never from strings a node controls.
- **XSS**: no `dangerouslySetInnerHTML`; Plot builds DOM nodes, not markup strings.
- **The screenshot baselines** are PNGs the repo commits and the gate compares with zero tolerance beyond
  anti-aliasing; a PR that changes a baseline, the spec's config or the fixture shows the expected / actual / diff
  images and is reviewed like code; a missing baseline fails the gate.
- **Supply chain / CI**: no new workflow permissions; the visual spec runs inside the existing `e2e.yml` on-demand job
  and the local gate.
- **The landing** ships no Plot (its E2E asserts nothing heavy loads before the click; Plot would be caught by the
  `net.heavy` check only if it matched the regex, so the lessons record the bundle listing instead).

## Assumptions

**Facts** (verified):
1. The binder's frames are measured: M1 `1fr 1fr 1fr 300px / 14px`, A1 `repeat(6,1fr) / 14px`, L2 per-frame grids and
   paddings, the type scale and button sizes (extracted from the binder's CSS and markup; `recon.md`).
2. Every UI primitive the layouts need exists with matching sizes: `Kpi` md/lg = `.num`/`.big`, `Button` uv/lg/sm =
   `.btn.uv`/`.lg`/`.sm`, `ScoreLoop` has `height` and `hero` props (`recon.md` §3).
3. The palette in `ui/src/theme.css` equals the binder's; the drifts are `eyebrow` (11 vs 11.5 px, lh 1.3 vs 1),
   the tile-label tone (`ink-2` vs `fg-3`), the tile radius (10 vs 8 px), the `md` KPI line-height (1.2 vs 1.1) and
   the unit tone (`ink-2` vs `fg-3`).
4. `@observablehq/plot@0.6.17` (2025-02-14) installs under `minimumReleaseAge = 604800` with 42 packages (probed in a
   scratch project); it sets `style` attributes, injects one `<style>` element per figure, hard-codes
   `font-family="system-ui, sans-serif"` on the SVG, supports a per-datum `ariaLabel` channel while `className` is a
   constant on the mark's group, passes CSS variables through as `fill` / `style` values, and draws no `barY` on a log
   scale without an explicit positive `y1` (all probed against the installed 0.6.17); `style-src 'unsafe-inline'` is
   already in the CSP.
5. The chart test contract today is `data-slot` counts and one page-wide halo count (`recon.md`, "Chart test
   contract").
6. No screenshot assertion exists anywhere; the stats mocked-node E2E freezes storage slots but forwards block reads
   and the deployment check to the live node, and the page's clock is `max(block.timestamp, Date.now())`.
8. `/stats/` and `/mine/` are one origin: the vault's IndexedDB (`keys/store.ts`, `yacana-keys`) and its
   non-extractable device key are reachable by any script served from it.
9. `e2e.yml` is `workflow_dispatch` only; the PR gates are `web-miner.yml`, `web-stats.yml`, `web-landing.yml`,
   `ui.yml`, `site.yml`.
10. `ScoreLoop`'s `hero` prop is already used by the landing's `Demo.tsx`.
7. The three shells cap at 768 / 1024 / 1024 px; the cockpit grid is two columns with a 320-px rail.

**Inferences** (unverified, checked in the named phase):
- Plot's `style` option plus explicit mark colours match the binder's chart look (P3.2; high confidence, the option
  exists for exactly this).
- A fixture-only visual spec is pixel-stable inside one pinned Playwright image, locally and in CI (P3.3; the
  gate's own proof: the baselines recorded locally in the image pass in CI's run of the same image; if they do not,
  the baselines are regenerated from CI's run and the local run becomes advisory, never a wider tolerance).
- The stats-only visual build and its two captures fit `web-stats.yml`'s 15-minute job (P3.3 benchmarks a clean
  run; fallback = a separate `web-stats-visual.yml` job with its own budget).
- The 900–1280 two-column block reads as the binder intends (P1.2, judged on screenshots in the arc review).

**Asks** (settled at the approval gate, not silently assumed):
1. **Wallet-origin risk**: accept that Plot + d3 run as wallet-origin code with the mitigations above, and that a
   separate stats origin goes on the roadmap for mainnet; or drop Plot and upgrade the hand-rolled charts instead.
2. **"Dynamic" charts** means tooltips, crosshair, annotations, a selection halo and a whole-figure cross-fade on new
   epochs; no continuous motion. Confirm this reading.
3. **Intermediate and mobile compositions** (900–1280 two-column block; the stats KPIs two-by-three below `xl` and
   one column on phones, never three cramped columns; the landing frames stacking below `md`) are the agent's judgment,
   reviewed by codex on screenshots and logged; the owner sees them in the PR screenshots, which include 1024 and 390
   captures beside the 1280 / 1440 ones.
4. **Baselines** are owned by whoever changes the page: updating them is part of that PR, and the arc-3 review judges
   the first set against the binder.

## Fidelity decisions (from the plan audit)

| frame element | decision |
|---|---|
| the binder's fabricated numbers (claim timestamps, "≈ one laptop", example hashes, the "time between claims" histogram) | never copied: the pages show live values; the retarget chart stays in the histogram's place (block scanning is out of scope) |
| the binder's older privacy copy ("Private: everything else", "never who · how fast · how much") | the shipped, qualified copy stays (the surfaces plan's cross-arc review settled it); the chain section's three chips are labelled illustrative |
| "difficulty since launch" | "recent epochs" stays (the page holds a window) |
| seven viewport-height landing screens | desktop proportions only; below `md` the frames stack to content height |
| six stats KPIs in one row | from `xl`; two rows of three below |
| the demo panel's proving / error states | preserved exactly (the binder draws only the happy path) |
| quiet refresh motion | the binder asks for it: cross-fade on new epochs, nothing continuous |
| the dim inks (`fg-3` .40, `fg-4` .22 over the tiles: 3.5:1 and 1.9:1) | `ink-3` is raised to .50 (light .60) so the binder's dim labels, hints and units meet 4.5:1; tile-header asides take `ink-3`, not `fg-4`; `ink-4` stays for pending steps and word indices only (arc-1 review) |
| the cockpit tile's state pill | the loop tile's header is the plain M1 label ("live · one dot per proof", or the phase); the state pill lives in the bar; a page-side pause keeps its red pill in the tile (arc-1 review) |
| the elapsed strip under the epoch segments | removed: M1 has the segments and six rows; "open for" and "expected close" carry the time (arc-1 review) |

## Delivery

| arc | branch | phases | stacks on | code_review |
|---|---|---|---|---|
| 1 miner | `fidelity-miner` | P1.1–P1.2 | main | off |
| 2 landing | `fidelity-landing` | P2.1 | arc 1 | off |
| 3 stats | `fidelity-stats` | P3.1–P3.3 | arc 2 | off |

`gh stack init fidelity-miner` at the start (the branch exists, off `origin/main` `9197fee`); at each boundary, after the
arc's codex loop converged, `gh stack add <next>`; `gh stack push` for checkpoints. PRs exist only at Delivery:
`gh stack submit --auto --open`, then `gh pr edit` each body with the gate lines, the codex rounds and the
screenshots. **Image hosting**: `gh pr edit` cannot upload files, so the 1280 / 1440 / 1024 / 390 renders and the binder frame
are committed under `implementations-plan/yacana-fidelity/shots/<arc>/` (PNG, ~200 KB each) and referenced from the PR
body by their `raw.githubusercontent.com` URL on the branch; they stay in the repo as the plan's evidence. After a
`gh stack sync` the affected arcs' fast gates (lint, typecheck, Vitest) rerun before `gh pr checks --watch`. The owner
merges (`gh stack merge`) and deploys each merge with `bun run site:deploy`; the agent never deploys production. The
stack does not touch the contracts or the reader.

## CI

No new workflows. `web-miner.yml`, `web-landing.yml`, `web-stats.yml` and `ui.yml` already run lint, typecheck and the
Vitest specs for their packages; the Plot dependency lands in `web-stats/package.json` and `bun.lock`;
`web-stats.yml` gains the fixture-only visual spec (`playwright install chromium`, `test:visual`, `updateSnapshots:
'none'`) so the screenshot gate is a PR gate, not an on-demand job.

## Post-implementation

Executed by the implementing session from this file. `code_review` is `off`: `/code-review` is NOT run at any point.

1. **Per arc, at the arc boundary** (all of the arc's phases ✓, before `gh stack add` for the next arc): render the
   surface at 1280 and 1440 with Playwright against the isolated E2E server (or `bun run --cwd <pkg> preview`) into the
   scratchpad `shots/`, next to the binder frame's screenshot. Send codex (`/codex xhigh`, a NEW session per arc) the
   arc's diff, this plan, `recon.md`, the arc map ("this is arc N of 3; later arcs build X on it"), the paths of the
   live and binder screenshots for that surface (codex reads images from the filesystem in its sandbox; if it cannot,
   the prompt carries the measured spec instead), the fidelity ask ("does the page match the frame? where it does
   not, is the deviation justified by the binder's own notes or by an unachievable frame?") and the adversarial ask,
   plus the two rules below verbatim. Triage (verify codex's claims against the code and the screenshots), apply the
   accepted fixes, commit, log the round in `lessons/phase-N.md`, RESUME the same session with the fix diff. Repeat
   until a round yields no new material findings; still churning after 3 rounds → stop and surface to the owner.
2. **After all three arcs**: one final cross-arc pass in a FRESH codex session over the net diff from `9197fee`,
   asking for seams between arcs (the shared `Tile`/`Kpi`/`Section` changes as each surface uses them), duplication
   across arcs and drift from this plan, with the same rules and the same loop-until-clean.
3. **Delivery**: only now create the PRs: `gh stack sync` if trunk moved, `gh stack submit --auto --open`, `gh pr
   edit` each body (screenshots, gates, codex rounds), `gh pr checks --watch`. Update `implementations-plan/index.md`.
   Never `gh stack merge`; never `bun run site:deploy` (the owner deploys after each merge).

**The no-over-engineering rule** (verbatim in every post-impl codex prompt): *"Report bugs and small, targeted
improvements only. Do not propose speculative abstractions, extra configuration surface, new layers, or rewrites — the
smallest change that fixes each real problem. If code works and is clear, leave it alone."*

**The comment-quality rule** (verbatim in every post-impl codex prompt): *"Audit the comments for value per character.
Flag any comment that narrates what the code visibly does, restates its line, references implementation plans / phases /
reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious invariant or constraint
deserves a comment it doesn't have. Comments are permanent context every future reader, human or LLM, pays to re-read:
they must be few, dense, and exact."*

Failure-retry policy: human-driven, 3 failures on one step → stop and reassess; autonomous `/loop`, 5. Lessons in
`lessons/phase-N.md` for every meaningful attempt; `agent-worktree status yacana-surfaces "yacana-fidelity phase N
green: <next>"` at each gate. Hard limits: never merge, never deploy, never push to `main`, never expand scope beyond
this plan (the miner's other screens, the landing's copy, the reader).

## Approval

ELI5: https://claude.ai/code/artifact/f38d46fd-ce84-4852-8811-d926c1df2782 (source `eli5.html` in this directory).
Codex plan audit: round 1 `reject` (eight findings, all adopted), round 2 **`conditional approve`** (seven
conditions, all adopted): `audit-codex.md`. **Approved by the owner on 2026-09-06**: Ask 1 accepted (Observable
Plot on the wallet's origin with the supply-chain guards; a separate stats host before mainnet on the roadmap), Asks
2–4 confirmed. The seeds below are final.

## Seeds

Recommended: `/goal` (completion is transcript-observable).

```
/goal All phases marked ✓ in implementations-plan/yacana-fidelity/plan.md (the per-phase headers in the file — not the chat, not the task list), each ✓ backed by its phase's validation gate (as defined in plan.md) reported passing in the transcript; for each phase the agent has printed `LESSONS_FILE=implementations-plan/yacana-fidelity/lessons/phase-N.md` in the transcript; `/code-review` was NOT run (code_review is off); the codex fix loop converged for EVERY reviewed diff — each of the three arcs at its boundary plus the final cross-arc pass — each convergence evidenced by a resumed codex pass reporting no new material findings, quoted in the transcript; the Delivery section's PR topology exists on GitHub, created only AFTER all loops converged (`gh stack view` output in the transcript), each PR body linking the 1280/1440/1024/390 screenshots beside the binder frame; `bun run lint` and `bun test` both report exit 0 in the transcript.
```

Alternative: `/loop 15m` (the standard drive prompt from the blueprint skill, with `bun run lint` / `bun test` as the
fast layers and this plan's path).
