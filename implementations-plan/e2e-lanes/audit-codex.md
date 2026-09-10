The plan is not ready to build beyond P1. Its proposed UI lane cannot run unchanged, its isolation change is incomplete, and its canary gates can pass without establishing real transaction-proof validity. **Confidence: high.**

I verified HEAD is `15e4550`, read the relevant implementation and Nulo precedent, and ran the existing site-config tests: **5 passed**. I did not run a network or browser experiment; proverless submission remains experimentally unverified.

1. **Adversarial and security**

**The four barriers are fewer than four independent protections.**

| Claimed barrier | Actual protection and weakness |
|---|---|
| Production discards environment overrides | Useful, but conditional on selecting production mode correctly. |
| `assertProductionConfig` rejects proverless | A second assertion within the same configuration boundary. It runs only in production and depends on the wallet consuming that configuration. |
| Double opt-in | Catches one accidentally enabled variable. Both variables normally travel together in an E2E environment; copying that environment defeats this protection. |
| Negative bundle grep | Potentially a separate artifact check, but absence of a marker establishes only marker absence—not that the executed wallet proves transactions. |

The shared failure is **mode selection or configuration bypass**. [`siteConfig()`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/site/src/vite-base.ts:44) accepts `YACANA_SITE_MODE` through a TypeScript cast without runtime validation. Following the proposed “anything except production” rule would also permit proverless operation in development or an invalid mode.

Moreover, discarding `opts.env` does not itself prevent Vite exposing a newly added `VITE_*` variable. The plan must explicitly add the resolved constant to `viteDefine()` and make the wallet consume only that constant. A direct browser read of an unoverridden environment variable could bypass the configuration assertions while the marker still says “clean.”

There is an existing protection the plan understates: [`assemble()`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/site/src/assemble.ts:87) rejects nonproduction builds targeting the production directory or Cloudflare. Preserve and extend that boundary. Put artifact verification in the assembly/deployment path; `scripts/run/agent.sh` never runs during ordinary deployment.

Require these concrete properties:

- Proverless is allowed **only in explicit E2E mode**; reject invalid modes.
- Define whether production rejects raw proverless variables or ignores them. The plan promises both behaviors in different places.
- The marker and wallet decision derive from the same resolved constant, with verification of actual wallet behavior.
- Scan the final deployable artifact, including executable chunks/workers. Missing output and grep errors must fail.
- Real lanes explicitly clear both flags and verify their effective proving mode.

**The overlooked failure mode is cross-lane bundle replacement. Confidence: high.**

[`run-setup.ts`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/e2e/run-setup.ts:33) builds every run into `e2e/.dist` using `--emptyOutDir`. Renaming `.run.json` leaves that directory shared. A proverless lane could overwrite the real canary’s bundle **after its marker check**, changing what its preview server serves. Different deployments, logs and test outputs also collide. Two invocations of the same lane still share the proposed manifest.

Use a unique **run identity**, not a lane name, for every mutable output. Check the artifact actually served by that run.

**Correct the production threat model. Confidence: high.**

A proverless browser does not, by itself, make a correctly verifying production network mint invalid claims. An attacker already controls their own browser and can submit arbitrary transactions. The network verifier is the security boundary.

Shipping this flag would break transaction submission and invalidate test assurances; fake-proof acceptance on a production network would be a separate, substantially worse failure.

**The garbage-proof reasoning is directionally correct, but overstated.**

[`claim()`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/contracts/yacana_miner/src/main.nr:138) also checks the open epoch, hashes the supplied proof into a ticket, compares the target and emits a nullifier. “Any bytes mint” is therefore false. The relevant counterexample is a **well-formed invalid recursive proof whose ticket still wins**, with the other claim conditions satisfied.

