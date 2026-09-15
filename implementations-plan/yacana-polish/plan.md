---
plan: yacana-polish
tier: deep
driver: claude-code
eli5_mode: artifact
code_review: off
hardening: none this arc
budget: "recon 2 agents (1 reuse sweep, 1 suite mapper); codex at high (GPT-6 Astra); fable legs on Fable 5.1"
status: draft — consolidated from plans/{main,codex,fable}.md (every claim verified at 10f893c); contradiction check and audits pending
created: 2026-09-15
---

# yacana-polish — the redesign implemented with fidelity, the suites driving it, a top-notch app

Design inputs (read first): `brief.md` v4.2.1 (§3 rules, §4 IA and shared components, §5 flows with copy, §6 the
copy deck, §7 the owner's picks, §9 what this plan carries: §9.1 defects 1–15, §9.2 decisions 1–21, §9.3
capabilities 1–10, §10 the review rounds), the canvas "Yacana Polish" (95 artboards, 8 pages; its generator
`canvas/` is the copy's source of truth), `recon.md` Part 0 (the reuse map, the browser suites, conventions, dedup
risks), `reviews/round-3.md`. The three independent drafts are `plans/{main,codex,fable}.md`; §8 says which
decision came from where; §9 holds the contradiction check and the audits.

## 1. Goal

Ship the brief and its canvas with fidelity, desktop only: every screen and state drawn, the copy verbatim from the
generator, the defects of §9.1 fixed, the decisions of §9.2 followed, the capabilities of §9.3 built (§9.3.7 bounded
to an ask), the runbook and the operator script extended (the recorded stop, the node-retired flag), the unified
header on the three apps, and every browser suite adapted so it drives the new screens: the four web-miner shards,
the replay lane, the rig's browser and origin cases, the site e2e, the stats visual gate and e2e, the landing e2e.

