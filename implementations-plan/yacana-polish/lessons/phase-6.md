# Phase 6 — Settings and the node

Arc 3 (`polish-mine`). Built 2026-09-16, commit `3a715c9`.

## What was built

- **The health store knows the chain (§9.2.19, D33, D41).** `node-health.ts` keeps the node's tip (block,
  checkpointed checkpoint, the block's own time: read by the public epoch poll and the controller's refresh beside
  the epoch, `readTip`), the rollup's pending checkpoint from L1 (`recordL1`, counted only when the L1 head moved:
  a cached answer is not news), the deployment check's outcome, and a sticky `behind`: a fresh L1 sample (under
  60 s) that puts the node more than one checkpoint behind sets it, only a fresh sample that finds the node caught
  up clears it. `standing()`: throttled / silent from the transport, `behind` from the flag, `healthy` only with
  the deployment checked, a tip and a fresh sample, `unknown` otherwise (the row then shows the transport's word).
- **The L1 sampler** (`web-miner/src/l1-sampler.ts`): every 15 s, `getChainId` + `getBlockNumber` +
  `getPendingCheckpointNumber` on the rollup, its own viem client (retryCount 0) on the RPC in use, started by the
  session whenever the build carries an Ethereum RPC, signed in or out; another chain's answer is dropped; the
  guard admits the RPC whenever the build has one (not only with a portal).
- **The behind pause.** `PauseReason` gains `behind`; the controller subscribes to the store and pauses on the
  flag with the notice "node behind · The node answers, but its chain is 4 min old. Mining is paused; it resumes
  when the node catches up." (`notice-behind`), releases when it clears; the pill reads `paused`.
- **The node row (§5.7, board NodeStates).** Line 1 `Aztec node` + the chip (`healthy` · `throttled` ·
  `no answer · 2 min` · `behind · 4 min` · `checking` before the deployment check); line 2 the host with
  `· default` or `· custom` and "Use the default"; line 3 `block 83,117 · 12 s ago` with the state's sentence
  (throttled: "public nodes throttle busy pages; it recovers on its own · mining pauses if it lasts a minute";
  behind: "the node answers, but its chain is old · mining paused"; silent: "your view is from 14:02 · mining
  paused" with **Retry**); **Change** at the right (disabled, "set by the page URL", under a query pin). Change →
  the field with **Save** / **Cancel** and "Any https node on this deployment."; Save → the stepper ✓ Reachable
  0.6 s · ✓ This deployment · ● Switching "Rebuilding your view of the chain from the new node. Mining pauses until
  it's done." · about a minute; a refused probe stays under the field ("Not this deployment's node (it serves
  rollup N). Kept v5…"), a failed rebuild too ("Couldn't rebuild your view from my-node…: it stopped answering.
  Kept v5…"). The Ethereum RPC row is the same shape: `healthy` / `no answer` / `not asked yet`, line 3
  `Sepolia · 0.4 s`.
- **The switch's fallback.** `switchNodeLive` moves the handle back and rebuilds from the former node when the new
  node's rebuild fails, then throws `SwitchFailed(kept: true)`: "Kept …" is said only once the old view is back.
  If the former node fails too the prover is given up (`giveUp`) and `SwitchFailed(kept: false)` marks the session
  dead with the boot error's way out. `rebuildChainView(strict)` no longer abandons the prover itself.
- **Settings in six cards**: network (the two rows), mining power (the slider with "This slider affects browser
  proving only; one core stays with the page.", Presto's row "native prover, several times faster · checked when
  you start mining" / "not found" / "connected ✦" / the banner's reason, "Get Presto ↗", the three pauses), alerts,
  account (the address, its method, Stay open with "On: anyone who can use this browser could open and spend from
  this account without your passkey. Off: one touch per open.", **Sign out** through the hold dialog), appearance,
  about (source, build, bb.js, relying party, "Yacana runs in your browser. Whoever serves this page controls it;
  the source is public — run your own build if that matters." + "More on /faq"). Copy diagnostics is gone.
- The defaults (`defaultNodeUrl`, `defaultEthRpcUrl`) read the build's env live.

## Decisions taken while building

- **`behind` is the rollup's word, not the tip's age** (plan §3: an idle local network builds no blocks). The chip's
  suffix is the tip's age, what the user feels; the verdict is the checkpoint delta. Without an Ethereum RPC in the
  build (the non-bridge e2e builds) the standing stays `unknown` and the chip says the transport's word.
- **The controller follows the store's flag, not `standing()`**: a throttled node with a known lag would otherwise
  resume mining when the throttle lifted before L1 said the lag was gone.
- **`unknown` with the deployment checked shows `healthy`** (the plan's "the transport's word"); before the check
  the chip says `checking`.
- **The probe is one call** (`probeNode` asserts the deployment then reads the tip): the stepper marks Reachable and
  This deployment together once it answers; a refusal names which it was from the check's message (chain, rollup).
- **Retry on a silent node** brings the cooldown's deadline to now, so the gate's next request goes to the network
  as the recovery; it does not bypass the gate.
- **Presto's row before a probe says "checked when you start mining"; found but not yet proved says "found"** (the
  brief names four states; the fifth is the seconds between the probe and the first native proof).
- **The old origin's Settings** (board OldSettings) is P10's.
- **Two e2e titles added** (the behind case in `states.e2e.ts` with an L1 stub the page's sampler reads; the refused
  node in `switch.e2e.ts`), both proofless, in the inventory.
- P5's specs used jest-dom's matchers without its types: `tsc -b` failed on them; replaced with plain assertions.

## The gate

- Fast layers: lint clean; `bun test` green (the inventory at 19 + 1 + 1 + 2); web-miner Vitest incl. the four
  Settings and node-tile specs; `tsc -b packages/site packages/web-miner` clean.
- Runs, each alone:
  - `chain` proverless on `3a715c9`: 7/8 — the switch spec expected `· default` on the saved proxy A; the row
    says `· custom` for any saved URL (proxy A is not the build's default). Fixed in `a98e9f9`; rerun 8/8
    (the behind case 30.8 s; both switch tests; presto 3/3).
  - replay on `3a715c9` and `a98e9f9`: red twice. First the sampler reached Sepolia from the replay build
    (every e2e build carries site.env's RPC; the config requires a URL, so `VITE_ETH_RPC_URL: ''` cannot
    switch it off); then the recording lacked `aztec_getCheckpointNumber`. The sampler now starts only when
    the build carries a bridge record or the e2e query pins an RPC; the recording was re-recorded
    (`1b061e0`).
  - `chain` proverless on `1b061e0`: 8/8. replay on `1b061e0`: 4/4 (41.8 s).
- The pass conditions: `healthy` needs a fresh tip (the standing's test: no tip → `unknown`, the chip says
  `checking` before the deployment check); a failed switch never reports success (`switch.bun.test.ts`: the
  rebuild that fails on the new node is retried from the former one and rejects with `kept: true`; failing
  there too abandons the prover and rejects with `kept: false`; the refused-node e2e keeps proxy A).

## The arc-3 codex fix loop (§10)

Diff under review: the arc's diff against `polish-account` (P4–P6). `/codex high`, both verbatim rules in the prompt.

### Round 1 — REVISE (session `01a0a7f5…`), 16 findings; fixes in `fae1e4a`

| # | sev | claim | verified | done |
|---|---|---|---|---|
| 1 | high | `readRebuiltOnce(strict)` abandons the prover before the former node is tried | true | strict rethrows; `switchNodeLive` decides |
| 2 | high | a node switch drains the controller only; bridge operations can run across it | true | `hold()` + drain the bridge's queue before the swap; released in `finally` |
| 3 | med | Retry treats pending/unknown as "resend"; the observed hash can be lost | first true; hash: declined | `fate()`: landed / dropped / unknown (kept); reconciliation inside `track()`. The hash exists only when `send` resolves |
| 4 | med | a landed retained claim dispatches `retry` → a `submit` with no pending | true | `reconciled` event: the claiming state, no command |
| 5 | med | eligibility ignores the epoch; old Retry links target the newest retained ticket | true | `retryEligible` needs the open epoch; older links stripped on a new retained failure and on Start |
| 6 | med | the L1 head baseline survives an RPC change; late sampler answers land | true | `resetL1()` on `switchEthRpc`; the sampler drops answers from a replaced RPC or after stop |
| 7 | med | `sampleTip` has no view guard; `standing()` ignores the tip's age | guard: true; age: declined | `views` counter. The transport's word covers a stale tip (the same poll reads both) |
| 8 | med | behind → offline → online clears the notice while still paused | true | `nodePause` in the reducer; the standing pause's notice shows |
| 9 | med | the stale verdict can override an explicit reason | true | the chain is consulted only when the message names no reason |
| 10 | med | settlement never follows `{ moved }`; the newest eight starve the rest | true | the record's block follows; the batch rotates (`rotate`) |
| 11 | med | a stored thread change never reaches the Worker's lazy WASM factory | true | a `threads` message; module-level `wasmThreads` |
| 12 | med | "Kept" names a stale node (closure); `kept: false` reads as kept | true | `former` captured per save; a null `kept` says the former node failed too |
| 13 | med | the switch e2e proves a closed port, the behind e2e rewinds L1; the vitest atom assertion tests nothing | true | proxy `foreign` mode; the node warps to catch up (`aztecDebug_warpL2TimeAtLeastBy`); assertion deleted |
| 14 | low | the notice renders inside the loop tile | true | page level in `Mine.tsx` |
| 15 | low | copy departures from the generator | partly | restored: the bar on the epoch line, the legend's `claiming`, the placeholder's period, "Use the default". Kept: `✗ failed` (the ledger draws it), the rail caption (the generator's power tile has none), `mining power`, curly apostrophes |
| 16 | low | comments: a board reference, narrative headers, an obsolete "tampered" comment | true | fixed |

Fast layers after the fixes: lint clean, `tsc -b` clean, `bun test` 455 pass, Vitest 275 (ui 68, landing 14,
miner 109, stats 84). The chain shard rerun on `fae1e4a` (switch + states changed): see round 2.

The chain shard on `fae1e4a`: 6/8. The behind case passed under the real warp; the foreign-node test found
no error under the field (the proxy intercepted `node_getNodeInfo`, the SDK asks `aztec_getNodeInfo`: codex
round 2's #9); the lost-race case read the balance a refresh before the rebuilt note was in it (the spec now
polls until the balance matches the claims).

### Round 2 — REVISE, 12 findings; fixes in `867278b`

| # | sev | claim | verified | done |
|---|---|---|---|---|
| 1 | high | Retry races: two calls adopt twice; adoption goes on after a Start | true | serialised; identity, phase and `disposed` rechecked after the node's answer; `reconciled` before `minted` so the drain waits |
| 2 | med | the epoch gate hides a landed claim whose inclusion closed the epoch; a mined revert reads as unknown | true | the epoch is required only to resend; `fate()` says `reverted` and the revert's recovery runs |
| 3 | med | decline #3 was wrong: the wallet observes the hash before `sendTx` | true | `lastSent()` before and after the send; a failed send keeps the observed hash |
| 4 | med | decline #7 was wrong: the tip read is separate and its failure swallowed | true | `TIP_FRESH_MS` 90 s; `healthy` and the verdict need a fresh tip |
| 5 | med | the bridge hold leaves the refresh timer and a refresh in flight | true | `suspend()`: refuse, stop, drain the queue and the refresh; `resume()`; `switchEthRpc` refused mid-switch |
| 6 | med | `views` increments after `recover()`; the handle moved before | true | incremented before `recover()` |
| 7 | med | `recovered` clears a standing node pause's notice | true | `standingNotice(nodePause)` |
| 8 | med | the stale wording is categorical for an inference | comments: true; wording: declined | D27 and P4's lessons record the chain-read verdict as the owner's decision; a mined revert carries no reason on 5.2.0, so the neutral sentence would never name the stale case. Surfaced to the owner |
| 9 | med | the proxy's foreign mode intercepts the wrong method | true | any `_getNodeInfo` |
| 10 | med | URL equality misses A → B → A | true | a generation bumped by `switched()` |
| 11 | med | a `threads` message during the build is overwritten | true | `wasmThreads` set before the build's awaits |
| 12 | low | three comments assert false invariants | true | corrected |

Fast layers after the fixes: lint clean, `tsc -b` clean, `bun test` 456 pass, web-miner Vitest 109.

The chain shard on `867278b`: 8/8 (6.5 min; the foreign node refused under the field, the lost race's balance
polled, the behind case caught up under the warp).

### Round 3 — REVISE, 6 findings (the hard stop); fixes applied without a further consult

| # | sev | claim | verified | done |
|---|---|---|---|---|
| 1 | high | only the receipt lookup is tracked: the drain passes while the adoption is `claiming`; a hashless Retry resends after dispose or under a pause | true | the whole Retry runs inside `track()` (the drain waits for it, a switch refuses it); a resend needs no pause and no dispose |
| 2 | med | `retained` is cleared before `minted()` finishes: a note that fails to sync leaves nothing to retry | true | cleared only once the adoption succeeded |
| 3 | med | the wallet is shared with the bridge: the observed hash may be a bridge transaction's | true | `adopt()` requires the ticket's nullifier among the effects; otherwise the hash is dropped and the next Retry sends the claim |
| 4 | med | `start()`'s `finally` installs the timer after a suspension or a close; `resume()` after a close restarts it | true | `closed` / `suspended` flags; `schedule()` honours both |
| 5 | med | an RPC change's bridge reopening in flight leaves a node switch nothing to suspend | true | the reopening is tracked (`reopening`); the switch awaits it before suspending |
| 6 | med | an obsolete reading's `finally` clears the newer reading's `inflight` | true | cleared only when it is still the completing promise |

Codex on the round-2 declines: #8 (the stale wording for a chain-inferred revert) stays "an acknowledged
inference" to surface to the owner; D27 names reason-string verification. **For the owner:** a mined revert's
receipt carries no reason on 5.2.0; today the ledger says "the epoch closed first" when the chain's open epoch
has moved past the claimed one at the time the revert is seen. If that reading is too strong, the neutral
"it reverted" sentence is one line in `claimFailed` (drop the `epochClosedSince` branch).

The loop ended at the hard stop with round 3 REVISE: its six findings were small, verified races and were
fixed (this commit), but no round 4 was run, so nothing foreign has reviewed these last fixes. The arc's
journey run covers them end to end.

## The arc-3 journey (the owner's ask: every path, tested, before the arc ends)

On `a780013`, 2026-09-16 10:35 → 11:47, sequential and alone in tmux, every step exit 0:

| step | result |
|---|---|
| lint, lint:shell, lint:actions, five typechecks | clean |
| `bun test` | 456 pass, 39 skip |
| `test:components` | ui 68, landing 14, miner 109, stats 84 |
| `portal:test` (Foundry) | green |
| the miner's full e2e, real proving, Presto beside it | 20/20 (19.5 min) |
| shards: cockpit · chain · bridge (proverless) · canary (real) | 7/7 · 8/8 · 1/1 · 4/4 |
| replay | 4/4 |
| `rig -- all` | 13 pass: H0 the flip, bridge (exit forwarded and minted, deposit, redeem), deposit and the close, migration (retire, the continuation, forward from the archive), never-settled, skip-version, browser (V5 mine · exit · deposit · send ahead twice · recovery file → the flip → V6 restore · the holder's forward and claim · redeem), origin (one passkey across the apex and the old origin) |
| stats e2e · visual (8 renders) | 7/7 · 8/8 |
| landing e2e | 5/5 |
| `site:build`, `YACANA_APP_ROLE=old site:build`, site e2e under wrangler dev | green · green · 3/3 |

What this proves for the owner's list: bridge in (deposit → claim), out (exit → forward → mint), forward (send-ahead
held → forwarded by the holder and by the listed forwarder → claimed), mine, sign in, sign out, restore on both
origins, the node switch and its refusals, the behind pause, the lost race, the canary's refusal and mint.
