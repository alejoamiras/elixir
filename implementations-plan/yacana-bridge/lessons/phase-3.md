# Phase 3 — YACA, the portal, the L1 deploy script, the record

## What landed

- `packages/portal` (Foundry): `src/YACA.sol` (ERC-20, the portal its immutable minter/burner),
  `src/YacanaPortal.sol` (the observed transitions, the frozen cap net of inbound, per-version pauses accounted up
  front, the deadline, `retire`, `forward`/`forwardMany`/`forwardOne` with the caller carried through the self-call,
  `deposit` with `closeDeposits`, `redeem` with no waiting period, EIP-712 `Forward`/`Redeem` structs),
  `src/YacanaHashes.sol` (the four contents + the pinned `RETIRE_SECRET_HASH`), `src/aztec/` (vendored interfaces,
  libs and shims; `VENDORED.md`), `test/aztec/` (the real `Outbox`/`Inbox`/`MerkleLib`/`FrontierLib` with the test
  as their rollup and a `FeeJuicePortalStub`), `test/Harness.sol` (FakeRollup, FakeRegistry, a two-leaf epoch tree
  and its witness, EIP-712 signing), 62 tests across `Hashes`, `Forward`, `Bound`, `Lifecycle` (incl. a fuzz over
  the net-issuance invariant), `script/Deploy.s.sol` (every input from env; the key read inside the script),
  `scripts/forge.ts` (the pinned `aztec-forge` with forge-std from the toolchain), `scripts/abi.ts` (committed ABIs,
  CI diffs them).
- `packages/bridge/src/policy.ts`: the fixed policy from the profile (3× the schedule per hour, a day's allowance,
  180 d / 30 d / 60 d, −7 d / +90 d).
- `packages/deploy/scripts/l1-deploy.ts`: `forge script` through the toolchain, code verified, the `bridge` block
  written into a record; `--anvil` starts its own anvil on a registry port and deploys the harness's FakeRegistry.
- `.github/workflows/portal.yml`; root `portal:build` / `portal:test`.

## Gate

`bun run portal:build` ✓ · `bun run portal:test` 62/62 ✓ · `bun packages/portal/scripts/abi.ts && git diff
--exit-code packages/portal/abi` ✓ · `bun packages/deploy/scripts/l1-deploy.ts --anvil` ✓ (portal + YACA on chain
31337, code verified) · `bun run lint:actions` ✓ · `bun run lint` + typecheck ✓.

## Lessons

- npm's `forge-std` is an abandoned unofficial mirror (1.1.2, imports `ds-test`): not usable. The pinned toolchain
  ships the real forge-std under `@aztec/l1-artifacts/l1-contracts/lib/forge-std`, covered by the installer's hash,
  so `scripts/forge.ts` and `l1-deploy.ts` remap `forge-std/` to it through `FOUNDRY_REMAPPINGS`. OpenZeppelin comes
  from npm (5.6.1) under the 7-day gate. D42 amended in spirit: "vendored if missing" became "from the toolchain".
- `solc` 0.8.30 downloads on first use; forge fetched it fine here (no cached svm).
- "Stack too deep" on a nine-argument internal call: pass a struct (`Signed`).
- Test fixtures must respect the field: a keccak-derived secret hash exceeds `MAX_FIELD_VALUE` and the Inbox
  rejects it (`Inbox__SecretHashTooLarge`); shift the fixture right by a byte.
- `vm.expectRevert` binds to the *next* external call: a view like `v2.INBOX()` between it and the call under test
  consumes it. Hoist the lookup.
- The Inbox numbers leaves globally from `INITIAL_CHECKPOINT_NUMBER + LAG`: the first index on a height-4 tree is
  32, not 0.
- `forge script --json` prints one JSON object per line; the script's return values sit in the object with a
  `returns` key.
- forge's `[lint]` warns on `1 << path.length` (incorrect-shift) in Aztec's own Outbox; cosmetic, left as is.

## Consults

None: the design followed plan.md §3.1 as written.
