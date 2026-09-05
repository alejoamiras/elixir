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

## Arc 0 codex loop (2026-09-05)

**Round 1** — session `01a07274-374c-7a21-8d1a-9bad08ec6109` (gpt-6-astra, xhigh, read-only; files in `~/.cache/tmp/codex-zq0gF8Lc`).
Verdict: "The rename and deployment are internally consistent; I found material guard, generation, and CI gaps, but no new
critical or high-severity exploit." Six findings, all verified against the repo and applied:
1. **Guard regex missed identifier spellings** (`ElixirMiner`, `VITE_ELIXIR_MINER`, `deployElixir`, `elixir_work.json` all
   evaded `\b…\b`; `.sh`, `.env.production`, `_headers`, file names unchecked). Now: substring `elixir` (any case) plus
   `t?ELX` bounded by non-alphanumerics, every tracked file except binary fixtures, paths included, the archived section
   bounded to its heading, positive/negative pattern cases in the test.
2. **`codegen` compiled before exporting the VK** (stale `verify_w.json`) and `export-vk` copied whatever proof sat in
   `target/<crate>/` next to a fresh VK. Now: `codegen` recompiles after the export; `export-vk` runs `bb verify` on the
   fixture and refuses a proof that does not verify under the new VK.
3. **Root `typecheck` had no CI consumer.** `miner-core.yml` runs it (and `bun test packages/deploy`), with its filter widened
   to the root program's inputs (`scripts/**`, `packages/deploy/**`, the scripts/e2e dirs, `deployments/**`, docs).
4. **`dorny/paths-filter` negations made every filter universal** (`!pkg/**/*.md` matches any unrelated file under the
   default `some` quantifier; codex reproduced `README.md` triggering all five workflows). All five workflows now set
   `predicate-quantifier: some-with-excludes` (supported at the pinned SHA, verified in its `action.yml`).
5. **Record test accepted unusable values.** Addresses now parse through `AztecAddress.fromStringUnsafe` + `isValid()`
   (5.2.0 has no throwing `fromString`; plan text saying `AztecAddress.fromString` means this pair), class ids/salts through
   `Fr.fromString`, zero rejected, `launchedAt ≥ launchAt`.
6. Comments: stale two-input `secretCommitment` docstring deleted; `mutation.ts` "nonce +/- 1" was wrong (the last public
   input is the output); codegen header compressed; record-test header no longer over-claims; `launchAt` documented as the
   chain-normalised value (not the address-predicting constructor argument).
Looks-fine list from codex: domain values, seeds, VK copies, artifact paths and production addresses agree; both addresses
and class ids reproduce from the artifacts; the archived record is byte-for-byte unchanged; no surviving deployer authority;
dropping the two tsconfig flags is defensible.

**Round 2** (resumed) — "Two material gaps remain, plus small validation and comment corrections." Applied:
1. `export-vk` verified `target/<crate>/proof` only when present, so a clean checkout skipped the check and copied a new
   VK beside the committed proof. Now the **fixture directory** is verified unconditionally after the copy (checked by
   moving `target/yacana_work` away and re-running: the committed fixture verifies, no diff).
2. `miner-core.yml` is now unconditional: the guard scans every tracked file and the root typecheck covers every package's
   scripts, so no path filter can be complete (`packages/web-miner/.env.production`, `index.html`, `commitlint.config.ts`
   were the examples). It is the cheap no-toolchain job.
3. Zero salts are legal (`YACANA_DEPLOY_SALT=0x0`), so the record test parses salts without a non-zero check.
4. Two comments corrected (no `AztecAddress.fromString` in 5.2.0; base64 `+ELX/` can match, the claim was dropped).
