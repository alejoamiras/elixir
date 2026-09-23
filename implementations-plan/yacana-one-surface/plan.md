---
plan: yacana-one-surface
tier: mid
driver: claude-code
eli5_mode: artifact
code_review: off
hardening: none (no new trust boundary; the hosted Stats reads only what the miner's guard already admits — the realm it joins is recorded in §4)
budget: "recon 3 agents (Stats mapper, miner sweep, landing and Stats sweep); codex at high (GPT-6 Astra); the Claude leg on Opus 5.5 (the owner prefers it to Fable); code-review off (owner, 2026-09-23)"
status: drafted 2026-09-23; round-1 audits folded (codex reject → reworked; Opus conditional approve → its six conditions folded); final codex pass pending
created: 2026-09-23
---

# yacana-one-surface — the owner's second feedback round, built to the canvas

Design input, authoritative for every word and pixel: the canvas "Yacana One Surface"
(https://claude.ai/artifact/9eMM61VNH7ACHaagGKq6BQ), version 4, with the owner's picks of 2026-09-23. Its
artboards are kept beside this plan in `canvas/` (`canvas/copy.md` is their text, extracted: a string there is the
string in the app). `recon.md` holds the reuse map, the facts with file:line, and the tests that move.

## 1. Goal

Ship the canvas's decisions as five stacked pull requests, every phase green on its gate, every arc through its
codex loop, with no regression in any existing browser suite.

Done means:
- `/mine` has one bar, **Mine · Wallet · Stats**. Stats opens inside the miner at `/mine/stats`, `/mine/stats/bridge`,
  `/mine/stats/verify`, with no reload, mining uninterrupted, the mini window kept; `/stats` stays the public page
  with the same bar.
- A first visit to `/mine` explains what Yacana is, ending on the flywheel line; it leaves for good once dismissed or
  once mining has started.
- The miner, the mini window, Stats and the landing use one word for how hard a win is: **difficulty**.
- A claim that fails because the node dropped a block recovers by itself — up to three sends while mining waits —
  never mints twice, never reports a landed claim as lost, and Start no longer throws a claimable win away.
- The small fixes: the Presto slider rule, the two-line pop-out, the mini-window setting, the recovery line, Lucide
  icons at stroke 1.5.
- The landing: the copy edits, the flywheel section between How and Verify, a "Why" anchor, one FAQ entry, and no
  download size in its copy.

## 2. What the canvas decided (short form; the canvas is authoritative)

| Item | Pick | Artboards |
|---|---|---|
| Navigation | **B** — Stats inside the miner, sub-tabs Overview · Bridge · Verify, "mining here · 11.8 proofs/min · 1 win" at the right of the sub-tabs; `/stats` public with the same bar | `Nav-Shell` |
| First visit | **A** — the dismissible strip, its copy ending on "…so the race to mine faster is a race to make Aztec faster." | `Cold-Strip` |
| Words | the deck and the tiles as drawn ("super") | `Words-Deck`, `Words-Tiles` |
| Presto | the slider leaves as soon as Presto is found and the user said yes; Settings locks at the same moment | `Fix-Presto` |
| Pop-out | **A** — 360 × 216, two lines: the user's numbers, then the network's | `Fix-Popout` |
| Recovery line | "save a recovery file · restore from a file · 2 crossings saved" | `Fix-Restore` |
| Mini-window setting | **A** — Pop out always shown; a setting, "Open the mini window when mining starts", opens it with the Start click | `Fix-Mini` |
| Claims | **A** — up to three tries in about three minutes while mining waits, then today's Retry; Start retries a pending win first | `Recover` |
| Icons | Lucide at stroke 1.5: `Pickaxe`, `Wallet`, `ChartColumn`, `ShieldCheck`, `Settings`, `FingerprintPattern` | `Icons` |
| Landing | hero headline kept ("audience" rejected); no download size; no testnet talk; the rest as drawn | `Landing-Copy` |
| Flywheel section | **A** — the loop: earn → optimize → upstream → grow, around "The difficulty keeps issuance at 4 wins every 5 min, however fast proving gets." (owner, 2026-09-23) | `Fly-A` |

Defaults this plan chose where the canvas is silent (each in the ledger, §8; confirmed or changed at approval):
- The strip leaves on × or once mining actually starts — not on a click that ends in an abandoned sign-in.
- The mini-window setting is a new setting, off by default: the old "Mini window" switch only showed the button,
  which is now always there, so nobody who turned it on asked for a window on every Start.
- On `/stats`, Mine and Wallet are plain same-tab links: nothing mines on the watcher's page.
- Stats' reader-facing "claims" become "wins"; the CSV and JSON `claims` columns stay (a data contract).
- No Bridge icon: Bridge becomes a text sub-tab, as drawn.
- The old origin (`v5.yacana.network`) keeps its bar and gets no stats routes.
- Hosted Stats runs no background history fill (the map shows the shared cache and the windows asked for).
- The mini window stays open across `/mine` ↔ `/mine/stats`; the page's hotkeys are off on the stats routes.
- The flywheel copy says "speedups that land in Barretenberg", never "miners improve Barretenberg": the retarget
  cancels a public speedup and pays for a private one (raised with the owner 2026-09-23).

## 3. Architecture & Implementation

### 3.1 Words, icons, the small fixes (arc 1)

**Icons.** `packages/ui/src/components/icons.tsx` keeps its API (`Icon({ name, size })`, `data-icon`); its glyphs
become Lucide components at `strokeWidth={1.5}`: `mine → Pickaxe`, `wallet → Wallet`, `stats → ChartColumn`,
`verify → ShieldCheck`, `settings → Settings`, `finger → FingerprintPattern`. No consumer changes.

**Words.** One module owns the miner's difficulty sentences, `apps/web-miner/src/lib/words.ts` (the epoch tips, the
difficulty tip with its live number, the chart's popover, the empty caption, the mini window's tooltip "About one
proof in 64 wins."), so `RailTile`, `LoopTile` and the pop-out stop duplicating them. `packages/ui` components take
the deck's words as their own labels and defaults (`score-loop.tsx`: the axis "difficulty reached · log scale", the
line caption, the hover card "#128 · reached 23.4 · below the difficulty", "★ 71.2 · a win", the retarget mark, the
aria label; `proof-line.tsx`: "reached"); `PipView` passes its caption explicitly instead of inheriting
`ScoreLoop`'s default. "next difficulty, if closed now" shows `147.8 (×2.31)` = `difficulty × closePreview` through
`difficultyLabel`. Stats: `Table.tsx`, `Detail.tsx`, `Observatory.tsx`, `charts/specs.ts` and
`miner-core/src/metrics.ts` `sentence()` say "wins" where a reader sees "claims"; `csv.ts` and `reader.ts` keep their
keys. "bar" is replaced only where it means the threshold (never a progress bar, a stacked bar, the Stepper).

**Presto.** One pure predicate, `prestoDecides(inputs)`, computed from the same inputs `use-presto.ts` already reads
(the atom, consent, the permission, mining): true when the standing is `found`, `remembered` or `proving` (`found`
always carries consent, `presto.ts:184-186`). `PrestoView.native` becomes `decides`. Its readers: `RailTile.tsx:44`
(the slider row hides), `Settings.tsx:107,111` (the slider locks, with the canvas caption), and the `[` `]` hotkeys
(`use-page-behaviour.ts:50`), which stop moving the threads while Presto decides. The ✦ suffix keeps reading
`active === 'presto'`: it says who proved. The rail row gains "· its own speed setting decides".

**The mini window, owned by the shell.** Today `PopOut` inside `LoopTile` creates the window, renders into it and
closes it on unmount (`LoopTile.tsx:99-128`), so leaving the cockpit closes it and a window opened elsewhere has
nothing in it. Instead:
- `pip.ts` holds the window in an atom (`pipWindowAtom`) and exposes `openPip()` — callable only from a click or key
  handler, gated on `navigator.userActivation.isActive`; a rejection or an unsupported browser resolves to `null`,
  never throws past the caller; a second call while one is pending returns the pending one.
- `features/PipHost.tsx`, mounted once in `App`, renders `PipView` into the window while the atom holds one,
  whatever the route; `pagehide` clears the atom.
- `PopOut` becomes a button that calls `openPip()`, rendered whenever `pipSupported()`, disabled while a window is open.
- `PIP_SIZE = { width: 360, height: 216 }`; `PipView`'s footer becomes two wrapping rows: "11.8 proofs/min · native" and
  "1 win · 4 tYACA", then "epoch 57 · 1 of 4 wins · difficulty 64.0".
- The setting `pipOnStart` (new key in `yacana.settings`, default off; the old `pip` key is dropped on parse). The row
  reads "Open the mini window when mining starts", hint "your Start click opens it; browsers don't let a page open it
  when you switch tabs".

**Start as a gesture.** One hook, `useStartClick()`, is what every Start button calls (the cockpit's signed-in and
signed-out buttons, the intro strip): signed in, it opens the mini window when `pipOnStart` is on (synchronously,
first) and starts mining regardless of the window's fate; signed out, it records the intent, opens sign-in and asks for
Presto, as the cockpit's signed-out button does today (`LoopTile.tsx:146-161`). The hotkeys and `useResumeOnOpen` keep calling
`onStart`, which never opens a window (no activation there). A signed-out Start cannot open the window: mining begins
after the passkey ceremony, outside the click's activation.

**Recovery line.** `ActivityList.tsx:138` drops "advanced ·" and separates the three items with "·".

### 3.2 Claims that recover by themselves (arc 2)

The pieces exist (`fate`, `adopt`, `retryEligible`, `ticketNullifier`, the nullifier lookup); the rules move into the
reducer, where they are unit-tested, and the controller keeps one timer.

**Kinds** (`packages/miner-core/src/claim-failure.ts`), all three out of today's `'other'`:
- `'anchor-pruned'` — the node's "Block hash … not found when resolving query … possibly a reorg has occurred": the
  PXE's anchor block went away while the claim was being proved;
- `'lost'` — our "no effects for 0x…" (`chain.ts:127`, its text a constant both sides share): the claim was seen in a
  proposed block, which was pruned before its effects were read;
- `'landed-elsewhere'` — the node's refusal of a transaction whose nullifier already exists (its text captured from a
  real refusal on the isolated network, in the fixture): an earlier send of this claim landed.
