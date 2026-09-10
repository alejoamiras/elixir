# e2e-lanes — the miner suite, faster, and honest about what it proves

```
driver: claude-code
tier: mid
eli5_mode: artifact
code_review: off
status: approved by codex with two conditions, both folded in; awaiting the owner
```

## What this is

The miner's browser suite is nineteen tests. Measured on the last green run: 16.6 minutes on the homelab, 16.2
of them inside Playwright; 26.5 minutes in CI on one runner, 24.9 of them in the e2e step and the rest in cached
setup steps of under a minute each. The forty minutes in `e2e.yml`'s header is stale. It runs on
`workflow_dispatch` only, so nothing about the miner is checked on an ordinary push. This plan
makes it faster and gives it a lane that can run on every push. The first draft of this plan was rejected twice,
by both reviewers, on findings that turned out to be correct; what follows is the design the evidence supports,
not the one I started with.

## What the first draft got wrong

Recorded because the corrections are the plan.

- **Nothing here can be "chainless" by skipping the node.** `packages/web-miner/src/boot.ts:127-153` runs a
  mandatory preflight — isolation, node, deployment — and only then does `session.ts` publish `signedOut`, which
  is what renders the sign-in screen. The three tests I called chainless still need a live node *and* a live
  deployment. A lane that provisions "a Vite server and nothing else" would fail two of its own three tests.
- **The fast lane already exists, one package over.** `packages/web-stats/e2e/visual-setup.ts` with
  `playwright.visual.config.ts` and `serve.ts` is a complete record-and-replay lane: a one-off `record` mode
  captures every JSON-RPC answer the page needs into `visual-rpc.json`, and `serve` builds against the recorded
  deployment and answers the page from the recording — its own header says "No node is involved in `serve`". It
  runs on every pull request in `web-stats.yml` inside fifteen minutes. That is the shape the miner's fast lane
  should copy, and it needs no tags and no proverless build.
- **The security barriers I claimed were one and a half.** `packages/site/src/config.ts:92` (production discards
  every override) is the real one. `assertProductionConfig`'s flag checks at `:170-171` are **unreachable**:
  `prestoE2ePort` is already `''` and `queryOverrides` already `false` by the time it runs. `config.test.ts:110`,
  whose title mentions "the e2e flag", does not test those branches at all — the flag-dropping is proved by the
  test at `:19`. And a double opt-in inside `loadSiteConfig` cannot fire in production, because there is nothing
  in `env` to conflict over.
- **One environment variable disables all of it.** `packages/site/src/vite-base.ts:45` casts
  `YACANA_SITE_MODE` to its type without validating it. Any value that is not `'production'` re-enables every
  override, skips the production assertion, and relaxes the shipped CSP (`headers.ts:19` adds
  `http://127.0.0.1:*` and `http://localhost:*` to `connect-src`). The one defence that genuinely does not share
  that predicate is `assemble.ts:69-70`, which refuses to let a non-production build land in the production
  directory or a Cloudflare build — and my draft never mentioned it.
- **The isolated network has never verified a transaction proof.** The toolchain's local network sets
  `realProofs: config.realProofs ?? false` (`local-network.ts:138`), which sends `aztec-node/src/factory.ts:219`
  down the `TestCircuitVerifier` branch, whose `verifyProof` returns `valid: true` unconditionally. So what real
  client proving buys this suite is not network verification: it is that the claim circuit's constraints must be
  satisfiable, including the in-circuit recursive verification of the mining proof. That is the thing proverless
  stops doing, and it is a sharper statement than my draft's.
- **The lost-race spec does not depend on proving time.** `states.e2e.ts:75-84` holds `aztec_sendTx` at a route
  until an outside miner closes the epoch. My reason for pinning it to a real-proving lane was simply wrong.
- **`BOOT_MS` is a timeout, not a cost.** `helpers.ts:45` is used as `toBeVisible({ timeout: BOOT_MS })`. My
  problem statement treated eight minutes as something every test pays. Nothing pays it unless boot is slow.
- **A correction to the correction.** The second review told me `packages/web-miner/e2e` was in no typecheck,
  and I repeated it. The root `tsconfig.json` includes `packages/*/e2e`, and `miner-core.yml` runs
  `bun run typecheck` on every pull request. The package-level `tsconfig.tests.json` omits it; the root one does
  not. Nothing to add.
