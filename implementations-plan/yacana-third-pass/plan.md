---
plan: yacana-third-pass
tier: mid
driver: claude-code
code_review: off
eli5_mode: artifact
budget: recon 1 agent (plus the six-ask map taken before the canvas) · code-review off · codex high fix loops until clean, hard stop 3 rounds per arc · a final cross-arc pass
created: 2026-09-08
---

# yacana-third-pass — the node, the waits, the strip, the pop-out

The second pass shipped the calmer surfaces. Using them, the owner found the rest: the one public node throttles
the page and nothing lets a user pick another; the stats page shows nothing at all until every read is in; the
miner opens on a sign-in screen and then a log of steps instead of the cockpit; the epochs strip has no answer to a
long history; the wallet still carries the senders card; the pop-out draws proofs the old way and cuts the bar's
label; the money table draws one rule too many. This plan applies the owner's picks from the design canvas.

Design source of truth: the design canvas **Yacana Third Pass Proposals**
(https://claude.ai/code/artifact/50978213-b8ab-476a-88a8-6186551de520, eighteen artboards; its generators live in the
authoring session's scratchpad, and every measurement the implementation needs is copied into this plan). Recon:
`recon.md`.

## Success criterion

Each surface matches its canvas artboard at 1280 and 1440 px in composition, copy and hierarchy (deviations listed in
`lessons/` with the reason); a user can point the miner, the stats and the landing at any https node from the miner's
Settings without a reload (the account's chain view rebuilt from the new node) and the change holds across
reloads and pages; a throttled or silent node is named on a banner with the way
out on it; the stats page paints its structure within 300 ms of a slow node answering and fills in the order the reads
land; the miner shows the chain's numbers before any account exists and opens an account behind a modal with a
determinate bar; the strip stays 48 cells wide at any history and the map under it moves the window; the senders card
is gone from the wallet; the pop-out draws ticks and a whole label; the money table's last row has no rule; the bar's
label never collides with the baseline's; no tile can blank a page; every existing gate passes with its assertions
updated; the stats screenshot baselines are regenerated once and hold; each arc converges in its codex loop; three
stacked PRs.

## Owner's answers (Phase 0)

- Picks (two canvas rounds, 2026-09-08): stats loading **skeleton, two beats**; mine signed-out **dull cockpit +
  modal**, opening **A** (the bar in the modal); node **free https URL, no list**, the throttled state on a **banner**
  (not the header line, not Settings); strip **A** (the 48-cell window + a map of every epoch); senders card
  **removed from the wallet**; money table last rule gone; the pop-out on the cockpit's drawing with a measured margin.
- The "0" report: on the miner's graph, possibly the pop-out too. Read as the bar's label colliding with the
  baseline's label when the bar sits at the floor (difficulty 1 before the epoch is read, or a near-1 target on a
  fresh network); see the Assumptions' Inference I3 and P1.3.
- Validation layers: lint + typecheck + `bun test` always; Vitest component specs on every component phase;
  Playwright E2E on the isolated network at each arc boundary; the stats screenshot gate for the stats arc; the
  assembled-site E2E once on arc 1 (it changes `_headers`).
- `code_review`: **off**.
- Delivery: **three stacked PRs** (miner + site → mine loading → stats + landing).
- CSP: **any https node** (`connect-src https:` in production; `http://localhost` and `127.0.0.1` only in dev builds).
- Hardening: none scheduled. The one trust change (the CSP) is argued in Security below and re-checked by both audits.

## The canvas, measured (the spec)

Tokens, type and primitives are `packages/ui`'s; the numbers below are the canvas's and are the target at 1440 px.

### Stats · the skeleton and the two beats (`StatsSkeleton`, `StatsFirstBeat`)

- From the first paint the page has its final geometry: header (freshness pill reads "reading the chain…" until the
  block lands), six KPI tiles, the strip tile (4 cols) beside the epoch card (2 cols), the lead difficulty chart, the
  three small charts, the table, then "what is not here" and Verify, then the footer. The two chain-free tiles
  (not-here, Verify) and the footer render complete at once.
- A skeleton block: `border-radius 3px`, background a 90° gradient `panel → panel-2 → panel`, `background-size 200%`,
  1.6 s ease-in-out shimmer; **no animation under `prefers-reduced-motion`**. Sizes: KPI value 64×22 (radius 4),
  KPI sub 120×10, table cell 10 px tall at column widths 24/60/30/48/70/34/80/44, strip 28 px tall full width, strip
  captions 90 and 140 px, epoch card values 40×22 and two rows 14 px (100 % and 70 %).
- A chart's skeleton keeps its axes: the gridlines and dim tick labels are drawn (difficulty 1 · 4 · 16 · 64;
  emission 0 · 5k · 10k; duration 10 s · 1000 s · 1 d; retarget ×0.25 · ×1 · ×4) and a `panel` band 30 % of the plot
  height sits at 35 % from the top. The lead chart is 200 px, the small ones 110 px (unchanged).
- Timing: **nothing under 300 ms** (a fast answer never shows a skeleton); at 300 ms every beat still unresolved shows
  its skeleton (a beat that landed first never does); beat one when the open epoch's number and the latest block land
  (with them supply and genesis, moved up: one and three fixed-slot reads) —
  the minted tile, the header pill, the "since you opened" tile and the epoch card's number fill; beat two when the
  48-epoch window lands — the strip, the epoch card, the four charts, the difficulty / claims-per-hour / network
  tiles and the table fill together. A value that appears glides from grey to its number with the tween that exists;
  under reduced motion it appears.
- The table's skeleton shows 8 rows; the "N of M" count and the CSV/JSON links wait for beat two (dashes until then).

### Mine · signed out (`MineSignedOut`, `MineWatching`)

- The cockpit renders behind the modal with everything the chain gives: the loop with the baseline and the bar (no
  proofs; centred `ink-4` caption "sign in to start proving"), the status line "live · last 3 min · — per proof ·
  11 threads · 0 proofs" and a `uv` "Sign in to mine" button in Start's place; the claim slot dashed ("no claim in
  flight"); the epoch tile complete (claims, difficulty, open for, expected close, if it closed now, escape hatch);
  the power slider live; the three KPI tiles with "—" values and honest subs ("no proofs yet", "the bar is 3.3 ·
  about 3 proofs per win", "sign in to start"); the ledger with the epoch's opened line; the balance tile with "—
  tYACA", a `uv` "Sign in" button, a dimmed "Wallet →" and "Your balance and your claims appear once an account is
  open."
- **Dull** while signed out: the page wrapper at `opacity .72; filter saturate(.55)`. Under the modal a **veil**:
  `rgba(10,10,11,.42)` with `backdrop-filter blur(2px)`.
- The **modal**: 480 px wide, `raised` background, `line-2` border, radius 10, padding 26/26/22, gap 16, shadow
  `0 24px 80px rgba(0,0,0,.6)`, top 180 px. Eyebrow "mine"; h2 24 px "Sign in to mine."; body "Your account lives in
  a passkey on this device, synced by your platform. Your balance follows the account, not the browser; nothing is
  written down."; a large `uv` "Sign up with a passkey"; a row with the underlined "I have twelve words" (left) and
  the `ink-3` "Not now — just watch" (right); the host warning in `ink-3` xs. A returning device reads "Welcome
  back." with the saved account row and Open, the same two links below. Focus is trapped; Escape and the veil click
  act as "Not now".
- **Dismissed**: the veil and the modal go; the cockpit stays dull with "Sign in to mine" in Start's place and "Sign
  in" in the balance tile; either reopens the modal.

### Mine · opening, A (`MineBootA`)

- The modal stays up after the passkey answers: eyebrow "opening your account"; h2 "A minute the first time."; body
  "The proving keys are 20 MB, fetched once and kept. After that, opening takes a few seconds."; a 4 px bar (`line-2`
  track, `uv` fill, radius 2); a step list at 13 px with a mono right column: `✓ passkey · 0.4 s`, `✓ the node
  answers for this deployment · 0.3 s`, `● proving keys · 8.4 of 20 MB` (current, `ink`), `notes and balance`,
  `ready to mine` (`ink-3`); a footer row "You can watch the chain behind this; press Start when it is done." (or,
  when "Resume mining when the page opens" is on, "mining resumes when it is done") and a ghost "Cancel". Done steps are `ok`. The bar's width is the sum of the finished steps' weights plus the current
  step's fraction (weights: passkey 5, node 5, keys 70, notes 15, ready 5; the keys step's fraction is bytes / total,
  the notes step's fraction is unknown and shows indeterminate motion inside its slice under motion, a static half
  under reduced motion).
- Behind it the cockpit is dull with the header pill "opening", Start reading "opening…" (disabled), the balance and
  claims shimmering (skeleton 96×40 for the balance, 180×10 for the sub; the Send and Wallet buttons at 50 %).
- Cancel returns to the signed-out state (the account stays saved on the device; nothing is deleted).

### Settings · the Node tile (`NodeSettings`, `NodeRateLimited`, `RateLimitBanner`)

- The Network tile becomes **Node** ("chain reads and claims go through it"). Inside: a framed row (padding 12/14,
  `line-2` border, radius 8) with the node in use — its host in mono ("· the default" when it is the build's), a
  status line in mono 12.5 px (`block 73,164 · 3 s ago` in `ok`, the latency, `this deployment ✓` in `ok`) and a
  dimmed "In use" button; below, "Another node" (label + input + "Check"); a result line after Check (`✓ chain … ·
  rollup …`, `✓ the miner and the token are there`, the block, the latency; or the refusal in `warn`); "Use this
  node" (primary) with "Applies at once; your account's view of the chain is rebuilt from the new node (about a
  minute) and mining carries on. The page checks any node against this deployment before it reads a number from
  it."; a rule and the note "The node answers what this page asks; it can delay or hide, never spend: every claim is
  proved here and verified on the chain. A public node may rate-limit you: run a node →" (link to the Aztec docs).
  (The canvas board's "Applies at once; mining carries on" holds; the owner chose the live switch over the reload the
  audits leaned to — the rebuild on switch is what makes it safe; see the Decision ledger.)
