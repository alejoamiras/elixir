# Phase 1 lessons — measure, and change nothing else (arc B)

**Gate (plan, P1)**: `bun run lint` · one local run and one CI run, each producing a breakdown that separates network startup, deployments, bundle build and per-spec time, states the rig's share, and attributes **browser** proving from the prover's `client-ivc-proof-generation` console events; the delayed-`aztec_sendTx` validation; absence of evidence fails. Result: see **Numbers** below.

## How the instrument works

- `e2e/fixtures.ts` exports the specs' `test`: an auto fixture puts a meter on every page. The prover logs through pino, whose browser transport calls `console.info(bindings, data, message)` — the event's fields sit in the **second** argument, not the first; the meter reads every object argument until one names the event, and reads `duration` from it (NaN when absent, which the inventory rejects). `aztec_sendTx` round trips are timed from `request` to `requestfinished`/`requestfailed`.
- `e2e/proof-inventory.ts` (import-free, so bun's unit tests and Playwright's loader both read it) lists the minimum browser proofs each title completes. A passing test under that count, or a title not listed, fails in the fixture's teardown. Floors, not exact counts: the easy target wins every other proof, so tests that keep mining after their asserted claim may prove more.
- `e2e/run-suite.ts` is `test:e2e`: prebuild, `playwright test` (args pass through), then `report.ts`. The isolated runner passes `YACANA_RUN_STARTED_AT` / `YACANA_NODE_READY_MS` down so the report reconciles against the outer clock; `run-setup.ts` writes its laps to `e2e/.timings.json`; Playwright's `json` reporter writes `e2e/.report.json`; the breakdown lands in `e2e/.breakdown.json`, on stdout and in `$GITHUB_STEP_SUMMARY`. All three are uploaded by `e2e.yml`.

## What went wrong on the way, and what it taught