- **Timeouts are not durations, and I made that mistake twice.** After correcting it for `BOOT_MS` I still
  called the lost-race spec a thirty-minute test and the switch spec a twenty-minute one. Those are
  `test.setTimeout` values. The measured durations from the last green run are: lost race 2.0 min, withdraw
  1.9 min, node-away 1.7 min, first visit 1.5 min, power changes 1.4 min, passkey 60 s, switch 53 s. The suite's
  sixteen local minutes are spread more evenly than the timeouts suggest, which weakens the case for pinning specs to their
  own jobs and strengthens the case for measuring before sharding at all.

## What a fourth read corrected

A different reviewer, checking the third version against the last green CI run rather than against the plan's
own prose.

- **The baseline was wrong by a third, in the direction that mattered.** The job is 26.5 minutes, not forty.
  From the CI log's own timestamps: the node is up 31 s into the e2e step, setup reports the preview ready at
  2:43, tests run from 2:43 to 24:52 — about 22 minutes of tests against about 4.4 minutes of everything else,
  the pre-steps included. Test time is the problem. Three shards therefore cost about a third more runner
  minutes (22 + 3 × 4.4 ≈ 35) for roughly half the wall clock (the slowest file bucket, split on this run's
  durations, is about 7.6 min of tests, so about 12 min per job). That answers Ask 1 without waiting for P1 —
  with the caveat that fresh deployments, random mining and runner variance move these numbers, which is why
  P2's gate carries budgets looser than the estimate.
- **"One environment variable disables all of it" was true of the config and overstated for the deploy.**
  `assemble.ts:69-70` refuses any non-production mode into the production directory or a Cloudflare build, and
  the supported scripts — `site:deploy`, and Workers Builds' configured build step — go through `assemble`. So a
  misspelled `YACANA_SITE_MODE` is rejected by every *supported* route. It is not rejected by a bare
  `wrangler deploy` of an existing `dist`, which `wrangler.jsonc` permits and no script guards. Nor does an
  invalid mode enable *every* override: the query overrides need the exact mode `e2e`. P0 buys an early, clear
  failure; the unguarded route is named rather than closed, because guarding `wrangler` itself is out of scope.
- **P0 had no definition of "forbidden".** There is no proverless marker yet, so an artifact inspection needs a
  concrete list or it tests nothing in particular. The list is below.
- **Proverless cannot be estimated from the logs we have — and I tried twice.** The proof durations in the run
  logs (7–12 s in CI, 5–8 s locally) belong to the deployer's setup transactions and to the burst miner's native
  `bb`, not to the browser; the page's own proving time is not logged to the e2e output. What is countable: the
  specs make at least twelve browser transaction proofs — nine successful claims, one deliberately reverted claim
  in the lost-race spec, and the withdraw spec's two transfers — plus whatever extra wins mining produces. What
  each costs in a headless browser is unknown until P1 measures it. The controller's own log is the wrong
  instrument: its `proving the claim in-page…` → `sent` interval spans PXE sync and simulation, proving,
  submission and — in the lost-race spec — the route that deliberately holds `aztec_sendTx`. The right one is
  the prover's own event: bb-prover emits `client-ivc-proof-generation` with a duration when it finishes a
  proof, in the browser as anywhere, and Playwright captures the page's console. That is per proof, covers
  withdrawals and rolls as well as claims, and survives reloads because it is collected as it happens rather
  than scraped from a bounded UI log. The 30% rule is therefore a policy, not a derivation: browser
  proving is the only thing exercising the claim circuit's in-circuit verification of the mining proof, and it is
  not given up for less than a third of the suite.
- **The replay lane's running cost was unnamed.** Any change to the miner's boot-time RPC surface breaks the
  lane until someone re-records on a machine with the toolchain — exactly how the stats lane already behaves.
  P3 says so, and runs as a timeboxed spike before anything is built on it.

## The shape that follows from that

Measure first, then take the cheap wins, and treat the risky one as optional and last.

**No tags, no lane abstraction.** Both reviewers reached the same conclusion independently: what a lane could
actually skip is one of the two deployments, two node proxies and a Presto — roughly one boolean's worth of
saving — while the isolated network, the production build and at least one deployment are unavoidable for every
test that opens the app. Two environment booleans in `run-setup.ts` deliver that saving without a taxonomy.

**Sharding by explicit file lists, not `--shard`.** Playwright assigns whole files to shards by cumulative test
count, which is a proxy for cost that this suite does not honour: measured, its slowest spec is 2.0 minutes and
its fastest is under three seconds, and the counts do not track that. Naming files keeps the split under control.
nulo pins its heavy files to their own jobs for the same reason, and its comment records the deadlock that
taught it.

