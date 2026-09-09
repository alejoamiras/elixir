# Phase 4 — docs and close, then the codex loop and the delivery

Started 2026-09-09 after P3.

## Log

- **Docs**: the threat model gains the "Local prover (Presto)" row (what it sees, what it cannot, the residuals,
  the guard's class, HTTPS only in production, the banner as constrained third-party code) and the Web page /
  Supply chain rows name the banner and the min-age exception; `CLAUDE.md`'s package table and commands, the
  miner README's step 5 and the plans index carry Presto.
- **The canvas in the repo**: the eleven artboards are committed with `@font-face` sources pointing at the repo's
  own fontsource files by relative URL (open them from a checkout); the generator beside them (`build-canvas.py`)
  reproduces the published form with `--embed`, which inlines the two woff2 files as the artifact carries them.
  Committing the embedded form would have been 1.1 MB of duplicated base64.
- **Renders**: the six 1280/1440 PNGs from the green e2e run live in `renders/` for the PR body and the codex loop.

## The codex loop

Session `01a0869d-fa12-7a21-824a-6365b8b33699` (GPT-6 Astra, `high`), the net diff against `07f4d45` with the six
renders attached (`codex exec -i`, mirrored from the skill script).

### Round 1 — **changes** (2026-09-09 18:12 UTC)

Every claim was checked against the source before it was acted on; all held. What changed, by finding:

1. **Provenance followed the *next* prover, not the proof** (`active` is `stuck ? wasm : presto`; a WASM proof under
   a busy Presto was held, verified and labelled native). `PrestoWorkProver.lastProver` now says who made the last
   proof returned; the Worker holds and labels by it. Asserted in the prover suite across the transient sequence.
2. **The downloading row could stick** (only `downloading` was forwarded; a `prover` transition cleared it, and
   consecutive native successes emit none). The Worker forwards the download's start and the first phase after it.
   The controller clears the page's Presto view on a replaced or abandoned Worker, not only on the next `ready`.
   The "browser · N threads" hint shows on warn rows only (an info row is a native proof on its way).
3. **Start did not force the probe** and a Retry probe could rebuild after a Stop. Start and Retry both ask afresh
   (`forceRefresh`); Start rebuilds only on an eligibility change, Retry under an unchanged config; the controller
   counts user Stops and a Start's probe that outlived one does nothing. Space goes through the same `onStart`;
   `[`/`]` are inert while native proves, as the disabled slider says.
4. **Sign-in waited for the probe** (`prestoFor` awaited it). It reads the status known at that moment; the probe is
   fire-and-forget from the preflight and `Preflighted.prestoProbe` is gone.
5. **A refused switch had already moved the handle**: `setNodeEndpoint` (which throws on a collision) now runs before
   `switchable.use`.
6. **An inline `onStart` could close the picture-in-picture window** (it sits in the pop-out effect's deps): both
   callbacks are `useCallback` in `App`.
7. **A rejected native proof still fed the chart** (`win:false` with the winning score lands in `samples`/`best`). The
   attempt is dropped outright; only the WASM re-proof of that nonce is reported. `mineFrom` moved to
   `worker-mine.ts`, free of the Worker globals, with four bun tests over a duck-typed native prover.
8. **The installer's fast path executed the cached binary to ask its version** before any digest check, and the action
   restored that binary from cache. Both gone: every run downloads the archive and verifies it against the committed
   SHA-256.
9. **The launcher's health loop had no per-fetch deadline** (2 s now). e2e: the HTTP evidence is a 200 seen by
   Playwright or the server's `UltraHonk prove finished … ok=true` line (not the "Received" line, which precedes the
   proof); the absent-Presto port is a registry-claimed, never-listened-on port of the run (`closedPort`), not `1`;
   the billboard spec's mock defines the element and asserts the `status` it is handed; a controller test covers the
   forced same-config rebuild and the Stop counter; the native render moved to the hard deployment (mining, never a
   claim in flight) and the claim-through-Presto check to its own spec.
10. Comments: "gzip-encoded witness" (gzip is encoding, not confidentiality); the e2e header no longer names the
    canvas; the billboard doc is one line; the plan says the config test *resolves* production config (it does not
    build). The denied row has no "how to approve" link: no URL for Presto's approval flow exists to point at, so the
    row names the step in the app instead — noted here rather than invented.

Not adopted: nothing. Codex also asked for build evidence behind the "production build under hostile e2e env"
claim — recorded below once produced.

### Round 2 — **changes** (2026-09-09 19:05 UTC), commit `c271386`

Five findings, each checked against the source (and against the pinned SDK) before it was acted on; all held.

1. **The download row cleared before the download did.** The SDK emits `downloading` and then walks
   `serialize → transmit → proving` *before* the POST (`presto-client.ts:347,380`), so my edge-trigger on "the next
   phase" fired immediately. The gate is now `downloadPhases` in `presto.ts` — a plain function, so it is tested
   directly against that order: `downloading` once, then only `proved` or `fallback` while a download is open.
2. **A Start could not bring native back.** After a denial the visitor approves the site in Presto and presses
   Start; the endpoint and the threads are unchanged, so `reconfigure`'s equal-config short-circuit dropped it and
   the page stayed on WASM. Start now forces the rebuild exactly when the page knows the Worker is stuck
   (`fallbackReason` set) — which is what plan §4 means by "sticky until Retry or Start".
3. **Retry still acted after a Stop.** The Stop snapshot only covered Start. It is taken inside `reprobePresto`
   now, so it covers both, as plan §2 requires ("not at all after Stop or dispose").
4. **The e2e's "independent" evidence could come from an earlier spec** — the server log is the run's, and the
   native spec proves through it first. The log is read from the offset taken when the test begins, and the
   response listener matches a POST at the run's exact prove URL.
5. **The fix-it row showed the opening thread count**, not the one the slider writes. It reads the setting now.

The new `presto-session.bun.test.ts` drives the real `reprobePresto` against a fake Presto whose `/health` the
suite releases by hand — the two Session behaviours above are what the controller-level suite could not reach.
Codex accepted the omitted approval link and the config-resolution evidence, but was right that the plan
overstated it: it now says the e2e port is dropped from the resolved config and from both realms' Vite
definitions, which is what the test checks.
