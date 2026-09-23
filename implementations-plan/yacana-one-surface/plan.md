---
plan: yacana-one-surface
tier: mid
driver: claude-code
eli5_mode: artifact
code_review: off
hardening: none (no new trust boundary; the hosted Stats reads only what the miner's guard already admits)
budget: "recon 3 agents (Stats mapper, miner sweep, landing and Stats sweep); codex at high (GPT-6 Astra); the Claude leg on Opus 5.5 (the owner prefers it to Fable); code-review off (owner, 2026-09-23)"
status: drafting 2026-09-23
created: 2026-09-23
---

# yacana-one-surface — the owner's second feedback round, built to the canvas

Design input, authoritative for every word and pixel: the canvas "Yacana One Surface"
(https://claude.ai/artifact/9eMM61VNH7ACHaagGKq6BQ), version 4, with the owner's picks of 2026-09-23. Its
artboards are kept beside this plan in `canvas/` (`canvas/copy.md` is their text, extracted: a string there is
the string in the app). `recon.md` holds the reuse map, the facts with file:line, and the tests that move.

## 1. Goal

Ship the canvas's decisions as four stacked pull requests, every phase green on its gate, every arc through its
codex loop, with no regression in any existing browser suite.

Done means:
- `/mine` has one bar, **Mine · Wallet · Stats**. Stats opens inside the miner at `/mine/stats`, `/mine/stats/bridge`,
  `/mine/stats/verify`, with no reload and mining uninterrupted; `/stats` stays the public page with the same bar.
- A first visit to `/mine` explains what Yacana is, ending on the flywheel line; one click dismisses it for good.
- The miner, the mini window, Stats and the landing use one word for how hard a win is: **difficulty**.
- A claim that fails because the node dropped a block recovers by itself (up to three tries while mining waits),
  never claims twice, and Start no longer throws a retained win away.
- The small fixes: the Presto slider rule, the two-line pop-out, the mini-window setting, the recovery line, Lucide
  icons at stroke 1.5.
- The landing: the copy edits, the flywheel section between How and Verify, a "Why" anchor, one FAQ entry, and no
  download size anywhere.

## 2. What the canvas decided (short form; the canvas is authoritative)

| Item | Pick | Artboards |
|---|---|---|
| Navigation | **B** — Stats inside the miner, sub-tabs Overview · Bridge · Verify, "mining here · 11.8 proofs/min · 1 win" at the right of the sub-tabs; `/stats` public with the same bar | `Nav-Shell` |
| First visit | **A** — the dismissible strip, its copy ending on "…so the race to mine faster is a race to make Aztec faster." | `Cold-Strip` |
| Words | the deck and the tiles as drawn ("super") | `Words-Deck`, `Words-Tiles` |
| Presto | the slider leaves as soon as Presto is found and the user said yes; Settings locks at the same moment | `Fix-Presto` |
| Pop-out | **A** — 360 × 216, two lines: the user's numbers, then the network's | `Fix-Popout` |
| Recovery line | "save a recovery file · restore from a file · 2 crossings saved" | `Fix-Restore` |
| Mini-window setting | **A** — Pop out always shown; the setting, "Open the mini window when mining starts", opens it with the Start click | `Fix-Mini` |
| Claims | **A** — up to three tries in about three minutes while mining waits, then today's Retry; Start retries a pending win first | `Recover` |
| Icons | Lucide at stroke 1.5: `Pickaxe`, `Wallet`, `ChartColumn`, `ShieldCheck`, `Settings`, `FingerprintPattern` | `Icons` |
| Landing | hero headline kept ("audience" rejected); no download size anywhere; no testnet talk; the rest as drawn | `Landing-Copy` |
| Flywheel section | **A** — the loop: earn → optimize → upstream → grow, around "The difficulty keeps issuance at 4 wins every 5 min, however fast proving gets." | `Fly-A` |

Defaults this plan chose where the canvas is silent (each is in the decision ledger, §8, and reversible):
- The strip also goes away when its own Start is pressed (starting is understanding).
- On `/stats`, Mine and Wallet are plain same-tab links: nothing mines on the watcher's page.
- Stats' reader-facing "claims" become "wins"; the CSV and JSON `claims` columns stay (a data contract).
- The live download progress ("13.0 of 20 MB") stays: it measures, it does not warn.
- No Bridge icon: Bridge becomes a text sub-tab, as drawn.
- The old origin (`v5.yacana.network`) keeps its bar (Send ahead · Stats ↗).
- The flywheel copy says "speedups that land in Barretenberg", never "miners improve Barretenberg": the retarget
  cancels a public speedup and pays for a private one (raised with the owner 2026-09-23).

## 3. Architecture & Implementation

### 3.1 Words, icons, the small fixes (arc 1)

**Icons.** `packages/ui/src/components/icons.tsx` keeps its API (`Icon({ name, size })`, `data-icon`), and its
glyphs become Lucide components at `strokeWidth={1.5}`: `mine → Pickaxe`, `wallet → Wallet`, `stats → ChartColumn`,
`verify → ShieldCheck`, `settings → Settings`, `finger → FingerprintPattern`. No consumer changes. The hand-drawn
paths go.

**Words.** One module owns the miner's difficulty sentences, `apps/web-miner/src/lib/words.ts` (the epoch tips, the
difficulty tip with its live number, the chart's popover, the empty caption, the mini window's tooltip), so
`RailTile`, `LoopTile` and the pop-out stop duplicating them. `packages/ui` components change their own defaults and
labels to the deck's words (`score-loop.tsx`: the axis, the line caption, the hover card "#128 · reached 23.4 · below
the difficulty", the retarget mark, the aria label; `proof-line.tsx`: "reached"), and `PipView` passes its caption
explicitly instead of inheriting `ScoreLoop`'s default. "next difficulty, if closed now" shows the absolute value and
the ratio, `147.8 (×2.31)` = `difficulty × closePreview` through `difficultyLabel`. Stats: `Table.tsx`, `Detail.tsx`,
`Observatory.tsx`, `charts/specs.ts` and `miner-core/src/metrics.ts` `sentence()` say "wins" where a reader sees
"claims"; `csv.ts` and `reader.ts` keep their keys. "bar" is replaced only where it means the threshold (never a
progress bar, a stacked bar or the Stepper).

**Presto.** `PrestoView.native` is replaced by `decides` = standing ∈ {`found`, `remembered`, `proving`} (`found`
always carries consent, `presto.ts:184-186`). Its readers: `RailTile.tsx:44` (the slider row hides),
`Settings.tsx:107,111` (the slider locks, with the canvas caption), and the `[` `]` hotkeys in
`use-page-behaviour.ts:50`, which stop moving the threads while Presto decides (today they read `active`, which would
leave a hidden control live). The ✦ suffix keeps reading `active === 'presto'`: it says who proved, not who decides.
The rail row gains "· its own speed setting decides".

**Pop-out.** `PIP_SIZE = { width: 360, height: 216 }`; `PipView`'s footer becomes two rows that wrap instead of
clipping: "11.8 proofs/min · native" and "1 win · 4 tYACA", then "epoch 57 · 1 of 4 wins · difficulty 64.0".

**Mini-window setting.** `PopOut` renders whenever `pipSupported()`; `settings.pip` keeps its key and now means "open
the mini window when mining starts": the signed-in Start click calls `openPip()` synchronously, before
`session.startMining()`, when the setting is on and no window is open (`requestWindow` needs the click's activation;
`LoopTile.tsx:122` is the precedent). The signed-out Start starts mining only after the passkey ceremony, outside
the activation, so it does not open the window; the button stays. The Settings row reads "Open the mini window when
mining starts" with the hint "your Start click opens it; browsers don't let a page open it when you switch tabs".
A stored `pip: true` now opens the window on Start: that visitor asked for the mini window.

**Recovery line.** `ActivityList.tsx:138` drops "advanced ·" and separates the three items with "·".

### 3.2 Claims that recover by themselves (arc 2)

The pieces exist; what changes is who calls them and when.

- **Classifier** (`packages/miner-core/src/claim-failure.ts`): two kinds join, both out of today's `'other'`:
  `'anchor-pruned'` for the node's "Block hash … not found when resolving query … possibly a reorg has occurred",
  and `'lost'` for our own "no effects for 0x…" (`chain.ts:127`, its text exported as a constant the classifier
  matches). Fixtures carry the two messages the owner saw.
- **Rule:** a claim whose transaction went out is reconciled before anything is sent again; one that never went out
  is proved again. That is `retryOnce` today (`fate` → `adopt`, or resend when `retryEligible`). One addition:
  when `fate` says `dropped`, the ticket's siloed nullifier is looked up
  (`findLeavesIndexes('latest', NULLIFIER_TREE, [ticketNullifier])`, the `miningSettlement` pattern): present means
  a lagging node, so the claim waits for the next check instead of being resent.
- **Scheduler** (`controller.ts`): after a failure classified `anchor-pruned` or `lost`, the controller schedules
  `retryPendingClaim()` itself — before try 2 after 5 s, before try 3 after 30 s — while mining stays halted. It stops
  early when the claim's epoch is no longer the open one (the win is then discarded with today's "not claimed: the
  epoch closed before the claim went out"), and cancels on dispose, a node switch or a pause. A reconciliation that
  answers `unknown` re-checks on the same schedule without resending. After try 3 the line falls back to today's
  manual Retry with the canvas's text. Any other `'other'` failure keeps today's manual Retry: an unrecognized error
  is not retried blind.
- **Start** (`controller.start`): with a retained claim still eligible, Start runs `retryPendingClaim()` first, and
  mining resumes when the claim resolves (`resumeAfterClaim`). With the epoch closed, the win is discarded with its
  line and mining starts. The `'mine'` command stops clearing the retained claim's secret while that claim's epoch is
  open (`controller.ts:552-557` clears every secret today, which is what forfeits the win).
- **Lines** (`lib/claim-copy.ts`, reducer notes): the canvas's `Recover` A texts — "the node dropped the block it was
  reading · proving again, try 2 of 3", "the node lost sight of it · checking the chain for your claim", "it didn't
  land · sending again, try 2 of 3", and after three: "couldn't claim after 3 tries: the node keeps dropping blocks ·
  the win stays claimable until epoch 57 closes" with Retry. The reducer carries the try count and the reason as
  note fields; the running and minted lines are today's.
- **Out of scope:** `syncChainTip: 'checkpointed'` (it would make the pruned anchor rare at the cost of a staler
  anchor, a slower claim and more "epoch is not open" refusals); a follow-up to measure on the testnet.

### 3.3 The first visit and the landing (arc 3)

**Intro strip.** `apps/web-miner/src/features/IntroStrip.tsx` renders the `Cold-Strip` copy (the reward and symbol
from `PARAMS`, not literals) with Start mining, "How it works ↗" (the landing's `/#how`, a new tab) and a dismiss ×.
`apps/web-miner/src/intro.ts` stores `yacana.intro` (`{ dismissed: true }`) on the `settings.ts` parse, load and save
convention: try/catch, validated, a storage that throws means the strip shows. It mounts at the top of `Mine.tsx` and
joins the `above` row count (`Mine.tsx:79`) so the grid does not misalign. Its Start is the cockpit's `onStart` (the
pop-out rule included) and dismisses it.

**Landing.** Copy per `Landing-Copy` in `apps/web-landing/src/copy.ts` and `faq-copy.ts`; the question "How is it
mined?" keeps its exact text (`faq-copy.ts:56` looks it up by it). `HeroLive.tsx`: the Kpi label "difficulty" and
"4 wins · by browsers"; `BarChart.tsx`'s reader-facing "accepted" becomes "wins"; How's step 2 is named `hash`.
The flywheel is `apps/web-landing/src/sections/Why.tsx`, section id `why`, inserted between How and Verify in
`SECTIONS`, `bar.anchors` ("Why") and `App.tsx`:
- from `md` up, an SVG ring (circle and four arcs with path arrowheads, on the `RuleDiagrams` conventions: token
  classes, no `<marker>`) with the four nodes as HTML boxes over it and the centre sentence;
- below `md`, the same four steps as How's numbered list;
- `role="img"` with a label naming the four steps in order on the ring; its own test id (`why-loop`), because two
  tests count `rule-diagram`.
The download size leaves `copy.ts:45` and `PreflightTile.tsx:10`.

### 3.4 One surface: Stats inside the miner (arc 4)

**The package.** `packages/stats-view` (`@yacana/stats-view`, layer 2) takes what web-stats renders and reads:
`state.ts`, `beats.ts`, `window.ts`, `history-fill.ts`, `history-cache.ts`, `map-geometry.ts`, `read-fixed.ts`,
`read-window.ts`, `serial.ts`, `explorer.ts`, `bridge.ts`, `bridge-beat.ts`, `chain.ts`, `charts/*`, `features/*`,
the three pages, and their specs. New in it:
- `runtime.ts`:
  ```ts
  interface StatsRuntimeDeps {
    store: Store;                // the host's jotai store; the atoms live there
    connection: Connection;
    busy?: () => boolean;        // the host's reads go first: the history fill waits while true
  }
  interface StatsRuntime {
    start(): void;               // idempotent: boots once, then resumes the poll, the fill, the bridge poller, the clock
    stop(): void;                // clears the timers; reads in flight finish into the atoms
    showWindow(w: EpochWindow): Promise<void>;
    poll(): Promise<void>;
  }
  function createStatsRuntime(deps: StatsRuntimeDeps): StatsRuntime;
  ```
  It is `main.tsx`'s boot without the page: it never calls `setNodeEndpoint` or `setEthRpcEndpoint`. The host owns
  the guard's slots.
- `host.tsx`: a context with `pathFor(page)`, `navigate(page)` and `faqHref`, which the pages read instead of
  importing a router (`routes/Stats.tsx:13`, `features/VerifyTile.tsx:6` today).
- `url-state.ts`: `?epoch=` and `?from=` (`select`, `setFrom`, `useSelected`, `useFrom`), moved from web-stats'
  router.
- `SubNav.tsx`: Overview · Bridge · Verify, with an `aside` slot.
- `pages.tsx`: `StatsPages({ page, connection, onWindow })`, the entry a host renders (the `Announcement` line
  included, so both hosts show it).

The navigation event and its subscription move to `packages/web-kit/src/browser/navigation.ts` (`NAVIGATE`,
`subscribeLocation`, `dispatchNavigate`), used by both routers and `url-state` — one definition instead of three.

**web-stats after the move** is a shell: `main.tsx` sets the node slot (10 s) and, with a bridge record, the Ethereum
slot (10 s), creates the store and the runtime, starts it and renders; `App.tsx` keeps the header, `Freshness`, the
node banner, the footer and `document.title`; `routes.ts` keeps its paths (`apps/site` imports its `Route`).

**The miner hosts it.**
- `routes.ts`: `Route = 'mine' | 'wallet' | 'settings' | 'stats' | 'stats/bridge' | 'stats/verify'`, parsed from up to
  two segments. The path-shaped members make `assemble.ts`'s `MINER_LINKS` emit `/mine/stats/bridge /mine/ 200`
  unchanged (exact sources, which Cloudflare serves without shadowing assets).
- `routes/Stats.tsx` is loaded with `React.lazy`, behind a `Suspense` fallback of `packages/ui` skeletons. It owns
  one module-level runtime and runs it only while a stats route is shown:
  `useEffect(() => { runtime.start(); return runtime.stop }, [nodeUrl, ethRpcUrl])`. A node or RPC switch
  recreates the runtime, because the guard admits only the endpoint in use and the history cache is keyed by it.
  `busy` is "a claim is in flight" (`minerAtom`'s phase). Nothing hosted sets the title: the miner's tab status owns it.
- The guard: the node slot is the miner's (120 s). The Ethereum slot is set by the session exactly when a bridge
  record exists (`session.ts:238-240`), the same condition under which the runtime reads L1, so nothing new is
  admitted. Hosted reads inherit the miner's deadlines — a stuck read stalls a tile, never the miner.
- The bar: `packages/ui` gains `siteTabs({ current, href, onSelect, waiting })`, the three tabs (labels, icons, test
  ids, order) defined once. The miner passes in-app `onSelect` for all three; web-stats passes plain links for Mine and
  Wallet (`/mine/`, `/mine/wallet`) and in-app Stats. Verify leaves the top level. `oldTabs` is unchanged.
- The sub-tabs sit under the bar on both hosts; the miner's `aside` is "mining here · N proofs/min · N win(s)" while
  mining, nothing otherwise.
- `App.tsx`: the stats routes render the lazy page, and the sign-in dialog does not sit over them (like Settings).
- Bundle: the miner's entry chunk must not reach `@yacana/stats-view` or `@observablehq/plot` statically.
  `apps/web-miner/scripts/check-chunks.ts` reads the build's Vite manifest and fails otherwise; it runs in the arc gate
  and in CI after the site build.

### 3.5 Data and control flow (the two critical paths)

1. `/mine/stats` while mining: the tab's `onSelect` → `navigate('stats')` → `pushState` + `NAVIGATE` → `useRoute` →
   the lazy chunk loads once → `runtime.start()` → reads through the miner's node client slot → atoms → tiles. The
   controller, the Worker and the claim path never notice; the fill yields while a claim is in flight.
2. A claim the node loses: `submit()` → `sent.wait()` throws "no effects for" → `'lost'` → retained with its hash →
   5 s → `retryOnce`: `fate` → re-included → `adopt` → minted ✓; or `dropped` → nullifier absent → resend, try 2 of 3;
   or `unknown` → check again in 30 s; epoch closed → discarded.

### 3.6 File-level change map

| Phase | Added | Modified | Removed |
|---|---|---|---|
| P1 | — | `ui/src/components/icons.tsx`, `ui/src/components/header.vitest.tsx` | the hand-drawn paths |
| P2 | `web-miner/src/lib/words.ts` | `RailTile.tsx`, `LoopTile.tsx`, `LedgerTile.tsx`, `ui/…/score-loop.tsx`, `ui/…/proof-line.tsx`, web-stats `Table.tsx`, `Detail.tsx`, `Observatory.tsx`, `charts/specs.ts`, `miner-core/src/metrics.ts`, their specs, the eight Stats baselines | — |
| P3 | — | `use-presto.ts`, `RailTile.tsx`, `Settings.tsx`, `use-page-behaviour.ts`, `pip.ts`, `LoopTile.tsx`, `settings.ts`, `ActivityList.tsx`, the Presto and pop-out specs | — |
| P4 | `e2e/claim-recovery.e2e.ts` | `miner-core/src/claim-failure.ts` (+test), `controller.ts`, `chain.ts`, `lib/reducer.ts` (+test), `lib/claim-copy.ts`, `tests/recovery.bun.test.ts`, `tests/claim-lines.bun.test.ts`, `e2e/fixtures.ts`, `e2e/shards.json`, `e2e/proof-inventory.ts` | — |
| P5 | `features/IntroStrip.tsx`, `intro.ts`, their spec | `routes/Mine.tsx`, the cockpit e2e and the replay specs it moves | — |
| P6 | `web-landing/src/sections/Why.tsx` (+spec) | `copy.ts`, `faq-copy.ts`, `App.tsx`, `HeroLive.tsx`, `BarChart.tsx`, `sections.vitest.tsx`, `e2e/landing.e2e.ts`, `web-miner/…/PreflightTile.tsx` | — |
| P7 | `packages/stats-view/**`, `web-kit/src/browser/navigation.ts` | web-stats `main.tsx`, `App.tsx`, `routes.ts`; web-miner `routes.ts`; root `package.json`, `tsconfig.json`, `bun.lock`, the CI filters the layout guard names | the moved web-stats modules |
| P8 | `web-miner/src/routes/Stats.tsx`, `ui/src/components/site-tabs.ts`, `web-miner/scripts/check-chunks.ts`, `e2e/stats-host.e2e.ts` | web-miner `routes.ts`, `App.tsx`, `lib/tabs.ts`; web-stats `App.tsx`; `site/src/assemble.ts`, `site/e2e/site.e2e.ts`, web-stats `e2e/stats.e2e.ts`, the eight baselines, `.github/workflows/site.yml` | `minerTabs`' external Stats and Verify |

### 3.7 Trade-offs and alternatives not taken

- **One app, two doors** (the competing outline, `plan-outline-one-app.md`): web-stats folds into the miner as a second
  Vite entry. One router and no package API, but the miner app takes on the watcher's page, its CI and its screenshot
  gate, and the watcher's build inherits the prover's configuration. Rejected for single responsibility and churn;
  the audits weigh it.
- **Nested routes** (`'stats'` plus a sub-route): cleaner types, but `MINER_LINKS` would need a second mechanism.
- **An iframe of `/stats`**: two React roots and two runtimes on one page; rejected.
- **Auto-retrying every `'other'`**: an unrecognized failure (a circuit error) would be proved again three times for
  nothing; only the two recognized kinds are retried.
- **Keep mining during recovery** (the canvas's B): the owner picked A; B needs a second held win beside a running
  miner.

## 4. Security & Adversarial Considerations

- **Threat model.** Nothing here adds a server, a secret, a permission or an origin. The surfaces: the fetch guard (a
  hosted module could reconfigure it), the claim path (a retry loop could double-spend proving, pay the sponsor for
  reverts, or keep a secret too long), the page (copy that overclaims, a hidden control with live effect), and the
  build (a chunk that pulls the stats code into the miner's first paint).
- **Guard ownership.** The runtime never calls the setters (a unit test spies on them); the miner's slots stay
  120 s / 30 s with Stats open (asserted in the host's test). Hosted Stats reads only the node and the RPC the miner
  already admits; a switch recreates the runtime rather than widening the guard.
- **Claims.** A resend never mints twice: the nullifier is a function of the ticket (`main.nr:221`). A claim against a
  closed epoch fails at simulation ("epoch is not open"), before proving or paying; the scheduler also stops on the
  epoch's close. At most three tries, single-flight (`retrying`), cancelled on dispose, switch and pause. Secrets stay
  in memory only, and the retained one lives no longer than its epoch. The nullifier lookup tells the node nothing it
  did not learn when it received the claim from this address.
- **Least privilege.** No new CI permission; `site.yml`'s chunk check runs under the existing `contents: read`.
- **Cryptography.** None new; `ticketNullifier` (Poseidon2 via `@aztec/foundation`, pinned by the lockfile) reused.
- **Input validation.** `yacana.intro` parsed and validated with a safe default; URL state keeps its integer checks.
- **Supply chain.** No new npm package; `@observablehq/plot` and `lucide-react` are already locked. The new workspace
  changes `bun.lock`'s workspace section only; CI's frozen install proves it.
- **Frontend.** No HTML injection (static copy); the pop-out opens only on the user's click; a hidden slider stops
  its hotkeys; the flywheel copy is kept to what is true (a public speedup is cancelled by the retarget).

## 5. Assumptions

### Facts (verified)
1. A claim lands only while its epoch is open: `main.nr:188` (simulation) and `:231-233` (`record_claim`).
2. The claim nullifier is `Poseidon2([DOM_NULL, digest])` (`main.nr:221`); `ticketNullifier` siloes it
   (`miner-core/src/proof.ts:51-53`).
3. "no effects for" is thrown by `chain.ts:127` after `waitForTx` reached `PROPOSED`.
4. `retryOnce` reconciles a known hash through `fate` and `adopt` and resends only when `retryEligible`
   (`controller.ts:787-863`).
5. `'mine'` clears every secret and the retained ticket (`controller.ts:552-557`).
6. `findLeavesIndexes` returns `DataInBlock<bigint> | undefined` (`@aztec/stdlib` 5.2.0 `aztec-node.d.ts:57`).
7. `found` always implies consent (`presto.ts:184-186`); `native` has two readers (`RailTile.tsx:44`, `Settings.tsx:107,111`);
   the hotkeys read `active` (`use-page-behaviour.ts:50`).
8. The signed-in Start is synchronous in the click (`LoopTile.tsx:182`, `App.tsx:139`); the signed-out one mines after
   the passkey ceremony (`session.ts:462-466`).
9. The guard's node and RPC slots are single, last write wins (`node-guard.ts:67-89`); the miner sets 120 s and 30 s,
   Stats 10 s and 10 s.
10. The session admits the RPC exactly when a bridge record exists (`session.ts:238-240`); Stats reads L1 under the same
    condition (`web-stats/src/bridge.ts:99-105`).
11. The slot table and layouts are fetched from the origin root (`web-kit/src/browser/slots.ts`); the miner's prebuild
    copies them.
12. Both routers dispatch `'yacana:navigate'` (`web-stats/src/routes.ts:19`, `web-miner/src/routes.ts:16`).
13. `MINER_LINKS` is `Record<Exclude<MinerRoute,'mine'>, true>` expanded to `/mine/${r} /mine/ 200` (`assemble.ts:71-77`).
14. No code splitting exists in the repo (searched `React.lazy`, `lazy(`, `import(`, `manualChunks`).
15. web-stats already says "difficulty"; its reader-facing "claims" are `Table.tsx:14,59`, `Detail.tsx:81-84`,
    `Observatory.tsx:63`, `charts/specs.ts:471-472`; `csv.ts:5` and `reader.ts` are data.
16. `faq-copy.ts:56` looks "How is it mined?" up by its exact text.
17. The Stats screenshot gate is eight zero-tolerance baselines regenerated only in
    `mcr.microsoft.com/playwright:v1.62.1-noble`; docker and the image are on this machine.
18. The canvas's icons are Lucide's `pickaxe`, `wallet`, `chart-column`, `shield-check`, `settings`, `fingerprint-pattern`
    (matched path for path against `lucide-react` 1.34).
19. The miner shows `DesktopOnly` below desktop widths (`App.tsx`), so `/mine/stats` is desktop-only; `/stats` is not.

### Inferences (unverified — attack these)
1. The Stats chunk is small beside the miner's bb.js and circuit chunks; P8 measures it with the manifest.
2. Chart re-renders beside the prover Worker cost nothing measurable.
3. A resend of a claim that landed is rejected by the node for its duplicate nullifier before inclusion, so it costs
   the sponsor nothing.
4. A node or RPC switch in the miner changes `connection.nodeUrl` / `ethRpcUrl` as the Stats route sees them (the
   effect dependencies), with no path that swaps the guard's slot without it.
5. `requestWindow` called synchronously before `startMining()` in the same click still has activation (Chrome's
   transient activation is time-based and nothing earlier in the handler consumes it).
6. The replay recording needs no re-record: the strip changes the page, not the node traffic.

### Asks
None open: the owner answered the four Phase 0 questions (flywheel A, the same validation as last pass, one plan as
stacked PRs, code-review off) and chose `mid`. The defaults in §2 are listed for the approval.

## 6. Phases with validation gates

Fast layers, after every meaningful edit and at every gate:

```sh
bun run lint && bun test
bun run typecheck
bun run test:components
bun run --cwd apps/web-miner test:replay
```

Every e2e run goes through `bun run e2e:agent -- …` in tmux. A shard passes when every title of its inventory
executed; proof floors bind only on real-proving runs. Real-proving gates spell `E2E_PROVERLESS=0`.

**Before P1** (once per machine): `bunx playwright install chromium` if Playwright 1.62.1's build is absent, and
`bash tools/localnet/bin/install-presto-server.sh` (the `chain` shard holds `presto.e2e.ts`, and a skipped title
fails the inventory).

### Arc 1 — words, icons, the small fixes

**P1 · Lucide icons.** §3.1. Gate: fast layers; `header.vitest.tsx` asserts each tab's Lucide glyph by name instead
of counting paths; `shell.vitest.tsx` unchanged. Layers: lint, typecheck, unit.

**P2 · One word: difficulty.** §3.1, every row of `Words-Deck` and `Words-Tiles`, Stats' "wins". Gate: fast layers
with the moved specs (`cockpit.vitest.tsx`, `loop-tile.vitest.tsx`, `ui` `score-loop.vitest.tsx`, `tooltip.vitest.tsx`,
`signature.vitest.tsx`, `metrics` tests, Stats' vitest); a grep over `apps/web-miner/src` and `packages/ui/src` finds no
reader-facing "score", "the bar" or "target length" outside tests of the old behaviour; the eight Stats baselines
regenerated in the pinned image and each diff inspected (header icons and words only). Layers: lint, typecheck, unit,
visual.

**P3 · Presto, the pop-out, the setting, the recovery line.** §3.1. Gate: fast layers; `presto-standing.bun.test.ts`
extended (`decides` at `found`); `presto-indicator.vitest.tsx` and `settings.vitest.tsx` assert the slider hidden and
locked at `found` and back at `absent`; a hotkey spec (`[` at `found` changes nothing); a loop-tile spec renders the
two-line footer in 360 px without overflow; `miner.e2e.ts` "the pop-out…" drives the always-present button.

**Arc 1 gate:** fast layers; `E2E_PROVERLESS=1 E2E_SHARD=cockpit`, `…=chain`, `…=bridge` and
`E2E_PROVERLESS=0 E2E_SHARD=canary bun run e2e:agent -- bun run --cwd apps/web-miner test:e2e`;
`bun run e2e:agent -- bun run --cwd apps/web-stats test:e2e`; `bun run --cwd apps/web-stats test:visual`.

### Arc 2 — claims that recover by themselves

**P4 · Classify, schedule, reconcile, keep the win.** §3.2. Gate: fast layers;
`claim-failure.test.ts` with the two real messages; `tests/recovery.bun.test.ts` on a fake node and Worker:
(a) `anchor-pruned` once → proved again → minted; (b) `lost` → `fate` re-included → adopted, not resent; (c) `lost` →
`dropped`, nullifier absent → resent once; (d) `dropped` with the nullifier present → no resend; (e) the epoch closes
mid-recovery → discarded, nothing sent; (f) three failures → the manual Retry line; (g) Start with a retained claim →
the claim first, mining after; (h) a retained secret survives `'mine'` in its epoch; (i) an unrecognized `'other'` →
no automatic try. `claim-lines.bun.test.ts` and `reducer.test.ts` cover the new lines. `e2e/claim-recovery.e2e.ts`
(in `chain`, in the inventory): the node refuses the first `sendTx` with the pruned-anchor error → the claim mints;
the first effect-bearing receipt comes back without effects → the claim is adopted in its block.

**Arc 2 gate:** fast layers; `E2E_PROVERLESS=1 E2E_SHARD=chain` and `E2E_PROVERLESS=0 E2E_SHARD=canary` (the claim
path proves for real).

### Arc 3 — the first visit and the landing

**P5 · The intro strip.** §3.3. Gate: fast layers; an `IntroStrip` spec (shows on a first visit, × persists, its Start
starts and dismisses, a throwing storage still shows it, the grid row count follows); a cockpit e2e test (first visit
shows it, dismissed survives a reload); the replay lane green.

**P6 · The landing and the flywheel.** §3.3. Gate: fast layers; a `Why` spec (four steps in ring order, the list below
`md`, the label, its test id); `sections.vitest.tsx` updated; `landing.e2e.ts` with the `why` section id and the "Why"
anchor; a grep over `apps/` and `packages/*/src` finds no "20 MB" in copy; `external-link-arrows` green.

**Arc 3 gate:** fast layers; `bun run e2e:agent -- bun run --cwd apps/web-landing test:e2e`;
`E2E_PROVERLESS=1 E2E_SHARD=cockpit`.

### Arc 4 — one surface

**P7 · `@yacana/stats-view`, web-stats as its shell.** §3.4. A pure move: nothing on `/stats` changes. Gate: fast
layers (the layout and boundaries guards accept the package); `bun run --cwd apps/web-stats test:visual` passes against
the P2 baselines **without** regenerating; `bun run e2e:agent -- bun run --cwd apps/web-stats test:e2e`; a runtime spec
(no setter called; `busy` holds the fill; `start`/`stop` idempotent; timers cleared on stop).

**P8 · The miner hosts Stats.** §3.4. Gate: fast layers; `routes` spec (the six routes round-trip through
`routeFromPath`/`pathFor`); `siteTabs` spec; `check-chunks.ts` passes on `bun run site:build`; `e2e/stats-host.e2e.ts` (in
`cockpit`, in the inventory): mining, open Stats → Bridge → Verify → back, proofs keep counting, the page never
reloads (a window marker survives), the guard's slots unchanged, back/forward restore the sub-page; `stats.e2e.ts`'s
bar labels; `site.e2e.ts` serves `/mine/stats`, `/mine/stats/bridge`, `/mine/stats/verify` cross-origin isolated;
the eight baselines regenerated (the bar and the sub-tabs) and each diff inspected.

**Arc 4 gate:** everything once on the stack's top: fast layers; all four miner shards (three proverless, `canary`
real); web-stats e2e and visual; web-landing e2e; `bun run e2e:agent -- bun run site:e2e`; `bun run lint:actions`.

## 7. Delivery — arcs → stacked PRs

| Arc | Branch | Phases | Stacks on | code-review |
|---|---|---|---|---|
| 1 · words, icons, fixes | `worktree-yacana-one-surface` | P1–P3 | `main` | off |
| 2 · claims recover | `yacana-one-surface-claims` | P4 | arc 1 | off |
| 3 · first visit, landing | `yacana-one-surface-first-visit` | P5–P6 | arc 2 | off |
| 4 · one surface | `yacana-one-surface-stats` | P7–P8 | arc 3 | off |

Start: `gh stack init --adopt worktree-yacana-one-surface`. At each arc boundary, after the arc's gate and its codex
loop: `gh stack add <next branch>`. Nothing is opened as a pull request, not even a draft, before the final cross-arc
pass converges. Then `gh stack submit --auto`, `gh pr edit` bodies (ending with the Claude Code line), and
`gh pr checks --watch` per PR. `gh stack merge` is the owner's.

## 8. Decision ledger

Filled as the audits land; each row: decision, source, alternatives rejected and why, status.

| # | Decision | Source | Rejected | Status |
|---|---|---|---|---|
| L1 | Stats as a package with two hosts | main draft | one app, two doors (`plan-outline-one-app.md`) | audit |
| L2 | Path-shaped miner routes | main draft | nested sub-route (a second rewrite mechanism) | audit |
| L3 | The host owns the guard's slots; hosted reads inherit its deadlines | recon | the runtime setting its own (shortens the miner's `sendTx`) | audit |
| L4 | The runtime restarts on a node or RPC switch | main draft | following the switch inside the runtime | audit |
| L5 | Auto-recovery = the scheduled reconciliation-first Retry, for two recognized kinds | main draft | retrying every `'other'` | audit |
| L6 | `pip` keeps its key, now "open on Start" | main draft | a new key (drops the visitors' choice) | audit |
| L7 | `native` → `decides` (found, remembered, proving), hotkeys included | recon | keeping the name with a new meaning | audit |
| L8 | The strip also leaves on its own Start | default | dismiss only | owner at approval |
| L9 | Stats' reader-facing "claims" → "wins"; data keys unchanged | default | renaming the CSV/JSON columns | owner at approval |
| L10 | `syncChainTip` measured later | main draft | changing it here | owner at approval |
| L11 | No Bridge icon (a text sub-tab) | canvas | an icon for a tab that leaves | owner at approval |
| L12 | `/stats`' Mine and Wallet are same-tab links | default | new-tab links | owner at approval |
| L13 | `siteTabs` in `packages/ui` | main draft | two builders with a parity test | audit |
| L14 | The chunk check in CI | main draft | a local-only check | audit |

## 9. Audit verdicts

Pending: codex (GPT-6 Astra, high) and the Claude leg (Opus 5.5) on this draft and `plan-outline-one-app.md`, then a
fresh codex pass on the consolidated plan and this ledger.

## 10. Post-implementation (self-contained — the implementing session executes this from here)

`code_review` is `off`: no `/code-review` pass runs.

**Per arc, at its boundary** (after the arc's gate, before `gh stack add`):
1. Codex audit through `/codex` at `high` (the helper scripts, never `codex exec` directly): the arc's diff
   (`git diff <arc base>...HEAD`), this plan, the decision ledger, the arc map ("this is arc N of 4; later arcs build
   …"), and the asks: *What could go wrong? What would an attacker target? What are we trusting that we shouldn't?
   Where are the supply-chain, crypto and least-privilege weaknesses?* — plus the two rules below, verbatim.
2. Triage: verify each factual claim against the repo first; apply the accepted fixes; commit; log the round (the
   consult and the verdict) in `lessons/phase-N.md`.
3. Resume the same codex session with the fix diff; repeat until a round yields no new material findings. Still
   material after three rounds: stop and surface to the owner.

**After arc 4:** one fresh codex session over the net diff from `main`, asking for cross-arc issues (seams between
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
/goal All phases P1–P8 marked ✓ in implementations-plan/yacana-one-surface/plan.md (the phase headers in the file), each ✓ backed by its phase's validation gate from plan.md §6 reported passing in the transcript; for each phase the agent has printed `LESSONS_FILE=implementations-plan/yacana-one-surface/lessons/phase-N.md`; code_review is off, so /code-review was NOT run; the codex fix loop converged for each of the four arcs at its boundary and for the final cross-arc pass, each evidenced by a resumed codex pass reporting no new material findings, quoted in the transcript; the stack of four PRs exists on GitHub, created only after all loops converged (`gh stack view` output in the transcript); `bun run lint` and `bun test` both report exit 0 in the transcript.
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
7. All phases ✓: the fresh cross-arc codex pass of §10, then Delivery per §7 (the first PRs), `gh pr checks --watch`, and a wrap-up: what shipped, every contested decision with its ELI5 context, open items. Surface and stop.
```
