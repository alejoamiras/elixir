# Phase 2 — the miner's bridge functions, counters, logs, continuation constructor

## What landed

- `yacana_miner/src/main.nr`: six new storage slots appended after `open_epoch` (existing slots unchanged:
  `storage-layout.json` diff is additions only); the constructor takes `first_epoch` and `portal` (zero portal
  refused); `launch()` opens `first_epoch` with either the lottery seed (genesis) or
  `continuation_seed(source_last_seed, first_epoch, now)` (`bridge.nr`); `commit_launch` refuses a continuation;
  `claim` reads `retired` from the anchor header in private and `record_claim` re-checks it in public;
  `send_ahead`, `exit_to_l1` (private: `message_portal` + `burn_private` via authwit + enqueued `record_exit`),
  `claim_from_l1` (private, allowed after retirement), `retire` (public, secret `[0]`), `record_exit` (two
  public logs: `self.emit(ExitRecorded)` under the event's type tag and `emit_public_log_unsafe(exit_log_tag(...))`
  under the exit's own tag), `record_inbound`, the `bridge_state()` view.
- `yacana_miner/Nargo.toml` depends on `yacana_bridge_hashes`.
- 16 new TXE tests (70 total): burns via authwit and the counters, no-authwit and zero-amount refusals, claim from
  the portal (twice fails, other sender fails), retire (stops claims, arrivals continue, other sender fails, twice
  fails), `record_exit` only-self, the continuation's first epoch and seed, no lottery on a continuation, zero
  portal refused.
- `packages/deploy/src/deploy.ts`: `portal` required (`YACANA_PORTAL`), `continuation` override
  (`YACANA_CONTINUE_FROM=<source record>` reads the source's open epoch and seed through the read path; or
  `YACANA_CONTINUE_FIRST_EPOCH` + `YACANA_CONTINUE_SEED` once the source node is gone); `verifyOnChain` checks the
  portal, the first epoch and the seed; the record gains `portal` and `continuation`; `TEST_PORTAL` for local runs.
  Eight test/e2e callers pass `TEST_PORTAL`.

## Gate

`bun run contracts:compile` ✓ · `bun run contracts:test` 70 + 6 ✓ · `export-layouts.ts` (six slots appended) ·
`artifacts:commit` (the miner artifact refreshed: bytecode changed, as it must) · `spike:gates` (claim 30207,
claim_split 21076, verify_ticket 22951 — unchanged: the spike contract is untouched) · `bun test packages/deploy`
4 pass 1 skip · `bun run lint` + typecheck clean. Extra, beyond the gate: the reader's live test on the isolated
network deploys with the new constructor and reads the record back (result below).

## Lessons

- The TXE's `add_private_authwit_from_call` only works for a **contract account** (`create_contract_account`);
  with a light account the private call to the token fails with "Cannot sync contract …: its instance is not
  registered nor published" — the failing address is the light account itself, which has no code to answer the
  authwit check. The token's own on-behalf-of tests use contract accounts for the same reason.
- The TXE cannot list L2→L1 messages or public logs, so the burn tests observe the private balance and the public
  counters; the message contents are pinned by the P1 vectors and consumed for real on the rig (P5).
- `emit_event_in_public` / `self.emit` tag every log of one event type identically; a second
  `emit_public_log_unsafe` under the exit's own tag is what lets the owner find its exits in one query
  (`getPublicLogsByTags` returns 20 per tag per call).
- `AztecAddress.fromString` does not exist on 5.2.0's class; the parser is `fromStringUnsafe`.
- The 80-line function budget bit `deployYacana`; the record's bridge fields moved to `bridgeRecord()`.

## Consults

None: every choice followed plan.md §3.1 as written.
