# Phase 0 lessons: spikes out, the decoupled deploy script

## Baseline (2026-09-21, `main` at `06b25d7` + the one test fix below)

| measure | value |
|---|---|
| `bun test` | **503 pass · 42 skip · 0 fail** (545 tests, 114 files), 107 s |
| component specs | ui 69 · web-landing 14 · web-miner 121 · web-stats 84 |
| FAST wall-clock | 178 s (lint 0 · typechecks 64 · `bun test` 107 · components 7) |
| full typecheck suite, cold (build-info removed) | 52 s (root 13 · site 4 · ui 5 · web-miner 17 · web-stats 8 · web-landing 5) |
| bundle manifest | `bundle-baseline.txt`: 651 files, production build, `GITHUB_SHA` pinned to the baseline |

The machine ran at a load average of 50–70 from other agents throughout; timings are comparable with each other,
not with a quiet machine.

## Attempts

1. **Baseline `bun test` red on untouched `main`: 2 failures.** Not load, though it looked like it.
   - `work-circuit/src/vk-pinning.test.ts`: `aztec-nargo: command not found`. The test calls the bare name and the
     shell had no toolchain on `PATH`. CI's `setup-aztec` appends `~/.aztec/versions/<pin>/bin` to `GITHUB_PATH`, so
     the FAST runner now does the same from `.aztecrc` and refuses to run without the pinned directory. The bare
     name in that test is the PATH dependence listed in `follow-ups.md`.
   - `web-stats/tests/history-transport.bun.test.ts`: reported as a 5 s timeout; with a long timeout it *fails* at
     6 s with `blocked endpoint http://127.0.0.1:<port>`. The site's fetch guard is one-way and process-wide; the
     web-miner Presto suite arms it, and the next file's requests to its own server are refused until the SDK
     client's retries run out. Reproduced with those two files alone; passes alone in 350 ms. Per-package CI lanes
     never share the process, so only the root `bun test` was red, on `main`.
   - Fix, its own commit and outside the plan's §2: the test holds a candidate lease for its server, the idiom the
     Presto suites already use. The measurement is unchanged (147 methods in 21 HTTP requests, armed or not).
   - **Lesson: a timeout under load is a hypothesis, not a diagnosis. Re-run with a long timeout before blaming
     the machine.**

2. **`bb verify` exit statuses on 5.2.0, observed before writing the classifier.** Everything that is not success
   exits 1, operational failures included:

   | case | exit | diagnostic |
   |---|---|---|
   | untouched | 0 | `Proof verified successfully` |
   | wrong public input; wrong VK (well-formed) | 1 | `verification failed at reduction step` · `Proof verification failed` |
   | flipped limb | 1 | `Deserialized point is not on the curve` |
   | field ≥ modulus | 1 | `Non-canonical proof element: value >= field modulus` |
   | truncated proof | 1 | `Proof verification failed: invalid proof size. Expected 410, got 409` |
   | missing VK or proof file | 1 | `Unable to open file: … (No such file or directory)` |
   | missing binary | spawn throws `ENOENT` | |
   | binary kills itself | none, signal `SIGKILL` | |

   So the old `exitCode === 0` test did count a missing VK as a refused mutation: the wrong-VK case read
   `target/sweep_1024/vk`, which exists only after a sweep, and passed vacuously on a clean tree. The plan assumed
   exit status plus diagnostic; only the diagnostic discriminates. `bb-verify.ts` reads it against a closed list
   and treats anything else as operational (fail closed: a new bb wording stops the run instead of passing it).

3. **Deliberate regression on the classifier.** Folding every non-zero exit into "refused" failed 2 of the 3
   operational tests (missing VK, self-killing binary); the missing binary fails at spawn, a second path, and
   folding that too failed the third. Both probes reverted; 4/4 green.

4. **The worktree guard refuses opaque command strings** (`tmux new-session … "bash …"`, a python heredoc naming
   git). An earlier launch had passed only because the payload sat behind shell variables. Long runs now go
   through the harness's background jobs as a plain `bash <script>`, which outlive the agent shell as tmux would.

