# Main draft — yacana-polish (2026-09-15, worktree at 10a932f)

## 1. Goal and done

Ship the brief (v4.2) and its canvas with fidelity: every screen and state drawn, the copy verbatim from the
generator, the thirteen defects of §9.1 plus 14–15 fixed, the twenty-one decisions of §9.2 followed, the
capabilities of §9.3 built (§9.3.7 bounded to an ask), the runbook and the operator script extended (the recorded
stop, the node-retired flag), the unified header on the three apps, and every browser suite adapted so it drives the
new screens: the four web-miner shards, the replay lane, the rig's browser and origin cases, the site e2e, the stats
visual gate and e2e, the landing e2e.

Done means: every phase's gate green in the transcript; `e2e.yml` dispatched on the stack's top branch green (the
shard matrix proverless but `canary`, the stats and landing suites, the rig); the stats visual baselines
regenerated and pinned; no `data-testid` the specs reference missing; the copy deck (§6 "after") is what the page
renders; the arcs of §6 stacked as PRs, opened only after the fix loops. Never merged, never deployed by the plan.

## 2. Architecture & Implementation

### 2.1 Shape

The redesign changes the presentation layer of three apps and the facts two of them need; it does not change the
miner's reducer topology, the journal's state machine, the contracts or the portal. New code lands where the
brief's components live in the recon map:

- **`packages/ui`** (the design system): `Header` (new; `Mark` + version tag + text tabs with icons + the right
  cluster: testnet badge, status pill, account chip, gear), `Dialog` `size="tx"` (440 px), `Stepper` fixes and a
  determinate bar, `AmountField` (new, editable; collapses `AmountInput` and `SendSheet`'s inline field; the
  read-only `AmountBlock` stays), `Trail` with ✓ on done stages, `ActivityRow` (new; the bridge vocabulary's row:
  amount + direction line, chip + time, sentence, trail, action, Details), `ClaimChip` (new, a `StatusPill`
  variant reading a step and a clock), `HoldButton` gains `armedLabel`/`waitingLabel` and the reveal-after-cancel
  slot. `Sheet` and `JournalCard` stay exported until the last consumer is gone (P5), then are deleted.
- **`packages/bridge`**: `deadline.ts` gains `readDeadline()` (the four readings, pure); `journal.ts` gains
  `Crossing.expiresAt` and the `checking` / `didn't finish` derivation; `proofs.ts` (new): the rollup's last
  proof-verified event's timestamp through the existing `logs.ts` windowing; `revert.ts` gains the name → sentence
  table; `record.ts` gains `stoppedProvingAt` and `nodeRetired`.
- **`packages/web-miner`**: `keys/store.ts` becomes a single slot; `features/SignInDialog.tsx` routes the brief's
  screens (Start, Create, Welcome, LogIn, Words, WordsLogIn, the failure notes, Opening); `LoopTile` /
  `LedgerTile` / `RailTile` carry the chip, the claim lines and the swap; `ClaimStatus.tsx`'s notice card becomes
  the two banners; `bridge/copy.ts` is rewritten to §5.4's table as `rowLine()`; `features/ActivityList.tsx` (new)
  replaces `BridgeTile` + `ArrivalCard`; the four sheets become dialogs (`ToEthereumDialog`, `FromEthereumDialog`,
  `SendDialog`, `SendAheadDialog`, `ClaimDialog`); `components/NodeTile.tsx` becomes the three-tier row with the
  inline stepper; `features/OldApp.tsx` becomes the Send-ahead page; `SignOutDialog` gains the claim wait and the
  reveal; `presto.ts` texts follow the board; `boot.ts` loses the cockpit-ready probe.
- **`packages/web-stats`, `packages/web-landing`**: consume `Header`; nothing else changes but the baselines.
- **`packages/site`**: `config.ts` passes the two record flags; `assemble.ts` unchanged.
- **`packages/deploy`**: `scripts/bridge.ts` gains `note-stop` and `retire-node` (record writes, like announce);
  `docs/upgrades.md` gains both steps and the old origin's redeploy that carries them.
