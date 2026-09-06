# Phase 4 lessons · arc 4 · landing, assembly, deploy

## P4.1 Sections, demo, launch flag (2026-09-06)

- **Package**: `packages/web-landing` on the site base with `prover: true` (the demo runs in the miner's Worker
  pipeline). Copy deck in `src/copy.ts` from the binder's landing study (H3 hero, the money rules and table, what the
  chain sees, how it works, live, verify, ask, footer, demo, mobile, launch); the numbers come from `PARAMS`, so the
  testnet page states its own schedule (4 per 5 minutes, 192 an hour). The footer line is the plan's wording.
- **The demo Worker** lives in web-miner (`src/demo/{index.ts,demo.worker.ts}`) as the plan says; the barrel exports
  only types and `createDemoWorker()`, so the landing's main chunk carries no more than the stats page's (bb.js's
  API code comes with aztec.js's `poseidon2Hash` import in both; its WASM chunks are emitted but not fetched, which
  the E2E asserts for the landing as it does for the stats). Rolldown emits `demo.worker-*.js` (405 KB) and the
  barretenberg chunks separately for the cross-package `new Worker(new URL(...))`, confirming the plan's inference.
- **One proof, scored, discarded**: the Worker derives the deploy domain itself, commits a random secret and
  recipient, proves nonce 1 against the open epoch's seed (read with the fourth `getPublicStorageAt`, only for the
  open epoch), scores the digest and posts `{score, proveMs}`; the bb.js instance is destroyed in `finally`. The
  E2E deployment uses target 1 so the demo never produces a winner.
- **The run** (`src/demo/machine.ts`): a pure reducer plus `runDemo(job, deps, onState)` with an injectable Worker
  factory and timeout; terminated in every path, including a Worker that fails to construct and messages after the
  end (a fake Worker keeps delivering; a real one does not). Threads `max(1, min(4, cores − 1))`, NaN-safe.
- **The page's reads** (`src/live.ts`, `src/chain.ts`): the open epoch with seed, the 12 before it without, supply
  and block, then a poll a minute; a failed poll keeps the last numbers with an "unreachable" note. The browser-side
  slot helpers moved to `packages/site/src/browser/slots.ts` and the slot copy step to
  `packages/site/scripts/copy-slots.ts`, both shared with web-stats.
- **`VITE_LAUNCH_MODE`** joined the site config (`site.env`, e2e override, `viteDefine`); the apps' `vite-env.d.ts`
  now reference the one in `packages/site` instead of carrying copies.
- **Mobile**: `matchMedia('(max-width: 767px)')` decides; below it the demo panel and "Prove one now" are not
  rendered at all (the E2E asserts a count of 0), "Send me the link" uses `navigator.share` with a clipboard
  fallback.
- **OG card**: `public/og.html` with the self-hosted fonts through relative `node_modules` paths (the file is opened
  as a `file://` URL by the screenshot script), rendered by `bun run og-card` to the committed `public/og.png`.
  First render used the fallback font and wrapped the footer; fixed with the `@font-face` rules and a 19 px footer.
- **Test files run under both runners**: `machine.test.ts` first used a regex in `toMatchObject` and fake timers;
  bun's `toMatchObject` does not take a regex for a string and its `vi` has no fake timers, so the test uses
  `expect.stringContaining` and a real 20 ms timeout.
- **E2E**: first run failed only because the steps list was unmounted in the done state; the panel now keeps the
  four step times under the result. The proof in headless Chromium on the isolated network took a few seconds
  (the whole spec 8.9 s).
- CI: `web-landing.yml` (watches `packages/web-miner/src/{demo,shims}/**` and `pinned-crs.ts`); `e2e.yml` gained
  on-demand `web-stats` and `web-landing` jobs beside the miner's.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · web-landing `tsc -b` ✓ · web-stats / web-miner / ui typechecks ✓ ·
`bun test` 147 ✓ · web-landing `test:components` 6 ✓ · web-stats 13 ✓ · E(web-landing) 3 passed (51.8 s) ✓ ·
E(web-stats) 3 passed (44 s) ✓.

LESSONS_FILE=implementations-plan/yacana-surfaces/lessons/phase-4.md

## P4.2 Assembly, Cloudflare, domain, docs (2026-09-06)

