# Independent plan: Yacana bridge

Build the contracts first, but gate migration integration on a standalone governance-upgrade rehearsal. Preserve one Aztec deployment per app build. No relayer service; manual operation and self-forwarding must be honest, usable paths.

Confidence is **high** for the cited repository/API findings. Runtime compatibility remains **unverified until the harness gates pass**.

## 1. Resolve these contradictions before freezing contract interfaces

1. **Frozen allowance versus eventual redemption:** draft 3 freezes growth, while draft 2 promises every blocked exit eventually passes. Both cannot hold. Without reservations, exits also have no queue position. Recommendation: specify a finite, competitive retirement allowance and disclose exhaustion; accepting that loss risk—or redesigning admission—is an owner decision.
2. **`flipAt` is observation time:** Registry does not expose historical activation timestamps through its getters. Calling `retire` late enlarges the purported frozen budget. Choose authenticated flip timing or explicitly observation-based semantics; do not describe the latter as freezing at the actual flip.
3. **Deadline indexing:** “version after next becomes canonical” means activation of Registry index `i+2`; `flipAt[successor²]`, defined as departure, means a later event. Store activation/retirement observations separately; an unseen required transition means the deadline remains open, not timestamp zero.
4. **Retire hash:** K5 must use `compute_secret_hash([0])`, not literal zero.
5. **Skipped versions:** if Registry contains V6, V5 cannot directly forward to canonical V7 under strict-successor rules; recover through K6, then deposit into V7.
6. **No bot:** remove guaranteed forwarding and bot-health copy. “Ready to forward” remains actionable until an operator or user submits it.

These are interface gates, not implementation details to decide silently.

## 2. Architecture & implementation

### Contracts and shared protocol

Keep bridge entrypoints **inside `YacanaMiner`**, with hashing and checkpoint helpers in separate Noir modules. The immutable token minter makes inbound issuance belong there. A separate bridge would need a privileged mint adapter and another authenticated actor, increasing the attack surface without removing trust.

Add:

- `exit_to_l1(amount, recipient, tag, authwit_nonce)`
- `send_ahead(amount, secret_hash, redeem_key, authwit_nonce)`
- `claim_from_l1(amount, secret, recipient, leaf_index)`
- `retire(leaf_index)`
- An `#[only_self]` public exit recorder, counters and `retired`.

Exits burn only the bound token from the authenticated caller. Create an authwit using the installed wallet’s `{caller, call: await action.getFunctionCall()}` form, then supply it through `authWitnesses`. Use fresh authwit nonces independently of recovery indices.

Check retirement in **public `record_claim`**, where execution ordering is authoritative; an early private historical check improves feedback but cannot prevent a race by itself. Retirement leaves exits and inbound claims enabled. Tests must establish that rejection leaves neither mint nor successful exit/message accounting behind.

Replace the ambiguous checkpoint tuple with a versioned deployment record containing the source deployment, finalized checkpoint, mining epoch, target and seed. No balances or supply are initialized from it. Define continuation seed derivation and whether migration starts a fresh mining epoch; do not rerun the launch lottery accidentally.

Create `packages/portal`, a Foundry workspace. `YacanaPortal` constructs its immutable ERC-20, avoiding circular deployment initialization. ERC-20 mint and allowance-consuming burn entrypoints are portal-only.

Proposed content encodings use `sha256_to_field(selector4 || ABI-encoded words)`:

| Kind | Signature and committed arguments |
|---|---|
| K1 | `yacana_exit_l1(address,uint256,bytes32)` — recipient, amount, tag |
| K2 | `yacana_send_ahead(uint256,bytes32,address)` — amount, secretHash, redeemKey |
| K4 | `yacana_claim(uint256,bytes32)` — amount, secretHash |
| K5 | `yacana_retire(uint256)` — source actor version |

These strings become protocol constants, with Solidity/Noir/TS golden vectors. Restrict amounts to positive `u128`-compatible values.

Portal boundaries:

