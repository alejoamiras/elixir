# Phase 8 — The Wallet, and the sweep

## What shipped

- The Wallet's balance tile is the number and its buttons: `claims` and its sentence go; "private" in both
  balance tiles' headers is a `Tip` (`PrivateTip`). `WinsRow`, `WinsList`, the `wins` state, and `ActivityList`'s
  `wins` slot with its three callers (`OldApp.tsx`, `gallery.vitest.tsx`, `bridge-features.vitest.tsx`) are gone.
- `CLAUDE.md`: the consent record, the card, `Tip` / `Popover`, the `Wins` dialog; "the probe at cockpit-ready"
  (already untrue before this plan) is gone.

## Arc 3's codex loop (session 01a0c58b-bafd-7f13-974f-458370cc1ce9, GPT-6 Astra at high)

Started beside the first sweep. **Round 1** — "two material bugs, one minor, comment cleanup":

| # | Finding | Verdict | Why |
|---|---|---|---|
| 1 | Mine counted the upgrade card as a row above the cockpit whenever an account was open; the card draws nothing while no upgrade is announced, so the `1fr` sat on an empty fourth row and a tall right column stretched the rows before it (codex measured 121 px gaps for 14) | **accepted** | True, and mine: P7's `ROWS[above]` counted the mount, not the render. `useMigrationShown()` (the card's own first test) and the bridge session now decide. Spec: signed in, quiet upgrade → four children, the three-row template; fails with the old count |
| 2 | The pop-out's `Tip` portals into the opener: a radix portal goes to `globalThis.document.body` whatever root rendered it | **accepted** | I had raised it as an inference in the prompt; codex confirmed it against radix's source. `Tip` takes `container`; `PipView` passes its own body. Specs in an iframe's document (ui and the pop-out's view); fails without the prop |
| 3 (minor) | The wins dialog said "4 tYACA" whatever the profile | **accepted** | The mainnet profile's symbol is `YACA` |
| 4 (nits) | A drifted clause in `BalanceCard`'s doc, two narrating comments, `Tip`'s doc overclaiming | **accepted** | |

Fix commit c791ece. **Round 2** — one material, one minor, both about my round-1 fix:

| # | Finding | Verdict | Why |
|---|---|---|---|
| 1 | `disableHoverableContent` on every tip removes the pointer's travel onto the explanation (WCAG 1.4.13) on the main page | **accepted** | I had generalised a workaround the pop-out alone needs. Now only when `container` is given |
| 2 (minor) | In the pop-out a click leaves radix's pointer-down flag set (its `pointerup` listener is on the opener's document), so focus stops opening the tip | **accepted** | The cross-document trigger prevents default on `pointerdown`, which skips radix's bookkeeping. Spec: pointer down/up in the iframe, then focus opens; fails without the guard |

Fix commit 575332f. **Round 3** — verdict, quoted: "no new material findings"; codex checked in Chromium, with the
real component, that main-page tips stay hoverable, that click → tab away → refocus opens the pop-out's tip, and
that Escape dismisses it. Loop converged at round 3 of 3.

Rule for later: **a second `document` is not a second React root.** Providers travel with the root; portals,
`document`-level listeners and "is the pointer down" flags travel with the *global* document. Anything rendered
into a Document Picture-in-Picture window needs its portal container named and its document-level behaviour
checked (open, close, click-then-focus, Escape), in a real second document — an iframe is enough in jsdom.

## The first sweep was stopped

It was started on the phase's first commit (now a39e252) beside the arc's review; round 1's fixes touched `Mine.tsx` and `Tip`, which every shard
renders, so the run was stale and was stopped at its second cockpit test. The stop left three of the run's own
process groups behind (the Vite preview, the node proxy, the headless Presto); each was ended by its owned pgid
(SIGTERM) and the five ports confirmed free. The sweep below is the one that counts: one run, on the final tree.

(Hashes are the final restacked ones: arc 3 was rebased onto arc 2 after every arc-2 fix.)

## The cross-arc pass (session 01a0c599-5660-7ea0-94c2-7b13da001338, GPT-6 Astra at high)

The whole stack against `main`, each fix landed in the earliest arc it affects, arc 3 restacked after each.
**Round 1** — "one material revocation gap, three minor issues, and two cleanup nits":

| # | Arc | Finding | Verdict | Why |
|---|---|---|---|---|
| 1 | 2 | `revoke()` went through `post()`, which waits for the prover's `ready`: with initialization held, the Worker saw `init → mine → revoke` — a queued native job ahead of the withdrawal | **accepted** | The revoke is posted to the Worker directly; only the reconfigure stays ordered behind `ready`. Test with a held Worker; fails with the old path |
| 2 (minor) | 2 | `claiming` read as idle: the card fell back to "proves when you start" and both sliders unlocked while Presto proved the transaction | **accepted** | `mining = phase === 'mining' \|\| 'claiming'` in `usePresto`; `native` is one field both consumers read |
| 3 (minor) | 3 | The next claim cleared `miner.minted`, ending the mint line after one second | **accepted** | See round 2: the first fix (component state) was itself incomplete |
| 4 (minor) | 2 | Settings' slider said "power", not "browser threads" | **accepted** | The label prop existed since arc 1; arc 2 forgot to pass it |
| 5 (nits) | 1/3 | The odds rounded in two places; two narrating comments; `Tip`'s doc too long | **accepted** | `oddsOf(bar)`; comments deleted; the doc keeps its two constraints |

