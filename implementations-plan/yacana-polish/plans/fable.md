# Fable draft — yacana-polish (2026-09-15, Plan subagent on Fable 5.1)


## 1. Goal and done

Ship the v4.2 brief and the 95-board canvas across `web-miner`, `web-stats`, `web-landing` and the old-origin build: one shared header (4A), page-first sign-in behind a click (1A), a single account slot per browser, the cockpit's claim chip with six outcomes and two banners, the Presto row in place of the slider (6A), the three-tier node row with `behind` and the stale-tip pause, the Wallet state table and a one-screen Send, one-screen bridge forms (3A) with the claim dialog's six states, the activity row replacing `JournalCard`/`ArrivalCard`, the four deadline readings, hold-to-sign-out that waits for a claim (5B), the old origin as one Send-ahead page (7A), and the two served record flags written by the operator script.

Done means, measurably:

- Every string on a board appears verbatim in code (a copy table per screen; the Vitest specs assert the table, not prose).
- §9.1 defects 1–15 each have a failing-then-passing test; §9.2 decisions 1–21 are each cited by the test that pins them; §9.3 capabilities 1–6, 8–10 are built, §9.3.7 is a written ask.
- The four web-miner shards, the replay lane, the rig's `browser` and `origin` cases, the site e2e and the stats visual gate pass; `proof-inventory.ts` lists every title with its floor; no proverless shard proves.
- No new dependency; `bun run lint` clean at every phase; no function over the complexity budget.

## 2. Architecture & Implementation

### 2.1 Shape and boundaries

Three layers stay as they are and the work respects them: pure logic in `packages/bridge/src` and `packages/miner-core/src` (bun tests), primitives in `packages/ui/src/components` exported through `index.ts`, and page wiring in `packages/web-miner/src/{routes,features,components,bridge}`. The reducer (`lib/reducer.ts`) remains the only place cockpit state changes; the controller (`controller.ts`) remains the only place that talks to the worker; `bridge/session.ts` remains the only writer of the journal. New shared things go to `packages/ui` (Header, ActivityRow, AmountField, the `.st` chip), new pure things go to `packages/bridge/src` (deadline reading, revert table, proof-time read, expiry rule).

### 2.2 Reuse / adapt / new — cross-checked against recon Part 0

Agree with the reuse map on every line but three, noted here:

| Capability | Recon says | Plan says | Evidence |
|---|---|---|---|
| Single slot | build new | **adapt**: `createWithPasskey` already passes `excludeCredentials` for every record (`session.ts:296-324`, `passkey.ts:80`); the missing piece is the fail-closed refusal in `restoreWithPasskey`, which today creates a record for an unknown master (`session.ts:352-373`), plus a `lastOpenedAt` stamp (`store.ts:13-35` has `createdAt` only) | narrower than "new" |
| Deadline reading | `packages/bridge/src/deadline.ts` | **new file** `packages/bridge/src/deadline-reading.ts`; `deadline.ts` is the L1 rollup-proof reader (`RollupReads` 7–12), not the portal deadline; the portal's `afterNextAt` (`YacanaPortal.sol:211-213`) is not read anywhere in `portal-reader.ts` and must be | avoids overloading a file with a different job |
| takingLong | fix once in `copy.ts` | fix once, but the clock is not in `copy.ts`: `takingLong` counts from `updatedAt` (`copy.ts:161-162`); the brief wants the next version's registration time, which is `VersionFlows.launchAt` for `migration.toIndex` (`portal-reader.ts:31-45`) — the read moves into `bridge/session.ts` facts, the predicate stays pure | |

Everything else: reuse `Dialog` with a `size: 'sm'` (440 px) variant (`dialog.tsx:23-57` has `max-w-md`), `Stepper` tones (`stepper.tsx:19`), `HoldButton` (`hold-button.tsx:14-74`), `PowerSlider` (`power-slider.tsx:29`), `ProofLedger`/`ProofLine` (`proof-line.tsx:9-15`), `ScoreLoop` calm variant (`score-loop.tsx:38`), the journal reducer (`journal.ts:200-218`), `scanLogs` (`logs.ts`), `revertName` (`revert.ts`), `probeNode` (`node.ts:50-75`), `switchNodeLive` (`boot.ts:212-231`), the recovery file (`recovery.ts`). Delete `Sheet` after its four consumers move (`index.ts:36-43`), delete the three amount fields for one `AmountField`, delete `JournalCard`, `ArrivalCard`, `BridgeTile`, `MigrationCard`, `TakingLongDialog`, `ClaimSlot`.

