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
