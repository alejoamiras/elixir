## 1. Goal and done

Implement the approved desktop experience across web-miner, web-stats, web-landing and the retired origin: canvas-faithful screens, verbatim approved copy, complete transaction states, and all brief §9 defects and capabilities. §9.3.7 remains an investigation, without changing PXE proving.

Done means:

- Every flow board maps to an implemented screen and a verification case.
- Account ownership, claim outcomes, crossing recovery, deadline readings and node health remain correct across reloads, failures and concurrent tabs.
- Every changed screen’s browser drivers, copy assertions, replay recording and applicable visual baselines change alongside it.
- Every phase passes the gates below; final site and stats gates pass.
- Production functions meet cognitive complexity ≤15 and ≤80 non-blank lines without suppressions.
- Reviewed, independently revertable product arcs are ready as stacked PRs. Nothing is deployed.

This draft is source-verified against `10a932f`. Implementation and validation commands have not been executed.

## 2. Architecture & Implementation

### Boundaries and reuse

Follow recon’s package boundaries:

- **`packages/ui`:** presentation primitives, without wallet clients, jotai or domain decisions. Adapt Dialog, Stepper, HoldButton, Trail, chart and ledger. Build Header, editable AmountField and ActivityRow. Reuse Mark, PowerSlider and existing accessible controls.
- **`packages/bridge`:** pure crossing/deadline policy and reusable chain readers. Retain the seventeen-state journal and recovery reducer; add evidence fields and readers rather than a second transaction machine.
- **web-miner:** account/session orchestration, controllers, jotai state, domain-to-view adapters and flow dialogs. Rewrite `bridge/copy.ts` once for every activity consumer.
- **`packages/site`:** shared node health, validated deployment metadata and assembly.
- **deploy/operator tooling:** write public lifecycle metadata; publishing remains an owner action.

Preserve existing passkey cryptography, account-class verification, operation queues, transaction tagging, witness archives, pinned signer checks, Presto billboard and native-proof verification.

Use current flow boards for copy where the aggregate CopyDeck is stale. Keep a board → component → test checklist in the plan artifacts; correct conflicting specification text explicitly.

### Key interfaces

**Activity presentation**

```ts
type ActivityRowProps = {
  id: string;
  amount: string;
  unit: string;
  direction: string;
  counterparty?: string;
  chip: { text: string; tone: ActivityTone };
  sentence: string;
  trail: readonly TrailStep[];
  actions: readonly ActivityAction[];
  details: ReactNode;
  compact: boolean;
};
type ActivityAction = {
  id: string;
  label: string;
  disabledReason?: string;
  onSelect(): void;
};
```

The application builds these props from crossing facts, account role and current operation. UI never decides whether money can move.

Implement an exhaustive copy table covering all seventeen raw states, specialized by crossing kind, plus presentation states:

| Reading | Required presentation |
|---|---|
| Unresolved send after reload | `checking`, no retry |
| Proven absence after enforced expiry | `didn't finish`, retry |
| Included source transaction | `reaching Ethereum`, actual proof deadline |
| Held send | `held for …`, registration-based delay |
| Destination transaction | `arriving` / `ready to claim` / `claiming` |
| Included destination claim | `claimed`, settlement qualification |
| Proven claim pruning | `ready to claim`, re-offer |
| Contract restrictions | paused, limit, last-day and cliff sentences |
| Failed required read | unknown sentence and disabled reason |

Copy strings come from `boards_states.py`, `boards_bridge.py` and `boards_upgrade.py`; dynamic values replace examples. Completed/consumed outcomes outrank stale restrictions. Unknown prerequisite reads prevent new actions. The actionable count and row buttons use the same selector. Finished rows collapse after seven days; they are not discarded.

**Deadline reading**

```ts
type DeadlineReading =
  | { kind: "before-flip" }
  | { kind: "floor"; at: bigint }
  | { kind: "cliff" }
  | { kind: "fixed"; at: bigint; closed: boolean };
```

Wrap this in an explicit loading/error result. Read `flipAt`, `afterNextAt`, credited paused seconds, policy floor, deadline and L1 timestamp at one block. Never convert the maximum integer sentinel into a date.

