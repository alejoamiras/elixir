# main plan (draft 1, before consolidation) — yacana-bridge

The main planner's independent draft of §3 (Architecture & Implementation), §5 (Assumptions) and §6 (Phases) for
`plan.md`, written against `recon.md` and `research/`. The codex and fable drafts live beside it; the consolidated
plan replaces the corresponding sections of `plan.md`.

## 3. Architecture & Implementation

### 3.1 Components and boundaries

**L2, per version — `packages/contracts/yacana_miner` (the miner carries the bridge).** The token's only minter is
the immutable miner, so `claim_from_l1` (minting) and `retire` (which gates `claim`) must live there; putting the
burn side elsewhere would give the portal two registered addresses per version to trust. One contract, one address
per version, one registration on the portal. New:

- storage: `portal: PublicImmutable<EthAddress>` (constructor arg), `retired: PublicMutable<bool>`,
  `exits_count: PublicMutable<u64>`, `exited_total: PublicMutable<u128>`, `claimed_from_l1_total:
  PublicMutable<u128>`; the constructor gains `portal`, `epoch_offset: u64` (0 on a first deployment; V5's last
  epoch + 1 on a continuation), and the continuation rule: with `epoch_offset > 0` the lottery is bypassed and
  `launch()` opens epoch `epoch_offset` with the constructor's target and seed after `launch_at` (the seed is
  `H(DOM_SEED, V5's closing seed)`, derivable by anyone from V5's public storage).
- `send_ahead(amount: u128, secret_hash: Field, redeem_key: Field, authwit_nonce: Field)` — private: builds the K2
  content, `message_portal(portal, content)`, `Token::burn_private(msg_sender, amount, authwit_nonce)`, enqueues
  `_record_exit(2, amount, secret_hash)`.
- `exit_to_l1(recipient: EthAddress, amount: u128, tag: Field, authwit_nonce: Field)` — private: K1 content,
  message, burn, `_record_exit(1, amount, tag)`.
- `claim_from_l1(amount: u128, secret: Field, recipient: AztecAddress, message_leaf_index: Field)` — private:
  `consume_l1_to_l2_message(K4 content, [secret], portal, leaf)`, `Token::mint_to_private(recipient, amount)`,
  enqueues `_record_inbound(amount)`. Allowed after retirement.
- `retire(message_leaf_index: Field)` — public: consumes the K5 message (`[0]` secret, the portal as sender), sets
  `retired`; `claim` asserts `!retired`. `roll()` stays allowed (harmless).
- `_record_exit` / `_record_inbound` — public, `only_self`: bump the counters and emit a public log
  `ExitRecorded { kind, amount, aux, exits_count }` (the relayer's and the app's preimage source).
- The content hashes in a new library crate `packages/contracts/yacana_bridge_hashes` (Noir), mirrored in Solidity
  and TS (§3.2). The retarget/ticket/claim circuits are untouched; new functions are their own circuits.

**L1, once — `packages/portal` (Foundry, `aztec-forge` 1.4.1 from the toolchain).** `YACA.sol` (OpenZeppelin ERC20,
`mint`/`burnFrom` restricted to the portal, 18 decimals, name/symbol from the profile), `YacanaPortal.sol`,
`YacanaHashes.sol` (the content encodings), `interfaces/` vendored from the 5.2.0 `l1-artifacts` bundle (IRegistry,
IHaveVersion, IRollup subset, IInbox, IOutbox, DataStructures, Hash, the Outbox/Inbox errors) with the source commit
recorded in `interfaces/VENDORED.md`, `test/` (unit tests with minimal mocks of Registry/Rollup/Inbox/Outbox;
the hash vectors; fuzzed accounting), `script/Deploy.s.sol`. Layout under `packages/portal/{foundry.toml, src,
test, script, lib}`; `bun run portal:build|test` wrap `toolchainBin('aztec-forge')`.

