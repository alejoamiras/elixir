---
plan: presto-mine
tier: light
driver: claude-code
eli5_mode: artifact
code_review: off
budget: default (recon 2 agents; codex at high; one plan audit)
status: approved design (two codex passes folded in: rework → approve with changes; Plan A; awaiting the go)
created: 2026-09-09
base: origin/main 07f4d45
worktree: .claude/worktrees/presto-mine (branch worktree-presto-mine)
---

# Presto on the Mine page

Presto is the owner's native proving accelerator: a local app (a menu-bar app on desktops, a headless
`presto-server` binary on servers and in CI) that proves Noir UltraHonk circuits with native `bb` for any page that
asks. The miner proves the work circuit W in a Web Worker with bb.js WASM today. This plan makes the miner prove W
through Presto when it is installed and working, fall back to WASM when it is not, tell the visitor which one is
running, and — when Presto is absent — show Presto's own billboard inviting the install. Everything else (the
wallet's own proofs, the CRS, the claim) stays as it is.

Decisions already taken by the owner (2026-09-09): the banner is the **billboard**; the probe runs at **cockpit
ready**; the native indicator shows in the **status pill**, the **Settings Performance tile** and the **loop tile's
rate line**; validation is **real headless Presto on the homelab and in CI** plus unit and Vitest; `code_review` is
off; `@alejoamiras/presto-banners` **1.0.0** (released 2026-09-09 14:55 UTC) is the pinned banner; **every UI change
is approved on the design canvas before it is built** (the canvas is a prerequisite of P2).

## Tier

Rubric: novelty **low** (the owner wrote Presto; the SDK is a drop-in for the class the miner already uses), blast
radius **medium** (the miner only; the wallet's proving untouched), irreversibility **low**, migration **none**,
external coupling **high** (a local third-party process, its SDK, its permission model), security sensitivity
**medium** (the fetch guard admits a fixed set of local URLs; the accelerator sees the witness of W, never the secret).
One high → the rubric says `mid`; the owner chose `light` with the reason that the surface is bounded (one app, one
new class in the guard, one prover behind an existing interface). Recorded; the single codex audit carried the
adversarial ask with the same weight and returned **rework** with bounded corrections, all folded in below
(`audit-codex.md` has the verification ledger).

## Recon

`recon.md` (2026-09-09). The reuse map's verdicts drive the architecture below: the `WorkProver` interface and the
prover loop are reused as they are; the guard gains a class; Presto's state is a miner atom, not a second health
store; the banner is a small wrapper around a Web Component the repo has no precedent for; the e2e launcher copies
the node-proxy's shape; CI copies Presto's own `start-headless-presto` action. Two recon corrections from the audit:
the page's probe uses `PrestoClient` from `@alejoamiras/presto-core` (the `@alejoamiras/presto` package drags the
Chonk stack in), and the banner precedent lives in `packages/ui/src/components/node-banner.tsx`, not in the miner.

## Architecture & Implementation

### Proposed architecture

1. **The prover** (`packages/web-miner/src/presto-prover.ts`, new): `PrestoWorkProver implements WorkProver` wraps
   one `PrestoUltraHonkBackend` (from `@alejoamiras/presto-noir`) built with `bbVersion: '5.2.0'`, `fallback: 'none'`,
   `verificationKey: { bytes: W_VK_BYTES, verifierTarget: 'noir-recursive-no-zk' }` and the bb.js `api` as a lazy
   factory, so WASM is never built on a purely native path. `prove()` runs `Noir.execute` locally (cheap; it yields
   `out`), then `generateProof(witness, { verifierTarget })`. The backend's typed `PrestoUnavailableError` is the
   swap: for `transient` (a 429/503/408/413) the same witness is proved locally through `setForceLocal(true)` and
   native is tried again on the next nonce, three in a row making it sticky; every other reason (`denied`, `cooldown`,
   `version-mismatch`, `scheme-unsupported`, `route-missing`, `network`, `malformed-response`, `unavailable`,
   `secure-connection-unavailable`) is sticky at once. The same nonce is always re-proved, one backend owns the WASM
   instance, and the scheduler never sees the swap; the consecutive-transient counter resets only on a native
   success. One callback, `onProver(kind, { sticky, reason? })`, fires on every change of what actually proved:
   native after a decoded native proof (the first, and again after a temporary WASM proof), `wasm` with
   `sticky: false` for a transient's local proof, `wasm` with `sticky: true` and the reason when the choice sticks;
   `onPhase` forwards the backend's phases (`downloading` is the one the page shows). `verifyWin(inputs, result)` checks a native winning proof with the
   backend's WASM `verifyProof` against **locally constructed** public inputs `[domain, seed, epoch, minerCommit,
   nonce, out]` (W's fixed order; `out` came from the local execute) and the same verifier target; an invalid one is
   a sticky fallback with reason `invalid-proof`. W's proof shape (410 fields) is checked before the mining loop sees
   a native proof.
2. **The Worker** (`prover.worker.ts`): `init` and `reconfigure` carry `presto: PrestoEndpoint | null`. With an
   endpoint the Worker installs the guard's accelerator URLs in its own realm before any SDK call, builds
   `PrestoWorkProver`, and answers `ready { prover: 'presto' }` — the *selected* backend, not yet proof of native
   proving. Every prover transition is its own message, `{ type: 'prover', kind: 'presto' | 'wasm', sticky, reason? }`,
   and the phase its own, `{ type: 'presto-phase', phase }`, both posted from the prover's callbacks; `active` in
   the atom follows `prover` exactly, so a temporary WASM proof reads as WASM and the ✦ returns with the next native
   one. **The win is reported only after it is verified**: on a natively active prover the Worker holds back the
   winning `attempt` message (the one the reducer would turn into a ★ line and `winAt`), awaits `verifyWin`,
   re-checks `keepGoing(nonce)` (a Stop or a replacement during the verification wins), then posts the `attempt`
   with `win: true` and the `winner` (which carries `prover: 'presto'`); an invalid proof posts the attempt with
   `win: false`, flips sticky with `invalid-proof`, and re-runs `mineEpoch` from that nonce on the now-WASM prover.
   The page clears `active`, `phase` and `fallbackReason` whenever a Worker is attached or rebuilt (`ready`) and on
   dispose; a health probe never clears a Worker's sticky failure — only a rebuild does. Without an endpoint, today's path, `ready { prover: 'wasm' }`. A retry of native after a sticky
   fallback is a `reconfigure` with the same threads and the endpoint: the loop's existing serialised rebuild path
   (`destroy` → `init`), the job resuming at its next nonce, never a second raw `init`. The loop's two pending slots
   (`reconfigureTo`, `pendingThreads`) hold the whole `{ threads, presto }` atomically (`undefined` = nothing pending,
   `presto: null` a valid config), so finish-in-flight, next-nonce resume, Stop precedence and last-config coalescing
   are unchanged. The controller's `reconfigure` keeps its equal-config short-circuit for the slider and gains a
   `force` for Retry (the adapter may be sticky-WASM under an unchanged config). Forced probing and the native retry
   are scoped to the **user's** Start button and Retry, never to `controller.start()` (which the automatic resumes
   after a claim or an expired claim also call); an awaited Retry probe acts only through `reconfigure`, and not at
   all after Stop or dispose.
3. **The guard's fourth class** (`packages/site/src/browser/node-guard.ts`): `setAcceleratorEndpoints(urls | null,
   deadlineMs)`. A request whose normalised URL (origin + path + query, as today) is in the set passes with the
   deadline and `redirect: 'error'`, is never reported (no listeners: the node's health store, `quietNodeReads` and
   the candidate leases do not see it) and is classified after the node and before candidates and the page origin.
   `setNodeEndpoint` and `setAcceleratorEndpoints` throw when a URL would be in both. The set is derived once from
   one `PrestoEndpoint { host, port, httpsPort, httpsOnly }` — the SDK's `PrestoConfig` shape:
   `https://host:httpsPort/health` and `/prove/ultra-honk` always, the `http://host:port` pair only when
   `httpsOnly` is false (the e2e mode). In production the SDK's witness-free HTTP `/health` diagnosis is blocked by
   this guard and by the CSP, so an installed Presto whose HTTPS is off reads as "not installed" (Ask 6 offers the
   one plaintext health origin in the CSP; recommended no).
