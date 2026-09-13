# Phase 10 — docs, CI, records

## What landed

- `docs/bridge.md`: the four crossings, the turnstile stated plainly (no per-crossing delay; the cap a cumulative
  bound net of what came in, `ALLOWANCE + PER_HOUR × hours(launch → flip)`, frozen at the observed flip; the pause
  stops what comes after it and extends the deadline; the deadline ends a version at the later of the version after
  next and flip + 180 d), the forwarding rule and its reason, what a holder keeps (journal, recovery file, the words,
  the witness archive), what is public, the operators' powers and the script's command line, the record's blocks.
- `docs/upgrades.md`: the runbook as the rig's steps, every step an operator-script entrypoint (`set-forwarder`,
  `register`, `close-deposits`, `note-transitions`, `retire`, `forward`, `bun run deploy` with
  `YACANA_CONTINUE_FROM`, `YACANA_APP_ROLE=old bun run site:build`), the announcement as a site redeploy, the
  witness archive committed and served, the old origin kept until the deadline, the preview-first rehearsal and
  the post-merge production deploys; a table of which rig case exercises which step.
- `bun run bridge -- set-forwarder <address> on|off`: the one runbook step the script lacked (the rig listed its
  forwarder through raw viem calls); `packages/deploy/src/bridge/register.ts` gained `setForwarder`, the run helper
  every browser e2e uses (`run.ts`) now goes through it.
- The witness archive served with the site: `witnessFiles(repoDir)` in `packages/site/src/assemble.ts` copies
  `deployments/witnesses/<profile>.jsonl` to `dist/witnesses/<rollupVersion>.jsonl` for profiles that have a
  record; the miner's session reads an earlier version's witness from there (`archivedWitness`) when no node
  serves that version.
- `docs/threat-model.md`: eight bridge rows (forged exits, issuance from a compromised old version, mining after
  the flip, the operators and forwarders, front-running and griefing, the page, the witness archive, privacy),
  each with the Foundry test, harness case or suite that measures it.
- `docs/deployments.md` (the record's `bridge` and `migration` blocks, the L1 deploy's env, Sepolia not yet
  deployed, the versioned origin, the archive), `docs/roadmap.md` (P1–P11 and the deferred decisions), README
  (layout, the docs table, `bun run rig -- flip`), CLAUDE.md (rows for `packages/portal`, `packages/bridge`,
  `packages/harness`, the bridge in `deploy`, `site`, `web-miner`, `web-stats`, `web-landing`, `scripts/run`; the
  commands), `implementations-plan/index.md`.
- CI filters: `packages/bridge/**` in `web-miner.yml`, `web-stats.yml`, `web-landing.yml`, `site.yml`;
  `packages/portal/abi/**` in `web-miner.yml` and `web-stats.yml` (the apps import the ABI through
  `packages/bridge/src/portal.ts`). `contracts.yml` already filtered on `packages/bridge/fixtures/**`;
  `harness.yml` and the `rig` job of `e2e.yml` were P4/P5's.

## Gate

`bun run lint` ✓ (two unused imports left by P9 in `packages/web-miner/e2e/run-setup.ts` removed) ·
`bun run lint:actions` ✓ · `bun run lint:shell` ✓ · `bun test packages/deploy packages/site packages/bridge` 109
pass / 1 skip · root `tsc -p tsconfig.json` clean. Every runbook step names an entrypoint the rig exercised
(`docs/upgrades.md`, the last table): `set-forwarder` through the run helper the browser e2e uses; the rest
through `packages/harness/tests/*.bun.test.ts`.

## The arc-4 codex loop (plan §10 steps 2–3, on `git diff bridge-miner...HEAD`)

Run while P11's chain side was in flight (the Sepolia deploy and the testnet redeploy needed the owner's keys,
which arrived mid-way); P11's record and docs get their own look in the final cross-arc pass. Session
`01a09a85-b5e7-77a1-9cdd-656349b0b699`, `/home/homelab/.cache/tmp/codex-8HmqmZdQ`, `/codex high` on Astra.

- **Round 1** (`response.md`, 14 findings, every one verified by reading the code; fixed in `6459c53`): the
  served archive was matched by the miner's global exit index against the account's derivation index (a
  holder's first send could be exit 42), believed without a root check (a served file could push a crossing to
  `minted-l1`), and a miss was cached for the session; the runbook's V6 deploy could not reach `register` as
  written (the deploy writes `deployments/<profile>.json`, refuses an existing file and carried no bridge
  block); the assembler named the whole archive after the profile's current version; the docs promised that
  words alone find an unforwarded send on a gone version; the FAQ and stats said exits "wait, never refused"
  (the frozen cap and the deadline end them), the allowance was called a day of the schedule (it is 24 epochs'
  rewards), the pause bound "per pause" (per call, 60 d in total), the operators' registration power was left
  out, a prune refund was promised to the wallet at once, the retire step said "mining ended" from an L1 send,
  Verify showed the build's operators, three comments. Applied: all but the archive-based discovery on a fresh
  device (documented as deferred, `docs/roadmap.md`); `set-forwarder`'s comment kept.
- **Round 2** (`response-1.md`, 7 findings, all verified): the leaf was rebuilt with this build's miner, not the
  source version's (an authentic V5 witness could never verify on V6 — the rig's browser case had passed only
  because the V6 page took V5's witnesses from the recovery file); the runbook left the V6 build on V5's node
  URL (`site.env`) and V5's example claim (a production build refuses it — P11 hit exactly this); step 8 left
  the operator in the old checkout; a parsed archive without the entry stayed cached; "may leave right now" on
  the numbers row and the device clock deciding pause/deadline sentences; the archive's transaction hash taken
  as fact; stale operators labelled "(now)". Applied: `verifiedArchiveEntry` in `packages/bridge/src/witness.ts`
  (matched by fields, folded to the source Outbox root with the source miner from `reader.standing`, the
  crossing's index and hash kept; unit-tested with distinct miners and a global index of 42), the miss evicts
  the cache, the stats snapshot carries Ethereum's block time and every sentence takes `chainNow`, the row is
  "headroom under the limit", Verify labels a stale read, the runbook's steps 6 and 8 rewritten (the example
  claim and `site.env` move with the version; the old origin builds in its own worktree).

## Lessons

- Docs written from memory of the plan drift from the code: the first draft said the launch time was "within a
  week either way" (the portal allows a week behind and 90 days ahead), put the forwarder key in an env variable
  the script does not read (`YACANA_L1_FORWARDER_KEY` is the runbook's shell name; the script signs with
  `YACANA_L1_PRIVATE_KEY`), and cited a rig case number that does not exist (H8 for the closed deposit; it is the
  tail of H2). Every figure in `docs/bridge.md` was re-read from `YacanaPortal.sol` and `policy.ts`, every case
  from the harness file headers, before the files were kept.
- A runbook step with no script entrypoint is a step the rig cannot have exercised: listing the forwarder was
  done by raw viem calls in two places; the gate's rule ("every step names an operator-script entrypoint the rig
  exercised") turned it into `set-forwarder` and one function both the script and the run helper call.
- The worktree's Bash guard refuses `for` loops over paths that contain `git` (`.github`) and `sed` with a
  computed operand; one command per file, spelled out, passes.