```ts
type ExitWitness = {
  sourceVersion: bigint;
  epoch: bigint;
  numCheckpointsInEpoch: bigint;
  leafIndex: bigint;
  siblingPath: Hex[];
};

type VersionRecord = {
  registryIndex: bigint;
  miner: Hex;
  launchAt: bigint;
  retirementObservedAt?: bigint;
  exited: bigint;
  inbound: bigint;
};
```

Storage additionally tracks immutable Registry/Safe addresses, pause accounting, schedule parameters and transition observations. Functions: `registerVersion`, `retire`, `forward`, bounded `forwardBatch`, `deposit`, `redeemToL1`, pause/unpause and eligibility views. Validate registration against Registry history; resolve each version’s own Inbox/Outbox.

Compute:

```text
budget = REWARD × N × ALLOWANCE
       + floor(REWARD × N × 3 × elapsed / EXPECTED)

exited + amount ≤ budget + inbound
```

Use checked arithmetic/full-precision multiplication. Count K2 and K3 arrivals in destination `inbound`; count K1, K2 and K6 consumption once in source `exited`. Apply the approved retirement-time rule to `elapsed`.

Pause duration is the **union** of global and local intervals, measured in seconds, capped at 60 days per version; each interval expires within 30 days. Implement lazy accounting without iterating over every registered version. Global pause must become ineffective for a version whose budget is exhausted.

K6 verifies EIP-712 authorization over source version, epoch, derived leaf ID, content, recipient and authorization expiry; domain includes chain ID and portal. The consumed K2 commits to the signer address. A valid signature makes revealing the claim secret unnecessary. Forwarding and redemption compete for the same Outbox leaf.

### Reuse and file map

| Location | Change |
|---|---|
| `packages/contracts/yacana_miner/src/main.nr`; new `bridge.nr`, `checkpoint.nr`, tests | Entry points, execution checks, encodings and continuation |
| `packages/portal/{src,test,script}`, `foundry.toml`, lockfile | ERC-20, portal, deployment, fuzz/invariant tests |
| New `packages/bridge/src/{messages,portal,witness,recovery,state}.ts` | Shared protocol client for browser, operator and stats; generated portal ABI |
| `packages/miner-core/src/keys/`, `reader.ts`; generated layouts | Reuse HKDF and fixed-slot readers; add bridge derivation/counters |
| `packages/deploy/src/deploy.ts`; new operator/checkpoint scripts | Constructor changes, immutable version records, manual bridge operations |
| `scripts/run/isolated-node.ts`; new `toolchain.ts`, `upgrade.ts` | Extract existing binary resolver; independently control node and Anvil |
| `web-miner/src/bridge/`, `session.ts`, `wallet.ts`, controller/boot/state | Journal, consent scheduler, transaction serialization, fee-provider function |
| `web-miner/src/keys/store.ts`, `main.tsx` | Class-specific addresses, scoped claim history, durable snapshots |
| `site/src/browser/{connection,node-guard,host}.ts` | Separate Ethereum RPC admission/health; explicit restore-only legacy hosts |
| `site/src/{config,assemble}.ts`, `site/v5/wrangler.jsonc` | Versioned manifests and frozen-origin build through existing assembly |
| `web-stats/src/routes/Bridge.tsx`; landing FAQ entry | Flow statistics, announcement, `/faq` without another workspace |
| Workflows, deployment docs, threat model, roadmap, lessons/index | Matching package gates and operational evidence |

The new bridge workspace avoids duplicating protocol behavior across three consumers. It does not own wallet sessions or mining.

Derive claim secrets and secp256k1 redemption keys with separate HKDF labels including chain, portal, source version and index. Preserve existing wallet KDF labels. Deduplicate by complete message identity, never secretHash. Gap-20 recovery is a fast scan, not a completeness guarantee; support extended scans and validated recovery files.

Migrate vault metadata without changing encryption AAD blindly: preserve existing ciphertext metadata and add addresses by account class. Account changes are **class-dependent**, not inevitable for every rollup version. Persist `{balance, block, blockHash, at}` under deployment/account identity; label it “last seen.”

Retain `Session`’s single-deployment invariant. Add a serialized bridge controller using existing pause/track/release behavior. The consent-bound hourly scheduler runs only while unlocked, stops on flip/unknown eligibility, and reconciles pending sends before retrying. Inject a `FeeProvider(operation)` function; testnet uses sponsorship, mainnet policy remains deferred.