- The miner and token address inputs go: the deployment is the build's and never a setting.
- When the node in use is throttled the framed row's status reads `429 · rate limited` (warn) · `last answer 40 s
  ago` · `this deployment ✓`.
- **The banner** (mine, wallet and settings alike; the same slot the preview notice uses, under the header): `warn`
  Alert with a 6 px amber dot; text "The node is rate-limiting this page (HTTP 429). The chain numbers are 40 s old
  and counting; a claim sent now would fail."; right side mono "retrying in 12 s" and the link "Use another node →"
  into Settings. The silent variant: "The node has not answered for 40 s. These are the last numbers read." The age
  counts from the last successful chain read, not from the last HTTP success. What proving does is the header pill's
  to say (the controller pauses after a minute without a read, as today); the banner never claims it. Not dismissible
  while the condition holds; gone on the first good chain read.
- The Behaviour, Performance, Account, Appearance and About tiles keep their content. The canvas's dashed
  **Advanced** tile is not built: the owner dropped the senders capability (A1), and nothing else belonged in it.

### Strip · A (`StripA`)

- The 48-cell strip is unchanged (widths = duration clamped [6, 400] as flex weights, labels as today — a cell
  labels itself when its container is at least 24 px wide — the open one always the rightmost with its number, ← →
  step, click selects, `?epoch=` in the URL).
- Under it, the two mono captions (the window's first epoch and its opening time; the open epoch's opening time and
  "epoch N open"), then the **map**: 18 px tall, one bar per epoch ever, `flex 1 0 0`, height `clamp(3, log10(duration
  s) × 4.6, 18)` px, colours `rgba(140,107,255,.5)` harder / `ink-4` easier / `rgba(232,181,77,.75)` escape hatch;
  the **window** drawn over it (`uv-2` 1 px border, radius 2, `rgba(140,107,255,.12)` fill, 4 px taller than the
  map on each side) covering the 48 epochs shown; an axis line under the map with day ticks ("launch · 09-05", one
  per day, "now").
- Controls row: the hint "48 epochs at a time · drag the window on the map, or ‹ › to page · the table follows · the
  URL keeps the window"; right: "‹ older", "newer ›" (dimmed at the newest), the `uv` badge "epoch 999".
- Behaviour: the window is `?from=N` in the URL (absent = the newest 48); ‹ › page by 48; a click on the map centres
  the window there; drag moves it; the table shows the window's rows (newest first) and its "load older" button is
  gone; the charts draw the window; the strip's selection stays `?epoch=`.
- The map's data is every closed epoch's `(openedAt, target, claims)`: read in the background after beat two, newest
  first in 48-epoch pages, drawn as it arrives (bars appear from the right), cached per deployment in the browser
  (closed epochs never change), so the second visit draws the whole map at once and reads only what is new. On a
  429 the background read pauses with the banner's retry.

### Wallet, money, pop-out (`WalletNoSenders`, `MoneyAfter`, `PopoutAfter`)

- Wallet: the balance tile (Send), the claims list, the account tile with Sign out; the senders card is gone, and
  with it the capability (`addSender`, `registerSender`). What it costs, measured in P1.4: nothing — the rewritten
  `withdraw.e2e.ts` sends privately from one account to another that never registered the sender, and the recipient
  finds the notes (Aztec's constrained delivery publishes a handshake on first contact; `registerSender` was
  redundant here). The Send sheet's copy is unchanged.
- Money: the table's last row loses its bottom rule (`[&>tr:last-child>td]:border-b-0` on the `tbody` — `last:` on a
  cell would match every row's last column; the section's border closes the block).
- Pop-out (360×190): the 48 px strip draws ordinary proofs as the cockpit's dim ticks (2 px, `ink-3` at 55 %) and a
  win as the ringed dot (3.5 / 6.5 radius); the left margin is `measureText(label).width + 8 + 8` where `label` is
  the bar's label (never less than 28); the baseline's "1" is not drawn when the bar's line is within one font height
  of the baseline; the footer row is unchanged and never wraps (10 px mono, `white-space: nowrap`).

## Architecture & Implementation

Grounded in `recon.md` and revised after the round-1 audits: the modal, the progress bar, the stepper, the alert, the
tween, the connection module, the reader, `serial` / `coalesced` and the fetch deadline all exist and are reused; what
is new is one skeleton primitive, one error boundary, a node-health store with its banner, a fail-closed fetch guard,
a streamed key loader, a public epoch read for the miner, a staged stats read, the strip's map with its cache, a
cancellable opening, and the measured margin in the loop. The node switches live — the owner's call — with the
account's chain view rebuilt on every switch (see Trade-offs).

### Proposed architecture

1. **The node is one shared setting, checked before it is used, switched live.**
   `packages/site/src/browser/connection.ts` keeps `yacana.connection` (nodeUrl) as the single source the three apps
   read at boot; the origin allowlist and `disallowedNodeUrl` go. `headers.ts` takes `mode: 'production' | 'e2e' |
   'dev'` and emits `connect-src 'self' data: https:` in production, plus `http://127.0.0.1:*` and
   `http://localhost:*` in `e2e` and `dev` (the E2E preview build keeps production's other headers and its local node
   and mock origins; `assertProductionConfig` still refuses an http default). `config.ts` drops
   `VITE_ALLOWED_NODE_ORIGINS`. A new `packages/site/src/browser/node.ts` owns:
   - `probeNode(url, expected, layout)` → `{ chainId, rollupVersion, rollupAddress, block, blockAgeS, latencyMs }`
     after `assertDeployment` (the boot's `node` + `deployment` rows and the Node tile's Check are the same call; its
     client is built with `makeFetch([], false)` so a dead candidate fails in one deadline, not three; a Check opens
     a **candidate lease** on the guard — `allowCandidate(endpointUrl, deadlineMs)` returns a release — so the
     probe's requests pass while the active endpoint stays active, and the candidate's responses never touch the
     active endpoint's health, even when both are paths of one origin). The expected rollup address comes from the
     build like the other identity fields: `deploy.ts` records `info.l1ContractAddresses.rollupAddress` in the
     deployment record from now on, a one-off script amends `deployments/testnet.json` from the default node once,
     `ExpectedDeployment` gains `rollupAddress`, and every boot and every Check compares it (so the check does not
     depend on the current node being alive). The tile's health row ("block N · 3 s ago · 210 ms") comes from a
     probe tick every 10 s while the Settings route is open — the miner never reads the block number otherwise.
   - `switchableNode(url)` → `{ node, use(url), current() }`: a `Proxy` whose every property read forwards to the
     current SDK client and binds functions to it — the same shape the wallet already puts in front of its node
     (`observeSends`, `wallet.ts:41-52`), and the SDK's own holders resolve methods at call time (the benchmarked and
     caching wrappers, the block-stream source: `benchmarked_node.js:30-45`, `caching_aztec_node.js:16-118`,
     `block_stream_source.js:7-35`; the fable audit read them). The wallet, the controller, the public poll and the
     probe hold the proxy.
   **"Use this node" switches live**, in this order (the owner's pick over the reload the audits leaned to; the
   safety property both asked for — no view built on one node is ever read against another — is kept by the
   rebuild): the candidate passed its Check (same chain id, rollup version, rollup address, both class ids, the
   bound token — so the `NodeInfo` the wallet cached for its lifetime, `base_wallet.ts:170`, stays true); the
   controller **pauses** (`'switch'`, the existing pause) and the serial read queue **drains** (no claim or read in
   flight straddles two endpoints); `saveConnection`; `switchable.use(url)`, the guard's active endpoint, the
   deadline and the health store move to the new endpoint (the old endpoint's late answers are dropped by endpoint
   tag); with an account open, the chain view is **rebuilt from the new node** through the existing recover path
   (`resetAccountView` → register the account → re-attach the deployment — the lost-race path, `controller.ts:
   518-537`) with the opening steps shown in the dialog ("rebuilding the chain view from the new node", about a
   minute); then the controller **resumes** (mining continues if it was mining). Signed out, the switch is the swap
   alone: the public poll's next tick reads the new node. The stats and the landing pick the saved URL at their next
   boot (same origin, same key). A rebuild that fails is a boot error with the way out (never the lost-race
   fallback that reopens the old database, which would keep a poisoned view).
   The PXE's store is keyed by the rollup, not by the node (`wallet.ts:35-38`), and its block synchroniser anchors on
   the node's tips: a node behind the old one prunes the view (notes vanish until rediscovered), a lying node's fake
   finalized tip can leave it unable to reconcile — which is why the view is rebuilt on every switch, and why the
   boot remembers which **endpoint** the view was last built on (`yacana.pxe-view.<namespace>` → the SHA-256 of the
   normalised node URL: origin + path + query, two paths on one origin can be two nodes). A boot whose saved
   endpoint differs from the marker, or finds no marker (a switch made on another page or tab, an interrupted
   rebuild), opens the account through the same rebuild; the marker is written after the rebuild, before the sync.
   No sender list is migrated or replayed: the owner dropped the senders capability (A1), so a rebuild registers
   the account and nothing else. The Node tile works with no session (`boot.phase` `signedOut` or `error`). Every
   boot-error alert (miner, stats, landing) offers "Use the default node" (`saveConnection(default)` + reload) and
   links `/mine/settings/`, so a dead saved node always has a way out.
2. **Every context's fetch fails closed.** `packages/site/src/browser/node-guard.ts` installs one mutable interceptor
   per context (page and prover Worker), imported before `pinned-crs.ts` so the CRS interceptor's fall-through goes
   through it: same-origin requests pass; requests to the **active endpoint** — matched on the complete normalised
   node URL (origin, path and query; the SDK appends nothing to it but the method's body, so the match is equality
   of the request URL's origin + path + query with the endpoint's, not a prefix: `/rpc?node=A` and `/rpc?node=B` are
   two nodes, and so are `/a` and `/ab`) — pass with the per-request deadline; **`data:` and `blob:` URLs pass**
   (bb.js loads its bundled WASM as `data:application/gzip;base64,…` — `bb.js/src/barretenberg_wasm/fetch_code/browser/index.ts:18`
   — whose origin is `"null"`; these are not network requests and the guard must not see them as one) (`boundNodeRequests` folds into it); requests to a **leased
   candidate endpoint** pass for the lease's duration and are not recorded; the pinned CRS hosts are served by
   `pinned-crs` before the guard sees them; **everything else throws** `blocked endpoint <url>`. With `connect-src https:` the CSP no longer makes an unpinned CRS fetch fail; the
   guard does, in code, in both contexts (recon: `pinned-crs.ts:1-3` relied on the CSP for it), and a static test
   asserts the relative order in `main.tsx` and `prover.worker.ts`: the Worker's globals shim before any SDK import,
   the guard before `pinned-crs`, and both before any SDK import (the shim stays first, as it must). The
   guard is set by `setNodeOrigin(url)` at boot (one mutable cell, never re-wrapped) and is the one place that knows
   it. **The guard is also the throttle gate**: while the store says `throttled` and `now < retryAt`, a node-origin
   request gets a synthetic `429` JSON response without touching the network — the SDK's transport makes one call
   and rejects (`makeFetch` raises `NoRetryError`; the node client surfaces a plain RPC error), which covers the
   PXE's own reads as well as the pollers'. Synthetic responses are not events: only real network outcomes update
   the store, so the gate can never extend its own cooldown. Every guarded request goes out with `redirect: 'error'`,
   applied after the caller's options (an explicit `follow` is overridden): a redirect fails instead of being
   followed past the check. The miner's node client is
   built with `makeFetch([], false)` as the stats page's is (no transport retries: the SDK's default retries
   retryable failures — a malformed or non-JSON error body — three times). `webrtc 'block'` joins the policy line as
   best effort: the directive is in the CSP3 draft and not in Chromium's enumeration today, so the plan claims
   emission, not enforcement.
