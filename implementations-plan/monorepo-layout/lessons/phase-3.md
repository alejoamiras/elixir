# Phase 3 lessons: the move

## P3.1 Move and re-point

Commit 1 (`4200631`): nine `git mv`s, 501 renames and nothing else — `web-miner`, `web-stats`, `web-landing`,
`site` → `apps/`; `work-circuit`, `contracts`, `portal` → `protocol/`; `deploy`, `harness` → `tools/`. The
directory renames carry the ignored build output (`target/`, `dist/`, per-workspace `node_modules/`) with them,
so nothing had to be recompiled for the tree to work.

Commit 2: the path map (`packages/<moved>` → its folder) over every tracked non-documentation file (66 files:
12 workflows, the root manifest and `tsconfig`, the guards, the codegen, 40-odd scripts and tests), plus what the
map cannot see:

- Split forms: `resolve(repo, 'packages', name)` in `assemble.ts` and `render-surfaces.ts` (→ `'apps'`),
  `'packages', 'contracts'` in `export-vk.ts` (→ `'protocol'`).
- Relative paths that crossed a folder boundary: the three apps' `vite.config.ts` (`../web-kit/…` →
  `../../packages/web-kit/…`, config time, the guard's listed edges), their `@source "../../ui/src"` (→
  `../../../packages/ui/src`), `web-stats/e2e/serve.ts`'s fixture, `miner-core`'s two proof tests and the miner's
  two Presto tests reaching `work-circuit`, `portal`'s `foundry.toml` and `Hashes.t.sol` reading `bridge`'s
  vectors. `contracts`' Nargo path deps (`../../work-circuit/crates/lib`) and `web-kit`'s `../../ui/src/mark.ts`
  keep their depth because both ends moved together or neither did.
- Root manifest: `workspaces` = the four folders; sort-package-json globs; `test:components` filters `apps/*` and
  `packages/*` (`ui` has Vitest specs), `test:e2e` `apps/*`. Root `tsconfig` include: the four folders' `src`,
  `scripts`, `e2e`, `tests` where they exist. `bun install`: the lock's diff as sorted line sets is workspace path
  lines only (0 others); frozen install passes.
- The boundary guard's layer table → the folder (`LAYER = { apps: 3, packages: 2, protocol: 1, tools: 0 }`,
  `layerOf(w)` from `w.dir`). The layout guard's exemption regex `/^packages\/harness\/tests\//` and the rename
  guard's manifest filter `/^(packages\/[^/]+\/)?package\.json$/` escaped their slashes, so the map missed both
  (found by the guards themselves: ten harness suites "orphaned", then a non-`@yacana` name check over one manifest
  fewer). **Lesson: a path map over text misses paths written as regexes; run the guards, they know their own
  inputs.**