Flip detection combines Registry, node identity, retired state, checkpoint/proof age and deployment-aware `build.json`. Old tabs retain their current operation and explicitly offer reload. Preserve the existing CSP; extend the fetch guard narrowly.

## 3. Upgrade harness

Implement a **Bun harness over `startIsolatedNode`**, not another network launcher:

```ts
interface UpgradeHarness {
  deployNext(): Promise<RollupRef>;
  executeUpgrade(next: RollupRef): Promise<FlipReceipt>;
  activateNode(version: bigint, autoProve: boolean): Promise<NodeRef>;
  stopNode(version: bigint): Promise<void>;
  proveThrough(version: bigint, checkpoint?: bigint): Promise<void>;
  warpTo(timestamp: bigint): Promise<void>;
  teardown(): Promise<void>;
}
```

Extend ownership handles so stopping V5 preserves Anvil and run data. `toolchainBin()` is currently private; extract it rather than inventing another resolver. Claim all node/admin/P2P ports through the registry; graceful stop precedes bounded group kill. Preserve failure evidence outside transient cleanup.

1. Bootstrap with `AZTEC_GOVERNANCE_VOTING_DURATION=60`. Record actual genesis inputs, addresses and config. Verify persistent directories explicitly: the `--local-network` CLI forwards only selected options, so passed flags are not sufficient evidence.
2. Deploy V6 using exported `deployRollupForUpgrade`: local committee zero, slashing/real verifier off, epoch four, proof window two, matching slot duration/lags/genesis; change only `manaTarget+1`. Fund its FeeJuicePortal through FeeAssetHandler and verify the balance.
3. The helper returns only `{rollup}`. Deploy the shipped `RegisterNewRollupVersionPayload` ABI/bytecode explicitly rather than scraping stdout.
4. Mint/deposit governance tokens sufficient for lock plus voting power; read actual parameters. Call `proposeWithLock`, extract proposal ID, warp/mine past voting start, vote, warp/mine past execution delay, execute.
5. Assert canonical address, history index, GSE latest, distinct versions and distinct boxes. Never impersonate governance or overwrite Registry storage.
6. Quiesce production with admin `pauseSequencer`; drain settlement before clock changes. Resume V5 for an explicit post-flip window, then stop it before activating V6.
7. Start V6 through `--node --sequencer --registry-address … --rollup-version … --node-debug`, with `USE_AUTOMINE_SEQUENCER=1`, `AUTOMINE_ENABLE_PROVE_EPOCH=1`, matching genesis funding inputs and bumped mana target. Never use `--local-network` to attach.
8. Prove V6 can accept and checkpoint an ordinary transaction before deploying Yacana there.

Run one automine sequencer at a time. The harness owns its lifecycle directly; do not nest it inside another isolated-network runner.

| Case | Required assertion |
|---|---|
| Pre-flip send ahead | Proven V5 witness survives shutdown; forwarding and V6 claim mint exactly once |
| Late send | V5 can exit after flip and retirement while production continues |
| Never-proven send | Restart pinned V5 with auto-proving disabled before burning; expire/prune checkpoint and reconcile reverted burn |
| V6 unregistered | Forward reverts without consuming; authorized K6 succeeds after 30 days |
| V5→V7 | Intermediate Registry V6 forces K6+deposit; absent Registry V6 makes V7 the actual successor |
| Ethereum round trip | K1 mint, approval/K3 burn, private claim; net allowance and supply reconcile |
| Pause/limit | Expiry, overlap, exhaustion, replenishment/freeze boundaries and competing exits |
| Retirement | Wrong sender/replay fail; claims racing retirement fail; exits/claims-from-L1 remain enabled |
| Origins | Apex replacement, stale tab, passkey restore, words restore, separate PXE, shared-vault migration |

**Proof classification:** governance, timing, UI and accounting cases may run proverless with synthetic settlement. Real PXE proving is required for a valid mining claim, altered recursive-proof rejection, and representative exit/inbound transactions. Reuse the canary’s proof meter. Synthetic Outbox insertion tests plumbing only; it is not an L1 validity proof. Public-testnet evidence must exercise genuine epoch proving.

