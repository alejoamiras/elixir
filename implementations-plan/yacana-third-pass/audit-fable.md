# Fable audit — yacana-third-pass

## Round 1 (plan + outline B), Fable 5.1 Plan agent, 2026-09-08

Prompt: the standard packet (adversarial, assumption attack, implementation critique, verdict) over plan.md, outline-b.md and recon.md; the same brief as codex round 1.

# Audit — yacana-third-pass (fable leg, round 1)

Read: plan.md, outline-b.md, recon.md, CLAUDE.md, then the listed code plus `packages/web-miner/src/{chain,session,main,App}.ts(x)`, `packages/site/src/vite-base.ts`, `packages/web-miner/e2e/{helpers,run-setup,miner.e2e,passkey.e2e,withdraw.e2e}.ts`, `packages/web-stats/{src/main.tsx,e2e/visual.e2e.ts,playwright.visual.config.ts}`, `packages/web-landing/src/sections/Money.tsx`, `docs/threat-model.md`, and the SDK in `node_modules/@aztec/{wallets,pxe,stdlib,foundation}` for how the node client is held.

## A. Adversarial / security

**A1 · High — a pasted node can durably poison the PXE's chain view; "no state is lost" (plan §Security, "The switch under an open wallet") is false.**
The PXE anchors on the node's tips (`@aztec/pxe/dest/block_synchronizer/block_synchronizer.js:41-47`, tips-only `L2BlockStream`). On a switch to a node *behind* the local tip, `areBlockHashesEqualAt` returns false above the source's tip (`@aztec/stdlib/dest/block/l2_block_stream/l2_block_stream.js:83-110, 255-290`) → `chain-pruned` → `noteStore.rollback`, `privateEventStore.rollback`, `factStore.rollback` (`block_synchronizer.js:96-128`). Honest-but-lagging: notes vanish until re-discovered above the finalized tagging index (`storage/tagging_store/recipient_tagging_store.js:6-7`). Malicious: the node hands a fake `finalized` tip; on switch-back the walk stops at `walkFloor = localTips.finalized` (`l2_block_stream.js:82, 97-107`) and the anchor never reconciles — every later simulate/send fails, across reloads, because the PXE store is per rollup (`wallet.ts:35-38`), not per node. The only remedy in the codebase is `resetAccountView` (`wallet.ts:119-135`), reachable only from the lost-race path (`controller.ts:518-537`). The reload variant (outline B item 1) has the identical exposure.
Fix: on `use(url)` under an open wallet, run the existing `recover()` (pause `'switch'` → `resetAccountView` → `readRebuilt` → release) so the view is always the current node's; the tile's copy becomes "Applies at once; the account's chain view is rebuilt from the new node; proving continues." If the owner refuses the resync cost, the Security section must state the pruning/poison behaviour and the boot-error path must offer sign-out/rebuild. Not testable by the same-node E2E (I6); say so.

