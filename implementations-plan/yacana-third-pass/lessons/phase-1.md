# Phase 1 — arc 1: miner + site

## P1.1 · The node is a setting ✓ (2026-09-08, `794e6d7`)

Gate, as run: `bun run lint` exit 0 · every package's `typecheck` ok (`scripts/run/typecheck-all.sh`) · `bun test`
187 pass, 0 fail (new: `headers.test.ts` on the three modes, `node.test.ts` — the URL rules, the probe's refusals, the
proxy's dispatch and switch, `node-guard.test.ts` — same origin and the node pass, the lease, the deadline,
`redirect: 'error'`, the outcomes, the gate, bb.js's real loader under the guard, the CRS fall-through,
`import-order.test.ts`, `node-check.test.ts`, `tests/switch.bun.test.ts` — pause → drain → swap → rebuild → resume on
the recovery harness, the marker) · Vitest web-miner 52 pass (the tile: Check lines, a refusal in warn, Use disabled
until a check passed, Use switches and shows the rebuild, a quota throw shows the fixed message and does not switch,
the tile with no session) · `bun run e2e:agent -- bun run site:e2e` 2 passed (the `_headers` line carries `https:`
and `webrtc 'block'`, the local forms under the e2e mode, and no node origin) · the landing E2E 3 passed (the boot
under the guard and the rollup-address check).

What the phase found:

- **The e2e builds carried the testnet's rollup address.** `config.ts` takes the identity fields from the profile's
  record with per-field `VITE_*` overrides for e2e; a new identity field needs a new override in all five e2e setups
  (miner, stats, landing, site, the visual fixture) or the e2e deployment fails its own check ("node serves rollup
  0x4ed7…, this build expects 0xd73a…"). The visual fixture's recording already held the rollup address in its
  `getNodeInfo` answer, so only its deployment record needed the field.
- **Interceptor state cannot hang off `fetch`.** `pinned-crs` wraps whatever `fetch` is at its import, so a guard that
  kept its state on the fetch function lost it under the CRS wrapper; the state lives on the realm (a symbol on
  `globalThis`), and the guard exports `installNodeGuard()` so a test that swaps `fetch` for a fake can re-arm it —
  bun shares the module registry across test files in one run, so "install at import" happens once per run.
- **The e2e preview needs production's HSTS.** The site E2E asserts every policy header on every path; the `e2e`
  header mode keeps HSTS (only `dev` drops it), as the plan's "production's other headers" meant.
- **The assembled site's `_headers` follow the build's mode.** `assemble.ts` rendered production's policy regardless;
  an e2e assembly under `wrangler dev` blocked its own local node until the mode was passed through.
- **Chromium logs "Unrecognized Content-Security-Policy directive 'webrtc'"** on every load: the directive is best
  effort, as the plan says; the console line is noise the E2E's console watcher tolerates.
- **`test.each` under Vitest + jsdom**: `new URL(…, import.meta.url)` yields jsdom's URL, which `fileURLToPath`
  rejects; resolve file paths as strings in dual-runner tests.
- The miner's `tsconfig.tests.json` typed `vite/client` but not the app's `vite-env.d.ts`; a test that reaches
  `import.meta.env` through `boot.ts` needs the declaration included.
- The live switch's E2E (two forwarding proxies, a claim after the switch, a stalled B) is P1.4's; P1.1 proves the
  order on the recovery harness with a held-open read.

## P1.2 · Node health and the banner ✓ (2026-09-08, `f99a0a5`)

Gate, as run: lint exit 0 · every typecheck ok · `bun test` 202 pass, 0 fail (`node-health.test.ts`: `Retry-After` as
seconds, an HTTP-date, garbage, the past, none; the 429 backoff 15 → 30 → 60 s and the [5 s, 120 s] clamp; silence
20 → 40 → 60 s keeping its first moment; classify; three opaque failures in a window → throttled, a success resets
the count; `markRead` independent of the transport; a stale endpoint's outcome dropped; the gate's synthetic 429 with
no network call, `makeFetch([], false)` rejecting `NoRetryError` once, a synthetic answer not moving the deadline;
a success that started before the cooldown ignored, a later one clearing it; at the deadline one of three concurrent
callers reaches the network; `waitTurn` at the deadline and through a recovery in flight; silence gating with a 503;
`bannerState`; the guard test grew the body-time outcomes, the stalled body as one timeout, and the header) · Vitest
ui 42 (the banner's three texts, the countdown, the way out, hidden when healthy), web-miner 54 (the shell shows the
banner from a throttled store and links Settings), web-stats 19, web-landing 10 · `test:visual` 4 passed, no diff.

What the phase found:

- **Outcomes at body time need a relay stream.** Reporting on `fetch` resolving would have cleared a cooldown on
  headers alone; the guard now returns the Response with its body piped through a `TransformStream` whose flush is the
  outcome and a relay whose read error is the death. The guard's own tests had to read bodies to see outcomes.
- **Re-arming the guard must not stack it.** A second `installNodeGuard()` (a test over a fake) now re-points the one
  guard's `original` instead of wrapping a second guard whose inner state still had no endpoint.
- **Suites share the realm in one bun run.** The health store's gate and its transport state outlived the health test
  file and gated the guard test's requests with synthetic 503s; the guard test clears the gate, the health test resets
  the store after itself. The fake network must decode `data:` URLs itself rather than call "the real fetch", which by
  then can be another suite's guard over this suite's fake (a recursion the stack overflowed on).
- **The endpoint's identity includes the query**, so a test that varies `?delay=` must set the endpoint with it.
- **The stats page's "node unreachable" alert is gone**: the banner covers throttled, silent and stale from the one
  store; the `unreachable` status stays for the poll's own bookkeeping.
- `packages/site` has no React: the store exposes `subscribeNodeHealth` and each shell calls `useSyncExternalStore`
  itself; the banner's props are plain values, so `ui` imports nothing from `site`.

## P1.3 · The loop's margin and the pop-out ✓ (2026-09-08, `063363a`)

Gate, as run: lint exit 0 · every typecheck ok · `bun test packages/ui` 9 pass (`labelsCollide`, `marginFor`) ·
Vitest ui 43 · the owner's symptom reproduced: `shots/arc-1/loop-before-after.png` renders the pre-change drawing and
the new one side by side, the same samples, at the pop-out's 48 px and the cockpit's 230 px.

What the render showed (the diagnosis the plan could only infer):

- **The "0" is the clip.** At 10 px mono in a 28 px margin, "56.2" right-aligned 8 px in starts at x = −4: the render
  reads "6.2" with the 5 gone — a bar between 10 and 99 shows its last digits only, and a bar just past 10 reads
  "0.0". The margin is now measured from the widest label the axis will carry, the font set in `frame()` before the
  measurement (it used to be set later, in the calm drawing).
- **The bar at difficulty 1 before the epoch was worse than a collision.** The cockpit passed `difficulty 1` until the
  epoch landed, and with every score ≥ 1 by construction, every proof drew as a ringed win with its "★ 1.x · a win"
  label: a wall of rings and text over the baseline. The loop now takes `null` and says "reading the epoch…".
- **A win near the top right collided with the bar's caption** ("the bar · clear it to win") in both drawings; a win
  within 2.5 lines of the bar in the right 220 px now labels itself below its dot, when there is room above the
  baseline.
- A bar of exactly 1.0 stays degenerate by definition (every proof clears it); the drawing is honest, not pretty.
- The harness: React + the two drawings bundled with `bun build --format iife`, loaded as a classic script over
  `file://` (module scripts are blocked there, and inlining the bundle tripped on a `</script>` inside it),
  screenshotted with Playwright at 2×. Deleted after the render; the PNG is the artefact.

## P1.4 · Boundaries, the senders' removal, the arc boundary ✓ (2026-09-08, `c4fa43d`)

Gate, as run: `bun run lint` exit 0 · every typecheck ok · `bun test` 194 pass, 0 fail (9 live tests skipped; new:
`clearOf`) · Vitest ui 46 (`TileBoundary`: a throwing child renders the fixed text, a sibling survives, Try again
remounts, the error reaches `onError` cut at 300 chars), web-miner 55 (no sender input anywhere; the tile's throttled
line), web-stats 19, web-landing 10 · **arc boundary**: `bun run e2e:agent -- bun run --cwd packages/web-miner
test:e2e` **13 passed in 13.5 min, exit 0** (miner ×6, passkey ×2, states ×2, the new `switch.e2e.ts`, withdraw,
words) · `bun run e2e:agent -- bun run site:e2e` 2 passed · renders at 1280/1440 under `shots/arc-1/`
(`miner-settings-*`, `miner-settings-throttled-*`, `miner-banner-*`, plus the cockpit and the wallet) beside the
artboards `NodeSettings`, `NodeRateLimited`, `RateLimitBanner`; the pop-out beside `PopoutAfter` in
`loop-before-after.png` (P1.3).

What the phase found:

- **The senders finding.** The plan had the Send sheet warn that a private transfer to another Yacana account needs
  the recipient to have registered the sender. The rewritten `withdraw.e2e.ts` — the sender steps gone, the
  recipient's balance still asserted — passed: the recipient found the notes with no sender registered (Aztec's
  first-contact handshake carries the tag). So the capability cost nothing to drop and the warning line was wrong;
  it went, and the plan, the ledger and the ELI5 say so.
