# preview-keys — phase 1 lessons (2026-09-11)

## Plan loop (before code)
- Codex round 1 (session `01a09036…`, high): conditional approve. The material catch: the draft opened keys on
  *any* `*.workers.dev`, which is a stranger's copy of the bundle too. Fixed by naming the host: `<label>` +
  `VITE_PREVIEW_HOST_SUFFIX` from `site.env`. Also removed the "isolation" claim (words are portable) and the
  "hostname proves the trigger" argument.
- Round 2: conditional approve — same-account Worker ambiguity documented (the suffix names a namespace, not this
  Worker), unknown-host tests narrowed to the guarded paths (a known record's `open()` is unguarded today, on
  purpose), production-only suffix loading specified. site.env kept over a constant. Owner delegated all four asks
  to this loop; none went back.

## Facts found while implementing
- The real hosts came from the Cloudflare check run on `e7009f3` (`gh api …/check-runs`): version
  `252abc2b-yacana.alejo-amiras.workers.dev`, alias `e2e-lanes-proverless-yacana.alejo-amiras.workers.dev`.
  `wrangler whoami` gives the account, not the workers.dev subdomain; `wrangler subdomain` no longer exists.
- `workers.dev` and `pages.dev` are on the Public Suffix List (checked against the live list).
- Bun tests: `import.meta.env.X` is `process.env.X`, so the session test sets the two env vars and
  `globalThis.location = { hostname }` per test, restoring both after.
- `loadSiteConfig` sat at the cognitive-complexity limit: the suffix's mode ternary had to be a helper.
- A fresh worktree has no `packages/contracts/target`: the e2e lane's deploy needs `bun run codegen` and
  `bun run contracts:compile` with `~/.aztec/versions/5.2.0/bin` first on PATH (`~/.aztec/current` was on 5.1.0,
  see the shared-symlink memory).

## Gate
- `bun run lint` exit 0; `bun test` 333 pass / 10 skip / 0 fail; web-miner Vitest 70/70 (host matrix included).
- Cockpit e2e shard (miner ×5, passkey ×2): 7 passed in 6.3 min; `artifacts:commit` after the fresh compile showed no drift against the committed artifacts.

## Codex fix loop (session `01a09045…`, high)
- Round 1: one P2 — restoring `process.env.X = undefined` stores the string "undefined" in Bun; absent variables must be deleted. Plus comment cuts. Applied in `217d20b`.
- Round 2: approve, no new material findings. Converged in two rounds.
