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