**A2 · High — `connect-src https:` re-opens the CRS CDN, and the plan deletes the test that pins that.**
`pinned-crs.ts:1-3` relies on the CSP to make an unintercepted CRS fetch "fail loudly"; `headers.test.ts:37-42` asserts `not.toMatch(/crs\./)`; `docs/threat-model.md:40-41,49` states the control. The interceptor is installed only in `main.tsx:1` and `prover.worker.ts:3`; any bb.js context created elsewhere (or a future import-order slip) would now silently fetch unverified CRS from `crs.aztec-cdn.foundation` / `crs.aztec-labs.com` (`crs.lock.json:2`). Impact is proof validity (DoS), not key material, but the plan's Security section claims "no cryptography touched" and omits this.
Fix: name it in Security as the loss; keep a test that every Barretenberg-creating entry imports `./pinned-crs` first (a static `bun test` over `main.tsx`/`prover.worker.ts`); rewrite threat-model rows 40/41 (the plan's `docs/` bullet lists only "the node setting, the cache key"). Ask the owner (see B/Asks A8).

**A3 · High — the exfil argument in §Security is wrong on both channels.** `img-src 'self' data:` (`headers.ts:23`) blocks image beacons; navigation is unbounded but loud. Today a compromised dependency on this origin (the PXE keystore lives in the same IndexedDB namespace as `yacana-pxe-*`) can exfiltrate only via a visible navigation or WebRTC; after the change it can do so silently to any https host. Accept as the owner's price, but state it honestly and add `webrtc 'block'` to the same policy line while touching it (closes the one pre-existing silent channel; zero product cost).

**A4 · Medium — the fetch wrapper stacks on every switch.** `boundNodeRequests` captures `globalThis.fetch` and re-wraps (`node-deadline.ts:8,17`); `pinned-crs.ts:34,57` already sits below it. The plan re-binds `watchNodeRequests(url)` on each switch → N wrappers, each still recording its old origin into the health store (a late answer from the old node flips `ok`/`silent`). Fix: install once; hold `{ origin, deadlineMs }` in a mutable cell that `use(url)` updates; tag each recorded event with the origin it was sent to and drop it if not current.

**A5 · Medium — a 429 usually reaches the page as a network error, not a 429.** An edge rate limiter's 429 rarely carries CORS headers, so `fetch` rejects with `TypeError` — the wrapper sees `silent`, and `Retry-After` is not CORS-safelisted (needs `Access-Control-Expose-Headers`). Even when the Response is visible, a non-JSON 429 body makes the SDK throw a plain `Error(resp.statusText)` (empty over h2) and *retry three times* on the miner's default client (`foundation/dest/json-rpc/client/fetch.js:34-46`; `createAztecNodeClient` uses `makeFetch([1,2,3])`, `stdlib/dest/interfaces/aztec-node.js:371-376`), multiplying the hammering. Fix: make the wrapper the gate — while `throttled && now < retryAt`, answer node-origin requests with a synthetic `429` JSON Response (no network); the SDK turns that into `NoRetryError` and stops; this also covers the PXE's own reads, which "pollers consult `retryAt`" cannot. Write the banner's `silent` copy knowing it is the common throttled case.

**A6 · Medium — the epoch cache is keyed by miner, not by node: a lying node's rows outlive the switch.** Closed rows never re-enter the live window, so a poisoned `yacana.epochs.<miner>` mis-draws forever on an honest node. Fix: key by `<miner>.<node origin>`, or spot-check one random cached epoch against the live node per visit and drop the cache on mismatch. Also cap by a byte budget, not `TABLE_EPOCHS` (262 144 rows ≈ 15 MB > the 5 MB the plan itself cites).

**A7 · Medium — Cancel has nothing to cancel and can double-open the PXE.** `startSession` (`boot.ts:136-199`) has no abort path; its cleanup runs only on throw (`:193-197`). A Cancel during `openWallet` followed by a second sign-in opens a second PXE on the namespace — the exact case `boot.ts:194` guards against. `Session.start` also sets `master/record/words` before the await (`session.ts:88-95`). Fix: a per-attempt token checked between steps; Cancel marks it, disables the modal's primary until the in-flight step settles and the catch-cleanup ran; the cancelled run's error must not land in `signedOut.error`.

**A8 · Low — error boundary and diagnostics.** SDK errors embed `inspect(err)`/response JSON (`fetch.js:33,45`); a hostile node can make them megabytes. Cap `error.message` at ~300 chars before the shortener. The diagnostics copy (`ConnectionCard.tsx:52-58`) names the node URL; with free URLs a keyed RPC (`?key=`) leaks on paste — print host only.

**A9 · Low — fee path.** `claimGasLimits(node)` takes `txsLimits` from the node once at `openWallet` (`claim.ts:14-19`, `wallet.ts:74`); the sponsored FPC address is derived locally (`wallet.ts:68-70`). A lying node can only make claims fail or grief the sponsor's max fee; the Security section may say so in one line. Correct as claimed: nothing signs or spends.

## B. Assumption attack

**Facts**
- F1: `config.ts:82-86` is wrong — lines 76-84 are the `origins` helper; the throw is `config.ts:100-104`. `assertProductionConfig` also iterates the allowlist (`:175`) and must change.
- F5: widths are `Strip.tsx:59-61`; `load-older` is `Table.tsx:148`. Cosmetic.
- F6: correct, but §Non-obvious mechanics ("`layout()` runs after `ctx.font` is assigned") is false: `frame()` calls `layout()` at `score-loop.tsx:262` before `drawCalmLines` sets the font at `:147`. Set the font in `frame()` before measuring.
- "The SDK client is itself a `Proxy`" is false: it is a plain object of arrow functions (`safe_json_rpc_client.js:184-191`). Harmless to the design.
- Unstated fact that matters: the E2E serves a **production-header** build (`run-setup.ts:6-7, 22`; `vite-base.ts` `preview: { headers: production }`) and the isolated node is `http://127.0.0.1:<port>` (`isolated-node.ts:182`), plus the mock node `http://127.0.0.1:1` (`run-setup.ts:28,35`; `miner.e2e.ts:198-201`); the site E2E likewise (`site/e2e/run-setup.ts:25`). With `HeaderPolicy` reduced to `production | dev` and origins dropped, **every miner and site E2E fails on CSP** — P1.1 and P1.4 gates cannot pass as written, and the implementer's shortcut would be to loosen production. Fix: `mode: 'production' | 'e2e' | 'dev'` where `e2e` adds `LOCAL`; `assemble.ts:68` already refuses an e2e build in the production dir; `headers.test.ts` pins that `production` has no `http:` form.
- Every E2E page is pinned by query (`helpers.ts:27-28`), so `isPinnedByQuery()` disables the Node tile (`ConnectionCard.tsx:14,38`). The switch test must load without `node=` (the e2e build's default is the isolated node, `run-setup.ts:34`). Keep `?miner=&token=` overrides: `miner.e2e.ts:213` needs the hard deployment.

**Inferences**
- I1 holds by code reading: every SDK holder resolves methods at call time (`withRecording` binds at `get`, `benchmarked_node.js:30-45`; `withCache` closures call `source.x()` at call time, `caching_aztec_node.js:16-118`; the block stream calls `node.x()` per call, `block_stream_source.js:7-35`; `observeSends` binds at `get`, `wallet.ts:41-52` — a bind over a bound function is inert). The Proxy works. What I1 misses is A1: the *semantics* of a switch under the PXE, which the E2E on one node cannot exercise. The proxy-vs-reload question is the wrong axis; both need A1's fix.
- I3 plausible, and P1.3 covers both candidates: at `left = 28`, 10 px mono, any 4-char label (24 px) right-aligned at x = 20 starts at −4 — a clipped "10.0" reads "0.0"; at the floor "1.0" over "1" collides. Say the clip is the likelier pop-out cause.
- I4 is optimistic in the wrong direction: see A5 — the header is usually invisible and the 429 itself often is.
- I5 is likely false on the default node: the owner's report says the *current* first window (144 reads) already throttles it; twenty more pages will too, the banner then appears because of the page's own optional work, and the first-visit map stays partial anyway. Fix: pace the fill at one page per poll tick, stop (not pause) for the visit on the first throttle/silence, draw the unfilled span as a hairline (outline B's honesty), let the cache complete it over visits.
- I6 fine once the e2e CSP mode exists; Chrome's `localhost` falls back to 127.0.0.1 if the node binds v4 only.
- I7 holds with three details: `DialogContent` hard-codes an X (`dialog.tsx:40-45`) — in the opening state it must be Cancel or hidden; `onEscapeKeyDown`/`onPointerDownOutside` must `preventDefault` while opening or an overlay click cancels an account open; Radix wants a `DialogTitle` (`:51-58`) — the key screens use `h1` (`KeyScreen.tsx:66,202`). Playwright role queries ignore `aria-hidden` content, so `passkey.e2e.ts:71-72` will merely wait until 'ready' closes the dialog.
- I2 holds for the words screens (3-col grids, `WordsScreens.tsx:9,28`). It does not hold for `CreateKey`'s three-link row (`KeyScreen.tsx:113-138`) — and the canvas drops two of those links (below).

**Asks to surface**
- A4 (new): the canvas's sign-in and Welcome-back bodies omit "Use twelve words instead", "I already have a passkey" and "Create a new account"; `words.e2e.ts:16,71-72` and `withdraw.e2e.ts:25-26` click `use-words` / `create-new-key`. Keep them as `ink-3` links (deviation logged) or rewrite those specs — the owner picks.
- A5 (new): the switch under an open wallet rebuilds the chain view (A1) — accept the resync pause, or accept the documented risk.
- A6 (new): the fill's pacing/stop and the honest partial map (I5).
- A7 (new): the CRS CDN becoming reachable (A2) — accept the loss of "fails loudly".
- A2/A3 as written are fine; add for A2: the stats/landing *boot* failure on a dead saved node needs the same way out (the banner is not mounted when boot fails), i.e. the boot-error alert links to `/mine/settings/` or offers "use the build's node" (`saveConnection(default)` + reload). Same for the miner when `boot.phase === 'error'`: Use must reload, there is no session to switch under.

## C. Implementation critique

Structure is right in outline; the boundaries leak in three places and two mechanics are underspecified.

- `NodeBanner(props: { health: NodeHealth … })` in `packages/ui` makes ui import a type from `packages/site`; site already imports ui (`vite-base.ts:12`) → cycle. Define the banner's props as plain values (`kind`, `ageS`, `retryInS`, `settingsHref`) or put the `NodeHealth` type in ui.
- The health store's kinds are `ok | throttled | silent` but the banner copy lists a fourth condition ("a node whose block stopped moving"), which the fetch wrapper cannot see. Either drop "stalled" from the copy or add `noteBlock(n)` fed by the pollers. Also the Settings health row wants "block N · 3 s ago" but the miner never reads the block number (`controller.ts:339-355`) — say it comes from a `probeNode` tick on the Settings route.
- `probeNode` should build its client with `makeFetch([], false)` as stats does (`chain.ts:44`), or Check on a dead candidate takes six seconds of SDK retries.
- The public epoch poll's handover: an in-flight public read landing after the controller's first read can write an equal epoch with older `claims`; the gate tests "never regresses the epoch number" only. Drop by generation on handover.
- Money: `last:border-b-0` on the cells targets each row's last *cell*, not the last row (`Money.tsx:5,42-50`). Use `tr` `last:[&>td]:border-b-0`. The proposed Vitest (class present on cells) would pass with the wrong selector; assert on the last `tr`'s cells.
- `Progress` has no indeterminate mode (`progress.tsx:5-22`); the notes-step stripe needs a prop, not a hand-rolled div.

**plan.md vs outline-b, item by item**
1. Switchable client vs reload — take plan.md's proxy (I1 verified) **plus** A1's rebuild-on-switch; B's reload buys nothing on the real risk and costs a passkey touch.
2. Health store vs per-app 429 — take plan.md, but only in the "wrapper is the gate" form (A5, A4); then delete "the pollers consult `retryAt`" (less surface, and it covers the PXE). B's three copies would still miss the PXE's reads.
3. Two beats vs one — owner's pick; plan.md's shape is fine. Beat one lands after two round trips vs ~20 for the window; the atom split is the honest way to let tiles take `null`.
4. Background fill vs paging — take plan.md's fill with B's honesty: paced, stop-on-throttle, hairline for the unread span (I5).
5. CRS out of the gate vs behind the modal — take plan.md; B disables the primary button for the whole download, and the canvas's keys step lives in the opening modal. Note that every watcher now downloads 20 MB per visit unless `/crs/*` is cache-friendly; check `_headers`/Cloudflare caching once.

**Gates**
- Commands are real (`lint`, per-package `typecheck`, `test:components`, `test:visual` (Docker), `test:e2e` with prebuild, `e2e:agent`, `site:e2e`). `bun test <paths>` filters work.
- P1.1/P1.4/site E2E: unpassable without the e2e CSP mode (Facts). The switch test must also assert something meaningful: the tile's host changes *and* a claim lands after the switch.
- P1.3: "a manual render kept under shots/" is not a gate; jsdom has no canvas, so only the pure helpers (`labelsCollide`, the margin formula) are testable — fine, but say the pop-out itself is checked by eye only.
- P2.3: `words`/`withdraw` specs depend on the affordances the canvas removes (Asks A4).
- P3.1: "test:visual unchanged" is fragile at zero tolerance (`playwright.visual.config.ts:13`); any wrapper `min-height` for a skeleton moves pixels. Allow one regeneration in P3.1 or P3.2, not "once" by decree. The recording answers every call or aborts (`visual.e2e.ts:26-47`); the staged read issues the same calls, and the 31-epoch fixture sits inside one window, so `fillHistory` never runs under any E2E — the cache, the pause and the drag are unit-tested only. State it.
- P3.3: the class-name Vitest does not prove the rule is gone (above).

**Biome budgets (≤ 15 cognitive, ≤ 80 lines, `skipIifes: false`)**
- `startSession` is 64 lines today (`boot.ts:136-199`); steps with timings, the keys step reading `crsAtom`, cancel checks between steps and the drain push it past 80. Extract a `runStep(id, fn)` like `preflight`'s `run` (`boot.ts:56-71`) and a `StepRunner` that publishes `steps`.
- `EpochMap` (bars, window box, drag with pointer capture, click-to-centre, day ticks) will not fit one function: `useDragWindow`, `DayAxis`, a pure `barsFor(rows)` in a model file with the tests.
- The Node tile (health row, candidate form with Check states, result line, Use, note) → `HealthRow`, `CheckForm`, `NodeNote`; the check state machine as a reducer.
- `fillHistory` → `readCache` / `pageLoop` / `persist`; `watchNodeRequests` → a pure `classify(resOrError) → HealthEvent` that `node-health.test.ts` tests directly.

## D. Verdict

`conditional approve (with conditions: (1) add an e2e header mode that admits http://localhost:* and http://127.0.0.1:* while production carries only https: — without it P1.1, P1.4 and the site E2E cannot pass; (2) resolve A1: rebuild the chain view on a node switch under an open wallet via the existing recover path, or rewrite §Security to state the prune/poison behaviour and add the way out; (3) install the fetch wrapper once with a mutable origin and make it the gate (synthetic 429 while throttled), replacing per-poller retryAt checks, and design for 429s arriving as opaque network errors; (4) name the CRS CDN reachability in §Security, keep a test that pinned-crs is imported first in every prover context, and update docs/threat-model.md rows 40/41; (5) decide Ask A4 (the removed sign-in affordances vs words.e2e/withdraw.e2e) before P2.2; (6) give Cancel a per-attempt token and a drain so a second sign-in cannot open a second PXE; (7) pace the background fill at one page per poll tick, stop for the visit on the first throttle, draw the unread span as a hairline; (8) fix F1's line cite, the measureText-before-font mechanic, the Money selector, and keep ui free of site's NodeHealth type; (9) name the Biome splits for startSession, EpochMap, the Node tile and fillHistory in the phase text.)`

### Critical Files for Implementation
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/site/src/headers.ts
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/site/src/browser/node-deadline.ts
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/wallet.ts
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/boot.ts
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-third-pass/packages/web-miner/src/pinned-crs.ts
