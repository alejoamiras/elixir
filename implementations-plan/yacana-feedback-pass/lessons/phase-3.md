# Phase 3 — the score loop

## What the specs could not see, and a screenshot did

Every spec was green with the bar's caption at the top-left of the bar, as the plan and the D6 board had it.
Rendered in Chromium (a scratch page: `Bun.build` of a TSX entry as an IIFE plus the app's built CSS, opened
from `file://`), the caption was drawn over by the win's ringed dot and pushed the win's own label down onto the
bar line: wins sit **just above the bar by definition**, so a caption up there collides with every win in the
older third of the window. The board never showed it because its D6 chart had no wins.

The caption now goes **under** the bar's left end whenever the bar is more than 2.4 lines off the floor (a proof
ending just under the bar is rare: about 1 in 0.8 × bar), else above as before. It is still registered as a
placed label, so a win's label steps clear of it through the existing `clearOf`; the special case that moved a
win's label under the old right-edge caption (`underCaption`) is gone.

Rule worth keeping: **a canvas change is not done until someone has looked at it.** jsdom proves calls, not
pixels. The scratch page takes two minutes; module scripts do not load from `file://`, hence the IIFE.

## The reducer reads no clock

First draft: `spansAfter` fell back to `performance.now()` when an event had no `t`. That made the controller
test worthless (a span appears with or without the stamp) and the reducer impure. Now: no stamp, no span. The
controller's `dispatch` stamps in one place, and `recovery.bun.test.ts` holds it: a real `winner` → `failed`
through the controller leaves a span with both ends, and neither event is sent with a `t`.

## Smaller things

- Spans are kept by the transition of `claim` (null ↔ non-null), not by event name, so `prover-dead` closes its
  span without being listed. `stop` during a claim does not: the claim finishes.
- A no-op event returns the state it was given (`toBe`): the wrapper only allocates when the spans changed.
  (`retry` from idle is **not** a no-op even with a dead prover: it opens a claim. Pre-existing; not touched.)
- bun's `toMatchObject` with `expect.any(Number)` left the matched values unusable by the next assertion;
  read the fields instead.
- Under reduced motion the still frame is drawn more than once on mount (the loop's effect and the props'
  effect both fire). Pre-existing; the band test asserts the first frame's rectangles only.
- `SpanBox.opened`: a claim that began before the window gets no left bar, or the plot's edge would read as a win.
- `ScoreLoop` was at the 80-line budget: it is now `useHidden`, `useDrawing`, `useScoreHover`, `ScoreHoverCard`
  and a render function.

## Gate (2026-09-21, at fc0b251)

Fast: lint 0 · typecheck 0 · web-miner typecheck 0 · `bun test` 514 pass, 0 fail · components ui 81, landing 14,
miner 125, stats 84 · replay 4 passed. Reducer: winner → claimed, winner → failed, `retry`, `reconciled` (the
earlier span turns `minted`), `prover-dead`, `stop`, trim, and the sample's `n` / `proveMs` / `at` from a real
`attempt`. Controller: Fact 7's fix through `recovery.bun.test.ts`. Model: `plotGeometry` (a resized margin),
`calmTicks`, `spanBoxes`, `nearestSample` (a grown window, an aged-out proof), `stepSample`. Component
(`getContext` and `clientWidth` mocked): one `stroke()` for the ticks however many, the band's rectangles under
the ticks, hover and the arrow keys with reduced motion on, nothing on the 48 px strip; `loop-tile.vitest.tsx`
holds both call sites (tile and pop-out) to passing `spans`.
