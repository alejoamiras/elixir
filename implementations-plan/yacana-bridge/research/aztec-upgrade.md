# research — simulating a governance rollup upgrade on the isolated local network (Aztec 5.2.0)

Persisted from a read-only research agent (2026-09-12) plus two verifications by the author (marked ✔). `$V5` =
the pinned sources at `~/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0`; `$CUR` = `~/Projects/aztec-node`
(6.0.0, `@aztec-labs/*`): identical governance CLI and local-network behaviour, so a 5.2.0-pinned harness does not
drift. The tutorial (docs site only, not in either checkout) is correct for 5.2.0 but its V6 never produces blocks.

## 1. What `aztec start --local-network` is

- `--local-network` short-circuits everything: it calls `createLocalNetwork({ l1Mnemonic, l1RpcUrls,
  testAccounts })` and ignores `--registry-address`, `--rollup-version`, `--node`, `--sequencer`
  (`$V5/yarn-project/aztec/src/cli/aztec_start_action.ts:33-49`). The debug RPC namespace is on.
- Forced config (`$V5/yarn-project/aztec/src/local-network/local-network.ts:100-141`): `useAutomineSequencer: true`,
  `automineEnableProveEpoch: true`, `realProofs: false`, `aztecEpochDuration: 4`, `aztecProofSubmissionEpochs: 2`
  (both forced, env ignored), `skipOrphanProposedBlockPruning: true`; `aztecSlotDuration` from env (72 s).
- Forced at L1 deploy (`:57-82`): `aztecTargetCommitteeSize: 0`, `slasherEnabled: false`, `realVerifier: false`.
- The L1 deployer / publisher / validator is anvil index 0 of `test test … junk` (`mnemonic.ts:1`):
  `0xf39F…2266`, key `0xac0974…ff80`. It owns the staking `TestERC20` (mints freely, `DeployAztecL1Contracts.s.sol
  :119-131, 263-273`; `TestERC20.sol:16-22`); `governanceBeneficiary = address(0)` → anyone may `Governance.deposit`
  (`Governance.sol:255-257`).
- `deployAztecL1Contracts` sets `anvil_setBlockTimestampInterval(12)` globally and warps past slot 0
  (`deploy_aztec_l1_contracts.ts:315-324, 376-397`); `deployRollupForUpgrade` touches no anvil time.

## 2. Governance timing on a local deployment

`DeploymentConfiguration.sol:152-164` (NETWORK unset → `local`): `votingDelay 60 s`, `votingDuration =
AZTEC_GOVERNANCE_VOTING_DURATION ?? 3600`, `executionDelay 60 s`, `gracePeriod 7 d`, `quorum 10 %`,
`requiredYeaMargin 4 %`, `minimumVotes 400e18`, `lockAmount 1e24`, `lockDelay 30 d`.
**`AZTEC_GOVERNANCE_VOTING_DURATION=60 aztec start --local-network` yields a 60 s voting window** (threaded from
node config to forge env, `ethereum/src/config.ts:215-219`, `deploy_aztec_l1_contracts.ts:553`). This matters
because the local proof window is `2 epochs × 4 slots × 72 s = 576 s` of L1 time: a 3760 s governance warp prunes
V5's unproven checkpoints; a 180 s one does not.

## 3. Deploying V6 and the version-collision trap

- Version = `uint32(bytes4(keccak256(abi.encode(rollupConfig, genesisState))))` (`RollupConfiguration.sol:132-145`);
  `Registry.addRollup` reverts `Registry__RollupAlreadyRegistered` on a duplicate (`Registry.sol:59-68`), which makes
  `Governance.execute` fail. Perturb one field: `manaTarget + 1` (CLI-friendly; `spartan/upgrade_rollup_version
  .test.ts:78-103`) — a genesis-timestamp offset (`add_rollup.test.ts:128-146`) only works in-process because
  `aztec start --node` cannot reproduce it (`standby.ts:26-39`, `start_node.ts:111-115`).
- ✔ `deployRollupForUpgrade(privateKey, rpcUrl, chainId, registryAddress, args)` and
  `getDeployRollupForUpgradeEnvVars(args)` are exported by the installed `@aztec/ethereum`
  (`dest/deploy_aztec_l1_contracts.d.ts:219, 253`); the args carry `initialValidators`, `realVerifier`,
  `feeJuicePortalInitialBalance`, the genesis triple (`vkTreeRoot`, `protocolContractsHash`, `genesisArchiveRoot`),
  `aztecSlotDuration`, `aztecEpochDuration`, `aztecTargetCommitteeSize`, the two lags, `inboxLag`,
  `aztecProofSubmissionEpochs`, `manaTarget`, `slasherEnabled`, and the slashing knobs. It runs
  `script/deploy/DeployRollupForUpgrade.s.sol` through `forge_broadcast.js` with `FORGE_BIN` resolved by
  `resolveFoundryBinary('forge')`, `REGISTRY_ADDRESS`, `NETWORK`, and derives GSE/governance/assets from the
  canonical rollup (`DeployRollupForUpgrade.s.sol:72-93`). The script also deploys a
  `RegisterNewRollupVersionPayload` and prints `payloadAddress` (`:53-69`).
