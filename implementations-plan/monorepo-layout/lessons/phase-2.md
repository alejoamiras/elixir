# Phase 2 lessons: cycles out

## P2.1 `web-kit`

31 files moved with their history (`git mv`): from `site`, `config`, `headers`, `vite-base` and their tests, the
eleven `browser/` modules with theirs, three prebuild scripts and `crs.lock.json`; from `web-miner`, `pinned-crs`
and the `detect-node` shim; `commit-artifacts.ts` to `contracts/scripts` (it writes protocol's output) and
`site.env` to `deployments/` (A6). Then 100 files rewritten: 81 importers of `@yacana/site/*` → `@yacana/web-kit/*`,
the three Vite configs' path import, the three apps' `vite-env.d.ts` to `/// <reference types="@yacana/web-kit/vite-env" />`
(I2 holds: the `types` condition resolves under `moduleResolution: bundler`, all three app typechecks pass, and
`web-miner/tsconfig.tests.json` no longer reaches into another package), the miner's five `./pinned-crs` imports,
`assemble.ts` / `artifact.ts` onto the package name, the boundary guard's PATH_EDGES (three `reference` exceptions
gone, the three config-time edges renamed).

`site` keeps assembly, the artifact contract, the e2e and the Workers; its manifest loses `exports` and the Vite
plugins. Graph now: apps → web-kit → {miner-core, bridge, ui}; site → apps + web-kit; `web-kit` dev-depends on
`contracts` for `COMMITTED`, `web-miner` too for its replay setup. `idb-keyval` moved with `pinned-crs` (it resolved
in the old place only through hoisting, which is the kind of dependency the boundary rule exists for).

The guards drove the rest, in this order:
- boundaries: `@yacana/web-kit` was "no such workspace" until `git add` (the guard reads tracked files); two files
  imported their own package by name (now relative); `web-miner/e2e/replay/setup.ts` needed `contracts` declared.
- layout: the seven moved `bun:test` files ran in no lane, three of them the critical CSP/guard/config suites —
  the exact failure the plan predicted for this phase. `web-kit.yml` added (its filter: the workspace, its closure,
  `portal/abi/**`, `deployments/**` for `site.env`); `packages/web-kit/**` added to the four lanes whose workspace
  depends on it. Then 18 pass.

The bundle comparer needed one more thing: an `old=new` map for a single file, not only a folder
(`pinned-crs.ts` and `detect-node.ts` moved on their own, `crs.lock.json` sits above `src/`).

