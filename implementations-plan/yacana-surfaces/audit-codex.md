# Codex audits — yacana-surfaces

Session `01a07183-edc1-7570-aa03-4ab3e6d11382` (gpt-5.6-sol, xhigh). The independent plan draft is `drafts/codex-plan.md`.

## Round 1 · contradiction check (resumed session)

Verdict: **contradictions found** (11). Adopted / rejected:

| # | finding | severity | disposition |
|---|---|---|---|
| 1 | storage reads cannot give a "last claim" timestamp or true rolling claims/hour; keep an incremental `scanClaimWindow` | High | **rejected**: the owner explicitly accepted losing per-claim timing; claims/hour over closed epochs is derivable from `opened_at` + claim counts; block bodies need Poseidon2 leaf-slot hashing in the browser (the stats read path ships no WASM). The Observatory tile is reworded ("open epoch · 2 claims · opened 3 min ago"). Ledger row added. |
| 2 | slot table: hard failure beyond epoch 262,143 or on a missing chunk; generator under `miner-core/scripts/**` not in app filters | Med | **adopted**: a visible "history unavailable beyond epoch N" state, the tiles that need no map slot stay; filters include `packages/miner-core/scripts/**`. Lazy bb.js fallback still rejected (it would pull the prover pipeline into stats). |
| 3 | deleting app wrangler files contradicts the owner's wording; `_headers` moved in P2.1 before assembly | High | **adopted**: apps keep name-less `wrangler.jsonc` for `wrangler pages dev`; `vite-base.ts` injects the rendered headers from P2.1 on, so standalone builds never lack isolation headers. |
| 4 | indexed rotation unrecoverable beyond indexes 1–3; second credential was safer | High | **adopted in part**: a full discovery protocol (sequential indexes, gap 5, "look further", tested in bun and E2E) plus "move here" consolidation; the second-credential alternative stays rejected (a passkey or phrase per rotation multiplies what the user must keep). |
| 5 | `DemoIn.job` lacks the domain inputs; "no WASM" wording | Med | **adopted**: the job carries `chainId, rollupVersion, miner, version`; the Worker computes the domain; wording: WASM-free read path, click-gated demo chunk. |
| 6 | P0.2's interim `yacana-wallet-*` cleartext DB survives P2.3; `elixir-wallet-*` too | High | **adopted**: P2.3 imports `yacana-wallet-*` accounts as sealed `legacy` records then deletes the DB, deletes `elixir-*`; tested; the security claim is qualified until the sweep. |
| 7 | gates summary overclaims; Vitest RTL specs as `*.test.tsx` collide with root `bun test` | High | **adopted**: summary corrected; DOM specs are `*.vitest.tsx`. (Verified: `bun test` runs today's vitest-authored pure specs fine; jsdom ones would not.) |
| 8 | `e2e.yml` lacks codegen + contract compile; filters miss `miner-core/scripts/**`, artifacts, slots, deployment inputs | High | **adopted** (`e2e.yml` steps; filters extended). |
| 9 | `node.getContract(to)` cannot see a local initializerless recipient | Med | **adopted**: `wallet.getContractMetadata(to)` first, then `node.getContract`; claim weakened. |
| 10 | "no third-party requests" is false (the Aztec RPC); `base-uri 'none'` silently dropped | Med | **adopted**: footer copy "no requests except to the Aztec node you choose"; `base-uri 'none'`. |
| 11 | `gh stack init --adopt` does not exist | Low | **adopted**: `git branch -m … && gh stack init arc0-rename` (verified with `gh stack init --help`). |

Codex's verbatim response:

---

contradictions found

1. **Stats architecture / P3.1–P3.2 — High.** Storage snapshots cannot produce the specified “last claim” timestamp or true rolling claims/hour; substituting claim count plus epoch age changes the brief. “No indexer” forbids a server, not bounded browser reads. **Fix:** retain an incremental `scanClaimWindow`: initially scan backward only to one hour/the latest claim, cache the last block, then fetch new block bodies. Do not rescan 48 epochs every poll.

2. **Slot table / P3.1 / CI — Med.** The table is the better normal path, but rejecting lazy bb.js entirely creates a hard failure after epoch 262,143 or when a chunk is missing—especially problematic with no scheduled rebuild. Its generator is also under `miner-core/scripts/**`, while app filters name only `miner-core/src/**`. **Fix:** keep tables primary, add lazy bb.js only as an exceptional fallback, generate once per site build, and filter/test `scripts/**`, slot outputs, deployment records, and contract storage layouts.

3. **One-origin assembly / P2.1 / P4.2 — High.** `packages/site` is cleaner than three independently deployable Wrangler files, but deleting app Wrangler files contradicts the owner’s explicit “each package keeps its own `wrangler.jsonc`.” Moving `_headers` in P2.1 before assembly lands also risks a standalone miner build without isolation headers. **Fix:** keep `packages/site` as the sole production deployable; retain app-local, dev-only Wrangler configs and copy shared headers into standalone builds until P4.2.

4. **Rotation / recovery — High.** Indexed rotation is unrecoverable beyond the hard-coded new-device search of indexes 1–3. A synced passkey restores the master, not the last-used index; index 4 can silently strand funds. **Fix:** reinstate a fresh same-method credential/phrase per rotated account, or specify a complete deterministic discovery protocol with a tested gap limit and explicit index backup. The second-credential alternative was safer as drafted.

5. **Demo interface / slot-table prose — Med.** `DemoIn.job` lacks `chainId`, `rollupVersion`, miner address and version, although the critical path says the Worker computes `deployDomain(...)`. The claim that landing “ships no WASM” also contradicts its lazy prover Worker. **Fix:** include those inputs or pass a precomputed domain, and say only the landing’s reader path is WASM-free. Shared Worker reuse remains preferable to an iframe.

6. **P0.2 temporary wallet → P2.3 vault — High.** P0.2 creates cleartext `yacana-wallet-*`; P2.3 merely asserts a fresh run does not create it. Existing `elixir-wallet-*` and temporary Yacana databases remain, contradicting “no sk/signingKey on disk.” **Fix:** add a legacy-database transition test and explicit sweep/delete flow after moving funds to a recoverable account; qualify the final security claim until cleanup completes.

7. **Validation gates / component tests — High.** The summary says every phase runs every layer, while multiple gates omit U, C, or E. Worse, current Vitest includes `src/**/*.test.*`, which root `bun test` also discovers; new RTL/jsdom component tests will run without Vitest setup. **Fix:** correct the summary and use a Vitest-only filename pattern such as `*.vitest.tsx`, excluded from Bun discovery.

8. **`e2e.yml` / path filters — High.** The manual clean-runner job installs Aztec and Chromium but never runs codegen or contract compilation; the current E2E setup deploys from compiled artifacts absent in a clean checkout. **Fix:** run `bun run codegen && bun run contracts:compile` first. Add missing upstream filters for `miner-core/scripts/**`, contracts/artifacts, generated slots, and deployment/config inputs.

9. **P2.4 Withdraw — Med.** `node.getContract(to)` cannot recognize a freshly created initializerless account registered only in the local PXE, yet the E2E transfers to exactly such a second local key. It also does not prove the recipient is actively syncing. **Fix:** accept `wallet.getContractMetadata(to).instance` for local recipients, fall back to `node.getContract` for published external instances, and weaken the security claim accordingly.

10. **Security copy / silently resolved choices — Med.** The landing promises “no third-party requests” while directly calling a remote Aztec RPC; the codex draft flagged this, but the ledger omits it. It also silently chose `base-uri 'self'` over the stricter, usable `none`. **Fix:** obtain approval for “only the named Aztec RPC; no trackers/cookies,” and use `base-uri 'none'`.

11. **Delivery — Low.** `gh stack init --adopt` is not supported by the installed `gh stack`. **Fix:** rename the current branch with Git, then run `gh stack init arc0-rename`.

What looks fine: the memory-backed WalletDB correction, exact `@scure/bip39` 2.3.0 pin, 64-byte `fromBufferReduce` derivation, actual Aztec token method names, query-override gating, centralized site assembly, and shared Worker instead of an iframe.

## Round 2 · double audit (resumed session)

Verdict: **reject** (blocking: legacy migration typing, indexed recovery, preview credentials, build provenance). 
Disposition of codex round 2 (14 findings):

| # | finding | severity | disposition |
|---|---|---|---|
| 1 | legacy migration cannot hold independently chosen legacy fields; delete-after risks loss | High | **superseded**: the migration is dropped entirely (fable round 2 showed it is unreachable: the new origin starts empty, first deploy at arc 4); boot refuses unexpected wallet DBs instead. Ask 3. |
| 2 | auto-deleting `elixir-*` databases is destructive and unauthorised | High | **adopted** by removal: nothing is deleted unasked (and `elixir-*` cannot exist on the new origin). |
| 3 | gap-5 discovery misses a consolidated key beyond a gap | High | **adopted**: discovery counts *used* indexes (any note, active or nullified), rotation never leaves usage gaps, `highestIndex` persisted locally, "look further"; Ask 2 makes the owner accept the residual. Second credential still rejected. |
| 4 | the `pull_request` preview job hands the Pages token to PR-controlled workflow code | High | **adopted**: `preview-web.yml` runs on `workflow_run` from the trusted `main` definition over the built artifact; artifact checks (`build.json`, no `_worker.js`/`functions/`/symlinks); `environment: preview`; Ask 7. |
| 5 | E2E and production share `dist`; no fail-closed separation | High | **adopted**: E2E assembles into `e2e/.dist`; production mode refuses E2E flags, localhost/IP/non-HTTPS origins and RP-ID mismatch; `build.json` verified at deploy; overrides need the flag AND `hostname === 'localhost'`. |
| 6 | vault copy imprecise; IVs/AAD/versioning; mode switch must delete ciphertext | Med | **adopted** (copy "no spend secret at rest"; `v: 1`; fresh IV; AAD internal; switch-back test). |
| 7 | ceremony/form/withdraw/demo/CSP invariants | Med | **adopted** (challenge/user id/attestation/timeout/abort/exclude; PRF digest precomputed; autocomplete off; review snapshot; decimal parsing; thread clamp ≥ 1 + timeout + `finally`; `script-src-attr 'none'`; `style-src-attr` audit in P2.1). |
| 8 | node trust understated | Med | **adopted** (`assertDeployment`, caps, timeouts, the RPC's view stated). |
| 9 | Facts: WalletDB also calls `close`; npm availability is external | Med | **adopted** (memory store implements the full map + `close`, run against `map_test_suite` and a WalletDB lifecycle test; npm resolution dated). |
| 10 | `getTxEffect` deprecated; recipient check proves less than claimed; IP-literal refusal unverified | Med | **adopted** (`getTxReceipt(…, { includeTxEffect: true })` — verified deprecated at `aztec-node.d.ts:294`; the check is a warning; P2.1 spikes `127.0.0.1`). |
| 11 | missing Asks (legacy deletion, recovery semantics, preview trust, ask-every-open default, RP ID gate) | High | **adopted**: Asks 1–9; the placeholder RP ID is refused by the production assembly. |
| 12 | production config only for web-miner; deploy paths | High | **adopted**: `packages/site/site.env` + `deployments/<profile>.json` through `src/config.ts` for all three apps; `packages/site/dist` everywhere. |
| 13 | `EpochRow.seed` required; `openWallet` single-account; per-key PXE deletion impossible | Med | **adopted** (`seed?`; `registerAccount`; "forget everything on this device"). |
| 14 | TTL anchor; `epoch-stats --json` needs a file; wrangler map; gate L placeholders | Med | **adopted** (`expiresAt` from the proven anchor header; `--json <file>`; app wrangler files kept; `L(<pkgs>)` named per phase). |


Verbatim response:

---

VERDICT: reject (blocking: destructive/impossible legacy migration, unreliable indexed-key recovery, unsafe PR-preview credentials, and no fail-closed production/E2E build separation)

## Security

1. **High — P2.3 / sealed storage.** The migration cannot work as typed. `KeyRecord.method` excludes `legacy`, and the vault seals a derivation master, while legacy WalletDB contains independently chosen `secretKey`, `salt`, and `signingKey`. Deleting afterward risks permanent loss. **Fix:** version the payload as `master | legacy-fields`, include `legacy` in the record type, prove reopen/transfer in E2E, and delete only after successful verification.

2. **High — P2.3 / rename hazards.** Automatically deleting every `elixir-*` database because the deployment has “no value” is destructive and unauthorized; testnet keys, notes, or provenance may still matter. It also contradicts the earlier “orphaned” description. **Fix:** preserve and detect these stores, explain the deployment mismatch, and require explicit user confirmation before deletion. Surface this as an Ask.

3. **High — Rotation discovery.** `GAP=5` is not a reliable used-account marker. After consolidating funds, indices 1–5 can be empty while index 6 remains funded, so restore silently stops early. “Look further” helps only users who already know. **Fix:** restore second credentials, persist/export a recoverable maximum index, or require explicit index entry. If retaining gap discovery, the owner must explicitly accept possible undiscovered funds.

4. **High — `deploy-web.yml` preview.** Same-repo PRs receive the Pages token while the PR controls workflow/build inputs and dependencies. An environment name alone is not protection unless mandatory approval is configured. The token is account-scoped Pages Edit, not project-isolated. **Fix:** use a trusted default-branch `workflow_run`/manual deployment job that only downloads and validates a static artifact, forbid `_worker.js`/functions/symlinks, require preview-environment approval, and run locked Wrangler without executing PR scripts.

5. **High — P2.1/P4.2 headers and query flags.** E2E and production both write `packages/site/dist`; an E2E artifact can contain localhost CSP plus `VITE_E2E_QUERY_OVERRIDES=1` and later be deployed. A snapshot test does not enforce artifact provenance. Raw environment origins could also inject malformed CSP unless canonicalized. **Fix:** use separate `e2e/.dist`; make production assembly reject the E2E flag, localhost/IP origins, RP-ID mismatch, and non-HTTPS URLs; require query overrides to satisfy both the compile flag and `location.hostname === "localhost"`; emit and verify a build-mode manifest before deploy.

6. **Med — passkey/vault.** “Nothing is stored but the credential id” is false—address/index/method metadata persists—and “encryption protects disk-at-rest bytes and backups” contradicts the admission that the device CryptoKey is backed up with the ciphertext. Any compromised same-origin landing/stats bundle can invoke that key. Ask-every-open is the correct safer default; convenience mode is only obfuscation against partial copies. **Fix:** use precise “no spend secret at rest” copy, version records, require unique 96-bit IVs, construct AAD internally, and test that switching back to ask-every-open deletes ciphertext and device-key access.

7. **Med — ceremony/forms/withdraw/demo/CSP.** WebAuthn options omit fresh challenge/user ID, `attestation: "none"`, timeout, abort, and duplicate exclusion; precompute the fixed PRF digest before the click. Phrase inputs need autocomplete/autocorrect/spellcheck disabled and explicit state clearing. Withdraw must snapshot parsed recipient/mode/amount at review and avoid float/exponent parsing. Demo threads can become zero and the Worker survives hangs/errors. CSP leaves all inline styles enabled. **Fix:** add these invariants and tests; clamp demo threads to at least one with timeout/finally termination; audit `style-src-attr`, add `script-src-attr 'none'`.

8. **Med — node trust.** “A malicious node can only mislabel” omits censorship, oversized responses, privacy leakage, fake chain metadata, and resource exhaustion. **Fix:** verify chain/rollup/deployment identity, cap epochs/ranges/concurrency/response sizes before slot lookup, add timeouts, and state that the RPC sees IP, timing, reads, and submitted transactions.

## Assumptions

### Facts

9. **Med — Facts line 236.** WalletDB does not use only the listed map calls: it invokes `store.close()` and `deleteAccount()` uses map deletion; `AztecAsyncKVStore` also has a wider structural interface. The proposed map-suite-only test is insufficient. npm availability is external state, not a cwd-verified fact. **Fix:** include `close`, test the exact WalletDB consumer lifecycle, and move package availability/version resolution to Inferences until locked.

### Inferences

10. **Med — Inferences line 238.** `getTxEffect` exists but is explicitly deprecated in Aztec 5.2.0; use `getTxReceipt(txHash, {includeTxEffect:true})`. `getContractMetadata`/`getContract` proves an instance is known, not that the recipient currently controls or syncs it. IP-literal WebAuthn refusal is unverified and is asserted as fact in Architecture. **Fix:** spike localhost versus `127.0.0.1` first, weaken recipient guarantees to a warning, and use the receipt API.

### Asks

11. **High — Asks.** Missing owner decisions: authorization to delete legacy stores; acceptable indexed-account recovery semantics; mandatory preview approval/trust model; and confirmation of the ask-every-open default, which changes the binder. The RP ID cannot remain a shipping placeholder. **Fix:** add these Asks and make hostname approval a hard gate before creating any production credential.

## Implementation

12. **High — production configuration/CI.** P0.3 creates only `packages/web-miner/.env.production`, while site/stats/landing need the same node, addresses, and RP ID. `deploy-web.yml` sets only `VITE_SOURCE_COMMIT`. It also uploads/deploys `dist`, although architecture outputs `packages/site/dist`. **Fix:** create one validated site build-config source, derive addresses from `deployments/testnet.json`, supply the remaining explicit environment, and consistently upload/deploy `packages/site/dist`.

13. **Med — interfaces.** `EpochRow.seed` is required although `readEpochs({withSeed:false})` omits it. `openWallet(...fields)` cannot naturally register the multiple accounts required by discovery. Forgetting “its PXE data” is not per-key because the current PXE namespace is shared. **Fix:** split summary/detail epoch types; expose `registerAccount(fields)` and batched sync; delete only vault/WalletDB records or explicitly redesign PXE namespaces.

14. **Med — claim flow/gates/maps.** The contract sets expiry from its actual anchor header, not an independently read “timestamp just before send”; derive it from the proven transaction output. P3.1’s `bun run epoch:stats -- --json` supplies no output filename, so it creates no fixture. The file map deletes `web-miner/wrangler.jsonc` despite retaining it architecturally. Gate `L` contains `<pkg>`, so gates are not fully exact commands. **Fix:** correct these items, name the JSON output, retain all three app Wrangler files, and expand every gate into concrete package commands.

## What looks fine

Storage-only stats matches the owner’s accepted trade-off; the build-time slot table, centralized `packages/site` assembler, shared lazy demo Worker, memory-backed WalletDB direction, pinned Aztec/scure versions, CSV guard, and origin-wide COOP/COEP/frame protections are sound foundations.

## Round 3 · final fresh-context pass (NEW session `codex-okZI7v7D`, gpt-5.6-sol, xhigh)

Verdict: **conditional approve** (conditions: preview isolation/provenance, gap-free recovery, vault integrity, phase gates). Disposition:

| # | finding | severity | disposition |
|---|---|---|---|
| 1 | previews publish PR-controlled JS under the project's domain; default "no approval" unsafe | High | **adopted**: no automatic previews; an owner-triggered, approval-gated `workflow_dispatch` preview only (Ask 7 default changed). |
| 2 | preview provenance incomplete (`site.yml` builds no artifact; `actions: read`) | High | **moot** after #1 (the manual preview builds its own ref in a secret-less job). |
| 3 | indexed recovery unsound: a reverted first claim mints nothing, rotation would create unused indexes; E2E kept the PXE | High | **adopted**: rotation only past chain-visible use; an unused paused account gets a PXE-namespace reset instead (verified in P2.5, fallback = wait); `accountUsed` = balance > 0 or a scoped Transfer event (P2.3 spike; fallback = explicit "I rotated N times" entry); the discovery E2E runs from a fresh browser context. |
| 4 | vault AAD omits version/index; per-address records duplicate master state | Med | **adopted**: one `MasterRecord` per master with nested accounts; AAD binds version, method, id; address check on every open in every mode. |
| 5 | toolchain pin test overstated (`aztec compile` CLI tree unpinned) | Med | **adopted**: the limit is stated; owning the install stays on the roadmap. |
| 6 | rename guard impossible as a raw grep (`ELX` inside a `bun.lock` integrity hash) | Med | **adopted**: word-bounded identifiers over tracked source types, `bun.lock` excluded, package names parsed. |
| 7 | npm resolutions are external observations | Low | **adopted** (moved to Inferences). |
| 8 | `assertDeployment` verifies the miner class only | Med | **adopted**: both instances and classes, and the miner's `token` slot. |
| 9 | tx-effect attribution unproven | Med | **adopted**: labelled as the transaction's effects; indices verified in P2.5. |
| 10 | Ask 1's default unsafe for durable funds; the 24-word alternative's restore path was inconsistent | High | **adopted**: the default is scoped to testnet with a mainnet re-decision; the 24-word path restores through `mnemonicToEntropy` → master directly. |
| 11 | gates don't typecheck non-app code | High | **adopted**: root `typecheck` script (`tsc -p tsconfig.json --noEmit`) added in P0.1 and in every L gate; P3.1 asserts the full slot generation. |
| WR | wrong rejections: preview approval; exported maximum index / explicit index entry | — | **adopted** via #1 and #3 (explicit index entry is the fallback). |

Verbatim response:

---

VERDICT: conditional approve (conditions: preview isolation/provenance, gap-free recovery, vault integrity, and phase gates are corrected)

## Adversarial / security

- **High — previews** (`plan.md:224`, Ask 7). `workflow_run` prevents PR code from directly reading the token, but it still deploys PR-controlled JavaScript to a trusted Yacana Pages domain. With no approval, a contributor can remove the off-apex redirect and publish a mnemonic-phishing UI. Honest previews redirect to production and are therefore unusable; malicious ones need not. **Fix:** default to disabled previews or mandatory approval with self-review prohibited, preferably using a clearly untrusted preview project. Never execute artifact content during deployment.

- **High — preview provenance is incomplete** (`plan.md:222–224`). `preview-web.yml` downloads an artifact supposedly built by `site.yml`, but the described `site.yml` neither runs `site:build` nor uploads an artifact. Cross-run download also needs explicit `actions: read`. **Fix:** make `site.yml` compile/build/upload the site, or trigger from the artifact-producing `contracts.yml`; require successful conclusion, exact run/PR/SHA matching, `actions: read`, and post-download validation.

- **High — indexed recovery remains unsound** (`plan.md:105,183,189`, Ask 2). A first claim can revert before minting a token note, yet the UI offers rotation for `reverted`; repeated failures can therefore create five token-unused indices before a funded later index. That disproves “usage has no gaps.” The E2E forget/restore retains the persistent PXE, so it does not prove new-device discovery. **Fix:** never advance past an index lacking chain-visible use, or export/request a maximum index. Define `accountUsed` through a supported public primitive such as `wallet.getPrivateEvents(Token.events.Transfer, { scopes: [address] })`, then test restoration after deleting both vault and PXE state. The wallet-sdk reference was decisive here because generic/nullified-note enumeration is not exposed by the public Wallet interface.

- **Medium — vault integrity boundary** (`plan.md:76–81`). AES-GCM AAD omits `v` and `index`, although index selects the spending keys. `KeyRecord` also ambiguously duplicates master/credential/highest-index state per derived address. **Fix:** use one vault record containing master/credential policy plus derived account metadata, or bind at least version, method, address, and index in AAD; verify the derived address on every open, including words and convenience modes.

- **Medium — toolchain trust is overstated** (`plan.md:238`). The existing pin test hashes native bb, nargo, one WASM, and dependency Git HEADs, but production invokes the unpinned npm-backed `aztec compile` CLI/transpiler. **Fix:** pin and verify the installer-generated package lock/integrities and relevant Aztec CLI package tree before compilation.

## Assumption attack

### Facts

- **Medium — rename guard is currently impossible as specified** (`plan.md:158`; `bun.lock:2109`). Literal uppercase `ELX` already occurs inside a dependency integrity hash. **Fix:** parse/check semantic names and selected source files; exclude lockfile integrity fields rather than raw-grepping the repository.

- **Low — npm resolutions are external observations**, not worktree Facts, despite the qualification at `plan.md:244`. Keep them under Inferences until committed to `bun.lock`.

### Inferences

- **Medium — deployment identity is incomplete** (`plan.md:49,136`). `assertDeployment` verifies only the miner class; it does not verify the configured token class or that the miner’s immutable `token` slot equals that address. **Fix:** accept `token` and `tokenClassId`, check both instances, and compare the bound-token slot before showing keys.

- **Medium — tx-effect attribution is unproven** (`plan.md:107,246`). A receipt contains all transaction note hashes/nullifiers, not an identified “claim” pair. **Fix:** label them as transaction effects or prove stable indices/event correlation in P2.5.

### Asks

- **High — Ask 1’s default is unsafe for durable funds**, and its alternative is technically inconsistent. `entropyToMnemonic(master)` creates 24 words, but the specified restore path uses `mnemonicToSeed → HKDF`, yielding a different master. **Fix:** constrain no-backup passkeys to explicitly warned testnet use, or add a distinct 24-word restore path using `mnemonicToEntropy` directly.

- Ask 2 and Ask 7 defaults are unsafe for the reasons above. Asks 3–6 and 8–9 are adequately surfaced; the hostname remains a proper hard gate.

## Implementation critique

- **High — phase gates do not universally typecheck touched code** (`plan.md:151–206`). P0.1 modifies deploy/work-circuit scripts but only typechecks web-miner; P3.1’s reader/generator/deploy CLI likewise receive no TypeScript check. Bun tests transpile but do not typecheck. **Fix:** add a root `typecheck` using the root `tsconfig.json`, include it in every `L` gate, and add a P3.1 full slot-generation/count/size check.

## Wrong rejections

The prior requirement for mandatory preview approval was wrongly weakened to “default: no approval.” The indexed-recovery alternatives—exported maximum index or explicit index entry—were also rejected prematurely; one is required unless the no-gap invariant is enforced and proven from fresh state. Dropping legacy migration is otherwise correct if Ask 3 is honored.

## What looks fine

Memory-backed WalletDB, ask-every-open, production/E2E directory separation with `build.json`, query-override gating, honest sealed-mode wording, storage-only stats, generated slot tables, and the off-apex redirect for trusted builds are sound.