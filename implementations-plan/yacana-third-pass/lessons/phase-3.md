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

## Arc 3 codex loop · round 1 (2026-09-09)

Session `01a083d9-7ad0-7a71-8da4-4e863e9f5f74` (Astra, high), the three renders and artboards attached. Thirteen
findings; all verified, all adopted (two in a narrower form). Fix commit `f2218d6`.

- **High — a failed window fetch retried in a tight loop.** The fetch effect keys on `history`; every failed
  `windowBeat` published a new history object with the error, which re-fired the effect at once (under a cooldown
  the guard answers synthetically, so the loop was as fast as React). `showWindow` now keeps a per-window gate:
  in flight, or failed and not before the poll cadence; the poll's publish is the retry.
- **High — a lying node could freeze the tab.** `readOpenEpochNumber` is `Number(bigint)`; `open = 1e20` made
  `readTo`'s `e--` a no-op forever. `assertOpenEpoch` refuses anything outside `[0, TABLE_EPOCHS)` before `Fixed`
  is published, and `readTo` walks the held keys instead of counting down through the gap.
- **Medium — a poll answering a lower open epoch kept the rows above it**, so the open epoch had a successor and a
  duration. `below()` drops them after a successful poll.
- **Medium — a queued fill page ignored a stop that came after it was queued.** `page` re-checks `stopped` and the
  transport.
- **Medium — the lottery never recovered from a failed boot read** and Verify showed zeros. It is read with
  `.catch(() => null)` at boot and again by every poll until it lands; a lottery failure no longer discards beat
  two's rows; Verify shows `—`.
- **Medium — "held" ignored the successor**: a historical window ending where the cache ended left its last row
  open. `windowHeld` requires `min(open, to + 1)`.
- **Medium — the day axis walked the calendar** up to the largest timestamp a row carried (a lying node could make
  that ~10⁸ iterations). One pass over the rows now.
- **Low** — `settled` needs a whole beat two (the displayed-window readiness was not folded in: the visual gate
  never pages; a paged unread window shows its own skeleton); the right caption names the open epoch's opening
  time from every held row; `frame()` memoised and `EpochMap` under `memo` (the clock redrew four Plots a second);
  the KPI value skeleton inline (the network tile's unit had wrapped); the card's skeleton names the open epoch at
  beat one; the drag's release reads a ref (a state updater ran `onWindow`, twice under Strict Mode); two comments
  tightened (the cache's header had claimed finality).
- The 390 px screenshot baseline moved by one pixel at the reproduce box's bottom edge after these changes — a
  sub-pixel layout shift with nothing textual behind it; regenerated, and the other three widths passed unchanged.

## Arc 3 codex loop · round 2 (2026-09-09)

Resumed session, the round-1 fix diff (`76a0100..f2218d6`). One finding, verified and adopted (`197b08c`):

- **Medium — the rollback fix missed the poll's error path.** Beat one publishes the lower open epoch before the
  rows are read; when that read failed, the held rows (row 100 included) were republished unchanged, and a later
  successful window fetch cleared the error while keeping the row that closed the open epoch. `below()` now cuts
  the kept rows on both paths (on a copy: the held map is never mutated); the rollback test covers the failing
  read.

Codex's verdict on the rest of round 1: `askedUntil` handles the internally caught failures and distinguishes
windows; the integer check rejects the oversized bigint conversion; the successor rule, the bounded day ticks, the
memoisation and the ref-based release address their findings; the narrower `settled` contract is acceptable for
the stated gate; the lottery's null stays visible through the transport health where it applies.

## Arc 3 codex loop · round 3 (2026-09-09) — converged

Resumed session, the round-2 fix diff (`f2218d6..197b08c`). Codex, verbatim: *"The fix is correct (high
confidence). The copied map preserves held state, retains the error, and removes future rows. Verified that
subsequent window recovery leaves epoch 99 open. All 8 beat tests pass. No remaining material findings from rounds
1–2. No new material findings"*.

The trend was monotone (13 → 1 → 0) and round 3 was the confirmation round, so the loop closes here: three rounds,
inside the plan's hard stop. Arc 3 is `197b08c` on `third-pass-stats`; the final cross-arc pass (a fresh session over
`f7e2ad4..HEAD`) follows.

## Cross-arc codex pass · round 1 (2026-09-09)

A fresh session (`01a083ee-904d-7ce3-83ea-d7ce6450dbe9`, Astra, high) over the net diff `f7e2ad4..HEAD`, asked
for seams, duplication and drift. Ten findings, all verified, all adopted — each on the arc that owns the file
(arc 1 `ac0cc0d`, arc 2 `76ead96`, arc 3 `69a753c`), the stack cascaded with `gh stack rebase --no-trunk` after
each:

- **High (arc 1 → 2/3) — `/rpc` and `/rpc/` shared an identity.** `normaliseEndpoint` folded trailing slashes
  while the SDK posts the path as given; two endpoints that can be two nodes shared a candidate lease, a PXE
  view marker and a stats cache key. The path is kept exactly now (the fragment alone is dropped); the tests that
  asserted the equivalence assert the difference.
- **High (arcs 1/2) — a switch could run under an opening attempt.** `switchNode` only checked another switch;
  until the attempt adopts its controller there is nothing to drain, and the opening wallet was left on a node the
  guard no longer admitted. Refused while `this.attempt` is set; the node tile's Use is off during the opening.
- **High (arcs 1/2) — a rebuild against a lower epoch kept the old node's numbers.** `readChain`'s regression
  guard compared the new node's epoch with the old node's; a lying node's inflated epoch survived a switch to an
  honest one. `rebuildForNewNode` clears the epoch and the balance first.