**The fast lane is record-and-replay, cloned from the stats visual lane.** It is the only shape that satisfies
the mandatory deployment probe without a chain, and it is already proven in this repo on every pull request.

**Proverless is optional, last, and may never be built.** It removes the browser's transaction proving —
claims, withdrawals and rolls alike, since the flag sits at the wallet — and nothing else: the mining proofs, the
block waits and the note sync all stay. Whether that is most of the time is unknown until P1 measures
it. It also genuinely reduces what the suite proves, so it gets its own decision, with numbers, after P1.

## Phases

Six phases, P0 to P5. Two of them — the flag hygiene and the measurement — depend on nothing and can land in
either order; the rest follow the measurement. The last is conditional and may never be built.

**P0 · Flag hygiene, independent of everything else.** Validate `YACANA_SITE_MODE` against its three literals and
throw otherwise — an early, clear failure where today `assemble.ts` catches the same mistake later with a less
specific one. Decide the fate of the unreachable assertions in `assertProductionConfig`: delete them, or make
them assertions over an independently constructed config with tests that fail when a guard is removed; either is
honest, neither adds a barrier. Add an artifact inspection to `assemble()` **after assembly, before it reports
success** (lines 69-70 run before any artifact exists). What it checks, over the **actual assembly
destination** including worker chunks and every emitted `_headers`: no plaintext loopback origin
(`http://127.0.0.1`, `http://localhost`) in any emitted JavaScript or header file; the production CSP present
and without the local `connect-src` entries; `build.json` present, well-formed, and reporting `production`;
and the resolved config it was built from carrying `queryOverrides: false` and an empty `prestoE2ePort`.
Presto's HTTPS-only policy is not a `SiteConfig` field — it lives in the miner's `prestoEndpointFor` — so it is
checked where it is consumed: the existing unit test that production-resolved inputs (`e2ePort: ''`,
`overrides: false`) yield the HTTPS-only default, plus a mutation test that flipping the consumed endpoint to
`httpsOnly: false` fails even with an empty `prestoE2ePort` and no loopback literal anywhere. Missing or
unreadable output, headers or `build.json` fail the check. The contract applies to production assembly only;
an e2e assembly violates it by design. It proves the artifact carries no *known* contamination — the two
literals and the config — not that it is clean in general; a URL built from pieces at runtime would not
contain either literal, which is why the resolved config is checked alongside the strings. Normalise `out` inside `assemble()` rather than trusting callers to pass the
canonical path. `packages/web-miner`'s own `build` is on no deploy path; note that in its script rather than
guarding it.
Gate: `bun run lint` · `bun test packages/site` · `bun test packages/web-miner/tests/presto.bun.test.ts`, which
holds the consumed-endpoint checks — extended so that the production-input case asserts `httpsOnly: true` on the
endpoint itself rather than equality with an imported default, plus the mutation test above · in the site
suite, a test that writes a loopback origin into the inspected output and requires assembly to fail, an invalid mode refused, a `YACANA_SITE_MODE=e2e` assembly into
the production directory still refused, a missing `_headers` or `build.json` failing, and the intended e2e
output still allowed · `bun run site:build` clean.
Layers: lint · unit.

**P1 · Measure, and change nothing else.** The coarse numbers are already known (26.5 min CI, 24.9 in the e2e
step; 16.6 min locally, 16.2 in Playwright); this phase produces the fine ones. Time the **whole** run, not just
`run-setup.ts`: the isolated network starts inside `e2e:agent` before Playwright launches, so instrumenting
setup alone misses it. Emit a
machine-readable per-spec report (`json` or `blob` beside `list`, which writes no file today although
`e2e.yml:31` archives `playwright-report`). Reconcile the recorded total against the job's own clock, so
unattributed time is visible rather than hidden.
Gate: `bun run lint` · one local run and one CI run, each producing a breakdown that separates network startup,
deployments, bundle build, and per-spec time, states what share of the total is rig, and attributes claim
proving specifically — **browser** proving, from the `client-ivc-proof-generation` events Playwright captures
off the page's console, summed per spec and kept apart from the deployer's and the burst miner's native proofs
(which are what the run logs show today) and from the surrounding sync, submission and inclusion time, which
are reported as their own lines — because P5's decision rule rests on that number and no other phase collects
it. Two validations are built in. A run with `aztec_sendTx` deliberately delayed must show submission time rising
while measured proving time stays put, or the instrument is measuring the wrong thing. And **absence of
evidence fails the measurement**: every test that necessarily completes a browser proof — each claim, the
lost-race spec's reverted claim, the withdraw spec's two transfers — must yield that many well-formed events
with positive durations, read from the console message's structured arguments rather than its text, or the
report is rejected rather than recording zero; tests that legitimately prove nothing are listed as such so a
silent collector cannot hide among them. Pass
criterion: the breakdown exists, reconciles to within a stated margin of the job clock, and answers "is the claim
transaction proof the bulk?" in one sentence with a number behind it. No optimisation ships here.
Layers: lint · e2e · CI.

