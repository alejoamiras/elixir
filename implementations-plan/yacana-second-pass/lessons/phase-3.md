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


## P3.2 · the landing E2E and the assembled site (2026-09-08) ✓

Gate: `bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e` **3 passed (45.4 s)** ✓ ·
`bun run e2e:agent -- bun run site:e2e` **2 passed (51.8 s)** ✓.

- The landing's setup now builds twice from one throwaway deployment: `e2e/.dist` with no claim, and
  `e2e/.dist-claim` with `VITE_EXAMPLE_CLAIM` pointed at `e2e/.example-claim.json`, the committed fixture
  (`e2e/fixtures/example-claim.json`) with its `miner` / `chainId` / `rollupVersion` rewritten to the run's
  deployment, since the config refuses anything else. Two ports under one run id in lane 5; the teardown kills
  both process groups. The first spec asserts the empty ledger (labels, dashes, no block chip, no link), the
  second the populated one (the block's, the hashes' and the counter's values and explorer hrefs); both assert
  no bb.js chunk or WASM was ever requested.
- An e2e build ships no claim unless `VITE_EXAMPLE_CLAIM` names one: the assembler's e2e run picked up the
  testnet file for its throwaway deployment and the identity guard refused it, which is the guard doing its job
  (a claim from another deployment must never ship); `siteConfig` now reads the profile's file only outside e2e.
- `site.e2e.ts`'s demo test became "the landing serves no prover; the miner still does": the landing's HTML and
  its requests name nothing of bb.js or a WASM, the hero tile and the empty ledger render on the assembled origin,
  and `/crs/g2.dat` (the CRS's 128-byte file) still serves from the root for the miner.

LESSONS_FILE=implementations-plan/yacana-second-pass/lessons/phase-3.md

## Arc 3 codex loop · round 1 (2026-09-08)

New session `01a07e75-f834-7610-995e-eaca63b69990` (Astra, high; the landing at 1440 / 1280, the LandingA and
H2-plus artboards, the arc diff, the plan, recon, the arc map, both rules). Six findings, all verified and adopted:

| sev | finding | fix |
|---|---|---|
| P2 | The recorder took `chainId` / `rollupVersion` from the deployment file, not the node it queried, so a forked endpoint with matching storage could mint a record the build guard accepts; the epoch scan trusted the node's `open_epoch` unbounded. | `assertDeployment` against the node first (chain, rollup, both contracts and classes), the returned effect's tx hash checked against the requested one, the scan bounded by `CHAIN_LEN`. |
| P2 | "One claim, as recorded" could splice a batched transaction: the first note hash of another operation, `[after − 1, after]` for a counter that moved twice; the sponsor row was copy, not a reading. | The extractor refuses an effect that claims in more than one epoch, carries more than a claim's notes (the minted one and, on a first claim, the handshake's), or lacks a fee-juice write on the canonical sponsored FPC's balance leaf (`sponsorFeeLeaf()`: `FEE_JUICE_ADDRESS`, `FEE_JUICE_BALANCES_SLOT`, the FPC instance from `SPONSORED_FPC_SALT`). The testnet record was re-recorded through the stricter path and is byte-identical. |
| P2 | The config guard accepted `[-1, 0]`, `[4, 5]`, `[0.5, 1.5]`, `['1', '2']`, block −1. | Safe integers, `0 ≤ before`, `after = before + 1 ≤ N` (from the record's params), block > 0, hex strings; eight malformed shapes in the config test. |
| P3 | The E2E asserted the hashes' links, never the hashes shown; nothing re-read the committed transaction. | The E2E reads each hash's short form and full `title`; `example-claim.test.ts` gained a `describe.skipIf(!YACANA_TESTNET_NODE_URL)` reread of the recorded transaction (run once here against the testnet node: the effect and the record match). |
| P3 | "the last six epochs" while the chart drew six closed plus the open one. | The chart draws the last six rows; a `captionShort` for shorter histories replaces the string surgery. |
| P3 | Grey eyebrows (the artboard's are violet), an outlined source button (filled), `live.ts` still describing the demo and reading the open epoch's seed, a narrating doc comment on `HeroLive`, the money table's "as money" header (blank in the artboard). | All six changed; the seed read is gone (`live.test.ts` asserts no row carries one). |

Codex judged the recorded-claim label, the privacy caveat and the test network's numbers justified, found no runtime
path from a read-only page to the throwing prover proxies, and confirmed the derived issuance (192 an hour).
Gates after the round: landing components 10 ✓ · `bun test packages/site packages/deploy scripts packages/web-landing`
✓ · landing E2E 3 passed (45.5 s) ✓ · lint ✓ · typecheck ✓.

## Arc 3 codex loop · round 2 (2026-09-08)

Resumed over `7cc96a5`: two findings, both verified and adopted:

| sev | finding | fix |
|---|---|---|
| P2 | Two claims in one epoch leave one counter and one digest but two minted notes — the permitted maximum — so the extractor could still pair the last claim's ticket with the first claim's note. | Exactly one note hash: a batch in one epoch has a note per claim and a first claim adds the handshake's, so neither is "one claim, as recorded". The committed example has one. The unit test drives two notes and none; miner-core's live test now asserts its own first claim is *refused* for its two notes and, with one note set aside, extracted with the same leaves, ticket and fee. |
| P2 | `PARAMS.CHAIN_LEN` bounded the epoch scan, but it is the work circuit's hash-chain length: any claim past epoch 2048 would have been refused. | The node's `open_epoch` is validated as a safe integer below `TABLE_EPOCHS` (the slot table's reach) and used as the bound. |

The re-run of the miner-core live suite on the isolated network: **4 pass** (LIVE_EXIT=0; a first attempt was killed by
the machine's memory pressure from other sessions, not by the test, and left no orphan). Offline: `bun test
packages/deploy` 4 pass, 1 skipped (the testnet reread) ✓ · lint ✓ · typecheck ✓.

## Arc 3 codex loop · convergence (2026-09-08)

Resumed over `a6cbe90`: **"No material findings."** (high confidence; codex ran the seven offline tests and the full
bounded scan against the committed fixture, ~20 s). Three rounds in one session (`01a07e75-f834-7610-995e-eaca63b69990`):
6 → 2 → 0. `shots/arc-3/` holds the renders after round 1; rounds 2 changed nothing visible.

LESSONS_FILE=implementations-plan/yacana-second-pass/lessons/phase-3.md
