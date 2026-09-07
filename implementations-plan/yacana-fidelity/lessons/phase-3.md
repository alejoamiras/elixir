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

## Arc 3 codex loop (2026-09-07)

Session `01a079b9-b822-7d83-a154-658635c46c9e` (`/codex xhigh`, read-only, a new session over `56cd7d3..1ba4666`
with the plan, the recon, this file, the arc map, the A1 frame and the four baselines).

**Round 1** — eight findings, all verified before acting:

1. *Should-fix, accepted.* The duration and retarget band axes labelled every epoch: with the normal 48-epoch
   window the labels were 5 px apart at phone width. `epochTicks` samples every k-th epoch for the width at
   hand, the newest always among them; the difficulty axis uses it too (its `≤ 12` rule is gone).
2. *Should-fix, accepted.* A roll label always ran rightward at one height: a late roll ran off the chart and
   neighbours overlapped. Past 60 % of the axis the label reads inward; consecutive rolls alternate between
   two heights; the tip keeps the full text.
3. *Should-fix, accepted.* A1's strip is a thin band with epoch numbers where the block is wide enough and the
   launch / now labels under it; ours was a 64-px band of unlabelled colour. The band is 28 px, each block a
   container query that shows its number from 24 px, and "launch HH:MM:SS … HH:MM:SS · epoch N open" sits
   beneath.
4. *Should-fix, accepted.* The emission's origin (the oldest loaded row) was nowhere: "cumulative from epoch N"
   in the tile's aside and the figure's label.
5. *Should-fix, accepted.* The visual spec checked for unexpected requests only before the capture; a request
   the capture provoked could not fail it. Checked again after.
6. *Should-fix, accepted.* The Verify chip shows `W_VK_HASH` from `packages/work-circuit/src/generated/vk.ts`,
   which the workflow's path filter did not name: a change there alone would skip the gate and fail a later
   unrelated PR on the stale baseline. Added.
7. *Nit, accepted.* The E2E's chart claims exceeded their assertions (a bar capped at T_MAX would still pass
   the count, the label and the axis text; four halos anywhere; "difficulty" in any tip). Now the roll bar's
   top must sit above the 10 000 s gridline, each chart must hold exactly one halo, and hovering epoch 4's
   point must name epoch 4.
8. *Nit, accepted.* `crossFade`'s comment claimed both figures inert (only the outgoing lose pointer events);
   the `Chart` doc is one sentence.

The baselines were re-recorded (`--update-snapshots`) for the strip and the caption, as the README says they
must be: in the PR, reviewed. Gates after round 1: `bun run lint` ✓ · `bun run lint:actions` ✓ · `tsc` ✓ ·
Vitest web-stats 14 ✓ · the stats E2E 3 passed with the stronger assertions ✓ · `test:visual` 4 passed on the
new baselines ✓.

**Round 2** (resumed, over `1ba4666..5e1d5c1`): two should-fixes; codex confirmed the sampled ticks (eight labels
about 30 px apart at 48 epochs), the strip, the emission origin, the post-capture check, the filter, the per-chart
halos, the geometry / fill check and the named hover.
1. *Should-fix, accepted.* The roll labels still clipped (a roll at epoch 4 in a 312-px chart) and overlapped (the
   two anchor groups restarted their alternation). `placeRollLabels` measures each label (6 px a glyph, a short
   form under 480 px), reads rightward or inward as the frame allows, takes the first of two rows with room, and
   drops the label when neither has any; the difficulty tip now carries "closed by roll() · ÷N at the close",
   so a dropped label loses nothing.
2. *Should-fix, accepted with a different fix.* The strip's numbers in the binder's `INK(.85)` composite to
   2.6:1 on amber and 2.9:1 on grey. Codex offered per-tone foregrounds or a backing; the numbers sit on a
   small `ground` backing at 75 % (`text-ink`), legible on every tone and in both themes without touching the
   tokens. Recorded in the fidelity decisions.
   Gates after round 2: `bun run lint` ✓ · `tsc` ✓ · Vitest web-stats 14 ✓ · the stats E2E 3 passed ✓ · the
   baselines re-recorded and `test:visual` 4 passed ✓.

**Round 3** (resumed, over `5e1d5c1..315c788`): one should-fix; codex confirmed the horizontal placement, the tip's
annotation, the strip numbers' contrast (over 12:1 on every tone in both themes) and the baselines.
1. *Should-fix, accepted.* The two label rows were `hi` and `hi / 2.2` on the log scale, so their pixel gap shrank
   with the domain (7 px apart at difficulty 2^20). One text mark per anchor and row, all at `y: hi`, the second
   row `dy` 14 px lower: a fixed gap whatever the domain. The fixture's single roll sits in row 0, so the
   baselines are unchanged (`test:visual` 4 passed without an update).
   A fourth round confirms convergence: the plan's three-round hard stop is a scope smell for churn, and this
   was a 12-line follow-up of one item, not churn; surfaced to the owner in the final report all the same.

**Round 4** (resumed, over `315c788..3880f90`): "no new material findings". The arc-3 loop converged in four rounds;
the shots beside the A1 frame are `shots/arc3/`, identical to the committed baselines.