- **Medium (arcs 1/2) — the signed-out public poll crossed the switch**, publishing an old-node answer after the
  swap and marking the new node read. It stops before the swap (its generation discards a read out), the epoch is
  cleared, and it restarts after.
- **Medium (arc 3 → 1) — the fill raised the banner.** Its reads went through the ordinary reporting path, so a
  fill-only 429 opened a cooldown before the fill stopped. `quietNodeReads` marks optional work; the store ignores
  a quiet outcome while the transport is `ok` and applies it once a cooldown is on (it may be the recovery).
- **Medium (arc 1) — a node on the page's own origin bypassed the guard** (no deadline, gate or reporting). The
  endpoint and the candidate lease are classified before the same-origin pass-through.
- **Medium (arc 1) — overlapping candidate leases revoked each other.** One entry per endpoint; the first release
  deleted it. Leases count their holders; a release is idempotent.
- **Medium (arcs 1/3) — Verify had no boundaries** and the observatory one for six KPIs. Four child components
  behind their own boundary; a boundary per KPI.
- **Low (arcs 1/3) — two latest-block readers disagreed on validation** (the landing's skipped `assertTimestamp`).
  One `readLatestBlock` in miner-core; the probe uses it too.
- **Low — three comments** (the e2e's "before the ceremony", `serial.ts`'s "load older", the skeleton's paragraph).

Codex's "looks fine" list: production `?node=` overrides ignored; the slot reads on one reader; the stats boot's
retry and `NodeWayOut`; the banner thresholds vs the poll; the cache caps and margin; the map coordinates; the
documented `data-settled` scope; the A5 actions; the CSP emission; the money selector; the CI step.

Two runbook notes: on arc 1's tree the miner's generated `public/` (the slot table the arc-2 prebuild copies) is
not yet ignored and fails `bun run lint` — it was set aside, not deleted; and a `NodeRequestOutcome` gained a
field, so every test literal of it needed `quiet: false` (the fixture's spread order mattered: defaults first).

## Cross-arc codex pass · round 2 (2026-09-09)

Resumed on the three fix commits. Two findings, both verified, both adopted on their arc (arc 1 `8f1526d`, arc 2
`09a9543`), the stack cascaded again:

- **Medium (arc 1 → 3) — `quiet` was sampled when the outcome arrived, not when the request started.** The
  reader's own 10 s deadline rejects without cancelling the request; `quietNodeReads` exited, and a 429 that landed
  afterwards was reported as ordinary work and opened a cooldown. `nodeRequest` now captures `{endpoint,
  startedAt, quiet}` at the start and the report carries it; the test holds a slow endpoint past the quiet scope.
- **Medium (arc 2) — stopping the public poll did not drain its read.** With the real reader, `open_epoch` came
  from A, the switch completed, and the remaining slots came from B; the restarted poll joined that obsolete
  promise, so the cockpit's epoch stayed null until the next 30 s tick. `stop()` returns the read in flight,
  `start()` forgets a read from before the stop, and the signed-out switch awaits the drain inside its own promise
  before the swap.

Codex's "looks fine": the quiet recovery clears `probing` and wakes `waitTurn()`; the `resetAt` check belongs
before the quiet filter; a cancelled opening releases the switch refusal; a strict rebuild failure reaches the boot
error; endpoint identity, leases, boundaries and the reader consolidation.

## Cross-arc codex pass · round 3 (2026-09-09)

Resumed on the round-2 fixes. Two findings, both introduced or exposed by the round-2 drain, both verified and
adopted on arc 2 (`f49c69a`):

- **High (arc 2) — the drain opened a window for a sign-in.** While Use waited on the poll's drain, a sign-in
  from Mine started an attempt (`runAttempt` did not look at `this.switching`); when the drain settled, the swap
  ran under an opening wallet whose controller was not yet adopted. `attemptBody` now awaits a switch in flight
  before its ceremony; the switch still refuses to start under an attempt, so the two exclude each other both ways.
- **Medium (arc 2) — a restart forgot a read left out by an unawaited stop** (the handover's), so a later `stop()`
  could not drain it and that reader could still cross a swap. The poll keeps every read still out across
  restarts and `stop()` drains them all; ticks coalesce on the current run's read as before.

The plan's nominal three rounds are exceeded here, as in arcs 1 and 2: round 3's items were small and confined to
the round-2 fix's seam, and a clean round is what the goal requires. Round 4 is the confirmation.

## Cross-arc codex pass · round 4 (2026-09-09) — converged

Resumed on the round-3 fix (`f49c69a`). Codex, verbatim: *"Both fixes close the reported races (high confidence).
The attempt is registered before waiting, preventing another switch; `outstanding` retains older reads until
settlement, while the identity check preserves current-generation coalescing. 52 focused tests passed, plus direct
checks for idle `stop()`, an old read settling during a restarted run, and a failed read draining without
rejection. No remaining material findings from rounds 1–3 or comment-quality issues in this diff. No new material
findings"*.

Four rounds (10 → 2 → 2 → 0). Session `01a083ee-904d-7ce3-83ea-d7ce6450dbe9` in `~/.cache/tmp/codex-Kl4NJ1Hv`
(responses 0–3). Every review loop of the plan is closed: arc 1 (4 rounds), arc 2 (4), arc 3 (3), the cross-arc
pass (4). Delivery follows: `gh stack rebase` → the fast gates → `gh stack push` → `gh stack submit --auto --open`
→ the PR bodies → `gh stack view` → `gh pr checks --watch`.