The four readings distinguish an unobserved flip, a minimum exit window, an unfixed cliff and an observed final deadline. Refresh credited pauses after unpause. Contract equality is allowed: `closed` means L1 time **greater than** deadline. Simulate before submitting because `_sync` can observe another transition during the transaction.

**Claim model**

Use one stable win ID with immutable `startedAt`, separate `stepStartedAt`, transaction expiry and visible `stopping`. Progress is proving → sent → in-block/syncing.

Outcomes are minted, reverted, expired, delivery-blocked, other and discarded. Reverted carries a verified cause or unknown; it must not automatically mean “epoch closed first.” Minted additionally carries transaction/block/checkpoint identity and settlement: pending, settled, pruned or unknown.

Update one ledger line throughout. Preserve the discarded win’s ring. Unknown failures resume mining unless Stop/sign-out is pending; retain a valid failed-claim retry handle independently of the next mining job.

**Header**

`HeaderProps` contains `homeHref`, version, typed navigation items, active destination, optional network/status/account controls and Settings action. Apps provide URLs and callbacks. Stats/Verify open externally from Mine; old-origin account opens Settings. Landing mounts no wallet or PXE merely to render navigation.

**Node health**

Extend the shared health model with deployment identity, tip block/timestamp, last successful response, transport failure and connection generation. Derive `healthy | behind | throttled | silent | unknown`.

Healthy requires the expected deployment and a tip younger than 60 seconds. Successful RPC responses do not clear `behind`. Polling continues while mining is paused.

**Single-slot ownership**

Add an ownership layer over existing records:

```ts
getSlot()
reserve(expectedRevision, intent)
stage(reservation, candidate)
commitOpened(reservation, account)
cancel(reservation)
forget(expectedRevision, accountId)
```

Use IndexedDB transactional revision checks; broadcasts only update UI. Reserve ownership and preload credential exclusions before enabling the credential button, preserving WebAuthn as the first awaited operation from its click.

Durably stage newly created credentials before PXE boot, as today; commit account adoption only after verified opening. Cancellation preserves recoverability. Switching requires the backup/sign-out gate and retains the former record until the replacement opens. Legacy extra records survive migration.

### Critical flows and mechanics

**Sign-in → opening → cockpit.** A new visitor sees the undimmed cockpit. Start records mining intent; Log in does not. Stored accounts receive Welcome. Consent gates creation. Login errors distinguish dismissal, unavailable credentials, missing PRF and another tab’s chain-view lock; no takeover.

Words input uses existing mnemonic validation, checksum-specific copy and slot matching. Opening reports real CRS bytes and measured stage timing; use block progress only if the installed PXE exposes it. Otherwise show elapsed time, without fabricated completion percentages. Cancel tears down owned work and clears intent. Retry reuses verified caches. Successful opening consumes Start intent exactly once.

**Win → ledger.** Emit the win before claiming; carry its clock and TTL through controller/reducer/UI. Inclusion updates the same line; exact checkpoint settlement later removes the provisional qualification. Unknown reads never imply pruning. Delivery-blocked recovery follows actual finality; an estimated wake-up is not a promise that finality occurred.

Stop and sign-out first prevent another claim from starting. Sign-out drains the active claim and queued money operations before deleting the record/reloading. Hold completion arms; release confirms. Early release reveals the click path. A click-only assistive activation must also reveal that path without signing out.

**Send → activity.** Persist the crossing, then durably capture the actual transaction hash and enforced expiration before network submission. Adapt `wallet.ts`’s existing pre-send observer to await persistence; storage failure prevents sending.

After reload, recover by tag. “Didn’t finish” requires a matching deployment, complete relevant history and a source tip past enforced expiry with no matching log. Missing expiry/history means checking. Keep this as a re-adoptable observation, not a terminal journal state; later evidence advances the original crossing. Imported expiry alone cannot authorize retry.

For Ethereum deposits, persist the submitted calldata deadline and reconcile receipts/events using L1 time. Remove the two-hour device-clock abandonment heuristic. A vanished wallet prompt is not proof that nothing was sent.

