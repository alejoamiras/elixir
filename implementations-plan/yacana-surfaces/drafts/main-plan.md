# yacana-surfaces — main draft (planner: main session)

## Summary

Rename Elixir to Yacana (arc 0: params, domain tags, circuits, VK, fixtures, vectors, crates, packages, env, storage keys, CI, docs, a fresh testnet deployment), then build the three product surfaces on one Cloudflare Pages origin: `packages/ui` (tokens, fonts, the signature components), the `packages/web-miner` redesign (M1 cockpit, passkey-first keys with twelve words behind a link, encrypted vault, indexed accounts for rotation, private/public withdraw, power slider, the win beats and failure states, settings, a `/mine/demo` route), `packages/web-stats` (Observatory over browser-side storage reads with a build-time slot table, Verify page, calculator) and `packages/web-landing` (H3 hero, Money section, demo panel as a same-origin iframe of `/mine/demo`, launch mode). `packages/site` assembles the three builds into one `dist` with one `_headers`, and `deploy-web.yml` ships it on merge to main.

## Architecture & Implementation

### Shape

```
packages/
  ui/            tokens (Tailwind v4 @theme), self-hosted fonts, signature + shadcn components, favicon/title hooks     [new]
  web-miner/     the miner app at /mine (cockpit, wallet, settings, demo); owns the prover Worker, CRS pin, artifacts     [redesign]
  web-stats/     the Observatory + Verify at /stats, /stats/verify; reads the node from the browser                        [new]
  web-landing/   the landing at /; static, no prover; live strip via the same reader; demo = iframe /mine/demo            [new]
  site/          assembler: builds the three apps with base paths, merges into dist/ with _headers + _redirects; wrangler   [new]
  miner-core/    + src/storage.ts (node-only reads, slot table) + scripts/gen-slots.ts                                     [adapt]
  deploy/        epoch-stats.ts becomes a thin CLI over miner-core/src/storage.ts                                          [adapt]
```

Cross-package imports stay **relative** (the repo's convention; no `workspace:*` names, no exports maps). Tailwind scans `packages/ui/src` via `@source` in each app's CSS entry.

**One origin.** `packages/site/build.ts` runs `vite build` for landing (`base: '/'`), miner (`base: '/mine/'`), stats (`base: '/stats/'`), copies `dist/`, `dist/mine/`, `dist/stats/`, writes `_redirects` (`/mine/* /mine/index.html 200`, `/stats/* /stats/index.html 200`) and one `_headers` with an origin-wide block (COOP `same-origin`, COEP `require-corp`, the CSP, nosniff, no-referrer) plus a `/mine/demo` block that replaces `frame-ancestors 'none'` with `'self'` so the landing can frame it. `wrangler.jsonc` lives in `packages/site` (project `yacana`), the only Pages project; `packages/web-miner/wrangler.jsonc` is deleted. The apps keep standalone `vite preview` for E2E.

**Why an iframe for the demo, not a shared prover package.** The demo needs bb.js, the pinned CRS, the artifacts, `crossOriginIsolated` and the bb.js-specific Vite config (`nodePolyfills`, `dedupe`, `optimizeDeps`). Sharing that with the landing would either duplicate the config or force the landing onto the heavy toolchain. A same-origin `<iframe src="/mine/demo">` costs one `frame-ancestors 'self'` header on one path and nothing else; the landing stays a 100 KB static page. Rejected: `packages/prover-web` (a third Vite/bb.js consumer to keep in sync), and running the proof in the landing's own bundle.

**Why a slot table for the stats reader.** `deriveStorageSlotInMap` is Poseidon2 through `BarretenbergSync` (WASM, ~3 MB gzipped: `@aztec/foundation/dest/crypto/poseidon/index.js`). The map slots for `epochs[e]` and `claims[e]` depend only on `e` and the contract's storage layout, so `packages/miner-core/scripts/gen-slots.ts` (Bun, native/WASM bb) emits `slots/<chunk>.json` files of 512 epochs each at build time (`{ epochs: hex[], claims: hex[] }`, ~66 KB per chunk) for `e < 262,144`; the browser fetches the one or two chunks its window needs. Fixed slots (`open_epoch`, `genesis`, `token`, `launch_mix`, `launch_reveals`, the token's `total_supply`) come straight from the artifacts' `storageLayout`. No WASM in stats or landing. The generator is pinned by a bun:test against `deriveStorageSlotInMap`. Rejected: shipping bb.js in the stats/landing bundles; a pure-TS Poseidon2 (rolling our own hash).