Portal storage: `IRegistry immutable registry`, `YACA immutable yaca`, `address operators` (the Safe), a global
`pausedUntil`, and per version `VersionInfo { bytes32 miner; uint64 registryIndex; uint64 launchAt; uint64 flipAt;
uint64 pausedUntil; uint64 pausedDays; uint128 exited; uint128 inbound; uint128 perHour; uint128 allowance; }`.
Functions: `registerVersion(version, miner, launchAt, perHour, allowance)` (operators; write-once; requires
`registry.getRollup(version)` and records the version's index in the Registry's history by scanning `getVersion(i)`
from the last known index), `forward(version, ForwardArgs)` (permissionless; consumes the Outbox leaf with the
version's own boxes; kind 1 → `yaca.mint(recipient, amount)`; kind 2 → requires the successor (index + 1) canonical
and registered → `Inbox(successor).sendL2Message(L2Actor(successorMiner, successorVersion), K4 content,
secretHash)`), `deposit(amount, secretHash, expectedVersion, deadline)` (burnFrom, send into `expectedVersion`'s
Inbox only if it is canonical), `retire(version)` (anyone; requires canonical ≠ that rollup; records `flipAt` once;
sends K5 into that version's Inbox with the miner as recipient), `redeem(version, ForwardArgs, recipient,
signature)` (a kind-2 leaf unforwarded 30 days after `flipAt`; `ecrecover` over `keccak(portal, chainid, version,
leafId, recipient)` must equal the `redeem_key` address committed in the content; mints YACA), `pause(version,
days)` / `pauseAll(days)` / `unpause` (operators; ≤ 30 days per call, `pausedDays` ≤ 60 per version; paused days
extend the deadline), views for stats (`versionInfo`, `headroom(version)`, `deadline(version)`). Events:
`VersionRegistered`, `Forwarded(version, leafId, kind, amount, aux)`, `Deposited(version, amount, secretHash,
inboxIndex)`, `Retired(version, flipAt)`, `Redeemed`, `Paused`, `Unpaused`.

Rate limit: `cap(t) = allowance + perHour × hours(min(t, flipAt ?: t) − launchAt)`; `forward` requires `exited −
inbound + amount ≤ cap(now)`, else reverts `WaitsForHeadroom` (the leaf stays consumable later). Exit deadline:
`forward` and `redeem` require `now ≤ max(flipAt[index + 2], flipAt + 180 d) + pausedDays × 1 d` when `flipAt != 0`.

**The harness — `packages/harness` (Bun, `bun:test`, no browser).** `src/network.ts` wraps
`scripts/run/isolated-node.ts` programmatically (boot with `AZTEC_GOVERNANCE_VOTING_DURATION=60`, registry ports,
owned process groups), `src/upgrade.ts` (deploy V6 via `deployRollupForUpgrade` with the local config and
`manaTarget + 1`, fund its FeeJuicePortal, deploy the payload, deposit/propose/warp/vote/warp/execute through viem
and the shipped cheat codes, verify), `src/nodes.ts` (stop the V5 node; start `aztec start --node --sequencer
--registry-address … --rollup-version … --node-debug` with `USE_AUTOMINE_SEQUENCER=1
AUTOMINE_ENABLE_PROVE_EPOCH=1`, the same genesis env, fresh data dirs, registry ports), `src/clock.ts` (warp, mine,
`aztecDebug_prove`, "nudge" txs), `src/yacana.ts` (deploy Yacana on a version through `packages/deploy`, mine one
real claim on the easy target, send ahead / exit / deposit / forward / retire / redeem through the same functions the
operator script uses), `src/cases/*.test.ts` (one file per case, `describe.skipIf(!process.env.YACANA_HARNESS)`).
The harness owns the whole network lifecycle (it cannot run under `e2e:agent`, which boots one node it does not
control); `bun run harness -- <case|all>` is the entry, `bun run harness -- flip` the cheap PR-gate case.

**The operator script — `packages/deploy/src/bridge/`** (`portal.ts`: deploy YACA + portal; `register.ts`;
`retire.ts`; `forward.ts` (scan a version's exit logs, fetch witnesses, forward, archive witnesses to
`deployments/witnesses/<version>/`); `pause.ts`; `status.ts`), exposed as `bun run bridge -- <cmd>` and called by
the harness and the runbook alike, so the runbook is executed by CI.

**The apps.** `packages/site/src/browser/eth-rpc.ts` (the RPC setting: parse, probe `eth_chainId` + the portal's
code, save; a second admitted slot in `node-guard.ts` with its own health), `packages/miner-core/src/bridge/`
(`hashes.ts`, `secrets.ts`, `journal.ts` (types, states, the state machine as a pure reducer), `scan.ts` (viem
`getLogs` over the portal + `ExitRecorded` public logs, matched locally against derived tags/secret hashes with a
gap limit), `deadline.ts` (per-epoch proof deadline from the rollup's constants)), `packages/web-miner/src/bridge/`
(`store.ts` — journal + witnesses in IndexedDB `yacana-bridge` keyed by chainId·portal·account; `flows.ts` —
sendAhead / exitToL1 / deposit / land / selfForward through the session, with the pause reason `'bridge'`;
`upgrade.ts` — the migration state from the profile's `migration` block + the Registry read + the node's rollup
version + the miner's `retired` flag + V5's block/proof age, "unknown" on silence; `snapshot.ts` — the last-seen
balance per chainId·rollupVersion·account written on every balance read; `wagmi.ts` — `@wagmi/core` with the
injected connector, chain from the profile), features `MigrationCard`, `ArrivalCard`, `SendAheadSheet`,
`ToEthereumSheet` (the Send sheet gains the destination row), `DepositSheet`, `BridgeTile`, `TakingLongDialog`,
`EthRpcTile`, `OldTabNotice`; `keys/store.ts` keys the stored address by account class id; `routes/Retired.tsx` +
`hostKind === 'versioned'` (from `VITE_VERSIONED_HOST`) renders the single-purpose page. `web-stats`: route
`bridge`, `features/Bridge*.tsx`, `chain.ts` gains the L1 reads. `web-landing`: the announcement `Alert` and a
second Vite entry `faq/index.html` sharing `copy.ts` (no router needed; `assemble.ts` copies it to `/faq/`).
`packages/site`: `assemble.ts` gains `--profile` and `--out`; `v5/wrangler.jsonc` (Worker `yacana-v5`, custom
domain `v5.yacana.network`, assets `dist-v5`); `deployments/<profile>.json` gains `bridge: { chainId, portal, yaca,
operators, l1Explorer }` and `migration: { toVersion, announcedAt, expectedFlipAt, oldOrigin } | null`.

### 3.2 Key interfaces

Content encodings (Noir `yacana_bridge_hashes`, Solidity `YacanaHashes`, TS `miner-core/src/bridge/hashes.ts`;
selector = first 4 bytes of keccak of the string; words big-endian 32 bytes; `sha256_to_field`):
- K1 `exit_to_l1(address,uint256,bytes32)` ‖ recipient ‖ amount ‖ tag
- K2 `send_ahead(uint256,bytes32,address)` ‖ amount ‖ secretHash ‖ redeemKey
- K4 `claim_from_l1(uint256,bytes32)` ‖ amount ‖ secretHash — the forwarded/deposited inbound content
- K5 `retire(uint256)` ‖ version — sent with `secretHash = compute_secret_hash([0])`
Secrets (`miner-core/src/bridge/secrets.ts`, HKDF over the wallet master like `keys/derive.ts`): `exitSecret_i =
HKDF(master, "yacana.exit.v1:" + version + ":" + i)`, `tag_i = poseidon2(DOM_EXIT, exitSecret_i)` (K1),
`secretHash_i = computeSecretHash(exitSecret_i)` (K2/K3), `redeemKey = HKDF(master, "yacana.redeem.v1")` as a
secp256k1 key (viem `privateKeyToAccount`), address committed in K2. Gap limit 20 per version.
Exit log: `ExitRecorded { kind: u8, amount: u128, aux: Field (tag | secretHash), index: u64 }`.
Journal (`journal.ts`): `Crossing { id, kind: 'exit' | 'ahead' | 'deposit' | 'land', version, amount, aux,
txHash?, epoch?, deadline?, witness?, l1Tx?, state, updatedAt }` with states exactly the state table's; a pure
`advance(crossing, facts)` reducer; facts come from the node, the RPC, and the local store.
Harness API: `startNetwork({ votingDuration })`, `deployYacana(node, profile)`, `upgrade(net) → { v6Rollup,
v6Version, flipAt }`, `postFlipWindow(net, { builds })`, `stopV5(net)`, `startV6Node(net) → node`, `clock.warp`,
`clock.prove`, `bridge.forward|retire|redeem|pause`.

### 3.3 Data and control flow (the critical path)

Send ahead: sheet → `flows.sendAhead(amount)` → derive `i`, secret, tag → authwit for `burn_private` (caller = the
miner) → `miner.send_ahead(...).send({ authWitnesses })` (mining paused `'bridge'`) → journal `sent` → poll the
receipt's epoch and the proof deadline → `proven` when `getBlockNumber('proven') ≥ block` → the Outbox witness
(`getL2ToL1MembershipWitness`, retried) stored in the journal → `held` (K2) / `ready` (K1). Forward (operator or
self): `forward(version, args)` on the portal → `Forwarded` event → the journal reads it → `forwarded`. On V6 at
sign-in: `scan` finds `Deposited`/`Forwarded` with matching secret hashes → `waitForL1ToL2MessageReady(node,
msgHash, 'proven')` → `claim_from_l1` (if the switch allowed it) → `landed`. Flip detection: every poll reads
`registry.getCanonicalRollup()` (RPC), `node.getNodeInfo().rollupVersion`, `miner.retired`, V5's pending/proven
checkpoint ages; the state is the conjunction, `unknown` when the RPC is silent.

### 3.4 File-level change map (against the reuse map)

Added: `packages/contracts/yacana_bridge_hashes/**`; `packages/portal/**`; `packages/harness/**`;
`packages/deploy/src/bridge/*`; `packages/miner-core/src/bridge/*`; `packages/web-miner/src/bridge/*`,
`features/{MigrationCard,ArrivalCard,SendAheadSheet,DepositSheet,BridgeTile,TakingLongDialog,EthRpcTile,
OldTabNotice}.tsx`, `routes/Retired.tsx`; `packages/site/src/browser/eth-rpc.ts`, `packages/site/v5/wrangler.jsonc`;
`packages/web-stats/src/features/Bridge*.tsx`, `routes/Bridge.tsx`; `packages/web-landing/faq/index.html` +
`src/faq.tsx`; `docs/bridge.md`, `docs/upgrades.md`; `.github/workflows/portal.yml`; `deployments/witnesses/`.
Modified: `yacana_miner/src/main.nr` (+ `params.nr` domains), `yacana.params.json` (`$domains` EXIT/REDEEM,
profiles gain `bridge`), `packages/deploy/src/deploy.ts` (constructor args, the portal), `scripts/run/isolated-node
.ts` (env passthrough, an exported `start()`), `node-guard.ts`, `connection.ts`, `host.ts`, `config.ts`, `site.env`,
`assemble.ts`, `headers.ts` untouched, `keys/store.ts`, `session.ts`, `chain.ts`, `controller.ts` (pause reason),
`App.tsx`, `routes.ts`, `routes/Wallet.tsx`, `SendSheet.tsx`, `Settings.tsx`, `settings.ts`, `main.tsx`
(`yacana.claims` scoping), `web-stats/src/{routes,App,chain}.ts(x)`, `web-landing/src/{App,copy}.ts(x)`,
`contracts.yml`, `e2e.yml`, `docs/{deployments,threat-model,roadmap}.md`, `README.md`, `CLAUDE.md`.

### 3.5 Non-obvious mechanics

- **Retire**: `portal.retire(N)` checks `registry.getCanonicalRollup() != registry.getRollup(N)`, records
  `flipAt[N] = block.timestamp` (first call), sends K5 with `secretHash = poseidon2([0], SECRET_HASH)`. On L2
  anyone calls `miner.retire(leaf)`; the public consume asserts the sender is the portal. `claim` reads `retired`
  in its public part (the claim's public enqueue) so the private proof is wasted but nothing mints; the app stops
  mining before that.
- **Redeem**: `redeem` recovers `ecrecover(keccak256(abi.encode(portal, chainid, version, leafId, recipient)),
  sig)` and requires it to equal the K2 content's `redeemKey`; the secret is never revealed on L1.
- **Successor**: `registryIndex` recorded at registration; successor = `registry.getVersion(index + 1)` if
  `numberOfVersions() > index + 1`; "version after next" = index + 2 for the deadline.
- **Flip detection** conjunction; the profile's `migration` block only narrates (dates, the old origin).
- **Balance snapshot**: `snapshot.ts` writes `{ balance, block, at }` under
  `yacana.last-seen.v1.<chainId>.<rollupVersion>.<account>` on every balance read; the V6 build reads the V5 key.
- **Address per class id**: `MasterRecord.account` becomes `{ address, index, classId }`; `openMaster` compares
  against the address derived for the build's class id, migrating a record whose `classId` is absent by re-deriving.
- **The versioned origin**: `hostKind` gains `versioned` (host === `VITE_VERSIONED_HOST`); keys: restore allowed,
  creation refused; the app renders `Retired` and reads the build's (old) deployment.

### 3.6 Trade-offs and alternatives not taken

- Bridge on the miner vs a separate exit contract: one address, one trust; the miner grows three circuits.
- A Foundry package vs Solidity compiled by Vite/solc: Foundry is the ecosystem's tool, `aztec-forge` ships already.
- The harness as its own package vs cases inside `packages/deploy/tests`: the harness owns processes (two nodes) and
  clocks; a package with one entry keeps `e2e:agent` untouched.
- FAQ as a landing entry vs a fourth app: an entry shares copy and build; a fourth app would add a package for one
  static page.
- viem: the upstream `viem@2.38.2` for wagmi (the fork `@aztec/viem` stays transitive); if the two disagree on
  types, the app's own client uses `@aztec/viem` directly and wagmi is dropped for a hand-rolled injected connector.

## 5. Assumptions (draft)

Facts: see `plan.md` §5 plus every path in `research/*.md`. Inferences: TXE can assert an emitted L2→L1 message and
inject an L1→L2 message for `claim_from_l1`/`retire` tests (`TestEnvironment` in 5.2.0 — verify; else those two
functions are tested only in the harness); the PXE still proves client transactions on the local network
(`realProofs: false` affects the node's verification only); the automine V5 node keeps proving after the flip
until stopped; `RollupCheatCodes`/`upgrade_utils` may not ship in the installed package (call Governance via viem
directly); wagmi and `@aztec/viem` coexist; the Registry index scan is cheap (single-digit versions). Asks: the V6
continuation without a lottery; the FAQ as a landing entry; the flip-only harness in the PR gate (≈ 5 min) with the
full suite on dispatch; the 24 h deposit close; the exit-deadline and pause bounds as drawn.

## 6. Phases (draft)

P1 bridge primitives (miner-core hashes/secrets/journal reducer + the Noir hash crate + vectors) — gate: `bun run
lint && bun test packages/miner-core && bun run contracts:compile`.
P2 the miner's bridge functions + continuation constructor + counters/log; TXE tests; artifacts — gate:
`bun run contracts:compile && bun run contracts:test && bun run artifacts:commit && git diff --exit-code && bun run
spike:gates`.
P3 the portal (Foundry) + `packages/deploy/src/bridge` — gate: `bun run portal:test` (forge, vectors, fuzz) and
`bun test packages/deploy` (`describe.skipIf(!L1_RPC_URL)` against anvil via `e2e:agent`).
— arc 1 —
P4 the flip harness (no Yacana): boot, V6, governance, verify, V6 node produces and proves — gate: `bun run
harness -- flip` green locally and as a `contracts.yml` job.
P5 the migration cases on the harness (with one real-proving mined balance per network) — gate: `bun run
harness -- all` green locally; `e2e.yml` job on dispatch.
— arc 2 —
P6 the site layer + bridge core in the miner (RPC setting, guard slot, journal store, scan, flows, snapshot, class-id
address, flip detection) — gate: `bun run lint && bun test packages/miner-core packages/web-miner && bun run
test:components`.
P7 the guided path UI + everyday sheets + settings + the browser migration e2e on the harness — gate:
`bun run test:components && bun run harness -- browser` (Playwright: sign in on V5, send ahead, flip, sign in on
V6, land) plus the existing shards still green under `e2e:agent`.
P8 the versioned origin + the operator script's runbook wiring + the retired build — gate: `bun run site:build`,
`bun run harness -- origin`, `bun run e2e:agent -- bun run site:e2e`.
— arc 3 —
P9 stats `/stats/bridge`, the announcement lines, the landing FAQ entry — gate: `bun run test:components && bun run
--cwd packages/web-stats test:visual && bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e`.
P10 docs + CI + records + threat-model rows — gate: `bun run lint:actions && bun run lint`, docs reviewed against
the harness's exact commands (the runbook's commands are the harness's).
P11 the testnet rehearsal: YACA + portal on Sepolia, the testnet profile redeployed with the bridge, one real exit
minted on Sepolia and one deposit back, the record updated — gate: Etherscan + aztecscan links in
`docs/deployments.md`, `bun run epoch:stats` on the new profile.
— arc 4 — then the cross-arc pass and Delivery.
