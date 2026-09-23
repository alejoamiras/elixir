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

## F9 — the depositor

- The plan named an "existing real-log test" for the portal reader's arrivals. There was none: the rig's
  `deposit` case now asserts `arrivals().deposited` against a real `Deposited` log (sender, amount, Inbox index).
  It needs CI's prerequisite order on a fresh worktree: `contracts:compile`, `codegen`, `portal:build`. Two
  runs died in `beforeAll` on missing artifacts before the assertion ever executed; a test that did not run is
  not a test that passed.
- `Claim.tsx` still prints `ethAddress` in two places: both are kind-1 only (the recipient the user typed), so
  the placeholder cannot reach them.
- The heal lives in `landed()`, applied to the **stored** row inside `adopt`, so a journal that is further along
  than the scan's picture keeps its state and only gains the address.

## Two test defects found by running the whole gate, not the file

- `bridge-store.bun.test.ts` (mine, from this phase) passed under `bun test` and failed `tsc -b`: a plain string
  where the journal types a hex hash. I had run the package typecheck before adding that test, not after.
  **The fast layers run as one script now, every time** (lint, both typechecks, unit, components, replay).
- `bridge-snapshot.bun.test.ts` (pre-existing) asserted the ciphertext does not contain `"48"`: random base64
  does, about one run in fifty. It now looks for the whole figure.

## Gate (2026-09-21, the full tree at 5fea9f3)

lint 0 · typecheck 0 · web-miner typecheck 0 · `bun test` 507 pass, 0 fail · components ui 72, landing 14,
miner 121, stats 84 · replay 4 passed · `bun run rig -- deposit` 1 pass, 11 expects. The scanning test was red
on five callers first; `recovery.test.ts` untouched and green.
