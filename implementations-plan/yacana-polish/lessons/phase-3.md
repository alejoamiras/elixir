# Phase 3 — Arrival and the opening

Arc 2 (`polish-account`, stacks on `worktree-yacana-polish`). Started 2026-09-15. Commit `6968b4a`.

## What was built

- **Page first (1A, §9.2.1).** `signInAtom` defaults to false; the boot sets it from the slot after
  preflight (a held or staged record → Welcome back on arrival). The cockpit keeps `data-signed-out` as a
  state marker and loses its opacity/saturate dim. The loop tile's signed-out button is **Start mining**
  (`sign-in-mine`): it sets `mineIntentAtom` and opens the dialog; the balance tile's quiet **Log in**
  (`sign-in-balance`) opens it without. The session spends the intent once, right after the ready publish
  (`startMining()`), and forgets it on Cancel; the dialog forgets it on Just watch / Escape / the veil.
- **The opening checklist (§5.2).** `opening-steps.ts` lists four stages — "Passkey confirmed" / "12 words
  accepted", "Preparing your miner", "Syncing your private balance", "Ready to mine" — as ui's `Stepper`
  (the P1 ring). The bar under the checklist shows only while the keys' bytes land (weights: key 5, crs 60,
  notes 30, ready 5); the sync shows `m:ss` since it went active (`since`, ticking on `nowAtom`); the keys
  step's right column reads "13 of 20 MB" while downloading and "first time only" otherwise; a sub-line
  per stage; the footer "Mining starts when this finishes." with the intent or `resumeOnOpen`, else "You
  can start mining when this finishes.", both "Cancel keeps you watching the chain."
- **A failed stage (board OpeningError, d6).** A throw after the ceremony marks the active step `failed` with
  a short reason at the right and publishes `signedOut` with `error.step` and the checklist (`opening`);
  the dialog renders `OpeningFailed`: the download note ("The connection dropped at 13.0 of 20 MB. Retry
  keeps what arrived."), the node note with **Change node** (kind `node`: the node guard's transport is not
  `ok` when the error is otherwise unclassified), the held tab's note, else "That didn't work." **Retry** is
  `session.open(record)` on the slot's record (the CRS bytes stay cached); **Cancel** hides that failure
  and closes the dialog, so Welcome is what reopens.
- The session logs `opened: key N s · crs N s · notes N s` on ready; `bootPage` and `opening.e2e.ts` print
  it as `[opening]` for the measurement.

## Decisions taken while building

- **No block progress.** `@aztec/pxe` 5.2.0 exposes `getSyncedBlockHeader()` on the PXE, but the embedded
  wallet does not hand the PXE out and the sync runs inside the wallet's own calls; polling a header the
  page cannot reach is not worth a fork of the wallet. The elapsed time is what the brief allows.
- **The bar under the checklist, not under the step.** The canvas draws one bar below the list (64 % while
  downloading); the brief says "one thin bar under the active one, only where the count is known". With
  the sync showing no count, the two agree: one bar, during the download.
- **The node step is gone from the checklist.** The preflight already proved the node; the canvas lists
  four stages. `nodeMs` stays on the preflight record.
- **The specs enter through Log in.** `passKeyScreen`/`keyScreen` click the balance tile's Log in so no
  spec inherits a mining intent; `opening.e2e.ts` is the one that proves the intent (spent once by an open
  from Welcome, forgotten by a cancel).
- **The old origin has no dialog on arrival** either (no slot there): `origin.e2e.ts` opens it from the
  tile's button.

## The measurement (isolated network, headless Chromium, this machine)

Six openings in the cockpit shard, the first cold (a fresh profile, the keys fetched from the run's
Vite server), the rest warm (the same profile, the CRS cached):

| opening | key | crs (wait after the ceremony) | notes |
|---|---|---|---|
| cold, first visit | 0.4 s | 0.0 s | 9.7 s |
| warm × 5 | 0.4 s | 0.0 s | 8.5–8.7 s |

The keys step reads 0.0 s here because the 20 MB come from localhost and are pinned before the
ceremony ends; the sync of a chain a few blocks long is the whole opening. The measurement cannot weigh
the download, so the weights keep the brief's expectation of a real network (20 MB against "usually
under a minute": key 5 · crs 60 · notes 30 · ready 5) and the bar shows only during the download, where
the count is known. The local numbers say what the warm opening costs on this rollup: under ten seconds,
all of it the notes sync — which is why the sync's line carries the elapsed time and no fake percentage.

## Gate — green 2026-09-15

- Fast layers: `bun run lint` clean; `typecheck` web-miner clean; `bun test` (web-miner, site, scripts) 260 pass ·
  1 skip · 0 fail; `test:components` web-miner 102/102, ui 67/67, web-landing 14/14.
- `cockpit` proverless: 7 passed (5.2 min), twice (before and after the wallet-route fix).
- `canary` real: 4 passed (5.0 min) on the third run. The first run failed `withdraw` and `words` after a
  sign-out: the page reloads on `/wallet`, which renders nothing without an account, and the specs waited
  for a cockpit — fixed in the app (`8e3a3e3`: a signed-out wallet route goes to the cockpit), not in the
  specs. The second run failed `words` at its last line, which expected the Start screen after the
  click-only sign-out; page first, the dialog is opened (`f75247b`).
- Replay: re-recorded (12 answers); the lane's first run failed the old-Presto test on a `not-now` click
  the arrival no longer offers (`b2e52a0`); then 4 passed (the account screens at 720 px, the malformed
  RPC, the old Presto, the public poll).
- `bun run rig -- origin` (tmux): the apex's passkey restores the same account on the versioned origin,
  which creates nothing and mines nothing; no dialog on arrival there either — 1 passed (22.2 s).

## Arc-2 boundary — the codex fix loop (§10)

