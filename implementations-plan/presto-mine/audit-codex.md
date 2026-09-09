# Codex audit — presto-mine (light, single pass)

- Date: 2026-09-09 · model `gpt-6-astra` at `high`, read-only sandbox, cwd = this worktree; the Presto source read at `~/Projects/presto`.
- Session `01a0869d-fa12-7a21-824a-6365b8b33699` (resumable for the post-implementation loop's context).
- Prompt: the plan, the recon, the touched files, the standard packet (architecture critique, adversarial / security, assumption attack, recon check, concrete changes), the no-over-engineering rule.
- Verdict: **rework** — bounded corrections, no architecture change. Every factual claim below was re-checked against the source before the plan was edited; the ledger follows the transcript.

## Verification ledger

| # | Codex claim | Checked | Disposition |
|---|---|---|---|
| 1 | "Exact endpoint" is origin+path+query; the SDK needs `/health` (HTTPS, and HTTP when not https-only, plus the witness-free HTTP `/health` diagnosis) and `/prove/ultra-honk` | `node-guard.ts:41-44,223-235`; `presto-transport.ts:741-812` | **adopted**: the accelerator class admits the fixed set of exact URLs derived from one `{host, port, httpsPort, httpsOnly}` config; unreported, deadline + `redirect:'error'`; classified after the node and before candidates; a node URL inside the set is rejected at configuration; no listener API (no consumer) |
| 2 | `{ baseUrl, httpsOnly }` is not `PrestoConfig` (`host/port/httpsPort`) | `types.ts:31-60` | **adopted**: one `PrestoEndpoint` type → `PrestoConfig` and the admitted URLs, defined once in `packages/web-miner/src/presto.ts` |
| 3 | `mineEpoch` holds the prover through its nonce loop; swapping the Worker's global does nothing to the running job; restarting repeats nonces | `miner.ts:35-55`; `prover.worker.ts:34-61` | **adopted**: the swap lives inside `PrestoWorkProver.prove()` — catch `PrestoUnavailableError`, `setForceLocal(true)`, retry the same witness; same nonce, one backend, the scheduler untouched |
| 4 | No SDK 429 retry policy; every 429/503/408/413 is an immediate `fallback('transient')` | `presto-client.ts:531-555` | **adopted**: `transient` is proved locally for that nonce and native is retried next nonce; three in a row stick to WASM with the reason; the P1 test asserts this, not "retries within the SDK's policy" |
| 5 | The SDK's own fallback is not silent (`fallback` phase, `denied`/`version-mismatch` phases) but does not expose every reason | `presto-ultra-honk-backend.ts:213-233` | **adopted** (wording): `fallback:'none'` kept for the precise reason and the sticky choice |
| 6 | `ready { prover:'presto' }` means "adapter constructed", not "proved natively" | `presto-ultra-honk-backend.ts:101-121` (no probe in the constructor) | **adopted**: `ready.prover` is the *selected* backend; `{type:'prover', kind:'presto'}` is posted after the first decoded native proof, `{kind:'wasm', reason}` on the sticky fallback; the ✦ follows the message, not `ready` |
| 7 | Cancellation window during the winning proof's verification | `prover.worker.ts:48-72`; `prover-loop.ts` `keepGoing` | **adopted**: `keepGoing(nonce)` is re-checked after the awaited verification before `winner` is posted |
| 8 | `!needsDownload` is a dead end: the SDK proves through a pending download; the server fetches bb first | `presto-client.ts:246-266,347-351`; `prove.rs:75-91` | **adopted** (already fixed before the audit landed): eligibility is `available && schemes ∋ ultra_honk`; the row distinguishes "needs a download" (before) from "downloading" (the phase) |
| 9 | The billboard has no Retry (CTA + close only) | `banners/src/render.ts:79-85` | **adopted**: re-probe with `forceRefresh:true` on Start and on the fix-it row's Retry; the billboard has no host retry (a reload or Start re-probes) |
| 10 | Decide the mount from `stateFromStatus`, not `reason === 'offline'`; in production the HTTP diagnosis cannot run, so "installed but TLS broken" is not distinguishable | `banners/src/status.ts:21-27`; `headers.ts:19`; `presto-transport.ts:797-812` | **adopted**; the consequence is recorded and one new Ask offers the exact plaintext health origin in the production CSP (recommended: no) |
| 11 | The probe at cockpit-ready can raise an LNA prompt before a gesture; keep it non-blocking | Chrome LNA docs; `presto-transport.ts:768-785` | **adopted** as a recorded consequence of the owner's timing decision; the probe never blocks boot or sign-in; a real-browser check of undecided/denied is in P2's gate |
| 12 | VK bytes: `export-vk.ts` already slices bb's binary VK into `W_VK` (115 × 32 = 3,680 bytes); the SDK wants `Uint8Array`, not base64 | `packages/work-circuit/scripts/export-vk.ts:12-23`; `presto-ultra-honk-backend.ts:50` | **adopted**: inference promoted to fact; `W_VK_BYTES` is the concatenation of `W_VK`'s fields (a test asserts equality with the committed fixture); decoded to `Uint8Array` once |
| 13 | The winning proof must be verified against locally constructed public inputs `[domain, seed, epoch, minerCommit, nonce, out]` with the non-ZK target | `yacana_work/src/main.nr:1-8`; `proof-data.ts:56-58` | **adopted**: `out` comes from the local `Noir.execute`, the five inputs are the job's; an invalid native win flips to WASM (`invalid-proof`) and the same nonce is re-proved |
| 14 | One WASM verify per win is unmeasured: it initialises bb.js on the first win and recomputes the VK each time | `presto-ultra-honk-backend.ts:236-259`; bb.js `backend.ts:194-212` | **adopted**: measured and recorded in P1's live gate; the pinned CRS path stays |
| 15 | E2E: set `AZTEC_BB_VERSION=5.2.0` beside `BB_BINARY_PATH`; the nightly `bb --version` string is irrelevant to negotiation | `server/src/main.rs:110-118`; `server.rs:455-482`; `toolchain.lock.json` | **adopted** (found independently before the audit landed) |
| 16 | Teardown: Presto's bb child has its own process group; SIGKILL on the pgid bypasses the SIGTERM handler that kills bb | `server/src/main.rs:131-154`; `core/src/bb.rs`; `run-teardown.ts:9-16` | **adopted**: TERM to the group, bounded wait, then KILL; `PRESTO_HOME` per run id |
| 17 | Starting Presto for the whole suite moves the WASM regressions (the power-change test fills the slider) onto native | `miner.e2e.ts:206-228` | **adopted**: a `?presto=off` query override under the existing e2e overrides keeps those tests on WASM; the same seam gives the "closed port" scenario |
| 18 | The scheduler tests are Vitest, not bun | `prover-loop.test.ts:1` | **adopted** in P1's gate; with the swap inside the prover the scheduler does not change |
| 19 | Provision the server in P1 (its live gate needs it); `lint:shell` the installer; dispatch CI at the branch and record the SHA | `package.json` scripts; `e2e.yml` | **adopted** |
| 20 | "A lying accelerator costs one proof" is false: losing garbage forever, withholding, stalls; "local machine already controls the browser" is wrong (binding a port is weaker) | `proof.ts:13-28`; `miner.ts:44-55` | **adopted**: the Security section states the residuals; W's proof shape (410 fields) is checked before the mining loop sees it |
| 21 | Privacy: the accelerator gets the compressed witness; commitment + timing allow correlation per job; never pass `MineJob` wholesale | `work.ts:44-50`; `worker-protocol.ts:2-10` | **adopted** (the prover only ever receives `WorkInputs`; stated) |
| 22 | Production transport needs executable evidence: `viteDefine` is enumerated, `VITE_PRESTO_*` absent; test a production build with hostile e2e env | `config.ts:89-90,178-199` | **adopted**: `VITE_PRESTO_E2E_PORT` is a `SiteConfig` field, empty in production by the same `env = {}` rule, asserted by the production guard and a config test |
| 23 | The package-age exception is name-wide and lasting; give it a removal condition | `bunfig.mdx:757-765` | **adopted** in the Ask's wording: exact names, the reason in the file, the owner decides permanence |
| 24 | The banner is trusted executable code; the inspected rendering is constrained (`href` protocol-checked, `noopener`); set properties after registration; events are requests only | `banners/src/element.ts`, `render.ts:25-35` | **adopted** (the threat-model row says so) |
| 25 | Pin the server digest in-repo; checksum beside the binary only protects against corruption | `release_metadata.rs:68-81` | **adopted**: `install-presto-server.sh` carries the version and the SHA-256 |
| 26 | `--allow-all` is needless (the e2e page origin `http://localhost:<port>` is auto-approved) and disables protection | `authorization.rs:568-596`; `run-setup.ts` `baseURL` | **adopted**: default gating |
| 27 | Use `PrestoClient` from `@alejoamiras/presto-core` for the page probe; `@alejoamiras/presto` drags the Chonk stack | `sdk-core/src/index.ts`; `sdk/package.json` deps | **adopted**: `presto-core` 1.0.1 (on npm) replaces `presto`; the dependency list shrinks to `presto-core`, `presto-noir`, `presto-banners` |
| 28 | Candidate leases could carry the health probes; the listener API has no consumer | `node-guard.ts:68-80` | **partly adopted**: the listener API is dropped; a dedicated set is kept over leases because the endpoints are permanent for the session and a lease's release semantics do not fit |
| 29 | `NodeBanner` path is wrong (`packages/ui/src/components/node-banner.tsx`) | confirmed | **adopted** |
| 30 | `PowerSlider` has no `disabled` prop | `power-slider.tsx:29-42` | **adopted**: a `disabled` prop in `packages/ui` |
| 31 | Per-origin cap: this Worker contributes one request; other tabs share the cap | `ultra_honk.rs:29-59` | **adopted** (wording) |
| 32 | The native e2e must record a successful `/prove/ultra-honk` response and a claim from that path | — | **adopted**: the test asserts a `prover: presto` message and a 200 on the route (captured through the page's request log) before the claim |

Rejected: none material. Not adopted as written: the lease-based admission of `/health` (see 28).

## Transcript (verbatim)

### 1. Verdict

**Rework. Confidence: high.** The overall integration is appropriate, but the plan is not implementation-ready: its single-endpoint guard does not accommodate SDK health probes, `!needsDownload` prevents cold installations from becoming usable, the winning-proof check lacks binding to the current job, and the proposed CI environment and teardown miss requirements of the real server. These need bounded corrections, not a different architecture.

### 2. Architecture & implementation critique

References prefixed **`Presto/`** refer to `/home/homelab/Projects/presto/`. Other paths are relative to this worktree. This was a read-only review; I did not run proving or E2E gates.

**The guard contract is incomplete.**

“Exact endpoint” currently means origin **plus path and query**, not a base URL. The SDK probes `/health` and posts `/prove/ultra-honk`; admitting either URL alone blocks the other. Installing the endpoint after a successful page probe is also too late—the probe itself needs admission. The Worker independently probes again, including after its cache expires. (`packages/site/src/browser/node-guard.ts:40–43,223–235`; `Presto/packages/sdk-core/src/lib/presto-transport.ts:741–765`; `Presto/packages/sdk-core/src/lib/presto-client.ts:321–323`; `Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:126–131`.)

Smallest correction: retain one exact accelerator **proof** endpoint and explicitly lease the exact health URL through the existing candidate mechanism around page probes and SDK operations that can probe. Install these permissions before calling the SDK in each realm; release leases in `finally`. Never admit a base-origin wildcard. (`packages/site/src/browser/node-guard.ts:68–80`.)

Specify collisions. The current dispatch checks node, then candidate, then page origin. Inserting accelerator after either node or candidate can misclassify it; inserting it before node can steal node traffic. Reject conflicting node/accelerator configurations and give the accelerator classification precedence over candidate and same-origin handling. Test both configuration orders, a same-origin accelerator, and an overlapping candidate. Separate listeners alone do not solve classification. (`packages/site/src/browser/node-guard.ts:59–80,223–233`; `packages/site/src/browser/node-health.ts:142–159`.)

The proposed `{ baseUrl, httpsOnly }` is an application type, **not** `PrestoConfig`; the latter takes `host`, `port`, and `httpsPort`. Define the conversion once and derive admitted URLs from that same configuration. In E2E, `httpsOnly:false` still launches an HTTPS probe as well as HTTP, so do not accidentally admit the SDK’s default HTTPS port belonging to another run. (`Presto/packages/sdk-core/src/lib/types.ts:31–60`; `Presto/packages/sdk-core/src/lib/presto-transport.ts:741–765`.)

**The Worker swap needs an explicit ownership contract.**

`mineEpoch` retains the prover argument throughout its nonce loop. Merely assigning the Worker’s global `prover` does not replace that captured object. Catching outside `mineEpoch` and restarting the original job can also repeat already-completed nonces. Retry the failed `prove(inputs)` through a stable delegate, or explicitly preserve the failing nonce when restarting. (`packages/web-miner/src/prover.worker.ts:34–61`; `packages/miner-core/src/miner.ts:35–55`.)

Keep the existing scheduler as the owner of stop, queued jobs and rebuilds. Define these invariants:

- One fallback construction and one destruction; no overlapping backend rebuild.
- Retry the same failed nonce; do not emit an attempt for a failed request.
- Stop or a newer job supersedes continuation.
- Thread reconfiguration does not silently re-enable a previously rejected native backend.
- Explicit native retry uses the serialized rebuild path, not another raw `init`.

That last distinction matters: current `init` directly invokes `backend.init`, whereas `reconfigure` uses the rebuild machinery. The controller’s `ready` promise resolves once and cannot serve as a fresh barrier for arbitrary later `init` messages. (`packages/web-miner/src/prover-loop.ts:43–57,74–105,109–130`; `packages/web-miner/src/controller.ts:173–199,444–449`.)

There is also a **new cancellation window during winning-proof verification**. Today `mineEpoch` checks `onAttempt` immediately before returning a winner. Adding an awaited verification afterwards requires another ownership check before posting `winner`; otherwise Stop/replacement can land during verification. The reducer rejects stale winners, but that does not justify violating the Worker’s contract or publishing misleading win events. (`packages/miner-core/src/miner.ts:51–55`; `packages/web-miner/src/prover.worker.ts:48–72`; `packages/web-miner/src/lib/reducer.ts:201–208`.)

**The fallback policy is defensible; its justification and tests are wrong.**

The SDK fallback is not silent: it emits `fallback`, and emits diagnostic phases for denial and version refusal. It does not expose every fallback reason through that callback, so `fallback:'none'` is useful when the application needs the precise reason and a sticky WASM choice. Keep that rationale. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:213–233`; `Presto/packages/sdk-core/src/lib/presto-client.ts:524–555`.)

There is **no SDK 429 retry policy to test**. Every `429` immediately becomes `fallback("transient")`; authorization cooldown is a server response the client classifies, not a client-side retry timer. Replace “capacity that does not clear” and “429 retries within the SDK’s policy” with the actual immediate-fallback behavior. (`Presto/packages/sdk-core/src/lib/presto-client.ts:531–555`.)

For the smallest implementation, consider retaining `PrestoUltraHonkBackend` after catching the typed error, calling its existing `setForceLocal(true)`, and retrying the witness. That preserves the reason while avoiding a second backend ownership path. A swap to `BbJsWorkProver` remains acceptable if the ownership rules above are explicit. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:124,176–178,186–198`.)

`ready { prover:'presto' }` currently means “constructed an adapter,” not “proved natively.” Construction performs no probe or proof. Either label this as the selected backend or publish actual native activation after a successful decoded native result. The proposed one-way `prover` message cannot express that latter transition. Clear active-backend state when the Worker is abandoned or disposed. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:101–143`; `packages/web-miner/src/controller.ts:215–219,245–250`.)

**The cold-install and Retry flows contain real dead ends.**

The `!needsDownload` eligibility condition prevents the first proof that would trigger the download. Health checking only reports the missing version; proving emits `downloading` and proceeds to the server. Permit an available server supporting `ultra_honk` even when it needs a download. Distinguish “needs a download” from “currently downloading.” (`Presto/packages/sdk-core/src/lib/presto-client.ts:246–266,337–351`; `Presto/packages/presto/core/src/server/prove.rs:75–91`; `Presto/packages/banners/src/strings.ts:59–64`.)

The billboard has **no Retry button**: it renders CTA and dismissal only. Listening for `presto-banner:retry` therefore provides no recovery from the offline billboard. Add a small host Retry control or re-probe on explicit Start; use `forceRefresh:true` for explicit Retry. Cache expiry alone does not schedule a probe. (`Presto/packages/banners/src/render.ts:79–85`; `Presto/packages/sdk-core/src/lib/presto-client.ts:117–135`; `Presto/packages/sdk-core/src/lib/presto-transport.ts:695–713`.)

Use `stateFromStatus` **before deciding whether to mount**. Testing only `status.reason === 'offline'` misses the normal HTTPS-only absent case, which is `secure-connection-unavailable/unconfirmed`. With production HTTP blocked, the HTTP diagnosis cannot establish “installed but TLS broken”; do not promise that distinction. (`Presto/packages/banners/src/status.ts:21–27`; `Presto/packages/sdk-core/src/lib/presto-client.ts:202–225`; `packages/site/src/headers.ts:19`.)

Preserve the owner’s cockpit-ready timing, but make the probe non-blocking and acknowledge that it can trigger LNA permission before a gesture. Chrome documents fetch-triggered local-network prompts; cockpit readiness is not permission readiness. Verify an undecided/denied permission case in a real browser, and keep sign-in usable while the probe settles. ([Chrome LNA documentation](https://developer.chrome.com/blog/local-network-access?hl=en); `packages/web-miner/src/boot.ts:154–158`; `Presto/packages/sdk-core/src/lib/presto-transport.ts:768–785`.)

**VK bytes are sound; the proposed verification contract is not yet sufficient.**

The VK inference is already directly established: codegen reads binary `vk`, requires `115 × 32` bytes and slices those bytes into `W_VK`. I independently compared the concatenated manifest fields with the committed binary fixture: **115 fields, 3,680 bytes, identical**. Emit from those existing bytes; no serialization investigation is needed. Also, the SDK expects `Uint8Array`, whereas the plan declares a base64 string—state the decoding step. (`packages/work-circuit/scripts/export-vk.ts:12–23`; `Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:50`.)

The server uses supplied VK bytes as `-k`; when omitted, it uses `--write_vk`, with the requested verifier target in either case. Omission is supported and costs key computation. A wrong supplied key is not an authenticated key-selection mechanism; the adapter itself documents that it can spoil proofs. (`Presto/packages/presto/core/src/bb/ultra_honk.rs:260–288`; `Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:45–50`.)

A winning proof must verify against **locally constructed expected public inputs** `[domain, seed, epoch, minerCommit, nonce, out]`, with `verifierTarget:'noir-recursive-no-zk'`. Verifying against accelerator-returned public inputs could accept a valid proof of a different job that subsequently fails the claim. The present `WorkResult` discards public inputs, so specify where this check lives. (`packages/work-circuit/crates/yacana_work/src/main.nr:1–8`; `packages/contracts/yacana_miner/src/main.nr:174`; `packages/miner-core/src/work.ts:19–28`; `Presto/packages/sdk-noir/src/lib/proof-data.ts:56–58`.)

One verification per native win is reasonable, but “cheap” is unmeasured. It initializes the lazy WASM backend on the first win, and bb.js recomputes the circuit VK during **each** `verifyProof`. Retain pinned CRS handling, measure first-win latency, and define false/throw as invalid-accelerator output leading to WASM recovery—not repeated Worker crashes. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:146–148,236–259`; `node_modules/@aztec/bb.js/src/barretenberg/backend.ts:194–212`; `packages/web-miner/src/prover.worker.ts:22–27`.)

