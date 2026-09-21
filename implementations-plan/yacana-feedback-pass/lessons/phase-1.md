# Phase 1 — links, words, the zero address

## Before P1: the baseline was not green on this machine (2026-09-21)

`bun test` at the repo root failed twice on the untouched base. Neither was a product bug; both were found
because the gate is the root `bun test`, which CI never runs (every workflow runs it per package).

| Failure | Cause | Fix |
|---|---|---|
| `work-circuit/src/vk-pinning.test.ts`: `aztec-nargo: command not found` | The pinned toolchain is installed (`~/.aztec/current/bin`) but no shell profile on this machine puts it on PATH | Environment, not code: gates run with `PATH="$HOME/.aztec/current/bin:$PATH"` |
| `web-stats/tests/history-transport.bun.test.ts`: 5 s timeout, only inside the full run | One `bun test` process is one realm. Any suite importing `presto.ts` installs the fetch guard at import (`site/src/browser/node-guard.ts:332`); the stats test's request to its own `127.0.0.1` server is then refused, the SDK client retries, the test times out. Bisected: each of the five `presto*.bun.test.ts` files reproduces it alone | The test leases its server with `allowCandidate` (three lines). Same measurement as before: 147 methods in 21 HTTP requests. No skip, no timeout change |

**A trap worth remembering**: the first baseline run was piped through `tail` and the harness printed
`exited with code 0` with two tests failing: that was `tail`'s status. Gates now run through a wrapper that
writes the full log to a file and prints the command's own exit status (`GATE[name] EXIT=n`). A gate's
"exit 0" is only evidence when nothing sits between the command and the status.

Also: the shared Playwright browser directory (`/opt/ms-playwright`, root-owned) held only Chromium 131;
the build Playwright 1.62.1 pins (151) was installed into it with `sudo`.

## F1 — the doubled arrow

The scanning test (`tests/external-link-arrows.bun.test.ts`) went red on exactly five callers, then green.
The three hand-rolled anchors the plan listed (`SendAhead.tsx`, `dialogs/Wallet.tsx`, `OldTabNotice.tsx`)
each carry **one** arrow, their own: they were never doubled and are left alone.
