# Codex audits — yacana-third-pass

## Round 1 (plan + outline B), GPT-6 Astra high, session 01a081ee-5a5a-7ef2-ab1b-2339b4f8cb38, 2026-09-08

Prompt: the standard packet (adversarial, assumption attack, implementation critique, verdict) over plan.md, outline-b.md and recon.md.

**A. Adversarial / security**

No Critical finding established. Confidence is **high** unless stated otherwise. References below are against `f7e2ad4`; SDK references are installed source under `node_modules`.

- **High — The CSP justification understates the loss.** `img-src 'self' data:` already blocks external-image exfiltration; saying an injected script “could post through an image” is false. Navigation remains an escape route, but that does not make silent HTTPS exfiltration equivalent. `'self'` authorizes same-origin scripts, including compromised dependencies; `'wasm-unsafe-eval'` allows WASM compilation. The vault’s sealed secrets and device decryption key share the origin. **Fix:** retain the owner’s HTTPS choice, but explicitly acknowledge the expanded exfiltration and remote-WASM surface across all three apps; remove the “never bounded” argument. Evidence: [headers.ts:19](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/site/src/headers.ts:19), [keys/store.ts:1](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/keys/store.ts:1), plan.md:442–448; [CSP specification](https://www.w3.org/TR/CSP3/#directive-connect-src).

- **High — Widening CSP removes a cryptographic fallback guard.** The CRS loader explicitly relies on CSP blocking unintercepted CDN requests. Its interceptor handles only `lock.hosts`; unknown origins fall through. Keeping SHA-256 verification unchanged does **not** preserve that protection. **Fix:** make proving downloads fail closed independently of the old origin allowlist; verify page, prover Worker and demo Worker paths under the new CSP, including an unexpected CDN URL and tampered cached CRS. Preserve cache purge ordering before bb.js initializes. Evidence: [pinned-crs.ts:1](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/pinned-crs.ts:1), `:57–60`, `:72–77`; plan.md:462–464.

- **High — “A node can only feed numbers” is an unsafe trust statement.** `assertDeployment` compares answers supplied by that same node; it authenticates neither the chain nor its headers, and does not compare the L1 rollup address. The wallet takes that address for its PXE namespace, consumes node headers and tag-query results, and sends public-static simulations with `simulationOrigin = from`. A malicious node can correlate account activity, suppress note discovery, poison the local chain view, falsify simulations and manipulate fee estimates. **Fix:** describe Check as a deployment-consistency check; compare the recorded rollup identity and document the remaining RPC trust. Keep the locally derived sponsored FPC fixed and test malicious headers, omitted notes and bogus fee responses. Do **not** claim arbitrary wallet draining is established: the fee payer is locally selected, not supplied by the node. Evidence: [reader.ts:47](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/miner-core/src/reader.ts:47), [wallet.ts:35](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/wallet.ts:35), `:68–74`; SDK `wallet-sdk/src/base-wallet/base_wallet.ts:340–351,458–479`, `pxe/src/node/caching_aztec_node.ts:154–164`. Also remove “your own never will” from plan.md:125.

- **Medium — Cache poisoning requires no script compromise.** An accepted malicious node can supply plausible false rows which the application itself persists. “Closed” also does not mean finalized; reads use `'latest'`. Miner-address-only keys cannot distinguish every rollup/fork, and the proposed `TABLE_EPOCHS` cap is **262,144 rows**, not a practical localStorage byte budget. **Fix:** version and namespace by deployment/rollup identity; invalidate on endpoint changes; refresh nonfinal history; bound serialized bytes before parsing/writing and catch storage/quota failures. Validate safe integers, claims, contiguity and bounded hex length. Evidence: plan.md:317–320,457–459; [reader.ts:125](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/miner-core/src/reader.ts:125), `:193–197`.

- **Medium — Retry-After handling is underspecified.** Clamping alone does not handle HTTP dates, malformed values, `NaN`, missing CORS exposure, or successful requests completing after a 429 and clearing its cooldown. The SDK parses HTTP failures below the app’s poll functions. **Fix:** parse both defined formats, validate before clamping, use the fallback when inaccessible, and preserve cooldown against unrelated/in-flight successes. Test actual cross-origin headers, not only constructed `Response`s. Evidence: plan.md:190–197,278–279,456; SDK `foundation/src/json-rpc/client/fetch.ts:41–72`; [HTTP Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after), [CORS header exposure](https://fetch.spec.whatwg.org/#cors-safelisted-response-header-name).

- **Medium — The boundary’s shortener is not a secrecy filter.** It preserves arbitrary prose, mnemonic words and URL paths; its own comment warns about this. React escaping prevents HTML execution, not secret disclosure or attacker-written instructions. **Fix:** show a fixed, bounded tile-failure message; never promote arbitrary exception text into the default UI. Evidence: [diagnostics.ts:1](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/lib/diagnostics.ts:1), `:14–20,33–37`; plan.md:460–461.

**B. Assumption attack**

**Facts**

- **Medium — Read-cost and “unchanged” claims need correction.** Genesis takes **three** storage reads, not one; strip labels currently use a **24 px container threshold**, not 100 px/multiples of eight. **Fix:** correct the measured specification and explicitly list the label change. Evidence: plan.md:72–74,141–143; [reader.ts:301](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/miner-core/src/reader.ts:301), [Strip.tsx:89](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-stats/src/features/Strip.tsx:89).

- **Low — F1 cites the wrong configuration lines.** The allowlist rejection is at [config.ts:103](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/site/src/config.ts:103), not 82–86. F2–F6 otherwise describe the relevant read/drawing paths substantially correctly. **Fix:** repair the citation.

**Inferences**

- **High — I1 confuses dynamic dispatch with safe wallet switching.** The SDK’s block-stream adapter does call through the node object dynamically; there is no evidence that this adapter permanently retains the original RPC methods. However, the wallet caches `NodeInfo` for its lifetime, PXE initializes a genesis hash, and PXE maintains cached reads, anchors and rollback state. Switching between successive calls of one sync/simulation can mix endpoints. **Fix:** take save-and-reload unless a preapproval spike proves an operation-safe transition. A sufficient switch test must disable the old endpoint and exercise sync, simulation, note discovery and send against independently controlled lagging/divergent responses. Two aliases of the same healthy node are insufficient. Evidence: SDK [base_wallet.ts:170](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/node_modules/@aztec/wallet-sdk/src/base-wallet/base_wallet.ts:170), `pxe/src/pxe.ts:294–334`, `block_synchronizer/block_stream_source.ts:14–17`, `block_synchronizer.ts:125–145`; plan.md:306–310,496–498.

- **Medium — I2 is factually wrong; I7 needs lifecycle rules.** Words backup and quiz are three-column grids; key screens contain nonwrapping action rows. `DialogContent` has neither viewport-height scrolling nor an overlay customization prop, and always supplies a close button. Keeping it mounted is feasible, but focus trapping does not disable window hotkeys. **Fix:** specify wrapping, scrolling, title/focus restoration, and consistent Escape/overlay/X/Cancel behavior; disable page hotkeys while open. Test backup, quiz, restore and errors inside the 480 px body at short desktop heights. Evidence: [WordsScreens.tsx:9](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/features/WordsScreens.tsx:9), `:28,120`; `KeyScreen.tsx:113,214`; [dialog.tsx:29](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/ui/src/components/dialog.tsx:29); `use-page-behaviour.ts:24–53`.

- **Medium — I3 is plausible, not a diagnosis. Confidence: moderate.** The fallback difficulty is 1 and both labels are drawn at the floor, establishing a collision. It does not establish that this produced the owner’s “0.” **Fix:** retain the collision fix, but require reproduction of the reported symptom before marking it resolved. Evidence: [LoopTile.tsx:133](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/features/LoopTile.tsx:133), [score-loop.tsx:157](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/ui/src/components/score-loop.tsx:157).

- **Medium — I5 has no supporting rate-limit evidence.** A page costs approximately 144 RPCs, issued eight concurrently; automated paging adds sustained load alongside polling. Previously clicking “load older” proves no safe background rate. **Fix:** define bounded page scheduling, foreground priority and pause/resume behavior; test total request counts and overlapping polls under 429. Reuse `serial`/`coalesced`, omitted by recon. Evidence: [reader.ts:255](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/miner-core/src/reader.ts:255), [serial.ts:1](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-stats/src/serial.ts:1); plan.md:505–509.

**Asks**

- **Medium — Surface actual unresolved trade-offs.** If uninterrupted switching is binding, the reload fallback needs explicit owner acceptance. Resolve the contradictory promises “proving continues” and the retained offline pause, and decide whether first-time sign-in automatically starts mining. Existing `begin()` only refreshes/starts polling; automatic Start depends on `resumeOnOpen`. A1 is already described as accepted on the canvas; A2’s route exists; A3 is routine link selection. Evidence: plan.md:107,130–133,196–197,515–524; [controller.ts:227](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/controller.ts:227), `:331–335`; `use-page-behaviour.ts:90–97`; `routes.ts:7–14`.

**C. Implementation critique**

- **High — Health currently measures transport success, not usable chain data.** Any HTTP success could keep `lastOkAt` fresh while epoch/balance reads fail, or while the block remains stationary. The proposed union cannot represent the promised stalled state. It also promises retries after boot failure, while stats installs its poll timer only after successful boot. **Fix:** separate transport cooldown from last successful chain read/block progress; retain the controller’s successful-read clock; schedule recovery after failed boot. Install one mutable fetch interceptor, rather than repeatedly nesting wrappers. Evidence: plan.md:190–197,240–247; [controller.ts:318](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/controller.ts:318), [main.tsx:49](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-stats/src/main.tsx:49), [node-deadline.ts:6](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/site/src/browser/node-deadline.ts:6).

- **High — Cancel has no implementation owner.** `startSession` only cleans up after rejection; `Session.start` retains secrets before awaiting it and installs the controller afterward. Closing the modal cannot stop a late completion publishing `ready`. **Fix:** add an attempt generation/cancellation signal owned by `Session`, prevent superseded writes, dispose late-created resources, clear transient secrets and await cleanup before retry. Add `session.ts` to the change map and test cancellation during wallet open, registration, CRS wait and prover startup. Evidence: [session.ts:80](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/session.ts:80), [boot.ts:143](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/boot.ts:143), `:189–197`; plan.md:205–206,291–296.

- **High — I6 and the CSP gates contradict production-preview E2E.** Preview builds currently get production headers plus explicitly allowlisted HTTP test origins. Removing those origins while permitting localhost only in `dev` blocks the isolated node and mocks. **Fix:** retain narrowly scoped E2E-only origins under `SiteMode === 'e2e'`, with production guards, and update `vite-base.ts`, assembly and fixtures. Keep production-preview coverage. Evidence: [vite-base.ts:94](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/site/src/vite-base.ts:94), `:147`; [run-setup.ts:22](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/e2e/run-setup.ts:22), `:28–37`; plan.md:181–182,508–509.

- **Medium — The skeleton timer fails the fast-first/slow-second case.** Clearing it when beat one arrives before 300 ms prevents the history skeleton appearing even if history takes minutes. **Fix:** let elapsed time govern skeleton visibility for each unresolved beat; only cancel once all required content has resolved. Test fast-first/slow-second, history failure and route remounts. Evidence: plan.md:212–217,315–316,407–411.

- **Medium — Window navigation needs explicit data semantics.** Existing keyboard stepping treats the last loaded row as the open epoch; historical windows invalidate that assumption. Page seams also need a successor row to derive duration/retarget. The proposed map only draws held rows, so its coordinates can shift as history arrives. **Fix:** position against absolute epoch indices, preserve `from` and `epoch` together, fetch a selected missing window immediately, and reuse `window()`/`linkRows` for seams. Test dragging, keyboard navigation, direct links and out-of-order page completion. Evidence: [Strip.tsx:29](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-stats/src/features/Strip.tsx:29), [chain.ts:78](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-stats/src/chain.ts:78), `reader.ts:279–290`; plan.md:218–222,413–419.

- **Medium — The money-table fix targets the wrong element.** `last:border-b-0` on each cell matches each row’s last cell. **Fix:** use `tbody`’s `[&>tr:last-child>td]:border-b-0`, and verify computed borders on every final-row cell and the preceding row. A class-presence test would bless the bug. Evidence: [Money.tsx:41](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-landing/src/sections/Money.tsx:41); plan.md:163,421–426.

The architecture choices should be:

| Choice | Take | Reason |
|---|---|---|
| Switchable client vs reload | **B’s reload**, unless the I1 spike succeeds | Rebuilds wallet-owned state; avoids introducing an unsafe transition. |
| Shared health vs per-app 429 checks | **A, corrected as above** | RPC methods return decoded values, not HTTP responses; B’s `response.status` checks sit at the wrong layer. SDK `foundation/src/json-rpc/client/fetch.ts:63–72`. |
| Two beats vs one | **A** | Two beats are fixed owner scope; B removes the outcome. `outline-b.md:18–21`. |
| Background fill vs paging | **A, bounded and serialized** | B never supplies the complete first-visit map. Reuse existing scheduling and reader helpers. `outline-b.md:22–25`; `serial.ts:1–20`. |
| CRS outside gate vs modal-blocked gate | **A, with verified readiness gating wallet/prover work** | B disables sign-in until download completes and changes the selected opening flow. `outline-b.md:26–30`; plan.md:103–110. |

- **Medium — Validation needs targeted additions, not more generic gates.** The named scripts exist: root `package.json:15,18,25,31–32`, miner `package.json:11–13`, stats `package.json:11–14`. But `main.tsx` orchestration is missing from the stats change map; the miner helper must handle an already-open dialog and retain readiness assertions. Visual replay rejects unrecorded RPCs and waits for tweens, not future map completion. **Fix:** update orchestration and helpers explicitly; retain zero-tolerance baselines; wait for the intended map state and fonts, extend the recording if probes add calls, and include delayed/partial-load screenshots. Evidence: `web-stats/src/main.tsx:49–82`; [helpers.ts:60](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/e2e/helpers.ts:60); [visual.e2e.ts:23](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-stats/e2e/visual.e2e.ts:23), `:56–64`.

- **Medium — Boundaries and function budgets need narrower promises.** A React boundary will not catch the canvas’s animation-frame exception, and a boundary placed below `Stats` cannot catch its own data derivation. The plan also concentrates staging, cache filling and progress/cancellation without naming decomposition. **Fix:** put derived rendering inside boundaries, handle asynchronous drawing failures locally, and split fixed/window reads, cache validation/scheduling, opening-step execution and map geometry/interaction. Keep cognitive complexity ≤15 and production functions ≤80 lines; enforce through lint, without asserting an unwritten implementation already violates them. Evidence: [score-loop.tsx:323](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/ui/src/components/score-loop.tsx:323), `Stats.tsx:33–40`, [biome.json:27](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/biome.json:27); plan.md:212–225.

**D. Verdict**

reject (with blocking findings: understated CSP/CRS trust changes; unproven live wallet switching; transport health replacing chain freshness; undefined cancellation lifecycle; CSP incompatible with the required production-preview E2E gates).

## Round 2 (the revision, resumed session), 2026-09-08

Prompt: verify the revision (reload + rebuild, the guard as gate, the synthetic 429 against the SDK's fetch layer), re-run the packet reporting only what is new or open, verdict.

**A. Adversarial / security**

Confidence: **high**, except where stated.

The synthetic JSON 429 works **at the transport layer**: I tested both `makeFetch([], false)` and the default retry configuration; each made one fetch and stopped. However, `createAztecNodeClient` converts that failure into a plain RPC `Error`. P1.2’s assertion that the SDK client throws `NoRetryError` is wrong. PXE uses the supplied client, not a separate transport. Fix the gate to assert one transport invocation and rejection, with the `NoRetryError` assertion confined to `makeFetch`. Sources: SDK `foundation/src/json-rpc/client/fetch.ts:53–66`, `retry/index.ts:59–65`, `safe_json_rpc_client.ts:182–233`; `wallets/src/embedded/entrypoints/resolve_aztec_node.ts:10–19`; plan.md:489.

- **High — Reload closes mid-operation mixing, but origin-based rebuilding does not close persistent poisoning.** `/node-a` and `/node-b` on the same HTTPS origin can serve different nodes; both the PXE marker and history-cache key treat them as identical. Marker handling after failed opening, missing metadata and failed storage writes is also unspecified. **Fix:** identify the normalized endpoint, including path/query, using an opaque fingerprint; treat unknown ownership conservatively and record ownership before node-driven mutations. Never reuse the lost-race fallback that reopens the old database after reset failure. Sources: [plan.md:203](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:203), `:289,691–694`; [boot.ts:158](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/boot.ts:158). Test same-origin endpoint changes and recovery from a poisoned finalized tip.

- **High — Rebuild deletes the retained sender capability’s configuration.** `resetAccountView` deletes the entire PXE database and re-registers only the account. Manually registered senders live in that database; their addresses are necessary to rediscover incoming transfers. **Fix:** preserve and replay registered sender addresses across this rebuild. Specify the cold-boot reset path: the current helper requires an existing `OpenedWallet`, which does not survive reload. Test receiving from an added sender before and after switching. Sources: [wallet.ts:119](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/wallet.ts:119), `session.ts:229–231`; SDK `wallet-sdk/src/base-wallet/base_wallet.ts:357–359`, `pxe/src/pxe.ts:855–889`.

- **Medium — “Every other origin throws” omits redirects.** Checking the initial URL does not intercept redirects followed internally by native fetch. **Fix:** reject redirects on guarded RPC requests; define equivalent handling for other guarded downloads. Checking `response.url` afterward is too late to prevent transmission. Source: plan.md:210–218; SDK `foundation/src/json-rpc/client/fetch.ts:41–46` supplies no redirect policy.

- **Medium — WebRTC is not demonstrably “closed now.”** The cited directive exists in the specification, but Chromium’s current directive enumeration contains no `webrtc`. A header-string assertion proves emission, not enforcement. **Fix:** describe this as best effort unless browser enforcement is demonstrated; remove the unconditional security claim. Source: plan.md:606,478; [Chromium CSP directives](https://raw.githubusercontent.com/chromium/chromium/main/services/network/public/mojom/content_security_policy.mojom).

**B. Assumption attack**

**Facts**

- **Medium — The expected rollup address has no defined source.** The revised probe returns one, but neither `ExpectedDeployment` nor `expectedDeployment()` contains one. Comparing against the currently selected node also fails when that node is dead—the recovery case. **Fix:** provide the expected address through build configuration and compare at every boot and candidate check. Sources: plan.md:194–199,318; [reader.ts:28](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/miner-core/src/reader.ts:28), `connection.ts:25–30`.

- **Low — Correct the remaining factual shorthand.** “Default retries three times on a 429” applies to malformed/non-JSON responses, not valid JSON 429s. “Keys never leave the vault” contradicts `Session.master` and account derivation. “Fee path untouched by a node” contradicts the following sentence’s node-derived gas limits. **Fix:** say transport retries cover retryable failures; secrets remain local; fee payer is locally fixed while fee inputs remain node-dependent. Sources: plan.md:222,597–599,625–626; SDK `fetch.ts:53–66`; `session.ts:80–85`; `wallet.ts:74`.

**Inferences**

- **Medium — I2’s overflow gate cannot establish layout.** The miner’s Vitest environment is jsdom. Rendering at a nominal 480 × 720 cannot prove scrolling, wrapping or viewport containment. **Fix:** put backup, quiz, restore and their error states through a Playwright geometry assertion at that size. Sources: plan.md:528,695–696; [vitest.config.ts:9](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/vitest.config.ts:9).

- **Medium — The cache is still called immutable without justification.** Excluding 96 epochs is a heuristic, not a verified finality boundary. The spec still promises the complete map immediately on subsequent visits despite the 8,192-row/512 KB cap. **Fix:** label the tail margin honestly and define eviction/progress behavior once the cap is reached; remove unconditional completeness and immutability claims. Sources: plan.md:161–164,288–295,428–429; `reader.ts:193–197` reads `'latest'`.

- **Low — Conflicting instructions remain executable.** I7 says Escape/overlay cancel while opening; architecture says they are inert. Line 429 says the cache key stays unchanged after switching; architecture says otherwise. Lines 164/746 say pause/resume; 286/741 say stop for the visit. **Fix:** reconcile these to the decision ledger. Sources: plan.md:258–259,429,710,741–746.

**Asks**

- **Medium — A4/A5 remain pending; the partial-map deviation also needs acknowledgment.** “Completes over visits” changes the first-visit outcome and is not included among the approval asks. A5 also misidentifies the existing affordances: fresh-account screens have `use-words` and `restore-passkey`; `WordsRestore` has Open/Back, not Create. **Fix:** enumerate retained actions per screen, and explicitly record acceptance of the bounded partial map. Sources: plan.md:262–265,288,721–729; `KeyScreen.tsx:113–138,214–223`; `WordsScreens.tsx:182–197`.

**C. Implementation critique**

- **High — The guard blocks “Check another node.”** It admits only self and the active node, while `probeNode(candidate)` uses SDK fetch against a different origin. Temporarily changing the active origin would disrupt the open wallet and its health attribution. **Fix:** give probes a narrowly scoped, deadline-bound candidate transport, independent of the active-node guard state; revoke it after the check. Test checking B while A remains open and polling. Sources: [plan.md:193](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:193), `:210–218,373`; SDK `fetch.ts:41`.

- **High — Synthetic failures must not renew their own cooldown.** The plan reports “each node response” but does not exclude synthetic responses. Classifying those as new 429s can perpetually advance `retryAt`. Also, `silent` has no retry deadline while failed boots immediately call `waitTurn()` again. **Fix:** only real network outcomes update transport/backoff; synthetic responses leave state unchanged. Give silent boot failures a bounded delay and allow one recovery attempt at expiry. Test repeated synthetic calls and immediately rejected network requests. Sources: plan.md:218–234,328–332,375–377.

- **Medium — A fail-fast gate does not make a claim “wait.”** The controller clears its pending ticket before sending and turns a rejection into claim failure. **Fix:** change the banner to describe temporary claim failure/unavailability; do not imply queuing unless it is actually implemented. Sources: plan.md:134–135; [controller.ts:450](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/controller.ts:450), `:483–484,499–506`.

- **Medium — The cancellable attempt starts after the ceremony.** Passkey acquisition, derivation and record persistence happen before `Session.start`. Dismissing the signed-out dialog during that work can still be followed by a late account opening. **Fix:** start attempt ownership at the initiating key action, or make dismissal inert throughout that pending action; guard every alternate sign-in action during the drain. Sources: plan.md:247–259,369–372; [session.ts:91](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/session.ts:91), `:122–128`.

- **Medium — Map geometry divides by zero at epoch 0.** `epoch / open` also describes endpoints rather than the widths of `open + 1` epoch cells. **Fix:** use a defined cell-count denominator and an exclusive window end; clamp short histories. Test open epochs 0, 1, 47 and 48. Source: plan.md:425–427.

- **Medium — Two validation instructions conflict with implementation order.** The Worker must retain its globals shim before Aztec imports; the proposed “guard, then pinned-crs before anything else” test displaces it. Also, regenerating snapshots in P3.1 cannot preclude regenerating after P3.2 adds the map. **Fix:** assert dependency ordering—shim before SDK, guard before pinned-crs—and regenerate after each intentional visual change. Sources: plan.md:216,474,553–554,569–570; `prover.worker.ts:2–4`; `shims/node-globals.ts:1–3`.

The named function splits adequately address the earlier budget concern. Keep the existing lint gate; no additional abstraction is warranted.

**D. Verdict**

reject (with blocking findings: candidate probes blocked by the guard; incomplete endpoint-based PXE invalidation and reset semantics; sender registrations lost during rebuild; cooldown feedback and silent-boot retry behavior undefined).

## Round 3 (resumed), 2026-09-08

Prompt: confirm or refute each round-2 closure; report only what is new or open; verdict.

Not every closure is present in the file. Confidence: **high**. References to `plan.md` mean `implementations-plan/yacana-third-pass/plan.md`; SDK paths are under `node_modules/@aztec/`.

**Confirmed**

- **Reload, endpoint marker and reset ordering:** sound at design level (`plan.md:209`). The browser wallet disables automatic sync and passes the supplied client into PXE (`wallets/src/embedded/entrypoints/browser.ts:39,60`); reset stops, deletes, reopens and registers (`packages/web-miner/src/wallet.ts:125`). This closes the mixed-client/poisoned-view finding, subject to sender migration below.
- **Synthetic 429:** confirmed by a mocked execution with both `[]` and `[1,2,3]` retries: one fetch call, transport `NoRetryError`, RPC `Error`. JSON 4xx takes the non-retry branch (`foundation/src/json-rpc/client/fetch.ts:63`); RPC converts it (`foundation/src/json-rpc/client/safe_json_rpc_client.ts:193,233`). PXE receives the supplied client (`wallets/src/embedded/entrypoints/resolve_aztec_node.ts:19`).
- **Accepted corrections:** build-sourced expected rollup (`plan.md:199`); attempt ownership before the ceremony (`:268`); synthetic responses excluded from health (`:234`); browser geometry gate (`:567`); visual regeneration after each intentional change (`:594`); bounded-cache disclosure/A6 (`:454,777`). The revised claim banner matches the failure path (`:135`; `packages/web-miner/src/controller.ts:503`).

**New or still open**

- **High — Existing senders disappear on upgrade.** Missing markers mandate a reset, but replay assumes the new `yacana.senders.*` list already exists (`plan.md:211,215`). Existing registrations are only written through the wallet (`packages/web-miner/src/session.ts:229`), and reset deletes their PXE store (`packages/web-miner/src/wallet.ts:126`). **Fix:** before the first destructive reset, durably migrate `wallet.getAddressBook()` into the app list; the SDK already reads persisted PXE senders there (`wallets/src/embedded/embedded_wallet.ts:147`). Add an upgrade fixture with existing PXE senders and neither new storage key. P1.4’s newly-added-sender test does not cover this (`plan.md:545`).

- **Medium — Candidate leases cannot distinguish same-origin endpoints.** `allowCandidate(origin, …)` and health attribution use only origin (`plan.md:197,255,357`), although different paths explicitly represent different nodes (`:210`). An origin-wide exemption either exempts active requests too or fails to isolate candidate responses. **Fix:** attribute/exempt probe requests themselves; test A and B on different paths of one origin while A polls and is throttled. The current gate only specifies B versus A (`:526`).

- **Medium — The cache fingerprint closure is absent.** Architecture, mechanics, Security and ledger still specify **origin**, not endpoint fingerprint (`plan.md:313,455,673,792`). Switching `/malicious` to `/honest` can therefore retain poisoned historical rows. **Fix:** use the normalized endpoint fingerprint consistently and test same-origin path/query changes.

- **Medium — Silence recovery remains internally inconsistent.** Both failures supposedly carry deadlines and permit one recovery attempt (`plan.md:246`), but `silent` has no `retryAt` in the interface (`:352`), and the guard condition covers only `throttled` (`:231`). Merely resolving `waitTurn()` releases concurrent callers together. **Fix:** specify gating for both states and ownership of the single recovery attempt; test concurrent poll/PXE arrivals during silence and at expiry, beyond the single-boot test (`:526`).

- **Medium — Redirect enforcement still has an escape.** “Unless the caller set `redirect` itself” permits explicit `follow` (`plan.md:235`). The current SDK omits that option (`foundation/src/json-rpc/client/fetch.ts:41`), so its path is covered; the claimed universal guard is not. **Fix:** enforce `redirect: 'error'` after caller options and test explicit `follow`.

- **Medium — The exclusive map endpoint is still wrong.** `min(from + 47, open)` is labelled exclusive (`plan.md:452`): epoch zero produces a zero-width box; full windows omit their last cell. Existing reader windows are inclusive (`packages/web-stats/src/chain.ts:78`). **Fix:** use exclusive end `min(from + 48, open + 1)`; assert exact widths at the four promised boundaries.

- **Medium — A5 still conflates creating and restoring words.** It labels `use-words` “I have twelve words” and omits `restore-words` (`plan.md:772`). Existing `use-words` creates a phrase; `restore-words` opens restoration (`packages/web-miner/src/features/KeyScreen.tsx:117,133`). **Fix:** retain both distinct actions and correct A5; remove the invented words-entry “Create” link from Architecture (`plan.md:287`; actual Open/Back: `packages/web-miner/src/features/WordsScreens.tsx:182`).

- **Low — Reconcile remaining contradictory instructions.** Security still calls WebRTC closed (`plan.md:649`) despite best-effort-only Architecture (`:239`); mechanics still require guard-first (`:433`) despite shim-first ordering (`:228`); flow still starts ownership at `Session.start` (`:396`) despite initiating-action ownership (`:268`). P2.3 also expects ceremony dismissal to produce `signedOut` (`:577`), contradicting inert dismissal in I7 (`:754`). **Fix:** align these clauses; test inert dismissal separately from explicit Cancel. F11 should say “retryable failures,” as Architecture already does (`:727,238`).

reject (with blocking findings: sender migration missing; candidate and cache endpoint identity incomplete; cooldown contracts inconsistent; map endpoint and retained key actions incorrect)

## Round 4 (resumed), 2026-09-08

Prompt: confirm the round-3 closures; verdict.

Two closures remain incomplete; the other listed corrections are present. Confidence: **high**. References below are to `implementations-plan/yacana-third-pass/plan.md`.

- **Medium — Endpoint identity still differs between components.** The marker/cache fingerprint includes query (`plan.md:211,325,372`), but guard/lease matching uses a **path prefix** (`:227,370`), and `classify` still accepts `origin` (`:360`). `/rpc?node=A` and `/rpc?node=B` collide; overlapping prefixes remain ambiguous. **Fix:** match the complete normalized endpoint URL consistently, update health attribution, and extend P1.2’s sibling-path test (`:549`) to query-only differences and overlapping paths.

- **Medium — Recovery losers can repeatedly retry synthetic failures.** `claimRecovery()` admits one caller while others receive synthetic failures (`plan.md:263`), but `waitTurn()` still resolves at `retryAt` (`:369`). A failed boot immediately retries through it (`:418`), although that deadline has passed and another recovery remains in flight. **Fix:** make `waitTurn()` await the recovery outcome/new deadline while recovery is owned; test a boot losing the recovery race through settlement, not just concurrent network-call counts (`:546`).

conditional approve (with conditions: unify full endpoint identity across guard, leases and health; make recovery waiters await the in-flight recovery outcome)

## Final fresh-context pass (new session 01a0821c-a5e8-7b41-93f1-4b5582d6e7ab), 2026-09-08

Prompt: the consolidated plan with the full decision trail (both audit files, the outline, recon), the standard packet, verdict.

**A. Adversarial / security**

- **High — The guard blocks bundled proving code.** [plan.md:225](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:225) permits self, active endpoint and candidates only. bb.js’s [browser loader:18](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/node_modules/@aztec/bb.js/src/barretenberg_wasm/fetch_code/browser/index.ts:18) fetches bundled `data:application/gzip;base64,…` URLs, whose origin is `"null"`. **Verified both WASM variants. Fix:** explicitly permit these non-network `data:` loads; retain rejection of unknown HTTPS endpoints. Add an actual SDK-loader test under the guard. **Confidence: high.**

- **High — The accepted sender migration still deletes existing registrations.** [plan.md:213](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:213) relies on `wallet.getAddressBook()`. The [EmbeddedWallet override:147](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/node_modules/@aztec/wallets/src/embedded/embedded_wallet.ts:147) reads PXE sources but returns **WalletDB’s** senders; this app supplies a fresh [MemoryKvStore:66](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/wallet.ts:66). Executing that method with one persisted source and an empty WalletDB returned zero contacts. **Fix:** migrate persisted PXE `getTaggingSecretSources({kind:'address-derived'})` through a wallet adapter, preserving the namespace-wide sender union before deletion. The upgrade test must exercise the actual SDK behavior; a fake returning the expected contacts conceals this bug. **Confidence: high.**

- **Medium — Header success can hide a stalled response body.** [plan.md:249](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:249) records fetch outcomes, but the SDK consumes the body afterward at [fetch.ts:53](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/node_modules/@aztec/foundation/src/json-rpc/client/fetch.ts:53). A node can send HTTP 200 headers and stall the body: recovery clears prematurely, while the later timeout never reaches fetch-outcome classification. **Fix:** retain recovery ownership through body completion and report body timeout/failure exactly once. Test headers arriving immediately with a stalled body. **Confidence: high.**

**B. Assumption attack**

- **Facts — Medium:** The “147 requests” premise in [I5:775](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:775) conflates RPC methods with HTTP requests. The [SDK batches calls:130](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/node_modules/@aztec/foundation/src/json-rpc/client/safe_json_rpc_client.ts:130); verified eight simultaneous methods produced one fetch. **Fix:** distinguish method work from transport counts, and measure both through the real SDK in P3.2. Keep the conservative pacing. **Confidence: high.**

- **Inferences — Medium:** [I8:785](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:785) specifies takeover but no return of ownership. The controller [publishes the epoch before awaiting balance:343](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/controller.ts:343). Opening can therefore fail or be cancelled after the public poll stops, leaving signed-out watching without a poll. **Fix:** restart public polling on failed/cancelled opening, invalidate disposed-controller reads, and test cancellation after takeover. **Confidence: high.**

- **Asks — Low:** Restart behavior remains contradictory: [opening copy:108](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:108) promises automatic mining; [node-switch copy:125](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:125) requires Start; [architecture:306](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:306) preserves `resumeOnOpen`. **Fix:** align both texts with the retained setting and make that behavior explicit in A4’s approval. **Confidence: high.**

**C. Implementation critique**

- **Medium — Save-and-reload assumes durable persistence.** [plan.md:416](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:416) reuses [saveConnection:62](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/site/src/browser/connection.ts:62), which silently swallows storage failures. Endpoint-specific history caches increase quota pressure; Use can reload onto the old node while appearing successful. **Fix:** return persistence success, reload only after a successful write, and show a fixed failure message otherwise. Test quota rejection. **Confidence: high.**

- **Medium — New stats unit gates will not run in CI.** [P3.2:632](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:632) depends on cache, scheduling and geometry tests, but [web-stats.yml:49](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/.github/workflows/web-stats.yml:49) runs only three miner-core suites. **Fix:** add `bun test packages/web-stats` to the existing workflow; no new workflow is needed. **Confidence: high.**

The named function splits reasonably address Biome’s budgets. No new evidence warrants reviving the rejected live-switch or single-beat alternatives.

**D. Verdict**

reject (with blocking findings: the fetch guard blocks bundled WASM; the prescribed SDK address-book migration loses persisted senders)

## Final pass, follow-up (resumed 01a0821c), 2026-09-08

Prompt: confirm the seven closures; verdict.

- **Low — A4 still does not name `resumeOnOpen`**, despite the corrected modal and Node copy. Add its automatic-resume exception to [plan.md:816](/home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/implementations-plan/yacana-third-pass/plan.md:816). This is an approval-note omission, not a behavioral blocker. **Confidence: high.**

approve
