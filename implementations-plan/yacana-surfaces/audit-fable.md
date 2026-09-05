# Fable audits — yacana-surfaces

The "fable" role is the independent top-tier Claude reviewer running alongside codex (Plan subagent, `model: fable`). The independent plan draft is `drafts/fable-plan.md`.

## Round 1 · contradiction check (fresh subagent, given all three drafts + the consolidated plan)

Verdict: **contradictions found** (11). Adopted / rejected:

| # | finding | severity | disposition |
|---|---|---|---|
| 1 | `site:e2e` cannot run on the isolated network: the production `_headers` pin `connect-src` to the public node and production builds ignore query overrides | High | **adopted**: `packages/site/src/headers.ts` renders `_headers` from the allowed origins (`headers.test.ts` pins the production rendering); `assemble.ts` takes the E2E env; `packages/site/e2e/run-setup.ts` deploys via `deployYacana` and assembles for the run. |
| 2 | WebAuthn refuses IP-literal RP IDs; the E2E serves `127.0.0.1`; `create` is disabled unless `location.hostname === VITE_RP_ID`, which the E2E build never sets | High | **adopted**: E2E servers bind `localhost`; E2E builds set `VITE_RP_ID=localhost`. |
| 3 | root `bun test` collects `*.test.tsx` jsdom specs | Med | **adopted**: `*.vitest.tsx` (same as codex #7). |
| 4 | "sealed master protects disk-at-rest bytes" overclaims: the device `CryptoKey` is serialised to the profile | Med | **adopted**: passkey keys default to ask-every-open (nothing at rest but the credential id); the sealed mode is labelled "convenience" with the honest limit; words keys are sealed and the limit is stated. |
| 5 | CI edits not assigned to phases (`fetch-crs` step, `packages/ui/**` and `packages/site/**` filters, `contracts.yml`) | Med | **adopted**: named in P1.3, P2.1, P4.2. |
| 6 | the P0.2 grep allow-list fails by construction | Med | **adopted**: `implementations-plan/**`, `docs/pitch/**`, `deployments/elixir-testnet-*`, the archived section of `docs/deployments.md`. |
| 7 | `metrics.ts` used in P2.2, created in P3.1 | Low | **adopted**: the miner subset lands in P2.2. |
| 8 | "no WASM" wording vs the demo chunk | Low | **adopted** (reworded). |
| 9 | `sendClaim` blocks in `send({ wait })`; the Stepper needs the hash; the TTL anchor is the anchor block's timestamp | Low | **adopted**: send + `wait()` split, `anchorTimestamp` returned (P2.5). |
| 10 | `EpochRow.seed` is a fourth read | Low | **adopted**: seed read only on request (the open epoch). |
| 11 | `base-uri 'none'` and SVG favicons silently resolved | Low | `base-uri 'none'` adopted; canvas favicon kept (noted). |

Rejected-alternative judgements (all agree with the consolidated choices): slot table > lazy bb.js (the landing strip needs slots at first paint); `packages/site` > `scripts/site/` (its TS moves under `src/` so the root tsconfig typechecks it — adopted); indexed accounts > second credential; shared Vite base > iframe; storage reads only (the valid argument is the leaf-slot hash, not "megabytes per poll" — rationale corrected; the `getPublicStorageAt(block)` bisection is noted as a future option for "last claim").

Facts re-verified by this round: `wallet_db.js` persists sk/salt/signingKey and uses only `openMap` + set/getAsync/delete/entriesAsync (+ `close`); `EmbeddedWalletDBOptions.store` override exists; re-registration idempotent; ephemeral IndexedDB random-named; the key store withholds signing keys; `fromBufferReduce` at `field.d.ts:95,155`; Poseidon2 = `BarretenbergSync` (3 MB gz); token `total_supply` slot 8 / `public_balances` slot 9 / both transfer functions; `@scure/bip39@2.3.0` at `bun.lock:689`; `getTxEffect` and `getContract` exist; `epoch-stats.ts --json` exists.

## Round 2 · double audit (fresh subagent)

Verdict: **conditional approve** (conditions A–D). Disposition of the findings:

| # | finding | severity | disposition |
|---|---|---|---|
| A/1 | a passkey master has no backup path; PRF sync across devices unproven | High | **surfaced as Ask 1** (the owner chose one method per key): default = explicit warning + "move funds" nudge; option = "back up this passkey key as 24 words" (`entropyToMnemonic(master)`); P2.3 records a manual cross-device PRF check. |
| 2 | `yacana.pages.dev` is a second origin where words keys would work | Med | **adopted**: off-apex hosts redirect to the apex; nothing creates keys off-apex. |
| 3 | `deploy-web.yml` lacks the toolchain pin test; `VITE_SOURCE_COMMIT` on PRs; `--branch main` from a preview | Med | **adopted** (pin test before every production build; previews use the PR head sha via `workflow_run`; previews deploy `pr-<n>` only). |
| 4 | nothing proves the production rendering at build | Med | **adopted** (`assemble.ts` production guards + `build.json`; `headers.test.ts` pins the production rendering). |
| 5 | no derived-address check after `assertPasskey` | Med | **adopted** (fails closed). |
| 6 | per-account PXE deletion is not implementable (`pxe.d.ts:239`: `registerAccount` only) | Med | **adopted** ("forget everything on this device" deletes the namespace). |
| 7 | CSP/CORP/Permissions-Policy, spellcheck/autocomplete, CSV tab/CR, E2E-only hooks, amounts out of notifications | Low | **adopted**. |
| 8 | landing RPC load (~150 reads per visitor) | Low | **adopted** (open row + 12 epochs, 60 s poll, unreachable state); Ask 5. |
| F1 | `config.ts:45` is line 40; `@scure/bip39` only transitive; PXE keys understated; `map_test_suite` covers more than four calls | — | **adopted** (facts corrected; direct exact dependency; full map implementation). |
| I1 | `elixir-*` deletion unreachable; interim `yacana-wallet-*` only if deployed | — | **adopted**: no migration; Ask 3. |
| I2 | assert no `barretenberg*` chunk before the click; gate `reconfigure` with `rssWatcher` | — | **adopted** (P4.1 and P2.2 gates). |
| Asks | cross-check removal is an owner decision already made; interim deploy; placeholder hostname; RPC load; old Pages project; one device per key | — | **adopted** as Asks 3–6 and docs; the threat-model row is rewritten in P2.1. |
| Impl | one env source of truth; `KeyRecord` union; generated-only `_headers`; `_changes.yml`; demo barrel; `public_balances` via a page hook; drop constant-equals-constant tests; `packages/site` `package.json` from P2.1; grep test location; `dist/_headers` gating | Med/Low | **adopted** (all). |

Verbatim response:

---
VERDICT: conditional approve (conditions: (A) surface the passkey-loss/no-backup gap and the cross-check removal as owner Asks before P2.1/P2.3; (B) one env source of truth for the three apps plus a build guard against the `yacana.xyz` placeholder; (C) fix P2.3's internal inconsistencies — `legacy` method, forget-vs-PXE, dead `elixir-*` sweep; (D) `deploy-web.yml` runs the toolchain pin test and `assemble.ts` asserts the production rendering.)

## Security

- **High — a passkey master has no backup path.** §Critical paths "Passkey → account" derives everything from the PRF; only words keys get `backedUp`. A reset/lost passkey, or a provider that does not sync PRF (the cited bazaar spike's own header says cross-device PRF is "a manual launch-risk test"), strands the balance. Fix: Ask the owner; cheapest design is "Back up as 24 words" = `entropyToMnemonic(master)` + `masterFromEntropy` (raw 32 B, no HKDF), or at minimum an explicit key-screen warning and a withdraw nudge.
- **Med — production is also served at `yacana.pages.dev`.** The `location.hostname === VITE_RP_ID` guard only disables passkey *create*; words keys and IndexedDB records work on the alias origin (a second, confusing origin). Fix: client-side redirect to the apex when hostname ≠ RP ID and the host is not a preview, or disable all key creation off-apex.
- **Med — `deploy-web.yml` produces the production bundle with the unpinned-installer toolchain** (`setup-aztec` comment) but, unlike `contracts.yml:61`, never runs `bun test scripts/run/toolchain.test.ts` with `YACANA_REQUIRE_TOOLCHAIN=1`. Add it before `contracts:compile`. Also `VITE_SOURCE_COMMIT=$GITHUB_SHA` is the merge SHA on `pull_request` (Verify shows a commit on no branch) — use `head.sha` for previews; add `if: github.head_ref != 'main'` on the preview job since `--branch main` is a production deploy.
- **Med — nothing at build time proves the production rendering.** `headers.test.ts` pins a rendering from env values, not `dist/_headers`; `site:e2e` uses the E2E env. Fix: `assemble.ts` fails when `VITE_E2E_QUERY_OVERRIDES` is set or `connect-src` contains `localhost`/`127.0.0.1` in production mode.
- **Med — no derived-address check.** After `assertPasskey({allow})` → derive, assert `address === record.address`; a PRF glitch must fail closed, not silently mine to a new account.
- **Med — "Forget … deletes its PXE data" is not implementable per account**: `@aztec/pxe` 5.2.0 exposes `registerAccount` but no removal (method list in `pxe.js`). Specify: delete the whole `yacana-pxe-<ns>` DB and re-sync the remaining keys, or drop the claim (the `words.e2e.ts` forget→restore leg depends on this).
- **Low** — CSP: add `frame-src 'none'`, `Cross-Origin-Resource-Policy: same-origin`, a `Permissions-Policy`; twelve-word inputs need `spellcheck=false autocomplete=off` (Chrome enhanced spellcheck uploads field text); CSV guard should also cover leading tab/CR; gate `window.yacana.simulateClaimFailure` to E2E builds; keep amounts out of OS notifications.
- **Low** — every landing visitor makes ~150 `getPublicStorageAt` calls to Aztec Labs' RPC (rate-limit SPOF for all three surfaces, IP exposure). Landing strip: open row only (4 reads), longer poll, unreachable state.

## Assumptions

**Facts.** `config.ts:45` is line 40. `@scure/bip39` 2.3.0 in `bun.lock:689` is *transitive* via `@aztec/foundation` (used only for BLS) — no workspace declares it; add an exact dep to `miner-core` (lockfile changes). "PXE holds viewing/tagging keys" understates: four privacy secret keys including nullifier-hiding (`key_store.js:62`) — still not spendable, wording only. "Verified against the kv-store interface test suite": `map_test_suite.js` exercises size/values/keys/ranges, far more than the four calls the memory store implements — implement `AztecAsyncMap` fully or write a WalletDB-shaped test. Verified as stated: `wallet_db.js:24-31`, `embedded_wallet.js:305-306`, `store.js:36`, `field.d.ts:95/155`, poseidon `index.js:5-12`, `boot.ts:41`, `run-setup.ts:70`, `chain.ts:118`, `package.json:28`, token ABI (`transfer_private_to_private(from,to,amount,_nonce)`, `public_balances`, `total_supply`), bazaar spike, `gh stack init <branch>`/`submit --auto`. npm versions (fontsource, wrangler, fake-indexeddb) not re-verified here.

**Inferences.** "`elixir-*` databases deleted" is unreachable: the old miner lives on `elixir-web-miner.pages.dev`, a different origin; `yacana-wallet-*` exist on the final origin only if the interim P0.2 miner is deployed there — otherwise the whole legacy sweep (records, `legacy` method, test) is dead code; delete-orphan-on-boot suffices. "Stats/landing ship no WASM" is plausible (bb.js WASM is a dynamic import in `fetch_code/browser/index.js`) but the node client drags bb.js glue in — add an E2E assertion that no `barretenberg*` chunk loads before the click. `reconfigure` memory is never gated — reuse `miner.e2e.ts`'s `rssWatcher` around three reconfigures.

**Asks to surface.** (1) Passkey backup (above). (2) Removing the cross-check deletes a shipped, E2E-tested defence listed in `threat-model.md` "Lying RPC" — not an owner decision; it is already dead in production (single allowlisted origin), say so and rewrite that row. (3) Will the interim miner be deployed before arc 2 (decides the migration)? (4) The `yacana.xyz` placeholder must never reach a production build — gate P4.2 on the real hostname. (5) Is the landing's RPC load on a third party acceptable? (6) Fate of `elixir-web-miner.pages.dev`. (7) One device per key: two devices deriving the same index desync PXE delivery indexes — document.

## Implementation

- **Med — env source of truth.** Only `packages/web-miner/.env.production` is named; where do web-stats/web-landing get node, miner, token and the allowlist in production? Three copies drift (stats reading a different deployment than the miner mines). Fix: `vite-base.ts` sets `envDir: packages/site` and `define`s miner/token from `deployments/<profile>.json`; `headers.ts` reads the same file.
- **Med — `KeyRecord.method: 'passkey' | 'words'` vs P2.3's `legacy` records.** A legacy account is raw (secret, salt, signingKey), not a master; `openMaster → deriveAccountFields` does not apply. Discriminated union, or drop the import (Ask 3).
- **Low** — `_headers` is both committed (`+_headers`) and rendered; make it generated-only. `changes` is copy-pasted into 11 workflows; a `workflow_call` job with a `filters` input. Landing importing `web-miner/src/demo.worker.ts` directly is why `web-landing.yml` must watch three miner files — export a barrel. `withdraw.e2e.ts`'s "`public_balances` storage read" from the Playwright (Node) side would import `@aztec/stdlib` into Playwright's loader (`run.ts` warns against this) — read via a `window.yacana` hook. Copy snapshot tests assert a constant equals itself; drop.
- **Gates.** Every named command exists at its phase (`site:build`/`site:e2e` arrive in P4.2, the `test:components` glob in P1.1; bun rewrites `vitest` imports, verified by running `format.test.ts`). Gaps: `packages/site` has no `package.json` until P4.2, so no `--cwd packages/site typecheck` before then — state it; the P0.2 grep test's location is unspecified (must sit under `scripts/` or `packages/*` to run in CI's `bun test packages/miner-core scripts`); P2.2 gates behaviour, not the memory inference; nothing gates `dist/_headers`.

## What looks fine

WalletDB-in-memory plus vault, verified against `wallet_db.js`/`base_wallet.js` (PXE never receives the signing key); PRF ordering with create→get fallback; per-account delivery block (`soak.ts:89`) justifies indexed rotation; WASM-free slot table; frozen lockfile, min-age, SHA pins, fork-PR handling; `*.vitest.tsx` split; `sendClaim` send/wait split; honest sealed-mode copy.

