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