- **Committed artifacts**: `bun run artifacts:commit` writes `packages/contracts/artifacts/yacana_miner-YacanaMiner.json`
  and `packages/work-circuit/artifacts/yacana_work.json` from `target/` with `file_map` emptied and every
  `debug_symbols` blanked (the compiled `file_map` carries absolute source paths: not reproducible across machines
  and not fit to publish). Dropping the keys outright broke the miner: aztec.js's `loadContractArtifact` requires
  `file_map` to be a record and `debug_symbols` a string, so they are emptied, not removed. 255 KB + 58 KB.
  `copy-artifacts.ts` reads the committed files; `contracts.yml` re-derives them and diffs.
- **`assemble.ts`**: builds the three apps with `--base` into `dist/{,mine,stats}`, each without its `public/`
  (`YACANA_ASSEMBLE=1` → `publicDir: false` in the shared base), then the CRS, the artifacts, the slot table and
  the layouts once at the root, `og.png`, `_headers`, `_redirects`, `build.json` (mode, commit, node origins, RP
  ID; no timestamp, so a rebuild of the same commit is byte-identical). The slot helpers fetch `/slots/` and
  `/layouts.json` at the origin root now, not under `BASE_URL`. 153 MB in all; the largest file is the 16 MB CRS,
  within Pages' 25 MB per-file limit.
- **`_redirects` on Cloudflare Pages** (the plan's unverified inference, checked with `wrangler pages dev` 4.127.1
  and a probe in the scratchpad): `/mine/* /mine/index.html 200` is *rejected* ("infinite loop detected"); a
  wildcard 200 to a target outside the prefix turns into a 308 to the canonical URL and, worse, is evaluated
  before static assets, so `/mine/assets/x.js` was redirected too; with no rule at all an unknown path serves the
  root `index.html` (the landing). **Codex consult** (`/codex xhigh`, session `01a07499-b551-7431-9916-1add403ab40a`,
  files in `~/.cache/tmp/codex-cdSH8fqK`): I proposed hash routing (fully static) over Pages Functions; codex's
  verdict was to keep path routing with *exact* sources and *directory* targets (`/mine/wallet /mine/ 200`,
  `/mine/settings /mine/ 200`, `/stats/verify /stats/ 200`, `/verify /stats/ 200`), which it exercised against
  wrangler's handler, and noted that a Functions fallback checking only for 404 would be wrong (the SPA fallback
  answers 200 with the landing). Re-probed here: every path 200 with the right shell, assets intact, headers
  applied. Adopted; the route lists are typed against the apps' `Route` unions so a new route cannot be left out.
- **`site.e2e.ts`** (`wrangler pages dev e2e/.dist`, lane 7): `build.json` says e2e; `/`, `/mine/wallet`,
  `/stats?epoch=0`, `/verify`, `/slots/0.json`, `/artifacts/yacana_work.json` carry identical policy headers;
  the landing, the miner's key screen at `/mine/wallet`, the stats detail for `?epoch=0` and Verify render;
  `crossOriginIsolated`; the demo proves on the assembled origin (8.4 s).
- **CI**: `_changes.yml` (a `workflow_call` job with a `filters` input; the seven callers pass their `relevant`
  block whole, so no indentation surgery inside the reusable file), `site.yml`, `contracts.yml` runs
  `artifacts:commit && git diff --exit-code` and `site:build` instead of the miner build alone.
- Docs: `docs/deployments.md` (the site section with the Cloudflare project settings the owner enters),
  `docs/threat-model.md` (one origin, keys and vault, withdraw, the read paths, the demo Worker),
  `docs/roadmap.md` (passkey backup, rotation, wallet-sdk launch mode, retiring the old Pages project),
  `CLAUDE.md`, `implementations-plan/index.md`.
- Owner's steps (not agent actions): connect the Pages project to the repository with the settings in
  `docs/deployments.md`, add the custom domains, HSTS / CAA / DNSSEC on the zone; the first production deploy is
  Cloudflare's build of `main` after the stack merges.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · site `tsc` ✓ · `bun run site:build` ✓ · `bun test packages/site` 10 ✓ ·
`bun run e2e:agent -- bun run site:e2e` 2 passed (56 s) ✓.

LESSONS_FILE=implementations-plan/yacana-surfaces/lessons/phase-4.md
