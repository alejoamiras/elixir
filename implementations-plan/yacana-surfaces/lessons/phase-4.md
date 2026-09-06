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

Gate: `bun run lint` ✓ · `lint:actions` ✓ · site `tsc` ✓ · every package's typecheck ✓ · `bun run site:build` ✓ ·
`bun test` 149 (site 10) ✓ · `bun run e2e:agent -- bun run site:e2e` 2 passed (56 s) ✓ · E(web-miner) 11 passed
(11.0 min, on the committed debug-emptied artifacts) ✓.

LESSONS_FILE=implementations-plan/yacana-surfaces/lessons/phase-4.md

## Arc 4 codex loop (2026-09-06)

**Round 1** (`/codex xhigh`, session `01a07676-4a25-76a2-83ab-bd88286fa6a3`, `run-codex.sh` on the `arc3-stats..HEAD` diff with the arc map, the plan, the lessons and both rules; files in `~/.cache/tmp/codex-0gu0L4i6`). Verdict: "changes required"; ten findings (two P1), all verified and accepted, plus a comment audit. Fixed in one commit:

- **Launch mode could not read an unlaunched deployment** (P1): epoch 0's target is zero before `launch()`, so the live read refused it and the lottery was never read. The reader gained `epochExists` (the target slot through the slot table, zero = not yet); in launch mode `readAll` reads the lottery first and on its own, and a missing epoch 0 is the `unlaunched` state (Vitest on `readAll`, the component test renders both states).
- **The Cloudflare instructions used the wrong root** (P1): Wrangler reads its config from the build's root, so the Pages root directory is `packages/site` (a `build` script runs the assembly; `bun install` there installs the whole workspace) and `BUN_VERSION` is the one environment variable.
- **An e2e build could land in the production directory**: `assemble` refuses a non-production mode into `packages/site/dist` or under `CF_PAGES` (bun test).
- **The countdown named the wrong event**: `launch_at` opens the reveal window; epoch 0 opens with `launch()` after it. The hero follows the contract's phases (commit → reveal → launch → open), and "open" comes only from an existing epoch 0, never from the clock (tested).
- **Privacy copy overstated**: the first-claim handshake, public withdrawals and amounts are now stated the way the threat model does; "never" is who mined it, how fast, what a key holds.
- **Launch and hardware claims**: this testnet launched at once (the copy says so; mainnet's lottery is named) and "never an ASIC farm" became "no special hardware exists for it".
- "Build it yourself" links `/stats/verify`; the cadence dots are labelled a cadence; odds are `≈ 1 in ⌈difficulty⌉`; the history read leaves a lane for the open epoch's read; "recent epochs" and the eligible-epoch count in the network sub.
- Comments: the narration in the demo Worker, the sparkline, the chip and the section slogan removed; the assembly, artifact and demo headers condensed; the build-order invariant and the relink note added.

Gate after the fixes: `bun run lint` ✓ · web-landing `tsc -b` ✓ · `bun test` 151 ✓ · web-landing `test:components` 7 ✓ · E(web-landing) 3 passed (59 s) ✓ · E(site) 2 passed (1.1 min) ✓.

**Round 2** (resumed, the round-1 fix commit under review). Verdict: "changes still required"; three findings, all reproduced and accepted, plus a comment audit; "no additional material findings in the reviewed fix diff":

- **A failed poll before launch froze the lottery silently**: the failure path marked only a `ready` live status. `markUnreachable` marks the lottery too (`LaunchStatus.ready` carries `unreachable`), the hero shows the note, the next successful read clears it (Vitest: success → failure → recovery).
- **"Never … who mined it · what a key holds"** still contradicted the first-claim linkage and public balances: the row is gone and the heading reads "Private: the notes and the transfers".
- **The median caption counted rows the median excludes**: `rateSample` (exported from metrics) is the one predicate; the caption counts its length.
- Comments: two test narrations and the Launch header trimmed; the lottery-flag comment corrected (a zero window means no lottery, not an immediate launch).

Gate after the fixes: `bun run lint` ✓ · web-landing / web-stats `tsc -b` ✓ · `bun test` 152 ✓ · web-landing `test:components` 8 ✓ · web-stats 13 ✓ · E(web-landing) 3 passed (60 s) ✓ · E(site) 2 passed (1.1 min) ✓.

**Round 3** (resumed, the round-2 fix commit under review). Verdict, quoted: "No new material findings; the remaining round-1/2 material findings are resolved. Confidence: high." One comment-only correction (the `networkRate` docblock had stayed above the new `rateSample`; moved). Codex exercised the real `watchChain` failure path (false → true → false), `rateSample`'s membership against the caption, the privacy copy and the earlier fixes; "29 targeted tests passed".

Arc 4 loop: three rounds (10 → 3 → 0 material findings). Session `01a07676-4a25-76a2-83ab-bd88286fa6a3`, files in `~/.cache/tmp/codex-0gu0L4i6`.

## Final cross-arc pass (2026-09-06)

**Round 1** (`/codex xhigh`, a FRESH session `01a07695-238a-7e61-a220-c748b6189c31`, `run-codex.sh` on the net diff `f2bf7a6..HEAD` with the arc map, the plan, all five lessons files, the four explicit asks (seams, duplication, drift, the whole-origin posture) and both rules; files in `~/.cache/tmp/codex-4rhHqQk7`). Verdict: "changes required: one CI blocker and several integration gaps; no critical exploit identified"; nine findings, all verified and accepted, plus a comment audit. Fixed in one commit:

- **`site.yml` ran `bun run lint:actions` on a runner without actionlint** (P1): the step is gone; `actionlint.yml` (Docker image) covers workflow changes.
- **The miner bypassed the reader's timestamp bound**: `readOpenEpoch` (miner-core `epoch.ts`) passed `opened_at` unchecked and the rail's `toISOString` threw on 2^63. `assertTimestamp` is the one bound (reader rows, genesis, the miner's epoch view).
- **The miner's bun suites had no CI consumer** (Vitest excludes `*.bun.test.ts`): `web-miner.yml` runs `bun test packages/web-miner`.
- **The stats closing block kept the absolutes** the landing had dropped: qualified the same way (first-claim handshake, public withdraw).
- **Host rules stopped at the miner**: `host.ts` moved to `packages/site/src/browser/`; the stats and landing entrypoints redirect the `pages.dev` alias and all three shells show the preview notice from one `previewNotice`.
- **A failed slot fetch discarded the landing's fixed reads and the poll never started**: `readLive` keeps open / supply / block with a `historyError`; `watchChain` installs the poll after a failed first read (only a failed deployment check stops it). Vitest on `readLive`.
- **The standalone stats linked `//mine/`** (another host): `/mine/`, the origin's root.
- **A restored thread setting bypassed the slider's clamp**: `clampThreads` in `boot.ts`.
- **The miner README and `CLAUDE.md` described the standalone deployment** (`.env.production`, `public/_headers`, `wrangler pages deploy`): rewritten for the assembled site.
- Comments: two narrating summaries deleted, the `prover` flag's doc, `forgetMaster`'s doc, the one-origin constraint at the top of `headers.ts`.

Gate after the fixes: `bun run lint` ✓ · `lint:actions` ✓ · every package's typecheck and the root's ✓ · `bun test` 154 ✓ · Vitest ui 33 / web-miner 33 / web-stats 13 / web-landing 10 ✓ · E(web-landing) 3 passed (1.1 min) ✓ · E(web-stats) 3 passed (55 s) ✓ · E(site) 2 passed (1.2 min) ✓ · E(web-miner) 11 passed (12.1 min) ✓.

**Round 2** (resumed, the fix commit `8f48bbb` under review). Verdict, quoted: "No new material findings; all nine round‑1 findings are resolved. Confidence: high." Three comment corrections applied (the `watchChain` note, `previewNotice`'s doc, a test fixture summary). Codex exercised the miner's `readOpenEpoch` at the bound, the three shells' host rules, the landing's failure → poll → recovery path and the CI change; "63 targeted tests passed".

Cross-arc pass: two rounds (9 → 0). Every codex loop of the plan converged: arcs 0 (3 rounds), 1 (3), 2 (5, the protocol's three-round threshold exceeded and logged), 3 (4), 4 (3), cross-arc (2).

## Post-delivery: Pages → Workers static assets (2026-09-06, owner's decision)

The stack merged (`c59b5c4`, five squash commits). Asked why `wrangler.jsonc` could not carry the domain the way a
Workers config does, the owner chose to host the site as a **Worker with static assets** instead of a Pages project:
Pages keeps build settings and domains in the dashboard (its wrangler file only names the output directory) and is in
maintenance mode; a Worker's `wrangler.jsonc` is the whole definition (`routes` with `custom_domain`, `assets`
directory, SPA fallback, `preview_urls`), applied by `wrangler deploy`. Changes: the site's and the apps' wrangler
files, `host.ts` without the pages.dev alias redirect (workers.dev and pages.dev names are previews), the site E2E
under `wrangler dev --assets`, `site:deploy` / `preview` scripts, docs. No Cloudflare credential exists on the
homelab: the deploy itself is the owner's (`wrangler login`, then `bun run site:deploy`).
