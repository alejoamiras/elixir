# Lessons — arc 2 (miner)

## P2.1 Site tooling + M1 shell (2026-09-05)

**Result:** ✓. `packages/site` (`site.env` = node, allowlist, `VITE_RP_ID=yacana.network`; `config.ts` merges it with
`deployments/<profile>.json`, production ignores the process env, e2e/dev may override every value; `headers.ts` renders
the one policy for dev / preview / production; `vite-base.ts` = shared bb.js-aware Vite config with `define`, the
rendered headers on both servers and an emitted `_headers` in every build output; `scripts/{fetch-crs,copy-artifacts}.ts
<public dir>` + `crs.lock.json` moved here; wrangler 4.127.1 exact (4.129.0 is younger than 7 days)). The web miner:
`vite.config.ts` is three lines; `.env.production`, `public/_headers`, `csp.test.ts` deleted; `config.ts` drops the
cross-check and honours `?node=&miner=&token=` only when the build set the e2e flag AND the host is `localhost`; the node
is the only user-editable connection value; `chain.ts`/`controller.ts` lose the cross-check; `boot.ts` runs
`assertDeployment` (new `miner-core/src/reader.ts`: chain id, rollup version, both instances + classes, the miner's
bound `token` slot); routes on `history` + `popstate` (`/mine`, `/mine/wallet`, `/mine/settings`, base-aware); the shell
(brand mark, nav, testnet badge, one StatusPill); host rules (alias → redirect, preview / unknown → banner, keys only on
the RP host or localhost in non-production builds); desktop-only screen (`< 900 px` or coarse pointer without SAB);
`tab-status.ts` (title `▸ · 18/min · 2/4 · Yacana`, SVG favicon per mark state).

- **RP ID spike (Playwright + CDP virtual authenticator, ctap2_1 + PRF):** `127.0.0.1` → `SecurityError: This is an
  invalid domain`; `localhost` → credential created, `prf.enabled=true`, 32-byte result. E2E servers bind `localhost`
  and the e2e build sets `VITE_RP_ID=localhost`.
- **`style-src` audit:** Radix sets inline `style` attributes and Sonner injects a `<style>` element, so
  `style-src 'self'` + `style-src-attr 'unsafe-inline'` would break the toaster. `'unsafe-inline'` stays, documented in
  `headers.ts`.
- `host.ts` must read `import.meta.env.VITE_RP_ID` per call, not at module load, or `vi.stubEnv` cannot vary it (and a
  `define`d constant hoisted into a module-level const is the same value anyway).
- The malformed-RPC spec now points the page at the mock origin through `?node=` (allowlisted by the e2e build); the
  four cross-check specs are gone with the feature. The miner-core live test deploys two throwaway instances and
  checks that every drift (chain, rollup, class, foreign miner, foreign token) is refused: 71 s on the isolated network.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · site + web-miner `typecheck` ✓ · `bun test` 61 ✓ · `test:components` 15 + 27 ✓ · E(web-miner) 4 passed (2.9 min) ✓ · plus `e2e:agent -- bun test packages/miner-core/src/reader.live.test.ts` 1 pass.