**The E2E lane needs three corrections.**

1. **Advertise the release identity.** Set `AZTEC_BB_VERSION=5.2.0` alongside `BB_BINARY_PATH`, as Presto’s CI does. Otherwise a clean headless instance reports `unknown`, includes that in `available_versions`, and the SDK reports `needsDownload:true`; the plan then rejects it. (`Presto/packages/presto/server/src/main.rs:110–118`; `Presto/packages/presto/core/src/server.rs:58,455–482`; `Presto/.github/workflows/_ts-package-ci.yml:223–238`.)

   The nightly-looking executable version is not itself evidence of incompatibility. The installed native binary and this worktree’s bb.js native binary have identical SHA-256, matching `toolchain.lock.json:9`. Negotiation uses advertised release strings, not `bb --version`. Keep `bbVersion:'5.2.0'`; prove W equivalence in the live gate.

2. **Graceful teardown first.** Presto’s bb child has its own process group. The existing proxy teardown uses `SIGKILL`; copying that for Presto bypasses its SIGTERM handler, which explicitly terminates and confirms bb’s exit. Use TERM, bounded wait, then owned escalation; exercise teardown during proving. Make `PRESTO_HOME` run-specific, not merely worktree-specific. (`Presto/packages/presto/core/src/bb.rs:693–695`; `Presto/packages/presto/server/src/main.rs:131–154`; `packages/web-miner/e2e/run-teardown.ts:9–16`.)

