# Phase 12 — The sweep (arc 7, `polish-presto-tx`)

## The copy (2026-09-17)

The announcement line on the landing (`copy.ts`) and the stats (`Announcement.tsx`) says "Mining on V5 ends
when the upgrade lands" (was "ends at the upgrade": a schedule claim; the old version keeps proving for a
while). Their Vitest specs follow. Commit `cde9066`.

The copy-deck check as the plan words it — one module per feature, a spec against the generator's table — is
what every phase's Vitest spec did for its screens (the strings live in `bridge/copy.ts`, `claim-copy.ts`,
`presto.ts` `PROVING`, the landing's `copy.ts`); the deck's "after" strings are grepped in the built bundles as
the last smoke (step 7 below).

## The sweep record

Every command once on the stack's top, in the plan's order; long runs in tmux through `bun run e2e:agent`,
one at a time.

### 1. fast (`cde9066`)

| command | result |
|---|---|
| `bun run lint` · `lint:shell` · `lint:actions` | clean |
| `bun run typecheck` · web-miner · web-stats · web-landing · site (`tsc -b` / `tsc -p`) · ui | clean |
| `bun test` | 499 pass · 42 skip · 0 fail (112 files) |
| `bun run test:components` | ui 69 · web-miner 119 · web-stats 84 · web-landing 14 |

### 2. the chains' own suites

| command | result |
|---|---|
| `bun run portal:test` | 4 suites, 74 tests passed (forward, redeem, deposit, retire, the deadline floor) |
| `contracts:test` | not run: `packages/contracts` is untouched on the stack (`git diff main...HEAD --stat -- packages/contracts` empty) |

### 3. the miner

**Every spec, real proving, the headless Presto beside it** (`bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e`, 20.3 min, 21/21):

| spec | executed titles |
|---|---|
| `bridge-states.e2e.ts` | the bridge through the page: an exit forwarded and minted; a deposit through the picker on the wrong chain, rejected, then confirmed and claimed |
| `canary.e2e.ts` | a claim with a bound public input altered is refused at proving before it is sent; restored, the same claim mints |
| `miner.e2e.ts` | first visit creates an account, mines at the easy target, claims and shows the balance · a poisoned CRS cache is purged before proving · three power changes keep mining, the ledger grows, memory stays bounded · a prover crash surfaces as an error and mining restarts on the next start · the pop-out draws with the page fonts and its own loop |
| `opening.e2e.ts` | page first; a cancel mid-opening forgets the intent, a Start mining that opens the account spends it |
| `passkey.e2e.ts` | a passkey account: create, mine, claim, reload with one touch, the balance follows the account · a known account whose passkey is gone does not open; the record stays |
| `presto.e2e.ts` | through Presto: the pill says ✦ presto after the first native proof, and power is Presto’s · a win Presto proved is verified in the browser before it shows, then claimed through Presto too; both proofs went over the wire · Presto gone mid-proof: the claim’s transmit fails, the browser finishes it, nothing is sent twice · nothing answers: the billboard invites the install and the browser proves without the suffix |
| `states.e2e.ts` | the node going away pauses mining after a minute; its return resumes it · a lost race: the claim reverts, the chain view is rebuilt, the next claim mints, the balance survives · a node behind the rollup on L1 pauses mining; its catching up resumes it |
| `switch.e2e.ts` | a live switch A → B while mining, a claim after it, and the banner on a dead node · another deployment’s node, or one that does not answer, is refused under the field; the node in use is kept |
| `withdraw.e2e.ts` | withdraw: private to a second key on this device, public to an address |
| `words.e2e.ts` | a words account: create, quiz, mine, sign out, restore, same address |

