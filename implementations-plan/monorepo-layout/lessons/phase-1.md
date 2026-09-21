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