3. **Keep WASM regression tests on WASM.** Starting Presto for the whole suite changes existing tests’ backend. The power-change test actively fills the slider, which this plan disables on native. Explicitly make Presto unavailable for that test; do not delete its coverage. Also specify how the closed-port scenario changes a build-time endpoint. (`packages/web-miner/e2e/miner.e2e.ts:206–228`; `packages/web-miner/e2e/run-setup.ts:44–49,93–95`.)

**Phase gates are close, but not yet sufficient.**

Move the minimal server provisioning into P1 because P1 already requires live Presto. Run scheduler tests in P1 through the actual Vitest command; they are Vitest tests, not the proposed Bun HTTP-adapter suite. Add adversarial public-input/proof cases and delayed fallback/verification races there. (`packages/web-miner/src/prover-loop.test.ts:1–3,45–139`; `packages/web-miner/package.json:11`.)

The native E2E must record a successful `/prove/ultra-honk` response and a claim from that path; a transient native label followed by a WASM claim is insufficient evidence. Dispatch CI explicitly at the feature branch and record its commit SHA—`gh workflow run e2e.yml` alone does not identify the reviewed revision. Add `lint:shell` for the new installer. (`implementations-plan/presto-mine/plan.md:203–208`; `package.json:21`.)

### 3. Adversarial / security review