Session `01a0a72e-905c-79b2-8407-11de519f21a0` (Astra, `high`, read-only), the arc's diff against
`worktree-yacana-polish`, the plan, the brief, the canvas generator, the five asks (adversarial on the slot
and the master's lifetime, copy against the generator, the suites' honesty, the state-machine trace, later
arcs) and the two verbatim rules.

### Round 1 — REVISE, twelve findings; all verified, all fixed (`11fbd35`)

| # | sev | claim | verified | fix |
|---|---|---|---|---|
| 1 | high | `commit` of an `open` reservation ignores the revision: reserve-open A → sign out A → stage B → commit A makes A held again, B's commit fails | reproduced by reading `slot.ts`: `open` writes nothing at reserve, and `commit` checked only `state.id` | `committable()`: an `open` commits only on its reservation's revision; the interleaving is a slot test |
| 2 | medium | Cancel during `adopt`/`openBridge` resolves with boot `ready` | true: the last `throwIfAborted` is before `adopt` | the cancel window ends at adoption: `attempt.adopted` makes `cancelOpening` inert, the dialog's Cancel is disabled once every step is done. Not the teardown codex proposed: the account is verified open at that point and Sign out is the way back; the window is one IDB commit and the bridge's open |
| 3 | medium | the download's Retry cannot retry: `crsRun ??=` keeps the rejected run, `verified` the rejected file | true (the docstring even said "only a reload retries") | a failed run is dropped, a failed file leaves `verified` and its bytes leave the count; the verified files stay, which is what "Retry keeps what arrived" now means (no byte-range resume of one file: not worth the surface) |
| 4 | medium | `node` is inferred from the transport for any error; every keys failure reads as a dropped connection, a hash mismatch included | true | `CrsPinError` → `kind: 'pin'` → the plain note with the message; `node` kept only when the failed step is the sync (the one that talks to the node) |
| 5 | medium | the Words screen's phrase is lost when a create fails before staging (the attempt publishes `opening` at once, `Screens` unmounts); its submissions bypass `attempt`, so the note never lands there | true | the phrase is the dialog's state; both submissions are `attempt('words', …)`; a spec |
| 6 | medium | Welcome's "Back up my 12 words" only opens the account | true | open, then `navigate('wallet', 'backup')`; the wallet starts on the backup and returns to its sign-out dialog (`Intent = 'send' \| 'backup'`) |
| 7 | medium | Welcome's no-webauthn primary says "Use 12 words" and runs the passkey open; Log in offers words after `no-prf`, which the brief forbids | true | the open context drops the words primary and the "; or use 12 words" clause (a passkey account cannot open with words); Log in hides the words link after `no-prf` |
| 8 | low | Retry after a typed login's sync failure loses `typed`, so the empty-account hint is lost | true | the failed boot carries `typedWords`; Retry passes it to `open` |
| 9 | low | Cancel's `hidden` is dialog state: a Settings round trip remounts the dialog and the cancelled checklist comes back | true (`App.tsx` unmounts the dialog on Settings) | `session.hideOpeningFailure()` strips `opening` from the boot; `hidden` deleted |
| 10 | medium | `site.e2e.ts` and `scripts/render-e2e.ts` still expect a dialog on arrival, `/mine/wallet` to stay, a disabled create button on the old origin | true — neither is in P2/P3's gate, both are P12's | both follow page-first; the site e2e and the cockpit shard run after the commit |
| 11 | low | copy: the keys step's reason "failed" (canvas "download failed"), the node's without its duration, "Mining stops." added during a claim | true | `reasonOf(error, step)`; "no answer for N min" from the transport's `since`; the claim body as the canvas |
| 12 | low | comments: the weights comment cites a phase log and claims a measurement the log denies; two restating comments in `Screen.tsx`; a stray doc line in `helpers.ts` | true | rewritten to the constraint; deleted |

Looks fine per codex: no dependency change; the credential restrictions, the master's zeroing, the backup
gate, the claim and queue draining; the arrival/intent trace; inventory titles and floors; the deliberate
departures (Welcome's "Open", no device link, the old origin's dismissal, the wallet eyebrow, the elapsed
sync); no interface a later arc must undo.

### Round 2 — REVISE, five findings; the round-1 fixes hold (`2376fd1`)

| # | sev | claim | verified | fix |
|---|---|---|---|---|
| 1 | medium | the renderer clicks `use-words` on the Start screen | true (the dialog opens on Start; the words are on Create) | `start-create` first |
| 2 | medium | `node` inside the sync step still catches an IndexedDB or quota error during an outage | true | evidence: the message has the JSON-RPC client's transport shape (`Error fetching from host …` / `Error NNN from server …`, the guard's cooldown answer included) and the transport is down; the step condition went |
| 3 | low | "Retry keeps what arrived" overstates (only whole files were kept) and the count shown at failure was the retained bytes, not where reception stopped | true | the download resumes: an interrupted file keeps its buffer, the next run sends a range request; a 206 continues, anything else restarts the file (its bytes leave the count); a pin failure drops the partial. The brief's sentence (§5.2) stays true; the alternative was to weaken it |
| 4 | low | the phrase spec never unmounted the Words screen | true | the spec publishes `opening` before the refusal |
| 5 | low | a comment on `boot.ts` still claimed the weights were measured; two docblocks doubled | true | deleted; merged |

Codex accepted the Cancel boundary (adoption ends the cancel window: coherent, smaller than rolling back an
adopted wallet), the slot's revision check, the CRS retry (a controlled stream: the failed file alone is fetched
again, verification still enforced), the phrase ownership, the Welcome → wallet backup → Sign out path, the
context-specific notes, the typed retry and the boot-held dismissal.

The cockpit shard on the round-1 commit: 7 passed (5.6 min).
