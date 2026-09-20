# Recon — the reuse map for the blueprint (2026-09-15, worktree at 10a932f), then what the app says today

Two parts. **Part 0** is the blueprint's Phase 0.4 recon (one reuse sweep, one mapper of the browser suites): what the
redesign reuses, adapts or builds, and what its fidelity breaks first in the tests. **Parts A–C** are the design pass's
recon from 2026-09-15 (verbatim strings as of 0d9d1ea), the brief's source for "what the app says today".

## 0. Reuse map

| Capability the brief needs | Existing code | Verdict |
|---|---|---|
| The transaction / account dialog, 440 px centred (§4.3, §9.2.2) | `packages/ui/src/components/dialog.tsx:22-53` (`max-w-md`, close, `hideClose`) | **adapt**: a `size` variant; every sheet consumer (`ToEthereumSheet`, `DepositSheet`, `SendAheadSheet`, `SendSheet`) rebuilt on it; `Sheet` stays exported until no consumer needs it |
| Stepper with title / detail / right (§4.3, §5.2, §5.7) | `ui/components/stepper.tsx:4-71` (`Step{id,label,state,ms,detail,right}`) | **adapt**: pending title `text-ink-4` → `ink-2` (§9.1.6), detail tone per state, a determinate bar under the active step |
| The opening checklist (§5.2) | `ui/components/preflight.tsx`, `web-miner/src/opening-steps.ts` (`WEIGHTS` line 12: notes 15, indeterminate) | **adapt**: weights from measured durations; blocks-based sync progress needs a PXE read that does not exist (searched `syncStatus`, `blocksSynced` in `web-miner/src`: none) |
| Epoch tile (§5.3) | `ui/components/epoch-rail.tsx`, `web-miner/src/features/RailTile.tsx:46-99` | **adapt**: "wins", "anyone can close it", the Presto row ↔ slider swap on the sticky state |
| Power slider (§5.7) | `ui/components/power-slider.tsx`, used by `RailTile.tsx` and `routes/Settings.tsx:127-132` | **reuse-as-is**: consumers move; the value stored and applied at the next browser build (§9.1.15) |
| The chart and the ledger (§5.3) | `ui/components/score-loop.tsx` + `score-loop-model.ts`, `proof-line.tsx:110` (`ProofLedger`), `LoopTile.tsx:58,239`, `LedgerTile.tsx:27` | **adapt**: the `−3 min` and the shared x mapping (§9.1.3), the win mark's drop, the claim line per step and outcome |
| The claiming chip in the loop tile's header (§5.3) | `LoopTile.tsx:169-172` (header: "live · last 3 min" or the pill word); `ClaimStatus.tsx:16-38` (`STEPS` proving/sent/waiting, `ttlDetail`); `lib/reducer.ts:16` (`Phase` incl. `claiming`, `recovering`) | **build new** UI on existing state: the chip reads the step and one clock from the win (the reducer's `claim.since` restarts per step) |
| Claim outcomes and the two banners (§5.3, board ClaimOutcomes) | `miner-core/src/claim-failure.ts` (`ClaimFailure`, `CLAIM_FAILURE_COPY`); `controller.ts` `claimFailed` (~655), `pauseUntilFinal` (~795), `'discard'` (~503) | **adapt**: the copy table rewritten to §5.3; `other` resumes with Retry (§9.1.14); the discard gets a ledger line |
| Presto's billboard and banners (§5.3) | `features/PrestoBanner.tsx` (`@alejoamiras/presto-banners`, presto.build), `presto.ts:163-216` (`causeText`, `statusText`, `noticeFor`), `boot.ts:159-164` + `session.ts:612-621` (two probe call sites) | **reuse-as-is** billboard; **adapt** the banner texts to the board and drop the cockpit-ready probe (§9.2.13) |
| The single account slot, fail-closed (§5.1, §9.2.12) | `keys/store.ts:81-82` (`listRecords` returns all), `keys/passkey.ts:80,108` (`excludeCredentials`, `allowCredentials` already built) | **build new** slot logic on the existing record CRUD; `WelcomeBack` lists one |
| Sign-in failure notes (§5.1) | `keys/passkey.ts:10` (`NoPrfError`), `wallet.ts:99` (`ChainViewHeldError`, no takeover) | **adapt**: two new notes ("Sign-in didn't complete", the held tab's Retry); no new error class |
| Words login: checksum, empty-account hint (§5.1) | `WordsScreens.tsx` (paste-only textarea) | **adapt**: the wordlist dependency validates the checksum; the hint is copy |
| Hold to sign out (§5.8) | `ui/components/hold-button.tsx` (1,200 ms, completion arms, release confirms, Space/Enter), `SignOutDialog.tsx:96-118` (the click link today) | **adapt**: the click link hidden until a hold released early; the hold waits while `phase === 'claiming'`; `session.ts` sign-out reloads |
| The activity row (§5.4, §9.2.3) | `ui/components/journal-card.tsx:20`, `features/ArrivalCard.tsx`, `features/BridgeTile.tsx` (filters `kind !== 3`: §9.1.4), `bridge/copy.ts` (`cardLine`, `trailOf` line 217, `journalTone`, `whoOf`, `untilOrAgo`, `takingLong` 161-166, `TAKING_LONG_AFTER_MS` 159) | **build new** row that replaces JournalCard + ArrivalCard + both list filters at once; `copy.ts` rewritten to the §5.4 state table and reused by the row; `Trail` adapts (✓ on done stages) |
| The crossing's states and facts (§5.4) | `packages/bridge/src/journal.ts:13-56` (`CrossingState`, all seventeen), `bridge/session.ts` (803 lines; `txByTag` when `!c.txHash`) | **reuse-as-is** machine; **adapt**: `Crossing` gains the persisted enforced expiry (§9.1.10; searched `expiresAt`, `expiry` in `journal.ts`: none) and the re-adoptable "didn't finish" (§9.1.13) |
| The deadline's four readings (§5.9, §9.3.4) | `packages/bridge/src/portal-reader.ts:19-100` (`flipAt`, `pausedSeconds`, `deadline`, `headroom`, `depositsClosed`, `registered`; **no `afterNextAt`**: the portal has the getter, `YacanaPortal.sol:211`, and only the operator's `deploy/src/bridge/status.ts:21` reads it), `deadline.ts` | **adapt**: add the `afterNextAt` read to `portal-reader.ts`, then one pure reading function in `packages/bridge/src/deadline.ts`, consumed by `copy.ts` and the stats |
| `takingLong` from V6's registration (§9.1.12) | `bridge/copy.ts:161-166`, `features/TakingLongDialog.tsx` (same bug twice) | **adapt** once in `copy.ts`; the dialog consumes it, then becomes a row state (§9.3.2) |
| "V5 proved an epoch 12 min ago" (§9.3.1) | none: `packages/bridge/src/logs.ts` windows `eth_getLogs` for portal events; `deadline.ts` `provenCheckpoint()`/`epochOfCheckpoint()` give proven-ness, not a time (searched `ProofVerified`, `getLogs`, `watchEvent` in bridge, web-miner, site) | **build new**: a timestamped read of the rollup's proof-verified event on `rollupReads`, reusing `logs.ts` windowing |
| The payer's ETH and a gas estimate (§9.3.8) | none: `bridge/eth.ts` wires `injected()`, `writeContract`, `waitForTransactionReceipt` (searched `getBalance`, `useBalance`: none) | **build new** on wagmi actions |
| The portal's revert names → sentences (§9.2.15) | `packages/portal/abi/YacanaPortal.ts` (`DeadlinePassed` 1353, `VersionPaused` 1581, `WaitsForHeadroom` 1592), `packages/bridge/src/revert.ts:21-30` (decodes any custom error to its name) | **adapt**: a lookup table over the existing decode |
| The node row: in-place edit, probe on Save, stepper, `behind` (§5.7) | `components/NodeTile.tsx` (Change → field → Check/Use), `site/src/browser/node.ts:51` (`probeNode`: deployment, block age, latency; rejects nothing), `node-guard.ts`, `node-health.ts`, `connection.ts`, `boot.ts:212` `switchNodeLive` (from `session.ts:559,586`) | **adapt**: the same machine with Save + the inline stepper; the chip needs the tip's age (§9.2.19) and a stale-tip pause that does not exist |
| The unified header and navigation (§5.10, 4A; §9.1.8) | `web-miner/src/App.tsx:82-139`, `web-stats/src/App.tsx:98-103`, `web-landing/src/sections/Bar.tsx:7-12` (three hand-rolled headers; the logo a `<span>` in all three); `ui/src/mark.ts` | **build new** shared `Header` in `packages/ui` on `Mark`; the three apps consume it |
| The old origin as one Send-ahead page (§5.9, 7A, §9.2.9) | `site/src/config.ts:11-18` (`YACANA_APP_ROLE`), `assemble.ts:25,124,147,155` (`OLD_OUT`, `_redirects`), `web-miner/src/OldApp.tsx` | **adapt**: the old app's route set and tab; the build and redirect plumbing as is |
| The recorded stop and the node-retired flag (§9.3.9–10) | `docs/upgrades.md` (no such steps), the deployment record (`packages/bridge/src/record.ts`) | **build new**: two record fields written by the operator script (`packages/deploy/src/bridge/`) and served with the record |
| The recovery file's prompt after a send-ahead (§9.3.6) | `packages/bridge/src/recovery.ts`, the recovery save/restore features (driven by `bridge.e2e.ts` `recovery-*`) | **adapt**: the prompt's timing and the re-offer once the witness is known |
| The amount box (§4.3, §9.1.5) | `ui/components/amount-block.tsx:9-42` (read-only), `web-miner/features/AmountInput.tsx` (editable), `SendSheet.tsx` (its own inline field) | **adapt + dedup**: one editable `AmountField` in `packages/ui`; the three collapse into it |
| Presto's fallback row per reason (§9.3.5) | `presto.ts` `FallbackCause`, `presto-prover.ts` (reports `wasm, sticky:false` per transient refusal), `controller.ts` `active` set on every message | **adapt**: the banner from `noticeFor`; the swap keyed on the sticky state (§9.2.18) |
| Presto through the PXE's proofs (§9.3.7) | none in the SDK's interface (probe/status/prove only) | **out of scope**: a bounded ask to the SDK (Assumptions) |