### 2.3 Key interfaces and types

**Activity row** (`packages/ui/src/components/activity-row.tsx`, copy in `packages/web-miner/src/bridge/copy.ts`):

```ts
interface ActivityRowProps {
  word: string; sentence: string; tone: 'info' | 'ok' | 'warn' | 'bad' | 'muted';
  amount: string; who: string; stamp: string;                // whoOf/stamp reuse (copy.ts:175-190)
  trail?: TrailStep[]; action?: { label: string; kind: RowAction; disabled?: string };
  testid: { state: string; kind: 1 | 2 | 3 };
}
type RowAction = 'claim' | 'forward' | 'redeem' | 'send-again' | 'change-rpc' | 'resume';
// copy.ts: LINES gains 'didnt-finish' and the arrival states; cardLine (143-156) becomes rowLine(c, ctx)
```

**Deadline reading** (`packages/bridge/src/deadline-reading.ts`), mirroring `deadline()` in `YacanaPortal.sol:259-266`:

```ts
type DeadlineReading =
  | { kind: 'open' }                                        // flipAt == 0
  | { kind: 'floor'; flipAt: bigint; atLeastUntil: bigint } // flip seen, afterNextAt == 0: flipAt + EXIT_FLOOR + pausedSeconds
  | { kind: 'set'; deadline: bigint; pausedSeconds: bigint }
  | { kind: 'passed'; deadline: bigint };                   // l1Now > deadline (Ethereum's clock, never the device's)
readDeadline(s: { flipAt; afterNextAt; deadline; pausedSeconds; exitFloor }, l1Now): DeadlineReading
```

`VersionStanding` (`portal-reader.ts:18-29`) gains `afterNextAt`; `BridgeView.standing` (`state.ts:49-57`) gains `afterNextAt` and `pausedSeconds`. `web-stats/src/bridge-beat.ts:87-137` already renders these words from the same fields and moves onto the shared reading.

**Claim outcome model** (`lib/reducer.ts`):

```ts
type ClaimOutcome =
  | { kind: 'minted'; block; tx; reward }
  | { kind: 'expired' } | { kind: 'reverted' }                        // dropped, resumes / chain view rebuilt
  | { kind: 'delivery-blocked'; until: number }                        // paused until finality
  | { kind: 'other'; message: string }                                 // first line + Retry; pending kept
  | { kind: 'discarded'; epoch: bigint };                              // §9.1: 'discard' gets a ledger line
ClaimProgress adds `stopping: boolean` (the controller's private stopAfterClaim, controller.ts:169, surfaces through a `stopping` event)
```

**Header** (`packages/ui/src/components/header.tsx`): `{ app: 'miner'|'stats'|'landing'|'old'; version: string; links: { label; href; icon; testid; external? }[]; active?: string; tag: 'testnet' | 'testnet · fees sponsored'; right?: ReactNode }` — the tag neutral (rule from §4), the link sets from `canvas/lib.py header()`.

**Node health with `behind`** (`packages/site/src/browser/node-health.ts`):

```ts
type NodeHealth =
  | { kind: 'healthy'; block; ageS; latencyMs } | { kind: 'behind'; ageS }   // ageS ≥ BEHIND_AFTER_S (60)
  | { kind: 'throttled' } | { kind: 'silent' } | { kind: 'failed'; message };
```

`bannerState` (187–201) gains `behind`; `PauseReason` (`controller.ts:37`) gains `'behind'`; `describeProbe` (`lib/node-check.ts:55-60`) returns the three-tier lines.

**Single-slot store** (`keys/store.ts`): `slot(): Promise<MasterRecord | undefined>`, `claimSlot(record): Promise<void>` (throws `SlotTakenError` when one exists), `touch(id)` sets `lastOpenedAt`, `forgetMaster` unchanged. `listRecords` stays for the migration of a device holding several records (the Welcome screen shows the most recently opened; the others are not deleted, only unreachable until Forget).

