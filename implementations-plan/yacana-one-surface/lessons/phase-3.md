# P3 · Presto, the mini window, Start, the recovery line — lessons

## What changed
- `prestoDecides(state, record, lna)` in `presto.ts`: the standing is found, remembered or proving. Mining only
  tells found from proving, so it is not an input (computed at `mining = false`, where proving reads as found).
  `PrestoView.native` → `decides`; the rail hides the slider, Settings locks it, and `[` `]` read the same predicate
  (the hotkeys now take the page's `Consent`). The found line: "proves when you start · its own speed setting decides".
- The mini window belongs to the shell: `pipWindowAtom`, `openPip(store)` (gated on `userActivation.isActive`,
  one pending request shared, a refusal or missing API resolves to `null`), `PipHost` mounted once in `App` (renders
  `PipView` into whatever window the atom holds; `pagehide` clears it). Pop out is always shown where supported and
  disabled while a window is open. `PIP_SIZE` 360 × 216, footer in two wrapping rows.
- `useStartClick(onStart)`: signed in, the window first when `pipOnStart` is on, then mining; signed out, intent +
  sign-in + the probe, as before. The keys and the resume on open still call `onStart`.
- Setting `pipOnStart` (default off) replaces `pip`; the old key drops on parse. Row: "Open the mini window when
  mining starts", hint "your Start click opens it; browsers don't let a page open it when you switch tabs".
- The recovery line: "save a recovery file · restore from a file · N crossings saved" (no "advanced ·").

## Facts
- Headless Playwright opens the Document PiP window as a page with the context's viewport (1280 wide): the e2e sets
  the PiP page to 360 × 216 before measuring, which is what a headed browser gives for `requestWindow(PIP_SIZE)`.
- Measured: the window 360, the document 360, both footer rows 336 (the 12 px padding each side), right edges 348.
- `PrestoStatus`'s unavailable reasons are `error | offline | secure-connection-unavailable | version-mismatch |
  permission-blocked`, without `protocol`; the bun test's `as unknown as` cast hid that.
- A fresh worktree has no `protocol/contracts/target`: the browser suites need `bun run codegen`,
  `bun run contracts:compile` (and `portal:build` for the bridge shard) first, as CI does. Codegen left the tree
  unchanged.
- The e2e title changed, so `e2e-breakdown.bun.test.ts`'s zero-floor example now uses the prover-crash title.

## Gate (2026-09-23)
- Fast layers: lint 0 · `bun test` 0 (588 pass, 42 skip) · typecheck 0 · `test:components` 0 (miner 140 incl.
  the new `pip-host.vitest.tsx`, the found → absent cases in `presto-indicator` and `settings`, the `[` spec) ·
  replay 0 (9 passed). `presto-standing.bun.test.ts`: the `prestoDecides` table (found, remembered, proving true;
  absent, checking, consent revoked, permission denied, the WASM fallback false). `settings.test.ts`: `pipOnStart`
  off by default, the old `pip` dropped.
- `E2E_PROVERLESS=1 … test:e2e -- e2e/miner.e2e.ts --grep "the mini window"`: 1 passed (Pop out with the page
  fonts; two rows inside 360 px; open across /mine → /mine/wallet → /mine; with the setting on, Start opens it and
  mines, Stop from the window; with `requestWindow` refused, Start still mines).