Every `build new` above names the search that found nothing; the audits attack those first.

### 0.1 The browser suites the redesign must keep driving

Full map by the mapper (paths and lines as of 10a932f); the parts the plan sequences on:

- **`packages/web-miner/e2e`**, four shards (`shards.json`): `cockpit` = `miner`, `passkey`; `chain` = `states`,
  `switch`, `presto`; `canary` = `canary`, `withdraw`, `words`, `opening`; `bridge` = `bridge-states`.
  `proof-inventory.ts` is the meter's floor per test title (titles are the identity, unique across files); under
  `E2E_PROVERLESS=1` any proof event fails the test, so a redesign must not leave proving on in a proverless
  shard. `fixtures.ts:32-82` wires the meter into every spec. `bridge.e2e.ts` and `origin.e2e.ts` are rig-only
  (`playwright.rig.config.ts`, `packages/harness/tests/{browser,origin}.bun.test.ts`, `RIG_STAGE` v5 → v5-flipped
  → v6; `yacana.test` / `v5.yacana.test` under a shared cert). The replay lane (`e2e/replay/`, `recording.json`,
  `dialog-geometry.replay.ts` asserting the sign-in dialog fits 480×720 at every screen, `signed-out.replay.ts`)
  runs on every PR (`web-miner.yml` `replay`, ~10 min) without a node; re-record with
  `bun run e2e:agent -- bun packages/web-miner/e2e/replay/setup.ts record` after the dialog changes.
- **CI on a PR**: `web-miner.yml` `test` (lint, typecheck, components, bun test) + `replay`; `harness.yml` the
  `flip` case only; `web-stats.yml` `test` + `visual` (the pinned full-page screenshots at four widths in the
  Playwright container image, the one PR-blocking pixel gate; any header change regenerates the baselines);
  `site.yml`, `web-landing.yml`, `ui.yml` lint/typecheck/unit only. `e2e.yml` is dispatch-only: the shard matrix
  (proverless except `canary`), the stats and landing suites, the rig (`browser`, `origin` included).
