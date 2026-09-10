# Recon — the miner e2e suite, what to reuse

> **Superseded in four places, kept for its search trails.** Playwright 1.62.1 *does* have `--shard` (see
> plan.md). `assertProductionConfig`'s flag checks are unreachable dead code, so "reuse as is" was wrong advice.
> The stats `mockNode` forwards to a real node and is not a chainless lane — `visual-setup.ts`, which this sweep
> missed, is. `BOOT_MS` is a timeout, not a floor every test pays. Read plan.md's "What the first draft got
> wrong" before acting on anything here.

One read-only sweep over this repo at `15e4550` and over `~/Projects/nulo`, which already shards an e2e suite
across runners and already has the proverless switch this plan needs.

## Reuse map

| Capability the plan needs | What exists here | Verdict |
|---|---|---|
| Lane selection (run a subset of specs) | `playwright.config.ts` has `testMatch`, `workers: 1`, no `projects`, no `grep`, no shard flag. Playwright's positional file argument already reaches through `e2e:agent -- … test:e2e -- words.e2e.ts` (documented in `scripts/run/isolated-node.ts:255`), nobody made it first-class | **adapt** the positional path; **build new** for lanes and a shard split |
| Sharding across runners | Nothing. Searched `--shard`, `--grep`, `grepInvert`, `projects:`, `tag:` across every `playwright*.config.ts`, package script and workflow — no hits | **build new**. Playwright has no `--shard` equivalent to vitest's, so the partition is ours to write |
| Proverless client proving | Nothing. `proverEnabled: true` is a literal at 9 call sites (`packages/web-miner/src/wallet.ts:65`, `packages/deploy/**`, `packages/miner-core/src/live.test.ts:68`, `packages/web-miner/e2e/burst.ts:34`). No `proverless`, no `PXE_PROVER_ENABLED`, no fake-proof path. `@aztec/pxe`'s own `getPXEConfig()` reads `PXE_PROVER_ENABLED` from the environment but nothing here calls it, so setting it today does nothing | **build new**, on a mechanism the SDK already has (`proverEnabled: false` → the kernel prover's `fakeProofs` path) |
| A build flag production refuses | `packages/site/src/config.ts`: `queryOverrides` and `prestoE2ePort` are resolved only outside production (`const env = mode === 'production' ? {} : opts.env`), then `assertProductionConfig` throws if either survived, and `config.test.ts:110` proves it | **reuse as is** — this is the template the new flag must follow |
| Post-build proof the flag did not ship | Nothing. Searched the workflows for a `dist/` grep — no hits. Yacana's defence is entirely pre-build | **build new** (nulo runs a positive grep on e2e builds and a negative grep on every other build) |
| Chain state without mining for it | `packages/web-stats/e2e/helpers.ts:27` intercepts `aztec_getPublicStorageAt` for slots present in `packages/miner-core/fixtures/epochs.testnet.json` (31 captured epochs) and forwards every other call to the real node. `deployYacana`'s `initialTarget` already gives an easy target (`1n<<127n`) and an impossible one (`1n<<64n`) | **reuse as is** for a chainless lane; **adapt** the target tiers |
| Per-run isolation for N lanes | `scripts/run/registry.ts`, `port-window.ts`, `isolated-node.ts`, `presto.ts` already own ports, process groups and data dirs per run, and `registry.test.ts` proves concurrent claims | **reuse as is**. The gap is policy, not mechanism: `run-setup.ts` always builds the maximal rig |

## What one run pays for today, whether or not the specs need it

`packages/web-miner/e2e/run-setup.ts` unconditionally: claims four ports, starts Presto when installed, runs
**two** `deployYacana` calls (easy and impossible targets, eight chain transactions between them), builds the
production bundle, starts Vite, and spawns two node proxies. A lane that only wants `dialog-geometry.e2e.ts`
pays for all of it. `e2e/.run.json` is one fixed path, so two lanes in one checkout would collide.

## The spec inventory the lane split rests on

