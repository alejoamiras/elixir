# fable plan (independent leg, Fable 5.1 via the Plan agent, 2026-09-12) — persisted by the parent

`W` = the worktree, `R` = the pinned 5.2.0 sources. **[unverified]** marks claims the agent did not read at the path.

## 0. Where the research contradicts the spec

- The spec still names a relayer; the owner removed it. Forwarding = operator script + in-app self-forward.
- `retire(N)` sets `flipAt[N]` at its first call, not at the real flip; the portal cannot read
  `CanonicalRollupUpdated` (`Registry.sol:67`) — accept the bound, make `retire(N)` the runbook's minute-one step.
- K6 "whoever proves the secret" contradicts draft 3's redeem key: with a key the secret is never revealed; adopt
  draft 3, drop the secret from K6.
- K4 content `H(4, amount, secretHash)` duplicates the Inbox message's own `secretHash` field (`Inbox.sol:109-117`,
  consumed through `compute_secret_hash(secret)`, `private_context.nr:890-910`); use the token bridge's form:
  `sha256ToField("claim_from_l1(uint256)" ‖ amount)`.
- `R/l1-contracts/script/deploy/` holds `DeployRollupForUpgradeV5.s.sol` and `V5_UPGRADE_RUNBOOK.md`: Aztec's own
  V4→V5 was a governance payload (`Registry.addRollup`, `GSE.addRollup`, plus reward-distributor and escape-hatch
  actions); the harness uses the generic `RegisterNewRollupVersionPayload` (two actions).
- Testnet has one canonical rollup: the rehearsal covers K1, K3, K2-to-held, the operator script, the RPC setting
  and the old origin; only the harness proves the flip.
- None of the new private functions verifies a proof, so the ACVM catches every bridge assertion; real proving is
  required where schedule continuity is tested (a real W claim on V6) and once per browser path.

## 1. Architecture

Bridge functions on the miner (`claim_from_l1` mints and `mint_to_private` validates the minter; `retire` gates
`claim`; a separate exit contract costs a second registered sender, split counters, a second `assertDeployment`).
`packages/portal` (Foundry: `YACA.sol`, `YacanaPortal.sol`, tag-pinned `src/aztec/` interface copies,
`script/Deploy.s.sol`, mocks, committed `abi/`; OZ + forge-std as commit-pinned submodules; `aztec-forge` from the
toolchain). `packages/miner-core/src/bridge/` (`content.ts`, `secrets.ts`, `portal-abi.ts`, `messages.ts`,
`records.ts`). `packages/deploy` grows (`l1.ts`, `scripts/bridge-forward.ts` also `--retire`,
`tests/bridge.live.test.ts`). Harness `scripts/run/upgrade-rig.ts` over `isolated-node.ts`. Web miner
`src/bridge/*`, `features/Bridge*.tsx`, `components/EthRpcTile.tsx`. Site: `host.ts` `versioned` kind, the guard's
second slot, `assemble.ts` role parameter, `v5/wrangler.jsonc`, `build.json` gains `role`, `rollupVersion`. Stats
`bridge` route; landing `sections/Faq.tsx` + `/faq` exact rewrite. Docs `docs/bridge.md`, `docs/upgrades.md`.

Miner: constructor `(initial_target, genesis_seed, launch_at, first_epoch: u64, portal: EthAddress)`; fixed slots
`portal, first_epoch, retired, exited_total, exits_count, claimed_from_l1_total`; `send_ahead(amount, secret_hash,
redeem_key, nonce)`, `exit_to_l1(amount, recipient, tag, nonce)`, `claim_from_l1(amount, secret, recipient,
leaf_index)` (allowed after retirement), `retire(leaf_index)` (public overload with `[0]`, sender = portal), `claim`
reads `retired` from the anchor header as it reads `open_epoch` (`main.nr:147-153`) and `record_claim` re-checks;
`record_exit` `#[only_self]` emits a public event `ExitRecorded{index, kind, amount, hash_or_tag,
recipient_or_redeem_key}` (`event_emission.nr:39-45`), listed by `node.getPublicLogsByTags` (`logs_query.ts:26-68`).