4. **Presto's state is the miner's** (`packages/web-miner/src/presto.ts`, new, and `state.ts`): `prestoAtom:
   { status, probedAt, selected: 'presto' | 'wasm' | null, active: 'presto' | 'wasm' | null, fallbackReason?, phase? }`.
   `probePresto(store, endpoint, force?)` runs `PrestoClient.checkStatus({ forceRefresh })` from
   `@alejoamiras/presto-core`, non-blocking, when the preflight passes (signed out included; boot and sign-in never
   wait for it), again with `forceRefresh` on Start and on the fix-it row's Retry. `selected` and `active` come from
   the Worker's `ready` and `prover` messages: the Worker is the one source for "native", the probe the one source
   for the banner. An `available` status whose `schemes` lacks `ultra_honk` (or predates `schemes`) is not eligible
   and maps to the update row, not to silence — the SDK would only say `scheme-unsupported` at prove time. `phase` carries the backend's `downloading` so the row can say Presto is fetching bb. The
   endpoint for production is the SDK's defaults with `httpsOnly: true`; under `YACANA_SITE_MODE=e2e` it is
   `VITE_PRESTO_E2E_PORT` (a `SiteConfig` field: empty in production by the same rule that drops every e2e override,
   asserted by the production guard) with `httpsOnly: false` and `httpsPort` set to the same closed port; the e2e
   page also honours `?presto=off|<port>` under the existing query-override switch.
5. **The billboard and the fix-it row** (`features/PrestoBanner.tsx`, new): the mount decision is
   `stateFromStatus(status) === 'offline'` (the banners' own mapping, which folds the HTTPS-only "nothing answered"
   case in); then a React wrapper mounts `<presto-banner variant="billboard" fonts="none" theme=<ours>
   href="https://presto.build">` under the header on the Mine route, importing `@alejoamiras/presto-banners/register`
   only then and setting `.status` after `customElements.whenDefined`; its events are requests to re-probe, never
   authority over the endpoint or the backend; dismissal is the component's own (seven days). The billboard has no
   Retry of its own: Start re-probes. The billboard renders only `offline` and `available`, so the states Presto's
   ribbon would carry get the miner's own row in the design system (the `NodeBanner` shape): `permission-blocked`
   ("Your browser blocked local access — allow local network access for this site, then retry"),
   `secure-connection-unavailable` with a diagnosis other than `unconfirmed` (only reachable where plaintext health
   is admitted: "Presto is installed, but its encrypted connection isn't on — Presto → Settings → Encrypted
   Connection"), `version-mismatch` ("Presto needs an update for this app" — only an app too old to serve the UltraHonk route or a
   revoked version; a bb version difference is never a mismatch, Presto downloads the version it needs), `error`, and the Worker's sticky reasons:
   `denied` ("Approve yacana.network in the Presto app, then retry — proving in the browser meanwhile"), `cooldown`,
   three `transient`s, `invalid-proof` ("Presto returned a proof that did not verify — proving in the browser"), plus
   the `downloading` phase as an info row ("Presto is fetching bb for Aztec 5.2.0… the first proof takes longer").
   Each has Retry (a forced re-probe, then `reconfigure` with the endpoint when it answers). `available` shows
   nothing here: the pill says it.
6. **The indicator**: `✦ presto` beside the status pill while `active === 'presto'` (a suffix, not a `Status`);
   `RateLine` and the pop-out's numbers gain `· native`; the Performance tile gains `prover · Presto ✦ native` with
   the power slider disabled (a new `disabled` prop on `PowerSlider`) and captioned "Presto's speed setting in its app
   decides the threads; this slider applies when proving in the browser" (or `bb.js WASM · N threads` and the live
   slider). Plan B on the canvas explores Presto's own brand for all of this (an indigo `presto✦` chip beside the
   pill, `presto` in the rate line, a small Presto panel in place of the greyed slider, Presto's ribbon for the
   fix-it states); the owner picks A or B at approval.