- **What a fidelity redesign breaks first**, by the number of specs on it: (1) the sign-in screens and their
  test ids (`key-screen`, `create-passkey`, `restore-*`, `use-words`; `helpers.ts:90-115` `bootPage`/`passKeyScreen`
  is every spec's entry) plus the replay lane's geometry assert; (2) the sign-out dialog (`sign-out-hold`,
  `sign-out-plain`, `sign-out-click`, `back-up-first` in `words.e2e.ts:84-101`); (3) Send and the activity row
  (`withdraw-*`, `crossing-word`, `arrival-*` in `withdraw`, `bridge-states`, `bridge`); (4) the node row
  (`node-in-use/health/url/check/check-result/use/banner`, "the miner and the token are there" in `switch`);
  (5) the upgrade card and the old origin (`migration-card[data-moment]`, `ahead-*`, `flipped-alert`, `retired`,
  `old-tab`, the landing's `announcement`); (6) the Mine vocabulary (`claim-slot[data-state]`, `epoch-claims`,
  `ledger` text in `miner`, `states`, `canary`); (7) Presto (`presto-billboard`, `presto-notice`, `rate-line`,
  `power-caption` in `presto.e2e.ts`; `signed-out.replay.ts` "needs an update"); (8) the stats visual gate.

### 0.2 Conventions

`routes/*.tsx` page-level; `features/*.tsx` route-scoped composites; `components/*.tsx` app-local widgets;
`packages/ui/src/components/*` cross-app primitives exported through `index.ts`. Bridge logic pure in
`packages/bridge/src` (journal, deadline, portal-reader, revert), page-side wiring in `web-miner/src/bridge/*`
(session, flows, forms, copy, facts). State: jotai atoms (`state.ts`, `settings.ts`, `presto.ts`);
`controller.ts` drives `lib/reducer.ts`'s pure `(state, event) → [state, effects]`; `session.ts` composes
controller + boot + the bridge session; the journal's `advance(crossing, facts)` is pure and shared by live sync
and file restore. Tests: `*.vitest.tsx` (jsdom, Testing Library) beside components, `*.test.ts` pure,
`*.e2e.ts` Playwright, `*.bun.test.ts` the rig. `data-testid` is the e2e contract (206 in `web-miner/src`).

### 0.3 Dedup risks

1. Three amount fields (`amount-block.tsx`, `AmountInput.tsx`, `SendSheet.tsx`'s inline one): the new Send must
   collapse them, not add a fourth.
2. Three headers: a new nav only in the miner leaves §9.1.8 in stats and the landing.
3. `BridgeTile` and `ArrivalCard` double bookkeeping: the row replaces both filters at once or the dropped
   deposit hides again.
4. `Sheet` vs `Dialog`: remove `Sheet` only once no consumer needs a side panel.
5. `takingLong` in `copy.ts` and `TakingLongDialog.tsx`: fix once, consume twice.

---

Read-only recon by three Explore agents before the design pass. Verbatim strings; line numbers as of 0d9d1ea.
Section A: sign-in, mine, settings, nav (this file). Section B: wallet and bridge. Section C: Bazaar's sign-in.

## A. Sign-in, opening, mine, settings, navigation

### A1. Sign-in and account

Files: `packages/web-miner/src/features/SignInDialog.tsx`, `KeyScreen.tsx`, `WordsScreens.tsx`, `SignOutDialog.tsx`,
`packages/web-miner/src/opening-steps.ts`, `boot.ts`, `session.ts`, `state.ts`, `keys/store.ts`,
`packages/ui/src/components/hold-button.tsx`, `packages/site/src/browser/host.ts`.

Dialog shell (`SignInDialog.tsx:15-51`): one `Dialog` whose `open` = `opening || (signedOut && wanted)`. While
`opening`, Escape/outside-click are swallowed. `DialogTitle` is screen-reader only: "Opening your account" /
"Sign in to mine".

Screens routed inside the dialog: Opening; CreateKey (no records); WelcomeBack (records exist); CreateKey
restore-only variant (versioned origin); WordsBackup (reveal → written checkbox → quiz); WordsRestore
(paste-only textarea); PreflightTile (outside the dialog, while `boot.phase === 'preflight'`).

**CreateKey** (`KeyScreen.tsx:120-202`): eyebrow "mine", title "Sign in to mine." Body: "Your account lives in a
passkey on this device, synced by your platform. Your balance follows the account, not the browser; nothing is
written down." Consent checkbox: "I understand my passkey is the only way back into this account. There is no
backup of a passkey." Primary: "Sign up with a passkey" (busy "Waiting for your device…"). Warning under it:
"Keep the passkey synced. Lose every copy of the passkey and the account and its balance are lost with it."
Links: "Use twelve words instead", "I already have a passkey", "I have twelve words", "Not now — just watch".
Footer: "This account is not an address to share: whoever knows it can link its first claim to it. Whoever
serves this page controls it: run your own build if that matters." Error: Alert "That did not work" + message.

**CreateKey, restore-only** (versioned origin, `KeyScreen.tsx:68-119`): eyebrow "sign in · same passkey or
words", title "Open the account you already have." Warning: "Accounts are restored here, not created. Create
one at {VITE_RP_ID}; the same passkey or twelve words open it here." Primary "Open with passkey". Live link "I
have twelve words"; disabled dead links "Sign up with a passkey", "Use twelve words instead" kept visible.
Footer: "This is another origin, so the passkey asks once and twelve words are typed again. Whoever serves this
page controls it: run your own build if that matters."

**WelcomeBack** (`KeyScreen.tsx:259-290`): eyebrow "mine", title "Welcome back.", sub "Your balance follows the
account, not the browser." One `KnownKey` tile per stored record: address, "passkey" or "twelve words", and
"stays open on this device" / "one touch to open" / "words to open". Button "Open with passkey" or "Open"
(busy "Opening…"). Links: "Use another passkey", "Enter twelve words instead", "Create a new account",
"Not now — just watch". Footer: HOST_WARNING.

**WordsBackup** (`WordsScreens.tsx:82-135`): "Your twelve words"; "Write them down, in order, somewhere offline.
They are the only way back into this account and its balance." Checkbox "I've written them down." (words hide
after 60 s or on tab hide). Quiz "confirm · type word 3, 7 and 11"; helper "Paste is disabled here: it keeps an
attacker from confirming a phrase you never read. The words above are hidden while you type." Buttons "Done"
(busy "Opening…"), "Skip for now (the account stays "not backed up")".

**WordsRestore** (`WordsScreens.tsx:151-198`): "Enter your twelve words"; banner "You are on {hostname}. Yacana
never asks for your words in chat, email or support. If anyone does, it is not us." Placeholder "ripple canyon
shadow …", helper "No drag-and-drop, no clipboard reads." Buttons "Open account", "Back".

**PreflightTile** (`KeyScreen.tsx:293-304`): "preflight"; "The proving keys (20 MB) download in the background
and are checked against their pinned hashes. Whoever serves this page controls it: run your own build if that
matters."

**Two account kinds coexist**: both are `MasterRecord`s (`keys/store.ts`, `method: 'passkey' | 'words'`) in one
IndexedDB store; `listRecords()` returns all; the dialog picks CreateKey vs WelcomeBack on `records.length`;
WelcomeBack lists every record. Whether create/restore links are enabled comes from `keysAllowed(hostname,
purpose)` (`packages/site/src/browser/host.ts:54-65`): the versioned host or the `old` role forces restore only.

**Opening progress** (`opening-steps.ts`): steps `key → node → crs → notes → ready`, weights
`{key 5, node 5, crs 70, notes 15, ready 5}`. Labels: key "your device" (overridden "passkey"/"twelve
words"), node "the node answers for this deployment", crs "proving keys", notes "notes and balance", ready
"ready to mine". `progressOf()` sums done weights plus `crs` bytes; `openingIndeterminate()` is true while
`notes` is active (the bar shows an indeterminate stripe). `bytesDetail()` "{loaded} of {total} MB". key/node
start pre-marked done. Body (`SignInDialog.tsx:73-76`): "A minute the first time." / "The proving keys are
20 MB, fetched once and kept. After that, opening takes a few seconds." Footer: "Mining resumes when it is
done." (resumeOnOpen) else "You can watch the chain behind this; press Start when it is done." Button "Cancel"
(once the key step is done).

**Hold to sign out** (`SignOutDialog.tsx:96-118`, `hold-button.tsx`): `HoldButton` default 1200 ms; label
"Hold to sign out" (busy "Signing out…"); a `bg-bad/25` fill grows 0→100% while held; sr hint "hold, then
release"; release early / pointer leaves / tab hide cancel. Fallback link "Can't hold? Sign out with a click" →
a danger `Button` "Sign out". Eligibility: passkey or backed-up words; else the row is a single "Back up the
twelve words" button. Note copy: passkey → "Your passkey signs you back in." / "It is saved on this device and
wherever your platform syncs passkeys, so there is nothing to write down."; words → "Make sure your twelve
words are saved." or "Back up the twelve words first." + "They are the only way back into this account; Yacana
keeps no copy." Dialog title "Sign out of this account?"; description shortened address + " · {amount} {SYMBOL}
stays on the chain, with the account." Rendered only from the Wallet route's Account tile (`Wallet.tsx:82-133`,
"Sign out"); Settings has no sign-out.

**"Not now — just watch"**: `setWanted(false)`; the Radix dialog and its overlay unmount. What remains is the
cockpit's "watch" state: `routes/Mine.tsx:62-66` sets `data-signed-out` on the grid and the CSS dims the whole
cockpit to `opacity-[.72] saturate-[.55]` — the "grey overlay everywhere" the owner saw is this dimming, and
the "Sign in to mine" button is inside the dimmed grid. Re-entry: "Sign in" (BalanceCard) or "Sign in to mine"
(LoopTile) → `openSignIn(true)`.

### A2. Mine cockpit

Files: `routes/Mine.tsx`, `features/LoopTile.tsx`, `RailTile.tsx`, `LedgerTile.tsx`, `ClaimSlot.tsx`,
`ClaimStatus.tsx`, `PrestoBanner.tsx`, `components/BalanceCard.tsx`, `presto.ts`, `boot.ts`,
`packages/ui/src/components/{power-slider,epoch-rail,score-loop,kpi,status-pill,proof-line}.tsx`,
`score-loop-model.ts`.

**Balance tile** (`BalanceCard.tsx:74-91`): chip row when ready: "account" + linked short address; "{n} claim(s)
this session" (renders "1 claim this session"). Signed-out: "Your balance and your claims appear once an
account is open." Buttons "Send" (ready) or "Sign in"; "Wallet →". Opening: skeletons.

**Chart** (`score-loop.tsx` + `score-loop-model.ts`; `LoopTile.tsx:239-246` main, `calm`, 230 px; the PiP view
60 s): main span falls back to `calm ? 180_000 : 60_000` → 3 minutes; `drawCalmDots` labels the left edge
"−{min} min" → "−3 min", right "now". Before any epoch: baseline "1", placeholder "reading the epoch…". Known
epoch, signed out: placeholder "sign in to start proving" while zero samples. Bar caption `difficultyLabel` +
"the bar · clear it to win". Header (`LoopTile.tsx:169-172`): "live · last 3 min" whenever mining or not ready;
otherwise the StatusPill word. A win: ringed dot + "★ {score} · a win". **Difficulty step vs marks**:
`barSegments()` and the dots use the same age→x mapping, so a retarget at an epoch close lines up exactly with
the miner's own dot at that instant.

**Epoch rail** (`RailTile.tsx:46-99`, `epoch-rail.tsx`): segmented bar (own claims `bg-uv-2`, others
`bg-uv/55`); rows "claims" ({n} of {N}), "difficulty", "open for", "expected close", "if it closed now"
("difficulty ×{x}"), "escape hatch" ("in {duration}" / "open" → button "Close the epoch").

**Presto probe timing**: cockpit-ready (`boot.ts:159-164`: "ask Presto now (the billboard may show before any
account)") — un-awaited `probePresto` right after `bootAtom` flips to `signedOut`; again at Start mining
(`session.ts:612-621`, forced re-probe, rebuild if eligibility changed); and on the banner's "Retry".

**PowerSlider copy under Presto** (`RailTile.tsx:100-104` and `Settings.tsx:127-132`): "Presto’s speed setting in
its app decides the threads; this slider applies when proving in the browser." Non-native: "{cores} cores, one
stays with the page. A change applies at the next proof; the rate readout follows within a minute. Prover started
with {threads} threads." Layout (`power-slider.tsx`): "power" + "{N} threads" (+ " · {readout}"); range 1..cores−1;
tick labels "eco / balanced / max · {n}"; `opacity-45` + disabled when Presto is active.

**Start control** (`LoopTile.tsx:121-166`): opening → "opening…"; not ready → "Sign in to mine"; mining/claiming →
"Stop" (title while claiming "The claim finishes; mining does not resume after it."); idle → "Start mining".

**KPI subs**: signed-out "next" → "the bar is {bar} · about {n} proofs per win" / "the bar is not read yet";
"best" → "sign in to start". Signed-in: "could be now, could be 3× longer"; "{wins} win(s) · {amount} {SYMBOL}
this session".

### A3. Settings

Files: `routes/Settings.tsx`, `components/NodeTile.tsx`, `features/EthRpcTile.tsx`, `lib/diagnostics.ts`,
`packages/site/src/browser/{connection,node,host}.ts`.

**Node** (`NodeTile.tsx`): header "Node", aside "chain reads and claims go through it". In-use row: host + " · the
default"; health "checking…" / message / "block {N} · {age} s ago", "{ms} ms", "this deployment ✓"; throttled
"429 · rate limited" or "no answer for {N} s" + "last answer {age} s ago". Form: "Another node", placeholder
"https://…", "Check"/"Checking…"; "set by the page URL" when pinned. "Use this node"/"Switching…". Side note:
"An account is opening: finish or cancel the sign-in first." or "Applies at once; your account's view of the
chain is rebuilt from the new node (about a minute) and mining carries on. The page checks any node against
this deployment before it reads a number from it." CheckResult: "rebuilding the chain view from the new node…",
"✓ in use", probe lines. Footer: "The node answers what this page asks; it can delay or hide, never spend: every
claim is proved here and verified on the chain. A public node may rate-limit you: " + "run a node".

**Ethereum RPC** (`EthRpcTile.tsx`): header "Ethereum RPC", aside "Ethereum". Intro: "The bridge reads the portal
through this JSON-RPC and holds back new withdrawals while it is silent. Any https endpoint for the portal's
chain will do." Row: "not asked yet" / "answering · {ms} ms" / "not answering ({status}) · new withdrawals to
Ethereum are held back"; "In use" disabled. "Another RPC", "Check"; success "chain {id} · block {n} · {ms} ms ·
the portal is there ✓" + "Use this RPC".

**About** (`Settings.tsx:63-94`): rows source / build / bb.js / relying party; button "Copy diagnostics
(shortened)" → "Copied"; helper "The last 200 lines, addresses shortened. It names this account's claims and the
node's host." (`lib/diagnostics.ts`: MAX_LINES 200).

**Account tile in Settings** (`Settings.tsx:140-180`): passkey account → toggle "Stay open on this device" with
hint "off (default): one touch per open, no spend secret at rest · on: the account is sealed under a device key in
this browser's storage (plaintext-equivalent against a stolen unencrypted disk)" and warning "A passkey account
has no backup: if the passkey is lost and was not synced, so is the balance. Move funds off an account that holds
more than a session's worth."; signed out → "Open an account to see its options." + "Sign in".

**Performance**: prover row "✦ Presto · native" or "bb.js WASM · {threads} threads"; PowerSlider; "Pause on
battery" (hint "not reported by this browser"), "Keep proving in a background tab" (hint "off: mining pauses
while the tab is hidden"). **Behaviour**: "Resume mining when the page opens", "Notify on a win" ("no amounts in
the notification"), "Sound on a win", "Report in the tab title and icon", "Mini window" ("Document
Picture-in-Picture"). **Appearance**: Dark / Light / System.

### A4. "Whoever serves this page controls it"

Three literals, all in web-miner: `KeyScreen.tsx:29` HOST_WARNING "Whoever serves this page controls it: run your
own build if that matters." (rendered 4×: CreateKey footer, restore-only footer, WelcomeBack footer,
PreflightTile); `App.tsx:199-200` footer under every route: "Whoever serves this page controls it: a compromised
host could redirect claims or spend this wallet. Run your own build if that matters. Chain reads come from the
node in Settings and can only waste work if the node lies — claims are verified on-chain."; `OldApp.tsx:92-93`
"…Accounts are restored here, not created. Whoever serves this page controls it; run your own build if that
matters." Six places a user sees it. "fees sponsored": `App.tsx:126` badge "testnet · fees sponsored";
`ArrivalCard.tsx:175` eyebrow "from {sources} · this account · fees sponsored".

