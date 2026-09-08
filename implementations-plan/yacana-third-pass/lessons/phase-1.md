# Phase 1 — arc 1: miner + site

## P1.1 · The node is a setting ✓ (2026-09-08, `794e6d7`)

Gate, as run: `bun run lint` exit 0 · every package's `typecheck` ok (`scripts/run/typecheck-all.sh`) · `bun test`
187 pass, 0 fail (new: `headers.test.ts` on the three modes, `node.test.ts` — the URL rules, the probe's refusals, the
proxy's dispatch and switch, `node-guard.test.ts` — same origin and the node pass, the lease, the deadline,
`redirect: 'error'`, the outcomes, the gate, bb.js's real loader under the guard, the CRS fall-through,
`import-order.test.ts`, `node-check.test.ts`, `tests/switch.bun.test.ts` — pause → drain → swap → rebuild → resume on
the recovery harness, the marker) · Vitest web-miner 52 pass (the tile: Check lines, a refusal in warn, Use disabled
until a check passed, Use switches and shows the rebuild, a quota throw shows the fixed message and does not switch,
the tile with no session) · `bun run e2e:agent -- bun run site:e2e` 2 passed (the `_headers` line carries `https:`
and `webrtc 'block'`, the local forms under the e2e mode, and no node origin) · the landing E2E 3 passed (the boot
under the guard and the rollup-address check).

What the phase found:

- **The e2e builds carried the testnet's rollup address.** `config.ts` takes the identity fields from the profile's
  record with per-field `VITE_*` overrides for e2e; a new identity field needs a new override in all five e2e setups
  (miner, stats, landing, site, the visual fixture) or the e2e deployment fails its own check ("node serves rollup
  0x4ed7…, this build expects 0xd73a…"). The visual fixture's recording already held the rollup address in its
  `getNodeInfo` answer, so only its deployment record needed the field.
- **Interceptor state cannot hang off `fetch`.** `pinned-crs` wraps whatever `fetch` is at its import, so a guard that
  kept its state on the fetch function lost it under the CRS wrapper; the state lives on the realm (a symbol on
  `globalThis`), and the guard exports `installNodeGuard()` so a test that swaps `fetch` for a fake can re-arm it —
  bun shares the module registry across test files in one run, so "install at import" happens once per run.
- **The e2e preview needs production's HSTS.** The site E2E asserts every policy header on every path; the `e2e`
  header mode keeps HSTS (only `dev` drops it), as the plan's "production's other headers" meant.
- **The assembled site's `_headers` follow the build's mode.** `assemble.ts` rendered production's policy regardless;
  an e2e assembly under `wrangler dev` blocked its own local node until the mode was passed through.
- **Chromium logs "Unrecognized Content-Security-Policy directive 'webrtc'"** on every load: the directive is best
  effort, as the plan says; the console line is noise the E2E's console watcher tolerates.
- **`test.each` under Vitest + jsdom**: `new URL(…, import.meta.url)` yields jsdom's URL, which `fileURLToPath`
  rejects; resolve file paths as strings in dual-runner tests.
- The miner's `tsconfig.tests.json` typed `vite/client` but not the app's `vite-env.d.ts`; a test that reaches
  `import.meta.env` through `boot.ts` needs the declaration included.
- The live switch's E2E (two forwarding proxies, a claim after the switch, a stalled B) is P1.4's; P1.1 proves the
  order on the recovery harness with a held-open read.
