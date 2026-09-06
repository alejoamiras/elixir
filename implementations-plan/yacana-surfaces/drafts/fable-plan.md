# yacana-surfaces — plan draft (fable)

## 1. Summary

Rename Elixir → Yacana in one protocol-level pass (new domain tags → new VK, fixture proof, vectors, class ids, then an owner-run testnet deployment), then build three surfaces on one Cloudflare Pages origin: `packages/ui` (tokens, fonts, the signature components), the M1 miner cockpit at `/mine` with passkey-first keys whose spend authority never reaches disk in cleartext, a static Observatory at `/stats` that reads the node from the browser through one DOM-free reader in `miner-core`, and the landing at `/` whose demo runs the miner's own Worker. Five arcs, thirteen phases; every phase gated by lint + typecheck, bun:test, Vitest and an isolated-network Playwright run; stacked PRs opened only after the codex loops converge.

## 2. Architecture & Implementation

### Components and boundaries

| package | role | reuse vs new |
|---|---|---|
| `packages/miner-core` | DOM-free: `reader.ts` (storage reads for stats, landing, miner), `metrics.ts` (score, rate, next win, close preview, network rate, calculator, epoch sentence, CSV), `keys/` (HKDF → Fr/Fq, bip39), `claim-failure.ts` | adapt: `deploy/scripts/epoch-stats.ts` and `web-miner/src/chain.ts` `crossCheck` fold into `reader.ts`; `difficulty`/`expectedSecondsToWin` move out of `web-miner/src/lib/format.ts` |
| `packages/ui` | `@theme` tokens, fonts, ScoreLoop, EpochRail, PowerSlider, Marks, ProofLine, Preflight, Stepper, StatusPill, Kpi, Mark + favicon states, shadcn primitives, ThemeProvider | new; primitives copied from `web-miner/src/components/ui` |
| `packages/web-miner` | cockpit, keys, wallet, settings; prover Worker and demo Worker | adapt `controller.ts`, `lib/reducer.ts`, `prover.worker.ts`, `pinned-crs.ts`; `wallet.ts` rewritten around a supplied master |
| `packages/web-stats` | Observatory + Verify, static, reads the node | new (small) |
| `packages/web-landing` | seven sections, demo panel, launch mode, OG card; owns the assembled `dist` and the one deployable `wrangler.jsonc` | new (small) |
| `scripts/site/` | `vite-base.ts`, `_headers`, `_redirects`, `headers.ts`, `fetch-crs.ts`, `copy-artifacts.ts`, `assemble.ts`, `og-card.ts` | new; the two web-miner scripts move here |

Where I disagree with recon: (1) browser Poseidon2 is bb.js WASM (`node_modules/@aztec/foundation/dest/crypto/poseidon/index.js:6-12`), so the "light" stats reader still costs a ~4 MB chunk; it is loaded by dynamic import after first paint, not avoided. (2) The token has no `transfer`: private withdraw is `transfer_private_to_private(from, to, amount, nonce)` (artifact `token_contract-Token.json`). (3) Sealing the key record is decorative unless the EmbeddedWallet's WalletDB stops persisting `sk` and `signingKey` in cleartext (`node_modules/@aztec/wallets/dest/embedded/wallet_db.js:29-31`): the wallet gets an in-memory store. (4) Theming: drop `next-themes`, one provider in `packages/ui`; `separator.tsx` dies.

### Key interfaces