Any other `'other'` keeps today's manual Retry: an unrecognized failure is not retried blind.

**The record.** `submit()` retains the ticket for the three kinds as it does for `'other'` today
(`controller.ts:731`), and `failureNote` gives them Retry (`reducer.ts:387`) — moved out of `'other'` without both,
mining would halt with nothing retained and no Retry. The record keeps **every transaction hash this claim has sent**
(not only the last), the original's expiry, and the try count. The reducer carries `recovery: { tries, reason, nextAt }` for the line.

**The rules**, in order, each time a retry is due (the timer, Start, or Retry):
1. **Defer, don't cancel.** Paused, switching or disposed → nothing now; the controller re-arms the timer on release
   and when a switch ends. Single-flight as today (`retrying`).
2. **Reconcile before anything is sent.** For each recorded hash, `fate`: in a block → adopt; reverted → today's
   revert recovery (stale → the delivery-blocked wait), and no more automatic sends.
3. **The nullifier decides.** Then `findLeavesIndexes('latest', NULLIFIER_TREE, [ticketNullifier])`: present means the
   claim landed — in a transaction whose hash we may not hold — so its block is read (`DataInBlock.l2BlockNumber`,
   `getBlock`), the effect carrying the nullifier is found, and the claim is adopted from it.
4. **Unknown waits.** A hash the node cannot place yet (`unknown`) is checked again in 15 s without a send; checks do
   not count as tries. A pending transaction is waiting, not failing. The wait is bounded: a claim expires 600 s after
   its anchor (`CLAIM_TTL_SECONDS`, `params.nr:5`, set at `main.nr:201`), and a closed epoch turns it into a watch
   (rule 6); Stop ends it.
5. **Resend only when it can still mint.** Nothing landed and no hash is alive: read the open epoch now (not the
   10 s-old atom); open and tries remaining → prove and send again, appending its hash; the line says which try.
6. **A closed epoch stops sends, not checks.** When the claim's epoch is no longer open: a claim that never went out
   is discarded with today's "not claimed: the epoch closed before the claim went out"; one with hashes that may still
   land (unexpired) becomes a **watch** — hash-only, no secret, checked on the same schedule until each hash lands,
   reverts or expires — and mining resumes beside it. The watch is its own record, not `retained` (the `'mine'`
   command clears that, `controller.ts:557`), and its adoption settles without resuming anything. The fourth claim
   closes its own epoch (`main.nr:236`), so "closed" never means "lost".
7. **Three sends.** Try 2 comes 5 s after the first failure, try 3 30 s after the second; after the third the line is
   the canvas's "couldn’t claim after 3 tries: the node keeps dropping blocks · the win stays claimable until epoch 57
   closes" with Retry. A manual Retry or Start is one more try whenever the epoch is open.
8. **Adoption settles once.** Today `adopt` awaits `minted()`, which ends in `resumeAfterClaim()`, and only then
   clears `retained` (`controller.ts:768,839-840`): a resume that meets the still-retained claim would join its own
   retry. Settlement and resumption split: the retained record is consumed before settling; a settlement that fails
   re-retains it (hashes kept); mining resumes exactly once, after settlement.

**Start and Stop.** Start with a retained claim: epoch open → rule 2 onward now, mining waits (canvas A); epoch closed
→ rule 6, then mining starts. Stop during recovery cancels the scheduled sends and any resume; a try already proving
finishes (a proof cannot be interrupted), and its failure leaves the Retry line. A generation counter, bumped by
dispose, a switch and Stop, is re-checked after every `await` of the recovery path; a stale continuation does nothing.
The `'mine'` command is unchanged: under A, mining never runs beside a claim that still needs its secret.

**Lines** (`lib/claim-copy.ts`): the canvas's `Recover` A — "the node dropped the block it was reading · proving
again, try 2 of 3", "the node lost sight of it · checking the chain for your claim", "it didn’t land · sending again,
try 2 of 3", the three-tries line above; the running and minted lines are today's.