**P2 · Shard by explicit file lists, with a cost ceiling.** Split by naming files, sized by P1's numbers. Merge
the reports. Assert coverage: Playwright suppresses "no tests found" under `--shard`, and a job can also go green
having skipped tests, so the gate compares the executed test identities against the inventory rather than
trusting exit codes.
Gate: `bun run lint` · `bun run lint:actions` · `bun test packages/web-miner` with a unit test that the job file
lists cover every `*.e2e.ts` exactly once — and, once P3 exists, that the sharded inventory plus the replayed
tests equal the original nineteen minus any exclusion declared by name, so a failed migration cannot hide
behind a shrunken expectation · a check that no spec carries `.only` · CI green where **the executed
identities equal the inventory**, the slowest job finishes under **15 minutes**, and the matrix's total runner
minutes stay under **45** — both set from the measured baseline (26.5 min on one runner) and tightened, not
loosened, if P1's finer numbers allow.
Layers: lint · unit · e2e · CI.

**P3 · A record-and-replay lane, on pull requests.** Clone the stats visual lane's shape for the miner. Scope it
honestly: the three tests that never open an account — dialog geometry, the malformed-RPC rejection, and the
old-Presto notice. The pop-out and missing-passkey tests call `bootPage()`, which opens an account and a PXE, so
they are not candidates.
**A spike comes first, timeboxed to one working session**: record the three tests' RPC under `e2e:agent`, replay
it with no node, and run them. If that does not pass cleanly within the box, the arc is abandoned, the three
tests stay in the sharded suite, and the plan records why. Nothing below is built until the spike passes.
What the spike must get right, known in advance: the miner's preflight calls `aztec_getBlockNumber` first,
which the stats recording never captured; its public-epoch reads fetch the seed slot, which stats never read; the
replay build must set `VITE_E2E_QUERY_OVERRIDES=1` — the stats `visualEnv` does not, and without it the
old-Presto test's `?presto=<port>` is silently ignored; the fake Presto is a stateful HTTP server the spec starts
itself and must stay one (its `GET /health` changes after `upgrade()`, so it cannot be a recording); the dialog
test needs an explicit Presto disposition (`presto=off`) so the default probe is not left to time out; the
malformed-RPC test's garbage must not be recorded under the shared mock origin; and the spike does not merely wait
past the 30-second public poll but **observes one complete**: the replay handler records a second
public-epoch read served after the first, and the page's log carries no swallowed poll error — a stopped timer
produces no unexpected traffic, so silence would prove nothing.
**The running cost, stated now**: the lane fails whenever the miner's boot-time RPC surface changes — a new call,
a changed parameter, a contract redeploy — until someone re-records on a machine with the toolchain. The stats
lane already works this way; this doubles that maintenance surface.
Three things the phase must solve, named now because they are where it will fail: `serve.ts` hard-codes the stats
package as its working directory, so its `buildApp`/`startPreview`/`waitUntilUp`/`claimPreviewPort` helpers are
parameterised and the stats lane re-validated in the same change; the replay specs need their own discovery
boundary, or the existing `testMatch` will sweep them into the full suite; and the recording is bound to the
contract artifacts, the storage layout and the SDK it was taken against, not merely to the RPC keys it holds.
The trigger is `pull_request`, matching how `web-miner.yml`'s change filter already works (Ask 2, answered).
Gate: `bun run lint` · `bun run lint:actions` · the lane green locally with no isolated network running · the
stats visual lane still green after the helpers move · a compatibility mutation: change one bound input and
require the lane to fail rather than replay a stale-but-consistent fixture · strict network accounting, so
unexpected traffic through the end of the test fails the lane, with explicit allowances for the deliberately
malformed response and the fake Presto endpoint · green in CI on `pull_request` inside **8 minutes** for the job, a
10-minute timeout, and a change filter covering the miner's sources, the stats helpers it imports, the run
scripts, the recording files and the contract artifacts. Layers: lint · e2e · CI.

