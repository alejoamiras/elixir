# Phase 3 lessons · arc 3 · stats

## P3.1 Reader, slot table, metrics (2026-09-06)

**Result:** ✓. `miner-core/src/reader.ts` grew the epoch history read path: `EpochRow`, `SlotTable` / `SlotLoader`
(`CHUNK` 512, `TABLE_EPOCHS` 262 144), `ReadLimits` (8 in flight · 10 s · ≤ 96 epochs), `readOpenEpochNumber`,
`readEpochs` (three `getPublicStorageAt` per epoch, a fourth for the seed; rows linked to their successor for
`duration`, `retarget`, `closedBy`), `readTotalSupply`, `readGenesis`, `readLottery`, `deriveSlotTable`
(bb.js Poseidon2, the Bun-side loader), the JSON chunk codec and `rowsToJson` / `rowsFromJson`.
`scripts/gen-slots.ts` writes the 512 chunks (37 MB, 11 s) into `packages/miner-core/generated/slots/`
(gitignored). `metrics.ts` grew `networkRate` (median of the last six count-closed epochs), `claimsPerHour`
(pro rata over the closed epochs inside the hour), `scheduledClaimsPerHour`, `calculator`, `sentenceKind` and
`sentence` (open · launch · rolled · fast · slow · normal). `csv.ts` round-trips the table with the formula guard.
`packages/deploy/scripts/epoch-stats.ts` is a thin CLI over the reader (`--json <file>`); `soak-report.ts` follows the
new row shape. Fixture: `fixtures/epochs.testnet.json`, captured from the Yacana testnet after a 30-minute soak.

- **`readEpochs` takes no layout**: the slots come from the table; the layout is only for the fixed slots and the
  generator. A deviation from the plan's signature, caught by the unused-parameter lint.
- **The fresh Yacana testnet had no history to capture** (epoch 0 open, 0 claims since the 16:39 launch), and the two
  pre-rename deployments cannot be read with the current artifact: the soak's contract (`0x1e57c929…`) predates the
  launch fields, so its slots read empty, and the archived 2026-09-04 record was never mined. A 30-minute soak
  (`bun run soak -- --hours 0.5 --epochs 8`, 11 → 5 → 11 threads, sponsored fees, ephemeral account) produced the
  fixture: epoch 0 rolled after 7 h open (×4.000 easing), then seven count-closed epochs of 144–432 s with retargets
  ×0.48–×1.44, 28 claims, 389 proofs, 112 tYACA to the soak account. Every sentence template is exercised by it.
- The first `claimsPerHour` counted whole closed epochs; the pro-rata version is the one that reads right at an hour
  boundary (half of an epoch outside the hour counts half its claims).
- The gen-slots test generates the whole table into a temp dir (about 12 s) and asserts 512 files of 69–72 KB; the
  reader test pins chunks 0 and 200 against `deriveStorageSlotInMap` for three epochs each rather than all 1024.
- `web-stats.yml` / `web-landing.yml` do not exist yet (P3.2 / P4.x create them with the packages); their filters will
  include `packages/miner-core/scripts/**`.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `tsc -b` ✓ · `bun test` 129 ✓ (reader 4, gen-slots 1, metrics 8, csv 2) · `test:components` 33 + 27 ✓ · `bun run e2e:agent -- bun test packages/miner-core` 51 passed, 0 failed (the live reader test: epoch 0 through the slot table equals the deployment record; genesis, lottery and supply read) ✓.

## P3.2 web-stats (2026-09-06)

**Result:** ✓. `packages/web-stats` on the shared site base (`prover: false`): the shell with the freshness line
(latest block and the age of its slot time), the observatory's six tiles (minted from `total_supply`, the open epoch's
claims and age, difficulty with the last close and the "if it closed now" preview, claims/hour against the schedule,
the network rate as a median, "last claim" reworded to the open epoch's claims and the escape hatch), the strip
(`role=listbox`, width = duration, colour = what happened next, ← → keys, a 240 ms slide-in for the newest closed
block, `?epoch=N` through `history.replaceState`), the detail card with the sentence, four SVG charts
(`src/charts`: emission against the schedule, difficulty on a log scale, durations with the rolls amber, retarget
ratios), the table with CSV/JSON downloads and "load older", the calculator sheet, the "what is not here" block,
the Verify page (the deployment record carried into the build as `VITE_DEPLOYMENT_RECORD`, `W_VK_HASH`, the source
commit, genesis/lottery as read, the constants, the reproduce commands), `web-stats.yml`. Shared page code moved to
`packages/site/src/browser/` (`connection.ts`, `format.ts`; the miner re-exports them).