- **Copy the local network's config exactly** (committee 0, slasher off, real verifier off, epoch 4, proof epochs 2,
  slot 72, inbox lag 2) except `manaTarget + 1`. Do not use `aztec deploy-new-rollup` blind: it takes plain env
  defaults (committee 48, slasher on, epoch 32; `cli/src/cmds/l1/deploy_new_rollup.ts:25`) and, without
  `--validators`, hardcodes a validator whose key you do not hold (`cli/src/utils/aztec.ts:67-81`).
- `_maybeRegisterRollup` skips direct registration when Governance owns the Registry (`DeployRollupLib.sol:112-119`):
  the governance path is mandatory. `_maybeMintInitialFeeAsset` leaves the new FeeJuicePortal at zero because the fee
  asset is owned by the CoinIssuer (`:94-110`): fund it via `FeeAssetHandler.setMintAmount` + `mint(newPortal)`
  (`add_rollup.test.ts:187-197`). ✔ `FeeAssetHandlerAbi`, `GovernanceAbi`, `GSEAbi`, `RegistryAbi`,
  `RegisterNewRollupVersionPayloadAbi` ship in `@aztec/l1-artifacts`.
- Payload: two actions, `Registry.addRollup(ROLLUP)` and `ROLLUP.getGSE().addRollup(ROLLUP)`
  (`RegisterNewRollupVersionPayload.sol:36-47`); `GSE.addRollup` makes V6 the latest and moves every
  `moveWithLatestRollup` attester to it at once (`GSE.sol:130-176, 281-286`). There is no `V5UpgradePayload.sol` in
  5.2.0.

## 4. The governance lifecycle, programmatically

1. Deposit: the staking asset is the governance token (`governance_utils.ts:39-54`); mint ≥ `lockAmount + vote`
   (2e24 as the tutorial does) to the deployer, `approve(governance)`, `governance.deposit(deployer, amount)`.
2. `governance.proposeWithLock(payload, to)` (`Governance.sol:427-431`): bypasses the GovernanceProposer and
   `GSEPayload.amIValid` (no 2/3-stake requirement); the proposal never becomes droppable; the id from the
   `Proposed` log (`ethereum/src/contracts/governance.ts:166-177, 457-470`).
3. Warp to `creation + votingDelay + 1` and MINE a block (`valueAt` must be strictly in the past,
   `CheckpointedUintLib.sol:78-81`), then `governance.vote(id, amount, true)` as the EOA — `Rollup.vote` cannot be
   used for a lock proposal (`StakingLib.sol:203-239`, `Staking__NotCanonical` is that guard).
4. Warp to `+ votingDuration + executionDelay + 1`, mine, `governance.execute(id)` (`Governance.sol:488-506`).
5. Verify `registry.getCanonicalRollup()`, `numberOfVersions()`, `gse.getLatestRollup()`,
   `RegistryContract.collectAddresses(client, registry, oldVersion | newVersion)`.
Cheat codes needed: `evm_setNextBlockTimestamp` + `hardhat_mine` (`EthCheatCodes.warp`, ✔ shipped under
`@aztec/ethereum/test`). A ready helper pair exists — `createGovernanceProposal` / `executeGovernanceProposal` in
`ethereum/src/test/upgrade_utils.ts` — but its lock/vote amount is 1e22, 100× below the local `lockAmount`; raise it.

## 5. After the flip: nodes

- The running `--local-network` node cannot follow the new canonical rollup: no flag, L1 addresses are pinned at
  startup (`aztec-node-admin.ts:84`), and `setupAutoShutdown` is off for `NETWORK=local` and only shuts down anyway.
- A node is pinned with `--registry-address` (`REGISTRY_CONTRACT_ADDRESS`) + `--rollup-version` (`ROLLUP_VERSION`,
  an integer; omit or `canonical` to follow at startup). No `--rollup-address`, no `--l1-contracts.*` in 5.2.0.
- Two nodes on two rollups on one anvil work sequentially (`add_rollup.test.ts:518-520`), but two automine
  sequencers fight over the L1 clock (the AutomineSequencer owns L1 time: `sequencer-client/src/sequencer/
  automine/README.md:41`). Run them one at a time: stop the V5 node before starting the V6 node.
- ✔ On the `--node` path the automine flags are env: `USE_AUTOMINE_SEQUENCER=1`, `AUTOMINE_ENABLE_PROVE_EPOCH=1`
  (`aztec-node/src/aztec-node/config.ts:121-130`); the rollup must have `aztecTargetCommitteeSize == 0`.
- The V6 node: `aztec start --node --sequencer --registry-address <R> --rollup-version <V6> --node-debug` with the
  same `TEST_ACCOUNTS` / `SPONSORED_FPC` / `PREFUND_ADDRESSES` as V5's genesis, `AZTEC_MANA_TARGET=<bumped>`, a fresh
  `--data-directory` and `--world-state-data-directory`, distinct `--port`/`--admin-port` (registry-claimed), the
  automine env above; it throws if its computed genesis root differs from the rollup's (`start_node.ts:111-115`).