### 2.4 Critical flows

**Sign-in → opening → cockpit.** `signInAtom` defaults to `false` (today `true`, `state.ts:39`); `sign-in-mine` (`LoopTile.tsx:122-166`), `sign-in-balance`, `sign-in-settings` set it; `SignInDialog.open = opening || (signedOut && wanted)` (`SignInDialog.tsx:19`) stays. The dialog is `size: 'sm'`. Create → `createWithPasskey` → `runAttempt` (`session.ts:182-201`) → `startSession` steps (`boot.ts:264-380`) → the opening checklist (`opening-steps.ts` weights reused) → `bootAtom` ready → cockpit. The Presto probe leaves `preflight` (`boot.ts:162-164`) for `startMining` (`session.ts:612-621` already reprobes); the controller is built with `presto: null` and `reconfigure` takes the endpoint when the probe answers.

**Claim, win → ledger.** Worker win → `winner` (`reducer.ts:206-214`) → chip `claiming · proving · 12 s` on one clock (`since − Σdone`, as `ClaimSlot.tsx:39` computes) → `submit` (`controller.ts:577-626`) → `advance` sent with `expiresAt` → waiting → `claimed` (229–246) writes the `minted` line through `ProofLine` (`proof-line.tsx:13`). Failure → `failed` (248–271) → outcome line + banner: `expired` resumes, `reverted` shows "chain view rebuilt", `delivery-blocked` shows the "claims paused until finality" banner from `pauseUntilFinal` (`controller.ts:795-803`), `other` keeps `pending` and offers Retry (`retry` event 291–302). `execute 'discard'` (503–506) dispatches `discarded` instead of logging.

**Crossing, send → row.** `exitToL1` (`bridge/session.ts:621-663`) → `sendRecorded` (`flows.ts:133-159`) records `txHash` **and** `expiresAt` from `observeSends` (`wallet.ts:48-59`) → row `sent` → every `REFRESH_MS` `factsFor` (`facts.ts:82-88`) → `advance` → `proven-pending` (the proof-time read, §2.6) → `witnessed` → `ready` → claim dialog → `claimed`. A record that lost its hash goes through `txByTag` (`bridge/session.ts:189-205`); when that finds nothing and the node's tip is past `expiresAt`, the row reads "didn't finish".

**Node switch.** `CheckForm` (`NodeTile.tsx:112-208`) → `probeNode` → `CheckResult` three tiers → `node-use` → `switchNodeLive` drain → swap → rebuild (`boot.ts:212-231`) → `saveConnection` (`connection.ts:98-106`). `useNodeHealth` (`NodeTile.tsx:25-55`, 10 s) feeds `behind`; the controller pauses with reason `behind` and releases when the tip is under a minute again.

### 2.5 Change map

**packages/ui** — add `header.tsx`, `activity-row.tsx`, `amount-field.tsx`, `state-chip.tsx`; modify `dialog.tsx` (size), `stepper.tsx`, `trail.tsx`, `hold-button.tsx` (`pending` + `pendingLabel`), `index.ts`; delete `sheet.tsx`, `journal-card.tsx`, `amount-block.tsx`.

**packages/bridge/src** — add `deadline-reading.ts`, `revert-table.ts`, `proof-time.ts`, `expiry.ts`; modify `journal.ts` (`Crossing.expiresAt`, state `didnt-finish`, `Facts.l2Tip`, `Facts.provenAt`), `portal-reader.ts` (`afterNextAt`, `launchAt` of the next version), `record.ts` (`stoppedAt?`, `nodeRetired?`).

