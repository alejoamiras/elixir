# Phase 1 — the protocol: encodings, secrets, redeem keys, vectors, the toolchain module

Green 2026-09-12. Gate run in full: `bun run lint` (442 files clean, manifests sorted) · `bun run codegen` then no
drift beyond the hand edits it regenerates · `bun test packages/bridge packages/miner-core scripts` (61 pass, 8
skipped live suites, 0 fail) · `bun run contracts:compile` (miner artifact hash unchanged) · `bun run contracts:test`
(54 TXE tests + the crate's 6 vector tests) · `bun run lint:actions` clean.

## What landed

- `scripts/run/toolchain.ts`: `toolchainBin`, `spawnDetached`, `killOwned`, `jsonRpcReady`, `repoRoot` lifted out
  of `isolated-node.ts` unchanged; the runner imports them. `toolchain.lock.json` now hashes `internal-bin/forge`,
  `anvil` and `cast` next to `nargo` and `bb`; the existing toolchain test covers them with no code change.
- `yacana.params.json`: domains `EXIT` ("YACA/exit") and `REDEEM` ("YACA/rdm"), plus a new `separators` block
  (`EXIT_LOG` = "YXLG") because the protocol's `compute_log_tag` takes a `u32`, not a field — a 31-byte ASCII
  domain cannot be a log-tag separator. The codegen emits `SEP_*` as `u32` in `domains.nr` and `SEPARATORS` in
  `params.ts`; the work lib re-exports them.
- `packages/contracts/yacana_bridge_hashes`: `exit_content`, `send_ahead_content`, `claim_content`,
  `retire_content`, `exit_log_tag`; the selector is a `comptime fn` over `keccak256` (the same dependency the
  token portal lib uses, already pinned in the lock); `test.nr` is generated from `bridge-vectors.json`.
- `packages/bridge`: `content.ts` (keccak selector + 32-byte words + `sha256ToField`, `EthAddress.toBuffer32()`
  for addresses), `secrets.ts` (`deriveCrossingSecrets` over miner-core's now-exported `hkdf`: 64 bytes reduced
  into Fr for the secret, into the secp256k1 order for the redeem key — a constant, no extra library; the label
  `yacana.exit.v1:<chainId>:<portal lowercase>:<version>:<i>`), `scripts/pin-vectors.ts`, `vectors.test.ts`.
- CI: `miner-core.yml` tests `packages/bridge`; `contracts.yml`'s filter watches `packages/bridge/fixtures/**`.

## Lessons

- `aztec test` runs contract crates only: a `type = "lib"` member of the Nargo workspace is silently skipped. The
  `contracts` package's `test` script now chains `aztec-nargo test --package yacana_bridge_hashes`. Any future lib
  crate needs the same.
- Adding globals to `domains.nr` changes the work circuit artifact's source `hash` field (the crate's whole source
  is hashed) while its bytecode and ABI stay byte-identical; `artifacts:commit` refreshes the committed copy and CI
  diffs it, so the refreshed file is committed with the change. Verified by comparing the two JSONs key by key.
- The Bash guard refuses any command whose text contains `git` (even inside an aztec-packages URL in a heredoc)
  and any `cd` in a compound command; write such files with the Write tool and run tests from the repo root.
- The `aztec` CLI tries to warn on version mismatch by scanning for `Nargo.toml` from the cwd: `aztec test --help`
  from the repo root errors out. Run it from `packages/contracts`.

## Consults

None needed: no design decision arose; every choice followed plan.md §3.1–3.2 as written.
