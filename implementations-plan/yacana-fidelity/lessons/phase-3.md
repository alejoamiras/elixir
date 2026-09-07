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
