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
