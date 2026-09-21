# Recon: monorepo-layout

Base: `main` = `origin/main` = `06b25d7` (2026-09-20). Three read-only explorers plus the driver's own greps; every
count below was produced by a command, not estimated. Ignored throughout: `implementations-plan/`, `node_modules`,
`dist`, `dist-old`, `target`, `.localnet`.

## Reuse map

| Capability needed | Existing code | Verdict |
|---|---|---|
| Repo-wide guard that fails on forbidden source patterns | `scripts/rename-guard.test.ts`: enumerates `git ls-files`, two-tier exemptions (`EXEMPT_PATHS`, `EXEMPT_REFERENCES`), collects `path:line` offenders, one `expect(hits).toEqual([])`; a third test already parses every `package.json` and asserts a naming invariant | **adapt**: same skeleton, new test file for import boundaries. It must *resolve* each relative specifier to a path and compare package roots; a `../<name>/` regex false-positives on `web-miner/src/bridge/` (7 of the 25 "bridge" hits were intra-package) |
| Lint rule banning cross-package relative imports | `biome.json` (Biome 2.5.10): `recommended` + complexity budgets, no import restriction configured | **build new as a test, not a Biome rule**: the rule needs path resolution against workspace roots, which `noRestrictedImports` patterns cannot express without false positives (see above) |
| Codemod / bulk import rewriter | none. Searched: `scripts/`, every `packages/*/scripts`, all 13 `package.json` for `ts-morph` / `jscodeshift`; no file named `*codemod*` / `*rewrite*` | **build new**, throwaway (not committed): a Bun script that resolves each relative specifier and rewrites it when it leaves its package |
| Package entry points | `main: src/index.ts` on `miner-core` and `ui` only; **no `exports` anywhere**; `bridge` has neither | **build new**: `exports` on every imported package |
| Package-name imports | 36 `@yacana/*` specifiers already in use, all deep with `.ts` (`@yacana/bridge/src/portal.ts` ×7, `@yacana/miner-core/src/keys/derive.ts` ×3, …). They resolve only because no `exports` map exists | **adapt**: the new `exports` must keep these resolvable or the codemod rewrites them in the same commit |
| Shared repo-root / toolchain helper | `scripts/run/toolchain.ts` (`repoRoot`, pinned binaries) and a second one, `packages/work-circuit/scripts/toolchain.ts` (`repoRoot`, `workCircuitRoot`, `AZTEC_VERSION`, `BB`); 22 files recompute the root by depth | **reuse-as-is**: every move keeps depth, so the hops survive; only `scripts/run`'s own three change. A shared helper would have to live where production code may import it, which `tools/localnet` is not. What goes stale is the literal after the root, and a layout guard covers those |
| Spike measurements | `implementations-plan/elixir-core/spike-results.md` | **reuse-as-is**: the numbers outlive the scripts |

## Import surface (what the `exports` maps must cover)

Distinct files imported from outside their package (relative and `@yacana/` forms together):