**Out of scope:** `syncChainTip: 'checkpointed'` (a staler anchor, a slower claim and more "epoch is not open"
refusals in exchange for fewer pruned anchors) — a follow-up to measure on the testnet.

### 3.3 The first visit and the landing (arc 3)

**Intro strip.** `apps/web-miner/src/features/IntroStrip.tsx` renders the `Cold-Strip` copy (the reward and symbol
from `PARAMS`) with Start mining (`useStartClick`), "How it works ↗" (the landing's `/#how`, a new tab) and a
dismiss ×. `apps/web-miner/src/intro.ts` stores `yacana.intro` (`{ dismissed: true }`) on the `settings.ts` parse,
load and save convention (try/catch, validated; a storage that throws means the strip shows). It is dismissed by ×
or by the first `startJob` (mining actually running). It mounts at the top of `Mine.tsx`, joins the `above` count
(`Mine.tsx:79`), and `ROWS` gains the fourth template that count can now reach.

**Landing.** Copy per `Landing-Copy` in `apps/web-landing/src/copy.ts` and `faq-copy.ts`; the question "How is it
mined?" keeps its exact text (`faq-copy.ts:56` looks it up by it). `HeroLive.tsx`: the Kpi label "difficulty" and
"4 wins · by browsers"; `BarChart.tsx`'s reader-facing "accepted" becomes "wins"; How's step 2 is named `hash`. The
flywheel is `apps/web-landing/src/sections/Why.tsx`, section id `why`, between How and Verify in `SECTIONS`,
`bar.anchors` ("Why") and `App.tsx`:
- from `md` up, an SVG ring (circle and four arcs with path arrowheads, on the `RuleDiagrams` conventions: token
  classes, no `<marker>`) with the four nodes as HTML boxes over it and the centre sentence;
- below `md`, the same four steps as How's numbered list;
- `role="img"` with a label naming the four steps in ring order; its own test id (`why-loop`), because two tests
  count `rule-diagram`.
The download size leaves the landing's reassurance (`copy.ts:45`) and the preflight caption (`PreflightTile.tsx:10`).

### 3.4 One surface: Stats inside the miner (arcs 4a and 4b)

**The package (4a).** `packages/stats-view` (`@yacana/stats-view`, layer 2) takes what web-stats renders and reads:
`state.ts`, `beats.ts`, `window.ts`, `history-fill.ts`, `history-cache.ts`, `map-geometry.ts`, `read-fixed.ts`,
`read-window.ts`, `serial.ts`, `explorer.ts`, `bridge.ts`, `bridge-beat.ts`, `chain.ts`, `charts/*`, `features/*`,
the three pages, and their specs. Its public surface is small:
- `@yacana/stats-view/runtime`:
  ```ts
  interface StatsRuntimeOptions {
    store: Store;                 // the host's jotai store
    connection: Connection;       // the endpoints this instance reads; a switch makes a new instance
    node: Node;                   // the client it reads through
    fill: boolean;                // the background history fill (the public page only)
    onFresh?: () => void;         // a chain read landed (the public page: node-health's markRead)
    yieldTo?: () => boolean;      // skip a tick while true (hosted: a claim in flight, a node cooldown)
  }
  interface StatsRuntime {
    start(): void;                // idempotent: boot once, then the poll, the bridge poller, the clock
    stop(): void;                 // timers cleared, instance kept (a hidden route)
    dispose(): void;              // generation invalidated: nothing it started publishes again
    showWindow(w: EpochWindow): Promise<void>;
    poll(): Promise<void>;
  }
  function createStatsRuntime(o: StatsRuntimeOptions): StatsRuntime;
  ```
  It is `main.tsx`'s boot without the page. It never calls `setNodeEndpoint` or `setEthRpcEndpoint` (the moved
  `openReader` and `startBridge` lose their setter calls). The serial queue, the boot retry and every timer belong to
  the instance; each publication and each timer installation checks the instance's generation, so a disposed or
  superseded instance — a switch, a StrictMode double effect, a boot waiting out a cooldown — cannot write into the
  store.
- `@yacana/stats-view/pages`: `StatsPages({ page, connection, onWindow, wayOut })` — the page bodies, the
  `Announcement` line, and the error card when the deployment cannot be read (`wayOut` is the host's link to its node
  setting); `SubNav` (Overview · Bridge · Verify, with an `aside` slot); a host context with `pathFor(page)`,
  `navigate(page)` and `faqHref` that the pages read instead of importing a router.
- `@yacana/stats-view/state`: the atoms web-stats' shell reads (`Freshness`, the settled marker).
- `url-state.ts` (`?epoch=`, `?from=`) moves from web-stats' router into the package.

The navigation event and its subscription move to `packages/web-kit/src/browser/navigation.ts` (`NAVIGATE`,
`subscribeLocation`, `dispatchNavigate`), used by both routers and `url-state` — one definition instead of three.
Both apps' `index.css` add `@source "../../../packages/stats-view/src"`: Tailwind scans only `packages/ui` today.

**web-stats after the move** is a shell: `main.tsx` sets the node slot (10 s) and, when a bridge record or the e2e RPC
pin applies, the Ethereum slot (10 s); creates the store, the node client and the runtime with `fill: true` and
`onFresh: markRead`; starts it and renders. `App.tsx` keeps the header, `Freshness`, the node banner, the footer and
`document.title`. `routes.ts` keeps its paths (`apps/site` imports its `Route`).

**The miner hosts it (4b).**
- **Routes.** `Route = 'mine' | 'wallet' | 'settings' | 'stats' | 'stats/bridge' | 'stats/verify'`, parsed from up to two
  segments. `assemble.ts` splits the rewrite lists: `REDIRECTS` takes every non-`mine` route (the path-shaped members
  expand to exact sources, which Cloudflare serves without shadowing assets); `OLD_REDIRECTS` takes only `wallet` and
  `settings`, and the old role's router maps the stats paths to `mine`.
- **Endpoints you can react to.** The session publishes `endpointsAtom = { nodeUrl, ethRpcUrl, switching }` wherever
  a guard slot changes: `switchNode` (start, success, rollback) and `switchEthRpc`. Today nothing reactive holds them:
  `App` gets the boot-time `connection` (`main.tsx:53,104`) and the session's URLs are plain getters.