**P4 · Trim the rig, if P1 says it is worth it.** Two environment booleans in `run-setup.ts`: skip the
impossible-target deployment, skip Presto. Both dependencies must fail loudly rather than degrade — a missing
Presto silently skips today (`presto.e2e.ts:27`), and a missing hard deployment would stringify into a URL that
fails confusingly.
Gate: `bun run lint` · `bun test packages/web-miner` · a run with each dependency withheld, each failing with a
named error rather than a skip · a successful trimmed run recording the saving against P1. Layers: lint · unit ·
e2e.

**P5 · Proverless — conditional, last, and possibly never.** The decision rule, fixed now: **built only if P1
shows browser-side transaction proving above 30% of test time** (denominator: the per-spec durations summed,
not the job clock). No honest estimate exists yet — see above — so the rule is a policy: that proving is the
only thing exercising the claim circuit's in-circuit verification of the mining proof, and it is not traded for
less than a third of the suite. Note also that the flag would sit
at the wallet (`wallet.ts:65`), so it would fake every transaction the embedded PXE proves — withdrawals and rolls
too — not claims alone. If P1 clears the bar, the owner
still decides how much coverage goes (Ask 3), with the number in hand. The flag
follows the `config.ts` template; its marker must be inseparable from the flag, since a marker that is merely
defined is tree-shaken and one emitted as its own asset proves nothing about the code.
The canary is the point of the phase, and its boundary is specified here rather than left to the implementer: it
runs against the **real-proving** browser build, asserts that build actually selected the real prover, and
injects the fault at the claim boundary — after the worker's own verification of the mining proof, which would
otherwise be what rejects it. Preserve valid encoding, a winning ticket and a live epoch, so that parsing, the
target threshold and epoch state cannot explain the failure. Altering a bound public input while keeping the
proof bytes well-formed is one way. `packages/miner-core/src/live.test.ts:305` is prior art for the tampering,
though it does not establish which prover a browser build chose.
Gate: `bun run lint` · `bun test packages/site` (the flag dropped in production, asserted through `viteDefine`) ·
a flagged build proving the marker present and a production build proving it absent · the negative canary failing
for the specified reason, demonstrated by showing it passes when the input is untampered · the claim lane green
with its measured saving. Layers: lint · unit · e2e.

**Coverage exclusions, stated rather than discovered.** `miner.e2e.ts:260` skips when the browser lacks Document
Picture-in-Picture. That is a silent skip today; whichever phase touches the workflow either requires a browser
that supports it or records it as an accepted exclusion.

## Architecture & Implementation

**Where the work lands.** `packages/web-miner/e2e/run-setup.ts` gains step timing and two booleans;
`packages/web-miner/e2e/replay/` is new and mirrors `packages/web-stats/e2e/visual-setup.ts`;
`.github/workflows/e2e.yml` gains a job matrix of file lists; `.github/workflows/web-miner.yml` gains the replay
lane; `packages/site/src/{config,vite-base,assemble}.ts` take the P5 hardening. `E2eRun` stays total — a spec
that reads a field its job did not provision gets a named runtime error from `run()`, not an optional type that
forces non-null assertions through nine spec files.

**What is deliberately reused rather than rebuilt.** `packages/web-stats/e2e/serve.ts` already factors out
`buildApp`, `startPreview`, `waitUntilUp` and `claimPreviewPort`, and its `waitUntilUp` handles both loopback
families where `run-setup.ts:67` handles one. The replay lane imports them rather than copying, and P3 closes
that divergence instead of deepening it.

**What is not attempted.** A claim-ready fixture — starting a spec from an already-claimed state — was in the
brief. It is not in this plan: the claim state lives in the wallet's PXE, whose notes are derived per account
from a chain the fixture would also have to fake, and the replay lane covers the read-path tests that would
benefit most. If P1 shows the claim specs dominate even after sharding, it comes back as its own plan.

**Trade-offs.** The rejected alternative is the first draft's: per-test tags, a lane abstraction and a lane
matrix. It is more machinery for a saving two reviewers independently measured at about one boolean, and its
`@ui` lane could not have worked. Sharding plus replay delivers the same wall clock and a genuinely fast push
lane; two booleans deliver the rig saving.

## Security & Adversarial Considerations

- **The one real pre-build barrier is `config.ts:92`.** Everything else the first draft claimed shares its
  predicate, is unreachable, or cannot fire in production. P0 fixes that inventory rather than building on it.
