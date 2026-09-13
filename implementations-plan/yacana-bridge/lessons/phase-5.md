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