**The “lying accelerator costs one proof” guarantee is false. Confidence: high.** A malicious responder can return well-formed losing garbage indefinitely, withhold good proofs, or stall requests. Winning-only verification prevents submission of invalid winners only when bound to expected inputs; it does not validate losses or guarantee progress. The SDK structurally decodes proof fields, while the miner applies its length check and digest before choosing a winner. (`Presto/packages/sdk-noir/src/lib/proof-data.ts:15–41`; `packages/miner-core/src/proof.ts:13–28`; `packages/miner-core/src/miner.ts:44–55`.)

Validate W’s exact proof shape before handing it into the mining loop. A whole-field proof of the wrong length passes the generic SDK decoder but fails the miner’s 410-field check; without an explicit recovery path, attacker-controlled output can consume the controller’s crash budget. (`Presto/packages/sdk-noir/src/lib/proof-data.ts:29–35`; `packages/miner-core/src/proof.ts:14–16`; `packages/web-miner/src/controller.ts:203–219`.)

Delete “whoever controls the local machine already controls the browser.” Binding a local port is a weaker capability than controlling the browser. Health-schema validation establishes protocol shape, not process authenticity—the SDK itself says this. (`Presto/packages/sdk-core/src/lib/presto-client.ts:456–465`.)

**Privacy exposure is limited but real.** The accelerator receives the compressed witness, not merely a list of inputs. W receives the commitment rather than the epoch secret or recipient directly; that commitment and proof timing permit correlation across work for that job. Do not pass `MineJob` wholesale: it contains both secret and recipient. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:201–209`; `packages/miner-core/src/work.ts:44–50`; `packages/miner-core/src/miner.ts:40–49`; `packages/web-miner/src/worker-protocol.ts:2–10`.)

**Production transport needs executable evidence.** Extend `SiteConfig`/`viteDefine` so production explicitly overrides or excludes the new port and insecure policy. The current protection covers only enumerated fields; `VITE_PRESTO_PORT` is absent. Test a production build with hostile E2E environment values and assert neither realm sends HTTP. Keep the CSP unchanged. (`packages/site/src/config.ts:89–90,178–199`; `packages/site/src/config.test.ts:19–33`; `packages/site/src/headers.ts:19`.)

**The package-age exception has lasting scope.** It exempts package names across future versions and all workspace installations, not just today’s pinned releases. Use only the necessary exact names, retain lockfile integrity, and give the temporary exception a removal condition. Common ownership is not evidence that npm compromise implies deployment compromise. (`bunfig.toml:1–7`; `node_modules/bun-types/docs/runtime/bunfig.mdx:757–765`.)

**The banner is trusted executable code, although the inspected rendering is reasonably constrained.** It uses `innerHTML`, but its href is protocol-checked and escaped, and links use `noopener`. With the fixed HTTPS href and `fonts="none"`, I found no demonstrated injection in this integration. Set properties after registration completes; treat events only as requests to re-probe, never as authority to change endpoints or backend status. Update the threat-model claim “no HTML injection” to describe the constrained template usage accurately. (`Presto/packages/banners/src/element.ts:29–37,88–95,154–159,271–280`; `Presto/packages/banners/src/render.ts:25–35`; `Presto/packages/banners/src/fonts.ts:11–17`; `docs/threat-model.md:41`.)

**Release checksums need an honest trust statement.** Downloading both binary and checksum from the same release protects against corruption, not replacement of both assets. For this single pinned server version, commit the expected digest alongside the version. Presto’s bb downloader explicitly documents the same upstream-control-plane limitation; WASM proof verification cannot sandbox a malicious native executable. (`Presto/packages/presto/core/src/versions/release_metadata.rs:68–81`; `.github/actions/setup-aztec/action.yml:23–27`.)

Keep CI at `contents:read`, with no production credentials exposed to the downloaded executable. `--allow-all` unnecessarily permits arbitrary browser origins on the homelab; localhost is already auto-approved. Use default headless gating for browser E2E unless a particular test requires the broader mode. (`.github/workflows/e2e.yml:9–10`; `Presto/packages/presto/server/src/main.rs:78–95`.)

### 4. Assumption attack

**Facts**

| Fact | Assessment |
|---|---|
| 1. Noir SDK contract | Verified in source, including exact bb.js peer; supplied VK is **bytes**, not a base64 string. Publication timestamp was not independently verified. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:34–58,201–220`; `Presto/packages/sdk-noir/package.json:32–34`.) |
| 2. Probe/cache/config | Verified. Worker detection is already implemented. (`Presto/packages/sdk-core/src/lib/presto-client.ts:117–135`; `Presto/packages/sdk-core/src/lib/config.ts:31–39`; `Presto/packages/sdk-core/src/lib/presto-transport.ts:6`.) |
| 3. Headless behavior | Source confirms flags, isolated-home requirement and localhost approval. Prior startup log and release-asset checksum were not independently reproduced. Add the missing version-advertisement requirement. (`Presto/packages/presto/server/src/main.rs:56–118,164–186`.) |
| 4. CSP | Verified; its consequence is that the SDK’s HTTP diagnosis cannot succeed in production. (`packages/site/src/headers.ts:10–19`; `Presto/packages/sdk-core/src/lib/presto-transport.ts:797–812`.) |
| 5. Guard | Verified. The claimed new collision immunity does not follow from existing dispatch. (`packages/site/src/browser/node-guard.ts:223–235`.) |
| 6. Banner | Mapping, variants and font opt-out verified. “Unpublished” is time-sensitive and was not independently rechecked. Billboard Retry is absent. (`Presto/packages/banners/src/status.ts:21–27`; `Presto/packages/banners/src/strings.ts:132`; `Presto/packages/banners/src/render.ts:79–85`.) |
| 7. Worker/W inputs | Verified. Also record that `WorkProver` currently has no verification method. (`packages/web-miner/src/worker-protocol.ts:13–22`; `packages/miner-core/src/work.ts:26–29,44–50`.) |
| 8. Installed toolchain/CI | Verified locally: reported nightly string, matching installed/package binary hashes. Dispatch-only workflow confirmed. This does not replace a native W proof test. (`toolchain.lock.json:8–10`; `.github/workflows/e2e.yml:6–7`.) |
| 9. Presto CI | Verified but incompletely copied: it sets `AZTEC_BB_VERSION` and terminates with normal `kill`. (`Presto/.github/workflows/_ts-package-ci.yml:225–245`.) |
| 10. Bun age rule | Verified. Exclusions are package-name-wide. (`bunfig.toml:1–3`; `node_modules/bun-types/docs/runtime/bunfig.mdx:757–765`.) |