7. **The e2e and CI**: `scripts/run/install-presto-server.sh` (P1) downloads the pinned
   `presto-server-1.1.1-linux-x86_64` release and verifies it against a SHA-256 **committed in the script**, installs
   under `~/.local/bin` (the homelab) or the runner's PATH (the `setup-presto` composite action, P3). The miner's
   `e2e/run-setup.ts` claims a `presto` lane port, spawns `presto-server --port <p>` detached (default origin gating:
   the page's `http://localhost:<port>` origin is auto-approved, so no `--allow-all`) with `PRESTO_HOME` under
   `e2e/.presto-home/<runId>`, `BB_BINARY_PATH` at the aztec toolchain's `bb` **and `AZTEC_BB_VERSION=5.2.0`**
   (without it the server reports `unknown`, the SDK sets `needsDownload`, and the server downloads bb from GitHub
   before the first proof even though it would then execute the override), records `prestoPid`/`prestoUrl` in
   `.run.json`, and tears it down with SIGTERM to the group, a wait of up to 8 s (longer than the 5 s Presto gives its `bb`
   child to confirm exit), then SIGKILL (Presto's SIGTERM handler is what kills its `bb` child, which runs in its own
   process group). The e2e build gets `VITE_PRESTO_E2E_PORT`;
   `presto.e2e.ts` proves through it; the existing WASM regressions (the power-change test fills the slider) open
   the page with `?presto=off`. The dispatchable `e2e.yml` gains the action and the env in the miner job.

### Key interfaces

```ts
// packages/web-miner/src/presto.ts
export interface PrestoEndpoint { host: string; port: number; httpsPort: number; httpsOnly: boolean } // = PrestoConfig
export const acceleratorUrls: (e: PrestoEndpoint) => string[];          // the exact URLs the guard admits
export interface PrestoState { status: PrestoStatus | null; probedAt: number | null; selected: 'presto' | 'wasm' | null; active: 'presto' | 'wasm' | null; fallbackReason?: FallbackReason | 'invalid-proof'; phase?: PrestoPhase }
export const prestoAtom: Atom<PrestoState>;
export function probePresto(store, endpoint: PrestoEndpoint, force?: boolean): Promise<PrestoStatus>;
export const noticeFor: (s: PrestoState) => { tone: 'warn' | 'info'; text: string; retry: boolean } | null; // pure
// packages/web-miner/src/controller.ts
reconfigure(threads: number, presto: PrestoEndpoint | null, opts?: { force?: boolean }): void; // force: Retry
// packages/site/src/browser/node-guard.ts
export const setAcceleratorEndpoints: (urls: string[] | null, deadlineMs: number) => void; // throws on a node collision
// packages/web-miner/src/worker-protocol.ts
type ToWorker = … | { type: 'init'; threads: number; presto: PrestoEndpoint | null }
                | { type: 'reconfigure'; threads: number; presto: PrestoEndpoint | null };
type FromWorker = … | { type: 'ready'; threads: number; initMs: number; prover: 'presto' | 'wasm' }   // selected
                    | { type: 'prover'; kind: 'presto' | 'wasm'; sticky: boolean; reason?: string }        // what proves now
                    | { type: 'presto-phase'; phase: PrestoPhase }
                    | { type: 'winner'; …; prover: 'presto' | 'wasm' };                                     // provenance
// packages/web-miner/src/presto-prover.ts
export class PrestoWorkProver implements WorkProver {
  constructor(artifact: WorkArtifact, api: () => Promise<Barretenberg>, endpoint: PrestoEndpoint,
              on: { prover: (kind: 'presto' | 'wasm', o: { sticky: boolean; reason?: string }) => void; phase?: (p: PrestoPhase) => void });
  readonly active: 'presto' | 'wasm';
  verifyWin(inputs: WorkInputs, result: WorkResult): Promise<boolean>;   // local public inputs, non-ZK target
  forceLocal(reason: string): void;                                       // sticky, posts the reason once
}
// packages/work-circuit/src/generated/vk.ts
export const W_VK_BYTES: Uint8Array; // W_VK's 115 fields concatenated = bb's binary VK (asserted against the fixture)
// packages/ui/src/components/power-slider.tsx
export function PowerSlider(props: { …; disabled?: boolean });
```

### Data & control flow

Preflight passes → `bootAtom` `signedOut` → `probePresto()` (page, non-blocking) → `prestoAtom.status` → the Mine
route mounts the billboard (`stateFromStatus` = offline) or the fix-it row (the other unavailable reasons) or
nothing (available). Sign in → `startSession` → the controller posts `init { threads, presto }` where `presto` is the
endpoint when `status.available && schemes ∋ 'ultra_honk'` (a pending download does not disqualify: the SDK proves
through it and Presto fetches bb 5.2.0 once, digest-verified, while the row says so), else null → the Worker admits
the URLs in its realm, builds the prover, answers `ready { prover }` → `selected`. A proof: `Noir.execute` (WASM
ACVM, cheap) → `generateProof` → `POST /prove/ultra-honk` → proof bytes → the 410-field check → the ticket digest as
today; the first decoded native proof → `prover { kind: 'presto', sticky: false }` → `active` → the ✦, `· native`, the
tile. A win → the winning `attempt` held back → `verifyWin` → `keepGoing` re-checked → `attempt { win: true }` +
`winner { prover: 'presto' }`. A `PrestoUnavailableError` → the prover's own swap on the same
witness → (when sticky) `prover { kind: 'wasm', reason }` → the ✦ drops, the row names the reason with Retry (a forced
re-probe; a good answer sends `reconfigure { threads, presto }`, the serialised rebuild, the job resuming at its next
nonce). Start always re-probes with `forceRefresh`.

### File-level change map

- `packages/site/src/browser/node-guard.ts` (+ test): the accelerator class. `packages/site/src/config.ts` (+ test):
  `prestoE2ePort` and its production assertion; `viteDefine` gains `VITE_PRESTO_E2E_PORT`.
- `packages/web-miner/src/presto.ts` (+ `tests/presto.bun.test.ts`): the endpoint, the URL set, the atom, the probe,
  `noticeFor`.
- `packages/web-miner/src/presto-prover.ts` (+ `tests/presto-prover.bun.test.ts`): the prover; the live suite
  `tests/presto-live.bun.test.ts` under `describe.skipIf(!process.env.PRESTO_URL)`.
- `packages/web-miner/src/prover.worker.ts`, `worker-protocol.ts`, `prover-loop.ts` (the config threaded through
  `init`/`reconfigure`, nothing else), `controller.ts` (`init`/`reconfigure` with the endpoint; the `ready` and
  `prover` messages into `prestoAtom`).
- `packages/web-miner/src/boot.ts` (the probe at the preflight's pass), `session.ts` / `controller.ts` (the re-probe
  on Start; Retry → `reconfigure`), `config.ts` (the endpoint per mode, the `?presto=` override).
- `packages/web-miner/src/features/PrestoBanner.tsx` (+ `presto-banner.vitest.tsx`), `App.tsx` (mount on Mine; the
  pill suffix), `features/LoopTile.tsx` (`RateLine`, `PipView`), `routes/Settings.tsx` (the Performance tile).
- `packages/ui/src/components/power-slider.tsx` (+ its Vitest): `disabled`.
- `packages/work-circuit/src/generated/vk.ts` (emitted by the existing `scripts/export-vk.ts` beside `W_VK`) and a
  test that the bytes equal the committed binary VK fixture.
- `packages/web-miner/e2e/run-setup.ts`, `run-teardown.ts`, `run.ts` (`prestoPid`, `prestoUrl`), `e2e/presto.e2e.ts`,
  the `?presto=off` on the WASM regressions; `scripts/run/install-presto-server.sh`;
  `.github/actions/setup-presto/action.yml`; `.github/workflows/e2e.yml`.
- `packages/web-miner/package.json` (`@alejoamiras/presto-core` 1.0.1, `@alejoamiras/presto-noir` 1.0.1,
  `@alejoamiras/presto-banners` 1.0.0, exact), `bunfig.toml` (the min-age exception, if approved), `bun.lock`.
- `docs/threat-model.md`, `CLAUDE.md`, `packages/web-miner/README.md`, `implementations-plan/index.md`.

### Non-obvious mechanics

- **One proof in flight.** Presto runs one `bb` at a time behind a single prover permit and sets its thread count
  from the app's Speed setting (Low … Full; `core/src/config.rs:8-35`, `server/prove.rs:112-120`); the Worker keeps
  one request out, so the page's `threads` mean nothing while native (the slider is disabled and the caption points
  at Presto's setting) and the loop's rate is the native rate. This Worker contributes one request to the per-origin cap (4 → `429 origin_queue_full`); other tabs share
  the origin's cap, which is why a `429` is a `transient` and not a sticky reason.
- **Two clients, two facts.** The page's `PrestoClient` (the probe, 10 s cache) and the Worker's backend (its own
  client) do not share state by design: the banner follows the probe, "native" follows the Worker's messages.
- **The version handshake.** Presto never runs `bb --version` (so the toolchain's `5.2.0-nightly.20260807` string is
  irrelevant): `/health` reports the version the app was built with (`AZTEC_VERSION` at build time; the headless
  binary's `AZTEC_BB_VERSION` env, else `unknown`) plus the cached ones, and the SDK sets `needsDownload` when
  `5.2.0` is not among them. A request for the reported version resolves to `find_bb(None)`, where `BB_BINARY_PATH`
  wins; any other version must come from the digest-verified cache and is downloaded first. Today's app bundles
  5.2.0; when Presto moves ahead of yacana's pin, the first native proof costs one download and the row says so.
- **The VK bytes.** `export-vk.ts` already reads bb's binary VK (115 × 32 bytes) and slices it into `W_VK`; the
  concatenation of those fields is the binary VK, byte for byte (checked against the committed fixture). `W_VK_BYTES`
  is that concatenation emitted beside `W_VK`, handed to the SDK as `Uint8Array`. Presto uses supplied bytes as `-k`
  and computes the key when omitted; a wrong key would spoil proofs, never select a circuit.
- **What the winning check does and does not buy.** One WASM `verifyProof` per native win, against the job's own
  public inputs, keeps an invalid proof off the claim path. It initialises bb.js in the Worker on the first win and
  recomputes the VK each time (bb.js's behaviour); P1 measures it. It does not validate losses: a lying accelerator
  can return well-formed losing garbage forever, withhold, or stall — visible only as a dead rate.
- **HTTP is an e2e device.** The headless server has no HTTPS; production's CSP admits `https:` only and the SDK's
  browser default is `httpsOnly`. Under `YACANA_SITE_MODE=e2e` the page passes `httpsOnly: false` and the e2e port;
  the production build drops the field by the same `env = {}` rule as every other override, and a config test resolves
  the production config under hostile e2e env and asserts the endpoint is the HTTPS default.
- **The realm.** The guard is installed per context; the page admits the URLs at boot, the Worker from the `init`
  message, both before the SDK's first probe.
- **The prompt before the gesture.** Chrome's Local Network Access permission is asked on the first loopback fetch;
  with the probe at cockpit-ready, a signed-out visitor may see it before touching anything. The owner chose the
  timing; the probe never blocks boot or sign-in, an undecided or denied permission is one probe outcome
  (`permission-blocked` shows the row), and P2 checks both in a real browser.

### Trade-offs & alternatives not taken

- *Presto's ribbon for everything* — carries all states in one surface, but the owner chose the billboard's pitch;
  the fix-it states are the miner's row in its own tokens (the copy borrowed from Presto's strings), so the page keeps
  one voice for errors. If the owner prefers the ribbon for the fix-it states, phase 2 swaps the row for it (Ask 1).
- *A second health store beside the node's* — rejected: Presto's state is not chain freshness and only the miner has
  it; an atom is the miner's shape for state.
- *`fallback: 'wasm'` inside the backend* — rejected: the SDK's own fallback is not silent (it emits the `fallback`
  phase, and `denied` / `version-mismatch` before it) but it does not expose every reason, and it retries native on
  every proof; `fallback: 'none'` plus the prover's own swap keeps the precise reason and a sticky, explainable
  choice.
- *A second prover class swapped in by the Worker* — rejected after the audit: `mineEpoch` holds its prover for the
  whole nonce loop, so a swap outside it would either miss the running job or repeat nonces; the backend's own
  `setForceLocal` does the same work inside one object.
- *Candidate leases for the health probes* — considered (recon's "leases never report" is true and fits discovery);
  not taken: the URLs are permanent for the session and a lease's release semantics do not fit; one set with no
  listeners is smaller.
- *Probing in the Worker only* — rejected: the banner has to render before any account is open.
- *Verifying every proof* — rejected as cost; verifying the winning one is the insurance that matters at the claim.

## Phases

**P1 ✓ (2026-09-09) · The prover through Presto** — gate passed: lint · lint:shell · typecheck · bun 213 pass / 0 fail
(the fake-Presto suite 6 pass, seven real WASM proofs) · Vitest 63 pass · live on the homelab against `presto-server`
1.1.1: native 1854 ms vs WASM 9153 ms × 11 threads, byte-identical to WASM and to bb's fixture, `verifyWin` true and
false on a corrupted copy, first verify 2687 ms, no download, clean teardown (`lessons/phase-1.md`).
Scope — `W_VK_BYTES` beside `W_VK` and the fixture-equality test; the guard's accelerator
class; `PrestoWorkProver` with the swap, the callbacks and `verifyWin`; the Worker's `init`/`reconfigure` with the
endpoint, `ready.prover`, the `prover` message, the re-checked `keepGoing` after verification; the dependencies pinned
exact (and the `bunfig` exception if approved); `scripts/run/install-presto-server.sh` with the pinned version and
digest.
Gate: `bun run lint` · `bun run lint:shell` · `bun run typecheck` and the packages' `typecheck` · `bun test
packages/site packages/miner-core packages/web-miner packages/work-circuit` (new: `node-guard.test.ts` — the
admitted set passes with the deadline and `redirect: 'error'` and is not reported nor quiet-counted, another local
port is still blocked, a node URL inside the set is refused; `presto-prover.bun.test.ts` with a fake Presto
`Bun.serve` — the request body's shape (`bytecode` verbatim, `witness` base64, `verifier_target`, `vk`), a `403`
sticks and posts the reason once, a `429` proves that nonce locally and tries native on the next, three in a row
stick, a malformed body sticks, the win is verified against the local public inputs and `keepGoing` is re-checked, no `attempt { win: true }`
is posted before the verification passes, an invalid win posts `win: false`, flips to `invalid-proof` and re-proves
the nonce; a transient after a native success posts `wasm, sticky: false` and the next native success `presto`
again, the counter resetting on it; `vk.test.ts` — `W_VK_BYTES` equals the committed
binary VK) · `bun run --cwd packages/web-miner test:components` (the loop's Vitest specs still green with the config
threaded through; the coalescing spec extended to assert the endpoint as well as the threads; a forced same-config
Retry rebuilds; a Retry probe resolving after Stop starts nothing) · **live on the homelab**: `presto-server` from the installer, started with `--port <p>`,
`PRESTO_HOME` under the scratch dir, `BB_BINARY_PATH` at the toolchain's `bb` and `AZTEC_BB_VERSION=5.2.0`; then
`PRESTO_URL=http://127.0.0.1:<p> bun test packages/web-miner/tests/presto-live.bun.test.ts` — one W proof through
Presto whose bytes equal the WASM proof of the same witness, `verifyWin` true on it and false on a byte-flipped copy,
the first-win verification latency printed; `PRESTO_HOME/versions` still empty afterwards. Layers: lint/typecheck ·
unit · component · live.

**P2 ✓ (2026-09-09) · The probe, the billboard, the fix-it row, the indicator** — gate passed: lint · typecheck ·
Vitest web-miner 68 pass, ui 47 pass · bun 219 pass / 0 fail · the LNA check on Chromium 151 with the SDK's probe
from the LAN address to loopback, three permission states, screenshots in `lessons/lna/` (a denied state cannot be
produced headless; recorded in `lessons/phase-2.md`) · the renders move to P3 with the running page.
Prerequisite met: the UI approved on the design canvas (Plan A). `probePresto()` at the preflight's pass, on Start and on Retry; `PrestoBanner` (mount by
`stateFromStatus`, dynamic import of `@alejoamiras/presto-banners/register`, `fonts="none"`, our theme, `.status`
after `whenDefined`, events as re-probe requests); `noticeFor` and the row; Retry → `reconfigure` with the endpoint;
the pill suffix, `RateLine` / `PipView` `· native`, the Performance tile's line and `PowerSlider`'s `disabled`; the
`SiteConfig` field and the `?presto=` override.
Gate: lint · typecheck · Vitest `packages/web-miner` + `packages/ui` (the billboard mounts only when
`stateFromStatus` is offline and nothing is imported otherwise; each fix-it state renders its copy and Retry
re-probes with `forceRefresh`; the suffix and `· native` follow `active` and vanish on the `wasm` message; the
tile's two states; the slider disabled) · `bun test packages/web-miner packages/site` (`presto.bun.test.ts`:
`noticeFor` per status and diagnosis, an `available` without `ultra_honk` → the update row, the `presto-phase`
message → the info row, the endpoint per mode and override, the URL set; the atom cleared on `ready` and dispose; `config.test.ts`: a
production build with hostile e2e env keeps the HTTPS default and an empty port) · a real-browser check on the
homelab's Chromium of the LNA permission states with the SDK's probe, with screenshots in `lessons/phase-2.md`
(the renders of each canvas state need the running page and move to P3's gate). Layers: lint/typecheck · unit ·
component · manual browser.

**P3 · The e2e and CI** — the `setup-presto` action (download, the committed digest, PATH), the run-setup's `presto`
lane (registry port, per-run `PRESTO_HOME`, `BB_BINARY_PATH`, `AZTEC_BB_VERSION`, default gating, TERM → wait → KILL),
`presto.e2e.ts` (through Presto: sign in with words, Start, the pill reads `✦ presto`, a claim lands **whose winner
carries `prover: 'presto'`** (the win line exposes it), and independently a `200` on `/prove/ultra-honk` — from the
page's request log if Playwright reports the Worker's requests, else from the headless server's own log under
`PRESTO_HOME`; with `?presto=<closed port>`: the billboard and WASM mining with no suffix), the WASM regressions on `?presto=off`,
`e2e.yml`'s miner job wired.
Gate: `bun run lint:shell` · `bun run lint:actions` · `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`
on the homelab with `presto-server` on PATH (the whole miner suite, `presto.e2e.ts` included, exit 0; the run's
`PRESTO_HOME/versions` stays empty, proving the override was used and nothing was downloaded; teardown leaves no
`presto-server` or `bb` of the run behind) · the 1280/1440 renders of each canvas state (billboard, native, the row)
taken from that run, beside their artboards · `gh workflow run e2e.yml --ref worktree-presto-mine` → the `web-miner`
job green, the run's head SHA recorded in `lessons/phase-3.md`. Layers: e2e (isolated network, headless Presto) · CI.

**P4 ✓ (2026-09-09) · Docs and close** — gate passed: lint exit 0 · `bun test` 282 pass / 0 fail (292 tests, 60
files) · `bun install --frozen-lockfile` clean (`lessons/phase-4.md`).
Scope — `docs/threat-model.md` (the accelerator row: what it sees, what it cannot, the residuals,
the guard's class, https only in production, the banner as constrained third-party code), `CLAUDE.md`'s package table,
`packages/web-miner/README.md` step 5, `implementations-plan/index.md`.
Gate: lint · `bun test` · `bun install --frozen-lockfile` clean (the min-age policy as decided). Layers: lint · unit.

## Validation layers

lint/typecheck (Biome, `tsc`, shellcheck, actionlint) · unit (`bun:test`; a fake Presto over `Bun.serve`) · component
(Vitest + RTL) · live (`describe.skipIf(!PRESTO_URL)` against the real headless server) · manual browser (the LNA
prompt) · render (1280/1440 beside the artboards) · e2e (Playwright on the isolated network with the real headless
server, locally and in the dispatchable CI job).

## Security & Adversarial Considerations

- **Threat model.** The new trust boundary is a local process on the visitor's machine that receives, per proof,
  the circuit's bytecode and the compressed witness of W (whose inputs are `domain`, `seed`, `epoch`, `miner_commit`,
  `nonce`), and returns a proof. The account's secret and the recipient are not inputs of W (`miner_commit` is), and
  the prover only ever receives `WorkInputs`, never the job; the commitment and the proof timing do let the process
  correlate all work of one job. Binding a loopback port is a weaker capability than controlling the browser, so the
  process is treated as untrusted: proof bytes are shape-checked, the winning proof is verified against the job's own
  public inputs before it reaches the claim, and every unavailable or invalid answer degrades to WASM with the reason
  shown. Residuals: a lying accelerator can return losing garbage indefinitely, withhold good proofs or stall — a
  denial of yield indistinguishable from bad luck except by the rate; the health schema proves protocol shape, not
  process identity.
- **The guard.** The accelerator is admitted by a fixed set of exact URLs derived from one endpoint config, with
  the same deadline and no-redirect rule as the node, reported to nobody; it cannot pose as the node (`setNodeEndpoint`
  refuses a collision, `currentNodeEndpoint()` is unchanged) nor open a cooldown on it. Production admits `https:`
  only, so a plaintext local endpoint is unreachable from the shipped page; the SDK's `httpsOnly` default agrees; a
  config test resolves the production config under hostile e2e env and finds the e2e port dropped from both the
  resolved config and the Vite definitions the two realms are built with.
- **Origin approval and permissions.** Presto approves origins per install (a popup; `yacana.network` is not
  pre-approved and cannot be); a denial is a `403` the page shows as "approve in the Presto app", never a retry storm
  (sticky until Retry or Start). The browser's local-network permission is the visitor's; the page shows the blocked
  state and a Retry, and never probes before the cockpit is ready.
- **Supply chain.** `@alejoamiras/presto-core` 1.0.1, `@alejoamiras/presto-noir` 1.0.1 and `@alejoamiras/presto-banners`
  1.0.0 are pinned exact and are hours to a day old: `bunfig.toml`'s 7-day `minimumReleaseAge` blocks them until
  2026-09-15/16 unless `minimumReleaseAgeExcludes` names them (Ask 2). The exception is name-wide and lasting (every
  future version of those names, every workspace install), so it names exactly those packages, carries the reason in
  the file, and the owner decides whether it stays or is removed once the pins are older than a week; common
  ownership is not evidence that an npm compromise implies a deploy compromise. The `presto-server` binary in CI and
  on the homelab is one pinned release whose SHA-256 is committed in the installer (a sidecar checksum from the same
  release only guards corruption); CI keeps `contents: read` and gives the binary no credentials. The page downloads
  nothing at runtime; the banners' Google Fonts link is off (`fonts="none"`); Presto's own `bb` download is Presto's,
  digest-verified, and not on the page's path.
- **The banner.** A third-party custom element executing in the page. Its rendering is constrained (the `href` is
  protocol-checked and escaped, links carry `noopener`, `innerHTML` is fed from its own templates); it is mounted
  only in the offline state, given a fixed HTTPS `href`, its properties set after registration, and its events are
  treated as requests to re-probe, never as authority over the endpoint or the backend. The threat-model row says
  "constrained templates", not "no HTML injection".
- **Licence.** Every Presto package is AGPL-3.0-only (the banners' npm record says so too); bundling the SDK and the
  banners into the shipped page conveys them. The owner authors both sides (Ask 3): a licence exception or a
  permissive dual licence on the SDK packages, or AGPL accepted for the page.
- **Input validation.** The SDK validates `/health` against its contract and decodes the route's body structurally;
  the miner checks W's exact proof shape before the digest; the winning proof is verified. The banner's `status` is
  set from the SDK's typed union, never from a string of ours.

## Assumptions

**Facts** (verified 2026-09-09; the audit re-checked each against the source)
1. `@alejoamiras/presto-noir` 1.0.1 exports `PrestoUltraHonkBackend(acirBytecode, api, { bbVersion, presto,
   verificationKey: { bytes: Uint8Array, verifierTarget }, fallback, onPhase })`, degrades to WASM unless
   `fallback: 'none'` (then `PrestoUnavailableError { reason, phase }`), exposes `setForceLocal`, `verifyProof`
   (WASM), posts `/prove/ultra-honk` `{ bytecode, witness, verifier_target, vk }`, peer-depends on `@aztec/bb.js`
   5.2.0 exactly (`sdk-noir/src/lib/presto-ultra-honk-backend.ts:34-58,101-260`).
2. `@alejoamiras/presto-core` 1.0.1 (on npm) exports `PrestoClient` with `checkStatus({ forceRefresh })` (single-
   flight, 10 s TTL) and `PrestoConfig { host, port 59833, httpsPort 59834, httpsOnly (true in pages and Workers),
   allowInsecureDowngrade }`; the status union and phases as in recon §3 (`sdk-core/src/index.ts`,
   `lib/presto-client.ts:117-135`, `lib/types.ts:31-60`).
3. The SDK probes `https://host:httpsPort/health` (and `http://host:port/health` when not https-only), never
   follows redirects, and in https-only mode runs one witness-free HTTP `/health` diagnosis after an HTTPS failure;
   `429/503/408/413` and recognised `500`s are an immediate `fallback('transient')`, `403` is `denied` /
   `cooldown` / `version-mismatch`, `404` `route-missing` (`presto-transport.ts:741-812`, `presto-client.ts:520-556`).
4. The headless `presto-server` 1.1.1 (asset `presto-server-1.1.1-linux-x86_64.tar.gz`, SHA-256 `48f524b1…`)
   takes `--port`, `--allow-all` / `ALLOWED_ORIGINS`, `PRESTO_HOME`, `BB_BINARY_PATH`, `AZTEC_BB_VERSION`; serves HTTP
   only; auto-approves `localhost` / `127.0.0.1` / `[::1]` origins under default gating; its SIGTERM handler kills the
   `bb` child (own process group) before exiting; started and stopped cleanly on the homelab (`server/src/main.rs:56-154`;
   `core/src/authorization.rs:568-596`).
5. Presto's version policy: `/health` lists `aztec_version` (the build's `AZTEC_VERSION`, or the headless binary's
   `AZTEC_BB_VERSION` env, else `unknown`) and `available_versions`; the SDK sets `needsDownload =
   !available_versions.includes('5.2.0')` and still proves, emitting the `downloading` phase; the server resolves a
   request for the reported version to `find_bb(None)`, where `BB_BINARY_PATH` is step 0, and downloads any other
   (`core/src/server.rs:455-482`, `server/src/prove.rs:53-93,514-531`, `core/src/bb.rs:47-54`,
   `presto-client.ts:247-267,347-351`). Presto's own CI sets `AZTEC_BB_VERSION` from `src-tauri/AZTEC_VERSION` beside
   `BB_BINARY_PATH` (`_ts-package-ci.yml:228`). The released app bundles the SDK's Aztec version, 5.2.0 today.
6. The production CSP is `connect-src 'self' data: https:`; the e2e and dev modes add `http://127.0.0.1:*` and
   `http://localhost:*` (`packages/site/src/headers.ts:10,19`). Production `SiteConfig` drops every env override
   (`env = {}`) and `viteDefine` is an enumerated list (`config.ts:89-90,178-199`).
7. The guard keys on origin + path + query and dispatches node → candidate lease → page origin → block; leases never
   report; the health store filters on `currentNodeEndpoint()` (`node-guard.ts:41-44,223-235`, `node-health.ts:144`).
8. `@alejoamiras/presto-banners` 1.0.0 is on npm (2026-09-09 14:55 UTC, AGPL-3.0-only, exports `.` and `./register`).
   The billboard renders `offline` and `available` only and has a CTA and a close button, no Retry;
   `stateFromStatus` maps `secure-connection-unavailable` + `unconfirmed` to `offline`; `fonts="none"` removes the
   package's only network request; the `href` is protocol-checked and escaped (`banners/src/strings.ts:132`,
   `render.ts:79-85`, `status.ts:21-27`, `fonts.ts:11-18`, `element.ts`).
9. The Worker's `init` is `{ threads }` and `ready` is `{ threads, initMs }`; `mineEpoch` holds its `WorkProver` for
   the whole nonce loop and calls `onAttempt` before returning a winner; the loop's `reconfigure` is the serialised
   `destroy` → `init` rebuild; the scheduler tests are Vitest (`worker-protocol.ts`, `miner.ts:35-55`,
   `prover-loop.ts:43-57`, `prover-loop.test.ts:1`). W's public inputs are `[domain, seed, epoch, miner_commit, nonce,
   out]` in that order (`yacana_work/src/main.nr:1-8`).
10. `export-vk.ts` reads bb's binary VK, requires 115 × 32 bytes and slices it into `W_VK`; the fields' concatenation
    equals the committed fixture byte for byte (`packages/work-circuit/scripts/export-vk.ts:12-23`; compared by the
    audit).
11. `.github/actions/setup-aztec` installs `~/.aztec/versions/5.2.0/bin/aztec-bb` (→ `bb 5.2.0-nightly.20260807`, the
    same SHA-256 as bb.js's native binary per `toolchain.lock.json`); `.github/workflows/e2e.yml` is
    `workflow_dispatch` only, one job per app, `contents: read`. The e2e page's origin is `http://localhost:<port>`
    (`run-setup.ts`); teardown SIGKILLs the owned groups (`run-teardown.ts:9-16`).
