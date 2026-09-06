## Summary

Rename the protocol and repository to Yacana/YACA first, regenerate every cryptographic derivative, and deploy a fresh testnet instance before building UI against it. Then add a shared React design system, replace the miner with the M1 cockpit and passkey-first encrypted wallet, add browser-direct stats, and build the landing page around a one-shot real proof. The three web packages build independently but assemble into one Cloudflare Pages directory serving `/`, `/mine`, `/stats`, and `/verify` under one security policy and RP ID. Each arc is one stacked PR, opened only after lint, typecheck, unit, component, and isolated-network E2E loops pass.

## Architecture & Implementation

### Boundaries and reuse

- `packages/miner-core` remains DOM-free and owns protocol math, artifact-independent public reads, block-effect decoding, and derived observatory metrics.
- `packages/ui` is presentation-only: Tailwind v4 tokens, self-hosted Hanken Grotesk/JetBrains Mono, shadcn-derived primitives, charts/canvas components, marks, status, and motion.
- `packages/web-miner` owns embedded PXE/wallet state, recovery, proving, transactions, routes, and miner state.
- `packages/web-stats` owns read orchestration, charts, exports, calculator, epoch URL state, and Verify.
- `packages/web-landing` owns static copy, launch mode, one-origin assembly, `_headers`, and the Pages deployment entry point.

I agree with the recon on extracting public reads into `miner-core`, adapting `openWallet`, retaining the mining loop, reusing the isolated E2E harness, and adding a small one-proof mode. I disagree in four places:

1. Existing tokens/fonts are not reusable as-is: Geist and the neutral palette do not meet v3. Reuse shadcn primitives and `cn()`, but replace tokens/fonts.
2. Claim submission must be adapted, not reused unchanged, because the stepper needs proving/sent/included/expired/reverted events.
3. Extend the existing Worker protocol with `proveOnce`; do not create an independent prover implementation or iframe.
4. Preserve the old deployment record byte-for-byte under `deployments/legacy-testnet-2026-09-04.json`, then replace `deployments/testnet.json`; leaving the latter untouched contradicts the brief.

The installed Aztec 5.2.0 token artifact names the private transfer method `transfer_private_to_private`, not simply `transfer`; the wrapper should call the actual generated method.

### Package interfaces

```ts
// @yacana/miner-core
export type PublicNode = Pick<
  ReturnType<typeof createAztecNodeClient>,
  'getPublicStorageAt' | 'getBlocks' | 'getBlockNumber' | 'getContract' | 'getNodeInfo'
>;

export interface PublicDeployment {
  miner: AztecAddress;
  token: AztecAddress;
  minerLayout: ContractArtifact['storageLayout'];
  tokenLayout: ContractArtifact['storageLayout'];
}

export interface EpochRecord {
  epoch: bigint;
  target: bigint;
  seed: bigint;
  openedAt: bigint;
  claims: number;
  duration: bigint | null;
  retarget: number | null;
  closedBy: 'claim' | 'roll' | null;
}

export interface ClaimObservation {
  epoch: bigint;
  block: number;
  timestamp: bigint;
  claimsAfter: number;
  nullifiers: readonly Fr[];
  noteHashes: readonly Fr[];
}

export function readEpochPage(
  node: PublicNode,
  deployment: PublicDeployment,
  options?: { before?: bigint; limit?: number },
): Promise<{ openEpoch: bigint; epochs: EpochRecord[] }>;

export function scanClaimWindow(
  node: PublicNode,
  deployment: PublicDeployment,
  epochs: readonly EpochRecord[],
): Promise<ClaimObservation[]>;

export function readTotalSupply(
  node: PublicNode,
  deployment: PublicDeployment,
): Promise<bigint>;

export function deriveObservatory(input: {
  supply: bigint;
  epochs: readonly EpochRecord[];
  claims: readonly ClaimObservation[];
  rules: EpochRules & { REWARD: bigint };
  chainNow: bigint;
}): ObservatoryModel;
```

