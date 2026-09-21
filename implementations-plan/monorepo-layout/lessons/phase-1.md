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

- **A false finding of mine, corrected in the review round below**: the guard first reported five `*.test.ts`
  files (`ui`'s `mark`, `score-loop-model`, `tokens`; `web-landing`'s `chain`, `live`) as running in no
  pull-request workflow, and I added a `bun test` step for each package. They import `vitest`, the Vitest configs
  include `src/**/*.test.ts`, and `test:components` already ran them; the added steps ran them a second time under
  the wrong runner. The steps are gone and the rule now asks which runner a file is written for. **Lesson: a
  file's name does not say its runner; read the import before calling a test orphaned.**
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

## Arc 1 review loop

### Round 1 (codex, high): "approve with changes", seven material findings and a nit

| # | finding | verdict | what changed |
|---|---|---|---|
| 1 | the boundary guard missed paths the compiler does not count as imports (`import.meta.glob`, `new URL`, `vi.mock`, `mock.module`), dropped a specifier it could not resolve, and excused a listed path edge from being declared | valid | `workspace-graph.ts` reads those calls; an unresolved specifier is judged by where it points; `site` declares `ui` |
| 2 | a glob under a folder counted as coverage of the folder | valid | the tested workspace needs its own `dir/**`; a dependency may be watched narrowly if the glob matches a file that is not a test |
| 3 | a folder was only seen at the start of a word | valid | `./packages/x` and `DIR=packages/x` are read |
| 4 | a step that may not run counted as running; the rule did not know which runner owns a file | valid, and it exposed a false finding of mine (P1.5 above) | `alwaysRuns`; the runner is read from the file's import; the two duplicate steps removed |
| 5 | `bundle-compare.ts` failed open: no reports on either side passed, two identical chunks cancelled against one, and a chunk with no partner of its size was never read for paths | valid | no report is a finding, an empty report is a finding, identical chunks cancel one for one, paths are counted over the whole group |
| 6 | every Worker build wrote the same report file, so the last one won | valid: the miner builds four Workers (`main`, `prover`, `thread`, `worker`: 8 / 231 / 6 / 5 modules) and the baseline held one | the report is named by the Worker's entry; the baseline inventories were rebuilt on the baseline commit with the same reporter |
| 7 | `site` reached `ui` through its Vite base without declaring it | valid | declared |
| 8 | narration in a header comment; the lessons' claim about five tests | valid | trimmed; corrected |

Replayed as regressions, each shown failing and reverted: a glob under a folder standing in for it (`ui.yml: runs
packages/ui's tests, filter lacks packages/ui/**`), a stale folder behind `./` (`site.yml: packages/site-gone does
not exist`), behind an assignment (`site.yml: unsupported form names DIR=packages/site-gone`), and the only step
that runs a suite made conditional (`packages/web-stats/tests/history-transport.bun.test.ts` orphaned). My first
input for the last one passed, correctly: `web-miner.yml` runs the root `test:components`, so `ui`'s specs had a
second runner. **Lesson: a regression input proves the rule only if it is the sole thing standing between the
file and a run.** The P1.5 table's row "a test file no PR workflow runs" rested on the false finding and is
superseded by this one. FAST after the round: exit 0, 526 pass, 42 skip, 0 fail.

## Arc 1 HEAVY+: the cockpit's memory bound fails on this host, at the baseline too

`miner.e2e.ts` "three power changes keep mining, the ledger grows, memory stays bounded" asks that the browser's
RSS grow by at most 300 MiB across three prover rebuilds, the last at the slider's maximum, which is
`navigator.hardwareConcurrency`: 192 on this machine, 4 on the CI runner.

| where | threads at the maximum | RSS baseline → after | growth | shard |
|---|---|---|---|---|
| arc 1 head | 192 | 1427 → 2273 MiB | +846 | 6 passed, 1 failed |
| the baseline commit, its own checkout and network | 192 | 2091 → 2991 MiB | +900 | 6 passed, 1 failed |

