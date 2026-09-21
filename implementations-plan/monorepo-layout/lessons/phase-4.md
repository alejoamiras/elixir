# Phase 4 lessons: one typecheck

## P4.1 Solution

`tsconfig.base.json` holds the root's options as they were (plus `resolveJsonModule`, which the three workspace
configs already set). A project per workspace: the eleven Bun-typed ones (`site`, `miner-core`, `bridge`, `web-kit`,
`work-circuit`, `contracts`, `portal`, `deploy`, `harness`, `localnet`) extend the base over the folders they have
(`src`, `scripts`, `tests`, `e2e`, `www`, `abi`, a Playwright config); `ui` keeps its browser options on the base; the
three apps keep `app` (src, `vite/client`) / `node` (`vite.config.ts`) and gain or extend a `tests` project (`tests`,
`e2e`, `scripts`, the Playwright and Vitest configs, `src/vite-env.d.ts`; `vite/client` + `bun`) — `web-stats` and
`web-landing` had none, and their `e2e` and `scripts` were the root's. A project for `scripts/` owns the root-level
`commitlint.config.ts` too. The root is `{ files: [], references: [15] }` and `typecheck` is `tsc -b --force`
(§3.8: without `--force`, a change in workspace B leaves project A "up to date"). No `composite`.

Two things found on the way:

- **A `../*.ts` include stops `./*.ts` matching.** `scripts/tsconfig.json` with `include: ["*.ts", "../*.ts"]` listed
  only `../commitlint.config.ts`; `["./*.ts"]` alone listed the eight scripts. TypeScript computes one common base
  for the include set and the parent-relative glob moves it up a level, after which the sibling glob matches
  nothing. The root file is named in `files` instead. **Lesson: check `tsc --showConfig`'s `files`, never trust an
  include list by eye.**
- The roots checker (below) is what caught it: an include that matches nothing is silent.

### P4.1 gate (2026-09-21)

| step | result |
|---|---|
| `bun run typecheck` | exit 0 |
| deliberate errors (each injected, typechecked, reverted; `p41-errors`) | all seven **refused, the file named**: a `string` into a `number` in `apps/web-miner/src/config.ts`, `packages/miner-core/src/metrics.ts`, `protocol/work-circuit/scripts/toolchain.ts`, `tools/deploy/src/deploy.ts` (one per layer); `Bun.file(…)` in `apps/web-stats/src/beats.ts` → TS2868 "Cannot find name 'Bun'" (the app project has `vite/client`, no `bun`); `import.meta.env.VITE_X.length` in `tools/localnet/src/registry.ts` → TS2532 "possibly 'undefined'" (Bun's `import.meta.env` is `string \| undefined` per key; under `vite/client` the same line passes as `any`) |
| a `miner-core` export's type changed (`difficulty` returns `string`) | the dependent app fails: `apps/web-landing/src/sections/BarChart.tsx(32,36)` TS2345 — no stale green under `--force` |
| every tracked `*.ts`/`*.tsx` outside `implementations-plan/` a root of exactly one project | **ok**: 21 leaf projects, 0 files off, 0 untracked roots; the three `vite-env.d.ts` roots of their app and tests projects by the explicit list |
| cold wall-clock (every build-info removed) | **37.7 s** (33.6 s on a quieter run) against the baseline suite's 52 s — under it, not merely within 3× (I5 holds) |
| FAST | all ok; `bun test` 537 pass · 42 skip · 0 fail |

## P4.2 Wire it

Every workspace's `typecheck` is `tsc -b --force` over its own project (fourteen manifests; `miner-core`, `bridge`,
`work-circuit`, `contracts`, `portal`, `deploy`, `harness` had none). The CI lanes keep their per-workspace steps
(`miner-core.yml` runs the root, which now is the whole solution). The layout guard gains two rules under "the
typecheck solution", both through TypeScript's own config reader (`getParsedCommandLineOfConfigFile`, no `tsc`
spawned; the guard still runs in 0.35 s): every workspace with tracked TypeScript, and `scripts/`, is a project the
root references (and every reference has its config); every tracked `*.ts`/`*.tsx` outside `implementations-plan/`
is a root file of exactly one leaf project (the three `vite-env.d.ts` of the apps and their tests projects excepted
by name), and no project roots an untracked file.

### P4.2 gate (2026-09-21)

| step | result |
|---|---|
| layout guard | 13 pass |
| a workspace dropped from the references (`tools/harness`) | **fails**: `+ "tools/harness"` in the references rule, and `tools/harness/src/revert.ts: no project` in the roots rule; restored, exit 0 |
| a folder dropped from a project's include (`miner-core`'s `scripts`) | **fails**: three `packages/miner-core/scripts/*.ts: no project`; restored, exit 0 |
| `lint:actions` | exit 0 |
| FAST | see below |
| FAST | all ok; `bun test` **539 pass · 42 skip · 0 fail** (537 + the two solution rules) |
