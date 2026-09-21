# Phase 5 — the machine, and the way to say yes

## The permission, for real (I2 settled)

`e2e/replay/lna.replay.ts`, on Presto's technique (Fact 19). What the browser said, verbatim from the run of
2026-09-21:

- **Browser**: `HeadlessChrome/151.0.7922.34` (Playwright 1.62.1's Chromium), Linux x86_64.
- **Descriptor that answers**: `loopback-network` (the split one; the legacy `local-network-access` was never
  reached). A fresh context reads `prompt`.
- **Secure context**: `true` on `http://127.0.0.1:<port>`. **`targetAddressSpace` in `Request.prototype`**: `true`.
- **Under `prompt`**: load → Start sends nothing to the fake, remembered or not (the page's rule). A **Look** under
  `prompt` is **held by the prompt**: zero hits, the SDK's bounded health check gives up, the card reads absent,
  the permission still reads `prompt`. A CDP grant in the same context fires `change`; the page re-asks the click
  it already has (`onLnaChange`), the fake gets its first hit, the card reads found — no reload.
- **Under `denied`** (`grantPermissions([], { origin })`): remembered Presto, Start → zero hits, card blocked; a
  Look under denied → **still zero hits** (the browser's gate, not the page's reading of it).
- **Under `granted` with Presto remembered**: the card opens on "used last time", Start probes **exactly once**.

So the plan's I2 holds as written — but only once the page was actually a public origin (below).

## Three runs that measured nothing, and why

The first three runs of the spec passed the override and got a browser that **never blocked anything**: under
`denied` a Look reached the fake, under `prompt` the request went straight through. Two hypotheses were tried
(the `LocalNetworkAccessChecks` feature flag: no change) before the mechanism was read off Presto's own config
(`--ip-address-space-overrides=127.0.0.1:5173=public` — the same flag, but the page reached **by IP**): the
override keys on the endpoint that served the page, and this lane's Vite preview binds `localhost`, which on this
host is **`::1` alone** (`/etc/hosts`: `::1 localhost`). The page came over `[::1]:<port>`, no override named
it, the page stayed loopback, and every fetch to 127.0.0.1 was loopback → loopback: no gate. "The browser does
not block" was an artefact of the lane's binding, the same class of mistake as `presto-mine`'s "undecided does
not block in headless".

The fix: the replay lane's preview now binds `127.0.0.1` (its `localhost` URL still works for every other spec:
Chromium connects across both loopback families), the LNA spec alone navigates by IP, and `queryOverridesAllowed`
admits the IPv4 loopback beside `localhost` (the page needs `?presto=<port>` to find the fake). Serving the whole
lane by IP was tried and rejected: the passkey RP ID is `localhost`, and WebAuthn on a `127.0.0.1` page fails with
"invalid domain" rather than the honest "Sign-in didn't complete." the dialog-geometry test asserts.

Rule for later: **a test of a network boundary must first prove the boundary exists** — here, a Look under
`denied` reaching nothing. The plan's spec had "denied → zero hits" only through the page's own refusal to probe,
which proves nothing about the browser. The Look under denied is now the assertion that does.

## What the plan said and what shipped differently

- `prestoStanding` takes a fourth argument, `mining`: the Worker's native prover while idle reads `found`
  ("proves when you start"), not `proving`. Without it a Look while idle (which rebuilds the prover at once)
  could never show the `found` the plan describes.
- `PrestoStanding` lives in `packages/ui` (the card owns the vocabulary); `presto.ts` re-exports it.
- `session.useBrowser()` is `chooseBrowser()`: Biome's hook rule reads any `use*` call inside a function as a
  hook, and the React hook's field had the same name. The card's prop stays `onUseBrowser`.
- The consent hooks reach the controller as an option (`consent: { allowed, promote, forget }`, built by
  `pageConsent(store)`), not through the module singleton: the controller's tests would otherwise run against a
  record they cannot see.
- `probePresto` no longer writes the atom: the session publishes an answer only on its own consent generation,
  which is what lets a lookup overtaken by a revoke land nowhere.
- The re-probe on `change` (`onLnaChange`) is not in the plan's operations list; the plan's own table ("prompt →
  Look → the request pends → a grant in the same context: `change` fires and the card reaches found with no
  reload") needs it, and the run above shows why: the held request is given up by the SDK before the grant.
- `lna.replay.ts` needed no factoring of `fixtures.ts`: `test.use({ launchOptions })` at the top of the file
  gives that file its own Chromium under the same routing fixture.
- The 5c unit list's "transaction paused in detection, revoked, released: no witness POST" is covered by the
  guard's refusal (asserted at the page realm in `presto-session` after `chooseBrowser`, and at the Worker realm
  in `worker-backend`), not by a held SDK transaction: the SDK's detection phase is not injectable from here.

## Smaller things

- `noticeFor` returns null for `revoked`: the fix-it row must not tell the user to fix what they just chose.
- The identity short-cut in `verifyWin` changed one existing assertion: the "wrong inputs, same proof" check
  now runs on a copy of the bytes, since the object `prove()` verified is trusted as is (the mining loop hands
  the same object back).
- `createProverLoop` crossed 80 lines with the `revoke` case: the coalescing rebuilder moved out (`rebuilder`).
  `startSession` did too: `txProverFor` and `startingThreads` moved out.
- `git commit` under lint-staged took longer than the tool's two minutes once and was cut; the index was left
  staged and the commit re-run. Commits with many staged files go in the background.

## Gate (2026-09-21)

5a: lint 0 · typecheck 0 · miner typecheck 0 · `bun test` 0 fail · components 0 fail · replay 4 passed.
5b: same layers, plus the real-proving prover suite 9 pass (three new: the first proof verified once, an invalid
first proof re-proved locally, a revoke during the witness never leaves), `worker-backend` 2 pass.
5c: lint 0 · typecheck 0 · miner typecheck 0 · `bun test` 0 fail · components 0 fail (the card's spec, the rail's
swap on the card) · replay **9 passed** (the fix-it test through the button after asserting Start sent nothing;
the five LNA tests above).
