# Phase 5 — the migration cases and the operator script

## What landed

- `packages/deploy/src/bridge/`: `operator.ts` (one record, one Ethereum connection, the portal/YACA/Registry typed;
  reads without a key, writes refused without one), `register.ts`, `transition.ts`, `status.ts`, `pause.ts`
  (+ `closeDeposits`), `retire.ts` (L1 then L2), `forward.ts` (exits → witnesses → the archive → `forwardMany`
  in batches; the announced-miner check for send-aheads), `l2.ts` (the operator's Aztec side); the CLI
  `bun run bridge -- <cmd>`.
- `packages/bridge/src/`: `portal.ts` (the `as const` ABIs, `ForwardArgs`), `witness.ts` (the Outbox leaf, the
  membership witness, the JSONL archive), `exits.ts` (`ExitRecorded` by type tag with a cursor), `inbox.ts`
  (the L1→L2 leaf a claim or the retire consumes), `signatures.ts` (EIP-712 Forward/Redeem).
- `packages/harness/src/`: `yacana.ts` (the portal on the rig's chain, a miner on a version, records under the
  run dir, operators by role), `user.ts` (a holder: mine once for real, send ahead, exit, claim), `revert.ts`
  (portal + Outbox errors by name); cases `bridge` (H1 H6 H8 H9 H10), `deposit` (H2), `migration` (H3 H4 H6
  H11), `skip-version` (H7 + the deadline boundary), `never-settled` (H5).
- `e2e.yml` gains the `rig` job (dispatch: every case).

## Gate

`bun run rig -- all` ✓ 2026-09-13 (967 s (16 min) wall, sequential; every case green on the first run of the gate) ·
`bun test packages/deploy packages/harness packages/bridge scripts/run` 41/41 ✓ · `bun run lint` + typecheck ✓ ·
`bun run lint:actions` ✓ (e2e.yml's `rig` job).

## Lessons

- The first K1 forward failed inside `forwardMany` with an empty reason while a later one passed. Not the
  per-leaf bound (a cold `forward` estimates at ~177k against 400k): a gas *estimate* cannot see through
  `forwardMany`'s try/catch — the cheapest "successful" execution is the one where the leaf runs out of its
  stipend and is logged as `LeafFailed` with no data, and that is the gas the estimator hands back. The
  operator now states the limit (`LEAF_GAS × leaves + 200k`); H1 prints the cold estimate and asserts it under
  the bound.
- After a prune, the two kinds of node tell two stories. The automine node that held the orphaned block keeps
  it (`skipOrphanProposedBlockPruning` is forced on with the automine sequencer), so its wallets still see the
  burn. A node syncing from scratch ignores the pruned checkpoint's calldata ("archive root mismatch") but its
  initial sync then starts over and never completes, so it never answers RPC unless `SKIP_ARCHIVER_INITIAL_SYNC`
  lets it serve while syncing — and served that way it never stores a block either (three minutes, nothing on
  it). So the local network cannot show what a production node does after a prune (drop the orphaned block; the
  reward untouched). H5 asserts the Ethereum side in full — the pending tip rewound, no root in the pruned slot,
  the forward refused — and that V6 comes back and serves; it makes no L2 balance claim, and neither may the app
  for an unsettled crossing beyond those facts. Plan P5's "time-boxed, see the wallet's balance back" is the one
  step of H5 the toolchain cannot stage.
- The local network settles on its own: an exit's witness exists moments after its block, so "not yet settled"
  cannot be observed on it. H5 pins its node with automatic settlement off to get an unsettled crossing.
- A message sent into the Inbox while checkpoint N is the tip lands in the tree of checkpoint N+3 (the Inbox's
  lag) and the node serves it only once its tip reaches N+3; blocks built within the same slot share a checkpoint,
  so two `mineBlock`s change nothing and two slot warps are one short. Measured with a bare `sendL2Message` on
  the rig: the hash the client computes is the Inbox's, bit for bit; the rig's `nudge` warps four slots.
- `LeafFailed` reasons and Outbox reverts are decodable only against the Outbox's ABI, not the portal's: viem
  names the portal's errors and leaves the rest as raw bytes.

## Arc 2 fix loop (plan.md §10 steps 2–3)

**Round 1** — `/codex high` (GPT-6 Astra), session `01a0984c-3ae4-7da1-907c-9b5ee7007927`, over
`git diff worktree-yacana-bridge...HEAD` (P4–P5), plan.md, §8, the arc map, the adversarial ask and both verbatim
rules. Verdict: confidence high, three blockers, seventeen should-fix, two nits, "a second round is needed after
these fixes". Every claim checked against the repo (and the toolchain's own `factory.js` for the key-store claim);
all but three were real. Applied:

- **Blocker** — the announced-miner check failed open: `forward` with no target record let every send-ahead through
  to whatever the live version had registered. Now no target holds every K2 (`refusedKind2: 'no target record'`),
  a differing miner holds them too, and the CLI says which; H3 and H6 assert the hold and the portal's own
  `NotForwardable` directly.
- **Blocker** — the pinned node inherited the ambient environment through `getConfigEnvVars()`, and the node
  factory prefers `KEY_STORE_DIRECTORY` over supplied keys and starts a prover node on `enableProverNode`. The
  launcher clears the key store, remote signer and prover switch, binds both RPC servers to loopback, and refuses a
  toolchain whose `@aztec/aztec` version is not the pinned one (`AZTEC_VERSION` from `.aztecrc`).
- **Blocker** — a SIGINT during a rig run tore down the local network but orphaned every pinned node (spawned
  outside its owned list) and its lanes; a failed version check after readiness leaked the child too.
  `startIsolatedNode` gained `adopt(child, cleanup)`: a pinned node dies with the network on teardown or signal, its
  lanes released; the rig's own `stop` disowns first; the version check sits inside the guard.
- The L1 `retire` could not be rerun once sent (`RetireAlreadySent`) although the CLI told the operator to run it
  again for the L2 step: `retireOnL1` returns the index from the `Retired` log with `resumed: true`, and the L2 step
  refuses a record of another version. H3 asserts the resume.
- The CLI had no way to forward from the archive alone: `--from-archive` and `--batch <n>` added; failures print by
  exit index and error name.
- The archive was parsed as JSON only: `parseArchivedExit` checks every field (kind 1|2, u128 amount, hex widths,
  path ≤ 64, leaf index inside the path, a checkpoint count ≥ 1) and names the line and field. Event fields from a
  node are checked too: a kind the miner cannot emit or an index past a safe integer is refused, not rounded.
- A bad archive line was kept as "archived" and its exit never fetched again: every entry is now folded to its root
  (`rootOf`, the Outbox's truncated-sha256 fold) and compared with `getRootData` before a forward; a mismatch stops
  the forward and names the exit. `errorName` moved to `packages/bridge/src/revert.ts` (the harness re-exports it).
- `LeafFailed` positions restarted at zero per batch: the report now carries the source exit's index.
- `batch: 0` looped forever and any size was accepted: 1–20 (`MAX_BATCH`), a unit test proves the refusal. The
  stated gas grew a per-leaf share for what a batch spends around each stipend (calldata, the copy into the
  self-call, a failure's event): `(LEAF_GAS + 60k) × leaves + 120k`; unused gas is refunded.
- The proof headroom was read after a warp, so a warp that crossed the deadline would have shown a fresh small
  number: `warpNodeBy` checks the pending tip did not rewind and throws if it did.
- `harness.yml`: a dispatch of the migration cases ran on a clean runner without the circuits, contracts or portal —
  the three builds now run on dispatch; `packages/bridge/**` and `packages/miner-core/**` join the filter.
- Nothing wrote the `.log` files both workflows uploaded: `spawnDetached` appends each child's output to
  `.localnet/logs/<run>/<name>.log`, kept after teardown; the artifacts point there.
- H8 in H2: total supply equals exited − inbound and headroom equals cap + inbound − exited after the round trip.
  H9 asserts `VersionPaused` by name; `pauseAll` is asserted on two registered versions in H3. The retirement
  refusal is matched on the miner's own message ("mining has ended on this version"), not any rejection.
- Vectors: the Outbox leaf and the Inbox leaf of one message and the Forward/Redeem EIP-712 digests are pinned and
  asserted by TS and by Foundry (`Hash.sha256ToField` over the real structs, the digest built from the portal's
  type strings); a TS test recovers a `signForward` signature to its key. Old vectors unchanged.
- `save` removed from the operator (unused; a stale read-modify-write). H5's header no longer promises a balance
  reading; three narrating comments trimmed.

Gate after the fixes: `bun run rig -- all` 8/9 then `migration` alone green (H11's stranger now names V6's record, so
the portal's `SignatureExpired` is what refuses it, not the script's hold) · Foundry 74/74 · bun 347 · lint +
typecheck + actionlint ✓.

Found on the way: the toolchain packages' `exports` do not expose `./package.json`, so the launcher's version
check reads the file by path rather than `require`-ing it; the first rerun of the cases died on that at every
pinned node, which is also what the new `.localnet/logs/<run>/aztec-v1.log` showed first.

Rejected, with reasons: a tree digest over the toolchain's whole JavaScript tree (the same tree runs every
isolated network of every E2E; the launcher now pins the version instead — the digest would add minutes to every
run for a check the `aztec` binary path never had); a live cap-edge case and a live multi-version budget case (the
cap arithmetic is Foundry's `Bound.t.sol`; mining past the cap on the rig is hours of proving); a 21-event
pagination test against a node (no offline node; the rig cases read through `readExits` already). The local
network's own admin listener (the `aztec` CLI's, no host option) still binds every interface unauthenticated — a
property of the toolchain's CLI, noted for the runbook.
