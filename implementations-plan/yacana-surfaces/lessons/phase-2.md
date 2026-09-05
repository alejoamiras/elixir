# Lessons — arc 2 (miner)

## P2.1 Site tooling + M1 shell (2026-09-05)

**Result:** ✓. `packages/site` (`site.env` = node, allowlist, `VITE_RP_ID=yacana.network`; `config.ts` merges it with
`deployments/<profile>.json`, production ignores the process env, e2e/dev may override every value; `headers.ts` renders
the one policy for dev / preview / production; `vite-base.ts` = shared bb.js-aware Vite config with `define`, the
rendered headers on both servers and an emitted `_headers` in every build output; `scripts/{fetch-crs,copy-artifacts}.ts
<public dir>` + `crs.lock.json` moved here; wrangler 4.127.1 exact (4.129.0 is younger than 7 days)). The web miner:
`vite.config.ts` is three lines; `.env.production`, `public/_headers`, `csp.test.ts` deleted; `config.ts` drops the
cross-check and honours `?node=&miner=&token=` only when the build set the e2e flag AND the host is `localhost`; the node
is the only user-editable connection value; `chain.ts`/`controller.ts` lose the cross-check; `boot.ts` runs
`assertDeployment` (new `miner-core/src/reader.ts`: chain id, rollup version, both instances + classes, the miner's
bound `token` slot); routes on `history` + `popstate` (`/mine`, `/mine/wallet`, `/mine/settings`, base-aware); the shell
(brand mark, nav, testnet badge, one StatusPill); host rules (alias → redirect, preview / unknown → banner, keys only on
the RP host or localhost in non-production builds); desktop-only screen (`< 900 px` or coarse pointer without SAB);
`tab-status.ts` (title `▸ · 18/min · 2/4 · Yacana`, SVG favicon per mark state).

- **RP ID spike (Playwright + CDP virtual authenticator, ctap2_1 + PRF):** `127.0.0.1` → `SecurityError: This is an
  invalid domain`; `localhost` → credential created, `prf.enabled=true`, 32-byte result. E2E servers bind `localhost`
  and the e2e build sets `VITE_RP_ID=localhost`.
- **`style-src` audit:** Radix sets inline `style` attributes and Sonner injects a `<style>` element, so
  `style-src 'self'` + `style-src-attr 'unsafe-inline'` would break the toaster. `'unsafe-inline'` stays, documented in
  `headers.ts`.
- `host.ts` must read `import.meta.env.VITE_RP_ID` per call, not at module load, or `vi.stubEnv` cannot vary it (and a
  `define`d constant hoisted into a module-level const is the same value anyway).
- The malformed-RPC spec now points the page at the mock origin through `?node=` (allowlisted by the e2e build); the
  four cross-check specs are gone with the feature. The miner-core live test deploys two throwaway instances and
  checks that every drift (chain, rollup, class, foreign miner, foreign token) is refused: 71 s on the isolated network.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · site + web-miner `typecheck` ✓ · `bun test` 61 ✓ · `test:components` 15 + 27 ✓ · E(web-miner) 4 passed (2.9 min) ✓ · plus `e2e:agent -- bun test packages/miner-core/src/reader.live.test.ts` 1 pass.

## P2.2 Cockpit, power, settings (2026-09-05)

**Result:** ✓. `miner-core/src/metrics.ts` (score, difficulty, proofsPerMinute over 20, nextWinSeconds, closePreview,
escapeHatchIn; `difficulty`/`expectedSecondsToWin` left `format.ts`), the Worker reports `score` + `win` per attempt and
takes `reconfigure`; its scheduling is now `prover-loop.ts` (pure, backend injected) so the resume rule is unit-tested:
finish the proof in flight → destroy + init → the same job continues at `nextNonce` with the same secret; a `stop`
during a reconfigure rebuilds without resuming; an idle reconfigure rebuilds at once and a job arriving meanwhile
waits. The reducer carries score/best/samples/winAt/ledger (200 lines, ★ ✓ ✗ ── grammar with clocked events).
Cockpit = LoopTile (pill, per-proof time, Start/Stop, ScoreLoop, the three numbers), RailTile (EpochRail with the
close preview / hatch rows and the PowerSlider), LedgerTile, the key tile; Settings = Performance / Behaviour /
Appearance / About / Network in `yacana.settings`; hotkeys Space · [ ] · w · ,; battery and hidden-tab pauses with
auto-resume; resume on open.

