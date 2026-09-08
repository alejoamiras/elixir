# Phase 2 — arc 2: mine loading

## P2.1 · The chain before the account ✓ (2026-09-08, `P21HASH`)

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