- **`YACANA_SITE_MODE` is unvalidated, and `assemble.ts:69-70` is what stops that mattering on the supported
  routes.** An unvalidated string re-enables most overrides (the query overrides need the exact mode `e2e`),
  skips the assertion and loosens the CSP in the *build*. `site:deploy` and Workers Builds' configured build
  step both go through `assemble`, which refuses a non-production mode into the production directory or a
  Cloudflare build — so on those routes the exposure is a confusing late failure. A bare `wrangler deploy` of
  an existing `dist` has no such guard; it is named, not closed. P0 makes the failure early and specific, and
  adds the artifact inspection at the same chokepoint.
- **The threat model for a build flag is whoever controls the build environment.** That is the same actor who
  could edit the source, so a build flag is a guard against mistakes more than against attackers; the inspection
  in P0 is what turns "we set the config right" into "the artifact carries none of the contamination we know
  to look for".
- **A proverless flag reaching production would not by itself let an attacker mint** — the attacker already
  controls their own browser, and the network is the boundary. It would break transaction submission for real
  visitors and invalidate the suite. That is the honest framing; my draft overstated it.
- **A test that proves nothing is the real risk of this plan**, and it has three named forms: a shard that runs
  nothing and is green, a spec that skips because its dependency is absent and is green, and a proverless claim
  that mints with a proof nobody checked. Each has a gate above.
- Least privilege, supply chain and run isolation are unchanged: no new dependency, no new secret, no new
  permission. Jobs keep `contents: read`.

## Assumptions

**Facts** (verified in this worktree at `15e4550`, or in the pinned toolchain)

1. `boot.ts:127-153` makes a live node and a live deployment mandatory before the sign-in screen renders.
2. `packages/web-stats/e2e/visual-setup.ts` is a working record-and-replay lane with no node in `serve`, wired
   into `web-stats.yml` on pull requests.
3. `config.ts:92` drops every override in production; `config.ts:170-171` cannot fire; `config.test.ts:110`
   does not test those branches, `:19` proves the dropping.
4. `vite-base.ts:45` casts `YACANA_SITE_MODE` without validation; `headers.ts:19` widens `connect-src` outside
   production; `assemble.ts:69-70` refuses a non-production build into the production directory or a Cloudflare
   build, and `site:deploy` and Workers Builds' build step both go through `assemble`, so a misspelled mode is
   refused on every supported route; a bare `wrangler deploy` of an existing `dist` is not guarded.
5. The toolchain's local network defaults `realProofs` to false (`local-network.ts:138`), so the node installs
   `TestCircuitVerifier` (`factory.ts:219-228`), which always answers valid.
6. `states.e2e.ts:75-84` synthesises its race by holding `aztec_sendTx` at a route.
7. `helpers.ts:45`'s `BOOT_MS` is a timeout, not a per-test cost.
8. The root `tsconfig.json` includes `packages/*/e2e` and `miner-core.yml` runs `bun run typecheck` on pull
   requests, so the e2e directory **is** typechecked; only the package-level `tsconfig.tests.json` omits it.
9. Playwright 1.62.1 has `--shard`, `--grep`, `--grep-invert`, `--project`, and assigns whole files to shards.
10. `run-setup.ts` always runs two deployments, builds the bundle into a shared `e2e/.dist` with
    `--emptyOutDir`, starts two proxies, and starts Presto when installed.
11. CI run 34395322513's miner job: 26.5 min total, 24.9 in the e2e step, the earlier steps cached and under a
    minute each (codegen 21 s, Playwright install 32 s). Inside the e2e step: node ready at 0:31, preview ready at
    2:43, tests 2:43–24:52. Locally: 16.6 min wall, 16.2 reported by Playwright, and
    the per-spec durations sum to 14.6 — so Playwright's total includes its global setup (the two deployments and
    the bundle build, about 1.6 min) and the node's start and stop sit outside it (about 0.4). Fixed cost is
    about two of the sixteen-and-a-half minutes locally; the CI projection is the one made from the CI log's own
    timestamps above (about 22 min of tests, 4.4 of everything else; three shards near 35 runner-minutes with
    the slowest job near 12).
12. Measured local durations, last green run (the one at the head commit): lost race 2.0 min, withdraw 1.9,
    node-away 1.7, first visit 1.5, power changes 1.4, passkey 60 s, switch 53 s, presto claim 52 s, prover crash
    47 s, CRS purge 43 s, words 42 s; the rest under twenty seconds. Per-spec total 14.6 min.

**Inferences** (attack these)

1. That sharding's wall-clock win survives the fixed rig each job pays again — its own network, deployments and
   build. P1 measures it; P2's pass criterion is derived from that measurement rather than assumed.