### Key interfaces

```ts
// packages/miner-core/src/storage.ts (browser + Bun; no wallet)
export interface StorageLayout { [name: string]: { slot: Fr } }
export interface EpochRecord { epoch: number; target: bigint; openedAt: number; claims: number }
export interface ChainSnapshot { openEpoch: number; epochs: EpochRecord[]; totalSupply: bigint; genesis: { target: bigint; seed: bigint; launchAt: number }; lottery: { mix: bigint; reveals: number }; block: number; at: number }
export function slotTable(chunk: number): Promise<{ epochs: Fr[]; claims: Fr[] }>        // fetches slots/<chunk>.json (browser) or derives (Bun)
export function readWindow(node: Node, miner: AztecAddress, layout: StorageLayout, opts: { from: number; to: number }): Promise<EpochRecord[]>
export function readSnapshot(node: Node, addrs: { miner: AztecAddress; token: AztecAddress }, layouts: { miner: StorageLayout; token: StorageLayout }, window: number): Promise<ChainSnapshot>
export function readTotalSupply(node: Node, token: AztecAddress, layout: StorageLayout): Promise<bigint>

// packages/web-miner/src/keys/
export type KeyMethod = 'passkey' | 'phrase';
export interface KeyRecord { id: string; method: KeyMethod; index: number; address: string; credentialId?: string; createdAt: number; pausedUntil?: number }
export interface DerivedKeys { secret: Fr; salt: Fr; signingKey: GrumpkinScalar }
export function deriveKeys(master: Uint8Array, index: number): Promise<DerivedKeys>       // HKDF-SHA256 labels, rejection sampling
export function passkeyCreate(rpId: string, userName: string): Promise<{ master: Uint8Array; credentialId: string }>
export function passkeyGet(rpId: string, credentialId?: string): Promise<{ master: Uint8Array; credentialId: string }>
export function phraseGenerate(): string[]; export function phraseToMaster(words: string[]): Promise<Uint8Array>
export interface Vault { list(): Promise<KeyRecord[]>; open(id: string): Promise<{ record: KeyRecord; master: Uint8Array | null }>; save(record: KeyRecord, master: Uint8Array | null): Promise<void>; forget(id: string): Promise<void> }
export function openVault(ns: string): Promise<Vault>                                       // AES-GCM under a non-extractable IndexedDB CryptoKey

// packages/web-miner/src/worker-protocol.ts (extended)
type ToWorker = … | { type: 'threads'; threads: number } | { type: 'proveOnce'; job: MineJob }
type FromWorker = … | { type: 'proved'; digest: string; score: number; proveMs: number; steps: { name: string; ms: number }[] }

// packages/ui/src/index.ts
export { ScoreLoop, EpochRail, PowerSlider, Marks, ProofLine, Preflight, Stepper, StatusPill, Mark, Sheet, Button, Input, Label, Alert, Badge, Progress, Toaster }
export { useTitleStatus, useFaviconStatus, ThemeProvider, useTheme, cn }
export type { ScoreSample, Beat, LedgerLine, PreflightStep, PillState }
```

### Critical flows

