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

## Gate — pending
