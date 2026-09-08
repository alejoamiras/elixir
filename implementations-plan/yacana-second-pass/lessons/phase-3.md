# Phase 3 · landing + site (arc 3, `second-pass-landing`)

## P3.1 · the landing (2026-09-08) ✓

Gate: `bun run lint` ✓ · `bun run lint:actions` ✓ · TC1 ✓ · `bun test packages/web-landing packages/site
packages/deploy` 25 pass ✓ · `bun run --cwd packages/web-landing test:components` 10 passed ✓ · `bun install
--frozen-lockfile` ✓ (the lockfile diff is the two dropped lines, `@aztec/bb.js` and `@aztec/noir-noir_js` under
web-landing; no other version moved) · `bun run --cwd packages/web-landing build` ✓ with `grep -rlE
"barretenberg|bb\.js|\.wasm" dist/assets` empty ✓ (1.1 MB of assets, from 9.8 MB).

- **The example claim** (Ask 1): `packages/deploy/scripts/record-example-claim.ts <txHash>` read the testnet
  transaction `0x0cc85e…1cad5`'s effect and found, in its public-data writes, this deployment's `claims[29]` leaf
  (value 2, so 1 → 2) and `last_digest[29]`, whose siloed ticket nullifier is among the effect's nullifiers; the
  first note hash and block 73,162 complete `deployments/testnet.example-claim.json`. The effect itself is
  committed as `packages/deploy/fixtures/example-claim-effect.json`, so the extraction is unit-tested offline
  (the record, and the three refusals: no writes, no ticket for the digest, another deployment's address); the
  miner-core live test runs the same extraction on the claim it makes on the isolated network and checks the
  siloed ticket and the note hash against what it observed.
- `loadSiteConfig` takes `exampleClaim` and refuses one whose `miner` / `chainId` / `rollupVersion` differ from
  the build's, or whose shape is off; `vite-base` reads `deployments/<profile>.example-claim.json` when it exists
  and, in e2e mode, `VITE_EXAMPLE_CLAIM` as a file path (empty = none). The page reads it from the define.
- **The landing still bundled the prover after the demo was gone.** aztec.js's node client reaches bb.js and
  the Noir WASM through lazy imports (`@aztec/stdlib` → hash → bb.js), so Vite emitted two 4 MB `barretenberg`
  chunks and `noirc_abi_wasm_bg.wasm` for a page that never loads them (the stats build had the same dead
  weight). `siteVite` now aliases `@aztec/bb.js` and `@aztec/noir-{acvm_js,noirc_abi,noir_js}` to
  `packages/site/src/browser/no-prover.ts` for `prover: false` apps: it exports the seven names aztec.js binds
  at import as proxies that throw "this page has no prover" on any use, so a reach fails loudly and the grep
  gate is meaningful. Both read-only builds pass it; the E2Es (P3.2) confirm nothing at render touches a stub.
- `ChipLink` moved into `packages/ui` (the stats Verify tile and the landing's Verify both link the deployment's
  addresses); `Chip` itself is untouched.
- The hero tile's chart is one SVG (`BarChart.tsx`): the last six closed epochs and the open one, a step per epoch
  on log₂ with ticks 1 · 4 · 16 · 64, one dot per accepted claim at `(k + ½) / claims` across its epoch, the open
  epoch named top right. Storage keeps counts, not claim times: the caption says the dots are spread.
- The rename guard now reads `packages/web-landing/src` too; the copy deck lost "holds a key", "a key's first
  claim", "to a key only you hold" with the diet.
- `docs/deployments.md`'s first-deploy record keeps its history ("Prove one now" was verified then) with a note
  that the demo has since gone.

LESSONS_FILE=implementations-plan/yacana-second-pass/lessons/phase-3.md