Encodings: K1 `"exit_to_l1(address,uint256,bytes32)"‖recipient‖amount‖tag`, K2 `"send_ahead(uint256,bytes32,
address)"‖amount‖secretHash‖redeemKey`, K4 `"claim_from_l1(uint256)"‖amount`, K5 `"retire(uint256)"‖version`;
vectors pinned three ways from `packages/miner-core/fixtures/bridge-vectors.json`.

Portal: per version `{l2Miner, registryIndex, launchAt, rewardPerEpoch, expectedEpochSeconds, flipAt, exited,
inbound, pausedUntil, pausedDays}`, `globalPausedUntil`; `register` (write-once, index by scanning `getVersion`),
`forwardToL1`, `forwardAhead` (successor = `getVersion(index+1)`, registered; `Inbox(successor).sendL2Message(
L2Actor(l2Miner[successor], successor), K4, secretHash)`), `deposit(amount, secretHash, expectedVersion,
deadline)`, `retire(version)`, `redeemToL1(…, sig)` (30 d after `flipAt`, EIP-712 `(leafId, recipient)`),
`pause(version|0, days)`; witness `{epoch, numCheckpointsInEpoch, leafIndex, path}`; a refusal reverts
`Portal__OverLimit` and the leaf stays consumable.

Secrets: `deriveExitSecret(master, version, i)` (HKDF `yacana.exit.v1:<version>:<i>`), `deriveRedeemKey(master)`
(HKDF `yacana.redeem.v1` → secp256k1 via viem `privateKeyToAccount`), gap 20; the scan matches
`computeSecretHash(secret_i)` against exit logs and `Deposited`/`Forwarded` events fetched by block range.

Harness API: `startUpgradeRig()` → `{ v5, l1, deployV6Rollup(), flip(), startV6Node(), stopV5(), proveV5(),
warp(seconds), teardown }`; `isolated-node.ts` exports `toolchainBin`, `spawnDetached`, `jsonRpcReady`; the pinned
node claims lanes 8–10.

Non-obvious: retire twice fails on the nullifier, another sender is not in the tree (TXE `send_l1_to_l2_message`);
EIP-712 domain `("YacanaPortal", chainId, portal)`; the rate limit freezes at `flipAt`; flip detection = Registry
canonical ≠ `VITE_ROLLUP_ADDRESS`, the node's `rollupVersion`, the miner's `retired` slot, V5 block/proven-tip age,
`/build.json` `rollupVersion` ≠ the tab's, any silence → "unknown"; balance snapshot
`yacana.balance.v1.<chainId>.<rollupVersion>.<token>.<account>`; `MasterRecord` v2 `account: { index, addresses:
{[classId]: address} }`; per-send proof deadline `getTimestampForEpoch(e + proofSubmissionEpochs + 1)` over the
RPC; `VITE_APP_ROLE=old` makes the miner app one page.

Trade-offs: viem only through the injected EIP-1193 provider, no wagmi (`viem` already hoisted as
`@aztec/viem@2.38.2`); Foundry tests over thin mocks; a witness archive instead of a relayer
(`deployments/bridge-witnesses-<profile>.jsonl`).

## 2. Phases and gates (11)

