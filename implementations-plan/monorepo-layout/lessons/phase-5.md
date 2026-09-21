# Phase 5 lessons: the repository's name

## P5.1 In-repo references

`REPO` in `apps/web-landing/src/copy.ts` is `https://github.com/alejoamiras/yacana`, with its two assertions
(`e2e/landing.e2e.ts`, `src/sections.vitest.tsx`); the rename guard's `github.com/alejoamiras/elixir` exemption is
gone, so the old URL in a live file is refused from here on (history stays exempt by path: `implementations-plan/`,
`docs/pitch/`, the archived deployment record and its docs section). The rename itself is C2, owner-present, before
this arc's PR merges; until then GitHub redirects either name.

### P5.1 gate (2026-09-21)

| step | result |
|---|---|
| FAST | all ok; `bun test` 539 pass · 42 skip · 0 fail |
| `git grep -n "alejoamiras/elixir" -- ':!implementations-plan' ':!docs/pitch'` | nothing |
| the old URL put back in `copy.ts` | the rename guard **fails** (`apps/web-landing/src/copy.ts:17`); restored, 5 pass |
| `bun run e2e:agent -- bun run --cwd apps/web-landing test:e2e` | 5 passed (the footer link asserts the new URL) |
