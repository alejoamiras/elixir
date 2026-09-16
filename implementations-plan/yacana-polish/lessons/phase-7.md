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
  overlap re-read (12 blocks) behind a known event, and a forward walk from there that keeps its progress
  (`scannedTo`) across refreshes; `'unknown'` while incomplete, `'none'` only at a floor that is exact, else
  `{at, checkpoint, block}` with `at` the event block's timestamp. `ProofScan.floor` answers `{block, exact}`:
  the session gives the Registry's canonical block for this version (exact), or the portal's deploy block as a
  bound alone (a proof may predate the portal), which can find an event but never prove an absence.
- `journal.ts`: `Crossing.expiresAt` (unix s) and `anchorBlock`; `RowState`, `rowState(c, {sourceTipAt,
  covered})` (`unfinished` needs the expiry, the anchor block, coverage, and a tip past the expiry; anything
  short is `checking`; a hash or any other state reads as the state).
- `wallet.ts`: `sendObserver()` — every send observed synchronously (`SentTx` gains `anchorBlock`), plus a
  one-shot `beforeNextSend(hook)` that runs before `target.sendTx` and refuses the send if it rejects; no hook,
  no extra tick (the mining claim's path is unchanged). `OpenedWallet.beforeNextSend` rides on `Deployment`
  (`chain.ts`, `boot.ts`) to the bridge's `L2Handles`; `flows.ts`'s `sendRecorded` installs it around the
  send and commits the hash, expiry and anchor block to the journal first.
- `facts.ts`: `DEPOSIT_GIVES_UP_MS` gone. A proving deposit with a hash asks its receipt (`FactReads.l1Tx` →
  `L1Receipt`: the `Deposited` log the portal emitted for this version, amount and derived secret hash →
  `deposited`; a failed receipt → `dropped`; `undefined` for "the RPC has no such receipt"; `'unreadable'` for
  a read that did not answer or answered with someone else's event). Without a receipt it is measured against
  Ethereum's clock and its calldata deadline (`expiresAt`, persisted by `deposit()` at creation) → `dropped`
  past it, but only on a definite absence: an unreadable receipt leaves the record where it is however late.
  The device's clock is out.
- `revert.ts`: `revertNameOf(e)` and `revertRow(e)` — the brief's three names (`WaitsForHeadroom`,
  `VersionPaused`, `DeadlinePassed`) map to the row states `headroom` / `paused` / `closed`, and
  `copy.ts`'s `revertLine` renders that row's own sentence through `cardLine`. `recovery.ts`: the file carries
  `expiresAt`/`anchorBlock`, `asHint` strips both on every state.
- `bridge/session.ts`: the view carries `deadline` (`readDeadline` at every refresh, the floor from `policy()`
  once), `targetRegisteredAt` (cached once seen), `proof` (best effort, kept from the last refresh when
  unread); `rowStatesAtom` published per refresh (the node's tip sampled before the readings; `covered` = the
  node serves the crossing's own version, the deployment check passed and `getBlockData(anchorBlock)` answers;
  a reading that failed publishes no tip, so the row stays `checking`); `payerFunds(account, ask)` prices the
  two calls that carry no signature — a deposit and an exit's claim — through `eth-balance.ts` (new:
  `getBalance`, `estimateGas`, `estimateFeesPerGas`; unknown is null, never zero; a verdict needs both
  numbers). The standing behind the deadline is read at one pinned L1 block, and that block's timestamp is
  `l1Now`.
- `copy.ts`: `takingLong(c, now, targetRegisteredAt)` counts from the later of held-at and the target's
  registration, never before it; `TakingLongDialog` passes the view's value (the dialog itself goes at P8).
- `DepositSheet.tsx`: both sheets read the payer's funds (the exit-claim sheet on open and on the click, the
  deposit on the click; a reading overtaken by a newer one is dropped) and refuse with "<wallet> has no
  <chain> ETH for the gas." plus `ClaimNoEth`'s "Add some to 0x…, then claim. The YACA waits for you."
  before the wallet is asked; a portal refusal is shown in the row's own words before the raw first line.