- **The hosted runtime.** `routes/Stats.tsx` is loaded with `React.lazy` and holds one runtime per endpoint pair:
  created when a stats route shows and `switching` is false, `stop()`ped when the route is left, `dispose()`d and
  replaced when the pair changes. Its options: `fill: false`, no `onFresh` (hosted reads never mark the miner's node
  fresh), `yieldTo` = a claim in flight or `nodeHealth().transport.kind !== 'ok'`, and `node` = a hosted client on its own JSON-RPC
  transport (`createAztecNodeClient` takes one; the SDK's `defaultFetch` builds each `init` itself and passes neither),
  whose every request carries a 10 s `AbortSignal` (the guard merges it with its own deadline,
  `node-guard.ts:157-162`) and a per-request **quiet** marker on its `init`.
- **The guard's one change.** `nodeRequest` marks a request quiet when `quietNodeReads` is active **or** the request's
  `init` carries the marker. Today quiet is a page-wide counter (`node-guard.ts:134-142,242`) that only web-stats' history
  fill enters (`web-stats/src/main.tsx:122-125`): wrapping hosted reads in it would make a claim sent meanwhile quiet
  too, and leaving them loud lets Stats' ordinary failures open the cooldown that answers every node request — the
  miner's `sendTx` included — with a synthetic 429 (`node-guard.ts:238-239`). Marked per request, hosted reads can
  do neither.
- **Failure.** An error boundary around the lazy route: a failed import shows a card with "Try again" (a fresh
  `import()`); after a redeploy has replaced the chunk, "Reload to open Stats" (the card says mining stops). The cockpit,
  the Worker and the mini window are outside the boundary. The chunk is loaded only when Stats is first opened.
- **The bar.** `packages/ui` gains `siteTabs({ current, href, onSelect, waiting })`, a pure `HeaderTab[]` builder
  (labels, icons, test ids, order defined once). The miner passes in-app `onSelect` for all three; web-stats passes
  plain links for Mine and Wallet (`/mine/`, `/mine/wallet`) and in-app Stats. Verify leaves the top level; `oldTabs`
  is unchanged. The sub-tabs sit under the bar on both hosts; the miner's `aside` is "mining here · N proofs/min · N
  win(s)" while mining, nothing otherwise.
- **The shell.** The stats routes render the lazy page; the sign-in dialog does not sit over them (as for Settings);
  the page's hotkeys (Space, `[` `]`, the route keys) are off on them; nothing hosted sets the title (the miner's tab
  status owns it).
- **The chunk stays out of the first paint.** `moduleReport` (`vite-base.ts:136-151`) also writes, per chunk, its
  modules and its static and dynamic imports; `apps/web-miner/scripts/check-chunks.ts` walks the entry's static
  imports and fails if `@yacana/stats-view` or `@observablehq/plot` is reachable, and prints the stats chunk's size.
  It runs in the arc gate and in `web-miner.yml` after the replay job's build.

### 3.5 Data and control flow (the two critical paths)

1. `/mine/stats` while mining: the tab's `onSelect` → `navigate('stats')` → `pushState` + `NAVIGATE` → `useRoute` →
   the lazy chunk loads once → a runtime for the current endpoints starts → reads through the hosted client (10 s,
   quiet) → atoms → tiles. The controller, the Worker, the mini window and the claim path never notice; a tick is
   skipped while a claim is in flight or the node is cooling down.
2. A claim the node loses: `submit()` → `sent.wait()` throws "no effects for" → `'lost'`, retained with its hash →
   5 s → `fate`: re-included → adopted ✓; `dropped` → the nullifier: present → its block → adopted ✓; absent and the
   epoch open → try 2; `unknown` → checked again in 15 s; the epoch closed with the hash alive → a watch, mining resumes.

### 3.6 File-level change map

| Phase | Added | Modified | Removed |
|---|---|---|---|
| P1 | — | `ui/src/components/icons.tsx`, `header.vitest.tsx` | the hand-drawn paths |
| P2 | `web-miner/src/lib/words.ts` | `RailTile.tsx`, `LoopTile.tsx`, `LedgerTile.tsx`, `ui/…/score-loop.tsx`, `ui/…/proof-line.tsx`, web-stats `Table.tsx`, `Detail.tsx`, `Observatory.tsx`, `charts/specs.ts`, `miner-core/src/metrics.ts`, their specs, the eight Stats baselines | — |
| P3 | `features/PipHost.tsx`, `features/use-start-click.ts` | `use-presto.ts`, `RailTile.tsx`, `Settings.tsx`, `use-page-behaviour.ts`, `pip.ts`, `LoopTile.tsx`, `App.tsx`, `settings.ts`, `ActivityList.tsx`, the Presto, pop-out and settings specs | `PopOut`'s window ownership |
| P4 | `e2e/claim-recovery.e2e.ts` | `miner-core/src/claim-failure.ts` (+test), `controller.ts`, `chain.ts`, `lib/reducer.ts` (+test), `lib/claim-copy.ts`, `tests/recovery.bun.test.ts`, `tests/claim-lines.bun.test.ts`, `e2e/fixtures.ts`, `e2e/shards.json`, `e2e/proof-inventory.ts`, `tests/e2e-inventory.bun.test.ts` | — |
| P5 | `features/IntroStrip.tsx`, `intro.ts`, their spec | `routes/Mine.tsx`, the cockpit e2e spec, `e2e/proof-inventory.ts`, `tests/e2e-inventory.bun.test.ts`, the replay specs the strip moves | — |
| P6 | `web-landing/src/sections/Why.tsx` (+spec) | `copy.ts`, `faq-copy.ts`, `App.tsx`, `HeroLive.tsx`, `BarChart.tsx`, `sections.vitest.tsx`, `e2e/landing.e2e.ts`, `web-miner/…/PreflightTile.tsx` | — |
| P7 | `packages/stats-view/**`, `web-kit/src/browser/navigation.ts` | web-stats `main.tsx`, `App.tsx`, `routes.ts`, `index.css`; web-miner `routes.ts`, `index.css`; root `package.json`, `tsconfig.json`, `bun.lock`; the CI filters and test invocations the layout guard names | the moved web-stats modules |
| P8 | `web-miner/src/routes/Stats.tsx`, `ui/src/components/site-tabs.ts`, `web-miner/scripts/check-chunks.ts`, `e2e/stats-host.e2e.ts` | web-miner `routes.ts`, `App.tsx`, `session.ts` (`endpointsAtom`), `lib/tabs.ts`, `use-page-behaviour.ts`; `web-kit/src/browser/node-guard.ts` (the per-request marker); `web-kit/src/vite-base.ts` (`moduleReport`); web-stats `App.tsx`; `site/src/assemble.ts` (+test), `site/e2e/site.e2e.ts`, web-stats `e2e/stats.e2e.ts`, the eight baselines, `e2e/shards.json`, `e2e/proof-inventory.ts`, `tests/e2e-inventory.bun.test.ts`, `.github/workflows/web-miner.yml` | `minerTabs`' external Stats and Verify |

### 3.7 Trade-offs and alternatives not taken

- **One app, two doors** (the competing outline, `plan-outline-one-app.md`): both auditors chose the package. The
  watcher's build keeps the alias that stubs bb.js out (`vite-base.ts:187-197`), and the churn is not front-loaded.
