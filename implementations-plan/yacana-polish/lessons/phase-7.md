# Phase 7 — The bridge's facts (arc 4, `polish-facts`)

## Build

- `packages/bridge/src/exit-deadline.ts` (new): `readDeadline(facts)` pure over `flipAt`, `afterNextAt`,
  `pausedSeconds`, the floor and `l1Now`; `exitDeadline()` mirrors `YacanaPortal.deadline` (the later of the
  two plus paused seconds), null while open-ended; `closed` is `l1Now > at`. The `floor` reading carries the
  paused seconds already spent (the contract never closes before them).
- `portal-reader.ts`: the turnstile read gains `afterNextAt` and `pausedSeconds` (one more `readContract`, the
  latter from the `versionInfo` already read); `registeredAt(version)` (the `VersionRegistered` block's
  timestamp, from the portal's deploy block); `canonicalAt(version)` (the Registry's `CanonicalRollupUpdated`
  block in one filtered `getLogs` over the chain, undefined when the RPC refuses the range).
- `proofs.ts` (new): `proofReader(client, {rollup, floor, budget, overlap})` → `latestProvenAt()`: newest-first
  windows of `LOG_WINDOW` from the L1 head under a per-call budget (4), a cursor resumed across calls, an
  overlap re-read (12 blocks) behind a known event; `'unknown'` while incomplete, `'none'` at the floor with no
  event, else `{at, checkpoint, block}` with `at` the event block's timestamp. The session's floor is the
  Registry's canonical block for this version, or the portal's deploy block when the RPC refuses the range.
- `journal.ts`: `Crossing.expiresAt` (unix s) and `anchorBlock`; `RowState`, `rowState(c, {sourceTipAt,
  covered})` (`unfinished` needs the expiry, the anchor block, coverage, and a tip past the expiry; anything
  short is `checking`; a hash or any other state reads as the state).
- `wallet.ts`: `sendObserver()` — every send observed synchronously (`SentTx` gains `anchorBlock`), plus a
  one-shot `beforeNextSend(hook)` that runs before `target.sendTx` and refuses the send if it rejects; no hook,
  no extra tick (the mining claim's path is unchanged). `OpenedWallet.beforeNextSend` rides on `Deployment`
  (`chain.ts`, `boot.ts`) to the bridge's `L2Handles`; `flows.ts`'s `sendRecorded` installs it around the
  send and commits the hash, expiry and anchor block to the journal first.
- `facts.ts`: `DEPOSIT_GIVES_UP_MS` gone. A proving deposit with a hash asks its receipt (`FactReads.l1Tx`:
  `getTransactionReceipt` + the `Deposited` log → `deposited`, a failed receipt → `dropped`); without one it is
  measured against Ethereum's clock and its calldata deadline (`expiresAt`, persisted by `deposit()` at
  creation) → `dropped` past it. The device's clock is out.
- `revert.ts`: `revertNameOf(e)`, the name → sentence table (`revertLine`, `explainRevert`) for the portal's
  holder-facing errors and the Outbox's three; `recovery.ts`: the file carries `expiresAt`/`anchorBlock`,
  `asHint` strips both on every state.
- `bridge/session.ts`: the view carries `deadline` (`readDeadline` at every refresh, the floor from `policy()`
  once), `targetRegisteredAt` (cached once seen), `proof` (best effort, kept from the last refresh when
  unread); `rowStatesAtom` published per refresh (`sourceTipAt` from the node's tip block, `covered` =
  deployment check passed and `getBlockData(anchorBlock)` answers); `payerFunds(account, ask)` builds the
  real call (the signature included for a send-ahead's forward or redeem) and reads the payer's ETH against
  its estimate through `eth-balance.ts` (new: `getBalance`, `estimateGas`, `estimateFeesPerGas`; unknown is
  null, never zero; a verdict needs both numbers).
- `copy.ts`: `takingLong(c, now, targetRegisteredAt)` counts from the later of held-at and the target's
  registration, never before it; `TakingLongDialog` passes the view's value (the dialog itself goes at P8).
- `DepositSheet.tsx`: both sheets read the payer's funds (the held-action sheet on open and on the click, the
  deposit on the click) and refuse with "<wallet> has no <chain> ETH for the gas." before the wallet is
  asked; a revert is explained through `explainRevert` before the raw first line.
