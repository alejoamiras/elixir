# P6 · The landing and the flywheel — lessons

## What changed
- `apps/web-landing/src/copy.ts`, `faq-copy.ts`: every `Landing-Copy` row, word for word (the canvas text in
  `canvas/copy.md`), with the reassurance line the owner approved (no gas clause); the numbers still come from
  `PARAMS`. The bar's and the hero's button read "Open the miner" (the landing's own label for that link); the
  network badge stays. The new FAQ question sits under "How is it mined?" in the Mining section; nothing links to
  it, so it lives in `faq-copy.ts` rather than among the linked questions.
- `sections/Why.tsx` (`why`, between How and Verify, in `SECTIONS`, the bar's anchors and `App.tsx`): from `md` up the
  `Fly-A` ring — the circle and four arcs as SVG with path arrowheads on token classes (no `<marker>`, whose fill
  cannot take a class), the four steps as HTML boxes centred on the ring in percent so their prose wraps as the ring
  scales; `role="img"` with a label naming the four steps in ring order, and the centre sentence drawn over it but
  outside the image, so a screen reader still reads it (an image's children are presentational); below `md` the
  same steps as How's numbered list, the sentence under them. Its own test id (`why-loop`): the FAQ's specs count `rule-diagram`.
- `HeroLive.tsx`: the KPI "difficulty", "N wins · by browsers"; `BarChart.tsx`: its label says difficulty and wins.
- `index.html`'s meta description repeats the subhead, so it follows it ("private from everyone").
- `apps/web-miner/src/features/PreflightTile.tsx`: no download size (the live "13.0 of 20 MB" progress stays, owner
  2026-09-23).

## Gate
- Fast layers on the working tree (P5 + P6): lint 0 · `bun test` 0 (633 pass, 44 skip) · typecheck 0 ·
  `test:components` 0 (ui 87, landing 15 with the `Why` spec, stats 84, miner 154) · replay 0 (9 passed).
- The `Why` spec: the four steps in ring order (the boxes and the label), the ring from `md` up and the list below
  it, the centre sentence outside the image, no `rule-diagram` on the landing. Its first draft read the classes
  as one string (`hidden md:block`); Biome's class order is not the author's, so it reads the class list.
- `grep -rn "20 MB"` and `grep -rn "no gas"` over `copy.ts`, `faq-copy.ts` and `index.html`: nothing. "testnet" in
  `copy.ts` only in two code comments; the bar and the hero say "Open the miner". The reassurance line is the
  approved text. `external-link-arrows.bun.test.ts` 1 pass.
- Landing e2e on the P6 commit: __LANDING__.
