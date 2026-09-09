# Phase 2 — arc 2: mine loading

## P2.1 · The chain before the account ✓ (2026-09-08, `00cfb5e`)

Gate, as run: `bun run lint` exit 0 · every typecheck ok · `bun test` 216 pass, 0 fail (new, under
`packages/web-miner/tests/`: `pinned-crs.bun.test.ts` — the streamed verifier reports bytes as they land and they
total the pin, a wrong hash still throws after every byte was counted, a body longer than its pin is refused as it
overflows; `public-epoch.bun.test.ts` — the poll fills the atom, keeps the claims fresh, never regresses the epoch,
stops on handover, and a read that was out when it stopped writes nothing) · Vitest web-miner 56 (the cockpit
renders the epoch tile from `epochAtom` + `rulesAtom` alone, no session) · as insurance on the boot path (not in
this phase's gate): the first-visit miner E2E on the isolated network, 1 passed.

What the phase found:

- **The CRS off the gate is mostly a memo.** `load()` was already memoised per asset; streaming it (`streamVerified`
  into a buffer of exactly the pinned size) gives byte progress for free, and `crsReady()` is that same memo, so the
  wallet's first proof and the prover's start wait on the download without a second copy. The one-run promise is
  kept failed on a bad pin: only a reload retries, and the failure shows both in `crsAtom.error` and to whoever
  awaits `crsReady()` (the opening step).
- **The public poll is the stats page's read path, one epoch wide.** `readOpenEpochNumber` then `readEpochs` over
  `{from: open, to: open}` with the seed, through `chunkLoader` — so the miner's `public/` now carries the slot table
  and layouts (`scripts/prebuild.ts`, the same shape as the stats prebuild). An epoch beyond the table is logged and
  the cockpit keeps "reading the epoch…" until sign-in.
- **The handover is a generation, checked after the await.** `stop()` bumps it; a read that was out lands nowhere;
  `start()` bumps it again so a read from a previous run cannot land either. A failed start (`Session.fail`) restarts
  the poll; a sign-out reloads the page, which restarts everything.
- **`preflight` sits at the 80-line budget**; the rules and the poll went into `startPublicChain` beside it.
- The dual-runner rule: the two new suites are `*.bun.test.ts` (bun only) — `ReadableStream` bodies and a fresh
  jotai store per test are cleaner outside jsdom.

## P2.2 · The cockpit signed out and the modal ✓ (2026-09-08, `1347482`)

Gate, as run: `bun run lint` exit 0 · every typecheck ok · `bun test` 216 pass · Vitest web-miner 60 (new
`sign-in.vitest.tsx`: the cockpit is dull with the epoch's numbers and "Sign in to mine" in Start's place, the
dialog is open with no corner X, Not now dismisses and either sign-in button reopens, Welcome back with a saved
record, the hotkeys are inert while the dialog shows and work once closed), ui 46, stats 19, landing 10 · the
Playwright geometry check against the dev server (`E2E_SERVER=dev`), 1 passed · as insurance (not this phase's
gate): the words and passkey flows on the isolated network through the dialog, 3 passed.

What the phase found:

- **The 480 × 720 check runs at 900 × 720.** `isDesktop` needs 900 px, so a 480-wide window shows the phone
  fallback and no dialog at all. What the plan means is the dialog's own box — 480 px wide — and the 720 px height:
  the spec asserts the dialog is 480 wide, that neither the page nor the dialog overflows horizontally, that its
  bottom stays inside the window, and that each screen's primary is reachable by the dialog's scroll; the error
  state is the real one (a passkey restore with no credential on the virtual authenticator).
- **The dialog is anchored high, not centred, and scrolls inside.** `top: clamp(24px, 20vh, 180px)` (the canvas's
  180 at 900 tall, less on short windows) with `max-height: calc(100vh − that − 24px)`; a centred dialog with
  `max-h-[85vh]` would have run past a 720 px window's bottom.
- **Settings stays free of the dialog.** The plan wants the node changeable signed out and the banner's
  "Use another node →" lands on Settings; a modal there would have to be dismissed first. The Account tile carries a
  "Sign in" instead (`sign-in-settings`: wants the dialog and navigates to Mine). The passkey E2E found this: it
  reloads on `#settings` and waited for a dialog that never came.
- **The dialog's title is an sr-only `DialogTitle`**; the screens keep visible `h2`s. The words screens are also
  rendered on the Wallet page outside any dialog, so they cannot own a Radix title.
- **Three complexity overruns** (`LoopTile` 17, `KpiTiles` 16, the hotkey handler 16): the header text and the rate
  line became small components, the KPI subs a pure `kpiSubs`, and the hotkey listener is simply not registered
  while the dialog shows.
- The words spec asserted the old heading ("Sign up with a passkey."); the modal's is "Sign in to mine." per the
  canvas.

## P2.3 · Opening A ✓ (2026-09-08, `9f0eb51`)

Gate, as run: `bun run lint` exit 0 · every typecheck ok · `bun test` (new `opening-steps.bun.test.ts` — the
weights, the active keys step's byte fraction, the notes step indeterminate; `session-open.bun.test.ts` — a cancel
after the ceremony ends in signedOut with no error and zeros the master and hands the epoch back, a dismissal
during the ceremony is inert, a superseded attempt publishes nothing and disposes what it made, a failure shows
the error) · Vitest web-miner 62 (the opening body: the bar's width from three step states, `aria-valuenow` 28,
Cancel disabled while the key step is active) · **arc boundary**: the full miner suite on the isolated network
(incl. the new `opening.e2e.ts` — a cancel mid-opening returns to signed out and the next open reaches the account
on one PXE) · renders at 1280/1440 of signed-out, watching and opening beside `MineSignedOut`, `MineWatching`,
`MineBootA`.

What the phase found:

- **The opening is a cancellable attempt in `Session`, and `startSession` is injectable.** The attempt (a
  generation + an `AbortController`) is minted at the initiating key action, before the ceremony; the ceremony (the
  OS passkey prompt, or the words work) runs under it with Cancel inert, and only once it settles does
  `startImpl` run the steps, checking the signal between each. A cancel aborts, `startSession`'s catch disposes the
  controller and stops the wallet, the master is zeroed, and the public poll takes the epoch back. `startSession`
  and `preflight` are constructor deps so `session-open.bun.test.ts` drives the attempt with fakes (no IndexedDB,
  no WebAuthn); the wallet's own stop-on-abort is covered by the E2E, not the unit.
- **"Cancel works" is derivable from the steps, not a second flag.** During the ceremony the published steps show
  the first step (`key`) active; `startSession` republishes it done. So the dialog enables Cancel exactly when the
  `key` step is done — the ceremony-over signal is already in the state the bar reads.
- **The step id `keys` reads as the forbidden word.** The rename guard scans string literals, and the CRS step's id
  `'keys'` (a discriminant, not copy) tripped "account, not key". Renamed the id to `crs`; the label stays
  "proving keys" (a compound the guard exempts).
- **The bar's indeterminate stripe is a `Progress` prop.** The notes step's fraction is unknown, so `Progress`
  gained `indeterminate` (a stripe crossing its slice under motion, a static half under reduced motion, `value=null`
  to Radix) rather than a hand-rolled div or a fake percentage. The keyframes live in `theme.css`.
- **The 480 × 720 geometry check runs at 900 wide** (below 900 the phone fallback shows and there is no dialog); it
  asserts the dialog's own 480-wide box, no overflow, and the primary reachable by its scroll.

## Arc 2 codex loop · round 1 (2026-09-08)

Session `01a08352-8b88-75e2-9dd8-cad7371dcf96` (Astra, high), the three renders and artboards attached. Twelve
findings; all verified, all adopted:

- **High — a cancel during the controller's first read still opened the account.** No signal check after
  `controller.begin()`, and `Session` adopted whatever `startSession` returned. Now the signal is checked after
  `begin()` (inside the cleanup-protected block) and again as the result is adopted; anything returned and not
  adopted is disposed and its wallet stopped in `finally`.
- **Medium — the wallet accessor captured the initial wallet.** A rebuild (a lost race, a node switch) replaces
  `opened`; `recipientKnown` would have used the stopped one. It reads the mutable handle again.
- **Medium — a disposed controller could overwrite the balance.** The `disposed` guard covered the epoch write, not
  the balance read that follows. Both now.
- **Medium — Cancel could not escape a stalled CRS download.** `crsReady()` is shared and un-cancellable; the
  attempt now races it against its own signal (the download keeps running for the next attempt), and a cancel wins
  over whatever error the abort made the steps throw.
- **Medium — supersession did not enforce ownership.** A new attempt neither aborted nor awaited its predecessor;
  both could hold the PXE namespace. It aborts the predecessor and waits for its cleanup first; the predecessor sees
  itself superseded and publishes nothing.
- **Medium — secret cleanup started too late.** A master derived in a ceremony whose later work threw (address,
  seal, record write) was never zeroed; `restoreWithWords` derived twice and dropped one. `owning(master, work)`
  zeros on throw in every ceremony; the restore passes its master on.
- **Medium — the indeterminate bar dropped the finished fill** and swept the whole track (a static 50 % under
  reduced motion). `Progress` keeps `value` and confines the stripe to `[value, value + span]`; the dialog passes the
  notes weight.
- **Low — fidelity**: `text-2xl` is 30 px, the spec says 24 (`text-[24px]` now); done steps carry their times (the
  ceremony's from `Session`, the crs and notes steps timed in `startSession`); the balance tile shows a `Skeleton`
  (new in ui) while opening with the buttons at 50 %; the sign-up is the compact one the artboard draws — the
  fingerprint card and its contradictory sentence ("never leaves this device" beside "follows your passkeys") are
  gone, the consent line, the button and the warning stay.
- **Low —** a failed purge now reports through `crsAtom.error` (purge inside the try); the opening tests import
  `fake-indexeddb/auto` themselves (they passed the full run on another suite's preload); the `boot.ts`/`state.ts`
  comments no longer place the CRS in the preflight.

Tests: the supersession test became two — a signal-aware predecessor is aborted and outlasted on one PXE, and a
cancel landing as the last step settles disposes the returned controller and stops its wallet. Gate re-run: lint ·
5 typechecks · `bun test` 224 pass · Vitest 137 · the full miner E2E on the isolated network 15 passed · the arc-2
renders re-shot.

## Arc 2 codex loop · round 2 (2026-09-09)

Resumed session, the round-1 diff. Five findings (12 → 5), all on the attempt's edges; all verified and adopted:

- **Medium — the cleanup finished too early.** The wallet stop of a discarded result was fire-and-forget, so
  `done`, `cancelOpening()` and the signed-out publish could all come before the namespace was free. `discard()` is
  awaited before any publish and before the attempt ends.
- **Medium — a queued attempt superseded while it waited still ran its ceremony** (A running, B then C queued: B
  prompted for a passkey and could write a record). Ownership and the signal are checked right after the wait,
  before the ceremony.
- **Medium — a stale publish could overwrite a replacement's opening.** `toSignedOut`/`fail` checked ownership
  before their `listRecords()` await, not after; a replacement that began during it lost its `opening` to a stale
  `signedOut` and ran its WebAuthn prompt behind dismissible controls. Both take the attempt id and re-check after
  the read.
- **Medium — two masters could outlive a failure**: the one `openMaster` refuses (a different account) and the one
  a words restore derives, whose tail (`listRecords`, the branch) sat outside the ownership wrapper. `openMaster`
  zeros what it refuses; the restore owns its master through its whole tail.
- **Low — the step list**: done steps in `ok` with a ✓, the keys step's bytes in the mono right column (`Stepper`
  gains a `right` slot), the node step's measured time (the preflight rows' `ms`, summed).

Tests: the wallet is stopped before the cancel resolves and before signed out is published; a queued attempt
superseded meanwhile never prompts (the fake's first call waits, later ones resolve — the first draft re-armed its
gate on every call and hung). Gate re-run: lint · 5 typechecks · `bun test` 226 pass · Vitest 137 · the full miner
E2E on the isolated network 15 passed · the arc-2 renders re-shot.

## Arc 2 codex loop · round 3 (2026-09-09)

Resumed session, the round-2 diff. One finding (12 → 5 → 1), verified, adopted: `openMaster` zeroed a master it
refused only on an address *mismatch*; when the derivation itself threw (a malformed `account.index`), the decrypted
master escaped — and the sealed path in `Session.open()` has not entered `owning()` yet at that point. The derivation
and the comparison now sit in one try/catch that zeros on either failure. Test: a supplied master is zeroed both on a
mismatch and when the address cannot be derived. The change is an error path inside `keys/store.ts`; the unit suite
(227 pass) covers it, the miner E2E from round 2 stands. As in arc 1, round 3 still carried an item and round 4 is
the confirmation the goal requires.
