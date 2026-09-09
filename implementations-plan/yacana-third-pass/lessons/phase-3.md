# Phase 3 — arc 3: stats + landing

## P3.1 · The skeleton and the two beats ✓ (2026-09-09, `70af0fc`)

Gate, as run: `bun run lint` exit 0 · typecheck ui, web-stats (and root, web-miner, web-landing) ok · `bun test`
220 pass, 0 fail (new `packages/web-stats/src/beats.test.ts`, replacing `chain.test.ts`: boot publishes the fixed
slots first and the window second, a history read that fails still publishes beat one and says so with no rows,
the poll joins a close to the tail and drops the held rows when more than a window closed, a poll whose history
fails keeps the rows, older joins in front and asks nothing at epoch 0, `settled` waits for beat two and for every
number at rest) · Vitest web-stats 27 (the page renders every tile as its skeleton with both atoms null; beat one
fills minted and the epoch number while the strip is still a skeleton; the header pill reads "reading the chain…"
until beat one and then names the block, `data-settled` stays 0 until beat two; fast-first / slow-second — the
window's skeleton is quiet until `slowAtom` flips and minted never blinks; `Skeleton` carries
`motion-reduce:animate-none`, quiet is the bare box; each chart with no rows draws its fixed ticks and one band, no
marks) · `bun run --cwd packages/web-stats test:visual` 4 passed against the existing baselines (no regeneration:
the recording answers at once, so no skeleton is in frame and the settled page did not move).

What the phase found:

- **The 300 ms timer is one line in `main.tsx`**; its observable is `slowAtom`, so the fast-first / slow-second
  case is proven at the component layer by flipping the atom, not by faking timers around the entry file.
- **The screenshot gate caught a one-pixel shift from a text-node change.** Writing the table's count as one
  template string (`31 of 31`) instead of the JSX's three text nodes (`{n} of {m}`) moved the second "31" one pixel
  left at 1280, 1440 and 1024 (49 px differ, an 8 × 8 box): Chromium lays out each text run with its own subpixel
  origin. Restoring the JSX form restored the baseline. The lesson generalises: a "no visual change" refactor of
  text-bearing markup must keep its text-node structure, or the baselines regenerate for nothing.
- **The empty charts reuse the specs' `base`** with a fixed domain per chart and a `panel` rect at 35–65 % of the
  height (log domains take the band in log space); no second component, no branch in the renderer.
- **`chain.ts` shrank to the reader and the latest block**; the window and lottery reads moved to `read-window.ts`,
  the fixed slots to `read-fixed.ts`, the beat order and failure rules to `beats.ts` (pure over injected reads and
  sinks). `Verify` reads the genesis and the open epoch from `fixedAtom`, the lottery from `historyAtom`, the
  launch time from the first row held.
- **The root typecheck was red from arc 1** (`794e6d7` added `rollupAddress` to the deployment check; the
  example-claim recorder's record type and the visual gate's `VisualDeployment` still lacked it). The per-package
  typechecks were the arc gates and never saw it; CI's miner-core job runs the root one on every PR and would have.
  Fixed where it belongs, on the arc-1 branch (`ec34574`), and the stack cascaded with `gh stack rebase --no-trunk`,
  which rehashed arc 2: P2.1 `00cfb5e` → `d797f60`, P2.2 `1347482` → `8abd687`, P2.3 `9f0eb51` → `75a8274`, the
  codex rounds `95a8abc` → `176cef1`, `4cc074c` → `4fd3861`, `546facb` → `dd65186`, the convergence log `e1a51b0` →
  `0f7ab85`. The plan's phase marks carry the new hashes; `lessons/phase-2.md` keeps the ones it was written with.
  From here the root typecheck is part of every arc gate.

## P3.2 · Strip A ✓ (2026-09-09, `6d83ab2`)

