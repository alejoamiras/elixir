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
  expected around sep 18`, "Aztec upgrades to V6 around Sep 18.", the body, **Send 3.5 tYACA ahead**, quiet
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

## Gate (2026-09-16)

(filled below as each layer reports)
