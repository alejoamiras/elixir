# Phase 10 — The upgrade and the old origin (arc 6, `polish-upgrade`)

## Build

- `packages/bridge/src/record.ts`: `LifecycleRecord` (`stoppedProvingAt` unix seconds, `nodeRetired`), the
  block the operator notes on a retired version's own record and no chain records. `deploy.ts` carries it on
  `Deployment`; `site/src/config.ts` builds it into the apps as `VITE_LIFECYCLE` (a unix time and a boolean,
  asserted in production like the migration block); `web-miner/src/bridge/env.ts` reads it
  (`lifecycleRecord()`); `e2e/build-env.ts` passes it to an old build.
- `packages/deploy/src/bridge/lifecycle.ts` (new): `lifecycleAfter` refuses the wrong version's record, a
  non-numeric time, a second stop, a retirement before the stop, a second retirement; `writeLifecycle` reads
  and rewrites the record. `scripts/bridge.ts` dispatches `note-stop <version> [<unix s>]` and
  `retire-node <version>` before `operatorFromEnv`: no key, no RPC. `lifecycle.test.ts` covers both.
- `packages/bridge/src/exit-deadline.ts`: `dayOf` and `deadlinePhrase` (the four readings) live beside
  `readDeadline` now; the miner's `copy.ts`, `rows.ts`, `SendAhead.tsx`, `FromEthereum.tsx` import them from
  there. `copy.ts` gains `proofChip(proof, stoppedAt, now, version)`: `checking` while the scan is
  unfinished, `no proof from V5 yet` on a proven absence, `V5 proved an epoch 12 min ago` (ok), `no proof
  from V5 for 3.0 h` (warn, past `SILENT_AFTER_S` = 2 h, with `silentS` for the sentence), `V5 stopped
  proving · Sep 21` (bad) from the record alone — a stop outranks a fresh proof, an age never says stopped.
- `web-stats/src/bridge-beat.ts`: `deadlineOf(v, snapshot)` = `readDeadline` over the version's transitions,
  its paused seconds, the policy's floor and the read's chain time; `lastDayWords` (the rule before the
  upgrade, `<day> at the earliest · then V7 going live`, `could close any day · V7 going live ends it`,
  `<day> · plus paused days`, `<day> · passed`); `versionLine(v, snapshot)` and `phasesOf(v, m, now,
  snapshot)` phrase from the reading; `Bridge.tsx`'s last-day row and `BridgePhases` take the snapshot.
  The portal's `deadline()` read stays for the exit-limit lines (the same block, the same arithmetic).
- `ui/src/components/hero-card.tsx`: `aside` across from the eyebrow (the live chip) and `actions` under the
  body and the trail (the one button and its quiet companion); `side` stays.