Recursive-proof validity requires the proving backend; simulation alone is insufficient. That agrees with [Noir’s recursion documentation](https://noir-lang.org/docs/v1.0.0-beta.12/noir/standard_library/recursion). But acceptance through this exact browser/contract/network combination still needs a controlled experiment. **Confidence: moderate on the unrun end-to-end counterexample.**

**The proposed canary is insufficient. Confidence: high.**

- [`presto.e2e.ts`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/e2e/presto.e2e.ts:46) explicitly skips when Presto is absent.
- Its HTTP/log evidence establishes **native mining-proof production**, not client transaction-proof production.
- Valid input succeeding does not establish that invalid input is rejected. Removing browser verification could leave this happy-path test green.
- The installed Aztec 5.2.0 local network defaults `realProofs` to false. Its node factory selects `TestCircuitVerifier` unless real proofs or forced transaction-proof verification are enabled. That verifier returns `valid: true`. Thus **a mined transaction is not independent proof-validity evidence**, even in the lane named `real`.
- Withdraw exercises private and public transfer paths that the claim canary does not cover. Keeping withdraw real is additional coverage, not mere redundancy.

Require non-skipping canaries, proof-generation evidence, independent transaction-proof verification, and a negative case that fails specifically for invalid proof validity. Reuse the tampering patterns in [`live.test.ts`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/miner-core/src/live.test.ts:269), ensuring the altered ticket still wins; otherwise target rejection can falsely appear to test verification. The older spike script has that technique, but targets the older `yacana_spike` contract and cannot be copied unchanged.

One canary job can contain several cases. **One existing happy-path spec cannot substantiate “the suite proves no less.”**

2. **Assumptions: Facts, Inferences, Asks**

**Facts**

- **Fact 2 overclaims test coverage.** `config.test.ts:110` does not exercise the query-override or Presto assertion branches despite its test title. The earlier test proves environment overrides are ignored. Those are different properties.
- **Fact 6 confuses dependency classification with assertions.** Nineteen tests and the 3/3/5/8 partition are defensible as rough categories, but only seven explicitly require a claim. The crash test does not.
- **“No account” does not mean “no chain.”** [`preflight()`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/src/boot.ts:89) obtains node information and validates the deployment before exposing sign-in and probing Presto. Dialog geometry and the old-Presto update row therefore require successful chain preflight. Only the malformed-RPC case supplies its own failing response.
- **The lost-race explanation is false.** [`states.e2e.ts`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/e2e/states.e2e.ts:75) holds `aztec_sendTx` until the outside miner closes the epoch. It does not rely on transaction proving taking long enough. Timing around installing the route still deserves testing, but the stated reason for mandatory real proving is wrong.
- **The grep claim is false.** Resolved `FullConfig` exposes `grep` and `grepInvert`; filtering tests rather than projects does not make those settings invisible to setup. A regex is not a dependency inventory, so explicit lane selection remains reasonable—but for that reason. [Playwright API](https://playwright.dev/docs/api/class-fullconfig#full-config-grep).
- Facts 1, 4, 5 and the substantive storage-forwarding claim in Fact 7 match the code. Recon’s description of that forwarding mock as reusable “for a chainless lane” does not.

**Confidence: high throughout these corrections.**

**Inferences**

- **Inference 1: promote it to a feasibility gate before committing to P3.** Source evidence is stronger than the plan reports: PXE’s fake path emits `ChonkProof.random()`, and local-network defaults support accepting it. Still, run a minimal experiment using this repo’s pinned SDK, actual miner contract, sponsored fees and browser wallet. Record effective node verification settings, receipt and balance. If it fails, retain real proving and ship sharding; do not improvise broader network weakening.
- **Inference 2 mistakes a timeout for elapsed work.** `BOOT_MS` is an eight-minute ceiling, not a floor. Signed-out preflight and account opening follow different paths; wallet/CRS waits occur during opening. Measure those paths separately.
- **Inference 3 is acceptable as an experiment.** Three runners should remain provisional. Measure duplicated setup, total runner minutes and the slowest shard.
- **Inference 4 targets the wrong risk.** Adding metadata is straightforward. Selecting subsets changes shared deployment history, epoch state, warm-up and ordering. P2 needs selection-completeness checks and independent execution, not concern about tests asserting their titles.

**Asks**

- **Coverage reduction must be decided before approval.** It conflicts with the hard “proves no less” criterion. Listing lost coverage in lessons does not satisfy that criterion.
- **Trigger policy is already an intended outcome in this request:** every push. Specify branch scope and PR deduplication in the plan rather than leaving contradictory acceptance criteria.
- **Runner cost can be staged:** authorize the initial measurement, report cost, then decide expansion. Do not require the owner to approve an unspecified five-lane-plus-shards topology.

3. **Architecture and implementation**

**Start with P1, then reassess. Do not automatically commit to four arcs.**

Sharding preserves current behavior with little new machinery. Add machine-readable reports, unique artifact names and completeness checks. Keep `workers: 1`. If file imbalance matters, assess `fullyParallel: true` with one worker before introducing manual file allocation; Playwright supports test-level sharding in that configuration. It still requires checking independence and does not balance by duration. [Playwright sharding guide](https://playwright.dev/docs/test-sharding).

Tags become useful when there is a concrete selective-run requirement. The current lane design has three problems:

- **Its resource table is wrong.** `@mine` includes the native-Presto pill test, so it needs Presto. Omitting Presto can silently skip that test. Meanwhile `@claim` generally does not need the hard deployment; moving the Presto claim to `real` further changes its requirements.
- **It mixes independent concepts.** `ui/account/mine/claim` describe behavior, while `real` describes proving mode. The plan never defines whether canaries receive two tags, how the fake lane excludes them, or how complete selection is maintained.
- **It creates two selection controls.** `E2E_LANE` chooses the rig and `--grep` chooses tests. Derive both from one validated selection, using the existing config or a small wrapper. Unknown lanes and contradictory selections should fail before provisioning.

Optional fields also do not provide the promised interface. `JSON.parse(...) as E2eRun` validates nothing, and `hardMiner?: string` merely propagates `undefined`. Use narrowly typed capability accessors or a discriminated run record with runtime validation.

More fundamentally, the stated typecheck excludes E2E: [`tsconfig.tests.json`](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/tsconfig.tests.json:8) includes `tests`, the app config includes `src`, and the node config includes `vite.config.ts`. Add an actual E2E typecheck before claiming compile-time enforcement.

The node-free UI lane requires an explicit choice: retain one deployment, or implement deterministic preflight fixtures. Reusing the stats interception pattern could help, but its forwarding mock is not already offline. The existing outer `e2e:agent` also always starts a network; lane decisions made later in global setup cannot avoid that cost.

For stats and landing, **do not transplant the miner taxonomy**. Stats has five regular tests in one file; landing has three in one file and two build variants. Neither suite opens mining accounts or makes browser claims. Optimize their measured setup costs and preserve their live-chain checks. Tags alone provide no demonstrated saving.

Finally, same-checkout concurrency affects more than services: the miner’s RSS watcher sums **all** Playwright Chromium process trees on the host. Concurrent lanes can corrupt its memory assertion even after ports and files are isolated.

4. **Phasing and gates**

| Phase | Why the stated gate is insufficient | Required correction |
|---|---|---|
| **P1** | Green shards can repeat one subset or omit another. A historical “40 minutes” comment is not a controlled baseline. | Compare enumerated test identities across the complete shard union; record skips, setup, execution, total runner minutes and a comparable CI baseline. |
| **P2** | Four sequential green runs do not establish concurrency safety. Missing Presto can produce green skips. The typecheck omits E2E. | Include E2E in typechecking; verify exact selection and required dependencies; run concurrent lanes and same-lane invocations; interrupt one and prove the other survives. |
| **P3** | Marker absence does not prove runtime behavior. A green canary may skip or submit to a fake verifier. Production “refuses” versus “ignores” is unresolved. | Exercise configuration combinations and real build entry points; verify the served artifact and effective wallet mode; require independent proof verification plus proof-specific rejection. |
| **P4** | “Inside its own time budget” has no defined budget. The UI lane is not currently node-free. Stats/landing changes lack acceptance detail. | Set a measured budget before accepting the phase; specify trigger/filter behavior and suite-specific setup savings. |

Later arcs can absolutely invalidate earlier evidence:

- Tags change P1’s selected sets; recheck completeness after every matrix change.
- Proverless execution changes timing of `claiming`, Stop, reload and switch assertions; P2’s real-proving results do not validate P3.
- Separate real and fake builds can invalidate marker evidence through shared output directories.
- A required canary that remains dispatch-only supplies no evidence for ordinary pushes. Specify when it must run and succeed.
- P4 should not depend on proverless. A selective UI check and transaction-proof optimization are independently deliverable.

Retain a full real-proving invocation as the reference suite. Either run it at the agreed acceptance points or explicitly narrow the “no coverage loss” promise.

reject (with blocking findings: incorrect UI-lane dependencies; incomplete run and bundle isolation; canaries do not establish real proof validity or preserve claimed coverage; phase gates permit silent omissions and skips)

---

# Final fresh pass, on the rework

The rework is materially responsive, but it still has implementation gaps and gates that can pass without establishing their stated conclusions. **Confidence: high** on the code findings; **moderate** on the likely performance benefit.

I checked commit `15e4550`, the referenced application code, and the installed pinned toolchain. The eight config/assembly tests pass. TypeScript’s file listing confirms that all nine miner E2E files already belong to the root typecheck. I did not run the full browser suite or verify historical CI durations.

**The ledger mostly translates into phases, with three important exceptions.**

| Ledger decision | Reflected in the rework? |
|---|---|
| Reject tags/lane abstraction | Yes: explicit file selection and two booleans. |
| Reject simply omitting the node | Yes, although “requires a live node” should mean “requires valid node responses”; replay supplies those. |
| Adopt replay | P3 adopts it, but the proposed helper reuse cannot work unchanged. |
| Reject naive sharding | Yes. The current file grouping supports the claimed undesirable split. |
| Reject four barriers | Yes in the inventory; P5’s replacement artifact barrier remains underspecified. |
| Move proverless last and make conditional | Yes structurally, but P1 does not collect the measurements required to unlock it. |
| Require negative canary | Written into P6, but its execution mode and failure boundary remain unspecified. |
| Defer claim-ready fixture | Explicitly deferred. Reasonable scope choice, although preparing state on a live chain would not necessarily require faking that chain. |
| Drop concurrent lanes in one checkout | Explicitly dropped. Do not then call existing fixed output paths generally parallel-safe. |

The [recon](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/implementations-plan/e2e-lanes/recon.md) still says Playwright lacks `--shard`, recommends the dead guards “as is,” calls partially mocked storage chainless, and describes `BOOT_MS` as a cost floor. Correct it or label it superseded. Leaving those instructions beside the reworked plan is a concrete regression risk.

**P5 is directionally correct, but not yet sufficient.**

Validating the mode closes the invalid-string path. It does **not** prevent a valid `e2e` or `dev` mode reaching an inappropriate output. Those modes still need destination/build-entrypoint enforcement.

The current [assembly guard](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/site/src/assemble.ts:65) protects the canonical production destination and `CF_PAGES` builds. It is not a universal deployment boundary: the repository also permits standalone Vite builds, and Wrangler can publish existing assets directly. Describe its protection as covering the supported build/deploy commands, rather than every possible deployment.

P5 needs these concrete requirements:

- Put the artifact inspection **after assembly**, before successful completion. Lines 69–70 execute before any artifact exists. Define what is forbidden in P5 independently of P6’s future marker.
- Inspect the actual emitted application/worker chunks and shipped headers. A clean `SiteConfig` or `build.json` alone does not establish that the payload is clean.
- Test valid `e2e`/`dev` rejection through production entrypoints, invalid-mode rejection, and contaminated-output rejection. Also test that the intended E2E output remains allowed.
- Cover the miner’s standalone production build without replacing a miner-only build with an unnecessary three-app build.
- Normalize `out` inside exported `assemble()`: its current string equality depends on callers already supplying the canonical path.

Deleting the redundant assertions is acceptable. Keeping them as assertions over independently constructed `SiteConfig` values is also acceptable, with direct tests. Neither choice creates another independent barrier.

The production-mint framing is correct **for a network enforcing proofs**. A browser flag cannot weaken consensus verification; attackers already control their clients. However, the proposed wallet-level switch affects **every transaction proved by that embedded PXE**, including withdrawals and rolls—not merely claim transactions. [wallet.ts:65](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/src/wallet.ts:65) makes that scope clear.

There is also stronger evidence for the revised coverage claim: the pinned client [verifies its generated Chonk proof locally](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/node_modules/@aztec/bb.js/src/barretenberg/backend.ts:374). Proverless removes that check too.

**The ten Facts need several qualifications.**

| Fact | Code verdict |
|---|---|
| 1 | Successful preflight is mandatory. An actually live chain is unnecessary when faithful responses are intercepted. |
| 2 | Replay implementation and PR wiring confirmed. “Every PR” is qualified by the change filter; fifteen minutes is the job timeout, not demonstrated runtime evidence. |
| 3 | Correct for `loadSiteConfig`’s environment overrides. “Every override” should not include upstream environment choices such as `YACANA_PROFILE`. |
| 4 | Core finding confirmed. An arbitrary invalid mode does **not** enable query overrides: those require exact mode `e2e`. Other overrides and relaxed CSP remain exposed. |
| 5 | Default behavior confirmed, but the verifier condition is `realProofs || debugForceTxProofVerification`. Source defaults do not prove the historical statement “never verified.” |
| 6 | Confirmed: the race is held at `aztec_sendTx`. |
| 7 | Confirmed: timeout, not cost. |
| 8 | Literally true about that particular tsconfig, but the resulting “in no typecheck” claim is false. |
| 9 | Correct under this suite’s current nonparallel configuration; Playwright can shard within files with parallel test groups. |
| 10 | Correct for default preview mode. `E2E_SERVER=dev` skips the build. |

For Fact 8, [root tsconfig.json](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/tsconfig.json:15) includes `packages/*/e2e`, and [miner-core.yml](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/.github/workflows/miner-core.yml:27) runs that typecheck on PRs. P1 should verify existing coverage, not claim to introduce it.

Also, the thirty- and twenty-minute figures for the race and switch tests are **timeouts**, not measured durations. The plan has corrected that mistake for `BOOT_MS` while retaining it elsewhere.

**Inference 2 is safer when narrowed to the actual signed-out boundary.**

The wallet/PXE opens in [startSession](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/src/boot.ts:307), after preflight publishes `signedOut`. The three suitable existing tests are:

- Dialog geometry.
- Malformed RPC rejection.
- Old-Presto notice/retry.

The pop-out and missing-passkey tests call `bootPage()`, which opens an account; they are not substitutes for those three.

Replay is plausible for this limited scope. **Confidence: moderate**, pending a recording/replay experiment. But P3 needs to fix two concrete problems:

1. [serve.ts](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-stats/e2e/serve.ts:14) hard-codes the stats package as `cwd`; importing its build/preview helpers unchanged builds and serves stats. Parameterize the small shared helpers and revalidate the stats lane.
2. New `e2e/replay/*.e2e.ts` files match the miner’s existing [full-suite discovery pattern](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/playwright.config.ts:9). Define separate discovery boundaries and inventories before adding them.

Staleness must include contract/artifact/layout and SDK compatibility, not merely “an RPC key is missing.” An old recording can remain internally consistent with its recorded deployment while no longer representing the current contract. Bind the fixture to relevant input hashes and deliberately mutate one. Reject unexpected network traffic through test completion, including background polling. Expected malformed responses and the fake Presto endpoint need explicit allowances.

If that narrow spike fails, retain the affected tests in the live suite and report the unmet fast-lane scope. Do not grow replay into a fake stateful PXE or quietly claim success with only the malformed-RPC test.

**The gates need tightening before implementation.**

| Phase | What could still pass incorrectly? | Necessary correction |
|---|---|---|
| P1 | Reports exist, but omit node startup and cannot distinguish mining, PXE opening, claim proving, and inclusion waits. | Measure the outer runner as well as setup; reconcile recorded time with total job time; collect claim-proof attribution if P6 remains a dependent decision. |
| P2 | File lists are correct, but workflow arguments select different tests, `.only` suppresses tests, or tests skip. Performance can worsen while the gate passes. | Compare actual collected/executed test identities with inventory; prohibit `.only`; account explicitly for skips; establish a wall-clock target and runner-minute ceiling. |
| P3 | Stale but self-consistent fixtures pass; the workflow skips relevant changes. | Compatibility mutation test, strict network accounting, explicit discovery, and filters covering imported stats helpers, run scripts, and contract/artifact inputs. |
| P4 | Missing Presto fails correctly, but missing hard-deployment fields fall back or stringify incorrectly. | Test both dependency failures, plus a successful trimmed run showing the saving. |
| P5 | Clean config and a clean ordinary build pass even if artifact inspection is missing. | Inject forbidden content into the inspected output and require the build to fail. |
| P6 | Tampering fails at parsing, ticket threshold, or standalone worker verification instead of recursive claim verification. | Specify the canary boundary and independently assert real proving is enabled. |

P1’s existence criterion is a legitimate **measurement deliverable**, not inherently unfalsifiable. It is insufficient as currently specified to support later decisions. In particular, timing `run-setup.ts` misses the network startup that occurs before Playwright launches. Per-spec timing cannot establish that claim proving is the bulk of runtime.

P2’s prose promises a measurement-derived pass criterion, but its gate only says to record the result. Ask 1 must become an explicit gate before accepting sharding’s cost. Ask 2 belongs before workflow implementation. Ask 3 is properly positioned, once the required evidence exists.

P6’s canary must use the **real-proving browser build** and inject the invalid proof/input at the claim boundary, after any worker verification. Preserve valid encoding, a winning ticket, and a live epoch so those checks cannot explain rejection. Altering a bound public input while preserving the winning proof bytes is one possible approach. The existing [cross-deployment negative test](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/miner-core/src/live.test.ts:305) is useful prior art, but does not prove the browser build selected the real prover.

One remaining silent skip is [Document Picture-in-Picture support](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/e2e/miner.e2e.ts:260). Make that an explicit coverage exclusion or require support in the intended CI browser.

Later arcs do invalidate earlier **performance and coverage conclusions**: P3 changes discovery; P4 changes rig cost; P5 changes build paths; P6 changes durations and proving coverage. Re-run the affected gates on the final combination. Preserve P1 as historical baseline, not evidence for the final system.

The broad sequence is sensible. I would run a bounded replay feasibility spike immediately after measurement, make P5 independent and earlier, and combine sharding with any justified rig trimming. Five or six mandatory stacked arcs are excessive for nineteen tests, particularly when optional P4 is made the parent of independently valuable P5. Separate reviewable changes are useful; an artificial dependency chain is not.

reject (with blocking findings: P1 cannot supply P6’s required evidence; P3 leaves helper reuse, discovery, and fixture compatibility unresolved; P2 lacks an execution-and-cost acceptance gate; P5’s artifact barrier and P6’s real-proving negative canary are not concretely specified)

---

# On the fourth read's corrections — auditr4

The sharding estimate is plausible, but its original reasoning is wrong. The proverless estimate is unsupported: it uses proofs produced outside the browser. **Confidence: high.**

I read both previous reviews, the implementation, the installed Playwright runner, and the actual CI/local logs. During review, HEAD advanced from `39fa473` to `8e1612e`; I checked that update too. Application code remains unchanged from `15e4550`. I did not run a new build or replay experiment.

1. **Baseline: totals broadly hold; “fixed cost is small” needs correction.**

   **Playwright’s `16.2m` includes global setup and teardown.** Its internal reporter starts timing at `onConfigure`, before setup tasks, and reports elapsed time at `onEnd`. That includes both deployments and the Vite build invoked by [global-setup.ts](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/e2e/global-setup.ts:5). See the [installed runner](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/node_modules/playwright/lib/runner/index.js:1773).

   The [local log](/home/homelab/.cache/tmp/claude-1000/-home-homelab-Projects-elixir/bc2e8998-a109-456c-beab-d307b684a651/scratchpad/e2e-final.log:1) records **16m36s wall time**. Adding its rounded individual test durations gives **875.539 seconds = 14.59 minutes**. Therefore approximately **two minutes are outside individual tests**, with roughly 1.6 inside Playwright’s timer. The 0.4-minute wall/Playwright difference never established total rig cost.

   [CI job logs](https://github.com/alejoamiras/elixir/actions/runs/34395322513/job/102613489896) show:

   | Event | UTC |
   |---|---|
   | E2E step starts | 19:30:38.716 |
   | Node ready | 19:31:09.871 |
   | Setup reports preview ready | 19:33:21.438 |
   | Test execution begins | 19:33:21.854 |
   | Playwright finishes | 19:55:33.526 |

   The E2E step is **24.91 minutes**; individual tests total approximately **22.05 minutes**. Against the approximately 26.5-minute job, fixed/unattributed work is approximately **4.4 minutes**, not merely the pre-step difference.

   “Every earlier step under twenty seconds” is false: **codegen takes approximately 20.6 seconds; Playwright installation approximately 31.8 seconds**.

   Nevertheless, the sharding estimate survives independently: with `F ≈ 4.4` and `T ≈ 22.1`, three shards cost `T + 3F ≈ 35.3` minutes, approximately **33% extra**. Partitioning the nine files using this CI run’s rounded durations gives a slowest test bucket around **7.6 minutes**, hence approximately **12 minutes per slowest job**. **Confidence: moderate** in that projection: fresh deployment history, random mining and runner variance can change it.

   The gates permit substantially worse results than the headline: **45 minutes is +70% cost**, and **15 minutes is only −43% wall time**. They are concrete budgets, but should not be presented as equivalent to +35%/−50%.

2. **Front door: correct for supported scripts; false as a universal deploy claim.**

   [Assembly’s guard](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/site/src/assemble.ts:65) protects its canonical production destination. `site:deploy` calls assembly, and the documented Workers Builds configuration calls it during the build stage.

   However, [wrangler.jsonc](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/site/wrangler.jsonc:13) simply uploads `./dist`. It has **no assembly/build hook**. Direct `wrangler deploy` can publish existing assets without assembly. The documented `wrangler versions upload` likewise relies on the preceding build stage. `deploy:www` bypasses assembly too, although it deploys only the redirect Worker.

   Correct wording: **“A misspelled mode is rejected by the supported site build/deploy scripts.”** “Cannot ship today” and “every deploy path” overclaim. This limitation was already identified in the second review.

   Also, an invalid mode does **not** enable every override: query overrides require exact mode `e2e` in [config.ts](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/site/src/config.ts:112).

3. **Forbidden list: useful contamination check, insufficient artifact assurance.**

   I found **no concrete application-code reason that those exact literals must survive a normal production build**:

   - Source maps are explicitly disabled.
   - The dev-server policy is build configuration.
   - Node-guard error messages interpolate endpoints; they do not embed those exact origins.
   - Production Presto legitimately uses HTTPS loopback; that must remain allowed.

   Dependency source does contain HTTP-loopback examples, but source comments do not establish emitted-bundle matches. I cannot certify the current clean build without building it. **Confidence: moderate** on freedom from false positives.

   More importantly, absence of those strings does not prove safe configuration. [Presto’s transport](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/node_modules/@alejoamiras/presto-core/src/lib/presto-transport.ts:688) constructs URLs from pieces; an unsafe runtime URL need not contain either contiguous literal in emitted JavaScript.

   Specify these missing properties:

   - Inspect the actual assembly destination, including worker chunks and nested emitted headers.
   - Missing/unreadable output, missing headers and missing/malformed `build.json` fail.
   - Verify the production CSP and relevant resolved configuration, including query overrides and Presto HTTPS policy; mode metadata alone is insufficient.
   - Apply production restrictions to production assembly while preserving intended E2E assembly.

   Do not describe a two-string grep as proving “the artifact is clean.”

4. **Proverless: neither 12% nor the newly substituted 7% is established.**

   The seven tests explicitly requiring claims entail:

   | Test | Minimum browser claim transactions |
   |---|---:|
   | First visit, including second visit | 2 |
   | Poisoned CRS | 1 |
   | Passkey | 1 |
   | Presto claim | 1 |
   | Lost race | 3: successful, reverted, successful |
   | Switch | 1 |
   | Withdraw setup | 1 |
   | **Total** | **10** |

   That is **nine successful claims plus one deliberately reverted transaction**, each requiring proving. Withdraw adds two transfer transactions. Continued mining can produce additional claims; the crash test can also win. The outside burst miner adds a variable number of separate native transactions.

   The decisive error is attribution: **all eight CI 7–12-second proof measurements occur during deployment setup**. Later logged proofs belong to `burst.ts`. Browser helpers forward page errors, not browser proof-duration logs.

   The new `8e1612e` estimate repeats the mistake with local measurements: **4.9–8.0 seconds measures deployment/native-burst proofs, not browser claim proofs**. Its eleven-transaction count also omits the reverted browser claim.

   Claims include private execution, kernel work, proving, submission, inclusion and balance/note synchronization. First-visit reopening also reconstructs the wallet/PXE session. Proverless retains mining proofs, inclusion waits and synchronization requirements; a wallet-level flag affects withdrawals and rolls too. See [sendClaim](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/src/chain.ts:92) and [openWallet](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/src/wallet.ts:65).

   **Confidence in either percentage, even within a factor of two: unknown.** Thirty percent is a defensible conservative policy, not a derived optimum. Define its denominator and measure browser proving separately from native/setup proofs. The new broader P5 rule also requires broadening P1’s still claim-specific attribution requirement.

5. **Replay: feasible premise; the stats lane cannot be copied unchanged.**

   **Confidence: moderate**, pending the spike. These three tests do not open a wallet/PXE; their successful boot path uses recordable reads.

   Concrete failures to handle:

   - The existing stats recording lacks **`aztec_getBlockNumber []`**, which miner preflight calls immediately. A fresh miner recording must include it.
   - Miner public-epoch reads request the **seed**, so stats’ existing storage recording is not sufficient.
   - Stats’ `visualEnv` does **not enable `VITE_E2E_QUERY_OVERRIDES`**. Merely selecting E2E mode does not enable it. Consequently the old-Presto test’s `?presto=<fake.port>` is ignored if that environment is copied.
   - The fake Presto’s **`GET /health`** is not JSON-RPC and changes after `upgrade()`. Keep its explicit stateful fake; a method/params recording cannot replace it.
   - Dialog geometry navigates without `presto=off`, so its default Presto probe also needs an explicit disposition.
   - Keep the malformed response out of the successful recording; it uses the same mock origin and otherwise risks contaminating shared keys.

   The 30-second poll does not inherently defeat replay: repeated `latest` reads can return the same fixture. The spike should deliberately cross that interval because public-poll errors are caught and logged; geometry assertions could pass despite broken polling.

   The timebox and maintenance disclosure hold. **The CI budget remains unnamed**, and relevant workflow filters still need explicit coverage for shared stats helpers, run scripts and contract inputs.

6. **Delivery: B holds; the dependencies need justification.**

   Combining P1 with P2/P4 in one PR is honest **if the unoptimized local and CI measurements are recorded before choosing the split**. A PR boundary is unnecessary; an experimental boundary is necessary. Since PR creation is deferred until review loops converge, explicitly use the dispatchable feature-branch workflow for P1’s CI measurement.

   C depends on B only if it consumes B’s inventory/discovery changes or relocates tests from those shards. Otherwise it is independent.

   D’s dependency on C is artificial: **abandoning the replay spike should not prevent a separately justified proverless experiment**. D needs the measurement and production safeguards, not successful replay.

Two further omissions remain: the final combined system needs its coverage/performance gates rerun, and the local “last green” durations are still misquoted—the located final log has **lost race 2.0 minutes and passkey 59.7 seconds**, not 2.6 and 2.0 minutes.

reject (with blocking findings: browser proving estimates use deployment/native measurements; deployment protection is still overstated; P0’s artifact acceptance contract and P3’s replay environment, traffic coverage, filters and numeric budget remain incomplete)

---

# On the fourth read's corrections — auditr5

One substantive correction is newly wrong: **P1’s proposed interval does not measure transaction proving.** Several older claims also remain elsewhere in the document. **Confidence: high.**

Verified `447ddf7`; application code remains unchanged from `15e4550`.

1. **P1 can still incorrectly unlock P5.**

   The interval from “proving the claim in-page…” to “claim … sent” surrounds the entire `sendClaim()` call in [controller.ts](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/src/controller.ts:557). That includes:

   - PXE synchronization and simulation, explicitly performed by [EmbeddedWallet.sendTx()](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/node_modules/@aztec/wallets/src/embedded/embedded_wallet.ts:164).
   - Transaction proving.
   - Submission and its response.
   - **The deliberate outside-miner wait in the lost-race test**, because its route holds `aztec_sendTx` before allowing submission to finish. [states.e2e.ts](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/e2e/states.e2e.ts:78)

   Consequently, the report can reconcile perfectly while attributing synchronization, network delay and native burst mining to browser proving.

   **Required correction:** capture the browser’s actual prover measurement—for example, the SDK’s `client-ivc-proof-generation` event from [createChonkProof()](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/node_modules/@aztec/bb-prover/src/prover/client/bb_private_kernel_prover.ts:379)—and report surrounding work separately. Include withdrawals and rolls if P5’s numerator remains **all browser transaction proving**. Claim-controller timestamps omit those.

   A useful validation: deliberately delay `aztec_sendTx`; submission time should increase while measured proving time remains unchanged. Collect measurements across reloads, rather than scraping the final bounded UI log.

2. **P0’s contract is clearer, but its HTTPS-only check lacks an actual configuration source.**

   `SiteConfig` has `queryOverrides` and `prestoE2ePort`; it has **no HTTPS-only field**. That policy lives in the miner’s [PRESTO_DEFAULT and prestoEndpointFor()](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/src/presto.ts:27).

   Specify that the check exercises the **endpoint configuration actually consumed by the miner**, using production-resolved inputs. An independently asserted “HTTPS-only” value would prove nothing about that endpoint.

   Require a mutation check: changing the consumed production endpoint to `httpsOnly: false` must fail validation even with empty `prestoE2ePort` and no contiguous HTTP-loopback literal. Explicitly scope the production acceptance contract to production assembly; E2E assembly necessarily violates it.

3. **P3 is substantially addressed; two acceptance details remain.**

   The named obstacles, budget and filter scope now provide a workable spike brief.

   However, **waiting past 30 seconds is not evidence that polling worked**. A stopped timer produces no unexpected traffic. Require an observed, successfully completed subsequent public-epoch poll and no swallowed poll error.

   Since C now removes tests from B’s inventory, preserve an overall coverage invariant: **live tests plus the three replay tests equal the original inventory, subject only to declared exclusions**. Merely shrinking B’s expected inventory could conceal a failed migration.

4. **Several corrections are only applied to the new paragraphs.**

   The current document still contains:

   | Location | Remaining contradiction |
   |---|---|
   | [Security section](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/implementations-plan/e2e-lanes/plan.md:275) | “Every deploy path” and “the artifact is clean.” |
   | [Fact 4](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/implementations-plan/e2e-lanes/plan.md:301) | A misspelled mode “cannot ship today.” |
   | [Fact 11](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/implementations-plan/e2e-lanes/plan.md:319) | Old scaled 4.6/8.6/13/36-minute projection alongside the new measured projection. |
   | [Sharding rationale](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/implementations-plan/e2e-lanes/plan.md:113) | Slowest local test still stated as 2.6 minutes. |
   | [Proverless overview](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/implementations-plan/e2e-lanes/plan.md:122) | “Removes only the claim transaction proof.” |
   | [Inference 2](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/implementations-plan/e2e-lanes/plan.md:331) | Wallet/PXE opening still offered as an obstacle to these signed-out replay tests. |

   Rewrite these rather than appending another correction beneath them.

The revised baseline arithmetic, withdrawal of the percentage estimate, twelve-transaction minimum, narrower deployment scope, dispatch-based measurement and revised arc dependencies otherwise hold. The combined-system rerun is also correctly added.

reject (with blocking findings: P1 still misattributes non-proving work and omits transaction types required by P5; P0 must bind its HTTPS-only check to the consumed endpoint configuration; P3 needs observable polling and preserved combined coverage; contradictory operative claims remain)

---

# On the fourth read's corrections — auditr6

The substantive blockers are resolved in `ba61943`. **Confidence: high** from source inspection; replay and measurement still need their planned execution gates.

Two small acceptance requirements remain:

1. **P1 must reject missing proof evidence, not count it as zero.**

   The SDK emits the proposed event, and its browser logger uses the console. However, a broken collector or suppressed logging could produce zero measured proving time; the delayed-submission check would still pass because zero remains unchanged.

   Require valid, positive-duration events for the proofs each relevant test necessarily completes—including the reverted claim and both withdrawals. Missing or malformed evidence must fail measurement. Read structured console arguments rather than assuming `ConsoleMessage.text()` contains serialized event fields. Keep legitimate zero-proof tests distinct.

   This closes the remaining “green report, no evidence” path without changing the proposed instrument.

2. **P0 must actually run the miner’s endpoint tests.**

   Its gate still names only `bun test packages/site`, while the consumed-endpoint tests live in [presto.bun.test.ts](/home/homelab/Projects/elixir/.claude/worktrees/e2e-lanes/packages/web-miner/tests/presto.bun.test.ts:19). Add that file and the mutation check to P0’s required commands.

   Also, the existing endpoint assertion compares against the imported `PRESTO_DEFAULT`; that assertion alone does not independently establish `httpsOnly: true`. The following exact-URL allowlist test supplies stronger evidence. Preserve it and explicitly assert the consumed endpoint’s HTTPS-only property.

The other corrections hold: production-only artifact checks, the observed second poll, combined inventory preservation, corrected timing attribution, and delivery dependencies are sufficiently specified for implementation. No further architectural change is needed.

Minor editorial leftovers remain: the historical paragraph still says **2.6 minutes**, an older ledger row still says **every deploy path**, and the document says **five phases** despite P0–P5. These are cleanup, not reasons to restart planning.

conditional approve (with conditions: P1 fails on missing or malformed expected browser proof events; P0 explicitly runs the consumed-endpoint tests and mutation check)