- **The read path pulled bb.js in through the reader**: `deriveStorageSlotInMap` was imported at the top of
  `reader.ts`, so the page bundle carried the 4 MB barretenberg chunks. The derivation moved to `slots.ts`
  (Bun-side: the generator, the CLI, the tests); the page fetches chunks. The bundle still emits the bb.js chunks
  (the aztec.js node client reaches them through dynamic imports), so the live E2E asserts what matters: **no
  request for a barretenberg chunk or a `.wasm` while the page reads and renders**. It held.
- **aztec.js needs `Buffer` at import time** even without a prover: the first build rendered nothing (an empty page,
  no console error in the spec's output until `pageerror` was logged). The Node polyfills are now on for every app;
  only the bb.js Worker plumbing stays behind `prover`.
- **Vite inlined the small font subsets as `data:` URLs**, which `font-src 'self'` blocks (eight console errors per
  page, the miner included, silently). `assetsInlineLimit: 0` in the shared base.
- **The mocked node** (`e2e/helpers.ts`): a Playwright route on `http://127.0.0.1:1` answers `getPublicStorageAt` for
  the slots in `.mock.json` (built by `run-setup` from the captured fixture through the slot table) and forwards every
  other call, batches included, to the real isolated node with the ids intact. The first version answered *every*
  slot of the miner from the map, zero for the unknown ones, and the deployment check failed on the bound token
  slot; only mapped slots are answered now, so genesis, the token and the block stay real.
- The charts take no clicks (an SVG `rect` cannot be a button): the strip and the table make the selection, every
  chart shows it (one halo each, asserted in the E2E).
- The storage layouts travel as `public/layouts.json` (extracted by the prebuild), not the 2 MB artifacts.
- The prebuild copies the 512 chunks (37 MB) into `public/slots`; `dist/` is 46 MB. Cloudflare Pages' limits
  (20 000 files, 25 MB per file) are far.
- Codex's earlier CSP question (`style-src 'unsafe-inline'`) is unchanged; the data: font finding is the same family
  and is fixed at the source.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-stats `tsc -b` ✓ · web-miner `tsc -b` ✓ · `bun test` 129 ✓ · `test:components` 5 + 33 + 27 ✓ · E(web-stats) 3 passed (42 s) ✓ · E(web-miner) 11 passed (11.1 min, on the shared Vite base changes) ✓.

## Arc 3 codex loop (2026-09-06)

**Round 1** (`/codex xhigh`, session `01a07441-18b7-71e2-ac9f-68490a5a3de9`, `run-codex.sh` on the `arc2-miner..HEAD` diff with the arc map, the plan, the decision ledger and both rules). Verdict: "changes requested"; fifteen findings (two P1), all verified and accepted, plus a five-item comment audit. Fixed in one commit:

- **A zero target froze the tab** (P1): `difficulty` → Infinity → the tick loop never ended. The reader now refuses rows outside what the contract can write (`target` a u128 ≥ 1, `opened_at` a u64, `claims` ≤ N) and `ticks` refuses non-finite bounds (bun test).
- **CI on a clean checkout could not run the reader tests** (P1): they loaded the compiled miner artifact for its storage layout. The two layouts are now a committed fixture, `fixtures/storage-layout.json`, written by `scripts/export-layouts.ts` and checked fresh in `contracts.yml`; the reader tests, the generator, the CLI, the stats prebuild and the E2E setup read the fixture; the page fetches a copy of it. `slots.ts` owns the derivation and the fixture path.
- **The poll left a permanent gap** after more than a window of closes: it now reads from `max(last held − 1, open − 47)` and replaces the history with the newest window when the two are not contiguous (Vitest). **A history read failing in the poll** used to read as "node unreachable" and discard the fixed-slot reads: the poll publishes supply/open/block and reports the history error as the "history unavailable" notice (Vitest).
- **Poll and "load older" could overwrite each other**: chain reads are serialised in `main.tsx`.
- **The request bound was overstated**: eight epochs in flight meant 24 requests; the reads of one epoch now go one at a time, so `concurrency` bounds requests (the test asserts a peak of 3 at concurrency 3). The stats page also aborts node requests after 30 s through the shared `boundNodeRequests` (moved to `site/src/browser/node-deadline.ts`; the miner keeps 120 s).
- **The CLI's batch boundaries left epochs 95, 191, … looking open**: rows are linked once, whole.
- **Calculator shares above 100 %**: the share is yours over the network plus yours (never above 1) and the per-day figure uses the same share; the sheet is disabled while the network rate is unknown instead of computing against zero.
- **Claims/hour ignored the open epoch's claims**: it counts them (spread over the epoch's life so far) and the tile says it is an estimate, since storage keeps counts, not claim times.
- **Sentences misstated retargets**: a roll always said "the maximum ×4 easing" (false at u128 saturation) and the normal template called ×0.96 a target increase; every template now states the observed move ("made ×1.44 harder" as a difficulty ratio, "eased ×0.72" as a target ratio).
- **The prebuild trusted any directory with 512 files**: the generator stamps the layout it derived from next to the chunks and regenerates when the fixture differs.
- **The strip overflowed** (percent bases plus minimum widths): widths are flex weights and the row scrolls horizontally.
- **A failed E2E setup leaked its Vite server**: both `run-setup.ts` kill the server's process group before releasing the port.
- **An unloaded `?epoch=` blocked the arrow keys**: the strip and the table get the loaded selection (or none).
- **A fast window hid the expected-duration guide**: the duration scale includes the expected value.
- Comments: the plan reference in `chain.ts`, four file summaries that repeated their component, the reader's successor contract, the emission caption, the ticks doc.