```ts
// miner-core/src/reader.ts — DOM-free; Node = ReturnType<typeof createAztecNodeClient>
export interface EpochRow { epoch: number; target: bigint; seed: bigint; openedAt: number; claims: number;
  duration: number | null; retarget: number | null; closedBy: 'claims' | 'roll' | null }
export function readOpenEpochNumber(node: Node, miner: AztecAddress, layout: StorageLayout): Promise<number>
export function readEpochs(node: Node, miner: AztecAddress, layout: StorageLayout, range: { from: number; to: number }): Promise<EpochRow[]>
export function readTotalSupply(node: Node, token: AztecAddress, layout: StorageLayout): Promise<bigint>
export function readGenesis(node: Node, miner: AztecAddress, layout: StorageLayout): Promise<{ target: bigint; seed: bigint; launchAt: number }>
export function readLottery(node: Node, miner: AztecAddress, layout: StorageLayout): Promise<{ mix: bigint; reveals: number }>
export function findLastClaimBlock(node: Node, miner: AztecAddress, layout: StorageLayout, epoch: number, sinceBlock: number, maxBlocks: number): Promise<{ block: number; timestamp: number } | null>

// miner-core/src/metrics.ts — pure
export const score = (digest: Fr): number                       // 2^128 / low128(digest)
export const difficulty = (target: bigint): number              // 2^128 / target
export const proofsPerMinute = (recentMs: number[]): number     // last 20
export const nextWinSeconds = (target: bigint, perMinute: number): number
export const closePreview = (target: bigint, elapsed: bigint, rules: EpochRules): number  // difficulty ratio via nextTarget(cappedElapsed)
export const escapeHatchIn = (openedAt: bigint, tMax: bigint, now: bigint): bigint
export const networkRate = (closed: EpochRow[], n: number): number | null // median of the last six, proofs/s
export const claimsPerHour = (closed: EpochRow[], nowSec: number): number
export const calculator = (yourPerMinute: number, network: number, rules: EpochRules & { REWARD: bigint }): { share: number; secondsToWin: number; perDay: bigint }
export const epochSentence = (row: EpochRow, next: EpochRow | null, rules: EpochRules): string // normal | fast | slow | rolled | launch
export const toCsv = (rows: EpochRow[]): string

// miner-core/src/keys/derive.ts + mnemonic.ts
export interface AccountFields { secret: Fr; salt: Fr; signingKey: Fq }
export function masterFromPrf(prf: Uint8Array): Promise<Uint8Array>      // exactly 32 B in; HKDF-SHA256(salt = sha256('yacana.kdf.v1'), info = 'master') → 32 B
export function masterFromMnemonic(words: string): Promise<Uint8Array>   // validateMnemonic → mnemonicToSeed → same HKDF
export function deriveAccountFields(master: Uint8Array): Promise<AccountFields> // HKDF 64 B per label → Fr/Fq.fromBufferReduce
export function classifyClaimFailure(e: unknown): 'reverted' | 'expired' | 'delivery-blocked' | 'other'

// web-miner/src/keys/passkey.ts — DOM; container injectable for Vitest
export function createPasskey(o: { rpId: string; credentials?: CredentialsContainer }): Promise<{ credentialId: Uint8Array; prf: Uint8Array }>
export function assertPasskey(o: { rpId: string; allow?: Uint8Array[]; credentials?: CredentialsContainer }): Promise<{ credentialId: Uint8Array; prf: Uint8Array }>

// web-miner/src/keys/store.ts — IndexedDB `yacana-keys`
export interface KeyRecord { address: string; method: 'passkey' | 'words'; createdAt: number; label: string;
  credentialId?: string; sealed?: { iv: Uint8Array; ct: Uint8Array }; askEveryOpen: boolean; backedUp: boolean; pausedUntil?: number }
export function sealMaster(master: Uint8Array, address: string): Promise<NonNullable<KeyRecord['sealed']>> // AES-GCM-256 under a non-extractable device CryptoKey, AAD = address
export function openMaster(record: KeyRecord): Promise<Uint8Array>

// web-miner/src/wallet.ts
export function openWallet(nodeUrl: string, node: Node, chainId: bigint, fields: AccountFields): Promise<OpenedWallet> // walletDb.store = MemoryKvStore

// web-miner/src/worker-protocol.ts additions
type FromWorker = … | { type: 'attempt'; epoch: bigint; secretId: number; nonce: bigint; proveMs: number; score: number }
type ToWorker   = … | { type: 'reconfigure'; threads: number }                       // destroy + re-init in place, resume at nextNonce
// web-miner/src/demo.worker.ts
type DemoIn  = { type: 'prove-once'; job: { domain: string; seed: string; epoch: bigint; target: bigint } }
type DemoOut = { type: 'step'; name: 'crs' | 'prover' | 'proof' | 'score'; ms: number } | { type: 'result'; score: number; proveMs: number } | { type: 'error'; message: string }
```

### Critical paths

**Passkey → account.** Preflight runs isolation, CRS and node first, then shows the key screen. On the click, before any aztec import: `createPasskey` (rp.id = `VITE_RP_ID || location.hostname`, `residentKey: 'required'`, `userVerification: 'required'`, ES256 + RS256, `prf.eval.first = sha256('yacana.passkey.prf.v1')`, create→get fallback when `prf.enabled` but no result) → `masterFromPrf` → `deriveAccountFields` → `openWallet` → `createSchnorrInitializerlessAccount(secret, salt, signingKey)` (re-registration is idempotent: `embedded_wallet.js:305-306`) → `sealMaster` unless "ask every open" → `KeyRecord` → controller. Returning: `openMaster` needs no gesture; with `askEveryOpen`, `assertPasskey({ allow: [credentialId] })`. "I already have a key" = discoverable `assertPasskey` without `allow`; the derived address is matched against records.