12. `bunfig.toml` sets `minimumReleaseAge = 604800`; `minimumReleaseAgeExcludes` is package-name-wide
    (`bun-types/docs/runtime/bunfig.mdx:757-766`); the repo has no exception today. `PowerSlider` has no `disabled`
    prop (`power-slider.tsx:29-42`).

**Inferences** (to be verified in the phase that touches them)
- Playwright's page request log sees the dedicated Worker's `fetch` to `/prove/ultra-honk` (Chromium reports
  dedicated-worker requests on the page); if not, P3 reads the `200` from the headless server's log under
  `PRESTO_HOME` — the HTTP evidence stays independent of the Worker's own messages.
- The first-win WASM verification in the Worker costs seconds (bb.js init + CRS + VK recomputation), acceptable at
  the win rate; P1 measures it.
- Presto's billboard in its own indigo reads as a third-party badge inside the cockpit, as the "TESTNET" badge does —
  the canvas render decides.
- An LNA permission left undecided is reported by the SDK as a probe failure (offline), not as `permission-blocked`
  (only an explicit denial is conclusive); P2's browser check settles the copy for that case.

**Decisions** (owner, 2026-09-09; O1 and the A/B pick still open)
1. **The fix-it surface — Plan A** (owner, 2026-09-09: "let's first go with the native one, with Plan A"). The
   miner's own amber row in the design system with Presto's wording (canvas artboards 3–4), and the indicator in the
   miner's tokens (the ✦ suffix, `· native`, the greyed slider). Plan B (Presto's indigo chip, its panel, its ribbon;
   canvas B1–B5) stays on the canvas as the future switch; nothing in the code should make that switch hard (the
   indicator and the row are each one component).