## 4. Phases and validation gates

Commands naming new files below become runnable when those files land.

| Phase | Gate and pass criteria |
|---|---|
| P0: protocol decisions/vectors | Resolve §1; `bun test packages/bridge`; matching vectors and explicit boundary semantics |
| P1: contracts/shared client | `bun run contracts:compile`, `bun run contracts:test`, `bun packages/portal/scripts/forge.ts test`, `bun test packages/miner-core packages/bridge`, `bun run lint`; authenticity, replay, accounting and pause invariants pass |
| P2: governance-only harness | `bun scripts/run/upgrade.ts --case governance`; real governance execution, both nodes checkpoint, isolated teardown; no Yacana dependency |
| P3: migration harness/operator | `bun scripts/run/upgrade.ts --case all`; every case above passes; `bun run e2e:agent -- bun test packages/miner-core` preserves existing integration |
| P4: miner/vault/origins | `bun run test:components`; `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`; real-proving canary plus harness-driven migration browser cases pass |
| P5: assembly/docs/rehearsal | `bun run site:build`, `bun run e2e:agent -- bun run site:e2e`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run lint:actions`; both origin artifacts and runbook evidence verified |

Refresh committed artifacts/layouts with existing commands, including `bun run artifacts:commit`; CI must detect drift.

## 5. Security & assumptions

**Attack targets:** forged public exit records, malicious first registration, redeem-signature replay, cap starvation, pause-budget bypass, duplicate browser execution, corrupted recovery files and deployment switching.

Public exit logs include kind, amount, recipient/tag or secretHash/redeemKey, content and local sequence; chain receipts supply transaction/block identity. Logs aid discovery, but Outbox membership authorizes issuance. Bound file sizes, path lengths, fields and chain/portal identities; imported files cannot choose contracts.

Use Aztec 5.2.0 hashes, the pinned viem fork `2.38.2`, and OpenZeppelin’s ERC20/ECDSA/EIP712 at the Aztec lockfile revision `448efeea6640bbbc09373f03fbc9c88e280147ba`. Pin compiler/dependencies, preserve the seven-day package gate and frozen lockfile. CI gets `contents: read`; local cheat-code credentials never enter production operation.

A compromised unlocked page already controls the wallet. Automation increases consequences and requires scoped consent. The Safe’s first-write issuance authority, Aztec proof security and RPC availability remain explicit trust assumptions.

**Verified facts:** `scripts/run/isolated-node.ts` lacks node-only teardown; installed `@aztec/ethereum` exports upgrade/cheat-code helpers; its deployment helper returns only the rollup; `aztec-node-admin.ts` exposes pause/resume; Noir public consumption hashes its supplied secret; `keys/store.ts` validates one stored address.

**Unverified:** two-process restart/genesis/blob availability; wagmi compatibility with the pinned fork; actual future SDK/account-class transition; public-testnet upgrade timing. Each needs recorded evidence, not assumptions promoted to facts.

**Asks:** resolve §1’s allowance/time semantics; confirm the public-testnet upgrade opportunity. A same-rollup Yacana redeploy cannot simulate Registry migration or retrofit bridging into the existing immutable miner.

## 6. Delivery

Keep four stacked arcs:

1. Contracts, portal, shared protocol and deployment records.
2. Governance harness, migration suite **and operator script**—move the script earlier so tests and operators share execution code.
3. Guided miner, everyday bridge, recovery and vault migration.
4. Stats/FAQ, versioned deployment, runbooks and rehearsal.

All four must pass before replacing the testnet app. Rehearse K1/K3 immediately; genuine K2 arrival requires an actual canonical transition. Without it, record K2 as pending validation rather than declaring completion.

Per arc: local gates, independent adversarial/implementation review, targeted fixes and re-review until no material findings; reassess after three failed rounds. `/code-review` stays off. Reject speculative rewrites; comments document invariants, not workflow. Finish with a fresh cross-arc review, then stacked PR submission/checks. Merge and deployment remain explicit release actions.