- `web-miner/src/features/MigrationCard.tsx` rewritten to the brief's three moments: announced (`aztec v6 ·
  expected around sep 18`, "Aztec upgrades to V6 around Sep 18.", the body, **Send ahead**, quiet
  "How it works"), sent (the sum as the title, `sentTrail` lit at the least advanced send, "1.2 tYACA mined
  since" with its button, "Wallet · details"), flipped (`aztec v6 is live · sep 18 14:02`, the chip, "Mining
  has ended on V5. Send what's left ahead.", the body, the button, How it works). The testids stay
  (`migration-card[data-moment]`, `send-ahead`, `sent-ahead-status`, `flipped-alert`) plus `proof-chip` and
  `send-ahead-how`. `SendAhead.tsx` takes `initial: 'form' | 'how'`; `Mine.tsx` opens it either way.
- `web-miner/src/lib/apex.ts` (new): `apexOrigin()`/`apexHost()` from the relying party, `statsHref` and
  `FAQ_HREF` on the apex under the old role (it serves neither); `tabs.ts` gains `oldTabs` (Send ahead ·
  Stats ↗).
- `web-miner/src/features/OldApp.tsx` rewritten to the one Send-ahead page: the hero (`aztec v5 · retired ·
  sep 18`, the chip, the title and body of each of the four states — live, silent from the chip's age,
  quiet from `stoppedProvingAt` with `deadlinePhrase` for what is held, gone from `nodeRetired`), the card
  (signed out: "Log in to see what's still here." **Log in** with the restore note; still here: `private ·
  can leave while V5 proves`, the balance, **Send ahead to V6**, quiet "or bridge to Ethereum" on
  `moneyStanding`, "Then claim it on V6 with one tap, at yacana.network. Same passkey."; quiet: `cannot
  leave`, "Left here when V5 stopped proving."; gone: "Logging in here needed V5's node, and it is gone."
  **Open yacana.network**), then `ActivityList` with the shared `MoneyDialogs` (exported from `Wallet.tsx`,
  the deposit now optional) and `SendAheadDialog` under `BridgeProviders`; the list's footer is the
  advanced line (save · restore). No forward anywhere (`mayForward` was already false on the old role).
- `App.tsx`: the old role's header (`V5 · retired`, `oldTabs`, no status pill, the account chip → Settings,
  no gear once the node is gone), no `NodeWayOut` and no node-banner settings link on the old role, `/wallet`
  → `/`; `GoneApp` (the shell over the page, no session). `main.tsx`: the session, the preflight and the key
  download live in `start()`; with `nodeRetired` on the old role the page mounts `GoneApp` and nothing else
  runs. `Opening.tsx`: `changeNode: !isOldRole()` and the sentence without "or use another node".
  `NodeTile` takes `readOnly` (the row reports, no Change); `Settings.tsx` on the old role: network (node
  read-only, RPC), account ("passkey · the same account as yacana.network", Sign out), appearance, about
  (`this origin · v5.yacana.network · retired`, "The old app, kept so what is still on V5 can leave. …
  More on /faq ↗"), no mining, no alerts, one column.
- `site/src/assemble.ts`: `appsFor(role)` (old: the miner alone at `/`), `redirectsFor(role)` (old: `/mine`,
  `/mine/`, `/mine/wallet`, `/wallet`, `/mine/settings`, `/settings` → `/ 200`, exact sources), no `og.png`
  for the old role; `assemble.test.ts` drives an old assembly through the stubbed steps.
- Deleted: `web-miner/src/features/SendAheadSheet.tsx`. `docs/upgrades.md`: steps 11–12 (the stop, the
  node's retirement, the old origin's redeploy carrying them, the witness archive first) and the rig table's
  row; `CLAUDE.md`: the operator commands and the old page.
- Specs: `bridge-features.vitest` (the three moments, the chip's five words), `gallery.vitest` (the old app's
  four states under a wagmi config, the rows without a forward), `versioned-origin.vitest` (signed out
  without a chip; the node gone), `settings.vitest` (the old origin's four tiles, no Change), `shell.vitest`
  (`oldTabs`), `web-stats/bridge-beat.test` (the four readings on the line and the phase),
  `bridge.vitest` (the fixture records the after-next transition), ui `bridge-primitives.vitest` (aside and
  actions); `origin.e2e.ts` (the new hero, the two tabs, no pill, the card's state, the chip, the list) and
  `bridge.e2e.ts` (the sum without the count, the flipped body, the chip).

## Decisions and departures

- **`Sheet` stays in ui.** The plan deletes it with `SendAheadSheet`, but the stats calculator
  (`web-stats/src/features/Calculator.tsx`) is on it and the plan never scoped a dialog for that; only the
  stats vitest caught the removal (the root typecheck excludes every app's `src`). Restored; the calculator's
  move is out of scope.
- **The flipped card carries `sent-ahead-status`** ("6 tYACA sent ahead · 2 still crossing") under its body:
  the board draws the flipped card before any send, but the rig's v5-flipped stage restores a recovery file
  on Mine and reads the sum there, and a holder who sent before the flip should see it on the card that
  tells them to send the rest. A held send counts as crossing (`inFlight`): it lands only once forwarded.
- **The old origin's list is "activity" in every state**, not "proven in time": sends undone by a missed
  proof are part of the record ("the balance came back here") and belong with what was proven; the header
  would lie over them.
- **The old origin's account tile keeps Stay open**: the board draws the address and Sign out alone, but the
  toggle is the passkey's and a holder may want it off there too. The apex line is added under the method.
- **Signed out, no chip**: the proof scan is the bridge session's, which exists only with an open account.
  The board draws the chip signed out; reading Ethereum for a page that has no account would be a read the
  page cannot act on.
- **`SILENT_AFTER_S` = 2 h**: the brief's example is three silent hours; two hours is a few proof windows
  (about 40 min each) past the last accepted proof, enough for silence to mean something and short enough to
  say it while a send can still be reconsidered. The operator's recorded stop is the only "stopped".
- **The stats words are the reading's, not the miner's**: `lastDayWords` are the card's short forms; the
  miner's `deadlinePhrase` is a sentence about redeeming. Both are pure over `DeadlineReading` now.
- **`note-stop` runs on both records**: the operator notes it on main's `deployments/testnet-v5.json` (the
  record of it) and on the old worktree's `deployments/testnet.json` before the redeploy; the runbook says
  so rather than adding a copy step.
- **Open yacana.network is an anchor** styled as the button (`asChild`): a page with no session has nothing
  to run, so it is a link.
- **The quiet hero's deadline is the reading's sentence**: the board says "redeemable until at least Mar 17";
  the page says `deadlinePhrase(view.deadline, next)` (the four readings), so a floor, a cliff and a set day
  each get their own words rather than one that is wrong for two of them.
- **The old origin's about tile keeps the apex's rows** (source, build, bb.js, relying party) under `this
  origin`: the board draws source and bb.js alone; one tile serves both roles and the extra rows cost two
  lines. The network tile drops its aside on the old role, as the board draws it.
- **"Activity follows it here" on the old origin's send-ahead Done step**: the board's "Wallet follows it
  here" names a tab the old origin has not (its page is the wallet); the apex keeps the board's word.
- **The How step's title from the card's link is generic**: the board's "What happens to 3.5 tYACA." is the
  form's typed amount, which the card's quiet link has none of; from the form the title carries the amount.
- **A future stop is refused by the CLI, not the build**: `note-stop` refuses a time past now (a typo would
  turn the old origin quiet early) and one past ten digits; the site build checks only the shape, so a build
  stays clock-free.

## Arc-6 codex fix loop

**Round 1** (2026-09-17, `run-codex.sh … high read-only`, session `01a0ac4a-f775-76e0-a706-cd1ff8bfecb3`):
REVISE, 11 findings, all verified against the code; 10 applied, one applied in part.

- Applied: the quiet old origin's rows still offered "Send ahead again" / "Bridge again" on a dropped or
  never-proven crossing (`rowLine` now disables `again` with "V5 stopped proving: nothing more can leave."
  when the crossing's version noted its stop; gallery test); the sent trail lit `claimable` at "forwarded"
  and a redeemed (`minted-l1`) or closed send as "held" (`claimable` → the claim station; both leave the
  card's `ahead`); `note-stop` accepted a future time and an unrepresentable one (refused; the site build
  bounds the digits); `NodeTile readOnly` still showed "Use the default" on a custom node (hidden without
  `onChange`; settings test on a custom node); the runbook's step 11 pointed at a worktree step 8 had
  removed, and step 12 named `/witnesses/5.jsonl` where the archive is keyed by rollup version (step 8
  keeps the worktree until the origin comes down; the path says rollup version); the old card's disabled
  buttons had no reason line (`money-reason` with Settings, as the Wallet's); the chip's test lacked the
  `'none'` word and the e2e accepted "checking" forever (the origin and the flipped stage now wait for the
  scan to end: `not.toHaveText('checking')`); `writeLifecycle` wrote in place (a `.tmp` and a rename); the
  cliff's phase was violet `on` (`bad` now: the Timeline's red); copy — the announced button carried the
  amount the board has not, the chip said "3.0 h" for the board's "3 h" (the trailing `.0` dropped; the
  hero body says "3 hours"), "Wallet follows it here" on the old origin (above), the How title (above),
  the network aside; comments — the card's, the old page's and the send-ahead dialog's introductions
  narrated the render and the dialog's said balances are lost "at the flip" (they leave until the version
  stops proving); `SentLine` and `HeroCard` now say the one thing the code does not.
- Applied in part: the "reads nothing" tests. The duplicate gone-page test in `versioned-origin.vitest`
  is gone and the gallery's is titled by what it proves; an entrypoint test of `main.tsx`'s gone branch is
  not added — it would mock the session, the preflight, the CRS fetch and `#root` to assert four things
  do not happen, for a branch that is one `if` over a record flag. Logged, not built.