### A5. Navigation and chrome

**web-miner** (`App.tsx:70-151`): Mark + "Yacana" as a plain span (no link) + version badge; nav "Mine",
"Wallet", "Stats ↗" (new tab, `/stats/`), "Settings"; right: badge "testnet · fees sponsored", StatusPill
(+ "✦ presto"). Routes `#`-based (`routes.ts`). **web-stats**: "Yacana" plain span; nav "Stats", "Bridge",
"Verify", "Miner ↗" (`/mine/`); badge "testnet"; right: "block {n} · {age} ago"; footer "© Yacana · read from
public storage · no trackers", "node {host}", "source {commit}". **web-landing** (`sections/Bar.tsx`): logo is
`<a href="#hero">`; nav Money, Chain, How, Verify + "Stats" + button "Mine on testnet"; badge "testnet". Cross-app:
landing → mine, stats; mine → stats only; stats → mine only; no link back to the landing from the apps.
**NodeBanner** (shared): "The node is rate-limiting this page (HTTP 429). The chain numbers are {age}; a claim sent
now would fail." / "The node has not answered for {age}. These are the last numbers read." / "The node answers,
but no chain read has landed for {age}. These are the last numbers read." + "retrying in {N} s".

**OldApp** (`OldApp.tsx`, the Mine tab on the versioned origin; the tab bar is unchanged): headline "{name}'s
last day has passed. Nothing can leave." (quiet) or "Send what is still here ahead."; states signed-out /
still-here / sent / quiet; AccountChip; "advanced ·" row: "another node", "Ethereum RPC" (→ Settings),
"recovery file", "forward it myself" (→ Wallet). Mining inert; PrestoBanner suppressed. **OldTabNotice**
(every build): "This tab is behind." + "Yacana has been redeployed at this address; reload to open it before you
send or claim anything." (+ " What is still on V{n} can be sent ahead from the old app."); "Reload" + old
origin link. **assemble.ts**: '/' → landing, '/mine/' → miner, '/stats/' → stats; deep links rewritten to each
app's index.