| Target | Distinct | Shape |
|---|---|---|
| `miner-core` | 19 | 16 `src/*` files (`generated/params.ts` ×52, `reader.ts` ×48, `metrics.ts` ×18 …), `scripts/gen-slots.ts`, `fixtures/epochs.testnet.json` (also as `?raw`). Consumers import deep files even where the barrel re-exports the symbol; `keys/derive.ts` and `keys/mnemonic.ts` are not in the barrel |
| `bridge` | 18 | all `src/*.ts` (`journal.ts` ×26, `record.ts` ×15, `portal.ts` ×12 …) |
| `site` | 19 | 12 `src/browser/*` (incl. `vite-env.d.ts`), `src/config.ts`, `src/vite-base.ts`, 4 `scripts/*`, `crs.lock.json` |
| `deploy` | 12 | `src/deploy.ts` ×15, 9 `src/bridge/*`, `src/example-claim.ts`, `scripts/l1-deploy.ts`. All importers are tests, e2e setups, harness or scripts |
| `work-circuit` | 5 | `src/generated/vk.ts`, `src/generated/proof-layout.json` (spike-only consumer), `fixtures/vectors.json`, `fixtures/yacana_work/proof`, `scripts/toolchain.ts` |
| `ui` | 3 | `src/index.ts` ×86 (already a barrel), `src/mark.ts`, `src/bridge-types.ts` |
| `portal` | 2 | `abi/YACA.ts`, `abi/YacanaPortal.ts` (from `bridge`) |
| `web-miner` | 4 | `e2e/run.ts`, `e2e/build-env.ts` (harness), `src/routes.ts` (site), `src/pinned-crs.ts` (site's guard test) |
| `web-stats` | 1 | `src/routes.ts` (site) |
| root `scripts/` | 8 of `run/*` | `registry.ts` ×14, `toolchain.ts` ×10, `upgrade-rig.ts` ×9, `port-window.ts` ×7, `preview.ts` ×5, `presto.ts`, `isolated-node.ts`, `control.ts` ×2 each |

Declared `workspace:*` deps today: `bridge → miner-core`, `deploy → bridge`, `harness → bridge, deploy, miner-core`.
Undeclared but real: every `web-*` → `miner-core`, `bridge`, `ui`, `site`; `deploy → miner-core`; `bridge → portal`;
`site → ui`, `bridge`, `miner-core`, `web-miner`, `web-stats`; `contracts → work-circuit`, `deploy` (resolution base).

Non-TS and dynamic crossings (these never fail typecheck when a path goes stale):
`web-miner/src/pinned-crs.ts` and two tests → `site/crs.lock.json`; `deploy/src/deploy.ts:267` dynamic imports of
`miner-core/src/{reader,slots}.ts`; `web-stats/e2e/visual-setup.ts:175` dynamic import of `deploy/src/bridge/run.ts`;
`web-stats` and `web-landing` Vitest specs importing `?raw` JSON from `miner-core/fixtures` and `deployments/`;
four `web-miner` tests dynamically importing `site/src/browser/node-guard.ts`.

## Filesystem hops (break silently on a move)

- **Repo root by depth**: `resolve(import.meta.dir, '../../..')` or `'../../../..'` in 22 files (`deploy` ×13,
  `site` ×4, `miner-core` ×3, `work-circuit/scripts/toolchain.ts`, `scripts/run/{toolchain,presto,registry}.ts`).
  Depth is unchanged by a `packages/x → apps/x` move but changes for `scripts/run → tools/localnet/src`.
- **Literal `packages/<name>` after the root**: `miner-core/src/artifacts.ts:9-10` (production: the miner and work
  artifact paths), `deploy/src/deploy.ts:149`, `deploy/scripts/{launch,l1-deploy}.ts`, `site/scripts/commit-artifacts.ts`,
  `site/src/assemble.ts:153`, `site/src/vite-base.ts:26` (`packages/web-miner/src/shims`: the shared Vite base reaches
  into an app), `harness/tests/{browser,origin}.bun.test.ts`, `miner-core/scripts/pin-vectors.ts`,
  `scripts/params-codegen.ts` (8 output paths), `scripts/run/rig.ts:10`, `scripts/rename-guard.test.ts:86-89`.
- **Repo-relative string constants**: `web-*/e2e/run-setup.ts` and `web-stats/e2e/visual*.ts` name
  `packages/web-*/e2e/.record.json` and a Playwright config path as plain strings.
- **Sibling hops**: `miner-core` tests → `../../work-circuit/fixtures`; `web-miner` tests → `../../work-circuit`;
  `contracts/scripts/token-artifact.ts:11` uses `../../deploy` as an npm resolution base.

## Spikes (per file)

No workflow under `.github/` runs any `spike:*` script. No `*.test.ts` and no committed artifact references
`yacana_spike` or the sweep crates (`site/scripts/commit-artifacts.ts` hardcodes exactly the miner and work artifacts).

| File | Invoked by | Verdict |
|---|---|---|
| `work-circuit/scripts/export-vk.ts` | root `codegen` (every CI job that regenerates) | **keep**; delete only line 45, the write into `yacana_spike/src/vk.nr` |
| `work-circuit/scripts/layout-manifest.ts` (script name `spike:manifest`) | root `codegen`; output pinned by `src/proof-layout.test.ts` | **keep**, rename the script to `manifest` |
| `work-circuit/scripts/toolchain.ts` | every script in the directory | **keep** |
| `work-circuit/scripts/{determinism,mutation}.ts` | `spike:work` only | **keep**, renamed `check:determinism` / `check:mutation`: `docs/threat-model.md:23` names "determinism and mutation tests" as the evidence against ticket grinding, and they are the only way to re-establish it after a `bb` bump. `mutation.ts:74` takes its wrong VK from `sweep_1024`; it needs another valid VK (`verify_w` is a `bin` crate in the same workspace) |
| `work-circuit/scripts/{sweep,ticket-cost,wasm-prove}.ts` | `spike:work` only; performance measurements, scratch output | **delete** (numbers live in `spike-results.md`) |
| `work-circuit/scripts/proof-shape.ts` | nothing (no script entry) | **delete** |
| `work-circuit/crates/sweep_{1024,4096}` | Nargo members, compiled on every `codegen`; used by `sweep.ts` and `mutation.ts:74` | **delete** |
| `contracts/yacana_spike/`, `contracts/scripts/gates.ts` | `spike:gates`; member of `contracts/Nargo.toml` | **delete** |
| `deploy/scripts/spike-{claim,browser}.ts`, `deploy/browser/`, `deploy/vite.config.ts` | `spike:claim`, `spike:browser` | **delete**, with `deploy`'s three devDependencies (`vite`, `playwright`, `vite-plugin-node-polyfills`): their only importers are `spike-browser.ts` and `vite.config.ts` |
| `contracts/scripts/token-artifact.ts` | `contracts` `pretest` | **keep** (not spike) |

The web miner's canary shard does not replace `mutation.ts`: the canary tampers a bound public input of the claim,
`mutation.ts` flips each of the proof's 410 fields natively. Different properties.

Blast radius beyond the files: `contracts/Nargo.toml` and `work-circuit/Nargo.toml` member lists, root and
per-package `spike:*` script entries, `.gitignore:12`, the `contracts` / `work-circuit` / `deploy` rows and four
command lines of `CLAUDE.md`, and `proof-layout.json` loses its only cross-package consumer.

## The move: what encodes a location

Every planned move keeps directory depth (`packages/x` → `apps/x`), so a root-by-depth hop survives unless the file
is in `scripts/run` (depth 2 → 3 as `tools/localnet/src`) or names a sibling that lands under a different parent.

### Fails silently (no red anywhere)

| # | Reference | What happens after a naive move |
|---|---|---|
| 1 | Root `tsconfig.json` `include: packages/*/{src,scripts,e2e,tests}` | `bun run typecheck` (the filter-free gate of `miner-core.yml`) keeps passing while covering 3 of 12 packages |
| 2 | `.github/workflows/*.yml` filters handed to `_changes.yml` (10 workflows, 60+ globs, several single-file) | `dorny/paths-filter` returns `false` on a glob that matches nothing: the gate stops firing and CI stays green |
| 3 | `bun run --filter './packages/*' test:components` / `test:e2e` | runs on whatever still matches; the three apps and `site` drop out |
| 4 | `sort-package-json --check 'packages/*/package.json'` inside `bun run lint` | checks 3 manifests instead of 12 |
| 5 | `scripts/run/toolchain.ts:24-34` `toolchainBin` | a wrong `repoRoot` cannot read `.aztecrc`, the `catch` swallows it, and every caller runs whatever `aztec` / `bb` / `forge` is on `PATH`: the pinned, hash-checked toolchain is off without a word |
| 6 | `scripts/run/registry.ts:11` fallback agents dir | used when `~/.agents` is absent (CI): the port registry lands in a different `.localnet` than the run data |
| 7 | `scripts/rename-guard.test.ts:75` (manifest regex) and `:86-89` (`COPY_ROOTS`) | both guards pass over an empty file list |
| 8 | `.gitignore`: 42 of 43 `packages/…` lines | `dist/`, run state, Playwright reports, pinned CRS bytes and slot chunks become committable under the new paths |
| 9 | `biome.json` `!packages/{portal/abi,contracts/artifacts,work-circuit/artifacts}` | generated JSON is linted, and `lint:fix` can reformat a committed artifact that `artifacts:commit && git diff --exit-code` catches much later |
| 10 | `packages/portal/foundry.toml:12` `fs_permissions … ../bridge/fixtures/bridge-vectors.json` | denied read, seen only when `portal:test` next runs |
| 11 | `scripts/run/typecheck-all.sh` package list | referenced by nothing (no script, no workflow, no doc): dead, delete |

### Fails loudly (module not found, ENOENT, non-zero exit)

- Root `package.json`: `workspaces`, 18 `--cwd packages/x` / `bun packages/x/…` scripts, `e2e:agent`, `rig`, `lint:shell`.
- CI: literal `bun test packages/…` arguments (`miner-core.yml:28`, `work-circuit.yml:48`, `deploy.yml:42`, `site.yml:48`,
  `web-stats.yml:52,54`, `web-landing.yml:49`), `--cwd packages/x typecheck` in five workflows, `bun test scripts/run/toolchain.test.ts`
  in three, the `e2e.yml` artifact paths and shard file, `portal.yml:47` ABI diff path, `.github/actions/setup-presto/action.yml:12`.
- Cross-parent hops: the three apps' `scripts/prebuild.ts` → `../../site/scripts/*`; `site/src/assemble.ts` (routes types,
  `resolve(repo, 'packages', name)`, `og.png`); `site/src/vite-base.ts:26`; `site/scripts/commit-artifacts.ts`;
  `contracts/scripts/token-artifact.ts:11` (`../../deploy`); `scripts/params-codegen.ts`; `scripts/render-{e2e,surfaces}.ts`;
  `scripts/run/rig.ts:9-10`; `scripts/run/upgrade-rig.ts:339` (names its own `pinned-node.mjs`); `scripts/run/agent.sh:6`;
  `scripts/run/toolchain.test.ts:9` (`../../toolchain.lock.json`); every `../../../scripts/run/*` import.