- **e2e**: each phase adapts the specs it breaks (recon §0.1's order); `proof-inventory.ts` titles stay; the
  replay recording is re-recorded twice (after the account dialog, after the signed-out cockpit).

### 2.2 Key interfaces

```ts
// packages/ui/src/components/header.tsx
export interface HeaderProps {
  app: 'mine' | 'stats' | 'landing';
  version: string;                       // "V5"
  tabs: { label: string; icon: IconName; href: string; current?: boolean; external?: boolean }[];
  status?: ReactNode;                    // the miner's pill (StatusPill), stats' freshness, nothing on the landing
  account?: { short: string; onClick: () => void } | null;   // the chip; null = "Log in" (miner only)
  onSettings?: () => void;
  mark: MarkState;
}

// packages/bridge/src/deadline.ts
export type DeadlineReading =
  | { kind: 'no-flip' }                                  // "for at least 180 days after the upgrade"
  | { kind: 'floor'; until: bigint }                     // "until at least <flip+180 d>; after that day, until the upgrade after V6 lands"
  | { kind: 'set'; at: bigint }                          // a date, final but for paused seconds
  | { kind: 'any-day' };                                 // past the floor, no after-next observed
export function readDeadline(s: { flipAt: bigint; afterNextAt: bigint; pausedSeconds: bigint; exitFloorS: bigint }, nowS: bigint): DeadlineReading;

// packages/bridge/src/journal.ts (additions)
export interface Crossing { /* … */ expiresAt?: string /* unix s, the tx's enforced expiry, written before the send */ }
export type RowState = CrossingState | 'checking' | 'unfinished';     // derived, never persisted
export const rowState = (c: Crossing, facts: { nodeSyncedTo: bigint | null }): RowState;

// packages/web-miner/src/bridge/copy.ts (rewritten)
export interface RowLine { chip: { word: string; tone: Tone }; sentence: string; trail: TrailItem[]; action?: RowAction; deadline?: DeadlineReading }
export const rowLine = (c: Crossing, f: RowFacts): RowLine;          // the §5.4 table, one entry per RowState × kind

// packages/web-miner/src/lib/reducer.ts (additions)
export type ClaimOutcome = 'minted' | 'reverted' | 'expired' | 'delivery-blocked' | 'other' | 'discarded';
export interface ClaimProgress { step: 'proving' | 'sent' | 'waiting'; wonAt: number; since: number; ttlAt?: number }
export type LedgerLine = ProofLine & { id: number; claim?: { step?: ClaimProgress['step']; outcome?: ClaimOutcome; note?: string } };

// packages/site/src/browser/node-health.ts (additions)
export type NodeHealthKind = 'healthy' | 'behind' | 'throttled' | 'silent';
export interface NodeHealth { kind: NodeHealthKind; block: bigint | null; blockAgeS: number | null; latencyMs: number | null; since: number }

// packages/web-miner/src/keys/store.ts (the slot)
export const readSlot = (): Promise<MasterRecord | null>;             // the one record this browser opens
export const claimSlot = (r: MasterRecord): Promise<void>;            // throws SlotTakenError when another id holds it
export const releaseSlot = (id: string): Promise<void>;               // sign out: the record is forgotten; a legacy second record, if any, becomes the slot

// packages/bridge/src/record.ts (additions)
export interface BridgeRecord { /* … */ stoppedProvingAt?: string; nodeRetired?: boolean }
```

### 2.3 Data and control flow (the critical paths)

- **Sign-in → opening → cockpit.** `/mine` renders the live cockpit signed out (no dimming; the chain reads run).
  Start mining or Log in opens the account dialog (1A). Create: consent → `claimSlot` refuses if a slot exists →
  WebAuthn create with `excludeCredentials` → the record. Log in: `allowCredentials` restricted to the slot's
  credential → PRF → the master; `NoPrfError` → the PRF note; a second tab's `ChainViewHeldError` → Retry.
  Opening: the checklist from `opening-steps.ts` with weights from measured durations (P2 measures them on the
  isolated network and writes the constants), the bar on the active step, Cancel. Ready → the cockpit; Start
  mining pressed before → mining starts (the session re-asks Presto).
- **A claim, win to ledger line.** The worker's win → reducer `winner` (a discard writes the ledger line "not
  claimed…") → `claiming` with `wonAt` → the chip `claiming · proving · Ns` and the row `claiming: proving…` →
  `sent` (ttlAt) → `waiting` → `minted` (✓, block, amount). `claimFailed` classifies → the ledger line per class;
  `reverted` → `recovering` banner + rebuild + resume; `delivery-blocked` after a rebuild → `paused` banner until
  finality; `expired` → resume; `other` → line with Retry, resume on the open epoch (§9.1.14). Stop during a claim
  → the pill `stopping · claim finishing`, Stop disabled, `stopAfterClaim`.
- **A crossing, send to row.** The dialog (2A) runs the stepper: `ensureChain` visible, prove (mining pauses),
  send; `expiresAt` written to the journal before `sendTx`. The session's refresh reads facts (node, portal, wallet)
  → `advance` → `rowState` (checking while the tag has no log and the node is not synced past `expiresAt`) →
  `rowLine` → `ActivityRow`. The deadline chip reads `readDeadline` on every refresh.
- **The node switch.** Change → field → Save → `probeNode` (reachable, this deployment) → `switchNodeLive`
  (mining pauses; the stepper's third step) → the row again with `custom`. The health poll fills the row's tiers;
  `behind` when `blockAgeS > 60` pauses mining with a new `PauseReason` `'behind'` released when the tip is fresh.

### 2.4 File-level change map

| package | added | modified | deleted |
|---|---|---|---|
| ui | `header.tsx`, `amount-field.tsx`, `activity-row.tsx`, `claim-chip.tsx`, `icons.tsx` (the four tab icons), specs for each | `dialog.tsx` (size), `stepper.tsx` (§9.1.6, the bar), `trail.tsx` (✓), `hold-button.tsx` (waiting, reveal), `status-pill.tsx` (stopping), `index.ts`, `bridge-types.ts` | `journal-card.tsx`, `sheet.tsx` (P5, once unused) |
| bridge | `proofs.ts` (+ test), `deadline.test.ts` cases | `deadline.ts`, `journal.ts` (+ tests), `revert.ts`, `record.ts` | — |
| web-miner | `features/ActivityList.tsx`, `features/ToEthereumDialog.tsx`, `FromEthereumDialog.tsx`, `SendDialog.tsx`, `SendAheadDialog.tsx`, `ClaimDialog.tsx`, `features/AccountDialog/*.tsx` (Start, Create, Welcome, LogIn, Words, WordsLogIn, Notes, Opening), `bridge/eth-balance.ts`, specs | `App.tsx` (Header), `keys/store.ts`, `keys/passkey.ts`, `session.ts`, `boot.ts`, `opening-steps.ts`, `controller.ts`, `lib/reducer.ts`, `lib/status.ts`, `features/{LoopTile,LedgerTile,RailTile,ClaimStatus,PrestoBanner,SignOutDialog,MigrationCard,OldApp,TakingLongDialog→row state}.tsx`, `bridge/{copy,flows,forms,session}.ts`, `components/NodeTile.tsx`, `routes/{Mine,Wallet,Settings}.tsx`, `presto.ts`, `settings.ts` | `features/{BridgeTile,ArrivalCard,ToEthereumSheet,DepositSheet,SendSheet,SendAheadSheet,ClaimSlot,AmountInput,KeyScreen,WordsScreens}.tsx` |
| web-stats, web-landing | — | `App.tsx` / `sections/Bar.tsx` (Header), `e2e/__screenshots__/*` (regenerated) | — |
| site | — | `src/config.ts` (the flags) | — |
| deploy | `src/bridge/flags.ts` (+ test) | `scripts/bridge.ts` (`note-stop`, `retire-node`) | — |
| docs | — | `docs/upgrades.md` | — |
| e2e | `e2e/replay/recording.json` (re-recorded) | every spec in recon §0.1's list; `proof-inventory.ts` only if a title changes (avoid) | — |

### 2.5 Non-obvious mechanics

- **The proof-verified timestamp.** The rollup emits `L2ProofVerified(checkpointNumber, proverId)` when an
  epoch's proof is verified on L1; `proofs.ts` reads the latest with `logs.ts`'s windowed `eth_getLogs` from the
  record's `deployBlock`, caches the last block scanned, and returns the event's block timestamp. The chip says "V5 proved an epoch 12 min ago" from that timestamp alone;
  "no proof for 3 h" is the same number aged; "stopped" comes only from `stoppedProvingAt`.
- **`expiresAt` and "didn't finish".** `wallet.ts` already observes `sendTx` and records the transaction's
  `expirationTimestamp`; the bridge flow reads it from that hook and the journal writes it on the record in the
  same tick as the hash (before the send's promise resolves, so a reload in between keeps it). A `proving` record without a hash after a reload: `txByTag` looks for the
  log; none, and the node's synced tip timestamp ≤ `expiresAt` → `checking`; none, and the tip is past it →
  `unfinished` (Bridge again offered); a log found later moves the record on from either.
- **The four deadline readings** are a pure function of `flipAt`, `afterNextAt`, `pausedSeconds` and the floor;
  the stats' bridge page and the row share it, and re-read on every refresh (an unpause refunds seconds).
- **The stale-tip pause** is a new `PauseReason` beside `offline`; it needs no reducer change (pause reasons are a
  controller set); the threshold is the App banner's `STALE_AFTER_MS` (60 s) reused, not a new constant.
- **The swap on the sticky Presto state**: `RailTile` reads `presto.selected === 'presto' && !presto.fallbackReason`;
  the pill alone reads `active`.
- **The hold that waits**: `SignOutDialog` passes `disabled` while `miner.phase === 'claiming'` with the label
  "Claim finishing · Ns"; `HoldButton` renders the reveal slot after an early release (`onCancel` count > 0).
- **The single slot's legacy**: a browser with two records (defect §9.1.1) keeps the last-opened as the slot; the
  other stays in IndexedDB unlisted; `releaseSlot` promotes it. No data is deleted by the upgrade.

### 2.6 Trade-offs and alternatives not taken

- A router-level rewrite (React Router, real routes for dialogs): rejected; the hash routes and jotai suffice, the
  dialog is state, and the replay lane's geometry assert depends on the in-page dialog.
- One `Header` in `packages/ui` vs three per-app headers with shared pieces: one component; the apps differ only in
  tabs and the right cluster, which are props. The cost is the stats visual baselines once.
- Persisting `RowState` in the journal: rejected; `checking`/`unfinished` are derivations of facts the journal
  already restores, and persisting them would make a file restore disagree with a live sync.
- Reading the proof timestamp from the page's own observation of the checkpoint (cheap): rejected by §9.3.1; it
  proves nothing about Ethereum.
- Keeping `ClaimSlot`'s "Use another account": rejected (§9.2.12); the banner waits instead.

## 3. Security & Adversarial Considerations

- **Threat model.** The page is served by whoever controls the origin (rule stated in About); this plan does not
  change that trust. What it touches: the account slot (a second account created over an existing one would orphan
  a balance → fail-closed create/login, `excludeCredentials` from the slot, no silent overwrite); pasted words (the
  wordlist and checksum validated in-page, never sent anywhere, never logged); addresses (checksum validation, the
  full address shown, the unknown-recipient probe on blur reads the node only); node URLs (`node-guard.ts` admits
  only the node in use and one candidate under check; the probe checks the deployment id before a switch); the
  record's flags (`stoppedProvingAt`, `nodeRetired`) are served with the build, so a compromised deploy could lie —
  the same trust as the record itself, no new surface; the ETH balance read is a read against the user's RPC, no
  signing; the L1 event read is a read; the bridge sentences and disabled reasons come from contract reads through
  the existing `portal-reader.ts`, never from `MigrationRecord.expectedFlipAt`.
- **Least privilege.** No workflow changes beyond paths filters if any; `contents: read` stays; no new secrets; the
  operator script's two new commands write the record file only (no key needed) — they never touch a chain.
- **Cryptography.** Unchanged: WebAuthn PRF, AES-GCM under the device key, bip39 through the existing dependency;
  no new crypto code.
- **Input validation.** Words (length, wordlist, checksum), amounts (`AmountField` parses decimals to bigint, refuses
  over-balance and dust per the existing forms), addresses (viem `isAddress` + checksum for Ethereum, Aztec address
  parse for L2), node URLs (`connection.ts` rules), the record (`config.ts` types the flags, refuses non-boolean).
- **Supply chain.** No new dependencies planned; the icons are inline SVG. If one is added it names a version and
  passes the 7-day min-age; the lockfile is frozen in CI.
- **Frontend.** No `dangerouslySetInnerHTML`; copy is static strings; the CSP/COOP/COEP headers of `site` unchanged
  (the site e2e asserts them); the Presto billboard's web component stays behind the existing allowlist.

## 4. Assumptions

**Facts** (verified): `claim-failure.ts` classes and copy (lines 6–45); `controller.ts` `claimFailed` returns
without resuming on `other` (~665), `pauseUntilFinal` (~795), `reconfigure` compares threads and endpoint only
(~329–336); `ClaimStatus.tsx` steps and `ttlDetail` (18–29); `session.ts` sign-out reloads (447, 565); `node.ts`
`probeNode` measures block age, rejects nothing (51); `App.tsx` `bannerState(health, now, STALE_AFTER_MS)` (77);
`keys/store.ts` `listRecords` returns all (81–82); `passkey.ts` has `excludeCredentials` (80) and `allowCredentials`
(108); `journal.ts` has no expiry field; `portal-reader.ts` reads `flipAt`, `afterNextAt`, `pausedSeconds`,
`deadline`, `headroom`, `depositsClosed`, `registered` (19–100); `revert.ts` decodes names (21–30); the ABI carries
`DeadlinePassed`, `VersionPaused`, `WaitsForHeadroom`; three hand-rolled headers (`web-miner/App.tsx:82-139`,
`web-stats/App.tsx:98-103`, `web-landing/sections/Bar.tsx:7-12`); `shards.json` and `proof-inventory.ts` as in
recon §0.1; `web-stats` `test:visual` runs in `mcr.microsoft.com/playwright:v1.62.1-noble`; `PrestoBanner.tsx`
links presto.build; `docs/upgrades.md` has no stop or node-retired step.

More facts: the Rollup ABI has `L2ProofVerified(uint256 indexed checkpointNumber, address indexed proverId)`
(`node_modules/@aztec/l1-artifacts/dest/RollupAbi.js:4113`); the page already observes every sent transaction's
`expirationTimestamp` (`wallet.ts:47-66` `observeSends` → `sent.expiresAt`), so the journal's `expiresAt` comes
from that hook, no new SDK surface; `node-health.ts` `Transport` is transport-only (`ok` / `throttled` / `silent`,
lines 9-12) and `bannerState`'s `stale` is the page's read age, not the tip's (178-194): `behind` needs a tip
field; `gh stack` v0.1.0 is installed; `visual.ts` takes `--update-snapshots` (line 1).

**Inferences** (unverified): `hardwareConcurrency` stays the slider's max; the replay
recording can be re-recorded on the isolated network in one run; the node poll can carry the tip's timestamp at no
extra request (the epoch read already fetches the latest block).

**Asks**: (1) the reveal-after-cancel click path in the sign-out dialog (the reviewers' accessibility point vs the
owner's "no click alternative"); (2) whether the `behind` pause threshold is 60 s (the banner's) or longer; (3) the
stats app's nav: does Stats keep "Verify" as a tab or as a link (4A draws Stats and Verify as external tabs from the
miner); (4) §9.3.7: ask the Presto SDK maintainers, or drop; (5) the legacy second record: promote on sign-out, or
delete on first open of the slot.

## 5. Phases with validation gates

Fast layers on every phase: `bun run lint && bun test` and `bun run --cwd packages/<touched> test:components`.
`bun run lint:actions` before any workflow change. Every e2e run through `bun run e2e:agent -- …` in tmux.

- **P1 — The primitives and the header.** `Header` in ui with the four tab icons; the three apps consume it (the
  miner's account chip → Settings; the old origin variant); `Dialog size="tx"`; `Stepper` fixes; `AmountField`;
  `Trail` ✓; `ClaimChip`; `HoldButton` props; `StatusPill` `stopping`. Specs: ui vitest for each; `web-stats`
  visual baselines regenerated in the container; `landing.e2e.ts` and `stats.e2e.ts` nav asserts updated.
  Gate: fast layers (ui, web-miner, web-stats, web-landing) · `bun run --cwd packages/web-stats test:visual` passes
  on the new baselines · pass = exit 0 · layers: lint, unit, component, visual.
- **P2 — The account.** The single slot (`store.ts`, `passkey.ts`, `session.ts`); the account dialog's screens and
  notes (§5.1); the opening checklist with measured weights (§5.2); sign-out hold with the wait and the reveal
  (§5.8); "Use a different account" through Sign out. Specs: `passkey`, `words`, `opening`, `sign-out`/`sign-in`
  vitest, `dialog-geometry.replay.ts` re-recorded. Gate: fast · `E2E_PROVERLESS=1 E2E_SHARD=cockpit …` ·
  `E2E_SHARD=canary …` (real proving) · `bun run --cwd packages/web-miner test:replay` · pass = every title of the
  shard executed with its floor · layers: + e2e live, replay.
- **P3 — Mine.** The undimmed cockpit, Start's intent; the chart's fixes (§9.1.3); the ledger's claim lines and the
  chip with one clock; the outcomes and the two banners; `other` resumes (§9.1.14); the discard line; the epoch
  tile's words and the swap on the sticky state; Presto probed at Start only; the banners' texts; the slider out of
  the cockpit when Presto is connected, `reconfigure` deferred under Presto (§9.1.15). Specs: `miner`, `states`,
  `canary`, `presto`, `cockpit.vitest`, `presto-*.vitest`, `signed-out.replay.ts` re-recorded. Gate: fast ·
  `cockpit` and `chain` proverless · `canary` real · replay · layers: + e2e live.
- **P4 — The bridge's facts.** `readDeadline`; `expiresAt` + `rowState`; `takingLong` from V6's registration;
  `proofs.ts`; the revert table; the ETH balance and gas estimate read; `record.ts` flags. All pure with tests in
  `packages/bridge` and `web-miner/src/bridge`. Gate: fast · `bun test packages/bridge packages/web-miner` ·
  `bun run e2e:agent -- bun test packages/bridge` if a live case is added (the proof event on the isolated network)
  · layers: unit, integration-live.
- **P5 — Wallet and the transaction dialog.** `ActivityList` + `ActivityRow` on `rowLine` (the §5.4 table, every
  state, one row per crossing incl. deposits); the five dialogs on `Dialog size="tx"` (To Ethereum, From Ethereum,
  Send one-screen with the blur probe, Send ahead, Claim with `ensureChain`, payer, no-ETH, revert mapping); the
  disabled reasons; `Sheet`, `JournalCard`, `BridgeTile`, `ArrivalCard`, `AmountInput` deleted. Specs: `withdraw`,
  `bridge-states`, `bridge-features.vitest`, `forms.vitest`, ui `bridge-primitives.vitest`. Gate: fast · `canary`
  real (withdraw) · `bridge` shard · replay · layers: + e2e live with the injected wallet.
- **P6 — Settings.** Sections per §5.7; the node row's tiers, Save + stepper, `behind` and its pause, throttled
  copy; the Ethereum RPC row; the slider line; the Presto row's three readings; Stay open copy; About. Specs:
  `switch`, `node-tile.vitest`, `settings.test`. Gate: fast · `chain` proverless · replay · layers: + e2e live.
- **P7 — The upgrade and the old origin.** The upgrade card's three states with the proof chip from `proofs.ts`;
  the send-ahead dialog and How it works; the old origin as one Send-ahead page with its states (signed out, silent,
  quiet from `stoppedProvingAt`, node gone from `nodeRetired`, no Change node); V6 first login; the operator's
  `note-stop` and `retire-node`; `docs/upgrades.md`. Specs: `bridge.e2e.ts`, `origin.e2e.ts`, `versioned-origin.vitest`,
  `packages/deploy` tests. Gate: fast · `bun run rig -- browser origin` (tmux; each boots its network) ·
  `bun test packages/deploy packages/harness` · layers: + rig.
- **P8 — The site, the stats, the landing.** The old origin's routes and `_redirects` if the page set changed;
  `/stats/bridge` on `readDeadline`; the FAQ and the announcement line where §6 changed them; the assembled site.
  Gate: fast · `bun run e2e:agent -- bun run site:e2e` · `bun run e2e:agent -- bun run --cwd packages/web-stats
  test:e2e` · `bun run --cwd packages/web-stats test:visual` · `bun run e2e:agent -- bun run --cwd
  packages/web-landing test:e2e` · layers: + site, stats, landing e2e, visual.
- **P9 — The sweep.** All four shards (proverless but canary) + replay + rig browser/origin + site + stats + landing
  in one run each on the stack's top; `e2e.yml` dispatched on the branch, green, its report's executed titles ==
  the inventory; the copy deck checked against the rendered pages (a script that greps §6 "after" strings in the
  built bundles); `implementations-plan/index.md`. Gate: every command above · `gh run watch` green.

## 6. Delivery

Five arcs, one branch each, stacked on `main` with `gh stack`; `code_review: off` on every arc.

| arc | branch | phases | stacks on |
|---|---|---|---|
| 1 primitives + header | `worktree-yacana-polish` (init `--adopt`) | P1 | main |
| 2 account + mine | `polish-account-mine` | P2–P3 | arc 1 |
| 3 bridge facts + wallet + dialogs | `polish-wallet` | P4–P5 | arc 2 |
| 4 settings + upgrade + old origin + operator | `polish-upgrade` | P6–P7 | arc 3 |
| 5 site, stats, landing + the sweep | `polish-sweep` | P8–P9 | arc 4 |

## 7. Adversarial notes

- **Where the brief and the code disagree.** §5.3's chip clock "from the win" needs the reducer's `claim.since` to
  stop resetting per step (`reducer.ts` `ClaimProgress`); the brief says it, the code does the opposite. §5.7's
  `behind` pause does not exist (`controller.ts` pauses only on `offline`); the plan adds a reason. §9.1.10's
  `expiresAt` is the observed `expirationTimestamp` of `wallet.ts`'s `sendTx` hook, written in the same tick as
  the hash; a crash between proving and the hook leaves `proving` without either, which `checking` covers.
- **Riskiest §9.3 capabilities.** (1) the L1 proof-verified read: event name/ABI, RPC log windows on public
  Sepolia RPCs (rate limits; `logs.ts` already windows), bounded by caching the last scanned block and reading once
  per refresh; (2) the payer's ETH and gas estimate: `estimateGas` can revert for the same reasons the call would
  (headroom, paused) — the dialog maps the revert first, estimates second; (3) the served flags: a stale old-origin
  build shows the wrong state until redeployed — the runbook says so.
- **If the budget halved.** Keep P1–P3, P5 and the account/mine/wallet e2e; defer P7's old-origin page to the copy
  changes only (keep today's page shape), P8 to the header + baselines, and P4's `proofs.ts` to the stats-only read.
