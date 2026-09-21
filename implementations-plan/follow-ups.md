# Follow-ups

Open items no active plan owns. Delete entries as they resolve.

- **Plan-folder hygiene migration**: `implementations-plan/.gitignore` now ignores `audit-*.md`, `plan-*.md`, `_*.md` and `eli5.html`, but 27 such files from earlier plans are still tracked (`git ls-files -ci --exclude-standard -- implementations-plan`), six of them carrying absolute local paths, and `index.md` links to several. Untracking them and repairing the index links is the owner's call; history keeps them either way.
- **One toolchain pin resolver** (from monorepo-layout): `scripts/run/toolchain.ts` (later `tools/localnet`) and `work-circuit/scripts/toolchain.ts` both resolve the pinned Aztec binaries; `portal` and `l1-deploy` get `aztec-forge` through the first. Merge them below `tools`.
- **Pin Node** (from monorepo-layout): nothing pins it in the repo, CI or Workers Builds, and Vite's config loader hands bare specifiers to the ambient Node. Four config-time imports stay relative to avoid depending on it.
- **Browser reachability check** (from monorepo-layout): walk the import graph from each app's page and Worker entries and refuse `tools`, `scripts/` and Node-only modules. `web-kit` is dual-environment and `siteVite` polyfills Node, so a wrong import need not fail the build.
- **`deploy/src` imports** (from monorepo-layout): it handles the L1 key and the deployer secret and sits in the layer that may import anything; forbid it from importing `harness` and `localnet`.
- **`bridge-vectors.json` under `protocol/`** (from monorepo-layout): `portal`'s Foundry tests read it upward from `packages/bridge/fixtures`.
- **The `miner-core` barrel** (`src/index.ts`) has no importer outside the package.
- **`compile` scripts call `aztec` / `aztec-nargo` from `PATH`** (`contracts`, `work-circuit`), not the pinned path.