**Done means**: every phase's gate green in the transcript (§6); `e2e.yml` dispatched on the stack's top branch
green (the shard matrix proverless but `canary`, the stats and landing suites, the rig); the stats visual baselines
regenerated and pinned; every `data-testid` the specs reference present; every "after" string of the copy deck (§6
of the brief) rendered by the page it names (P11's check); the arcs of §7 stacked as PRs, opened only after the fix
loops of §10. Never merged, never deployed by this plan: `site:deploy` and the `yacana-v5` Worker are the owner's.

## 2. What the design decided (the short form; the brief is authoritative)

One account per browser, page-first arrival with the account dialog on the click (1A), a centred 440 px
transaction dialog for every money flow (2A), one-screen bridge and send forms (3A), text tabs with icons in one
header across the apps (4A), hold-to-sign-out (5B; the click path after a hold released early), the Presto row
replacing the slider while Presto proves (6A), the old origin as one Send-ahead page (7A), the consent checkbox
kept (8A). The cockpit never dims; a claim shows its step and one clock; every claim outcome has a sentence; the
activity row replaces two cards with a state table of seventeen states plus two derived ones; the deadline has
four readings from recorded transitions; the node row keeps reporting and gains `behind`; nothing says "safe".

## 3. Architecture & Implementation

### 3.1 Components and boundaries (grounded in `recon.md` §0)

The redesign changes the presentation layer of three apps and the facts two of them need. It does not change the
miner's reducer topology, the journal's seventeen states, the contracts or the portal. Each package keeps its
concern:

- **`packages/ui`** — presentation only, no wallet, no jotai, no domain decision. Adapt `Dialog` (a `size="tx"`
  variant, 440 px), `Stepper` (§9.1.6 tones; a determinate bar under the active step), `HoldButton`
  (`waitingLabel`, the reveal slot after an early release), `Trail` (✓ on done stages), `ScoreLoop` +
  `score-loop-model.ts` (§9.1.3), `ProofLedger` (claim lines), `StatusPill` (`stopping`). Build `Header` (brand +
  version tag + typed tabs with icons + a right slot; the landing composes `Brand` with its own sections nav),
  `AmountField` (editable; `AmountInput` and `SendSheet`'s inline field collapse into it; the read-only
  `AmountBlock` stays), `ActivityRow` (the bridge vocabulary's row), `ClaimChip`. `Sheet` and `JournalCard` stay
  exported until their last consumer is gone (P9), then are deleted.
- **`packages/bridge`** — pure crossing and deadline policy, chain readers. `portal-reader.ts` gains the
  `afterNextAt` read (missing today; the operator's `status.ts` has it); `deadline-reading.ts` (new) holds
  `readDeadline()` (the four readings, pure, one L1 block; `deadline.ts` stays the rollup's proof reader); `journal.ts` gains `Crossing.expiresAt` and the derived `RowState`
  (`checking`, `unfinished`), never persisted; `proofs.ts` (new) reads the rollup's latest `L2ProofVerified` through
  `logs.ts`'s windowing; `revert.ts` gains the name → sentence table; `record.ts` gains `stoppedProvingAt` and
  `nodeRetired`.
- **`packages/web-miner`** — orchestration and views. `keys/slot.ts` (new) is the single-slot ownership layer over
  the existing record CRUD (the create side already fails closed with `excludeCredentials`; the login side is
  open today: `restoreWithPasskey` makes a record for an unknown master, `session.ts:352-373`); `features/account/*` (new) are the dialog's screens; `LoopTile` / `LedgerTile` /
  `RailTile` carry the chip, the claim lines and the swap; `ClaimStatus.tsx`'s card becomes the two banners;
  `bridge/copy.ts` is rewritten once to §5.4's table as `rowLine()`; `features/ActivityList.tsx` (new) replaces
  `BridgeTile` + `ArrivalCard`; the four sheets and `ClaimSlot` become dialogs on `Dialog size="tx"`;
  `components/NodeTile.tsx` becomes the three-tier row with Save and the inline stepper; `features/OldApp.tsx`
  becomes the Send-ahead page; `SignOutDialog` gains the claim wait and the reveal; `presto.ts` texts follow the
  board; `boot.ts` loses the cockpit-ready probe; `wallet.ts`'s send observer feeds the journal's `expiresAt`.
- **`packages/site`** — `node-health.ts` gains the node's tip, the rollup's L1 tip and the derived `behind`
  (the brief's "a tip under a minute old", §5.7 and §9.2.19, becomes "the node lags the rollup on L1": an idle
  local network builds no blocks, so an age threshold would pause every e2e run; the brief is amended at P6); `config.ts`
  types the two record flags (build-time, like `migration`); `assemble.ts` gives the old role its own page set
  (the miner at `/`, no landing, no stats; §9.1.9).
- **`packages/web-stats`, `packages/web-landing`** — consume `Header` / `Brand`; the stats bridge page shares
  `readDeadline`; nothing else changes but the baselines and the FAQ lines §6 rewrote.
- **`packages/deploy`** — `scripts/bridge.ts` gains `note-stop` and `retire-node`: record writes, no key, no chain
  (like announce); `docs/upgrades.md` gains both steps and the old origin's redeploy that carries them.
- **e2e** — each phase adapts the specs it breaks, inside the phase (recon §0.1's order); test titles and the
  proof inventory stay; the replay recording is re-recorded after the header (P1), the account dialog (P2) and the
  signed-out cockpit (P5).

### 3.2 Key interfaces

```ts
// packages/ui/src/components/header.tsx
export interface HeaderProps {
  version: string;                                   // "V5"
  homeHref: string;
  tabs: { label: string; icon?: IconName; href: string; current?: boolean; external?: boolean; testId?: string }[];
  right?: ReactNode;                                 // testnet badge · status pill · account chip / Log in · gear
  mark: MarkState;
}
export function Brand(p: { version: string; homeHref: string; mark: MarkState }): JSX.Element;   // the landing's bar keeps its sections nav

// packages/ui/src/components/activity-row.tsx (props built by the app; the row decides nothing about money)
export interface ActivityRowProps {
  id: string; amount: string; unit: string; direction: string; counterparty?: string;
  chip: { word: string; tone: Tone }; when: string; sentence: string;
  trail: readonly TrailItem[];
  action?: { label: string; disabledReason?: string; onSelect(): void };
  details?: ReactNode;                               // the Details disclosure (hashes, the recovery file)
}

// packages/bridge/src/deadline-reading.ts — one L1 block: flipAt, afterNextAt, pausedSeconds, deadline(), l1Now
export type DeadlineReading =
  | { kind: 'no-flip' }                              // "for at least 180 days after the upgrade"
  | { kind: 'floor'; until: bigint }                 // "until at least <flip+180 d>; after that day, until the upgrade after V6 lands"
  | { kind: 'any-day' }                              // past the floor, no after-next observed
  | { kind: 'set'; at: bigint; closed: boolean };    // observed: a date (plus paused seconds); closed = l1Now > at (`_requireOpen` is `<=`)
export function readDeadline(s: DeadlineFacts): DeadlineReading;                    // pure; the uint256 max is never a date

// packages/bridge/src/journal.ts (additions)
export interface Crossing { /* … */ expiresAt?: string }                            // unix s, the sent tx's expirationTimestamp
export type RowState = CrossingState | 'checking' | 'unfinished';                   // derived; a later log re-adopts either
export function rowState(c: Crossing, f: { sourceTipAt: bigint | null; historyComplete: boolean }): RowState;

// packages/bridge/src/proofs.ts
export interface ProofReader { latestProvenAt(): Promise<{ at: bigint; checkpoint: bigint; block: bigint } | null> } // null = unknown (an incomplete scan), never "none"

// packages/web-miner/src/bridge/copy.ts (rewritten to §5.4's table)
export interface RowLine { chip: { word: string; tone: Tone }; sentence: string; trail: TrailItem[]; action?: RowAction; deadline?: DeadlineReading }
export function rowLine(c: Crossing, f: RowFacts): RowLine;                          // exhaustive over RowState × kind; unknown facts → an "unknown" sentence and a disabled reason

// packages/web-miner/src/lib/reducer.ts (additions)
export type ClaimOutcome = 'minted' | 'reverted' | 'expired' | 'delivery-blocked' | 'other' | 'discarded';
export interface ClaimProgress { step: 'proving' | 'sent' | 'waiting'; wonAt: number; stepAt: number; expiresAt?: number }
export type LedgerLine = ProofLine & { id: number; claim?: { step?: ClaimProgress['step']; outcome?: ClaimOutcome; note?: string; settled?: 'pending' | 'settled' | 'pruned' } };

// packages/site/src/browser/node-health.ts (additions)
export interface NodeHealth { /* transport as today */ tip: { block: bigint; at: number; observedAt: number } | null; l1Tip: { block: bigint; at: number } | null; deploymentOk: boolean | null; generation: number }
export type NodeStanding = 'healthy' | 'behind' | 'throttled' | 'silent' | 'unknown';
export function standing(h: NodeHealth, now: number): NodeStanding;   // behind = the rollup on L1 knows a block newer than the node's tip by more than BEHIND_BLOCKS (2); healthy = ok transport ∧ deploymentOk ∧ not behind; l1Tip null → never behind (unknown, no pause)

// packages/web-miner/src/keys/slot.ts (over store.ts's CRUD; every mutation one IDB readwrite transaction with a revision check)
export function readSlot(): Promise<{ record: MasterRecord; revision: number } | null>;
export function claimSlot(candidate: MasterRecord, expectedRevision: number): Promise<void>;   // SlotTakenError when another id holds it
export function releaseSlot(id: string, expectedRevision: number): Promise<void>;               // sign out; a legacy second record, if any, becomes the slot

// packages/bridge/src/record.ts (additions, build-time like `migration`)
export interface BridgeRecord { /* … */ stoppedProvingAt?: string; nodeRetired?: boolean }
```

### 3.3 Data and control flow (the critical paths)

- **Arrival → account → opening → cockpit.** `/mine` renders the live cockpit signed out at full contrast; the
  chain reads run. Start mining records the intent and opens the account dialog; Log in opens it without. Create:
  consent → `claimSlot` (refuses when another id holds the slot) → WebAuthn create with `excludeCredentials` from
  the slot → the record staged before the PXE boots (as today) → commit after a verified opening. Log in:
  `allowCredentials` restricted to the slot's credential → PRF → the master; `NoPrfError` → the PRF note (open
  it where it works); a second tab's `ChainViewHeldError` → Retry, never a takeover. Words: the wordlist and the
  checksum validated in-page. Opening: the checklist from `opening-steps.ts` with weights from durations measured
  in P3, the bar on the active step, real CRS bytes, elapsed time where the PXE exposes no progress, Cancel tears
  down what it owns and clears the intent. Ready → the cockpit; the Start intent is consumed exactly once.
- **A claim, win to ledger line.** The worker's win → reducer `winner` (a win whose epoch changed is discarded:
  the ring stays, the ledger line reads "not claimed: the epoch closed before the claim went out") → `claiming`
  with `wonAt` → the chip `claiming · proving · Ns` and the row `claiming: proving…` → `sent` (`expiresAt` from
  the send observer; "drops in m:ss if no block takes it") → `waiting` → `minted` (✓, block, amount; `settled`
  once `claimSettled` says so, §9.3.3). `claimFailed` classifies: `reverted` → the line + the recovering banner +
  rebuild + resume; `delivery-blocked` after a rebuild → the paused-until-finality banner (the wake-up is an
  estimate, the sentence says "about"); `expired` → the line, resume; `other` → the line "claim failed: <first
  line> · mining paused" with **Retry** (re-sends the retained ticket while `retryEligible`), mining stays paused
  (§9.1.14). Stop during a claim → the pill `stopping · claim finishing`, Stop disabled, `stopAfterClaim`.
- **A crossing, send to row.** The dialog runs the stepper: `ensureChain` visible, prove (mining pauses), send. The
  journal persists the crossing first; the send observer (`wallet.ts` `observeSends`) hands the hash and
  `expirationTimestamp` to the journal in the same tick, awaited before the send's promise resolves; a storage
  failure refuses the send. Refresh reads facts (node, portal, wallet) → `advance` → `rowState` (`checking` while
  the tag has no log and the source tip ≤ `expiresAt` or the history is incomplete; `unfinished` once the tip is
  past it with no log; a log found later re-adopts either) → `rowLine` → `ActivityRow`. Deposits persist the
  calldata deadline and reconcile on receipts and events by L1 time; the two-hour device-clock give-up goes. The
  deadline chip reads `readDeadline` at every refresh.
- **The node switch.** Change → field → Save → `probeNode` (reachable, this deployment) → `switchNodeLive`
  (mining pauses; the stepper's third step) → the row again with `custom`. On a rebuild failure the session
  rebuilds from the former node (the same operation with the old URL) before saying "Kept …"; if that fails too the
  boot error's reload path shows, never "Kept" over a dead account. Responses from an earlier generation are
  dropped. The poll carries the node's tip and the bridge's L1 refresh carries the rollup's latest block (the
  `Rollup` on L1 knows every block the node should have); `standing()` yields `behind` when the node lags it by
  more than two blocks, the controller pauses with a new reason, released when the node catches up; polling
  continues while paused. The tip's age alone is never the signal: an idle local network builds no blocks, and
  testnet's cadence is not the node's fault.

### 3.4 File-level change map (cross-checked against `recon.md` §0)

| package | added | modified | deleted |
|---|---|---|---|
| ui | `header.tsx` (+ `Brand`), `amount-field.tsx`, `activity-row.tsx`, `claim-chip.tsx`, `icons.tsx`, their specs | `dialog.tsx`, `stepper.tsx`, `trail.tsx`, `hold-button.tsx`, `status-pill.tsx`, `score-loop.tsx`, `score-loop-model.ts`, `proof-line.tsx`, `index.ts`, `bridge-types.ts` | `journal-card.tsx`, `sheet.tsx` (P9, once unused) |
| bridge | `proofs.ts` (+ test on a recorded event), `deadline.test.ts` cases | `portal-reader.ts` (`afterNextAt`), `deadline.ts`, `journal.ts` (+ tests), `revert.ts`, `record.ts`, `recovery.ts` (the file carries `expiresAt`) | — |
| miner-core | — | `claim-failure.ts` (the copy table to §5.3) | — |
| web-miner | `keys/slot.ts`, `features/account/{Start,Create,Welcome,LogIn,Words,WordsLogIn,Notes,Opening}.tsx`, `features/ActivityList.tsx`, `features/dialogs/{ToEthereum,FromEthereum,Send,SendAhead,Claim}.tsx`, `bridge/eth-balance.ts`, specs | `App.tsx`, `keys/store.ts`, `keys/passkey.ts`, `session.ts`, `boot.ts`, `wallet.ts`, `opening-steps.ts`, `controller.ts`, `lib/reducer.ts`, `lib/status.ts`, `features/{LoopTile,LedgerTile,RailTile,ClaimStatus,PrestoBanner,SignOutDialog,MigrationCard,OldApp,SignInDialog}.tsx`, `bridge/{copy,facts,flows,forms,session}.ts`, `components/NodeTile.tsx`, `routes/{Mine,Wallet,Settings}.tsx`, `presto.ts`, `settings.ts`, `state.ts` | `features/{BridgeTile,ArrivalCard,ToEthereumSheet,DepositSheet,SendSheet,SendAheadSheet,ClaimSlot,AmountInput,KeyScreen,WordsScreens,TakingLongDialog}.tsx` |
| site | — | `src/browser/node-health.ts` (+ test), `src/config.ts` | — |
| web-stats, web-landing | — | `App.tsx` / `sections/Bar.tsx`, stats' bridge page (deadline), `e2e/__screenshots__/*` (regenerated), landing `copy.ts` (FAQ lines of §6) | — |
| deploy | `src/bridge/flags.ts` (+ test) | `scripts/bridge.ts` | — |
| docs | — | `docs/upgrades.md` | — |
| e2e | `e2e/replay/recording.json` (re-recorded twice) | the specs of recon §0.1, `helpers.ts`; `proof-inventory.ts` untouched (titles stay) | — |

### 3.5 Non-obvious mechanics

- **The proof-verified timestamp.** The Rollup emits `L2ProofVerified(uint256 indexed checkpointNumber, address
  indexed proverId)` (`@aztec/l1-artifacts` `RollupAbi.js:4113`). `proofs.ts` scans for the *latest* event with
  `logs.ts`'s bounded windows from the record's `deployBlock`, keeps a cursor (block, hash) and re-scans an overlap
  on refresh (reorgs), and returns the event's block timestamp; an incomplete scan (an RPC that refuses the window)
  is `null` = unknown, and the chip says "checking", never "no proof". "V5 proved an epoch 12 min ago" is that
  timestamp; "no proof for 3 h" the same aged; "stopped" only from `stoppedProvingAt`.
- **`expiresAt` and "didn't finish".** The page already observes every `sendTx` and records the tx's
  `expirationTimestamp` (`wallet.ts:47-66`); the bridge flow awaits the journal write of hash + expiry inside that
  observer. `unfinished` needs: the same deployment, the source node's history complete over the send's window,
  its tip past `expiresAt`, no log for the tag. Anything short of that is `checking`, no retry; an imported
  recovery file's expiry alone never authorizes a retry (the file's node may be behind).
- **The four readings** are pure over `flipAt`, `afterNextAt`, `pausedSeconds`, the floor and `l1Now`, read in
  one block; the page and the stats share the function; a shown date is re-read at every refresh (an unpause
  refunds unused seconds); `closed` is `l1Now > deadline` (the contract admits equality).
- **`takingLong`** starts at `max(heldAt, the block timestamp of V6's `VersionRegistered` event)` and runs only
  while the canonical target is registered; `launchAt` is `registerVersion`'s parameter (the miner's launch time,
  `YacanaPortal.sol:111,220`), not the registration's time, so the event is read through `logs.ts` once and cached
  in the bridge session's facts; the predicate stays pure in `copy.ts`, the dialog gone.
- **The `behind` pause** is a new `PauseReason` beside `offline` in the controller's set. `behind` is anchored on
  L1, not on the tip's age: the rollup contract's latest block (already read by the bridge's refresh) minus the
  node's tip > 2 blocks. A successful RPC does not clear it, a caught-up tip does; without an L1 read the standing
  is `unknown` and nothing pauses. The row's line 3 still shows `block · age` (the age is information, not the
  verdict). `STALE_AFTER_MS` (60 s, `App.tsx:68`) keeps its job for the banner's read age.
- **The swap on the sticky Presto state**: `RailTile` reads `presto.selected === 'presto' && !presto.fallbackReason`;
  the pill alone reads `active`. A thread change while native proves is stored and applied at the next browser
  build (`reconfigure` only when the browser prover is the one running).
- **Start never waits for Presto**: `startMining` launches the browser prover and probes beside it; the probe's
  result applies only to the run that started it (a generation counter), the row swaps when it says yes.
- **The hold that waits**: `SignOutDialog` passes `waiting` while `phase === 'claiming'` ("Claim finishing · Ns");
  sign out drains the claim and queued money operations before `forget` + reload. `HoldButton` reveals the click
  path after an early release, and on a click-only activation (voice control, switch access) reveals it without
  signing out.
- **The single slot**: the create side already refuses a second credential (`excludeCredentials` over every
  record); the login side is closed by refusing a master whose fingerprint is not the slot's (the note "This
  passkey belongs to a different account" is not a case the brief draws: `allowCredentials` restricted to the
  slot's credential makes the browser show only that one, and a master that still differs is a refusal, never a
  new record). Legacy: two records (§9.1.1) → the newest-created record is the slot (last-opened is unknowable:
  records carry no open timestamp); the other stays in IndexedDB unlisted; `releaseSlot` promotes it. The slot is
  per browser profile and origin (the apex and the old origin each have one). Nothing is deleted by the migration.