Breakdown (`p12-miner-all-breakdown.json`, kept in the scratchpad): rig 99.0 s (8.1 %), browser transaction
proving 253.4 s (22.7 % of test time), 2 proofs through Presto (11.5 s: the Presto spec's claim and the
switch spec's), submission round trips 18.9 s.

**As CI runs it**:

| shard | result |
|---|---|
| `E2E_PROVERLESS=1 E2E_SHARD=cockpit` | 7/7 (miner, passkey), the inventory executed, 5.4 min |
| `E2E_PROVERLESS=1 E2E_SHARD=chain` | first run 6/9: the two P11 Presto cases asserted the wire on a build that proves nothing (fixed: `c536928`, the assertions follow `window.yacana.proverless`), and the lost race read 5 nullifiers on its first claim where 4 are expected (2 notes, the ticket among them; CI's proverless chain shard on the same commit read 4, as did three proving runs today) — rerun below |
| `E2E_PROVERLESS=1 E2E_SHARD=bridge` | 1/1, 3.9 min |
| `E2E_SHARD=canary` | 4/4 (canary, opening, withdraw, words), 5.5 min |
| `E2E_PROVERLESS=1 E2E_SHARD=chain` rerun (`c536928`) | 9/9, the inventory executed, 7.2 min; the lost race's first claim read 4 nullifiers |
| `bun run --cwd packages/web-miner test:replay` | 4/4 on the recording of 2026-09-15 (the account screens fit the dialog at 720 px · a malformed RPC payload is rejected · an old Presto answers: the update row, and Retry re-asks · the public epoch poll reads again from the recording), 42 s; no re-record: the dialog's geometry and the signed-out page changed in words and bindings the recording does not carry (P9's lane passed on it too) |

### 4. the rig, every case (`bun run rig -- all`, 22.5 min, 13 pass across 8 files)

bun prints no per-case titles outside a TTY; the titles below are the files' (`describe › test`), the count
is the run's. CI's rig job (below) prints them and is the second reading.

| case | executed title |
|---|---|
| `flip` | the flip alone (H0) › V5 → V6 → V7: each flip lands in the Registry and a pinned node settles on the new version |
| `bridge` | the bridge on one version › H1: an exit to Ethereum mints YACA there once; the counters and the supply agree · H6: with no later version registered, a send-ahead is redeemed by its key at once · H9: a pause holds exits and the budget is charged; pauseAll covers every version · H10: an exit from a miner the portal never registered cannot be consumed |
| `deposit` | a deposit from Ethereum (H2) › a deposit lands on the version it named and is claimed to an address chosen at claim time |
| `migration` | the migration V5 → V6 › H3 · H4 · H6 · H11: the whole migration |
| `skip-version` | a skipped version (H7) › V5 → V6 → V7 with V6 unregistered: the send-ahead lands on V7, the deadline follows V7 |
| `never-settled` | a send-ahead that never settles (H5) › the prune leaves nothing to consume on Ethereum, rewinds the tip, and the version comes back |
| `browser` | the migration through the page › on V5: mine, exit, deposit, send ahead twice, save the recovery file — through the page (`bridge.e2e.ts` "on V5: a words account mines one claim, exits to Ethereum (forwarded and minted), deposits through the picker and claims, and sends ahead twice", 3.2 min) · the flip: V5 retired on Ethereum and on its own chain; the page says mining has ended (`bridge.e2e.ts` "on V5 after the flip: the migration card says mining has ended and what is left can still be sent ahead", 11.4 s) · on V6: restore, the recovery file, the holder’s own forward and claim, the redeem — through the page (`bridge.e2e.ts` "on V6: the same words restore the account, the recovery file brings the held send-aheads, one is forwarded from the page with the holder’s signature and claimed, the other redeemed to Ethereum", 1.2 min) |
| `origin` | the versioned origin › one passkey across the apex and the versioned origin: the same account, restored, never created (`origin.e2e.ts` "the versioned origin: the same passkey restores the apex’s account there, creates nothing, and mines nothing", 20.6 s) |

### 5. the read-only apps and the site

| command | result |
|---|---|
| `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e` | 7/7 (the captured history through a mocked node · a slow node: every tile as its skeleton at 400 ms, fills in two beats · the map from 31 epochs, the paging, a ?from= link · a deep link selects an epoch; the calculator · live on the isolated deployment: epoch 0, ?epoch=0, Verify matches the run · the bridge page: this version registered and live on the portal, its turnstile, the keys; Verify names the portal · the header), 1.3 min |
| `bun run --cwd packages/web-stats test:visual` | 8/8: the observatory and the bridge page at 1280, 1440, 1024, 390 against the pinned baselines (no regeneration needed) |
| `bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e` | 5/5 (the argument in order, the hero tile from the chain · a recorded claim's ledger · /faq: six panels, the questions, the rules · a phone reads, shares the miner link and mines nothing · the bar), 44 s; the demo proof is the hero's |
| `bun run site:build` · `YACANA_APP_ROLE=old bun run site:build` | both assembled under the production guards (5 s each) |
| `bun run e2e:agent -- bun run site:e2e` | first run 2/3: "the versioned origin" asserted the old origin's "Mining has ended on this version", P10's page says "Send what’s still here ahead." (`origin.e2e.ts` already did; the arc-6 gate did not run `site:e2e`) — ported; rerun 3/3 (one origin, three apps: every path serves its app under the same headers; build.json says e2e · the versioned origin: the old role under the same headers, restore only, and an open tab learns it is behind · the landing serves no prover; the miner still does), 1.5 min |

### 7. the copy-deck grep

Sixty "after" strings of the deck (`canvas/boards_meta.py` `DECK`, the literal sentences of every row, plus
the announcement's new words) grepped in the assembled site's 173 bundles (`dist` and `dist-old`), straight
or curly apostrophes: **60/60**. Four are interpolated or JSX-split in the source and were matched on their
static part (`minted in{' '}<block>`, `wallet on ${chain}`, `Nothing was ${done}; the YACA is still yours
to ${verb}`, `The ${FLOOR_DAYS} days are over`). The script is the session's (`p12-copy-deck.ts` in the
scratchpad); not committed — the deck is a design artifact, the specs are the check that lasts.

### 6. CI (`e2e.yml` dispatched on the stack's top)

| run | commit | result |
|---|---|---|
| 35234562232 | `cde9066` | shards (cockpit, bridge, canary, the whole suite), stats, landing green; **chain** red on the two P11 Presto cases (the wire asserted on a proverless build); **rig** red: every `browser` and `origin` case died at `browserType.launch` — the rig job never installed Chromium, and `e2e.yml` had not been dispatched since the two page-driven cases joined the harness (2026-09-14; its last run was 2026-09-10) |
| 35239712748 | `c536928` | every miner shard, the whole suite, stats, landing green; the rig's 12 headless and browser cases green; **origin** red: `net::ERR_CONNECTION_REFUSED` on `https://yacana.test:<port>` — the preview bound `localhost` (IPv6 on the runner) while Chromium's resolver rule sends the test domains to 127.0.0.1 (`waitUntilUp` already knew the two families can differ) |
| 35244577323 | `e214e27` | **green**: the four shards, the whole suite, stats, landing, and the rig's 13 cases (the origin case 1.5 s to the page, restored) |

## The journeys

| journey | proven by (executed title, from the record above) |
|---|---|
| create an account with a passkey · mine · claim · the balance · reload with one touch | `passkey.e2e.ts` "a passkey account: create, mine, claim, reload with one touch, the balance follows the account"; `miner.e2e.ts` "first visit creates an account, mines at the easy target, claims and shows the balance" |
| create with words · the quiz · mine · sign out (the hold) · restore with the words · the same address | `words.e2e.ts` "a words account: create, quiz, mine, sign out, restore, same address" |
| sign out, then Welcome back and open on this device; log in on a new device; create refused over a held slot | `passkey.e2e.ts` "a passkey account: create, mine, claim, reload with one touch, the balance follows the account" (the second visit: Welcome back, one touch, no Create or Log in offered) and "a known account whose passkey is gone does not open; the record stays"; `words.e2e.ts` "a words account: create, quiz, mine, sign out, restore, same address" (Create not offered while an account is stored; Use a different account goes through Sign out); the new device is the rig's V6 stage, a fresh browser profile: `bridge.e2e.ts` "on V6: the same words restore the account, …" |
| cancel mid-opening; the account opens on the next try | `opening.e2e.ts` "page first; a cancel mid-opening forgets the intent, a Start mining that opens the account spends it" |
| bridge out: exit → forwarded → minted on Ethereum · bridge in: a deposit through the picker | `bridge-states.e2e.ts` "the bridge through the page: an exit forwarded and minted; a deposit through the picker on the wrong chain, rejected, then confirmed and claimed"; rig `browser` → `bridge.e2e.ts` "on V5: a words account mines one claim, exits to Ethereum (forwarded and minted), deposits through the picker and claims, and sends ahead twice" |
| forward (the operator's script, the witness archive) | rig `bridge` "H1: an exit to Ethereum mints YACA there once; the counters and the supply agree" · "H6: with no later version registered, a send-ahead is redeemed by its key at once" · "H9: a pause holds exits and the budget is charged; pauseAll covers every version" · "H10: an exit from a miner the portal never registered cannot be consumed"; `bridge.e2e.ts` "on V5: … (forwarded and minted) …" |
| send ahead before the flip · the flip · the same words on V6 · the recovery file · a held send-ahead forwarded on V6 | rig `browser` → `bridge.e2e.ts` "on V5: … sends ahead twice" · "on V5 after the flip: the migration card says mining has ended and what is left can still be sent ahead" · "on V6: the same words restore the account, the recovery file brings the held send-aheads, one is forwarded from the page with the holder’s signature and claimed, the other redeemed to Ethereum" |
| the old origin: the same passkey restores the apex account, creates nothing, mines nothing | rig `origin` → `origin.e2e.ts` "the versioned origin: the same passkey restores the apex’s account there, creates nothing, and mines nothing"; `site.e2e.ts` "the versioned origin: the old role under the same headers, restore only, and an open tab learns it is behind" |
| withdraw: private to a second key on this device, public to an address | `withdraw.e2e.ts` "withdraw: private to a second key on this device, public to an address" |
| a lost race reverts, the view rebuilds, the next claim mints · the node away pauses mining, back resumes it | `states.e2e.ts` "a lost race: the claim reverts, the chain view is rebuilt, the next claim mints, the balance survives" · "the node going away pauses mining after a minute; its return resumes it" · "a node behind the rollup on L1 pauses mining; its catching up resumes it" |
| a live node switch while mining, a claim after it, the banner on a dead node | `switch.e2e.ts` "a live switch A → B while mining, a claim after it, and the banner on a dead node" · "another deployment’s node, or one that does not answer, is refused under the field; the node in use is kept" |
| Presto proves (the ✦ pill), the browser fallback, the billboard when nothing answers | `presto.e2e.ts` "through Presto: the pill says ✦ presto after the first native proof, and power is Presto’s" · "a win Presto proved is verified in the browser before it shows, then claimed through Presto too; both proofs went over the wire" · "Presto gone mid-proof: the claim’s transmit fails, the browser finishes it, nothing is sent twice" · "nothing answers: the billboard invites the install and the browser proves without the suffix" |
| a tampered claim refused at proving, the untampered one mints (real proving) | `canary.e2e.ts` "a claim with a bound public input altered is refused at proving before it is sent; restored, the same claim mints" |
| deposits, migrations, a skipped version, never settled, the flip itself | rig `deposit` "a deposit lands on the version it named and is claimed to an address chosen at claim time" · `migration` "H3 · H4 · H6 · H11: the whole migration" · `skip-version` "V5 → V6 → V7 with V6 unregistered: the send-ahead lands on V7, the deadline follows V7" · `never-settled` "the prune leaves nothing to consume on Ethereum, rewinds the tip, and the version comes back" · `flip` "V5 → V6 → V7: each flip lands in the Registry and a pinned node settles on the new version" |
| the stats (the map, the bridge page, verify), the landing's demo proof, the assembled site's paths and headers | `stats.e2e.ts` 7 titles and the visual gate's 8 (§5); `landing.e2e.ts` 5 titles; `site.e2e.ts` "one origin, three apps: every path serves its app under the same headers; build.json says e2e" · "the landing serves no prover; the miner still does" |
| the signed-out page and the dialog's geometry, no node | `test:replay` "the account screens and their notes fit the dialog at 720 px tall" · "a malformed RPC payload is rejected, not acted on" · "an old Presto answers: the update row, and Retry re-asks" · "the public epoch poll reads again from the recording, and nothing else" |

## Lessons

- **A phase's gate only covers what it runs.** Three stale assertions surfaced in this sweep from phases
  whose gates ran a subset: `states.e2e.ts` (P9 removed `minted`, found in P11's chain run), `site.e2e.ts`
  (P10 rewrote the old page, the arc-6 gate ran the rig's `origin` but not `site:e2e`), and CI's rig job
  (never dispatched since the page-driven cases joined). The sweep is where such gaps show; the fix is the
  sweep, not more per-phase gates.
- **Proverless is a build, not an env the spec sees.** A spec asserting a transaction proof's wire must
  read `window.yacana.proverless` (as `canary.e2e.ts` does) — CI runs every shard but `canary` on that
  build, and the inventory refuses a skipped title.
- **`localhost` is two addresses.** A browser resolver rule that maps a test domain to 127.0.0.1 needs a
  server bound there; `--host localhost` binds whichever family the machine resolves first (IPv6 on GitHub's
  runners).
- **The lost race read 5 nullifiers once** (1 of 6 runs today: 4 in three proving runs, CI's proverless
  shard and the local rerun). The effect carried the ticket and 2 notes as always, plus one nullifier. Not
  reproduced; the trace was cleared by the shards after it. For the owner: if it recurs, keep
  `test-results/` before the next run and read the effect's fifth nullifier against the registry's handshake
  and the account's own.

## The arc-7 codex fix loop (§10 steps 2–3, `/codex high`, GPT-6 Astra)

Session `01a0b03d-989f-70b2-b90b-8d5f72416243` on `git diff polish-upgrade...HEAD`; prompt with the arc map,
the facts, the security asks and both verbatim rules.

**Round 1** (2026-09-17): REVISE, six findings, none high; all six checked against the code and folded.
1. (medium) `txProvingAtom` cleared on `proved`/`receive` only: a `/prove` answer the SDK does not recognise
   throws after `transmit` with neither, leaving "presto" on the atom, and the next forced-local proof
   (`proving` with no `detect`) then keeps Presto's label; `proved` also arrives at the response headers,
   before the body. Fix: `TxProver.onProof('start' | 'end')` around `createChonkProof` (in a `finally`),
   the session clears the atom on both; `tx-prover.bun.test.ts` (a thrown proof ends, the next starts
   clean).
2. (medium) The `TxProver` registered no endpoints with the guard: only the probe (Start mining, Retry)
   does, so a restored account sending before mining had the SDK's `/health` blocked → WASM. Folded into 4:
   the wallet is forced local until the page's probe has seen Presto serve chonk, so the SDK never asks
   before the endpoints are registered (and the old origin, which never probes, proves in WASM as before).
3. (medium) The probe's 60 s guard deadline applied to `/prove` too: a queued or first-download proof past
   a minute was aborted while Presto kept computing. Fix: one `ACCELERATOR_DEADLINE_MS` (10 min) exported
   from `presto.ts` for the page and the Worker (the Worker had its own copy).
4. (medium) The pre-proof line read the Worker's build (`selected === 'presto'`): with Presto serving chonk
   but not UltraHonk the line said "in your browser" while the wallet posted to Presto; before any probe
   the SDK decided alone. Fix: `prestoProvesTx` = no sticky fallback ∧ the probe saw `available` ∧ chonk,
   and `bindTxProver` mirrors exactly that into `setForceLocal` — the line promises what the SDK is
   allowed. This is the plan's own design (the choice from the page's state) rather than codex's
   conditional wording; the cost is Presto only after a probe, which Start mining runs.
5. (low) The live test's garbage-body case passed on any fallback; it now also POSTs the body raw and
   asserts the server's 500.
6. (low) Comments: `tx-prover.ts`'s five-line header to two; "fallback selects WASM" (not "WASM proved");
   `useProvingWords`'s restating comment gone; the walk test's `denied` note says it is `/prove`'s answer.
   Codex's "looks fine": the transport (production `https://127.0.0.1:59834`, no query override, no
   downgrade without the flag, the CSP), the trust boundary, bad replies (the node verifies; a refused
   proof costs no nullifier or fee), the rebind, the e2e's route pattern, the inventory floors, P12's fixes.

**Round 2** (resumed, `high`): APPROVE, nothing material — the loop converges at round 2. Codex checked the
forced-until-probed rule (the probe's failures write an unavailable status, no stale success; the endpoint is
preflight's, a node switch does not move it; `invalid-proof` rightly bars the wallet too), the mid-proof
`setForceLocal` (read once at the proof's entry), and the bracket on every SDK path (`downloading`, a `/prove`
denial → fallback → WASM, a throw with no phase). Fixes committed as `2b3904d`; the real chain shard 9/9 on
them.

## The final cross-arc codex pass (§10 step 4, a fresh session on `git diff main...HEAD`)

Session `01a0b074-0f5f-7973-929e-1562343f8afe` (285 files, +23174/−6079, 77 commits); the prompt asked for
the seams between arcs, duplication across them, drift from the plan and the brief, the whole surface's
threat model, vestigial code, and both verbatim rules. Before it ran: `ClaimStatus.tsx`'s stepper and marks
(no consumer since P9) removed, the file renamed `NoticeCard.tsx` for what it holds (`fb70ce7`).

**Round 1** (2026-09-17): REVISE, eight findings (six medium, two low), all verified and folded (`ba9579b`).
1. (medium) A recovery file's `createdAt` up to `MAX_SAFE_INTEGER` passed validation and threw
   `RangeError` in the row's `stamp()` — outside every tile boundary, and persisted. `parseCrossing`
   bounds both times by the last millisecond a Date holds; the test case.
2. (medium) The upgrade card counted every K2 crossing, an earlier upgrade's arrivals included, as this
   version's "sent ahead"; and `c.state` alone, so a send never sent (`unfinished`) stayed counted. Now
   this version's sends, through `rowStatesAtom`.
3. (medium) The header chip, the Wallet tile and Settings showed `record.account.address` (the address
   the record was made with) while the balance is the current class's (`boot.account`) — on main too, but
   the stack rewrote all three surfaces. All three show what the build opened.
4. (medium) The page's shortcuts (`,` `w` Space) fired from inside a dialog: a locked transaction dialog
   navigated away from mid-proof. `interactive()` includes `[role="dialog"]`; the hotkeys spec covers it.
5. (medium) The activity rows hardcoded "about 20 s" (four places) and a 20 s bar while the wallet
   proves through Presto in 5. `RowFacts.prover` from `useTxProver()` → `PROVING[prover].about` and the
   bar's length; `activity-rows` covers the Presto case. The chip word does not gain ✦ (the pill and the
   ledger's claim line carry the attribution; the row's is a promise).
6. (medium) The brief's rule 4 ("risk only where the user can act, said once"): `App.tsx`'s three-line
   host-trust paragraph under every route and the preflight tile's repeat were still there beside
   Settings › About and the FAQ. Both removed.
7. (low) `HeroCard.side` (only its own test used it), `journal.visible()` (rows fold, never drop) and
   `copy.ts` `untilOrAgo` removed with their assertions.
8. (low) Introductions naming deleted surfaces (`features/recovery.ts`, `routes.ts`, the gallery) and
   `rows.ts`'s three-line header compressed to its invariant.
   Codex's "looks fine": formatting is a re-export, not a copy; the version-name adapters have distinct
   inputs; miner and stats share `readDeadline`; `Sheet` keeps the stats calculator; the witness and
   signature bindings; the Presto endpoint policy; the old origin's WASM as a recorded departure.