Gate after the fixes: `bun run lint` ✓ · `lint:actions` ✓ · `typecheck` ✓ · web-stats and web-miner `tsc -b` ✓ · `bun test` 129 ✓ · `test:components` 9 + 33 + 27 ✓ · E(web-stats) 3 passed ✓ · E(web-miner) 11 passed (12.0 min) ✓.


**Round 2** (resumed, the round-1 fix commit under review). Verdict: "changes requested"; seven findings, all reproduced and accepted, plus one comment correction:

- **A u64 `opened_at` is not a timestamp**: `2^63` passed the round-1 bound and `new Date(...)` threw `RangeError` in the table. The reader bounds `opened_at` and `launch_at` by the last second a `Date` can hold (8.64e12); the reader test asserts the refusal.
- **`1e309` in the calculator field**: `Number("1e309")` is Infinity, the share became NaN and `BigInt(NaN)` threw while rendering. `calculator` treats a rate that is not a finite positive number as zero (documented; bun test), and the sheet passes the raw parse.
- **The serialisation defeated the "already loading" guard**: `older()` checked the flag after its turn came, by which time the previous read had cleared it, so a held ArrowLeft queued a window per repeat. The flag is taken before queueing; polls are coalesced (`serial.ts`: `serial` + `coalesced`, Vitest).
- **A failed history read mislabeled the open epoch**: `pollChain` advanced `open` while keeping the old rows, and the Observatory took the last row as the open one, so "epoch 13" showed epoch 12's claims. The tiles use the row whose epoch is `chain.open`, or a dash and "this epoch not read yet" (Vitest).
- **Abandoned reads stayed in flight**: the transport bound was 30 s against the reader's 10 s, and the SDK's default fetch retries three times with its own deadline each. The stats client uses `makeFetch([], false)` (no retries) and the bound equals `DEFAULT_LIMITS.timeoutMs`, so a read the reader gave up on is aborted with it.
- **The layout freshness check ignored its inputs**: `contracts.yml` now watches `miner-core/scripts/**` and `miner-core/fixtures/**`.
- **A truncated cached chunk was served**: the stamp (`.stamp.json`) carries the layout and a SHA-256 per chunk; `slotsCurrent` verifies every chunk (the gen-slots test truncates one).
- Comment: "eased ×0.72" was an easing below one; the example is now "eased ×1.44" with the target fall stated for the harder case.

Gate after the fixes: `bun run lint` ✓ · `lint:actions` ✓ · web-stats `tsc -b` ✓ · `bun test` 143 ✓ · web-stats `test:components` 12 ✓ · E(web-stats) 3 passed (43 s) ✓ (the miner does not import the changed modules; its E2E is unchanged from round 1).