`readEpochPage` caps each page at 48. `scanClaimWindow` pages backwards from `getBlockNumber()`, using `getBlocks(from, limit, { includeTransactions: true })`, stopping before the oldest loaded epoch. It matches successful transaction writes against `computePublicDataTreeLeafSlot(miner, deriveStorageSlotInMap(claimsSlot, epoch))`.

```ts
// @yacana/ui
export type ScoreSample = {
  id: string; at: number; score: number; proveMs: number; winner: boolean;
};
export function ScoreLoop(props: {
  attempts: readonly ScoreSample[]; difficulty: number; spanMs?: number;
  motion?: 'auto' | 'reduce'; ariaLabel: string;
}): React.ReactElement;
export function EpochRail(props: {
  epoch: bigint; claims: number; claimLimit: number; difficulty: number;
  openedAt: number; now: number; expectedSeconds: number; tMaxSeconds: number;
  ownClaimIndexes?: readonly number[]; onRoll?: () => void;
}): React.ReactElement;
export function PowerSlider(props: {
  value: number; cores: number; measuredProofsPerMinute: number;
  disabled?: boolean; onChange: (threads: number) => void;
}): React.ReactElement;

export type ProofEntry =
  | { kind: 'attempt'; at: number; nonce: bigint; score: number; proveMs: number; best: boolean }
  | { kind: 'win'; at: number; score: number; difficulty: number }
  | { kind: 'mint'; at: number; block: number; amount: bigint; marks: ChainMarks }
  | { kind: 'failure'; at: number; message: string }
  | { kind: 'epoch'; at: number; epoch: bigint; difficulty: number };

export function ProofLine(props: { entry: ProofEntry }): React.ReactElement;
export function Marks(props: ChainMarks): React.ReactElement;
export function Preflight(props: { steps: readonly EvidenceStep[] }): React.ReactElement;
export function Stepper(props: { steps: readonly StepState[] }): React.ReactElement;
export function BrandMark(props: { state: 'idle' | 'mining' | 'won' | 'paused' }): React.ReactElement;
export function StatusPill(props: { state: SurfaceStatus; children: React.ReactNode }): React.ReactElement;
```

Miner-internal key boundary:

```ts
export type RecoveryMethod = 'passkey' | 'mnemonic';
export interface AccountKeyMaterial { secret: Fr; salt: Fr; signingKey: Fq }
export interface StoredKey {
  version: 1; address: string; method: RecoveryMethod; derivation: 'yacana-v1';
  credentialId?: string; iv: Uint8Array; ciphertext: ArrayBuffer;
}
export interface KeyVault {
  store(key: AccountKeyMaterial, metadata: Omit<StoredKey, 'iv' | 'ciphertext'>): Promise<void>;
  unlock(address: string): Promise<AccountKeyMaterial>;
  forget(address: string): Promise<void>;
}
```

### Critical flows and mechanics