**Twelve words.** `generateMnemonic(english, 128)` → grid → the checkbox hides the words → quiz on words 3/7/11 with `onPaste` blocked → `masterFromMnemonic` → the same path; `backedUp` flips when the quiz passes. Restore: link → hostname banner (`location.hostname`) → textarea with `onPaste`/`onDrop` blocked, no `navigator.clipboard.readText` → `validateMnemonic` → derive → open.

**Mine → win → claim → mint.** Worker `attempt{ score, proveMs }` → reducer (ledger line, best-of-epoch, rate) → ScoreLoop dot; on a winner the dot rises 420 ms, the bar flashes 900 ms, the loop header becomes the Stepper: `proving` (elapsed) → `sent` (TTL countdown = send time + `CLAIM_TTL_SECONDS`) → `waiting` → `minted`: `node.getTxEffect(txHash)` supplies the nullifier and note-hash chips, `claims k → k+1`, balance count-up 600 ms, `start()` resumes. Failures pass through `classifyClaimFailure`: `reverted` or `delivery-blocked` → "claim reverted", `pausedUntil` on the record, "Mine with a fresh key" creates a second record with the same method; `expired` (wait timeout ≥ TTL, or a dropped receipt) → "claim expired"; `other` → the error line.

**Stats read path.** Shell renders → `import('./reader')` (bb.js sync WASM for `deriveStorageSlotInMap`) → `readOpenEpochNumber` → `readEpochs(open − 47 … open)` (three `getPublicStorageAt` per epoch, JSON-RPC batched) → `readTotalSupply` (slot 8) → tiles, strip, charts, table; `findLastClaimBlock` scans at most 64 blocks of the open epoch with `getBlocks(from, n, { includeTransactions: true })`, matching `computePublicDataTreeLeafSlot(miner, claimsSlot)` in `publicDataWrites`; the 30 s poll starts from `getBlockData('latest')`; "load older" reads the previous 48. `?epoch=N` ↔ selection; ← → step.

**Landing demo.** Click → `new Worker(new URL('../../web-miner/src/demo.worker.ts', import.meta.url), { type: 'module' })` → `prove-once` with the live seed/epoch/target from the reader, `deployDomain(chainId, rollupVersion, miner, VERSION)`, a random secret commitment and nonce → steps with real ms → score, bar, odds `1 in ⌈difficulty⌉`; the dot joins the loop. Nothing leaves the page.

### File-level change map (+ added, ~ modified, − deleted)

- root: ~`package.json` (`yacana`; `site:build`, `site:e2e`; `test:components` → `--filter './packages/*'`), `elixir.params.json` → +`yacana.params.json`, ~`CLAUDE.md`, ~`README.md`, ~`docs/{deployments,threat-model,roadmap}.md`, +`scripts/site/*`, +`.github/workflows/{ui,web-stats,web-landing,deploy-web,e2e}.yml`, ~`.github/workflows/{web-miner,miner-core,contracts,work-circuit,deploy}.yml`.
- contracts / work-circuit: crate, contract and artifact renames; regenerated `vk.nr`, `vectors.nr`, `fixtures/yacana_work/*`, `fixtures/vectors.json`, `src/generated/vk.ts`.
- miner-core: +`reader.ts`, +`metrics.ts`, +`keys/{derive,mnemonic}.ts`, +`claim-failure.ts`, +tests, +`fixtures/epochs.testnet.json`; ~`generated/params.ts`, ~`artifacts.ts`.
- deploy: ~`scripts/epoch-stats.ts` (thin CLI over `reader.ts`), ~`src/deploy.ts` (`deployYacana`, `YACANA_*`); `deployments/testnet.json` → `deployments/elixir-testnet-2026-09-04.json`, +new `deployments/testnet.json`.
- ui: + everything.
- web-miner: +`src/keys/*`, +`src/wallet/memory-store.ts`, +`src/routes/{Mine,Wallet,Settings}.tsx`, +`src/features/*`, +`src/demo.worker.ts`, +`src/tab-status.ts`, +`src/pip.ts`, +`src/settings.ts`; ~`boot.ts`, ~`controller.ts`, ~`lib/reducer.ts`, ~`worker-protocol.ts`, ~`prover.worker.ts`, ~`wallet.ts`, ~`config.ts` (cross-check gone), ~`vite.config.ts` (uses `vite-base`); −`public/_headers`, −`src/csp.test.ts`, −`components/ui/*`, −`components/theme-provider.tsx`, −`ConnectionCard.tsx`; ~`e2e/*` (+`passkey`, `words`, `withdraw`, `states` specs; the four cross-check specs deleted).
- web-stats / web-landing: + packages with `e2e/` on the `run-setup.ts` pattern (lanes 4 and 5).

