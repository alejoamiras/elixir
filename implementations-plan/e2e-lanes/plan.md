# e2e-lanes — the miner suite, faster, and honest about what it proves

```
driver: claude-code
tier: mid
eli5_mode: artifact
code_review: off
status: reworked twice; three audits on the record; awaiting the owner
```

## What this is

The miner's browser suite is nineteen tests, about sixteen minutes on the homelab and forty in CI on one runner,
and it runs on `workflow_dispatch` only, so nothing about the miner is checked on an ordinary push. This plan
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
  `test.setTimeout` values. The measured durations from the last green run are: lost race 2.6 min, withdraw
  1.9 min, node-away 1.7 min, first visit 1.5 min, power changes 1.4 min, switch 53 s. The suite's sixteen local
  minutes are spread more evenly than the timeouts suggest, which weakens the case for pinning specs to their
  own jobs and strengthens the case for measuring before sharding at all.

## The shape that follows from that

Measure first, then take the cheap wins, and treat the risky one as optional and last.

**No tags, no lane abstraction.** Both reviewers reached the same conclusion independently: what a lane could
actually skip is one of the two deployments, two node proxies and a Presto — roughly one boolean's worth of
saving — while the isolated network, the production build and at least one deployment are unavoidable for every
test that opens the app. Two environment booleans in `run-setup.ts` deliver that saving without a taxonomy.

**Sharding by explicit file lists, not `--shard`.** Playwright assigns whole files to shards by cumulative test
count, which is a proxy for cost that this suite does not honour: measured, its slowest spec is 2.6 minutes and
its fastest is under a second, and the counts do not track that. Naming files keeps the split under control.
nulo pins its heavy files to their own jobs for the same reason, and its comment records the deadlock that
taught it.

**The fast lane is record-and-replay, cloned from the stats visual lane.** It is the only shape that satisfies
the mandatory deployment probe without a chain, and it is already proven in this repo on every pull request.

**Proverless is optional, last, and may never be built.** It removes only the claim transaction proof; the
mining proof runs in a worker and is untouched. Whether that is most of the time is unknown until P1 measures
it. It also genuinely reduces what the suite proves, so it gets its own decision, with numbers, after P1.

## Phases

Five phases. Two of them — the flag hygiene and the measurement — depend on nothing and can land in either
order; the rest follow the measurement. The last is conditional and may never be built.

**P0 · Flag hygiene, independent of everything else.** Validate `YACANA_SITE_MODE` against its three literals and
throw otherwise. Decide the fate of the unreachable assertions in `assertProductionConfig` — delete them, or make
them assertions over an independently constructed config with tests that fail when a guard is removed; either is
honest, neither adds a barrier. Add an artifact inspection to `assemble.ts` **after assembly, before it reports
success** (lines 69-70 run before any artifact exists), over the emitted chunks and the shipped headers rather
than over the config object. Bring `packages/web-miner`'s own `build` under the same guard without forcing a
three-app build on someone who wants one app. Normalise `out` inside `assemble()` rather than trusting callers to
pass the canonical path.
Gate: `bun run lint` · `bun test packages/site`, including a test that injects forbidden content into the
inspected output and requires the build to fail, a `YACANA_SITE_MODE=e2e` build refused through the production
entrypoint, an invalid mode refused, and the intended e2e output still allowed · `bun run site:build` clean.
Layers: lint · unit.

**P1 · Measure, and change nothing else.** Time the **whole** run, not just `run-setup.ts`: the isolated network
starts inside `e2e:agent` before Playwright launches, so instrumenting setup alone misses it. Emit a
machine-readable per-spec report (`json` or `blob` beside `list`, which writes no file today although
`e2e.yml:31` archives `playwright-report`). Reconcile the recorded total against the job's own clock, so
unattributed time is visible rather than hidden.
Gate: `bun run lint` · one local run and one CI run, each producing a breakdown that separates network startup,
deployments, bundle build, and per-spec time, states what share of the total is rig, and attributes claim
proving specifically — because P6's decision rests on that number and no other phase collects it. Pass
criterion: the breakdown exists, reconciles to within a stated margin of the job clock, and answers "is the claim
transaction proof the bulk?" in one sentence with a number behind it. No optimisation ships here.
Layers: lint · e2e · CI.