**packages/web-miner/src** — add `features/ClaimChip.tsx`, `features/ClaimOutcomes.tsx`, `features/PrestoRow.tsx`, `features/SendDialog.tsx`, `features/ToEthereumDialog.tsx`, `features/ClaimOnEthereumDialog.tsx`, `features/FromEthereumDialog.tsx`, `features/SendAheadPage.tsx`, `features/Activity.tsx`, `features/AccountFailure.tsx`, `bridge/eth-balance.ts`; modify `App.tsx`, `routes.ts` (route `send-ahead` on the old role), `routes/{Mine,Wallet,Settings}.tsx`, `features/{SignInDialog,SignOutDialog,KeyScreen,WordsScreens,LoopTile,RailTile,ClaimStatus,PrestoBanner,OldApp}.tsx`, `components/{NodeTile,BalanceCard,EthRpcTile}.tsx`, `lib/{reducer,node-check,withdraw-form}.ts`, `keys/store.ts`, `session.ts`, `controller.ts`, `boot.ts`, `state.ts`, `presto.ts`, `bridge/{copy,session,flows,facts,env,forms}.ts`, every `*.vitest.tsx` touched, `e2e/*.e2e.ts`, `e2e/proof-inventory.ts`, `e2e/helpers.ts`, `e2e/replay/*`; delete `features/{ToEthereumSheet,DepositSheet,SendAheadSheet,SendSheet,MigrationCard,TakingLongDialog,ClaimSlot,BridgeTile,ArrivalCard}.tsx`, `components/AmountInput.tsx`.

**packages/site/src** — modify `browser/node.ts`, `browser/node-health.ts`, `config.ts` (validate the two flags), `assemble.ts` (old role: miner at `/`, no landing, no stats).

**packages/web-stats/src** — modify `App.tsx` (Header), `bridge-beat.ts` (shared reading), `e2e/__screenshots__` regenerated.

**packages/web-landing/src** — modify `sections/Bar.tsx` (Header).

**packages/deploy/src/bridge** — add `stop.ts` (`record-stop`, `record-node-retired` commands writing the two fields); modify `cli.ts`. **docs/upgrades.md** gains steps between retire and the old origin.

### 2.6 Non-obvious mechanics

**L1 proof-verified timestamp (§9.3.1).** The Rollup emits `L2ProofVerified(checkpointNumber, proverId)` (`node_modules/@aztec/l1-artifacts/dest/RollupAbi.js:4113`); the crossing knows its L2 epoch and `RollupReads` gives `provenCheckpoint`/`epochOfCheckpoint` (`deadline.ts:7-12`). `proof-time.ts` scans with `scanLogs` (`logs.ts`, 10,000-block windows) backwards from the latest L1 block for the first event whose `checkpointNumber ≥` the crossing's checkpoint, bounded to `MAX_WINDOWS` (8), then `getBlock(blockNumber).timestamp`; cached per checkpoint in memory. On a miss the row says "proven on Ethereum" without a time (never a fabricated time). Runs only when the state moves to `proven-pending`, once.

**Persisted expiry and the re-adoptable "didn't finish".** `expiresAt` is captured at send from the same value `SentTx.expiresAt` carries (`wallet.ts:25-28`, `chain.ts:92-122` already does this for claims) and stored on the `Crossing`. `advance` gets `Facts.l2Tip`; the rule in `expiry.ts`: `state ∈ {sent, proving}` ∧ no tx by hash ∧ no tx by tag ∧ `l2Tip > expiresAt` → `didnt-finish`. It is **not** in `FINAL_STATES`; `landing.ts` `BEFORE_ARRIVAL` (98–108) gains it, so a later log for the same index revives it through `landed` (115–126) and `store.adopt` (`store.ts:157-169`); its index is never reused (`store.ts:4-5`). The row's action is `send-again`, which reserves a new index.

**Four deadline readings.** `open` before the flip; `floor` after the flip while `afterNextAt == 0` ("at least until", `flipAt + EXIT_FLOOR + pausedSeconds`); `set` once both transitions are observed; `passed` against `l1Now` (`bridge/session.ts:385-396`), never `Date.now()`. Every sentence on the Wallet, the activity row, the old origin and the stats page derives from this one function.

**Stale-tip pause.** `probeNode` computes `blockAgeS` (`node.ts:69`) from the node's own tip timestamp; `useNodeHealth` re-probes every 10 s. `behind` when `ageS ≥ 60` → `controller.pause('behind')`; precedence: `behind` shows before `offline` (`OFFLINE_AFTER_MS` at `controller.ts:398-419`), the throttled row states the offline pause comes after a minute. Release on the first healthy probe. The e2e localnet's block cadence must stay under 60 s or the `switch` spec flaps — assumption below.