- **Passkey → account:** render the lightweight key screen before importing Aztec. The button synchronously starts WebAuthn creation with PRF, `residentKey: "required"` and `userVerification: "required"`. Use `SHA-256("yacana.passkey.prf.v1")` as the fixed PRF input; if creation reports PRF support without output, immediately perform `get()`. HKDF-SHA256 creates a versioned master, then independently rejection-samples `secret: Fr`, `salt: Fr`, and `signingKey: Fq`. Only then dynamically import PXE/prover code and call `createSchnorrInitializerlessAccount`.
- **Twelve words:** `@scure/bip39` generates 128-bit English entropy. Its seed enters method-separated HKDF labels and the same Fr/Fq derivation. Never persist the phrase. Creation hides it after acknowledgement and quizzes words 3/7/11 with paste blocked. Restore appears only after the link, displays the actual hostname, accepts a normalized valid checksum phrase, and never calls clipboard APIs.
- **Encrypted storage:** generate a non-extractable AES-256-GCM `CryptoKey` via WebCrypto and structured-clone it into IndexedDB. Use a fresh 96-bit IV per write and `yacana-key:v1:<method>:<address>` as AAD. Ciphertext contains the three fixed-width scalars. “Ask every open” stores only passkey metadata and re-runs PRF; otherwise decrypted material lives only for the session. This protects disk-at-rest bytes, not against same-origin XSS.
- **Mine → mint:** Worker attempts return digest/score and real `proveMs`; the reducer appends dots and ★ ledger entries. A winner pauses mining while the 420 ms rise and 900 ms flash run concurrently with claim construction. Claim callbacks drive proving, sent, inclusion, and TTL countdown. Success adds ✓, shows marks, counts balance by four over 600 ms, refreshes the epoch, rotates the epoch secret, and resumes. Stale public reverts mark the key blocked and offer same-method fresh-key creation; expiry continues without mint; 60 seconds of failed reads pauses mining; three Worker crashes enter terminal prover-dead state.
- **Power:** integer range `1..max(1, hardwareConcurrency-1)`, with eco/balanced/max markers at `min(3,max)`, `min(6,max)`, and max. A change completes the current proof, records `nextNonce`, replaces the Worker with the new thread count, and resumes the same secret/job.
- **Stats:** initial storage reads render supply/open epoch immediately; the newest 48 epochs and matching blocks progressively fill charts/table. “Load older” prepends another 48. Selection is validated against loaded/open epochs, stored as `/stats?epoch=N`, updated with `history.replaceState`, and responds to ←/→. CSV uses RFC 4180 quoting and guards spreadsheet prefixes `=`, `+`, `-`, `@`; JSON converts bigint to decimal strings.
- **Landing proof:** the live reader supplies the current epoch/difficulty. `proveOnce` uses ephemeral random secret/recipient/nonce, the same Worker, CRS interceptor, artifact, and thread policy; it returns real timing/digest, adds the dot, then discards proof and secrets without sending a transaction. One click, one proof, bounded memory, desktop only.
- **Status:** swap fixed self-hosted SVG favicons rather than constructing markup; update `▸ 18/min · 2/4 · Yacana`, keep the won icon for 60 seconds, stop canvas drawing in hidden/reduced-motion states.
- **One origin:** Vite bases are `/`, `/mine/`, and `/stats/`. `scripts/build-web.ts` assembles atomically into `dist/web`: landing root, miner under `mine/`, stats app under `stats/`, and a copy of its entry at `verify/index.html`. Shared `/crs` and `/artifacts` are copied once. Only `packages/web-landing/public/_headers` survives. All three `wrangler.jsonc` files name the same `yacana-web` project and point to `../../dist/web`; deployment invokes one config once.

### File-level change map

| Area | Changes |
|---|---|
| Root | Rename `elixir.params.json` → `yacana.params.json`; modify `package.json`, `bun.lock`, `CLAUDE.md`, docs and run env names; add `scripts/build-web.ts`; archive the old deployment. |
| Contracts | Move `elixir_miner`/`elixir_spike` to `yacana_miner`/`yacana_spike`; rename Nargo packages, contracts, tests, generated params/VKs and artifacts. |
| Work circuit | Move `crates/elixir_work` and `fixtures/elixir_work`; rename `elixir_work_lib`; update all scripts/defaults/imports; regenerate proof, VK, vectors and manifest. |
| Deploy | Rename `deployElixir`, env vars, artifact paths and logs; preserve secret-redaction behavior; adapt stats CLI to the shared reader. |
| Miner core | Rename scope/comments/generated constants; add `public-reader.ts`, `observatory.ts` and Bun tests; retain proof/retarget/claim primitives. |
| UI | Add package manifest, TS/Vitest configs, theme CSS, font imports, component modules/tests and favicon assets. |
| Web miner | Replace `App.tsx` and cards with routes/features; add keys/vault/withdraw/settings/status; extend Worker protocol/controller/reducer; delete `crossCheck`, old cards, local UI copies, `separator.tsx`, duplicate theme provider and local `_headers`. |
| Web stats | Add complete Vite/React package, reader orchestration, Stats/Verify routes, exports, calculator, charts, tests, E2E and matching `wrangler.jsonc`. |
| Web landing | Add static sections, live strip, demo, launch-mode wallet service, OG card, assembly-owned `_headers`, tests/E2E and `wrangler.jsonc`. |
| CI | Rename stale paths/envs; add `ui.yml`, `web-stats.yml`, `web-landing.yml`, `deploy-web.yml`; modify all existing filters. |