- **The record flags** are build-time, like `migration`: `note-stop` / `retire-node` write the deployment record,
  and the old origin's Worker is redeployed to carry them (the runbook's step, the owner's action). The old origin
  reads `nodeRetired` before any node access and shows the "node gone" page without an opening.

### 3.6 Trade-offs and alternatives not taken

- A runtime-fetched status file for the flags (no redeploy): rejected for this arc; the record is already the
  served truth and announce is already a redeploy; revisit if the runbook shows the redeploy is the slow step.
- Persisting `RowState` in the journal: rejected; `checking`/`unfinished` derive from facts the journal restores,
  and a persisted state would let a file restore disagree with a live sync.
- Reading the proof timestamp from the page's observation of the checkpoint: rejected by §9.3.1.
- Keeping "Use another account" on the lost-race banner: rejected (§9.2.12); the banner waits.
- Resuming mining after an unknown claim failure: rejected; a restart rotates the secret and drops the retained
  ticket, which Retry needs (`retryEligible`); the canary's same-ticket proof depends on it.
- A router-level rewrite: rejected; hash routes and jotai suffice, the dialog is state, and the replay lane's
  geometry assert depends on the in-page dialog.
- One `Header` vs three per-app headers with shared pieces: one component with a `right` slot; the landing keeps
  its sections nav under the shared `Brand`. The cost is the stats baselines once.

