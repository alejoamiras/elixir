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
- **The billboard's link is `https://presto.build/`**, not `https://presto.build`: the element resolves its `href`
  through `new URL()`, which spells an origin with the trailing slash. The first local run's only failure
  (17 passed, 1 failed); the spec accepts either form.
- **The `*.list` pattern missed the runner's Chrome source** (ubuntu-24.04 image 20260907.300 keeps it under
  another name): CI run 34384869083 (`a960b18`) died at the same apt step with the `rm` in place. The step now
  removes every file under `sources.list.d` naming `dl.google.com`; run 34385390258 (`7336ce7`) got the landing
  and stats jobs through their whole suites, so the workaround holds.
- **Local gate (homelab, 2026-09-09 18:05 UTC, `a960b18`)**: `bun run e2e:agent -- bun run --cwd packages/web-miner
  test:e2e` with `presto-server` on PATH — **18 passed in 16.1 min, exit 0**. The lane started on registry port
  25091; `presto.e2e.ts`: native 51.5 s (the ✦ after the first native proof, the claimed winner `prover: presto`,
  the `/prove/ultra-honk` responses seen), the billboard against a closed port 17.4 s, the update row and Retry
  1.8 s. The server's own log records five `/prove/ultra-honk` requests; `PRESTO_HOME/versions` never appeared
  (nothing downloaded); after teardown no `presto-server` process remains. Renders at 1280/1440 of the three states
  in `renders/` (the billboard's is the signed-in cockpit with Presto absent; artboard 1 drew the signed-out one).
- **CI run 34385390258 (`7336ce7`)**: the miner job ran the whole suite; the three Presto specs passed (native
  1.7 min, the billboard 35.7 s, the update row 2.3 s) and 17 of 18 specs in all. The one failure is the pre-existing
  first-visit spec (`miner.e2e.ts:63`) on its *second* visit: the claim counter reached 1 (the claim minted, mining
  resumed) but the balance stayed `4` for the 60 s the assertion allows — the reopened PXE lagging on the new note on
  the 4-core runner. Nothing on the Presto paths is involved (that page runs `?presto=off`; no probe, no Worker
  change on that path), and the same spec passed on the homelab in both local runs. Re-dispatched with the fix
  round's commit; if it recurs, it is a runner-speed allowance for that spec, tracked apart from this plan.
- **Final local gate (homelab, 2026-09-09 19:27 UTC, `cf74cb0` — the head after both fix rounds)**: `bun run
  e2e:agent -- bun run --cwd packages/web-miner test:e2e` — **19 passed in 16.2 min, exit 0**. The suite is 19 now
  because the Presto spec split in two: the native state renders while mining on the hard deployment (11.8 s), and
  the claim through Presto is its own spec (51.4 s) with the evidence scoped to itself. The billboard spec takes
  the run's registry-claimed closed port (19.0 s); the update row and Retry, 1.8 s. The run's own server log
  records six finished UltraHonk proofs (`ok=true`), no `versions` directory appeared, and no `presto-server`
  survived teardown. The six renders in `renders/` are from this run.