**Ethereum observations.** Add a latest-proof reader using the installed rollup ABI’s verified event signature, filtered to the source rollup. Reuse bounded log windows, but scan for the latest event rather than stopping at the first historical match. Resolve its block timestamp; retain cursor/block hash, overlap refreshes for reorgs and expose incomplete searches as unknown. Never substitute checkpoint-observation time.

Forward delay begins at `max(heldAt, destinationRegistrationBlockTimestamp)` and only while the canonical destination is registered. Registration’s `launchAt` is not its event timestamp.

**Node switch.** Probe URL/deployment, pause mining, drain controller and bridge operations, then rebuild against the candidate. Commit persisted selection only after successful reads. On failure restore the former endpoint and rebuild its chain view; existing reset destroys the old PXE view, so rollback is real work. If rollback also fails, show recovery failure rather than “Kept …” implying a functioning session. Reject late responses from earlier generations.

**Presto.** Remove cockpit-ready probing. Start launches browser proving immediately and probes asynchronously; apply the result only to the still-current run. The cockpit row/slider follows sticky selection without fallback; ✦ follows actual native proving. Preserve every SDK fallback banner and Retry. Store browser thread changes without rebuilding an active native prover, and supply the latest value when browser proving next starts.

### File-level change map

| Package | Added | Modified / removed |
|---|---|---|
| ui | `components/header.tsx`, `amount-field.tsx`, `activity-row.tsx` | Dialog, Stepper, HoldButton, Trail, proof-line, score-loop, `score-loop-model.ts`, exports and adjacent specs |
| miner-core | Only extracted claim helpers if needed | `claim-failure.ts`; preserve distinct verified causes |
| bridge | Proof-event reader and lifecycle-record validator | `journal.ts`, `deadline.ts`, `portal-reader.ts`, `recovery.ts`, `record.ts`; reuse `logs.ts`, `revert.ts` |
| web-miner | `keys/slot.ts`, activity/action adapters, transaction frame, claim/wallet-picker dialogs, claim-settlement adapter | `session.ts`, `boot.ts`, `wallet.ts`, `controller.ts`, reducer/state/settings, key screens, opening, routes, NodeTile, mining tiles, bridge wiring/copy/facts/flows, `features/OldApp.tsx` |
| web-miner cleanup | — | Replace Send/ToEthereum/Deposit/SendAhead sheets; remove ArrivalCard, BridgeTile, TakingLongDialog and ClaimSlot only after all behavior has a replacement |
| site | Runtime deployment-status reader/served artifact | `config.ts`, `assemble.ts`, browser node/health/connection modules and tests |
| deploy | Public lifecycle-record operator command | Record validation, bridge command wiring and tests |
| stats / landing | — | Both headers; stats deadline consumers/screenshots; landing FAQ/rules and shared-chart consumers |
| harness / docs | Phase lessons and coverage checklist | Browser/origin cases, replay fixtures, proof inventory, `docs/upgrades.md`, plan index and affected command documentation |

Retain compatibility exports for Sheet/JournalCard until searches show no consumers. Do not replace read-only AmountBlock usages unnecessarily; consolidate editable amount inputs.

## 3. Security & Adversarial Considerations

**Account slot:** concurrent tabs, mismatched credentials and interrupted migration must fail closed without losing keys. Preserve non-extractable WebCrypto keys, authenticated encryption, account fingerprints, `excludeCredentials` and chain-view ownership. Validate pasted words locally; never transmit, log or automatically read the clipboard.

**Money actions:** derive displayed sentences and disabled reasons from the same validated snapshot. Revalidate at submission. Deposits require canonical registration, open deposits and no pause; source L2 sends/burns do not require an open portal. Forward/redeem obey registration, pause, headroom and deadline. Decode ABI errors and refresh facts after races.

Validate amounts as bounded integers, full recipient addresses, chain IDs and expected deployment identities. Preserve fixed exit recipients independently of gas payers. ETH balance and gas estimates are keyed by chain, payer and calldata; wallet/network changes invalidate them. Unknown balance is not zero. Recheck account/chain after switching and immediately before wallet submission.