## 4. Security & Adversarial Considerations

- **Threat model.** Whoever serves the page controls it (About says so); this plan adds no trust. Surfaces it
  touches: the account slot (a second account over an existing one would orphan a balance → fail-closed create
  and login, `excludeCredentials` from the slot, a transactional revision check, no silent overwrite, the former
  record retained until the replacement has opened); pasted words (validated in-page, never sent, never logged,
  the clipboard never read on its own); addresses (checksum-validated, shown in full, the unknown-recipient probe
  on blur reads the node only); amounts (`AmountField` parses to bigint, refuses over-balance and dust as the
  forms do today); node URLs (`connection.ts` rules; `node-guard.ts` admits only the node in use and one candidate
  under check; the deployment check before a switch; late responses from an earlier generation dropped); the
  record's flags (served with the build: the same trust as the record, no new surface; `config.ts` refuses a
  non-boolean); the ETH balance and gas estimate (reads against the user's RPC, keyed by chain, payer and calldata,
  invalidated on account or chain change; unknown is not zero); the L1 event read (validated by contract address
  and signature; unknown on an incomplete scan); the bridge sentences and disabled reasons (from one validated
  snapshot of contract reads, revalidated at submission, never from `MigrationRecord.expectedFlipAt`; ABI reverts
  decoded and the facts refreshed after a race); the old origin (retirement suppresses login before node access;
  the cross-origin passkey warnings stay: the sibling origin is a trust boundary).
- **Least privilege.** No workflow changes beyond paths filters if any; `contents: read` stays; no new secrets; the
  operator's two new commands write the record file only. Nothing deploys.
- **Cryptography.** Unchanged: WebAuthn PRF, AES-GCM under the non-extractable device key, bip39 through the pinned
  `@scure/bip39`; no new crypto code.
- **Supply chain.** No new dependencies planned (icons inline SVG); if one is added it names a version and passes
  the 7-day min-age; the lockfile is frozen in CI; the Aztec pins and the viem alias stay.
- **Frontend.** No `dangerouslySetInnerHTML`; errors rendered as escaped, redacted text (the raw first line only);
  copy is static; the CSP/COOP/COEP headers unchanged (the site e2e asserts them); the Presto billboard stays behind
  the existing allowlist.

## 5. Assumptions

