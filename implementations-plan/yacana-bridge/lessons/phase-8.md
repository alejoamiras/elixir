# Phase 8 — the versioned origin

## What landed

- `packages/site/src/assemble.ts`: each role lands in its own directory (`dist` for the apex Worker, `dist-old` for the
  versioned origin's Worker) and a production build refuses the other pairing; `build.json` carries `role`,
  `rollupVersion` and `miner`; `/faq` waits for arc 4. `packages/site/v5/wrangler.jsonc`: the `yacana-v5` Worker
  (`v5.yacana.network`, `../dist-old`, SPA fallback, the old preview suffix).
- `packages/web-miner`: `features/Retired.tsx` (the old role's cockpit head in place of the loop tile), `isOldRole()` in
  `bridge/env.ts` and the session's inert Start under it, the key screen's host note where a host restores but never
  creates, `OldTabNotice` asking the served record on every return to the tab and once after load.
- `packages/site/e2e`: both roles assembled and served (`localhost`, `v5.localhost`), the spec checks the same headers,
  `build.json.role`, the old miner's retired head and restore-only key screen, and the old-tab notice on a same-rollup
  redeploy. `packages/harness/tests/origin.bun.test.ts` + `e2e/origin.e2e.ts`: one passkey across the apex and the
  versioned origin on the rig.
- Vitest: `versioned-origin.vitest.tsx`.

## Gate

`bun test packages/site` 75/75 ✓ · `bun run site:build` ✓ (`dist`, `build.json.role = apex`) · `YACANA_APP_ROLE=old
bun run site:build` ✓ (`dist-old`, role `old`) · `bun run e2e:agent -- bun run site:e2e` 3/3 ✓ (both roles under
`wrangler dev` on `localhost` and `v5.localhost`: one header policy, `build.json.role`, the retired head and the
restore-only key screen on the old role, the old-tab notice on a same-rollup redeploy) · `bun run rig -- origin` ✓
(20.9 s: one passkey registered on `https://yacana.test`, signed in on `https://v5.yacana.test`, the same account).

## Lessons

- Browsers resolve `*.localhost` to loopback and Vite's preview admits it by default, which is enough for the
  site's e2e (no passkeys there). WebAuthn does not accept `localhost` as a registrable suffix of `v5.localhost`
  ("The relying party ID is not a registrable domain suffix"), so one authenticator across the apex and the
  versioned origin needs a real-looking domain: the rig's origin case serves `yacana.test` and `v5.yacana.test`,
  resolved to loopback with Chromium's `--host-resolver-rules`. A plain-http made-up domain is no secure context,
  and the headless shell ignores `--unsafely-treat-insecure-origin-as-secure` (probed: `isSecureContext` false), so
  the case makes a one-day self-signed certificate (`openssl`), the e2e preview serves it (`YACANA_E2E_TLS_CERT` /
  `_KEY`) and Playwright ignores HTTPS errors for that run. Bun's `fetch` takes `tls: { rejectUnauthorized: false }`
  for the readiness probe.
- Two `wrangler dev` side by side need distinct inspector ports (the default 9229 is taken by the first) and the
  second's readiness must be probed through `localhost` like the first's.
- The port registry handed out a port a sandbox it never registered was listening on; `claim` now binds each
  candidate on both loopback addresses before handing it out.

## Consults

None yet.