1. **Create a key (passkey)**: user gesture → `passkeyCreate(rpId = location.hostname)` (WebAuthn `create` with `residentKey: 'required'`, `userVerification: 'required'`, `extensions.prf.eval.first = sha256('yacana.passkey.prf.v1')`, create→get fallback when `prf.enabled` but no result) → `master` (HKDF-SHA256, fixed salt `sha256('yacana.passkey.kdf.v1')`, info `yacana.passkey.master.v1`) → `deriveKeys(master, 0)` → `openWallet` registers the initializerless Schnorr account (no tx) → `vault.save(record, master or null)`; only THEN the heavy aztec import continues (the ceremony runs first so the gesture is not consumed by the import). "Ask for the passkey on every open" stores `master: null` and repeats `passkeyGet` at boot.
2. **Twelve words**: `phraseGenerate()` (`@scure/bip39`, 128 bits) → write-down gate (checkbox → words replaced by dots → quiz 3/7/11, paste blocked, blur on tab hide / 60 s) → `phraseToMaster` (bip39 seed → HKDF to 32 bytes) → same `deriveKeys`. Restore: textarea (no clipboard reads, no drag-drop, hostname banner) → validate → derive indexes 0…gap until one has notes or is unused.
3. **Mine → win → mint**: unchanged reducer; the loop tile appends a dot per `attempt` (`proveMs`, `score = 2^128 / low128(digest)`); `winner` → the tile header becomes the Stepper (proving / sent + TTL countdown / block / minted) driven by `sendClaim` events; `claimed` → Marks shown until the next `attempt`; balance +4 count-up; title/favicon hooks read the reducer state.
4. **Reverted claim → rotation**: `isDeliveryBlockedError` → the record gets `pausedUntil = now + 40 min`, the "Mine with a fresh key" button derives `index + 1` from the same master and registers it; the wallet lists all records with balances.
5. **Stats read path**: `readSnapshot` → `open_epoch` (1 read) → chunk(s) for `[open − 48, open]` → 3 reads per epoch in batches of 8 (`Promise.all`) → `total_supply`, `genesis`, lottery → numbers render as each batch lands; "load older" repeats for the next 48. Refresh every 30 s reads only `open_epoch`, the open epoch's row and `total_supply`.
6. **Demo**: landing renders `<iframe src="/mine/demo">` on desktop; the route boots the Worker only (no wallet, no PXE), posts `proveOnce` with the live seed/difficulty read via the same reader, shows Preflight steps with measured times, then score / bar / odds; `postMessage({ type: 'yacana:proved', score })` to the parent so the landing's loop can add the dot.

### File-level change map

- **new** `packages/ui/{package.json, tsconfig.json, vitest.config.ts, components.json, src/theme.css, src/fonts.css, src/index.ts, src/components/*.tsx, src/hooks/*.ts, src/**/*.test.tsx, tests/setup.ts}`
- **new** `packages/web-stats/{package.json, tsconfig*.json, vite.config.ts, vitest.config.ts, index.html, src/{main.tsx, App.tsx, routes/*, charts/*, reader.ts, sentence.ts, calculator.ts, export.ts, config.ts}, e2e/{run-setup.ts, run-teardown.ts, run.ts, global-*.ts, stats.e2e.ts, fixtures/history.json}, public/_headers? (no: site owns headers)}`
- **new** `packages/web-landing/{…same shape…, src/sections/*, src/copy.ts, public/og.png}`
- **new** `packages/site/{package.json, build.ts, headers.ts, wrangler.jsonc, site.test.ts, e2e/…}`
- **modified** `packages/web-miner`: `vite.config.ts` (base `/mine/`, `@source`), `src/{main.tsx, App.tsx → routes, boot.ts, wallet.ts, controller.ts, worker-protocol.ts, prover.worker.ts, config.ts, state.ts, lib/reducer.ts}`, `src/keys/*` (new), `src/routes/{Mine,Wallet,Settings,Demo}.tsx` (new), `src/components/*` (rewritten on `ui`), `src/components/ui/*` (deleted), `index.css`, `e2e/*.e2e.ts` (+ `keys.e2e.ts`, `withdraw.e2e.ts`, `demo.e2e.ts`), `scripts/{fetch-crs,copy-artifacts}.ts` (unchanged), `wrangler.jsonc` (deleted), `public/_headers` (moved to site).
- **modified** `packages/miner-core/src/{storage.ts (new), epoch.ts, generated/*}`, `scripts/{gen-slots.ts (new), pin-vectors.ts}`; `packages/deploy/scripts/epoch-stats.ts`.
- **renamed** everything in recon §rename; `elixir.params.json → yacana.params.json`.
- **CI** new `ui.yml`, `web-stats.yml`, `web-landing.yml`, `site.yml`, `deploy-web.yml`; modified `web-miner.yml`, `miner-core.yml`, `contracts.yml`, `work-circuit.yml`, `deploy.yml` (filters).
- **docs** `CLAUDE.md`, `README.md`, `docs/{deployments,roadmap,threat-model}.md`, `packages/*/README.md`, `implementations-plan/index.md`.

### Non-obvious mechanics