### A6. packages/ui

Components: alert, amount-block, badge, button, chip-link, chip, dialog, epoch-rail, external-link, hero-card,
hold-button, input, journal-card, kpi, label, marks, mark, node-banner, node-way-out, note, power-slider,
preflight, progress, proof-line, radio-cards, score-loop, segmented, sheet, skeleton, stacked-bar, status-pill,
stepper, switch, tile-boundary, tile, timeline, toaster, trail. Tokens (`theme.css`): ground #0a0a0b, raised
#111114, panel #17171b, panel-2 #1e1e24, ink #f2efe9 (+ ink-2/3/4 at 64/50/22 %), line 10 %, line-2 18 %, uv
#8c6bff, uv-2 #b39dff, uv-dim, ok #58c98b, warn #e8b54d, bad #e5624f; light theme swaps to warm paper. Fonts
Hanken Grotesk Variable / JetBrains Mono Variable. Radii 4/6/10/14. Type scale 11 → 56 px.

## C. Bazaar's sign-in (the owner's reference; `~/Projects/bazaar-monorepo`, `packages/buyer-web`)

**Entry**: not a dialog — a full-page route `/onboard` (guarded `requireSignedOut`). Title "Create or restore your
account." Subtitle "Start a new account, or restore the one you already have." CTAs: primary "Create account" →
`/onboard/create`, secondary "Restore account" → `/onboard/restore`. Card 520 px, 48 px padding, 1 px rule,
no shadow; no mobile sheet variant. From an item page: "Sign in to buy" + "Takes less than a minute — we'll
bring you right back."; TopNav "Sign in".