- **The memory gate must not include a claim.** On the easy E2E target a claim proof (ClientIVC in the PXE, ≈ 2 GB)
  lands between reconfigures; the first run showed +690 MiB and would have condemned the in-place rebuild. `run-setup`
  now deploys a second instance at an impossible target (`1 << 64`) and the spec pins the page to it: three rebuilds
  (5 → 1 → 11 threads) grew the process tree by **221 MiB** (1402 → 1623), under the 300 MiB gate, so the in-place
  `reconfigure` stays (no respawn fallback).
- `bb.js` does not export its `package.json`; the version is a `define` (`VITE_BB_VERSION`) read by the site config.
- A mapped "boolean keys of Settings" type picks up `undefined` from the optional `threads`; an explicit `BOOLEANS`
  tuple is the honest type.
- `low128 < target` is `score > difficulty`, not `≥`; the reducer takes the Worker's `win` flag instead of comparing
  floats.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `typecheck` ✓ · `bun test` 69 ✓ · `test:components` 20 + 27 ✓ · E(web-miner) 5 passed (4.9 min; the new spec: three reconfigures, ledger grows, RSS +221 MiB) ✓.

## P2.3 Passkey keys + vault (2026-09-05)

**Result:** ✓. `miner-core/src/keys/derive.ts` (HKDF-SHA256 with the versioned labels; `masterFromPrf` 32 B in, 32 B out;
`deriveAccountFields(master, index)` 64 B per label → `fromBufferReduce`) and `keys/mnemonic.ts` (`@scure/bip39` 2.3.0
exact, NFKD-normalised, `masterFromMnemonic`), pinned by golden vectors including the **addresses** (computed offline
with `getSchnorrInitializerlessAccountContractAddress`, `@aztec/accounts`): PRF `00..1f` → account 0
`0x1362161b…474b`, account 1 `0x02979e13…0ba9`; the bip39 test phrase → `0x1d344823…ebc1`. `web-miner/src/keys/passkey.ts`
(every ceremony invariant, PRF input hashed at import, create→get fallback, `NoPrfError`), `keys/store.ts` (the vault:
records + a non-extractable AES-GCM device key in `yacana-keys`; AAD `yacana-key:v:method:id`; every open re-derives
account 0 and fails closed), `wallet/memory-store.ts` (an `AztecAsyncKVStore` for the WalletDB, run against the kv-store
package's own `describeAztecMap` suite + a WalletDB lifecycle test), `wallet.ts` around supplied fields, `session.ts`
(create / open / restore / stay-open), the key screen (card, consent, sync warning, Welcome back with one touch),
`boot.ts` split into preflight (evidence rows) → key → session.

- **The kv-store map suite is bun-only** (jest globals, not exported from the package barrel — imported by path) and the
  vault spec needs bb.js's Grumpkin for the address check, which throws `std::bad_cast` under jsdom. Both live in
  `packages/web-miner/tests/*.bun.test.ts`: bun runs them (WebCrypto + `fake-indexeddb`), Vitest excludes `*.bun.test.ts`,
  and the root `tsconfig` now includes `packages/*/tests` so they type-check with bun types. The plan said Vitest for the
  vault; the substance (WebCrypto, fake IndexedDB, AAD/IV/mode assertions) is identical.
- **LMDB range semantics**: forward `[start, end)`, reverse `(start, end]` descending — the suite pins it.
- **Chromium allows one internal virtual authenticator per environment**; the E2E helper returns the one it made so a spec
  can clear its credentials instead of adding another. A reload on `/mine/settings` reopens on the settings route, so
  the convenience-mode reopen navigates to Mine before reading the key tile.
- At rest after a first passkey boot (asserted by the E2E from inside the page): one record with `askEveryOpen: true`,
  no `sealed`, the only 32-byte hex in it is the address; no `yacana-wallet-*` database; the `yacana-pxe-*` store exists.
  Convenience mode seals the master and opens with the authenticator removed; switching back deletes the ciphertext.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `typecheck` ✓ · `bun test` 97 ✓ · `test:components` 24 + 27 ✓ · E(web-miner) 7 passed (5.5 min: miner ×5 through the passkey key screen, `passkey.e2e.ts` ×2) ✓.
