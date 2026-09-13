---
plan: yacana-bridge
tier: mega-deep
driver: claude-code
eli5_mode: artifact
code_review: off
budget: "recon 4 agents (1 reuse sweep, 3 subsystem mappers); codex at high (GPT-6 Astra); fable legs on Fable 5.1"
status: approved 2026-09-12 — the owner's nine answers folded in; final codex re-check APPROVE; implementing from P1
created: 2026-09-12
---

# yacana-bridge — the Ethereum bridge, the cross-rollup migration, the upgrade harness, the runbook

Design inputs (read first): `design-spec.md` (the mechanism, drafts 2 + 3 deltas; §8 amends it), `ux-brief.md` (the
guided path; §6 P7 lists the lines this plan overrides), the design canvases "Yacana Bridge Take Two" (the UI spec)
and "Yacana Bridge and Migration" (take one, the checkpoint). `recon.md` and `research/` hold what the codebase and
the Aztec 5.2.0 sources offer. The three independent drafts are `plans/{main,codex,fable}.md`; this plan
consolidates them (§8 says which decision came from where), the contradiction check and two audit rounds (§9,
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
claims (a fee-payer function ships; the sponsored FPC stays on testnet), Sepolia-only rig runs, fixed denominations,
the hourly automatic send-ahead of new wins (dropped at approval as a deferred feature: sends are manual, landing is
a one-tap Claim).

## 2. The mechanism (summary; `design-spec.md` as amended by §8)

- **Kinds**: K1 to-Ethereum (mint YACA to an address), K2 send-ahead (held on Ethereum, forwarded into the canonical
  version if Yacana registered it, or redeemed to YACA by its holder at any time), K3 deposit (burn YACA on Ethereum,
  mint privately on Aztec), K4 the inbound claim, K5 retire (the portal → the old miner: mining ends), K6 redeem (a
  held K2 becomes YACA on Ethereum, authorised by the exit's redeem key, under the same cap, pause and deadline as a
  forward).
- **Portal rules**: sender/version checks on each version's own boxes; Registry transitions recorded by
  *observation* — the first portal call (any state-changing entrypoint, or the permissionless `noteTransition`)
  that sees the Registry's `numberOfVersions()` above an index records that index's activation as `now`; observed
  times are never earlier than the true flip, so nobody can shorten a holder's window, and no oracle is needed
  (D17). The exit deadline is `max(observed activation of index i+2 (∞ until seen), flipAt(i) + 180 d) +
  pausedSeconds`. The rate limit is `exited − inbound + amount ≤ cap` with `cap = ALLOWANCE + PER_HOUR ×
  hours(launchAt → min(now, flipAt))`, saturating at `ALLOWANCE` before `launchAt`: the cap grows on wall time for
  the version's life and freezes at the observed flip, because retirement ends honest minting minutes after it
  (D9); before the flip a leaf over the cap waits and stays consumable; after it the frozen remainder is all that
  can ever leave. Pauses are per version (`pauseAll` loops the registered ones), ≤ 30 d per call and ≤ 60 d per
  version, accounted up front; they neither add nor remove cap, they extend the deadline. `PER_HOUR`, `ALLOWANCE`
  and the bounds are immutable policy set at deployment (3× the schedule, one day's allowance); `launchAt` is an
  operator input bounded to `[now − 7 d, now + 90 d]` at registration: the operators choose which miner a version
  trusts and may move its cap by at most a week's growth, never more (D38). A K2 is forwarded only by its holder (a
  signature by the exit's redeem key) or by an operator-listed forwarder; K1 forwarding is permissionless (D37).
  Deposits into a version close when the operators say so before an announced flip (D48).
- **The bound, plainly**: a compromised old version can never issue more than `cap(flipAt)` net of what was
  deposited into it — three times what its schedule could have minted, plus a week — before its deadline closes;
  the pause defers, the deadline ends. The cap is a tripwire, not a proof of honesty: in a competitive boom honest
  production can exceed the schedule (epochs close on N claims with no minimum duration, `main.nr:188-193`), so an
  honest exit can be delayed and, once the cap is frozen and exhausted, refused (A3, accepted).
- **Safety**: a send is safe once its epoch is settled on L1 (each epoch has a proof deadline the UI shows); a missed
  deadline prunes the epoch and the burn is undone onto V5; V5 keeps producing and settling after the flip only
  while its operators keep it running, without a lifetime signal; balances left on a stopped chain are lost.
- **The path**: one card, one button (Send ahead, kept on the card while V5 holds anything), a one-tap Claim on the
  arrival card at V6 sign-in; the card is the status; the flip card names the bet and shows V5's block and settled age;
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
  `first_epoch` with the constructor's target and a seed `genesis_epoch_seed(H(DOM_SEED, seed of the source's last
  epoch), 0, now)` — the source's seed is derivable by anyone from its public storage, and mixing the actual open
  timestamp makes pre-mining cost one attempt per candidate slot (A1, accepted: the exposure is bounded by one epoch's
  reward); the deployment record names the source deployment, its last epoch, target and seed (C). No balance or
  supply carried.
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
- `record_exit` / `record_inbound` — `#[only_self]` public: bump the counters and emit the exit twice: the public
  event `ExitRecorded { index: u64, kind: u8, amount: u128, hash_or_tag: Field, recipient_or_redeem_key: Field }`
  under its type tag (`emit_event_in_public`; the operator enumerates it with `getPublicLogsByTags` and its
  `afterLog` cursor, 20 logs per call) and the same payload under `compute_log_tag(hash_or_tag, DOM_EXIT_LOG)`
  (`emit_public_log_unsafe`; the owner asks for its ≤ 20 candidate tags in one call and never walks the version).
  Every field a forwarder needs, never a secret (F).
- The content hashes in a library crate `packages/contracts/yacana_bridge_hashes` (added to the Nargo workspace's
  `members` and to the miner's dependencies); its `#[test]` vectors are codegen'd from
  `packages/bridge/fixtures/bridge-vectors.json` by `scripts/params-codegen.ts` (a Noir test cannot read JSON) (F).
  `yacana.params.json` gains `$domains` `EXIT`, `EXIT_LOG` and `REDEEM`; the retarget/ticket/claim circuits are
  untouched.

**L1, once — `packages/portal` (Foundry; `aztec-forge` 1.4.1 from the toolchain, its binary hash added to
`toolchain.lock.json` with `anvil` and `cast`).** `src/YACA.sol` (OpenZeppelin ERC20; `mint`/`burnFrom` portal-only;
the portal deploys it in its constructor, no circular init — C; the minter is immutable, A9),
`src/YacanaPortal.sol`, `src/YacanaHashes.sol` (the encodings, plus the pinned constant `RETIRE_SECRET_HASH =
compute_secret_hash([0])` with a vector — never computed on L1), `src/aztec/` (tag-pinned copies of `IRegistry`,
`IHaveVersion`, `IInbox`, `IOutbox`, `DataStructures`, `Hash`, `Epoch`, the Outbox/Inbox errors; source commit in
`src/aztec/VENDORED.md`), `script/Deploy.s.sol` (reads the deployer key from env inside the script, never from
`--private-key`), `test/` (the real `Outbox` and `Inbox` with `FrontierLib`, `MerkleLib` and `Hash` vendored under
`test/aztec/` and deployed with the test contract as their rollup — `insert` is `onlyRollup`, so the test drives
real roots and real nullifiers; only the Registry is a mock; the hash vectors; fuzzed accounting; invariants),
committed `abi/` (CI diffs after build). `@openzeppelin/contracts` and `forge-std` come from npm under the 7-day
gate (`packages/portal/package.json`, `remappings.txt` into `node_modules`; vendored if a package is missing), never
as submodules (no `.gitmodules` exists and checkout fetches none). `bun run portal:build|test` wrap
`toolchainBin('aztec-forge')` from `scripts/run/toolchain.ts` (extracted in P1).

Portal storage: `IRegistry immutable registry`, `YACA immutable yaca`, `address operators` (an EOA on Sepolia; the
Safe with the mainnet plan, A4), the immutable policy `PER_HOUR`, `ALLOWANCE`, `EXIT_FLOOR = 180 d`, `PAUSE_MAX = 30 d`, `PAUSE_BUDGET =
60 d`, `LAUNCH_BACKDATE = 7 d`, `LAUNCH_AHEAD = 90 d`, `LEAF_GAS`; `mapping(address ⇒ bool) forwarders`;
`uint256[] registeredVersions`; `mapping(uint256 index ⇒ uint64 observedAt) transitions` (when the portal first
saw the Registry hold a version at that index; 0 = unseen); per version `VersionInfo { bytes32 miner; uint64
registryIndex; uint64 launchAt; uint64 pausedUntil; uint64 pausedSeconds; uint128 exited; uint128 inbound; bool
registered; bool retireSent; bool depositsClosed; }`.
Derived: `flipAt(v) = transitions[index + 1]`, `afterNextAt(v) = transitions[index + 2]`, `cap(v) = ALLOWANCE +
PER_HOUR × saturatingSub(min(now, flipAt or now), launchAt) / 3600`, `deadline(v) = max(afterNextAt or ∞, flipAt +
EXIT_FLOOR) + pausedSeconds` (defined once `flipAt` is set), `headroom(v) = cap(v) + inbound − exited`.
Functions:
- `_sync(version)` — internal, first in every state-changing entrypoint: `n = registry.numberOfVersions()`; for
  `k ∈ {index, index + 1, index + 2}` with `n > k` and `transitions[k] == 0`, set `transitions[k] = now` and emit
  `TransitionObserved(k, now)`. A record made by a call that later reverts is rolled back with it, so
  `noteTransition` is the persisted step the app and the script call before anything that depends on `flipAt`.
- `noteTransition(index)` — anyone: the same record for any index the Registry already holds; the runbook's
  minute-one call together with `retire`.
- `registerVersion(version, index, miner, launchAt)` — operators, write-once, requires `registry.getVersion(index)
  == version` (no scan; out-of-order registration works) and `launchAt ∈ [now − LAUNCH_BACKDATE, now +
  LAUNCH_AHEAD]`; appends to `registeredVersions`; `_sync`.
- `retire(version)` — anyone: `_sync`; requires `flipAt` recorded (else `FlipUnrecorded`) and the version
  registered; sends K5 into that version's Inbox with the miner as recipient and `RETIRE_SECRET_HASH`, exactly once
  (`retireSent`); allowed while paused (it is not an exit); emits `Retired`.
- `forward(version, ForwardArgs)` / `forwardMany` — `_sync`; each leaf runs through a self-only
  `forwardOne(caller, version, args)` that receives the original `msg.sender` explicitly, under a per-leaf gas bound
  (`LEAF_GAS`, so a try/catch never swallows an out-of-gas leaf), and a batch continues past a failed leaf;
  consumes the Outbox leaf on that version's own Outbox (the message rebuilt with that version's number and the
  portal as recipient); requires not paused, the deadline open, `exited − inbound + amount ≤ cap` (else
  `WaitsForHeadroom`, the leaf stays consumable); kind 1 → anyone; `yaca.mint(recipient, amount)`; kind 2 →
  `caller ∈ forwarders` (the portal itself never is), or `args.sig` is the K2's `redeemKey`'s EIP-712 signature
  over `Forward(version, epoch, leafId, contentHash, target, expiry)`; `target` must be the canonical version,
  registered, with an index greater than this one → `inbound[target] += amount`, `Inbox(target).sendL2Message(
  L2Actor(minerOf[target], target), K4, secretHash)`; `exited[version] += amount`; emits `Forwarded(version,
  leafId, kind, amount, aux, target, inboxIndex)`.
- `deposit(amount, secretHash, expectedVersion, deadline)` — requires `registered` first, then `_sync`; reverts
  unless `expectedVersion` is canonical, not paused, deposits open and `now ≤ deadline`; `burnFrom(msg.sender)`;
  `inbound += amount`; emits `Deposited(version, sender, amount, secretHash, inboxIndex)`.
