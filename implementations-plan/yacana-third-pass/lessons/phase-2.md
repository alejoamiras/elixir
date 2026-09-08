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

## P2.2 · The cockpit signed out and the modal ✓ (2026-09-08, `P22HASH`)

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