- **Two forwarding proxies, not two nodes.** `e2e/node-proxy.ts` puts A and B in front of the one isolated node,
  each counting the JSON-RPC requests it forwarded, with a mode switch (`ok` · `down` → 503 · `throttled` → 429 with
  `Retry-After: 60`). The switch spec proves the live switch by A's counter staying flat after it (≤ 2 in-flight
  requests) while B's climbs past 20, and a claim minting on B; the render script uses `throttled` for the
  rate-limited screens. The spec loads the page with the node in `localStorage`, not the `?node=` pin: a pinned page
  disables the tile by design.
- **The first full run failed two specs for reasons outside this arc.** `passkey.e2e.ts` asserted the exact text of
  `key-address`, which has carried an `ExternalLink`'s screen-reader suffix since #20 — the spec now checks the
  visible text and the `title`. The lost-race spec's burst miner read `packages/work-circuit/target/yacana_work.json`,
  gitignored and absent in a fresh worktree (like the contracts in P1.1) — `bun run --cwd packages/work-circuit
  compile`; the bytecode matched the committed copy. The suite was rerun whole: 13 passed.
- **The renders caught two spec deviations the tests could not.** (1) Under a 429 the tile's health line printed the
  client's raw error ("Error 429 from server http://…: the node is rate-limiting this page"); the spec wants `429 ·
  rate limited` · `last answer N s ago` · `this deployment ✓`. The line now reads the shared health store while the
  transport is throttled or silent (and the probe's result otherwise), and the deployment check a node passed once
  survives its failed probes (`verified`). (2) Two wins within a hundred pixels near the bar: the upper one's label
  landed on the bar line, the caption and its neighbour's dot. A label that goes below now goes below the **bar**,
  not merely below its dot, and `clearOf` steps it down a line past the labels already drawn this frame (stopping at
  the baseline). Unit-tested; the drawing re-rendered.
- **`TileBoundary` catches rendering only.** A throw inside the loop's animation frame is the drawing's own
  (`safely()` → `drawFailure`); a rejected promise in a tile's effect is the tile's. The boundary's text is fixed and
  the error goes to `onError` or the console, cut at 300 characters (a node's whole response can ride an error).
- The docs link in the tile note is set in the prose face and unbreakable; `ExternalLink` defaults to mono for
  chain values.

## Arc 1 codex loop · round 1 (2026-09-08)

Session `01a082b3-cb6f-7763-b05d-48f6157796c8` (Astra, high), the four renders and three artboards attached. Twelve
findings; all verified against the code, all adopted (the loop's high signal — three were plan invariants the code
had drifted from):

- **High — the drain did not bound the switch.** `refresh()` stored the deadline-wrapped promise as `refreshing`, so
  `drain()` returned while the real `readChain` floated on the old node; the poll ignored the switch. Now `refresh`
  tracks the real read (`inflightRead`), `drain` awaits it, a `switching` flag makes `poll()` skip across a switch.
- **High — a failed node-switch rebuild took the lost-race reopen fallback and reported success.** The plan says a
  switch rebuild that fails is a boot error, never the reopen (which would keep a view built on the old node). Added a
  `strict` path: `recover(strict)` in `boot.ts` rethrows instead of reopening; `rebuildChainView(why, strict)`
  rethrows after abandoning the prover; `Session.switchNode` sets `bootAtom` to `error` with the way out.
- **High — two switches could overlap.** A tile remount gave a second usable form while the first switch ran.
  `Session` now holds one in-flight switch promise and returns it to a concurrent caller.
- **Medium — a switch from idle started mining.** `readRebuiltOnce` called `start()` unconditionally; under a switch
  pause it now leaves the resume to `release('switch')`, which only fires if mining was active at pause time.
- **Medium — an obsolete answer freed the recovery lock.** `probing` cleared on any current-endpoint outcome; now
  only an outcome that started at/after the recovery was admitted (`probingSince`) clears it.
- **Medium — a cancelled response body left the gate stuck.** The relay reported no outcome on cancel; it now settles
  the status once before cancelling the reader.
- **Medium — reinstalling the guard after the CRS wrapper recursed.** `installNodeGuard` is now idempotent (never
  re-captures `original`); tests point the guard at their fake through the new `setOriginalFetch`.
- **Medium — health probes overlapped for minutes.** The active node's probe uses the guard's 120 s deadline, not the
  tile's 10 s; a tick is now skipped while the last probe is in flight.
- **Medium — five Settings tiles were outside a boundary.** Performance, Behaviour, Account, Appearance and About are
  now wrapped; every miner boundary logs through `useTileLog` (the diagnostics log, host-only), not the console.
- **Low — `restoreDefaultNode` reloaded even when the save failed** (back into the broken node); it now reloads only
  on a successful write.
- **Low — the pop-out footer was 11 px and could wrap**; it is 10 px mono, `whitespace-nowrap`, per the spec.
- **Low — two stale comments** (`pinned-crs` still named the CSP as the CRS control; the gate comment said others
  "wait for" the recovery when they get a synthetic answer) corrected.

New tests: a cancelled body reports once (guard); a stale answer does not free the recovery lock (health); an idle
switch stays idle and a strict rebuild failure rejects without reopening (switch). Gate re-run: lint · 5 typechecks ·
`bun test` 199 pass · Vitest ui 46 / web-miner 55 · the switch and pop-out E2E on the isolated network · renders
re-shot (the throttled tile now reads `429 · rate limited · last answer N s ago · this deployment ✓`).

## Arc 1 codex loop · round 2 (2026-09-08)

Resumed session, the round-1 fix diff. Eight findings, all verified; all adopted (the round-1 fixes had been
built by a downgraded model and the owner asked for a re-review under the intended one — that re-read found
two more defects of its own, below):

- **High — the drain still missed work.** `inflightRead` was overwritten per refresh, so a read that outlived its
  deadline while the next started was not awaited; and `claiming → recovering` ended the phase wait before a
  lost-race rebuild finished (two rebuilds at once). Reads now accumulate (`Promise.all` over the previous
  entry), and the drain waits out `recovering` as well as `claiming` — both settle to `idle` (recovered / paused /
  prover-dead) — then the rebuild read.
- **Medium — a concurrent switch to a different node silently picked the first.** `switchNode(C)` during a switch
  to B returned B's promise while the tile had already saved C. A different-target call now rejects; the same
  target returns the switch underway; and the tile saves **after** the switch lands, never before.
- **Medium — strict recovery swallowed a first-read failure.** `recover(strict)` could succeed and the fresh view's
  first `refresh()` fail inside `readRebuiltOnce`, which resolved anyway. Strict now threads through
  `readRebuilt`: the read failure abandons the prover and rethrows, so the switch rejects and the boot error shows.
- **Medium — after a terminal switch failure the next node choice could not recover the session.** `Session.dead`
  is set on a rejected switch; a later `switchNode` saves and reloads (a fresh boot on the chosen node) instead of
  live-switching a dead account.
- **Medium — the cooldown's reference time was the failing request's start**, so a success already in flight when
  the throttle began could clear it. `cooldownFrom` is now `performance.now()` at the moment the cooldown is
  observed; a success that started earlier says nothing about now.
- **Medium — a cancelled body reported its status (200)**, which is "headers alone are success" — the very thing
  `reportOnBody` exists to avoid. A cancel now settles once as a failure (`died(reason)`), freeing a recovery lock
  without declaring the node healthy.
- **Medium — the idempotent reinstall still re-asserted `globalThis.fetch = guarded`**, dropping a wrapper above it
  (the CRS interceptor). Reinstall is a pure no-op now; `setOriginalFetch` (tests only) is the one path that
  re-points `globalThis.fetch`.
- **Low —** the rebuild-failure comment said a lost race "waits it out" after `abandonProver`; it is terminal for
  both paths (a switch additionally rethrows).

The owner's re-review request (Fable over the round-1 edits) found two more:

- **`Session.switchNode`'s reload path returned silently when the save failed**, and the tile would then have
  reported "now in use" for a node the page never took. It throws the fixed storage message instead.
- **`NodeTile.use()` skipped `onSwitched()` when the post-switch save failed**, leaving the tile on the old host
  while the session was on the new node. `onSwitched()` fires as soon as the switch lands; the save's failure is
  reported after it, as what it is ("Now in use, but the browser refused to save it").

Tests: the cancel test expects a failure; the cooldown tests use fresh (`performance.now()`) successes where they
mean a real answer — under observation-time cooldowns a `startedAt: 0` success is correctly stale, which is what
the opaque-burst test tripped on; the tile's storage-refusal spec now asserts the switch happened first, the tile
followed the node, and nothing was persisted. Gate re-run: lint · 5 typechecks · `bun test` 199 pass · Vitest 130
pass · the live-switch and pop-out E2E on the isolated network.