**External evidence:** validate event address/signature, block identity, record fields and recovery provenance. A timeout cannot establish absence, finality, stop or retirement. Runtime metadata must match chain/rollup/miner/portal; malformed or unavailable records become unknown. Old-origin retirement suppresses login before node access.

**Frontend and operations:** preserve CSP and cross-origin isolation; render errors as escaped, redacted text. Validate node/RPC URLs using existing protocol and deployment restrictions. Preserve cross-origin passkey warnings: sibling-origin serving code remains a trust boundary. No secrets in artifacts, logs, CI or command lines; operator changes write public metadata only.

No new dependencies proposed. Retain pinned Aztec packages, `@scure/bip39@2.3.0` and the existing viem alias. Bun ≥1.4, seven-day minimum release age, committed lockfile and frozen installs remain mandatory.

## 4. Assumptions

### Facts — high confidence

- Store records lack historical last-open timestamps; CRUD permits multiple records: `packages/web-miner/src/keys/store.ts:12`, `:81`.
- The send observer runs before submission and can inspect actual expiry: `packages/web-miner/src/wallet.ts:48`, `:67`.
- Unresolved transactions currently remain unchanged without evidence: `packages/bridge/src/journal.ts:149`.
- Deposit abandonment currently uses elapsed device time: `packages/web-miner/src/bridge/facts.ts:41`.
- Deadline equality remains open; deposits additionally require canonicality: `packages/portal/src/YacanaPortal.sol:272`, `:414`.
- Node rebuild failure currently leaves the session unusable: `packages/web-miner/src/session.ts:588`.
- Claim failures have four code classes; discarded wins are a separate controller outcome: `packages/miner-core/src/claim-failure.ts:6`, `packages/web-miner/src/controller.ts:503`.
- Deployment configuration embeds the record at build time: `packages/site/src/config.ts:322`.
- Current wagmi is `^3.7.7`, not the personal-stack v2 default: `packages/web-miner/package.json:38`.

### Inferences — moderate confidence

- Additive journal/record fields permit rollback without destructive migration.
- Landing can consume shared navigation without account-session initialization. Its exact navigation arrangement lacks a canvas branch: `canvas/lib.py:283`.
- Rollup proof-event reading can reuse existing RPC infrastructure; exact event semantics and deployment search bounds remain unverified.

### Asks for the owner

1. Approve a deterministic legacy fallback—newest-created record—because “most recently opened” cannot be reconstructed. Preserve both records.
2. Approve corrections to unsupported copy: generic reverts, deadline equality, guaranteed finality wake-up, and rollback failure.
3. Confirm landing navigation: proposed product links plus existing landing content navigation, with no account initialization.
4. For §9.3.7, authorize a bounded SDK feasibility answer: inspect the pinned interface and identify missing support; no PXE integration or dependency upgrade this arc.

## 5. Phases with validation gates

### Common gate G — mandatory after every phase

Run long lanes in tmux through existing isolation tooling; never hardcode ports or kill by name.

```sh
bun run lint
bun run typecheck
bun test
E2E_PROVERLESS=1 E2E_SHARD=cockpit bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e
E2E_PROVERLESS=1 E2E_SHARD=chain bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e
E2E_PROVERLESS=0 E2E_SHARD=canary bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e
E2E_PROVERLESS=1 E2E_SHARD=bridge bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e
bun run --cwd packages/web-miner test:replay
bun run rig -- browser origin
```

Run canary with `E2E_PROVERLESS` **unset** if the runner treats variable presence as enabled; verify its parser before execution.

G passes only with all expected unique titles executed, inventory floors satisfied, zero browser proofs in proverless shards, and owned processes cleaned up. No skipped external-data integration counts as validation: exercise env-gated readers against the isolated network.

When account dialogs or signed-out rendering change, regenerate before replay:

```sh
bun run e2e:agent -- bun packages/web-miner/e2e/replay/setup.ts record
```

Every phase below includes G plus its named component gates. Add tests beside changes; retain meaningful failure coverage rather than increasing test counts mechanically.

### Phase 1 — Shared primitives and unified navigation

Add Header/AmountField/ActivityRow shells; adapt dialog geometry, Stepper contrast and Trail tones. Wire all three headers and logo links. Preserve old consumers through adapters.

