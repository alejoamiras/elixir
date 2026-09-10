# yacana

Privately mineable token on Aztec whose mining work is Barretenberg proving: a miner proves a fixed Noir circuit per
nonce, the ticket is Poseidon2 over the whole UltraHonk proof, a ticket below the target wins, and the winner claims
through a private Aztec transaction that verifies the proof in-circuit and mints privately. Bitcoin-style difficulty:
epochs close after `N` accepted claims and the target rescales by actual/expected time, clamped to [¼, 4].

**Plan**: `implementations-plan/elixir-core/plan.md` (§2 mechanism, §4 security, §6 phases with gates, §9
post-implementation). Hand-off: `implementations-plan/elixir-core/context.md`. Lessons: `implementations-plan/elixir-core/lessons/`.
Phase 1 measurements: `implementations-plan/elixir-core/spike-results.md`.

## Packages (Bun workspace)

| Package | Owns |
|---|---|
| `packages/contracts` | Aztec contracts (Nargo workspace): `yacana_miner` and the Phase 1 spike contract `yacana_spike`; aztec-standards token as a git dep (`v5.2.0`) |
| `packages/work-circuit` | Noir work circuit `W` (`crates/lib` + `crates/yacana_work`), the VK-embedding verifier `crates/verify_w`, generated VK / proof-layout manifest, fixture proofs, spike scripts |
| `packages/miner-core` | Platform-agnostic TS: proof → fields → ticket digest, domain separators, retarget mirror, claim builder, key derivation, `reader.ts` (node-only storage reads through the slot table), `metrics.ts`, `csv.ts`; `scripts/gen-slots.ts`; `fixtures/` (captured epoch histories) |
| `packages/deploy` | Spike drivers (`spike-claim.ts`, `spike-browser.ts` + the Vite page under `browser/`); sandbox / testnet deploy in later phases |
| `packages/site` | What the apps share below the components: `src/config.ts` (one env source of truth: `site.env` + `deployments/<profile>.json` → Vite `define`, the production guards), `src/headers.ts` (CSP/COOP/COEP per environment), `src/vite-base.ts` (`siteVite`), `src/browser/{connection,node,node-guard,format,slots}.ts` (the page-side connection config, the node as a setting: URL rules, the probe, the switchable client; the fetch guard every context installs first — same origin, the node in use and a candidate under check pass, everything else throws; formatting; the slot-table and layout fetches), `src/assemble.ts` (the three apps into one origin: `dist/{,mine,stats}`, the shared assets once at the root, `_headers`, `_redirects`, `build.json`; production guards), `scripts/{fetch-crs,copy-artifacts,copy-slots,commit-artifacts}.ts`, `crs.lock.json`, `wrangler.jsonc` (the Worker: custom domain, assets directory, SPA fallback), `www/` (the www → apex redirect Worker), the assembled-site E2E under `wrangler dev` |
| `packages/ui` | Design system shared by the surfaces: `theme.css` (tokens, dark default + `.light`, self-hosted Hanken Grotesk / JetBrains Mono), shadcn-style primitives, StatusPill, Kpi, Mark + `faviconDataUrl`, ScoreLoop, ProofLedger, Stepper, Preflight, EpochRail, PowerSlider, Marks, ThemeProvider; Vitest specs (`*.vitest.tsx`) |
| `packages/web-miner` | React + Vite miner on `packages/ui`: embedded wallet (IndexedDB), sponsored FPC, W proved by bb.js in a Worker — or through Presto, the visitor's native prover (`presto.ts`: the endpoint per mode, the probe at cockpit-ready, the fix-it copy; `presto-prover.ts`: the prover that falls back to WASM inside itself and verifies a native win against the job's own inputs; `features/PrestoBanner.tsx`: Presto's billboard when absent, the miner's row when in the way; the ✦ suffix, `native` and the dimmed slider follow what actually proved), pinned CRS (`crs.lock.json`, served from `/crs`), Vitest specs, Playwright E2E on the isolated network (a headless Presto beside it when installed); ships at `/mine/` of the assembled site (`wrangler.jsonc` for local `wrangler dev` parity only) |
| `packages/web-stats` | Observatory + Verify (`/stats`, `/stats/verify`): the page reads in two beats (`beats.ts`: the fixed slots, then a 48-epoch window; every tile has a skeleton), the strip's window from `?from=` (`window.ts`) over a map of every epoch (`map-geometry.ts`, `features/EpochMap.tsx`), the map filled in the background one page per poll (`history-fill.ts`) and carried between visits by a validated, capped `localStorage` cache (`history-cache.ts`), four Observable Plot charts, the table with CSV/JSON, the calculator, the deployment record; Vitest specs, the screenshot gate (`test:visual`, pinned Playwright image), Playwright E2E (a mocked node on the captured fixture + the live isolated deployment) |
| `packages/web-landing` | The landing (`/`): seven sections from the copy deck (`src/copy.ts`), the live strip through the reader, the in-page demo proof (the miner's `src/demo/demo.worker.ts`, fetched on the click), `VITE_LAUNCH_MODE` hero, the OG card (`public/og.html` → `og.png` via `bun run og-card`); Vitest specs, Playwright E2E on the isolated network |
| `scripts/run` | Run isolation: port registry, isolated local network, per-worktree runner; `presto.ts` (a headless Presto for one run: registry port, per-run `PRESTO_HOME`, the lock-pinned native `bb`, `AZTEC_BB_VERSION`, SIGTERM first) and `install-presto-server.sh` (the pinned release by committed digest) |

## Toolchain

- **Aztec 5.2.0 only** (`.aztecrc`): `aztec-nargo` (Noir 1.0.0-beta.25), `aztec compile` (transpiles public bytecode
  and writes Chonk VKs — plain `aztec-nargo compile` is not enough for contracts), `aztec-txe`, `bb` from
  `~/.aztec/versions/5.2.0`. Never bare `nargo`. `bb --version` prints `5.2.0-nightly.20260807` for this release.
- **Bun ≥ 1.4** for everything (PM, runtime, `bun:test`). Biome lints and formats. Vitest only for React components.
- Supply chain: `bunfig.toml` enforces a 7-day npm min-age; the linker is **hoisted** (Vite's pre-bundler cannot
  resolve the aztec packages' transitive imports under the isolated layout); CI installs with a frozen lockfile;
  GitHub Actions are pinned by commit SHA.

## Commands

```
bun run lint           # biome + sort-package-json --check
bun run lint:fix
bun run lint:shell     # shellcheck on scripts/run/*.sh and hooks
bun run lint:actions   # actionlint
bun test               # all bun:test suites (packages + scripts)
bun run contracts:compile / contracts:test
bun run e2e:agent -- <cmd>   # run <cmd> against a fresh isolated local network (AZTEC_NODE_URL set)
bun run e2e:agent -- bun test packages/miner-core                        # live miner-core suite
bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e           # web miner in headless Chromium (production build; E2E_SERVER=dev for the dev server); with presto-server installed the run gets a headless Presto and presto.e2e.ts runs; every run ends with a breakdown (rig, per spec, browser proving from the prover's console events) in e2e/.breakdown.json
E2E_SHARD=cockpit bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e   # one shard of e2e/shards.json (CI runs them as a matrix); the shard must execute exactly its files' inventory (e2e/proof-inventory.ts)
E2E_PROVERLESS=1 E2E_SHARD=cockpit …                                     # the shard on a build whose PXE skips transaction proving (CI does this for every shard but `canary`); the meter then fails any test that proves
E2E_SHARD=canary bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e    # the real-proving canary: a claim with a bound public input altered is refused at proving, the untampered one mints
E2E_DELAY_SENDTX_MS=20000 …                                              # hold every aztec_sendTx: the breakdown's submission column must rise while proving stays put
bun run --cwd packages/web-miner test:replay                             # the signed-out tests against e2e/replay/recording.json, no node (the PR lane); re-record after the miner artifact, the layouts or the SDK move: bun run e2e:agent -- bun packages/web-miner/e2e/replay/setup.ts record
bash scripts/run/install-presto-server.sh   # the pinned headless Presto (1.1.1, digest committed) into ~/.local/bin; PRESTO_URL=http://127.0.0.1:<port> bun test packages/web-miner/tests/presto-live.bun.test.ts against one you started
bun run test:components        # every package's Vitest specs (ui, web-miner, web-stats, web-landing)
bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e          # stats page in headless Chromium (production build)
bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e        # landing in headless Chromium: the demo proves W for real
bun run artifacts:commit       # refresh the committed miner + work-circuit artifacts from target/ (CI diffs them)
bun run site:build             # assemble the production site into packages/site/dist (Cloudflare's build command)
bun run e2e:agent -- bun run site:e2e   # the assembled site under wrangler dev: paths, headers, build.json, the demo
bun run site:deploy            # assemble the production site and `wrangler deploy` it (needs a Cloudflare login)
AZTEC_NODE_URL=… YACANA_DEPLOYER_SECRET=… [YACANA_LAUNCH_AT=<unix s>] bun run deploy   # deploy the generated profile → deployments/<profile>.json (announce before launch_at)
AZTEC_NODE_URL=… bun run launch -- commit|reveal|open   # launch lottery of the recorded deployment (anyone; see docs/deployments.md)
AZTEC_NODE_URL=… bun run soak -- --hours 2 --epochs 24     # headless soak miner with a hashrate schedule
bun run epoch:stats            # epoch history of deployments/<profile>.json from public storage (--json <file> keeps the rows)
bun packages/miner-core/scripts/gen-slots.ts   # the slot table the stats/landing read path fetches (packages/miner-core/generated/slots, gitignored)
bun run --cwd packages/web-miner dev | build   # both run scripts/prebuild.ts first (pinned CRS, artifacts, slot table)
bun scripts/run/isolated-node.ts --smoke
bun run spike:work     # W sweep, determinism, WASM, manifest, mutation, ticket-cost (needs compiled work-circuit)
bun run spike:gates    # Chonk gate counts of the spike contract's private functions
BB_VERBOSE=1 LOG_LEVEL=verbose bun run spike:claim   # real claim tx on an isolated local network
bun run spike:browser  # same claim proved in headless Chromium
```

## Conventions

- Complexity budgets (Biome, error level): cognitive ≤ 15 everywhere; ≤ 80 non-blank lines per production
  function. Never suppress complexity rules in new code.
- Run isolation: never hardcode ports, never kill by name. Ports come from `~/.agents/ports.md` via
  `scripts/run/registry.ts`; services run detached in their own process group; teardown kills only owned groups.
  Data dirs live under `.localnet/` (real disk, gitignored). A sandbox on 8080 belongs to someone else.
- Long local runs (spikes, e2e) go in `tmux`; they die with the agent shell otherwise.
- Proof validity is only checked by real proving: the ACVM (nargo test, TXE, PXE simulation) accepts any bytes in
  the recursion black box. Tests about proofs must prove.
- Comments say what the code cannot; no references to plans, phases or reviews in code.
- Conventional commits (commitlint), signed. Feature branches only; PRs open only at the Delivery step of plan §9.
- Tests: the smallest set that proves the behaviour and catches the expected failures. External-system code gets one
  real-data integration test under `describe.skipIf(!ENV)`.
- The owner's global `~/.claude/CLAUDE.md` and the `my-stack`, `run-isolation`, `blueprint` skills apply.
