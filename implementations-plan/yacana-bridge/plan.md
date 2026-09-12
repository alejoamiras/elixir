---
plan: yacana-bridge
tier: mega-deep
driver: claude-code
eli5_mode: artifact
code_review: off
budget: "recon 4 agents (1 reuse sweep, 3 subsystem mappers); codex at high (GPT-6 Astra); fable legs on Fable 5.1"
status: consolidated, awaiting contradiction check
created: 2026-09-12
---

# yacana-bridge — the Ethereum bridge, the cross-rollup migration, the upgrade harness, the runbook

Design inputs (read first): `design-spec.md` (the mechanism, drafts 2 + 3 deltas), `ux-brief.md` (the guided path),
the design canvases "Yacana Bridge Take Two" (the UI spec, every screen and state) and "Yacana Bridge and Migration"
(take one, the checkpoint). `recon.md` and `research/` hold what the codebase and the Aztec 5.2.0 sources offer.
The three independent drafts are `plans/{main,codex,fable}.md`; this plan consolidates them (§8 says which decision
came from where).

## 1. Goal

Aztec's Alpha rollups do not carry state to the next version. Yacana survives an upgrade because every holder can move
their balance through Ethereum, one holder at a time, while the miner's schedule continues on the new version. This
plan ships, mainnet-launch grade and rehearsed on testnet:

1. **Contracts.** The miner gains `send_ahead` and `exit_to_l1` (a private burn via authwit plus an L2→L1 message plus
   a public record of the exit's public fields), `claim_from_l1` (private, allowed after retirement), `retire`
   (consumes the portal's retire message; `claim` refuses afterwards), and a constructor that continues the previous
   version's schedule. The token is unchanged.
2. **Ethereum.** `YACA` (an ERC-20 whose only minter and burner is the portal) and `YacanaPortal` as a Foundry project.
3. **The harness.** A programmatic governance rollup upgrade on the isolated local network, and an integration suite
   that proves every migration case.
4. **The apps.** The web miner's guided path exactly as drawn; the everyday To Ethereum / Deposit from Ethereum;
   `/stats/bridge`; the FAQ; the announcement line; the Ethereum RPC setting; the versioned old-app origin.
5. **The docs.** `docs/bridge.md` (the design) and `docs/upgrades.md` (the operator runbook for the day Aztec
   announces the next version, written for a session that will not have this context).

**Done means**: every phase's gate green; the harness proves the flip and the migration cases on the local network in
CI; YACA and the portal live on Sepolia; the testnet profile redeployed with the bridge and one exit to Ethereum, one
deposit back and one send-ahead held with its witness archived — all verified on the explorers; the runbook followed
once by the harness. A send-ahead landing on a new testnet version is recorded as *pending validation* until Aztec
upgrades the testnet: a same-rollup redeploy cannot simulate a Registry migration (C, F).

**Not in this plan** (documented follow-ups): the relayer bot (forwarding stays permissionless: the operator script and
the in-app self-forward; the owner runs the script by hand), the mainnet fee path for claims (a fee-payer function
ships; the sponsored FPC stays on testnet), Sepolia-only harness runs, fixed denominations for exits.

## 2. The mechanism (summary; `design-spec.md` is authoritative, amended by §8's decisions)

- **Kinds**: K1 to-Ethereum (mint YACA to an address), K2 send-ahead (held on Ethereum, forwarded into the canonical
  version's registered miner), K3 deposit (burn YACA on Ethereum, mint privately on Aztec), K4 the inbound claim,
  K5 retire (the portal → the old miner: mining ends), K6 redeem (a K2 unforwarded 30 days after the flip becomes
  YACA on Ethereum, authorised by a seed-derived redeem key's signature).
- **Portal rules**: sender/version checks per version's own boxes; `flipAt` authenticated against the GSE's history;
  the exit deadline `max(flipAt[successor] (= the activation of the version after next, ∞ until seen),
  flipAt[N] + 180 d) + pausedDays`; the rate limit `exited − inbound + amount ≤ cap(now)` with `cap` growing at the
  schedule's rate for the life of the version (never frozen, never a refusal, a leaf that waits stays consumable);
  pause ≤ 30 d per call, ≤ 60 d per version, paused days extend the deadline.
- **Safety**: a send is safe once its epoch is proven (each epoch has a proof deadline the UI shows); a missed deadline
  prunes the epoch and the burn is undone onto V5; V5 keeps proving after the flip only while its validators stay,
  without a lifetime signal; balances left on a stopped chain are lost.
- **The path**: one card, one button (Send ahead), one switch (hourly sends of new wins until the upgrade; the landing
  claim on V6 at sign-in); the card is the status; the flip card names the bet and shows V5's block and proof age;
  the old origin is one page; exceptions are one line and one link. Without a relayer the copy says "Yacana forwards
  exits by hand a few times a day; forward it yourself any time" (§8 D22).

## 3. Architecture & Implementation

### 3.1 Components and boundaries

**L2, per version — the miner carries the bridge (`packages/contracts/yacana_miner`).** The token's only minter is
the immutable miner, so `claim_from_l1` (minting) and `retire` (gating `claim`) must live there; a separate exit
contract would give the portal a second registered sender per version, split counters and a second deployment check
for nothing the portal cannot already do (M, C, F unanimous). New, in `src/bridge.nr` + `src/main.nr`:

- storage (fixed slots, exported by `export-layouts.ts`): `portal: PublicImmutable<EthAddress>`, `first_epoch:
  PublicImmutable<u64>`, `retired: PublicMutable<bool>`, `exits_count: PublicMutable<u64>`, `exited_total:
  PublicMutable<u128>`, `claimed_from_l1_total: PublicMutable<u128>`.
- constructor `(initial_target, genesis_seed, launch_at, first_epoch: u64, portal: EthAddress)`: `open_epoch` starts
  at `first_epoch`; when `first_epoch > 0` (a continuation) the lottery is bypassed and `launch()` opens
  `first_epoch` with the constructor's target and seed at `launch_at`; the continuation seed is
  `H(DOM_SEED, seed of V5's last epoch)`, derivable by anyone from V5's public storage; the deployment record
  names the source deployment, its last epoch, target and seed (C). No balance or supply is carried.
- `send_ahead(amount: u128, secret_hash: Field, redeem_key: EthAddress, authwit_nonce: Field)` — private: K2 content,
  `message_portal(portal, content)`, `Token::burn_private(msg_sender, amount, authwit_nonce)`, enqueue
  `record_exit(2, amount, secret_hash, redeem_key)`.
- `exit_to_l1(amount: u128, recipient: EthAddress, tag: Field, authwit_nonce: Field)` — private: K1, message, burn,
  `record_exit(1, amount, tag, recipient)`.
- `claim_from_l1(amount: u128, secret: Field, recipient: AztecAddress, message_leaf_index: Field)` — private:
  `consume_l1_to_l2_message(K4, [secret], portal, leaf)`, `mint_to_private(recipient, amount)`, enqueue
  `record_inbound(amount)`. Allowed after retirement.
- `retire(message_leaf_index: Field)` — public: the public overload with `[0]`, sender = `portal`, sets `retired`.
  `claim` reads `retired` from the anchor header in private (fast feedback, like `open_epoch`) and `record_claim`
  re-checks it in public, where ordering is authoritative (C, F).
- `record_exit` / `record_inbound` — `#[only_self]` public: bump the counters and emit the public event
  `ExitRecorded { index: u64, kind: u8, amount: u128, hash_or_tag: Field, recipient_or_redeem_key: Field }`
  (`emit_event_in_public`), read with `node.getPublicLogsByTags` — every field a forwarder needs, never a secret (F).
- The content hashes in a library crate `packages/contracts/yacana_bridge_hashes` mirrored in Solidity and TS (§3.2).
  `yacana.params.json` gains `$domains` `EXIT` and `REDEEM`; the retarget/ticket/claim circuits are untouched.

**L1, once — `packages/portal` (Foundry; `aztec-forge` 1.4.1 from the toolchain).** `src/YACA.sol` (OpenZeppelin
ERC20; `mint`/`burnFrom` portal-only; the portal deploys it in its constructor, no circular init — C),
`src/YacanaPortal.sol`, `src/YacanaHashes.sol`, `src/aztec/` (tag-pinned copies of `IRegistry`, `IHaveVersion`, the
`IRollup` subset, `IInbox`, `IOutbox`, `DataStructures`, `Hash`, `Epoch`, the Outbox/Inbox errors; source commit in
`src/aztec/VENDORED.md`), `script/Deploy.s.sol`, `test/` (thin mocks of Registry/Rollup/Inbox/Outbox/GSE, the hash
vectors, fuzzed accounting, invariants), committed `abi/` (CI diffs after build), `lib/` OZ + forge-std as
commit-pinned submodules at the Aztec lockfile revision. `bun run portal:build|test` wrap `toolchainBin('aztec-forge')`.

Portal storage: `IRegistry immutable registry`, `IGSE immutable gse`, `YACA immutable yaca`, `address operators`
(the Safe), `uint64 globalPausedUntil`, per version `VersionInfo { bytes32 miner; uint64 registryIndex; uint64
launchAt; uint64 flipAt; uint64 pausedUntil; uint64 pausedDays; uint128 exited; uint128 inbound; uint128 perHour;
uint128 allowance; }`. Functions:
- `registerVersion(version, miner, launchAt, perHour, allowance)` — operators, write-once, requires
  `registry.getRollup(version)`; records the version's index by scanning `getVersion(i)` from the last known index.
- `forward(version, ForwardArgs)` / `forwardMany` — permissionless, per leaf, a batch continues past a failed leaf;
  consumes the Outbox leaf on that version's own Outbox (the message rebuilt with that version's number and the
  portal as recipient); kind 1 → `yaca.mint(recipient, amount)`; kind 2 → requires the canonical version to be
  registered with an index > this one → `Inbox(canonical).sendL2Message(L2Actor(minerOf[canonical], canonical),
  K4, secretHash)`; emits `Forwarded(version, leafId, kind, amount, aux, target, inboxIndex)`.
- `deposit(amount, secretHash, expectedVersion, deadline)` — `burnFrom(msg.sender)`; reverts unless
  `expectedVersion` is canonical and registered and `now ≤ deadline`; emits `Deposited`.
- `retire(version, flipTs)` — anyone: requires `gse.getLatestRollupAt(flipTs − 1) == registry.getRollup(version)` and
  `gse.getLatestRollupAt(flipTs) != …` (the GSE keeps a timestamp-keyed trace of rollups; the caller finds `flipTs`
  by bisection off-chain); records `flipAt = flipTs` once; sends K5 into that version's Inbox with the miner as
  recipient and `secretHash = compute_secret_hash([0])`; emits `Retired`.
- `redeem(version, ForwardArgs, recipient, expiry, sig)` — a kind-2 leaf, `now ≥ flipAt + 30 d`; EIP-712 (domain
  `YacanaPortal`/chainId/portal) over `(version, leafId, recipient, expiry)`; `ECDSA.recover` must equal the K2's
  `redeemKey`; consumes the leaf (competing with forward for the same nullifier) and mints; no secret revealed.
- `pause(version, days)` / `pauseAll(days)` / `unpause` — operators; a call ≤ 30 d; the union of global and local
  intervals counts toward `pausedDays ≤ 60` per version (lazy accounting); paused days extend the deadline.
- views: `versionInfo`, `headroom(version)`, `deadline(version)`, `successorOf(version)`.

Rate limit: `cap(t) = allowance + perHour × hours(t − launchAt)`, growing for the life of the version; `forward`
requires `exited − inbound + amount ≤ cap(now)` (checked arithmetic, `inbound` = K2 arrivals + K3 deposits into
that version, `exited` counts K1/K2/K6 once), else reverts `WaitsForHeadroom` and the leaf stays consumable. The
deadline: `forward` and `redeem` require `now ≤ max(flipAt[successor] or ∞, flipAt + 180 d) + pausedDays × 1 d`
once `flipAt` is set.

**The rig — `scripts/run/upgrade-rig.ts` + `packages/harness`.** The rig owns the whole network lifecycle (it is not
nested in `e2e:agent`): `startUpgradeRig({ votingDuration: 60 })` boots the isolated network through the exported
`startIsolatedNode` with `AZTEC_GOVERNANCE_VOTING_DURATION=60`, records the genesis inputs, addresses and config;
`deployV6()` calls `deployRollupForUpgrade` with V5's config from `getL1Config` and exactly one change
(`manaTarget + 1`), committee 0, slasher off, real verifier off, epoch 4, proof epochs 2, slot 72, inbox lag 2, and
funds the new FeeJuicePortal through `FeeAssetHandler`; `flip()` deploys the payload from the shipped ABI/bytecode,
mints and deposits ≥ 2e24 of the staking asset, `proposeWithLock`, warps to `creation + votingDelay + 1` and mines,
votes, warps past `votingDuration + executionDelay`, mines, executes, and asserts `getCanonicalRollup`,
`numberOfVersions`, `gse.getLatestRollup`, distinct versions and boxes; `pauseV5()` quiesces through the admin
`pauseSequencer` before any clock change; `postFlipWindow()` keeps V5 building and auto-proving; `stopV5()`;
`startV6Node()` runs `aztec start --node --sequencer --registry-address … --rollup-version … --node-debug` with
`USE_AUTOMINE_SEQUENCER=1 AUTOMINE_ENABLE_PROVE_EPOCH=1`, the same `TEST_ACCOUNTS`/`SPONSORED_FPC`/`PREFUND_ADDRESSES`
as V5's genesis, `AZTEC_MANA_TARGET=<bumped>`, fresh data dirs, registry-claimed ports (lanes 8–10); `clock.warp`,
`clock.mine`, `clock.prove` (`aztecDebug_prove`), `clock.nudge` (two cheap L2 txs); `yacana.*` deploys Yacana on a
version through `packages/deploy` and drives every bridge action through the operator script's functions, so the
runbook's commands are the tested ones. `isolated-node.ts` exports `toolchainBin`, `spawnDetached`, `jsonRpcReady`
(moved to `scripts/run/toolchain.ts`), gains a node-only stop that keeps anvil and the run dir. Cases live in
`packages/harness/tests/*.bun.test.ts` under `describe.skipIf(!process.env.YACANA_RIG)`; `bun run rig -- <case|all>`
boots the rig and runs them.

**The operator script — `packages/deploy/src/bridge/`** (`portal.ts` deploy YACA + portal; `register.ts`; `retire.ts`
(bisects the flip timestamp, calls `retire`, sends the L2 `retire`); `forward.ts` (scans a version's `ExitRecorded`
logs, fetches each witness with `getL2ToL1MembershipWitness`, archives it to
`deployments/bridge-witnesses-<profile>.jsonl`, forwards); `pause.ts`; `status.ts`), exposed as `bun run bridge --
<cmd>`; `packages/deploy/src/deploy.ts` gains the constructor args and writes `bridge: { chainId, portal, yaca,
operators, l1Explorer, l1RpcUrl }` into the record; `scripts/l1-deploy.ts` runs `script/Deploy.s.sol` through
`aztec-forge script` and records the addresses.

**The shared client — `packages/bridge` (TS, viem).** One workspace package for the browser, the operator and stats
(C): `content.ts` (the encodings), `secrets.ts` (derivation, gap scan), `portal.ts` (ABI + typed client),
`witness.ts` (leaf and witness helpers over `@aztec/stdlib/messaging`), `journal.ts` (the crossing record, its states
exactly the state table's, a pure `advance(record, facts)` reducer), `recovery.ts` (the file schema, bound to
chainId + portal), `deadline.ts` (the per-epoch proof deadline from the rollup's constants), `flip.ts` (the
flip-signal reducer). `miner-core` stays free of viem.

**The apps.** `packages/site/src/browser/eth-rpc.ts` (parse under `parseNodeUrl`'s rule, probe `eth_chainId` and
the portal's code, save `Connection.ethRpcUrl`); `node-guard.ts` gains a second persistent admitted slot
(`setEthRpcEndpoint`) with its own health; `host.ts` gains `versioned`; `config.ts` + `site.env` gain
`VITE_ETH_RPC_URL`, `VITE_L1_EXPLORER_URL`, `VITE_OLD_APP_ORIGIN`, `VITE_MIGRATION` (the profile's `migration`
block), `VITE_APP_ROLE`; `assemble.ts` gains `--profile`, `--out`, `--role`; `packages/site/v5/wrangler.jsonc` (Worker
`yacana-v5`, custom domain `v5.yacana.network`, assets `dist-v5`); `build.json` gains `role`, `rollupVersion`.
`packages/web-miner/src/bridge/` (`store.ts` — journal + witnesses in IndexedDB `yacana-bridge` keyed by
chainId·portal·account; `flows.ts` — sendAhead / exitToL1 / deposit / land / selfForward through the session with
the pause reason `'bridge'`, serialised with `track`; `scheduler.ts` — the consent-bound hourly send, running only
while unlocked, stopping on a flip or an unknown state, reconciling pending sends before retrying; `landing.ts` —
the sign-in scan and the auto-claim gated on the stored consent; `eth.ts` — the injected EIP-1193 provider through
viem (`custom(window.ethereum)`), chain switch, `deposit`, `forward`, `redeem`; `snapshot.ts` — the last-seen
balance per `yacana.balance.v1.<chainId>.<rollupVersion>.<token>.<account>` on every read); `keys/store.ts` →
`MasterRecord` v2 `account: { index, addresses: {[classId]: address} }`, `openMaster` derives with the build's
class and migrates a v1 record; `wallet.ts` extracts `feePayer.ts` (a `FeeProvider(operation)`); features
`MigrationCard`, `ArrivalCard`, `SendAheadSheet`, `ToEthereumSheet` (the Send sheet gains the destination row),
`DepositSheet`, `BridgeTile`, `TakingLongDialog`, `EthRpcTile`, `OldTabNotice`; `routes/Retired.tsx` renders the
single-purpose page when `VITE_APP_ROLE === 'old'`; `main.tsx` scopes `yacana.claims` by account and deployment.
`web-stats`: route `bridge`, a bridge beat in `beats.ts`, `features/Bridge*.tsx`, `explorer.ts` gains Etherscan,
`routes/Verify.tsx` gains YACA/portal/operators. `web-landing`: the announcement `Alert` in the shell slot,
`sections/Faq.tsx` (the six panels + the questions), `/faq` rewritten to `/` in `_redirects` with a scroll-on-load.

### 3.2 Key interfaces

Content encodings (Noir `yacana_bridge_hashes`, Solidity `YacanaHashes`, TS `packages/bridge/src/content.ts`; the
first 4 bytes of keccak of the string, then 32-byte big-endian words, then `sha256_to_field` with the leading zero
byte as `Hash.sol` does):
- K1 `exit_to_l1(address,uint256,bytes32)` ‖ recipient ‖ amount ‖ tag
- K2 `send_ahead(uint256,bytes32,address)` ‖ amount ‖ secretHash ‖ redeemKey
- K4 `claim_from_l1(uint256)` ‖ amount — the Inbox message carries `secretHash` itself (F)
- K5 `retire(uint256)` ‖ version
Vectors pinned three ways from `packages/bridge/fixtures/bridge-vectors.json` (Noir `#[test]`, `forge test`,
`bun test`).

Secrets (`packages/bridge/src/secrets.ts`, HKDF over the wallet master as `keys/derive.ts`): `exitSecret_i =
HKDF(master, "yacana.exit.v1:<chainId>:<portal>:<version>:<i>")` → `Fr`; `tag_i = poseidon2(DOM_EXIT, exitSecret_i)`
(K1); `secretHash_i = computeSecretHash(exitSecret_i)` (K2, K3); `redeemKey = HKDF(master, "yacana.redeem.v1")` as
a secp256k1 key (viem `privateKeyToAccount`), its address committed in K2; sequential `i` per version, next index =
max seen + 1, gap limit 20 for the fast scan, an extended scan and the recovery file for completeness (C).
Deduplication by full message identity, never by `secretHash`.

Journal (`packages/bridge/src/journal.ts`): `Crossing { id, kind: 'exit' | 'ahead' | 'deposit' | 'land', version,
amount, aux, txHash?, epoch?, deadline?, witness?, l1Tx?, state, updatedAt }`; states exactly the state table's;
`advance(crossing, facts)` pure; facts from the node, the RPC and the store.

Harness API: `startUpgradeRig(opts) → { v5, l1, deployV6, flip, pauseV5, postFlipWindow, stopV5, startV6Node,
clock, yacana, bridge, teardown }`.

### 3.3 Data and control flow (the critical path)

Send ahead: the sheet → `flows.sendAhead(amount)` → derive `i`, secret, tag → the authwit for `burn_private`
(caller = the miner, `wallet.createAuthWit(owner, { caller, call })`) → `miner.send_ahead(...).send({ authWitnesses
})` (mining paused `'bridge'`) → journal `sent` → the receipt's epoch and the proof deadline → `proven` when
`getBlockNumber('proven') ≥ block` and `getRoots(epoch)` is non-zero → the Outbox witness (retried) stored →
`held` (K2) / `ready` (K1). Forward (operator or self): `forward(version, args)` → `Forwarded` → `forwarded`. On V6
at sign-in: `landing.scan` matches `Forwarded`/`Deposited` events and `ExitRecorded` logs locally →
`waitForL1ToL2MessageReady(node, msgHash, { chainTip: 'proven' })` → `claim_from_l1` if the switch allowed it →
`landed`. Flip detection (`flip.ts`): Registry canonical ≠ the build's rollup (RPC), the node's `rollupVersion`, the
miner's `retired` slot, V5's block and proven-tip age, `/build.json` `rollupVersion` ≠ the tab's; the state is the
conjunction, `unknown` when a signal is silent, and unknown holds back new Ethereum-bound sends.

### 3.4 File-level change map (cross-checked against `recon.md`)

Added: `packages/contracts/yacana_bridge_hashes/**`, `packages/contracts/yacana_miner/src/bridge.nr`;
`packages/portal/**`; `packages/bridge/**`; `packages/harness/**`, `scripts/run/upgrade-rig.ts`,
`scripts/run/toolchain.ts`; `packages/deploy/src/bridge/*`, `scripts/l1-deploy.ts`; `packages/web-miner/src/bridge/*`,
`features/{MigrationCard,ArrivalCard,SendAheadSheet,DepositSheet,BridgeTile,TakingLongDialog,EthRpcTile,
OldTabNotice}.tsx`, `routes/Retired.tsx`, `e2e/bridge.e2e.ts`; `packages/site/src/browser/eth-rpc.ts`,
`packages/site/v5/wrangler.jsonc`; `packages/web-stats/src/routes/Bridge.tsx`, `features/Bridge*.tsx`;
`packages/web-landing/src/sections/Faq.tsx`; `docs/bridge.md`, `docs/upgrades.md`; `.github/workflows/portal.yml`;
`deployments/bridge-witnesses-<profile>.jsonl`.
Modified: `yacana_miner/src/main.nr` (+ `params.nr`), `yacana.params.json` (domains, `bridge` per profile,
`migration`), `scripts/params-codegen.ts`, `packages/deploy/src/deploy.ts`, `scripts/run/isolated-node.ts`,
`node-guard.ts`, `connection.ts`, `host.ts`, `config.ts`, `site.env`, `assemble.ts` (`headers.ts` untouched),
`keys/store.ts`, `keys/derive.ts`, `session.ts`, `wallet.ts` (`feePayer.ts` extracted), `chain.ts`,
`controller.ts` (`PauseReason` + `'bridge'`), `App.tsx`, `routes.ts`, `routes/Wallet.tsx`, `SendSheet.tsx`,
`Settings.tsx`, `settings.ts`, `main.tsx`, `e2e/{run,run-setup,proof-inventory,shards.json}`, `web-stats/src/{routes,
App,chain,beats,explorer}.ts(x)`, `routes/Verify.tsx`, `web-landing/src/{App,copy}.ts(x)`, `contracts.yml`,
`e2e.yml`, `web-miner.yml`, `docs/{deployments,threat-model,roadmap}.md`, `README.md`, `CLAUDE.md`.
Reuse honoured: authwits (no approval mechanism), fixed slots (no slot-table work), the node setting as the RPC
setting's template, no CSP change, no second vault, `www/` as the second-Worker precedent, `toolchainBin` extracted
rather than duplicated.

### 3.5 Non-obvious mechanics

- **Retire**: a second `retire` fails on the nullifier; a message from another sender is not in the tree (TXE:
  `send_l1_to_l2_message(…, sender = other)`); `claim` is refused in public, so a proof made after retirement is
  wasted but mints nothing; the UI stops mining first.
- **Authenticated flip time**: the GSE's `rollups` trace (`GSE.sol:193, 285, 596-597`) answers `getLatestRollupAt(ts)`;
  `retire(version, flipTs)` checks the rollup was latest at `flipTs − 1` and not at `flipTs`. A late call cannot move
  the recorded time.
- **Deadline**: `flipAt[successor]` is the activation of the version after next; unseen means open, never zero.
- **Rate limit**: grows for the version's life (post-flip mining cannot add exits because `retire` stops mints; the
  gap before consumption is minutes); the pause is the emergency stop; nothing is refused.
- **Forward target**: the canonical version if Yacana registered it and its index is greater; a skipped version
  never strands a send (C's objection resolved without K6).
- **Redeem**: EIP-712 with expiry, the K2 commits to the signer; forwarding and redemption race for one nullifier.
- **Balance snapshot**: written on every balance read; the V6 build reads the V5 rollup's key for the account's V5
  address and shows "last seen … may still be there".
- **Address per class id**: `MasterRecord` v2; `openMaster` migrates v1 records; the arrival card explains the new
  address.
- **Proof deadline**: `getTimestampForEpoch(e + proofSubmissionEpochs + 1)` on the version's Rollup over the RPC.
- **The versioned origin**: a build with `VITE_APP_ROLE=old` from the last V5 commit, served by the `yacana-v5`
  Worker; `hostKind === 'versioned'` allows key restore, refuses creation; words are retyped; the page is
  `Retired.tsx` with node, RPC, recovery file and self-forward under "advanced"; `build.json.role = 'old'`.

### 3.6 Trade-offs and alternatives not taken

- The miner carries the bridge (unanimous) over a separate exit contract.
- `packages/bridge` as the shared client (C) over bridge code inside `miner-core` (M, F): miner-core stays free of
  viem; three consumers share one implementation.
- viem through the injected provider (F) over wagmi (the owner's literal answer named wagmi; the capability — an
  in-app Ethereum wallet connection for deposits and self-forwards — is delivered with fewer dependencies and no
  fork/peer conflict; flagged at the gate).
- The rig owns its network (C, M) over cases under `e2e:agent` (F): two runners would boot two networks.
- The FAQ as a landing section with a `/faq` rewrite (F, C) over a fourth app or a second Vite entry (M).
- Foundry tests over thin mocks; the real boxes only on the isolated network (F).
- A witness archive by the operator script instead of a relayer (F).
- Authenticated `flipAt` via the GSE trace (M, verified) over an observation-time `flipAt` (F: accept the bound;
  C: name it as observation).

## 4. Security & Adversarial Considerations

**Threat model.** Attackers: a holder trying to mint YACA without burning (forged exits), a miner trying to inflate
after the flip, a front-runner on Ethereum (redemption, forwarding), the operators (the multisig) turning rogue, a
compromised or wrong web page, a lying or silent RPC or node, whoever forwards (anyone) censoring, an Aztec-level bug
(fake proofs on the old version), a corrupted recovery file, a deployment switch. Assets: YACA on Ethereum, balances on
each Aztec version, the seed.

- **Message authenticity**: every L2→L1 leaf is consumed on its version's Outbox with a Merkle path against a proven
  root and nullified by leaf id; the portal rebuilds the message with that version's number and the registered
  miner as sender; every L1→L2 message the miner consumes must come from the portal's fixed address (`retire`, K4).
  Public exit logs aid discovery; Outbox membership alone authorises issuance (C).
- **Issuance bound under a compromised old version**: the rate limit slows a drain (never refuses); the pause stops
  it; neither confiscates: paused days extend the deadline and a K2 always has K6.
- **Post-flip mining**: the retire message ends claims on chain within minutes of the flip; the UI stops mining on
  the flip signals; the deadline closes a version's exits at the later of the version after next and 180 days.
- **The operators**: write-once registration per version (cannot repoint an old version's exits), no timelock by the
  owner's choice, pause bounded; the record page discloses who they are and what a wrong first registration could do
  (mint YACA up to that version's cap). A 2-of-3 Safe; keys never in the repo or CI; the Sepolia deployer key is
  `YACANA_L1_PRIVATE_KEY`, env only, never echoed.
- **Front-running**: redemption signs `(version, leafId, recipient, expiry)`; forwarding is idempotent (a consumed
  leaf reverts); deposits carry the expected version and a deadline so a flip between review and inclusion reverts.
- **The page**: the embedded wallet already holds signing capability, so automation adds no capability; the send
  sheet's switch is the scoped consent for the hourly sends and the landing claim, visible as "claiming, as you
  allowed", pausable; the app refuses to claim on a version whose registered miner differs from its build's; the old
  origin is the same pipeline, headers, CSP and `artifact.ts` guards; key creation stays apex-only.
- **RPC and node**: reads only; the guard admits the chosen RPC origin as a second slot with its own health; silence
  renders "unknown" and holds back new Ethereum-bound sends; the page fetches event ranges and matches locally,
  never per hash; the node can waste work, never move funds.
- **Privacy**: amounts, secret hashes, redeem keys and timing are public on Ethereum and, through the token's public
  supply, on both rollups; the review says so; nothing names the account; the K1 tag is a hash.
- **Cryptography**: Aztec's `compute_secret_hash` / `sha256_to_field` for contents (three-way vectors); secrets and
  the redeem key from the wallet master with domain separation; OpenZeppelin ERC20/ECDSA/EIP712 at the Aztec
  lockfile revision; no custom cryptography.
- **Supply chain**: 7-day npm min-age, frozen lockfile, actions by SHA (unchanged); OZ and forge-std by commit;
  `aztec-forge` from the pinned toolchain; viem at the Aztec alias `npm:@aztec/viem@2.38.2`.
- **Least privilege**: CI keeps `contents: read`; the rig runs on anvil with throwaway keys; testnet deploys use the
  existing deployer secret path.
- **Input validation**: amounts through `parseAmount`; Ethereum addresses through viem `getAddress`; RPC URLs
  https-only in production; recovery files schema-validated, size-bounded and bound to chainId + portal (an imported
  file cannot choose contracts).

## 5. Assumptions

**Facts (verified; paths in `recon.md` and `research/*.md`)**
- Aztec Alpha releases do not migrate state; every version has its own Rollup/Inbox/Outbox with immutable `VERSION`;
  the Registry's `versions[]` is the canonical history, versions are keccak-derived identifiers (`Registry.sol`,
  `RollupConfiguration.sol:132-145`); `Rollup.getCurrentEpoch()` is L1-time based.
- The GSE keeps a timestamp-keyed trace of rollups; `getLatestRollupAt(ts)` is a public view (`GSE.sol:193, 285,
  596-597`; in the shipped `GSEAbi`).
- Outbox/Inbox semantics: `leafId = (1 << depth) + leafIndex`, per-epoch nullifier bitmap, `consume` checks version,
  recipient, chain id, a non-zero root; `sendL2Message` checks the version and field ranges, no fee, no allowlist;
  `Hash.sol` prepends a zero byte.
- aztec-nr 5.2.0: `message_portal` and `consume_l1_to_l2_message` in both contexts; `compute_secret_hash([Field;N])`;
  `emit_event_in_public` + `getPublicLogsByTags`; TXE `send_l1_to_l2_message` returns the leaf index; the token's
  `burn_private` is `#[authorize_once]`; `Wallet.createAuthWit(from, { caller, call })`.
- `--local-network` ignores `--registry-address`/`--rollup-version`, forces automine + auto-prove, epoch 4, proof
  epochs 2, committee 0, slasher off; `AZTEC_GOVERNANCE_VOTING_DURATION` reaches the deploy; local governance:
  delays 60 s, lock 1e24; the deployer mints the staking asset; `proposeWithLock` bypasses the GovernanceProposer;
  `vote` needs a mined block after `votingDelay`.
- The installed 5.2.0 packages export `deployRollupForUpgrade`, `getDeployRollupForUpgradeEnvVars`, the
  `RegisterNewRollupVersionPayload` ABI + bytecode, `EthCheatCodes`, `RollupCheatCodes`, `upgrade_utils`,
  `createAztecNodeDebugClient`; the node path takes `USE_AUTOMINE_SEQUENCER`, `AUTOMINE_ENABLE_PROVE_EPOCH`;
  `aztec set-proven-through` writes no Outbox root; `aztecDebug_prove` does.
- `scripts/run/isolated-node.ts` exports `startIsolatedNode`, returns `l1RpcUrl`, sets `L1_RPC_URL`; the toolchain
  ships `aztec-forge` 1.4.1, `aztec-cast`, `aztec-anvil`; the guard admits one node endpoint, accelerators and
  leased candidates; the CSP already allows any `https:`; `Session.pre` is single; `pxeNamespace` is per rollup;
  `yacana-keys` is device-wide; the account address depends on the SDK's account class, not on Yacana's deployment.

**Inferences (unverified — the audits attack these)**
- The `--node` path reproduces V5's funded genesis set from `TEST_ACCOUNTS` / `SPONSORED_FPC` / `PREFUND_ADDRESSES`
  env, so the pinned V6 node passes its genesis-root check (P4's first, time-boxed spike; fallback: compute the root
  with `getGenesisValues` for the set the node uses).
- V5's automine node keeps building and proving after the flip until stopped.
- The PXE proves client transactions on the local network (`realProofs: false` affects the node's verification).
- The sponsored FPC instance exists on V6 at genesis (else the rig publishes it).
- A public Sepolia RPC with browser CORS exists for the default `VITE_ETH_RPC_URL`.
- WebAuthn accepts RP ID `yacana.network` from `v5.yacana.network` (the spec's rule; never exercised here).
- The next aztec.js changes the account class id (the migration of `MasterRecord` is needed then, harmless if not).

**Asks (owner; resolved at the gate)**
- A1 The V6 continuation skips the launch lottery (its seed is derived from V5's public state and announced ahead).
- A2 viem-only in-app Ethereum wallet (injected provider) instead of wagmi.
- A3 The flip-only rig case in the PR gate (`contracts.yml`, ≈ 5 min); the full suite on `workflow_dispatch`.
- A4 The cap constants: `perHour = REWARD × N_CLAIMS × 3600 / EXPECTED_EPOCH_SECONDS × 3`, `allowance = REWARD ×
  N_CLAIMS × 24`; the bounds 180 d / 30 d / 60 d as drawn; the 24 h deposit close in the UI.
- A5 The Safe's signers and threshold on Sepolia and mainnet; the default Sepolia RPC.
- A6 The FAQ as a landing section with a `/faq` rewrite (the canvas drew a standalone page with the landing's header).

## 6. Phases with validation gates

Every gate includes the fast layers for the touched packages (`bun run lint`, typecheck, unit); heavier layers appear
where they matter. A phase is ✓ only when its gate passed and this file says so.

**P1 — the protocol: encodings, secrets, redeem key, vectors** (`packages/contracts/yacana_bridge_hashes`,
`packages/bridge`, `yacana.params.json` domains, `params-codegen`). Decisions of §8 D14–D18 frozen here.
Gate: `bun run lint && bun run codegen && git diff --exit-code && bun test packages/bridge packages/miner-core &&
bun run contracts:compile && bun run contracts:test` (the Noir vector `#[test]`s pass; the TS vectors match).

**P2 — the miner's bridge functions, counters, event, continuation constructor** (`bridge.nr`, `main.nr`,
`deploy.ts`, the record). TXE: send_ahead burns via an authwit and emits `ExitRecorded`; exit_to_l1 likewise;
`claim_from_l1` via `env.send_l1_to_l2_message`; `retire` from the portal stops claims, from another sender fails,
twice fails; `claim` after retirement reverts in public; `first_epoch` continuity; the lottery bypass.
Gate: `bun run contracts:compile && bun run contracts:test && bun packages/miner-core/scripts/export-layouts.ts &&
git diff --exit-code && bun run artifacts:commit && git diff --exit-code && bun run spike:gates && bun test
packages/deploy`.

**P3 — the portal, YACA, the L1 deploy script, the record** (`packages/portal`, `packages/deploy/src/bridge/portal.ts`,
`scripts/l1-deploy.ts`, `portal.yml`). Foundry: the hash vectors; register write-once and index discovery; forward
per leaf with mocked Outbox (`AlreadyNullified` replay, wrong version, wrong recipient); kind-2 target rules
(canonical registered, index greater); deposit `expectedVersion`/`deadline`; `retire(version, flipTs)` against a
mocked GSE trace; redeem EIP-712 (valid, wrong signer, expired, before 30 d, replay); the rate limit (growth, net of
inbound, `WaitsForHeadroom`); pause 30/60 union and the deadline extension; invariants: `yaca.totalSupply == Σ minted
− Σ burned`, `exited ≥ inbound` never underflows.
Gate: `bun run portal:build && bun run portal:test && git diff --exit-code packages/portal/abi && bun run e2e:agent
-- bun packages/deploy/scripts/l1-deploy.ts --anvil` (deploys, verifies code and the record) `&& bun run lint:actions`.
— arc 1 boundary: the codex loop, then `gh stack add bridge-harness` —

**P4 — the flip alone** (`scripts/run/upgrade-rig.ts`, `packages/harness` H0, `toolchain.ts` extraction). No Yacana:
boot with a 60 s vote, V6 with `manaTarget + 1`, the payload, deposit ≥ 2e24, propose, warp + mine, vote, warp + mine,
execute; assert the Registry, the GSE, distinct versions and boxes; pause V5, stop V5, start the pinned V6 node
(the genesis spike first, time-boxed to a day; fallback per §5), V6 accepts a transaction and proves a checkpoint.
Gate: `bun run rig -- flip` green locally (≤ 10 min) and as a `contracts.yml` job.

**P5 — the migration cases and the operator script** (`packages/deploy/src/bridge/*`, `packages/harness` H1–H10).
H1 K1 round trip on V5 (replay refused) — real proving once for the mined balance, simulation on reruns; H2 K3
deposit + `claim_from_l1` (`waitForL1ToL2MessageReady`, nudge blocks); H3 the migration (send_ahead → proven →
forward refused (no registered canonical) → flip → `register(V6)` → `retire(V5, flipTs)` consumed on V5 → claim on V5
refused → forward → V5 stopped → the V6 node → the V6 miner + token from V5's last epoch → `claim_from_l1` on V6 →
one real W claim on V6 at the continued index); H4 send_ahead after the flip while V5 proves; H5 V5 stops before
proving (V5 restarted pinned with auto-prove off before the burn, stopped, a warp past the proof window with V6
running; L1-only assertions: roots zero, forward reverts `Outbox__NothingToConsumeAtEpoch`, `canPruneAtTime`);
H6 no registered successor 30 d → redeem, then a late register + forward reverts nullified; H7 V5 → V7 with V6 in
the Registry but unregistered by Yacana → forward into V7; H8 Ethereum round trip accounting (`totalSupply`, net
allowance); H9 pause / limit / deadline boundaries on the live portal; H10 an unregistered L2 sender is
unconsumable. Every action through the operator script's functions; witnesses archived.
Gate: `bun run rig -- all` green locally; `e2e.yml` gains a `rig` job on `workflow_dispatch`; `bun test
packages/deploy packages/harness` (unit parts) green.
— arc 2 boundary: the codex loop, then `gh stack add bridge-miner` —

**P6 — the site layer and the bridge modules in the miner** (`eth-rpc.ts`, the guard's second slot,
`connection.ts`, `host.ts`, `config.ts`, `site.env`, `packages/web-miner/src/bridge/*`, `keys/store.ts` v2,
`feePayer.ts`, `controller.ts` pause reason, `main.tsx` scoping).
Gate: `bun run lint && bun test packages/site packages/web-miner packages/bridge && bun run test:components &&
bun run --cwd packages/web-miner typecheck && bun run --cwd packages/web-miner test:replay`.

**P7 — the guided path UI and the everyday bridge** (`MigrationCard`, `SendAheadSheet` with the switch, `ArrivalCard`
and its states, `ToEthereumSheet`, `DepositSheet`, `BridgeTile`, `TakingLongDialog`, `EthRpcTile`, `OldTabNotice`,
Settings, the copy deltas of D22). Vitest specs per feature; the browser migration e2e on the rig:
`e2e/bridge.e2e.ts` (sign in on V5, send ahead, the flip, sign in on V6, land — real proving, the proof inventory
updated) plus proverless state specs in a `bridge` shard.
Gate: `bun run test:components && bun run rig -- browser && bun run e2e:agent -- bun run --cwd packages/web-miner
test:e2e` (the existing shards untouched).

**P8 — the versioned origin** (`Retired.tsx`, `VITE_APP_ROLE=old`, `assemble.ts` role/out, `v5/wrangler.jsonc`,
`build.json.role`, `hostKind === 'versioned'`).
Gate: `bun test packages/site && bun run site:build && YACANA_APP_ROLE=old bun run site:build && bun run e2e:agent --
bun run site:e2e` (both roles: identical headers, `build.json.role`) `&& bun run rig -- origin`.
— arc 3 boundary: the codex loop, then `gh stack add bridge-stats-docs` —

**P9 — stats, the announcement lines, the FAQ** (`/stats/bridge`, the bridge beat, Etherscan links, Verify's new
chips; the landing `Alert` and `sections/Faq.tsx` + `/faq` rewrite).
Gate: `bun run test:components && bun run --cwd packages/web-stats test:visual && bun run e2e:agent -- bun run
--cwd packages/web-stats test:e2e && bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e`.

**P10 — docs, CI, records** (`docs/bridge.md`, `docs/upgrades.md` written as the rig's steps with the operator
script's exact commands, `docs/threat-model.md` rows, `docs/deployments.md`, `docs/roadmap.md`, README, CLAUDE.md,
`implementations-plan/index.md`; `contracts.yml` filter, `e2e.yml` jobs, `web-miner.yml`).
Gate: `bun run lint && bun run lint:actions && bun run lint:shell`; every command in `docs/upgrades.md` is one the
rig ran in P5 (a `docs/upgrades.md` ↔ `packages/harness` cross-check test).

**P11 — the testnet rehearsal** (Sepolia: the Safe, YACA + portal deployed and verified on Etherscan; the testnet
profile redeployed with the bridge and launched per `docs/deployments.md`; the frozen record of the previous testnet
deployment and the `yacana-v5` Worker deployed; one K1 minted on Sepolia, one K3 claimed, one K2 held with its
witness archived; the record and docs updated; the K2 landing recorded as pending validation).
Gate: the explorer links in `docs/deployments.md`; `bun run epoch:stats` on the new profile; `bun run bridge --
status` reporting the three crossings; `bun run site:deploy` + the `v5` deploy green.
— arc 4 boundary: the codex loop, the cross-arc pass, Delivery —

## 7. Delivery — arcs → stacked PRs

Four arcs, one branch each, stacked with `gh stack` (installed, v0.1.0); `code_review: off` on every arc.

| arc | branch | phases | stacks on |
|---|---|---|---|
| 1 contracts + portal + protocol + deploy script | `worktree-yacana-bridge` (init `--adopt`) | P1–P3 | main |
| 2 the rig + the migration suite + the operator script | `bridge-harness` | P4–P5 | arc 1 |
| 3 the web miner: guided path, everyday bridge, versioned origin | `bridge-miner` | P6–P8 | arc 2 |
| 4 stats, FAQ, docs, CI, the testnet rehearsal | `bridge-stats-docs` | P9–P11 | arc 3 |

Each arc is revertable alone and reviewable in one sitting. PRs are opened only in the Delivery step, after every
arc's fix loop and the final cross-arc pass converged. Before the rehearsal (P11): arcs 1–3 merged, the Safe created,
the runbook drafted so the rehearsal edits rather than writes it.

## 8. Decision ledger

Sources: owner (O), Codex round 1 on the mechanism (C1), Codex round 2 on the guided path (C2), the Fable UX critic
(FU), the Fable adversarial critic (FA), the three drafts: main (M), codex (C), fable (F).

| # | decision | source | rejected alternatives |
|---|---|---|---|
| D1 | Bridge permanent from launch; ERC-20 + private relay through Ethereum | O | migration windows only |
| D2 | Old app at `v5.yacana.network` | O | same-origin `/v5/mine`; swap at window close |
| D3 | No relayer bot in this plan; operator script + self-forward | O | homelab service; Worker cron |
| D4 | Ethereum reads from the browser via an RPC setting | O | Worker proxy |
| D5 | Plain multisig, no timelock; pause bounded | O | timelock |
| D6 | Retire message instead of an epoch cutoff | C1 | lazy cutoff |
| D7 | Successor by Registry history index | C1 | `N+1` arithmetic on ids |
| D8 | Exit deadline = later of (the version after next activates, flip + 180 d) + paused days; K6 redemption | C1, C | one hop (confiscation) |
| D9 | The rate limit never refuses, keeps growing for the version's life (no freeze) | M (resolving C's contradiction) | frozen cap (draft 3, F); a finite competitive allowance (C) |
| D10 | Deposits carry expectedVersion + deadline | C1 | plain deposit |
| D11 | Verb "Send ahead" | FU, C2 | "Commit" |
| D12 | One switch: hourly sends + landing at sign-in | FU (adapted by M) | auto-commit at the flip (C2 rejected) |
| D13 | Per-send proof deadline shown; missed → undone onto V5 | C2 | "lost" |
| D14 | The miner carries the bridge (one registered address per version) | M, C, F | a separate exit contract |
| D15 | K4 content = `claim_from_l1(uint256)` ‖ amount (the Inbox carries the secret hash) | F | `H(4, amount, secretHash)` |
| D16 | K6 by EIP-712 signature of a seed-derived redeem key, with expiry; no secret revealed | C2, C, F | a bearer secret |
| D17 | `flipAt` authenticated through the GSE's `getLatestRollupAt` trace; `retire(version, flipTs)` | M (verified) | observation time (F, C) |
| D18 | K2 forwards into the canonical version if Yacana registered it (index greater), so a skipped version never strands a send | M | strict successor (F, C: K6 + deposit) |
| D19 | `retired` checked in private for feedback and in public `record_claim` authoritatively | C, F | private only |
| D20 | `packages/bridge` as the shared TS client (browser, operator, stats) | C | bridge code inside `miner-core` (M, F) |
| D21 | viem through the injected provider; no wagmi | F | wagmi (O's literal answer; capability kept — Ask A2) |
| D22 | No-relayer copy: "Yacana forwards exits by hand a few times a day; forward it yourself any time"; "ready to forward" stays actionable | C, FU | "the relayer forwards within the hour" (the canvas) |
| D23 | The rig owns its network (`bun run rig`), cases in `packages/harness` | C, M | cases under `e2e:agent` (F) |
| D24 | H5 "never proven": V5 restarted with auto-prove off, stopped, a warp past the window, L1-only assertions | C, F | — |
| D25 | Quiesce V5 with the admin `pauseSequencer` before clock changes; prove V6 accepts a tx before deploying Yacana | C | — |
| D26 | The public event `ExitRecorded` read by `getPublicLogsByTags` | F | a storage log |
| D27 | Continuation constructor `(target, seed, launch_at, first_epoch, portal)`, lottery bypassed when `first_epoch > 0`, a versioned record | M, C | carrying supply |
| D28 | `MasterRecord` v2 `addresses: {[classId]}`; snapshot key `yacana.balance.v1.<chainId>.<rollupVersion>.<token>.<account>` | FA, F | — |
| D29 | The FAQ as a landing section + `/faq` rewrite | F, C | a fourth app; a second Vite entry (M) |
| D30 | The old app is a build with `VITE_APP_ROLE=old` served by a second Worker | F | runtime hostname role only (M) |
| D31 | Operator script in arc 2; deploy-script/record changes in arc 1; K2 landing on testnet = pending validation | C, F | — |
| D32 | Fee payer abstracted (`FeeProvider`); mainnet decides later | O | Yacana FPC now; fee juice |

Disputed / open for the contradiction check: D9 vs the spec's "frozen at flipAt" (the spec is amended by this plan);
D18 vs the spec's strict successor; D21 vs the owner's wagmi answer (Ask A2).

## 9. Audit verdicts

_Inline after each round: codex (`audit-codex.md`), fable (`audit-fable.md`)._

## 10. Post-implementation (self-contained — the implementing session executes this from here)

Loop placement: this is a **multi-arc** plan (§7). Steps 1–3 run **per arc, at each arc boundary** — after the arc's
phases go green and BEFORE `gh stack add` opens the next arc — scoped to that arc's diff while the arc is the stack
tip. After all arcs are green and looped, one **final cross-arc integration pass** runs over the net diff. Then
Delivery.

1. **`/code-review`: not run.** `code_review: off` — the codex fix loop is the review. Do not add it.
2. **Codex audit** (`/codex high`, GPT-6 Astra, `~/.claude/skills/codex/scripts/run-codex.sh <prompt> <cwd> high`):
   send the arc's diff (`git diff <arc-base>...HEAD`), this plan.md, the decision ledger (§8), the arc map ("this is
   arc N of 4; later arcs build X on it"), the adversarial/security ask ("What could go wrong? What would an
   attacker target? What are we trusting that we shouldn't? Where are the supply-chain / crypto / least-privilege
   weaknesses?"), and both rules below verbatim.
3. **Iterative fix loop**: verify codex's factual claims against the repo first (it can misread code); apply the
   accepted fixes; commit; log the round (consult + verdict) in `lessons/phase-N.md`; RESUME the same codex session
   (`resume-codex.sh <session-id> <followup> <codex-dir> high`) with the fix diff and ask for a re-review under the
   same rules. Repeat until a round yields no new material findings (rejected nitpicks are not churn). Still material
   after 3 rounds → stop and surface: a scope smell.
4. **Final cross-arc pass**: a FRESH codex session over the net diff from the plan baseline (`git diff main...HEAD`),
   asking for cross-arc issues (seams between arcs, duplication across arcs, drift from this plan), same loop.
5. **Delivery**: only now. `gh stack sync` (if main moved), `gh stack submit --auto`, then `gh pr edit` each PR with a
   proper body ending in "🤖 Generated with [Claude Code](https://claude.com/claude-code)", then
   `gh pr checks --watch`. `gh stack merge` is the owner's call. Then mark `implementations-plan/index.md`.

**The no-over-engineering rule** (verbatim in every post-impl codex prompt, initial and resumed): *"Report bugs and
small, targeted improvements only. Do not propose speculative abstractions, extra configuration surface, new layers,
or rewrites — the smallest change that fixes each real problem. If code works and is clear, leave it alone."*

**The comment-quality rule** (verbatim, same treatment): *"Audit the comments for value per character. Flag any
comment that narrates what the code visibly does, restates its line, references implementation plans / phases /
reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious invariant or constraint
deserves a comment it doesn't have. Comments are permanent context every future reader, human or LLM, pays to
re-read: they must be few, dense, and exact."*

Failure-retry policy: human-driven, stop and reassess after 3 failures on one step; `/loop` autonomous, after 5.
At each phase-gate pass: `agent-worktree status yacana-bridge "phase N green: <next>"`. Lessons per phase in
`lessons/phase-N.md`; every consult logged.

## Seeds (DRAFT until the approval gate)

_Finalized post-approval; see the ELI5 companion._
