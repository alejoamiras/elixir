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
