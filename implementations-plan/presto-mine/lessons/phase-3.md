# Phase 3 — the e2e lane and CI

Started 2026-09-09 after P2 (`e19afed`).

## Log

- **One launcher for every run** (`scripts/run/presto.ts`): a registry-claimed port, a per-run `PRESTO_HOME`,
  `BB_BINARY_PATH` at the lock-pinned native `bb` (never the Node wrapper on PATH), `AZTEC_BB_VERSION` from
  `.aztecrc` so the server reports the release it proves with and downloads nothing, default origin gating (the
  e2e page is `http://localhost:<port>`, auto-approved), SIGTERM → up to 8 s → SIGKILL. The e2e `run-setup.ts` uses
  it before the build so `VITE_PRESTO_E2E_PORT` is baked in; `run-teardown.ts` stops it after the groups it kills
  outright. A machine without `presto-server` runs the suite with the lane absent and the Presto spec skipped; an
  installed server that fails to start fails the run.
- **`pageUrl()` switches Presto off by default** (`?presto=off`): every existing spec keeps its browser-prover
  regressions (the power-change spec fills the slider, which native disables); `presto.e2e.ts` opts in with
  `presto: 'on'` or points at a port of its own.
- **The claimed winner's provenance** rides on `LastClaim.prover` (from the Worker's `winner.prover`), which the
  e2e reads through the page's hook; the HTTP evidence is Playwright's view of the Worker's `/prove/ultra-honk`
  responses or, failing that, the server's own log under `PRESTO_HOME`.
- **The row in e2e**: an "old Presto" is a `node:http` fake in the spec answering `/health` without `ultra_honk`
  (CORS open); Retry after the fake gains the route clears the row — the Retry wiring proven end to end.
- **A fresh worktree needs `bun run contracts:compile` before the e2e** (the deploy reads
  `packages/contracts/target/yacana_miner-YacanaMiner.json`); the first local run died in setup for that.
- **CI run 34383319955 (`ba3783b`)**: all three jobs failed in the same second at `bunx playwright install
  --with-deps chromium` — `apt-get update` refused Google's Chrome repo index (`dl.google.com … Hashes of
  expected file` ≠ received; a mid-publish state on their side at 17:16–17:39 UTC), before any test ran. The
  `setup-presto` action had already installed the pinned server by digest on the miner job. Re-dispatched.