3. **Node health is one store, one banner, two clocks.** `packages/site/src/browser/node-health.ts`: the guard reports
   each node response — `ok` (latency), `429` (with a parsed `Retry-After`: delta-seconds or HTTP-date, invalid or
   absent → a backoff of 15 s doubling to 60 s; clamped to [5 s, 120 s]; the header is rarely readable cross-origin, so
   the backoff is the norm), a timeout or network failure — into a tiny external store read through
   `useSyncExternalStore`; an outcome is reported once, when the **body** completes or fails (the guard returns the
   `Response` with a pass-through body stream that settles the event on close, error or the deadline — a node can
   send `200` headers and stall the body, and the SDK reads the body after `fetch` resolves), so a recovery owned by
   `claimRecovery()` is held until the body lands. The store separates **transport** (`ok · throttled · silent`; both failure kinds carry a
   `retryAt` — the 429's from the header or the backoff, silence's own 20 s doubling to 60 s — after which one
   recovery attempt is allowed) from
   **freshness** (`lastReadAt`, set by the pollers through `markRead()` after a successful chain read, never by the
   interceptor). A success whose request started before a 429 does not clear the cooldown. The gate in the guard
   answers requests during the cooldown, so no poller needs a check of its own; a boot that failed on a throttled or
   silent node retries on the cooldown instead of stopping (the stats and the landing today install their poll only
   after a successful boot). An edge's 429 without CORS headers reaches `fetch` as a `TypeError`: a network failure
   right after successes is a throttle candidate — three in a row inside one poll interval → `throttled` with the
   backoff. Each event carries the endpoint it was sent to and is dropped if that endpoint is no longer the active
   one. **Both failure kinds gate**: during a throttle's or a silence's cooldown the guard answers active-endpoint
   requests with a synthetic failure (429 for a throttle, 503 for a silence) without touching the network; at the
   deadline exactly one caller — the first to ask, via `claimRecovery()` — goes to the network while the others keep
   the synthetic answer until that outcome lands (an `ok` clears the state for everyone; a failure re-arms the
   deadline); `waitTurn()` follows the same rule, so a failed boot that lost the recovery race waits for the
   recovery's outcome or the new deadline rather than retrying into a synthetic failure. `NodeBanner`
   (`packages/ui`) renders from the store; each app's shell mounts it under the header beside the preview notice. The
   miner's controller keeps its own successful-read clock and its pause (`OFFLINE_AFTER_MS`); the banner does not
   describe mining, the header pill does.
4. **The miner shows the chain before it has an account.** `boot.ts` splits: `preflight` keeps `isolation`, `node`
   and `deployment` (the probe) and ends in `{ phase: 'signedOut', records }`; the CRS leaves the gate — `startCrs`
   runs from page load, streaming with byte progress into `crsAtom`, and the wallet's and the prover's start await
   `crsAtom.done` (readiness still gates proving; only the order changes). A public epoch poll (`public-epoch.ts`:
   `readOpenEpochNumber` + `readEpochs` with the seed through `fetchLayouts` / `chunkLoader`, the stats page's path;
   `copySlots` joins the miner's prebuild) fills `epochAtom` every 30 s until the controller's first read lands — the
   public poll's writes carry a generation and are dropped once the controller owns the atom, so a late public read
   can never overwrite fresher claims;
   `rulesAtom` starts from `PARAMS` and is replaced by `readRules` after sign-in as today.
5. **Opening is a cancellable attempt owned by `Session`.** The attempt begins at the initiating key action
   (`createWithPasskey`, `openRecord`, the words restore) — before the ceremony, the derivation and the record write,
   not after them — so a dismissal during the ceremony is inert (the primary and the alternate actions are disabled
   until the attempt settles) and no late open can follow a Cancel; `Session` mints the attempt generation and an
   `AbortController` there; `startSession(…, signal)` checks the signal between steps and publishes `{ phase: 'opening',
   steps }` only for the live generation; Cancel aborts, disposes whatever the attempt created (the existing
   failed-start cleanup: controller dispose, wallet stop), clears the transient secrets (`master`, `words`) and
   returns to `signedOut`; the dialog's primary is disabled until the in-flight step settled and the cleanup ran, so
   a second sign-in can never open a second PXE on the namespace; a cancelled attempt's error never lands in
   `signedOut.error`; a late completion of a cancelled attempt publishes nothing. Steps: passkey · node · proving keys
   (bytes) · notes and balance · ready (plus "rebuilding the chain view" after a node change).
6. **The cockpit is one component with a signed-out rendering.** `Cockpit` renders whenever the preflight passed;
   `data-signed-out` dims it (`opacity-[.72] saturate-[.55]` on the grid) and swaps Start for "Sign in to mine". The
   sign-in `SignInDialog` uses `DialogContent` with `max-h-[85vh] overflow-y-auto`, no corner X (signed out, "Not now
   — just watch", Escape and the overlay are one action: dismiss; while opening, Escape and the overlay are
   `preventDefault`ed and only Cancel cancels — an overlay click must not abort an account open), the screens' `h1`
   becomes the `DialogTitle`, the trigger regains focus on close, and the page hotkeys (`useHotkeys`: space, `[`,
   `]`, `w`, `,`) are off while it is open. It hosts the existing key screens (`WelcomeBack`, `CreateKey`, the words
   screens) as its body at 480 px, **with every action they have today** — the canvas drew the two most used; the
   rest ("Use twelve words instead" `use-words`, "I already have a passkey" `restore-passkey`, "I have twelve words"
   `restore-words` on the fresh screen; "Use another passkey", "Enter twelve words instead", "Create a new account"
   `create-new-key` under Welcome back; Open and Back on the words entry, `words-open`) stay as `ink-3` links in the
   same row, since `words.e2e.ts` and `withdraw.e2e.ts` use them and a returning user needs them (a logged
   deviation; Ask A5);
   the words backup and quiz grids (three columns) and the screens' action rows get `flex-wrap` so they fit 428 px of
   content width and a 720 px-tall viewport. The opening body is `Progress` + `Stepper` from `boot.steps`.
   `KeyScreen.tsx`'s page chrome goes; its screens stay. No auto-start: `ready` closes the dialog with Start
   enabled; `resumeOnOpen` behaves as today.
7. **The stats page always renders, in two beats.** `chain.ts` splits into `read-fixed.ts` (beat one: block, open,
   supply, genesis), `read-window.ts` (beat two: the window through `window()` + `linkRows`, and the lottery),
   `history-fill.ts` and `history-cache.ts`; `main.tsx`'s orchestration publishes each beat as it lands (a history
   failure still publishes beat one and the `historyError`). `chainAtom` splits into `fixedAtom` and `historyAtom`;
   every tile, chart and the table accept `null` and draw their skeleton; one 300 ms timer per mount shows the
   skeleton of every beat still unresolved at that moment. `Skeleton` (`packages/ui`) is a `div` with the shimmer
   gradient (`motion-reduce:animate-none`). `Tweened` starts from `null` (skeleton) and glides from 0 on its first
   number; `data-settled` waits for beat two and every tween.
8. **The strip is a window over a history that fills in the background, bounded.** `historyAtom` holds rows by
   epoch; the window is `[from, from + 47]` from `?from=` (absent = the newest 48), kept in the URL together with
   `?epoch=`; `EpochMap` positions every bar by absolute epoch index over `[0, open]` (held rows drawn, missing ones
   as the rail), so nothing shifts as history arrives; ‹ ›, a click and a drag move `from`; a window not held is
   fetched at once (foreground, through the same `serial` queue as the poll) with its successor row for the seam
   (`window()` already reads `to + 1`); the table and the charts read the window; keyboard stepping takes `open`
   from `fixedAtom`, not from the last held row. `fillHistory` reads one 48-epoch page per poll interval,
   newest-first, serialized with the poll through `serial` (never overlapping), yields to a foreground window fetch,
   **stops for the visit** on the first throttle or silence (the page's own optional work must never be what raises
   the banner), and stops when epoch 0 is held; the unread span of the map is a hairline with the caption "older
   epochs are read a page at a time; the map fills over visits" — the cache carries what was read, up to its cap. The cache (`history-cache.ts`) holds
   closed rows only, keyed `yacana.epochs.v1.<chainId>.<rollupAddress>.<miner>.<endpoint fingerprint>` (the same
   SHA-256 of the normalised node URL as the PXE marker: a node's rows never outlive a switch, `/a` and `/b` on one
   origin are two nodes), as contiguous ranges of
   `[epoch, target hex, openedAt, claims]`, capped at 8192 rows and 512 KB of text (checked before parse and before
   write; quota errors caught and ignored); read once at boot and validated (safe integers, ascending by one inside a
   range, `1 ≤ target ≤ u128` as ≤ 32 bytes of hex, `0 ≤ claims ≤ N`, `openedAt` after the genesis and before now);
   any bad row drops the cache whole. The newest 96 epochs are never served from the cache (finality margin: reads are
   at `'latest'`), so a poisoned or stale tail is always re-read.