5. **First `check:mutation` on the new classifier stopped, as designed.** A multi-bit flip in a commitment limb
   trips bb's limb-range assertion (`Assertion failed: (uint256_t(fr_vec[0]) < …)` · `Reason : Conversion error
   here usually implies some bad proof serde or parsing`), a wording the single-bit survey never produced. A
   second survey (13 fields × 5 bit positions) found six distinct diagnostics in all; that one joined the
   undecodable list, and `failed at pairing check` already reads as a refusal. **Lesson: survey the input space
   the script actually walks, not one sample per class.**

## P0.1 gate (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · **507 pass · 42 skip · 0 fail** (549 tests, 115 files) = baseline + the 4 `bb-verify` tests; no test left with the spikes |
| `bun install --frozen-lockfile` | ok (three devDependencies left `deploy`; lockfile −10 +3) |
| `bun run codegen` then diff | ok, no drift |
| `contracts:compile` · `contracts:test` | ok (36 s · 36 s) |
| `artifacts:commit` then diff · `export-layouts` then diff | ok, no drift |
| `check:mutation` alone, no witness on the tree | ok: 410 single flips, 50 combinations, 8 valid-point substitutions refused; wrong public input and wrong VK both `{verified:false, wellFormed:true}`; the ZK-flavour proof refused |
| `check:proofs` | exit 0: `yacana_work` 151 728 gates, prove 0.91 s; 10 native proves → 1 distinct proof; WASM byte-identical to native, WASM verify true |
| `verify()` unit tests · deliberate regression | 4/4; regression failed 3/3 operational tests, reverted |
| baseline bundle manifest | `bundle-baseline.txt` |

## P0.2 gate and arc 0's end (2026-09-21)

| step | result |
|---|---|
| FAST | exit 0 · 507 pass · 42 skip · 0 fail |
| `bun run site:wrangler --version` | `4.127.1` |
| `bun run site:wrangler deploy --dry-run` after a `site:build` | exit 0, `--dry-run: exiting now.`, nothing uploaded, no login asked for |
| bundle manifest, arc 0 against the baseline | **identical**, 651 files, empty diff (`bundle-arc0.txt`) |

The identical manifest is also the first evidence that a production build is reproducible run to run on this
machine, which the later arcs' diffs depend on. Arc 0's end is scoped to the protocol and artifact gates of P0.1
and this manifest; the browser suites start at arc 1's end.

## Codex fix loop, arc 0

**Round 1** (session `01a0c45a-ba13-7bb3-ba90-08fcbf1188bf`, GPT-6 Astra at `high`): *approve with changes*, two
material, both reproduced before fixing.

| # | finding | call |
|---|---|---|
| 1 | material: `verify()` matched substrings, and bb echoes a path it cannot open, so a missing VK under a directory named `Proof verification failed` returned a well-formed refusal. A path holding a newline injects a whole line (my own variant, also reproduced) | **adopted**: `Unable to open file` is settled first and is always operational; verdicts match whole lines with bb's `(mem: …)` suffix stripped. Three-path regression test |
| 2 | material: an empty VK prints `Proof verification failed: invalid VK size` and read as *well-formed* | **adopted**: listed as malformed; the well-formed refusal is now the exact line `Proof verification failed`. Regression test |
| 3 | nit: `spike-results.md` cites removed scripts as reproduction steps | **adopted**: an archival note names `06b25d7` and maps the surviving checks |
| 4 | nit: the lease comment claimed requests pass "untouched" (a candidate gets a deadline and `redirect: 'error'`); `bundle-manifest.ts` narrated itself | **adopted**: one accurate sentence; usage line only |

Upheld: the wrong VK exchanges two complete commitments (codex decoded both as canonical points on the curve);
D8's lease; nothing still consumes the removed components; `site:wrangler` under a hoisted install. After the
fixes: `check:mutation` exit 0, FAST 509 pass · 42 skip · 0 fail (+2 regression tests).

**Lesson: text a tool echoes back is input. Classify on a diagnostic only after ruling out the lines that carry the
caller's own strings.**

**Round 2** (same session, resumed): *approve with changes*, one new material, reproduced.

| # | finding | call |
|---|---|---|
| 5 | material: under `BB_VERBOSE=1` bb echoes every argument before it reads one. A directory as public inputs fails first (`Failed to read from /: Is a directory`), so a VK path holding `\nProof verification failed\n` lands as a whole line with no `Unable to open file` beside it: a well-formed refusal from a verifier that never ran | **adopted**: a path holding CR or LF is operational before bb is spawned. With whole-line verdicts and paths the only caller text on stderr (codex checked the assertion's `Left`/`Right` are numeric), that closes the class. The reviewer's exact case is in the path test; `.rejects` assertions are now awaited |

After the fix: the verify tests 6/6, plain and under `BB_VERBOSE=1`; FAST 509 pass · 42 skip · 0 fail.