**Inferences**

- **VK concatenation:** promote to fact; already verified by codegen and the byte comparison. Use fixture equality as the smallest regression check. (`packages/work-circuit/scripts/export-vk.ts:15–23`.)
- **Worker runtime detection:** promote to fact; explicit `httpsOnly` remains sensible. (`Presto/packages/sdk-core/src/lib/config.ts:31–39`.)
- **Per-origin capacity:** weaken to “this Worker contributes at most one request.” Multiple tabs share the origin’s cap, and other origins can occupy global capacity. A mocked `429` is the cheapest recovery check. (`Presto/packages/presto/core/src/server/ultra_honk.rs:29–59`; `Presto/packages/presto/core/src/server.rs:52`.)
- **Billboard appearance:** retain as a visual judgment; the requested actual 1280/1440 renders are the right validation.
- **Localhost approval:** promote to fact. Remove the characterization of `--allow-all` as extra protection—it disables protection. (`Presto/packages/presto/server/src/main.rs:78–95`.)

**Asks**

The custom fix-it row, disabled slider and Mine-only placement are reasonable. The license decision remains explicit; I verified package license declarations, not legal compatibility. (`Presto/packages/sdk-noir/package.json:10`; `Presto/packages/banners/package.json:10`.)

Revise the age-rule ask to a temporary, narrowly named exception. Record the consequence of the already-approved probe timing: a signed-out visitor may receive an LNA prompt. Do not reopen the timing decision; make its browser validation and recovery behavior explicit. The remaining technical gaps do not need additional owner decisions.

