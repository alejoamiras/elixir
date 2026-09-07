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
