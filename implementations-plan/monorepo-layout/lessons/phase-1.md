# Phase 1 lessons: boundaries, no workspace moves

## P1.1 Prove the resolution chain

### Attempts

1. **Hand imports, one of each kind.** `exports` on `miner-core` (6 subpaths) and `ui` (`.`, `./theme.css`); the six
   existing `@yacana/miner-core/src/*.ts` specifiers rewritten in the same change. By hand: a page module
   (`web-stats/src/bridge-beat.ts`, `web-miner/src/main.tsx` for `ui`'s barrel), the prover Worker
   (`@yacana/miner-core/work`), a Vitest spec (`gallery.vitest.tsx`), a `bun:test` file
   (`activity-rows.bun.test.ts`), the `?raw` JSON in `stats.vitest.tsx` (which is also the only cross-package dynamic
   `import()` in an app's source, so it covers both kinds), and `@import "@yacana/ui/theme.css"` in the miner's
   `index.css`. No kind failed to resolve; I1's fallback was not needed. The config-time files are untouched.
   `ui` was never imported bare before: all 86 uses of its barrel are relative.

2. **Dev-server smoke.** Per app: a port from the registry, vite in its own process group, `/` and one module
   importing `@yacana/*` both 200, the workspace import rewritten to an `/@fs/…/packages/<pkg>/…` path (so Vite
   treats it as source, not a pre-bundled dependency), no `Failed to resolve`, the group killed and confirmed gone.

3. **The bundle manifest moved, and the plan's assumption with it.** FAST, both builds and `test:replay` green; the
   manifest differed in five files: the miner's main chunk +12 bytes, four files that embed its hashed name.
   Bisected by reverting one change at a time and rebuilding:
   - the `main.tsx` path restored, the line left where Biome had put it: still different;
   - the Worker import restored: still different;
   - every `miner-core` change and its map reverted (only `ui`'s map and the CSS `@import` left): still different;
   - `main.tsx` restored **byte for byte**: identical to the baseline, with the CSS `@import` and `ui`'s map in place.

   Cause: `organizeImports` moves a rewritten import (package specifiers sort before relative ones). Module order
   changes and the minifier renames across the whole 4.9 MB chunk; the character histogram shifts everywhere, net
   +12 bytes. The CSS kind is output-neutral. With ~600 rewrites coming in P1.3, identical hashes are out of reach.
   - **Lesson: a formatter that sorts imports makes any specifier rewrite a module-order change. Measure the gate
     on the first hand edit, not after the codemod.**

4. **Does the re-sort endanger the fetch guard?** No. The guard, `pinned-crs` and the Worker's globals shim are the
   only production modules that patch a global at import (searched top-level assignments to `globalThis`, `window`,
   `self`, `process` and top-level installs across `site`, the three apps, `ui`, `miner-core`, `bridge`). All three
   page entries import the guard as their first statement in side-effect form, the Worker imports shim then guard
   the same way, and Biome never moves a side-effect import (they delimit its sort groups). After the rewrite the
   guard line did not move; `import-order.test.ts` matches `/node-guard/`, which the package specifier still
   contains. Limits: a grep cannot certify that no module reads a global at import and depends on a sibling's order;
   the behavioural gates (HEAVY, the canary) are the evidence for that. There is one Worker in the repository;
   CLAUDE.md's `demo/demo.worker.ts` no longer exists (for the docs pass in P3.3).

### Codex consult: the bundle gate (session `01a0c475-6c7e-7c70-b327-2f810b45f2a8`, `high`)

Asked whether "same files, non-JS identical, JS within a size tolerance, path grep" could replace identity.
**Verdict (high confidence): useful evidence, but it overclaims; reject the tolerance.** A changed condition can have
the same length, 0.1 % of the miner's chunk is 4.9 KB, and the Node polyfills make a green build weak evidence
against Node leakage. It asked for a per-app and per-Worker inventory of bundled modules, normalisation on real
artifacts with ambiguous names rejected, and the path grep as supplementary only. **Call: adopted**, as plan D10 and
§3.10's amendment. Both warnings proved right on the first run: chunks share stems (`lazy-*`, `barretenberg-*`), so
names are compared as groups; and upstream Aztec artifacts carry their builder's `/home/…` paths, so generic
prefixes are checked for a rise against the baseline while this machine's own paths are absolute findings.

### What landed for it

`moduleReport` in `site/src/vite-base.ts` (page and Worker pipelines, inert without `YACANA_MODULE_REPORT`; the
baseline manifest is byte-identical with it in place), `bundle-compare.ts`, and `modules-baseline/`: web-landing 596
modules, web-miner 1567, its Worker 231 (16 first-party, the guard and the shim among them), web-stats 1270.

### P1.1 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · 509 pass · 42 skip · 0 fail (no test added, moved or removed) |
| `build` of `web-miner` and `web-stats` | ok (18 s · 8 s) |
| dev-server smoke, both apps | `/` 200 · the module 200 · 1 workspace import rewritten to `/@fs`, 0 left bare · no `Failed to resolve` · owned group gone |
| `test:replay` | 4 passed |
| bundle comparison (§3.10, amended) | **no findings**: 651 files, the four module inventories identical to the baseline; re-emitted scripts `mine/assets/index` +12 B, `ccip`, `lazy`, `register` +0 B (they embed the main chunk's hashed name) |

## P1.2 Maps and declarations

The extractor lives in `scripts/workspace-graph.ts` (the guards reuse it); `codemod.ts` has three modes on it.
`ts.preProcessFile` reports an import at its **opening quote** and a triple-slash reference at its first character,
so offsets are normalised and asserted against the text before anything is rewritten. `vi.mock('…')` strings are
not imports to it (none crosses a workspace today).

- The survey agrees with the recon: 559 cross-workspace relative specifiers (554 imports, 2 CSS `@import`s left
  after P1.1's hand one, 3 references), exactly the 4 config-time edges, 0 unresolved. Targets no workspace owns:
  `scripts/run` 47, three `node_modules/@aztec` paths, `yacana.params.json`, one `deployments/` file.
- `--emit-exports`: miner-core 19, bridge 19 (18 + its barrel), site 17 (19 less the two exempt targets), deploy 12,
  web-miner 4, ui 3, web-stats 2, portal 2, work-circuit 1. The recon's "work-circuit 5" counted occurrences: one
  module is imported (`generated/vk.ts`, five times); the other strings are filesystem paths, which the layout
  guard's literal rule covers. A subpath that would name two files is an error, not a silent overwrite.
- `--bare-only`: 30 `@yacana/x/src/y.ts` specifiers in 18 files (the plan's 36 less P1.1's 6), 0 unresolved.
- `--emit-deps`: production importers into `dependencies`, the rest into `devDependencies`, the root manifest
  included (`web-stats`, dev). The graph shows the cycles arc 2 removes: `site ⇄ web-miner/web-stats` in production,
  `miner-core → deploy` from its live tests.

### P1.2 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · 509 pass · 42 skip · 0 fail |
| `bun install --frozen-lockfile` | ok, no changes |
| `bun.lock` diff outside workspace entries | empty but for the braces of newly created dependency blocks; no npm package moved |

## P1.3 Codemod

552 specifiers in 218 files (the 559 less the 3 references and the 4 config-time edges), 0 unresolved; a second run
rewrites nothing. After Biome's re-sort every entry still opens as before: the three pages with
`import '@yacana/site/browser/node-guard'`, the Worker with its shim and then the guard. No `vi.mock`,
`mock.module` or `require` call holds a path that crosses a workspace, so nothing the extractor cannot see was left
behind. `scripts/run` imports stay relative (47): it is not a workspace until P2.2.

### P1.3 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · 509 pass · 42 skip · 0 fail |
| zero unresolved non-exempt targets | `codemod.ts --dry`: 0 specifiers, 0 unresolved |
| `bun run --cwd packages/web-landing build` | ok |
| bundle comparison | **no findings**: 651 files, the four module inventories identical to the baseline (596 / 1567 / 231 / 1270). Re-emitted scripts: landing `index` +9 B, miner `index` +12 B, stats `index` −2 B, and five at +0 B that embed a changed name (the prover Worker among them) |

## P1.4 The boundaries guard

`scripts/boundaries.test.ts`, on the extractor: no path leaves its workspace (TypeScript, references, CSS
`@import`); every listed exception still exists, so the list cannot rot; a workspace import is declared, under
`dependencies` when production code imports it (files no workspace owns answer to the root manifest); and, one rule
more than the plan's two because it costs four lines, a workspace import names a subpath its owner exports, which
otherwise fails only where that one file is loaded. Seven path edges are listed with their reason (the four
config-time ones, the three references until P2.1) and five kinds of unowned target (`scripts/run` until P2.2).
Tailwind's `@source` needs no exemption: the extractor reads `@import` only. The plan folder's tools are skipped;
they import the graph by path and are neither shipped nor run in CI. The declaration rule went over the
cognitive-complexity budget (19) and was split, not suppressed.

### P1.4 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · **515 pass · 42 skip · 0 fail** (557 tests, 116 files) = 509 + the guard's 6 |
| regression: a relative escape in TypeScript | failed: `packages/web-stats/src/bridge-beat.ts:9 reaches packages/miner-core/src/reader.ts by path`; reverted |
| regression: a relative escape in CSS | failed: `packages/web-miner/src/index.css:1 reaches packages/ui/src/theme.css by path`; reverted |
| regression: a production import only in `devDependencies` | failed: `packages/web-landing/src/App.tsx:10 imports @yacana/ui: not in dependencies of packages/web-landing/package.json` (and three more lines); reverted |

## P1.5 Location-independent config and the layout guard

`scripts/layout.test.ts`, ten rules, all holding on the tree before any folder moves. It found real gaps on `main`
on its first run, fixed in the same commit:

- **Five `bun:test` files ran in no pull-request workflow**: `ui`'s `mark`, `score-loop-model` and `tokens`, and
  `web-landing`'s `chain` and `live`. `ui.yml` and `web-landing.yml` ran Vitest only. Both now run `bun test` on
  their package.
- **Five workflows ran a workspace's tests without watching all it depends on** (14 missing globs): `deploy`
  lacked `bridge` and `portal`; `site` lacked `miner-core`, `portal`, `work-circuit`; `web-landing` lacked `portal`,
  `web-miner`, `web-stats`, `work-circuit`; `web-miner` lacked `web-stats`, `work-circuit`; `web-stats` lacked
  `web-miner`. Several exist only through the `site ⇄ web-*` cycle; P2.4 prunes what the graph stops requiring.
- **`contracts.yml` and `work-circuit.yml` watched `toolchain.test.ts` but not `toolchain.ts`**, the resolver it
  tests. My first version of the rule accepted that (it only asked for a glob under `scripts/run/`); it now asks
  for a glob that matches the resolver file. **Lesson: run a new guard against a known-bad case from the plan's
  own facts before trusting a green.**

Parser limits met and handled: `x=$(jq … file)` leaves a parenthesis on the token, so command substitutions are
unwrapped; a folder a script writes into (`bun …/fetch-crs.ts packages/web-miner/public`) is not tracked, so for a
script's arguments the owning workspace is checked, as for uploaded artifacts. The path rule was 55 on Biome's
cognitive-complexity scale as first written and was split into two helpers.

The 50 anchored lines of the root `.gitignore` (the plan counted 42 before the polish arcs) moved into five
per-workspace files; `git status --porcelain --ignored --untracked-files=all` lists the same 68 252 entries before
and after. `biome.json` names no folder (`!**/abi`, `!**/artifacts`); it checks 613 files, the 610 of before plus
the three new scripts.

### P1.5 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · **525 pass · 42 skip · 0 fail** = 515 + the layout guard's 10 |
| `bun run lint:actions` | exit 0 |
| regression: a dead filter glob | failed: `ui.yml: packages/ui-gone/**` (and the graph rule, for the same line); reverted |
| regression: a stale path in a `run:` line | failed: `site.yml: packages/site-gone does not exist (bun run --cwd packages/site-gone typecheck)`; reverted |
| regression: a workspace path in an unsupported form | failed: `ui.yml: unsupported form names packages/ui/package.json (cat packages/ui/package.json)`; reverted |
| regression: a test file no PR workflow runs | failed: `packages/ui/src/score-loop-model.test.ts`, `packages/ui/src/tokens.test.ts`; reverted |
| regression: a workflow missing a dependency's folder | failed: `deploy.yml: runs packages/deploy's tests, filter lacks packages/bridge/**`; reverted |
| regression: a toolchain lane without `YACANA_REQUIRE_TOOLCHAIN` | failed: `work-circuit.yml: the toolchain test may skip`; reverted |
| `git status --porcelain` after `site:build` and `test:replay` | empty |
