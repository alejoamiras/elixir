---
plan: monorepo-layout
tier: mid
driver: claude-code
eli5_mode: artifact
eli5_url: https://claude.ai/artifact/E2ARW8TwPLCVUguswbyQAM
eli5_source: implementations-plan/monorepo-layout/eli5.html
code_review: off
budget: recon 3 explorers; codex at high; one fable Plan subagent; fix loop hard stop at 3 rounds
validation: fast layers every phase, heavy layers at arc ends
decisions: resolved with codex inside plan scope; hard limits stay hard
baseline: 06b25d7
worktree: .claude/worktrees/monorepo-layout (branch worktree-monorepo-layout)
---

# monorepo-layout

Restructure the workspace from one flat `packages/*` into four folders with an enforced dependency direction, without
changing any behaviour. Recon: `recon.md`. Audits: codex → reject, fable → conditional approve; every finding was
checked against the code and is folded below (§10).

## 1. Goal and success criteria

Today 12 packages of five kinds sit in one folder, only 5 of their real dependency edges are declared, no package has
an `exports` map, and 622 cross-package imports are deep relative paths. Boundaries exist by convention only.

Done means:

1. `apps/`, `packages/`, `protocol/`, `tools/` hold the workspaces below; package names are unchanged.
2. No source file reaches another workspace by relative path (TypeScript imports, `/// <reference>`, CSS `@import`),
   except a short, commented list of edges that cannot be package imports (§3.3). Every `@yacana/*` import resolves
   through an `exports` entry and is declared in the importer's `package.json`. A test enforces it.
3. `apps → packages → protocol` holds for production source; `tools` may import anything; only tests, e2e setups and
   scripts import `tools`. No cycle exists in the production (`dependencies`) graph. A test enforces both.
4. Every location-bearing reference in config and CI points at something that exists, every `bun:test` file is run by
   some workflow, and every workflow's path filter covers its workspace's declared dependencies. A test enforces it.
5. One `bun run typecheck` covers every workspace, each under its own `types`.
6. The Phase 1 spikes are gone; what the threat model and `spike-results.md` rest on survives under honest names.
7. Every gate green on `06b25d7` is green at the end, and the assembled site's bundle manifest is unchanged or every
   delta is explained.

8. The GitHub repository is `alejoamiras/yacana`, nothing live in the tree names the old URL, and Actions and
   Workers Builds still run on a push.

```
apps/        web-miner · web-stats · web-landing · site        site = assembler + Workers + assembled-site E2E
packages/    miner-core · bridge · ui · web-kit                web-kit = config, headers, siteVite, browser/*, prebuild helpers
protocol/    work-circuit · contracts · portal                 Noir, Aztec, Solidity
tools/       deploy · harness · localnet                       localnet = today's scripts/run as @yacana/localnet
scripts/     params-codegen · render-* · test-preload · the guards
```

## 2. Scope

**In**: the six arcs of §6. **Out** (each in `implementations-plan/follow-ups.md`): renaming any package; deleting the
unused `miner-core` barrel; merging the two `toolchain.ts` copies; pinning Node; a transitive browser-reachability
check; moving `bridge-vectors.json` under `protocol/`; untracking old plan transcripts; true `composite` project
references; any production deploy; renaming the local clone folder. The Cloudflare edit and the repository rename are
in scope only as the two owner-present steps of §7.

## 3. Architecture & Implementation

### 3.1 Entry points: explicit subpath `exports`, source-first

Every imported workspace gets an `exports` map listing its public subpaths, each pointing at source. Specifiers drop
`src/` and the extension:

```jsonc
// packages/miner-core/package.json
"exports": {
  "./reader": "./src/reader.ts",
  "./generated/params": "./src/generated/params.ts",
  "./keys/derive": "./src/keys/derive.ts",
  "./fixtures/epochs.testnet.json": "./fixtures/epochs.testnet.json",
  "./scripts/gen-slots": "./scripts/gen-slots.ts"
}
```