- `site.yml` and `web-kit.yml` take `!apps/**/*.md` and `!protocol/**/*.md` back out beside `!packages/**/*.md`
  (the moved folders' READMEs).
- One path my survey missed and FAST found: `presto-prover.bun.test.ts` spawned `../web-kit/scripts/fetch-crs.ts`
  by path; now `Bun.resolveSync('@yacana/web-kit/scripts/fetch-crs', pkg)`.
- `tools/localnet/bin/typecheck-all.sh` deleted (referenced by nothing).
- `.github/actions/setup-presto` already pointed at `tools/localnet` (P2.2); nothing to do.

### P3.1 gate (2026-09-21)

| step | result |
|---|---|
| FAST (lint, six typechecks, `bun test`, components) | all ok; `bun test` **537 pass · 42 skip · 0 fail** (= arc 2's end; the move adds none), 83 s |
| both guards + rename guard | 27 pass |
| `lint:actions` · `lint:shell` | exit 0 · exit 0 |
| from clean targets: `bun run codegen && git diff --exit-code` | codegen ok (params, two compiles, VK export, manifest: 410 slots, sha `2c913f…` unchanged); no generated file changed |
| `contracts:compile` · `contracts:test` | ok (30 s) · 74 + 7 tests passed (35 s) |
| `artifacts:commit && git diff --exit-code` | **one delta, explained**: `work-circuit/artifacts/yacana_work.json` differs in `hash` alone, `9160…` → `1072…` — the value the baseline held before arc 0's refresh; `abi`, `bytecode`, `debug_symbols`, `file_map`, `noir_version` identical (field-by-field JSON comparison). Nargo's program hash follows the workspace's location (arc 0 met the same when the sweep crates left); the refreshed artifact is committed here because CI computes it from the new folder |
| `portal:build && portal:test` | ok · 9 Foundry tests passed (`Hashes.t.sol` reads the vectors from `packages/bridge` through its new path) |
| `site:build` + bundle comparison against the baseline | **no findings**: 651 files, the seven inventories identical after the folder maps (`apps/*`, `protocol/*`, `tools/*`, plus arc 2's `site=web-kit` and `pinned-crs`); seven JavaScript chunks re-emitted with size deltas of −26/+12/−16 bytes on the three pages (module ids now sort `apps/…` before `packages/…`, so chunk order and the minifier's names move — D10's mechanism), the four Worker chunks size-identical; the served `yacana_work.json` is byte-identical to the baseline's again |
| `site:wrangler deploy --dry-run` | resolves `apps/site/wrangler.jsonc`, reads 660 files from `apps/site/dist`, uploads nothing |
| `git status --porcelain` | nothing untracked but the gate's own reports (deleted) |

## P3.2 Prove the CI edit is mechanical

`sed` with the three-line path map over arc 2's head's (`52f457f`) workflow files, diffed against the tree's
(`.localnet/monorepo-layout/p32/diff.txt`). **Residue: two lines, both deliberate** — `site.yml` gains
`- '!apps/**/*.md'` and `web-kit.yml` gains `- '!protocol/**/*.md'`, the documentation exclusions for the folders
each now watches. Nothing else differs across the twelve files. No file changed in this phase.

### P3.2 gate (2026-09-21)

| step | result |
|---|---|
| the diff | two added lines, listed above |
| FAST · both guards | as P3.1's (no file changed since) |

## P3.3 Docs

The path map over the eleven documentation files (`CLAUDE.md`, `README.md`, the three apps' READMEs, six under
`docs/`), with two things first: arc 2's stale mentions of `packages/site/site.env` (→ `deployments/site.env`) and
of the site files that moved to `web-kit` (`config.ts`, `headers.ts`, `browser/host.ts`), which P2.1's docs pass
had missed in `docs/deployments.md`, `docs/upgrades.md`, `docs/threat-model.md` and two READMEs. Then by hand:
`CLAUDE.md`'s table is "Workspaces", grouped by folder with the layer rule and the two guards named, the `site` row
split into `apps/site` and `packages/web-kit`, `tools/localnet` naming its files; `README.md`'s layout is the four
folders. Stale beyond paths, dropped: the landing's in-page demo (no `demo` in the landing's code, its Vitest
asserts "no demo") from `CLAUDE.md`'s row and two command comments and the landing README's section. One line of
`docs/deployments.md` keeps `packages/site` on purpose: the Workers Builds root directory until the cutover (D13;
§7 C1 deletes it).

### P3.3 gate (2026-09-21)

| step | result |
|---|---|
| FAST | all ok; `bun test` 537 pass · 42 skip · 0 fail, 81 s |
| the grep outside `implementations-plan` and `docs/deployments.md` | nothing |
| the grep on `docs/deployments.md` | line 105 only, the D13 line (the file has no other hit, archived sections included) |

## Arc 3 codex fix loop

### Round 1 (2026-09-21) — "Two material findings"

Codex (GPT-6 Astra, `high`, read-only, session `01a0c533-0a79-7b30-bb11-c016cb20c79c`) over `git diff
52f457f..7dc4d18` with six named attack surfaces. Both findings real; one I had found and fixed uncommitted while
it read.

1. **A template path the map could not match.** `scripts/render-e2e.ts:19` read `` `packages/web-${app}/e2e/.run.json` ``:
   the regex wants the whole workspace name after `packages/`, and `web-${app}` is not one. Fixed to `apps/`. A
   second sweep for `packages/…${`, `` `packages/ `` and concatenations found nothing else that was not prose.
   **Lesson: after a path map, grep for the *prefix* alone (`packages/`) in code, not for the names — a template
   or a concatenation shows only there.**
2. **Three tests lost typechecking.** The root `tsconfig.json` include I wrote in P3.1 had `protocol/*/scripts` and no
   `protocol/*/src`, so `work-circuit/src/{proof-layout,vk-bytes,vk-pinning}.test.ts` (and `generated/vk.ts`) were
   root files of no project. Found before the review returned by comparing the root project's file set: the
   pre-move include over `52f457f`'s tree, mapped through the path map, against `tsc --showConfig` now — 242
   expected, 238 present, exactly those four missing; with `protocol/*/src` added, 242 = 242 (the comparison script
   is the regression evidence: run against the committed `tsconfig.json` it lists the four, against the fixed one
   nothing). Arc 4's "every tracked file is a root of exactly one project" gate makes this class structural.
3. Minor: the new `CLAUDE.md` intro and `README.md` layout stated "never by a path" and "own layer or below"
   without the two deliberate exceptions (the config-time edges the boundary guard lists; `tools/` importing
   anything). Qualified.

Confirmed fine by codex: no other stale path across configs, hooks, actions and records; the workflow map's residue
is exactly the two exclusion lines; all 14 workspaces keep their layer; only `hash` changed in the artifact and
nothing consumes it (Verify shows `W_VK_HASH`, another value).

| step | result |
|---|---|
| lint · three guards | exit 0 · 27 pass |
| root typecheck (`protocol/*/src` back) | exit 0 |

### Round 2 (2026-09-21) — "no new material findings"

Codex re-derived the root-file comparison itself (242 = 242), checked the renderer's path against the three apps'
`RUN_FILE` definitions, and swept string-built paths, regex literals, config values and comments once more: nothing
left but the D13 line. **Arc 3's loop converged in two rounds** (`/tmp/codex-lBc8NTEF/response*.md`).

## Arc 3 HEAVY+ (2026-09-21)

On `7dc4d18` (the arc's head before the fix loop; the loop changed one template path, one tsconfig include and two doc
sentences, none of which a build or an e2e reads), each e2e on its own isolated network:

| step | result |
|---|---|
| `test:replay` | 4 passed |
| `site:build` + bundle comparison | 651 files; **no findings**: the seven inventories identical after the folder maps, seven JavaScript chunks re-emitted (−26/+12/−16 bytes on the three pages, the Workers size-identical), `bundle-arc3.txt` and `modules-arc3/` recorded |
| `site:e2e` | 3 passed |
| cockpit shard, proverless | **6 passed, 1 failed**: `three power changes … memory stays bounded`, RSS 1452 → 3131 MiB (+1679 against 300, peak 3352) — the arc 1 failure on this host again (baseline commit +900, arc 1 +846/+671, arc 2 +30, CI green on arc 1's run); rerun below |
| canary shard (real proving) | 4 passed: the tampered claim refused at proving, the untampered one mints |
| web-stats e2e | 7 passed |
| web-landing e2e | 5 passed |
| `test:visual` | 8 passed (the pinned Playwright image) |
| `bun run rig -- flip` | 1 pass, H0 in 63 s |
| `YACANA_APP_ROLE=old bun run site:build` | `apps/site/dist-old` assembled: `_headers`, `_redirects`, `artifacts`, `assets`, `build.json`, `crs`, `index.html`, `layouts.json`, `slots`, `witnesses` |
| `git status --porcelain` | nothing untracked but the arc's own reports |
| cockpit shard, rerun on a fresh network | **7 passed**, RSS 1473 → 1542 MiB (+69, peak 1766): the same build, the same test, one run apart — the flake reading of arc 1 and arc 2 holds |
