# audit-fable.md — the Anthropic-family review legs (Fable 5.1, fresh-context `Plan` subagents)

## Round 1 (2026-09-12) — full packet: adversarial, assumption attack, implementation critique, recon check

### The agent's report (verbatim; its trailing list of local file paths dropped)

**Verdict: ship to implementation after the listed fixes; reverse D9's post-flip cap growth first.**

#### Findings

**Blockers**

1. [§2, §3.5, D9] "cap grows until `flipAt + 180 d`; by the floor the cap is at least three times the schedule" — honest supply is bounded by `N × REWARD` per epoch (main.nr:186-189); mainnet `N=24`, `EXPECTED=3600` (yacana.params.json) gives 96 YACA/h, so a 42-day version mints ≈ 97 k, `cap(flipAt)` ≈ 293 k, but `cap(flipAt+180 d)` ≈ 1.53 M: the 180 d of growth funds only an attacker on a compromised old version (mining is retired minutes after the flip). The paused-time exclusion is what created the honest-blocked case the growth then repairs (life 45 d, paused 40 d → `cap(flipAt)` = 15 d-equivalents). — Grow on wall time to `flipAt`, freeze there; a pause only delays and extends the deadline. Bound becomes 3× for every version.
2. [P5 H5, D24] "V5 restarted pinned with auto-prove off" — the `--node` path funds test accounts + sponsored FPC + prefund only (standby.ts:27-30) while the local network's genesis also funds the banana FPC (local-network.ts:173-184) and forces auto-prove on (local-network.ts:132, the CLI passes no such key); V5's root is not reproducible. — Run H5 on V6 (pinned, auto-prove off) before the V7 flip.
3. [P11, D31] "`bun run site:deploy` from the arc-4 branch, no merge" — Workers Builds deploys `main` to production and other branches as preview versions (docs/deployments.md:94-99; wrangler.jsonc routes `yacana.network`): the rehearsal overwrites the live apex with unreviewed code and the next push to main reverts it. — Rehearse the site on the branch's preview version (`hostKind` preview allows keys, host.ts:7-18) plus the `v5` Worker; `site:deploy` after merge.
4. [§3.1 keys, D28] "`addresses` filled at open by re-deriving with the build's class" — `openMaster` fails closed only by comparing the derived address to the stored one (store.ts:161-165); under a new class nothing is stored for it, so wrong words open a fresh wrong account silently. — Add a master fingerprint (a new HKDF label) to the record in this arc, verify it before deriving under a new class.

**Should-fix**

5. [§3.1 `noteTransition`, D17] the overwrite case is a dead zone — same-timestamp `addRollup` overwrites (GSE.sol:276-277) yet `isRollupRegistered` stays true (GSE.sol:564): the authenticated path never matches, the fallback is refused, `flipAt` is unrecordable, `retire` impossible. — Add a sandwich rule (`getLatestRollupAt(ts)` is index+1's rollup and `(ts−1)` is index−1's); wrap `getGSE()` in try/catch.
6. [P4 gate] the flip job in `contracts.yml` — its filter fires on `packages/site|ui|web-*/**`, `package.json`, `bun.lock` (contracts.yml:29-41): a two-node governance run on every UI PR. — Own workflow filtered on `scripts/run/**`, `packages/{harness,portal,contracts,deploy}/**`.
7. [P4, §5 inference 1] "genesis spike, time-boxed to a day" — the pinned set is already known and `computeExpectedGenesisRoot` is exported (standby.d.ts:11). — Compute V6's root with it, pass to `deployRollupForUpgrade`; no spike.
8. [P7] `bridge.e2e.ts` signs in on V5 then V6 — `expectedDeployment()` is build-time (connection.ts:41-47), query overrides cover node/miner/token only (connection.ts:58-68), `assertDeployment` checks the rollup version. — Two builds and servers in one Playwright run, or extend the overrides; size it.
9. [§4 operators] "a wrong first registration could mint up to that version's cap" — a wrong V6 registration also strands every K2 forwarded into it: the K4 message is addressed to that miner (public_context.nr:247-256) and the leaf is nullified (Outbox.sol:161-167), so K6 is gone. — Disclose; the forward script refuses when the registered miner differs from the announced record.
10. [P11] the `v5` Worker serves new code against the frozen record — that miner has no `send_ahead` (main.nr, deployments/elixir-testnet-2026-09-04.json has no portal). — State that the rehearsal's old origin proves role, headers and sign-in only.
11. [§3.1 portal `lib/`] OZ and forge-std as submodules — no `.gitmodules` exists, `actions/checkout` fetches none by default, the 7-day npm gate (bunfig) does not apply. — `@openzeppelin/contracts` from npm with remappings, or vendor.
12. [P6 gate] "`test:replay` incl. opening an existing sealed v1 record" — the replay lane is signed-out only (research/web-miner.md:136). — `tests/vault.bun.test.ts`.