Fix commits b1752fb (arc 2) and ff5d050 (arc 3). **Round 2** — one material, one minor, one nit, all about round 1's fixes:

| # | Arc | Finding | Verdict | Why |
|---|---|---|---|---|
| 1 | 2 | A native `reconfigure` already queued behind `ready` was delivered after the direct revoke and rebuilt the prover on Presto (`init → revoke → reconfigure:native → mine`, consent false); its build read the epoch the revoke had already moved, so the guard passed | **accepted** | `post()` judges a message when it is sent: a native config without consent goes out with `presto: null`. Test: a forced native reconfigure queued, revoke, release → every reconfigure delivered carries no endpoint; fails without the guard |
| 2 (minor) | 3 | The mint line's component state was lost on a route change inside the ten seconds | **accepted** | No state at all: the line reads the newest record of `claimsAtom`. Spec unmounts and mounts the cockpit again |
| 3 (nit) | 2 | "A claim is proved by whoever mined" is false when the kernel prover falls back to WASM | **accepted** | The comment says only that claiming is not idle |

Fix commits 86cc853 (arc 2) and a527888 (arc 3). **Round 3** — verdict, quoted: "no new material findings"; codex
repeated both reproductions against the real controller, Worker loop and component (`init → revoke →
reconfigure:local → mine (WASM)`; the line survives the remount and ends at 11 500). Converged at round 3 of 3.
Accepted and said so: a reload inside the ten seconds shows "just now" again, which is still true.

Rules for later:

- **Authorize at dispatch, not at enqueue.** Anything that waits behind a promise (`ready`, a lock, a fetch) and
  carries a capability must re-read the permission when it finally runs. Moving the withdrawal to the front of the
  queue is half a fix; what was queued before it still holds the old answer.
- **A fix to a race gets its reproduction from the reviewer's trace, as a sequence assertion** (`init, revoke`
  first; every later `reconfigure` without the endpoint), not as a state assertion after the dust settles.
- **Derive "recently happened" from a record with a timestamp, never from component state.** Two rounds were spent
  on a line that only needed `now - last.at`.

## The sweep on the final tree

Seven gates in order, once, then the reruns each finding needed. Every failing gate was read to its cause before
anything was rerun; nothing was retried blind.

| Gate | First run | Cause | Final |
|---|---|---|---|
| cockpit (proverless) | 1 of 7 failed: the mint line still said "just now" fifteen seconds after the first win | The spec assumed the line ends while mining. At the easy target a win mints every few seconds and each renews it — exactly what round 2 asked for. The "ends" assertion now runs after Stop (8c72e43) | 7/7, twice |
| chain (real proving) | "use the browser": one `POST /prove/ultra-honk` reached Presto after the click (1 of 3 runs) | **A product bug, arc 2.** `PrestoWorkProver.prove()` checked its revoked flag in the continuation of `noir.execute`; a warm execute is one synchronous stretch, so a revoke posted during it was still an undelivered *task* when the *microtask* ran the check, and the witness left. Reproduced in `bun:test` with a `MessageChannel` message that revokes, posted right after `prove()` starts — the fake Presto received the witness. Fix (67f61c1): one `MessageChannel` round trip before the check; HTML delivers the never-transferred ports of a realm (the Worker's own among them) as one FIFO, so the revoke lands first. Test fails without the fix, 5/5 with it | 12/12 on arc 2's tip; 12/12 on the final tree |
| chain (real proving) | "a lost race": 5 nullifiers on the first claim where the spec expects 4 — 4 of 4 shard runs on arc 3, never alone, never on arc 2's tip | Not a flake and not the miner. The kept trace's effect has 9 public data writes against 4, the same 2 notes and 3 private logs: it is the claim that **closed its epoch**, and `record_claim` initializes the next epoch's `PublicImmutable`, whose initialization is a nullifier. Which claim this spec makes first depends on how many the Presto specs before it landed in the same epoch — arc 3's cockpit is faster to Start, so the count shifted by one. The spec reads the tile before Start and expects 5 exactly when its first claim is the N-th (d738871). This was the "5 nullifiers once" mystery of the polish plan's phase 12 | see above |
| canary (real proving) | ✓ | | ✓ |
| bridge (proverless) | ✓ | | ✓ |
| rig `browser origin` | ✓ | | ✓ |
| old-site build + `site:e2e` | 1 of 3 failed: `getaddrinfo ENOTFOUND v5.localhost` | Chromium resolves `*.localhost` itself; Node asks the OS, and this host has no nss-myhostname. The spec's Node-side requests go to `localhost` (9e4aa8b); the page still opens the versioned name | 3/3 |
| `lint:actions` | ✓ | | ✓ |

Fast layers (`FAST`: typecheck ×2, unit, components, replay) green on the final tree; `bun run lint:actions` exit 0.

The arc-2 fix landed after codex's round 3, so it went back to the same session as an addendum (response 4):
"no new material findings"; one nit — the helper's comment claimed all queued messages, where the spec's FIFO covers
only the never-transferred ports — fixed in 6a8c7a2 (comment only). Codex confirmed the ordering claim against
the HTML spec's unshipped-port message queue and I read the same section; it also noted the SDK does synchronous
work (base64, JSON) between the check and its fetch, a window the Worker's fetch guard closes on the next task
turn and which I accept as the instant-of-click concurrency.

Rules for later:

- **A one-in-three e2e failure with a request that should not exist is a product bug until proven otherwise.**
  Reading "1 of 3" as flaky would have shipped a consent leak.
- **A check after `await` is not a check after the event loop turned.** A synchronous stretch inside an
  `await`ed call leaves posted messages queued; a permission read there sees the world before them.
- **When a shard fails and the test alone passes, bisect the shard's history, not the code.** Kept traces plus
  the effect's shape (writes, notes, logs) named the closing claim in minutes; six bisect runs on commits had
  said nothing.

## The rebase onto the monorepo layout (2026-09-22)

`main` moved under the delivered stack by #54–#59 (flat `packages/*` → `apps/ packages/ protocol/ tools/`, every
cross-workspace import through `@yacana/*` exports, `scripts/run` → `tools/localnet`, `site`'s browser code and
`pinned-crs` into `web-kit`). #61 conflicted with `main` in 34 files; GitHub never computed #63's merge state.

