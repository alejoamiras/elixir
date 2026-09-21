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
