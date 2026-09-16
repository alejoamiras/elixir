# Phase 5 — Mining's presentation and Presto

Arc 3 (`polish-mine`). Built 2026-09-16, commits `835c621` (the build) and `3aa0a53` (the loop's footer
row reserved from the first paint). Green 2026-09-16.

## What was built

- **The loop from the start (§5.3, board Cockpit).** ui's `ScoreLoop` grows its calm window from `since`
  (a 60 s floor, the 3 min cap), draws older bars on the axis and a dashed tick where the bar changed
  (`epoch N · bar A → B`, the sample's own epoch), drops the calm window from under the ring to its bar,
  and ends in a DOM row (`data-slot="score-loop-footer"`: the footer left, "now" right). The placeholder is
  a pair: "Your proofs draw here once you start" · "The bar is 3.0 · clear it to win". No `−N min` in calm mode.
- **The loop tile.** The header reads paused · `live · since 22:12` (`loop-window`, the last 3 min after 180 s)
  · "your proofs"; the footer `0.8 s per proof · ✦ presto · 12 proofs` (`rate-line`, ✦ only after a native
  proof); signed out the Start button asks Presto through the session; the KPI subs signed out say
  "starts with mining" and "the bar is X · about N proofs per win".
- **The epoch tile (§9.1.15).** Rows: wins (`epoch-claims`), bar, open for, expected close, "next bar if it
  closed now" (×0.62), "anyone can close it" (`in N` / `now`); the power row is Presto's ("Presto · native
  prover", "proving on this machine · About Presto", `presto-row`) while `prestoSticky`, the slider with its
  caption otherwise.
- **Presto (§9.2.13, §9.2.18, board PrestoReasons).** No probe at cockpit-ready: Start mining asks, the
  signed-out Start included (`session.startMining` with no controller). The row ↔ slider swap follows the
  sticky state (`selected === 'presto'` without a fallback reason); the pill's ✦ and the chart footer follow
  `active`. A thread change while native proves is stored (`controller.reconfigure` logs and returns) and
  applied at the next browser build. The reasons are the board's sentences; no threads chip on the row;
  `PRESTO_SITE` in one place.
- **The balance tile.** "Your balance shows once you log in." signed out; an sr-only line
  "account 0x… · N wins from this device" once ready.

## Decisions taken while building

- **The landing's "shared chart" does not exist**: `HeroLive` draws its own strip; nothing to change there.
- **The account and wins stay on the balance tile, screen-reader only.** The brief moves them to the Wallet;
  assistive tech still gets the account under its balance, and the thirty-odd e2e hooks on `account` and
  `claims` keep their anchor without a second element.
- **`since` survives a claim** (the loop resumes after it) and is cleared by Stop: the window is the session's.
- **The footer row is in the flow from the first paint** (empty until proofs exist): the cockpit gate pins the
  loop tile's height across a claim, and a row that mounted with the first proof grew it by 14 px — the
  gate's first red.
- **The replay recording was not re-recorded**: the signed-out cockpit changed in words, not in bindings
  (artifacts, layouts, SDK); the lane passed on the recording of 2026-09-15.
- **The hard deployment's next-win KPI overflows its tile** (an impossible target's seconds): a test-only
  deployment, left as is.

## The gate

- Fast layers: lint clean; `bun test` 481 pass (39 skip); web-miner Vitest 103; ui 68.
- Runs, each alone:
  - `cockpit` proverless on `835c621`: 6/7 — the miner spec's first test: the loop tile grew 14 px when the
    first proof landed (the footer row). Fixed in `3aa0a53`; rerun alone 7/7 (5.9 min).
  - `chain` proverless on `835c621`: 6/6 (presto 3/3, 17.6 s to the first native proof; states, switch).
  - replay: 4/4 (42 s), no re-record.
- The pass conditions: no probe at cockpit-ready (presto's third test: no billboard before Start); no
  rebuild on a slider change while native (`presto-retry.bun.test.ts`'s stored-threads case); ✦ only on a
  native proof (presto's first test: `native` after the proof, `rate-line` with ✦ presto; the third: no ✦
  without Presto).
- `e2e/.renders/native-1280.png`: the row "Presto · native prover", the footer "1.5 s per proof · ✦ presto ·
  2 proofs", the header "live · since 01:32".
