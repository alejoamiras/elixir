# Phase 2 lessons — shard by explicit file lists, with a cost ceiling (arc B)

**Gate (plan, P2)**: `bun run lint` · `bun run lint:actions` · `bun test packages/web-miner` with the unit test that the shard lists cover every `*.e2e.ts` exactly once and no spec carries `.only` · CI green where the executed identities equal the inventory, the slowest job under 15 minutes, the matrix under 45 runner-minutes. Result: see **CI** below.

## How it is built

- `e2e/shards.json` names the shards: `cockpit` (miner, dialog-geometry, opening), `chain` (states, switch, words), `accounts` (withdraw, passkey, presto) — sized from P1's CI per-spec times so each shard carries 7–9 minutes of tests (the unsharded suite is 24.5 min of tests on one runner). The workflow's first job turns the file's keys into the matrix (`jq -c '{shard: keys}'`), so the lists are the single source of truth; each shard job runs `E2E_SHARD=<name> bun run test:e2e` on its own isolated network.
- `run-suite.ts` resolves the shard's files and, after Playwright, requires the executed tests (status passed/failed/timedOut/interrupted — not skipped, not missing) to equal the inventory's titles for those files. Playwright's exit code is not trusted for this: it is silent when a shard matches no test, and a skipped test leaves it green.
- `proof-inventory.ts` became per file (`INVENTORY[file][title] = floor`), and `tests/e2e-inventory.bun.test.ts` holds it to the sources: every `*.e2e.ts` on disk in exactly one shard, every file in the inventory, every top-level `test('…')` title in the source equal to the inventory's, no `.only`. A test renamed or added without touching the inventory fails the unit test, not a CI shard twenty minutes later.
- `web-miner-report` downloads every shard's artifact and `report.ts merge` prints one table, reads the shard jobs' clocks from the Actions API (advisory, `actions: read`), and fails the run when the union of executed tests is not the whole inventory.

## What went wrong, and what it taught

- 2026-09-10 · **`actions/upload-artifact` skips dotfiles by default.** P1's CI run archived nothing — `No files were found with the provided path` — because every file the job keeps is a dotfile (`e2e/.report.json`, `.breakdown.json`, `.vite.log`) or a directory that exists only on failure. This predates the plan (the old workflow never archived `.vite.log` either). `include-hidden-files: true` on the three upload steps. The first sharded run (34517361062) ran on the unfixed workflow: its shard jobs are valid timing evidence, its merge job had nothing to read and failed by design.
- 2026-09-10 · A matrix from `fromJSON(needs.shards.outputs.matrix)` passes actionlint; the `run:` line producing it needs a block scalar — `jq -c '{shard: keys}'` inside a plain scalar reads as a YAML mapping.
- 2026-09-10 · Each shard pays the rig again (network, two deployments, prebuild's CRS download in CI): about 5.5 min per shard job before the first test. Three shards is the most the 45-runner-minute budget allows (3 × 5.5 + 24.5 ≈ 41); four would not fit, two would not make the 15-minute ceiling.

## CI (run 34518184884, `fcb7d89`, 2026-09-10 — green, merge job included)

| job | wall clock | e2e step ("whole run") | tests | browser proving |
|---|---|---|---|---|
| web-miner · cockpit (miner, dialog-geometry, opening) | 13 min 10 s | 698.8s | 523.5s | 170.9s |
| web-miner · chain (states, switch, words) | 14 min 42 s | 794.8s | 603.6s | 178.4s |
| web-miner · accounts (withdraw, passkey, presto) | 12 min 43 s | 687.9s | 496.6s | 208.1s |
| web-miner · the whole suite (merge) | 17 s | | | |

- **Slowest shard 14.7 min (budget 15); matrix 40.6 runner-minutes (budget 45)** — both inside, neither with room to tighten. The unsharded job was 30 min 9 s: wall clock halved for a third more runner minutes, as the plan estimated.
- **Coverage: "every one of the inventory's 19 tests executed, nothing else."** The merge's union check passed on the real artifacts; the summary table is in the job's step summary.
- Per-shard rig on the runner: network 29 s, prebuild 15–16 s, the two deployments 66+56 s (cockpit) to 74+63 s (chain, accounts), build 3 s — 2.6–3.1 min before the first test, per shard.
- Tests were slower per shard than in the unsharded run (the lost race 322 s vs 260 s; withdraw 215 s vs 169 s): three runners at once share nothing, so this is runner variance, not contention — worth knowing when the 15-minute ceiling is read.
- Proving's share over the three shards: 557.4 s of 1623.6 s = **34.3% of test time**.
- The run's summary printed **"Runner minutes: −1,065,411,038.7"**: the merge job's own row matched the `web-miner · ` prefix and `gh` prints an unfinished job's `completedAt` as `0001-01-01T00:00:00Z`, which `Date.parse` accepts. Codex's round 1 caught it alongside four more (below); the fix keys the lookup on the shard names read from the artifact directories and requires `status: completed`, with a unit test over representative `gh` output.
- The first sharded run (34517361062, before the upload fix) is not evidence for the merge, but its shard jobs are: cockpit 13.7 min, accounts 12.4 min — and its `chain` shard ran past 27 minutes where the fixed run's took 14.7. Recorded in the lessons when it ends.

## Codex fix loop (arc B)

- 2026-09-10 · Round 1 (GPT-6 Astra, high, session in `scratchpad/auditb`): **changes**, five findings, all applied. (1) The runner-minutes bug above. (2) Title-only coverage relies on titles being unique across files, which nothing asserted — `Object.assign` would silently merge floors and sets collapse identities; a unit test now asserts global uniqueness and the inventory's header says titles are the identity. (3) Under `--retries`, only the last attempt's duration and proofs counted and the failed attempt vanished into "Playwright overhead"; `specRows` now sums every attempt and keeps the last verdict, with a two-attempt regression case. (4) The lost-race spec's `aztec_sendTx` route ended in `route.continue()`, which bypasses the fixture's earlier `E2E_DELAY_SENDTX_MS` handler; `route.fallback()` composes them. (5) `run-suite.ts` removed the raw report and timings before a run but left `.breakdown.json`, so a prebuild failure left a stale breakdown for readers; removed with the others. Comment audit: the fixtures header called the data object "the first argument" (wrong; pino's is the second) — cut to two lines; the inventory and runner headers shortened; the reconciliation comments now say what zero unattributed time proves (the wrapper's clocks tile the outer one, which stops before the network's teardown) and that `playwrightOverheadMs` absorbs whatever the rig laps and test durations do not attribute. Codex also confirmed: no privilege escalation in the report job (`actions: read` fits the job-duration lookup; artifact contents never reach a shell), Chromium forwards worker console events, `page.reload()` keeps the fixture's listener, the floors are right, and skipped/missing/grep-excluded/empty-shard results all fail coverage.
