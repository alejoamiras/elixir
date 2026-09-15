# Fable audit — yacana-polish plan (2026-09-15)

Fable 5.1, read-only, every citation checked at fb3a54c.

## Findings

### High

1. **§3.2 `reserve()` (l.144), §3.3 "Log in", §3.5 "The single slot" — the empty-slot login does not exist.** `reserve('login')` throws "when none [holds the slot]", and the only login described is `allowCredentials` restricted to the slot's credential. The brief's Log in is the new-device path (§5.1: "Log in is offered only when nothing is stored"; a discoverable passkey or the words makes the record — `session.ts:351-372`, `words.e2e.ts:56-62`, `bridge.e2e.ts:61`). The interface cannot put a record on an empty slot except by `create`. Fix: three intents — `create` and `login` need the slot EMPTY (`stage` under the empty revision, `commit` after the opening); `open` (Welcome back) needs it HELD, `allowCredentials` = its credential, no stage. A master differing from a held slot stays refused.

2. **§7 "every arc reverts cleanly" vs §3.2 "an empty slot has a revision too".** `store.ts:41-49` opens `yacana-keys` at version 1; a new object store means version 2, and every build without the slot then fails `indexedDB.open(DB_NAME, 1)` with `VersionError`: the vault unreadable until site data is cleared. That is what reverting arc 2, or a rollback deploy after it, would do. Fix: the revision is a key in the existing `device` store (`store.ts:38`), read and written in one `db.transaction([RECORDS, DEVICE], 'readwrite')`; `withStore` (`store.ts:60`) takes one store, so the CAS primitive belongs in `store.ts`, `slot.ts` keeps the policy. Write "version stays 1" into §7.

### Medium

3. **§3.2 `NodeStanding` `'unknown'` (l.139-140), §3.5, Ask 2 — a state with no board.** The canvas NodeStates board draws `healthy`, `throttled`, `no answer · 2 min`, `behind · 4 min` and nothing else; "copy verbatim" leaves `unknown` without a chip. §3.2 also says both "healthy = … ∧ not behind" and "l1 null → unknown", and P6's pass criterion "`healthy` needs a fresh tip" is false under the L1 anchor when the L1 sample is missing. And `4 min` is an age while the verdict is a checkpoint delta. Fix: decide and write: `unknown` renders as `healthy` (line 3's age is the honest information) or a board is added; the chip's minutes are the tip's age when the delta says behind.