### 5. Recon check

Most reuse decisions are sound. Four adjustments:

- **Use `PrestoClient` directly for page health.** `PrestoProver.checkPrestoStatus` merely forwards to it, while the full package brings Chonk-related dependencies. Direct core reuse removes an unnecessary adapter and dependency. (`Presto/packages/sdk-core/src/index.ts:3`; `Presto/packages/sdk/src/lib/presto-prover.ts:115–124,149–150`; `Presto/packages/sdk/package.json:27–34`.)
- **Reuse exact candidate leases for health probes.** Recon’s “leases cannot carry it” is valid for reported proof traffic, not for discovery whose result already feeds the atom. The proposed accelerator listener API has no identified consumer; omit it unless one is specified. (`implementations-plan/presto-mine/recon.md:11`; `packages/site/src/browser/node-guard.ts:68–80`.)
- **Reuse existing scheduler tests and VK export.** Both provide the seams this plan needs. (`packages/web-miner/src/prover-loop.test.ts:45–139`; `packages/work-circuit/scripts/export-vk.ts:12–23`.)
- **Correct the NodeBanner path.** `packages/web-miner/src/components/NodeBanner.tsx` does not exist. The actual component is `packages/ui/src/components/node-banner.tsx:33`, imported through the UI package at `packages/web-miner/src/App.tsx:14–18`.

I found no counterexample to the Web Component absence claim. The file map nevertheless omits the shared config changes, and the slider needs either a disabled fieldset wrapper or a supported `disabled` prop—it currently exposes none. (`packages/site/src/config.ts:6–31,178–199`; `packages/ui/src/components/power-slider.tsx:29–42,59–69`.)

### 6. Concrete changes

1. **“The guard’s fourth class”** — name `/prove/ultra-honk` as the exact accelerator endpoint; describe scoped exact `/health` leases in both realms, collision rejection and production HTTP refusal.

2. **“Key interfaces”** — define one conversion from application endpoint configuration to SDK `host/port/httpsPort`; make VK decoding to `Uint8Array` explicit. Remove unused accelerator listeners unless a consumer is named.

3. **“The Worker chooses”** — specify same-nonce retry, single backend ownership, serialized rebuilds, sticky fallback across thread changes and cancellation checks after asynchronous verification. Define `ready` versus actual native activation.

4. **“Trade-offs: fallback” and P1’s 429 gate** — replace the silent-fallback assertion with precise-reason/sticky-policy rationale; replace SDK retries with immediate `transient` fallback. Consider the existing `setForceLocal` path before building a separate swap.

5. **“Data & control flow”** — remove `!needsDownload`; distinguish pending download from active download, and carry the necessary phase information to the page.

6. **“The billboard and fix-it row”** — normalize status before mount decisions; add a reachable host Retry or explicit-Start re-probe, forced refresh and registration-before-property assignment. Preserve fallback notices until actual recovery.

7. **“Winning proof”** — require verification against locally derived current-job public inputs and the explicit non-ZK target; define malformed/invalid native output as recoverable fallback. Record first-win WASM/VK cost.

8. **“The VK bytes”** — promote byte concatenation to a verified fact. Replace vague “hash the bytes” wording with exact fixture equality and the existing bb-generated VK/hash consistency checks.

9. **“HTTP is an e2e device” / file map** — include shared site configuration and tests that hostile E2E environment values cannot enable HTTP in either production realm.

10. **“The e2e and CI”** — add `AZTEC_BB_VERSION=5.2.0`, run-specific `PRESTO_HOME`, startup ownership evidence, TERM-and-wait teardown and interrupted-proof cleanup. Preserve default origin gating where sufficient.

11. **P1/P2/P3 gates** — provision Presto before P1’s live gate; run Vitest scheduler regressions in P1; preserve the WASM power-change test; require successful native transport evidence plus a claim; specify the unavailable scenario mechanism, shell lint and CI branch/SHA.

12. **“Security & Adversarial Considerations”** — remove the one-proof-loss and local-process/browser-equivalence claims; document correlation, withholding and invalid-loss residuals; pin the server digest in-repo and make the npm age exception temporary.
---

# Round 2 — the revised plan (resumed session, 2026-09-09)