- Same-parent hops that survive: `harness → deploy` (both to `tools/`), `contracts → work-circuit` including the three
  Nargo path deps `../../work-circuit/crates/lib` (both to `protocol/`), `portal/foundry.toml` `libs = ['../../node_modules']`.

Committed artifacts carry no paths: `commit-artifacts.ts` empties `file_map` and `debug_symbols` before writing, the
portal ABI is pure ABI, `web-miner/e2e/replay/recording.json` has zero `packages/` occurrences. Only the scripts that
locate them move.

### `scripts/run` as a package

Not a workspace member, no manifest. `upgrade-rig.ts` imports 25+ `@aztec/*` subpaths plus `viem`, all resolved only
through hoisting; `harness` declares nearly the same list. `pinned-node.mjs` resolves against the pinned toolchain's
own `node_modules` and carries no repo path. `registry.test.ts` and `toolchain.test.ts` are found by bare `bun test`.

## Typecheck today

- Root `tsc -p tsconfig.json` covers every package's `src`/`scripts`/`e2e`/`tests` **except** the React sources
  (`ui/src`, `web-*/src`, `web-miner/tests`), which need `vite/client` types instead of `bun`.
- `site` and `ui`: own `tsconfig.json`, `tsc -p`. The three apps: solution file with `references` to
  `tsconfig.app.json` / `tsconfig.node.json` (+ `tsconfig.tests.json` in `web-miner`), `tsc -b`, `noEmit`, no `composite`.