- V5 after the flip: its automine node keeps building and synthetically proving V5 as long as it runs (proving is
  cheat-code based, independent of canonical status); stopping it is "V5 goes quiet". The RewardDistributor gates on
  canonical (`RewardDistributor.sol:124-171`) — irrelevant to the harness.

## 6. Proving on the local network

- Epochs are proven synthetically by the AutomineSequencer's auto-prove loop (`automineEnableProveEpoch`): it writes
  the epoch out hashes into the Outbox and advances the proven tip (`automine/README.md:35, 53-60`). Wall clock is
  decoupled from slot time (automine warps L1 to slot boundaries).
- `aztecDebug_prove(upToCheckpoint?)` (`stdlib/src/interfaces/aztec-node-debug.ts:38`, ✔ `createAztecNodeDebugClient`
  exported) does the same on demand; `aztecDebug_mineBlock`, `warpL2TimeAtLeastTo/By` exist too.
- `aztec set-proven-through` (hidden; module `assume_proven_through.ts` → `RollupCheatCodes.markAsProven`) only
  pokes the STF proven tip via `hardhat_setStorageAt`; it writes NO Outbox root, so it is not a substitute for
  proving L2→L1 messages — its use is to stop pruning across a long warp.
- `RollupCheatCodes` (`ethereum/src/test/rollup_cheat_codes.ts`): `advanceToEpoch`, `advanceToNextEpoch`,
  `advanceSlots`, `markAsProven`, `insertOutbox(epoch, num, outHash)`, `waitForEpoch`.
- Env that reaches a `--local-network` rollup: `AZTEC_SLOT_DURATION` (a multiple of 12) only; on the `--node` path
  also `AZTEC_EPOCH_DURATION`, `AZTEC_PROOF_SUBMISSION_EPOCHS`, `ETHEREUM_SLOT_DURATION`. Epoch duration ≤ 32.

## 7. Messages across versions

- One Inbox and one Outbox per rollup, each with an immutable `VERSION`; `Inbox.sendL2Message` requires
  `recipient.version == VERSION`, `Outbox.consume` requires `sender.version == VERSION` and `chainid`: V5 messages
  live only on V5's boxes, V6's only on V6's. A portal must resolve boxes per version from the Registry (never cache
  one canonical rollup as `TokenPortal.initialize` does).
- L1→L2 readiness with `inboxLag = 2`: use `isL1ToL2MessageReady` / `waitForL1ToL2MessageReady`, not "seen".
- L2→L1 witness: `node.getL2ToL1MembershipWitness(txHash, leaf)` in `retryUntil(…, 60, 1)` → `{epochNumber,
  numCheckpointsInEpoch, root, leafIndex, siblingPath}` → `Outbox.consume` (`l2_to_l1.test.ts:358-410`).
- Arbitrary-sender public consumption exists (`TestContract.consume_message_from_arbitrary_sender_public`), so a
  portal-sent retire message consumed by a public function with the portal as `sender` is the standard shape.

## 8. Pitfalls (each with the workaround)

1. Version collision → `manaTarget + 1`. 2. `deploy-new-rollup` env defaults + a foreign validator → call
`deployRollupForUpgrade` with the local config. 3. A non-zero committee size → no automine, no blocks, plus
`lagInEpochsForValidatorSet` epochs of history → keep 0. 4. Shared GSE/staking asset: V6 takes the bonus attesters
(irrelevant with committee 0). 5. V6's FeeJuicePortal unfunded → `FeeAssetHandler`. 6. Actor `version` fields →
per-version boxes. 7. Portals that cache addresses → resolve per call. 8. Node state not portable → fresh data dirs.
9. Governance warps past the proof window → `AZTEC_GOVERNANCE_VOTING_DURATION=60` at network start (and
`aztecDebug_prove` before long warps). 10. `valueAt` NotInPast → warp + mine before voting. 11. `upgrade_utils`'s
1e22 lock → 2e24. 12. Two automine sequencers → sequential. 13. Epoch duration ≤ 32.

## What is impossible / open

- Impossible: making a running `--local-network` follow the flip; pointing `--local-network` at an existing
  Registry; using `set-proven-through` to make L2→L1 messages consumable; registering an identical rollup;
  overriding epoch duration / proof epochs on a `--local-network` rollup; `Rollup.vote` on a lock proposal;
  reproducing a genesis-timestamp perturbation from the `--node` CLI.
- Open (verify at the harness phase): whether `RollupCheatCodes` and `upgrade_utils` ship in the installed
  `@aztec/ethereum/test` (only `eth_cheat_codes*` was listed; otherwise call Governance through viem directly);
  whether raising `AZTEC_SLOT_DURATION` affects PXE tx expiry; no in-repo e2e uses the `proposeWithLock` route
  (both upgrade tests use the GovernanceProposer signalling path), so the harness is the first.