- Not applied: serializing record writes across operators in the runbook — one operator runs one command
  at a time; the atomic rename covers the cut write, which was the real risk.

**Round 2** (2026-09-17, resumed, `high`): REVISE, 2 findings, both applied. The retry block was keyed on
the crossing's version being the build's own; a recovery file can bring an older version's crossing, whose
retry still sends from this build — `RowFacts.stopped` is now the build's own version by name when its
record notes the stop, whatever the row's version (gallery test on a V4 never-proven row under V5's stop).
The runbook's step 11 and 12 commit the lifecycle notes in the old worktree too, so the worktree removed
in "Then" is clean. Codex marked the entrypoint test's omission, the concurrent-writer case and the e2e's
wait as not material; it noted a pre-existing path where `canonicalAt()` swallows an RPC error and
`proofFloor()` caches an inexact floor, which could hold "checking" past the 60 s — unobserved on the rig.

**Round 3** (2026-09-17, resumed, `high`): APPROVE, nothing material — the loop converges at round 3. The
rig's `browser` (3/3: V5 3.2 min · flip 11.9 s · V6 1.2 min) and `origin` (1/1, 21.7 s) cases green on
`7542096` with the round-1 chip assertions; lint, the five typechecks, `bun test` 496, vitest miner 118 /
stats 84 / ui 69 green.

