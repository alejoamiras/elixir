# Lessons — arc 0 (rename)

## P0.1 Protocol rename (2026-09-05)

**Result:** ✓. New `W_VK_HASH = 0x1d1043617e4762fe8a2bb2ecf572de706ae890fdb4a4ff0d8f298e24722ece7b` (was `0x09fdc6…fb53`).
Order that worked: `git mv` crates/fixtures → sed renames → `params-codegen` → work-circuit `compile` → `sweep.ts --runs 1 yacana_work`
(the fixture proof comes from `target/<crate>/`, which `sweep.ts` writes; `determinism.ts` writes to `target/<crate>-det` and never feeds
the fixture) → `determinism.ts --runs 3` (3/3 byte-identical, sha256 `57799830…be42`) → `export-vk` → `pin-vectors` → `params-codegen`
(vectors.nr) → `spike:manifest` → work-circuit `compile` AGAIN → contracts compile.

- **`bun run codegen` leaves `target/verify_w.json` one VK behind.** Its order is compile → export-vk, so the verify_w artifact
  is built against the previous `vk.nr`; `vk-pinning.test.ts` compiles verify_w itself so it is unaffected, but anything reading
  `target/verify_w.json` after a VK change needs a second compile.
- **nargo `--print-acir` prints constants above p/2 as negatives.** The new hash happens to be > p/2, so the pinning test's
  `(\d+)` regex silently dropped the `ASSERT w492 = -…` line. Fixed: `(-?\d+)` normalised mod p.
- **Root `typecheck` (new) surfaced ten latent errors** in scripts nobody type-checked (Bun runs them untyped): `launch.ts`
  logged `receipt.txHash` off a `{ receipt }` wrapper (printed `undefined` at runtime), an `unknown`→`number` template, a
  `Uint8Array<ArrayBuffer>` narrowing in `mutation.ts`, `proof-shape.ts` not a module, `window.__spike`/`window.yacana`
  declared only in files outside the program, and `process.off('SIGINT')` rejected by bun-types 1.4's `memoryPressure`
  override (cast through `EventEmitter`). Root `tsconfig.json` dropped `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes` (never enforced; `exactOptionalPropertyTypes` makes `NodeEmbeddedWallet` unassignable to
  aztec's `Wallet`, an upstream typing gap) and excludes `packages/web-miner/src` (its own `tsc -b` with `jsx` + `@/` paths
  covers it; the gates run both). `typescript ~6` is now a root devDependency.
- Timings (homelab, Ryzen 5 5600X): work-circuit compile < 1 s; prove 2.6 s; contracts compile ≈ 4 min; `aztec test` 54 tests ≈ 3 min.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `typecheck` ✓ · `bun run codegen && git diff --exit-code` ✓ (after `git add -A`) · `contracts:compile` ✓ · `contracts:test` 54 passed ✓ · `bun test` 37 pass / 6 skip / 0 fail ✓.

## P0.2 Workspace, env, storage, CI, docs (2026-09-05)

**Result:** ✓. `@yacana/*` names (lockfile diff = the five workspace rows only), `YACANA_*` / `VITE_YACANA_*`, storage keys
`yacana.connection` / `yacana-pxe-<ns>` / `yacana-wallet-<ns>`, `yacana-` run ids, wrangler `yacana-web-miner`, CI path
filters, docs; `deployments/testnet.json` → `deployments/elixir-testnet-2026-09-04.json` (git mv, unchanged) with an
"Archived" section in `docs/deployments.md`.

- **The guard needs reference exemptions, not just path exemptions.** `CLAUDE.md`, `README.md` and `docs/roadmap.md`
  legitimately point at `implementations-plan/elixir-core/…` and the archived record; the test strips those path
  tokens from a line before the word-bounded match. `docs/deployments.md` is checked only above its `## Archived`
  heading. A planted `tELX` in `README.md` was caught (negative check), then removed.
- The web miner's `.env.production` keeps the old addresses under the new keys until P0.3 writes the Yacana ones.

Gate: `bun install --frozen-lockfile` ✓ · `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `typecheck` ✓ · `bun test` 39 pass / 6 skip / 0 fail ✓ · `test:components` 12 passed ✓ · E(web-miner) 8 passed (3.7 min) ✓.

## P0.3 Fresh testnet deployment (2026-09-05)

**Result:** ✓. `AZTEC_NODE_URL=https://v5.testnet.rpc.aztec-labs.com bun run deploy` with `YACANA_DEPLOYER_SECRET` taken
from the owner's env file inside a throwaway wrapper script (sourced at runtime, exported, the sibling variables
unset; the log was deleted after the run; nothing echoed the value). Same deployer account as the archived
deployment (`0x2c7a1312…c54b`; a fixed account salt), so a rotated secret would have changed it — the owner's call.

- miner `0x2091605cff5bb6658821ef6df7a268e7b499ff326cafba8a5696102212565e3e`, token
  `0x2f83633f946bdf7ea294183c9c49dfb4172646b1edf81a6fb4b4f305bbd42d88`, miner class
  `0x20680945…ebb9` (new: new VK + domains), token class unchanged (`0x10fd5603…ecbf`, same aztec-standards artifact),
  `launchAt = launchedAt = 1788626340`, deployed 16:38:35Z; 4 sponsored transactions, ≈ 2.5 min end to end.
- The record test (`packages/deploy/src/deployment-record.test.ts`) compares `params` against `yacana.params.json`
  after canonicalising numbers / hex to decimal strings, which is how the deploy script serialises bigints.
- `scripts/rename-guard.test.ts` flagged itself once it was tracked (its own regexes name the old protocol) — it now
  exempts its own path. The Yacana section of `docs/deployments.md` must not name the old protocol either; only the
  `## Archived` tail may.

Evidence, `AZTEC_NODE_URL=https://v5.testnet.rpc.aztec-labs.com bun run epoch:stats` (2026-09-05 16:40 UTC):

```
epoch  claims  opened_at (UTC)       duration  retarget  difficulty
    0       0  2026-09-05T16:39:00     open        –  16.0
```

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `typecheck` ✓ · `bun test` 41 pass / 6 skip / 0 fail ✓ · `epoch:stats` shows epoch 0 ✓.