- `bridge-states.e2e.ts`: the unanswered prompt → reload → "Waiting for your Ethereum wallet" → an L2 warp
  past the deposit's deadline retires it without a tap → deposit again → the page reloads the moment the
  wallet has been asked → the row settles to `deposited` on its own → claim as before. Which reading settles
  it is the race's: the receipt when the hash reached the journal before the reload, the portal's event
  otherwise (the fixture counts the wallet before it broadcasts, and the receipt comes over the page's own RPC,
  which the fixture cannot hold) — the spec proves that one of them does, unattended, not which. The title and
  the inventory are unchanged.
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
- The payer's refusal is the canvas's `ClaimNoEth` note verbatim — the title with the connector's name and
  the chain's, then "Add some to 0x…, then claim. The YACA waits for you." over the payer's own address (the
  board's `0x90F7…b906` is the connected wallet there, and the wallet is what needs the ETH). The deposit
  sheet's amount is typed, so it reads on the click only; the exit-claim sheet reads on open and on the click
  (the brief's "re-read on the Claim click").
- A send-ahead's forward and its redeem are not priced at all: the portal takes either from anyone carrying
  the redeem key's signature, so making one to fill in an estimate would hand the RPC the authority to act
  before the holder chose. Their cost stays unknown and the wallet's own estimate is the first word. §9.3.8's
  "unknown ≠ zero" is what covers it.
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

## Arc-4 codex fix loop (§10 steps 2–3)

### Round 1 — `/codex high` (GPT-6 Astra, `high`, read-only), verdict **REVISE**, 14 findings

Prompt: `scratchpad/codex-arc4-round1.md` over `git diff polish-mine...HEAD` (37 files, one commit `ae07e20`),
both verbatim rules. Its own verification: 26 passed, 2 skipped. Three load-bearing claims verified against the
SDK and the repo before anything was applied:

| claim | verdict |
|---|---|
| Aztec 5.2.0 reports an unknown tx hash as **dropped** (`node_tx_receipt.js`: "if we don't know the tx, we consider it dropped") | true — a refresh between the journal commit and the node accepting the send would have made the record terminal |
| `Controller.pause()` deliberately lets a claim in flight finish | true — `pause` only dispatches `stop` from `mining`; `drain()` was the only thing that waited for `claiming` |
| `TimestampTxValidator` measures `expirationTimestamp` against the block being built | true — the L2 block timestamp is the expiry's clock, so `sourceTipAt` is the right one |

Applied, in its numbering:

1. **#1 high** — `payerCall` no longer signs anything. `PayerAsk` is `deposit | claim`; a send-ahead's forward
   and its redeem are unpriced (above).
2. **#2 high** — `MinerController.claimSettled()` extracted from `drain()`'s wait, and `guarded()` awaits it
   through a new `BridgeContext.settled` after `pause('bridge')`: the bridge's one-shot hook can no longer
   capture a mining claim's send.
3. **#3 high** — a `dropped` receipt is only terminal once the node's tip is past the send's `expiresAt`
   (`pastExpiry`); before that the reading returns undefined and the record waits.
4. **#4 high** — the tip is sampled **before** the readings; `reread` reports `answered | failed` and a failed
   reading publishes `sourceTipAt: null`; `covers()` also requires `servesVersion(c)`. `hashless(c)` moved to
   `journal.ts` so `rowState` and the session share one predicate.
5. **#5 high** — `L1Receipt` distinguishes "no such receipt" from `'unreadable'`; only a definite absence plus
   a passed deadline gives a deposit up.
6. **#6 medium** — the `Deposited` log must be the portal's own, for this version and amount, under the secret
   hash the index derives; anything else is `'unreadable'`.
7. **#7 medium** — reproduced and fixed: a known proof at block 900 with the head at 60 000 and a newer proof
   at 59 000 stopped at 40 887 and returned the old proof forever. Both walks now keep their progress
   (`scannedTo`, `searchedFrom`), and blocks that appeared above a walk in flight are read first.
8. **#8 medium** — `ProofFloor {block, exact}`: the portal's deploy block is a bound, not a birth, so
   exhausting it is `'unknown'`, never `'none'`. A floor above the head is `'unknown'` too.
9. **#9 medium** — `portalReader.standing(version, at?)` pins every read to one block; the refresh reads that
   block once and uses its timestamp as `l1Now`.
10. **#10 medium** — the canonical target's registration is read even when it equals this build's version, and
    a previous value is carried over only while the canonical version is the same one.
11. **#11 medium** — the payer-funds effect keeps a request counter: a reading overtaken by a newer one
    (another account, another row, another action) no longer writes.
12. **#12 medium** — accepted in full: the sixteen invented sentences are gone. Only the brief's three names
    map to row states, the row's own sentence is rendered through `cardLine`, and the sheet carries
    `ClaimNoEth`'s supporting line. §5.4's exact wording arrives with `rowLine` at P8, in one place.
13. **#13 medium** — accepted as a claim, not as machinery: the reload's comment and this file now say the
    settlement may come from the receipt **or** the landing scan, because the page's own RPC (where the
    receipt comes from) is not the injected wallet and this fixture cannot hold it. Adding an RPC proxy to
    force the receipt-only path is more machinery than the finding is worth.
14. **#14 low** — the file heads of `exit-deadline.ts`, `proofs.ts`, `eth-balance.ts` and the `sendRecorded`
    doc compressed; the hook's exclusivity and coverage's honest-node assumption are now written down where
    they hold.

Not accepted:

- **#4's "add session-level tests"** — `BridgeSession` needs IndexedDB, a jotai store and Vite's `import.meta.env`;
  there is no harness for it and building one is the layer the no-over-engineering rule forbids. The path is
  covered by `rowState`'s unit cases, `bridge-facts`'s readings and the `bridge` shard's live run.

New tests: `payer-funds.bun.test.ts` (both numbers, either reading failing alone, no call to price),
`bridge-facts` gains the unreadable-receipt case, `proofs.test.ts` was rewritten around `ProofFloor` with
codex's two reproductions as cases, `revert.test.ts` follows `revertRow`.

Two more of my own, found while fixing #7:

- #7 asked to "clamp/reset cursors when the head retreats" and I had only clamped `cursor`. `scannedTo` and
  `searchedFrom` are clamped too now (`clampTo`): left above a retreated head, the forward walk would read
  nothing until the chain grew back past them.
- With the clamp in place, `confirm()` asked for an **inverted** block range (`fromBlock` above `toBlock`) when
  the head fell below the known event — a real RPC refuses that, so the reading would have thrown and the view
  kept its stale proof. `confirm` now treats a head below the event as the reorg it is, and the test fake
  throws on an inverted range so the suite cannot hide that class again.

Found on the way, unrelated to the findings: `switch.bun.test.ts` left six `MinerController`s undisposed, so
their 10 s poll fired into whatever file bun ran next (five "Unhandled error between tests" once the suite grew
by a couple of seconds). They are now disposed in an `afterEach`.

### Round 1's gate

| layer | result |
|---|---|
| `bun run lint` · root `typecheck` · web-miner `typecheck` | clean |
| `bun test packages/bridge packages/web-miner` | 233 pass, 3 skip, 0 fail, 0 errors |
| `test:components` (ui 68, web-landing 14, web-miner 109, web-stats 84) | green |
| `bun run e2e:agent -- bun test packages/bridge` | 38 pass, 1 skip |
| `bridge` shard, proverless | 1/1 (138.9 s) |

### Round 2 — resumed, verdict **REVISE**, 9 findings

Prompt: `scratchpad/codex-arc4-round2.md` over `git diff HEAD~1` (the round-1 commit `7099739`), the same two
rules, the same session. Its own verification: 25 passed, 2 skipped. Four of the nine it reproduced. Every
one was a real defect; all nine are applied.

The proof scan took six of them (#3, #4, #5, #6 plus round 1's #7 and #8), and patching them one by one was
not going to hold, because they were all the same missing invariant: the reader would report an event it had
found while blocks above it were still unread. `proofs.ts` is now written around an explicit `ScanState` —
`scannedTo` (the highest block read, so `(scannedTo, head]` is unread), `complete` (the whole floor-to-frontier
range has been read, which is the only thing that makes `known` its *newest* event), `cursor` (an unfinished
downward walk's next bound) — with the module-level `confirm`, `forward`, `walkDown` and `answer` taking it.
`answer()` is the contract: an event only when `complete && scannedTo >= head`, `unknown` otherwise. What that
fixed, in codex's numbering:

- **#3** `catchUp()` set `searchedFrom = head` after reading only part of the way there, so `take()` then
  marked never-read blocks as searched and a proof above them could be skipped for good. Reproduced. There is
  no `catchUp` any more: a downward walk finishes before the frontier is followed, so nothing unread is ever
  claimed as read, and one budget is shared between the confirm and the pass that follows it.
- **#4** a reorg that took the known event while an *older* one survived in the overlap left `known` in place,
  and the reader went on reporting a block that no longer existed. Reproduced. `confirm` now treats an overlap
  whose newest event is older than the known one as the reorg it is.
- **#5** a short reorg could put a newer proof just below the frontier, where neither the overlap around the
  known event nor a forward pass starting above the frontier would ever read it. Reproduced. The forward pass
  always starts `overlap` blocks behind the frontier, and runs even when the frontier is already at the head.
- **#6** the reader answered a stale event while newer blocks were unread — "V5 proved an epoch 3 h ago" when
  it might have proved two minutes ago. That is the finding that set the invariant above. The cost is that a
  first scan of a long chain says "checking" for a few refreshes, which is what the chip is for.

The rest:

- **#1 high** — the clock was read *after* the negative receipt on both chains, so a send included in between
  read as dropped. `reads.tx` now reads the tip and the node's reach first (`Promise.all`), then the receipt;
  `depositFacts` reads Ethereum's clock before `l1Tx`. Both clocks are held for one window (`CLOCK_MS`), so a
  refresh judges every deadline by one sample taken before the readings it judges.
- **#2 high** — a hashed send's negative rested on the expiry alone, so an honest replacement node with a late
  tip but no history of the send could end a crossing that had landed. `covers()`'s test is now
  `servesHistory(c)` and `reads.tx` requires it too; `pastExpiry` without a recorded expiry is no longer
  "past" but "no evidence", so such a record waits instead of being given up.
- **#7 medium** — the request ticket guarded `setFunds` but not the click: an overtaken reading still returned
  its refusal to `go()`, and an obsolete success could carry on into a submission for a payer whose funds were
  never checked. `readFunds` returns `'stale'` and the click abandons.
- **#8 medium** — codex was right that I dismissed the seam too fast: `Object.create(BridgeSession.prototype)`
  with fake dependencies runs the real `factReads()` under bun, no IndexedDB and no Vite env.
  `tests/bridge-reads.bun.test.ts` uses it for exactly what no pure function can show — that the tip and the
  node's reach are asked *before* the receipt, and what each answer is and is not worth.
- **#9 low** — the orphaned revert doc-comment left annotating `flippedAway` is gone, and `depositFacts`'s
  paragraph no longer implies protection from a lying RPC: a dishonest "no such receipt" is indistinguishable
  from an honest empty node, and that honest-endpoint assumption is now stated where the reading rests on it.

Codex's "looks fine" this round: the estimate-time signatures are gone, `claimSettled()` introduces no queue
cycle, hashless rows sample the tip before the reads and distinguish a failed query, the receipt-log identity
checks and the exact-versus-guessed floor are sound, rendering a temporary row state for a revert mutates
nothing, and the narrowed e2e claim is reasonable with no RPC proxy needed.