4. **§3.5 `proofs.ts` — the helper cannot find "latest".** `scanLogs` walks forward from `fromBlock` in 10,000-block windows and `first` stops at the FIRST match (`logs.ts:31-47`). The latest event means a walk from `deployBlock` to head on every fresh visitor (a months-old Sepolia deployment = dozens of `eth_getLogs`, the 429 the plan's own `throttled` state exists for). Fix: scan backward from head, stop at the first non-empty window (a proof lands every ~40 min ≈ 200 blocks); a `direction` on `scanLogs` or a sibling; the overlap cursor stays.

5. **§3.3/§3.5 `unfinished` needs `historyComplete`; nothing computes it.** `rowState` takes it (l.123); `txByTag` is `getPublicLogsByTags` (`bridge/session.ts:189-192`), which returns empty for "no log" and for "not synced" alike. Undefined, the row is `checking` forever (§9.1.10 under a new word) or `unfinished` on missing evidence — a double burn after "Bridge again". Fix: name the read (the node's tips vs the send's window; or: the URL the send went through, tip past `expiresAt`, still no log one refresh later) and add the never-true case to P7's tests.

6. **§3.3 D29 — the async observer sits on the claim path.** The same wallet's `sendTx` carries every mining claim (`wallet.ts:47-59`; `lastSent()` feeds the claim TTL). An awaited journal commit and "a storage failure refuses the submission" would delay or drop claims for a bridge's sake. Fix: the flow installs a one-shot hook before its send; the observer awaits only when one is installed; claims stay synchronous.

7. **§6 D15 — the rig first sees the new dialog at P10.** `bridge.e2e.ts:41-61` and `origin.e2e.ts:22-40` drive `key-screen`, `use-words`, `restore-words`, `create-passkey`, `bootPage`; P2 rewrites all of them. Eight phases of drift on the two specs with the highest floors (`RIG_ONLY` 5+1). Fix: `bun run rig -- origin` (nothing proved) at the arc-2 boundary.

8. **§6 P2 vs `words.e2e.ts:66-101`.** The spec's second half creates a second account over the first (`create-new-key`, l.72) and asserts Welcome back with two records; under the slot a second create is refused, the scenario vanishes, and Ask 3's legacy rule has no test. Fix: P2 re-plots it (sign out → create → the backup gate → Welcome back with one) and seeds two records in IDB directly for the legacy rule's vitest.

9. **§8 D2 amends brief §5.1 silently.** The brief: "the stored record is replaced only after the new account has opened"; D2 rejects that ("release only by Sign out") and §9 lists no amendment. Today Sign out deletes the record (`session.ts:443-448`); `release` "empties the slot" — say whether it deletes. Fix: either retain the old record unlisted until `commit` (cheap: the slot already distinguishes listed from stored) or mark the brief amended at P2.

### Low

10. §3.2: `ActivityRowProps` and `RowLine` are one shape twice. `RowLine` into ui's `bridge-types.ts`; `ActivityRowProps = RowLine & { id, amount, … }`.
11. `deadline-reading.ts` reads as a variant of `deadline.ts` (the proof deadline): `exit-deadline.ts`.
12. §6 P6 `states` (behind): one node on the isolated network; produce `behind` with `page.route` on the Ethereum RPC answering `getPendingCheckpointNumber` = tip + 3 (`states.e2e.ts:16`'s pattern).
13. §4 the ETH balance: a stale user-RPC read disables the claim button; re-read on the click, the wallet's own error wins.
14. §3.4 deletes `journal-card.tsx` at P9; P8 says "`JournalCard` gone". One phase.
15. §3.1 l.69 and §3.5 l.250 still say create "already fails closed with `excludeCredentials`"; §5 says the opposite, and exclusions only stop the same authenticator (`session.ts:295-320` stores whatever a second one makes).

## Assumption attack (§5)

**Facts.** Every cited line holds (off by one at most: `restoreWithPasskey` 351-372; the `<=` at `YacanaPortal.sol:276`). `CheckpointTag` is `'checkpointed' | 'proven' | 'finalized'` (`chain_tips.d.ts:9`). `MasterRecord` (`store.ts:13-35`) carries `createdAt` only: "last opened unknowable" holds. The stale "create fails closed" survives only in §3 (finding 15).

**Inferences.** "The tip at no extra request": the tick's `probeNode` already reads the latest block (`node.ts:50-63`), but `getCheckpointNumber` is one more call — mislabelled, cheap. "Public RPCs accept the windows": the risk is the count (finding 4). `Brand` on the landing: `Bar.tsx:1-3` imports ui, copy, state only — safe. "> 1 checkpoint": one per L1 slot, so ≥ 2 ≈ 72 s+, and an idle local network posts none — the e2e claim holds.

**Asks.** Ask 2 is a decision the owner cannot judge in checkpoints: decide it; surface `unknown`'s rendering instead (3). Ask 3: newest-created is the only knowable rule — decide it. Ask 6: cost in hours, not "triples". Missing: finding 9. Asks 1, 4, 5 are real picks.

## Brief vs code

The L1-anchored `behind` is right (an age flaps an idle network) but incomplete without `unknown`'s chip and the number rule (3). `other` staying paused is right: `execute('mine')` rotates the secret (`controller.ts:477-481`). `closed = l1Now > deadline` matches `YacanaPortal.sol:276`. The slot's login side follows the brief's intent while the interface refuses the brief's own Log in (1). `takingLong` from `VersionRegistered` is §9.1.12 verbatim (`YacanaPortal.sol:111`). Sign out's release amends §5.1 unrecorded (9). `behind · 4 min` and `didn't finish` the code can honour only with the definitions 3 and 5 ask for.

## Verdict

**REVISE** — fix 1 and 2 (the empty-slot `login` intent; the slot revision in the `device` store at DB version 1, the CAS in `store.ts`), and write 3, 4, 5, 6 into §3 (the `unknown` chip rule; a backward proof scan; a named `historyComplete` read; the observer's one-shot hook); then APPROVE.