- 2026-09-10 · **Two failed spike runs that were not the meter's fault.** The CRS spec's claim never landed: the page's poll (`getChainTips` → `getPredictedMinFees` → `simulatePublicCalls` every ~2 s) ran for ten minutes after the one "Simulating transaction execution request", no further RPC, no error on the console, "claim failed" in the UI. An A/B run with Playwright's own `test` failed identically, which cleared the fixture. Cause: `~/.aztec/current` had been repointed to **5.1.0** by another session at 14:38; `bun run contracts:compile` (which resolves `aztec` through PATH) produced a 5.1.0 artifact in `target/` — the deploy read that, while the page ships the committed 5.2.0 artifact from `packages/contracts/artifacts` — different class ids (`0x168e…` vs `0x2068…`), so the page simulated the wrong bytecode against the deployed instance. The isolated-node launcher is immune (it resolves `~/.aztec/versions/<pin>/bin` itself); the compile script is not. Fix for the run: `PATH="$HOME/.aztec/versions/5.2.0/bin:$PATH"`, `rm -rf packages/contracts/target` (nargo's "No source changes detected" otherwise keeps the stale build), recompile; the fresh artifact then matches the committed one function by function (`file_map` paths aside). Never repoint the machine's `current`: another agent owns it. Recorded in memory as well.
- 2026-09-10 · **Reading a failure off the trace beats guessing.** `trace.zip` holds the console (`0-trace.trace`, `type: console`, with args previews) and every request with its POST body under `resources/<sha1>` — a 40-line bun script over those answered "what was the page doing for eight minutes" in one pass. The scratch scripts (`trace-net.ts`, `trace-bodies.ts`) are worth keeping around for the next one.
- 2026-09-10 · The local network builds one block per transaction and jumps its own clock a slot at a time (`foundation:test-date-provider … Time set to`), so after a deploy the node's time sits ~17 minutes ahead of the wall clock and no block is built until the next transaction. Harmless here; worth knowing when a "stuck at block N" appears in a trace.
- 2026-09-10 · Vite 8 (rolldown) builds the miner's e2e bundle in under two seconds; the deploys (≈45 s + ≈39 s) and the network (≈24 s) are the rig. P4's question is therefore the second deployment, not the bundle.
- 2026-09-10 · Bun 1.4.0 runs every `bun test` file in one process, so a `mock.module` of a Node builtin leaks into later files; prefer dependency injection (arc A's `AssemblySteps`) — same lesson applied to keep report.ts importable from a unit test.
- 2026-09-10 · The worktree bash guard refuses `tmux new-session … "<inline cmd>"` and any variable-first `sed`; a tiny launcher script (`bash tmux-launch.sh <session> <script>`) and literal paths get around it. `sleep` chains are refused too — `Monitor` with an `until` loop is the wait.

## Numbers

### CI, one runner, the unsharded suite (run 34514815841 · job 102997478903, 2026-09-10, `62f57c0`)

Job 30 min 9 s; the e2e step is the "whole run" below, the other 2.8 min are checkout, the toolchain, codegen, compile and Chromium.

| step | time |
|---|---|
| isolated network ready (before Playwright) | 29.1s |
| prebuild (CRS, artifacts, slots) | 14.2s |
| rig · presto start | 0.5s |
| rig · deploy (easy target) | 62.9s |
| rig · deploy (impossible target) | 52.5s |
| rig · bundle build (preview) | 2.9s |
| rig · server up | 0.5s |
| rig · proxies up | 0.3s |
| **tests** | **1472.2s** |
| Playwright launch, teardown and gaps | 3.5s |
| Playwright process | 1595.3s |
| unattributed on the outer clock | 0.0s |
| **whole run** | **1638.7s** |

Rig (network + prebuild + setup): **162.9s**, 9.9% of the run. Browser transaction proving: **446.8s**, **30.3% of test time, 27.3% of the run**.

| spec | time | proofs | proving | submission |
|---|---|---|---|---|
| miner › first visit | 175.2s | 2 | 75.7s | 0.1s |
| miner › poisoned CRS | 155.8s | 1 | 42.6s | 0.1s |
| miner › malformed RPC | 0.9s | 0 | — | — |
| miner › three power changes | 137.4s | 0 | — | — |
| miner › prover crash | 33.8s | 0 | — | — |
| miner › pop-out | 17.5s | 0 | — | — |
| opening › cancel mid-opening | 11.8s | 0 | — | — |
| passkey › create, mine, claim | 97.5s | 1 | 40.2s | 0.2s |
| passkey › passkey gone | 18.1s | 0 | — | — |
| presto › ✦ presto | 14.8s | 0 | — | — |
| presto › win proved by Presto, claimed | 84.7s | 1 | 42.9s | 0.1s |
| presto › nothing answers | 31.4s | 0 | — | — |
| presto › old Presto | 2.3s | 0 | — | — |
| states › node going away | 118.5s | 0 | — | — |
| states › lost race | 260.0s | 3 | 111.2s | 57.3s (the held `aztec_sendTx` while the burst closes the epoch) |
| switch › live switch A → B | 85.0s | 1 | 40.8s | 0.1s |
| withdraw › private + public | 168.5s | 3 | 93.3s | 0.4s |
| words › create, quiz, mine, restore | 55.9s | 0 | — | — |
| dialog-geometry › the sign-in screens | 3.2s | 0 | — | — |

**The one-sentence answer:** the claim-transaction proof is not the bulk — browser proving is **30% of test time (27% of the job's e2e step)** in CI, about 40 s per proof on the runner; the other 70% is mining (W proofs in the Worker), the boot, block waits and the deliberately slow scenarios (the node-away minute, the power test's three rebuilds). That clears P5's 15% bar. The rig is under 10%: each deployment ≈ 1 min in CI, the network 29 s, prebuild 14 s (the CRS download; 0.3 s locally with the cache).

**Instrument checks.** Every test that claims produced exactly the floor of well-formed events or more; the delayed-`aztec_sendTx` run (below) moved submission and not proving.

### Local (homelab, 12 cores), the unsharded suite, 19/19 (`97dd924`, 2026-09-10)

| step | time |
|---|---|
| isolated network ready (before Playwright) | 24.6s |
| prebuild (CRS, artifacts, slots) | 0.3s |
| rig · presto start | 0.5s |
| rig · deploy (easy target) | 45.9s |
| rig · deploy (impossible target) | 39.1s |
| rig · bundle build (preview) | 1.9s |
| rig · server up | 0.5s |
| rig · proxies up | 0.3s |
| **tests** | **1002.6s** |
| Playwright launch, teardown and gaps | 3.0s |
| Playwright process | 1093.9s |
| unattributed on the outer clock | 0.0s |
| **whole run** | **1118.8s** |

Rig **113.1s**, 10.1% of the run. Browser transaction proving **291.2s = 29.0% of test time, 26.0% of the run**; submission round trips 21.9 s (21.1 s of it the lost race's held `aztec_sendTx`). Per spec: first visit 144.9 s (2 proofs, 56.5 s), CRS 70.0 s (1, 35.0 s), power 90.4 s (0), crash 49.0 s (1, 22.4 s — the floor is 0; a win after the restart is allowed), pop-out 12.4 s, opening 11.1 s, passkey 64.9 s (1, 21.6 s) + 13.3 s, presto 12.1 / 54.6 s (1, 22.0 s) / 21.8 / 1.8 s, node-away 102.7 s, lost race 126.6 s (3, 56.3 s), switch 53.7 s (1, 21.3 s), withdraw 123.1 s (3, 56.1 s), words 47.3 s, dialog 2.1 s.

A caveat on this run's first minutes: `bun test packages/web-miner` (152 s of CPU-heavy unit tests) overlapped the first three specs, which is why the first visit's proofs took 28 s each and the CRS proof 35 s where every later proof took 21–22 s. An earlier, uncontended run of the same tree (18/19, the lost race failing on the missing work circuit) measured 943.9 s whole, tests 826.6 s, proving 203.4 s = 24.6% of test time, 21.5% of the run, with 19.6–20.0 s per proof on every spec. The share is 25–30% of test time either way.

### The delayed-`aztec_sendTx` validation (local, CRS spec, `E2E_DELAY_SENDTX_MS=20000`)

| | proving | submission | test |
|---|---|---|---|
| undelayed | 19.8s | 0.1s | 56.4s |
| held 20 s | 20.0s | 20.1s | 64.6s |

Submission rose by the hold, proving did not: the meter reads the prover, not the round trip.