**Swap on the sticky Presto state.** The rail shows the Presto row when `prestoAtom.selected === 'presto' && fallbackReason === undefined`, the slider otherwise; `active` (set on every message, `controller.ts:518-575`) never drives the swap, so a transient refusal (`presto-prover.ts:108-111`, `TRANSIENT_LIMIT` 3) does not flap. `reconfigure` (`controller.ts:329-336`) adds the engine to its comparison so a slider move under Presto does not rebuild (§9.1.15). Settings' Presto row: `status === null` → "checked when you start mining".

**The hold that waits for a claim.** `HoldButton` gains `pending: boolean` and `pendingLabel`: while pending, the fill completes and the button shows the label ("signing out after the claim · 61 s") instead of confirming. `SignOutDialog` reads `phase === 'claiming'`; `session.forget` (`session.ts:443-448`) becomes `await controller.stop(); await claimSettled; forgetMaster; reload` — the reload only after `phase !== 'claiming'`. The click path renders only after an early release (`useHold` cancel branch at `hold-button.tsx:14-74` exposes `released: 'early' | null`).

### 2.7 Trade-offs

- **Page-first sign-in** costs every "dialog open on arrival" assertion (`sign-in.vitest.tsx:66-76`, `opening.e2e.ts:18`, `passkey.e2e.ts:35-38`); gained: the live cockpit as the landing state. Alternative (keep auto-open, hide the dim) rejected: it contradicts 1A.
- **`didnt-finish` as a persisted state** rather than a derived flag: derived would need `l2Tip` at render time; a state survives reload and is what `adopt` can revive.
- **One `Header` in `ui`** over three hand-rolled ones: the web-stats baselines regenerate once; the alternative (three headers with one copy table) leaves the drift the recon found (`App.tsx:82-139`, `web-stats/App.tsx:98-129`, `Bar.tsx`).
- **Proof time bounded by windows** rather than exhaustive: an unbounded backward scan on a public RPC is a DoS on the user's rate limit.
- **The Presto probe on Start** rather than at cockpit-ready: the controller must accept a null prover engine and swap; the alternative keeps the probe at boot and lies in Settings before mining (Fable r3 #7).

## 3. Security & Adversarial Considerations

**Threat model.**

- *Account slot.* An attacker with a second passkey on the device must not overwrite or shadow the stored account: `restoreWithPasskey` refuses a master whose fingerprint differs from the slot's (failure d3 "belongs to a different account") instead of creating a record (`session.ts:352-373`); `createWithPasskey` keeps `excludeCredentials` over every record (`session.ts:296-324`); `forget` is the only path that empties the slot and it stays behind the backed-up check (`SignOutDialog.tsx:18-19`).
- *Bridge sentences and disabled reasons.* Every one derives from `DeadlineReading`, `standing.{paused,headroom,registered,depositsClosed}` and `revertName` (`revert.ts`); `expectedFlipAt` from the record is used only for the announcement's "around <day>" (`Announcement.tsx:12-13`), never to close a button. A test asserts no sentence in `copy.ts` reads `migrationRecord()`.
- *ETH balance read (§9.3.8).* `getBalance` and `estimateGas` on the connected wallet's address through the pinned chain (`ensureChain`, `eth.ts:57-59`) only when the crossing is `ready`; an estimate failure is "unknown", not "no ETH"; the read never blocks Claim, it only writes the "no ETH" state's sentence.
- *L1 event read.* `L2ProofVerified` from the configured rollup address only (`VITE_ROLLUP_ADDRESS`); bounded windows; a timestamp is displayed, never used in a decision.
- *Served record flags.* `stoppedAt` (numeric string) and `nodeRetired` (boolean) are validated in `config.ts` `blockOf` (152–153) with a shape check like `assertExampleClaim` (230–253); they drive copy on the old origin only ("Mining stopped on <day>", "the node is gone"); the deadline stays a contract read.
- *Old origin.* `keysAllowed` stays restore-only for the old role (`host.ts:54-65`); the route set drops the landing and stats (`assemble.ts:28-32`); `startMining` stays inert (`session.ts:612-621`).

**Least privilege.** The page requests only `eth_getLogs`, `eth_getBlockByNumber`, `eth_getBalance`, `eth_estimateGas` on top of today's calls; no new permissions, no new storage keys beyond `lastOpenedAt` and `expiresAt`.

**Input validation.** Pasted words: `normaliseWords` + `validWords` (`mnemonic.ts:17-23`), the per-word `isWord` (39) for the checksum message; the phrase never enters the log or an error string. Addresses: `parseRecipient` (`withdraw-form.ts:33-44`) and `parseEthAddress` checksum (`forms.ts:18-25`) unchanged; the pasted chip shows the checksum verdict. Node URLs: `parseNodeUrl` (`node.ts:19-31`), production https-only (`config.ts:263-275`), the guard bounds requests (`node-guard.ts`). The record: JSON from the build define only; the two new fields validated at load.

**Supply chain.** No new dependencies. wagmi's `getBalance`/`estimateGas` and `@aztec/l1-artifacts`' `RollupAbi` are already installed. Should a reviewer propose one, it must be named with a version and be older than seven days.

**Frontend risks.** `location.reload()` on sign-out during a claim (fixed by the wait); `dangerouslySetInnerHTML` is absent and stays so; explorer links through `ExternalLink` only; the hotkeys stay disabled while any dialog is open (`use-page-behaviour.ts`).

## 4. Assumptions

**Facts (verified).**
- `signInAtom = atom(true)` opens the dialog on arrival (`state.ts:39`); `sign-in.vitest.tsx:66-76` asserts it.
- `restoreWithPasskey` creates a record for an unknown master (`session.ts:352-373`); `MasterRecord` has no `lastOpenedAt` (`store.ts:13-35`).
- `afterNextAt` exists on the portal (`YacanaPortal.sol:211-213`) and is unread (`portal-reader.ts:18-29`); `deadline()` semantics at `YacanaPortal.sol:259-266`; errors `NotRegistered`, `VersionPaused`, `DeadlinePassed`, `WaitsForHeadroom` at 272–278.
- `L2ProofVerified(checkpointNumber, proverId)` at `RollupAbi.js:4113`; no reader exists.
- `Crossing` has no expiry field (`journal.ts:57-92`); `SentTx.expiresAt` exists (`wallet.ts:25-28`); `sendRecorded` records the hash only (`flows.ts:133-159`).
- `eth.ts` has no balance or gas read (30–152).
- `probeNode` computes `blockAgeS` and rejects nothing (`node.ts:69`); `bannerState` has no `behind` (`node-health.ts:187-201`).
- `stopAfterClaim` is private and undispatched (`controller.ts:169, 310-318`); `other` halts (`reducer.ts:269-270`, `controller.ts:665`); `discard` only logs (`controller.ts:503-506`).
- `takingLong` counts from `updatedAt` (`copy.ts:161-162`).
- `assemble.ts APPS` serves the landing at `/` for every role (28–32).
- `BridgeRecord`/`MigrationRecord` lack stop/retired fields (`record.ts`); `docs/upgrades.md` has no such step; `cli.ts` has no such command.
- Stats visual baselines live in `packages/web-stats/e2e/__screenshots__`, run in the pinned image (`visual.ts:7`).

**Inferences (unverified).**
- The e2e localnet produces a block well under 60 s, so `behind` never trips in the `switch` spec; if not, the threshold becomes a `VITE_*` override in e2e mode only.
- `SentTx.expiresAt` is comparable to the node's tip in the same unit as the claim path uses it.
- The canvas's signed-out cockpit is live (no dim); `Mine.tsx:63-64`'s `data-signed-out` styling goes.
- The old origin's `Send-ahead` page can reuse `SendAheadSheet`'s review logic (`ahead-*` testids) inside a route rather than a dialog.

**Asks.**
1. 5B's accessibility exception (Fable r3 #6): confirm the click path only after an early release.
2. Where the two flags live: `MigrationRecord.stoppedAt` / `MigrationRecord.nodeRetired` (per version, per the migration) — or top-level on the deployment record?
3. `BEHIND_AFTER_S = 60` fixed, or a setting?
4. §9.3.7 (PXE proofs through Presto): a two-page investigation note is the deliverable; confirm no code.
5. A device with several stored records after the single-slot change: keep-unreachable (this plan) or migrate-by-forgetting?

## 5. Phases with validation gates

Each gate's fast layer is `bun run lint && bun test && bun run --cwd packages/<p> test:components` for every touched package; the pass criterion is zero failures and no inventory shortfall (`proofShortfall`). Long runs in tmux.

**P0 — Shared primitives and the header.** `Dialog size`, stepper tones, `.st` chip, `AmountField`, `Header`, `ActivityRow` (unwired), neutral testnet tag; three apps take `Header`; `Sheet` marked for deletion. Adapt: `shell.vitest.tsx`, `sections.vitest.tsx`, `stats.vitest.tsx`, `signed-out.replay.ts` (header changed → re-record). Gate: fast layer for `ui`, `web-miner`, `web-stats`, `web-landing`; `bun run e2e:agent -- bun packages/web-miner/e2e/replay/setup.ts record` then `bun run --cwd packages/web-miner test:replay`.

**P1 — Account.** Single slot, page-first sign-in, six failures, checksum copy, opening checklist, welcome, old-origin note. Adapt: `sign-in.vitest.tsx`, `passkey.vitest.tsx`, `passkey.e2e.ts`, `words.e2e.ts`, `opening.e2e.ts`, `helpers.ts passKeyScreen`, `dialog-geometry.replay.ts` (440 px), `proof-inventory.ts`. Gate: fast layer; `E2E_SHARD=cockpit E2E_PROVERLESS=1 bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`; `E2E_SHARD=canary bun run e2e:agent -- …` (proving); replay re-recorded.

**P2 — Cockpit.** Claim chip and outcomes, banners, `stopping`, `other` Retry, `discarded` line, Presto row swap, probe on Start, `reconfigure` engine compare, epoch tile, idle ledger epoch line. Adapt: `cockpit.vitest.tsx`, `presto-banner.vitest.tsx`, `miner.e2e.ts`, `states.e2e.ts`, `presto.e2e.ts`, `canary.e2e.ts`, `signed-out.replay.ts`. Gate: fast layer; shards `cockpit`, `chain` proverless, `canary` proving; replay.

**P3 — Node.** Three-tier row, `behind`, stale-tip pause, Settings sections, Presto fallback row, EthRpc row. Adapt: `node-tile.vitest.tsx`, `node-banner.vitest.tsx`, `switch.e2e.ts`. Gate: fast layer (`site`, `web-miner`); `E2E_SHARD=chain E2E_PROVERLESS=1 …`.

**P4 — Wallet and sign-out.** K1/K2/K3 table, account tile, `SendDialog` on `AmountField`, hold-to-sign-out with the claim wait. Adapt: `sign-out.vitest.tsx`, `forms.vitest.tsx`, `withdraw.e2e.ts`, `words.e2e.ts` (hold timings), `passkey.e2e.ts`. Gate: fast layer; shards `canary` (proving) and `cockpit` proverless.

**P5 — Bridge core (pure).** `deadline-reading.ts`, `revert-table.ts`, `proof-time.ts`, `expiry.ts`, `Crossing.expiresAt`, `didnt-finish`, `afterNextAt` read, `launchAt`-based takingLong, `eth-balance.ts`, copy table for rows. Adapt: `packages/bridge` bun tests, `bridge-beat` tests. Gate: `bun test packages/bridge packages/web-stats`; fast layer.

**P6 — Bridge screens.** `Activity` rows replace `BridgeTile`+`ArrivalCard`, `ToEthereumDialog`, `ClaimOnEthereumDialog` six states, `FromEthereumDialog`, `Sheet` deleted. Adapt: `bridge-features.vitest.tsx`, `bridge-primitives.vitest.tsx`, `bridge-states.e2e.ts`, `bridge.e2e.ts` (rig, run at P7). Gate: fast layer; `E2E_SHARD=bridge E2E_PROVERLESS=1 …`; replay.

**P7 — Upgrade and the old origin.** `SendAheadPage`, route set, `OldApp` rewrite, record flags, `config.ts` validation, operator commands, `docs/upgrades.md`. Adapt: `versioned-origin.vitest.tsx`, `origin.e2e.ts`, `bridge.e2e.ts`, `packages/site` tests. Gate: fast layer; `bun test packages/site packages/deploy`; `bun run rig -- browser origin` in tmux.

**P8 — Site.** Stats navigation and freshness on `Header`, landing bar, baselines. Adapt: `visual.e2e.ts` baselines (`--update-snapshots` inside the image), `stats.e2e.ts`, landing e2e. Gate: `bun run --cwd packages/web-stats test:visual`; `bun run e2e:agent -- bun run site:e2e`; all four shards; replay; `bun run lint:actions` if any workflow changed (none planned).

## 6. Delivery

| Arc | Phases | Stacks on |
|---|---|---|
| A `feat(ui): shared header and primitives` | P0 | `main` |
| B `feat(web-miner): single slot and page-first sign-in` | P1 | A |
| C `feat(web-miner): cockpit claim outcomes and Presto row` | P2, P3 | B |
| D `feat(web-miner): wallet, send and hold-to-sign-out` | P4 | B |
| E `feat(bridge): deadline readings, expiry and activity rows` | P5, P6 | A (pure) then D (screens) |
| F `feat(site): old origin page and served stop flags` | P7 | E |
| G `feat(site): stats and landing on the shared header` | P8 | A |

Each arc is one `gh stack` branch with conventional commits; revert of an arc reverts only its own diff because arcs C, D, G touch disjoint files from each other and stack only on A/B. F depends on E's journal changes and cannot be reverted alone without E — stated, not hidden. PRs open only after the Codex fix loops converge on every arc.

## 7. Adversarial notes

**Where the brief and the code disagree.**
- *1A page-first* vs `signInAtom = true` (`state.ts:39`) and specs asserting the open dialog: the plan flips the default and rewrites the assertions.
- *§9.2.12 single slot* — the brief calls it new; the code's create side already fails closed (`passkey.ts:80`); only login is open (`session.ts:352-373`). The brief should say "close the login side".
- *§5.9 four readings* assume the version-after-next time is readable; it is (`YacanaPortal.sol:211-213`) but unread; the brief under-specifies `pausedSeconds` in the floor reading — the contract adds it (`deadline()` 265), so the floor sentence must too.
- *§9.3.1 proof timestamp* — the brief implies a per-crossing time; the event is per checkpoint. The plan reads the checkpoint that covered the crossing's epoch and says so in the sentence ("the checkpoint carrying it was proven at").
- *§9.1 takingLong* — the fix is a different clock, not a dedup: `launchAt` of the next version, not `updatedAt`.
- *7A* — `assemble.ts:28-32` still serves the landing and stats on the old role; the brief does not mention the route set.
- *Record flags* — the brief names them but no field, command or runbook step exists; the plan adds all three and asks where the fields live.
- *5B* — the click-after-early-release is an accessibility compromise the owner has not confirmed.
- *Announcement* — `Announcement.tsx:12-13` sentences from `expectedFlipAt`; allowed as an announcement, but the word "ends at the upgrade" there is a schedule claim; the plan rewrites it to "ends when the upgrade lands".

**Riskiest §9.3 capabilities and their bounds.** (1) The proof-time read — bounded windows, cached, display-only, silent miss. (8) The payer ETH read — only in `ready`, unknown on estimate failure, never gates Claim. (9) `behind` — a fixed 60 s, release on first healthy probe, e2e override if the localnet is slower. (5) `didnt-finish` — the state never enters `FINAL_STATES`, so a wrong verdict is undone by the next log. (7) Presto-through-PXE — a note, no code.

**If the budget halved.** Cut: the proof-time read (row says "proven on Ethereum"); the payer ETH read (the claim dialog surfaces the revert name instead); the old-origin one-page (keep `OldApp` with copy fixes and the removed "bet/sure loss" lines); the hold-waits-for-claim (disable the hold while claiming with the "claim finishing" line); the landing bar on `Header` (stats only). Keep: single slot, page-first sign-in, claim outcomes, Presto row, `behind`, deadline readings, activity rows, record flags.

### Critical Files for Implementation
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-polish/packages/web-miner/src/session.ts
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-polish/packages/web-miner/src/lib/reducer.ts
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-polish/packages/bridge/src/journal.ts
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-polish/packages/web-miner/src/bridge/copy.ts
- /home/homelab/Projects/elixir/.claude/worktrees/yacana-polish/packages/web-miner/src/App.tsx