### Non-obvious mechanics

- **One origin.** `scripts/site/assemble.ts` builds the landing (`base /`), the miner (`--base /mine/`) and the stats (`--base /stats/`) into `packages/web-landing/dist/{,mine,stats}`, materialises `crs/` and `artifacts/` once at the root, and copies `scripts/site/_headers` (one `/*` block: COOP/COEP, CSP `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' data: <node>; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'none'`) and `_redirects` (`/mine/* /mine/index.html 200`, `/stats/* /stats/index.html 200`, `/verify /stats/index.html 200`). `packages/web-landing/wrangler.jsonc` (`name: yacana-web`, `pages_build_output_dir: dist`) is the only deployable; miner and stats keep a `wrangler.jsonc` without `name` for `wrangler pages dev` parity only. Dev servers keep `base /`, materialise CRS and artifacts into their own gitignored `public/`, and `vite-base.ts` injects the shared headers so dev and preview run under the production policy. `pinned-crs.ts` and artifact loaders use root-absolute `/crs` and `/artifacts` everywhere.
- **Encrypted key storage.** Spend authority is `secret` + `signingKey`. At rest only the sealed master exists; the WalletDB gets `MemoryKvStore` (the kv-store "ephemeral" mode still writes a random-named IndexedDB: `node_modules/@aztec/kv-store/dest/deprecated/indexeddb/store.js:36`); the PXE store holds only viewing/tagging/nullifier-hiding keys and notes (`node_modules/@aztec/key-store/dest/key_store.js:269-275`) and stays persistent and unencrypted (residual: balance readable from disk, not spendable; sqlite-opfs encryption stays a roadmap item, `docs/roadmap.md:35`). "Ask every open" stores no master at all.
- **PRF ceremony ordering.** `navigator.credentials.*` is the first await after the click; CRS and node preflight finish before the key screen, the wallet import starts after the ceremony resolves.
- **Worker reuse for the demo.** `demo.worker.ts` imports `shims/node-globals` first, `pinned-crs` second, reuses `BbJsWorkProver`; the landing uses the shared bb.js-aware Vite base so the Worker chunk is emitted correctly and downloaded on click only.
- **Power slider → threads.** threads ∈ [1, cores − 1]; labels eco = ⌈(cores − 1)/4⌉, balanced = ⌈(cores − 1)/2⌉, max = cores − 1; `reconfigure` stops the job, destroys and recreates `Barretenberg`, resumes from `nextNonce`; the readout is the measured rate.
- **Favicon/title.** `tab-status.ts` draws the mark on a 32 px canvas → `link[rel=icon]` data URL (covered by `img-src data:`); states idle / mining / won (60 s) / paused; title `▸ 18/min · 2/4 · Yacana`; both update while hidden, the loop stops drawing.
- **CSV export.** `toCsv(rows)` → `Blob` → `URL.createObjectURL` download; JSON is the same rows.
- **URL-addressable epoch.** `history.replaceState` on selection, `popstate` restores, arrows step within loaded rows and trigger "load older" at the left edge.

### Trade-offs and alternatives not taken

- Three routes on `history` + `popstate` (~40 lines) instead of a router dependency.
- sqlite-opfs encrypted stores are the right primitive but blocked by unhashed worker/WASM emission; deferred.
- `wrangler pages dev` only for the assembled-site E2E; per-package E2E keeps `vite preview`.
- Raw WebAuthn as in bazaar; no passkey library.
- A pure-JS Poseidon2 (unvetted) rejected in favour of bb.js loaded lazily.

## 3. Phases

Gate legend — **L**: `bun run lint && bun run lint:actions && bun run lint:shell` and `bun run --cwd <pkg> typecheck`; **U**: `bun test`; **C**: `bun run test:components`; **E**: `bun run e2e:agent -- bun run --cwd <pkg> test:e2e`. Pass = exit 0, no skipped required spec, no new Biome suppressions.

### Arc 0 · rename