- **Nested routes**: cleaner types, a second rewrite mechanism.
- **An iframe of `/stats`**: two React roots and two runtimes on one page.
- **Retrying every `'other'`**: a circuit error would be proved again three times for nothing.
- **Keep mining during recovery** (the canvas's B): the owner picked A; under A the `'mine'` command needs no change.
- **Reusing the `pip` key**: would open a window on every Start for everyone who only wanted the button.
- **A screenshot gate for hosted Stats**: its pages are the components `/stats`' gate already pins; the hosted chrome
  (the bar, the sub-tabs, the aside) is covered by component specs and a computed-style check in the e2e.
- **Prefetching the Stats chunk at boot** (would survive a redeploy): it would load Plot and d3 into every miner's
  realm, not only the ones who open Stats (§4).

## 4. Security & Adversarial Considerations

- **Threat model.** No server, secret, permission or origin is added. The surfaces: the fetch guard and the
  node-health store a hosted module shares; the claim path (a retry loop could resend after a landing, pay the sponsor
  for reverts, or keep a secret too long); the page's realm (Stats' dependencies join the realm that holds the open
  account's keys and signs its transactions: the wallet is embedded); the page (a hidden control with live effect, copy that overclaims); the
  build (a chunk that pulls Stats into the miner's first paint).
- **Guard ownership.** The runtime never calls the setters (a spec spies on them); the miner's slots stay 120 s / 30 s
  with Stats open (the host's e2e asserts it). Hosted Stats reads only the node and RPC the miner already admits; a
  switch disposes and replaces the runtime rather than widening the guard. The guard's one change is additive: a
  request may declare itself quiet; nothing can declare another request quiet.
- **Node health.** Hosted reads are quiet request by request (no cooldown from Stats), carry a 10 s deadline (no
  abandoned reads piling up behind the miner's 120 s slot), never mark the node fresh, and skip their ticks during a
  claim or a cooldown.
- **Claims.** A second send never mints twice: the nullifier is a function of the ticket (`main.nr:221`), and a send
  after a landing is refused for its duplicate nullifier (then adopted, §3.2). Not free in every case: a claim whose
  epoch closes between its anchor and its inclusion reverts in public (`main.nr:231-233`), the sponsor pays, and the
  account's claims wait for L1 finality (`claim-failure.ts:2-5`). Automatic sends come later in the epoch, where that
  is likelier, so each one reads the open epoch fresh, a stale revert ends the automatic sends (a spec), and there are
  at most three. Single-flight, a generation re-checked after every `await`, secrets in memory only and no longer than
  the claim can be sent. The nullifier lookup tells the node nothing it did not learn when it received the claim.
- **Realm and supply chain.** No new npm package (`@observablehq/plot`, its `d3` and `lucide-react` are already locked,
  `bunfig.toml:3`'s 7-day `minimumReleaseAge`, frozen CI installs). Hosting still widens their reach: loaded, they run
  beside the unsealed key and the guard (`Symbol.for`). The chunk is therefore strictly lazy — only a visitor who opens
  Stats loads it — and `check-chunks.ts` keeps it out of the entry.
- **Least privilege.** No new CI permission; `web-miner.yml`'s chunk check runs under its existing `contents: read`.
- **Cryptography.** None new; `ticketNullifier` (Poseidon2 via `@aztec/foundation`, pinned) reused.
- **Input validation.** `yacana.intro` and `pipOnStart` parsed with safe defaults; URL state keeps its integer checks.
- **Frontend.** Static copy only; the mini window opens only inside a user activation; a hidden slider takes its
  hotkeys with it; the flywheel copy says only what is true.

## 5. Assumptions

### Facts (verified)
1. A claim lands only while its epoch is open: `main.nr:188` at the anchor, `:231-233` in `record_claim`; the N-th
   claim closes its own epoch (`:236`).
2. The claim nullifier is `Poseidon2([DOM_NULL, digest])` (`main.nr:221`); `ticketNullifier` siloes it
   (`miner-core/src/proof.ts:51-53`).
3. "no effects for" is thrown by `chain.ts:127` after `waitForTx` reached `PROPOSED`.
4. `retryOnce` reconciles one known hash through `fate` and `adopt`, then resends only when `retryEligible`
   (`controller.ts:787-863`); `submit()` retains the ticket only for `'other'` and overwrites the hash on each failure
   (`:731`).
5. `findLeavesIndexes` returns `DataInBlock<bigint> | undefined` (`@aztec/stdlib` 5.2.0 `aztec-node.d.ts:57`).
6. `found` always implies consent (`presto.ts:184-186`); `native` has two readers (`RailTile.tsx:44`,
   `Settings.tsx:107,111`); the hotkeys read `active` (`use-page-behaviour.ts:50`).
7. `PopOut` owns the window and closes it on unmount (`LoopTile.tsx:99-128`); `useResumeOnOpen` calls `onStart`
   without a click (`use-page-behaviour.ts:108-113`).
8. The signed-in Start is synchronous in the click (`LoopTile.tsx:182`, `App.tsx:139`); the signed-out one mines after
   the passkey ceremony (`session.ts:462-466`); `session.startMining()` without a controller only asks for Presto
   (`session.ts:879-885`).
9. The guard's node and RPC slots are single, last write wins (`node-guard.ts:67-89`); quiet is a page-wide counter
   (`:134-142`) read at each request's start (`:242`); a caller's `AbortSignal` is merged with the slot's deadline
   (`:157-162`).
10. The session admits the RPC when a bridge record exists or an e2e page pins one (`session.ts:238-240`); Stats reads
    L1 when a bridge record exists (`web-stats/src/bridge.ts:99-105`).
11. The miner's `connection` is loaded once (`main.tsx:53`) and passed to `App` (`:104`); the session's switches
    change its own fields only (`session.ts:759-791,818-870`).
12. The slot table and layouts are fetched from the origin root (`web-kit/src/browser/slots.ts`); the miner's prebuild
    copies them.
13. Both routers dispatch `'yacana:navigate'` (`web-stats/src/routes.ts:19`, `web-miner/src/routes.ts:16`).
14. `MINER_LINKS` feeds both `REDIRECTS` and `OLD_REDIRECTS` (`assemble.ts:71-83`); `assemble.test.ts` pins both lists.
15. Dynamic `import()` exists (`PrestoBanner.tsx:18`, `bridge/flows.ts:99`); no `React.lazy` route and no
    `manualChunks` do.
16. Tailwind scans `packages/ui/src` only (`apps/*/src/index.css:2`).
17. web-stats already says "difficulty"; its reader-facing "claims" are `Table.tsx:14,59`, `Detail.tsx:81-84`,
    `Observatory.tsx:63`, `charts/specs.ts:471-472`; `csv.ts:5` and `reader.ts` are data.
18. `faq-copy.ts:56` looks "How is it mined?" up by its exact text.
19. The Stats screenshot gate is eight zero-tolerance baselines (`/` and `/bridge`) regenerated only in
    `mcr.microsoft.com/playwright:v1.62.1-noble`; docker and the image are on this machine.
20. The canvas's icons are Lucide's `pickaxe`, `wallet`, `chart-column`, `shield-check`, `settings`,
    `fingerprint-pattern` (matched path for path against `lucide-react` 1.34).
21. The miner shows `DesktopOnly` below desktop widths (`App.tsx`), so `/mine/stats` is desktop-only; `/stats` is not.
22. `tests/e2e-inventory.bun.test.ts:76` pins the suite's title count; CI's `chain` shard runs proverless (`e2e.yml`).
23. `gh stack init <branch>` adopts an existing branch (gh-stack's help; there is no `--adopt`).
24. `web-miner.yml`'s replay job builds the miner; `site.yml` builds nothing.
25. The SDK's JSON-RPC transport builds each request's `init` (method, body, headers, credentials) and takes no signal
    or marker (`@aztec/foundation` 5.2.0 `dest/json-rpc/client/fetch.js`); `createAztecNodeClient` accepts a transport
    (`web-kit/src/browser/node.ts:34`).
26. The history fill is the only quiet reader today (`web-stats/src/main.tsx:122-125`); the miner has none.
27. `adopt` resumes mining (through `minted()`) before it clears `retained` (`controller.ts:768,839-840`); the `'mine'`
    command clears `retained` (`:557`).

### Inferences (unverified — attack these)
1. The Stats chunk is small beside the miner's bb.js and circuit chunks; P8 prints its size.
2. Chart re-renders beside the prover Worker cost little; P8's e2e reports proofs per minute with Stats open next to
   the cockpit's, as a number in the lessons, not a gate.
3. The node refuses a send whose nullifier exists before inclusion (no fee); P4 captures the refusal's text from a real
   one on the isolated network.
4. `navigator.userActivation.isActive` is true inside the click handler before any `await`, and `requestWindow` called
   there opens the window (the existing Pop out precedent works this way).
5. The replay recording needs no re-record: the strip changes the page, not the node traffic.
6. The claim's pre-send anchor read that fails in production can be targeted in e2e by its JSON-RPC method (P4 lists
   the claim's node calls to pick it).

### Asks (for the approval)
1. **The live download progress** ("13.0 of 20 MB" while the proving keys download) — keep it (it measures; the
   plan's default) or remove it too ("no download size anywhere").
2. **"no gas on testnet"** in the landing's reassurance line, which the canvas kept although "no testnet talk" — keep as
   drawn, say "no gas", or drop the gas clause.
3. Confirm the defaults of §2.

## 6. Phases with validation gates

Fast layers, after every meaningful edit and at every gate:

```sh
bun run lint && bun test
bun run typecheck
bun run test:components
bun run --cwd apps/web-miner test:replay
```

The miner's browser suite, as it runs in the gates below (each in tmux):

```sh
E2E_PROVERLESS=1 E2E_SHARD=cockpit bun run e2e:agent -- bun run --cwd apps/web-miner test:e2e
E2E_PROVERLESS=1 E2E_SHARD=chain   bun run e2e:agent -- bun run --cwd apps/web-miner test:e2e
E2E_PROVERLESS=1 E2E_SHARD=bridge  bun run e2e:agent -- bun run --cwd apps/web-miner test:e2e
E2E_PROVERLESS=0 E2E_SHARD=canary  bun run e2e:agent -- bun run --cwd apps/web-miner test:e2e
```

A shard passes when every title of its inventory executed; proof floors bind only on real-proving runs. A new e2e
title goes into `e2e/proof-inventory.ts`, a shard in `e2e/shards.json`, and the count in
`tests/e2e-inventory.bun.test.ts`.

**Before P1** (once per machine): `bunx playwright install chromium` if Playwright 1.62.1's build is absent, and
`bash tools/localnet/bin/install-presto-server.sh` (the `chain` shard holds `presto.e2e.ts`; a skipped title fails the
inventory).

### Arc 1 — words, icons, the small fixes

**P1 · Lucide icons.** §3.1. Gate: fast layers; `header.vitest.tsx` asserts each tab's Lucide glyph instead of counting
paths. Layers: lint, typecheck, unit.

**P2 · One word: difficulty.** §3.1, every row of `Words-Deck` and `Words-Tiles`, Stats' "wins". Gate: fast layers with
the moved specs (`cockpit.vitest.tsx`, `loop-tile.vitest.tsx`, `ui` `score-loop.vitest.tsx`, `tooltip.vitest.tsx`,
`signature.vitest.tsx`, the `metrics` tests, Stats' vitest); `grep -rn` over `apps/web-miner/src` and `packages/ui/src`
finds no reader-facing "score", "the bar" or "target length" outside tests; `bun run --cwd apps/web-stats test:visual
-- --update-snapshots` in the pinned image, each of the eight diffs inspected (the header's icons and the words only),
then `bun run --cwd apps/web-stats test:visual` passes.

**P3 · Presto, the mini window, Start, the recovery line.** §3.1. Gate: fast layers; `prestoDecides` table spec
(`found`, `remembered`, `proving`, `absent`, `checking`, consent revoked, permission denied, the WASM fallback);
`presto-indicator.vitest.tsx` and `settings.vitest.tsx` at `found` and back at `absent`; a hotkey spec (`[` at `found`
changes nothing); `settings.ts` parse spec (`pipOnStart` defaults off, the old `pip` dropped); a `PipHost` spec (the
window follows the atom, `pagehide` clears it); `miner.e2e.ts` in real Chromium: Start with the setting on opens the
window and mines; with the window refused, mining still starts; the window survives `/mine` → `/mine/wallet` → back;
the two-line footer fits 360 px with no horizontal overflow (measured in the window's document).

**Arc 1 gate:** fast layers; the four shards; `bun run e2e:agent -- bun run --cwd apps/web-stats test:e2e`;
`bun run --cwd apps/web-stats test:visual`.

### Arc 2 — claims that recover by themselves

**P4 · Classify, record, reconcile, schedule.** §3.2. Gate: fast layers; `claim-failure.test.ts` with the owner's two
messages and the captured duplicate-nullifier refusal; `reducer.test.ts` for the recovery state (tries, deferral
on pause and switch, the three-tries line, Start's cases, Stop); `tests/recovery.bun.test.ts` on a fake node and
Worker: (a) `anchor-pruned` → proved again → minted, one send; (b) `lost` → `fate` re-included → adopted, no send;
(c) `lost` → `dropped`, nullifier present → the block read, adopted, no send; (d) `dropped`, nullifier absent, epoch
open → one resend with both hashes recorded; (e) the original lands after the resend → adopted, the resend's refusal
adopted too; (f) the fourth claim's effects missing, its epoch closed by it → adopted, never "not claimed";
(g) epoch closed, a hash alive → a watch, mining resumes, the watch adopts; (h) a stale revert mid-recovery → no more
automatic sends; (i) a pause at try 2 → deferred, resumed on release; (j) three failed sends → the Retry line;
(k) Start with a retained claim, epoch open → the claim first, mining once, after it settles; (l) Stop mid-recovery →
nothing further sent; (m) dispose or a switch during each `await` → nothing happens after it; (n) an unrecognized
`'other'` → no automatic try. `claim-lines.bun.test.ts` for every new line. `e2e/claim-recovery.e2e.ts` (`chain`):
the claim's first pre-send anchor read answers with the node's pruned-anchor error → the claim is proved again and
mints with one send; the first effect-bearing receipt comes back without effects → the claim is adopted, no second
send. One real-proving title in `canary`: the pruned-anchor case, asserting one send, the minted line, the balance and
mining resuming.

**Arc 2 gate:** fast layers; the four shards.

### Arc 3 — the first visit and the landing

**P5 · The intro strip.** §3.3. Gate: fast layers; an `IntroStrip` spec (shows on a first visit; × persists; a
signed-out Start opens sign-in and leaves the strip until mining starts; a signed-in Start mines and dismisses; a
throwing storage still shows it; the grid's row count follows); a cockpit e2e title (first visit shows it; dismissed
survives a reload); the replay lane green.

**P6 · The landing and the flywheel.** §3.3. Gate: fast layers; a `Why` spec (four steps in ring order, the list below
`md`, the label, its test id); `sections.vitest.tsx` updated; `landing.e2e.ts` with the `why` section and the "Why"
anchor; `grep -rn "20 MB"` over the copy files finds nothing; `external-link-arrows` green.

**Arc 3 gate:** fast layers; the four shards; `bun run e2e:agent -- bun run --cwd apps/web-landing test:e2e`.

### Arc 4a — `@yacana/stats-view`

**P7 · The package, web-stats as its shell.** §3.4. A pure move: nothing on `/stats` changes. Gate: fast layers (the
layout and boundaries guards accept the package; its Vitest runs in `test:components` and in CI); a runtime spec
(no setter called; `fill: false` never enters `quietNodeReads`; `yieldTo` skips ticks; `start`/`stop` idempotent;
after `dispose` a delayed boot, a late poll and a late bridge read publish nothing; A → B → A endpoints; StrictMode's
double effect); `bun run --cwd apps/web-stats test:visual` passes against P2's baselines **without** regenerating;
`bun run e2e:agent -- bun run --cwd apps/web-stats test:e2e`.

**Arc 4a gate:** P7's gate.

### Arc 4b — the miner hosts Stats

**P8 · Routes, runtime, guard, bar, chunk.** §3.4. Gate: fast layers; a `routes` spec (the six routes round-trip;
under the old role the stats paths resolve to `mine`);
an `assemble` spec (`REDIRECTS` has the three stats rewrites, `OLD_REDIRECTS` none); a guard spec (a marked request is
quiet while an unmarked one alongside is not; a marked request's failure opens no cooldown); a `siteTabs` spec;
`YACANA_MODULE_REPORT=<dir> bun run --cwd apps/web-miner build` then `bun apps/web-miner/scripts/check-chunks.ts <dir>`;
`e2e/stats-host.e2e.ts` (`cockpit`): while mining, open Stats → Bridge → Verify → back — proofs keep counting, the page
never reloads (a window marker survives), the mini window stays open, the guard's slots unchanged, back/forward
restore the sub-page, a tile's Tailwind class has its computed style, Space scrolls the page; a node switch while on
Stats → the new runtime reads the new node, no blocked-endpoint error; the stats chunk answering 404 → the boundary
card, mining continues; `stats.e2e.ts`'s bar labels; `site.e2e.ts` serves the three paths cross-origin isolated; the
eight baselines regenerated (the bar and the sub-tabs) and each diff inspected.

**Arc 4b gate:** everything once on the stack's top: fast layers; the four shards; web-stats e2e and visual;
web-landing e2e; `bun run e2e:agent -- bun run site:e2e`; `bun run lint:actions`.

## 7. Delivery — arcs → stacked PRs

| Arc | Branch | Phases | Stacks on | code-review |
|---|---|---|---|---|
| 1 · words, icons, fixes | `worktree-yacana-one-surface` | P1–P3 | `main` | off |
| 2 · claims recover | `yacana-one-surface-claims` | P4 | arc 1 | off |
| 3 · first visit, landing | `yacana-one-surface-first-visit` | P5–P6 | arc 2 | off |
| 4a · the stats package | `yacana-one-surface-stats-view` | P7 | arc 3 | off |
| 4b · Stats in the miner | `yacana-one-surface-stats-host` | P8 | arc 4a | off |

Start: `gh stack init worktree-yacana-one-surface` (it adopts the branch). At each arc boundary, after the arc's gate
and its codex loop: `gh stack add <next branch>`. No pull request, not even a draft, before the final cross-arc pass
converges. Then `gh stack submit --auto` (drafts), `gh pr edit` bodies (ending with the Claude Code line),
`gh pr checks --watch` per PR, and `gh pr ready` for each once green. `gh stack merge` is the owner's.

## 8. Decision ledger

| # | Decision | Source | Rejected, and why | Status |
|---|---|---|---|---|
| L1 | Stats as a package with two hosts | main draft; both audits | one app, two doors: the watcher inherits the prover's build, churn first | adopted |
| L2 | Path-shaped miner routes; separate old-origin rewrites | main draft; codex 11, Opus 8 | nested sub-route (a second rewrite mechanism) | adopted |
| L3 | The host owns the guard's slots | recon | the runtime setting its own (shortens the miner's `sendTx`) | adopted |
| L4 | `endpointsAtom` from the session; one runtime per endpoint pair, generation-guarded | codex 1, 7; Opus 4 | reading the boot-time `connection` (never changes) | adopted |
| L5 | Hosted reads: per-request quiet marker, 10 s deadline, no `markRead`, no fill, yield during a claim or cooldown | codex 8; Opus 3 | the page-wide quiet counter (makes a claim quiet); a pre-fill `busy` check only | adopted |
| L6 | Recovery rules in the reducer: reconcile first, the nullifier decides, closed stops sends not checks, defer on pause | codex 3–6; Opus 1, 2, 10 | "present nullifier = lagging node"; discard on close; cancel on pause | adopted |
| L7 | The `'mine'` command unchanged | Opus 2c | keeping the retained secret through `'mine'` (only canvas B needs it) | adopted |
| L8 | A new `pipOnStart` setting, off by default | codex 10; Opus asks | reusing `pip` (a window on every Start for the button's users) | adopted |
| L9 | `PipHost` in the shell; `openPip` only in a user activation; `useStartClick` for every Start button | codex 12; Opus 6, 7 | the window in `PopOut` (closes on navigation); `onStart` opening it (no activation) | adopted |
| L10 | `prestoDecides`, one pure predicate for the rail, Settings and the hotkeys | codex 13 | a second approximation for the hotkeys | adopted |
| L11 | An error boundary around the lazy route; strictly lazy chunk | codex 9; Opus 5, 11 | Suspense alone; prefetching at boot (Plot in every realm) | adopted |
| L12 | The module report per chunk, checked in `web-miner.yml` | codex 9; Opus 13 | a Vite manifest (off, and it lists chunks, not packages); `site.yml` (builds nothing) | adopted |
| L13 | Hotkeys off on the stats routes | Opus 9 | Space toggling mining while reading Stats | adopted |
| L14 | Arc 4 as two PRs (the move, then the hosting) | Opus D | one PR for both | adopted |
| L15 | All four shards at arcs 2, 3 and 4b; a real-proving recovery title | codex 14; Opus 13 | the touched shard only | adopted |
| L16 | Pre-send injection for the pruned anchor | codex 14; Opus 13 | at `sendTx` (the send is already recorded there, `wallet.ts:83-86`) | adopted |
| L17 | Tailwind `@source` for the package in both apps, a computed-style check on `/mine/stats` | codex 15; Opus 12 | a new screenshot gate for hosted Stats (its pages are the gated components) | adopted |
| L18 | The strip leaves on × or at the first real start | codex 10; Opus 6 | on its Start click (an abandoned sign-in dismissed it) | adopted |
| L19 | Stats' "claims" → "wins" on screen only | default | renaming the CSV/JSON columns | owner at approval |
| L20 | `syncChainTip` measured later | main draft | changing it here | owner at approval |
| L21 | No Bridge icon (a text sub-tab) | canvas | an icon for a tab that leaves | owner at approval |
| L22 | `/stats`' Mine and Wallet are same-tab links | default | new-tab links | owner at approval |
| L23 | `siteTabs` in `packages/ui` | main draft; both audits | two builders with a parity test | adopted |
| L24 | The live download progress stays | default | removing a measurement with the warnings | Ask 1 |
| L25 | Flywheel section A (the loop) | owner, 2026-09-23 | B (three facts) | owner's pick |
| L26 | The old origin's change gated by specs (its router, `OLD_REDIRECTS`) | Opus 13 | the rig's `origin` case per arc (boots an upgrading network for a route map) | adopted |
| L27 | Start after three failed sends is one more try while the epoch is open | canvas A | discarding the win on Start (the behaviour the owner reported) | adopted |

## 9. Audit verdicts

**Round 1** (both saw `plan.md` and `plan-outline-one-app.md`):
- **Codex (GPT-6 Astra, high): reject** — blocking: the claim-recovery lifecycle, stale Stats connections, shared
  fetch-health interference, incomplete failure gates. Fifteen findings; all verified against the code and adopted
  (L2, L4–L6, L8–L12, L15–L18), two facts corrected (RPC admission, dynamic imports), one rejected in part: a hosted
  screenshot gate (L17's alternative).
- **Opus 5.5: conditional approve** — conditions: rewrite the recovery rules (the present nullifier, Start case by
  case, the retain rule, pauses defer, the `'mine'` change dropped); a reactive endpoint source with generation-guarded
  writes and node-health isolation; an error boundary; the mini window outside `LoopTile`; the strip's signed-out Start;
  no stats routes on the old origin. All six folded (L2, L4–L7, L9, L11, L18, L26), with its findings on the hotkeys (L13),
  the sponsor cost (§4), the realm (§4, L11), Tailwind (L17), the gates (L12, L15, L16) and the arc split (L14).

**Final pass:** pending — a fresh codex session on this plan and the ledger.

## 10. Post-implementation (self-contained — the implementing session executes this from here)

`code_review` is `off`: no `/code-review` pass runs.

**Per arc, at its boundary** (after the arc's gate, before `gh stack add`):
1. Codex audit through `/codex` at `high` (the helper scripts, never `codex exec` directly): the arc's diff
   (`git diff <arc base>...HEAD`), this plan, the decision ledger, the arc map ("this is arc N of 5; later arcs build
   …"), and the asks: *What could go wrong? What would an attacker target? What are we trusting that we shouldn't?
   Where are the supply-chain, crypto and least-privilege weaknesses?* — plus the two rules below, verbatim.
2. Triage: verify each factual claim against the repo first; apply the accepted fixes; commit; log the round (the
   consult and the verdict) in `lessons/phase-N.md`.
3. Resume the same codex session with the fix diff; repeat until a round yields no new material findings. Still
   material after three rounds: stop and surface to the owner.

**After arc 4b:** one fresh codex session over the net diff from `main`, asking for cross-arc issues (seams between
arcs, duplication across arcs, drift from this plan), with the same rules and the same loop.

**Then Delivery** (§7) — the first time any pull request exists.

The no-over-engineering rule (verbatim in every codex prompt, initial and resumed): *"Report bugs and small, targeted
improvements only. Do not propose speculative abstractions, extra configuration surface, new layers, or rewrites —
the smallest change that fixes each real problem. If code works and is clear, leave it alone."*

The comment-quality rule (verbatim in every codex prompt): *"Audit the comments for value per character. Flag any
comment that narrates what the code visibly does, restates its line, references implementation plans / phases /
reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious invariant or constraint
deserves a comment it doesn't have. Comments are permanent context every future reader, human or LLM, pays to
re-read: they must be few, dense, and exact."*

Implementation rules: comments say what the code cannot and never cite this plan; conventional, signed commits
(commitlint: header and body lines ≤ 100); `agent-worktree status yacana-one-surface "<phase> green: <next>"` at each
gate; `LESSONS_FILE=implementations-plan/yacana-one-surface/lessons/phase-N.md` printed when a phase closes; three
failures on one step (five under `/loop`) → stop and reassess with codex.

## Seeds (draft — finalized after approval)

Recommended: `/goal` (completion is visible in the transcript).

```
/goal All phases P1–P8 marked ✓ in implementations-plan/yacana-one-surface/plan.md (the phase headers in the file), each ✓ backed by its phase's validation gate from plan.md §6 reported passing in the transcript; for each phase the agent has printed `LESSONS_FILE=implementations-plan/yacana-one-surface/lessons/phase-N.md`; code_review is off, so /code-review was NOT run; the codex fix loop converged for each of the five arcs at its boundary and for the final cross-arc pass, each evidenced by a resumed codex pass reporting no new material findings, quoted in the transcript; the stack of five PRs exists on GitHub, created only after all loops converged (`gh stack view` output in the transcript); `bun run lint` and `bun test` both report exit 0 in the transcript.
```

Alternative: `/loop` (use exactly one of the two per session).

```
/loop 15m Drive implementations-plan/yacana-one-surface forward. Never idle waiting for my input. Each firing:
1. Reality check: read plan.md and lessons/ (authoritative, not the chat). If the plan moved to implementations-plan/archive/ or carries an `## Outcome` block, STOP. Otherwise rebuild the task list from plan.md if empty; `git status`, `git log --oneline -5`; with PRs open, `gh stack view`.
2. Waiting on CI is fine: confirm it progresses (`gh run watch <id>` up to 10 min), use the wait to review the diff or prepare the next phase.
3. No task in hand: take the next pending step of plan.md §6; after each meaningful edit run the fast layers; commit; `gh stack push`.
4. Stuck, or a decision you would bring to me: `/codex high` with full context until you two reach a defensible decision; log it in lessons/phase-N.md. Hard limits stay hard: never merge, publish or deploy, never widen scope beyond plan.md.
5. Same step failed 5 times: stop, reassess with codex, continue on the agreed path.
6. Phase green = its §6 gate passes: paste the result, mark ✓ in plan.md, file lessons, print LESSONS_FILE=…, `agent-worktree status yacana-one-surface "<phase> green: <next>"`. Arc boundary: the codex loop of §10 until nothing material, then `gh stack add <next branch>`.
7. All phases ✓: the fresh cross-arc codex pass of §10, then Delivery per §7 (the first PRs), `gh pr checks --watch`, `gh pr ready` once green, and a wrap-up: what shipped, every contested decision with its ELI5 context, open items. Surface and stop.
```
