# Phase 3 lessons · arc 3 · stats

## P3.1 The A1 grid (2026-09-07)

- `Stats.tsx` is the A1 frame: `grid-cols-6` from `md` with the binder's spans from `xl` (six KPI cells, the strip
  `span 4` beside the detail `span 2`, four chart tiles `span 3`, the table full width, "what is not here" `span 3`
  beside the new `VerifyTile` `span 3`); between `md` and `xl` the KPIs sit three to a row, the strip and the detail
  take the width, the charts pair up. `Observatory` renders its six tiles into the page's grid through a `contents`
  wrapper, at the binder's `.num` size (22 px); the epoch tile reads "2 · of 4 claims" and the last-claim tile
  "2 · in this epoch", the binder's number-plus-unit shape (the test ids stay on the numbers).
- `Detail` is the binder's card: the header carries "opened → closed", three inline KPIs (claims, warn-toned when the
  epoch was rolled; duration or "open for"; difficulty → next), the sentence as a hint, then the chips (how it
  closed, what it minted). The strip grew to the binder's 64 px and shows the selected epoch as a violet chip.
- The chart captions moved from the SVG frame's `figcaption` to the tiles' headers with the binder's asides; the
  table's header reads "epochs · newest first · CSV · JSON" with the downloads as text buttons; "what is not
  here" has the violet border and header; `VerifyTile` shows the identity chips and the reproduce command, linking
  the full record.
- Shared pieces: `Chip` (copy on click) moved to `ui` from the landing's Verify section, used by both;
  `durationParts` in `site/src/browser/format.ts` splits a duration into a KPI's value and unit (the miner's
  next-win tile uses it too).
- The stats Vitest setup stubs the build-time `VITE_*` (the deployment record, the source commit) as the landing's
  does: `VerifyTile` parses the record at module load. `render-e2e.ts` renders the stats page through the E2E's
  mocked node, so the captured nine-epoch history is what the renders show.
- The renders (`.run-state/renders-p31/`, the mocked nine-epoch history) match A1's composition; the tiles stretch
  to their rows as the binder's do (no `items-start` here: the KPI subs differ in length and the row reads as one).
  The E2E's six-track check compares numbers with half a pixel of slack: 1010 / 6 is not a whole number and
  Chromium reports the tracks at two rounded widths.

Gate: `bun run lint` ✓ · `tsc` web-stats / ui / web-landing / web-miner ✓ · `bun run test:components` ui 29 /
web-miner 34 / web-landing 11 / web-stats 14 ✓ · `bun test packages/web-miner/src/lib` (durationParts) ✓ · the stats
E2E 3 passed (45 s) with the grid assertion ✓ · the renders at 1280 / 1440 / 1024 / 390 reviewed against A1.

LESSONS_FILE=implementations-plan/yacana-fidelity/lessons/phase-3.md

## P3.2 Charts on Observable Plot (2026-09-07)

- `@observablehq/plot@0.6.17` (published 2025-02-14, far past the 7-day gate) in `web-stats` only: the site build's
  root bundle (the landing) has no Plot marker and the same size as the landing package's own build
  (954 601 bytes for its index chunk before, `index-iMH-uV3P.js` 961 383 in the assembled site, the difference
  being the assembled base path); the stats index chunk carries Plot (1 284 452 bytes, six `--plot-background`
  hits).
- `charts/specs.ts` owns data, scales and marks; `charts/plot.tsx` owns the DOM: a fixed 170-px container, a
  fresh `Plot.plot()` on every change of rows / selection / width (a `ResizeObserver`; 640 in jsdom), a 240-ms
  cross-fade of the outgoing figure only when the set of epochs changed (a close or an open), instant under
  reduced motion, the outgoing figure `aria-hidden` and inert meanwhile. `frame.tsx` is gone.
- Colours are the theme's variables in the marks (`fill="var(--warn)"`): a Chromium probe confirmed `var()`
  resolves in SVG presentation attributes, and the E2E asserts the roll bar's computed fill equals the computed
  `--warn`. Plot puts a constant fill on the mark's `<g>`, not each shape (the tests read it there). The
  figure's font, colour and `--plot-background` (the tip's fill) go through Plot's `style` option as one string.