**The artifacts gate found a stale committed artifact, and it is arc 0's.** `bun run artifacts:commit && git diff
--exit-code` differs in `work-circuit/artifacts/yacana_work.json` by its `hash` field alone (bytecode, ABI, debug
symbols, file map identical). That hash covers the Nargo workspace, and arc 0 (`9b9be03`) removed the sweep crates
from it; the local target was compiled after that. `contracts.yml` runs the same diff, so the arc 0 PR would be red
on it. Fixed on the arc 0 branch and cascaded through the stack (below), not here. **Lesson: a gate a later phase
runs can catch an earlier arc; run every diff-style gate at every arc end, HEAVY-scoped or not.**

### P2.1 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · 527 pass · 42 skip · 0 fail |
| the layout guard on the moved tests before their lane existed | failed: seven `packages/web-kit/**` test files orphaned, the three critical suites unwatched; then `web-kit.yml` |
| both guards after | 18 pass |
| `bun test packages/web-kit packages/site packages/contracts` | 85 pass, 0 fail |
| `bun run artifacts:commit && git diff --exit-code` | **red on arc 0's stale hash** (above); green once the arc 0 fix is in |
| `bun run site:build` + bundle comparison | no findings: 651 files, seven inventories identical with the moved ids mapped, the prover Worker chunk byte-identical |
| `bun run lint:actions` | exit 0 |
| `bun.lock` diff | workspace entries and `packages/web-kit`; one npm entry re-keyed (`estree-walker@2.0.2` under two nested paths, same version and integrity) because `site` dropped the Vite plugins |

## P2.2 `localnet`

15 files moved with their history: the twelve `scripts/run/*.{ts,mjs}` to `tools/localnet/src/`, the three shell
scripts to `tools/localnet/bin/`. `tools/*` is a workspace root; `@yacana/localnet` exports the eight modules
§3.6 names and declares the twelve `@aztec/*` packages and `viem` its sources import, at the versions `deploy`
and `harness` pin. 46 files rewritten: 45 relative imports became `@yacana/localnet/<module>` (registry 13,
toolchain 10, upgrade-rig 9, port-window 6, preview 5, presto 2, control 2), the root scripts (`e2e:agent`,
`rig`, `lint:shell`), the root `tsconfig` include, seven workflows and both composite actions, the comments that
named the old path. Seven workspaces declare it: `harness` under `dependencies` (`src/yacana.ts`), the other six
under `devDependencies` (scripts, e2e setups, Playwright configs).

The two depth fixes of §3.6: `repoRoot` is derived once in `toolchain.ts` (three levels up now) and `presto.ts`
and `registry.ts` import it; `upgrade-rig.ts` finds `pinned-node.mjs` next to itself instead of by a repo path.
`toolchainBin(name, root = repoRoot)` throws on a pin it cannot read, an empty one and a malformed one, instead of
handing back the bare name for `PATH` to resolve. `agent.sh` and `typecheck-all.sh` go up three. Missed by the
sweep and caught by the first test run: `toolchain.test.ts` reached the lock and the pin two levels up by its own
relative paths; it takes them from `repoRoot` now.

The layout guard read the move as the plan said it would: the three toolchain lanes watched
`tools/localnet/src/toolchain*.ts` (a file glob for what is a workspace now) and `registry.test.ts` ran nowhere
(it had ridden on `miner-core.yml`'s `scripts` argument). All four toolchain lanes watch `tools/localnet/**`;
`miner-core.yml` runs `tools/localnet` as well.

One FAST run failed on `bridge-snapshot.bun.test.ts`, a test this phase never touched: "opaque at rest" asserted
that the stored JSON does not contain `48`, and the JSON is a random IV and ciphertext in base64 (`w48QTIs…`).
Two of four reruns failed. Fixed as its own commit, ledger D12: the check asserts on the field name and the whole
figure. **Lesson: an assertion about random bytes is a coin toss with a delay; it fails on the arc that happens to
flip it, not the one that wrote it.**

### P2.2 gate (2026-09-21)

| step | result |
|---|---|
| FAST | first run: 531 pass · 1 fail (the coin toss above); after D12: exit 0 · **532 pass · 42 skip · 0 fail** (527 + the five localnet cases) |
| layout guard | 18 pass; regressions: a toolchain lane watching the resolver file instead of the folder (`portal.yml: … filter lacks tools/localnet/**`), a lane not running the toolchain test (`contracts.yml does not run tools/localnet/src/toolchain.test.ts`); both reverted |
| `bunx tsc -p tools/localnet --noEmit` | exit 0 |
| `bun run lint:shell` · `bun run lint:actions` | exit 0 · exit 0 |
| `bun install --frozen-lockfile` + lock diff | no changes; the diff is workspace entries and `tools/localnet` |
| unit tests | `toolchainBin` throws on a missing (`cannot be read`), empty and malformed pin and on an uninstalled version; `repoLocalAgentsDir` is `<repo>/.localnet/agents`; 13 pass |
| `bun run portal:build && bun run portal:test` | ok · 74 passed |
| `bun run e2e:agent -- true` | a network ready in 28 s, torn down |
| `bun tools/localnet/src/isolated-node.ts --smoke` | SMOKE OK |

## P2.3 Remaining edges

`miner-core/src/{live,reader.live}.test.ts` → `deploy/tests/`, with history. They test a deployment (they call
`deployYacana`), so they belong to the workspace that deploys; their ten `miner-core` imports go through the package
name (every module was already exported), their two `deploy` imports become relative, and `miner-core` loses its
only `devDependency`. The graph's last production-adjacent cycle (`miner-core → deploy → miner-core`, dev) is gone.
`bridge → portal/abi` and `harness → web-miner/e2e/*` were declared in P1.2. `CLAUDE.md`'s command line for the
live suite names `packages/deploy`; the threat-model rows say "the live suite", which is still its name.

`contracts:test` failed on the first run with `Failed calling external resolver. Request timeout` after 316 s per
test, four tests in: the TXE's oracle timing out while FAST, the live suite and the TXE shared a box at load 80. No
Noir changed in arc 2 (the P0.1 gate ran the same suite in 36 s). Rerun alone, below. **Lesson: a suite with an
internal timeout is a load gauge; run it alone before reading it as a failure.**

### P2.3 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · 535 pass · 42 skip · 0 fail |
| both guards | 18 pass |
| `bun run --filter '*' typecheck` (I4) | exit 0, every workspace with the script |
| `bun run e2e:agent -- bun test packages/deploy` | 25 pass · 1 skip · 0 fail in 620 s; the skip is `example-claim.test.ts`'s testnet case (no testnet env), the two moved suites ran whole: five proofs, eight claims, the burst (4 accepted, 4 stale) |
| `bun run contracts:test` | first run red on the oracle timeout above (four tests at 316 s each); alone: exit 0, **74 + 7 passed in 39 s** |

## P2.4 Direction and cycles

Rules 3 and 4 on the boundary guard, 21 tests now. Direction: a production file (`isProduction`) imports its own
layer or below (`apps` 3, `packages` 2, `protocol` 1), never a `tools` workspace, and never a subpath whose export
target sits under the owner's `scripts/`, `e2e/` or `tests/`; `site/src/assemble.ts` is the one listed importer of
`web-kit/scripts/*`. The layer is a name table in the test until arc 3 puts the workspaces in their folders; a
workspace missing from the table is a failure of its own. Cycles: depth-first over `dependencies`, the cycle
reported as the names around it. Both pass on the tree as it stands, which is the point of arcs 2's first three
phases: `apps → web-kit → {miner-core, bridge, ui}`, `site → apps + web-kit`, `bridge → miner-core, portal`.

A read-only pass over the workflows' filters against the dependency closure of what each lane tests found five
globs that only the `site ⇄ web-*` cycle had required: `site.yml`'s `web-landing`, `web-miner.yml`'s `site` and
`web-stats`, `web-stats.yml`'s `site` and `web-miner`. Pruned. `contracts.yml` and `harness.yml` still watch the
apps and the whole protocol beyond their closure, on purpose: they build and run them (the replay recording, the
rig), which no `dependencies` edge says.

### P2.4 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · 535 pass · 42 skip · 0 fail |
| regression: an app's production source importing `@yacana/deploy` | failed: `web-stats/src/beats.ts:1 imports @yacana/deploy, a tool, from production code` (and the declaration rule); reverted |
| regression: production source importing another workspace's `scripts/` subpath | failed: `web-landing/src/App.tsx:1 imports @yacana/web-kit/scripts/copy-slots, which is @yacana/web-kit's ./scripts/copy-slots.ts: not production code`; reverted |
| regression: a same-layer production cycle (`miner-core → bridge`) | failed: `["@yacana/bridge", "@yacana/miner-core", "@yacana/bridge"]`; reverted |
| both guards after the prune · `lint:actions` | 21 pass · exit 0 |

## Arc 2 HEAVY (2026-09-21)

| step | result |
|---|---|
| `test:replay` | 4 passed |
| `site:build` + bundle comparison | 651 files, seven inventories identical with the moved ids mapped (`packages/site=packages/web-kit`, the two single files); **one delta, explained**: `artifacts/yacana_work.json` differs from the baseline build in its `hash` field alone (`1072…` → `9160…`), the committed artifact arc 0's fix refreshed (`2a85076`); bytecode, ABI, debug symbols and file map identical |
| `site:e2e` | 3 passed |
| cockpit shard, proverless | 7 passed; RSS 1440 → 1470 MiB (+30, peak 1768) |
| web-stats e2e | 7 passed |
| web-landing e2e | 5 passed |
| `bun run rig -- flip` | 1 pass, H0 in 64 s |
| `git status --porcelain` | nothing untracked but this arc's own reports |

The cockpit's memory test passed here this time, +30 MiB against the +846, +900 and +671 of arc 1's three runs
on the same host. So "192 threads" was at best part of the story: the failure is intermittent on this machine
(load was 63 falling from 157 during this run; arc 1's ran at 80). The reading of arc 1 stands — the failure
predates this work and CI is where the bound holds — and the follow-up entry gains a fact: it is a flake here, not
a constant. **Lesson: one green run does not retire an intermittent failure; the baseline comparison did the work.**

## Arc 2 codex fix loop

### Round 1 (2026-09-21) — "Changes requested: two material findings"

Codex (GPT-6 Astra, `high`, read-only) reviewed arc 2's diff against arc 1's head with the two guards' rules and
plan §3.2 in the prompt. Both findings hold; both fixed.

1. **Rule 3 accepted conditional exports into forbidden directories.** The guard read an `exports` target as a
   string and turned any object into `''`, so `"./scripts/copy-slots": {"import": "./scripts/copy-slots.ts"}`
   imported from `web-landing/src/App.tsx` passed where the string form is refused. Fix: `ExportTarget` (a path,
   an array of fallbacks, or a map of conditions) and `exportPaths()` in `workspace-graph.ts`, every path an entry
   can resolve to; rule 3 flags an import if any of them is not production code. Replayed codex's exact input:
   the guard fails with `App.tsx:1 imports @yacana/web-kit/scripts/copy-slots, which is @yacana/web-kit's
   ./scripts/copy-slots.ts: not production code`; restored, 21 pass.
2. **`web-kit`'s manifest relied on hoisting.** `browser/node.ts` and `eth-rpc.ts` import `@aztec/aztec.js`,
   `@aztec/foundation` and `viem` undeclared; `copy-artifacts.ts` resolved `@aztec-foundation/aztec-standards` from
   the repo root and `vite-base.ts` read `@aztec/bb.js`'s manifest from the root `node_modules`; `contracts`
   resolved the standards artifact through `../../deploy`, against plan §3.2. Fix: the three production imports
   under `dependencies`, standards and bb.js under `devDependencies` (web-kit), standards under `devDependencies`
   (contracts); both scripts resolve from `import.meta.dir`. bb.js exports no `./package.json`, so
   `bbVersion()` resolves the package's entry and reads the first manifest above it — the earlier
   `require.resolve('@aztec/bb.js/package.json')` attempt failed the proverless-marker bundle test with
   `ERR_PACKAGE_PATH_NOT_EXPORTED`. Lock diff: the five declarations, nothing else; `bun install --frozen-lockfile`
   passes.

Also swept: an unused `resolve` import left in `tools/localnet/src/presto.ts` by P2.2 (Biome warning).

| step | result |
|---|---|
| both guards | 21 pass |
| regression replay (object-form export, then restored) | exit 1 with the rule-3 message · exit 0 |
| `token-artifact.ts` · `copy-artifacts.ts` from their own dirs | both find the artifact, `target/` unchanged |
| FAST (lint, six typechecks, `bun test`, components) | all ok; `bun test` 107 s |
| `lint:actions` · web-kit typecheck | exit 0 · exit 0 |

### Round 2 (2026-09-21) — "Changes requested: two defects reproduced"

Both real; both mine from round 1.

1. **`bbVersion()` read the wrong manifest.** The first `package.json` above bb.js's resolved entry
   (`dest/node-cjs/index.js`) is `dest/node-cjs/package.json`, `{"type":"commonjs"}` — so the walk-up returned
   `undefined`, into `VITE_BB_VERSION` and the Settings row, and FAST stayed green because nothing asserted the
   value. Fix: walk up to the manifest whose `name` is `@aztec/bb.js` and validate its `version`; exported and
   pinned by `web-kit/src/vite-base.test.ts` to the version the manifest declares (`5.2.0`). **Lesson: a value
   only a page displays needs a test the moment its source changes; the build cannot tell `undefined` from a
   string.**
2. **A `null` export target crashed the guard.** `{ browser: null, default: './src/config.ts' }` is valid
   metadata (the subpath withheld under a condition) and `Object.values(null)` throws. `ExportTarget` admits
   `null`, `exportPaths` yields nothing for it; a fixture test covers nested conditions, arrays, withheld
   branches.

Noted, pre-existing (not a regression, logged in `follow-ups.md`): `web-kit/src/browser/node-guard.test.ts:248`
loads bb.js's browser WASM loader through the root `node_modules`, a subpath the package does not export.

| step | result |
|---|---|
| both guards + web-kit's tests | 90 pass across 10 files |
| `bbVersion()` | `5.2.0` |
| FAST | all ok; `bun test` 98 s |
| `lint:actions` | exit 0 |

### Round 3 (2026-09-21) — "no new material findings"

Codex re-ran both guards and the new version test (23 pass), probed `bbVersion()`'s two throws in memory, and
found nothing regressed by `92781c0`. **Arc 2's loop converged in three rounds** (session
`01a0c50b-59f7-7a23-9778-12873e597ac5`). Score: 4 findings in 2 rounds, all
real, two of them mine from round 1's fix — the second-round pair is the price of fixing under review without a
test for the value fixed.