P1 encodings/secrets/redeem key/vectors — `bun test packages/miner-core`, `contracts:test` vector tests,
`aztec-forge test --match-path 'test/Hashing.t.sol'`, `bun run lint`. P2 miner functions/counters/constructor/TXE —
compile, `export-layouts.ts` diff, `contracts:test` (send_ahead burns via authwit and emits the record;
claim_from_l1 via `env.send_l1_to_l2_message`; retire from the portal stops claims, another sender fails, twice
fails; `first_epoch` continuity), `artifacts:commit` diff. P3 portal/YACA/deploy script/record — `aztec-forge
test` (register write-once, per-leaf forward continuing past failures, cap frozen at `flipAt`, pause 30/60 d and
deadline extension, deposit `expectedVersion`/`deadline`, redeem signature and 30 d, mocked
`Outbox__AlreadyNullified`), `bun test packages/deploy`, `e2e:agent -- bun packages/deploy/scripts/l1-deploy.ts
--anvil`. P4 the flip alone — asserts `numberOfVersions()==2`, `getVersion(1)==V6`, canonical == V6; the V6 node
boots pinned and publishes a checkpoint; V5 still proposes and proves. P5 integration suite + operator script.
P6 session and bridge modules — `bun test packages/web-miner` (journal, gap scan, record migration by class id,
flip-signal reducer, snapshot key, fee payer). P7 guided path/RPC tile/old-origin mode — `test:components`,
typecheck, `test:replay`. P8 bridge E2E shard — `E2E_SHARD=bridge` real proving, proverless for state specs,
inventory updated. P9 `/stats/bridge`, landing line, FAQ. P10 versioned origin — `site:build` both roles,
`site:e2e` both roles. P11 docs, threat model, runbook, rehearsal — Sepolia deploy verified; the testnet miner
redeployed; one K1 minted, one K3 claimed, one K2 held with its witness archived; `v5.yacana.network` live; the
runbook executed once by the harness. CI: `portal.yml`, `contracts.yml` filter += `packages/portal/**`, `e2e.yml`
+= the `bridge` shard and a `harness` job.

## 3. The harness

`startIsolatedNode({ env: { AZTEC_GOVERNANCE_VOTING_DURATION: '60' } })`; `deployRollupForUpgrade` with V5's config
from `getL1Config`, `manaTarget + 1`, `realVerifier: false`, committee 0; the payload through `deployL1Contract`;
V6's FeeJuicePortal funded through `FeeAssetHandlerContract`; own deposit + `proposeWithLock` (the shipped helper
locks 1e22, under the local 1e24), then the shipped `executeGovernanceProposal`; the V6 node with
`USE_AUTOMINE_SEQUENCER=1 AUTOMINE_ENABLE_PROVE_EPOCH=1`, fresh data dirs, registry ports. One clock owner: "V5
keeps proving after the flip" is the window between `flip()` and `stopV5()`; "V5 stops" is `stopV5()` before the
epoch proves then a warp past the proof window, asserted on L1 (`getRoots(epoch)` zero, forward reverts
`Outbox__NothingToConsumeAtEpoch`, `canPruneAtTime(now)`). Cases H0–H10 with a proving classification (real proving
for the V6 claim and one send_ahead→claim chain; simulation elsewhere; Foundry for limit/pause/deadline). Every case
forwards through `bridge-forward.ts` as a module so the runbook's commands are the tested ones.

## 4–6. Security, assumptions, delivery

Security as the main plan plus: a wrong first `register` mints up to the version's cap (disclosed); K6 binds the
recipient by signature; the Sepolia deployer key is `YACANA_L1_PRIVATE_KEY`, env only. Facts read: both contexts'
messaging APIs, `emit_event_in_public` + `getPublicLogsByTags`, TXE `send_l1_to_l2_message`, the authwit shape,
Registry getters, Outbox/Inbox checks, `Hash.sol`, `proposeWithLock/vote/execute`, the local governance config, the
shipped upgrade/cheat-code helpers, `--registry-address`/`--rollup-version`, `--local-network` ignoring them, the V6
node's genesis-root check, version = keccak(config, genesis), `aztec-forge` in the toolchain, viem hoisted.
Inferences **[unverified]**: the `--node` path reproduces the funded genesis set from `TEST_ACCOUNTS`/`SPONSORED_FPC`
(P4's first time-boxed spike; fallback `getGenesisValues`); V5 keeps proposing after the flip; the voting-duration
env reaches forge; the sponsored FPC exists on V6 at genesis; WebAuthn accepts the apex RP ID on the subdomain; a
public Sepolia RPC with browser CORS exists. Asks: the Safe's signers/threshold; the cap constants and the
180/30/60-day bounds; the frozen record's name; the default Sepolia RPC. Delivery: arcs confirmed; the operator
script into arc 2, the deploy-script/record changes into arc 1; before the rehearsal arcs 1–3 merged, the Safe
created, YACA + portal deployed and verified, the frozen record and the `v5` Worker deployed, the runbook drafted.