**Nits**

13. [recon.md:48] inverted: `node_modules/viem` is `@aztec/viem` 2.38.2 (hoisted); import as `viem`.
14. [§3.1 `src/aztec`] `getGSE` is IStaking.sol:76, `getTimestampForEpoch` is IValidatorSelection (Rollup.sol:243, 468); the payload lives in `src/periphery/`.
15. [§3.1 lanes 8–10] H5 runs two pinned nodes at once; lanes 0–3 are taken (isolated-node.ts:137-142), window 100 / span 8 — assign 4–6 and 8–10.
16. [§3.3] V6 landing "matches `ExitRecorded` logs" — those live on V5's node and the guard admits one (node-guard.ts:257); `Forwarded`/`Deposited` with `inboxIndex` suffice.
17. [§3.1 deposit] no pause check; ux-brief.md:62 pauses deposits — decide.
18. [§3.1 `registerVersion`] scanning "from the last known index" breaks out-of-order registration; take the index, check `getVersion(index) == version` (Registry.sol:94-96).
19. [§3.2] a 32-byte HKDF output as a secp256k1 scalar: reduce 64 bytes as derive.ts:56-58 does.
20. [§3.4] `deployments/bridge-witnesses-*.jsonl` trips site.yml's `deployments/**` filter (site.yml:25).
21. [§5] "GSE and Registry additions share a timestamp" is assumed (the standard payload); a split payload skews `flipAt`.
22. [research/web-miner.md:167] a same-rollup redeploy is not detected by `viewBuiltOn` (boot.ts:313-314); the rehearsal hits it; the plan is silent.
23. [P3 gate] `e2e:agent` boots a full node (isolated-node.ts:211-219) to deploy on anvil; start `aztec-anvil` alone.
24. [§4] `forge script --private-key` shows the key in the process list; read it inside the script from env.

#### What looks fine

- Message authenticity: per-version boxes, sender/recipient/chainid/root/nullifier checks exactly as claimed (Outbox.sol:137-167, Inbox.sol:80-83); K4 rightly leaves the secretHash to the message (Inbox.sol:109-117).
- The private `retired` read mirrors the existing `open_epoch` anchor read (main.nr:147-153); `#[only_self]`, `emit_event_in_public`, TXE `send_l1_to_l2_message` exist (main.nr:184; event_emission.nr:39; test_environment.nr:971).
- Governance arithmetic: local lock 1e24 (DeploymentConfiguration.sol:155-158), shipped helper locks 1e22 (upgrade_utils.js:63), so 2e24 is right; `proposeWithLock` takes the lock from the caller's power (Governance.sol:427-431).
- Every gate command exists today except the new `rig`, `bridge`, `portal:*` scripts (package.json); `export-layouts`, `artifacts:commit`, `codegen` diffs are the current CI steps (contracts.yml:57-66).
- Redeem binding, deposit `expectedVersion + deadline`, recovery file bound to chainId + portal, `write-once` registration: no replay or front-run found.
- The privacy disclosure holds: the token's `total_supply` is public (token main.nr:58), so amounts leak regardless.

#### Facts verified

GSE trace, overwrite, `isRollupRegistered`, `getLatestRollupAt` (GSE.sol:276-286, 564, 596-598); Registry has no timestamps (Registry.sol:59-96); `toDeadlineEpoch` (TimeLib.sol:68-74); automine owns L1 time and auto-proves (automine/README.md:41, 59); pinned-node genesis check (start_node.ts:83-115); local-network forced config (local-network.ts:128-140); installed exports: `deployRollupForUpgrade`, `upgrade_utils`, `rollup_cheat_codes`, payload ABI/bytecode, `GSEAbi.getLatestRollupAt`, `RollupAbi.getGSE/getTimestampForEpoch`, `pauseSequencer`, `getPublicLogsByTags`, `waitForL1ToL2MessageReady`, `waitForProven`, `createAuthWit`; `aztec-forge/cast/anvil` in the toolchain bin; `burn_private` is `authorize_once` (token main.nr:293); vault AAD (store.ts:107-108); one guarded endpoint (node-guard.ts:62-70); `viem/accounts` exports `privateKeyToAccount`, `signTypedData`.