2. That the three signed-out tests' boot RPC is recordable the way the stats page's was. None of them opens a
   wallet or a PXE, so the surface is preflight, the public-epoch poll and the Presto probe; the six known
   obstacles are listed in P3, and the spike finds any seventh. If replay cannot cover a test, it stays in the
   sharded suite.
3. That two booleans capture the rig saving. If P1 shows the second deployment is cheap and the network is
   everything, P4 is not worth building.
4. That browser-side transaction proving is a minority of test time. Unmeasured: the logged proofs are the
   deployer's and the burst miner's, not the page's. P1 measures it from the page's own log timestamps; until
   then the 30% rule stands as policy and P5 is not planned.

**Asks** — two answered by the measured baseline, one converted to a rule

1. **Runner minutes — answered: yes.** The job is 26.5 minutes on one runner with a small fixed cost, so three
   shards cost roughly a third more minutes for roughly half the wall clock. P2's gate carries the ceiling
   (45 runner-minutes for the matrix, slowest job under 15).
2. **The push lane's trigger — answered: `pull_request`.** It matches `web-miner.yml`'s existing change filter;
   every-push would need `_changes.yml` reworked for a `push` event and would run on unfinished branches.
3. **Proverless — a rule, not a question.** Built only if P1 shows browser-side transaction proving above 30%
   of test time. No estimate is claimed; P1 produces the number. If it clears the bar, the owner decides the
   coverage trade then.

## Decision ledger

| Decision | Source | Outcome |
|---|---|---|
| Per-test tags and a lane abstraction | first draft | **Rejected** by both reviewers: the saving is about one boolean and the `@ui` lane was impossible |
| A chainless lane with no node | first draft | **Rejected**: `boot.ts` requires node and deployment |
| Record-and-replay for the fast lane | second review | **Adopted**: already built for stats, the only shape that satisfies the preflight |
| Naive `--shard N/M` | first draft | **Rejected**: splits by file and pairs the two longest specs; explicit file lists instead |
| "Four independent barriers" | first draft | **Rejected as false**; P5 fixes the real inventory |
| Proverless as the third of four arcs | first draft | **Rejected**: unmeasured benefit, real coverage cost; moved last and made conditional |
| One happy-path canary | first draft | **Rejected**: happy path plus a negative case, or it proves nothing |
| A claim-ready fixture | the brief | **Deferred**: the state lives in the PXE; out of scope, named as a possible follow-up |
| Two lanes sharing a checkout | first draft | **Dropped**: not needed, and five other paths are fixed anyway |
| "e2e is in no typecheck" | second review, repeated by me | **Wrong**: the root tsconfig covers it and CI runs it |
| Timeouts quoted as durations | third review | **Corrected**: measured values from the last green run replace them |
| Six mandatory stacked arcs | third review | **Reduced**: four arcs after the fourth read, one conditional, the flag hygiene its own PR |
| P1 measuring only `run-setup.ts` | third review | **Widened**: the network starts before Playwright and must be timed |
| Asks 1 and 2 left as questions | third review | **Promoted to gates** on the phases they govern |
| P5's artifact check "in assemble.ts" | third review | **Specified**: after assembly, over emitted chunks and headers |
| The proverless canary as "a negative case" | third review | **Specified**: real-proving build, fault injected at the claim boundary, other causes excluded |
| "Forty minutes in CI" | fourth read | **Corrected** to the measured 26.5, with a small fixed cost; the sharding maths flips |
| "One variable opens the front door" | fourth read | **Softened**: `assemble.ts` already refuses it on the supported routes; P0 is early failure, not a closed hole |
| P0's "forbidden content" | fourth read | **Defined**: loopback origins in `dist/**/*.js` and `_headers`; a non-production `build.json` |
| Proverless as an open ask | fourth read | **A rule**: built only above 30% of test time; the estimate withdrawn — the logged proofs were not the browser's |
| P3 straight into arc C | fourth read | **A spike first**, timeboxed; the maintenance cost named |
| Asks 1 and 2 | fourth read | **Answered** from the measured baseline: yes to sharding; `pull_request` |
| "Every deploy path goes through assemble" | codex on the fourth read | **Narrowed** to the supported scripts; a bare `wrangler deploy` of an existing `dist` is named as unguarded |
| The 7% proverless estimate | codex on the fourth read | **Withdrawn**: the logged proofs were the deployer's and the burst miner's; P1 measures the browser's |
| P0's two-string grep as "the artifact is clean" | codex on the fourth read | **Reframed** as a contamination check plus a resolved-config check, with missing output failing |
| P3's replay premise | codex on the fourth read | **Six concrete obstacles named** for the spike; an 8-minute budget; the change filter's scope |
| D stacked on C | codex on the fourth read | **Unstacked**: proverless needs the measurement and P0, not the replay lane |
| P1 measuring the controller's log interval | codex, round 2 | **Replaced**: the prover's own `client-ivc-proof-generation` events off the page console, with a delayed-`sendTx` validation |
| P0 asserting an HTTPS-only "field" | codex, round 2 | **Bound to the consumed endpoint**: `prestoEndpointFor` under production inputs, plus a mutation test |
| P3 "wait past the poll" | codex, round 2 | **Observe a completed poll**; and the inventory invariant spans both suites |
| Six passages the corrections had not reached | codex, round 2 | **Rewritten in place** |
| A collector that records zero proving | codex, round 3 | **Fails the measurement**: expected proofs must yield positive-duration events |
| P0's gate naming only the site suite | codex, round 3 | **Runs the miner's endpoint tests** and asserts `httpsOnly` on the consumed endpoint |