The same test fails by the same margin before any of this work: the bound is a statement about a CI-sized
machine, and 192 Worker threads each hold their own stack and memory. Not a regression, not fixed here (the bound
and the slider's ceiling are product questions outside this plan). I did not rerun until it passed; I ran the
baseline, which is the experiment that separates the two explanations. **Lesson: when a gate fails on a
resource bound, run the baseline on the same host before reading the diff.**

A third run, arc 1 with the whole run pinned to 16 CPUs (`taskset`), failed the same way: 2439 → 3110 MiB, +671,
6 passed, 1 failed. So the affinity mask does not shape the bound here, and thread count is at best part of the
cause; I did not establish the rest and stopped there rather than try configurations until one passed. What is
established: the test fails on this host with or without this work, by a similar margin. The shard's other six
tests pass on arc 1. **The cockpit gate is not green locally and is not claimed as green**; its evidence is the
baseline parity above plus the shard on a CI runner (`e2e.yml`, dispatched on the pushed head).

### Round 2 (codex, high, same session): "approve with changes"

Items 7 and 8 closed. Six partly closed, each with an input that still passed, and one false pass my round-1
fix introduced. All valid; none disputed.

| # | the input that still passed | what changed |
|---|---|---|
| 1 | `import.meta.glob(["…"])`, `new URL ("…")`: a list and a space defeated the regex | path calls are read from the TypeScript syntax tree: a literal, a list of them, a template without substitutions |
| 2 | `!packages/ui/src/components/**` (only two sentinel paths were tested); `packages/bridge/package.json` standing in for the folder | an exclusion may take out nothing but `.md`; a dependency is watched whole, unless listed with its reason (`portal` → `portal/abi/**`) |
| 3, new | `bun ./packages/site/missing.ts`: the paths lost `./`, the script kept it, so the script was read as an output argument | both are compared in one spelling |
| 4 | a Vitest file the config does not include; `exit 0; bun test …` | the workspace's `include` must match the file; commands after `exit`, before `\|\|`, or in a `continue-on-error` step do not count |
| 5 | report folders trimmed to one page on both sides; a path dropped from one chunk paying for one added to its sibling | a report for every page and a Worker is required; paths are compared as sets against the baseline's, so a path the baseline lacks is a finding |
| 6 | two Workers whose files share a name share a report | the build throws when one report name meets two entry modules |

The stricter filter rule found four real gaps: `deploy`, `web-landing`, `web-miner` and `web-stats` watched
`miner-core/src/**` (and `web-stats` one file of `work-circuit`), which leaves out `package.json`, where a
workspace's exports now live. They watch the folders whole. The guard also reported itself as a Vitest file: its
source held the text `from 'vitest'` inside a regular expression. The check reads an import line now. **Lesson:
a guard that classifies files by their text will meet its own text.**

Each input replayed, red, reverted: the seven above against the two guards (the new files staged with
`git add -N` for the run and removed after), the two comparer inputs on synthetic folders (`a path the baseline
lacks … /home/another-user/private.ts`; `no module report for web-landing / web-miner / any Worker`). Arc 1
against the baseline after the changes: 651 files, seven inventories identical, no findings.

On the cockpit gate codex's reading matches mine: baseline parity shows the failure predates this work,
confidence that arc 1 adds none is moderate, and the CI run stays required.

### Arc 1 HEAVY+ (2026-09-21)

| step | result |
|---|---|
| `site:e2e` | 3 passed (after D11) |
| web-stats e2e | 7 passed |
| web-landing e2e | 5 passed |
| cockpit shard, proverless | **not green here**: 6 passed, 1 failed (the memory bound; fails alike on the baseline commit, above) |
| canary shard, real proving | 4 passed: the altered claim refused at proving, the untampered one mints |
| bundle comparison | no findings |
| web-stats `test:visual` | 8 passed |
| FAST after round 2 | exit 0 · 527 pass · 42 skip · 0 fail (the first run failed lint: the reporter reached 19 on the complexity scale with the collision check in it, and was split into a helper) |

### Round 3 (codex, high, same session): "approve with changes". The loop did NOT converge

Four of round 2's seven closed (filters, command paths, Worker collisions, the script spelling). Three stayed
partly closed, one of them a regression my round-2 fix introduced. All valid.

| # | the input that still passed | what changed |
|---|---|---|
| 1, new | every file was parsed as TSX, where `<T>(x: T) => x` in a `.ts` file reads as an element and hides the calls after it | the script kind follows the file's name; the generic-arrow case is a fixture |
| 4 | an `exclude` that removes the component specs; the old `include` kept as a comment before a narrower one; `continue-on-error` on the job | `include` and `exclude` are read from the config's syntax tree, and a file runs if the first matches and the second does not; a job's tolerance counts as its steps' |
| 5 | the prover Worker's report removed from both folders | the seven expected reports are named in the comparer, not read from either folder |

My first repair of item 4 was wrong twice before it was right: a comment-stripping regular expression took the
`/**/` inside `'src/**/*.vitest.tsx'` for a block comment (55 false orphans), and "reject any `exclude`" met three
real configs that carry one. **Lesson: the second regular expression over source code is the signal to use the
parser; I had the parser imported one file away.**

Replayed red and reverted: the three config and workflow inputs, the generic-arrow probe, the missing Worker
report (`no module report for web-miner.worker.prover.worker`). Both guards 18 pass.

The comparer also reported `file new: stats/assets/index-abc.js` in a build I had not touched. Not the reviewer:
`assemble.test.ts` assembles into the real `packages/site/dist`, so a `bun test` between a build and a comparison
dirties the build. The gate builds immediately before it compares; the test is in `follow-ups.md`.

**Status of the loop: three rounds, the hard stop, without "no new material findings".** Round 3's findings are
fixed and replayed, but no review has passed over those fixes. That is the scope smell the protocol names: two
guards that parse shell, YAML, TypeScript and Vitest configs by hand have a long tail of forms, and each round
found the next one. A fourth round is the owner's call, not mine.

### The cockpit shard on a CI runner (2026-09-21, after the push)

`e2e.yml` dispatched on the arc 1 head `8c8e4ba` (run 35626070297): **success**, every job — the shards `bridge`,
`canary`, `chain`, `cockpit` and the whole suite, the stats and landing e2e, the rig's migration cases. The memory
test that fails on this 192-thread host passes on the 4-core runner it was written for. With the baseline parity
above, the cockpit gate for arc 1 stands on CI's run, not on a local pass. (The head was rebased afterwards onto
arc 0's artifact-hash fix, `2a85076`; the code the run tested differs from `e378d33` by that one JSON field.)
Arc 2's run of the same shard on this host passed (+30 MiB, `lessons/phase-2.md`): the failure is intermittent
here, which the three arc 1 runs could not tell from a constant.