**Facts** (verified at 10f893c): `claim-failure.ts` classes and copy (6–45); `controller.ts` `claimFailed` returns
without resuming on `other` (~665), `pauseUntilFinal` (~795), `reconfigure` compares threads and endpoint only
(~329–336), `execute('mine')` clears the secrets and the retained ticket (477–481), `retryEligible` needs `idle`
(~806); `ClaimStatus.tsx` steps and `ttlDetail` (18–29); `session.ts` sign-out reloads (447, 565) and a failed
rebuild marks the session dead with a reload path (588–596); `wallet.ts` observes `sendTx` and records
`expirationTimestamp` (47–66); `node.ts` `probeNode` measures block age and rejects nothing (51); `node-health.ts`
`Transport` is transport-only (9–12) and `bannerState`'s `stale` is the page's read age (178–194);
`App.tsx` `STALE_AFTER_MS` = 60 s (68); `keys/store.ts` `listRecords` returns all (81–82), records carry no open
timestamp; `session.ts` `restoreWithPasskey` makes a record for an unknown master (352–373) while
`createWithPasskey` already passes `excludeCredentials` over every record (296–324); `state.ts:39`
`signInAtom = atom(true)` opens the dialog on arrival (specs assert it: `sign-in.vitest.tsx:66-76`,
`opening.e2e.ts:18`, `passkey.e2e.ts:35-38`); `deadline.ts` is the rollup's proof reader (`RollupReads`, 7–12),
not the portal's deadline; `launchAt` is `registerVersion`'s parameter (`YacanaPortal.sol:111,220`);
`web-landing/src/copy.ts:150` says "Mining on V5 ends at the upgrade" (a schedule claim); `assemble.ts` `APPS`
(28–32) serves the landing at `/` for every role; `passkey.ts` has `excludeCredentials` (80) and `allowCredentials` (108); `journal.ts` has no expiry
field; `facts.ts` `DEPOSIT_GIVES_UP_MS` two-hour device-clock heuristic (41); `portal-reader.ts` reads `flipAt`,
`pausedSeconds`, `deadline`, `headroom`, `depositsClosed`, `registered` and **not** `afterNextAt` (19–100; the
getter is `YacanaPortal.sol:211`, read by `deploy/src/bridge/status.ts:21`); `_requireOpen` admits equality
(`YacanaPortal.sol:272`); `revert.ts` decodes names (21–30); the ABI carries `DeadlinePassed`, `VersionPaused`,
`WaitsForHeadroom`; the Rollup ABI has `L2ProofVerified(checkpointNumber, proverId)` (`RollupAbi.js:4113`);
three hand-rolled headers (`web-miner/App.tsx:82-139`, `web-stats/App.tsx:98-103`,
`web-landing/sections/Bar.tsx:5-25`; the landing's e2e asserts sections, not the bar); `shards.json` and
`proof-inventory.ts` as in recon §0.1; `visual.ts` takes `--update-snapshots` and runs in
`mcr.microsoft.com/playwright:v1.62.1-noble`; `PrestoBanner.tsx` links presto.build; `config.ts` embeds the
record at build time (322); `docs/upgrades.md` has no stop or node-retired step; `gh stack` v0.1.0 installed;
wagmi `^3.7.7`.

**Inferences** (unverified, labelled): the node poll can carry the tip's timestamp at no extra request (the epoch
read already fetches the latest block); the PXE exposes no sync progress in blocks (searched `syncStatus`,
`blocksSynced`: none; P3 confirms against the installed PXE and otherwise shows elapsed time); the replay
recording re-records in one isolated run; public Sepolia RPCs accept `logs.ts`'s windows for the proof scan
(the bridge page already scans portal events the same way); `hardwareConcurrency` stays the slider's max; the
landing can mount `Brand` without any session code (it imports from `packages/ui` only).

**Asks** (the owner decides at the gate): (1) the click path revealed after a hold released early (the reviewers'
accessibility point vs "no click alternative"; default: reveal); (2) the `behind` threshold: 60 s (the banner's)
or longer (default: 60 s); (3) the legacy second record: the newest-created becomes the slot (default) or the
owner names another rule; (4) the landing's bar: `Brand` + its sections nav + Mine/Stats links (default) or the
full app tabs; (5) §9.3.7: a bounded feasibility answer from the pinned Presto SDK interface (default: one
paragraph in `lessons/`, no PXE integration this arc).

## 6. Phases with validation gates

Fast layers on every phase, after every meaningful edit: `bun run lint && bun test` and
`bun run --cwd packages/<touched> test:components`. `bun run lint:actions` before any workflow change. Every
e2e run goes through `bun run e2e:agent -- …` in tmux (the isolated network, registry ports, owned process
groups); shard runs pass only when every title of the shard executed with its inventory floor and, under
`E2E_PROVERLESS=1`, no proof event fired. The replay lane runs on every phase that touches the miner
(`bun run --cwd packages/web-miner test:replay`; re-record first when the account dialog or the signed-out page
changed: `bun run e2e:agent -- bun packages/web-miner/e2e/replay/setup.ts record`). Long commands, verbatim:

```
SHARD='bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e'
E2E_PROVERLESS=1 E2E_SHARD=cockpit $SHARD · E2E_PROVERLESS=1 E2E_SHARD=chain $SHARD · E2E_SHARD=canary $SHARD · E2E_PROVERLESS=1 E2E_SHARD=bridge $SHARD
bun run rig -- browser origin
bun run e2e:agent -- bun run site:e2e
bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e · bun run --cwd packages/web-stats test:visual [--update-snapshots]
bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e
```

### P1 — The primitives and the header

`Header` + `Brand` + the four tab icons in ui; the three apps consume them (the miner: Mine · Wallet · Stats ↗ ·
Verify ↗, the testnet badge neutral, the pill, the account chip → Settings, the gear; stats: Stats · Bridge ·
Verify · Mine ↗; the landing: `Brand` + its sections nav + Mine/Stats); `Dialog size="tx"`; `Stepper` tones and
bar; `AmountField`; `Trail` ✓; `ClaimChip`; `HoldButton` props; `StatusPill` `stopping`; the logo as `Mark` in all
three (§9.1.8). Specs: a vitest per new primitive; `shell.vitest.tsx`, `stats.e2e.ts` and `landing.e2e.ts` nav asserts;
`signed-out.replay.ts` re-recorded (the header changed); the stats visual baselines regenerated in the container
and reviewed by eye.
**Gate**: fast layers (ui, web-miner, web-stats, web-landing) · replay (re-recorded) · `test:visual
--update-snapshots` then `test:visual` green · pass: exit 0, the four widths' images reviewed · layers: lint,
unit, component, replay, visual.

### P2 — The account

`keys/slot.ts` over the record CRUD (transactional; the legacy rule); `passkey.ts` wired to the slot's
`excludeCredentials` / `allowCredentials`; the dialog's screens and notes (§5.1: Start, Create with consent, Welcome
with one account, LogIn, Words with the quiz, WordsLogIn with the wordlist and checksum errors and the
empty-account hint, the failure notes incl. "Sign-in didn't complete", the PRF note, the held tab's Retry);
sign-out (§5.8): the hold with the wait and the reveal, the backup gate, "Use a different account" through it
(§9.2.8); `forget` drains the claim and the queued operations in the session, not only the dialog. Specs:
`passkey`, `words`, `origin` (its restore-only screen), `sign-in`/`sign-out` vitest, `helpers.ts`
`passKeyScreen`, `dialog-geometry.replay.ts` re-recorded; cases for a concurrent create in two tabs (refused), a
failed opening (the former record kept), the backup refusal, the click-only activation.
**Gate**: fast · `cockpit` proverless · `canary` real · replay (re-recorded) · pass: shard titles and floors ·
layers: + e2e live, replay.

### P3 — Arrival and the opening

Page-first (1A): `signInAtom` defaults to false (the dialog opens on the click, never on arrival), the
undimmed cockpit signed out (§9.2.1), Start mining's intent consumed once, Log in without it;
the opening checklist (§5.2, §9.1.2): weights from durations measured on the isolated network (cold and warm, the
numbers into `opening-steps.ts` with the measurement in `lessons/phase-3.md`), real CRS bytes, block progress only
if the installed PXE exposes it (else elapsed time), Cancel and Retry; the §9.3.7 feasibility paragraph. Specs:
`opening`, `miner` (the first-visit flow), replay screens.
**Gate**: fast · `cockpit` proverless · `canary` real (opening) · replay · layers: + e2e live.

### P4 — The claim

The chip and the ledger line per step with one clock from the win (`ClaimProgress.wonAt`, `stepAt`); the six
outcomes' lines and the two banners (§5.3, board ClaimOutcomes; `claim-failure.ts`'s copy table rewritten);
`other` paused with Retry (§9.1.14); the discard line; `stopping`; the ✓'s `settled` from `claimSettled` (§9.3.3)
and the pruned-claim re-offer; `MintedMarks` kept under Details. Specs: `miner`, `states` (the lost race), `canary`
(the same-ticket proof: Stop during the claim, then `retryPendingClaim`), `cockpit.vitest`.
**Gate**: fast · `cockpit` proverless · `chain` proverless · `canary` real · pass: the canary refuses before
sending and the restored claim mints · layers: + e2e live.

