# Fable audit — the first draft

Run in parallel with the first codex pass, on the same draft, with no knowledge of it. Verdict: **reject**.

Its blocking findings, each verified against the code before being acted on:

1. **The `@ui` lane is impossible as specified.** `boot.ts:127-153`'s preflight makes a live node and a live
   deployment mandatory before `key-screen` or `cockpit` render; `SignInDialog.tsx:25` gates on `signedOut`.
   Two of the three tests in that lane would fail. This collapsed the lane rig's savings and the fast-lane
   promise built on it.
2. **The four security barriers are one and a half.** `config.ts:92` and `:134` share the predicate
   `mode === 'production'`; `config.ts:170-171` is unreachable, because `prestoE2ePort` is already `''` and
   `queryOverrides` already `false` when the assertion runs; the double opt-in cannot fire in production
   because `env` is empty there; and the artifact grep was placed off the only real deploy path —
   `grep -rn wrangler .github/` returns one hit and there is no deploy workflow.
3. **`vite-base.ts:45` casts `YACANA_SITE_MODE` without validation.** One environment variable disables the
   override gate, the production assertion and the double opt-in, and widens `connect-src` via `headers.ts:19`.

Beyond the blockers, three findings changed the plan's shape:

- **`packages/web-stats/e2e/visual-setup.ts`, with `playwright.visual.config.ts` and `serve.ts`, is already a
  complete chainless record-and-replay lane**, running on every pull request. The draft missed it and
  reimplemented a worse version. This is now the fast lane's design.
- **The lane abstraction is oversized**: `rigFor` can only skip one deployment, two proxies and a Presto. Two
  environment booleans deliver the same saving. The isolated network, the production build and one deployment
  are unavoidable.
- **Naive `--shard` is the worst split available** for this suite, and `runner/index.js:6178` shows Playwright
  suppresses its "no tests found" error when `--shard` is set, so a mis-specified matrix is silently green.

It also corrected the draft's facts: `config.test.ts:110` does not test the flag branches (`:19` does);
`BOOT_MS` is a `toBeVisible` timeout rather than a per-test cost; `states.e2e.ts:75-84` synthesises its race by
holding `aztec_sendTx` at a route, not by proving time; and the local network's `realProofs ?? false` means the
node has always installed `TestCircuitVerifier`, which answers valid to everything.

One of its findings was itself wrong, and the third pass caught it: it reported `packages/web-miner/e2e` as
untypechecked from `tsconfig.tests.json`, but the root `tsconfig.json` includes `packages/*/e2e` and
`miner-core.yml` runs it on every pull request.

---

# The fourth read

A different reviewer (Fable 5.1), checking the third version against the last green CI run rather than the
plan's prose. Verdict: **conditional approve**. Its corrections — the 26.5-minute baseline with its small fixed
cost, the softening of the `YACANA_SITE_MODE` finding against `assemble.ts`'s guard, P0's forbidden list, a
numeric rule for proverless, a spike and a named running cost for the replay lane, two asks answered — were
then sent through codex, which rejected them twice and approved on the third round. The most instructive
rejection: the read had cited the run log's proof durations as the browser's, and they were the deployer's and
the burst miner's. Its own estimate was withdrawn and replaced by a measurement.
