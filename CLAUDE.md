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
| `packages/miner-core` | Platform-agnostic TS: proof → fields → ticket digest, domain separators (retarget mirror, epoch reader, claim builder arrive in Phase 3) |
| `packages/deploy` | Spike drivers (`spike-claim.ts`, `spike-browser.ts` + the Vite page under `browser/`); sandbox / testnet deploy in later phases |
| `packages/web-miner` | React + Vite + Tailwind + shadcn miner: embedded wallet (IndexedDB), sponsored FPC, W proved by bb.js in a Worker, pinned CRS (`crs.lock.json`, served from `/crs`), Vitest specs, Playwright E2E on the isolated network, Cloudflare Pages config (`wrangler.jsonc`, `public/_headers`) |
| `scripts/run` | Run isolation: port registry, isolated local network, per-worktree runner |

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
bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e           # web miner in headless Chromium (production build; E2E_SERVER=dev for the dev server)
bun run test:components        # web-miner Vitest specs
AZTEC_NODE_URL=… YACANA_DEPLOYER_SECRET=… [YACANA_LAUNCH_AT=<unix s>] bun run deploy   # deploy the generated profile → deployments/<profile>.json (announce before launch_at)
AZTEC_NODE_URL=… bun run launch -- commit|reveal|open   # launch lottery of the recorded deployment (anyone; see docs/deployments.md)
AZTEC_NODE_URL=… bun run soak -- --hours 2 --epochs 24     # headless soak miner with a hashrate schedule
bun run epoch:stats            # epoch history of deployments/<profile>.json from public storage
bun run --cwd packages/web-miner dev | build   # both fetch the pinned CRS and copy the artifacts first
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