### P5 — Mining's presentation and Presto

The chart (§9.1.3: no `−3 min`, one x mapping, the drop above the bar, the window "since 16:05" → "last 3 min"),
the footer line, the epoch tile's words ("wins", "anyone can close it", "next bar if it closed now"), the balance
tile; Presto probed at Start only and never gating it (§9.2.13), the banners' texts from the board, the swap on
the sticky state (§9.2.18), the slider out of the cockpit while native, `reconfigure` deferred (§9.1.15), the
billboard kept. Specs: `presto`, `miner` (power changes, the pop-out), `signed-out.replay.ts` re-recorded,
`presto-*.vitest`, the landing's shared chart.
**Gate**: fast · `cockpit` proverless · `chain` proverless (presto) · replay (re-recorded) · pass: no probe at
cockpit-ready, no rebuild on a slider change while native, ✦ only on a native proof · layers: + e2e live.

### P6 — Settings and the node

`node-health.ts` with the node's tip, the rollup's L1 tip and `standing()`; `behind` anchored on L1 and its
pause (§9.2.19; an idle isolated network never trips it); the row's three tiers in every
state (§5.7, board NodeStates), Change → Save → the inline stepper, the rollback rebuild on failure, generation
checks; the Ethereum RPC row; the sections (Mining with the slider and its line, the Presto row's readings, Alerts,
Account with Stay open's copy and Sign out, Appearance, About). Specs: `switch`, `states` (behind), `node-tile`
and `settings` tests, `node-health.test.ts` (site).
**Gate**: fast · `chain` proverless · replay · pass: `healthy` needs a fresh tip; a failed switch never reports
success · layers: + e2e live.

### P7 — The bridge's facts

`portal-reader.ts` `afterNextAt`; `readDeadline` (+ tests: each reading, equality, an unpause refund, the max
sentinel); `Crossing.expiresAt` from the send observer, `rowState` (+ tests: reload before the hash, an incomplete
history, a stale node, a late log); the deposit's calldata deadline and L1-time reconciliation (§9.1.16, the
two-hour heuristic gone); `takingLong` from the registration block (§9.1.12); `proofs.ts` (+ a test on a recorded
`L2ProofVerified` log and one live under `e2e:agent` on the isolated network); the revert table (§9.2.15); the
payer's ETH and gas estimate (§9.3.8; unknown ≠ zero); `recovery.ts` carries `expiresAt`. No screen changes.
**Gate**: fast · `bun test packages/bridge packages/web-miner` · `bun run e2e:agent -- bun test packages/bridge`
(the live proof-event case) · layers: unit, integration-live.

### P8 — The Wallet

`ActivityList` + `ActivityRow` on `rowLine` (the §5.4 table, every RowState × kind, deposits included, one row per
crossing, finished rows collapsed after seven days, never discarded); the "ready to claim" count and the row's
action from one selector; the disabled reasons (§9.2.4); the empty states; `BridgeTile`, `ArrivalCard`,
`JournalCard` gone. Specs: `bridge-states` (`crossing-word` → the row's chip), `bridge-features.vitest`, ui
`bridge-primitives.vitest`.
**Gate**: fast · `bridge` shard proverless · replay · pass: each crossing appears once; count, action and reason
agree · layers: + e2e live with the injected wallet.

### P9 — The transaction dialog

The five dialogs on `Dialog size="tx"` (§5.5, §5.6, §5.4 Send, §5.9 Send ahead, the claim on Ethereum with
`ensureChain` visible, the payer, the fixed recipient, the no-ETH state, the revert mapping; the wallet picker
deduplicated); Send one-screen with the blur probe and the four field refusals; the full pasted address; the
recovery file's prompt and re-offer (§9.3.6); `Sheet`, the four sheets, `ClaimSlot`, `AmountInput` deleted.
Specs: `withdraw`, `bridge-states` (wrong network, refused, left open, account changed), `forms.vitest`.
**Gate**: fast · `canary` real (withdraw) · `bridge` shard · replay · pass: cancellation boundaries and disabled
reasons match the send's ownership · layers: + e2e live.

### P10 — The upgrade and the old origin

The upgrade card's three states with the chip from `proofs.ts` and `stoppedProvingAt` (§5.9); Send ahead's
dialog and How it works; the old origin as one Send-ahead page (7A, §9.2.9, §9.2.16): its header, its states
(signed out, silent, quiet, node gone from `nodeRetired` read before any node access, no Change node), Settings
with Account; the old role's page set in `assemble.ts` (the miner at `/`, no landing, no stats; `_redirects`
for `/mine/` → `/`, exact sources only); V6's first login; the stats bridge page on `readDeadline`; `note-stop` and `retire-node` in
`scripts/bridge.ts` with `flags.ts`; `docs/upgrades.md` (the stop, the retirement, the old origin's redeploy that
carries them, the witness archive line); `OldTabNotice` untouched (§9.2.11). Specs: `bridge.e2e.ts` and
`origin.e2e.ts` through the rig (`migration-card[data-moment]`, `ahead-*`, `flipped-alert`, `retired`), the
harness's browser/origin cases, `versioned-origin.vitest`, `packages/deploy` tests.
**Gate**: fast · `bun test packages/deploy packages/harness` · `bun run rig -- browser origin` (tmux) · pass:
both cases green with the new copy · layers: + rig.

### P11 — The sweep