#### Facts not verified

A public Sepolia RPC with browser CORS (offline); WebAuthn RP-suffix acceptance on `v5.` (no browser run); `aztec set-proven-through` writing no Outbox root; `--local-network` ignoring `--registry-address`; `getGenesisValues` order sensitivity (installed file not located); Noir/Solidity `sha256_to_field` byte equality (the vectors will decide); V5 keeps proposing after the flip (needs a run; automine has no proposer check, README:17).

#### §8 decisions to reverse

D9 (finding 1); D24's V5 restart (finding 2); D31's rehearsal deploy target (finding 3). D17 stands with the sandwich rule.

#### Resolved silently; the owner should decide

The hourly send cadence publishes per-hour win amounts on Ethereum (a privacy choice, not just a UX one); deposits under pause; `launchAt` as an operator input rather than the registration block's time; submodules versus npm for OZ; whether the PR gate boots two nodes; the scope of the wrong-registration disclosure (finding 9).

### Verification and disposition (the driver)

| # | verified | disposition |
|---|---|---|
| 1 cap growth after the flip | Yes: retirement ends honest mints minutes after the flip, so post-flip growth funds only an attacker; the paused-time exclusion under-funds honest supply (mining continues on L2 during a portal pause). | **Adopted — D9 rewritten**: the cap grows on wall time from `launchAt` and freezes at the observed `flipAt`; pauses neither add nor remove cap, they extend the deadline. The bound is 3× the schedule for every version (Ask A7 states the competitive-exhaustion case Codex raised). Retracts the contradiction check's B2 exclusion. |
| 2 V5 cannot be restarted pinned | Yes: `local-network.ts:127-131` forces automine + auto-prove; `:172-178` funds BananaFPC; the pinned check (`standby.ts:26-29`) does not. | **Adopted — D24 rewritten**: H5 runs on a pinned V6 (auto-prove off, genesis computed by the rig) before a V7 flip; the local-network V5 is only ever stopped. |
| 3 the rehearsal deploys production | Yes: `docs/deployments.md:92-99` (`site:deploy` = `wrangler deploy`; Workers Builds deploys `main`). | **Adopted — D31 rewritten**: P11 uses the branch's preview version and no production deploy; the apex switch and the `v5` Worker's custom domain go live after merge, on the owner's call (Ask A12). |
| 4 a wrong phrase opens a wrong account under a new class | Yes: `store.ts:161-165` compares the derived address only. | **Adopted**: a master fingerprint (HKDF label `yacana.master.fp.v1`) added to the record at open; verified before any re-derivation under a new class. |
| 5 GSE dead zone | Moot: D17 is reversed to observation time (Codex's blocker; a split payload defeats the sandwich rule too, the agent's own nit 21). | **Rejected in favour of the reversal**; the GSE is not vendored. |
| 6 the flip job fires on UI PRs | Yes (`contracts.yml:29-41`). | **Adopted**: `harness.yml`, filtered on `scripts/run/**` and `packages/{harness,portal,contracts,deploy}/**`. |
| 7 no genesis spike | Yes (`standby.d.ts:11`). | **Adopted**: the rig computes V6's root with `computeExpectedGenesisRoot`. |
| 8 the browser e2e needs two builds | Yes (`connection.ts:41-47`). | **Adopted**: the rig's browser case builds and serves twice (V5 profile, V6 profile); sized in P7. |
| 9 a wrong registration strands forwarded K2s | Yes (the K4 names the registered miner). | **Adopted**: disclosed in §4; the forwarder script and the app refuse a target whose registered miner differs from the announced record. |
| 10 the rehearsal's old origin | Yes (the frozen miner has no bridge functions). | **Adopted**: P11 states the old origin proves role, headers and sign-in only. |
| 11 submodules | Yes (no `.gitmodules`; the npm gate applies to npm only). | **Adopted**: `@openzeppelin/contracts` and `forge-std` from npm under the 7-day gate, remapped; vendored if a package is missing. |
| 12 replay lane is signed-out | Yes. | **Adopted**: `tests/vault.bun.test.ts`. |
| 13–24 nits | Yes for each checked: lanes 0–3 (`isolated-node.ts:137-142`), `site.yml:25`, `boot.ts:313-314`, the payload under `src/periphery/`. | **Adopted** all: import `viem`; interface paths; lanes 4–6 and 8–10; the landing scan on `Forwarded`/`Deposited` + `inboxIndex`; deposits refused while paused; `registerVersion(index, …)` checked against `getVersion(index)`; 64-byte reduction; witnesses under `deployments/witnesses/` excluded from `site.yml`; `build.json.miner` and the old-tab notice on deployment identity; `l1-deploy.ts --anvil` starts its own `aztec-anvil`; the deploy script reads the key from env. |
| owner items | — | Asks A10 (K2 forward authorisation), A11 (the hourly cadence's privacy), A12 (production deploys after merge); `launchAt` as an operator input disclosed in §4. |

## Round 2 (2026-09-12) — hostile fresh-context leg (Fable 5.1)

### The agent's report (verbatim; its trailing list of local file paths dropped)

**Verdict: not ready for the final pass — the portal's headline bound is not real: `launchAt` is an unbounded operator input, so the "immutable policy" of D38 caps nothing.**

#### Findings

**Blockers**

1. [§3.1 `registerVersion`, §4, D38] "the operators choose which miner a version trusts, never how much it may issue" — `cap = ALLOWANCE + PER_HOUR × (min(now, flipAt) − launchAt)/3600` with `launchAt` free (plan:149-152): `launchAt = 0` gives ≈ 56 y × 288 YACA/h ≈ 141 M YACA to whatever miner they register; "the same trust" is false (a wrong miner is bounded by the cap, a wrong `launchAt` *is* the cap). — Change: the first version's `launchAt` an immutable constructor arg; later ones `require(launchAt ≥ transitions[index])` (`getVersion(index) == version` proves the index exists, `Registry.sol:94-96`); the subtraction saturates at `ALLOWANCE` while `now < launchAt`, because registration precedes the miner's `launch_at` by ≥ `LAUNCH_NOTICE_SECONDS` on mainnet (`launch.nr:15-24`), so `launchAt ≤ now` cannot be required.
2. [P11 gate] "the `v5` Worker's preview version … proves role, headers and sign-in" — `host.ts:7-18`: preview = `<label>` + `VITE_PREVIEW_HOST_SUFFIX` = `-yacana.alejo-amiras.workers.dev` (`docs/deployments.md:100-103`); the `yacana-v5` Worker's previews end in `-yacana-v5.…` → `unknown` → keys refused (`host.ts:36-40`), and the plan's own boot rule (`role old ⇔ versioned origin`) fails closed there too. — Change: a per-role preview suffix in the old-role build and an explicit preview exemption in the role/origin check, or drop "sign-in" from P11.

**Should-fix**

3. [§3.1 `store.ts`, §4 "fetches event ranges", D26/D40] the rescan of the version's `ExitRecorded` logs before every allocation — `emit_event_in_public` tags every log of one event type identically (`event_emission.nr:44-49`); `getPublicLogsByTags` returns ≤ `MAX_LOGS_PER_TAG = 20` per tag per call (`api_limit.ts:7`, `logs_query.ts:43-44,90`) behind an `afterLog` cursor (`:16-19`): unpaginated, the app sees the version's first 20 exits of anyone; paginated, it walks every exit ever on every send. — Change: emit with `emit_public_log_unsafe(tag = hash_or_tag, …)` (what `emit_event_in_public` does one line later) and query the account's ≤ 20 candidates as tags (≤ 100 per call); the P6 queue test runs against > 20 exits.
4. [§3.3 `flip.ts`, D33] `/build.json`'s deployment ≠ the tab's → `flipped` — `assemble.ts:50-55,99` writes it per build; a same-rollup redeploy (P11's own case, `research/web-miner.md:167`) then stops mining under "Aztec V6 is live", and a future in-place miner redeploy invites K2s with no greater-index target (plan:160-162) and, with `flipAt` unset, no redeem. — Change: a `stale` state ("reload"), never `flipped`.
5. [§3.1 `redeem`, D16] `now ≥ flipAt + REDEEM_AFTER` is undefined while `flipAt == 0`: a K2 sent after an announcement whose flip slips or is cancelled is neither forwardable nor redeemable — a strand by omission; and under D37 the 30 days protect nothing (only the holder or a forwarder can consume the leaf). — Change: define redeem for an unflipped version (e.g. `rollup(version).getTimestampForEpoch(epoch + 1) + REDEEM_AFTER ≤ now`, `Rollup.sol:468`) or drop the wait.
6. [§3.1 `keys/store.ts`, D28] "verified before any derivation" — the fingerprint is written at the first open *after this release* (plan:247-249); a device that skips to the class-changing aztec.js has none, and `addressOf` under the new class (`store.ts:138-141`) matches nothing: fail-closed has no verdict. — Change: pin the previous class id in the V6 build and compare the address recomputed under it; else refuse with "open once on the old origin".
7. [P3, §3.6 "thin mocks"] `AlreadyNullified`, wrong version, wrong recipient, cross-epoch `leafId` are `Outbox.consume`'s properties (`Outbox.sol:137-167`); a mock reproducing them tests the mock. Both boxes deploy standalone with the test as `ROLLUP` (`Outbox.sol:74`, `Inbox.sol:43`; `insert` is `onlyRollup`, `:103-104`). — Vendor them (+ `FrontierLib`, `MerkleLib`, `Hash`) and drive real roots.
8. [P4–P5, D25] the rig's L1 key — `TestERC20.mint` is `onlyMinter`, the minter is the deployer (`TestERC20.sol:17-24`), which is also the live V5 node's publisher (`local-network.ts:147-156`, hd index 0): two clients on one EOA while V5 proposes every slot is a nonce race. — Sign the rig's txs from another anvil account funded by one `mint` under quiesce; `deployRollupForUpgrade(privateKey, …)` takes any key (`deploy_aztec_l1_contracts.d.ts:252`).
9. [P7 gate, e2e] a rig-only `bridge.e2e.ts` — `run-suite.ts:48-57` and `mergeShards` (`report.ts:250-256`) require executed titles = `titlesOf(SPEC_FILES)`; the meter fails a passing title off the list (`proof-inventory.ts:98-100`, `fixtures.ts:77`). — A `RIG_ONLY` section beside `REPLAYED`, excluded by the merge; else `e2e.yml`'s dispatch merge is red forever.
10. [§3.5 deposit, P10] "deposits close 24 h before" is UI-only; the portal accepts a deposit one block before the flip whose Inbox message a stopping V5 may never consume (`Inbox.sol:141-159` advances only as the rollup consumes): burned, unminted, unrefundable. — The runbook's pre-flip step is `pause(V5)` (D10 refuses deposits under pause; it also holds forwards, and extends the deadline), or a deposit-only switch — owner's call.
11. [§3.4, §4 witnesses] `deployments/witnesses/*.jsonl` excluded from `site.yml` and never served — after V5's node is gone a fresh device cannot self-forward a held K2 (the guard admits one node, `node-guard.ts:62-70`); the archive is public data. — Serve it, or state that self-forward needs the operator after V5.
12. [§3.1 `_sync`] records `index+1, index+2` only; `registerVersion(V6, 1)` proves `numberOfVersions() > 1` yet leaves `transitions[1]` (= `flipAt(V5)`) to the runbook's minute-one call. — Record `transitions[index]` at registration and in `_sync`.

**Nits**

13. [A1] the continuation seed is public from deployment and `launch()` is ≥ a day later on mainnet (`launch.nr:15-24`): V6's first epoch is pre-minable — precisely what `launch.nr:1-8` built the lottery against; bounded to N × REWARD (96 YACA). A1 must say so; `genesis_epoch_seed(seed, 0, now)` narrows it for free.
14. [§3.1 cap] `min(now, flipAt) − launchAt` underflows while `now < launchAt` → every cap-reading entrypoint reverts for that version: saturate (see 1).
15. [§3.1 deposit/`_sync`] an unregistered `expectedVersion` has `registryIndex == 0` — V5's index: check `registered` first.
16. [§3.1 `forwardMany`] a try/catch also swallows an out-of-gas leaf (63/64 rule): bound per-leaf gas.
17. [§3.5 snapshot] the private balance lands in plaintext localStorage beside the unscoped claims log (`main.tsx:20-21`): undisclosed.
18. [§3.3 landing] forwarded K2s carry V5-labelled secrets, deposits V6-labelled ones (plan:275-279): the V6 scan derives under both; unstated.
19. [§3.1 `pauseAll`] exhausted budget on one version: revert the loop or skip? Specify skip + event.

**§8 to reverse**: D26's tagging (3); D38's free `launchAt` (1); D33's build.json signal (4); D16's undefined pre-flip redeem (5); §3.6 mocks (7).
**New owner asks**: YACA's minter is one immutable portal — a portal bug means a new token (accept, or a one-way `setMinter` under the Safe); the pre-flip deposit close (10); publishing the witness archive (11); A1's pre-minable epoch (13).

#### What survived scrutiny

- Observation time: every caller's delay only grows `flipAt + 180 d` and `afterNextAt`; a griefer cannot shorten a window; the attacker's gain is the cap growth between the true flip and the first portal call.
- `Forward` and `Redeem` differ by type name and both bind `(version, epoch, leafId, contentHash)`; the Outbox nullifies per `(epoch, leafId)` (`Outbox.sol:160-165`): no cross-replay found.
- Up-front pause accounting with refund keeps `deadline − pausedSeconds` fixed; a pause cannot reopen a closed version.
- Per-version boxes: `sender.version`, `recipient.actor`, `chainid`, non-zero root (`Outbox.sol:137-153`); `sendL2Message` open and version-checked (`Inbox.sol:75-83`).
- Two §5 inferences now have source support: the PXE prunes after a reorged block (`block_synchronizer.ts:20,125`), and L1 has no canonical gate on propose/prove (`ProposeLib`/`EpochProofLib` grep empty; `Staking__NotCanonical` only at `StakingLib.sol:217`).

#### Facts verified

`Registry.sol:59-96` (`numberOfVersions`, `getVersion`, no timestamps); `Outbox.sol:130-170`; `Inbox.sol:75-128`; `Hash.sol:49-51`; `TimeLib.sol:69-75`; `GSE.sol:110-113,281-286`; `RegisterNewRollupVersionPayload.sol:36-47`; `RollupConfiguration.sol:133-146`; `DeploymentConfiguration.sol:152-164`; `Governance.sol:427-431,488-506`; `RollupCore.sol:457`, `Rollup.sol:205,468,582`; `private_context.nr:861-910`, `public_context.nr:239-263`, `test_environment.nr:971-979`, `event_emission.nr:39-50`; `main.nr:147-153,191-196,215`; `local-network.ts` forced automine/prove + BananaFPC; `standby.ts:24-37`, `start_node.ts:111-115`; automine `:184-187,229-241,316-333,340-349`; `aztec-node/dest/aztec-node/config.js:62,67`; `node-lib/dest/config/index.js:4-14`; `deployRollupForUpgrade` returns `{rollup}`; `aztec_start_action.ts:33-49`; repo `isolated-node.ts:46,137-142`, `toolchain.test.ts:20-24`, `internal-bin/{forge,anvil,cast}` present, `node_modules/viem` = `@aztec/viem` 2.38.2, `config.ts:114`, `vite-base.ts:52-54`, `connection.ts:40-46`, `store.ts:107-171`, `controller.ts:438-449`, `boot.ts:313-314`, `passkey.ts:91-95`, `wallet.ts:69`, `contracts.yml:16-41`, `site.yml:25`, `docs/deployments.md:92-103`, `fake-indexeddb` present (`web-miner/package.json:46`), `deploy.ts:95-99,198`.

#### Facts not verified

`wrangler versions upload` against a never-deployed Worker; a CORS-enabled public Sepolia RPC; WebAuthn RP-suffix acceptance in a real browser; whether `runProve` moves L1 time (only `reconcileDateProvider` at `:709`, which follows L1 — and the settler ignores `paused`, so quiesce rests on it); the admin `pauseSequencer` → `pause()` wiring; `set-proven-through` writing no root; Noir↔Solidity `sha256_to_field` byte equality; the K2's `inbound[target]` credit on forward (plan:156-163 omits it; `design-spec.md:68-69` requires it) — an ambiguity, settled by reading the implementation.

### Verification and disposition (the driver)

| # | verified | disposition |
|---|---|---|
| 1 `launchAt` unbounded | Yes (and Codex's round 2 raised it independently). | **Adopted**: `launchAt ∈ [now − 7 d, now + 90 d]` at registration and a saturating cap (`ALLOWANCE` while `now < launchAt`); the window bounds backdating to 7 d × `PER_HOUR`. Fable's `launchAt ≥ transitions[index]` rejected: it under-funds a version registered late (a miner already running before registration). Disclosed in A7. |
| 2 the `v5` preview host is `unknown` | Yes (`host.ts:7-18`; `docs/deployments.md:100-103`). | **Adopted**: the old-role build carries its own `VITE_PREVIEW_HOST_SUFFIX` (`-yacana-v5.…`); role `old` allowed on `versioned`, `preview`, `local`, refused on the apex; the preview rehearsal proves role, headers and a preview-RP sign-in; apex-passkey continuity is P8's cross-origin e2e. |
| 3 event tag per type; 20 logs per tag | Yes (`event_emission.nr:39-49`; `api_limit.ts:7`; `logs_query.ts:43-51`; `emit_public_log_unsafe(tag, log)` at `public_context.nr:110-121`). | **Adopted — D26 amended**: two public logs per exit: the `ExitRecorded` event under its type tag (the operator's paginated enumeration with `afterLog`) and the same payload under `compute_log_tag(hash_or_tag, DOM_EXIT_LOG)` (the owner's scan: its ≤ 20 candidate tags in one call); the P6 test runs past 20 exits. |
| 4 `build.json` mismatch as `flipped` | Yes (`assemble.ts:50-55`). | **Adopted — D33 amended**: `stale` ("reload"), never `flipped`. |
| 5 redeem undefined before the flip; the 30 d protect nothing under D37 | Yes. | **Adopted — D16 amended**: the wait is dropped; a held K2 is redeemable by its holder any time after settlement under the cap, pause and deadline; A4 loses the 30 d bound; the copy loses "after 30 days". |
| 6 fingerprint bootstrap on a skipped device | Yes (also Codex round 2). | **Adopted**: refuse with "sign in once at the old origin (its build still derives the old address), or restore again"; the pinned-old-class recomputation noted as the fallback once the old origin is gone. |
| 7 thin mocks test the mock | Yes (`Outbox.sol:74`, `Inbox.sol:43`: standalone with `_rollup` = the test). | **Adopted**: the real `Outbox`/`Inbox` (+ `FrontierLib`, `MerkleLib`, `Hash`) vendored and deployed in Foundry with the test as the rollup; only the Registry is mocked. |
| 8 the rig's key races the publisher | Yes (`TestERC20.sol:11-21`; `local-network.ts:145-150`). | **Adopted**: the rig signs from anvil account 1, funded by one deployer `mint` while the sequencer is paused. |
| 9 the e2e title merge | Yes (`run-suite.ts:47-57`; `proof-inventory.ts:92`). | **Adopted**: a `RIG_ONLY` inventory section excluded from the shard merge. |
| 10 a deposit right before the flip | Yes (`Inbox.sol` semantics). | **Adopted**: `closeDeposits(version)` (operators, one-way) as the runbook's pre-flip step 24 h before the announced flip; the UI's close mirrors it. Pausing V5 rejected: it would also hold V5's exits in the critical window. |
| 11 witnesses unreachable after V5's node | Yes (`node-guard.ts` admits one node). | **Adopted**: the archive is copied by `assemble.ts` to `/witnesses/<profile>.jsonl` and fetched same-origin when the source node is gone; a K2 not yet archived needs the source node or the operator (stated). |
| 12 `_sync` misses the version's own index | Yes. | **Adopted**: `_sync` records `{index, index+1, index+2}`; `registerVersion` syncs. |
| 13–19 nits | Yes where factual (`launch.nr:15-24`; `main.tsx:20-21`). | **Adopted** all: A1 states the bounded pre-mining and the seed mixes the actual open timestamp; saturation; `registered` checked first; per-leaf gas bound; the snapshot sealed under the master and disclosed; the landing scan derives under both versions' labels; `pauseAll` skips + event. |
| the `inbound[target]` credit | An omission in §3.1's text. | **Fixed**: a kind-2 forward credits `inbound[target] += amount`. |
| new owner asks | — | A13 (the token's immutable minter); the deposit close and the witness archive are design (D48, D45); A1 amended. |