- Semantics from the plan: the duration bars start at a 10 s floor (`y1`) on a log axis whose ticks reach
  10 000 s so epoch 0's 26 136 s is a true bar, `T_MAX` a rule with "anyone may roll" and `expected` a dashed
  one; the emission's x is hours since the oldest loaded row with the schedule from the same origin; the
  difficulty is a step line (the open epoch's step spans its width through a synthetic end point), log base 2,
  a roll annotated at the successor's boundary with the observed easing ("÷4.00 escape hatch · epoch 0"); the
  retarget bars grow from 1 on a log-2 axis, violet harder, grey easier. Tips through `pointerX` on every
  chart, a crosshair on the difficulty line, the selection as a translucent band (a dot on the emission).
- First render's faults, fixed before the gate: a 44-px left margin clipped "10000 s"; the amber `T_MAX`
  label vanished over the amber bar (labels now carry a halo in the tile's background); the difficulty ticks
  printed "16.0". Nine epochs put every epoch on the x axis; past twelve, eight ticks.

Gate: `bun run lint` ✓ · web-stats `tsc -b` ✓ · `bun run --cwd packages/web-stats test:components` 14 ✓ · the stats
E2E 3 passed (45 s: eight bars, four halos, the true 26 136 s bar with "10000 s" on the axis, the warn fill resolved
from the variable, the difficulty tip on hover) ✓ · `bun run site:build` ✓ with Plot only under `/stats/` (above) ·
the renders at 1280 / 1440 / 1024 / 390 reviewed against A1.

LESSONS_FILE=implementations-plan/yacana-fidelity/lessons/phase-3.md

## P3.3 The screenshot gate (2026-09-07)

- The runner is fixture-only: `visual-setup.ts serve` builds `e2e/.visual-dist` from the recorded deployment
  (`visual-deployment.json`) with the mock origin as the node, a fixed source commit (the site config honours
  `VITE_SOURCE_COMMIT` in e2e mode), only chunk 0 of the slot table (derived on the spot, no 512-chunk
  generation) and the layouts, then serves it on a registry-claimed port; `visual.e2e.ts` answers every
  JSON-RPC call from `visual-rpc.json` (40 answers: chain id, node info, two contracts, the latest block, 35
  storage reads) and aborts anything else, which fails the test; the clock is fixed before the recorded block,
  so the page's `nowSec` is the block's time and the freshness reads "0 s ago". Four full-page captures at
  1280 / 1440 / 1024 / 390 against `e2e/__screenshots__/`, `threshold: 0`, `maxDiffPixels: 0`, animations off.
- The recording (`visual-setup.ts record`, under `e2e:agent`) drives the built page once against a fresh
  deployment with the fixture's storage overlaid and the rest forwarded, and keeps every answer under its
  method and params. Both setups share `serve.ts` (the fixture storage, the build, the preview, the port).
- `test:visual` (`visual.ts`) runs the spec inside `mcr.microsoft.com/playwright:v1.62.1-noble` through
  Docker, or directly when `PLAYWRIGHT_VISUAL_IN_IMAGE=1` (the CI job runs in that container, with `unzip` for
  setup-bun). The homelab's Docker is rootless: the host user is the container's root, so a numeric `--user`
  would land on a subordinate uid with no access to the mount (the first run failed on `test-results`);
  `--user` is passed only under rootful Docker, where it keeps the baselines from coming back as root's.
- Proof the gate bites, before the baselines were committed: (a) the tile padding at 20 px instead of 18 — all
  four captures fail (59 208 pixels at 1280); (b) the KPI unit tone `ink-3` → `ink-2` — all four fail (598
  pixels); (c) the roll bars' colour `--warn` → `--uv` — all four fail (7 266 pixels). Then two clean passes
  (4 passed, 7 s and 8 s wall-clock each, build included). CI's number comes from the arc-3 PR (the same-image
  check); the job's budget is 15 minutes, its work is a checkout, `bun install`, one Vite build and four
  captures.
- The baselines are the arc-3 review's object: whether the first one is faithful is codex's call against A1;
  the gate then holds that state.
- The regular `playwright.config.ts` matched `*.e2e.ts` and so picked up the visual spec, which reads its run
  file at load: `testIgnore` keeps it out; the stats E2E passed again (3, 45 s).

Gate: three deliberate regressions each failed the spec (above) · `bun run --cwd packages/web-stats test:visual`
passed twice without `--update-snapshots` (7 s, 8 s) · `bun run lint` ✓ · `bun run lint:actions` ✓ ·
`bun run lint:shell` ✓ · `bun test` 147 pass / 8 skip ✓ · `bun run test:components` 29 / 34 / 11 / 14 ✓ · the stats
E2E 3 passed ✓.

LESSONS_FILE=implementations-plan/yacana-fidelity/lessons/phase-3.md