Done commit by commit (`git rebase --onto`, 40 → 39 commits: two test fixes main had made itself were dropped,
the pre-rebase branches kept as `prelayout/arc{1,2,3}`), with three small tools: import-only conflict hunks took
the stack's names on main's specifiers (a union where main had sorted other lines into the block), whole new files
had their cross-workspace specifiers rewritten, the plan-folder index files kept main's entries with ours appended.
The rest by hand: `CLAUDE.md` (main's table, our two rows ported), one harness import block, one comment.

What the tools got wrong, all caught by the gates before anything was pushed: the codemod rewrote the app's own
`../bridge/env` to `@yacana/bridge/env` (typecheck + the export map); a duplicate-then-merged import in `RailTile`
(typecheck); `rerere` replayed a mangled multi-line resolution into `BalanceCard` (by eye — rerere was switched
off for the rest); the ↗ scan's roots pointed at folders that no longer existed and the test passed on nothing
(it now fails when a root scans no file); a Vitest mock reached `ScoreLoop` by file path (the boundary guard).
The old layout's build outputs (`packages/contracts/target`) were not where the new prebuild looks: one compile.

Gates on the rebased tip: fast layers green on each arc; the seven-gate sweep `ALL-GREEN`; codex (the same
cross-arc session, round 5) compared all 99 changed files after normalising moves: "no new material findings", one
doc nit fixed. Rule for later: **a rebase across a layout change is reviewed as a diff of diffs** (new stack vs new
main against old stack vs old main), and every automated resolution is checked by a gate that would notice a
dropped line — a test that scans a moved folder passes on nothing.

## Confidence checks on the rebased stack (2026-09-22)

The sweep ran on the tip only; the lower arcs had fast layers. Four checks closed that gap, each lower arc in a
throwaway worktree off its branch, the tip's worktree untouched:

| Check | Tree | Result |
|---|---|---|
| `bun run rig -- deposit` (the harness import block merged by hand) | arc 1 | 1 pass |
| `cockpit` shard, proverless | arc 1 | 7/7 |
| `chain` shard, real proving | arc 1 | 9/9, then 9/9 after the move below |
| `chain` shard, real proving | arc 2 | 11/12, then 12/12 after the move |
| `chain` shard, real proving, a second run | tip | 12/12 |
| PR titles within commitlint's header limit once GitHub appends ` (#61)` | #61 | shortened |

Arc 2's failure was the lost race opening on the epoch's closing claim: five nullifiers where the spec expected
four. `main`'s spec carries the same assumption; the fix had landed in arc 3 only, where the sweep found it.
It moved to the top of arc 1, the earliest arc that runs the spec, by plumbing (`merge-tree --write-tree` and a
signed `commit-tree` per commit, then `update-ref` with the old values), because the tip's worktree was in use
for a manual smoke test: no checkout, and the tip's tree came out identical. Arc 1's rerun then opened on a
closing claim too, so the fix is exercised on both arcs.

CI on the pushed stack: #62 and #63 green; #61's contracts job failed when the TXE died of an uncaught native
`Napi::Error` twenty tests in, every later test reading "Failed calling external resolver. client error
(Connect)". The layout PRs' contracts runs failed the same way twice on 2026-09-21; a rerun of the job passed.

Rules for later:

- **A spec fix found on the tip is checked against every arc that runs the spec**, not only where it was found:
  a lower arc passing once proves only that its shard's claims landed differently that time.
- **A TXE that dies takes every later test with it**: the first failure after a native abort is the only one
  that says anything; "Failed calling external resolver" on the rest is the resolver being gone.