Alternatives rejected: no indexer or scheduled snapshot, no iframe/second prover, no second Pages project, no mobile mining, no second node, and no stale epoch OG-card generation. Direct reads cost more latency and trust the configured RPC, but avoid a new stateful service.

## Phases

### Arc 0 · Rename

**Phase 0.1 — Protocol identity.** Goal: produce a cryptographically self-consistent Yacana circuit. Rename params, domains (`YACA/*`), seeds, Noir crates/contracts/artifacts and generated paths; run codegen, re-prove the fixture, export the VK, pin vectors, rerun codegen and regenerate the manifest. Files: params, contracts, work-circuit, miner-core generated files. Tests added: name/domain tripwires and regenerated VK/vector/proof assertions.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-miner typecheck`
> - unit: `bun run codegen && git diff --exit-code && bun test packages/work-circuit packages/miner-core scripts`
> - component: `bun run test:components`
> - e2e-isolated: `bun run contracts:compile && bun run contracts:test && bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: clean codegen diff; real proof/VK and all tests pass; E2E mints tYACA.

**Phase 0.2 — Repository/runtime identity.** Goal: remove active Elixir identifiers. Rename package scopes, functions, env vars, runtime globals, logs, storage prefixes, Pages name, CI filters and docs; regenerate `bun.lock`. Leave historical values only in the archived deployment/history. Tests added: repository grep allowlist, config/storage-name tests, updated E2E assertions.

