---
plan: yacana-bridge
tier: mega-deep
driver: claude-code
eli5_mode: artifact
code_review: off
budget: "recon 4 agents (1 reuse sweep, 3 subsystem mappers); codex at high (GPT-6 Astra); fable legs on Fable 5.1"
status: audit round 1 folded in, awaiting round 2
created: 2026-09-12
---

# yacana-bridge — the Ethereum bridge, the cross-rollup migration, the upgrade harness, the runbook

Design inputs (read first): `design-spec.md` (the mechanism, drafts 2 + 3 deltas; §8 amends it), `ux-brief.md` (the
guided path; §6 P7 lists the lines this plan overrides), the design canvases "Yacana Bridge Take Two" (the UI spec)
and "Yacana Bridge and Migration" (take one, the checkpoint). `recon.md` and `research/` hold what the codebase and
the Aztec 5.2.0 sources offer. The three independent drafts are `plans/{main,codex,fable}.md`; this plan
consolidates them (§8 says which decision came from where), the contradiction check and audit round 1 (§9,
`audit-codex.md`, `audit-fable.md`).

## 1. Goal

Aztec's Alpha rollups do not carry state to the next version. Yacana survives an upgrade because every holder can move
their balance through Ethereum, one holder at a time, while the miner's schedule continues on the new version. This
plan ships, mainnet-launch grade and rehearsed on testnet:

1. **Contracts.** The miner gains `send_ahead` and `exit_to_l1` (a private burn via authwit plus an L2→L1 message plus
   a public record of the exit's public fields), `claim_from_l1` (private, allowed after retirement), `retire`
   (consumes the portal's retire message; `claim` refuses afterwards), and a constructor that continues the previous
   version's schedule. The token is unchanged.
2. **Ethereum.** `YACA` (an ERC-20 whose only minter and burner is the portal) and `YacanaPortal` as a Foundry project.
3. **The rig.** A programmatic governance rollup upgrade on the isolated local network, and an integration suite that
   proves every migration case; the flip alone in the PR gate of the packages it guards, the full suite on dispatch.
4. **The apps.** The web miner's guided path as drawn (with the no-relayer copy of §6 P7); the everyday To Ethereum /
   Deposit from Ethereum; `/stats/bridge`; the FAQ; the announcement line; the Ethereum RPC setting; the versioned
   old-app origin.
5. **The docs.** `docs/bridge.md` (the design) and `docs/upgrades.md` (the operator runbook for the day Aztec
   announces the next version, written for a session that will not have this context).

**Done means**: every phase's gate green; the rig proves the flip in the PR gate and the migration cases on
dispatch; YACA and the portal live on Sepolia; the testnet profile redeployed with the bridge; one exit to Ethereum,
one deposit back and one send-ahead held with its witness archived, verified on the explorers from the branch's
preview site; the runbook followed once by the rig. The apex switch to the new record and the `v5` Worker's custom
domain are production deploys after merge, on the owner's call (§7). A send-ahead landing on a new testnet version is
recorded as *pending validation* until Aztec upgrades the testnet: a same-rollup redeploy cannot simulate a Registry
migration (C, F).

**Not in this plan** (documented follow-ups): the relayer bot (forwarding stays by hand: the operator script under a
forwarder key and the in-app self-forward; the owner runs the script on no promised cadence), the mainnet fee path for
claims (a fee-payer function ships; the sponsored FPC stays on testnet), Sepolia-only rig runs, fixed denominations.

## 2. The mechanism (summary; `design-spec.md` as amended by §8)

- **Kinds**: K1 to-Ethereum (mint YACA to an address), K2 send-ahead (held on Ethereum, forwarded into the canonical
  version if Yacana registered it), K3 deposit (burn YACA on Ethereum, mint privately on Aztec), K4 the inbound
  claim, K5 retire (the portal → the old miner: mining ends), K6 redeem (a K2 unforwarded 30 days after the flip
  becomes YACA on Ethereum, authorised by a per-exit redeem key's signature, under the same cap, pause and deadline
  as a forward).
- **Portal rules**: sender/version checks on each version's own boxes; Registry transitions recorded by
  *observation* — the first portal call (any state-changing entrypoint, or the permissionless `noteTransition`)
  that sees the Registry's `numberOfVersions()` above an index records that index's activation as `now`; observed
  times are never earlier than the true flip, so nobody can shorten a holder's window, and no oracle is needed
  (D17). The exit deadline is `max(observed activation of index i+2 (∞ until seen), flipAt(i) + 180 d) +
  pausedSeconds`. The rate limit is `exited + amount ≤ cap + inbound` with `cap = ALLOWANCE + PER_HOUR ×
  hours(launchAt → min(now, flipAt))`: the cap grows on wall time for the version's life and freezes at the observed
  flip, because retirement ends honest minting minutes after it (D9); a leaf over the cap waits and stays
  consumable. Pauses are per version (`pauseAll` loops the registered ones), ≤ 30 d per call and ≤ 60 d per
  version, accounted up front; they neither add nor remove cap, they extend the deadline. `PER_HOUR` and
  `ALLOWANCE` are immutable policy set at deployment (3× the schedule, one day's allowance): the operators choose
  which miner a version trusts, never how much it may issue (D38). A K2 is forwarded only by its holder (a
  signature by the exit's redeem key) or by an operator-listed forwarder; K1 forwarding is permissionless (D37).
- **The bound, plainly**: a compromised old version can never issue more than `cap(flipAt)`, three times what its
  schedule could have minted, before its deadline closes; the pause defers, the deadline ends. The cap is a tripwire,
  not a proof of honesty: in a competitive boom honest production can exceed the schedule (epochs close on N claims
  with no minimum duration, `main.nr:188-193`), so an honest exit can be delayed and, at the deadline, refused (Ask
  A7).
- **Safety**: a send is safe once its epoch is settled on L1 (each epoch has a proof deadline the UI shows); a missed
  deadline prunes the epoch and the burn is undone onto V5; V5 keeps producing and settling after the flip only
  while its operators keep it running, without a lifetime signal; balances left on a stopped chain are lost.
- **The path**: one card, one button (Send ahead), one switch (hourly sends of new wins until the upgrade; the landing
  claim on V6 at sign-in); the card is the status; the flip card names the bet and shows V5's block and settled age;
  the old origin is one page; exceptions are one line and one link. Forwarding is by hand or by the user: the copy
  never promises a cadence (D22).

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
  `H(DOM_SEED, seed of the source's last epoch)`, derivable by anyone from the source's public storage; the
  deployment record names the source deployment, its last epoch, target and seed (C). No balance or supply carried.
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
- The content hashes in a library crate `packages/contracts/yacana_bridge_hashes` (added to the Nargo workspace's
  `members` and to the miner's dependencies); its `#[test]` vectors are codegen'd from
  `packages/bridge/fixtures/bridge-vectors.json` by `scripts/params-codegen.ts` (a Noir test cannot read JSON) (F).
  `yacana.params.json` gains `$domains` `EXIT` and `REDEEM`; the retarget/ticket/claim circuits are untouched.

**L1, once — `packages/portal` (Foundry; `aztec-forge` 1.4.1 from the toolchain, its binary hash added to
`toolchain.lock.json` with `anvil` and `cast`).** `src/YACA.sol` (OpenZeppelin ERC20; `mint`/`burnFrom` portal-only;
the portal deploys it in its constructor, no circular init — C), `src/YacanaPortal.sol`, `src/YacanaHashes.sol` (the
encodings, plus the pinned constant `RETIRE_SECRET_HASH = compute_secret_hash([0])` with a vector — never computed on
L1), `src/aztec/` (tag-pinned copies of `IRegistry`, `IHaveVersion`, `IInbox`, `IOutbox`, `DataStructures`, `Hash`,
`Epoch`, the Outbox/Inbox errors; source commit in `src/aztec/VENDORED.md`), `script/Deploy.s.sol` (reads the
deployer key from env inside the script, never from `--private-key`), `test/` (thin mocks of Registry, Inbox and
Outbox; the hash vectors; fuzzed accounting; invariants), committed `abi/` (CI diffs after build).
`@openzeppelin/contracts` and `forge-std` come from npm under the 7-day gate (`packages/portal/package.json`,
`remappings.txt` into `node_modules`; vendored if a package is missing), never as submodules (no `.gitmodules`
exists and checkout fetches none). `bun run portal:build|test` wrap `toolchainBin('aztec-forge')` from
`scripts/run/toolchain.ts` (extracted in P1).

Portal storage: `IRegistry immutable registry`, `YACA immutable yaca`, `address operators` (the Safe, threshold per
Ask A5), the immutable policy `PER_HOUR`, `ALLOWANCE`, `EXIT_FLOOR = 180 d`, `REDEEM_AFTER = 30 d`, `PAUSE_MAX =
30 d`, `PAUSE_BUDGET = 60 d`; `mapping(address ⇒ bool) forwarders`; `uint256[] registeredVersions`;
`mapping(uint256 index ⇒ uint64 observedAt) transitions` (when the portal first saw the Registry hold a version at
that index; 0 = unseen); per version `VersionInfo { bytes32 miner; uint64 registryIndex; uint64 launchAt; uint64
pausedUntil; uint64 pausedSeconds; uint128 exited; uint128 inbound; bool registered; bool retireSent; }`.
Derived: `flipAt(v) = transitions[index + 1]`, `afterNextAt(v) = transitions[index + 2]`, `cap(v) = ALLOWANCE +
PER_HOUR × (min(now, flipAt or now) − launchAt) / 3600`, `deadline(v) = max(afterNextAt or ∞, flipAt +
EXIT_FLOOR) + pausedSeconds` (defined once `flipAt` is set).
Functions:
- `_sync(version)` — internal, first in every state-changing entrypoint: `n = registry.numberOfVersions()`; for
  `k ∈ {index + 1, index + 2}` with `n > k` and `transitions[k] == 0`, set `transitions[k] = now` and emit
  `TransitionObserved(k, now)`. A version anyone touches is never "unrecorded" past that call.
- `noteTransition(index)` — anyone: the same record for any index the Registry already holds; the runbook's
  minute-one call together with `retire`.
- `registerVersion(version, index, miner, launchAt)` — operators, write-once, requires `registry.getVersion(index)
  == version` (no scan; out-of-order registration works); appends to `registeredVersions`; `launchAt` is the
  operators' input (disclosed: an earlier value grows the cap sooner; the operators are trusted for which miner a
  version uses, and this is the same trust).
- `retire(version)` — anyone: `_sync`; requires `flipAt` recorded and the version registered; sends K5 into that
  version's Inbox with the miner as recipient and `RETIRE_SECRET_HASH`, exactly once (`retireSent`); allowed while
  paused (it is not an exit); emits `Retired`.
- `forward(version, ForwardArgs)` / `forwardMany` — per leaf, a batch continues past a failed leaf; `_sync`;
  consumes the Outbox leaf on that version's own Outbox (the message rebuilt with that version's number and the
  portal as recipient); requires not paused, the deadline open, `exited + amount ≤ cap + inbound` (else
  `WaitsForHeadroom`, the leaf stays consumable); kind 1 → anyone may call; `yaca.mint(recipient, amount)`; kind
  2 → `msg.sender ∈ forwarders`, or `args.sig` is the K2's `redeemKey`'s EIP-712 signature over
  `Forward(version, epoch, leafId, contentHash, target, expiry)`; `target` must be the canonical version, registered,
  with an index greater than this one → `Inbox(target).sendL2Message(L2Actor(minerOf[target], target), K4,
  secretHash)`; emits `Forwarded(version, leafId, kind, amount, aux, target, inboxIndex)`.
- `deposit(amount, secretHash, expectedVersion, deadline)` — `_sync(expectedVersion)`; reverts unless
  `expectedVersion` is canonical, registered, not paused and `now ≤ deadline`; `burnFrom(msg.sender)`; `inbound +=
  amount`; emits `Deposited(version, sender, amount, secretHash, inboxIndex)`.
- `redeem(version, ForwardArgs, recipient, expiry, sig)` — a kind-2 leaf; `_sync`; `now ≥ flipAt + REDEEM_AFTER`;
  the same pause, deadline and cap checks as `forward`; EIP-712 (domain `YacanaPortal`/chainId/portal) over
  `Redeem(version, epoch, leafId, contentHash, recipient, expiry)`; `ECDSA.recover` must equal the K2's `redeemKey`;
  consumes the leaf (competing with forward for one nullifier) and mints; no secret revealed.
- `pause(version, seconds)` / `pauseAll(seconds)` / `unpause(version)` — operators; a call ≤ `PAUSE_MAX`;
  `pausedSeconds + seconds ≤ PAUSE_BUDGET`; the whole interval is accounted at the call (`pausedUntil` extended,
  `pausedSeconds += seconds`) and `unpause` refunds the unused remainder; `pauseAll` loops `registeredVersions`.
- `setForwarder(address, bool)` — operators.
- views: `versionInfo`, `cap`, `headroom`, `deadline`, `flipAt`, `transition(index)`.

**The rig — `scripts/run/upgrade-rig.ts` + `packages/harness`.** The rig owns the whole network lifecycle (it is not
nested in `e2e:agent`): `startUpgradeRig({ votingDuration: 60 })` boots the isolated network through the exported
`startIsolatedNode` with `AZTEC_GOVERNANCE_VOTING_DURATION=60`, records the genesis inputs, addresses and config;
`deployNext({ bump })` calls `deployRollupForUpgrade` with the current canonical's config from `getL1Config` and
exactly one change (`manaTarget + bump`), committee 0, slasher off, real verifier off, epoch 4, proof epochs 2,
slot 72, inbox lag 2, a genesis root computed with the pinned node's own formula (`computeExpectedGenesisRoot` from
`@aztec/aztec/dest/cli/cmds/standby`: test accounts + the sponsored FPC + prefund, no BananaFPC), funds the new
FeeJuicePortal through `FeeAssetHandler`, and reads the new version from the deployed Rollup's `getVersion()` (never
computes it: the Solidity and TS formulas differ, `RollupConfiguration.sol:132-145`); `flip(next)` deploys the
payload from the shipped ABI/bytecode, mints and deposits ≥ 2e24 of the staking asset, `proposeWithLock`, warps to
`creation + votingDelay + 1` and mines, votes, warps past `votingDuration + executionDelay`, mines, executes, and
asserts `getCanonicalRollup`, `numberOfVersions`, `getVersion(i)`, distinct versions and boxes — repeatable for a
second flip; `quiesce(node)` pauses the node's sequencer through the admin API *and* waits for its serial queue's
`syncPoint` (the pause gates only the mempool poller; builds, warps and the settle tick run in the queue) before any
clock change; `postFlipWindow()` keeps the old node building and settling; `stopNode(v)` (node only; anvil and the
run dir stay); `startNode(v, { autoProve })` runs `aztec start --node --sequencer --registry-address … --rollup-version
… --node-debug` with `USE_AUTOMINE_SEQUENCER=1` and `AUTOMINE_ENABLE_PROVE_EPOCH=<autoProve>`, the same
`TEST_ACCOUNTS`/`SPONSORED_FPC`/`PREFUND_ADDRESSES` the genesis was computed from, `AZTEC_MANA_TARGET=<bumped>`,
fresh data dirs, registry-claimed ports (lanes 4–6 for the second node, 8–10 for a third: lanes 0–3 are the local
network's); after a pinned node boots the rig publishes the sponsored FPC on it (the fixed salt) and executes one
sponsored transaction before any Yacana setup; the local-network V5 is only ever stopped, never restarted (its
genesis funds BananaFPC and forces auto-prove on); `clock.warp`, `clock.mine`, `clock.prove` (`aztecDebug_prove`),
`clock.nudge` (two cheap L2 txs), `clock.prune` (`Rollup.prune` when `canPruneAtTime`); `yacana.*` deploys Yacana on
a version through `packages/deploy` and drives every bridge action through the operator script's functions, so the
runbook's commands are the tested ones. `scripts/run/toolchain.ts` takes `toolchainBin`, `spawnDetached`,
`jsonRpcReady` out of `isolated-node.ts` unchanged. Cases live in `packages/harness/tests/*.bun.test.ts` under
`describe.skipIf(!process.env.YACANA_RIG)`; `bun run rig -- <case|all>` boots the rig and runs them; one automine
sequencer at a time.

**The operator script — `packages/deploy/src/bridge/`** (`portal.ts` deploy YACA + portal; `register.ts`;
`transition.ts` (`noteTransition`); `retire.ts` (`retire` on L1, then the L2 `retire`); `forward.ts` (scans a
version's `ExitRecorded` logs, fetches each witness with `getL2ToL1MembershipWitness`, archives it to
`deployments/witnesses/<profile>.jsonl`, forwards under the forwarder key from env, and refuses a K2 target whose
registered miner differs from the announced deployment record); `pause.ts`; `status.ts`), exposed as `bun run bridge
-- <cmd>`; `packages/deploy/src/deploy.ts` gains the constructor args and writes `bridge: { chainId, portal, yaca,
operators, forwarders, l1Explorer, l1RpcUrl }` into the record; `packages/deploy/scripts/l1-deploy.ts` runs
`script/Deploy.s.sol` through `aztec-forge script` and records the addresses; with `--anvil` it starts its own
`aztec-anvil` on a registry port (no full node).

**The shared client — `packages/bridge` (TS, `viem` — the hoisted `@aztec/viem` alias; depends on `miner-core`,
never the reverse).** One workspace package for the browser, the operator and stats (C): `content.ts` (the
encodings), `secrets.ts` (derivation, the index scan), `portal.ts` (ABI + typed client), `witness.ts` (leaf and
witness helpers over `@aztec/stdlib/messaging`), `journal.ts` (the crossing record, its states exactly the state
table's, a pure `advance(record, facts)` reducer), `queue.ts` (one promise queue for every bridge operation),
`recovery.ts` (the file schema, bound to chainId + portal), `deadline.ts` (the per-epoch proof deadline from the
rollup's constants over the RPC), `flip.ts` (the flip-signal reducer).

**The apps.** `packages/site/src/browser/eth-rpc.ts` (parse under `parseNodeUrl`'s rule, probe `eth_chainId` and
the portal's code, save `Connection.ethRpcUrl`); `node-guard.ts` gains a second persistent admitted slot
(`setEthRpcEndpoint`) with its own health; `host.ts` gains `versioned` (the host of `VITE_OLD_APP_ORIGIN`) and
splits `keysAllowed` into create (production, preview, local) and restore (those plus versioned), with
`session.guardHost(kind)` per caller; `config.ts` + `site.env` gain `VITE_ETH_RPC_URL`, `VITE_L1_EXPLORER_URL`,
`VITE_OLD_APP_ORIGIN`, `VITE_MIGRATION` (the profile's `migration` block; announcing is a site redeploy),
`VITE_APP_ROLE` (from `YACANA_APP_ROLE`, mapped as `YACANA_PROFILE` is); `assemble.ts` gains `--profile`, `--out`,
`--role` and `assertProductionArtifact` fails closed unless `role === 'old' ⇔ the origin is versioned`;
`packages/site/v5/wrangler.jsonc` (Worker `yacana-v5`, custom domain `v5.yacana.network`, assets `dist-v5`);
`build.json` gains `role`, `rollupVersion`, `miner`. `packages/web-miner/src/bridge/` (`store.ts` — journal +
witnesses in IndexedDB `yacana-bridge` keyed by chainId·portal·account, the next exit index reserved in the same
transaction that creates its crossing, after a rescan of the version's `ExitRecorded` logs for the account's own
hashes; `flows.ts` — sendAhead / exitToL1 / deposit / land / selfForward through `queue.ts` with the pause reason
`'bridge'` (the controller's `track` is a drain join, not a mutex — `controller.ts:438-449`); `scheduler.ts` — the
consent-bound hourly send, running only while unlocked, stopping on `flipped` or `unknown`, reconciling pending
sends before retrying; `landing.ts` — the sign-in scan over the portal's `Forwarded`/`Deposited` events (the
`inboxIndex` is enough; the old version's logs live on another node) and the auto-claim gated on the stored consent
`{ account, deployment, operation, expiresAt }`, with a Claim action always offered for a claimable crossing;
`eth.ts` — the injected EIP-1193 provider through viem (`custom(window.ethereum)`), chain switch, `deposit`,
`forward` (the holder's `Forward` signature by the exit's redeem key, gas from the injected wallet; refused when the
target's registered miner differs from the record), `redeem`; `snapshot.ts` — the last-seen balance per
`yacana.balance.v1.<chainId>.<rollupVersion>.<token>.<account>` on every read); `keys/store.ts` keeps `v: 1` and
the sealed ciphertext untouched (the AAD includes `v`), adds a master fingerprint (`HKDF(master,
"yacana.master.fp.v1")`, written at the first open, verified before any derivation) and an optional
`account.addresses: {[classId]: address}` filled at open by re-deriving with the build's class (a record whose
stored address matches no class is migrated only after the fingerprint matches); `wallet.ts` extracts `feePayer.ts`
(a `FeeProvider(operation)`); features `MigrationCard`, `ArrivalCard`, `SendAheadSheet`, `ToEthereumSheet` (the
Send sheet gains the destination row), `DepositSheet`, `BridgeTile`, `TakingLongDialog` (opens for a `held`/`ready`
crossing older than a stated age, not on a bot's silence), `EthRpcTile`, `OldTabNotice` (compares `/build.json`'s
`miner` and `rollupVersion` with the tab's: a same-rollup redeploy is not caught by the PXE's node fingerprint);
`routes/Retired.tsx` renders the single-purpose page when `VITE_APP_ROLE === 'old'` (Send ahead, a quiet "or to
Ethereum", node/RPC/recovery file/self-forward under "advanced"); `main.tsx` scopes `yacana.claims` by account and
deployment. `web-stats`: route `bridge`, a bridge beat, `features/Bridge*.tsx`, `explorer.ts` gains Etherscan,
`routes/Verify.tsx` gains YACA/portal/operators/forwarders. `web-landing`: the announcement `Alert` in the shell
slot, `sections/Faq.tsx` (the six panels + the questions), `/faq` rewritten to `/` in `_redirects` with a
scroll-on-load.

### 3.2 Key interfaces

Content encodings (Noir `yacana_bridge_hashes`, Solidity `YacanaHashes`, TS `packages/bridge/src/content.ts`; the
first 4 bytes of keccak of the string, then 32-byte big-endian words, then `sha256_to_field` with the leading zero
byte as `Hash.sol` does):
- K1 `exit_to_l1(address,uint256,bytes32)` ‖ recipient ‖ amount ‖ tag
- K2 `send_ahead(uint256,bytes32,address)` ‖ amount ‖ secretHash ‖ redeemKey
- K4 `claim_from_l1(uint256)` ‖ amount — the Inbox message carries `secretHash` itself (F)
- K5 `retire(uint256)` ‖ version
Vectors pinned three ways from `packages/bridge/fixtures/bridge-vectors.json` (codegen'd into the Noir crate, `forge
test`, `bun test`).

Secrets (`packages/bridge/src/secrets.ts`, the exported `hkdf` of `keys/derive.ts`: HKDF-SHA-256, the fixed
`yacana.kdf.v1` salt, 64 output bytes reduced into the target field, bias 2⁻¹⁹⁰): `exitSecret_i = reduce_Fr(
hkdf(master, "yacana.exit.v1:<chainId>:<portal>:<version>:<i>", 64))`, `tag_i = poseidon2(DOM_EXIT, exitSecret_i)`
(K1), `secretHash_i = computeSecretHash(exitSecret_i)` (K2, K3), `redeemKey_i = reduce_n(hkdf(master,
"yacana.redeem.v1:<chainId>:<portal>:<version>:<i>", 64))` as a secp256k1 key (viem `privateKeyToAccount`), one per
exit so no two sends share an address (C). Label encoding: decimal chainId, lowercase hex portal with `0x`, decimal
version, decimal `i`; frozen by the P1 vectors. Sequential `i` per version: the next index = max seen + 1 over the
journal *and* the version's `ExitRecorded` logs matched to the account's own hashes (rescanned before every
allocation), reserved atomically; gap limit 20 for the fast scan, an extended scan and the recovery file for
completeness. Two devices allocating the same `i` at once link two exits and lose nothing (both K4 messages stay
claimable with the same secret; a redeem signature binds its leaf): disclosed as "one device at a time for bridge
sends". Deduplication by full message identity.

Journal (`packages/bridge/src/journal.ts`): `Crossing { id, kind: 'exit' | 'ahead' | 'deposit' | 'land', version,
amount, aux, txHash?, epoch?, deadline?, witness?, l1Tx?, state, updatedAt }`; states exactly the state table's;
`advance(crossing, facts)` pure; facts from the node, the RPC and the store.

Rig API: `startUpgradeRig(opts) → { l1, nodes, deployNext, flip, quiesce, postFlipWindow, stopNode, startNode,
clock, yacana, bridge, teardown }`.

### 3.3 Data and control flow (the critical path)

Send ahead: the sheet → `flows.sendAhead(amount)` (queued) → rescan, reserve `i`, derive secret, tag, redeem key →
the authwit for `burn_private` (caller = the miner, `wallet.createAuthWit(owner, { caller, call })`) →
`miner.send_ahead(...).send({ authWitnesses })` (mining paused `'bridge'`) → journal `sent` → the receipt's epoch and
the proof deadline → `proven` when `getBlockNumber('proven') ≥ block` and `getRoots(epoch)` is non-zero → the Outbox
witness (retried) stored → `held` (K2) / `ready` (K1). Forward (operator or self): `forward(version, args)` →
`Forwarded` → `forwarded`. On V6 at sign-in: `landing.scan` matches `Forwarded`/`Deposited` events by the account's
own secret hashes → `waitForL1ToL2MessageReady(node, msgHash, { chainTip: 'proven' })` → `claim_from_l1` if the
consent allows it, else the Claim action → `landed`. Flip detection (`flip.ts`), by precedence, not conjunction (C,
F): a confirmed Registry departure over the RPC → `flipped` (mining stops, the hourly scheduler stops); the node's
`rollupVersion` moved, the miner's `retired` slot, or `/build.json`'s deployment ≠ the tab's → `flipped` too; the
Registry read silent with nothing positive → `unknown` (new Ethereum-bound sends held back); deployment readiness
(Yacana registered on the new version) and retirement (K5 consumed) are separate states shown on the flip card.

### 3.4 File-level change map (cross-checked against `recon.md`)

Added: `packages/contracts/yacana_bridge_hashes/**`, `packages/contracts/yacana_miner/src/bridge.nr`;
`packages/portal/**` (+ `package.json`, `remappings.txt`); `packages/bridge/**`; `packages/harness/**`,
`scripts/run/upgrade-rig.ts`, `scripts/run/toolchain.ts`; `packages/deploy/src/bridge/*`,
`packages/deploy/scripts/l1-deploy.ts`; `packages/web-miner/src/bridge/*`, `features/{MigrationCard,ArrivalCard,
SendAheadSheet,DepositSheet,BridgeTile,TakingLongDialog,EthRpcTile,OldTabNotice}.tsx`, `routes/Retired.tsx`,
`tests/vault.bun.test.ts`, `e2e/bridge.e2e.ts`; `packages/site/src/browser/eth-rpc.ts`,
`packages/site/v5/wrangler.jsonc`; `packages/web-stats/src/routes/Bridge.tsx`, `features/Bridge*.tsx`;
`packages/web-landing/src/sections/Faq.tsx`; `docs/bridge.md`, `docs/upgrades.md`; `.github/workflows/portal.yml`,
`.github/workflows/harness.yml`; `deployments/witnesses/<profile>.jsonl`.
Modified: `yacana_miner/src/main.nr` (+ `params.nr`), `packages/contracts/Nargo.toml` (members), `yacana.params.json`
(domains, `bridge` per profile, `migration`), `scripts/params-codegen.ts`, `toolchain.lock.json` (forge, anvil,
cast), `packages/deploy/src/deploy.ts`, `scripts/run/isolated-node.ts`, `node-guard.ts`, `connection.ts`,
`host.ts`, `config.ts`, `site.env`, `assemble.ts`, `artifact.ts` (`headers.ts` untouched), `keys/store.ts`,
`keys/derive.ts` (export `hkdf`), `session.ts`, `wallet.ts` (`feePayer.ts` extracted), `chain.ts`, `controller.ts`
(`PauseReason` + `'bridge'`), `App.tsx`, `routes.ts`, `routes/Wallet.tsx`, `SendSheet.tsx`, `Settings.tsx`,
`settings.ts`, `main.tsx`, `e2e/{run,run-setup,proof-inventory,shards.json}`, `web-stats/src/{routes,App,chain,
beats,explorer}.ts(x)`, `routes/Verify.tsx`, `web-landing/src/{App,copy}.ts(x)`, `contracts.yml` (filter +
`packages/contracts/yacana_bridge_hashes/**`), `miner-core.yml` (`packages/bridge`, `packages/harness` unit parts),
`site.yml` (`!deployments/witnesses/**`), `e2e.yml` (the `rig` dispatch job), `web-miner.yml`,
`docs/{deployments,threat-model,roadmap}.md`, `README.md`, `CLAUDE.md`.
Reuse honoured: authwits (no approval mechanism), fixed slots (no slot-table work), the node setting as the RPC
setting's template, no CSP change, no second vault, `www/` as the second-Worker precedent, `toolchainBin` extracted
rather than duplicated, `hkdf` exported rather than duplicated, `viem` already hoisted.

### 3.5 Non-obvious mechanics

- **Retire**: a second L2 `retire` fails on the nullifier; a message from another sender is not in the tree (TXE:
  `send_l1_to_l2_message(…, sender = other)`); `claim` is refused in public, so a proof made after retirement is
  wasted but mints nothing; the UI stops mining first; a second L1 `retire` sends no second leaf.
- **Transitions by observation**: the Registry keeps no timestamps and the GSE's trace does not authenticate a
  Registry activation (the GSE's latest need not be the canonical, `GSE.sol:110-113`; `GSE.addRollup` stamps
  whenever the owner calls it, `:281-286`; only the shipped payload couples both calls). Observation is monotone
  (never before the true flip) and self-healing (every entrypoint records what it sees); the only manipulation is
  delaying a record, which extends exposure but never shortens a holder's window; `retire` and `noteTransition` are
  the runbook's minute-one calls, so the lag is minutes.
- **Deadline**: `afterNextAt` is the observed activation of the version after next, recorded for any Registry
  version whether or not Yacana registered it (C); unseen means open, never zero.
- **Rate limit**: grows on wall time for the version's life and freezes at the observed flip; post-flip mining
  cannot add exits because `retire` stops mints and the gap before consumption is minutes; the pause defers, the
  deadline bounds: the total that can ever leave a version is `cap(flipAt)` (F). A pause on the portal does not pause
  mining on L2, which is why paused time is not excluded from growth.
- **Forward target**: the canonical version if Yacana registered it and its index is greater; a skipped version
  never strands a send; K6 remains for "no registered canonical". A K2 forward is the holder's or a forwarder's
  choice, never a stranger's: a leaf forwarded into a version about to stop would lose its K6 (D37).
- **Redeem**: EIP-712 over `(version, epoch, leafId, contentHash, recipient, expiry)` (the Outbox nullifies per
  epoch, so `leafId` alone repeats across epochs — C); the K2 commits to the per-exit signer; forwarding and
  redemption race for one nullifier; the same cap, pause and deadline as a forward (F).
- **Balance snapshot**: written on every balance read on the apex; the V6 build reads the V5 rollup's key for the
  account's V5 address and shows "last seen … may still be there". The old origin has neither the vault nor the
  snapshots: passkeys restore, words are retyped (C).
- **Address per class id**: `addresses` filled at open after the fingerprint check; the sealed record's AAD is
  unchanged; the arrival card explains the new address.
- **Proof deadline**: `getTimestampForEpoch(e + proofSubmissionEpochs + 1)` on the version's Rollup over the RPC
  (`TimeLib.sol:73`, exposed through `RollupAbi`).
- **The versioned origin**: a build with `VITE_APP_ROLE=old` from the last V5 commit, served by the `yacana-v5`
  Worker; `hostKind === 'versioned'` allows key restore, refuses creation; `assertProductionArtifact` and boot fail
  closed on a role/origin mismatch; `build.json.role = 'old'`. The passkey's RP ID is the apex, so the old origin can
  obtain the same master after user verification (`passkey.ts:93-96`): it is a fully trusted sibling, built by the
  same pipeline with the same headers, maintained with the apex until its version's deadline passes, then taken
  down; the role/origin check guards deployments, not secrets.

### 3.6 Trade-offs and alternatives not taken

- The miner carries the bridge (unanimous) over a separate exit contract.
- `packages/bridge` as the shared client (C) over bridge code inside `miner-core` (M, F): miner-core stays free of
  viem; three consumers share one implementation; the dependency runs `bridge → miner-core` only.
- viem through the injected provider (F) over wagmi (the owner's literal answer named wagmi; the capability — an
  in-app Ethereum wallet connection for deposits and self-forwards — is delivered with fewer dependencies and no
  fork/peer conflict; Ask A2).
- The rig owns its network (C, M) over cases under `e2e:agent` (F): two runners would boot two networks.
- The FAQ as a landing section with a `/faq` rewrite (F, C) over a fourth app or a second Vite entry (M).
- Foundry tests over thin mocks; the real boxes only on the isolated network (F).
- A witness archive by the operator script instead of a relayer (F).
- Transitions by observation (C; adopted on Codex's round-1 finding) over the GSE trace (M + F): the trace cannot
  authenticate a Registry activation, and a split payload defeats any sandwich rule.
- A Registry-based deadline (C) over a Yacana-registered-based one (F's S2): bounded exposure whether or not Yacana
  registers the next version.
- Holder-or-forwarder K2 forwarding (Codex round 1) over permissionless forwarding (the drafts): closes the
  front-run-into-a-dying-version griefing at the cost of one role; K1 stays permissionless.
- Immutable policy constants (Codex round 1) over operator-set caps per version (the drafts).
- Per-version pauses with `pauseAll` as a loop (Codex round 1) over a global scalar (the drafts): a scalar cannot be
  reconstructed lazily for a dormant version.

## 4. Security & Adversarial Considerations

**Threat model.** Attackers: a holder trying to mint YACA without burning (forged exits), a miner trying to inflate
after the flip, a front-runner on Ethereum (redemption, forwarding), a griefer forwarding others' sends, the
operators (the multisig) or a forwarder turning rogue, a compromised or wrong web page, a lying or silent RPC or
node, an Aztec-level bug (fake proofs on the old version), a corrupted recovery file, a deployment switch. Assets:
YACA on Ethereum, balances on each Aztec version, the seed.

- **Message authenticity**: every L2→L1 leaf is consumed on its version's Outbox with a Merkle path against a settled
  root and nullified by leaf id; the portal rebuilds the message with that version's number and the registered
  miner as sender; every L1→L2 message the miner consumes must come from the portal's fixed address (`retire`, K4).
  Public exit logs aid discovery; Outbox membership alone authorises issuance (C).
- **Issuance bound under a compromised old version**: the rate limit slows a drain (a leaf over it waits); the pause
  defers it; the deadline bounds it: nothing beyond `cap(flipAt)` — three times the schedule — ever leaves a
  version, and `redeem` is under the same cap, pause and deadline (F). An honest holder is never confiscated by the
  cap's growth rule, but a competitive boom can delay honest exits and the deadline can end them (Ask A7).
- **Post-flip mining**: the retire message ends claims on chain; until it is consumed the UI's flip signal stops
  mining; the deadline closes a version's exits at the later of the version after next and 180 days.
- **The operators**: write-once registration per version (cannot repoint an old version's exits), the policy
  immutable (they never choose how much a version may issue), no timelock by the owner's choice, pause bounded;
  the record page discloses who they are (a Safe; threshold per A5), the forwarders, and what a wrong first
  registration does: it lets that miner issue up to the version's cap *and* strands every K2 forwarded into that
  version (the K4 names the registered miner and the leaf is nullified), which is why the forwarder script and the
  app refuse a target whose registered miner differs from the announced record, and why `launchAt` is disclosed as
  an operator input. Keys never in the repo or CI; the Sepolia deployer key is `YACANA_L1_PRIVATE_KEY` and the
  forwarder key `YACANA_L1_FORWARDER_KEY`, env only, never echoed, never on a command line. `retire` and
  `noteTransition` are permissionless and can be censored only by Ethereum itself.
- **Front-running and griefing**: redemption and K2 forwarding sign `(version, epoch, leafId, contentHash, target or
  recipient, expiry)`; K1 forwarding is idempotent (a consumed leaf reverts); deposits carry the expected version and
  a deadline so a flip between review and inclusion reverts; a stranger cannot push a K2 into a version about to
  stop.
- **The page**: the embedded wallet already holds signing capability, so automation adds no capability; the send
  sheet's switch is the scoped consent `{ account, deployment, operation, expiresAt }` for the hourly sends and the
  landing claim, visible as "claiming, as you allowed", pausable, and Claim is always offered by hand; every bridge
  operation runs through one queue with its index reserved before sending (no two sends share a secret on one
  device); the app refuses to claim on a version whose registered miner differs from its build's; the old origin is
  a fully trusted sibling (§3.5) with the same pipeline, headers, CSP and `artifact.ts` guards, maintained and then
  retired; key creation stays apex-only; a wrong phrase can never open a wrong account silently (the fingerprint).
- **RPC and node**: reads only; the guard admits the chosen RPC origin as a second slot with its own health; silence
  renders "unknown" and holds back new Ethereum-bound sends; the page fetches event ranges and matches locally,
  never per hash; the node can waste work, never move funds.
- **Privacy**: amounts, secret hashes, redeem addresses and timing are public on Ethereum and, through the token's
  public supply, on both rollups; the hourly sends publish per-hour win amounts (Ask A11); the review says so;
  nothing names the account; the K1 tag is a hash; one redeem address per exit.
- **Cryptography**: Aztec's `compute_secret_hash` / `sha256_to_field` for contents (three-way vectors); secrets and
  the redeem keys from the wallet master with domain separation through the existing HKDF; OpenZeppelin
  ERC20/ECDSA/EIP712 from npm, pinned; no custom cryptography.
- **Supply chain**: 7-day npm min-age (now covering OZ and forge-std), frozen lockfile, actions by SHA (unchanged);
  `aztec-forge`, `anvil` and `cast` hashed in `toolchain.lock.json` like `nargo` and `bb`; viem at the Aztec alias.
- **Least privilege**: CI keeps `contents: read`; the rig runs on anvil with throwaway keys; testnet deploys use the
  existing deployer secret path; production deploys are never run from a branch (§7).
- **Input validation**: amounts through `parseAmount`; Ethereum addresses through viem `getAddress`; RPC URLs
  https-only in production; recovery files schema-validated, size-bounded and bound to chainId + portal (an imported
  file cannot choose contracts).

## 5. Assumptions

**Facts (verified; paths in `recon.md`, `research/*.md`, `audit-*.md`)**
- Aztec Alpha releases do not migrate state; every version has its own Rollup/Inbox/Outbox with immutable `VERSION`;
  the Registry's `versions[]` is the canonical history and keeps no timestamps (`Registry.sol:59-68`); versions are
  keccak-derived identifiers (`l1-contracts/script/deploy/RollupConfiguration.sol:132-145`, whose comment says the
  Solidity formula differs from the TS one — the rig reads a version from the Rollup); `Rollup.getCurrentEpoch()`
  is L1-time based.
- The GSE's latest rollup need not be the Registry's canonical (`GSE.sol:110-113`); `GSE.addRollup` pushes
  `block.timestamp` whenever the owner calls it (`:281-286`); the shipped payload (`src/periphery/
  RegisterNewRollupVersionPayload.sol:40-43`) couples the Registry and GSE additions in one execution, another
  payload need not.
- Outbox/Inbox semantics: `leafId = (1 << depth) + leafIndex`, per-epoch nullifier bitmap, `consume` checks version,
  recipient, chain id, a non-zero root; `sendL2Message` checks the version and field ranges, no fee, no allowlist;
  `Hash.sol` prepends a zero byte; `TimeLib.sol:73` gives the proof deadline epoch.
- aztec-nr 5.2.0: `message_portal` and `consume_l1_to_l2_message` in both contexts (the public one takes `[Field; N]`);
  `compute_secret_hash([Field;N])`; `emit_event_in_public` + `getPublicLogsByTags`; TXE `send_l1_to_l2_message`
  returns the leaf index; the token's `burn_private` is `#[authorize_once]`; `Wallet.createAuthWit(from, { caller,
  call })`; the token's total supply is public.
- The miner closes epochs on N claims with the elapsed time capped (`main.nr:188-193`): honest production is not
  bounded by wall time (`design-spec.md:71`).
- `--local-network` ignores `--registry-address`/`--rollup-version`, forces automine + auto-prove
  (`local-network.ts:127-131`), epoch 4, proof epochs 2, committee 0, slasher off, and funds test accounts, the
  BananaFPC, the sponsored FPC and prefund addresses at genesis (`:172-178`); the pinned `--node` path checks a root
  computed from test accounts + the sponsored FPC + prefund only (`standby.ts:26-29`; `computeExpectedGenesisRoot`
  is exported, `standby.d.ts:11`); `AZTEC_GOVERNANCE_VOTING_DURATION` reaches the deploy; local governance: delays
  60 s, lock 1e24; the deployer mints the staking asset; `proposeWithLock` bypasses the GovernanceProposer; `vote`
  needs a mined block after `votingDelay`.
- The automine sequencer's `pause()` gates only the mempool poller (`automine_sequencer.ts:230-240`); builds, warps,
  `prove` and the settle tick run in one serial queue with a `syncPoint` (`:310-333`); its "proving" is synthetic
  settlement (Outbox roots + the proven tip), not proof validation.
- The installed 5.2.0 packages export `deployRollupForUpgrade`, `getDeployRollupForUpgradeEnvVars`, the
  `RegisterNewRollupVersionPayload` ABI + bytecode, `EthCheatCodes`, `RollupCheatCodes`, `upgrade_utils`,
  `createAztecNodeDebugClient`; the node path takes `USE_AUTOMINE_SEQUENCER`, `AUTOMINE_ENABLE_PROVE_EPOCH`;
  `aztec set-proven-through` writes no Outbox root; `aztecDebug_prove` does; the admin API has `pauseSequencer`.
- `scripts/run/isolated-node.ts` exports `startIsolatedNode`, returns `l1RpcUrl`, sets `L1_RPC_URL`, claims lanes
  0–3 (`:137-142`), and keeps `toolchainBin` module-private (`:46`); the toolchain ships `aztec-forge` 1.4.1,
  `aztec-cast`, `aztec-anvil` as `internal-bin/{forge,cast,anvil}`, unpinned by `toolchain.lock.json` (which pins
  `bb` and `nargo`; `toolchain.test.ts:18-19` iterates the lock's map); the guard admits one node endpoint,
  accelerators and leased candidates; the CSP already allows any `https:`; `Session.pre` is single; `pxeNamespace`
  is per rollup; the PXE's view is keyed by the node's fingerprint, not the deployment (`boot.ts:313-314`);
  `expectedDeployment()` is build-time (`connection.ts:41-47`); the key vault `yacana-keys` is per origin and shared
  by every rollup version on that origin (`keys/store.ts:27-41`), its sealed records' AAD includes the record
  version (`:107-136`), `openMaster` fails closed by comparing the derived address only (`:161-165`); the passkey's
  RP ID is the apex and sibling origins can evaluate its PRF (`passkey.ts:93-96`); the controller's `track` joins
  the drain and runs the operation at once (`controller.ts:438-449`); the account address depends on the SDK's
  account class, not on Yacana's deployment; `contracts.yml`'s filter fires on site/ui/web changes (`:29-41`);
  `site.yml` watches `deployments/**` (`:25`); `site:deploy` is `wrangler deploy` to production and Workers Builds
  deploys `main` (`docs/deployments.md:92-99`); `node_modules/viem` is the hoisted `@aztec/viem` 2.38.2.

**Inferences (unverified — the audits attack these)**
- A pinned node whose genesis the rig computed with `computeExpectedGenesisRoot`'s inputs passes its own check
  (by construction; P4's first run proves it).
- The old automine node keeps building and settling after the flip until stopped (the automine loop has no proposer
  check).
- The PXE proves client transactions on the local network (`proverEnabled: !PROVERLESS`, `wallet.ts:69`;
  `realProofs: false` affects the node's verification).
- The sponsored FPC published on a pinned version with the fixed salt lands at the funded address (the rig executes
  one sponsored transaction before any Yacana setup).
- A public Sepolia RPC with browser CORS exists for the default `VITE_ETH_RPC_URL` (probed from the served origin).
- WebAuthn accepts RP ID `yacana.network` from `v5.yacana.network` (the spec's rule; the e2e reuses its virtual
  authenticator across both origins).
- The next aztec.js changes the account class id (the `addresses` migration is needed then, harmless if not; tested
  both ways).
- A pruned version restarted as a follower re-syncs and the wallet shows the undone burn (H5's reconciliation is
  time-boxed; the UX claim is made only when the balance is back).
- `forge-std` is on npm (else vendored).

**Asks (owner; resolved at the gate)**
- A1 The V6 continuation skips the launch lottery (its seed is derived from V5's public state and announced ahead).
- A2 viem-only in-app Ethereum wallet (injected provider) instead of wagmi.
- A3 The flip-only rig case in the PR gate of `harness.yml` (paths: `scripts/run/**`, `packages/{harness,portal,
  contracts,deploy}/**`), its budget set from P4's measurement; the full suite on `workflow_dispatch`.
- A4 The cap constants: `PER_HOUR = REWARD × N_CLAIMS × 3600 / EXPECTED_EPOCH_SECONDS × 3`, `ALLOWANCE = REWARD ×
  N_CLAIMS × 24`; the bounds 180 d / 30 d / 60 d; the 24 h deposit close in the UI.
- A5 The Safe's signers and threshold on Sepolia and mainnet; the forwarder key's custody; the default Sepolia RPC.
- A6 The FAQ as a landing section with a `/faq` rewrite (the canvas drew a standalone page with the landing's header).
- A7 The issuance bound as §2 states it: 3× the schedule, frozen at the observed flip; honest exits can be delayed
  in a competitive boom and refused at the deadline. Accept, or raise the multiplier (each ×1 adds one schedule's
  worth of attacker headroom).
- A8 The forward target: the canonical version if Yacana registered it (D18) rather than the strict successor.
- A9 Flip detection by any positive signal (D33); the old page keeps "or to Ethereum".
- A10 K2 forwarding by the holder's signature or an operator-listed forwarder (D37), or permissionless with the
  front-run-into-a-dying-version griefing accepted.
- A11 The hourly send cadence publishes per-hour win amounts on Ethereum; keep hourly (disclosed), or daily, or
  manual only.
- A12 The rehearsal runs on the branch's preview site and never deploys production; the apex switch and the `v5`
  Worker's custom domain go live after merge on the owner's call.

## 6. Phases with validation gates

Every gate includes the fast layers for the touched packages (`bun run lint`, typecheck, unit); heavier layers appear
where they matter. A phase is ✓ only when its gate passed and this file says so.

**P1 — the protocol: encodings, secrets, redeem keys, vectors, the toolchain module** (`packages/contracts/
yacana_bridge_hashes` + `Nargo.toml`, `packages/bridge`, `keys/derive.ts` exporting `hkdf`, `yacana.params.json`
domains, `params-codegen` incl. the vector codegen into the Noir crate, `scripts/run/toolchain.ts` extracted,
`toolchain.lock.json` + `toolchain.test.ts` covering `forge`/`anvil`/`cast`).
Gate: `bun run lint && bun run codegen && git diff --exit-code && bun test packages/bridge packages/miner-core
scripts && bun run contracts:compile && bun run contracts:test` (the Noir vector `#[test]`s pass; the TS vectors
match; the toolchain test passes with the three new hashes).

**P2 — the miner's bridge functions, counters, event, continuation constructor** (`bridge.nr`, `main.nr`,
`deploy.ts`, the record). TXE: send_ahead burns via an authwit and emits `ExitRecorded`; exit_to_l1 likewise;
`claim_from_l1` via `env.send_l1_to_l2_message`; `retire` from the portal stops claims, from another sender fails,
twice fails; `claim` after retirement reverts in public and leaves no mint; `first_epoch` continuity; the lottery
bypass.
Gate: `bun run contracts:compile && bun run contracts:test && bun packages/miner-core/scripts/export-layouts.ts &&
git diff --exit-code && bun run artifacts:commit && git diff --exit-code && bun run spike:gates && bun test
packages/deploy`.

**P3 — the portal, YACA, the L1 deploy script, the record** (`packages/portal` with its npm deps and remappings,
`packages/deploy/src/bridge/portal.ts`, `packages/deploy/scripts/l1-deploy.ts --anvil`, `portal.yml` incl. the ABI
diff). Foundry: the hash vectors incl. `RETIRE_SECRET_HASH`; register write-once with the index check (out of order
too); `_sync`/`noteTransition` against a mocked Registry (recorded on the first call that sees the index, monotone,
never rewritten, `afterNextAt` for an unregistered middle version); `retire` once, allowed while paused; forward per
leaf with the mocked Outbox (`AlreadyNullified` replay, wrong version, wrong recipient, a batch continuing past a
failure); K2 forward by a forwarder, by the holder's signature, by neither (revert), wrong target, target's index
not greater; deposit `expectedVersion`/`deadline`/paused; redeem (valid, wrong signer, expired, before 30 d, replay,
a cross-epoch leafId replay, over the cap, paused, past the deadline); the rate limit (`exited + amount ≤ cap +
inbound` with an inbound-funded version before its first exit, growth on wall time, frozen at the observed flip,
`WaitsForHeadroom`); pauses per version (up-front accounting, refund on unpause, the 30/60 d bounds, a dormant
version, an exhausted budget, `pauseAll` over three versions, the deadline extension); the deadline with and without
an observed `afterNextAt`; invariants: `yaca.totalSupply == Σ minted − Σ burned`, `exited ≤ cap(flipAt) + inbound`.
Gate: `bun run portal:build && bun run portal:test && git diff --exit-code packages/portal/abi && bun
packages/deploy/scripts/l1-deploy.ts --anvil` (its own `aztec-anvil`; deploys, verifies code and the record) `&& bun
run lint:actions`.
— arc 1 boundary: the codex loop, then `gh stack add bridge-harness` —

**P4 — the flip alone** (`scripts/run/upgrade-rig.ts`, `packages/harness` H0, `harness.yml`). No Yacana: boot with a
60 s vote, `deployNext` (the genesis root from `computeExpectedGenesisRoot`'s inputs), the payload, deposit ≥ 2e24,
propose, warp + mine, vote, warp + mine, execute; assert the Registry, distinct versions and boxes; quiesce (pause +
`syncPoint`) and stop V5, start the pinned V6 node (its genesis check passes by construction — the first run proves
it), publish the sponsored FPC, one sponsored transaction, V6 settles a checkpoint (a non-zero Outbox root); `flip`
twice (V7) in one run; the run's wall time and the proof-window headroom of every warp recorded in the case's
output and copied into this plan (A3's budget).
Gate: `bun run rig -- flip` green locally and as `harness.yml`'s PR job, filtered on `scripts/run/**` and
`packages/{harness,portal,contracts,deploy}/**`, `workflow_dispatch` for `all`.

**P5 — the migration cases and the operator script** (`packages/deploy/src/bridge/*`, `packages/harness` H1–H11).
H1 K1 round trip on V5 (replay refused) — real proving once for the mined balance, simulation on reruns; H2 K3
deposit + `claim_from_l1` (`waitForL1ToL2MessageReady`, nudge blocks); H3 the migration V5 → V6, in this order:
send_ahead → settled → forward refused (no registered canonical) → flip → `noteTransition` → `retire(V5)` consumed
on V5 → claim on V5 refused → post-flip window (one more settled checkpoint on V5) → quiesce and stop V5 → start V6
→ deploy the V6 miner + token from V5's last epoch → `register(V6, 1)` → one K2 forwarded by the forwarder key, one
by the holder's signature → `claim_from_l1` on V6 → one real W claim on V6 at the continued index; H4 send_ahead
after the flip while V5 still settles; H5 never settled, on V6 → V7 (V6 pinned with auto-prove off: send_ahead on
V6, stop V6 before it settles, flip to V7, V7 quiesced, a warp past the proof window, `clock.prune` on V6's
Rollup; L1 assertions: roots zero, forward reverts `Outbox__NothingToConsumeAtEpoch`, the pending tip rewound;
then, time-boxed, a V6 follower restarted pinned and the wallet's balance back — the UX claim only when it is); H6
no registered canonical 30 d → redeem (under cap/pause/deadline), then a late register + forward reverts nullified;
H7 V5 → V7 with V6 in the Registry but unregistered by Yacana → forward into V7, and V5's deadline from V7's
observed activation; H8 Ethereum round trip accounting (`totalSupply`, net allowance); H9 pause / limit / deadline
boundaries on the live portal incl. `pauseAll`; H10 an unregistered L2 sender is unconsumable; H11 a K2 forwarded
by a stranger reverts, and the script refuses a target whose registered miner differs from the record. Every action
through the operator script's functions; witnesses archived.
Gate: `bun run rig -- all` green locally; `e2e.yml` gains a `rig` job on `workflow_dispatch`; `bun test
packages/deploy packages/harness` (unit parts) green.
— arc 2 boundary: the codex loop, then `gh stack add bridge-miner` —

**P6 — the site layer and the bridge modules in the miner** (`eth-rpc.ts`, the guard's second slot,
`connection.ts`, `host.ts` (create/restore split, `versioned`), `config.ts`, `site.env`, `packages/web-miner/src/
bridge/*` with `queue.ts` and the atomic index reservation, `keys/store.ts` fingerprint + `addresses`,
`feePayer.ts`, `controller.ts` pause reason, `main.tsx` scoping, `tests/vault.bun.test.ts`).
Gate: `bun run lint && bun test packages/site packages/web-miner packages/bridge && bun run test:components &&
bun run --cwd packages/web-miner typecheck && bun run --cwd packages/web-miner test:replay` — the vault test opens
an existing sealed v1 record, adds the fingerprint, refuses a wrong phrase under a changed class, migrates
`addresses` both with an unchanged and a changed class; a queue test proves two concurrent sends get distinct
indices.

**P7 — the guided path UI and the everyday bridge** (`MigrationCard`, `SendAheadSheet` with the switch, `ArrivalCard`
and its states incl. the always-offered Claim, `ToEthereumSheet`, `DepositSheet`, `BridgeTile`, `TakingLongDialog`,
`EthRpcTile`, `OldTabNotice`, Settings). Copy overrides of `ux-brief.md` (D22): "usually under an hour to Ethereum"
→ "when V5 settles the epoch, usually within a few epochs"; "the relayer forwards it within the hour" → "Yacana
forwards exits by hand; the last forward was N ago; forward it yourself any time"; "relayer quiet > 1 h" → a
`held`/`ready` crossing older than the stated age; "arrives by itself" kept only for the landing claim at sign-in.
Vitest specs per feature; the browser migration e2e on the rig: `e2e/bridge.e2e.ts` (a V5-profile build and server:
sign in, send ahead; the flip; a V6-profile build and server: sign in, land — real proving, the proof inventory
updated; the run builds twice because the expected deployment is build-time) plus proverless state specs in a
`bridge` shard.
Gate: `bun run test:components && bun run rig -- browser && bun run e2e:agent -- bun run --cwd packages/web-miner
test:e2e` (the existing shards untouched).

**P8 — the versioned origin** (`Retired.tsx`, `VITE_APP_ROLE=old`, `assemble.ts` role/out + the fail-closed
role/origin check, `v5/wrangler.jsonc`, `build.json.{role,miner}`, `hostKind === 'versioned'`, `OldTabNotice` on
deployment identity).
Gate: `bun test packages/site && bun run site:build && YACANA_APP_ROLE=old bun run site:build && bun run e2e:agent --
bun run site:e2e` (both roles: identical headers, `build.json.role`, a mismatched role refused; the old-tab notice on
a same-rollup redeploy) `&& bun run rig -- origin`.
— arc 3 boundary: the codex loop, then `gh stack add bridge-stats-docs` —

**P9 — stats, the announcement lines, the FAQ** (`/stats/bridge`, the bridge beat, Etherscan links, Verify's new
chips; the landing `Alert` and `sections/Faq.tsx` + `/faq` rewrite).
Gate: `bun run test:components && bun run --cwd packages/web-stats test:visual && bun run e2e:agent -- bun run
--cwd packages/web-stats test:e2e && bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e`.

**P10 — docs, CI, records** (`docs/bridge.md`; `docs/upgrades.md` written as the rig's steps with the operator
script's entrypoints — minute one: `noteTransition` and `retire`; announcing is a site redeploy with the migration
block; the forwarder key's use; the old origin maintained with the apex and taken down after its deadline; the
preview-first rehearsal and the post-merge production deploys; `docs/threat-model.md` rows, `docs/deployments.md`,
`docs/roadmap.md`, README, CLAUDE.md, `implementations-plan/index.md`; `contracts.yml` filter, `harness.yml`,
`e2e.yml` jobs, `web-miner.yml`, `site.yml` exclusion).
Gate: `bun run lint && bun run lint:actions && bun run lint:shell`; every runbook step names an operator-script
entrypoint the rig exercised (no prose-matching test).

**P11 — the testnet rehearsal** (from the arc-4 branch, no merge and no production deploy: Sepolia — the Safe, YACA
+ portal deployed and verified on Etherscan, a forwarder set; the testnet profile redeployed with the bridge and
launched per `docs/deployments.md` (a new record; the previous deployment keeps running); the branch's preview site
verified against the new record; the `v5` Worker's preview version serving the frozen record (proves role, headers
and sign-in only: that miner has no bridge functions); one K1 minted on Sepolia, one K3 claimed, one K2 held with
its witness archived; the record and docs updated; the K2 landing recorded as pending validation).
Gate: the explorer links and the preview URLs in `docs/deployments.md`; `bun run epoch:stats` on the new profile;
`bun run bridge -- status` reporting the three crossings; `bun run site:build` for both roles green. The apex
switch and the `v5` custom domain are §7's post-merge steps.
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
arc's fix loop and the final cross-arc pass converged; the rehearsal (P11) runs from the arc-4 branch on preview
deployments and needs no merge (C, F). Merges are the owner's call, after Delivery. After the merges, two production
deploys are the owner's explicit call and never a branch action: `bun run site:deploy` with the new record (the
apex switch) and the `yacana-v5` Worker with its custom domain.

## 8. Decision ledger

Sources: owner (O), Codex round 1 on the mechanism (C1), Codex round 2 on the guided path (C2), the Fable UX critic
(FU), the Fable adversarial critic (FA), the three drafts: main (M), codex (C), fable (F); the contradiction check:
codex (CC), fable (FC); audit round 1: codex (CA1), fable (FA1).

| # | decision | source | rejected alternatives |
|---|---|---|---|
| D1 | Bridge permanent from launch; ERC-20 + private relay through Ethereum | O | migration windows only |
| D2 | Old app at `v5.yacana.network` | O | same-origin `/v5/mine`; swap at window close |
| D3 | No relayer bot in this plan; operator script (forwarder key) + self-forward | O | homelab service; Worker cron |
| D4 | Ethereum reads from the browser via an RPC setting | O | Worker proxy |
| D5 | Plain multisig, no timelock; pause bounded | O | timelock |
| D6 | Retire message instead of an epoch cutoff | C1 | lazy cutoff |
| D7 | Successor by Registry history index | C1 | `N+1` arithmetic on ids |
| D8 | Exit deadline = later of (observed activation of Registry index i+2, flip + 180 d) + paused time; K6 redemption; transitions recorded lazily by every entrypoint | C1, C, CC, CA1 | one hop (confiscation); a Yacana-registered-based deadline (FC S2); records only through `retire` (M) |
| D9 | The cap grows on wall time from `launchAt` and freezes at the observed flip: the bound is `cap(flipAt)` = 3× the schedule for every version; pauses extend the deadline, never the cap; honest exits can be delayed in a boom and refused at the deadline (Ask A7) | FA1 (resolving CA1) | growth to `flipAt + 180 d` minus paused time (FC B2 — retracted by FA1); frozen at `flipAt` minus paused time (draft 3, F); a finite competitive allowance (C); "never refused" (M) |
| D10 | Deposits carry expectedVersion + deadline; refused while the version is paused | C1, FA1 | plain deposit |
| D11 | Verb "Send ahead" | FU, C2 | "Commit" |
| D12 | One switch: hourly sends + landing at sign-in; consent scoped `{account, deployment, operation, expiresAt}`; Claim always offered | FU (adapted by M), CA1 | auto-commit at the flip (C2 rejected) |
| D13 | Per-send proof deadline shown; missed → undone onto the old version (H5 verifies pruning) | C2, CC | "lost" |
| D14 | The miner carries the bridge (one registered address per version) | M, C, F | a separate exit contract |
| D15 | K4 content = `claim_from_l1(uint256)` ‖ amount | F | `H(4, amount, secretHash)` |
| D16 | K6 by EIP-712 over `(version, epoch, leafId, contentHash, recipient, expiry)` with a per-exit redeem key; under the same cap, pause and deadline as a forward | C2, C, F, CC, FC B3 | a bearer secret; `(version, leafId, recipient, expiry)`; one wallet-wide key |
| D17 | Transitions by observation: the first portal call that sees the Registry above an index records `now`; `noteTransition` permissionless; no GSE | C, CA1 | the GSE trace with a fallback (M + F, CC, FC B1); a sandwich rule on the trace (FA1 — defeated by a split payload) |
| D18 | K2 forwards into the canonical version if Yacana registered it (index greater); K6 for "no registered canonical" (Ask A8) | M | strict successor (F, C, FC conceded) |
| D19 | `retired` checked in private for feedback and in public `record_claim` authoritatively | C, F | private only |
| D20 | `packages/bridge` as the shared TS client, `bridge → miner-core` only; vectors codegen'd into the Noir crate; `hkdf` exported from `keys/derive.ts` | C, FC, CA1 | bridge code inside `miner-core` (M, F) |
| D21 | viem (`import 'viem'`, the hoisted alias) through the injected provider; no wagmi (Ask A2) | F, FA1 | wagmi (O's literal answer) |
| D22 | No-relayer copy, no promised cadence: "Yacana forwards exits by hand; the last forward was N ago; forward it yourself any time"; `TakingLongDialog` opens on a crossing's age | C, FU, CC, FC S4 | "the relayer forwards within the hour" (the canvas); "a few times a day" (M) |
| D23 | The rig owns its network (`bun run rig`), cases in `packages/harness`; `deployNext({bump})` reads the Rollup's version; `flip()` repeatable and cross-checks the Registry; the genesis by `computeExpectedGenesisRoot` (no spike) | C, M, FC S5, CA1, FA1 | cases under `e2e:agent` (F); a genesis spike (M) |
| D24 | H5 "never settled" on a pinned V6 → V7 (auto-prove off), never a restarted V5; `prune`, L1 assertions, then a time-boxed follower reconciliation | C, F, CC, FA1 | V5 restarted pinned (M — its genesis is not reproducible) |
| D25 | Quiesce = admin `pauseSequencer` + the serial queue's `syncPoint` before clock changes; prove a pinned node accepts a sponsored tx before deploying Yacana; the flip job's budget measured | C, CA1 | pause alone (M) |
| D26 | The public event `ExitRecorded` read by `getPublicLogsByTags` (the landing scan uses the portal's events instead) | F, FA1 | a storage log |
| D27 | Continuation constructor `(target, seed, launch_at, first_epoch, portal)`, lottery bypassed when `first_epoch > 0`, a versioned record | M, C | carrying supply |
| D28 | `MasterRecord` keeps `v: 1` and its AAD; a master fingerprint added at open and checked before any derivation; optional `addresses: {[classId]}`; snapshot key `yacana.balance.v1.<chainId>.<rollupVersion>.<token>.<account>` | FA, F, CC, FA1 | bumping `v` (breaks decryption); the address check alone (a wrong phrase opens a wrong account under a new class) |
| D29 | The FAQ as a landing section + `/faq` rewrite | F, C | a fourth app; a second Vite entry (M) |
| D30 | The old app is a build with `VITE_APP_ROLE=old` on a second Worker; `versioned` = the host of `VITE_OLD_APP_ORIGIN`; role ⇔ origin enforced at boot and in `assertProductionArtifact`; keys create/restore split; the origin is a fully trusted sibling, maintained then retired | F, FC S3, CA1 | runtime hostname role only (M); treating the role check as secret protection |
| D31 | Operator script in arc 2; deploy-script/record changes in arc 1; K2 landing on testnet = pending validation; the rehearsal from the arc-4 branch on preview deployments; production deploys after merge on the owner's call (Ask A12) | C, F, CC, FA1 | a merge precondition (M); `site:deploy` from the branch (the drafts — overwrites the apex) |
| D32 | Fee payer abstracted (`FeeProvider`); mainnet decides later | O | Yacana FPC now; fee juice |
| D33 | Flip detection by precedence: any positive signal → `flipped`; `unknown` only when the Registry read is silent with nothing positive; readiness and retirement are separate states (Ask A9) | CC, FC S1 | a conjunction (M) |
| D34 | H3's order: retire and stop V5 before V6's miner exists; register after deploying it; forward after registering | CC | register before deploy (M) |
| D35 | `RETIRE_SECRET_HASH` pinned in Solidity with a vector; a second L1 `retire` sends no leaf; `retire` allowed while paused | FC nits | — |
| D36 | Announcing (`VITE_MIGRATION`) is a site redeploy; the runbook says so | FC nit | a runtime config fetch |
| D37 | K2 forwarding by the holder's redeem-key signature or an operator-listed forwarder; K1 permissionless (Ask A10) | CA1 | permissionless K2 forwarding (the drafts) |
| D38 | `PER_HOUR`, `ALLOWANCE` and the day bounds immutable in the portal; `registerVersion(version, index, miner, launchAt)` with the index checked against the Registry | CA1, FA1 | operator-set caps per version (the drafts); an index scan (M) |
| D39 | Pauses per version, accounted up front, refunded on unpause; `pauseAll` loops the registered versions | CA1 | a global scalar with lazy unions (M) |
| D40 | Every bridge operation in the app runs through one queue; the exit index is reserved in the journal's transaction after a rescan of the account's own hashes; a cross-device collision links two exits and loses nothing (disclosed) | CA1 | serialisation through `track` (M — it is a drain join) |
| D41 | `harness.yml` owns the flip job, filtered on the rig's inputs | FA1 | the flip job in `contracts.yml` (M — fires on UI PRs) |
| D42 | `@openzeppelin/contracts` and `forge-std` from npm under the 7-day gate, remapped; vendored if missing | FA1 | submodules (the drafts) |
| D43 | `forge`, `anvil`, `cast` hashed in `toolchain.lock.json`; the deploy script reads its key from env | CA1, FA1 | an unpinned toolchain; `--private-key` |
| D44 | The wrong-registration disclosure covers stranded K2s; the forwarder script and the app refuse a target whose registered miner differs from the record | FA1 | the cap-only disclosure (M) |

Disputed items surfaced as Asks A7–A12 rather than resolved silently (CC, FC, CA1, FA1).

## 9. Audit verdicts

**Contradiction check (one round).** Codex (`response-3`): 6 blockers, 8 should-fix — adopted: the accounting
inequality restored (D9 text, P3), the redeem binding (D16), the transition fallback (D17, since superseded), the
H3 order (D34), the delivery decoupled from merges (D31), transition accounting independent of registration (D8),
H5's pruning + reconciliation (D24), flip-detection precedence (D33), no timing promises (D22), per-exit redeem keys
(D16), the AAD-safe record migration (D28), the per-origin vault fact (§5), D9/D18/threshold surfaced as Asks.
Rejected: none. Fable (inline report): 3 blockers, 5 should-fix, 6 nits — adopted then: B1 (superseded by D17's
reversal), B2 (superseded by D9's rewrite), B3, S1, S3, S4, S5, the nits. Rejected: S2's Yacana-registered deadline
(D8).

**Audit round 1.** Codex (`audit-codex.md`): "reject pending the blockers" — 7 blockers, 8 should-fix, 8 inference
checks; every finding verified against the sources and adopted (D17 reversed to observation time; D8 lazy sync; D9
made honest about competitive exhaustion; D38 immutable policy; D39 per-version pauses; D37 K2 forward
authorisation; D40 the queue; the HKDF and index rules; consent scope; the trusted sibling origin; the quiesce
semantics; `toolchain.ts` in P1; the workspace and CI wiring; the settlement wording; D43; the genesis by
construction; the inference verifications in the gates; no prose-command test). Fable (`audit-fable.md`): "ship
after the listed fixes" — 4 blockers, 8 should-fix, 12 nits; adopted: D9 frozen at the flip on wall time (its own
contradiction-check exclusion retracted), D24 on a pinned V6, D31 preview-only rehearsal, the master fingerprint,
D41, no genesis spike, the double-build browser e2e, D44, the old origin's rehearsal scope, D42, the vault test, and
every nit. Rejected: the GSE sandwich rule (D17 reversed instead — a split payload defeats it, its own nit 21).
Disagreement logged: Fable kept D17 with a sandwich rule, Codex reversed it; the reversal wins because observation
is monotone, self-healing and needs no vendored GSE.

_Audit round 2 and the final codex verdict follow here._

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
   `gh pr checks --watch`. `gh stack merge` is the owner's call, and so are the two production deploys after it (§7).
   Then mark `implementations-plan/index.md`.

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