Gate, as run: `bun run lint` exit 0 · typecheck web-stats and root ok · `bun test` 251 pass, 0 fail (new:
`routes.test.ts` — `?from=` parsing, `withFrom` / `withEpoch` keep each other and the node pin, `windowFor` clamps at
both ends, ‹ › page by 48 and write null at the newest window, `centredFrom`; `map-geometry.test.ts` — a bar at
its absolute cell and a page arriving moves none, the heights, the window box at open = 0 · 1 · 47 · 48 · 999,
`epochAtX`, the day ticks and their thinning; `history-cache.test.ts` — the key, the round trip, the newest 96 never
written or served, each validation rule drops the cache whole, malformed text / a duplicate / an empty range, the
row and byte caps, a quota error swallowed; `history-fill.test.ts` — `readTo`, one page per tick newest first
through the queue, stops at epoch 0, stops for the visit on a throttle or silence before reading and on a failed
page, yields to a foreground window, a page is 48 × 3 + 3 storage reads; `tests/history-transport.bun.test.ts` —
the same page through the real SDK client against a counting `Bun.serve`: **147 methods in 21 HTTP requests**) ·
Vitest web-stats 61 (the strip's tests on the window props; over a 1000-epoch chain with 200 rows held: 200 bars,
the box at `left: 90%` / `width: 4.8%`, ‹ › page by 48 and are disabled at the ends, a click on the rail centres
the window, keyboard stepping at a historical window pages at its edges and steps in from the open epoch) ·
`bun run --cwd packages/web-stats test:visual` regenerated in the pinned image (the map and the paging row are new
pixels) and stable on a second run.

What the phase found:

- **`Window` is the DOM's name.** The first draft called the `{from, to}` type `Window`; Biome's `noRedeclare`
  caught the clash with `declare global { interface Window }` in `main.tsx`. It is `EpochWindow`.
- **The SDK batches.** One 48-epoch page is 147 `getPublicStorageAt` methods at 8 lanes; the client's batching
  window folds them into 21 HTTP requests (measured, not assumed). The plan's I5 concern was about HTTP requests
  per poll tick against a public node's limit: 21 per 30 s is the number the testnet watch should use.
- **A drag is one window change.** The box follows the pointer in local state and the URL (and any fetch) gets
  the window on release; the fetch effect keys on a memoised window object, so the one-second clock tick does not
  re-queue a fetch while one is in flight.
- **jsdom rejects `max()` in inline styles**: `style.width = 'max(4.8%, 3px)'` reads back empty. The box is a
  plain percentage plus `min-w-[3px]`, which is also the cleaner CSS.
- **The skeleton's `Sk` covers the map before beat two**; after beat one the badge already names the open epoch
  (it is known), so a Vitest that looked for one "epoch 30" found two — the KPI label and the badge.
- **The fill's stop is a phase, not a flag**: `fillAtom` carries `readTo` and the reason, and the strip's caption
  reads it; the map itself needs nothing extra for the unread span — missing cells draw nothing over the rail.

## P3.3 · The money table ✓ (2026-09-09, `0db788a`) — and the arc-3 boundary

Gate, as run: `bun run lint` exit 0 · `bun run lint:actions` ok · typecheck web-landing, web-stats, root ok ·
Vitest web-landing 11 (new: the money table's `tbody` carries `[&>tr:last-child>td]:border-b-0`, the selector
reaches the last row's five cells, no cell says `last:`, every cell keeps `border-b`) · **arc boundary** on the
isolated network: `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e` **5 passed** (new: a slow
node — the mocked node holding every answer 1.5 s — shows every tile as its skeleton at 400 ms with no quiet box
left, then minted and the pill at beat one and the 31 options at beat two, `data-settled` 1 and no skeleton left;
the map from 31 epochs: 31 bars, the box spanning the rail, "launch" and "now" on the axis, `?from=99` clamped to
the one window, ‹ › disabled, no fill note, `?epoch=` riding beside `?from=`) · `bun run e2e:agent -- bun run
--cwd packages/web-landing test:e2e` **3 passed** (the money table's last row has a computed bottom border of
0 px on all four cells and the row above 1 px) · renders at 1280/1440 under `shots/arc-3/`: `stats-skeleton-*`
(the slow node at 450 ms), `stats-*` (settled), `landing-money-*` (the section as an element shot), beside
`StatsSkeleton`, `StripA`, `MoneyAfter`.

What the phase found:

- **`getByRole('option', { name: 'epoch 3' })` also matches "epoch 30"**: the accessible-name match is a
  substring by default; the spec uses `exact: true`. The first boundary run failed on that alone.
- **The fill note was on the skeleton.** With `fillAtom` idle (no `reason`), "older epochs are read a page at a
  time…" showed before beat two; the note now needs a measured gap (`readTo > 0`), so it is absent before the
  fill's first tick and once it reached epoch 0. The stats renders were redone after that change.
- **The skeleton render vs the artboard**: the KPI tiles show their constant units (`tYACA`, `of 48`,
  `proofs/s`) and the calculator link while the values are skeletons — the artboard drew bare blocks. Kept: the
  units are build constants, not reads, and hiding them would shift the layout when the numbers land.
- **The mocked node's `delayMs`** is the only E2E knob added; the slow-node spec takes 28 s because every
  round trip (the deployment check, the layouts, beat one, beat two) pays the delay — acceptable for one spec.