Prompt: re-read the revised `plan.md`; the owner's decisions and two corrections (Presto downloads the bb version a page asks for; its thread count is the app's Speed setting); do the structural corrections hold, did the revision introduce anything, verdict. Same session `01a0869d-fa12-7a21-824a-6365b8b33699`, `high`, read-only.

Verdict: **approve with changes** — "the revised fallback architecture, cryptographic binding, exact URL guard, version negotiation, and production transport policy hold." Six edits, each verified and folded in:

| # | Finding | Checked | Disposition |
|---|---|---|---|
| 1 | "First native success + sticky fallback only" cannot describe the prover: a transient's local proof after a native success leaves `active` dishonest | plan §Architecture 1–2 | **adopted**: `prover { kind, sticky, reason? }` on every transition; `active` follows it; the transient counter resets on a native success |
| 2 | No Worker transport for the `downloading` phase; no reset of `active`/`phase`/`fallbackReason` on rebuild or dispose; a health probe must not clear a Worker's sticky failure | `controller.ts:173-199,245-250` | **adopted**: `presto-phase` message; cleared on `ready` and dispose; probes never clear |
| 3 | An invalid native proof is shown as a win before verification: `onAttempt` posts `attempt.win`, the reducer writes the ★ line and `winAt` | `miner.ts:54-55`, `prover.worker.ts:48-63`, `reducer.ts:155-177` (verified) | **adopted**: the winning `attempt` is held back until `verifyWin` + `keepGoing` pass; an invalid one posts `win: false` |
| 4a | An `available` status without `ultra_honk` selects WASM silently; the banner mapper calls it available | `presto-client.ts:337-345`, `banners/src/status.ts:21-27` | **adopted**: maps to the update row |
| 4b | Forced probing in `controller.start()` would also fire on the automatic resumes after a claim / expired claim; a Retry probe must not start mining after Stop or dispose; `reconfigure` short-circuits on equal threads so Retry needs a `force` | `controller.ts:254-274,520,544` (verified) | **adopted**: scoped to the user's Start/Retry; `reconfigure(threads, presto, { force })`; the loop's pending slots hold the whole config |
| 5 | Teardown grace must exceed Presto's 5 s child-termination window | `server/src/main.rs:131-154` | **adopted**: up to 8 s before SIGKILL |
| 6 | "A native message + a 200 + a claim from that session" does not prove the claimed winner was native; the native message must not replace the HTTP evidence | plan P3 gate | **adopted**: `winner.prover` provenance asserted on the claimed win; the `200` read from the page log or the server's own log |

Rejected: none.

## Transcript (verbatim)

### 1. Do the corrections hold?

**Mostly yes. Confidence: high.** The remaining changes concern state propagation, retry wiring, and evidence. `Presto/` below denotes `~/Projects/presto`.

- **Same-object fallback: sound.** `setForceLocal(true)` only changes a boolean; the next `generateProof` bypasses detection and proves the supplied witness locally. Setting it back to `false` resumes the normal client path without destroying its cache or protocol state. Within the **10-second health TTL**, the next nonce normally goes straight to another native POST; after expiry, it performs the normal health probe. A slow first WASM initialization can therefore make the next nonce pay that probe. There is **no client-side transient cooldown** preventing the retry: the relevant HTTP errors immediately return `transient`. Reset the consecutive-failure counter only after a successful native result. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:119–133,176–178,226–259`; `Presto/packages/sdk-core/src/lib/presto-client.ts:117–135,321–351,547–555`; `Presto/packages/sdk-core/src/lib/presto-transport.ts:6,696–713`.)

  Keeping `fallback: 'none'` is justified: it exposes the precise reason before the wrapper decides whether fallback sticks. The SDK’s automatic fallback does not make that decision for you. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:213–233`.)

