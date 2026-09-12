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
  ships the real forge-std under `@aztec/l1-artifacts/l1-contracts/lib/forge-std`, pinned by a tree digest in
  `toolchain.lock.json` (the installer's hash covers only the installer script, not the npm packages it fetches),
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

## Arc 1 fix loop (plan.md §10 steps 2–3)

**Round 1** — `/codex high` (GPT-6 Astra), session `01a0978b-662d-7350-bb67-e6e2806cf9fd`, over `git diff main...HEAD`
(P1–P3), plan.md, §8, the arc map, the adversarial ask and both verbatim rules. Verdict: confidence high, one
blocker, ten should-fix, two nits, "a second round is needed after these fixes". Every claim was verified against the
repo; all were real. Applied:

- **Blocker** — `deadline()` treated an unseen `afterNextAt` as 0, so exits closed at `flip + 180d` instead of
  staying open until index `i+2` is observed (D8). Now `if (flip == 0 || next == 0) return max`; the test that
  asserted the bug was replaced and `testExitsRemainOpenAfter180DaysWithoutAfterNext` added.
- Continuation deployments reset difficulty: `continuationOf()` dropped the source's target. `sourceTarget` is now
  carried, deployed with, verified and recorded; `YACANA_CONTINUE_TARGET` is required alongside epoch and seed by
  hand.
- `pause`/`pauseAll`/`unpause`/`closeDeposits` never `_sync`ed, so a pause right after a flip left the cap growing
  through the pause (D17). All four sync first; `pauseAll` covers every registered version.
- One malformed leaf reverted a whole `forwardMany` batch: the catch recomputed the overflowing `leafId`.
  `LeafFailed` now carries `(version, position, epoch, reason)`, computed without the shift.
- `l1-deploy.ts` attached a portal to a record whose top-level `portal` differed. It refuses the mismatch.
- `Forwarded`/`Redeemed`/`LeafFailed` lacked the epoch, though leaf ids repeat across epochs. Added.
- `setOperators(0)` and a zero-operator constructor bricked administration. Both reject (`ZeroOperators`).
- Supply chain: the installer's hash covers the installer script, not the npm packages it fetches, so forge-std was
  unpinned. `toolchain.lock.json` gains a `trees` digest of `l1-artifacts/.../forge-std/src` (checked by
  `toolchain.test.ts` through `treeDigest`), and `noir-lang/keccak256/v0.1.3` a commit entry.
- The replay gate failed on artifact + layouts drift: re-recorded `recording.json` on the isolated network.
- Test names overstated coverage; the named tests were added (forward-then-redeem, redeem past the observed
  deadline, rejected-inbox refund, batch partial failure, saturation).
- TXE: retirement was mined before `claim`, so only the private anchor check was exercised. Added
  `record_claim_after_retirement_is_refused_as_self`, `record_inbound_is_only_self`,
  `claim_from_l1_rejects_a_wrong_secret` / `_amount` (contract-account setup for authwits).
- Vectors: an `edge` set (max-u128 amount, a tag with bit 253 set, an address with bit 159 set) pinned and asserted
  in TS, Foundry and Noir.
- Comments trimmed or corrected where they narrated declarations or misstated the forwarder rule.

Gate after the fixes: Foundry 71/71 · Noir 74 + 7 · bridge/deploy/scripts bun tests · lint + typecheck ✓.

Found on the way: the replay recorder ran a bare `vite build` without the miner's prebuild, so in a fresh worktree
(no `public/` CRS, artifacts or slot table) the page could never reach the cockpit and `record` timed out after
8 minutes with nothing to show; the replay lane always ran prebuild. `record()` runs it too now and surfaces the
page's console errors. Committed as `e072352`.

**Round 2** — resumed the same session with the fix diff. Two should-fix, both real:

- The committed ABI (`packages/portal/abi/YacanaPortal.json`) still carried the old event signatures and lacked
  `ZeroOperators`: regenerated. (`portal.yml` would have caught it, but only on the PR.)
- `testAFailedLeafRollsBackButTheOuterSyncSurvives` failed its leaf at `_requireOpen` (over the cap), before the
  Outbox was consumed, so its "rolled back" assertions were vacuous. It now fails at the mint — a zero recipient,
  `ERC20InvalidReceiver` — after consumption and the counter write, and asserts the `LeafFailed` reason.

Verdict: "ANOTHER ROUND". Committed as `4d83e18`.

**Round 3** — resumed with the round-2 commit. Findings: none. Verdict: "CONVERGED: nothing material remains".
The arc-1 loop closed in three rounds (1: 13 findings, 2: 2, 3: 0).