**Create** (`/onboard/create`, passkey-first, both branches inline, no dialog): `PasskeyCreateCard`: h2 "Create
your account." Body "A passkey signs you in with Face ID, Touch ID, or your device PIN. There's nothing to write
down." Note (flame border): "Your passkey is the only key to this account. Keep it synced to your device and you
can sign in again anywhere. If it isn't synced and you lose your device, the account can't be recovered."
Checkbox gating the button: "I understand my passkey is the only way back into this account." Button
(fingerprint icon) "Continue with passkey", busy "Setting up your account…". Quiet link "Use a 12-word phrase
instead". Phrase branch: "Generating your phrase…" then `RecoveryPhrase`: h2 "Write down your 12-word recovery
phrase." Body "These twelve words are generated on this device and never sent to Bazaar. They are the only way
to recover your account. Write them down before continuing." Note "Anyone with these 12 words controls your
account. Write them down on a piece of paper you save safely, your password manager, or another encrypted
backup service." Eyebrow "Recovery phrase" + ghost "Copy phrase". 12 numbered cells, blurred once acknowledged.
Checkbox "I've written them down." Challenge "Confirm: type word 3, 7, and 11" (three inputs; paste blocked:
"Type the word. Paste is disabled."). Errors "Word 3 doesn't match your phrase. Check your written copy."
Primary "Finish account setup". **Deploy step** (both branches): h2 "Creating your Aztec account." Body
"Bazaar is creating your Aztec account. Don't close this tab until it has finished." `SlowTaskProgress`: thin
fill bar + "Usually takes 2-3 minutes" / "{m:ss} elapsed"; a 4-stage checklist (active stage suffixed "..."):
"Generating account keys", "Proving the deployment transaction", "Submitting to the Aztec network", "Waiting for
Aztec confirmation". No account naming (a derived `user_…` id, never shown; the address chip is the label).

**Restore** (`/onboard/restore`): `PasskeyRestoreCard`: h2 "Restore your account." Body "Sign back in with the
passkey you created, or use your 12-word recovery phrase." Button "Continue with passkey", busy "Signing in…".
Quiet link "Enter a 12-word phrase". Phrase branch: h2 "Restore your account from the 12-word phrase." Body
"Paste or type the phrase you saved when you first created your account." Caption "Bazaar will never ask for
your phrase in chat, email, or support. If anyone does, it's not us." `PhishingBanner` (trusted host: "This is
the official Bazaar site." + "Pasting your phrase still has risks; only do it if you've typed the URL
yourself."; mismatch: "Stop. This may not be the official Bazaar site ({hostname})…"). Label "Your 12-word
recovery phrase", placeholder "thunder agile lobster …", counter "Words detected: {n}/12"; drag-drop blocked.
Errors "That phrase doesn't match a known account. Check each word against your written record." Button
"Restore account" → "Restoring…". Discoverable-credential login when nothing is stored. On success: straight
to the page (no interstitial).

**Loading after sign-in**: pulsing-dot pill "Preparing wallet…"; "Retrieving your history…"; "Updating your
balance — usually a minute or two."; a silent warm-up prefetch so returning users rarely see the gate.

**Sign out**: ghost "Sign out" → Dialog (480 px) title "Sign out?", description "Hold the button for 3 seconds
to sign out." Recovery note: passkey "Your passkey signs you back in." / "It's saved on this device and any
synced devices, so there's no recovery phrase to keep."; phrase "Make sure your recovery phrase is saved." /
"Your 12-word phrase is the only way back into this account, and Bazaar doesn't keep a copy." Hold button 3 s,
flame border/text, a left-anchored fill span at 20 % opacity, "Hold to sign out" ↔ "Signing out...".

**Visual system**: serif display (Newsreader), serif body (Source Serif 4), Inter UI, JetBrains Mono; radii 0/2/4/8;
no shadows; nothing animates over 220 ms; icons sparse ("if you can use a word, use a word"); dialogs 520 px,
40 px padding, overlay rgba(19,16,14,.62). No Figma, no Storybook, no golden screenshots.

**Single account**: one localStorage slot; `requireSignedIn`/`requireSignedOut` guards; create/login fail closed on
a different account: "That passkey is for a different account than the one on this device. Sign out first to
switch accounts."; `excludeCredentials` prevents a duplicate passkey. Label: the short address chip only.

## B. Wallet and the bridge flows

### B1. Wallet page (`routes/Wallet.tsx`)

Order: balance tile → account tile → claims history (span 2) → the bridge block (`BridgeTile`, `ArrivalCard`,
`ToEthereumSheet`, `DepositSheet`, two `HeldSheet`s for redeem/forward) → `SendSheet` → `SignOutDialog`.
`MigrationCard` and `SendAheadSheet` live on the Mine route (and inside `OldApp`), not on Wallet.

Balance tile: header "balance" aside "private"; Kpi `{amount} tYACA` size lg, sub "{n} claim(s) · nothing about
this balance is public". Buttons: "Send" (primary), "Bridge to Ethereum" (disabled when no balance / RPC
failing / not registered), "Bridge from Ethereum" (ghost). Account tile: bordered row with the address (link),
"passkey" or "twelve words", "not backed up" badge + "Back up now" or "backed up" (ok), "· stays open on this
device"; "Sign out" button in the row; below: "Signing out returns to the sign-in screen. Your passkey signs you
back in; the balance stays with the account." / "The twelve words open it again; the balance stays with the
account." Claims history: "claims from this device" aside "{n} · newest first"; rows time · epoch · block;
empty "nothing yet".

### B2. Bridge to Ethereum (`ToEthereumSheet.tsx`)

Step 1: eyebrow "bridge to ethereum · step 1 of 2"; `AmountInput` unit tYACA, max; "To · an Ethereum address"
input "0x…"; Stepper (all pending): "burned here, privately" · "20 s"; "proven to Ethereum" · "usually within
the hour"; "claimed on Ethereum by you" · "one transaction"; button "Review". Step 2: eyebrow "… step 2 of 2";
`AmountBlock` aside "→ {n} YACA"; rows "to" `Ξ 0x…`, "fees" "none here · gas on Ethereum when you claim",
"claimable" "usually within the hour · undone if the epoch is never proven"; Note warn "Public on Ethereum."
"{addr} receives {n} YACA; anyone can see that."; buttons "Bridge to Ethereum" (busy "Proving and sending…"),
"Back". Sent: eyebrow "bridge to ethereum"; title "On its way."; AmountBlock aside "✓ burned in block {N}" /
"✓ burned · waiting for a block"; Stepper: "burned here, privately" done; "being proven to Ethereum" active,
right "epoch {n}", detail "Usually within the hour; safe from then on."; "claim on Ethereum · {addr}" pending,
right "from the wallet page"; row "balance now" "{n} · private"; button "Done" + "Progress stays in Wallet;
claim it there once it is proven."

