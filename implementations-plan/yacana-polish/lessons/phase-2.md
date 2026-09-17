# Phase 2 — The account

Arc 2 (`polish-account`, stacks on `worktree-yacana-polish`). Started 2026-09-15. Commit `396cde4`.

## What was built

- `keys/slot.ts`: one held record per browser in the `device` store (`yacana-keys` stays v1), CAS on a revision,
  a staged record that survives a crash, tab leases (2 min) for create and log in only; `open` needs a held or
  staged record and writes nothing until the ceremony commits. The legacy rule (two records, no slot): the
  newest-created is the slot. A released record stays in the store unlisted until a replacement commits, so a
  crash mid-switch re-adopts it. `keys/store.ts` exposes `transaction` for the multi-store writes.
- `session.ts`: every ceremony runs inside `reserved(intent, work)` — reserve, stage, open, adopt (commit) — and
  cancels on any throw; `createWithPasskey` excludes the known credentials; `restoreWithPasskey` and the words
  login carry `allowCredentials` / `findRecordFor` over the reservation's known records; `forget` drains the
  claim and the queued crossings before releasing, then reloads. `classifyAccountError` maps the failure to a
  kind (`dismissed`, `no-prf`, `no-webauthn`, `held-tab`, `slot`, `other`) published on the signed-out state.
- `features/account/`: `Screen` (eyebrow, h2, body, Back), `Start`, `Create` (consent), `Welcome` (the stored
  account; Open with passkey / Open; "Use a different account" through the sign-out dialog), `LogIn`, `Words`
  (the grid, the copy, the checkbox that hides the words, the quiz on 3 · 7 · 11, "Back up later"),
  `WordsLogIn` (count under the field; "Word N isn't in the list: check "x"."; the checksum sentence), `Notes`
  (the PRF note, the old origin's note, `noteFor(error, context)` with the brief's copy and primaries).
- `SignOutDialog`: "Sign out?", the body per method and backup state, the hold with the claim's wait
  ("Claim finishing · N s"), the click path revealed after an early release, the backup gate
  ("Back up my 12 words" → the backup → back to the dialog, now eligible).
- `Wallet`: after a typed words login an empty balance carries "Expected a balance? A mistyped word opens a
  different, empty account: check your words." (`typedWords` on the ready state).

## Decisions taken while building

- **Leases only for create and log in.** `open` (a stored record) reserves nothing: two tabs opening the same
  account is the chain view's `held` case, already refused with its own note. A lease there would make Retry
  wait two minutes for nothing.
- **Reserve before the WebAuthn prompt.** The slot check is an IndexedDB roundtrip; there was one before the
  prompt already (the record listing), so the user-visible timing is unchanged, and a held slot refuses before
  the authenticator is touched.
- **Releasing a staged record deletes it.** Its keys (the passkey, the words) restore it; keeping it would leave
  a second unlisted record the legacy rule could later promote.
- **Welcome's primary for a words account reads "Open".** The canvas' "Enter 12 words" assumed re-typing; sealed
  entropy opens without it (D38 seals the entropy under the device key). Retyping on every open would be the
  old flow's friction back.
- **"Try another device" is not a link.** The canvas shows it on the PRF note; it has no destination on this
  page. The note's body carries the instruction instead.
- **The old origin's Log in screen has no dismiss link**: Escape and the veil dismiss it (`origin.e2e.ts` uses
  Escape). Start is never shown there (`start-create` count 0).
- **The Wallet's backup eyebrow is "account · 12 words"** (the dialog's is "create account · 12 words"): the
  canvas has no Wallet-side backup board; the eyebrow names where the screen sits.
- **The empty-account hint lives on the balance tile**, keyed by `typedWords` on the ready boot state: only a
  login that typed the phrase sets it (both branches: an existing record taken back, or a fresh sealed one).
  A stored open or a creation never shows it, whatever the balance.

## Gate — the first run, and what it found

- The first cockpit run failed `miner.e2e.ts` at once: mining went `idle` after one proof, no notice. The
  trace showed the migration card ("Mining has ended") and 225 requests to Sepolia's public RPC from a page
  meant to know only the isolated network. Cause (`site/src/config.ts` `blockOf`): the e2e build hands
  `VITE_BRIDGE=''` for a run without a portal and the config fell back to the profile record's bridge
  block (`deployments/testnet.json` carries one since #43); the bridge session then read the live Registry,
  whose canonical version is not the throwaway rollup's, the verdict read "flipped by registry", and the
  controller retired. Fixed in `407e1f2`: an e2e build carries only the blocks its run hands it (test added).
  Not this pass's scope, but the gate cannot pass through it; CI's cockpit shard was green on main with the
  same leak, so its green depended on that RPC's answer — now closed.
- The stack's diff touches nothing on the mining path (the controller, the reducer, the loop tile, the
  prover are unchanged since main): the failure was the environment's, not P2's.
- `scripts/rename-guard.test.ts` flagged "Your passkey is the only key." and "can't derive a/the key": the
  brief's copy verbatim, both about the cryptographic key. The guard admits those two phrases (`2167c6b`).
- The replay inventory named the dialog-geometry test by its old title (`proof-inventory.ts`); renamed.

## Gate — green 2026-09-15

- Fast layers: `bun run lint` clean; `typecheck` in ui and web-miner clean; `bun test` 424 pass · 39 skip · 0 fail
  after the three fixes above; `test:components` ui 67/67, web-miner 101/101, web-landing 14/14.
- `cockpit` proverless (`E2E_PROVERLESS=1 E2E_SHARD=cockpit`, tmux): 7 passed (5.2 min) — the first visit,
  the poisoned CRS, three power changes, the prover crash, the pop-out, the passkey journey (create, mine, claim,
  reload with one touch, sign out, log in), the gone passkey. The shard's inventory and floors held.
- `canary` real proving (`E2E_SHARD=canary`): 4 passed (4.7 min) — the tampered claim refused at proving and the
  restored one minted (1 proof, 13.9 s), the cancel mid-opening, withdraw (sign out → words account B → its backup
  and sign-out → A's passkey login → a private and a public send → B's words login sees the balance, 3 proofs,
  39.0 s), the words journey (create, quiz, mine, hold to sign out, restore, the empty-account hint, "Use a
  different account" through Sign out, the backup gate, the click-only sign-out).
- Replay: re-recorded on a fresh isolated network (12 answers), then `test:replay` 4 passed (41.7 s): the account
  screens and their notes at 440 × ≤720 px (Start, Create, LogIn with the sign-in note, WordsLogIn, Words with
  the quiz), the malformed RPC, the old Presto, the public epoch poll.