> **Validation gate**
> - typecheck/lint: `bun install --frozen-lockfile && bun run lint && bun run --cwd packages/web-miner typecheck`
> - unit: `bun test`
> - component: `bun run test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: no unallowlisted `Elixir|ELX|@elixir|ELIXIR_`; all layers pass.

**Phase 0.3 — Fresh testnet record.** Goal: bind UI/config to the owner-deployed Yacana instance. Archive the old JSON first; owner securely exports variables and runs `AZTEC_NODE_URL="$AZTEC_NODE_URL" YACANA_DEPLOYER_SECRET="$YACANA_DEPLOYER_SECRET" YACANA_DEPLOY_FORCE=1 bun run deploy`; commit only public output and update `.env.production`. Tests added: deployment schema/on-chain field comparison.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-miner typecheck`
> - unit: `bun test && AZTEC_NODE_URL="$AZTEC_NODE_URL" bun run epoch:stats -- deployments/testnet.json`
> - component: `bun run test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: public record matches views/class IDs/VK; local E2E passes. Deployment is owner-run evidence, not a live-testnet CI gate.

### Arc 1 · Shared UI

**Phase 1.1 — Foundation.** Goal: establish tokens, fonts, theme and reusable primitives. Add `packages/ui`, mount `next-themes`, default dark, and export CSS/components. Tests added: token contract, theme persistence, typography and status-pill accessibility.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/ui typecheck`
> - unit: `bun test packages/ui scripts`
> - component: `bun run --cwd packages/ui test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: no literal component colors; UI and unchanged miner pass.

**Phase 1.2 — Signature components.** Goal: implement ScoreLoop, EpochRail, PowerSlider, Marks, ProofLine, Preflight, Stepper, mark/favicons and reduced motion. Tests added: canvas command model, glyph grammar, keyboard/ARIA, roll boundary, discrete threads, reduced motion.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/ui typecheck`
> - unit: `bun test packages/ui packages/miner-core`
> - component: `bun run --cwd packages/ui test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: binder states render deterministically and miner remains functional.

### Arc 2 · Web miner

**Phase 2.1 — Derivation and vault.** Goal: implement versioned PRF/mnemonic HKDF, Fr/Fq rejection sampling and AES-GCM IndexedDB. Tests added: golden derivation vectors, wrong-AAD/tamper failure, unique IVs, non-extractable key and no phrase persistence.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-miner typecheck`
> - unit: `bun test packages/web-miner/src/keys packages/web-miner/src/vault`
> - component: `bun run --cwd packages/web-miner test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: virtual-authenticator round trip restores the same address; ciphertext mutation fails closed.

**Phase 2.2 — Key UX and boot.** Goal: add consent-first passkey creation/recovery, twelve-word fallback, 3/7/11 gate, hostname warning and evidence preflight; defer Aztec imports until ceremony completion. Tests added: PRF create→get fallback, unsupported PRF, phrase validation, paste policy and gesture ordering.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-miner typecheck`
> - unit: `bun test packages/web-miner/src/keys`
> - component: `bun run --cwd packages/web-miner test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: both exclusive methods create/restore; no instant/add-passkey path exists.

**Phase 2.3 — M1 cockpit.** Goal: connect score/ledger/metrics/rail, claim beats, error states, roll and power reconfiguration to the reducer/controller. Tests added: all state transitions, TTL, stale winner, 60-second RPC pause, three-crash terminal state and nonce-preserving thread changes.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-miner typecheck`
> - unit: `bun test packages/web-miner/src packages/miner-core`
> - component: `bun run --cwd packages/web-miner test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: passkey → mine → ★ → stepper → ✓/+4 → automatic resume is proven on localnet.

**Phase 2.4 — Wallet, withdraw and settings.** Goal: add routes, key list/history, private-default withdraw, fresh-key rotation, notifications, PiP, battery/background behavior, title/favicon and phone stop-screen. Tests added: address/amount/nonce validation, both token calls, privacy copy, settings effects and responsive guards.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-miner typecheck`
> - unit: `bun test packages/web-miner/src packages/miner-core`
> - component: `bun run --cwd packages/web-miner test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
> - Pass: both withdrawals settle locally; mobile never initializes PXE/Worker.

### Arc 3 · Stats

**Phase 3.1 — Public reader.** Goal: extract storage reads, add paged block scanning and pure metrics. Tests added: malformed data, reverts ignored, claim-slot matching, roll classification, median-six and pagination.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-stats typecheck`
> - unit: `bun test packages/miner-core packages/web-stats`
> - component: `bun run --cwd packages/web-stats test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e`
> - Pass: local deployment produces correct supply/epochs/claims without a wallet.

**Phase 3.2 — Observatory.** Goal: implement six numbers, epoch strip/detail sentences, four specified charts and table with progressive rendering. Tests added: normal/fast/slow/rolled/launch templates, chart domains, URL/keyboard selection and partial-read failures.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-stats typecheck`
> - unit: `bun test packages/miner-core packages/web-stats`
> - component: `bun run --cwd packages/web-stats test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e`
> - Pass: `/stats?epoch=N` survives reload and all metrics trace to node data.

**Phase 3.3 — Verify, calculator and export.** Goal: implement Verify checks, calculator, 48-row load-more and safe CSV/JSON downloads. Tests added: record mismatch, formulas, CSV injection/escaping and bigint JSON.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-stats typecheck`
> - unit: `bun test packages/miner-core packages/web-stats`
> - component: `bun run --cwd packages/web-stats test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e`
> - Pass: Verify reproduces public values; exports reopen cleanly; older pages append once.

### Arc 4 · Landing and deployment