- `redeem(version, ForwardArgs, recipient, expiry, sig)` — a kind-2 leaf; `_sync`; the same pause, deadline and cap
  checks as `forward`, no waiting period (the holder alone decides between forwarding and redeeming, so a delay
  protects nobody); EIP-712 (domain `YacanaPortal`/chainId/portal) over `Redeem(version, epoch, leafId,
  contentHash, recipient, expiry)`; `ECDSA.recover` must equal the K2's `redeemKey`; consumes the leaf (one
  nullifier for forward and redeem) and mints; no secret revealed.
- `pause(version, seconds)` / `pauseAll(seconds)` / `unpause(version)` — operators; a call ≤ `PAUSE_MAX`;
  `pausedSeconds + seconds ≤ PAUSE_BUDGET`; `pausedUntil = max(now, pausedUntil) + seconds`, `pausedSeconds +=
  seconds`; `unpause` refunds `max(pausedUntil − now, 0)` and sets `pausedUntil = now`; `pauseAll` loops
  `registeredVersions`, skipping a version whose budget is exhausted (`PauseSkipped`).
- `closeDeposits(version)` — operators, one-way: the runbook's step 24 h before an announced flip, so no deposit's
  Inbox message can be stranded on a stopping version; the UI's 24 h close mirrors it.
- `setForwarder(address, bool)` — operators.
- views: `versionInfo`, `cap`, `headroom`, `deadline`, `flipAt`, `transition(index)`.