2. **The 7-day rule — exception.** `minimumReleaseAgeExcludes = ["@alejoamiras/presto-core",
   "@alejoamiras/presto-noir", "@alejoamiras/presto-banners"]` in `bunfig.toml`, with the reason beside it; it stays
   (every Presto bump would need it again).
3. **Licence — no problem for the owner.** AGPL accepted for the page as things stand. Recommendation for the Presto
   repo (a follow-up there, not this plan): relicense the three npm packages MIT (or Apache-2.0) so no consumer dApp
   inherits the question; the desktop app can stay AGPL.
4. **The power slider while native — disabled with the reason** (Plan A; Plan B's panel is the future alternative).
   Correction from the owner: Presto's thread count is configurable in its app (the Speed setting), so the caption
   points there rather than saying "one at a time".
5. **Where the billboard shows — the Mine route only.**
6. **Plaintext health in production's CSP — no.** An installed Presto with HTTPS off shows the billboard.

## Delivery

Single arc: branch `worktree-presto-mine` off `origin/main` `07f4d45`, one PR via `gh pr create` opened only at the
Delivery step below, `code_review: off`. Before the push: `git rebase origin/main` if trunk moved → the fast gates →
push → after the codex loop converged, `gh pr create` with the gates, the codex rounds and the 1280/1440 renders of
the cockpit with the billboard, the fix-it row and the `✦ presto` pill beside the approved canvas artboards;
`gh pr checks --watch`. The owner merges and deploys; the agent never does.

## Post-implementation

Executed by the implementing session from this section alone.

1. **`/code-review`: not run.** `code_review` is `off`; do not add it.
2. **After the last phase is green**: send codex (`/codex high`, GPT-6 Astra; resume session
   `01a0869d-fa12-7a21-824a-6365b8b33699` for its context, or a fresh one with `audit-codex.md` attached) the net diff
   (`git diff 07f4d45..HEAD`), this plan (its Architecture, Security and Assumptions), the adversarial / security ask
   ("What could go wrong? What would an attacker target? What are we trusting that we shouldn't? Where are the
   supply-chain / crypto / least-privilege weaknesses?"), the 1280/1440 renders of the three cockpit states beside
   the approved artboards (mirror the skill script's `codex exec` call with `-i <png>`), and the two rules below
   verbatim.
3. **Iterative fix loop**: verify codex's factual claims against the repo; apply the accepted fixes; commit; log the
   round (consult + verdict) in `lessons/phase-N.md`; **resume the same codex session** with the fix diff and ask for
   a re-review under the same rules. Repeat until a round yields no new material findings; rejected nitpicks are not
   churn. Still material after 3 rounds → stop and surface to the owner.
4. **Delivery** per the section above: the first and only time a PR is opened. Then `implementations-plan/index.md`
   gets the completed marker and the manifest row `done: PR #N`.

**The no-over-engineering rule** (verbatim in every codex prompt, initial and resumed): *"Report bugs and small,
targeted improvements only. Do not propose speculative abstractions, extra configuration surface, new layers, or
rewrites — the smallest change that fixes each real problem. If code works and is clear, leave it alone."*

**The comment-quality rule** (verbatim, same treatment): *"Audit the comments for value per character. Flag any
comment that narrates what the code visibly does, restates its line, references implementation plans / phases /
reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious invariant or constraint
deserves a comment it doesn't have. Comments are permanent context every future reader, human or LLM, pays to
re-read: they must be few, dense, and exact."*

Failure-retry policy: 3 failures on one step with the owner present, 5 under `/loop` or `/goal`, then stop and
reassess with codex. Hard limits: never merge, never deploy, never widen scope beyond this plan; the production CSP
gains no plaintext origin unless Ask 6 says so; the guard admits the fixed URL set of one endpoint, never a scheme or
a host; no UI state ships that was not on the approved canvas.

## Approval

ELI5 companion: `implementations-plan/presto-mine/eli5.html`, published as the Artifact **Presto on the Mine Page**:
https://claude.ai/code/artifact/50b4e323-9cb7-46e9-ac15-92468be80076 (published 2026-09-09).

UI canvas: `implementations-plan/presto-mine/canvas/` (artboards + `canvas.json`), published as the design canvas
**Presto on the Mine Page · screens**: https://claude.ai/code/artifact/17ef5779-8b73-491d-9f26-874e1ac3aabf (published 2026-09-09; six Plan A artboards, five Plan B artboards on the rows below them). **Plan A approved
2026-09-09**; P2 builds artboards 1–6.

Codex verdicts: round 1 **rework** → folded in (32 findings); round 2 on the revised plan (resumed session)
**approve with changes** → the six edits folded in (`audit-codex.md`). The design is approved for implementation;
the post-implementation loop reviews the code.

## Seeds

Draft until approval; finalised after.

```
/goal All phases marked ✓ in implementations-plan/presto-mine/plan.md (the per-phase headers in the file — not the chat, not the task list), each ✓ backed by its phase's validation gate (as defined in plan.md) reported passing in the transcript — P1's live test against the headless server on the homelab, P2's real-browser LNA check and P3's e2e run and CI job (with its head SHA) included; for each phase the agent has printed `LESSONS_FILE=implementations-plan/presto-mine/lessons/phase-N.md` in the transcript; `/code-review` was NOT run (code_review is off); the codex fix loop over the whole diff converged, evidenced by a resumed codex pass reporting no new material findings, quoted in the transcript; the PR exists on GitHub, created only AFTER the loop converged (`gh pr view` output in the transcript), its body linking the 1280/1440 renders beside the approved canvas artboards; `bun run lint` and `bun test` both report exit 0 in the transcript.
```

```
/loop 15m Drive implementations-plan/presto-mine forward. Never idle waiting for my input. Each firing: (1) read plan.md and lessons/ (authoritative state), rebuild the task list from plan.md if empty, `git status`, `git log --oneline -5`, `gh pr view --json statusCheckRollup` if a PR exists; (2) waiting on CI is fine if it is progressing (`gh run watch` up to 10 min); use the wait to prep the next phase; (3) no task in hand → take the next pending phase; after each meaningful edit run `bun run lint` and the touched packages' tests and `typecheck`, commit, push; (4) stuck or facing a decision → `/codex high` with full context, decide, act, log the consult in lessons/phase-N.md; hard limits stay hard (never merge, deploy, push to main, or expand scope beyond plan.md; no plaintext origin in the production CSP unless Ask 6 said so; the guard admits the fixed URL set of one endpoint; no UI state that is not on the approved canvas); (5) same step failed 5 times → stop and reassess with codex; (6) phase green means its validation gate in plan.md passes: run it, paste the result, mark ✓, print `LESSONS_FILE=…`, `agent-worktree status presto-mine "phase N green: <next>"`; (7) all phases ✓ → the codex loop over the net diff with the renders and the plan's two rules until a round yields nothing material, then Delivery per plan.md (`gh pr create`, the body, `gh pr checks --watch`), then the wrap-up report; surface and stop.
```
