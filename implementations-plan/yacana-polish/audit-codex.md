# Codex audit — yacana-polish plan (2026-09-15, GPT-6 Astra at high, session 01a0a64d…, resumed after the contradiction check)

## Findings

1. **High · §3.2–3.3, P2 — Empty-slot login is impossible.** `reserve('login')` rejects an empty slot, and every assertion restricts `allowCredentials` to that slot. This prevents recovery on new devices and the retired origin; existing discovery deliberately omits that restriction (`packages/web-miner/src/session.ts:352–369`). **Fix:** distinguish opening an occupied slot from restoring into an empty one. Apply fingerprint matching only when a slot exists; cover passkeys and words.

2. **High · §3.3, P4, D3 — Production Retry has no retained ticket.** `submit()` retains a ticket only when `tamperNext` activates the canary branch; ordinary failures assign `null` (`packages/web-miner/src/controller.ts:582–589`, `:623`). Pausing alone does not implement Retry. **Fix:** retain ordinary retryable claims and their secrets, reconcile ambiguous submissions before retrying, and invalidate eligibility on epoch change, retirement or Start. Test an ordinary failure separately from the canary.

3. **High · §3.5, P4, D28 — Mining pruning cannot inherit bridge re-claim behavior.** Bridge recovery re-offers an Inbox message; mining requires the original epoch to remain open (`packages/contracts/yacana_miner/src/main.nr:188`, `:231`), and subsequent mining clears retained secrets (`packages/web-miner/src/controller.ts:477–481`). **Fix:** retain settlement identity and report pruning, but offer mining Retry only with an available, currently eligible ticket. Do not promise an unconditional re-offer.

4. **High · §3.2, §3.5, P6 — Health depends on polling that disappears.** The ten-second poll exists only while NodeTile is mounted (`packages/web-miner/src/components/NodeTile.tsx:22–53`); BridgeSession requires an opened account (`packages/web-miner/src/session.ts:455–460`). Moreover, a freshly received response from a lagging L1 RPC is not fresh chain evidence. **Fix:** own checkpoint sampling in session/public lifecycle, independent of Settings; validate chain/rollup and L1 head progression, invalidate samples on RPC changes, and define whether unknown preserves an existing pause. Never clear known lag merely because L1 became unavailable.

5. **High · §3.2–3.5, P7 — Expiry evidence has no enforceable provenance.** `rowState` accepts only a timestamp and `historyComplete`; it cannot distinguish imported expiry from locally observed transaction expiry. Recovery currently preserves non-final records (`packages/bridge/src/recovery.ts:172–174`), while `txByTag` returns only a matching log or absence (`packages/web-miner/src/bridge/session.ts:189–204`). **Fix:** strip imported expiry’s authority, retain local transaction provenance, and specify how history coverage is established. Anchor queries to a block hash using the existing `referenceBlock` capability; absent coverage remains checking.

6. **High · §3.2, P10, D10 — Version-specific flags would be inherited by continuations.** Flags are added to `BridgeRecord`, but `carriedBridge()` returns that entire object unchanged (`packages/deploy/src/bridge-block.ts:7–15`). A later version could inherit its predecessor’s stop/retirement. **Fix:** place lifecycle fields on the version-specific deployment record or explicitly strip and bind them during continuation. Validate identity and timestamps; require archive publication and verification of the updated old-origin build before node retirement.

7. **Medium · §3.2, P2, §7 — Reservation recovery and rollback remain unspecified.** Cancellation leaves staged records “recoverable, unlisted” without a recovery operation; abandoned reservations can block another tab. Additive storage changes alone do not ensure rollback: the existing store opens database version 1 explicitly (`packages/web-miner/src/keys/store.ts:44`). **Fix:** define reservation ownership, crash recovery, staged-record reopening and backward-readable storage. Test crash/reload, competing tabs and opening the database with the previous build.