**The rig — `scripts/run/upgrade-rig.ts` + `packages/harness`.** The rig owns the whole network lifecycle (it is not
nested in `e2e:agent`), and it never moves L1 time itself while an automine node runs: the automine sequencer owns
L1 time and serialises builds, warps and settlement in one queue, so every warp goes through the running node's debug
`warpL2TimeAtLeastTo` / `warpL2TimeAtLeastBy`; anvil's cheat codes are used only when no node is alive.
`startUpgradeRig({ votingDuration: 360 })` boots the isolated network through the exported `startIsolatedNode` with
`AZTEC_GOVERNANCE_VOTING_DURATION=360` (five 72 s slots: the node's warp rounds its target up to the next slot
boundary and publishes an empty checkpoint there, `automine_sequencer.ts:586-602`, so a one-minute window can close
between the warp's landing and the vote's inclusion; the rig asserts every governance transaction lands inside its
window), records the genesis inputs, addresses and config, and funds its own L1 signer
(anvil account 1) with the staking asset by one deployer `mint` while the sequencer is paused (the deployer key is
the live node's publisher; two clients on one EOA would race nonces); `deployNext({ bump })` calls
`deployRollupForUpgrade` under the rig's key with the current canonical's config from `getL1Config` and exactly one
change (`manaTarget + bump`), committee 0, slasher off, real verifier off, epoch 4, proof epochs 2, slot 72, inbox
lag 2, a genesis root computed with the pinned node's own formula composed from exported helpers
(`getInitialTestAccountsData` from `@aztec/accounts/testing`, the sponsored FPC address as `wallet.ts` computes it,
`getGenesisValues` from `@aztec/world-state/testing`: test accounts + the sponsored FPC + prefund, no BananaFPC),
funds the new FeeJuicePortal through `FeeAssetHandler`, and reads the new version from the deployed Rollup's
`getVersion()` (never computes it: the Solidity and TS formulas differ, `RollupConfiguration.sol:132-145`);
`flip(next)` deploys the payload from the shipped ABI/bytecode, deposits ≥ 2e24 of the staking asset,
`proposeWithLock`, warps through the running node past `creation + votingDelay` (the warp lands on the next slot
boundary), votes inside the window, warps past `votingDuration + executionDelay`, executes, and asserts `getCanonicalRollup`, `numberOfVersions`, `getVersion(i)`,
distinct versions and boxes — repeatable for a second flip, and needing no node for the new version;
`postFlipWindow()` keeps the old node building and settling; `stopNode(v)` pauses the sequencer, then stops the
node (anvil and the run dir stay); `startNode(v, { autoProve })` runs `aztec start --node --sequencer
--registry-address … --rollup-version … --node-debug` with `USE_AUTOMINE_SEQUENCER=1` and
`AUTOMINE_ENABLE_PROVE_EPOCH=<autoProve>`, the same `TEST_ACCOUNTS`/`SPONSORED_FPC`/`PREFUND_ADDRESSES` the genesis
was computed from, `AZTEC_MANA_TARGET=<bumped>`, fresh data dirs, registry-claimed ports (lanes 4–6 for the second
node, 8–10 for a third: lanes 0–3 are the local network's); after a pinned node boots the rig compares its logged
genesis root with the one it computed, publishes the sponsored FPC on it (the fixed salt) and executes one sponsored
transaction before any Yacana setup; the local-network V5 is only ever stopped, never restarted (its genesis funds
BananaFPC and forces auto-prove on); `clock.warp` (the node's debug warp, or anvil when no node runs),
`clock.prove` (`aztecDebug_prove`), `clock.nudge` (two cheap L2 txs), `clock.prune` (`Rollup.prune` when
`canPruneAtTime`); `yacana.*` deploys Yacana on a version through `packages/deploy` and drives every bridge action
through the operator script's functions, so the runbook's commands are the tested ones. `scripts/run/toolchain.ts`
takes `toolchainBin`, `spawnDetached`, `jsonRpcReady` out of `isolated-node.ts` unchanged. Cases live in
`packages/harness/tests/*.bun.test.ts` under `describe.skipIf(!process.env.YACANA_RIG)`; `bun run rig -- <case|all>`
boots the rig and runs them; one automine sequencer at a time.

**The operator script — `packages/deploy/src/bridge/`** (`portal.ts` deploy YACA + portal; `register.ts`;
`transition.ts` (`noteTransition`); `retire.ts` (`noteTransition`, `retire` on L1, then the L2 `retire`);
`forward.ts` (enumerates a version's `ExitRecorded` logs with the cursor, fetches each witness with
`getL2ToL1MembershipWitness`, archives it to `deployments/witnesses/<profile>.jsonl`, forwards under the forwarder
key from env, and refuses a K2 target whose registered miner differs from the announced deployment record);
`deposits.ts` (`closeDeposits`); `pause.ts`; `status.ts`), exposed as `bun run bridge -- <cmd>`;
`packages/deploy/src/deploy.ts` gains the constructor args and writes `bridge: { chainId, portal, yaca, operators,
forwarders, l1Explorer, l1RpcUrl }` into the record; `packages/deploy/scripts/l1-deploy.ts` runs
`script/Deploy.s.sol` through `aztec-forge script` and records the addresses; with `--anvil` it starts its own
`aztec-anvil` on a registry port (no full node).

**The shared client — `packages/bridge` (TS, `viem` — the hoisted `@aztec/viem` alias; depends on `miner-core`,
never the reverse).** One workspace package for the browser, the operator and stats (C): `content.ts` (the
encodings), `secrets.ts` (derivation, the index scan by candidate tags), `portal.ts` (ABI + typed client),
`witness.ts` (leaf and witness helpers over `@aztec/stdlib/messaging`, and the archive reader), `journal.ts` (the
crossing record, its states exactly the state table's, a pure `advance(record, facts)` reducer), `queue.ts` (one
promise queue for every bridge operation), `recovery.ts` (the file schema, bound to chainId + portal),
`deadline.ts` (the per-epoch proof deadline from the rollup's constants over the RPC), `flip.ts` (the flip-signal
reducer).

**The apps.** `packages/site/src/browser/eth-rpc.ts` (parse under `parseNodeUrl`'s rule, probe `eth_chainId` and
the portal's code, save `Connection.ethRpcUrl`); `node-guard.ts` gains a second persistent admitted slot
(`setEthRpcEndpoint`) with its own health; `host.ts` gains `versioned` (the host of `VITE_OLD_APP_ORIGIN`) and
splits `keysAllowed` into create (production, preview, local) and restore (those plus versioned), with
`session.guardHost(kind)` per caller; `config.ts` + `site.env` gain `VITE_ETH_RPC_URL`, `VITE_L1_EXPLORER_URL`,
`VITE_OLD_APP_ORIGIN`, `VITE_MIGRATION` (the profile's `migration` block; announcing is a site redeploy),
`VITE_APP_ROLE` (from `YACANA_APP_ROLE`, mapped as `YACANA_PROFILE` is) and a per-role `VITE_PREVIEW_HOST_SUFFIX`
(the `yacana-v5` Worker's previews end in `-yacana-v5.…`); `assemble.ts` gains `--profile`, `--out`, `--role`,
copies `deployments/witnesses/` to `/witnesses/`, and `assertProductionArtifact` fails closed unless the
production pairing holds (`role === 'old'` runs on `versioned`, `preview` and `local` hosts and never on the
apex); `packages/site/v5/wrangler.jsonc` (Worker `yacana-v5`, custom domain `v5.yacana.network`, assets
`dist-v5`); `build.json` gains `role`, `rollupVersion`, `miner`. `packages/web-miner/src/bridge/` (`store.ts` —
journal + witnesses in IndexedDB `yacana-bridge` keyed by chainId·portal·account; the next exit index read and
incremented inside the transaction that creates its crossing (tabs share it), after a scan of the account's ≤ 20
candidate tags on the version's node, abandoned reservations kept, never reused; `flows.ts` — sendAhead /
exitToL1 / deposit / land / selfForward through `queue.ts` with the pause reason `'bridge'` (the controller's
`track` is a drain join, not a mutex — `controller.ts:438-449`); `landing.ts` — the sign-in scan over the portal's
`Forwarded`/`Deposited` events (the `inboxIndex` is enough; the old version's logs live on another node), deriving
candidates under both the source version's labels (forwarded K2s) and the current version's (deposits), surfacing
each claimable crossing on the arrival card behind a one-tap Claim (nothing sends or claims by itself: no
scheduler, no stored consent); `eth.ts` — wagmi's injected connector with EIP-6963 discovery (the picker lists every
installed wallet by name and icon; no WalletConnect) over the hoisted viem, a `WagmiProvider` and query client
scoped to the bridge features, chain switch, `deposit`, `forward` (the
holder's `Forward` signature by the exit's redeem key, gas from the injected wallet; `noteTransition` first when
`flipAt` is unrecorded; refused when the target's registered miner differs from the record; the witness from the
source node or, when it is gone, from `/witnesses/<profile>.jsonl` same-origin), `redeem`; `snapshot.ts` — the
last-seen balance per `yacana.balance.v1.<chainId>.<rollupVersion>.<token>.<account>` on every read, sealed under
the master like the vault's records and disclosed in the review); `keys/store.ts` keeps `v: 1` and the sealed
ciphertext untouched (the AAD includes `v`), adds a master fingerprint (`HKDF(master, "yacana.master.fp.v1")`,
written only after the address check passed under the current class) and an optional `account.addresses:
{[classId]: address}` filled at open by re-deriving with the build's class (a record whose stored address matches
no class migrates only after the fingerprint matches; one with neither is verified against the legacy class on the
apex — the build pins the previous account class id and recomputes the legacy address with
`computeContractAddressFromInstance`; a match writes the fingerprint and migrates, a mismatch is refused as a wrong
phrase; should a future SDK change make that recomputation impossible, the app offers a fresh restore on the apex
with the disclosure that a fresh restore has nothing to compare against — the old origin's vault is a separate
store and can fix nothing here); `wallet.ts` extracts `feePayer.ts` (a
`FeeProvider(operation)`); features `MigrationCard`, `ArrivalCard`, `SendAheadSheet`, `ToEthereumSheet` (the Send
sheet gains the destination row), `DepositSheet`, `BridgeTile`, `TakingLongDialog` (opens for a `held`/`ready`
crossing older than a stated age, not on a bot's silence), `EthRpcTile`, `OldTabNotice` (compares `/build.json`'s
`miner` and `rollupVersion` with the tab's and asks for a reload: a same-rollup redeploy is not caught by the PXE's
node fingerprint, and it is never "flipped"); `routes/Retired.tsx` renders the single-purpose page when
`VITE_APP_ROLE === 'old'` (Send ahead, a quiet "or to Ethereum", node/RPC/recovery file/self-forward under
"advanced"); `main.tsx` scopes `yacana.claims` by account and deployment. `web-stats`: route `bridge`, a bridge
beat, `features/Bridge*.tsx`, `explorer.ts` gains Etherscan, `routes/Verify.tsx` gains YACA/portal/operators/
forwarders. `web-landing`: the announcement `Alert` in the shell slot, `routes/Faq.tsx` — a standalone `/faq` page under the
landing's header (the six panels + the questions), served by the root SPA fallback and linked from the miner's
migration card, the stats bridge page and the landing.

### 3.2 Key interfaces

Content encodings (Noir `yacana_bridge_hashes`, Solidity `YacanaHashes`, TS `packages/bridge/src/content.ts`; the
first 4 bytes of keccak of the string, then 32-byte big-endian words, then `sha256_to_field` with the leading zero
byte as `Hash.sol` does):
- K1 `exit_to_l1(address,uint256,bytes32)` ‖ recipient ‖ amount ‖ tag
- K2 `send_ahead(uint256,bytes32,address)` ‖ amount ‖ secretHash ‖ redeemKey
- K4 `claim_from_l1(uint256)` ‖ amount — the Inbox message carries `secretHash` itself (F)
- K5 `retire(uint256)` ‖ version
Vectors pinned three ways from `packages/bridge/fixtures/bridge-vectors.json` (codegen'd into the Noir crate, `forge
test`, `bun test`), including the exit log tag `compute_log_tag(hash_or_tag, DOM_EXIT_LOG)`.

Secrets (`packages/bridge/src/secrets.ts`, the exported `hkdf` of `keys/derive.ts`: HKDF-SHA-256, the fixed
`yacana.kdf.v1` salt, 64 output bytes reduced into the target field, bias 2⁻¹⁹⁰): `exitSecret_i = reduce_Fr(
hkdf(master, "yacana.exit.v1:<chainId>:<portal>:<version>:<i>", 64))`, `tag_i = poseidon2(DOM_EXIT, exitSecret_i)`
(K1), `secretHash_i = computeSecretHash(exitSecret_i)` (K2, K3), `redeemKey_i = reduce_n(hkdf(master,
"yacana.redeem.v1:<chainId>:<portal>:<version>:<i>", 64))` as a secp256k1 key (viem `privateKeyToAccount`), one per
exit so no two sends share an address (C). Label encoding: decimal chainId, lowercase hex portal with `0x`, decimal
version, decimal `i`; frozen by the P1 vectors. Sequential `i` per version: the next index = max seen + 1 over the
journal *and* the account's own exit logs (its candidate tags `i … i + 20` queried in one call before every
allocation), reserved inside the journal's transaction; an extended scan and the recovery file for completeness.
Two origins on one device (the apex and the old origin have separate stores) or two devices allocating the same `i`
at once link two exits and lose nothing (both K4 messages stay claimable with the same secret; a redeem or forward
signature binds its leaf): disclosed as "one active origin per device for bridge sends". Deduplication by full
message identity.

Journal (`packages/bridge/src/journal.ts`): `Crossing { id, kind: 'exit' | 'ahead' | 'deposit' | 'land', version,
amount, aux, txHash?, epoch?, deadline?, witness?, l1Tx?, state, updatedAt }`; states exactly the state table's;
`advance(crossing, facts)` pure; facts from the node, the RPC and the store.

Rig API: `startUpgradeRig(opts) → { l1, nodes, deployNext, flip, postFlipWindow, stopNode, startNode, clock, yacana,
bridge, teardown }`.

### 3.3 Data and control flow (the critical path)

Send ahead: the sheet → `flows.sendAhead(amount)` (queued) → scan the candidate tags, reserve `i`, derive secret,
tag, redeem key → the authwit for `burn_private` (caller = the miner, `wallet.createAuthWit(owner, { caller, call })`)
→ `miner.send_ahead(...).send({ authWitnesses })` (mining paused `'bridge'`) → journal `sent` → the receipt's epoch
and the proof deadline → `proven` when `getBlockNumber('proven') ≥ block` and `getRoots(epoch)` is non-zero → the
Outbox witness (retried) stored → `held` (K2) / `ready` (K1). Forward (operator or self): `forward(version, args)`
→ `Forwarded` → `forwarded`; or `redeem` → `redeemed`. On V6 at sign-in: `landing.scan` matches
`Forwarded`/`Deposited` events by the account's own secret hashes → `waitForL1ToL2MessageReady(node, msgHash, {
chainTip: 'proven' })` → the Claim tap → `claim_from_l1` → `landed`. Flip detection
(`flip.ts`), by precedence, not conjunction (C, F): a confirmed Registry departure over the RPC → `flipped` (mining
stops); the node's `rollupVersion` moved or the miner's `retired` slot set → `flipped`
too; `/build.json`'s deployment ≠ the tab's → `stale` (reload; a same-rollup redeploy is not an upgrade); the
Registry read silent with nothing positive → `unknown` (new Ethereum-bound sends held back); deployment readiness
(Yacana registered on the new version) and retirement (K5 consumed) are separate states shown on the flip card.

### 3.4 File-level change map (cross-checked against `recon.md`)

Added: `packages/contracts/yacana_bridge_hashes/**`, `packages/contracts/yacana_miner/src/bridge.nr`;
`packages/portal/**` (+ `package.json`, `remappings.txt`, `test/aztec/`); `packages/bridge/**`;
`packages/harness/**`, `scripts/run/upgrade-rig.ts`, `scripts/run/toolchain.ts`; `packages/deploy/src/bridge/*`,
`packages/deploy/scripts/l1-deploy.ts`; `packages/web-miner/src/bridge/*`, `features/{MigrationCard,ArrivalCard,
SendAheadSheet,DepositSheet,BridgeTile,TakingLongDialog,EthRpcTile,OldTabNotice}.tsx`, `routes/Retired.tsx`,
`tests/vault.bun.test.ts`, `e2e/bridge.e2e.ts`, `e2e/helpers/l1-wallet.ts`; `packages/site/src/browser/eth-rpc.ts`,
`packages/site/v5/wrangler.jsonc`; `packages/web-stats/src/routes/Bridge.tsx`, `features/Bridge*.tsx`;
`packages/web-landing/src/routes/Faq.tsx`; `docs/bridge.md`, `docs/upgrades.md`; `.github/workflows/portal.yml`,
`.github/workflows/harness.yml`; `deployments/witnesses/<profile>.jsonl`.
Modified: `yacana_miner/src/main.nr` (+ `params.nr`), `packages/contracts/Nargo.toml` (members), `yacana.params.json`
(domains, `bridge` per profile, `migration`), `scripts/params-codegen.ts`, `toolchain.lock.json` (forge, anvil,
cast), `packages/deploy/src/deploy.ts`, `scripts/run/isolated-node.ts`, `node-guard.ts`, `connection.ts`,
`host.ts`, `config.ts`, `site.env`, `assemble.ts`, `artifact.ts` (`headers.ts` untouched), `keys/store.ts`,
`keys/derive.ts` (export `hkdf`), `session.ts`, `wallet.ts` (`feePayer.ts` extracted), `chain.ts`, `controller.ts`
(`PauseReason` + `'bridge'`), `App.tsx`, `routes.ts`, `routes/Wallet.tsx`, `SendSheet.tsx`, `Settings.tsx`,
`settings.ts`, `main.tsx`, `packages/web-miner/package.json` (wagmi + its query client),
`e2e/{run,run-setup,run-suite,proof-inventory,shards.json}` (a `RIG_ONLY` inventory
section excluded from the shard merge), `web-stats/src/{routes,App,chain,beats,explorer}.ts(x)`,
`routes/Verify.tsx`, `web-landing/src/{App,copy}.ts(x)`, `contracts.yml` (filter +
`packages/contracts/yacana_bridge_hashes/**`), `miner-core.yml` (`packages/bridge`, `packages/harness` unit parts),
`site.yml` (`deployments/witnesses/**` included: the site serves them), `e2e.yml` (the `rig` dispatch job),
`web-miner.yml`, `docs/{deployments,threat-model,roadmap}.md`, `README.md`, `CLAUDE.md`.
Reuse honoured: authwits (no approval mechanism), fixed slots (no slot-table work), the node setting as the RPC
setting's template, no CSP change, no second vault (the snapshot reuses its sealing), `www/` as the second-Worker
precedent, `toolchainBin` extracted rather than duplicated, `hkdf` exported rather than duplicated, `viem` already
hoisted, Aztec's own `Outbox`/`Inbox` under test rather than mocks.

### 3.5 Non-obvious mechanics

- **Retire**: a second L2 `retire` fails on the nullifier; a message from another sender is not in the tree (TXE:
  `send_l1_to_l2_message(…, sender = other)`); `claim` is refused in public, so a proof made after retirement is
  wasted but mints nothing; the UI stops mining first; a second L1 `retire` sends no second leaf.
- **Transitions by observation**: the Registry keeps no timestamps and the GSE's trace does not authenticate a
  Registry activation (the GSE's latest need not be the canonical, `GSE.sol:110-113`; `GSE.addRollup` stamps
  whenever the owner calls it, `:281-286`; only the shipped payload couples both calls). Observation is monotone
  (never before the true flip) and self-healing (every succeeding entrypoint records what it sees); the only
  manipulation is delaying a record, which lets the cap grow until the first call and extends the deadline, never
  shortens a holder's window; `noteTransition` and `retire` are the runbook's minute-one calls, so the lag is
  bounded by the first call. A reverting call rolls its own record back: the app and the script call
  `noteTransition` before anything that reads `flipAt`.
- **Deadline**: `afterNextAt` is the observed activation of the version after next, recorded for any Registry
  version whether or not Yacana registered it (C); unseen means open, never zero.
- **Rate limit**: grows on wall time for the version's life and freezes at the observed flip; post-flip mining
  cannot add exits because `retire` stops mints; the pause defers, the deadline bounds: the net total that can ever
  leave a version is `cap(flipAt)` (F). Before the flip "over the cap" means waiting; after it, the frozen
  remainder is final and the copy says so. A pause on the portal does not pause mining on L2, which is why paused
  time is not excluded from growth.
- **Forward target**: the canonical version if Yacana registered it and its index is greater; a skipped version
  never strands a send; K6 remains for "no registered canonical" and for a change of mind. A K2 forward is the
  holder's or a forwarder's choice, never a stranger's: a leaf forwarded into a version about to stop would lose its
  K6 (D37).
- **Redeem**: EIP-712 over `(version, epoch, leafId, contentHash, recipient, expiry)` (the Outbox nullifies per
  epoch, so `leafId` alone repeats across epochs — C); the K2 commits to the per-exit signer; `Forward` and `Redeem`
  are distinct struct types over the same leaf; the same cap, pause and deadline as a forward (F); no waiting
  period.
- **Balance snapshot**: written on every balance read on the apex, sealed under the master; the V6 build reads the
  V5 rollup's key for the account's V5 address and shows "last seen … may still be there". The old origin has
  neither the vault nor the snapshots: passkeys restore, words are retyped (C).
- **Address per class id**: `addresses` filled at open after the fingerprint check; the sealed record's AAD is
  unchanged; the arrival card explains the new address. A send-ahead never names a V6 address: the K2 carries a
  secret hash and a redeem key, both derived from the seed, and `claim_from_l1` takes its `recipient` on V6 at
  claim time from whoever presents the secret — the same seed re-derives the secret under the source version's
  label whatever address the new account class yields. The Ethereum side is the same: forward and redeem are
  authorised by the seed-derived redeem key's signature, never by an Aztec address.
- **Proof deadline**: `getTimestampForEpoch(e + proofSubmissionEpochs + 1)` on the version's Rollup over the RPC
  (`TimeLib.sol:73`, exposed through `RollupAbi`).
- **The versioned origin**: a build with `VITE_APP_ROLE=old` from the last V5 commit, served by the `yacana-v5`
  Worker; `hostKind === 'versioned'` allows key restore, refuses creation; `assertProductionArtifact` and boot fail
  closed on a role/origin mismatch (the role may also run on a preview or local host); `build.json.role = 'old'`.
  The passkey's RP ID is the apex, so the old origin can obtain the same master after user verification
  (`passkey.ts:93-96`): it is a fully trusted sibling, built by the same pipeline with the same headers, maintained
  with the apex until its version's deadline passes, then taken down; the role/origin check guards deployments,
  not secrets. Its vault is its own per-origin store: nothing signed in there reaches the apex's records.

### 3.6 Trade-offs and alternatives not taken

- The miner carries the bridge (unanimous) over a separate exit contract.
- `packages/bridge` as the shared client (C) over bridge code inside `miner-core` (M, F): miner-core stays free of
  viem; three consumers share one implementation; the dependency runs `bridge → miner-core` only.
- wagmi over viem alone (the owner's pick at approval, for its connector layer and the EIP-6963 wallet picker; the
  plan had recommended viem alone for fewer dependencies): wagmi's `viem` peer must resolve to the hoisted Aztec
  alias, proven by P6's install.
- The rig owns its network (C, M) over cases under `e2e:agent` (F): two runners would boot two networks.
- The FAQ as a standalone `/faq` page in the landing app (the owner's pick at approval: it is linked from several
  places) over a landing section with a rewrite (F, C) or a second Vite entry (M).
- The turnstile as designed — the cap, the pause and the deadline, no per-crossing delay (the owner's pick at
  approval) — over a 24 h queue on Ethereum-bound mints: the cap is a cumulative bound, so the pause only stops what
  comes after it; `docs/bridge.md` says so plainly.
- Aztec's real `Outbox`/`Inbox` under Foundry (Fable round 2) over thin mocks (the drafts): the properties under
  test are the boxes' own.
- A witness archive by the operator script, served by the site, instead of a relayer (F).
- Transitions by observation (C; adopted on Codex's round-1 finding) over the GSE trace (M + F): the trace cannot
  authenticate a Registry activation, and a split payload defeats any sandwich rule.
- A Registry-based deadline (C) over a Yacana-registered-based one (F's S2): bounded exposure whether or not Yacana
  registers the next version.
- Holder-or-forwarder K2 forwarding (Codex round 1) over permissionless forwarding (the drafts): closes the
  front-run-into-a-dying-version griefing at the cost of one role; K1 stays permissionless.
- Immutable policy constants with a bounded `launchAt` (both audits) over operator-set caps per version (the
  drafts); a `launchAt ≥ observed activation` rule rejected because it under-funds a version registered late.
- Per-version pauses with `pauseAll` as a loop (Codex round 1) over a global scalar (the drafts): a scalar cannot be
  reconstructed lazily for a dormant version.
- No redeem waiting period (Fable round 2) over 30 days (the drafts): under holder-authorised forwarding the wait
  protected nobody and stranded a K2 whose flip never came.
- The node's debug warp as the rig's only clock while a node runs (Codex round 2) over pause-and-drain (round 1):
  the automine sequencer owns L1 time.
- A one-way `closeDeposits` (Fable round 2) over pausing the old version before the flip: a pause would also hold
  its exits in the critical window.
- An injected Node-answered L1 test wallet for the browser e2e (the owner, after approval; nulo's tools fixture as
  the model) over a browser-extension wallet (none runs headless) or a mocked wagmi connector (it would skip the
  picker and the real signing path).

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
  defers it; the deadline bounds it: net of deposits, nothing beyond `cap(flipAt)` — three times the schedule plus
  at most a week — ever leaves a version, and `redeem` is under the same cap, pause and deadline (F). The cap grows
  until the first portal call after the true flip records it: the runbook's minute-one call bounds that gap. An
  honest holder is never confiscated by the cap's growth rule, but a competitive boom can delay honest exits and
  the frozen cap can end them (A3, accepted).
- **Post-flip mining**: the retire message ends claims on chain; until it is consumed the UI's flip signal stops
  mining; the deadline closes a version's exits at the later of the version after next and 180 days.
- **The operators**: write-once registration per version (cannot repoint an old version's exits), the policy
  immutable and `launchAt` bounded (they never choose how much a version may issue beyond a week's growth), no
  timelock by the owner's choice, pause bounded, `closeDeposits` one-way; the record page discloses who they are (an
  EOA on Sepolia, a Safe on mainnet, A4), the forwarders, and what a wrong first registration does: it lets that miner issue up to
  the version's cap *and* strands every K2 forwarded into that version (the K4 names the registered miner and the
  leaf is nullified), which is why the forwarder script and the app refuse a target whose registered miner differs
  from the announced record. A listed forwarder holds the griefing power D37 removed from strangers (A7, accepted). The
  token's minter is the portal, immutably (A9, accepted). Keys never in the repo or CI; the Sepolia deployer key is
  `YACANA_L1_PRIVATE_KEY` and the forwarder key `YACANA_L1_FORWARDER_KEY`, env only, never echoed, never on a
  command line. `retire` and `noteTransition` are permissionless and can be censored only by Ethereum itself.
- **Front-running and griefing**: redemption and K2 forwarding sign `(version, epoch, leafId, contentHash, target or
  recipient, expiry)` under distinct struct types; K1 forwarding is idempotent (a consumed leaf reverts); deposits
  carry the expected version and a deadline, and close before an announced flip, so no deposit's Inbox message is
  stranded on a stopping version; a stranger cannot push a K2 into a version about to stop.
- **The page**: the embedded wallet already holds signing capability, so automation adds no capability; nothing
  sends or claims without a tap (no scheduler, no stored consent: every crossing is the holder's own action); every bridge
  operation runs through one queue with its index reserved in the store's transaction (no two sends share a secret
  on one origin); the app refuses to claim on a version whose registered miner differs from its build's; the old
  origin is a fully trusted sibling (§3.5) with the same pipeline, headers, CSP and `artifact.ts` guards,
  maintained and then retired; key creation stays apex-only; a wrong phrase can never open a wrong account silently
  (the fingerprint, or a refusal when a legacy record has none under a new class).
- **RPC and node**: reads only; the guard admits the chosen RPC origin as a second slot with its own health; silence
  renders "unknown" and holds back new Ethereum-bound sends; the page fetches event ranges and matches locally,
  never per hash; the node can waste work, never move funds.
- **Privacy**: amounts, secret hashes, redeem addresses and timing are public on Ethereum and, through the token's
  public supply and the exit logs, on both rollups; nothing is sent automatically, so a holder chooses when an amount
  becomes visible; the review says so; nothing names the account; the K1 tag is a hash; one redeem address per exit; the last-seen
  balance is sealed on the device and named in the review; the witness archive holds only public leaves.
- **Cryptography**: Aztec's `compute_secret_hash` / `sha256_to_field` for contents (three-way vectors); secrets and
  the redeem keys from the wallet master with domain separation through the existing HKDF; OpenZeppelin
  ERC20/ECDSA/EIP712 from npm, pinned; no custom cryptography.
- **Supply chain**: 7-day npm min-age (now covering OZ and forge-std), frozen lockfile, actions by SHA (unchanged);
  `aztec-forge`, `anvil` and `cast` hashed in `toolchain.lock.json` like `nargo` and `bb`; viem at the Aztec alias.
- **Least privilege**: CI keeps `contents: read`; the rig runs on anvil with throwaway keys; testnet deploys use the
  existing deployer secret path; production deploys are never run from a branch (§7).
- **Input validation**: amounts through `parseAmount`; Ethereum addresses through viem `getAddress`; RPC URLs
  https-only in production; recovery files schema-validated, size-bounded and bound to chainId + portal (an imported
  file cannot choose contracts); archived witnesses are re-verified against the Outbox root before use.

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
  both deploy standalone with a `_rollup` constructor argument and `insert` is `onlyRollup` (`Outbox.sol:74, 103`;
  `Inbox.sol:43`); `Hash.sol` prepends a zero byte; `TimeLib.sol:73` gives the proof deadline epoch.
- aztec-nr 5.2.0: `message_portal` and `consume_l1_to_l2_message` in both contexts (the public one takes `[Field; N]`);
  `compute_secret_hash([Field;N])`; `emit_event_in_public` tags every log of one event type with the same
  `compute_log_tag(event type id, DOM_SEP__EVENT_LOG_TAG)` (`event_emission.nr:39-49`) and `emit_public_log_unsafe(tag,
  log)` takes any tag (`public_context.nr:110-121`); `getPublicLogsByTags` returns at most 20 logs per tag per call
  (`api_limit.ts:7`) behind an `afterLog` cursor; TXE `send_l1_to_l2_message` returns the leaf index; the token's
  `burn_private` is `#[authorize_once]`; `Wallet.createAuthWit(from, { caller, call })`; the token's total supply
  is public.
- The miner closes epochs on N claims with the elapsed time capped (`main.nr:188-193`): honest production is not
  bounded by wall time (`design-spec.md:71`); a profile with a notice period refuses a launch inside it
  (`launch.nr:15-24`), so a continuation's seed is public for at least the notice before it opens.
- `--local-network` ignores `--registry-address`/`--rollup-version`, forces automine + auto-prove
  (`local-network.ts:127-131`), epoch 4, proof epochs 2, committee 0, slasher off, funds test accounts, the
  BananaFPC, the sponsored FPC and prefund addresses at genesis (`:172-178`), and publishes with the deployer's HD
  key (`:145-150`, the `TestERC20` minter, `TestERC20.sol:11-21`); the pinned `--node` path checks a root computed
  from test accounts + the sponsored FPC + prefund only (`standby.ts:26-29`; `computeExpectedGenesisRoot` lives in
  an unexported subpath — `@aztec/aztec` exports `.`, `./deploy`, `./testing` — but its constituents are exported:
  `getInitialTestAccountsData` from `@aztec/accounts/testing`, `getGenesisValues` from `@aztec/world-state/testing`);
  `AZTEC_GOVERNANCE_VOTING_DURATION` reaches the deploy; local governance: delays 60 s, lock 1e24; the deployer
  mints the staking asset; `proposeWithLock` bypasses the GovernanceProposer; `vote` needs a mined block after
  `votingDelay`.
- The automine sequencer owns L1 time in the local network (`automine/README.md`, "Time control"); its `pause()`
  gates only the mempool poller (`automine_sequencer.ts:230-240`); builds, warps, `prove` and the settle tick run in
  one serial queue (`:282-299, 340`); the node's debug API exposes `mineBlock`, `prove`, `warpL2TimeAtLeastTo`,
  `warpL2TimeAtLeastBy` (`stdlib/src/interfaces/aztec-node-debug.ts:14-72`); the admin `pauseSequencer` calls that
  `pause()` (`server.ts:954-956`); its "proving" is synthetic settlement (Outbox roots + the proven tip), not proof
  validation; its `runWarp` rounds the target up to the next slot boundary and publishes an empty checkpoint there
  (`automine_sequencer.ts:586-602`); a propose prunes first when the proof window has passed
  (`ProposeLib.sol:172-175`); governance's pending phase ends at `creation + votingDelay` and voting at
  `+ votingDuration` (`ProposalLib.sol:162`); `computeContractAddressFromInstance` is exported by
  `@aztec/stdlib/contract`.
- The installed 5.2.0 packages export `deployRollupForUpgrade` (any signing key), `getDeployRollupForUpgradeEnvVars`,
  the `RegisterNewRollupVersionPayload` ABI + bytecode, `EthCheatCodes`, `RollupCheatCodes`, `upgrade_utils`,
  `createAztecNodeDebugClient`; the node path takes `USE_AUTOMINE_SEQUENCER`, `AUTOMINE_ENABLE_PROVE_EPOCH`;
  `aztec set-proven-through` writes no Outbox root; `aztecDebug_prove` does.
- `scripts/run/isolated-node.ts` exports `startIsolatedNode`, returns `l1RpcUrl`, sets `L1_RPC_URL`, claims lanes
  0–3 (`:137-142`), and keeps `toolchainBin` module-private (`:46`); the toolchain ships `aztec-forge` 1.4.1,
  `aztec-cast`, `aztec-anvil` as `internal-bin/{forge,cast,anvil}`, unpinned by `toolchain.lock.json` (which pins
  `bb` and `nargo`; `toolchain.test.ts:18-19` iterates the lock's map); the guard admits one node endpoint,
  accelerators and leased candidates; the CSP already allows any `https:`; `Session.pre` is single; `pxeNamespace`
  is per rollup; the PXE's view is keyed by the node's fingerprint, not the deployment (`boot.ts:313-314`);
  `expectedDeployment()` is build-time (`connection.ts:41-47`); `build.json` is written per build
  (`assemble.ts:50-55`); the key vault `yacana-keys` is per origin and shared by every rollup version on that origin
  (`keys/store.ts:27-41`), its sealed records' AAD includes the record version (`:107-136`), `openMaster` fails
  closed by comparing the derived address only (`:150-165`); the passkey's RP ID is the apex and sibling origins can
  evaluate its PRF (`passkey.ts:93-96`); a preview host is `<label>` + `VITE_PREVIEW_HOST_SUFFIX` and uses itself as
  the RP ID (`host.ts:7-21`; `docs/deployments.md:100-103`); the controller's `track` joins the drain and runs the
  operation at once (`controller.ts:438-449`); the claims log is plaintext localStorage (`main.tsx:20-21`); the e2e
  runner requires a shard's executed titles to equal its inventory (`run-suite.ts:47-57`, `proof-inventory.ts:92`);
  the account address depends on the SDK's account class, not on Yacana's deployment; `contracts.yml`'s filter
  fires on site/ui/web changes (`:29-41`); `site.yml` watches `deployments/**` (`:25`); `site:deploy` is `wrangler
  deploy` to production and Workers Builds deploys `main` (`docs/deployments.md:92-99`); `node_modules/viem` is the
  hoisted `@aztec/viem` 2.38.2.
- nulo's tools app carries the reference e2e L1 wallet fixture
  (`~/Projects/nulo/.claude/worktrees/tools-readiness/apps/tools/tests/browser/fixtures/l1-wallet.ts`, on that
  branch): an init-script `window.ethereum` forwarding over `exposeFunction` to a viem wallet client in Node,
  wallet-side methods handled there, other reads proxied to anvil, events pushed back, `rejectNext`/`holdNext`/
  `setChainId`/`setAccount` controls; wired as a worker-scoped fixture per spec file. Yacana copies the shape, not
  the code.

**Inferences (unverified — the audits attack these)**
- A pinned node whose genesis the rig computed from the exported constituents passes its own check (by
  construction; P4's first run compares the two roots).
- The old automine node keeps building and settling after the flip until stopped (the automine loop has no proposer
  check; L1 has no canonical gate on propose or prove — `Staking__NotCanonical` guards staking only).
- The PXE proves client transactions on the local network (`proverEnabled: !PROVERLESS`, `wallet.ts:69`;
  `realProofs: false` affects the node's verification), and prunes its view after a reorged block.
- The sponsored FPC published on a pinned version with the fixed salt lands at the funded address (the rig executes
  one sponsored transaction before any Yacana setup).
- A public Sepolia RPC with browser CORS exists for the default `VITE_ETH_RPC_URL` (probed from the served origin).
- WebAuthn accepts RP ID `yacana.network` from `v5.yacana.network` (the spec's rule; the P8 e2e reuses one virtual
  authenticator across both origins).
- The next aztec.js changes the account class id (the `addresses` migration is needed then, harmless if not; tested
  both ways).
- A pruned version restarted as a follower re-syncs and the wallet shows the undone burn (H5's reconciliation is
  time-boxed; the UX claim is made only when the balance is back).
- `forge-std` is on npm (else vendored); `wrangler versions upload` works for a never-deployed Worker (else the
  `v5` preview is a `wrangler dev` run in the rig's `origin` case).
- wagmi's `viem` peer resolves to the hoisted `@aztec/viem` alias under bun's hoisted linker (P6's install and
  typecheck prove it; else a root `overrides` entry pins the resolution).

**Asks — the owner's answers at approval (2026-09-12)**
- A1 The V6 continuation skips the launch lottery; the seed is public for the notice period and mixes the actual
  open timestamp, so a head start is bounded to one epoch's reward per candidate slot. **Accepted.**
- A2 The in-app Ethereum wallet: **wagmi** (the owner's pick, for its connector layer and the EIP-6963 picker over
  the installed wallets; no WalletConnect), over the plan's recommendation of viem alone. D21 amended.
- A3 The cap policy, all of it: `PER_HOUR = REWARD × N_CLAIMS × 3600 / EXPECTED_EPOCH_SECONDS × 3`, `ALLOWANCE =
  REWARD × N_CLAIMS × 24`, exits closing 180 d after a flip, pauses 30 d a call and 60 d in total, the `launchAt`
  window −7 d / +90 d, the 24 h deposit close; the bound is `cap + inbound` (everything bridged or deposited into a
  version is credited one for one, so a version's bound chains from its predecessors); the cap is a tripwire, not
  a proof of honesty, cumulative rather than a speed limit, with no per-crossing delay. **Accepted as designed,
  immutable** — the owner weighed "no cap" and a raise-only dial and chose neither: without a cap a compromised old
  version would inflate the next version through send-ahead, not only YACA.
- A4 Sepolia runs with **EOAs** as the operator and the forwarder; the Safe, its signers and threshold arrive with
  the mainnet plan.
- A5 The FAQ is a **standalone `/faq` page** in the landing app (linked from several places). D29 amended.
- A6 A held send forwards into the live registered version, across a skipped one (D18). **Accepted.**
- A7 K2 forwarding by the holder's signature or an operator-listed forwarder (D37). **Accepted**, with the
  instruction that the rule and its reason (a stranger could forward a send into a version about to stop, and
  forwarding takes away the holder's redeem) are written into `docs/bridge.md`, the FAQ and the held card's copy.
- A8 The hourly automatic send-ahead: **dropped**, recorded as a deferred feature; sends are manual, landing is a
  one-tap Claim. D12 amended.
- A9 YACA's minter is the portal, immutably. **Accepted.**

Settled by the plan, not asked (the final pass's call): the flip job in `harness.yml`'s PR gate with a measured
budget (D41); flip detection by any positive signal and the old page's "or to Ethereum" (D33, the owner's earlier
instruction that mining on V5 stops once V6 is live); the preview-only rehearsal (D31 — the production deploys are
requested when they are ready, not pre-approved); the default Sepolia RPC (engineering: P6's probe and
`docs/deployments.md`).

## 6. Phases with validation gates

Every gate includes the fast layers for the touched packages (`bun run lint`, typecheck, unit); heavier layers appear
where they matter. A phase is ✓ only when its gate passed and this file says so.

**P1 ✓ — the protocol: encodings, secrets, redeem keys, vectors, the toolchain module** (green 2026-09-12; `lessons/phase-1.md`) (`packages/contracts/
yacana_bridge_hashes` + `Nargo.toml`, `packages/bridge`, `keys/derive.ts` exporting `hkdf`, `yacana.params.json`
domains incl. `EXIT_LOG`, `params-codegen` incl. the vector codegen into the Noir crate, `scripts/run/toolchain.ts`
extracted, `toolchain.lock.json` + `toolchain.test.ts` covering `forge`/`anvil`/`cast`).
Gate: `bun run lint && bun run codegen && git diff --exit-code && bun test packages/bridge packages/miner-core
scripts && bun run contracts:compile && bun run contracts:test` (the Noir vector `#[test]`s pass; the TS vectors
match, the exit log tag included; the toolchain test passes with the three new hashes).

**P2 ✓ — the miner's bridge functions, counters, logs, continuation constructor** (green 2026-09-12; `lessons/phase-2.md`) (`bridge.nr`, `main.nr`,
`deploy.ts`, the record). TXE: send_ahead burns via an authwit and emits both logs (the event tag and the per-exit
tag); exit_to_l1 likewise; `claim_from_l1` via `env.send_l1_to_l2_message`; `retire` from the portal stops claims,
from another sender fails, twice fails; `claim` after retirement reverts in public and leaves no mint;
`first_epoch` continuity; the lottery bypass with the open-time seed.
Gate: `bun run contracts:compile && bun run contracts:test && bun packages/miner-core/scripts/export-layouts.ts &&
git diff --exit-code && bun run artifacts:commit && git diff --exit-code && bun run spike:gates && bun test
packages/deploy`.

**P3 ✓ — the portal, YACA, the L1 deploy script, the record** (green 2026-09-12; `lessons/phase-3.md`) (`packages/portal` with its npm deps, remappings and the
vendored boxes under `test/aztec/`, `packages/deploy/src/bridge/portal.ts`, `packages/deploy/scripts/l1-deploy.ts
--anvil`, `portal.yml` incl. the ABI diff). Foundry, against the real `Outbox`/`Inbox` with the test as their rollup
and a mocked Registry: the hash vectors incl. `RETIRE_SECRET_HASH`; register write-once with the index check (out of
order too) and the `launchAt` window; `_sync`/`noteTransition` (recorded on the first succeeding call that sees the
index — the version's own, the next, the one after; monotone; never rewritten; rolled back by a reverting call;
`afterNextAt` for an unregistered middle version); `retire` once, `FlipUnrecorded` before a record, allowed while
paused; forward per leaf against real roots (`AlreadyNullified` replay, wrong version, wrong recipient, a
cross-epoch leaf, a batch continuing past a failed and an out-of-gas leaf, the original caller preserved through
`forwardOne`); K2 forward by a forwarder, by the holder's signature, by neither (revert), an expired signature, a
`Redeem` signature offered as a `Forward` (revert), wrong target, target's index not greater, `inbound[target]`
credited; deposit `registered`-first / `expectedVersion` / `deadline` / paused / closed; redeem (valid, wrong signer,
expired, replay, over the cap, paused, past the deadline, before any flip); the rate limit (`exited − inbound +
amount ≤ cap` with an inbound-funded version before its first exit, growth on wall time, saturating before
`launchAt`, frozen at the observed flip, `WaitsForHeadroom` before the flip, final after it); pauses per version
(extension during a pause, expired unpause, refund, the 30/60 d bounds, a dormant version, an exhausted budget
skipped inside `pauseAll` over three versions, the deadline extension); the deadline with and without an observed
`afterNextAt`; invariants: `yaca.totalSupply == Σ minted − Σ burned`, `exited − inbound ≤ cap(flipAt)` per
version.
Gate: `bun run portal:build && bun run portal:test && git diff --exit-code packages/portal/abi && bun
packages/deploy/scripts/l1-deploy.ts --anvil` (its own `aztec-anvil`; deploys, verifies code and the record) `&& bun
run lint:actions`.
— arc 1 boundary: the codex loop, then `gh stack add bridge-harness` —

**P4 ✓ — the flip alone** (green 2026-09-12; `lessons/phase-4.md`; `bun run rig -- flip` 50 s wall on the homelab
box: network boot ≈ 20 s, both flips and the pinned node's boot, sponsored transaction and settlement in the rest;
proof-window headroom after each node warp — V5: +61 s → 9 slots, +373 s → 11, +288 s → 10; V6: +360 s → 12,
+61 s → 9, +373 s → 11 — against a 2-epoch (8-slot) submission window, i.e. every warp left the pending chain at
least one epoch clear of a prune. As built: the pinned node is `scripts/run/pinned-node.mjs`, the local network's
node construction on the toolchain's packages without its deployment — a plain `aztec start --node --sequencer`
has no settable clock for the automine sequencer and `--local-network` deploys unless p2p is on, which this
toolchain's libp2p cannot bind; the sponsored FPC needs no publication (it is in the genesis prefund, as on the
local network); each pinned node takes two lanes, 4–5 then 6–7.)
(`scripts/run/upgrade-rig.ts`, `packages/harness` H0, `harness.yml`). No Yacana: boot with a
five-slot vote, fund the rig's signer under a paused sequencer, `deployNext` (the genesis root from the exported
constituents), the payload, deposit ≥ 2e24, propose, warp through the node, vote, warp, execute; assert the
Registry, distinct versions and boxes; pause and stop V5, start the pinned V6 node (compare its logged genesis root
with the rig's), publish the sponsored FPC, one sponsored transaction, V6 settles a checkpoint (a non-zero Outbox
root); `flip` twice (V7) in one run with V6 as the running node; the run's wall time and the proof-window headroom
of every warp recorded in the case's output and copied into this plan (the CI budget, D41).
Gate: `bun run rig -- flip` green locally; `harness.yml` written (the flip job filtered on `scripts/run/**` and
`packages/{harness,portal,contracts,deploy}/**`, `workflow_dispatch` for `all`) and `bun run lint:actions` clean —
its first green run is verified on the arc-2 PR at Delivery (§10 step 5), since no PR exists before then.

**P5 ✓ — the migration cases and the operator script** (green 2026-09-13; `lessons/phase-5.md`; `bun run rig -- all`
967 s (16 min) wall on the homelab box, the six cases one after another on their own networks — alone: bridge 268 s, deposit
153 s, migration 341 s, skip-version 252 s, never-settled 115 s, flip 50 s; the unit parts `bun test packages/deploy
packages/harness packages/bridge scripts/run` 41 tests green; `e2e.yml`'s `rig` job on dispatch, actionlint clean. As
built, three deviations, all in the lessons: H5 asserts the Ethereum side in full — the pending tip rewound to the
baseline, no root in the pruned position, the kind-1 probe reverting `Outbox__NothingToConsumeAtEpoch` — then that V6
restarts and serves; the "balance back" reading is not stageable on this toolchain (the automine node keeps the
orphaned block; a fresh node never finishes its initial sync behind a prune), so the app may claim only those facts
for an unsettled crossing. "Not yet settled" is unobservable on the auto-settling local network (H3's first forward
is refused for the missing canonical, not for a missing witness). The operator states `forwardMany`'s gas
(`LEAF_GAS × leaves + 200k`): an estimate cannot see through the per-leaf try/catch. The Inbox serves a message three
checkpoints after the tip it was sent at, so the rig's `nudge` warps four slots.)
(`packages/deploy/src/bridge/*`, `packages/harness` H1–H11).
H1 K1 round trip on V5 (replay refused) — real proving once for the mined balance, simulation on reruns; H2 K3
deposit + `claim_from_l1` (`waitForL1ToL2MessageReady`, nudge blocks), then `closeDeposits` refuses the next; H3 the
migration V5 → V6, in this order: send_ahead → settled → forward refused (no registered canonical) → flip →
`noteTransition` → `retire(V5)` consumed on V5 → claim on V5 refused → post-flip window (one more settled checkpoint
on V5) → pause and stop V5 → start V6 → deploy the V6 miner + token from V5's last epoch → `register(V6, index)` →
one K2 forwarded by the forwarder key, one by the holder's signature → `claim_from_l1` on V6 → one real W claim on
V6 at the continued index; H4 send_ahead after the flip while V5 still settles; H5 never settled, on V6 → V7 (V6
pinned with auto-prove off; the V6 deployment and the mined balance settled by `prove` first and recorded as the
baseline; send_ahead on V6; stop V6 before it settles; with no node alive the rig's cheat codes own the clock: flip to V7,
warp past the proof window and `prune` V6's Rollup — a running V6 would publish a checkpoint on every warp and its
own propose would prune first (`ProposeLib.sol:172-175`), defeating the assertions; L1 assertions with V6 still
stopped: roots zero, forward reverts `Outbox__NothingToConsumeAtEpoch`, the pending tip rewound to the baseline;
only then restart V6 pinned and, time-boxed, see the wallet's balance back — the UX claim only when it is); H6 no registered canonical → redeem at once (under
cap/pause/deadline), then a late register + forward reverts nullified; H7 V5 → V7 with V6 in the Registry but
unregistered by Yacana → forward into V7, and V5's deadline from V7's observed activation; H8 Ethereum round trip
accounting (`totalSupply`, net allowance); H9 pause / limit / deadline boundaries on the live portal incl.
`pauseAll`; H10 an unregistered L2 sender is unconsumable; H11 a K2 forwarded by a stranger reverts, and the script
refuses a target whose registered miner differs from the record. Every action through the operator script's
functions; witnesses archived and one forward served from the archive alone.
Gate: `bun run rig -- all` green locally; `e2e.yml` gains a `rig` job on `workflow_dispatch`; `bun test
packages/deploy packages/harness` (unit parts) green.
— arc 2 boundary: the codex loop, then `gh stack add bridge-miner` —

**P6 ✓ — the site layer and the bridge modules in the miner** (green 2026-09-13; `lessons/phase-6.md`; lint, the
three packages' bun suites 252/252, the Vitest specs of every app, the miner's typecheck and the replay lane 4/4 all
green; the vault test and the index test as the gate words them; as built: the record's bridge and migration block
types moved to `packages/bridge/src/record.ts` so the site never imports the deploy package, `queue.ts` lives in
`packages/bridge`, and the `WagmiProvider` mounts with the bridge features in P7 over `wagmiConfigFor`.)
(`eth-rpc.ts`, the guard's second slot,
`connection.ts`, `host.ts` (create/restore split, `versioned`, the per-role preview suffix), `config.ts`,
`site.env`, `packages/web-miner/src/bridge/*` with `queue.ts` and the in-transaction index, wagmi and its provider
wiring (`bun pm ls viem` shows the single hoisted alias and typecheck passes — typecheck alone proves nothing about
resolution), `keys/store.ts`
fingerprint + `addresses`, `feePayer.ts`, `controller.ts` pause reason, `main.tsx` scoping, the sealed snapshot,
`tests/vault.bun.test.ts`).
Gate: `bun run lint && bun test packages/site packages/web-miner packages/bridge && bun run test:components &&
bun run --cwd packages/web-miner typecheck && bun run --cwd packages/web-miner test:replay` — the vault test opens
an existing sealed v1 record, adds the fingerprint, refuses a wrong phrase under a changed class, verifies a legacy
record without a fingerprint under a changed class against the pinned previous class (a match migrates, a mismatch
is refused), migrates `addresses` both with an
unchanged and a changed class; a queue test proves two concurrent sends and two tabs (`fake-indexeddb`) get
distinct indices with more than 20 prior exits on the version.

**P7 ✓ — the guided path UI and the everyday bridge** (green 2026-09-13; `lessons/phase-7.md`; `bun run
test:components` 84 miner specs among them; `bun run rig -- browser` 3/3 in 391 s: V5 — mine, exit, deposit, two
send-aheads, the recovery file; V5 after the flip — the card says mining ended, the file restores four crossings;
V6 — restore, the file, the holder's forward from the page and the claim, the redeem, the YACA balance — real
proving throughout; `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` 18/18 in 17.8 min, the
`bridge` shard among them. What the gate forced: the local network builds blocks only on transactions or warps, so
the browser case warps a slot a minute; a deposit the wallet never answered is offered again; the words backup's
quiz survives StrictMode; e2e bundles are built as production; signature expiries and deadlines are dated by
Ethereum's clock, not the device's. After the arc-3 codex loop (`lessons/phase-8.md`: three rounds, thirty-four
findings applied — the journal per account, claims read from the nullifier tree on the version they land on,
arrivals adopted in one transaction, a file's states as hints, no deposit re-sent under its secret) the gate ran
again on the final tree: `rig -- browser` 3/3 in 370 s, the suite 18/18 in 17.7 min, the components 84.)
(`MigrationCard`, `SendAheadSheet`, `ArrivalCard` with its one-tap Claim, `ToEthereumSheet`, `DepositSheet`,
`BridgeTile`, `TakingLongDialog`, `EthRpcTile`, `OldTabNotice`, Settings, the wallet picker). Copy overrides of `ux-brief.md` (D22, D16, D12, A7): "usually under an hour to
Ethereum" → "when V5 settles the epoch, usually within a few epochs"; "the relayer forwards it within the hour" →
"Yacana forwards exits by hand; the last forward was N ago; forward it yourself any time"; "relayer quiet > 1 h" →
a `held`/`ready` crossing older than the stated age; "after 30 days you can redeem" → "redeem to Ethereum any
time"; the send sheet's switch, its consent copy and "arrives by itself" dropped — landing is a tap on the arrival
card; the held card says who may forward a send and why ("only you, with this device's key, or Yacana's listed key:
a stranger could push it into a rollup about to stop"); "over the cap" reads "waiting for headroom" before the flip
and "the version's exit capacity is used up" after it. Vitest specs per feature; the browser
e2e on the rig, every crossing through the page and none through the script: `e2e/helpers/l1-wallet.ts` — an
injected EIP-1193 provider answered from Node, modelled on nulo's tools fixture (D51): `installL1Wallet(context, {
rpcUrl, privateKey, chainId })` defines the page's provider in a context init script and forwards every `request`
over `context.exposeFunction` to a viem wallet client signing with a rig anvil key, wallet-side methods handled in
Node (`eth_requestAccounts`, `eth_accounts`, `eth_chainId`, `wallet_switchEthereumChain`, `eth_sendTransaction`,
`eth_signTypedData_v4`, `personal_sign`), reads proxied to the rig's anvil, `chainChanged`/`accountsChanged` pushed
back into the page, an EIP-6963 announcement so wagmi's picker lists it as "Yacana test wallet", and the controls
`rejectNext(kind)`, `holdNext(kind, { to })`, `setChainId`, `setAccount`, `calls(method)`; the key never enters the
page. `e2e/bridge.e2e.ts` in the `RIG_ONLY` inventory section (the run builds twice because the expected
deployment is build-time): a V5-profile build and server — sign in, one real W claim for the balance, exit to
Ethereum from the Send sheet, the portal forward, the YACA balance on the bridge tile; deposit from the Deposit
sheet through the picker, the arrival card's Claim; send ahead; the flip; a V6-profile build and server — sign
in, self-forward from the page with the holder's signature, Claim on the arrival card; a second send-ahead on V5
redeemed from the page — real proving throughout, the proof inventory updated (two burns and three claims). State
cells through the same wallet: wrong chain (the sheet asks to switch and continues), a rejected signature (the
sheet returns to its form with the reason), an open prompt left unanswered (`holdNext`: the sheet shows "waiting
for your wallet", a reload recovers the crossing from the journal), an account change mid-flow (the sheet
re-checks the address). Proverless state specs stay in a `bridge` shard.
Gate: `bun run test:components && bun run rig -- browser && bun run e2e:agent -- bun run --cwd packages/web-miner
test:e2e` (the existing shards untouched; the shard merge ignores `RIG_ONLY`).

**P8 ✓ — the versioned origin** (green 2026-09-13; `lessons/phase-8.md`; `bun test packages/site` 75/75, `bun run
site:build` (dist, role apex), `YACANA_APP_ROLE=old bun run site:build` (dist-old, role old), `bun run e2e:agent --
bun run site:e2e` 3/3: both roles under one policy, `build.json.role`, the retired head and the restore-only key
screen on the old role, the old-tab notice on a same-rollup redeploy; `bun run rig -- origin` 20.9 s: one passkey
across the apex and the versioned origin, served as `yacana.test` and `v5.yacana.test` over a run certificate —
WebAuthn refuses `localhost` as a shared suffix. After the arc-3 codex loop the site tests (75), `site:e2e` 3/3
and `rig -- origin` ran green again on the final tree.) (`Retired.tsx`, `VITE_APP_ROLE=old`, `assemble.ts` role/out + the
fail-closed production pairing, `v5/wrangler.jsonc`, `build.json.{role,miner}`, `hostKind === 'versioned'`, the
old-role preview suffix, `OldTabNotice` on deployment identity).
— arc 3 boundary: the codex loop, then `gh stack add bridge-stats-docs` —

**P9 ✓ — stats, the announcement lines, the FAQ** (green 2026-09-13; `lessons/phase-9.md`; `bun run
test:components` (ui 49, landing 13, miner 84, stats 75), `bun run --cwd packages/web-stats test:visual` 4/4
(baselines refreshed for the nav's third word), `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e`
6/6 with the bridge page read from a live portal on the run's anvil, `bun run e2e:agent -- bun run --cwd
packages/web-landing test:e2e` 4/4 with `/faq` and the announced build's line; `site:e2e` 3/3 covers `/faq` and
`/stats/bridge` under the one policy.) (`/stats/bridge`, the bridge beat, Etherscan links, Verify's Ethereum
tile; the landing `Alert` and the standalone `/faq` page (`routes/Faq.tsx`, the six panels incl. the forwarding
rule and its reason), linked from the miner's migration card and the stats bridge page. The viem-only portal
reader moved to `packages/bridge/src/portal-reader.ts`, with the per-version flows and the policy.)

**P10 ✓ — docs, CI, records** (green 2026-09-13; `lessons/phase-10.md`; `bun run lint && bun run lint:actions &&
bun run lint:shell` ✓, `bun test packages/deploy packages/site packages/bridge` 109/109, root typecheck clean;
every runbook step names an operator-script entrypoint the rig exercised, `set-forwarder` added for the one that
had none; the witness archive served at `/witnesses/<rollupVersion>.jsonl` and read by the miner for an earlier
version.) (`docs/bridge.md` — the mechanism, the turnstile stated plainly (no per-crossing
delay; the cap is a cumulative bound net of what came in; the pause stops what comes after it; the deadline ends a
version) and the forwarding rule with its reason; `docs/upgrades.md` written as the rig's steps with the operator
script's entrypoints — the day before: `closeDeposits`; minute one: `noteTransition` and `retire`; announcing is a
site redeploy with the migration block; the forwarder key's use; the witness archive redeployed with the site; the
old origin maintained with the apex and taken down after its deadline; the preview-first rehearsal and the
post-merge production deploys; `docs/threat-model.md` rows, `docs/deployments.md`, `docs/roadmap.md`, README,
CLAUDE.md, `implementations-plan/index.md`; `contracts.yml` filter, `harness.yml`, `e2e.yml` jobs, `web-miner.yml`,
`site.yml`).
Gate: `bun run lint && bun run lint:actions && bun run lint:shell`; every runbook step names an operator-script
entrypoint the rig exercised (no prose-matching test).

**P11 ✓ — the testnet rehearsal** (green 2026-09-13; `lessons/phase-11.md`; portal
`0xD536D74Eedf1d2308bf8556402f37f4102eD63f7` and YACA verified on Sepolia, the testnet miner redeployed with the
bridge and registered at index 5, the forwarder listed, one K1 minted, one K3 claimed, one K2 held with its
witness archived and served, the previews verified against the new record, the `yacana-v5` version serving the
frozen record; `bun run epoch:stats` ✓, `bun run bridge -- status` ✓, both role builds ✓; the K2 landing
pending validation.) (from the arc-4 branch, no merge and no production deploy: Sepolia — an operator EOA, YACA
+ portal deployed and verified on Etherscan, a forwarder EOA set; the testnet profile redeployed with the bridge and
launched per `docs/deployments.md` (a new record; the previous deployment keeps running); the branch's preview site
verified against the new record; the `v5` Worker's preview version serving the frozen record (proves role, headers
and a preview-RP sign-in only: that miner has no bridge functions and a preview host is its own RP); one K1 minted
on Sepolia, one K3 claimed, one K2 held with its witness archived and served; the record and docs updated; the K2
landing recorded as pending validation).
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
codex (CC), fable (FC); audit round 1: codex (CA1), fable (FA1); audit round 2: codex (CA2), fable (FA2).

| # | decision | source | rejected alternatives |
|---|---|---|---|
| D1 | Bridge permanent from launch; ERC-20 + private relay through Ethereum | O | migration windows only |
| D2 | Old app at `v5.yacana.network` | O | same-origin `/v5/mine`; swap at window close |
| D3 | No relayer bot in this plan; operator script (forwarder key) + self-forward | O | homelab service; Worker cron |
| D4 | Ethereum reads from the browser via an RPC setting | O | Worker proxy |
| D5 | Plain multisig, no timelock; pause bounded | O | timelock |
| D6 | Retire message instead of an epoch cutoff | C1 | lazy cutoff |
| D7 | Successor by Registry history index | C1 | `N+1` arithmetic on ids |
| D8 | Exit deadline = later of (observed activation of Registry index i+2, flip + 180 d) + paused time; K6 redemption; transitions recorded lazily by every succeeding entrypoint and by `noteTransition` | C1, C, CC, CA1, CA2 | one hop (confiscation); a Yacana-registered-based deadline (FC S2); records only through `retire` (M) |
| D9 | The cap grows on wall time from `launchAt`, saturates before it, and freezes at the observed flip: the net bound `exited − inbound ≤ cap(flipAt)` is 3× the schedule plus at most a week for every version; pauses extend the deadline, never the cap; before the flip an over-cap leaf waits, after it the frozen remainder is final; honest exits can be delayed in a boom and refused once exhausted (A3, accepted) | FA1 (resolving CA1), CA2, FA2 | growth to `flipAt + 180 d` minus paused time (FC B2 — retracted by FA1); frozen at `flipAt` minus paused time (draft 3, F); a finite competitive allowance (C); "never refused" (M) |
| D10 | Deposits carry expectedVersion + deadline; refused while the version is paused or its deposits are closed | C1, FA1, FA2 | plain deposit |
| D11 | Verb "Send ahead" | FU, C2 | "Commit" |
| D12 | Manual sends and a one-tap Claim on the arrival card; no scheduler, no consent record (the hourly auto-send dropped at approval as a deferred feature) | O (at approval), over FU, M, CA1 | one switch for hourly sends + auto-landing (FU, M); auto-commit at the flip (C2 rejected) |
| D13 | Per-send proof deadline shown; missed → undone onto the old version (H5 verifies pruning) | C2, CC | "lost" |
| D14 | The miner carries the bridge (one registered address per version) | M, C, F | a separate exit contract |
| D15 | K4 content = `claim_from_l1(uint256)` ‖ amount | F | `H(4, amount, secretHash)` |
| D16 | K6 by EIP-712 over `(version, epoch, leafId, contentHash, recipient, expiry)` with a per-exit redeem key; under the same cap, pause and deadline as a forward; no waiting period | C2, C, F, CC, FC B3, FA2 | a bearer secret; `(version, leafId, recipient, expiry)`; one wallet-wide key; 30 days after the flip (the drafts — undefined before a flip, protects nobody under D37) |
| D17 | Transitions by observation: the first succeeding portal call that sees the Registry above an index records `now` for the version's own index, the next and the one after; `noteTransition` permissionless and the persisted step; no GSE | C, CA1, CA2, FA2 | the GSE trace with a fallback (M + F, CC, FC B1); a sandwich rule on the trace (FA1 — defeated by a split payload) |
| D18 | K2 forwards into the canonical version if Yacana registered it (index greater); K6 for "no registered canonical" or a change of mind (A6, accepted) | M | strict successor (F, C, FC conceded) |
| D19 | `retired` checked in private for feedback and in public `record_claim` authoritatively | C, F | private only |
| D20 | `packages/bridge` as the shared TS client, `bridge → miner-core` only; vectors codegen'd into the Noir crate; `hkdf` exported from `keys/derive.ts` | C, FC, CA1 | bridge code inside `miner-core` (M, F) |
| D21 | wagmi over the hoisted viem alias: the injected connector with EIP-6963 discovery as the wallet picker, a provider scoped to the bridge features; no WalletConnect (A2) | O (at approval) | viem alone through the injected provider (F, FA1 — the plan's recommendation) |
| D22 | No-relayer copy, no promised cadence: "Yacana forwards exits by hand; the last forward was N ago; forward it yourself any time"; `TakingLongDialog` opens on a crossing's age | C, FU, CC, FC S4 | "the relayer forwards within the hour" (the canvas); "a few times a day" (M) |
| D23 | The rig owns its network (`bun run rig`), cases in `packages/harness`; `deployNext({bump})` reads the Rollup's version; `flip()` repeatable, needs no node for the new version, cross-checks the Registry; the genesis composed from exported helpers (no spike); the rig signs from its own anvil account | C, M, FC S5, CA1, FA1, CA2, FA2 | cases under `e2e:agent` (F); a genesis spike (M); an unexported subpath (M); the deployer key (M — the publisher's) |
| D24 | H5 "never settled" on a pinned V6 → V7 (auto-prove off), never a restarted V5; a settled baseline first; `prune`, L1 assertions, then a time-boxed follower reconciliation | C, F, CC, FA1, CA2 | V5 restarted pinned (M — its genesis is not reproducible) |
| D25 | While an automine node runs, every warp goes through its debug `warpL2TimeAtLeastTo/By` (the sequencer owns L1 time and serialises builds, warps and settlement); anvil cheat codes only when no node is alive; `pauseSequencer` only before `stopNode`; prove a pinned node accepts a sponsored tx before deploying Yacana; the flip job's budget measured | CA2 (over C, CA1) | pause alone (M); pause + `syncPoint` (CA1 — the settle tick is not suspendable) |
| D26 | Each exit emits two public logs: the `ExitRecorded` event under its type tag (the operator's paginated enumeration) and the same payload under `compute_log_tag(hash_or_tag, DOM_EXIT_LOG)` (the owner's one-call scan); the landing scan uses the portal's events | F, FA1, FA2 | one event log (M — 20 per tag per call, a full walk per send); a storage log |
| D27 | Continuation constructor `(target, seed, launch_at, first_epoch, portal)`, lottery bypassed when `first_epoch > 0`, the first seed mixing the actual open timestamp; a versioned record | M, C, FA2 | carrying supply; a seed fixed at deployment (pre-minable for the whole notice) |
| D28 | `MasterRecord` keeps `v: 1` and its AAD; a master fingerprint written after the address check under the current class and required before any migration; a legacy record without one under a new class is verified against the pinned previous class on the apex, else offered a fresh restore; optional `addresses: {[classId]}`; the snapshot key `yacana.balance.v1.<chainId>.<rollupVersion>.<token>.<account>`, sealed under the master | FA, F, CC, FA1, CA2, FA2 | bumping `v` (breaks decryption); the address check alone; accepting a supplied master's fingerprint at bootstrap (CA2 — trusts the master blindly); a plaintext snapshot |
| D29 | The FAQ as a standalone `/faq` page in the landing app, linked from the miner and stats (A5) | O (at approval) | a landing section + rewrite (F, C); a fourth app; a second Vite entry (M) |
| D30 | The old app is a build with `VITE_APP_ROLE=old` on a second Worker with its own preview suffix; `versioned` = the host of `VITE_OLD_APP_ORIGIN`; the role runs on `versioned`, `preview` and `local`, never on the apex; keys create/restore split; the origin is a fully trusted sibling, maintained then retired | F, FC S3, CA1, CA2, FA2 | runtime hostname role only (M); treating the role check as secret protection; `role old ⇔ versioned` strictly (round 1 — refuses its own preview) |
| D31 | Operator script in arc 2; deploy-script/record changes in arc 1; K2 landing on testnet = pending validation; the rehearsal from the arc-4 branch on preview deployments; production deploys after merge, requested from the owner when ready | C, F, CC, FA1 | a merge precondition (M); `site:deploy` from the branch (the drafts — overwrites the apex) |
| D32 | Fee payer abstracted (`FeeProvider`); mainnet decides later | O | Yacana FPC now; fee juice |
| D33 | Flip detection by precedence: a Registry departure, the node's version or the `retired` slot → `flipped`; a `/build.json` mismatch → `stale` (reload); `unknown` only when the Registry read is silent with nothing positive; readiness and retirement are separate states | CC, FC S1, FA2 | a conjunction (M); `build.json` as a flip signal (round 1 — a same-rollup redeploy is not an upgrade) |
| D34 | H3's order: retire and stop V5 before V6's miner exists; register after deploying it; forward after registering | CC | register before deploy (M) |
| D35 | `RETIRE_SECRET_HASH` pinned in Solidity with a vector; a second L1 `retire` sends no leaf; `retire` allowed while paused | FC nits | — |
| D36 | Announcing (`VITE_MIGRATION`) is a site redeploy; the runbook says so | FC nit | a runtime config fetch |
| D37 | K2 forwarding by the holder's redeem-key signature (`Forward`, a distinct struct from `Redeem`) or an operator-listed forwarder, the original caller carried through `forwardOne`, the portal never a forwarder; K1 permissionless (A7, accepted) | CA1, CA2 | permissionless K2 forwarding (the drafts) |
| D38 | `PER_HOUR`, `ALLOWANCE` and the day bounds immutable in the portal; `registerVersion(version, index, miner, launchAt)` with the index checked against the Registry and `launchAt ∈ [now − 7 d, now + 90 d]`; the cap saturates before `launchAt` | CA1, FA1, CA2, FA2 | operator-set caps per version (the drafts); an index scan (M); a free `launchAt` (round 1 — the cap's real dial); `launchAt ≥ observed activation` (FA2 — under-funds a late registration) |
| D39 | Pauses per version: `pausedUntil = max(now, pausedUntil) + s`, `pausedSeconds += s`, `unpause` refunds `max(pausedUntil − now, 0)`; `pauseAll` loops the registered versions and skips an exhausted one | CA1, CA2, FA2 | a global scalar with lazy unions (M) |
| D40 | Every bridge operation in the app runs through one queue; the exit index is read and incremented inside the store's transaction (tabs share it) after a one-call scan of the account's candidate tags; abandoned reservations kept; a cross-origin or cross-device collision links two exits and loses nothing (disclosed as "one active origin per device") | CA1, CA2, FA2 | serialisation through `track` (M — it is a drain join); a full log walk per send |
| D41 | `harness.yml` owns the flip job, filtered on the rig's inputs | FA1 | the flip job in `contracts.yml` (M — fires on UI PRs) |
| D42 | `@openzeppelin/contracts` and `forge-std` from npm under the 7-day gate, remapped; vendored if missing | FA1 | submodules (the drafts) |
| D43 | `forge`, `anvil`, `cast` hashed in `toolchain.lock.json`; the deploy script reads its key from env | CA1, FA1 | an unpinned toolchain; `--private-key` |
| D44 | The wrong-registration disclosure covers stranded K2s; the forwarder script and the app refuse a target whose registered miner differs from the record | FA1 | the cap-only disclosure (M) |
| D45 | The witness archive is committed under `deployments/witnesses/` and served by the site at `/witnesses/`; a fresh device forwards a held K2 from it once the source node is gone; a K2 not yet archived needs the source node or the operator | FA2 | an archive nobody can reach (round 1) |
| D46 | Foundry tests run against Aztec's real `Outbox`/`Inbox` (vendored, the test as their rollup); only the Registry is mocked | FA2 | thin box mocks (the drafts) |
| D47 | `bridge.e2e.ts` lives in a `RIG_ONLY` inventory section the shard merge ignores | FA2 | a shard file (round 1 — the merge would stay red) |
| D51 | The browser e2e drives every crossing through the page against the rig's real portal, with an injected EIP-1193 test wallet answered from Node (the shape of nulo's tools fixture: Node-side signing, `rejectNext`/`holdNext`/`setChainId`/`setAccount`), announced over EIP-6963 for wagmi's picker; state cells for wrong chain, rejection, an open prompt and an account change | O (after approval) | script-only coverage of exit, deposit, self-forward and redeem (the approved plan); a browser-extension wallet (none runs headless); a mocked wagmi connector (skips the picker) |
| D48 | `closeDeposits(version)` (operators, one-way) the day before an announced flip; the UI's 24 h close mirrors it | FA2 | a UI-only close (the drafts); pausing the old version (holds its exits) |
| D49 | The turnstile as designed: cap + inbound, pause, deadline, no per-crossing delay; the cap immutable (A3) | O (at approval) | no cap (the owner's first instinct — inflates the next version through send-ahead); a raise-only dial; a 24 h queue on Ethereum-bound mints |
| D50 | Sepolia's operator and forwarder are EOAs; the Safe comes with the mainnet plan (A4) | O (at approval) | a Safe on Sepolia now |

Disputed items surfaced as Asks A3–A9 rather than resolved silently (CC, FC, CA1, FA1, CA2, FA2); the final pass
settled D31, D33 and D41 as plan decisions and merged the two cap asks into A3.

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
authorisation; D40 the queue; the HKDF and index rules; consent scope; the trusted sibling origin; `toolchain.ts` in
P1; the workspace and CI wiring; the settlement wording; D43; the genesis by construction; the inference
verifications in the gates; no prose-command test). Fable (`audit-fable.md`): "ship after the listed fixes" — 4
blockers, 8 should-fix, 12 nits; adopted: D9 frozen at the flip on wall time (its own contradiction-check exclusion
retracted), D24 on a pinned V6, D31 preview-only rehearsal, the master fingerprint, D41, no genesis spike, the
double-build browser e2e, D44, the old origin's rehearsal scope, D42, the vault test, and every nit. Rejected: the
GSE sandwich rule (D17 reversed instead — a split payload defeats it, its own nit 21). Disagreement logged: Fable
kept D17 with a sandwich rule, Codex reversed it; the reversal wins because observation is monotone, self-healing
and needs no vendored GSE.

**Audit round 2.** Codex, resumed self-critique (`audit-codex.md`): "not ready — two blockers" — both verified and
adopted: the automine sequencer owns L1 time, so the rig warps only through the node's debug API (D25), and a
legacy vault record cannot bootstrap its own fingerprint (D28); plus nine should-fixes (the reverting `_sync`, net
issuance, the `launchAt` dial, the pause formulas, the store's transaction, the forwarder's custody and the batch
caller, the unexported genesis subpath, H5's baseline, the old role on a preview host) and the remaining "minutes"
wording. Fable, fresh hostile (`audit-fable.md`): "not ready — `launchAt` is the cap's real dial" — adopted with a
window rather than its `≥ observed activation` rule (which under-funds a late registration); its other blocker (the
`v5` preview host is `unknown`) and every should-fix and nit adopted: two-tag exit logs (D26), `stale` not `flipped`
(D33), no redeem wait (D16), the real boxes under Foundry (D46), the rig's own signer (D23), the `RIG_ONLY`
inventory (D47), `closeDeposits` (D48), the served witness archive (D45), the version's own index in `_sync`
(D17), the open-time seed (D27), the sealed snapshot, the two-label landing scan, saturation, `registered` first,
per-leaf gas, `pauseAll` skip. A new ask on the immutable minter (A9). Both legs agreed the round-1 choices stand:
observation time, the frozen cap with A3, the genesis by construction, D24, D42, D37 with A7's custody note.

**Final fresh-context pass.** Codex, a new session over the finished plan and both audit files
(`audit-codex.md`, final section): **APPROVE WITH CONDITIONS** — "I found no additional fund-loss or
unbounded-issuance blocker beyond the risks already disclosed for owner acceptance." Three conditions, all verified
and folded in: (1) the node's warp rounds up to a slot boundary and publishes a checkpoint, so a one-minute vote
window can be missed — the rig votes over five slots and asserts every governance transaction lands inside its
window; (2) H5's warp and prune run while V6 is stopped, because a running node's propose prunes first and every
warp publishes a checkpoint — V6 restarts only for the wallet reconciliation; (3) a legacy vault record cannot
acquire its fingerprint at the old origin (a separate per-origin store) — the apex verifies it against the pinned
previous account class, else offers a fresh restore. Also adopted: P4's gate is the local run, its CI job verified
on the arc-2 PR at Delivery (no PR exists earlier); Asks reduced to the owner's genuine decisions (D31, D33, D41
settled; the cap asks merged; A7 rephrased to accept the forwarder's custody rather than reopen permissionless
griefing). Every gate is otherwise executable in order; the runtime inferences of §5 remain to be run.

**Approval (2026-09-12).** The owner answered the nine asks (§5): wagmi (D21), the cap as designed and immutable
(D49), Sepolia EOAs (D50), the standalone FAQ page (D29), the live registered version as the forward target, the
forwarding rule with its reason documented, the hourly auto-send dropped (D12), the immutable minter, the lottery
skip. Two questions raised at the gate and answered in the plan: a send-ahead passes the same turnstile as an exit
(§3.6, `docs/bridge.md`), and a version's bound chains from its predecessors through `inbound` (A3). The delta was
sent back to the final Codex session for a clean verdict.

**Re-check (2026-09-12).** The same session over the approved delta: **APPROVE** — "No new blockers found."
wagmi's providers coexist with the session created outside React; the `/faq` page is compatible with the
assembled site (the Worker's SPA fallback, no intercepting redirect); removing the consent removed no
authorization the security section relies on; all three earlier conditions correctly resolved. Its one note:
P6 must prove wagmi's dependency resolution, not only typecheck — folded in (`bun pm ls viem`). Two prose
remnants it spotted are fixed.

**Post-approval addition (2026-09-12, the owner).** P7's browser e2e now drives every crossing through the page —
exit to Ethereum, deposit, send ahead, self-forward, claim, redeem — with an injected Node-answered L1 test wallet
modelled on nulo's tools fixture (D51), plus the wrong-chain, rejection, open-prompt and account-change cells. The
proof inventory grows by two burns and three claims. No other change.

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
   `gh pr checks --watch` (the arc-2 PR's `harness.yml` flip job is P4's CI verification — its first run happens
   here). `gh stack merge` is the owner's call, and so are the two production deploys after it (§7). Then mark
   `implementations-plan/index.md`.

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

## Seeds (final — approved 2026-09-12)

ELI5 companion (Artifact mode): https://claude.ai/code/artifact/e51eba92-5d79-4506-8124-4ca750522962 — source
`implementations-plan/yacana-bridge/eli5.html` (republish the same file to keep the URL). Use exactly one seed per
session; they do not compose. `/goal` is the recommended one.

```
/goal All eleven phases marked ✓ in implementations-plan/yacana-bridge/plan.md (the per-phase headers in the file — not the chat, not the task list), each ✓ backed by its phase's validation gate as written in plan.md §6 reported passing in the transcript; for each phase the agent has printed `LESSONS_FILE=implementations-plan/yacana-bridge/lessons/phase-N.md`; at each of the four arc boundaries the codex fix loop of plan.md §10 (steps 2–3, `/codex high`, both verbatim rules, resumed until a round yields nothing material, hard stop at 3) has converged with its rounds logged in lessons; the final cross-arc codex pass over `git diff main...HEAD` has converged; then Delivery per §10 step 5: `gh stack submit --auto`, each PR body ending with the attribution line, `gh pr checks --watch` green on every PR in the stack. Never merge, never deploy production (`site:deploy`, the v5 Worker's custom domain), never expand scope beyond plan.md; the testnet rehearsal (P11) runs on preview deployments only. Fast layers after every meaningful edit: `bun run lint` and `bun test` for the touched packages; `bun run lint:actions` before any workflow push.
```

```
/loop 15m Drive implementations-plan/yacana-bridge forward. Never idle waiting for my input. Each firing:
1. Reality check: read implementations-plan/yacana-bridge/plan.md and lessons/ (authoritative state — not the chat); native task list empty? rebuild it from plan.md §6's phase headers plus one task per arc fix loop, the cross-arc pass and Delivery; run `git status` and `git log --oneline -5`; with a stack open, `gh stack view`.
2. Waiting on CI is fine — confirm it is progressing (`gh run watch <run-id>` up to 10 minutes; stuck past that → inspect logs, log it as blocked in lessons). Use the wait: review the diff, prep the next phase, strengthen tests. Do not start work that conflicts with the in-flight change.
3. No task in hand? Pick the next pending step from plan.md and start it. After each meaningful edit run `bun run lint` and `bun test` for the touched packages (`bun run lint:actions` for workflows). Commit → push (`gh stack push`; `gh stack sync` if trunk or a lower arc moved).
4. Stuck, or facing a decision you would normally bring to me? Do not wait. Call `/codex high` with full context and go back and forth until you reach a defensible decision, then act on it. Log every consult + verdict in lessons/phase-N.md. Hard limits stay hard: never merge, never deploy production, never expand scope beyond plan.md; P11 runs on preview deployments only.
5. Same step failed 5 times? Stop retrying; reassess with codex, then continue down the agreed path.
6. Phase green? Green means the phase's validation gate as written in plan.md §6 passes. Run the full gate, paste the result, mark ✓ in plan.md, file the lessons entry, print `LESSONS_FILE=implementations-plan/yacana-bridge/lessons/phase-N.md`, advance. Arc boundary crossed (P3, P5, P8, P11)? Run plan.md §10 steps 2–3 on that arc's diff before `gh stack add` opens the next arc.
7. All phases ✓? Close out per plan.md §10: the fresh cross-arc codex pass over `git diff main...HEAD`, then Delivery (`gh stack submit --auto`, PR bodies with the attribution line, `gh pr checks --watch`). Merging and the two production deploys are mine.
Keep the native task list current (plan.md stays the source of truth).
```