The FAQ and the announcement lines §6 changed (`copy.ts:150` "ends at the upgrade" → "ends when the upgrade
lands");
the copy-deck check (a script greps every "after" string of brief §6 in the built bundles and lists misses); the
four shards + replay + the rig + the site e2e + the stats e2e and visual + the landing e2e in one run each on the
stack's top; `e2e.yml` dispatched on the branch; `implementations-plan/index.md`.
**Gate**: every command of the list above green · `gh run watch` on the dispatch green with executed titles ==
the inventory · layers: everything.

## 7. Delivery — arcs → stacked PRs

Six arcs, one branch each, stacked on `main` with `gh stack` (installed, v0.1.0); `code_review: off` on every arc.
Storage changes are additive (the slot layer, `expiresAt`, the record flags): every arc reverts cleanly at its
stack position without deleting keys, downgrading journals or touching contracts.

| arc | branch | phases | stacks on |
|---|---|---|---|
| 1 primitives + header | `worktree-yacana-polish` (init `--adopt`) | P1 | main |
| 2 the account and the arrival | `polish-account` | P2–P3 | arc 1 |
| 3 mine: the claim, Presto, settings | `polish-mine` | P4–P6 | arc 2 |
| 4 the bridge's facts | `polish-facts` | P7 | arc 3 |
| 5 the wallet and the dialog | `polish-wallet` | P8–P9 | arc 4 |
| 6 the upgrade, the old origin, the sweep | `polish-upgrade` | P10–P11 | arc 5 |

PRs are opened only in the Delivery step (§10), after every arc's fix loop and the final cross-arc pass converged.
Merges (`gh stack merge`) and the two production deploys after them (`bun run site:deploy`, the `yacana-v5` Worker
carrying the record flags) are the owner's explicit call, never a branch action.

## 8. Decision ledger

Sources: the owner (O: the brief's picks and §10), the design reviews (R: `reviews/round-1..3.md`), the drafts:
main (M), codex (C), fable (F); the contradiction check: codex (CC), fable (FC); the audits: codex (CA), fable (FA).

| # | decision | source | rejected alternatives |
|---|---|---|---|
| D1 | One `Header` in ui with a `right` slot; the landing composes `Brand` with its sections nav | M, C | three headers with shared pieces (M's rejected); the full app tabs on the landing (an Ask) |
| D2 | The single slot as a transactional ownership layer over the record CRUD; the login side closed (`restoreWithPasskey` refuses an unknown master); legacy: the newest-created record; per browser profile and origin | C (transactional, legacy rule, per-origin), F (the login side is the open one; create already fails closed), M (API shape) | main's untransacted `claimSlot`; "most recently opened" (unknowable); F's `lastOpenedAt` stamp (nothing to stamp before the first open under the new code) |
| D3 | `other` keeps mining paused with Retry (the retained ticket needs its secret) | code (`execute('mine')`, `retryEligible`), C | main's and v4.2's "resume on the open epoch" |
| D4 | `expiresAt` from `wallet.ts`'s send observer, awaited before the send resolves; `unfinished` needs a complete history and a tip past it; re-adoptable | M (the hook), C (evidence bar, re-adoption) | a persisted `RowState`; the wallet's TTL constant as a fallback |
| D5 | Deposits reconcile on receipts, events and the calldata deadline by L1 time; the two-hour give-up goes (§9.1.16) | C | keep the heuristic |
| D6 | `afterNextAt` added to `portal-reader.ts`; `readDeadline` pure over one block; `closed` = `l1Now > deadline` | C (the missing read, equality), M (the type) | recon's "already read" |
| D7 | `proofs.ts` scans for the latest `L2ProofVerified` with a cursor and an overlap; unknown on an incomplete scan | M (the event), C (latest-not-first, reorg overlap, unknown) | the page's checkpoint observation |
| D8 | `behind` anchored on the rollup's L1 tip (the node lags it by > 2 blocks), not on the tip's age; a new pause reason; unknown without an L1 read | F (the idle local network builds no blocks: an age threshold flaps the suites), M, C, R (the pause) | the tip's age at 60 s (M, C, the brief's wording: amended); an e2e-only override of the threshold (F) |
| D9 | A failed switch rebuilds from the former node before "Kept …"; a double failure shows the reload path | C | the cosmetic "Kept …" over a dead session |
| D10 | The record flags build-time; the old origin's Worker redeployed to carry them | M | C's runtime status artifact (revisit if the redeploy is the slow step) |
| D11 | Start never waits for the probe; the swap follows the sticky state; a thread change under Presto is stored | R, M, C | — |
| D12 | The claim's one clock from the win; six outcomes; the banners without "Use another account" | R, M, C | — |
| D13 | The hold reveals the click path after an early release and on a click-only activation; sign out drains the claim | R (Fable 3), C | the owner's "no click alternative" as an absolute (an Ask) |
| D14 | Six arcs (C's shape, M's phases merged: 11 phases) | M, C | M's five arcs; C's twelve phases |
| D15 | Gates: the fast layers everywhere, the shards a phase touches, the rig at P10 and P11, site/stats/landing at P1 (visual) and P11 | O (Phase 0), M | C's common gate G (every shard and the rig on every phase) |
| D16 | Finished rows collapse after seven days, never discarded | C | — |
| D17 | Copy precedence: the flow boards over the deck where they disagreed; the deck fixed (v4.2.1) | C | — |
| D18 | `readDeadline` in a new `deadline-reading.ts`; `deadline.ts` keeps the rollup's proof reads | F | M's and C's "in deadline.ts" |
| D19 | `takingLong` from the `VersionRegistered` event's block timestamp, read once through `logs.ts` | brief, C | F's `launchAt` (the miner's launch parameter, not the registration's time) |
| D20 | The old role's page set: the miner at `/`, no landing, no stats (§9.1.9) | F | leave `assemble.ts` as is |
| D21 | `signInAtom` defaults to false; the arrival specs rewritten to the click | F | keep auto-open and only drop the dim |
| D22 | The replay lane re-recorded at P1 (the header), P2 (the dialog), P5 (the signed-out cockpit) | F, M | — |
| D23 | `checking` / `unfinished` derived at the session's fact refresh and held in the view, never in the journal | M, C | F's persisted non-final `didnt-finish` state (revivable through `adopt`; rejected because a file restore would then disagree with a live sync until its first refresh) |
| D24 | The proof time is the version's latest `L2ProofVerified` only (the upgrade card's chip); no per-crossing proof time | M, C | F's per-crossing checkpoint time on `proven-pending` (the brief's rows carry none) |
| D25 | The hold during a claim: dimmed "Claim finishing · Ns", arms when done (the brief) | brief | F's "fill completes and waits" |
| D26 | Six linear arcs (`gh stack` is linear) | M, C | F's seven arcs with a DAG |

Still disputed for the contradiction check: D1 (the landing's bar), D8 (the L1 anchor's block count), D13 (the reveal), D23 (derived vs persisted), D15 (gate weight).

## 9. Audit verdicts