- **Threads at runtime**: `Barretenberg.new({ threads })` fixes the pool; a `threads` message makes the Worker finish the in-flight proof, `destroy()` the API, re-`init` with the new count and resume from `nextNonce`. The slider is immediate; the rate readout follows the next 20 proofs.
- **Title/favicon**: `useTitleStatus(state)` sets `document.title`; `useFaviconStatus` draws the mark (bar + dot) on a 32×32 canvas and swaps `<link rel="icon">` as a data URL; states idle/mining/won (60 s)/paused.
- **Notifications**: `Notification.requestPermission()` on the toggle; fired on `claimed`; PiP via `documentPictureInPicture` behind capability detection (Chrome only, no polyfill).
- **CSV/JSON export**: a Blob URL from the in-memory rows; no server.
- **URL selection**: `?epoch=N` read on load and written with `history.replaceState`; arrows move it.
- **Rename**: IndexedDB namespaces become `yacana-pxe-<ns>` / `yacana-wallet-<ns>`; the old Elixir stores are orphaned (a different deployment anyway); localStorage `yacana.connection`, `yacana.settings`; the debug global `window.yacana`.

## Phases

Legend for gates: **fast** = `bun run lint && bun run --cwd <pkg> typecheck && bun test <pkg>` (typecheck/lint · unit); **components** = `bun run --cwd <pkg> test:components` (Vitest); **e2e** = `bun run e2e:agent -- bun run --cwd <pkg> test:e2e` (Playwright on the isolated network, production build by default). Every gate ends with exit 0.

### Arc 0 · rename

**P0.1 Protocol rename (crypto regenerates).** Rename `elixir.params.json → yacana.params.json` (tags `YACA/depl … YACA/lnch`, `GENESIS_SEED` = hex of `YACA/testnet` / `YACA/mainnet`, token `Yacana Testnet`/`tYACA`, `Yacana`/`YACA`); `scripts/params-codegen.ts` reads the new file and `YACANA_PROFILE`; crates `yacana_miner`, `yacana_spike`, `yacana_work`, `yacana_work_lib` (Nargo.toml names, workspace members, `use` paths); contracts `YacanaMiner`, `YacanaSpike` (+ 60 test references); artifact names and all 17 loaders (recon §1e); `bun run codegen` → `contracts:compile` + work-circuit compile → re-prove the fixture (`spike:determinism`) → `export-vk` → `pin-vectors` → `codegen` → `spike:manifest`. Fix the six tripwires (`tELX` regexes, `deployElixir → deployYacana`, `'Elixir','ELX'` in the two spike scripts, `window.elixir`).
Gate: `bun run codegen && git diff --exit-code && bun run contracts:compile && bun run contracts:test && bun test && bun run lint` — all exit 0; `vk-pinning.test.ts`, `vectors.test.ts`, `proof.test.ts` green on the new `W_VK_HASH`. Layers: lint · unit · contracts (TXE).

**P0.2 Names, env, storage, CI, docs.** Package names `@yacana/*` (+ `bun install` for the lockfile); env vars `YACANA_*`, `VITE_YACANA_*`; storage keys, IndexedDB namespaces, run-id prefix, tmpdir prefix; wrangler project name (deleted in arc 3 anyway, renamed now); CI path filters; `CLAUDE.md`, `README.md`, `docs/*`, `packages/*/README.md`, UI strings. `implementations-plan/elixir-core/*` stays as history (add one note at the top of its `context.md`).
Gate: `bun install --frozen-lockfile && bun run lint && bun run lint:actions && bun run lint:shell && bun test && bun run --cwd packages/web-miner typecheck && bun run test:components`; `grep -rIl 'elixir\|ELX' --exclude-dir=node_modules --exclude-dir=implementations-plan --exclude-dir=deployments --exclude-dir=.localnet .` returns only files listed in the phase's allow-list (docs/pitch, the elixir-core plan dir). Layers: lint · unit · component.