## Gate (2026-09-16)

| layer | result |
|---|---|
| lint (biome, sorted package.json) | clean |
| typecheck: root, web-miner, web-stats, web-landing (`tsc -b`), ui (`tsc -p`) | clean (the root check excludes every app's `src`: see the `Sheet` departure) |
| `bun test` (every suite) | 494 pass, 41 skip, 0 fail once the deletions were staged (the rename guard reads the tracked files) |
| `bun test packages/deploy packages/harness` (+ site, the guard) | 109 pass, 30 skip (the harness cases skip without `YACANA_RIG`) |
| `test:components`: web-miner 119 (22 files), web-stats 84, ui 69, web-landing 14 | green |
| `bun run rig -- browser origin` (tmux) | browser 3/3: V5 3.2 min · flip 10.9 s · V6 1.2 min; origin failed once (no `account` on the rewritten page: the apex carries it on the balance card's sr-only line; the old card got the same, `ac74377`), then 1/1 in 20.8 s |
| `test:visual --update-snapshots`, then `test:visual` | 8/8 both runs; the four `bridge-*.png` baselines changed: the last-day phase now says "the later of V2 going live and 180 d after the upgrade · plus paused days" for the recorded version instead of the generic sentence |

Pass criteria: both rig cases green with the new copy — the announced card sends ahead twice and the sum
reads "2 tYACA sent ahead"; the flipped card says "Mining has ended on V0. Send what's left ahead.", "what's
still here when it stops can't leave.", shows the chip and the sum after a restore; the old origin's hero
says "Send what's still here ahead." under the two-tab header with no pill, restores the apex's passkey,
shows the still-here card with the chip and the activity list.
