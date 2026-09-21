# Phase 5 lessons: the repository's name

## P5.1 In-repo references

`REPO` in `apps/web-landing/src/copy.ts` is `https://github.com/alejoamiras/yacana`, with its two assertions
(`e2e/landing.e2e.ts`, `src/sections.vitest.tsx`); the rename guard's `github.com/alejoamiras/elixir` exemption is
gone, so the old URL in a live file is refused from here on (history stays exempt by path: `implementations-plan/`,
`docs/pitch/`, the archived deployment record and its docs section). The rename itself is C2, owner-present, before
this arc's PR merges: GitHub redirects the old URL after a rename, never the new one before it, so a preview
built from this branch before C2 links to a repository that does not resolve yet.

### P5.1 gate (2026-09-21)

| step | result |
|---|---|
| FAST | all ok; `bun test` 539 pass · 42 skip · 0 fail |
| `git grep -n "alejoamiras/elixir" -- ':!implementations-plan' ':!docs/pitch'` | nothing |
| the old URL put back in `copy.ts` | the rename guard **fails** (`apps/web-landing/src/copy.ts:17`); restored, 5 pass |
| `bun run e2e:agent -- bun run --cwd apps/web-landing test:e2e` | 5 passed (the footer link asserts the new URL) |

## Arc 5 codex fix loop

### Round 1 (2026-09-21) — "no new material findings"

Codex (GPT-6 Astra, `high`, read-only, session `01a0c584-38f6-7bb0-a7b2-4e4170a7014a`) over `git diff
7735211..d895ac7`: no other live reference to the old repository name in workflows, package metadata, badges,
Wrangler configs, HTML/OG metadata or active docs; no split-name construction; C2 already covers the ordering.
Two non-blocking notes, both taken: this file had the redirect direction wrong (corrected above), and `bun.lock:6`
still names the root workspace `elixir` — pre-existing, exempt from the guard, no URL in it (`follow-ups.md`).
**Arc 5's loop converged in one round.**

## Final cross-arc codex pass

Fresh session `01a0c584-48c6-7751-bf32-2d659cfe068c` (GPT-6 Astra, `high`, read-only) over the whole stack,
`06b25d7..87ed343`.

### Round 1 (2026-09-21): "Changes requested: three material findings and one minor cleanup"

| # | Finding | Verified | Fix |
|---|---|---|---|
| 1 | `contracts.yml` is the only pull-request lane that runs `bun run site:build`, and its filter stopped watching what the build reads: the baseline watched `packages/site/**`, the moved tree watched neither `packages/web-kit/**` (the config, the headers, the Vite base) nor `deployments/site.env` | True. The guard only credited `bun test` and `test:components`, so a build was invisible to it | The guard counts `bun run site:build` as running `apps/site` whole, so the filter must cover the site's production closure, and a lane that builds must watch `deployments/**`. The filter now names `packages/web-kit/**`, `deployments/**`, and whole `packages/bridge`, `packages/miner-core`, `protocol/work-circuit`, plus `protocol/portal/abi/**` |
| 2 | The guard credits any `test:components` as the workspace's whole Vitest run without reading the script | True: `vitest run src/features` would have passed | A workspace's `test:components` must be exactly `vitest run` |
| 3 | `@import url(../x.css)` without quotes is valid CSS and the boundary guard's extractor missed it | True | The extractor reads quoted, `url("…")` and unquoted `url(…)`; a fixture test pins the three forms |
| 4 | Two lessons files named the reviewer's scratch directory | True | Removed; the session ids carry the provenance |

Replays, each red and then restored (`git status` clean but for the intended edit):

- `apps/web-stats` `test:components` narrowed to `vitest run src/features` → "test:components is "vitest run src/features", not "vitest run"".
- `@import url(../../web-stats/src/index.css);` appended to the landing's stylesheet → "apps/web-landing/src/index.css:4 reaches apps/web-stats/src/index.css by path".
- `contracts.yml` without `packages/web-kit/**` → "runs apps/site's tests or build, filter lacks packages/web-kit/**".
- `contracts.yml` without `deployments/**` → first replay stayed **green**: my rule covered workspaces only, and the env file is in none. Added the config rule; the replay then said "runs the production build, filter lacks deployments/**".

FAST after the fixes: status 0 (lint, the six typecheck steps, `bun test`, components). Where the fixes live: ledger D14.

### Round 2 (2026-09-21): "Changes requested: three remaining P2 guard gaps (high confidence)"

| # | Finding | Verified | Fix |
|---|---|---|---|
| 1 | Round 1's script rule accepted an absent `test:components`: the root's filtered run skips a workspace without the script, and the guard still credited its specs | True | A workspace with a `vitest.config.ts` must have the script, and it must be `vitest run` |
| 2 | The site's closure left the landing out: `apps/site` declared the miner and the stats as dependencies but not `@yacana/web-landing`, which the assembler builds and copies `og.png` from | True, and wider than reported: once declared, the guard named `site.yml` too, whose filter never watched `apps/web-landing/**` | `apps/site` declares the landing (`bun.lock` +1 line); `site.yml` watches it |
| 3 | Watching `deployments/site.env` alone satisfied the rule whose message asks for `deployments/**` | True | The filter must contain the glob itself: the profile's record and the witness archives are build inputs too |

Codex on D14: acceptable for an uninterrupted landing; my "no interval exists" was false, since `main` holds the
gaps between arc 2 and arc 5. The ledger row now says so and states the landing constraint.

Replays, each red and then restored: the miner's `test:components` deleted; `contracts.yml` without
`apps/web-landing/**`; `site.yml` without it; `contracts.yml` with `deployments/site.env` in place of
`deployments/**`. Round 1's four replays are still red.

**Lesson.** A rule's replay proves the one mutation I thought of. Both rounds' misses were the neighbouring
mutation (narrow the script → delete it; drop the glob → narrow it), so a guard's replay set should include the
absent and the narrowed form of whatever it requires, not only the wrong one.