- **Selected/active ordering and serialized retry: structurally sound, incompletely wired.** Construction performs no native proof, so `ready.prover` correctly means selected; activation after decoding is the right boundary. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:101–143`.)

  Threading `{threads, presto}` through the loop preserves its invariants **provided both pending reconfiguration slots hold the whole configuration atomically**, with `undefined` meaning no pending rebuild and `presto: null` remaining a valid configuration. Preserve finish-in-flight, next-nonce resume, stop precedence, and latest-configuration coalescing. Those are precisely the existing implementation and test contracts. (`packages/web-miner/src/prover-loop.ts:35–57,74–104`; `packages/web-miner/src/prover-loop.test.ts:45–85,100–137`.)

  **One concrete omission:** the controller currently returns immediately when the thread count is unchanged. Native Retry must explicitly bypass that deduplication—even when both requested threads and endpoint equal their previous values, because the existing adapter may be sticky-WASM. Extend the existing coalescing test to assert the endpoint as well as threads. (`packages/web-miner/src/controller.ts:270–274`; `packages/web-miner/src/prover-loop.test.ts:101–109`.)

- **Winning-proof verification: cryptographically sound.** The six locally constructed public inputs match W’s declaration. `toProofData` produces exactly `0x` plus 64 hexadecimal digits per field, and bb.js consumes those strings as bytes. The non-ZK recursive target selects Poseidon2 with ZK disabled. (`packages/work-circuit/crates/yacana_work/src/main.nr:1–8`; `Presto/packages/sdk-noir/src/lib/proof-data.ts:45–58`; `node_modules/@aztec/bb.js/src/barretenberg/backend.ts:84–89,194–212`.)

  **The seeded VK does not drive verification:** the SDK delegates verification to WASM, which recomputes the VK from local bytecode. The seed supplies the native proving request. That is the desired trust boundary, and the revised plan correctly acknowledges its initialization and recomputation costs. (`Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:146–155,201–209,253–259`; `node_modules/@aztec/bb.js/src/barretenberg/backend.ts:200–212`.)

  Rechecking `keepGoing(nonce)` after verification preserves cancellation; checking it twice with the same nonce does not advance twice—the scheduler assigns `nextNonce = nonce + 1`. Retrying an invalid result from that nonce inside the same backend operation is compatible with this. There remains a premature **UI win report**, discussed below. (`packages/web-miner/src/prover-loop.ts:95–104`; `packages/miner-core/src/miner.ts:40–55`.)

- **Exact URL admission: sound.** This integration’s SDK calls use the literal `/health` and `/prove/ultra-honk` paths, without trailing-slash or query variants. HTTPS failure can additionally trigger the already-accounted-for HTTP `/health` diagnosis. (`Presto/packages/sdk-core/src/lib/presto-transport.ts:741–765,797–806,940–943`; `Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:126–130`.)

  Browser-generated OPTIONS preflights run below the JavaScript fetch wrapper; they do not require another admitted URL. Presto’s router supplies CORS handling for POST and the SDK’s headers. The proposed ordering also keeps accelerator requests under their own deadline when sharing a candidate URL or page origin; bidirectional node-collision rejection removes the dangerous ambiguity. (`packages/site/src/browser/node-guard.ts:107–111,211–239`; `Presto/packages/presto/core/src/server.rs:383–400`.)

- **E2E version, origin, and production isolation: sound, with one timing detail to specify.** Advertising `5.2.0` makes that requested version resolve as bundled, avoiding the download branch; the existing `BB_BINARY_PATH` override then wins binary lookup. Ordinary multi-version differences cause `needsDownload`, not rejection. (`Presto/packages/presto/server/src/main.rs:110–118`; `Presto/packages/presto/core/src/server/prove.rs:63–91`; `Presto/packages/presto/core/src/bb.rs:47–60`; `Presto/packages/sdk-core/src/lib/presto-client.ts:247–266`.)

  Default headless gating approves the localhost page, and `PRESTO_HOME` isolates mutable state. **Specify a teardown grace longer than Presto’s own five-second child-termination window** before escalating to SIGKILL. (`Presto/packages/presto/server/src/main.rs:85–105,131–154`; `Presto/packages/presto/core/src/lib.rs:30–37`.)

  The proposed port field and existing query switch fit production isolation: production discards overrides, `viteDefine` explicitly supplies their compiled values, query overrides require localhost, and production CSP excludes the HTTP additions. I found no further production escape in that design. (`packages/site/src/config.ts:89–110,178–199`; `packages/site/src/browser/connection.ts:48–57`; `packages/site/src/headers.ts:19`.)

### 2. Anything the revision introduced?

**Yes—four concrete integration gaps and one evidence gap.**

1. **Temporary fallback makes `active` dishonest.** After a native success followed by one or two transient failures, the plan emits no WASM message although those witnesses are proved locally. Conversely, a temporary fallback before the first native success leaves `active` unset. “First native success” plus “sticky fallback only” cannot describe the actual prover. Separate backend transitions from sticky diagnosis: report temporary WASM without setting a sticky reason, and report native again when it succeeds. (`implementations-plan/presto-mine/plan.md:58–63,89–94,117–120`; `Presto/packages/sdk-noir/src/lib/presto-ultra-honk-backend.ts:124,226–233`.)

2. **The downloading phase has no specified Worker transport, and reset semantics are missing.** The revised interfaces include a prover phase callback and atom field, but no phase message connecting them. Specify that message and clear stale phase/active/fallback state on rebuild and disposal; a successful health probe must not itself clear a Worker’s sticky failure. (`implementations-plan/presto-mine/plan.md:143–160`; `packages/web-miner/src/controller.ts:173–199,245–250`.)

3. **An invalid proof can still be displayed as a win.** `mineEpoch` invokes `onAttempt` before returning the candidate winner; the Worker immediately posts `attempt.win`, and the reducer creates a win ledger entry and updates `winAt`. Verification afterward protects submission but cannot retract that report. Defer the winning attempt’s win indication until verification and the cancellation recheck pass. (`packages/miner-core/src/miner.ts:54–55`; `packages/web-miner/src/prover.worker.ts:48–63`; `packages/web-miner/src/lib/reducer.ts:155–177`.)

4. **Eligibility and retry need explicit handling.**
   - An available health response without `ultra_honk` selects WASM under the revised eligibility rule, so the SDK never gets to emit `scheme-unsupported`. The banner mapper considers an available status available/downloading. Explicitly map missing or unsupported schemes to the miner’s update row. (`implementations-plan/presto-mine/plan.md:110–116,172–174`; `Presto/packages/sdk-core/src/lib/presto-client.ts:337–345`; `Presto/packages/banners/src/status.ts:21–27`.)
   - Scope forced probing/re-enabling to **user Start/Retry**. Putting it indiscriminately in `controller.start()` also affects automatic post-claim and expired-claim resumes. An awaited probe must not restart mining after Stop or disposal. (`packages/web-miner/src/controller.ts:245–266,521,544`; `implementations-plan/presto-mine/plan.md:181,194–195`.)

5. **The native-claim gate can still pass after fallback.** A native message and successful POST followed by a claim “from that session” do not establish that the claimed winner came from native proving. Require native provenance for the winning proof. Also remove the inference allowing the native message to replace HTTP evidence; change the observation point if necessary. (`implementations-plan/presto-mine/plan.md:303–305,423–425`.)

### 3. Verdict

**Approve with changes. Confidence: high.** Smallest required edits:

1. Define actual backend-transition messages, phase transport, and lifecycle resets.
2. Preserve the complete configuration through rebuilds; permit same-thread explicit Retry; keep asynchronous user retry subordinate to Stop/disposal.
3. Defer the winning attempt’s win indication until verification succeeds.
4. Map unsupported/missing schemes to the update row.
5. Specify teardown grace exceeding five seconds.
6. Require evidence that the **claimed winner** was native; retain independent HTTP evidence.

The revised fallback architecture, cryptographic binding, exact URL guard, version negotiation, and production transport policy hold.