8. **Medium · §3.5, P7 — Log windows do not bound total work.** `scanLogs` traverses every window (`packages/bridge/src/logs.ts:35–48`); a cold proof scan can monopolize the bridge refresh. Its starting `deployBlock` belongs to portal deployment, not necessarily rollup creation (`packages/deploy/scripts/l1-deploy.ts:149`). **Fix:** scan newest-first with a per-refresh request budget, adaptive range reduction and resumable cursor; use the rollup’s justified history boundary. Keep the timestamp observation separate from successful coverage through a recent L1 head.

9. **Medium · §3.5, P4, D27 — Cause recognition still overstates payment.** `"epoch is not open"` is checked during simulation, before proving/submission (`packages/contracts/yacana_miner/src/main.nr:181–188`); it cannot justify “the sponsor paid.” The canvas also promises a finality restart time that the controller merely estimates with a timer (`packages/web-miner/src/controller.ts:795–802`). **Fix:** distinguish pre-submission refusal from receipt-confirmed reversion and describe finality timing as an estimate; update the generator alongside the plan.

10. **Medium · §4, P7–P9 — Ethereum policy needs an explicit shared input contract.** Current standing reads span independent calls (`packages/bridge/src/portal-reader.ts:63–70`), and deposit canonicality is an additional contract condition (`packages/portal/src/YacanaPortal.sol:421`). **Fix:** specify block-pinned policy inputs, canonicality and action-specific restrictions; reuse `bridge/forms.ts` validation. Key ETH estimates by RPC generation as well as payer/chain/calldata, compare balance against estimated maximum cost, and preserve `pinnedSigner` on submission.

11. **Medium · P6–P7, P10 — Operations can straddle a node switch.** Existing switching drains only the mining controller (`packages/web-miner/src/boot.ts:219–226`), while bridge work has its own queue (`packages/web-miner/src/bridge/session.ts:145`). **Fix:** freeze new money operations, drain bridge polling/queue and controller together, then switch or roll back before releasing either. For metadata-only operator commands, dispatch before `operatorFromEnv`, which currently performs network access (`packages/deploy/scripts/bridge.ts:38`; `src/bridge/operator.ts:66`).

12. **Medium · §6 — Gates and adaptations do not fully match the changes.** P7 changes deposit recovery, but the browser case still immediately resumes an unanswered prompt and retires it when another deposit sends (`packages/web-miner/e2e/bridge-states.e2e.ts:101–121`). **Fix:** adapt and run that case in P7, including late settlement; explicitly update replay geometry’s 480-pixel assertion when adopting 440 pixels (`e2e/replay/dialog-geometry.replay.ts:22`). Add package typechecks, regenerate stats baselines when P10 changes rendered deadlines, and replace bundle-grep “fidelity” with rendered-state assertions.

## Facts

- Source files under `packages` and `scripts` are unchanged between `10f893c` and current `bc2a278`.
- §5 correctly identifies unconditional creation; §3.1/§3.5 still falsely claim exclusions already enforce slot ownership.
- D8 still says “>2 blocks,” contradicting §3.2’s “>1 checkpoint.”
- Checkpoint comparison and deadline equality amendments are supported; paused `other` needs finding 2’s implementation.

## Inferences

- Neither an empty log response nor a successful RPC proves complete/current history.
- Shared headers, presentation-only rows and a separate deadline module fit existing boundaries; do not duplicate form validators.
- Existing Presto packages have explicit minimum-age exemptions (`bunfig.toml`); preserve pins and do not describe the gate as universal.

## Asks

Keep owner decisions on legacy selection, landing navigation and the accessibility exception. Treat reservation recovery, RPC validity and checkpoint sampling as engineering decisions supported by tests. Reduced validation requires explicit authorization; a cheaper planning tier does not itself change the earlier gate requirement.

REVISE — repair recovery and Retry semantics, bound and validate chain evidence, isolate lifecycle flags, specify rollback-compatible storage, and align copy, phase tests and gates.