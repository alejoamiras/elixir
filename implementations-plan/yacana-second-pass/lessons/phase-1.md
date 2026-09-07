# Phase 1 · arc 1, ui + miner

## P1.1 · the shared pieces (2026-09-07) ✓

Gate: `bun run lint` clean; `typecheck` in ui, web-miner, web-stats, web-landing, site and the root all exit 0;
`bun test packages/site packages/ui` 24 pass; `bun run --cwd packages/ui test:components` 36 pass;
the diff against main for `chip.tsx` and `segmented.tsx` is empty.

Decisions made while building:
- **The link component lives in `packages/ui`, not `packages/site`.** The plan put `ExplorerLink` in
  `packages/site/src/browser/explorer.tsx`; the site package has no JSX config and no React, and teaching it both for
  one component was more surface than the component. `ExternalLink` in ui is generic (href, full value, copy
  sibling, no explorer knowledge); `packages/site/src/browser/explorer.ts` stays a pure URL builder the apps
  compose with it. Same boundary Codex asked for, one package fewer touched.
- **HoldButton measures on the frame clock only.** The first draft mixed `performance.now()` at pointer-down with
  rAF timestamps; under jsdom's fake clock that produced negative progress, and in a real browser the two clocks
  are only nominally the same. Elapsed time now starts at the first frame's timestamp (`start ||= t`), so the
  spec's clock must start above 0 (a real frame clock always does).
- **`setPointerCapture` is optional-chained**: jsdom lacks it, and so may older engines; the hold works without it.
- **`ScoreLoop` split**: `drawCalmWin`, `tick`, `layout`, `scaleFor`, `frame` keep every function under Biome's
  cognitive budget of 15 (`draw` and `drawCalmDots` had reached 20).
- The tween's settled signal for the stats visual fixture lands in P2.1, where the fixture is.

## P1.2 · the cockpit (2026-09-07) ✓

Gate: lint clean; the six typechecks exit 0; `bun test packages/web-miner` 54 pass; `test:components` 36 pass.

- **The reducer's mint lifetime**: `attempt` and `startJob` no longer clear `minted`; `winner` does (a new claim
  in flight), and `claimed` replaces it. Freshness (`MINTED_FRESH_MS`, `mintedFresh`) is the display's business:
  the slot and `pillStatus(m, now)` share it, so a stop long after a claim shows idle, not a stale minted.
- **`SAMPLE_SPAN_MS` is 180 s** and exported; the reducer test drives eighty proofs to prove the trim.
- **Ledger links are resolved by the app**: the reducer records `links: {block, tx}` as values (pure, no config),
  `ProofLedger` takes a `linkFor` resolver, and `web-miner/src/explorer.ts` builds it from the site's explorer
  module. `Marks`' chips stay copy-only; the ✓ line's "block" and "effects" anchors carry the links.
- **Vitest needs the explorer env stubbed** (`tests/setup.ts`, `vi.stubEnv('VITE_EXPLORER_URL', …)`), the
  same pattern web-stats uses for the deployment record; without it the links render as plain text, which is
  the production behaviour when the base is `off`.
- **The pop-out** now re-links stylesheets by URL instead of copying `cssText` (the plan's first candidate),
  copies inline `<style>` elements as text, and is 360 × 190 with the 48 px calm strip drawn on its own window
  (`ScoreLoop win`). Whether the fonts load is asserted in P1.4's E2E, not assumed here.
- The miner's tests tsconfig has no jest-dom matcher types; the cockpit spec uses `queryBy… not.toBeNull()`.

## P1.3 · Send, Sign out, the wallet page, the rename, Settings (2026-09-07) ✓

Gate: lint clean; the six typechecks exit 0; `bun test packages/web-miner packages/miner-core scripts` 112 pass
(8 live tests skipped); `test:components` 40 pass; the rename guard passes.

- **The rename is a script of exact pairs** (kept in the session scratchpad, not the repo): 30 strings across
  eleven files. Four were missed on the first pass because the source uses curly apostrophes (`key’s`) and one
  sentence wraps across lines; grep for the exact bytes before assuming a string is absent.
- **The guard scans copy, not code**: string literals and JSX text, minus imports, test ids, comments and the
  boot phase literal `'key'` (an identifier). It exempts `keys/store.ts` (`yacana-keys`, the AAD prefix) and
  `keys/passkey.ts` (`'public-key'`) by file, with the reason beside each. Compounds (`passkey`, `proving
  keys`, `device key`, …) are removed before the match.
- **The passkey's WebAuthn `userName`** changed from "Yacana key" to "Yacana account": it is the label the OS
  shows in its passkey picker. Existing credentials keep their stored label; only new ones get the new one.
  Nothing about sign-in depends on it.
- **The vault store's three internal errors** (`this key is not stored on this device`, `not a words key`, `a
  words key is always sealed`) stay: they are invariants for developers, never shown, and the file is exempt.
- **Diagnostics** are a pure function (`lib/diagnostics.ts`) with a unit test: last 200 lines, 400 characters
  each, 16 KB total, long hex shortened, URL credentials and queries stripped. The button says what it copies.
- `SendSheet` keeps every `data-testid` the E2E uses (`withdraw`, `withdraw-to`, `withdraw-amount`,
  `withdraw-review`, `withdraw-send`, `withdraw-sent`, `public-warning`, `unknown-recipient`) so P1.4 changes
  assertions, not selectors; new ids: `withdraw-max`, `sent-block`, `sent-tx`, `sign-out`, `sign-out-hold`,
  `sign-out-plain`, `sign-out-click`, `back-up-first`, `wallet-account`, `claims-history`, `copy-diagnostics`.