**P0.3 Testnet redeploy (owner-run, recorded).** The owner runs `AZTEC_NODE_URL=… YACANA_DEPLOYER_SECRET=… bun run deploy` (rotated secret recommended first), records `deployments/testnet.json` (the Elixir record is kept as `deployments/elixir-testnet-2026-09-04.json`), updates `docs/deployments.md` and `packages/web-miner/.env.production`; `bun run epoch:stats` output pasted into lessons as evidence.
Gate: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` (the existing suite on the renamed contracts) exit 0; `AZTEC_NODE_URL=… bun run epoch:stats` shows epoch 0 of the new deployment. Layers: e2e-isolated (+ owner evidence for testnet).

### Arc 1 · ui

**P1.1 Package + tokens + primitives.** Scaffold `packages/ui` (Vitest + jsdom + RTL; `tests/setup.ts`), `theme.css` (`@theme` tokens: ground/raised/panel/ink/ultraviolet/ok/warn/bad, radii, the type scale, `tabular-nums`), fonts via `@fontsource-variable/hanken-grotesk` and `@fontsource-variable/jetbrains-mono` (self-hosted, `font-src 'self'`), move the shadcn primitives from web-miner (drop `separator.tsx`, `card.tsx`), keep the hand-rolled `ThemeProvider` and drop `next-themes` (Sonner's theme comes from `useTheme`), `cn`. Workflow `ui.yml`.
Gate: `bun run lint && bun run --cwd packages/ui typecheck && bun run --cwd packages/ui test:components && bun run lint:actions`. Layers: lint · component.

**P1.2 Signature components.** `StatusPill`, `Mark`, `Stepper`, `Preflight`, `Marks`, `ProofLine` (★ ✓ ✗ ── grammar, virtualised to 200 lines), `EpochRail` (with `PowerSlider`), `ScoreLoop` (canvas; a pure `score-loop-model.ts` with the sample buffer, log axis and win flash, tested without a canvas; draw loop stops when hidden; reduced-motion still frame), `useTitleStatus`, `useFaviconStatus`. One Vitest spec per component: renders each state, roles/labels, keyboard where applicable; the model gets bun:test-style unit tests under Vitest.
Gate: `bun run --cwd packages/ui test:components && bun run --cwd packages/ui typecheck && bun run lint`. Layers: lint · component.

**P1.3 web-miner on ui (no redesign yet).** Replace `packages/web-miner/src/components/ui/*` with imports from `../../ui/src`, `index.css` imports `theme.css` + `@source`, delete duplicates; the current screens keep working.
Gate: fast(web-miner) + components(web-miner) + `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`. Layers: lint · component · e2e-isolated.

### Arc 2 · web-miner

**P2.1 Shell, routes, base path, cockpit.** `base: '/mine/'` (assets, `/mine/artifacts`, `/mine/crs`), the hand-rolled router (`/mine`, `/mine/wallet`, `/mine/settings`, `/mine/demo`), M1 layout on the existing data (loop, three numbers, ledger, rail, key tile), title/favicon, desktop-only screen (`matchMedia('(pointer: coarse) and (max-width: 900px)')` + `navigator.hardwareConcurrency < 4`), `window.yacana` test hooks. E2E: the existing mine → claim flow on the new test ids; desktop-only screen at a phone viewport.
Gate: fast + components + e2e. Layers: lint · unit · component · e2e-isolated.

**P2.2 Power, settings, behaviour.** `threads` message + Worker re-init; `yacana.settings` (power, pause on battery, background, resume on open, notify, sound, title status); Notification permission flow; PiP behind detection. Unit: settings reducer, threads clamp; E2E: change power → the header shows the new thread count and proving continues.
Gate: fast + components + e2e. Layers: lint · unit · component · e2e-isolated.

**P2.3 Key model + vault.** `keys/derive.ts` (HKDF labels, rejection sampling, index), `keys/phrase.ts`, `keys/passkey.ts`, `keys/vault.ts`, `wallet.ts` takes `DerivedKeys` and supports several accounts; pinned derivation vectors (bun:test, checked in); vault round-trip and tamper tests under Vitest with `fake-indexeddb`; phrase validation and the quiz model unit-tested.
Gate: `bun test packages/web-miner` + components + fast. Layers: lint · unit · component.

**P2.4 Key screens + first run.** Create (passkey card, consent, sync warning, twelve-words link), Backup (write-down gate, quiz), Recover (passkey first, phrase after the link, hostname banner, no clipboard reads), the nudge escalation, Preflight as the loader. E2E (`keys.e2e.ts`): virtual authenticator (CDP `WebAuthn.addVirtualAuthenticator` with `hasPrf: true`) create → mine → mint; twelve-word create → quiz → forget → restore → same address and balance; "ask on every open" round trip.
Gate: fast + components + e2e. Layers: lint · unit · component · e2e-isolated.

**P2.5 Win beats + failure states.** Stepper with the TTL countdown, Marks at the mint until the next proof, +4 count-up, reverted → paused key + rotation (index + 1), expired, node unreachable (pause after 60 s without a read, retry), prover dead. Reducer unit tests for every transition; E2E: node unreachable via route interception (existing pattern), rotation via the `window.yacana.simulateReverted()` hook (the controller path that reads `isDeliveryBlockedError` is exercised with a synthetic error, the on-chain race is not reproducible deterministically).
Gate: fast + components + e2e. Layers: lint · unit · component · e2e-isolated.

**P2.6 Wallet, withdraw, receive.** Wallet route; Withdraw sheet: Private (`transfer_private_to_private(from, to, amount, 0)`) default, Public (`transfer_private_to_public`), address validation (`AztecAddress.fromString`, non-zero, not self), recipient discoverability check (`node.getContract(to)`; if absent the sheet explains "the recipient's wallet must be registered with the network"), amount ≤ balance, review step; Receive shows the address with the linkability note. E2E (`withdraw.e2e.ts`): mint, then private withdraw to a second registered account (deployed in the test through the wallet), then public withdraw, `balance_of_public` read.
Gate: fast + components + e2e. Layers: lint · unit · component · e2e-isolated.

**P2.7 Demo route + docs.** `/mine/demo` (Worker-only boot, `proveOnce`, steps with measured times, score/bar/odds, `postMessage`), `packages/web-miner/README.md`, `docs/threat-model.md` rows (passkey/vault, demo Worker, withdraw), `docs/roadmap.md`. E2E (`demo.e2e.ts`): the route proves once and posts the message.
Gate: fast + components + e2e + `bun run lint:actions`. Layers: lint · component · e2e-isolated.

### Arc 3 · stats + site + deploy

**P3.1 Storage reader + slot table.** `miner-core/src/storage.ts`, `scripts/gen-slots.ts` (chunks under `packages/miner-core/generated/slots/`, gitignored, built by the apps' `prebuild`), `epoch-stats.ts` rewritten on the reader, `chain.ts` crossCheck deleted. bun:test: the generator matches `deriveStorageSlotInMap` for chunk 0 and a random chunk; the live suite (`bun run e2e:agent -- bun test packages/miner-core`) reads epoch 0 of a fresh deployment through the reader.
Gate: `bun test packages/miner-core packages/deploy && bun run lint && bun run e2e:agent -- bun test packages/miner-core`. Layers: lint · unit · e2e-isolated (live suite).

**P3.2 web-stats Observatory.** Scaffold (plain Vite config, `base: '/stats/'`), reader wiring with progressive rendering and "load older", six numbers, strip with URL selection and keyboard, detail card + sentence templates, four SVG charts (scale helpers unit-tested), table with CSV/JSON export, calculator sheet, "not here" block. Vitest: chart scales, sentence templates, calculator math, export formatting. Playwright (`stats.e2e.ts`): (a) mocked RPC from `fixtures/history.json` (deterministic numbers, strip selection, export), (b) live smoke on the isolated network (epoch 0, 0 claims). Workflow `web-stats.yml`.
Gate: fast + components + e2e + `bun run lint:actions`. Layers: lint · unit · component · e2e-isolated.

**P3.3 Verify page.** `/stats/verify`: addresses, class ids (`getContract`), `W_VK_HASH` from the build, constants, genesis + lottery from storage, source commit (`VITE_SOURCE_COMMIT` injected at build), reproduce command, "build it yourself" link. Vitest for the record formatting; E2E: the page renders the deployment of the run.
Gate: fast + components + e2e. Layers: lint · component · e2e-isolated.

**P3.4 Site assembler + deploy workflow.** `packages/site/build.ts`, `headers.ts` (origin block + `/mine/demo` block), `_redirects`, `wrangler.jsonc` (project `yacana`), `site.test.ts` (headers/redirects/CSP ↔ allowed origins; replaces `csp.test.ts`), `deploy-web.yml` (push to main, paths filter, `setup-bun` + `setup-aztec`, `codegen`, `contracts:compile`, work-circuit compile, `bun run --cwd packages/site build`, `wrangler pages deploy dist --project-name yacana --branch main` with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`; a manual `workflow_dispatch` input `branch` for previews), `site.yml` PR gate (assemble + `bun test packages/site`), root scripts (`test:components` glob, `site:build`). E2E (`site.e2e.ts`): `wrangler pages dev dist` on a registry port: `/`, `/mine`, `/stats` return 200 with the headers; `/mine/demo` has `frame-ancestors 'self'`.
Gate: `bun run --cwd packages/site build && bun test packages/site && bun run lint:actions && bun run e2e:agent -- bun run --cwd packages/site test:e2e`. Layers: lint · unit · e2e-isolated.

### Arc 4 · landing

**P4.1 Landing sections.** Scaffold (`base: '/'`), sections in order (bar, hero H3, money + table, chain, how, live strip via the reader, verify, ask + footer), mobile (no demo, "Send me the link" via `navigator.share` with a copy fallback, "Watch the stats"), OG image, `VITE_LAUNCH_MODE` (countdown, commitments, "Commit my entropy" deep link to the docs). Copy in `src/copy.ts` (one object; the copy deck is the test's source). Vitest: every section renders its copy; launch mode swaps the hero. Playwright (`landing.e2e.ts`): anchors, mobile viewport hides the demo and shows the share button, live strip with mocked RPC. Workflow `web-landing.yml`.
Gate: fast + components + e2e + `bun run lint:actions`. Layers: lint · component · e2e-isolated.

**P4.2 Demo panel + site integration.** `<iframe src="/mine/demo">` behind desktop detection with the click-to-load consent, `postMessage` → the loop adds the dot; the site assembler includes the landing; `site.e2e.ts` gains: landing → click "Prove one now" → iframe posts `yacana:proved` (the assembled dist under `wrangler pages dev`). Docs: `CLAUDE.md` package table + commands, `docs/roadmap.md`, `docs/threat-model.md` (landing rows), `implementations-plan/index.md`.
Gate: fast + components + `bun run --cwd packages/site build && bun run e2e:agent -- bun run --cwd packages/site test:e2e`. Layers: lint · component · e2e-isolated.

## Delivery

| arc | branch | phases | stacks on | code_review |
|---|---|---|---|---|
| 0 rename | `yacana-rename` | P0.1–P0.3 | main | off |
| 1 ui | `yacana-ui` | P1.1–P1.3 | 0 | off |
| 2 miner | `yacana-miner` | P2.1–P2.7 | 1 | off |
| 3 stats + site | `yacana-stats` | P3.1–P3.4 | 2 | off |
| 4 landing | `yacana-landing` | P4.1–P4.2 | 3 | off |

`gh stack init --adopt worktree-yacana-surfaces` renamed to `yacana-rename` at the start; `gh stack add <next>` at each boundary after that arc's codex loop; `gh stack submit --auto` only in Delivery; `gh stack merge` is the owner's.

## CI

- `ui.yml`, `web-stats.yml`, `web-landing.yml`, `site.yml`: the canonical `changes` job + `test` (lint, typecheck, components; `site.yml` assembles and runs `bun test packages/site`). Filters enumerate upstream deps: every app lists `packages/ui/**`; stats/landing list `packages/miner-core/src/**` and `yacana.params.json`; site lists all three apps.
- `web-miner.yml` adds `packages/ui/**`; `miner-core.yml` adds nothing new; `contracts.yml` keeps building web-miner and now also `bun run --cwd packages/site build` (the only job with artifacts).
- `deploy-web.yml`: `on: push: branches: [main]` with `paths:` for the five packages + miner-core + params + workflows; `permissions: contents: read`; secrets `CLOUDFLARE_API_TOKEN` (scoped to Cloudflare Pages: Edit on the account) and `CLOUDFLARE_ACCOUNT_ID`; `concurrency: deploy-web`; `workflow_dispatch` with `branch` input for a preview deploy. E2E stays local: it needs an isolated Aztec network and proving (8+ minutes on a laptop, more on hosted runners); a self-hosted runner is the way to add it later, noted in the roadmap.
- `actionlint.yml` unchanged; `bun run lint:actions` in every gate that touches workflows.

## Security & Adversarial Considerations

- **Threat model.** Attackers: a compromised host page (already stated on the page: it can redirect claims and spend the tab's key), XSS in any of the three apps, a malicious node (wastes work; never steals), a phisher of twelve-word phrases, a malicious extension, a lost/stolen device, a compromised npm dependency, a compromised CI token.
- **Keys.** Passkey PRF via `navigator.credentials` (no library), HKDF-SHA256 and AES-GCM-256 via WebCrypto, `@scure/bip39 ^2.4`; Schnorr keys via `@aztec/*` 5.2.0 only. Constants (`yacana.passkey.prf.v1`, KDF labels) are one-way doors pinned by test vectors. The vault key is non-extractable: script running in the origin can use it while the page is open, never export it; the "ask every open" mode keeps no seed at rest at all. Forgetting a key requires typing its last four characters.
- **Phrases.** Paste blocked on the quiz; no `clipboard.readText()`, no drag-drop on restore; hostname banner; no analytics anywhere; the phrase never touches localStorage; screen readers get the dotted placeholders, not the words, after the checkbox.
- **Frontend.** CSP unchanged in spirit (`script-src 'self' 'wasm-unsafe-eval'`, `connect-src 'self' data: <node>`), COOP/COEP origin-wide, `frame-ancestors 'none'` everywhere except `/mine/demo` (`'self'`), `X-Content-Type-Options`, no third-party requests; React escapes copy; the only `dangerouslySetInnerHTML` is none; the CSV export is a Blob, the OG image is static. Pasted addresses parsed by `AztecAddress.fromString` before use; the query-string node URL must be in the build's allowlist (existing check).
- **Withdraw.** Review step shows what will be public; public withdraw carries the amber warning; amount ≤ balance; the recipient discoverability check prevents a private transfer to an address whose keys the PXE cannot find.
- **Rename hazards.** New IndexedDB namespaces orphan Elixir-era stores (a different deployment anyway; nothing of value is lost); the RP ID is the apex hostname from `VITE_RP_ID`, and the plan refuses to create passkeys on `*.pages.dev` previews (create disabled unless `location.hostname === VITE_RP_ID`).
- **Supply chain / CI.** 7-day min-age, frozen lockfile, SHA-pinned actions, `permissions: contents: read`; the Cloudflare token is the only secret, scoped to Pages: Edit, used only by `deploy-web.yml` on `main`; previews are manual. `wrangler` pinned.
- **Demo Worker.** Boots without a wallet; inputs are the live seed/difficulty and a random secret; no user-chosen inputs; the iframe is same-origin and the parent only receives a number.

## Assumptions

**Facts** (verified): recon.md's file:line citations for the rename inventory and the reuse map; `poseidon2Hash` in the browser goes through `BarretenbergSync` (`node_modules/@aztec/foundation/dest/crypto/poseidon/index.js:5-12`); the token exposes `transfer_private_to_private`, `transfer_private_to_public`, `balance_of_public`, `total_supply` (artifact `token_contract-Token.json`, 5.2.0); `@fontsource-variable/hanken-grotesk` 5.3.0 and `@fontsource-variable/jetbrains-mono` 5.3.0 exist; `wrangler` 4.129.0, `fake-indexeddb` 6.2.5, `@scure/bip39` 2.4.0 on npm; bazaar's virtual-authenticator options work with PRF (`passkey-prf-spike.spec.ts`); the miner e2e already mocks RPC via route interception; `contracts.yml` is the only workflow with compiled artifacts.

**Inferences** (unverified): a Worker can `destroy()` and re-`init` bb.js with a different thread count without leaking memory; `transfer_private_to_private` to an external wallet needs that wallet's public keys discoverable via `node.getContract` (to verify in P2.6 with a spike); Cloudflare Pages `_headers` per-path blocks override the origin block for `frame-ancestors`; `wrangler pages dev dist` applies `_headers`/`_redirects` faithfully enough for the site E2E; the slot-table chunk count (512 chunks) stays under Pages' file limits; Document PiP exists in the owner's Chrome; `navigator.getBattery` is Chromium-only (accepted).

**Asks** (new, not already decided): (1) the production hostname to bake as `VITE_RP_ID` (placeholder `yacana.xyz` until then; passkey creation is disabled on previews); (2) whether the Elixir testnet deployment record is archived under a dated filename (proposed) or deleted; (3) the GitHub repo rename to `yacana` (out-of-band; redirects keep links working); (4) the Cloudflare account and `yacana` Pages project creation (owner action before P3.4's first deploy).

## Adversarial self-review

- The riskiest phase is P0.1: regenerating the VK and fixtures touches four embedded copies and three test suites; the order of operations must be followed exactly or tests pass against a stale fixture. Mitigation: the gate diffs `codegen` output and reruns everything.
- P2.3/P2.4 could over-engineer: indexed accounts + vault + two methods is a lot of surface; each piece has a single test that proves it.
- The slot table is a clever thing; if a chunk is missing the page must fall back to a visible "history unavailable" instead of a blank chart.
- The demo iframe could break on Safari (COEP + `SharedArrayBuffer` in iframes); desktop-only and Chromium-first, stated in the panel.
- Trusting: Cloudflare's per-path headers, WebAuthn PRF availability on the owner's platforms, bb.js re-init.

## Estimates

Arc 0: 2 agent-days (P0.1 dominates). Arc 1: 2. Arc 2: 6. Arc 3: 3. Arc 4: 2. Total ≈ 15 agent-days plus five codex loops.