9. **Nothing can blank a page.** `TileBoundary` (`packages/ui`, a class component) wraps each cockpit tile, each
   stats tile, each landing section and each settings tile; the derivation a tile renders from happens inside the
   boundary (a tile reads its atoms itself); it renders `Alert variant="bad"` with a fixed text — "This tile hit an
   error. Try again, or reload the page." — and a "Try again" that remounts; the error goes to the diagnostics log
   (`logAtom` in the miner, `console.error` elsewhere) with its message cut at 300 characters (SDK errors can embed a
   node's whole response), never to the UI. The diagnostics copy prints the node's host, never its URL (a keyed RPC
   URL must not leak on paste). The explicit error states
   (`boot.phase === 'error'`, `status.phase === 'error'`) are untouched. The `ScoreLoop`'s animation frame runs in
   a try/catch: a drawing error stops the loop and paints the same fixed text into the canvas area (a boundary cannot
   see a `requestAnimationFrame` throw).
10. **The loop measures its margin.** `score-loop.tsx` `layout()` takes `ctx.measureText(label).width + 16` as the
    left margin (floor 28 with `geometry`, 48 otherwise; `frame()` sets `ctx.font` before it calls `layout()` —
    today the font is set later, in `drawCalmLines`); short strips
    draw ticks like tall ones; the baseline's "1" is skipped when the bar's line is within `1.2 × fontPx` of it
    (`labelsCollide(yBar, yBase, fontPx)` in the model, tested). Before the epoch is read no bar is drawn and the
    caption says "reading the epoch…" (today the cockpit passes `difficulty 1`, which parks the bar on the floor).

### Key interfaces

```ts
// packages/site/src/browser/node.ts
export interface NodeProbe { chainId: bigint; rollupVersion: bigint; rollupAddress: string; block: number; blockAgeS: number; latencyMs: number }
export function probeNode(url: string, expected: ExpectedDeployment, layout: StorageLayout): Promise<NodeProbe>;
export function parseNodeUrl(text: string, mode: SiteMode): URL;   // https only in production; no credentials, no fragment
export function switchableNode(url: string): { node: Node; use(url: string): void; current(): string };   // a Proxy over the current SDK client; functions bound at read time

// packages/site/src/browser/node-guard.ts — one interceptor per context, installed at import
export function setNodeOrigin(url: string | null, deadlineMs: number): void;   // one mutable cell; the gate answers 429 while throttled
export function classify(result: Response | unknown, startedAt: number, endpoint: string): HealthEvent;  // pure, tested directly; `endpoint` is the normalised URL the request went to
export function onNodeResponse(fn: (r: { startedAt: number; status: number | 'timeout' | 'network'; latencyMs: number }) => void): void;

// packages/site/src/browser/node-health.ts
export interface NodeHealth {
  transport: { kind: 'ok'; latencyMs: number } | { kind: 'throttled'; retryAt: number; status: 429 } | { kind: 'silent'; since: number; retryAt: number };
  lastReadAt: number | null;   // the pollers' last successful chain read
}
export function markRead(at?: number): void;
export function waitTurn(): Promise<void>;      // resolves when the endpoint is usable again: at retryAt if no recovery is in flight, else when the in-flight recovery settles (ok → resolve; failure → the new deadline)
export function allowCandidate(endpointUrl: string, deadlineMs: number): () => void;   // a probe's lease on the guard, by the complete normalised endpoint URL; its responses are not events
export function claimRecovery(): boolean;        // at a cooldown's deadline: true for exactly one caller, whose request goes to the network
export const endpointFingerprint = (url: string): Promise<string>;   // SHA-256 of the normalised URL (origin + path + query); the PXE marker and the cache key
export function useNodeHealth(): NodeHealth;
export function parseRetryAfter(header: string | null, now: number): number | null; // seconds, or null

// packages/web-miner/src/state.ts
type Boot =
  | { phase: 'preflight'; rows: PreflightRow[] }
  | { phase: 'signedOut'; records: MasterRecord[]; error?: string }
  | { phase: 'opening'; steps: OpeningStep[] }          // ui's Step + { bytes?: { loaded: number; total: number } }
  | { phase: 'ready'; account: string; threads: number; record: MasterRecord }
  | { phase: 'error'; message: string };
export const crsAtom: Atom<{ loaded: number; total: number; done: boolean; error?: string }>;
// packages/web-miner/src/session.ts
class Session { cancelOpening(): Promise<void>; /* the attempt and its AbortController are minted at the initiating key action; every alternate action is disabled until the attempt settles */ }
// packages/web-miner/src/boot.ts
export function startSession(store, pre, connection, record, master, signal: AbortSignal, publish: (steps: OpeningStep[]) => void): Promise<…>;
export const progressOf = (steps: OpeningStep[]): number;   // weights 5 · 5 · 70 · 15 · 5, the keys step's fraction from its bytes

// packages/web-stats/src/state.ts
export interface Fixed { block: Chain['block']; open: number; supply: bigint; genesis: Genesis; readAt: number }
export interface History { rows: Map<number, EpochRow>; lottery: Lottery | null; error?: string }
export const fixedAtom: Atom<Fixed | null>; export const historyAtom: Atom<History | null>;
export const windowAtom: Atom<{ from: number; to: number }>;          // from ?from= and fixed.open
// packages/web-stats/src/history-cache.ts
export function readCache(key: string): Map<number, EpochRow> | null;  // null on any bad row or over the caps
export function writeCache(key: string, rows: Map<number, EpochRow>, open: number): void;  // closed rows older than open − 96

// packages/ui
export function Skeleton(props: { className?: string }): JSX.Element;            // data-slot="skeleton"
export class TileBoundary extends React.Component<{ name: string; onError?: (e: unknown) => void; children }>;
export function NodeBanner(props: { kind: 'throttled' | 'silent' | 'stale'; ageS: number | null; retryInS: number | null; settingsHref: string }): JSX.Element | null; // plain values: ui must not import site's types (site imports ui)
export function Progress(props: { value?: number; indeterminate?: boolean }): JSX.Element;   // the indeterminate stripe is a prop, not a hand-rolled div
export const labelsCollide = (yBar: number, yBase: number, fontPx: number): boolean;
```

### Data & control flow

- **Boot (miner)**: load → the guard set to the saved node → `startCrs` (background) ∥ `preflight` (isolation →
  probe) → `signedOut` (the public epoch poll starts; the cockpit paints dull; the dialog opens) → the user takes a
  key action (the attempt and its `AbortController` are minted here, before the ceremony) → `startSession` (steps
  published; the keys step waits on `crsAtom`; the public poll stops when the controller's first read lands) →
  `ready`. Cancel at any step → cleanup → `signedOut`; a dismissal during the ceremony is inert.
- **Node switch**: Settings → Check (`probeNode(candidate)` under a lease) → Use (same identity required) →
  `saveConnection` returns whether the write held (today it swallows storage failures, `connection.ts:62-68`) — on
  failure a fixed message ("The browser refused to save the setting; free some site storage and try again.") and no
  switch — then the controller pauses (`'switch'`), the serial queue drains, `switchable.use(url)` + the guard's
  endpoint + the deadline + the health store move, the view is rebuilt when an account is open (steps in the
  dialog), the controller resumes; the stats and the landing pick the saved URL at their next boot (same origin, same key).
- **Health**: every node response → the store's transport; every successful chain read → `markRead`; the banner
  renders while transport ≠ `ok` or `now − lastReadAt` exceeds two poll intervals; the gate answers during a
  cooldown (no poller logic); a failed boot re-runs after `waitTurn()` (both failure kinds have a deadline).
- **Stats**: mount → 300 ms timer → beat one (`fixedAtom`) → beat two (`historyAtom` with the window) → `fillHistory`
  in the background (cache first, then one page per poll interval, newest first) → the map grows from the right.

### File-level change map

- `packages/site`: `src/headers.ts` (mode, `https:`), `src/config.ts` (drop the allowlist), `src/assemble.ts`,
  `src/vite-base.ts` (`e2e` mode headers), `site.env`, `src/browser/connection.ts` (drop the allowlist helpers), new
  `src/browser/node.ts`, `src/browser/node-guard.ts` (absorbs `node-deadline.ts`), `src/browser/node-health.ts`; tests
  beside each; the site E2E asserts the new header.
- `packages/ui/src/components/`: new `skeleton.tsx`, `tile-boundary.tsx`, `node-banner.tsx`; `score-loop.tsx`,
  `score-loop-model.ts` (+ test); `dialog.tsx` (a `hideClose` prop); `index.ts` exports; Vitest specs.
- `packages/web-miner/src/`: `boot.ts` (preflight split, `startSession` with the signal and steps, `progressOf` in
  `opening-steps.ts`), `session.ts` (the attempt, `cancelOpening`), `state.ts`, `pinned-crs.ts` (streamed `load`),
  new `public-epoch.ts`, new `features/SignInDialog.tsx`, `features/KeyScreen.tsx` (screens only),
  `features/WordsScreens.tsx` (wrapping), `features/LoopTile.tsx` (signed-out button; no bar before the epoch),
  `features/RailTile.tsx`, `features/use-page-behaviour.ts` (hotkeys off while the dialog is open), `session.ts`
  (`addSender` removed; the live switch's pause → drain → swap → rebuild → resume), `controller.ts` (the `'switch'`
  pause, the recover path reused),
  `components/BalanceCard.tsx`, `features/SendSheet.tsx` (the private-mode line), `routes/Settings.tsx` (Node tile;
  no Advanced tile), `components/ConnectionCard.tsx` →
  `NodeTile.tsx`, `routes/Wallet.tsx` (card removed), `App.tsx` (banner, boundaries), `prover.worker.ts` (the guard
  imported first), new `scripts/prebuild.ts` (with `copySlots`), package scripts; e2e helpers and specs.
- `packages/web-stats/src/`: `chain.ts` → `read-fixed.ts`, `read-window.ts`, `history-fill.ts`, `history-cache.ts`;
  `main.tsx` (the beats, the retry on cooldown), `state.ts`, `routes.ts` (`?from=`), `routes/Stats.tsx`,
  `features/Observatory.tsx`, `Strip.tsx`, new `EpochMap.tsx` + `map-geometry.ts` (pure), `Table.tsx` (no
  load-older), `ChartRows.tsx`, `charts/specs.ts` (empty-data axes), `Tweened.tsx`, `App.tsx` (banner, boundaries);
  specs; the visual recording (extended if the probe adds a call) and baselines.
- `packages/web-landing/src/`: `sections/Money.tsx`, `main.tsx` (retry on cooldown), `App.tsx` (banner, boundaries);
  the sections spec.
- `docs/` (the node setting, the cache key, the guard) and `CLAUDE.md`'s package table.

### Non-obvious mechanics

- **The guard's order**: in `main.tsx` and `prover.worker.ts` the globals shim stays first, then `node-guard.ts`,
  then `pinned-crs.ts`, then anything from the SDK; `pinned-crs.ts` captures `globalThis.fetch` at import, so the
  guard before it makes the CRS interceptor's fall-through the guarded fetch. A test imports them in that order and
  asserts an unknown origin throws through both.
- **Two clocks**: `transport` says whether the node is answering HTTP; `lastReadAt` says when the page last got usable
  chain data. A node returning 200 with errors keeps transport `ok` and lets `lastReadAt` age, which is what the
  banner's "N s old" reads; a 429 sets `retryAt`. `parseRetryAfter` accepts `^\d+$` (seconds) and an HTTP-date
  (`Date.parse`, future only); everything else is `null`.
- **Cancel**: the attempt generation is checked before every `store.set` in `startSession` (a stale attempt's writes
  are dropped) and the `AbortSignal` is awaited between steps; the keys step's wait on `crsAtom` is abortable; the
  cleanup is the same as a failed start plus the secrets' `fill(0)`.
- **Progress weights**: 5 · 5 · 70 · 15 · 5 (passkey, node, keys, notes, ready); the bar is the sum of the finished
  weights plus the current step's fraction — the keys step's is `loaded / total`; the notes step has no fraction and
  shows the bar's indeterminate stripe inside its slice (static half under reduced motion). A keys download that
  finished before sign-in shows ✓ with its time and the bar starts at 80.
- **Skeleton timing**: one `setTimeout(300)` per mount; at 300 ms each unresolved beat's placeholders switch from
  blank to skeleton; a beat that resolved earlier never shows one; a beat that resolves later replaces its skeleton
  (fast-first / slow-second shows the history skeleton for as long as the history takes).
- **The map's coordinates**: `open + 1` cells across the rail, cell `e` at `[e / (open + 1), (e + 1) / (open + 1))`
  of the width; held rows draw a bar, missing ones nothing (the rail shows through), so an arriving page never moves
  a bar; the window box spans cells `[from, min(from + 48, open + 1))` (exclusive end: a full window covers 48
  cells, epoch 0 alone covers one), the reader's inclusive `[from, to]` derived from it; exact widths asserted at
  open = 0, 1, 47, 48.
- **The cache** is written after each background page and at beat two, always excluding the newest 96 epochs — a
  margin, not a finality proof (reads are at `'latest'`); a node change changes the key (the endpoint fingerprint
  is in it), so a new node starts a fresh history. At the cap (8192 rows / 512 KB) the oldest ranges are evicted; beyond it the map's
  oldest span is a hairline each visit. "Complete over visits" therefore means: complete up to the cap, one page per
  poll tick, on visits the node does not throttle.
- **`measureText`** needs the font set first: `frame()` assigns `ctx.font` before `layout()`, every frame.

### Trade-offs & alternatives not taken

- **Save-and-reload on a node switch** (outline B's item 1; the audits' lean): codex read the SDK — the wallet
  caches `NodeInfo` for its lifetime, the PXE initialises a genesis hash and keeps cached reads, anchors and
  rollback state (`wallet-sdk/src/base-wallet/base_wallet.ts:170`, `pxe/src/pxe.ts:294-334`) — and warned that a
  switch between two calls of one sync or simulation mixes endpoints; fable read the same SDK and found every holder
  resolves methods at call time, so the proxy dispatches, and named the real risk (the per-rollup view) with its
  fix (rebuild on switch). The owner chose the live switch. What makes it safe: the probe's identity check keeps the
  cached `NodeInfo` true; the pause and the drain mean no operation straddles the swap; the rebuild throws the old
  view away, so nothing read against the old node survives. The residual risk is the same as the reload's: a
  malicious new node feeds the rebuilt view; the way out is another switch, which rebuilds again. The E2E for it
  runs two distinct endpoints (two forwarding proxies in front of the isolated node, with request counters and a
  stall mode), not two names for one.
- **Per-app 429 checks in the polls** (outline B's item 2): the SDK's RPC methods return decoded values, not
  responses (`foundation/src/json-rpc/client/fetch.ts:63-72`); the status is only visible at the fetch layer, which is
  where the guard already sits. Rejected; the shared store taken.
- **One beat** (outline B's item 3): removes an outcome the owner picked. Rejected.
- **The map from paging only** (outline B's item 4): never gives a complete first-visit map. Rejected; the fill taken,
  bounded to one page per poll interval and serialized with the poll.
- **The CRS behind the modal's disabled button** (outline B's item 5): changes the opening flow the owner chose.
  Rejected; the background download taken, with readiness still gating the wallet's and the prover's start.
- **A proxy Worker in front of the node** (one origin, CSP unchanged): puts the site's operator between every read
  and claim and does nothing for a throttled upstream. Rejected.
- **A second reader variant for the map** (openedAt + claims only): saves a third of the calls, adds a reader for one
  consumer; the cache makes it moot after the first visit. Rejected.

## Phases

Every phase ends with its validation gate; "green" means the gate as written. Renders at 1280 and 1440 beside the
artboards land at each arc boundary under `implementations-plan/yacana-third-pass/shots/arc-N/`. The fast layers
(`bun run lint`, the touched packages' `typecheck`, `bun test <package>`) run after every meaningful step. Functions
stay under Biome's budgets (cognitive ≤ 15, ≤ 80 non-blank lines): the decomposition above (`read-fixed`,
`read-window`, `history-fill`, `history-cache`, `opening-steps`, `map-geometry`) is how.

### Arc 1 · miner + site (`worktree-yacana-third-pass`)

**P1.1 · The node is a setting** ✓ (2026-09-08, `794e6d7`) — `connect-src https:` with the `e2e` / `dev` localhost forms; the allowlist and its
checks removed; `parseNodeUrl`; `probeNode` (with the rollup address); the fail-closed **guard** in the page and the
prover Worker, imported before `pinned-crs` (a static import-order test); the miner's node client without transport
retries and `redirect: 'error'` on guarded requests; `webrtc 'block'` (best effort); the miner's boot on them; the
**Node tile** as `HealthRow` + `CheckForm` (a reducer for the check states) + `NodeNote`, usable with no session,
with the candidate lease for Check; `switchableNode`; Use → the live switch (pause → drain → swap → rebuild →
resume; signed out, the swap alone); the rebuild-on-endpoint-change at boot (`yacana.pxe-view.*` keyed by the
endpoint fingerprint); the expected rollup address in the deployment record and `ExpectedDeployment`;
"Use the default node" on the three boot-error alerts; the miner and token inputs gone (the
e2e query overrides stay); `docs/threat-model.md` rows on the CRS control rewritten and `docs/` on the node setting.
Gate: `bun run lint` · `bun run --cwd packages/site typecheck` and `--cwd packages/web-miner typecheck` · `bun test
packages/site packages/web-miner` (new: `headers.test.ts` — production carries `https:` and no origin, `e2e` and
`dev` add the two localhost forms; `node.test.ts` — `parseNodeUrl` refuses http in production, credentials and
fragments; the probe refuses a wrong chain id, class id or rollup address; `node-guard.test.ts` — same-origin and the
node origin pass, any other origin throws, the deadline applies, and through `pinned-crs` an unpinned CRS host
throws, `data:` and `blob:` URLs pass, and bb.js's real browser loader fetches its bundled WASM under the guard;
`import-order.test.ts` — in `main.tsx` and `prover.worker.ts` the shim precedes the SDK and the guard precedes
`pinned-crs`, which precedes the SDK; the
connection tests without the allowlist; `node.test.ts` also: the proxy forwards every call to the current client
and `use()` moves it, a function read through the proxy is bound to the client of that moment; `boot`/`session` with
a fake wallet: a live switch pauses, drains the read queue, swaps, rebuilds through `resetAccountView`, writes the
marker after the rebuild and resumes; a changed endpoint fingerprint or a missing marker at boot opens through the
rebuild; a reset failure is a boot error and never reopens the old database; two paths on one origin are two
endpoints for the marker, the cache key and the guard; a guarded request carries `redirect: 'error'` even when the
caller asked to follow)
· Vitest `packages/web-miner` (the tile: Check shows the probe's line, a refusal in warn, Use is disabled until a
check passed, Use switches and shows the rebuild's progress, a storage write that throws (quota) shows the fixed
message and does not switch, the tile renders in `signedOut` and `error`) · `bun run e2e:agent -- bun run
site:e2e` (the `_headers` line carries `https:` and `webrtc 'block'`, and under the e2e mode the localhost forms).
Layers: lint/typecheck · unit · component · e2e (assembled site).

**P1.2 · Node health and the banner** ✓ (2026-09-08, `f99a0a5`) — the store (transport + freshness), `parseRetryAfter`, `waitTurn`,
`markRead`; `NodeBanner`; the three shells mount it; the pollers wait their turn and mark reads; the boots retry on
the cooldown; the visual recording extended if the probe adds a call.
Gate: lint · typecheck (site, ui, the three apps) · `bun test packages/site` (`node-health.test.ts`: a 429 with a
seconds header, with an HTTP-date, with garbage, with none → the backoff and its doubling and clamp; a success that
started before the 429 leaves the cooldown; a timeout → silent; three `TypeError`s inside a poll interval after
successes → throttled; an event from a stale origin is dropped; an ok clears transport; `markRead` ages
independently; `classify` directly; `200` headers with a body that stalls past the deadline count as one failure
reported once and hold the recovery until then; the gate answers a node-origin request with a synthetic 429 during
the cooldown
— `makeFetch([], false)` rejects with `NoRetryError` after one call, the node client built on it rejects once with a
plain RPC error, and neither call reaches the network or moves `retryAt`; a synthetic response is not an event; a
silent boot retries once after its deadline; during a silence the gate answers a synthetic 503 and at the deadline
exactly one of several concurrent callers (a poll and a PXE read arriving together) reaches the network while the
others keep the synthetic answer until its outcome; a candidate lease lets a probe of B pass while A stays active,
polling and throttled, with A and B as two paths of one origin, then as one path with two queries, then as `/a` and
`/ab`, and B's responses do not touch A's health; a boot that loses the recovery race waits through the recovery's
settlement and then proceeds on `ok` or waits the new deadline on failure) · Vitest `packages/ui` (the banner's two texts, the countdown, hidden when healthy) and
`packages/web-miner` (the shell shows the banner from a throttled store) · `bun run --cwd packages/web-stats
test:visual` (unchanged pixels; the recording covers any new call). Layers: lint/typecheck · unit · component ·
visual.

**P1.3 · The loop's margin and the pop-out** ✓ (2026-09-08, `063363a`) — `measureText` margin; ticks at every height; the baseline label
yields; `labelsCollide`; no bar before the epoch; the drawing try/catch.
Gate: lint · `bun test packages/ui` (`labelsCollide`; the margin helper given a width — jsdom has no canvas, so the
drawing itself is checked by eye in the renders) · **the owner's symptom reproduced first**: the miner on the isolated network (its target puts the bar at the floor) and the pop-out,
screenshots before and after under `shots/arc-1/`; if the "0" is something else, it is logged in `lessons/phase-1.md`
and fixed in this phase. Layers: lint/typecheck · unit · manual render.

**P1.4 · Boundaries and the senders' removal** ✓ (2026-09-08, `c4fa43d`) — `TileBoundary` around every tile and section of the three apps,
the derivations inside; the senders card, `Session.addSender` and the `registerSender` call go; `withdraw.e2e.ts`
loses the sender steps and keeps its strongest assertion — the recipient's balance rises — which proves the
capability was redundant (the delivery handshake); the Send sheet's copy stays.
Gate: lint · typecheck · Vitest `packages/ui` (a throwing child renders the fixed text, a sibling survives, Try
again remounts, the error reaches `onError`) and `packages/web-miner` (no sender input anywhere) · **arc boundary**: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` (the full miner suite,
with two forwarding proxies A and B in front of the isolated node — a Bun forwarder under `e2e/` with per-endpoint
request counters and a stall switch: a live switch A → B under an open words account while mining, loaded without
the `node=` pin, shows the rebuild, keeps the session, lands a claim after it, and A's counter stays flat from the
switch on; a switch to a stalled B raises the silent banner and the switch back to A clears it; the pop-out) · `bun run e2e:agent -- bun run
site:e2e` · renders at 1280/1440 of Settings and the banner beside `NodeSettings`, `NodeRateLimited`,
`RateLimitBanner`, `PopoutAfter`. Layers: lint/typecheck · unit · component · e2e (isolated network).

### Arc 2 · mine loading (`third-pass-mine`, stacks on arc 1)

**P2.1 · The chain before the account** ✓ (2026-09-08, `00cfb5e`) — the preflight without the CRS; `startCrs` streamed with bytes; readiness
awaited by the wallet's and the prover's start; the public epoch poll and its handover; `rulesAtom` from `PARAMS`;
`copySlots` in the miner's prebuild; the `Boot` shape.
Gate: lint · typecheck · `bun test packages/web-miner` (`pinned-crs.test.ts`: progress totals equal the pinned sizes,
a wrong hash still throws after streaming, the Worker's import order; `public-epoch.test.ts` with a fake node: the
poll fills the atom, stops on handover, never regresses the epoch number) · Vitest `packages/web-miner` (the cockpit
renders with the atom filled and no session). Layers: lint/typecheck · unit · component.

**P2.2 · The cockpit signed out and the modal** ✓ (2026-09-08, `P22HASH`) — the dull cockpit; "Sign in to mine"; the dashed claim slot; the KPI
dashes and subs; the ledger's opened line; the balance tile; `SignInDialog` hosting the key screens (scroll, no X,
wrapping, focus restore, hotkeys off); "Not now — just watch"; the E2E helper opens the dialog first and handles it
already open.
Gate: lint · typecheck · Vitest `packages/web-miner` (`cockpit.vitest.tsx`: signed-out shows the epoch's numbers,
both sign-in buttons open the dialog, Not now leaves it dull, the Welcome back variant with a saved record, the
a hotkey while open does nothing) · `bun test packages/web-miner` · a Playwright geometry check (jsdom cannot
prove layout): at a 480 × 720 viewport the backup, the quiz, the restore and their error states fit the dialog with
no horizontal overflow and the primary reachable by scroll — run in this phase against the dev server through `bun
run e2e:agent`, not deferred to the arc boundary. Layers: lint/typecheck · unit · component.

**P2.3 · Opening A** — the attempt and its cancel in `Session`; `startSession` on a `runStep(id, fn)` runner (as
`preflight`'s `run`) that publishes `steps`; the steps and the bar (`Progress` with `indeterminate` for the notes
step) in the modal; Escape and the overlay inert while opening; the shimmering balance behind; the header pill.
Gate: lint · typecheck · `bun test packages/web-miner` (`opening-steps.test.ts`: the weights, a finished keys step;
`session.test.ts` with a fake wallet: cancel during the wallet open, during registration, while waiting for the keys
and during prover start — each leaves no controller, a stopped wallet, zeroed secrets and `signedOut` with no
error; a dismissal attempt during the passkey ceremony is inert (the dialog stays, the ceremony completes or fails
on its own) while an explicit Cancel after it settles cancels; the primary and the alternate actions stay disabled
until the drain; a stale attempt's completion publishes nothing; a second sign-in after a cancel opens one PXE; a cancel
after the controller's first epoch write hands the atom back to the public poll and drops the disposed controller's
reads) · Vitest (the opening body's bar width from three step states; static under
reduced motion) · **arc boundary**: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` (passkey,
words, states, withdraw, burst on the new flow; a cancel mid-opening then a successful open) · renders at 1280/1440
of signed-out, watching and opening beside `MineSignedOut`, `MineWatching`, `MineBootA`. Layers: lint/typecheck ·
unit · component · e2e (isolated network).

### Arc 3 · stats + landing (`third-pass-stats`, stacks on arc 2)

**P3.1 · The skeleton and the two beats** — `Skeleton`; `read-fixed` / `read-window`; `main.tsx`'s beats;
`fixedAtom` / `historyAtom`; every tile, chart and the table with `null`; the per-beat 300 ms rule; the header pill;
`Tweened` from null; `data-settled` waits for beat two.
Gate: lint · typecheck (ui, web-stats) · `bun test packages/web-stats packages/ui` (the beat order; beat one
published when the history fails; the settled rule; the timer's fast-first / slow-second case) · Vitest
`packages/web-stats` (the page renders every tile with both atoms null; beat one fills minted and the pill; the
skeleton has no animation under reduced motion; charts draw their axes with no data) · `bun run --cwd
packages/web-stats test:visual` (the recording answers at once so no skeleton is in frame; the baselines regenerate
in the pinned image after each intentional visual change — here if a wrapper moves a pixel, and again in P3.2 for
the map — each regeneration committed with the change that caused it).
Layers: lint/typecheck · unit · component · visual.

**P3.2 · Strip A** — the window from `?from=` kept with `?epoch=`; `EpochMap` as `barsFor(rows)` (pure) +
`useDragWindow` + `DayAxis`; ‹ ›, click and drag; a missing window fetched at once; the table and the charts on the
window; `history-fill` as `pageLoop` / `persist` over `readCache`, paced, serialized, stopping for the visit on the
first throttle; the hairline for the unread span; `history-cache` with its caps and validation; `load-older` gone.
Under the E2E the 31-epoch fixture sits inside one window and the isolated deployment is young, so the fill, the
stop and the drag are proven by the unit and component tests, not end to end — said here so nobody looks for it.
Gate: lint · typecheck · `bun test packages/web-stats` (`routes.test.ts`: `from` clamping and paging, `from` and
`epoch` together; `map-geometry.test.ts`: absolute positions, a page arriving moves nothing; `history-cache.test.ts`:
round trip, each validation rule drops the cache, the row and byte caps, a quota error is swallowed, the newest 96
never written; `history-fill.test.ts` with a fake reader and a fake health store: one page per interval, newest
first, stops for the visit on a throttle, yields to a foreground window, stops at epoch 0, the request count per
page is 48 × 3 + 3 methods, and the HTTP request count is measured through the real SDK client, not a fake) · Vitest (the map's bar count, the window box, ‹ › disabled at the ends, a click moves the window,
keyboard stepping at a historical window) · `bun run --cwd packages/web-stats test:visual` with the baselines
regenerated in the pinned image and committed with the map. Layers: lint/typecheck · unit · component · visual.

**P3.3 · The money table** — the `tbody` selector; the landing's banner and boundaries from P1.2/P1.4 verified in
place.
Gate: lint · Vitest `packages/web-landing` (the last `tr`'s cells are the ones the selector reaches; no cell carries
`last:`) · **arc
boundary**: `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e` (the fixture: a delayed route shows the
skeleton at 400 ms and fills; the map fills from 31 epochs; a `?from=` link; the live deployment) · `bun run
e2e:agent -- bun run --cwd packages/web-landing test:e2e` (the last row's cells have a computed bottom border of 0
and the row above does not) · renders at 1280/1440 of the stats skeleton (the mocked node delayed), the settled page
and the landing's money section beside `StatsSkeleton`, `StripA`, `MoneyAfter`. Layers: lint/typecheck · component ·
e2e (isolated network).

## Validation layers

lint/typecheck (Biome, the per-package `typecheck` scripts) · unit (`bun test`) · component (Vitest + RTL,
`*.vitest.tsx`) · visual (the stats screenshot gate in the pinned Playwright image) · e2e-isolated (Playwright on the
isolated local network through `bun run e2e:agent`, at arc boundaries; the assembled-site E2E once on arc 1). No
testnet layer: nothing here touches chain behaviour.

## Security & Adversarial Considerations

- **Threat model.** The page's trust boundary is the node URL the user pastes and the browser storage the page
  reads. A node answers what the page asks: it can lie about numbers (wasted proving work), delay or hide notes and
  blocks (a claim that never lands, a balance that never appears), serve a divergent chain view (the PXE's synced
  state goes stale until a reopen), falsify simulations and fee estimates, and **correlate** — the wallet's
  tag-query and simulation traffic (`simulationOrigin = from`) tells the node which account is active. It cannot
  sign or spend: claims and sends are proved in the browser, the fee payer is the locally derived sponsored FPC
  (`wallet.ts:68-74`), and the secrets stay local (the master is held in memory by `Session` for the account's
  derivation and zeroed on cancel or sign-out; nothing is sent). Storage (`yacana.connection`, `yacana.epochs.*`) is
  same-origin; whoever can write it already runs script on the origin.
- **The CSP change.** `connect-src` goes from one origin to `https:`. What it keeps: `script-src 'self'
  'wasm-unsafe-eval'` with no inline scripts and `script-src-attr 'none'` (no remote script can run; a script that
  runs is the bundle's or a compromised dependency's), `img-src 'self' data:` (no image exfiltration, before or
  after), no frames, objects, forms or base URI. What it loses, on the origin that holds the vault's sealed secrets
  and device key (`keys/store.ts`): the bound on where a script already running can send data over HTTPS, and the
  bound on WASM bytes such a script could fetch and compile. Navigation was and is an exit (loud); WebRTC is a
  silent one that `webrtc 'block'` closes where a browser enforces the directive (Chromium does not list it today,
  so this is best effort); a silent HTTPS channel is a real widening across all three apps. Accepted as the price of the owner's ask; what the code adds back
  is the **guard** (every request that is not to the page's origin, the active endpoint or a leased candidate throws,
  in the page and the Worker) — a bound on the SDK's and
  bb.js's fetches and a fail-closed CRS, not an XSS bound (an injected script can replace `fetch`).
- **The CRS fail-closed property.** `pinned-crs.ts` relied on the CSP to make an unpinned CDN fetch fail
  (`:1-3`; `headers.test.ts:37-42` pins that the policy names no `crs.` host; `docs/threat-model.md:40-41,49` states
  the control). With `https:` the CDN (`crs.lock.json:2`) is reachable again by policy; a context that created a
  Barretenberg without the interceptor would fetch unverified CRS — a proof-validity loss, not a key loss. The guard
  restores the failure in code in both contexts, the import-order test keeps the interceptor first in every prover
  entry, `headers.test.ts` pins `https:` and the absence of any `http:` form in production, and the threat-model rows
  are rewritten to name the guard as the control. The cache purge before bb.js initialises is unchanged.
- **The URL field.** `parseNodeUrl` requires a parseable URL, `https:` in production (`http://localhost` and
  `http://127.0.0.1` in `e2e` and `dev`), no credentials, no fragment; the host is shown back. Check is a
  **deployment-consistency** check (chain id, rollup version, both class ids, the miner's bound token, the rollup
  address the PXE namespace is keyed by — `wallet.ts:35-38`), answered by the node under test; it authenticates
  neither the chain nor its headers. The tile's copy says what a node can and cannot do (see the spec).
- **The switch** is live, and the account's chain view is rebuilt as part of it: the PXE's store is per rollup, its
  synchroniser anchors on a node's tips, and a lagging or lying node can prune or poison a view that would otherwise
  survive (`block_synchronizer.js:41-128`, `l2_block_stream.js:82-110`); the rebuild (`resetAccountView`)
  rediscovers notes from the new node. The controller is paused and the read queue drained before the client moves,
  so no operation straddles two endpoints; the probe's identity check (chain id, rollup version, rollup address,
  class ids, bound token) keeps the wallet's cached `NodeInfo` true; a boot that finds the saved endpoint differing
  from the view's marker rebuilds too. The fee
  payer is fixed locally (the sponsored FPC is derived from a constant salt, `wallet.ts:68-70`) while the fee inputs
  are node-dependent (the gas limits are read from the node once at open, `:74`): a lying node can make a claim fail
  or grief the sponsor's max fee, not spend.
- **The banner's countdown** comes from `Retry-After` when readable (delta or HTTP-date, validated), else the
  backoff; clamped to [5 s, 120 s]; a hostile header cannot pin the page or shorten it below the floor.
- **The cache** is keyed by the deployment's identity and the node's endpoint fingerprint (chain id, rollup address,
  miner, the hashed normalised URL), versioned, capped in rows and bytes before parse and write, validated field by field on read and dropped
  whole on a bad row; it never feeds the newest 96 epochs or a claim. A lying node's rows live only under that
  node's key: switching nodes starts a fresh history; staying on a lying node shows what it says, which is the
  user's choice and is said in `docs/`.
- **The error boundary** shows a fixed text, never `error.message` (the diagnostics shortener keeps prose, words and
  paths: `diagnostics.ts:1-2`); the error goes to the log, its message cut at 300 characters; the diagnostics name
  the node's host, not its URL.
- **Least privilege / supply chain / crypto**: no new dependencies; no new workflow permissions; no cryptography
  touched (the CRS hash check runs on the streamed bytes exactly as before).
- **Frontend risks**: XSS — none new (strings through React; the URL is rendered as text); clickjacking —
  `frame-ancestors 'none'` unchanged; the dialog traps focus and closes on Escape (Radix); the banner's link is an
  in-app route; the hotkeys are off while the dialog is open.

## Assumptions

**Facts** (verified in the tree at `f7e2ad4`; see `recon.md` for the rest)

- F1 `headers.ts:15,22` builds `connect-src 'self' data: <nodeOrigins>`; `config.ts:100-104` throws when the default
  node is outside `VITE_ALLOWED_NODE_ORIGINS` and `assertProductionConfig` iterates the allowlist (`:175`);
  `connection.ts:86-96` re-checks at runtime; `helpers.ts:27-28` pins every E2E page by query and
  `ConnectionCard.tsx:14,38` disables the tile when pinned; `vite-base.ts:94,147` give
  the `e2e` preview build production headers, and `e2e/run-setup.ts:22-37` allowlists the isolated node and a mock
  origin (`http://127.0.0.1:1`).
- F2 `boot.ts:96-126` probes `getChainId` / `getNodeInfo` / `getBlockNumber` and runs `assertDeployment` before any
  key exists; `startSession` reads the rules (`readEpochRules`) and the epoch only through the wallet;
  `session.ts:80-88` stores the master and the words before awaiting `startSession`.
- F3 `pinned-crs.ts:1-3` states the CSP is what makes an unintercepted CRS fetch fail; `:64-70` fetches whole
  buffers; the pinned hashes are checked after download; `wallet.ts:35-38` keys the PXE namespace by chain id,
  rollup version and the rollup address; `:41-52` already wraps the node in a `Proxy`.
- F4 `readEpochs` (`reader.ts:242-278`) is three sequential storage reads per epoch, eight in flight; `readGenesis`
  is three reads (`:301-…`); `WINDOW = 48`; `readChain` reads the open epoch and the block, then the window, then
  supply, genesis and lottery (`chain.ts:87-115`); `main.tsx:49-82` installs the poll only after a successful boot;
  `Stats.tsx:32` renders nothing while `chainAtom` is null; `serial.ts` serializes chain reads.
- F5 `Strip.tsx:59-61` sizes cells by duration / 6 clamped [6, 400] as flex weights and labels a cell when its
  container is ≥ 24 px (`:89`); `:29-41` steps with the last held row as the open epoch; `routes.ts:39-52` keeps
  `?epoch=`; `Table.tsx:148` carries `load-older`.
- F6 `score-loop.tsx:232-235` pins `left = 28` when `geometry` is given and draws the calm labels right-aligned at
  `left − 8`; `frame()` calls `layout()` (`:262`) before `drawCalmLines` sets the font (`:147`); short strips
  (`h ≤ 80`) draw dots (`:216-221`); `LoopTile.tsx:133` passes `difficulty 1` before the epoch is read; nothing in
  the repo calls `measureText`. At 10 px mono a four-character label right-aligned at x = 20 starts at −4: a clipped
  "10.0" reads "0.0" — the likelier pop-out cause of the "0".
- F7 `Dialog`'s overlay is `bg-ground/70 backdrop-blur-[2px]`; `DialogContent` (`dialog.tsx:29`) always renders a
  close button and has no scroll of its own; `Progress` exists and is unused; `Stepper` exists; `Alert` has `warn`
  and `bad`; the three shells render the preview notice with `data-testid="preview-banner"`;
  `use-page-behaviour.ts:22-53` binds space, `[`, `]`, `w`, `,` on `window`.
- F8 `Wallet.tsx:117-149` is the only sender UI; `session.ts:229-232` the only `registerSender` call;
  `withdraw.e2e.ts:22-34` the only test of it (both go with the capability). `Money.tsx:5` applies `border-b` to every cell. `WordsScreens.tsx:9,
  28,120` lay the backup and the quiz in three-column grids.
- F9 No error boundary exists; no test asserts the opening strings, `boot-step` or the Network tile's copy;
  `controller.ts:30,318-335` pauses mining after `OFFLINE_AFTER_MS` (60 s) without a successful read.
- F10 The stats visual gate replays a recording that answers instantly (`visual-rpc.json`), rejects unrecorded
  RPCs (`visual.e2e.ts:23`), four widths, zero tolerance.
- F11 The SDK's RPC client decodes responses below the app (`foundation/src/json-rpc/client/fetch.ts:41-72`): an HTTP
  status is visible only at the fetch layer; `createAztecNodeClient` retries retryable failures (a malformed or
  non-JSON error body) three times by default (`stdlib/dest/interfaces/aztec-node.js:371-376`) while the stats reader passes `makeFetch([], false)`
  (`chain.ts:44`); the SDK's node holders resolve methods at call time (`benchmarked_node.js:30-45`,
  `caching_aztec_node.js:16-118`, `block_stream_source.js:7-35`), and the PXE's synchroniser anchors on tips and
  rolls its stores back on a prune (`block_synchronizer.js:41-128`).

**Inferences** (unverified; the audits should attack them)

- I1 *(revised)* A reload after "Use this node" rebuilds every holder of the node on the new URL through the boot
  that exists, and the rebuild-on-node-change reopens the account through `resetAccountView`, so no PXE view built
  on one node is ever read against another; nothing persists a node URL other than `yacana.connection` and the new
  `yacana.pxe-view.*` marker.
- I2 *(revised)* The words backup and quiz grids fit 428 px of content width with `flex-wrap` on the action rows and
  `max-h-[85vh] overflow-y-auto` on the dialog; tested at 480 × 720 in P2.2.
- I3 The owner's "0" is the bar's label colliding with the baseline's when the bar sits at the floor (`difficulty 1`
  before the epoch is read; a near-1 target on a fresh network). Plausible, not proven: P1.3 reproduces the symptom
  before and after, and logs anything else it finds.
- I4 A public node's 429 carries no readable `Retry-After` (not CORS-safelisted); the backoff is what the page will
  use in practice.
- I5 *(revised)* One 48-epoch page (147 RPC methods at 8 lanes; the SDK batches concurrent methods into fewer HTTP
  requests — `safe_json_rpc_client.ts:130` — so the transport count is lower and is measured through the real SDK
  in P3.2, method and request counts both) per 30 s poll interval, serialized with the poll, may
  still be more than the default public node tolerates (the owner's report says the first window alone draws a 429
  at times); the fill therefore stops for the visit on the first throttle or silence, the map says so with a
  hairline, and the cache completes it over visits. Request counts are asserted in P3.2's unit tests; the testnet is
  watched in the first hour after deploy.
- I6 *(revised)* The `e2e` header mode with the two localhost forms keeps every existing E2E (the isolated node, the
  mock origin `http://127.0.0.1:1`, the assembled-site run) working under production's other headers.
- I7 A Radix `Dialog` kept open through the opening steps behaves with focus trapped and the page's hotkeys
  disabled; while signed out Escape, the overlay and "Not now" are one action (dismiss); while a key action or the
  opening is in flight Escape and the overlay are inert and only Cancel cancels.
- I8 The keys step's wait on `crsAtom` and the public poll's handover introduce no race with the controller's first
  read: the poll stops on the first `epochAtom` write by the controller (generation-tagged), and the controller never
  regresses the epoch number (`controller.ts:341-343`). The controller publishes the epoch before the opening is
  done (`:343`), so a cancel or a failure after that write hands the atom **back**: the public poll restarts and the
  disposed controller's reads are dropped by generation; P2.3 tests a cancel after the takeover.

**Asks** (the owner decides at the gate)

- A1 *(decided: drop it)* The senders capability goes entirely — the card, the Advanced row, `addSender`, the
  `registerSender` call; no migration or replay of registered senders; the Send sheet's private mode says what that
  means.
- A2 The banner on the stats page and the landing links to `/mine/settings` (they have no settings of their own).
- A3 The docs link on the Node tile: the Aztec docs' "run a node" page (an outbound `rel="noopener"` anchor).
- A4 *(decided: live switch)* The node switches in place — the proxy, the pause and drain, the rebuild of the view
  through the existing recover path, the resume — as the canvas said; the audits' lean to a reload is recorded in
  the ledger with the reasons, and the E2E runs the switch between two distinct endpoints.
- A5 **The sign-in dialog keeps every action today's key screens have**, per screen: the fresh-account screen
  "Sign up with a passkey" (primary, `create-passkey`), "Use twelve words instead" (`use-words`: creates a words
  account), "I already have a passkey" (`restore-passkey`) and "I have twelve words" (`restore-words`: restores
  one); Welcome back: Open (primary, `open-key`), "Use another passkey", "Enter twelve words instead"
  (`restore-words`), "Create a new account" (`create-new-key`); the words entry: Open (`words-open`) and Back. The
  canvas drew the two most used ("Sign up with a passkey", "I have twelve words"); the rest stay
  as `ink-3` links in the same row, since `words.e2e.ts` and `withdraw.e2e.ts` use them and a returning user with a
  second device needs them. Approve, or name the ones to drop and the specs get rewritten.
- A6 **The first-visit map is partial by design**: it fills one 48-epoch page per poll tick, stops for the visit on
  the first throttle or silence, and is carried between visits by a capped cache (8192 rows); the unread span is a
  hairline with a caption. The canvas drew the map complete. Approve the bounded version.

## Decision ledger

| decision | taken | rejected | source |
|---|---|---|---|
| Node switch | **live** (owner's decision at the gate): `switchableNode` proxy + pause → drain → swap → rebuild (`resetAccountView`, the recover path) → resume; the endpoint marker still guards boots after a switch made elsewhere | save-and-reload (codex r1/r2 lean: mid-operation mixing, a healthy same-node E2E proves nothing); fable r1 had the proxy dispatching and asked for the rebuild-on-switch, which is what ships | codex r1 High; fable r1 A1 High; owner A4 |
| Dead saved node | every boot-error alert offers "Use the default node" and links `/mine/settings/`; the tile works with no session | leaving the banner as the only way out (it is not mounted when boot fails) | fable r1 Asks |
| Guard as gate | the fetch guard answers a synthetic 429 during a cooldown (covers the PXE's reads); no per-poller `retryAt` checks; opaque `TypeError` bursts count as throttling; the miner's client without transport retries | pollers consulting `retryAt` | fable r1 A4/A5; codex r1 C (one interceptor) |
| CRS control | the guard + an import-order test + `headers.test.ts` on `https:` + threat-model rows rewritten | "no cryptography touched" as the whole story | codex r1 High; fable r1 A2 |
| WebRTC | `webrtc 'block'` added | — | fable r1 A3 |
| Sign-in affordances | every action of today's screens kept, per screen (A5) | the canvas's two | fable r1 I2 / Asks; codex r3 |
| Fill on a throttle | stop for the visit, hairline, the cache completes it | pause and resume | fable r1 I5 |
| Cache key | + the endpoint fingerprint | deployment identity only; the origin; a per-visit spot check | fable r1 A6; codex r3 |
| PXE view identity | the endpoint fingerprint (normalised URL, hashed) for the marker, the cache key and the guard's leases; a missing marker → rebuild; a reset failure → boot error | the origin; the lost-race reopen fallback | codex r2 High ×2, r3 High |
| Cooldown gate | both failure kinds gate (synthetic 429 / 503); `claimRecovery` gives one caller the network at the deadline | `waitTurn` releasing every caller at once | codex r3 Medium |
| Map end | `[from, min(from + 48, open + 1))` | `min(from + 47, open)` as exclusive | codex r3 Medium |
| Guard and WASM | `data:` and `blob:` pass; bb.js's loader tested under the guard | "everything else throws" | codex final High |
| Sender migration | moot: the capability is dropped (A1); nothing is migrated or replayed | the PXE's persisted tagging sources through an adapter (codex final, correct while the capability existed) | owner A1 |
| Outcome timing | reported on body completion; recovery held until then | on `fetch` resolving | codex final Medium |
| Handover | ownership returns to the public poll on a cancel or failure after the controller's first write | takeover only | codex final Medium |
| Persistence | `saveConnection` reports success; the switch runs only then | switching regardless | codex final Medium |
| CI | `bun test packages/web-stats` added to `web-stats.yml` | assuming the suites run | codex final Medium |
| Check while open | a candidate lease on the guard, its responses not events | swapping the active origin for the probe | codex r2 High |
| Cooldown feedback | only real outcomes are events; `silent` has its own deadline and one recovery attempt | synthetic 429s as events | codex r2 High |
| Expected rollup address | from the build (the deployment record, amended once for testnet) | from the current node | codex r2 Facts |
| Redirects | `redirect: 'error'` on guarded requests | checking `response.url` | codex r2 Medium |
| Banner and claims | "a claim sent now would fail" | "a claim waits" | codex r2 Medium (the controller fails a rejected send) |
| Map | `open + 1` cells, exclusive window end, tests at 0/1/47/48 | `epoch / open` | codex r2 Medium |
| Cache honesty | the 96-epoch tail a margin; eviction at the cap; "fills over visits" (A6) | "immutable", "complete" | codex r2 Medium |
| 429 detection | one fetch-layer store shared by the three apps, transport and freshness separated | per-app checks in the polls | codex r1 (the SDK decodes responses below the app); the "stalled" state of the canvas note dropped for `lastReadAt` ageing |
| CSP | `connect-src https:` (owner's pick) + the fail-closed fetch guard in page and Worker; `e2e`/`dev` keep the localhost forms | an allowlist; a proxy Worker | codex r1 High ×2 (the CRS relied on the CSP; the E2E preview build needs local origins) |
| Stats loading | two beats, per-beat 300 ms rule | one beat | owner's pick; codex r1 Medium on the timer |
| Map data | background fill, one page per poll interval, serialized, paused on 429, cache keyed by deployment with caps and validation, the newest 96 never cached | paging only; chain only; a lighter reader | codex r1 Medium ×2 |
| CRS | out of the gate, readiness still awaited by the wallet and the prover | behind the modal's disabled button | owner's flow (Opening A); codex r1 table |
| Cancel | an attempt with an `AbortSignal` owned by `Session`; superseded writes dropped; secrets zeroed | Cancel as a UI-only close | codex r1 High |
| Error text | fixed text; the error to the log | `error.message` through the shortener | codex r1 Medium |
| Money rule | `[&>tr:last-child>td]:border-b-0` on `tbody` | `last:border-b-0` on cells | codex r1 Medium |
| Senders | dropped entirely (owner's decision at the gate); the E2E proves a private transfer between two Yacana accounts is found with no sender registered (the first-contact handshake), so nothing is lost | a row under Settings → Advanced (the canvas); a warning line in the Send sheet (drafted, then disproved by the E2E); migrating and replaying registrations across rebuilds (codex r2/r3/final, now moot) | owner A1 |

Disputed / open after rounds 1–4 and the fresh pass (codex round 4: conditional approve, both conditions folded in — the complete endpoint URL as the identity everywhere, `waitTurn` awaiting an in-flight recovery; the fresh pass: reject on two SDK facts — the WASM `data:` loads and the address book's source — both folded in above): the node switch's shape — fable wanted the live switch with a rebuild, codex the
reload; the plan takes the reload with the rebuild (both audits' safety property, neither's transition risk) and
puts the copy change to the owner (A4). Round 2 (codex resumed on the revision) and the final fresh pass are
recorded in `audit-codex.md`; their verdicts in Approval.

## Delivery

| arc | branch | phases | stacks on | code_review |
|---|---|---|---|---|
| 1 miner + site | `worktree-yacana-third-pass` | P1.1–P1.4 | main | off |
| 2 mine loading | `third-pass-mine` | P2.1–P2.3 | arc 1 | off |
| 3 stats + landing | `third-pass-stats` | P3.1–P3.3 | arc 2 | off |

`gh stack init --adopt worktree-yacana-third-pass` at the start (the worktree's branch, off `origin/main` `f7e2ad4`,
becomes layer 1; not renamed, so the `agent-worktree` manifest row stays true); at each boundary, after the arc's
codex loop converged, `gh stack add <next>`; `gh stack push` for checkpoints (after the fast gates, never before).
PRs exist only at Delivery: `gh stack submit --auto --open`, then `gh pr edit` each body with the gate lines, the
codex rounds and the 1280/1440 renders beside the canvas artboards (committed under
`implementations-plan/yacana-third-pass/shots/<arc>/`, referenced by raw URL). Every push, at a boundary or at
Delivery, follows the same order: `gh stack rebase` (never `sync`, which pushes as part of its rebase) → the affected
arcs' fast gates → `gh stack push`; then `gh pr checks --watch`. The owner merges (`gh stack merge`) and deploys
(`bun run site:deploy`); the agent never deploys production.

## CI

No new workflows. `web-stats.yml` gains one step, `bun test packages/web-stats` (today it runs only three
miner-core suites, `web-stats.yml:49`, so the new cache, scheduling and geometry tests would never run in CI); the
site's workflow covers `headers.test.ts` and the new `node*.test.ts` (checked when the phase lands; a missing step
is added the same way); `web-stats.yml`'s `visual` job compares the regenerated baselines; the miner's workflow picks
up `scripts/prebuild.ts` through its existing `packages/web-miner/**` filter. `bun run lint:actions` runs before any push that touches `.github/`.

## Post-implementation

Executed by the implementing session from this section alone.

1. **`/code-review`: not run.** `code_review` is `off`; do not add it.
2. **At each arc boundary** (the arc's phases green, before `gh stack add`): send codex (`/codex high`, GPT-6 Astra)
   the arc's diff (`git diff <arc base>..HEAD`), this plan and its decision ledger, the arc map ("this is arc N of 3;
   later arcs build X on it"), the adversarial / security ask ("What could go wrong? What would an attacker target?
   What are we trusting that we shouldn't? Where are the supply-chain / crypto / least-privilege weaknesses?"), the
   1280/1440 renders beside the artboards (the skill scripts take no images: mirror the script's `codex exec` call
   by hand with `-i <png>` per image, same model, effort and session dir), and the two rules below verbatim.
3. **Iterative fix loop**: verify codex's factual claims against the repo; apply the accepted fixes; commit; log the
   round (consult + verdict) in `lessons/phase-N.md`; **resume the same codex session** with the fix diff and ask for
   a re-review under the same rules. Repeat until a round yields no new material findings; rejected nitpicks are not
   churn. Still material after 3 rounds → stop and surface to the owner.
4. **After all three arcs**: one **final cross-arc pass** — a FRESH codex session over the net diff from `f7e2ad4`,
   asking for seams between arcs, duplication across arcs and drift from the plan, the same loop until clean.
5. **Delivery** per the section above: the first and only time PRs are opened. Then `implementations-plan/index.md`
   gets the completed marker and the manifest row `done: PRs #…`.

**The no-over-engineering rule** (verbatim in every codex prompt, initial and resumed): *"Report bugs and small,
targeted improvements only. Do not propose speculative abstractions, extra configuration surface, new layers, or
rewrites — the smallest change that fixes each real problem. If code works and is clear, leave it alone."*

**The comment-quality rule** (verbatim, same treatment): *"Audit the comments for value per character. Flag any
comment that narrates what the code visibly does, restates its line, references implementation plans / phases /
reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious invariant or constraint
deserves a comment it doesn't have. Comments are permanent context every future reader, human or LLM, pays to
re-read: they must be few, dense, and exact."*

Failure-retry policy: 3 failures on one step with the owner present, 5 under `/loop` or `/goal`, then stop and
reassess with codex. Hard limits: never merge, never deploy, never widen scope beyond this plan; the CSP line is the
plan's, not a knob.

## Approval

ELI5 companion: `implementations-plan/yacana-third-pass/eli5.html`, published as the Artifact **Yacana Third Pass**
(https://claude.ai/code/artifact/2e6e0475-a801-4017-8772-5d5243d7b99f; redeploying the same source file keeps the URL).

Verdicts (transcripts in `audit-codex.md`, `audit-fable.md`):
- codex round 1 (Astra high, session `01a081ee`): `reject` (five blocking findings) → all folded in.
- fable round 1 (Fable 5.1 Plan agent): `conditional approve` (nine conditions) → all folded in.
- codex rounds 2–3 (resumed): `reject` (precision and consistency of the revision) → folded in; round 4:
  `conditional approve (with conditions: unify full endpoint identity across guard, leases and health; make recovery
  waiters await the in-flight recovery outcome)` → both folded in.
- codex final, fresh context (session `01a0821c`): `reject` on two SDK facts (the guard vs bb.js's `data:` WASM
  loads; `getAddressBook()` as the migration source) → folded in; follow-up on the same session: **`approve`** (one
  note on A4's wording, applied).

Owner's decision (2026-09-08): **approved** with A1 = drop the senders capability, A2 ok, A3 ok, A4 = the live
switch ("doable without any weird hacks"), A5 approved, A6 approved. The plan above is the approved scope; the
seeds below are final.

## Seeds

Drafts until approval; finalized after it (below, replaced in place).

### /goal (recommended)

```
/goal All phases marked ✓ in implementations-plan/yacana-third-pass/plan.md (the per-phase headers in the file — not the chat, not the task list), each ✓ backed by its phase's validation gate (as defined in plan.md) reported passing in the transcript; for each phase the agent has printed `LESSONS_FILE=implementations-plan/yacana-third-pass/lessons/phase-N.md` in the transcript; `/code-review` was NOT run (code_review is off); the codex fix loop converged for EVERY reviewed diff — each of the three arcs at its boundary plus the final cross-arc pass — each convergence evidenced by a resumed codex pass reporting no new material findings, quoted in the transcript; the Delivery section's PR topology exists on GitHub, created only AFTER all loops converged (`gh stack view` output in the transcript), each PR body linking the 1280/1440 renders beside the canvas artboards; `bun run lint` and `bun test` both report exit 0 in the transcript.
```

### /loop 15m (alternative)

```
/loop 15m Drive implementations-plan/yacana-third-pass forward. Never idle waiting for my input. Each firing: (1) read plan.md and lessons/ (authoritative state), rebuild the task list from plan.md if empty, `git status`, `git log --oneline -5`, and `gh stack view` if a stack exists; (2) waiting on CI is fine if it is progressing (`gh run watch` up to 10 min), use the wait to prep the next phase; (3) no task in hand → take the next pending phase, after each meaningful edit run `bun run lint` and the touched packages' tests and `typecheck`, commit, `gh stack rebase` → fast gates → `gh stack push`; (4) stuck or facing a decision → `/codex high` with full context, decide, act, log the consult in lessons/phase-N.md; hard limits stay hard (never merge, deploy, push to main, or expand scope beyond plan.md; the CSP line is the plan's, not a knob); (5) same step failed 5 times → stop and reassess with codex; (6) phase green means its validation gate in plan.md passes: run it, paste the result, mark ✓, print `LESSONS_FILE=…`, `agent-worktree status yacana-third-pass "phase N green: <next>"`; arc boundary → the codex loop with the arc map, the renders and the plan's two rules until a round yields nothing material, then `gh stack add <next-arc-branch>`; (7) all phases ✓ → the final cross-arc codex pass (fresh session, net diff from f7e2ad4), then Delivery per plan.md (`gh stack submit --auto --open`, `gh pr edit` bodies, `gh pr checks --watch`), then the wrap-up report; surface and stop.
```