`AmountInput`: `<label data-slot="amount">` with a 36 px mono input, a `<small>` unit beside it, and on the
right the aside + `MaxChip` (`amount-block.tsx:46-60`, "max" uppercased by CSS) — the unit sits at the input's
baseline while the chip is vertically centred: the misalignment the owner saw. **Prover**: the burn is proved
by the page's PXE (`wallet.ts:72-75`, bb.js WASM); Presto is wired only into the mining work prover
(`presto-prover.ts`), never into `flows.ts`/`session.ts`.

### B3. The crossing cards (`BridgeTile.tsx` + `bridge/copy.ts` LINES)

Kinds: 1 withdrawal, 2 send-ahead, 3 deposit. Words/sentences by state: proving "Proving in your browser,
about 20 s." (k3 "wallet": "Waiting for your Ethereum wallet. If its prompt is gone, deposit again."); sent
"Sent. Waiting for a block."; dropped (k3) "Your wallet never sent it, or Ethereum never included it before
its deadline. Nothing left your wallet: deposit again." / (k≠3) "The node never included it. Nothing left this
account: send again."; proven-pending "proving to Ethereum": "{provenBy}; then you claim it there." / "; then
it is held there for {target}." where provenBy = "Its proof is due on Ethereum by {HH:MM}, or the burn is
undone" or "Usually proven to Ethereum within the hour"; witnessed "proven": "Proven to Ethereum; reading the
portal for the claim." / "Proven to Ethereum; held there for {target}."; never-proven "undone": "{v} never
proved it in time: the burn was undone and the balance is back on {v}."; paused: "The bridge is paused; it
moves again when the pause lifts, 30 days at most a call[; the redeem waits with it]."; headroom "over the
limit" (flipped): "Beyond the version's frozen exit limit: it cannot leave." / "waiting for the limit": "More
has left this version than its exit limit allows for now; it goes through once the limit grows."; closed:
"{v}'s last day passed before this was claimed. Gone."; ready (k1) "ready to claim": "Proven. Claim it on
Ethereum with a wallet: one transaction, you pay the gas."; minted-l1 "claimed"/"redeemed": "Claimed: YACA on
Ethereum." / "Redeemed: YACA on Ethereum."; held (k2) "held on Ethereum": "Held on Ethereum for {target}, out
of the old version's reach. Yacana forwards it once {target} opens; you can too, or redeem it on Ethereum, any
time before the last day."; not-registered "waiting for Yacana": "The next version is live; Yacana has not
opened its contract there yet. Redeem on Ethereum any time before the last day."; forwarded "arrived": "On
Aztec {target}. Claim it there with this passkey."; deposited "crossing": "Deposited on Ethereum; crossing to
Aztec, a few minutes."; claimable "ready to claim": "On Aztec. Claim it here: one tap, about 20 s.";
minted-l2 "claimed": "Claimed here, privately." `target` = `versionNameOf(c.target, canonical)`, and
`c.target` is unset until forwarded → "the next version" even when the canonical version is known.
`takingLong` = kind 2, held, > 6 h. "forwarded to the next version" + right "by hand, or by you" is a Stepper
row in `OldApp.tsx` `Sent`.

Trails: deposits `DEPOSIT_TRAIL` (your wallet → deposited → crossing → claim → minted); exits "burned → block N →
proven to Ethereum → {claim on Ethereum | held | waiting for the next version | … }".

**Where deposits render**: `BridgeTile` filters `c.kind !== 3 && state !== 'claimable' && state !== 'minted-l2'`
— deposits never appear there; they render only in `ArrivalCard` (`shownHere`: destination is this version and
state in {forwarded, deposited, claimable} or k3 proving or minted-l2). Kind 1 lives only in BridgeTile; kind 2
starts there and moves to ArrivalCard at claimable/minted-l2 (both cards can show it at forwarded/deposited).
A `dropped` deposit renders in neither list. `ArrivalCard`'s per-row `from(c)` lacks the canonical argument
(can read "from another version" while the eyebrow says "from Aztec V5").

### B4. Bridge from Ethereum (`DepositSheet.tsx`)

Connect: wagmi `injected()` + `multiInjectedProviderDiscovery` (no WalletConnect); "Reconnecting your Ethereum
wallet…"; connected row: gradient dot, short address, "×" (Disconnect), "{n} YACA there"; not connected: one
uv button per connector "Connect {name}" (hence "Connect injected" and "Connect Rabby" side by side); helper
"MetaMask, Rabby, any injected wallet." / "No Ethereum wallet is installed in this browser." Form: `PreFlip`
note "Aztec V{n} is expected around {day}." + "A deposit lands on {v} and would need sending ahead again before
{v} stops. Deposit after the upgrade instead, unless you mean to use it here now."; "Deposits into this version
are closed." + "An upgrade is a day away or less; deposit on the next version once it is live."; `AmountInput`
unit YACA (the L1 ticker), max = the wallet's YACA; Stepper pending: "deposit" · "your wallet · gas" · "One
Ethereum transaction: the portal burns the YACA there and sends it across."; "crossing to Aztec" · "minutes";
"arrives in this account, privately" · "on a tap" · "The arrival card offers a Claim: a private transaction
this page makes, about 20 s, fee sponsored."; Note "Public on Ethereum" "Your wallet and the amount. The account
that receives it is not."; button "Deposit" (busy "Waiting for your wallet · deposit…"). **No approve step**:
the portal burns the sender's YACA itself. Done: AmountBlock "→ {n} tYACA · private"; Stepper "deposited on
{chain}" done (tx link), "crossing to Aztec" active "minutes", "arrives in this account, privately" pending
"Keep this tab open, or come back: the arrival card offers the Claim."

`ArrivalCard`: title "{sum} landed." / "{sum} on its way."; eyebrow "from {sources} · this account · fees
sponsored"; side "nothing to press" / "each lands with a tap" over a `Progress` bar = landed ÷ arrivals; body
"Every send landed in this account, privately." / "These are yours on this version: each claims privately on a
tap, about 20 s, the fee sponsored."; per row: amount + word, sub "from Ethereum", right a small uv "Claim"
(busy "Claiming…") or "Deposit again" or "✓ block N"; the chips trail below. `StatusPill` is used only in the
header and LoopTile; the trail chips are `Trail` with `chips`.

