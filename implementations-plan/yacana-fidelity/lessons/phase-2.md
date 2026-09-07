# Phase 2 lessons · arc 2 · landing

## P2.1 The seven frames (2026-09-07)

- `Section` is the thin frame wrapper (id = anchor = test id, a top rule, `scroll-mt` for the 52-px bar); each
  frame owns its grid and padding from the binder (`hero 56/36/44`, `money · chain · how · verify 32/36`,
  `live 28/36`, `ask 44/36`, footer `18/20`), `px-4 py-8` below `md`. `SectionLabel` is the binder's `.sec`
  (the `label-mono` utility, an `h2` where it is the frame's only heading: "how it works"); `SectionHeading` the
  30-px `hero-h` with its `10px 0 14px` margins. The shell drops its inset: the bar carries `px-4 md:px-5`.
- Hero: `1fr 1.1fr`, gap 30, the 50-px headline, the 19-px `.sub` at 46ch, `uv` primary + outline `lg`, the hint;
  the demo tile at `14px 16px` with the binder's live pill ("epoch N · c of N · difficulty d") and "live from the
  chain" opposite, `ScoreLoop height={250} hero`. The launch-week hero shares the frame (`HERO_FRAME`).
- Money: `1fr 1.25fr`, gap 36; the `.rule` rows (`118px 1fr`, mono 11/1.6 labels) and the `cmp4` table as a real
  `<table>` with the binder's column ratios (`table-fixed` + `colgroup`), label-mono heads, tones ok / warn / bad.
- Chain: `1fr 1fr`, gap 40; the three chips are `Marks` with example values and the `illustrative` suffix (the
  landing has no claim of its own to show). How: three `Tile`s (`asChild` on an `li`, added to `ui`), the
  uv-2 mono step numbers, the docs hint. Live: one row `repeat(4,1fr) 1.4fr` aligned at the end, no heading; the
  epoch KPI reads "N" with "c of N" as its unit and "open X · expected Y" on the chain's clock (the last block's
  time, so the isolated network's skewed clock cannot show a negative age); the difficulty sub is the last
  close's retarget. Verify: `1fr 1fr`; chips + `sm` outline / ghost / ghost buttons. Ask: centred, 36 px, `uv` +
  outline `lg`. Footer: `18px 20px`, `ink-3`, 12.5 px.
- `scripts/render-e2e.ts` replaces `render-cockpit.ts`: `landing | miner` from the app's `e2e/.run.json`.
- The first renders exposed a display bug the binder never meets: the landing's E2E deployment uses a target of 1
  ("no proof reaches it", so the demo never has a winner to discard), and `difficulty()` of that is 2^128:
  `toFixed(1)` prints `3.402823669209385e+38`, which broke the live strip's row and wrapped the demo pill.
  `difficultyLabel` (in `ui`'s score-loop model, so the canvas's "the bar" label uses it too): one decimal, the
  exponent form from 1e6. The table head for the token symbol keeps its case (`tYACA`, not `TYACA`).
- Two landing e2e runs of one worktree cannot overlap: they share `e2e/.run.json`, and the first teardown kills
  the other's preview server (`ERR_CONNECTION_REFUSED` mid-render). Renders and the E2E run one after the other.

Gate: `bun run lint` ✓ · web-landing `tsc -b` ✓ · `bun run test:components` ui 29 / web-miner 34 / web-landing 10 /
web-stats 13 ✓ · `bun test packages/ui packages/web-miner/src/lib` 20 ✓ · `bun run e2e:agent -- bun run --cwd
packages/web-landing test:e2e` 3 passed (52.7 s) on the final tree ✓ · the renders at 1440 / 1280 / 1024 / 390
reviewed against the L2 frames (`shots/arc2/`).

LESSONS_FILE=implementations-plan/yacana-fidelity/lessons/phase-2.md

## Arc 2 codex loop (2026-09-07)

Session `01a0797a-64f7-77d1-9ec1-98b4b1f18d7f` (`/codex xhigh`, read-only, a new session over `1b4328a..fd792a3`
with the plan, the recon, this file, the arc map and the four renders beside the L2 frames).

**Round 1** — nine findings, all verified against the code before acting:

1. *Should-fix, accepted (a real bug).* The difficulty sub printed `retarget` itself; `retarget` is the target's
   ratio at the close and the difficulty moves by its inverse (the stats page already prints `1 / retarget`).
   Fixed; the fixture's closing epoch now carries `0.25` so the test reads "×4.00 at the last close".
2. *Should-fix, accepted.* A failed history read keeps `live.open` but the epoch KPI showed "—". The number
   (`live-open`) now renders from `live` alone; the claims unit from the open row; a partial-failure test.
3. *Should-fix, accepted.* The sparkline was 240 px fixed in a ~230-px column at 1024; now `w-full` with
   `preserveAspectRatio="none"` and a non-scaling stroke. Subs of different heights under `items-end` misaligned
   the numbers: every sub is two lines tall from `md` (`min-h-[2lh]` through an arbitrary variant on the frame).
4. *Should-fix, accepted.* The binder breaks the headline after "bank."; `text-balance` on the whole string
   balanced both sentences together. `Headline` renders each sentence as a block from `md` (the copy and the
   `h1`'s text are unchanged); the launch hero uses it too.
5. *Should-fix, accepted.* The how-tile titles inherited the theme's 22-px `h3`; the binder's are bold 14-px
   body text. Sized locally, still `h3`.
6. *Should-fix, accepted.* The comparison table stopped short of the rules column; the binder's grid fills the
   row. `md:h-full` on the table (a stretched grid item distributes the height over its rows); the heads' 8-px
   top padding and the bottom rule on every cell restored.
7. *Should-fix, accepted.* The layout assertions accepted a narrower shell (ratios only) and a left-aligned
   heading (a block's box is always centred). Now: the frame is 1120, the hero tracks sum to the frame minus
   paddings and gap, the four KPI tracks are equal and the five sum likewise, the ask's `text-align` is
   `center` and its button row sits with equal slack on both sides; `live-open` asserted in Vitest.
   Not done: a populated history at 1024 in the E2E — the isolated deployment's target of 1 closes no epoch, and
   waiting for T_MAX (1200 s) is not a gate; the sparkline's width is by construction (`w-full`) instead.
8. *Nit, accepted.* `SectionLabel` `leading-none` (the binder's `.sec` 1), `SectionHeading` `leading-[1.02]`.
9. *Nit, accepted.* The `difficultyLabel` comment states the constraint and the domain; the narrating comments in
   the Vitest spec, the E2E and `Section.tsx` are gone.

Gates after round 1: `bun run lint` ✓ · `tsc` web-landing / ui ✓ · Vitest web-landing 11 ✓ · the landing E2E 3 passed
(53.3 s) ✓ · the renders redone into `shots/arc2/`.

**Round 2** (resumed, over `fd792a3..a5dc1a1`): two should-fix, two nits; codex confirmed the ×4.00 caption, the
kept epoch number, the KPI variant, the SVG sizing, the table, the how titles and the mobile composition.
1. *Should-fix, accepted.* Block sentences balance independently: the second sentence broke "YACA makes it /
   need no witness." where the binder has "YACA makes it need / no witness.". `Headline` now keeps the sentences
   inline with a `<br>` shown from `md`, so the whole headline balances around the forced break, as the binder's
   `hero-h` does.
2. *Should-fix, accepted.* The ask check lost the heading's centre (a translated heading would have passed on
   `text-align` alone); the bounding-box centre comparison is back beside the alignment and button-row checks.
3. *Nit, accepted.* The fixture's second target is `1n << 120n`, a quarter of the first, consistent with its
   `retarget: 0.25`.
4. *Nit, accepted.* The `expectFrames` narration and the over-promising half of the `difficultyLabel` comment
   are gone.
   Gates after round 2: `bun run lint` ✓ · `tsc` web-landing ✓ · Vitest web-landing 11 ✓ · the landing E2E 3 passed
   (52.7 s) ✓ · the renders redone (the first render attempt timed out waiting for the live strip, a transient node
   read; `render-e2e.ts` now keeps a `<app>-failed-<width>.png` when a wait runs out).