**P0.1 Protocol rename.** Goal: `YACA/*` tags, `Yacana Testnet`/`tYACA` and `Yacana`/`YACA`, `GENESIS_SEED` = "YACA/testnet"/"YACA/mainnet", crates `yacana_work`, `yacana_work_lib`, `yacana_miner`, `yacana_spike`, contracts `YacanaMiner`/`YacanaSpike`, regenerated VK, fixture proof and vectors. Steps: params file (+`$comment`); `scripts/params-codegen.ts` reads `YACANA_PROFILE`; rename crates, Nargo workspaces, `use yacana_work_lib`, the `env.deploy("YacanaMiner")` literals, every artifact loader (recon §1); `bun run codegen`; `bun run --cwd packages/work-circuit spike:determinism` (fresh native proof) → `bun run --cwd packages/work-circuit export-vk` → `bun packages/miner-core/scripts/pin-vectors.ts` → `bun run codegen` again; fix the six tripwire tests. Tests: existing suites regenerate. Gate: L; U; `bun run contracts:compile && bun run contracts:test`; `bun run codegen && git diff --exit-code` (the CI check).

**P0.2 Workspace, env, storage, CI, docs, deployment.** Goal: `@yacana/*`, `YACANA_*` env, `yacana.connection`, `yacana-pxe-<ns>`, `window.yacana`, `deployYacana`, `yacana-` run ids, CI filters, docs. Steps: package names + `bun install` (lockfile diff reviewed); env, storage and wrangler (`yacana-web`); e2e strings `tYACA`; `docs/deployments.md`, `CLAUDE.md`, `README.md`, threat model; move the old record; the owner runs `AZTEC_NODE_URL=… YACANA_DEPLOYER_SECRET=… bun run deploy` (secret from the shell, never echoed or committed), commits `deployments/testnet.json` and `.env.production`; evidence = `bun run epoch:stats` output in `docs/deployments.md`. Gate: L; U; C; E (`web-miner`, all specs green under the new ids); `git grep -i elixir` hits only history files, `docs/pitch`, `implementations-plan/elixir-core` and `harsh-elixir`.

### Arc 1 · ui

**P1.1 Scaffold, tokens, fonts, primitives, status.** Goal: `packages/ui` with `@theme` tokens from the binder palette (dark default, light override), `@fontsource-variable/hanken-grotesk` + `@fontsource-variable/jetbrains-mono` (both 5.3.0), primitives (button, input, label, switch, segmented, sheet, dialog), StatusPill (5 px rectangles), Kpi, Mark + `faviconDataUrl(state)`, ThemeProvider, Vitest + jsdom + RTL. Files: `packages/ui/{package.json,vitest.config.ts,tsconfig.json,tests/setup.ts,src/index.ts,src/tokens.css,src/components/*}`; root `test:components` filter. Tests: StatusPill variants, `faviconDataUrl` per state, ThemeProvider class toggling. Gate: L; C.

