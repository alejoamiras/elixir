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


## P2.2 · the screenshot gate and the E2E (2026-09-07) ✓

Gate: `bun run --cwd packages/web-stats test:visual` **4 passed, no diff** (in `mcr.microsoft.com/playwright:v1.62.1-noble`,
after one `--update-snapshots` run) ✓ · `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e` **3 passed
(58.8 s)** ✓.

- The recording (`visual-setup.ts record` under `e2e:agent`) over the 31-epoch fixture: 106 answers (was 40).
  Chunk 0 of the slot table covers 512 epochs, so nothing about the fixture-only build changed.
- The visual spec waits for `main[data-settled="1"]` before the capture: the fixed clock freezes `Date`, not
  rAF, so the tweens still run under it and finish within 300 ms; the recorded block's slot time drives every
  age (the epoch tile reads "open 134:12", amber, because the fixture's open epoch had sat two hours by the time
  the record ran — deterministic per recording).
- The first baseline exposed "key" wording in the stats page's own copy (`NotHere`: "Which key claimed which
  epoch"): reworded to "account", and the rename guard's roots now include `packages/web-stats/src`. The landing's
  copy has the same words; arc 3 rewrites `copy.ts` and extends the guard there.
- The live E2E asserts the freshness pill's block link, both titles, the table's scroll under a header whose
  `boundingBox().y` does not move, the three "the escape hatch" rows, the chart heights `[200, 110, 110, 110]`,
  and the Verify chips' explorer hrefs on the isolated deployment's own addresses. The 26 136 s bar is now judged
  against the 20-minute rule's y (the 10 000 s tick is gone with the three-tick axis) — the same claim, "a cap
  at T_MAX would leave it on the rule".
- The miner E2E (arc 1) had to move with the fidelity round: the acknowledgement no longer carries the marks
  the `states` spec matched, and the `miner` spec's "no claim in flight within 15 s" raced a second win at the
  easy target (at 12 passed the first time by luck). Both assertions were retargeted (`319f57c`); the words spec
  met the dialog that now reopens after the backup it asked for (`72f279a`). The re-run is in `phase-1.md`.

LESSONS_FILE=implementations-plan/yacana-second-pass/lessons/phase-2.md

## Arc 2 codex loop · round 1 (2026-09-07)

New session `01a07e40-c02c-7fb1-b19d-89d863349ed1` (Astra, high; `codex exec -i` with the 1440 / 1280 renders and
the artboard, the arc diff, the plan, recon, the arc map, both rules). Five findings, all verified and adopted:

| sev | finding | fix |
|---|---|---|
| P2 | The 1440 render drew every chart at the 640 px fallback (the lead chart short, the small multiples scaled down): the first draw happens before the container is measured and, under load (the miner E2E was proving alongside), the observer's redraw lagged past the capture. | `useWidth` returns 0 until measured (640 only where there is no `ResizeObserver`), and `Chart` draws nothing at 0, so no frame ever exists at a guessed width. The live E2E asserts every chart's SVG width equals its container at 1280 and 1440; `render-e2e.ts` waits for the same before the capture. |
| P2 | Emission's x ticks rounded fractional hours: a short history read "+0 h" four times. | Integers stay integers, fractions keep one decimal; a spec renders the first five epochs and asserts distinct labels. |
| P2 | "N · open" was the last loaded row's, but `pollChain` keeps the old rows when a history read fails after a close, so a stale tail would be called open. | `ChartInput.open` carries the chain's open epoch; the suffix appears only when the newest row is it. A spec passes `open = last + 1` and reads "30". |
| P2 | "since you opened" would print "+-1 claims" if the supply read lower than at the first read (a reorg, a stale answer, a lying node). | A negative delta shows "—" with "the supply read lower than at the first read"; tested. |
| P3 | Three narrating comments (`ChartRows`, `SinceOpened`, `LEAD_HEIGHT`). | Removed; the log-axis and separate-borders comments stay. |

Codex also noted the since-opened spec never saw the tween settle: it now `waitFor`s the unsettled set to empty
under jsdom's real rAF and reads "+3". Gates after the round: web-stats components 19 ✓ · `test:visual` 4 passed,
no diff (the final frame is unchanged) ✓ · the stats E2E 3 passed (1.2 m) with the width assertion ✓ · lint ✓ ·
typecheck ✓. The renders in `shots/arc-2/` are re-taken.