**Phase 4.1 — Argument.** Goal: implement the exact English H3 copy, anchors, Money/Chain/How/Live/Verify/Ask sections, mobile share path and static OG image. Tests added: copy/anchor contract, no tracker assets, mobile no-demo, build-flag branches.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run --cwd packages/web-landing typecheck`
> - unit: `bun test packages/web-landing packages/miner-core`
> - component: `bun run --cwd packages/web-landing test:components`
> - e2e-isolated: `bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e`
> - Pass: sections and mobile behavior match the binder; live strip reads the local node.

**Phase 4.2 — Demo, launch mode and assembly.** Goal: add one-shot Worker proof, wallet-sdk launch ceremony, final assembly, shared headers and Pages configs. Launch wallet discovery occurs only after click: `WalletManager.configure()`, streaming discovery, secure channel plus `hashToEmoji`, scoped `requestCapabilities`, contract registration, `commit_launch`/`reveal_launch`, and disconnect handling. Tests added: proof timing/score, one-proof termination, wallet concurrency guards/capability scope, route/header/asset collision tests.

> **Validation gate**
> - typecheck/lint: `bun run lint && bun run lint:actions && bun run --cwd packages/web-landing typecheck`
> - unit: `bun test`
> - component: `bun run test:components`
> - e2e-isolated: `bun run build:web && bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e`
> - Pass: all four routes load under COOP/COEP/CSP; one real W proof completes; no wallet/PXE is touched by the demo.

## Delivery

Each arc is one signed, conventional-commit branch; phases are reviewable commits within it:

`arc0-rename` → `arc1-ui` → `arc2-web-miner` → `arc3-web-stats` → `arc4-web-landing`.

Arc 1 stacks on Arc 0 because scopes/artifacts change; Arc 2 on UI; Arc 3 on the reader/UI; Arc 4 on all surfaces and assembly. Run each phase gate, then the arc-wide xhigh fix loop. After Arc 4, run the complete gates for all packages plus one cross-surface isolated E2E and inspect `git diff --check`/generated diffs. Only then run:

```sh
gh stack init arc0-rename arc1-ui arc2-web-miner arc3-web-stats arc4-web-landing
gh stack submit --open
```

Use `gh stack sync` after review changes and rerun affected/downstream gates before resubmission. Never use `gh stack merge`; the owner controls merges and the testnet deployment.

## CI

Every PR workflow retains `changes` → gated `test`, manual-dispatch override, `permissions: contents: read`, frozen setup-bun, timeouts and SHA-pinned actions. Every filter also includes its workflow, `.github/actions/**`, `package.json`, `bun.lock`, `bunfig.toml`, `biome.json`, and `tsconfig.json`.

- `work-circuit.yml`: `packages/work-circuit/**`, `yacana.params.json`, params codegen, `.aztecrc`, toolchain lock/test. Runs lint, toolchain assertion, codegen-diff, Bun tests.
- `contracts.yml`: contracts plus work-circuit crates/generated/VK/fixtures and params/codegen/toolchain. Runs codegen, compile, TXE tests, generated diff.
- `miner-core.yml`: miner-core plus work-circuit generated/fixtures, `contracts/yacana_miner/src/**`, params/codegen and `scripts/run/**`. Runs lint, advisory audit and Bun tests.
- `deploy.yml`: deploy plus contracts, miner-core, work-circuit generated artifacts, params and run scripts. Runs lint and deploy-script tests only; never deploys.
- New `ui.yml`: `packages/ui/**`. Runs lint, typecheck and Vitest components.
- `web-miner.yml`: miner plus UI, miner-core, miner contract/work artifact sources, params, deployment record and build scripts. Runs lint, typecheck, components, codegen/contract compile/build, CRS verification.
- New `web-stats.yml`: stats plus UI, miner-core public reader, miner/token artifact sources, params and deployment record. Runs lint, typecheck, components and build.
- New `web-landing.yml`: landing plus all three upstream web packages, UI/miner-core, proof/artifact sources, deployment record, `scripts/build-web.ts` and `_headers`. Runs lint, typecheck, components and assembled build.

`actionlint.yml` remains standalone for `.github/**`; pin checkout/paths-filter by commit and the actionlint container by immutable digest, not only `1.7.12`.

`deploy-web.yml` triggers on `push` to `main` and same-repository `pull_request` changes to web/upstream/build files. It builds `dist/web` once, checks exactly one `_headers`, then runs Wrangler with step-local `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Production uses the protected `pages-production` environment and branch `main`; previews use `pages-preview` and `wrangler pages deploy dist/web --project-name yacana-web --branch pr-N`. Never use `pull_request_target`; fork PRs receive build checks but no secret-backed preview. The API token is limited to Pages edit for this account/project.

Do not add required CI E2E now. The real suite provisions Aztec, compiles/proves contracts, takes up to tens of minutes, and measured Chromium alone peaks near 2.4 GB. Keep it mandatory locally before PRs; a later non-required self-hosted/manual job would cost roughly 30–60 runner-minutes per execution.

## Security & Adversarial Considerations

- **Miner:** hostile host/XSS can decrypt any open vault, redirect withdrawals, observe proofs and control the Worker; a lying RPC can waste work and correlate IP, polling and claim timing. On-chain recipient binding prevents proof theft, not page compromise. Keep the existing warning: whoever serves the page controls the tab; self-host if that matters. Passkeys improve recoverability and remove cleartext/random-secret persistence, but do not make a compromised origin trustworthy.
- **Stats/landing:** node data is untrusted. Validate field widths, block counts, storage layouts and addresses; cap concurrency/pages; ignore reverted effects. Verify cannot prove the RPC honest. The demo is a new CPU/RAM boundary: explicit click, one proof, bounded threads, termination, no key, wallet or transaction.
- **Crypto:** pin all `@aztec/*`, Schnorr account and wallet-sdk dependencies exactly to `5.2.0`; pin `@scure/bip39` to `2.2.0`. Use raw WebAuthn PRF, WebCrypto HKDF-SHA256/AES-256-GCM and CSPRNG only. Version and golden-test every label; reject missing/short PRF results and unsupported authenticators, offering twelve words explicitly.
- **Inputs:** production query overrides require an explicit E2E build flag; parse node URLs with `URL`, require HTTPS outside local E2E, reject credentials/unknown origins, and let CSP enforce the same allowlist. Parse withdrawals with safe `AztecAddress.fromString`, enforce positive u128 decimal amounts within balance and zero self-call nonce. Normalize mnemonic input, require exactly 12 valid checksum words, and never log it.
- **Frontend:** no `dangerouslySetInnerHTML`; escape all node-derived text; prevent CSV formula execution. Use `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `style-src 'self'`, `font-src 'self'`, and existing `'wasm-unsafe-eval'` only for scripts. One origin means one compromise reaches landing, miner storage and RP ID, making CSP and dependency review especially important. No cookie auth means conventional CSRF is absent; wallet and embedded-wallet transactions still require explicit UI review.
- **Supply chain/CI:** retain seven-day npm minimum age, frozen lockfile, hash-pinned CRS/toolchain, advisory audit and SHA/digest-pinned CI dependencies. Secrets exist only in protected deployment environments; PR jobs get none.
- **Launch wallet:** request only accounts, miner registration, and transaction scopes for `commit_launch`, `reveal_launch`, and `launch`; no auth-witness or private-data capability. Show the SDK emoji comparison, prevent concurrent/retried handshakes, and reset on disconnect.
- **Rename/RP ID:** never rename or delete legacy browser databases in place. The new app uses `yacana-*` and a new deployment; old tELX data stays recoverable from the old commit pending owner policy. Freeze the apex hostname before the first passkey—changing RP ID later can permanently strand passkey-only YACA keys.

## Assumptions

### Facts

- The protocol is proof → Poseidon ticket → private verifying claim → mint, with count-based clamped retargeting (`CLAUDE.md:3-6`).
- Aztec is fixed at 5.2.0 and Bun at 1.4.0; frozen installs and pinned Actions are conventions (`CLAUDE.md:23-31`, `.aztecrc:1`, `package.json:54-56`).
- Current wallet creation uses one random secret and Elixir-prefixed IndexedDB stores (`packages/web-miner/src/wallet.ts:24-53`).
- The Worker already isolates bb.js, purges CRS cache and constructs `BbJsWorkProver` (`packages/web-miner/src/prover.worker.ts:19-27`).
- The reducer already preserves 20 proof timings and handles epoch-secret rotation (`packages/web-miner/src/lib/reducer.ts:53-95`).
- Public epoch storage reading works without a wallet (`packages/deploy/scripts/epoch-stats.ts:26-63`).
- The current production policy already supplies COOP/COEP and a node-only CSP (`packages/web-miner/public/_headers:1-6`).
- Browser W proofs take 3.2–3.4 seconds, claims 21.9 seconds, and Chromium peaks at 2,387 MiB (`implementations-plan/elixir-core/spike-results.md:46`).
- The generated token API exposes `transfer_private_to_private` and `transfer_private_to_public` (`node_modules/@aztec-foundation/aztec-standards/artifacts/src/artifacts/Token.d.ts:93-96`).

### Inferences

- The public RPC will allow browser CORS for `getBlocks(..., { includeTransactions: true })` at acceptable latency.
- Target authenticators preserve WebAuthn PRF output across their advertised passkey-sync path.
- Non-extractable AES keys survive IndexedDB restarts on supported desktop browsers.
- Extension wallet discovery works under the chosen COOP/COEP policy; cross-origin web-wallet iframes are not assumed.
- Cloudflare Pages resolves `/mine`, `/stats`, and `/verify` directory indexes without redirects.

### Asks

- Supply the final apex hostname/RP ID, Pages project/account environments, node allowlist, GitHub/X/docs URLs and source repository URL.
- Decide whether legacy tELX access needs a hosted compatibility route; default is archived record plus self-host instructions, not silent migration.
- Confirm the supported desktop browser floor and whether PRF-unsupported browsers should show twelve words immediately.
- Confirm extension-only wallet discovery for launch mode, or provide approved web-wallet origins and a revised COEP/CSP policy.

## Adversarial self-review

The plan’s weakest assumption is that direct block scanning is fast, CORS-enabled and stable enough for progressive stats; if not, the brief forbids the obvious server-side remedy. Claim-write matching may also change with Aztec’s public-data encoding, so it needs a real localnet fixture rather than mocked shapes.

An attacker will target the single origin, vault CryptoKey, WebAuthn flow, withdrawal confirmation, build pipeline, Pages token and node responses. AES-at-rest can be over-marketed: same-origin malicious JavaScript can invoke decryption. PRF sync semantics may differ by authenticator, making “follows your passkeys” too strong. One-method recovery deliberately concentrates risk.

I am also trusting that changing thread count by replacing the Worker can preserve a job cleanly, that the token’s generated methods remain usable through generic `Contract`, and that wallet-sdk extension transport survives strict isolation. The legacy-account answer is operationally incomplete until the owner decides whether old tELX merits a hosted path. Finally, “no third-party requests” is literally strained by direct calls to the named Aztec RPC; copy should explain that exception even if the required footer remains unchanged.

## Estimates

| Arc | Effort |
|---|---:|
| Arc 0 · rename, regeneration, owner deployment support | 3–4 agent-days |
| Arc 1 · UI foundation/components | 2–3 agent-days |
| Arc 2 · miner/key/wallet redesign | 6–8 agent-days |
| Arc 3 · direct reader and stats | 4–5 agent-days |
| Arc 4 · landing/demo/assembly/deploy | 3–4 agent-days |
| Final cross-arc quality pass | 1–2 agent-days |
| **Total** | **19–26 agent-days** |

The riskiest phase is 2.1: a derivation or persistence mistake can create an apparently valid but unrecoverable account and strand funds. Phase 3.1 is the largest schedule risk because public block-scan behavior has not yet been exercised in-browser.