Adapt navigation assertions and dialog replay geometry. Regenerate stats baselines inside the pinned Playwright image now.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
bun run --cwd packages/web-stats test:components
bun run --cwd packages/web-landing test:components
bun run --cwd packages/web-stats test:visual --update-snapshots
bun run --cwd packages/web-stats test:visual
```
Plus G. Pass: approved desktop geometry, links, focus and baseline review.

### Phase 2 — Account ownership and sign-out

Implement slot reservations/migration, fail-closed login/create, Welcome, words validation, consent and hold fallback. Gate forgetting in session code, not only the dialog.

Adapt `helpers.ts`, passkey/words/origin specs and account replay. Cover concurrent mutation, failed opening, backup refusal and click-only access.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
```
Plus G and re-recording. Pass: no unintended replacement or unrecoverable credential loss.

### Phase 3 — Opening and mining intent

Implement page-first arrival, Start intent, truthful opening steps and cancellation. Measure cold/warm stages without collecting secrets; investigate PXE progress and Presto feasibility.

Adapt opening/miner/passkey helpers and replay screens.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
```
Plus G and re-recording. Pass: cancel/retry works; only the intended successful opening starts mining.

### Phase 4 — Node health and Settings

Implement continuous freshness, stale-tip pause, transactional switching/rollback and Ethereum RPC settings. Complete Settings sections and account entry.

Adapt `switch.e2e.ts` and `states.e2e.ts`; cover answering-but-stale, candidate failure, rollback failure and late responses.

**Gate:**
```sh
bun run --cwd packages/web-miner test:components
```
Plus G. Pass: healthy means fresh; failed switches never falsely report success.

### Phase 5 — Claim lifecycle

Implement stable win clocks, steps, TTL, six outcomes, stopping and quiescent sign-out. Add exact settlement tracking and sanitized unknown-error Retry.

Adapt miner/states/canary assertions. Preserve the canary’s same-ticket rejection-and-restoration proof by stopping during the claim and explicitly retrying its retained ticket.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
```
Plus G. Pass: canary rejects before sending, then the same restored claim mints; Stop remains respected.

### Phase 6 — Mining presentation and Presto

Fix chart time extent, epoch step/drop separation, ledger layout and epoch vocabulary. Implement Start-only probing, sticky slider swap and deferred browser settings; retain billboard and all fallback reasons.

Adapt Presto/miner/pop-out specs and signed-out replay; verify shared landing chart behavior.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
bun run --cwd packages/web-landing test:components
```
Plus G and re-recording. Pass: no idle probe, no native rebuild from slider changes, truthful ✦.

### Phase 7 — Durable crossing evidence

Persist actual pre-send expiry/hash, implement absence checks and re-adoption, and replace deposit timeout guesses with receipt/event/deadline evidence.

Adapt bridge-states and rig browser cases. Cover reload-before-response, unavailable history, stale nodes and late logs. A merely abandoned wallet prompt stays unresolved.

**Gate:**
```sh
bun run --cwd packages/web-miner test:components
```
Plus G. Pass: no duplicate-money retry from uncertainty; restored early recovery files advance.

### Phase 8 — Contract readings and settlement

Add block-consistent four-way deadline policy, latest L1 proof timestamps, registration timing and ABI-error policy. Share deadline presentation with stats.

Exercise real emitted-event fixtures, deadline equality, transition observation, pause refund, partial history and pruned claims.

**Gate:**
```sh
bun run --cwd packages/web-miner test:components
bun run --cwd packages/web-stats test:components
```
Plus G. Pass: timestamps match L1 blocks; schedules never grant permission.

### Phase 9 — Wallet activity

Replace both lists with one ActivityList, exhaustive copy, details/actions and completed-row collapse. Include deposits and every dropped/pruned/unknown state. Integrate wallet balance/privacy composition.

Adapt crossing/arrival selectors in bridge-states and rig specs.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
```
Plus G. Pass: each crossing appears once, and count/action/reason agree.

### Phase 10 — L2 transaction dialogs