About 100 lines across 11 manifests, generated from the import graph, not typed by hand (§3.9). Existing `"."` barrels
stay exported (`ui`'s is used 86 times). `ui` also exports `./theme.css`. The map mixes production API and test hooks
(`deploy`'s 12, `web-miner/e2e/*`, `web-stats/e2e/helpers`); that is accepted and stated, not hidden.

Why explicit rather than `./*`: the list is the package's API and TypeScript (`moduleResolution: bundler`), Bun and
Vite all reject an unlisted subpath. Why subpaths rather than barrels: `miner-core`'s barrel re-exports
`artifacts.ts`, which builds filesystem paths at import; a page must never pull it.

Resolution chain, per consumer: Bun and TypeScript follow `exports` natively. Vite resolves the workspace symlink to
its real path, outside `node_modules` and inside `server.fs.allow: [repo]`, so it is transformed as source and never
pre-bundled (confirmed in Vite 8.2.2's resolver); Vitest externalizes by the same resolved path. `?raw` specifiers are
invisible to TypeScript (`vite/client`'s ambient `*?raw`), so a wrong `exports` entry for one fails only at Vite or
Vitest run time; P1.1 exercises one. Playwright's Node loader never meets `@yacana/*`: all 14 cross-package e2e files
are Bun-run setups.

**The config-time graph stays relative.** Vite's config bundler externalizes every bare specifier and lets the ambient
Node `import()` it. A `vite.config.ts` importing `@yacana/web-kit/vite-base` would therefore need a Node that strips
types (≥ 22.18), and nothing pins Node here, in CI or in Workers Builds. So the three `vite.config.ts → vite-base.ts`
imports and `vite-base.ts → ui/src/mark.ts` stay relative, as today, and are the guard's listed exemption (the rest
of that graph is already relative or type-only: `mark.ts → tokens.ts`, `config.ts`'s `bridge` import). The build
depends on the ambient Node exactly as much as it does today, no more.

### 3.2 Declared dependencies

Production source importing `@yacana/x` → `dependencies`; only tests, e2e, scripts or configs → `devDependencies`.
The root manifest is an importer too (`scripts/render-e2e.ts` → `@yacana/web-stats/e2e/helpers`). New workspaces
declare their npm imports as well: `web-kit` takes `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`,
`vite-plugin-node-polyfills`, `idb-keyval` from `site`/`web-miner`; `localnet` takes the `@aztec/*` list and `viem` at
`harness`'s versions; `contracts` and `web-kit` declare `@aztec-foundation/aztec-standards` instead of resolving it
through another package's directory.

### 3.3 `scripts/boundaries.test.ts` (arc 1, grows in arc 2)

Specifiers come from `ts.preProcessFile(text, true, true)` (TypeScript is already a root devDependency): it returns
static, type-only, re-exported, dynamic and `typeof import()` specifiers, multi-line forms, and triple-slash
references, and ignores comments and strings. `Bun.Transpiler.scanImports` drops every type-only form and is unfit.
The same function drives the codemod. A small fixture test pins the extractor on each syntactic form.

1. **No relative escape.** Each relative specifier or `/// <reference path>` in tracked `*.ts/tsx/mts/mjs` is resolved
   against its file; the owner is the workspace whose root is the longest prefix. Owner ≠ importer's workspace →
   offender. The same for relative `@import` in tracked CSS. Exempt, by an explicit list with one line of why each:
   the config-time graph (§3.1), Tailwind `@source` lines (Tailwind takes paths, not packages), targets no
   workspace owns (`yacana.params.json`, `toolchain.lock.json`, `deployments/*`, two `node_modules` paths in
   `web-miner/tests/memory-store.bun.test.ts`), and, from P1.4 until P2.1 removes them, the three apps'
   `/// <reference path>` to `site/src/browser/vite-env.d.ts`.
2. **Declared, in the right block.** A production file's `@yacana/x` must be in `dependencies`; any other file's in
   `dependencies` or `devDependencies`.
3. **Direction** (arc 2). Layers `apps` 3, `packages` 2, `protocol` 1, `tools` free. A production file (not under
   `tests/`, `e2e/`, `scripts/`; not `*.test.*`, `*.vitest.*`, `*.e2e.ts`, `*.config.ts`) imports only layers ≤ its
   own, never `tools`, and never a subpath whose target lives under another workspace's `scripts/`, `e2e/` or `tests/`.
   One listed exception: `site/src/assemble.ts` imports `@yacana/web-kit/scripts/{copy-artifacts,copy-slots,fetch-crs}`
   (it is a Bun build program that happens to live in `src/`; nothing it imports reaches a page). Until arc 3 the
   layer comes from a name table in the test; arc 3 replaces it with the folder.
4. **No production cycle** (arc 2). Depth-first over the `dependencies` graph.

This does not make browser bundles safe "by construction": `web-kit` is dual-environment and its map offers Node-only
subpaths (`vite-base`, `headers`) to the apps. Rule 3 blocks the direct wrong import; the bundle manifest (§3.10) is
the evidence that this refactor changed nothing; a transitive reachability check is a follow-up.

### 3.4 `scripts/layout.test.ts` (end of arc 1, before any path changes)

Everything here passes on the baseline, so it lands before the moves it guards.

- **Workflows**, parsed with `Bun.YAML` (the `filters` block is a string, parsed again):
  (a) every non-negated filter glob matches ≥ 1 tracked file;
  (b) checked-in inputs exist: the path arguments of a closed list of command forms (`--cwd X`, `bun test <paths>`,
  `bun <path>.ts`, `bash <path>`, `git diff --exit-code <path>`, `jq … <path>`, `working-directory`, `uses: ./…`).
  A `run:` line that names a workspace folder in any other form fails as "unsupported form": no shell interpreter.
  Generated outputs (`upload-artifact` `path:` values: reports, logs, screenshots) are checked only for their owning
  workspace folder, since they do not exist in a clean checkout;
  (c) **coverage inverse**: every tracked `*.test.ts` is matched by a `bun test` invocation (Bun's filters are path
  substrings; a bare `bun test` matches all) **in a workflow triggered by `pull_request`**, minus an explicit list of
  live/rig-only files. `bun test a b` exits 0 when `a` matches nothing, so nothing else notices a test leaving CI;
  (d) **filters follow the graph**: the filter of a workflow that runs workspace X's tests names, at directory
  granularity, X and every workspace in X's transitive `dependencies`. Baseline gaps are fixed in the same phase;
  (e) **critical lanes, named one by one**: the four toolchain lanes (`contracts`, `work-circuit`, `portal`,
  `harness`) each run `toolchain.test.ts` with `YACANA_REQUIRE_TOOLCHAIN` set (without it the suite skips where the
  toolchain is absent, `toolchain.test.ts:17`) and their filters cover the resolver's folder, not only the test file
  (`work-circuit.yml:25` names the test alone today); `headers.test.ts`, `node-guard.test.ts` and `config.test.ts`
  run in a PR lane whose filter covers their folder.
- **Root manifest**: `workspaces` globs cover exactly the tracked workspace manifests; `--filter`, `--cwd` and
  `sort-package-json` arguments exist.
- **Source literals**: a whole string literal in tracked TS that starts with a workspace folder (`packages/x`,
  later `apps/x` …) names an existing directory. Limits stated: two segments only, constructed paths are not seen
  (they fail loudly with ENOENT); the guards' own fixtures are exempt.
- **CSS**: every relative `@source` path exists.
- Arc 4 adds: the root solution references every workspace that has TypeScript.

Two categories are removed instead of guarded, in the same phase: the 42 anchored `.gitignore` lines move into
per-workspace `.gitignore` files (they then travel with `git mv`), and `biome.json`'s three negations become
location-independent (`!**/abi`, `!**/artifacts`, beside the existing `!**/fixtures`, `!**/generated`).

### 3.5 `web-kit` (breaks `site ⇄ web-*`)

New workspace `packages/web-kit`, created at its final path. `git mv` from `packages/site`: `src/config.ts`,
`src/headers.ts`, `src/vite-base.ts`, `src/browser/*`, their tests, `scripts/{fetch-crs,copy-artifacts,copy-slots}.ts`,
`crs.lock.json`. From `web-miner`: `src/pinned-crs.ts` (it sits on the guard and reads `crs.lock.json`; moving it
removes the dev cycle `web-kit` test → `web-miner` → `web-kit`) and `src/shims/detect-node.ts` (the one shim `siteVite`
aliases).

Elsewhere:
- `scripts/commit-artifacts.ts` → `contracts/scripts/`: it reads `{contracts,work-circuit}/target` and writes their
  committed `artifacts/`, which is protocol's output. `web-kit`'s `copy-artifacts.ts` and the replay setup import
  `COMMITTED` downward.
- `site.env` → `deployments/site.env` (Ask A6): it is the origin's deployment config (RP ID, node URL, old origin),
  `config.ts` only parses text handed to it, and `vite-base.ts` already reads `deployments/<profile>.json` two lines
  above. No library owns production config and the path stops depending on any workspace.
- The three apps' `vite-env.d.ts` become `/// <reference types="@yacana/web-kit/vite-env" />` (an `exports` entry with
  a `types` condition; codex's in-memory probe resolved it) and `web-miner/tsconfig.tests.json` drops its
  `../site/src/browser/vite-env.d.ts` include.

`site` keeps `src/assemble.ts`, `src/artifact.ts`, `e2e/`, `playwright.config.ts`, `wrangler.jsonc`, `www/`, `v5/`. It
imports `@yacana/web-kit/{config,headers,vite-base,scripts/*}` and `import type { Route }` from the two apps' `routes`.
Graph: apps → web-kit → {miner-core, bridge, ui}; site → apps + web-kit.

### 3.6 `localnet` (breaks `packages → scripts/run`)

New workspace `tools/localnet`, created at its final path: `scripts/run/*.{ts,mjs}` → `tools/localnet/src/` (including
`rig.ts` and `pinned-node.mjs`, which `upgrade-rig.ts:339` names by path), `agent.sh` and `install-presto-server.sh`
→ `tools/localnet/bin/` (`agent.sh:6` `cd ../..` → `../../..`). Exports: `registry`, `toolchain`, `upgrade-rig`,
`port-window`, `preview`, `presto`, `isolated-node`, `control`.

Two behaviour fixes required by the depth change:
- `repoRoot` is derived once in `toolchain.ts`; `presto.ts` and `registry.ts` import it.
- `toolchainBin(name, root = repoRoot)` throws when the pin is unreadable, empty or malformed, instead of returning
  the bare name. `.aztecrc` is committed, so the `catch` only fires on a wrong root, and its effect is to run whatever
  is on `PATH`. This is fail-closed *lookup*; hash verification stays `toolchain.test.ts`'s job.

`toolchainBin` also resolves `aztec-forge` for `portal/scripts/forge.ts` and `deploy/scripts/l1-deploy.ts`, so it is
in the build-and-deploy chain of the contract that mints YACA. Both importers are scripts (exempt from rule 3).
`work-circuit/scripts/toolchain.ts` is a second, already fail-closed copy; merging the two into `protocol` is a
follow-up (it would be a third new workspace or an odd home; out of this plan's scope).

### 3.7 Remaining edges

- `miner-core/src/{live,reader.live}.test.ts` import `deploy` → move to `deploy/tests/`; `miner-core` exports what
  they import. `CLAUDE.md:50` and the threat-model rows that cite "the live suite" follow.
- `bridge → portal/abi`: declared. `harness → web-miner/e2e/*`: declared dev.
- `portal/foundry.toml:12` and `portal/test/Hashes.t.sol:14` read `../bridge/fixtures/bridge-vectors.json`: the one
  known upward data read; both paths are re-pointed in arc 3.

### 3.8 Typecheck: a solution of per-package projects

`tsconfig.base.json` carries today's options unchanged (including `lib: ["ESNext","DOM"]`: Bun-typed Playwright
callbacks legitimately use DOM globals). Every workspace with TypeScript gets a `tsconfig.json` (apps keep their
app/node/tests split) with its own `include`, `types` and `tsBuildInfoFile`. The root becomes
`{ "files": [], "references": [...] }` plus a project for root `scripts/`. No `composite`: projects follow imports
into each other's source, as the apps do today (codex built such a solution in memory under TypeScript 6.0.3).

`typecheck` = `tsc -b --force`. Without `--force`, `tsc -b` decides up-to-dateness from a project's own root files, so
a change in workspace B leaves project A "up to date"; that hole exists in the three apps today and must not become
the repo-wide gate. The separation is on the `types` axis only.

### 3.9 The codemod

`implementations-plan/monorepo-layout/codemod.ts` (committed with the plan, outside Biome and `tsconfig`; it is needed
again after every `gh stack sync` and archived with the plan). Using §3.3's extractor: for each relative specifier
owned by another workspace, replace it with `@yacana/<owner>/<subpath>` by reverse lookup in the owner's `exports`;
with `--emit-exports` it prints the maps from the graph instead. The 36 existing `@yacana/x/src/y.ts` specifiers go
through the same lookup. Query suffixes are kept. Exempt targets (§3.3) are skipped; any other unresolved target is
reported, never guessed.

### 3.10 Bundle manifest

A **production** `bun run site:build` (the assembler refuses a non-production build in `dist`, `assemble.ts:137`; a
production build lands only there, and `dist` is ignored) with fixed inputs: `GITHUB_SHA` set to the baseline's full
sha and `CF_PAGES_COMMIT_SHA` unset (a production build takes its commit from those, then from `HEAD`,
`vite-base.ts:38-42`, and the commit is compiled into the JavaScript; `VITE_SOURCE_COMMIT` counts only in e2e mode),
the committed `deployments/testnet.json` profile, no `YACANA_*` overrides. Then a sorted list of every file under
the site's `dist`, relative to it, with byte size and sha256 (JS, CSS, HTML, `_headers`, `_redirects`, `build.json`),
written to `lessons/bundle-<arc>.txt`. Taken at the baseline (P0.1) and at each
arc end. Arcs 1–3 change specifiers and locations only, so hashes should be identical; a delta is either explained in
lessons down to the cause (for instance a path leaking into a chunk after the move) or is a finding. It also catches
a lost Tailwind `@source` (utilities vanish from the CSS silently).

**Amended in P1.1 (D10).** Identical hashes do not survive arc 1: a rewritten import is re-sorted by Biome
(package specifiers before relative ones), module order changes, and the minifier renames across the whole chunk
(measured: one moved line in `web-miner/src/main.tsx`, +12 bytes, five files re-hashed; bisected in
`lessons/phase-1.md`). From P1.1 the gate is `bundle-compare.ts` reporting **no findings** against the baseline
build and its module inventories: the same files once content hashes leave their names (shared stems compared as
groups); everything that is not JavaScript byte-identical after hashed names are normalised inside it (this keeps
the lost-`@source` check exact); no path of this machine in any script and no rise in generic folder prefixes; and,
per page and per Worker, **the same set of bundled modules** (`YACANA_MODULE_REPORT`, a build-time listing in
`vite-base.ts` that emits nothing into the bundle), with only a moved folder's ids mapped in arc 3. Every
JavaScript size delta is printed and recorded; size is diagnostic, never proof. This is regression evidence, not
byte or semantic equivalence: the behavioural gates (HEAVY, the canary, `import-order`) carry that.

### 3.11 File-level change map

| Arc | Added | Moved | Deleted | Edited |
|---|---|---|---|---|
| 0 | root script `site:wrangler` | `work-circuit/scripts/sweep.ts` → `prove.ts` | `contracts/yacana_spike/`, `contracts/scripts/gates.ts`, `deploy/{browser/,vite.config.ts,scripts/spike-*.ts}`, `work-circuit/crates/sweep_*`, `work-circuit/scripts/{ticket-cost,proof-shape}.ts` | both `Nargo.toml`, `export-vk.ts:45,62-65`, `mutation.ts` (own witness, in-script wrong VK, no vacuous pass), `determinism.ts:17` (pinned `aztec-nargo`), `prove.ts` (default crate `yacana_work`), script entries (`spike:*` out; `prove`, `manifest`, `check:{determinism,mutation,wasm,proofs}` in), `deploy` devDependencies, `.gitignore:12`, `CLAUDE.md`, `README.md`, `docs/deployments.md` (the decoupled Workers Builds settings) |
| 1 | `scripts/{boundaries,layout}.test.ts`, the codemod, per-workspace `.gitignore` files | none | none | `exports` + deps in 11 manifests + root, ~620 import lines, 3 `index.css` `@import`s, `biome.json`, root `.gitignore`, workflow filters the graph rule finds missing, `bun.lock` |
| 2 | `packages/web-kit/package.json`, `tools/localnet/package.json`, their tsconfigs | §3.5, §3.6, §3.7 | none | root `workspaces` (+ `tools/*`), root scripts, **every CI `bun test` line and filter touched by the moves** (`site.yml:48`, `web-landing.yml:49`, `miner-core.yml:28`, `work-circuit.yml:48`, `contracts.yml:62`, `portal.yml:42`, `harness.yml:55`, `web-miner.yml` CRS step), `setup-presto`, `lint:shell`, specifiers `@yacana/site/*` → `@yacana/web-kit/*`, guard rules 3–4, docs |
| 3 | none | nine workspaces into `apps/`, `protocol/`, `tools/` | `typecheck-all.sh` (dead) | root `workspaces`/scripts (incl. `site:wrangler`), root `tsconfig`, `rename-guard` roots, path literals, config-time relative imports, 3 `@source` lines, `foundry.toml`, `Hashes.t.sol:14`, 12 workflows, `setup-presto`, guard name table → folders, `CLAUDE.md`, `README.md`, `docs/*`, READMEs, wrangler comments |
| 4 | `tsconfig.base.json`, a `tsconfig.json` per workspace lacking one | none | root `exclude` list | root `tsconfig.json`, `typecheck` scripts, `layout.test.ts` |

## 4. Security & Adversarial Considerations

**Threat model.** No runtime surface changes; the risk is a refactor that weakens a control without anyone seeing.
Who benefits: a supply-chain attacker (unpinned toolchain, unreviewed dependency change), anyone helped by a CI gate
that stopped running, a user harmed by a page bundle that gained an operator or Node-only module.

- **Controls leaving CI silently.** Three mechanisms, all verified: `dorny/paths-filter` treats a dead glob as "not
  relevant"; `bun test a b` exits 0 when `a` matches nothing; `git diff --exit-code <stale path>` exits 0
  (`portal.yml:47`, the ABI-drift gate of the contract that holds funds). The split would also have taken
  `headers.test.ts` (CSP/COOP/COEP), `node-guard.test.ts` (the fetch guard) and `config.test.ts` (production guards)
  out of every workflow while local `bun test` stayed green. Answer: §3.4 (a)–(d), landed before the first path
  change, run by `miner-core.yml` on every PR; and §3.11 names every CI line arc 2 must edit.
- **Toolchain.** `toolchainBin` fails closed (§3.6). It checks existence, not hashes; `toolchain.test.ts` does the
  hashing and keeps running in its four workflows. `determinism.ts` stops calling bare `aztec-nargo`. Residual, out of
  scope: the `compile` scripts of `contracts` and `work-circuit` call `aztec` from `PATH`.
- **Bundle contents.** Rule 3 forbids production app source from importing `tools` or another workspace's
  `scripts/`/`e2e/`/`tests/`. It is not a proof: `web-kit` is dual-environment and `siteVite` enables node polyfills,
  so a Node module could enter a page without failing the build. Evidence for this refactor: the bundle manifest.
  `assertProductionArtifact`, CSP/COOP/COEP and the fetch guard move byte-identical with their tests; `site:e2e`
  asserts headers on the assembled origin at every arc end from arc 1.
- **Supply chain.** No new npm package. New manifests re-declare versions already in `bun.lock`. Gate, in the phases
  that touch manifests: `bun install --frozen-lockfile` exits 0 and a scripted diff of `bun.lock` shows no changed
  version, `resolved` or integrity field outside workspace entries. Frozen install proves manifest/lock agreement, not
  provenance; the 7-day min-age (with its three owner-package exemptions, `bunfig.toml:6`) and SHA-pinned Actions are
  untouched. Arc 0 removes `vite`, `playwright`, `vite-plugin-node-polyfills` from `deploy`.
- **Least privilege.** Workflow `permissions` blocks are untouched; `actionlint` gates every workflow edit.
- **Cryptography.** None added. The ticket-grinding mitigation rests on proofs being non-malleable and byte-identical
  across runs and across native/WASM (`docs/threat-model.md:23`, `spike-results.md` I8). The three scripts that show
  it, and the one that regenerates the fixture proof, are kept; `mutation.ts` can no longer pass on a crash or a
  missing file (P0.1).
- **Contracts.** `yacana_spike` is undeployed. The VK and the contract class are shown unchanged by regenerating from
  clean targets and diffing: `codegen`, compile, `artifacts:commit`, `export-layouts`, each followed by
  `git diff --exit-code`.
- **Secrets.** `deploy` handles `YACANA_L1_PRIVATE_KEY` and `YACANA_DEPLOYER_SECRET` and lands in the layer that may
  import anything. Nothing changes what it imports; tightening that is a follow-up.
- **Production deploy.** Every branch push already uploads a preview version of the production Worker; the agent
  pushes feature branches only and never deploys to production. The Workers Builds settings are edited once, in step
  C1, by the agent with the owner present (or by the owner). The token is the new secret this plan introduces.
  Workers Builds Configuration: Edit is narrow on paper and broad in effect: it can trigger builds, set build
  variables and point a production build at arbitrary commands, and a build runs with deploy credentials and whatever
  secrets the build can read. It is **indirect production authority**. Controls: user-scoped to one account, shortest
  TTL, minted on merge day and revoked the same hour whatever happens, one mode-600 file outside the repo, never in
  `argv`, the environment, the chat (the transcript persists) or any log, responses redacted, never reachable from
  an autonomous seed, two named triggers and three named fields, before and after shown to the owner first.
- **The repository rename.** Redirects cover old URLs until someone registers the old name; the owner
  controls the account namespace and will not recreate the old repository. What survives the rename (Actions, open
  PRs, the stack, branch protection, the GitHub App's repository selection, Workers Builds' connection) is verified
  in C2, not assumed.

## 5. Assumptions

### Facts (verified)

1. Five workspace edges are declared (`bridge → miner-core`, `deploy → bridge`, `harness → bridge, deploy,
   miner-core`); 10 workspaces plus the root import others.
2. No `exports` field exists anywhere; `main: src/index.ts` on `miner-core`, `ui` and `bridge`.
3. 622 relative cross-workspace specifiers (567 outside `scripts/run`), 36 `@yacana/*` specifiers, 3 cross-workspace
   `/// <reference path>`, 6 cross-workspace CSS lines (`web-*/src/index.css:1-2`).
4. All 12 `node_modules/@yacana/*` symlinks exist under `linker = "hoisted"` (`bunfig.toml:10`).
5. `siteVite`: `server.fs.allow: [repo]`, no `preserveSymlinks`, `optimizeDeps` names only `@aztec/*` and shims
   (`packages/site/src/vite-base.ts:106-160`). Vite 8.2.2 treats a resolved id outside `node_modules` as source.
6. Vite's config bundler externalizes bare specifiers (`externalize-deps`, filter `/^[^.#].*/`); nothing pins Node
   (no `.nvmrc`, `.node-version`, `engines.node`, `setup-node`).
7. No `*.e2e.ts` spec or Playwright config imports across packages; the 14 e2e files that do are Bun-run.
8. No workflow runs `spike:*`; no test and no committed artifact references `yacana_spike` or a sweep crate.
9. `sweep.ts` is the only writer of `target/yacana_work/{proof,public_inputs}`, which `export-vk.ts:52-56` copies into
   the committed fixture and `wasm-prove.ts` compares against; `export-vk.ts:62-65` tells the operator to run it.
10. `mutation.ts:33-42` returns `exitCode === 0` under `.nothrow().quiet()`: a crash or a missing VK counts as "did
    not verify". `mutation.ts:82` needs a witness it never creates.
11. `docs/threat-model.md:23` cites "determinism and mutation tests"; `spike-results.md:19` records WASM proofs
    byte-identical to native.
12. `bun test <missing> <existing>` exits 0 (run here). No workflow runs a bare `bun test`.
13. `scripts/run/toolchain.ts:24-30` returns the bare name when `.aztecrc` is unreadable; four workflows run
    `toolchain.test.ts` (`contracts.yml:62`, `work-circuit.yml:48`, `portal.yml:42`, `harness.yml:55`).
14. `node-guard.test.ts:257` imports `web-miner/src/pinned-crs.ts`, which imports `site/crs.lock.json`.
15. `config.ts` parses text; `vite-base.ts:61` reads `site.env` and `:48-56` reads `deployments/<profile>.json`.
16. The three apps typecheck with `tsc -b` over non-`composite`, `noEmit` projects under TypeScript 6.0.3; under `-b`
    up-to-dateness is decided from root files and a buildinfo is always written.
17. Root `tsconfig.json:6` has `lib: ["ESNext","DOM"]`.
18. Committed artifacts embed no repo paths; the replay recording binds by content hash.
19. `docs/deployments.md:99-104` documents Workers Builds: root directory `packages/site`, build `bun install
    --frozen-lockfile && bun run build`, deploy `npx wrangler deploy` (main) / `npx wrangler versions upload` (other
    branches). This is documentation, not a reading of the dashboard.
20. Every workspace-folder move preserves depth; `scripts/run → tools/localnet/{src,bin}`, `site.env →
    deployments/`, and the two live tests (`src/` → `tests/`) do not. Sibling relations are not preserved
    (`index.css`, `foundry.toml:12`, `Hashes.t.sol:14`).
21. `scripts/run/typecheck-all.sh` is referenced by nothing. The `miner-core` barrel has no outside importer.
22. `main` took seven `web-miner` PRs (#46–#52) in the two weeks before the baseline. A `yacana-feedback-pass`
    worktree exists; that a session is active in it comes from the owner's memory notes, not from a check.
23. `assemble.ts:137` refuses a non-production build in `dist`; `assemble.ts:11-13` imports three of `site`'s scripts.
24. `harness.yml` runs on `pull_request` (the `flip` case); `e2e.yml` is dispatch-only. `toolchain.test.ts:17` skips
    where the toolchain is absent unless `YACANA_REQUIRE_TOOLCHAIN` is set; `work-circuit.yml:25` filters on the test
    file alone.

### Inferences (each has a phase that tests it)

- I1. Vite (build **and** dev server) and Vitest resolve source-first subpath `exports`, including `?raw` JSON, the
  prover Worker's imports, dynamic `import()` and CSS `@import "@yacana/ui/theme.css"` through `@tailwindcss/vite`.
  P1.1. Fallback: a `resolve.alias` regex in `siteVite` plus `server.deps.inline` in the Vitest configs (not needed by
  the config-time graph, which stays relative).
- I2. `/// <reference types="@yacana/web-kit/vite-env" />` resolves through a `types` condition. P2.1. Fallback: the
  relative reference, added to rule 1's exempt list.
- I3. A VK made in-script by substituting valid curve points (as `mutation.ts:88-109` already does for proofs) is
  rejected by `bb verify` with the same exit path as a genuine failed verification. P0.1. Fallback: `verify_w`'s VK
  with the same existence, size and inequality assertions.
- I4. `bun install` and `bun run --filter` behave with the dev edges this creates. P2.3.
- I5. `tsc -b --force` over ~14 projects, cold, stays ≤ 3× today's full typecheck suite. P4.1; otherwise stop and surface.
- I6. FAST (§6) runs in a few minutes. Measured in P0.1 and recorded; it is the owner's chosen per-phase gate.

### Asks (decided by the owner, 2026-09-21)

- **A1. Cloudflare Workers Builds: decided, the agent runs the cutover with a temporary token (§7, step C1).** The
  cutover has no failed production build: arc 0 adds a root script `site:wrangler`; after **arc 0 only** is merged,
  both triggers are edited once to a form that never names a workspace again: root directory `/`, build
  `bun install --frozen-lockfile && bun run site:build`, deploy `bun run site:wrangler deploy` (main) /
  `bun run site:wrangler versions upload` (other branches); then the rest merges. Until that edit, the Cloudflare
  check on the arc 3–4 branches is **expected red** (root directory missing). Reverting arc 3 needs no further edit in
  this form. It protects `main`, not every branch: once the preview trigger is switched, a branch that does not yet
  contain `site:wrangler` (anything cut before arc 0 merged, `yacana-feedback-pass` included) fails its preview build
  until it is rebased. Whether `yacana-v5` and `www` have triggers is unknown to the repo; C1 lists them first.
- **A7. The GitHub repository is renamed `elixir` → `yacana`** (added by the owner, 2026-09-21): arc 5 and step C2.
- **A2. Four "spikes" are kept**, renamed: `prove` (regenerates the fixture proof), `check:determinism`,
  `check:mutation`, `check:wasm`, and `check:proofs` running them in order. They are evidence, not CI; they must be
  re-run after any `bb`/Aztec bump. Deleted: `ticket-cost`, `proof-shape`, the sweep crates, `yacana_spike`, `gates`,
  the `deploy` spike drivers.
- **A3. HEAVY uses one proverless web-miner shard** (the owner's Phase 0 choice); the real-proving canary and the
  stats screenshot gate run at the ends of arcs 1, 3 and 4.
- **A5. `main` moving under the stack: decided, rebase.** The owner will try to keep `main` still; if it moves, the
  agent rebases with `gh stack sync`, re-runs the codemod and both guards, and surfaces a sync that costs more than
  one attempt.
- **A6. `site.env` moves to `deployments/site.env`: decided.**
- A2 and A3: decided as proposed.

## 6. Phases

Placeholders: `<site>`, `<web-miner>`, `<web-stats>`, `<web-landing>` are `packages/<name>` through arc 2 and
`apps/<name>` from P3.1; `<ui>` is always `packages/ui`.

**FAST**, every phase: `bun run lint && bun run typecheck && bun run --cwd <site> typecheck && bun run --cwd <ui>
typecheck && bun run --cwd <web-miner> typecheck && bun run --cwd <web-stats> typecheck && bun run --cwd <web-landing>
typecheck && bun test && bun run test:components`. After arc 4 the six typecheck commands collapse into the one
`bun run typecheck`; lint, `bun test` and the component specs stay. Pass: exit 0, and the `bun test` pass **and skip**
counts equal the baseline in `lessons/phase-0.md` adjusted by the tests each phase adds, moves or removes, every
adjustment written down in that phase's lessons entry.

**HEAVY**, arc ends, each in `tmux`, each run on its own isolated network:
`bun run --cwd <web-miner> test:replay` · `bun run site:build` · the bundle comparison (§3.10) against the
baseline · `bun run e2e:agent -- bun run site:e2e` · `E2E_PROVERLESS=1 E2E_SHARD=cockpit bun run e2e:agent -- bun run
--cwd <web-miner> test:e2e` · `bun run e2e:agent -- bun run --cwd <web-stats> test:e2e` · `bun run e2e:agent -- bun
run --cwd <web-landing> test:e2e` · then `git status --porcelain` shows nothing untracked (the ignores hold).
**HEAVY+** (arcs 1, 3, 4) adds `E2E_SHARD=canary bun run e2e:agent -- bun run --cwd <web-miner> test:e2e` (real
proving through the Worker) and `bun run --cwd <web-stats> test:visual`.

### Arc 0: spikes out

**P0.1 ✓ Remove the spikes, keep the evidence.** First record the baseline in `lessons/phase-0.md`: `bun test` pass and
skip counts, FAST wall-clock, the full typecheck suite's cold wall-clock, the bundle manifest. Then arc 0's row of
§3.11. `mutation.ts` executes its own witness, builds its wrong VK in-script, and asserts that file exists, has the
real VK's byte length and differs from it before verifying. `verify()` classifies every `bb verify` outcome into
three: **verified** (exit 0), **rejected** (the exit status and diagnostic the pinned `bb` gives for a well-formed
proof that fails, and for an undecodable proof element; both observed on 5.2.0 first and recorded in lessons), and
**operational** (a missing input, an unspawnable binary, a signal, any other status), which throws. A mutated proof
may be rejected either way; the wrong-VK and wrong-public-input cases must be the well-formed kind. `prove.ts`,
`determinism.ts` and `mutation.ts` call `aztec-nargo` through the pinned path, not `PATH`.
*Assumes*: Facts 8–11; I3, I6.
*Gate*, in this order from clean `target/` directories: FAST · `bun install --frozen-lockfile` · `bun run codegen &&
git diff --exit-code` · `bun run contracts:compile && bun run contracts:test` · `bun run artifacts:commit && git diff
--exit-code` · `bun packages/miner-core/scripts/export-layouts.ts && git diff --exit-code` · `bun run --cwd
packages/work-circuit check:proofs` (prove → determinism → mutation → wasm: the untouched proof verifies, every
mutation is *rejected*, none is *operational*, WASM bytes equal native) · `check:mutation` alone on a tree without a
witness passes · `verify()` is exported and unit-tested directly (the script already throws when the untouched proof
fails, `mutation.ts:50`, so "the script fails" proves nothing): with the VK path removed, with `BB` pointed at a
missing binary, and with `BB` pointed at a script that kills itself, `verify()` throws an error tagged
**operational**; a regression that folds operational outcomes back into "rejected" makes those three tests fail ·
the baseline bundle manifest (§3.10). Layers: lint,
typecheck, unit, TXE, native and WASM proving.

**P0.2 ✓ The decoupled deploy script.** Root `site:wrangler` (`cd packages/site && wrangler`), and
`docs/deployments.md`'s Workers Builds paragraph rewritten to the decoupled settings of A1, marked as the target state.
*Gate*: FAST · `bun run site:wrangler --version` prints wrangler 4.127.1 · `bun run site:wrangler deploy --dry-run`
after a `site:build` exits 0 without uploading.

### Arc 1: boundaries, no workspace moves

**P1.1 ✓ Prove the resolution chain.** `exports` on `miner-core` and `ui`; rewrite **every** existing
`@yacana/miner-core/src/*.ts` specifier in the same commit (the tree never holds a specifier its map rejects). By
hand, one import of each kind in `web-miner`/`web-stats`: a page module, the prover Worker, a Vitest spec, a `bun:test`
file, a `?raw` JSON (`web-stats/src/features/stats.vitest.tsx`), a dynamic `import()`, and `@import
"@yacana/ui/theme.css"` in one `index.css`. Confirm the config-time graph is untouched.
*Assumes*: Facts 4–7; I1.
*Gate*: FAST · `build` of `web-miner` and `web-stats` · a dev-server smoke per app: start `vite` on a registry port,
fetch `/` and one module that imports `@yacana/*`, assert 200 and no "Failed to resolve" in the log, stop it by owned
process group · `test:replay` · the bundle comparison (§3.10, amended) reports no findings.
*Kill criterion*: a kind that cannot resolve → stop, record, apply I1's fallback for that kind only.

**P1.2 ✓ Maps and declarations.** `codemod.ts --emit-exports` → the 11 maps; deps per §3.2; rewrite the remaining
`@yacana/x/src/y.ts` specifiers in the same commit.
*Gate*: FAST · `bun install --frozen-lockfile` · the scripted `bun.lock` diff (§4) is empty outside workspace entries.

**P1.3 ✓ Codemod.** TypeScript specifiers, the three `/// <reference path>` (relative until P2.1), the three CSS
`@import`s. `scripts/run` imports stay relative: it is not a workspace yet.
*Gate*: FAST · zero unresolved non-exempt targets · `bun run --cwd packages/web-landing build` · the bundle comparison reports no findings.

**P1.4 ✓ The boundaries guard.** Rules 1–2 and the extractor's fixture test.
*Gate*: FAST · one deliberate regression per rule (a relative escape in TS; one in CSS; a production import declared
only in `devDependencies`) fails the guard naming file and line, then is reverted.

**P1.5 ✓ Location-independent config and the layout guard.** Per-workspace `.gitignore` files, `biome.json` negations,
`scripts/layout.test.ts` with every rule of §3.4; baseline filter gaps fixed.
*Gate*: FAST · `bun run lint:actions` · six deliberate regressions fail it (a dead filter glob; a stale path in a
`run:` line; a workspace path in an unsupported command form; a test file no PR workflow runs; a workflow missing a
dependency's folder; a toolchain lane without `YACANA_REQUIRE_TOOLCHAIN`) · `git status --porcelain` clean after
`site:build` and `test:replay`.
*Arc end*: HEAVY+.

### Arc 2: cycles out

**P2.1 ✓ `web-kit`.** §3.5, with the CI lines of §3.11. I2 tried here.
*Gate*: FAST · the layout guard (it now fails if the moved tests left CI) · `bun test packages/web-kit packages/site
packages/contracts` · `bun run artifacts:commit && git diff --exit-code` · `bun run site:build` · bundle manifest unchanged.

**P2.2 ✓ `localnet`.** §3.6, with the CI lines of §3.11.
*Gate*: FAST · layout guard (its critical-lane rule now requires the four toolchain filters to cover
`tools/localnet/**`) · `bunx tsc -p tools/localnet --noEmit` (the new workspace typechecks on its own declared
dependencies) · `bun run lint:shell` · `bun run lint:actions` · `bun install --frozen-lockfile` + lock diff · unit tests: `toolchainBin` throws on an unreadable, empty and malformed pin; `registry.ts`'s fallback directory
resolves under the repo root · `bun run portal:build && bun run portal:test` (`forge.ts` changed its import) ·
`bun run e2e:agent -- true` (the moved `agent.sh` boots and tears down a network) · `bun
tools/localnet/src/isolated-node.ts --smoke`.

**P2.3 ✓ Remaining edges.** §3.7.
*Gate*: FAST · layout guard · `bun run contracts:test` · `bun run --filter '*' typecheck` completes for every
workspace that has the script (I4) · in `tmux`: `bun run e2e:agent -- bun test packages/deploy`, asserting from the
output that the moved live tests **ran** (pass count, zero skips for them).

**P2.4 ✓ Direction and cycles.** Rules 3–4.
*Gate*: FAST · three deliberate regressions fail the guard: an app's production source importing `@yacana/deploy`;
one importing another workspace's `scripts/` subpath; a same-layer production cycle.
*Arc end*: HEAVY · `bun run rig -- flip`.

### Arc 3: the move

**P3.1 ✓ Move and re-point.** Commit 1: `git mv` the nine workspaces, nothing else (kept separate for review only;
squash merges do not preserve it and no gate can run on it). Commit 2: everything in arc 3's row of §3.11 except
docs, **including the 12 workflows and `setup-presto`**: the layout guard reads them, so they move with the folders.
`bun install`.
*Gate*: FAST · both guards · `bun run lint:actions` · from clean targets: `bun run codegen && git diff --exit-code` ·
`contracts:compile` · `contracts:test` · `artifacts:commit && git diff --exit-code` · `bun run portal:build && bun run
portal:test` · `bun run site:build` · bundle manifest unchanged (a lost `@source` shows here) · `bun run
site:wrangler deploy --dry-run` still resolves the moved Worker config.

**P3.2 ✓ Prove the CI edit is mechanical.** Apply the path map (`packages/<moved>` → new folder, `scripts/run` →
`tools/localnet/…`) to the **baseline** workflow files with `sed` and diff the result against the edited ones; only
differences listed in the phase's lessons entry may remain. No file changes unless the diff finds one.
*Gate*: FAST · the diff, shown · both guards.

**P3.3 ✓ Docs.** `CLAUDE.md`, `README.md`, `docs/*`, READMEs, wrangler comments.
*Gate*: FAST · `git grep -nE "packages/(web-miner|web-stats|web-landing|site|work-circuit|contracts|portal|deploy|harness)\b|scripts/run\b" -- ':!implementations-plan' ':!docs/deployments.md'`
returns nothing, and the same grep on `docs/deployments.md` returns only lines under its `## Archived` headings.
*Arc end*: HEAVY+ · `bun run rig -- flip` · `YACANA_APP_ROLE=old bun run site:build`.

### Arc 4: one typecheck

**P4.1 ✓ Solution.** §3.8.
*Gate*: `bun run typecheck` exits 0 · deliberate errors fail it and name the file: one type error per layer;
`Bun.file(…)` in a React source (wrong under `vite/client`); `import.meta.env.VITE_X` in a `tools` file (wrong under
`bun`) · editing only a `miner-core` export's type makes a dependent app's project fail (no stale green) · every
tracked `*.ts`/`*.tsx` outside `implementations-plan/` is a **root file** of exactly one project (`bunx tsc -p
<project> --showConfig`'s `files`, compared with `git ls-files`; a file may still be pulled into other programs by
import). Ambient `*.d.ts` files may be roots of several projects, by an explicit list (`web-miner/src/vite-env.d.ts`
is a root of both its app and its tests project today) ·
cold wall-clock ≤ 3× the baseline suite (I5) · FAST.

**P4.2 ✓ Wire it.** Per-package `typecheck` scripts; the layout guard's references rule.
*Gate*: FAST · `bun run lint:actions` · a workspace missing from the references fails the layout guard.
*Arc end*: HEAVY+.

### Arc 5: the repository's name

**P5.1 ✓ In-repo references.** Three live references and one exemption: `web-landing/src/copy.ts:17` (`REPO`), its two
assertions (`web-landing/e2e/landing.e2e.ts:114`, `src/sections.vitest.tsx:99`), and `scripts/rename-guard.test.ts:24`
(the `github.com/alejoamiras/elixir` exemption goes, so the guard starts refusing the old URL). History keeps the old
name: `implementations-plan/elixir-*`, `docs/pitch/`, the archived deployment record and its docs section stay exempt.
The local clone's folder name is **not** changed: Claude Code keys session history and memory by path, and the
worktrees hold absolute paths.
*Assumes*: the rename itself (C2) happens before this arc's PR merges, so the landing never ships a link that 404s;
GitHub redirects the old URL either way.
*Gate*: FAST · `git grep -n "alejoamiras/elixir" -- ':!implementations-plan' ':!docs/pitch'` returns nothing ·
`bun run e2e:agent -- bun run --cwd <web-landing> test:e2e` (the footer link assertion). No HEAVY: one constant changed.

## 7. Delivery

Six arcs, stacked with `gh stack`, one branch each; `code_review: off` for every arc.

| Arc | Branch | Phases | Stacks on | PR title |
|---|---|---|---|---|
| 0 | `worktree-monorepo-layout` (adopted) | P0.1–P0.2 | `main` | `chore(contracts, work-circuit, deploy): monorepo arc 0/5, the spikes out` |
| 1 | `monorepo-layout-boundaries` | P1.1–P1.5 | arc 0 | `refactor: monorepo arc 1/5, package boundaries` |
| 2 | `monorepo-layout-cycles` | P2.1–P2.4 | arc 1 | `refactor(web-kit, localnet): monorepo arc 2/5, the cycles out` |
| 3 | `monorepo-layout-move` | P3.1–P3.3 | arc 2 | `refactor: monorepo arc 3/5, apps, packages, protocol, tools` |
| 4 | `monorepo-layout-typecheck` | P4.1–P4.2 | arc 3 | `build: monorepo arc 4/5, one typecheck` |
| 5 | `monorepo-layout-repo-name` | P5.1 | arc 4 | `chore(web-landing): monorepo arc 5/5, the repository is yacana` |

### Merge day: two steps the agent runs only with the owner present

Neither step is reachable from `/goal` or `/loop`. Each starts on the owner's explicit "go" in the session, and each
is reported line by line. The merges themselves stay the owner's.

**C1. The Workers Builds cutover** (after the owner merges arc 0, before arcs 1–5). The owner may do it by hand
instead; the agent then only reminds them of the three values per trigger, and of the fact that the settings page
edits the production trigger alone (`docs/deployments.md:99-103`), so the non-production one needs the API call below
either way. When the step comes up, the agent restates the token permissions unprompted.
- Token: user-scoped, this account only, **Workers Builds Configuration: Edit** plus **Workers Scripts: Read** (what
  the tag lookup needs, per Cloudflare's API reference; without it the owner pastes the tag). Shortest TTL the
  dashboard offers, created on merge day. **Treat it as indirect production authority**: it can trigger builds, set
  build variables and point a build at arbitrary commands, and a build holds deploy credentials. Patching three
  fields constrains the agent's client, not a stolen token; the TTL and the revoke are the real bound.
- Handling: the owner writes it to `~/.config/yacana/cf-token` (directory 700, file 600). It never enters the chat,
  the repo, a command line or the environment: a throwaway Bun client in the scratch directory reads the file itself
  and calls `fetch` (nothing in `argv`, no `curl`, no `set -x`), and prints an explicit allowlist only (trigger uuid and
  name, branch patterns, the three reviewed fields, HTTP status, `success`), never a raw response: pattern-based
  redaction cannot recognize every secret.
- Scope: **the two triggers of the apex Worker `yacana` only.** `yacana-v5` (its build needs `YACANA_APP_ROLE=old` and
  `v5/wrangler.jsonc`) and the `www` Worker (its own config) are **listed, not changed**; if they have triggers that
  name `packages/site`, the agent shows them and the owner approves a separate mapping for each, or edits them.
- Sequence: `GET /accounts/{account}/builds/workers/{tag}/triggers` → record, outside the repo, only each trigger's
  uuid, branch patterns and the three fields' current values (the rollback record, mode 600 in the same private
  directory; never the full response) → show
  the owner before and after → `PATCH /accounts/{account}/builds/triggers/{uuid}` with `root_directory`,
  `build_command`, `deploy_command`; every call checks the HTTP status and the API's `success`, and the step stops at
  the first failure → `GET` again and diff → the owner pushes or retries a build; green on `main` and on one branch
  that contains `site:wrangler` closes the step. Rollback restores a field only if it still holds the value this step
  wrote (no overwriting a concurrent edit).
- Always, on success, failure or interruption: the owner revokes the token, the agent deletes the file and the
  client, and says so.
- After the cutover: the "Until the cutover" sentence in `docs/deployments.md` (the old root directory, D13) goes,
  in the same commit as any other record of the step.

**C2. The repository rename** (after arcs 0–4 are merged, before arc 5).
- Before: record branch protection (`gh api repos/alejoamiras/elixir/branches/main/protection`) and `gh stack view`.
- `gh repo rename yacana --repo alejoamiras/elixir` → `gh repo view alejoamiras/yacana` → `git remote set-url origin
  git@github.com:alejoamiras/yacana.git` in the canonical clone (worktrees share it) → the row in
  `~/.agents/clones.md`. Never create a repository under the old name: that is what breaks GitHub's redirects.
- Verify, do not assume: push an empty commit to the still-open arc-5 PR branch (the workflows run on `pull_request`,
  not on `push`). Required for **that sha**: the PR-gate workflows complete successfully; a Workers Builds check
  appears and is green, from the `yacana` Worker; `gh stack view` still shows the stack with the right bases; branch
  protection **settings** equal the record (its name-bearing URLs change by definition); the owner confirms the Cloudflare GitHub App's repository selection shows `yacana`.
  Whether Workers Builds stores the repository by name is undocumented (**unverified**): if no build appears, the
  owner reconnects the repository in the dashboard (C1's token is already revoked).
- Then the owner merges arc 5, and the plan is closed (§8).

Revertable **top-down**; arc 0 alone is independent. Arc 1 is reviewed as "read the maps, the guards and the codemod;
trust the codemod for the ~620 lines", with the unchanged bundle manifest attached. Arc 0's PR body opens with the
Workers Builds cutover (A1); arc 3's says the Cloudflare check is expected red until that edit.

At Delivery, on the arc-3 and arc-4 heads: `gh workflow run e2e.yml --ref <branch>` (dispatch-only, and it holds
command lines no local gate and no PR executes) and `gh workflow run harness.yml --ref <branch>` (the PR runs `flip`
alone; the dispatch runs the six default headless cases, `browser` and `origin` stay local).

`main` moving: `gh stack sync`, then `bun implementations-plan/monorepo-layout/codemod.ts`, then both guards, before
anything else.

## 8. Post-implementation

Executed by the implementing session from this file.

**Per arc, at its boundary, before `gh stack add <next-branch>`:**

1. `/code-review` is **off** for this plan. Do not run it.
2. Codex audit: `/codex high` with the arc's diff (`git diff <arc-base>..HEAD`), this `plan.md`, the ledger (§10), the
   arc map ("this is arc N of 5; later arcs will build X on it", from §7, so seams reserved for later arcs are not
   reported as dead code), the adversarial ask ("What could go wrong? What would an attacker target? What are we
   trusting that we shouldn't? Where are the supply-chain, crypto and least-privilege weaknesses?"), and both rules
   below verbatim.
3. Fix loop: check each of codex's factual claims against the repo first; apply the accepted fixes; commit; log the
   round (consult and verdict) in `lessons/phase-N.md`; **resume the same codex session** with the fix diff and both
   rules and ask for a re-review. Repeat until a round yields no new material finding (rejected nitpicks are not
   churn). Still material after 3 rounds: stop and surface to the owner.

**After all six arcs are green and looped:** one final cross-arc pass: a **fresh** codex session over
`git diff 06b25d7..HEAD` with the cross-arc ask (seams between arcs, duplication across arcs, drift from this plan)
and both rules; same loop until clean.

**Then, and only then, Delivery:** `gh stack sync` if `main` moved, `gh stack submit --auto`, `gh pr edit` each body,
the two workflow dispatches of §7, `gh pr checks --watch` (the Cloudflare check on arcs 3–4 is expected red until the
owner's A1 edit: report it, do not fix it). No PR, not even a draft, exists before this step. `gh stack merge` is
never run by the agent.

The no-over-engineering rule (verbatim in every codex prompt, initial and resumed): *"Report bugs and small, targeted
improvements only. Do not propose speculative abstractions, extra configuration surface, new layers, or rewrites — the
smallest change that fixes each real problem. If code works and is clear, leave it alone."*

The comment-quality rule (verbatim, same prompts): *"Audit the comments for value per character. Flag any comment that
narrates what the code visibly does, restates its line, references implementation plans / phases / reviews, or spends a
paragraph where a sentence works — and flag places where a non-obvious invariant or constraint deserves a comment it
doesn't have. Comments are permanent context every future reader, human or LLM, pays to re-read: they must be few,
dense, and exact."*

**Dispositions for an autonomous session:** never idle waiting for input; a decision that would normally go to the
owner goes to `/codex high` and is logged; the same step failing 5 times means reassess with codex; hard limits stay
hard (never merge, never deploy to production, never touch Cloudflare or rename the repository outside steps C1 and
C2 of §7, which need the owner present, never expand scope past this file). Long runs
go in `tmux`. Refresh the manifest at every gate: `agent-worktree status monorepo-layout "<phase> green: <next>"`.

**Closing the plan** happens in the merge-day session, after C1 and C2 (§7) are done and criterion 8 holds, never in
the autonomous session that delivers the PRs. On the top arc's branch, before the owner merges it: an `## Outcome`
block right after the front matter
(date, status, PRs, what was dropped, one line retiring the seeds); promote the generalizable lessons into
`implementations-plan/lessons.md`; move open follow-ups into `implementations-plan/follow-ups.md`; after the stack
merges, `git mv` this folder into `implementations-plan/archive/` in its own commit and move the index line.

**Post-implementation hardening:** none scheduled. The change adds no trust boundary; `/harden` belongs before a release.

## 9. Competing outline: move first, alias instead of `exports`

1. `git mv` everything into the four folders on day one; fix what breaks.
2. No `exports`. One `paths` block in a base `tsconfig`, mirrored as a Vite `resolve.alias`; imports become
   `@yacana/miner-core/src/reader.ts`.
3. No `web-kit`: `site` stays whole under `apps/`, `Route` types move to `ui`. No `localnet`: `scripts/run` stays a
   root folder, exempt from the rule.
4. One guard (no relative escape). No layout guard; rely on CI going red.

For it: fewer new packages, the visible result lands first. Against, and why the main plan wins (both auditors agree):
moving first rewrites ~620 imports twice, and the move's worst breakages never go red; `paths` is a second resolution
system four tools must each be told about, and it enforces nothing; `site` whole under `apps/` keeps the
`site ⇄ web-*` cycle, which a layer rule cannot see; `scripts/run` outside the workspace keeps 55 cross-boundary imports
and an `@aztec/*` surface that works only by hoisting.

Taken from it: make config location-independent *before* moving (per-workspace `.gitignore`, `**` Biome negations,
the decoupled Workers Builds settings), and add no package that a smaller cut avoids (no toolchain package, no
path-helper package).

## 10. Decision ledger

### Driver decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D1 | Boundaries before the move | Move first | One rewrite instead of two; the move becomes config |
| D2 | Explicit subpath `exports` to source | `./*`; barrels; `paths` | The list is the API; barrels drag Node-only modules into pages; aliases enforce nothing |
| D3 | Guards as `bun:test` with path resolution | Biome `noRestrictedImports` | A pattern cannot tell `web-miner/src/bridge/` from `packages/bridge/` |
| D4 | `web-kit` and `localnet` created at their final paths | Create under `packages/`, move later | One move fewer |
| D5 | `toolchainBin` throws on an unreadable pin | Keep the `PATH` fallback | The fallback turns pinning off exactly when a path is wrong |
| D6 | Live `miner-core` tests move to `deploy` | A dev-only cycle | They test a deployment; approved scope says the cycle goes |
| D7 | No shared repo-root helper | `packageDir()` in a new package | Depth is preserved; production code may not import `tools` |
| D8 | A test-only fix outside §2, as its own commit before P0.1: `history-transport` holds a lease on the fetch guard | Carry one known `bun test` failure as the baseline | Root `bun test` was red on `main` (the Presto suite arms the one-way guard, the next file's server is refused); a baseline that exits 1 hides every later failure. `lessons/phase-0.md` §1 |
| D10 | The bundle gate becomes `bundle-compare.ts` with per-page and per-Worker module inventories (§3.10, amended) | Byte-identical manifests; a size tolerance; an order-preserving codemod | Identity is unattainable once Biome re-sorts ~600 rewritten imports. Codex (session `01a0c475`, high confidence) rejected a size tolerance as proof (0.1 % of the miner's chunk is 4.9 KB; the Node polyfills make a green build weak evidence against Node leakage) and asked for the module inventory, which answers "did anything new reach a page" better than a hash did. Its wider point, that re-sorting named imports can reorder transitive evaluation, is answered by an audit, not by the gate: only `node-guard`, `pinned-crs` and the Worker's shim patch globals at import, and every page entry and the Worker pin them as leading side-effect imports, which Biome never moves (`lessons/phase-1.md`) |
| D9 | `verify()` classifies on bb's diagnostic against a closed list, not on exit status plus diagnostic as P0.1 words it | Exit status as the discriminator | bb 5.2.0 exits 1 for a refusal and for an unreadable input alike (observed, `lessons/phase-0.md` §2); an unlisted diagnostic is operational, so a new bb wording stops the run |
| D11 | A test-only fix outside §2, as its own commit in arc 1: the assembled-site spec reaches the old origin from Node through `localhost` | Skip `site:e2e` on hosts without a `*.localhost` resolver rule; edit the host's resolver | Chromium resolves `*.localhost` itself, Node asks the host, and this one fails the lookup (`ENOTFOUND v5.localhost`), so the arc-end gate could not run; the same Worker answers on `localhost`, and the browser half of the spec still visits the named origin |
| D12 | A test-only fix outside §2, as its own commit in arc 2: `bridge-snapshot`'s opacity check asserts on the field name and the whole figure, not on two digits | Carry a FAST gate that fails about one run in three; rerun until green | The stored JSON is a random IV and ciphertext in base64, in which `48` appears by chance (seen twice in four runs); the fix keeps the property under test (the plaintext is not at rest) and removes the coin toss |
| D13 | P3.3's grep exempts one line of `docs/deployments.md`: "Until the cutover both triggers still hold root directory `packages/site`" keeps the old literal | Rewrite it to `apps/site` (false: the dashboard holds the old value until C1) or paraphrase the value away (a reader doing the cutover needs it exact) | The line quotes a Workers Builds setting, not a repository path; it is true until C1 and C1 deletes it (§7) |
| D14 | The cross-arc pass's fixes land on the top branch of the stack (arc 5), not on the arc each finding was born in | Amend or fix up the lower branches and cascade with `gh stack sync` | The findings are about the finished tree (a filter against the moved folders, two guard gaps); rewriting four pushed branches to place them re-runs every arc's gate for no reader's benefit, and the stack lands bottom-up within one merge day, so no interval exists in which `main` holds the gap without the fix above it |

### Audit findings: adopted

| Source | Finding | Change |
|---|---|---|
| fable C1, codex 3 | Moved tests leave CI silently; `bun test a b` ignores a dead filter; four toolchain workflows, not three | §3.4 (c), §3.11 names every line, §4 |
| fable H1 | The layout guard landed after the moves it guards | P1.5 |
| fable M-d, codex 3 | A live glob does not prove dependency coverage | §3.4 (d) |
| fable H2 | `vite.config.ts` bare imports make the ambient Node part of the build contract; the fallback could not cover it | §3.1: the config-time graph stays relative |
| codex 2, fable H3 | CSS `@import`/`@source` cross workspaces; `@source` fails silently | `ui` exports `./theme.css`; rule 1 covers CSS; layout guard checks `@source`; bundle manifest; `test:visual` in HEAVY+ |
| codex 5, fable H4 | `sweep.ts` regenerates the fixture proof; `mutation.ts` passes on a crash and needs a witness it never makes; gate order compiled before codegen | P0.1; `prove.ts` kept; Facts 9–10 |
| fable S7 | WASM/native byte equality is part of the determinism evidence | `check:wasm` kept (A2); `work-circuit` keeps `bb.js`/`noir_js` |
| codex 1, fable M1 | P1.1 broke six existing specifiers before its gate; the optimizer criterion was vacuous on `build` | P1.1 rewrites them; dev-server smoke |
| codex 7, fable M2 | Hand-rolled scanner; `scanImports` drops type-only forms | `ts.preProcessFile`, shared with the codemod; grep cross-check dropped |
| fable M3, codex 4 | Unowned relative targets; prod vs dev block; no cycle test; `web-kit ⇄ web-miner` dev cycle | Rule 1 exempt list; rules 2 and 4; `pinned-crs.ts` moves to `web-kit` |
| codex 8, fable H5/M4 | `document` check cannot fail under `lib: DOM`; `tsc -b` goes stale across workspaces | `tsc -b --force`; `types`-axis regressions; stale-green and file-coverage checks |
| codex 4, fable S3/M5 | "By construction" overclaimed; no evidence the bundle is unchanged | §3.3 wording; rule 3's target-class clause; bundle manifest |
| codex 10, fable M7 | `commit-artifacts.ts` is protocol's | → `contracts/scripts/` |
| codex 10, fable L3 | `site.env` is deployment config | → `deployments/site.env`, surfaced as A6 |
| fable M8 | Hook reformats artifacts inside the "pure rename" commit; ignores go stale | P1.5 makes both location-independent; `git status` after HEAVY |
| codex 6, fable S8/M10 | A1 was a post-merge fix; previews break first; revert coupling | A1: decoupled settings after arc 0; expected-red note; P0.2 |
| codex 11, fable M9 | Arcs are not independently revertable; the codemod is needed after every sync; dispatch-only workflows never run | §7 wording; codemod committed with the plan; two dispatches at Delivery; A5 |
| codex 9 | Pinning and lockfile wording overstated; bare `aztec-nargo` in `determinism.ts` | §4; arc 0 row |
| fable L1, codex Facts | Five edges; `bridge` has `main`; 622 specifiers; root is an importer; `web-stats` exports 2; `web-kit` npm deps | §5, §3.2 |
| fable L2, L4, L5, L8 | `Hashes.t.sol:14`; `tsconfig.tests.json` include, `pinned-node.mjs`, `rig.ts`; archived doc text; frozen install in gates | §3.5–3.7, P3.3, gates |

### Audit findings: rejected or deferred

| Source | Finding | Disposition |
|---|---|---|
| fable M6 | Move pin resolution under `protocol`, merged with `work-circuit/scripts/toolchain.ts` | **Deferred** (follow-up). It needs a third new workspace or makes `work-circuit` own `aztec-forge` lookup for `portal`. The fail-open copy is fixed in place; `portal:build`/`portal:test` join P2.2's gate; §3.6's wrong justification is corrected |
| codex 4 | Browser entry-point reachability check incl. Workers and dynamic imports | **Deferred**. An enduring graph walk is a new control, not part of a no-behaviour-change refactor. Rule 3's target-class clause plus the bundle manifest cover this plan |
| fable H2 alt | Pin Node ≥ 22.18 in repo, CI and Workers Builds | **Deferred**. Keeping four imports relative removes the dependency entirely; pinning Node is worth doing on its own |
| fable L7 | Guard line forbidding `deploy/src` from importing `harness`/`localnet` | **Deferred**: new policy, not layout |
| fable L2 alt | Move `bridge-vectors.json` under `protocol/` | **Deferred**: touches the three-way vector pipeline |
| codex FAST | Run affected checks per phase, full FAST at arc ends | **Rejected**: the owner chose FAST on every phase at Phase 0. Its cost is measured in P0.1 (I6) and surfaced if unreasonable |
| codex 11 | Coordinate a short integration window | **Surfaced** as A5 rather than assumed |

### Final codex pass (fresh session): reject on sequencing, structure upheld; all adopted

| Finding | Change |
|---|---|
| The bundle baseline could not run: the assembler refuses a non-production build in `dist` | §3.10: a production build with fixed inputs, sha256 of every file |
| Coverage inverse checked membership, not that a PR lane triggers and does not skip; `work-circuit.yml` filters on the test file alone; the toolchain suite can skip | §3.4 (c) requires a `pull_request` workflow; new rule (e) names the critical lanes |
| The layout guard could not pass on a clean baseline (`e2e.yml` upload paths are generated) | §3.4 (b): closed list of command forms, outputs checked by owning folder, unsupported forms fail |
| P1.4 banned the three `/// <reference path>` that P1.3 kept until P2.1 | Rule 1's exempt list carries them until P2.1 |
| P3.1 ran the guards while CI paths waited for P3.2 | CI moves in P3.1; P3.2 is the mechanical-diff proof |
| The assembler imports `web-kit`'s scripts, which rule 3 forbade | One listed exception, three edges |
| "Every file in exactly one project's file list" is impossible when projects follow imports | Root-file ownership instead |
| A1 protects `main`, not branches cut before arc 0 | A1 says so; the dry-run gate repeats after the move |
| P0.1 never tested operational-failure classification; `sweep.ts:40` also calls bare `aztec-nargo` | Three outcome classes, three negative controls, pinned `aztec-nargo` in all kept scripts |
| FAST's accounting forbade added tests; "typecheck alone" read as dropping lint and tests | §6 wording |
| `harness.yml` is not dispatch-only; Fact 20 had exceptions; Fact 22 partly unverified; "removes the dependency entirely" overstated | Facts 20, 22–24; §3.1; §7 |

Its ledger re-evaluation: deferring the resolver merge, the reachability check and the Node pin is reasonable; rule
(d) earns its keep alongside explicit critical lanes; the bundle manifest is proportionate; `site.env` belongs under
`deployments/`; keep the owner's FAST.

**Resumed pass on the fixed plan: `conditional approve (with conditions: correct the production bundle pin, verifier
negative controls, shared declaration coverage, and local tsc invocation)`**, "no architectural blocker remains". All
four conditions are folded: §3.10 pins the commit through `GITHUB_SHA` (a production build ignores
`VITE_SOURCE_COMMIT`); P0.1 unit-tests `verify()` directly for a tagged operational error; P4.1 allows listed ambient
`.d.ts` roots in several projects; `bunx tsc`. Its factual note (the harness dispatch runs six headless cases, not
all) is in §7.

### Owner decisions at the gate (2026-09-21)

| Item | Decision |
|---|---|
| A1 | The agent runs the Workers Builds cutover with a temporary, least-privilege token, owner present (§7 C1). The listing and update endpoints and the permission name come from Cloudflare's Workers Builds API reference and `docs/deployments.md:103`; the non-production trigger cannot be edited from the settings page at all, so the API is needed either way |
| A2, A3, A6 | As proposed |
| A5 | Rebase; the owner will try to keep `main` still |
| A7 (new scope) | Rename the GitHub repository to `yacana`: arc 5 (three references, one guard exemption) and step C2. The local clone folder keeps its name |

### Codex on the owner's delta (same session, resumed): reject, all adopted

| Finding | Change |
|---|---|
| `$(< file)` into a `curl -H` puts the token in `argv`; full trigger responses may hold build variables | A throwaway Bun client reads the file and calls `fetch`; output redacted; the rollback record holds uuids, branch patterns and three fields only; revoke and delete on every exit path |
| "Cannot deploy or read secrets" was unsafe reasoning | §4 and C1 call the token indirect production authority; the field restriction binds the client, not a thief |
| Listing three Workers then patching "each trigger" would push apex commands onto `yacana-v5` and `www` | C1 changes the apex Worker's two triggers only; the others are listed and need a separately approved mapping; status checked per call, stop on first failure, rollback only where our value still stands |
| C2's verification was imprecise; "same token" contradicted C1's revoke; an old-name placeholder would kill redirects | Push to the open arc-5 PR branch, require green runs for that sha from the right Worker, check the stack, branch protection and the GitHub App's repository selection |
| Seeds demanded HEAVY at arc 5 and closed the plan before criterion 8 | "Where §6 specifies"; closing moved to the merge-day session |

Resumed once more on the fixed steps: **`approve`**, "no remaining blocking issue in the revised scope"; three
clarifications folded (compare branch-protection settings, not URLs; an output allowlist instead of redaction, and
the rollback file mode 600; §4's rename wording).

### Approval

The owner approved on 2026-09-21 by deciding the Asks, adding A7 and setting the `/goal`. The goal they set is the
pre-amendment seed (P0.1–P4.2, five PRs); this file is authoritative and adds arc 5, so that goal's condition is a
subset of what is delivered.

### Unresolved

None blocking. Every execution outcome (I1–I6) and Workers Builds' behaviour on a repository rename are unverified
until their step runs.

## 11. Seeds

Final (approved 2026-09-21). Use exactly one per session; run it **inside this worktree** (`agent-worktree resume monorepo-layout`).

Recommended, `/goal` (every completion signal is visible in the transcript):

```
/goal All phases P0.1–P5.1 are marked ✓ in implementations-plan/monorepo-layout/plan.md (the phase headers in the file — not the chat, not the task list), each ✓ backed by that phase's validation gate as written in plan.md §6 reported passing in the transcript (FAST on every phase; HEAVY or HEAVY+ where plan.md §6 specifies an arc end, with the bundle manifest diff shown; every deliberate-regression check shown failing, then reverted); for each phase the agent has printed `LESSONS_FILE=implementations-plan/monorepo-layout/lessons/phase-N.md`; `/code-review` was NOT run (plan.md says code_review: off); the codex fix loop converged for each of the six arcs at its boundary and for the final cross-arc pass, each convergence evidenced by a resumed codex pass reporting no new material findings, quoted in the transcript; the six stacked PRs of plan.md §7 exist on GitHub, created only after all loops converged (`gh stack view` output in the transcript), and e2e.yml and harness.yml were dispatched on the arc-3 and arc-4 heads; `bun run lint`, `bun run typecheck`, `bun test` and `bun run lint:actions` all report exit 0 in the transcript. Nothing was merged, nothing was deployed to production, no Cloudflare setting was touched and the repository was not renamed (steps C1 and C2 of plan.md §7 belong to the merge-day session with the owner present, not to this one); a red Cloudflare check on arcs 3–4 was reported, not fixed.
```

Alternative, `/loop`:

```
/loop 15m Drive implementations-plan/monorepo-layout forward. Never idle waiting for my input. Each firing:
1. Reality check: read implementations-plan/monorepo-layout/plan.md and lessons/ (authoritative — not the chat). If that path is gone, look for implementations-plan/archive/monorepo-layout/plan.md: the plan closed, STOP and say so. If plan.md carries an `## Outcome` block, STOP. Otherwise rebuild the task list from plan.md's phase headers if it is empty; run `git status` and `git log --oneline -5`; `gh stack view` once PRs exist.
2. Waiting on CI is fine: confirm it progresses (`gh run watch <id>` up to 10 min), and use the wait to prepare the next phase without touching files the in-flight change owns. A red Cloudflare check on the arc 3–4 branches is expected until the owner's Workers Builds edit: report it, never try to fix it.
3. No task in hand? Take the next pending phase of plan.md §6. After each meaningful edit run the fast layers (`bun run lint`, `bun run typecheck`, `bun test` for the touched workspaces, both guards once they exist). Long runs (HEAVY, the rig, check:proofs, the live tests) go in tmux. Commit small, conventional, signed per this machine's mode; `gh stack push`.
4. Stuck, or facing a decision you would bring to me? Call `/codex high` with full context, go back and forth to a defensible decision, act, and log consult + verdict in lessons/phase-N.md. Hard limits stay hard: never merge, never deploy to production, never touch Cloudflare settings or rename the repository (steps C1 and C2 of plan.md §7 need the owner present), never expand scope past plan.md; if a decision needs one crossed, surface it and hold.
5. Same step failed 5 times? Stop retrying; reassess with codex.
6. Phase green means THE PHASE'S GATE in plan.md §6 passes. Run it in full, paste the result, mark ✓ in plan.md, file the lessons entry, print `LESSONS_FILE=implementations-plan/monorepo-layout/lessons/phase-N.md`, run `agent-worktree status monorepo-layout "<phase> green: <next>"`. Arc boundary (plan.md §7)? Run the arc's HEAVY/HEAVY+ gate, then the arc's codex loop per plan.md §8 (code_review is off: do not run /code-review) until a round yields nothing material, THEN `gh stack add <next-arc-branch>`.
7. main moved? `gh stack sync`, then `bun implementations-plan/monorepo-layout/codemod.ts`, then both guards, before anything else. A sync that costs more than one attempt: surface it.
8. All phases ✓? Final cross-arc pass per plan.md §8 (fresh codex session over `git diff 06b25d7..HEAD`), loop until clean. Then Delivery — the first time any PR is opened: `gh stack sync`, `gh stack submit --auto`, `gh pr edit` each body (arc 0's opens with the Workers Builds cutover, arc 3's with the expected-red note), dispatch e2e.yml and harness.yml on the arc-3 and arc-4 heads, `gh pr checks --watch`. Do NOT close the plan: steps C1 and C2 of §7 and the Outcome block belong to the merge-day session. Write the wrap-up: what shipped, every decision codex and I debated with its ELI5 context, open items. Surface and stop.
```
