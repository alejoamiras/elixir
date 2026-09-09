# Phase 4 — docs and close, then the codex loop and the delivery

Started 2026-09-09 after P3.

## Log

- **Docs**: the threat model gains the "Local prover (Presto)" row (what it sees, what it cannot, the residuals,
  the guard's class, HTTPS only in production, the banner as constrained third-party code) and the Web page /
  Supply chain rows name the banner and the min-age exception; `CLAUDE.md`'s package table and commands, the
  miner README's step 5 and the plans index carry Presto.
- **The canvas in the repo**: the eleven artboards are committed with `@font-face` sources pointing at the repo's
  own fontsource files by relative URL (open them from a checkout); the generator beside them (`build-canvas.py`)
  reproduces the published form with `--embed`, which inlines the two woff2 files as the artifact carries them.
  Committing the embedded form would have been 1.1 MB of duplicated base64.
- **Renders**: the six 1280/1440 PNGs from the green e2e run live in `renders/` for the PR body and the codex loop.

## The codex loop

(rounds logged below as they run)