## Final cross-arc pass (2026-09-07)

Session `01a079d0-0f98-7531-b672-d80d6a95b84b` (`/codex xhigh`, read-only, a fresh session over the net diff
`9197fee..6cd4540` with the plan, the three lessons files and every shot), asked for seams between the arcs,
duplication, drift from the plan and the whole-site adversarial view.

**Round 1** — seven should-fixes and a nit, all verified before acting:

1. *Accepted.* `clock(now)` on the strip could throw `RangeError: Invalid Date`: `now` is the node's block
   timestamp, which no guard covered (the epochs' timestamps have `assertTimestamp`). The latest block goes
   through the same guard in `chain.ts`.
2. *Accepted.* The plan promised domain guards for the retarget chart; a ratio of 0 was dropped silently and 100
   drew outside the frame. Ratios outside the contract's [¼, 4] clamp are hollow markers at the baseline with a
   label saying so, never bars; a Vitest case renders a malformed history.
3. *Accepted.* The verify tile copied the Verify route's `AZTEC_NODE_URL=${url} bun run epoch:stats`; a URL with
   `&` backgrounds the assignment in a shell. One `reproduceCommand` (`lib/reproduce.ts`) single-quotes the URL,
   a quote inside included; both views use it; a unit test covers the three shapes.
4. *Accepted.* The difficulty axis printed every integer in full, up to sixteen digits: whole numbers below 1e6
   only, the compact form above.
5. *Accepted.* A duration exactly at the 10 s floor became a zero-height bar with no marker: bars need `> FLOOR`,
   the marker says "at or below".
6. *Accepted.* `render-surfaces.ts` still waited for "epochs, newest first" (gone since P3.1) and swallowed the
   timeout: it waits for a table row now and fails when the page never comes.
7. *Accepted.* The recorder launched Chromium outside its cleanup scope; a launch failure would have left the
   preview and the port reservation behind. The launch is inside `try`, the teardown always runs.
8. *Nit, accepted.* The visual config's header narrated its settings and the render script's header referenced
   reviews; both trimmed.
   Gates after the round: `bun run lint` ✓ · `tsc` ✓ · Vitest web-stats 15 ✓ · `bun test` (the reproduce test) ✓ ·
   the stats E2E 3 passed ✓ · the baselines re-recorded (the quoted command) and `test:visual` 4 passed without an
   update ✓.

**Round 2** (resumed, over `6cd4540..64e2b14`): one should-fix; the other seven dispositions confirmed by probes
(the oversized timestamp rejected, two markers and six bars, the floor marker, compact ticks, the quoted command
round-tripping `&` and quotes), the baselines byte-identical to the shots.
1. *Accepted.* Failing the render on a missed readiness (round 1) broke the landing at 390 and in launch mode:
   the demo copy it waited for is desktop-only and absent from the launch-week hero. The readiness is the live
   strip's epoch number, or the launch hero's phase, at every width; a run at 390 and 1280 against the public
   testnet rendered both.

**Round 3** (resumed, over `64e2b14..bf2b7f7`): one should-fix on the same line: `launch-phase` exists at once
with "reading the chain…", so a launch-mode capture could pass while loading. The readiness filters that text
out. A fourth resumed pass confirms convergence; the rounds past the plan's third were each a narrowing of one
tooling line in `render-surfaces.ts`, not churn in the product, and are surfaced to the owner in the report.

**Round 4** (resumed, over `bf2b7f7..2135c06`): "no new material findings". The cross-arc pass converged.

## Delivery (2026-09-07)

Stack #17: PRs #14 (`fidelity-miner` → `main`), #15 (`fidelity-landing`), #16 (`fidelity-stats`), created with
`gh stack submit --auto --open` after every loop converged; the bodies carry the gates, the rounds and the shots
by raw URL on each branch. Every check passed except the new screenshot-gate job on #16: "vite preview did not
start". Reproduced in the pinned image without host networking: the preview bound `localhost` on one loopback
family and Bun's readiness fetch resolved `localhost` to the other, so the server was up and the probe never
saw it (the E2E setups share the probe but had only ever run on the host). Binding `127.0.0.1` instead made the
page a "preview build" (the banner is by hostname) and moved every baseline by 55 px; the fix is the probe: it
tries `127.0.0.1` and `[::1]`, the page keeps its `localhost` URL, and the job keeps `e2e/.visual.log` as an
artifact. The reproduction and the local gate pass on the fix.
On the pushed fix the screenshot gate passed in CI inside the pinned image in 1 min 17 s (the same-image check
of the baselines; the job's budget is 15 minutes); every check on #14, #15 and #16 is green.

## Merge and deploy (2026-09-07)

Stack #17 squash-merged into `main` as `4846519` (#14, #15, #16 in one atomic merge) on the owner's word; the
merged tree diffed empty against the tested branch tip; `bun run site:deploy` from it uploaded 11 changed assets
and published Worker version `c18941c9`. Verified live: `/`, `/mine/`, `/stats/` and `/build.json` answer 200,
the build's commit is `4846519`, and a Playwright pass at 1280 shows the landing's strip reading the chain and
the observatory on 26 real epochs (`.run-state/live/`).