### B5. Send ahead (`SendAheadSheet.tsx`, `MigrationCard.tsx`, `OldApp.tsx`, `TakingLongDialog.tsx`)

`nextVersion()` = `migrationRecord()?.toIndex ?? 'the next version'`; every "V{n}" label reads "Vthe next
version" when there is no migration record (the flipped-but-unannounced case). Head: eyebrow "send ahead to
aztec v{n}"; title "Leaves {v} once its epoch is proven. Lands on V{n} with a tap." / "Sent ahead." Form:
`AmountInput` tYACA, max = whole, aside "all · {whole}" beside the prefilled whole (the balance twice), helper
"the whole balance by default", button "Review". Review: AmountBlock aside button "some of it →" (**never
disabled**, clickable while busy); Stepper pending: "leaves this account, privately" · "about 20 s" · "Mining
pauses while your browser proves it."; "proven to Ethereum with its epoch" · "a few epochs" · "{v} must prove
the epoch by its deadline. If it does not, the send is undone and the balance is back here."; "held on Ethereum
until V{n} opens" · {day} · "Out of reach meanwhile, held for this account alone. The amount is visible there,
nothing else."; "lands on V{n}: a tap on the arrival card" · "A private claim this page makes when you tap, fee
sponsored, about 20 s. Same passkey."; Note warn "The amount is public on Ethereum." "The account is not: the
send is held under a one-time secret of this account. Round amounts blend in."; Note "If V{n} never opens" "A
send Yacana could not forward can be redeemed on Ethereum as YACA any time before the last day, by this
account. The passkey or words are the only thing to keep."; buttons "Send {n} ahead" (busy "Proving and
sending…"), "Not now"; footer "Anything still on {v} when it stops proving is lost. {v} stops hours or days
after the upgrade, without notice." Sent: AmountBlock ok "✓ burned in block N"; Stepper "burned here,
privately" done; "being proven to Ethereum" active, right "by {HH:MM}", detail "Epoch {e}. Usually within a
few epochs; safe from then on. If {v} misses the deadline the send is undone and the balance is back here.";
"held on Ethereum until V{n} opens"; "lands on V{n} with a tap" · "Same passkey. The arrival card there claims
it when you tap."; buttons "Done", "save a recovery file ⤓"; footer "You can close this; the card on Mine
follows it. Mining resumed."

`MigrationCard` Announced: eyebrow "aztec v{n} · expected in about {d}"; title "{v} ends soon. Send your
balance ahead." / "{sum} sent ahead."; trail "leaves {v} · now → proven to Ethereum · safe → waits for V{n} →
lands with a tap on V{n}"; body "{when}, Aztec starts V{n} and {v} stops. Sent ahead, your balance waits on
Ethereum, out of {v}'s reach, once {v} proves the epoch; it lands on V{n} with a tap on the arrival card, same
passkey. The amount is public on Ethereum; the account is not. {loss}"; side "Mining continues here until the
upgrade. Wins after this need sending ahead too."; link "what happens, step by step →". Flipped (shown when
`view.verdict.kind === 'flipped'`): title "Mining has ended on {v}. Send what is left ahead now."; body "{v}'s
contract refuses mining claims since the retire message landed. {n} still on {v}. Sending it ahead now is a bet
that {v} proves one more epoch; leaving it is a sure loss. Yacana's next app takes this address once V{n}'s
contract is deployed; each send shows its own proof deadline. {loss}"; `loss` = "Anything still on {v} when it
goes quiet is lost. {v} goes quiet after the upgrade, without notice."

`OldApp`: eyebrow "aztec v5 · retired"; title "Send what is still here ahead." (quiet: "{v}'s last day has
passed. Nothing can leave."); body "Mining has ended on this version. Yacana lives at {apexHost} now; this is
the old app, kept open so your balance can leave: send ahead to the next version, or to Ethereum, from the
wallet. Sending it ahead now is a bet that {v} proves one more epoch; leaving it is a sure loss. Anything still
on {v} when it goes quiet is lost — it goes quiet after the upgrade, without notice."; SignedOut: "sign in ·
same passkey or words", "Open with passkey or words", note "This is another origin, so the passkey asks once
and twelve words are typed again. Accounts are restored here, not created. Whoever serves this page controls
it; run your own build if that matters."; StillHere: "still on {v}" aside "private · can leave while this
version proves", Kpi, "Send {n} ahead", "or to Ethereum", "Sent ahead, it lands in this same account at
{apexHost} with a tap, the next time you sign in there."; Sent: "left this account" done; "proven to Ethereum"
/ "not yet proven by {v}" right "by {HH:MM}" detail "Lands if the version proves the epoch by then, lost if it
stops first."; "forwarded to the next version" right "by hand, or by you"; "lands at {apexHost} with a tap"
"Same passkey."; footer "You can close this page and watch it at {apexHost}; the wallet here follows it too.";
Quiet: aside "lost", sub "cannot leave"; "proven in time · safe" rows. Advanced row: "another node", "Ethereum
RPC", "recovery file", "forward it myself".

`TakingLongDialog`: "taking long"; "Held for {waited}. Forward it yourself, or wait."; "Your {n} tYACA are held on
Ethereum, proven and waiting for the next version. Yacana forwards by hand; past 6 h it is worth a look. Nothing
is lost while it waits, until the last day; before then you can redeem it on Ethereum while the bridge is not
paused: this account alone decides."; box "With an Ethereum wallet" "Forward it from the next version's page, or
redeem it from the bridge tile: one transaction, the wallet pays the gas. Only this passkey or an authorized
relayer may forward it."; "Open the bridge tile"; "That wallet is public as the sender…"; Note "A silent
Ethereum RPC makes every crossing look stuck." + "Check the RPC in Settings"; "Waiting is fine too." + "Wait".

### B6. Stepper tones (`packages/ui/src/components/stepper.tsx`)

`TEXT = {pending: 'text-ink-4', active: 'text-ink', done: 'text-ink-2', failed: 'text-bad', warn: 'text-warn'}`;
the label inherits it, the detail is hardcoded `text-ink-2`. A pending step's title (22 % ink) is dimmer than its
description (64 %): the "disabled titles, readable paragraphs" effect. `Trail` chips: todo ink-3/line, on
ink/uv, done ok, bad, warn.

### B7. Header

`App.tsx` Shell: Mark + "Yacana" (span) + version badge; nav Mine / Wallet / Stats ↗ (new tab) / Settings;
`<Badge variant="warn">testnet · fees sponsored</Badge>`; `StatusPill` (+ "✦ presto").