Nineteen tests in nine files. `helpers.ts:45` sets `BOOT_MS` to eight minutes for "CRS verification, wallet + PXE
boot, bb.js init" — the floor almost every test pays before it does anything.

**No chain interaction beyond booting the page (7)** — `dialog-geometry` (the sign-in screens fit the dialog);
`miner.e2e.ts` "a malformed RPC payload is rejected" (points at a fabricated origin, asserts `boot-error`) and
"the pop-out draws with the page fonts" (never calls `start`); `opening.e2e.ts` (cancel mid-opening);
`passkey.e2e.ts` "a known account whose passkey is gone"; `presto.e2e.ts` "an old Presto answers" (a local fake
HTTP server, never calls `start`).

**Mines, deliberately never claims (5)** — `miner.e2e.ts` "three power changes"; `presto.e2e.ts` "the pill says
✦ presto" and "nothing answers: the billboard"; `states.e2e.ts` "the node going away pauses mining";
`words.e2e.ts`. Four of the five already use the impossible-target deployment for exactly this reason.

**Mints at least one claim (7)** — `miner.e2e.ts` "first visit" and "a poisoned CRS cache"; `passkey.e2e.ts`
"a passkey account"; `presto.e2e.ts` "a win Presto proved … then claimed"; `states.e2e.ts` "a lost race"
(`test.setTimeout(30 * 60_000)`, spawns a second native miner through `burst.ts` — the heaviest test in the
repo); `switch.e2e.ts` (also needs both node proxies); `withdraw.e2e.ts` (a claim plus two transfers).

One borderline: `miner.e2e.ts` "a prover crash surfaces as an error" runs on the easy deployment but asserts
only that tickets moved, so a claim is incidental rather than required.

## What nulo does that is worth copying

- **The runner's own file selection does the splitting.** `_network-e2e.yml` takes `shard`, `test_files`,
  `exclude_files` as workflow-call inputs and turns them into vitest arguments in three lines of bash; the
  matrix is five entries in `pr-network-e2e.yml`. No custom partitioner — but vitest has `--shard` and
  Playwright does not, so that part does not transfer.
- **A matrix pool plus dedicated jobs.** The heavy files are pinned to their own runners
  (`network-e2e-heavy`, `network-e2e-heavy-concurrent`, `network-e2e-canary`) so their CPU does not pressure
  the pool. The comment records why: a real deadlock when they shared a host.
- **Proverless is a double opt-in that fails closed.** Two environment variables must both be set
  (`apps/extension/src/e2e/config.ts` throws if only one is), the build stamps a marker string, `agent.sh`
  greps the bundle for that marker before the tests run, and every non-e2e build greps for its absence.
- **One real-proving canary survives the split** (`network-e2e-canary`), pinned to the files that must see a
  real proof, with the reason written down: a fake proof would green an artifact the prover can no longer prove.

## Absence claims, with their search trails

- No shard/tag/grep support: `grep -rn "\-\-shard\|--grep\|grepInvert\|tag:" packages/*/package.json
  packages/*/playwright*.config.ts package.json` and `grep -rln "projects:" packages/*/playwright*.config.ts`.
- No proverless anything: `grep -rniE "proverEnabled|proverless|PXE_PROVER|fake.?proof|test.?prover" packages
  scripts` returns nine hits, all of them the literal `proverEnabled: true`.
- No `getPXEConfig` consumer: `grep -rln "getPXEConfig|@aztec/pxe/config" packages scripts`.
- No post-build bundle check: `grep -rn "grep\|dist/" .github/workflows/{site,deploy,web-miner}.yml`.
- No node-side reduced mode: `IsolatedNodeOptions.env` exists (`scripts/run/isolated-node.ts:31`) but all three
  call sites pass nothing or `{ verbose }`, and `aztecArgs()` sets only `--sequencer.minTxsPerBlock 0`.

## The one duration figure the repo records

`.github/workflows/e2e.yml`'s header: "about 40 minutes and 3 GB on ubuntu-latest". Nothing finer is written
down, so the plan's first phase has to measure the split before it optimises anything.