**P1.2 Signature components.** Goal: ScoreLoop (canvas, log axis 1–1000, one dot per attempt at its real time, the bar at the difficulty, win rise/flash, `prefers-reduced-motion` still frame, no drawing while hidden), ProofLine (★ ✓ ✗ ── grammar, 120 ms entry), Stepper (real times), Preflight (evidence rows, failure state), EpochRail (segments with the miner's own claims brighter, expected tick, kv rows, "Close the epoch" when the hatch ≤ 0), PowerSlider (labels, clamp), Marks. Tests: one spec each — dots per attempt and the win flag, all four line kinds, failure evidence, the button at T_MAX, clamp and emitted threads. Gate: L; C.

### Arc 2 · miner

**P2.1 Site tooling + M1 shell.** Goal: `scripts/site/{vite-base,headers,fetch-crs,copy-artifacts}.ts`, `scripts/site/_headers` as the source of truth with `scripts/site/headers.test.ts` (bun:test replacing `csp.test.ts`: `connect-src` equals every package's `VITE_ALLOWED_NODE_ORIGINS`), the three-route shell, desktop-only screen (< 900 px, or coarse pointer without `SharedArrayBuffer`), testnet label, tab status, cross-check removed from `config.ts`, `chain.ts` and the specs; `miner.e2e.ts` keeps passing under new test ids, the malformed-RPC spec now targets the primary node through the mock origin. Tests: `headers.test.ts`, route hook, desktop-only. Gate: L; U; C; E (`web-miner`).

**P2.2 Cockpit, power, settings.** Goal: score → ledger → three numbers → rail (`closePreview`, hatch countdown → `roll()`), PowerSlider → `reconfigure`, Settings (Performance with pause-on-battery via `navigator.getBattery` and background proving; Behaviour with resume-on-open, notify, sound, tab status, PiP via `documentPictureInPicture`; Appearance; About with version, `VITE_SOURCE_COMMIT`, bb.js version; Network: node only), `yacana.settings` in localStorage. Files: `reducer.ts` (score, best, ledger), `worker-protocol.ts`, `prover.worker.ts`, `controller.ts`, `features/*`, `settings.ts`. Tests: reducer (ledger, best resets per epoch, rate over 20), `metrics.test.ts` (bun), reconfigure resumes the nonce (Vitest, fake worker). Gate: L; U; C; E (`miner.e2e.ts` plus: changing power keeps mining and the ledger grows).

**P2.3 Passkey keys + sealed storage.** Goal: `keys/derive.ts` with pinned vectors (fixed master → fixed address), `keys/passkey.ts`, `keys/store.ts`, `wallet/memory-store.ts`, `openWallet(fields)`, the key screen (card, consent checkbox, sync banner, two links), "Welcome back", "ask every open". Tests: derive vectors (bun), memory-store subset exercising the calls `WalletDB` makes (bun), ceremony with a fake `CredentialsContainer` including the create→get fallback (Vitest), seal/open with an AAD mismatch failing (Vitest, WebCrypto). E2E `passkey.e2e.ts`: CDP virtual authenticator (`ctap2_1`, `hasPrf`, `automaticPresenceSimulation`) → create → mine → claim → reload → balance; with "ask every open" the reload prompts again; no `yacana-wallet-*` database exists and `yacana-keys` holds no field-sized plaintext. Gate: L; U; C; E.

**P2.4 Twelve words, wallet route, withdraw.** Goal: words path (gate, 3/7/11 quiz, paste blocked, hostname banner, show for 60 s, forget with the last-4 confirmation), Wallet route (balance, recovery row, keys on this device, claims history in localStorage), Withdraw sheet: private = `transfer_private_to_private`, public = `transfer_private_to_public`, recipient check (`node.getContract(to)` before a private send), amount ≤ balance, mining paused around the send. Tests: quiz hook (Vitest), mnemonic vectors (bun), form validation (Vitest). E2E `words.e2e.ts` (create, quiz, mine, forget, restore) and `withdraw.e2e.ts` (private "move here" to a second key; public to an address checked through a `public_balances` storage read). Gate: L; U; C; E.

**P2.5 States, rotation, resilience, CI e2e.** Goal: Stepper with TTL, minted marks from `getTxEffect`, reverted → fresh key, expired, node unreachable (pause after 60 s of failed reads, retry every 10 s, auto-resume), prover-dead card, notifications, sound, PiP; `claim-failure.ts` with message fixtures; `e2e.yml` (`workflow_dispatch`). Tests: classifier (bun), reducer paths (Vitest). E2E `states.e2e.ts`: the node route aborted mid-mining → paused → restored → resumes; the prover-crash spec stays. Gate: L; U; C; E; `bun run lint:actions`.

### Arc 3 · stats

**P3.1 Reader + metrics.** Goal: `reader.ts`, `metrics.ts`, `epoch-stats.ts` rewired, `fixtures/epochs.testnet.json` captured with `bun run epoch:stats -- --json`. Tests: metrics on fixtures (median network rate, claims/hour, the five sentence templates, close preview, calculator), CSV round-trip, `describe.skipIf(!process.env.AZTEC_NODE_URL)` live read of epoch 0. Gate: L; U; `bun run e2e:agent -- bun test packages/miner-core`.

**P3.2 web-stats.** Goal: Observatory (six numbers), strip (URL selection, keys, 240 ms slide-in), detail card + sentence, four SVG charts in `web-stats/src/charts`, table + CSV/JSON, "what is not here", calculator sheet, Verify page from `deployments/<profile>.json` + `PARAMS` + `W_VK_HASH` + `VITE_SOURCE_COMMIT` + the reproduce command, "load older", freshness line. Tests: Vitest per chart and for the strip on fixture rows, the URL-selection hook. E2E `stats.e2e.ts` on the isolated deployment: epoch 0 renders, `?epoch=0` selects, CSV downloads, Verify matches `.run.json`. Gate: L; U; C; E (`web-stats`).

### Arc 4 · landing

**P4.1 Sections, demo, launch flag.** Goal: seven sections with the copy deck verbatim, live strip through the reader, mobile (share sheet, no demo button rendered), `demo.worker.ts` + the three-state panel, `VITE_LAUNCH_MODE` hero (countdown from `readGenesis`, status from `readLottery`, "Commit my entropy" links the `bun run launch -- commit` path until an in-page wallet exists — Ask 3), `og-card.ts` (Playwright screenshot of `public/og.html`) → `public/og.png`. Tests: copy snapshots, demo state machine with a fake worker. E2E `landing.e2e.ts`: "Prove one now" yields a score with real step times under COOP/COEP; no request leaves `'self'` and the node. Gate: L; C; E (`web-landing`).

**P4.2 Assembly, deploy, previews.** Goal: `assemble.ts`, `_redirects`, `deploy-web.yml`, `site:e2e` (`wrangler pages dev dist --port <registry lane 7> --ip 127.0.0.1`) asserting `/`, `/mine/wallet`, `/stats?epoch=0` and `/verify` serve the right app with identical headers and that the demo proves; docs (`CLAUDE.md` table, threat-model rows, web section in `docs/deployments.md`). Gate: L; `bun run site:build`; `bun run e2e:agent -- bun run site:e2e`; `bun run lint:actions`.

## 4. Delivery

Branch `yacana-surfaces` in this worktree; one branch per arc, stacked with `gh stack` (`arc0-rename` → `arc1-ui` → `arc2-miner` → `arc3-stats` → `arc4-landing`). Per arc: phases → gates → codex xhigh fix loop until it converges (no `/code-review`, owner's decision) → next arc. Then the final cross-arc codex pass and `gh stack submit`, which opens the five PRs in order; each body lists the gates run and the E2E evidence (peak RSS, timings, deployment evidence for arc 0). Never merge; never touch mainnet.

## 5. CI

- New PR gates on the existing `changes` template (`dorny/paths-filter`, manual-dispatch override, `contents: read`): `ui.yml` (paths: `packages/ui/**`, `biome.json`, `tsconfig.json`, `package.json`, `bun.lock`, its own file, `.github/actions/**`; job: `bun run lint`, `bun run --cwd packages/ui typecheck`, `bun run --cwd packages/ui test:components`); `web-stats.yml` (adds `packages/miner-core/src/**`, `packages/ui/**`, `scripts/site/**`, `deployments/**`, `yacana.params.json`, `scripts/params-codegen.ts`); `web-landing.yml` (same, plus `packages/web-miner/src/{demo.worker.ts,pinned-crs.ts,shims/**}`, `packages/web-miner/crs.lock.json`). `web-miner.yml` adds `packages/ui/**` and `scripts/site/**`; `miner-core.yml`, `contracts.yml`, `work-circuit.yml` filters follow the renames; `contracts.yml` runs `bun run site:build` instead of the miner build alone.
- `deploy-web.yml`: `on: push: branches: [main]` and `pull_request`; `permissions: contents: read`; `changes` (web paths) → `build` (setup-bun, setup-aztec, `bun run codegen`, `bun run contracts:compile`, `bun run site:build`, upload `dist`) → `deploy` (main only, `environment: production`, `bunx wrangler pages deploy` with `CLOUDFLARE_API_TOKEN` scoped to Pages: Edit and `CLOUDFLARE_ACCOUNT_ID`) or `preview` (same-repo PRs only: `github.event.pull_request.head.repo.full_name == github.repository`; `wrangler pages deploy --branch "$GITHUB_HEAD_REF"`; `pull-requests: write` on that job alone to comment the URL). Wrangler pinned in `web-landing` devDependencies (min-age applies); `VITE_SOURCE_COMMIT=$GITHUB_SHA`.
- `actionlint.yml` unchanged; every workflow passes `bun run lint:actions`.
- E2E in CI: `e2e.yml`, `workflow_dispatch` only, 90-minute timeout: setup-aztec, `bunx playwright install --with-deps chromium`, `bun run e2e:agent -- bun run test:e2e`. Cost about 40 minutes and ~3 GB RAM per run on `ubuntu-latest`; proving on 4 vCPU is 3–4× slower than the homelab, so it is evidence, not a merge gate.

## 6. Security & adversarial considerations

- **Miner.** Threats: hosted-page compromise (reads the unlocked master; stated on the page), XSS (`script-src 'self' 'wasm-unsafe-eval'`, no inline scripts, React escaping, no `dangerouslySetInnerHTML`), clickjacking (`frame-ancestors 'none'` origin-wide), CSRF (no cookies, no server), a lying node (wastes work; claims verified on-chain; malformed payloads rejected at boot), disk theft (sealed master; residual privacy keys), phishing of the words (hostname banner, no clipboard reads, the quiz exists only at creation). Cryptography: WebAuthn PRF (CTAP2 `hmac-secret`), HKDF-SHA256 and AES-GCM-256 through WebCrypto only, `@scure/bip39` pinned to `2.3.0` (already in `bun.lock:689`), `@aztec/*` `5.2.0`, field sampling by `fromBufferReduce` over 64 HKDF bytes (the repo's `secret.ts` pattern). Input validation: addresses through `AztecAddress.fromString` (throws), amounts as `bigint` with decimals, node URL against the allowlist and CSP, `?node=` only within the allowlist, mnemonics through `validateMnemonic`, quiz words normalised.
- **Stats / landing.** No secrets, read-only; a lying node can only mislabel numbers (the footer names the node); `getBlocks` bounded to 64 blocks per poll; epoch numbers validated before slot derivation. The demo Worker is a new boundary: same CSP/COOP/COEP, no key, no network beyond `'self'`; the landing never asks for a key.
- **What a hosted page can do.** Today: read the wallet DB and spend. After: read the unlocked master in memory during a session, so "run your own build" stays on the page; passkeys add a device-bound, non-exportable credential and user verification, not protection from same-origin script. RP ID = apex hostname (`VITE_RP_ID`, runtime `location.hostname` when unset); preview deployments get separate passkeys.
- **Rename hazards.** New IndexedDB names orphan `elixir-*` data (documented: the old testnet key is not migrated); the RP ID is unaffected; renamed env vars break local `.env` files (documented).
- **Supply chain.** Seven-day min-age (`bunfig.toml:3`), frozen lockfile, SHA-pinned actions, fonts and wrangler through the lockfile, no CDN requests.

## 7. Assumptions

Facts: WalletDB persists `sk`/`signingKey` (`node_modules/@aztec/wallets/dest/embedded/wallet_db.js:29-31`); the key store withholds signing keys (`node_modules/@aztec/key-store/dest/key_store.js:269-275`); re-registration is idempotent (`node_modules/@aztec/wallets/dest/embedded/embedded_wallet.js:305-306`); token functions `transfer_private_to_private`, `transfer_private_to_public`, `total_supply` at slot 8 (`node_modules/@aztec-foundation/aztec-standards/target/token_contract-Token.json`); browser Poseidon2 is bb.js (`node_modules/@aztec/foundation/dest/crypto/poseidon/index.js:6-12`); `getBlockData` is header-only (`node_modules/@aztec/stdlib/dest/interfaces/aztec-node.d.ts:184`); `Fq.fromBufferReduce` exists (`node_modules/@aztec/foundation/dest/curves/bn254/field.d.ts:155`); the ephemeral IndexedDB store still writes (`node_modules/@aztec/kv-store/dest/deprecated/indexeddb/store.js:36`); threads default to `cores − 1` (`packages/web-miner/src/boot.ts:41`); E2E port lane 6 (`packages/web-miner/e2e/run-setup.ts:70`); the claim wait is 900 s (`packages/web-miner/src/chain.ts:118`); root `test:components` hardcodes web-miner (`package.json:28`); the sqlite-opfs blocker (`docs/roadmap.md:35`); the fonts exist at 5.3.0 and wrangler at 4.x on npm.

Inferences (unverified): Cloudflare Pages `_redirects` 200 rewrites serve nested SPAs; `wrangler pages dev` honours `_headers` and `_redirects` offline; Vite emits a Worker chunk for a cross-package `new Worker(new URL(...))`; the public testnet RPC serves `getBlocks` with bodies at acceptable latency; CDP `hasPrf` behaves in Playwright 1.62's Chromium as in bazaar's 1.49; Document PiP exists only in Chromium (feature-detected).

Asks: (1) GitHub org, X handle and domain for the footers and `VITE_RP_ID`; (2) "Receive": show the address only, or also publish the account instance so others can send privately; (3) launch mode v1: command-line commit acceptable, or in-page wallet-sdk connection now; (4) may the old Elixir testnet record move to `deployments/elixir-testnet-2026-09-04.json`.

## 8. Adversarial self-review

- The in-memory WalletDB store relies on an undocumented call subset; an upstream change to `WalletDB` range queries would break unlock silently — the memory-store test mirrors the exact calls and the passkey E2E fails loudly.
- One `_headers` for three surfaces means one bad edit takes all of them down; `headers.test.ts` pins every directive.
- `reconfigure` in place may leak bb.js memory; if the E2E shows growth, respawn the Worker instead (the generation logic exists).
- An attacker targets the words-restore form (phishing) and the demo Worker (a CPU sink): the hostname banner and the click-gated download are mitigations, not proofs.
- I trust that `getTxEffect` exposes the claim's nullifiers right after `wait`; otherwise the marks come from a scan of the receipt's block.
- Most likely wrong: the stats bundle cost (bb.js sync WASM) and the Pages rewrite semantics; both are checked in the P3.2 and P4.2 gates before anything ships.

## 9. Estimates

Arc 0: 2.5 agent-days (plus the owner's deploy). Arc 1: 2. Arc 2: 6. Arc 3: 2.5. Arc 4: 2.5. Total about 15.5 agent-days. Riskiest phase: P2.3 — the ceremony ordering, PRF determinism under the virtual authenticator, the memory wallet store and the sealed records all land together.