**P2 · Shard by explicit file lists, with a cost ceiling.** Split by naming files, sized by P1's numbers. Merge
the reports. Assert coverage: Playwright suppresses "no tests found" under `--shard`, and a job can also go green
having skipped tests, so the gate compares the executed test identities against the inventory rather than
trusting exit codes.
Gate: `bun run lint` · `bun run lint:actions` · `bun test packages/web-miner` with a unit test that the job file
lists cover every `*.e2e.ts` exactly once · a check that no spec carries `.only` · CI green where **the executed
identities equal the inventory**, the slowest job beats a wall-clock target set from P1, and total runner minutes
stay under a ceiling the owner approves (Ask 1, answered with P1's numbers before this phase is implemented).
Layers: lint · unit · e2e · CI.

**P3 · A record-and-replay lane, on every push.** Clone the stats visual lane's shape for the miner. Scope it
honestly: the three tests that never open an account — dialog geometry, the malformed-RPC rejection, and the
old-Presto notice. The pop-out and missing-passkey tests call `bootPage()`, which opens an account and a PXE, so
they are not candidates.
Three things the phase must solve, named now because they are where it will fail: `serve.ts` hard-codes the stats
package as its working directory, so its `buildApp`/`startPreview`/`waitUntilUp`/`claimPreviewPort` helpers are
parameterised and the stats lane re-validated in the same change; the replay specs need their own discovery
boundary, or the existing `testMatch` will sweep them into the full suite; and the recording is bound to the
contract artifacts, the storage layout and the SDK it was taken against, not merely to the RPC keys it holds.
Ask 2 — the trigger and branch scope — is answered before the workflow is written.
Gate: `bun run lint` · `bun run lint:actions` · the lane green locally with no isolated network running · the
stats visual lane still green after the helpers move · a compatibility mutation: change one bound input and
require the lane to fail rather than replay a stale-but-consistent fixture · strict network accounting, so
unexpected traffic through the end of the test fails the lane, with explicit allowances for the deliberately
malformed response and the fake Presto endpoint · green in CI on the agreed trigger inside a budget named before
implementation. Layers: lint · e2e · CI.

**P4 · Trim the rig, if P1 says it is worth it.** Two environment booleans in `run-setup.ts`: skip the
impossible-target deployment, skip Presto. Both dependencies must fail loudly rather than degrade — a missing
Presto silently skips today (`presto.e2e.ts:27`), and a missing hard deployment would stringify into a URL that
fails confusingly.
Gate: `bun run lint` · `bun test packages/web-miner` · a run with each dependency withheld, each failing with a
named error rather than a skip · a successful trimmed run recording the saving against P1. Layers: lint · unit ·
e2e.

**P5 · Proverless — conditional, last, and possibly never.** Built only if P1 answered its one-sentence question
with a number that justifies it, and only after the owner answers Ask 3 with that number in hand. The flag
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

- **The one real pre-build barrier is `config.ts:92`.** Everything else I claimed shares its predicate, is
  unreachable, or cannot fire in production. P5 fixes that inventory rather than building on a fiction.
- **`YACANA_SITE_MODE` is the attack.** One unvalidated string re-enables the overrides, skips the assertion and
  loosens the CSP. It is exploitable only by whoever controls the build environment — but that is exactly the
  threat model a build flag defends against, and the fix is three lines.
- **`assemble.ts:69-70` is the barrier that actually holds**, because it fires *because* the mode is not
  production. Artifact checks belong there, on the path every deploy takes, not in a script that only e2e runs.
  `packages/web-miner`'s own `build` bypasses it today.
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
   production; `assemble.ts:69-70` refuses a non-production build into the production directory.
5. The toolchain's local network defaults `realProofs` to false (`local-network.ts:138`), so the node installs
   `TestCircuitVerifier` (`factory.ts:219-228`), which always answers valid.
6. `states.e2e.ts:75-84` synthesises its race by holding `aztec_sendTx` at a route.
7. `helpers.ts:45`'s `BOOT_MS` is a timeout, not a per-test cost.
8. The root `tsconfig.json` includes `packages/*/e2e` and `miner-core.yml` runs `bun run typecheck` on pull
   requests, so the e2e directory **is** typechecked; only the package-level `tsconfig.tests.json` omits it.
9. Playwright 1.62.1 has `--shard`, `--grep`, `--grep-invert`, `--project`, and assigns whole files to shards.
10. `run-setup.ts` always runs two deployments, builds the bundle into a shared `e2e/.dist` with
    `--emptyOutDir`, starts two proxies, and starts Presto when installed.

**Inferences** (attack these)

1. That sharding's wall-clock win survives the fixed rig each job pays again — its own network, deployments and
   build. P1 measures it; P2's pass criterion is derived from that measurement rather than assumed.
2. That the miner's boot RPC is recordable the way the stats page's was. The stats page only reads storage; the
   miner also opens a wallet and a PXE, which may make far more calls, some of them stateful. P3 finds out
   early, and if replay cannot cover a spec, that spec stays in the sharded suite.
3. That two booleans capture the rig saving. If P1 shows the second deployment is cheap and the network is
   everything, P4 is not worth building.
4. That the wall-clock win is worth the runner minutes at all. Every shard pays its own network, deployments and
   build, so total minutes rise by roughly the fixed cost times the number of jobs. P1 measures the ratio and Ask
   1 becomes P2's gate rather than a question asked in the abstract.

**Asks** (for the owner, and P1's numbers answer most of them)

1. **Runner minutes.** Sharding multiplies fixed cost: three jobs pay three networks, three builds, three sets
   of deployments. Wall clock falls; total minutes rise, plausibly by more than half. Approve after P1 reports
   the real ratio, not now.
2. **The push lane's trigger.** Every push on every branch, or pull requests only. `web-miner.yml` runs on
   `pull_request` and `workflow_dispatch` today and its change filter is written for those; adding `push` is a
   real change, not a line.
3. **Whether to build P6 at all**, and if so how much claim coverage may go proverless. This one is a genuine
   trade of coverage for time and should be decided with P1's numbers.

## Decision ledger

| Decision | Source | Outcome |
|---|---|---|
| Per-test tags and a lane abstraction | first draft | **Rejected** by both reviewers: the saving is about one boolean and the `@ui` lane was impossible |
| A chainless lane with no node | first draft | **Rejected**: `boot.ts` requires node and deployment |
| Record-and-replay for the fast lane | second review | **Adopted**: already built for stats, the only shape that satisfies the preflight |
| Naive `--shard N/M` | first draft | **Rejected**: splits by file and pairs the two longest specs; explicit file lists instead |
| "Four independent barriers" | first draft | **Rejected as false**; P5 fixes the real inventory |
| Proverless as arc 3 of 4 | first draft | **Rejected**: unmeasured benefit, real coverage cost; moved last and made conditional |
| One happy-path canary | first draft | **Rejected**: happy path plus a negative case, or it proves nothing |
| A claim-ready fixture | the brief | **Deferred**: the state lives in the PXE; out of scope, named as a possible follow-up |
| Two lanes sharing a checkout | first draft | **Dropped**: not needed, and five other paths are fixed anyway |
| "e2e is in no typecheck" | second review, repeated by me | **Wrong**: the root tsconfig covers it and CI runs it |
| Timeouts quoted as durations | third review | **Corrected**: measured values from the last green run replace them |
| Six mandatory stacked arcs | third review | **Reduced to four**, with the two independent ones unstacked |
| P1 measuring only `run-setup.ts` | third review | **Widened**: the network starts before Playwright and must be timed |
| Asks 1 and 2 left as questions | third review | **Promoted to gates** on the phases they govern |
| P5's artifact check "in assemble.ts" | third review | **Specified**: after assembly, over emitted chunks and headers |
| P6's canary "a negative case" | third review | **Specified**: real-proving build, fault injected at the claim boundary, other causes excluded |

## Delivery

Four arcs, not six. The flag hygiene stands alone and can merge first or last; the measurement gates everything
after it; the conditional arc sits on top so abandoning it costs nothing. P4's rig trim rides with the sharding
it serves rather than becoming a parent of work that does not depend on it.

| Arc | Phases | Stacks on | Independently useful? |
|---|---|---|---|
| A · flag hygiene | P0 | main | Yes — a security fix on its own |
| B · measure | P1 | main | Yes — the numbers are the deliverable |
| C · shard, trim, replay | P2, P4, P3 | arc B | Yes — the wall-clock win and the push lane |
| D · proverless (conditional) | P5 | arc C | Only if arc B's numbers justify it |

Arcs A and B are independent of each other and of C; if the stack tooling makes that awkward, A ships as its own
pull request first.

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
3. After the last arc: a fresh codex session over the net diff from `15e4550` for cross-arc issues.
4. Then Delivery: `gh stack sync`, `gh stack submit --auto`, `gh pr edit` each body, `gh pr checks --watch`. No
   pull request before the loops converge. Never merge, never deploy, never push to main.

## Seeds

Drafted; finalised after approval.
