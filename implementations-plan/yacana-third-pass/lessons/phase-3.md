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
