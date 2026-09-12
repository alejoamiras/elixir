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
