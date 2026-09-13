# Phase 4 — the flip alone: the rig, harness.yml

## What landed

- `scripts/run/upgrade-rig.ts`: `startUpgradeRig()` boots the isolated network with a five-slot vote, deploys the
  next rollup (`deployRollupForUpgrade` with the canonical's on-chain config, the pinned node's own genesis root and
  prefund, one bump to `manaTarget`), carries the governance vote through the live node's clock, stops a node
  (pausing its sequencer first), starts a node pinned to a version (validator + publisher keys, no proof
  verification at the node, the same genesis env), and records every warp with the live version's proof-window
  headroom.
- `packages/harness`: `tests/flip.bun.test.ts` (H0, under `YACANA_RIG=1`), `src/sponsored.ts` (a fresh account
  deploys itself with the sponsored FPC paying — the one user transaction the plan asks of the new version).
- `scripts/run/rig.ts` + root `bun run rig -- <case>…`; `.github/workflows/harness.yml` (PRs run the flip;
  dispatch runs named cases or all).
- `scripts/run/toolchain.ts`: a child's last 40 output lines travel with a readiness failure (`Owned.tail`), and
  exit is also read from `exitCode`/`signalCode`, not the event alone.

## Gate

`bun run rig -- flip` ✓ (1 pass; 50 s wall; the run's warps and their proof-window headroom in the plan's P4 line;
teardown left no port rows and no run dir) · `bun run lint:actions` ✓ · `bun run lint` + typecheck ✓ ·
`bun test packages/harness packages/bridge scripts/run` ✓ (the rig case skips without `YACANA_RIG=1`).

Eleven H0 runs to green, each one fix: the Registry lookup of an unregistered rollup, the governance lock's
effect on voting power, the missing key store, real-proof verifiers, a silent logger, the automine sequencer's
clock, the local-network path's p2p requirement, libp2p's multiaddr mismatch (twice: announce, then bind), the
launcher's timing config, and the Outbox epoch the assertion read.

## Lessons

- A rollup just deployed is not in the Registry: `RegistryContract.collectAddresses(version)` throws "Rollup address
  is undefined". Read `getInbox()`/`getOutbox()` off the rollup itself.
- `proposeWithLock` starts a withdrawal of `lockAmount` from the proposer's deposit, so the power left to vote with
  is `deposit − lockAmount`, not the deposit (`Governance__InsufficientPower`). Vote with `powerAt(voter,
  votingOpens)` after the warp, and check it against `getConfiguration().minimumVotes`.
- A plain `aztec start --node --sequencer` gets nothing from the mnemonic: `--local-network` derives the validator
  and publisher keys itself ("Failed to create key store, a requirement for running a validator"). Pass
  `VALIDATOR_PRIVATE_KEYS`, `SEQ_PUBLISHER_PRIVATE_KEYS` and `COINBASE`.
- The same for proofs: the local network sets `realProofs: false`; a plain node defaults to real verifiers and dies
  with "Barretenberg working directory (BB_WORKING_DIRECTORY) is not set".
- The decisive one: the automine sequencer needs a settable clock, and only `createLocalNetwork` constructs a
  `TestDateProvider` — a plain `aztec start --node --sequencer` with `USE_AUTOMINE_SEQUENCER=1` boots, answers RPC,
  and then fails every build with "this.deps.dateProvider.setTime is not a function". No flag reaches that
  constructor. The local-network path itself only skips its L1 deployment when p2p is on, and this toolchain's
  libp2p cannot bind a socket: `@multiformats/mafmt` at the toolchain's root is bound to multiaddr 12.1.14 while
  `libp2p`'s nested copy is 12.5.1, so the TCP transport's `listenFilter` rejects every listen address ("no valid
  addresses were provided for transports [@libp2p/tcp]") — verified with a two-line probe against both copies.
- So a pinned node is our own launcher, `scripts/run/pinned-node.mjs`: the local network's node construction
  (`createAztecNodeService` with a `TestDateProvider`, automine on, synthetic settlement, no proof verification,
  the genesis from `PREFUND_ADDRESSES`) without the deployment, the RPC + debug + admin servers from the same
  `@aztec/foundation` server the CLI uses, resolved from the toolchain's packages and run by the same `node` the
  aztec launcher execs. Not a fork of anything: ~90 lines of wiring over exported functions.
- `bun test` runs with `NODE_ENV=test`, and the aztec logger takes that as "silent": a node spawned from a test
  logs nothing unless `LOG_LEVEL` is set explicitly (the local-network path sets its own). The rig passes
  `LOG_LEVEL=info` to a pinned node; its own progress lines go through `console.info` for the same reason.
- A plain node checks its computed genesis root against the rollup's at boot (`start_node.js`), so a pinned node
  that reaches readiness has agreed with the rig on the genesis; H0 also asserts the rollup's root on chain.
- The sponsored FPC needs no publication on a pinned node: the local network never deploys it either — its
  address is in the genesis prefund and wallets register the instance locally. The pinned node's prefund list
  (`PREFUND_ADDRESSES`: the test accounts, then the FPC) is the same list, in the same order, that the rig computed
  the new rollup's genesis root from.
- Without the child's output, a node that dies at boot reads as "port in use or spawn failed" and a node that never
  listens reads as a 240 s timeout with no cause: the tail in the error turned two blind reruns into one-look fixes.
- CI's `setup-aztec` installs only `~/.aztec/versions/<pin>`; `@aztec/ethereum` resolves forge through
  `$FORGE_BIN`, `~/.aztec/current`, `~/.foundry` and PATH, so the flip failed on the stack's PRs with
  "forge binary not found" while every local run passed (a moved `~/.aztec/current` had lent 5.1.0's forge).
  The rig names the pinned `aztec-forge` through `FORGE_BIN` before the second rollup's deploy; local flip green.