Pending: the contradiction check (codex, fable), audit round 1 (codex, fable), the final fresh-context codex pass.

## 10. Post-implementation (self-contained — the implementing session executes this from here)

Loop placement: this is a **multi-arc** plan (§7). Steps 1–3 run **per arc, at each arc boundary** — after the
arc's phases go green and BEFORE `gh stack add` opens the next arc — scoped to that arc's diff while the arc is the
stack tip. After all arcs are green and looped, one **final cross-arc integration pass** runs over the net diff.
Then Delivery.

1. **`/code-review`: not run.** `code_review: off` — the codex fix loop is the review. Do not add it.
2. **Codex audit** (`/codex high`, GPT-6 Astra, `~/.claude/skills/codex/scripts/run-codex.sh <prompt> <cwd> high`):
   send the arc's diff (`git diff <arc-base>...HEAD`), this plan.md, the decision ledger (§8), the arc map ("this
   is arc N of 6; later arcs build X on it"), the adversarial/security ask ("What could go wrong? What would an
   attacker target? What are we trusting that we shouldn't? Where are the supply-chain / crypto / least-privilege
   weaknesses?"), the copy ask ("Is every sentence the brief's, verbatim from the canvas generator? Does any state
   lack its sentence?"), and both rules below verbatim.
3. **Iterative fix loop**: verify codex's factual claims against the repo first (it can misread code); apply the
   accepted fixes; commit; log the round (consult + verdict) in `lessons/phase-N.md`; RESUME the same codex session
   (`resume-codex.sh <session-id> <followup> <codex-dir> high`) with the fix diff and ask for a re-review under the
   same rules. Repeat until a round yields no new material findings (rejected nitpicks are not churn). Still
   material after 3 rounds → stop and surface: a scope smell.
4. **Final cross-arc pass**: a FRESH codex session over the net diff from the plan baseline (`git diff main...HEAD`),
   asking for cross-arc issues (seams between arcs, duplication across arcs, drift from this plan and the brief),
   same loop.
5. **Delivery**: only now. `gh stack sync` (if main moved), `gh stack submit --auto`, then `gh pr edit` each PR with
   a proper body ending in "🤖 Generated with [Claude Code](https://claude.com/claude-code)", then
   `gh pr checks --watch`. `gh stack merge` is the owner's call, and so are the two production deploys after it
   (§7). Then mark `implementations-plan/index.md`.

**The no-over-engineering rule** (verbatim in every post-impl codex prompt, initial and resumed): *"Report bugs and
small, targeted improvements only. Do not propose speculative abstractions, extra configuration surface, new layers,
or rewrites — the smallest change that fixes each real problem. If code works and is clear, leave it alone."*

**The comment-quality rule** (verbatim, same treatment): *"Audit the comments for value per character. Flag any
comment that narrates what the code visibly does, restates its line, references implementation plans / phases /
reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious invariant or constraint
deserves a comment it doesn't have. Comments are permanent context every future reader, human or LLM, pays to
re-read: they must be few, dense, and exact."*

Failure-retry policy: human-driven, stop and reassess after 3 failures on one step; `/loop` autonomous, after 5.
At each phase-gate pass: `agent-worktree status yacana-polish "phase N green: <next>"`. Lessons per phase in
`lessons/phase-N.md`; every consult logged. Commits signed (this machine's key is non-interactive), conventional,
with the attribution trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Seeds (DRAFT — finalized after the approval gate)

Use exactly one seed per session; they do not compose. `/goal` is the recommended one. The implementing session
must run inside this worktree (`agent-worktree resume yacana-polish`).

```
/goal All eleven phases marked ✓ in implementations-plan/yacana-polish/plan.md (the per-phase headers in the file — not the chat, not the task list), each ✓ backed by its phase's validation gate as written in plan.md §6 reported passing in the transcript; for each phase the agent has printed `LESSONS_FILE=implementations-plan/yacana-polish/lessons/phase-N.md`; at each of the six arc boundaries the codex fix loop of plan.md §10 (steps 2–3, `/codex high`, both verbatim rules, resumed until a round yields nothing material, hard stop at 3) has converged with its rounds logged in lessons; the final cross-arc codex pass over `git diff main...HEAD` has converged; then Delivery per §10 step 5: `gh stack submit --auto`, each PR body ending with the attribution line, `gh pr checks --watch` green on every PR in the stack. Never merge, never deploy production (`site:deploy`, the v5 Worker), never expand scope beyond plan.md and the brief. Fast layers after every meaningful edit: `bun run lint` and `bun test` and the touched packages' `test:components`; `bun run lint:actions` before any workflow push; every e2e through `bun run e2e:agent` in tmux.
```

```
/loop 15m Drive implementations-plan/yacana-polish forward. Never idle waiting for my input. Each firing:
1. Reality check: read implementations-plan/yacana-polish/plan.md and lessons/ (authoritative state — not the chat); native task list empty? rebuild it from plan.md §6's phase headers plus one task per arc fix loop, the cross-arc pass and Delivery; run `git status` and `git log --oneline -5`; with a stack open, `gh stack view`.
2. Waiting on CI is fine — confirm it is progressing (`gh run watch <run-id>` up to 10 minutes; stuck past that → inspect logs, log it as blocked in lessons). Use the wait: review the diff, prep the next phase, strengthen tests. Do not start work that conflicts with the in-flight change.
3. No task in hand? Pick the next pending step from plan.md and start it. After each meaningful edit run `bun run lint`, `bun test` and the touched packages' `test:components` (`bun run lint:actions` for workflows). Commit → push (`gh stack push`; `gh stack sync` if trunk or a lower arc moved).
4. Stuck, or facing a decision you would normally bring to me? Do not wait. Call `/codex high` with full context and go back and forth until you reach a defensible decision, then act on it. Log every consult + verdict in lessons/phase-N.md. Hard limits stay hard: never merge, never deploy production, never expand scope beyond plan.md; copy comes from the canvas generator, verbatim.
5. Same step failed 5 times? Stop retrying; reassess with codex, then continue down the agreed path.
6. Phase green? Green means the phase's validation gate as written in plan.md §6 passes. Run the full gate, paste the result, mark ✓ in plan.md, file the lessons entry, print `LESSONS_FILE=implementations-plan/yacana-polish/lessons/phase-N.md`, advance. Arc boundary crossed (P1, P3, P6, P7, P9, P11)? Run plan.md §10 steps 2–3 on that arc's diff before `gh stack add` opens the next arc.
7. All phases ✓? Close out per plan.md §10: the fresh cross-arc codex pass over `git diff main...HEAD`, then Delivery (`gh stack submit --auto`, PR bodies with the attribution line, `gh pr checks --watch`). Merging and the two production deploys are mine.
Keep the native task list current (plan.md stays the source of truth).
```