Replace Send, bridge-to-Ethereum and Send-ahead sheets with one-screen dialogs. Add blur recipient checks, private/public behavior, full pasted-address review, truthful progress and recovery-file prompts/re-offers.

Adapt withdraw/bridge/bridge-states specs and dialog fixtures.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
```
Plus G and affected recordings. Pass: cancellation boundaries and disabled reasons match actual send ownership.

### Phase 11 — Ethereum wallet interactions

Implement deduplicated wallet discovery, visible network switching, payer ETH/gas checks, fixed recipients, deposits, claims, forward and redeem dialogs.

Adapt bridge-states’ wrong-network/rejection/account-change cases and V6 forward/redeem rig steps.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
```
Plus G. Pass: account/chain changes invalidate estimates; portal races yield the same policy sentences.

### Phase 12 — Retired origin, operator records and final fidelity

Add validated runtime lifecycle metadata and operator stop/retirement writes. Make old `/` resolve to Send ahead; remove mining/deposits/Wallet, retain Settings and apex Stats. Load node-retired status before account boot. Preserve `OldTabNotice`.

Update runbook for operator-recorded stop, witness archival, retirement and explicit publication of affected origins. Complete upgrade cards, FAQ/rules, navigation and canvas checklist.

Adapt origin/browser cases, including silent versus stopped versus node-retired and missing metadata.

**Gate:**
```sh
bun run --cwd packages/ui test:components
bun run --cwd packages/web-miner test:components
bun run --cwd packages/web-stats test:components
bun run --cwd packages/web-landing test:components
bun run e2e:agent -- bun run site:e2e
bun run --cwd packages/web-stats test:visual
```
Plus G. Run `bun run lint:actions` before any workflow change. Pass: every board/state accounted for, final visual review complete, no deployment executed.

## 6. Delivery

| Arc | Phases | Stacks on |
|---|---|---|
| `yacana-polish-foundations` | 1 | `main`, the worktree’s base |
| `yacana-polish-account` | 2–3 | foundations |
| `yacana-polish-mining` | 4–6 | account |
| `yacana-polish-evidence` | 7–8 | mining |
| `yacana-polish-wallet` | 9–11 | evidence |
| `yacana-polish-retired` | 12 | wallet |

Use conventional commits and additive storage changes. Each arc must revert cleanly at its stack position without deleting keys, downgrading journals or changing contracts; revert dependent arcs first. Compatibility adapters stay until their consumers have migrated.

Run the Codex adversarial fix loop against each arc’s parent, then a cross-arc integration loop. Resolve findings before PR creation; no additional code-review or hardening pass.

Only at Delivery: submit through `gh stack submit --auto`, synchronize as needed, and watch PR checks. No merge, release or deployment command belongs to execution.

## 7. Adversarial notes

The brief needs explicit corrections:

- **Missing reader:** recon claims `afterNextAt` is already exposed, but `packages/bridge/src/portal-reader.ts:19` does not provide it. Add the read.
- **Deadline:** “closes in that block” overlooks `<=` at `YacanaPortal.sol:272`; “can only move later” overlooks pause refunds. Contract readings win.
- **Reverts:** broad classification at `miner-core/src/claim-failure.ts:13` cannot justify “epoch closed first” for every revert.
- **Rollback:** current switching mutates the live connection before rebuilding; the proposed “Kept …” sentence requires implemented rollback, not cosmetic error handling.
- **Copy precedence:** `canvas/boards_meta.py:82` retains superseded Presto claims. Current flow boards and verified contract behavior require reconciliation before copy acceptance.
- **Account history:** “most recently opened” is unknowable for legacy records. Also, the slot is per browser profile **and origin**, not shared across apex and retired hosts.

Highest-risk capabilities are trustworthy send absence, latest-proof history, settlement/pruning and account replacement. Bound them with explicit unknown states, durable local evidence, exact checkpoint identity and transactional ownership. Node retirement requires a served operator record; silence never substitutes.

If budget halves, reduce delivery to fewer complete arcs with owner approval. Defer later wallet/retired-origin redesign arcs rather than cutting their states, weakening proof gates or shipping reassuring sentences without evidence. The original success criteria cannot honestly be met at half scope.