## Delivery

Four arcs, one of them conditional and probably never opened. The flag hygiene ships as its own pull request
first, since it depends on nothing. The measurement is the first phase of the sharding arc rather than a pull
request of its own: its code is a reporter and some timestamps, and its numbers land in `lessons/phase-1.md`
before P2's split is chosen. The replay lane is its own arc because its spike may kill it. P1's CI measurement runs through the dispatchable
workflow on the feature branch, since no pull request exists until the loops converge; and the unoptimised
local and CI numbers are recorded in `lessons/phase-1.md` before P2's split is chosen — the boundary that matters
is the measurement, not the pull request. After the last arc built, the coverage and timing gates run once more
on the combined system, since each arc changes what the earlier evidence described.

| Arc | Phases | Stacks on | Independently useful? |
|---|---|---|---|
| A · flag hygiene | P0 | main (its own PR) | Yes — early, clear failure on a misconfigured build |
| B · measure, shard, trim | P1, P2, P4 | main | Yes — the wall-clock win |
| C · replay lane | P3 (spike, then lane) | arc B — it changes B's inventory check to exclude the replayed tests | Yes — the miner checked on every pull request |
| D · proverless | P5 | arc B, if ever — it needs the measurement and P0's safeguards, not the replay lane | Only if P1 clears the 30% bar |

## Post-implementation

`/code-review` is **off**; the codex fix loop is the review. At each arc boundary, after that arc's phases are
green and before `gh stack add` opens the next:

1. `/codex high` with the arc's diff, this plan, the decision ledger and the arc map, the adversarial and
   security ask, and verbatim: *"Report bugs and small, targeted improvements only. Do not propose speculative
   abstractions, extra configuration surface, new layers, or rewrites — the smallest change that fixes each real
   problem. If code works and is clear, leave it alone."* and *"Audit the comments for value per character. Flag
   any comment that narrates what the code visibly does, restates its line, references implementation plans /
   phases / reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious
   invariant or constraint deserves a comment it doesn't have."*
2. Verify every finding against the repo before acting; apply what holds; commit; log the round in
   `lessons/phase-N.md`; resume the same session with the fix diff. Repeat until nothing material. Three rounds
   without convergence: stop and surface.
3. After the last arc that is actually built: a fresh codex session over the net diff from `15e4550` for
   cross-arc issues.
4. Then Delivery: `gh stack sync`, `gh stack submit --auto`, `gh pr edit` each body, `gh pr checks --watch`. No
   pull request before the loops converge. Never merge, never deploy, never push to main.

## Approval

ELI5 companion: `implementations-plan/e2e-lanes/eli5.html`, published as the Artifact **Faster Miner Tests**:
https://claude.ai/code/artifact/bb5030c3-30d5-426c-afa4-8af0a3642e3b

Audit trail: `audit-codex.md` (two passes on the early versions, then three rounds on the fourth read's
corrections) and `audit-fable.md` (the first-draft audit, and the fourth read). Three rejections on the first two
versions; the fourth read, by a different reviewer against the last green CI run, gave a conditional approve;
codex then rejected that read's corrections twice — once for citing the deployer's proofs as the browser's, once
for a measurement interval that spanned more than proving — and on the third round returned
**conditional approve (with conditions: P1 fails on missing or malformed expected browser proof events; P0
explicitly runs the consumed-endpoint tests and mutation check)**. Both conditions are in this version.

## Seeds

Drafted; finalised after approval.
