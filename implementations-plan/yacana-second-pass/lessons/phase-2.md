# Phase 2 · stats (arc 2, `second-pass-stats`)

## P2.1 · the observatory (2026-09-07) ✓

Gate: `bun run lint` ✓ · TC1 (ui, web-miner, web-stats, web-landing, site, root) ✓ · `bun test packages/miner-core
packages/web-stats packages/site` 70 pass ✓ · `bun run --cwd packages/web-stats test:components` 18 passed ✓.

- **The fixture grew before the code did.** P2.2's plan called for a two-hour soak to get twenty epochs with one
  escape-hatch close. The testnet deployment already had 31 epochs with three (0, 25, 29), so
  `bun run epoch:stats --json` against the public testnet node replaced `fixtures/epochs.testnet.json` — real chain
  data, no soak. Every stats test, the E2E's mocked node and the visual gate's storage overlay read that file, so the
  component spec's counts moved with it (27 claim bars + 3 amber, 30 retarget bars, 31 points, the table's three
  "the escape hatch" rows). `metrics.test.ts`'s claims-per-hour case now measures the hour before epoch 24 opened
  on the history *as it stood then* (`rows.slice(0, 25)`): the estimator assumes `nowSec` is at or after every
  row it is given, and a historical instant over later rows returns nonsense (−5020), which is a misuse, not a bug.
- **Plot blanks a log axis's "minor" ticks even with a function formatter** (`inferTickFormat`: a function is
  used directly only when the scale is not log). The duration chart's `1 d` tick (86 400 s) came out empty because
  d3's log `tickFormat(count, fn)` wraps `fn` and drops ticks whose mantissa exceeds its budget. An explicit
  `Plot.axisY(ticks, { text })` mark sidesteps the inference; the difficulty and retarget axes are base 2, whose
  ticks are all powers, so they were never affected.
- **A constant channel lives on the mark's group.** `textAnchor` lands as `text-anchor` on the `<g>`, not the
  `<text>`; the roll-label spec reads the parent.
- **Settledness for the screenshot gate.** `useTweenedNumber` reports nothing, so a small `Tweened` component in
  web-stats adds its id to `unsettledAtom` while `shown !== value` and `<main data-settled>` reflects the set.
  P2.2's visual spec waits for `data-settled="1"`.
- The "since you opened" tile reads the page's clock through a prop like the rest of the observatory, not
  `nowAtom` directly: the component spec drives time by prop.
- The escape-hatch roll labels: a label reads leftward from the right 30 % of the frame; two rows, filled by an
  overlap check rather than a running edge, so a leftward label after a rightward one lands in the right row.
- `Observatory` and `Stats` stayed under the 80-line budget by moving the open-epoch tile (`OpenEpoch`), the sixth
  tile (`SinceOpened`), the ring (`EpochRing`) and the chart rows (`ChartRows`) out; `specs.ts`'s label placer
  split its anchor rule (`labelAnchor`) and its four text marks (`rollLabelMarks`) out for the cognitive budget.

LESSONS_FILE=implementations-plan/yacana-second-pass/lessons/phase-2.md
