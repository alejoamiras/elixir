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