- `web-miner/tsconfig.tests.json` includes `../site/src/browser/vite-env.d.ts` by path.
- CI: root typecheck in `miner-core.yml` on every PR; `--cwd packages/<x> typecheck` in `site`, `ui`, `web-*` workflows.
- `node_modules/@yacana/` already holds a symlink for all 12 packages, declared or not (hoisted linker), so a
  package-name import resolves today from anywhere.

## `packages/site` anatomy (the split)

| File | Imported from outside `site` by | Reaches out to | Goes to |
|---|---|---|---|
| `src/config.ts` | all three apps (7 files; `web-miner/src/wallet.ts` takes a value, the rest types) | `bridge/src/record.ts` (types) | **web-kit** |
| `src/vite-base.ts` (`siteVite`) | the three `vite.config.ts` | `ui/src/mark.ts`; `packages/web-miner/src/shims` by path (`:26`, prover branch only) | **web-kit**, with the `detect-node` shim it aliases |
| `src/headers.ts` | nobody by name; `vite-base.ts`, `assemble.ts`, `artifact.ts` in-package | none | **web-kit** (ships in every app through `siteVite`'s `emitHeaders`); the assembler imports it from there |
| `src/browser/*` (13 files) | 11 to 25 files each across the apps | `miner-core/src/reader.ts` from `node.ts` and `slots.ts` | **web-kit** |
| `scripts/{fetch-crs,copy-artifacts,copy-slots,commit-artifacts}.ts`, `crs.lock.json` | the apps' `prebuild.ts`; `web-miner/src/pinned-crs.ts` and two tests (the lock); `web-miner/e2e/replay/setup.ts` (`COMMITTED`); root `artifacts:commit`; `web-miner.yml` (CLI) | `miner-core/scripts/gen-slots.ts`, `miner-core/src/{reader,slots}.ts`; literal `packages/{contracts,work-circuit}/{artifacts,target}` | **web-kit** |
| `site.env` | `vite-base.ts:61`, `config.test.ts:14`; named in `docs/deployments.md`, `docs/upgrades.md`, `web-miner/README.md` | none | **web-kit**, beside `config.ts` that parses it (leaving it in the assembler makes a `packages → apps` file hop) |
| `src/assemble.ts`, `src/artifact.ts` | nobody | `import type { Route }` from `web-miner/src/routes.ts` and `web-stats/src/routes.ts`; `vite build` with `cwd: packages/<app>`; `packages/web-landing/public/og.png` | **site** (assembler) |
| `e2e/*`, `playwright.config.ts`, `wrangler.jsonc`, `www/`, `v5/` | nobody | `deploy/src/deploy.ts`, `scripts/run/{registry,port-window}.ts` from `e2e/run-setup.ts` | **site** |

After the split the back-edge disappears: apps → web-kit → {miner-core, bridge, ui}; site → apps (types, build) and
→ web-kit. `site → apps` is the direction an assembler should have.

## Resolution mechanics (`siteVite`)

- `server.fs.allow: [repo]` (`vite-base.ts:160`), no `preserveSymlinks`: a workspace symlink resolves to its real
  path under the repo, is served, and is treated as source, not pre-bundled. `optimizeDeps` include/exclude name only
  `@aztec/*` and their CJS shims. `resolve.alias`: `@` → the app's `src`; `detect-node` → the shim (prover apps);
  `@aztec/bb.js` and three Noir packages → `browser/no-prover.ts` (non-prover apps). None of it keys on `@yacana/*`.
- Vitest configs (`ui`, `web-miner`, `web-stats`, `web-landing`): jsdom, no `server.deps.inline`. Vitest externalizes
  by resolved path containing `node_modules`; workspace symlinks resolve outside it. **Unverified here**: must be shown
  on one spec before the codemod runs.
- `deploy/vite.config.ts` duplicates `siteVite`'s prover branch by hand; it dies with the spikes.
- Playwright setups shell out to `bun` for anything that touches repo modules; their configs resolve nothing.

## Corrections to the explorers

- "`miner-core` never imports `deploy`": wrong. `miner-core/src/live.test.ts:19-20` and `reader.live.test.ts:8`
  import `deploy/src/{deploy,example-claim}.ts`; both are `describe.skipIf(!AZTEC_NODE_URL)` and no workflow runs them.
- "`node_modules` does not exist": it did not in the explorers' checkout; in the worktree all 12 `@yacana/*` symlinks exist.
- "No Nargo path dep leaves its package": wrong. Three `contracts` crates depend on `../../work-circuit/crates/lib`;
  the hop survives because both packages go to `protocol/`.
- The `miner-core` barrel (`src/index.ts`) has no importer outside the package.

## External configuration (outside the repo)

`docs/deployments.md:99-104`: Cloudflare Workers Builds holds **root directory `packages/site`**, build command
`bun install --frozen-lockfile && bun run build`, deploy command `npx wrangler deploy`, on two triggers of the apex
Worker (the settings page edits only the production one; the other goes through the API). Moving `site` to
`apps/site` fails every push-triggered build until the owner edits both. The live Worker keeps serving the last
deploy. The build settings of the `yacana-v5` and `www` Workers are not documented in the repo.