- `bridge-states.e2e.ts`: the unanswered prompt → reload → "Waiting for your Ethereum wallet" → an L2 warp
  past the deposit's deadline retires it without a tap → deposit again → the page reloads the moment the
  wallet has sent → the row settles to `deposited` on its own → claim as before. The title and the inventory
  are unchanged.
- The stats' visual recording gains the `afterNextAt(version)` answer (zero, like `flipAt`'s) so the bridge
  page still replays; the stats' own use of `readDeadline` is P10's.

## Decisions and departures

- `ProofReading` is `ProvenAt | 'unknown' | 'none'`: the plan's `| null` had no word for the true negative
  (the floor reached without an event), which the chip needs ("no proof yet" vs "checking").
- The proof scan's floor falls back to the portal's deploy block when the Registry's full-range `getLogs` is
  refused: a public RPC caps ranges; the fallback only shortens what "none" can claim, never invents a proof.
- The backward walk lives in `proofs.ts` on `LOG_WINDOW` rather than as a `logs.ts` primitive: it is the only
  newest-first scan, and it carries a cursor and an overlap `scanLogs` has no use for.
- `rowState` is computed in the session and published as its own atom (`rowStatesAtom`) keyed by id: the
  plan says derived, never persisted; the row (P8) reads it beside the journal.
- The payer's refusal sentence is the canvas's `ClaimNoEth` line ("Rabby has no Sepolia ETH for the gas.")
  with the connector's name and the chain's; the deposit sheet's amount is typed, so it reads on the click
  only, the held-action sheet on open and on the click (the brief's "re-read on the Claim click").
- The e2e retirement uses the node's `aztecDebug_warpL2TimeAtLeastBy` (3 700 s) rather than anvil's cheat
  codes directly: the rig's own warp, so the L2 clock follows and nothing pending is left unproven (everything
  was settled before the deposits).

## Gate (2026-09-16)

| layer | result |
|---|---|
| lint, lint:shell, typechecks (web-miner, site, web-stats, web-landing) | clean |
| `bun test packages/bridge packages/web-miner` | 228 pass, 3 skip |
| `test:components` (web-miner 109, web-stats 84) | green |
| `bun run e2e:agent -- bun test packages/bridge` | 35 pass |
| `bridge` shard, proverless | 1/1 (3.4 min) |
| `proofs.test.ts` against Sepolia (`YACANA_SEPOLIA_RPC_URL`, the record's public RPC) | a real event: checkpoint 77 362 at block 11 716 587 |

Two findings on the way:

- The isolated network never emits `L2ProofVerified`: its synthetic prove (`settleEpochOutbox`) writes the
  outbox roots and the proven tip by cheat code, never `submitEpochRootProof`. The plan's "live proof-event case"
  therefore asserts the reader's true negative (`none`) off a real anvil after a prove, and the recorded fixture
  (`fixtures/l2-proof-verified.json`) is a real Sepolia log read through the reader; the opt-in Sepolia case
  reads a fresh one. Nothing in the e2e ever shows a proof time on the isolated network: P10's chip will read
  "no proof yet" there, by design.
- The first shard run collided with three-day-old orphans of the deleted `yacana-bridge` worktree (a Presto, a
  Vite preview, a node proxy and a control server on 24988–24993, plus a rig preview on 30040 and a Presto on
  11693; pgids 1447018, 1525114, 1526187, 1526226, 1526235, 1795166). Their `kill -TERM -<pgid>` was refused by
  the session's permission classifier; the rerun's fresh run id hashed to another window. **For the owner:**
  reap them by pgid.
