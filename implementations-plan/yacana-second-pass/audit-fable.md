# Fable audit — yacana-second-pass

Same-family reviewer: a `Plan` subagent on Fable 5.1, read-only in the worktree, 2026-09-07. Packet: plan.md
(outline A), outline-b.md, recon.md, CLAUDE.md, the named sources; the four asks.

**Verdict: `conditional approve`** with five conditions: (1) rewrite the landing-ledger premise (no launch claim in
`deploy.ts`, the E2E deployment cannot record its own, P3.2's linked-block assertion unprovable as written); (2)
surface the `Senders`/`addSender` deletion as a functional regression; (3) per-app `typecheck` in every gate; (4) the
reducer changes the calm loop and the ten-second ✓ need; (5) fix the `site.e2e.ts` demo test and the arc-1 `Chip`
DOM-stability constraint. **All five adopted** (plan.md, Decision ledger).

## Findings and disposition

| sev | finding | disposition |
|---|---|---|
| High | Removing `Senders` breaks receiving private transfers (`Wallet.tsx:93-127` is the only path to `registerSender`, `session.ts:229-232`). | adopted: the senders row stays, reworded and demoted under the balance tile. |
| Med | Hold-to-confirm is weaker than the typed check and has a11y holes (timer completion, `event.repeat`, pointer capture / cancel, no non-hold path for switch users). | adopted: cancel list, `repeat` ignored, progressbar semantics, a plain confirm after a hold / under reduced motion / on keyboard-opened dialogs; the weaker guard is the owner's pick, recorded in Security. |
| Med | The sign-up copy drops the passkey-loss disclosure; Windows Hello / Linux passkeys do not sync. | adopted: "synced where your platform syncs passkeys … Lose every copy of the passkey and the balance is lost with it." |
| Low | "Copy diagnostics" links claims to a person; needs a caveat. | adopted: bounded, shortened, captioned. |
| Low | Add `explorerUrl` to `assertProductionConfig` (https only); the `source` chip links `REPO`, not the explorer. | adopted. |
| Low | Favicon under CSP fine; lockfile fine; renaming the adopted worktree branch would desync the manifest. | adopted: `gh stack init --adopt` keeps the branch name. |
| High (Facts) | "The deploy script captures the launch claim" is false (`deploy.ts:93-186` never claims); the nullifier/note-hash pick follows `controller.ts:81-99`. | adopted: `record-example-claim.ts <txHash>` from a real testnet claim; the ordering cited. |
| Med (Facts) | The pop-out font "fact" was promoted without a repro; Vite emits absolute `/mine/assets/…` URLs; try `<base href>` first. | adopted: diagnose first, two candidate fixes in order, evidence logged. |
| Med (Facts) | "`tsc -b` per app" vs the gates' root `typecheck`, which excludes the app sources (`tsconfig.json:21-26`). | adopted: `TC1` runs every package's `typecheck`. |
| Missing | `attempt` nulls `minted` (`reducer.ts:169`), the controller restarts mining after `claimed` (`controller.ts:482`), `SAMPLE_SPAN_MS` is 60 s, `NoticeCard` carries non-claim notices. | adopted: the reducer changes; non-claim notices stay under the loop; `ClaimSlot` precedence. |
| Missing | `site.e2e.ts:71-79` proves the demo and would fail P3.2. | adopted: replaced by "the landing serves no prover; the miner still does". |
| Inference | `exampleClaim` through `VITE_DEPLOYMENT_RECORD` is replaced wholesale in e2e builds; the isolated deployment has no claim. | adopted: its own file and `VITE_EXAMPLE_CLAIM`; the E2E asserts "—" and a fixture-populated state. |
| Asks | Keep sender registration? `POLL_MS` 15 s doubles load on the shared node? Where do "Back up now" and `PowerSlider` live? | answered: kept; poll stays 30 s; back-up in the dialog and the account tile; `PowerSlider` stays in the epoch tile under the claim slot. |
| High (gates) | P3.2 cannot assert a linked block without a claim in the isolated deployment. | adopted: "—" asserted in the isolated run, the linked state from a fixture. |
| Med | `Chip href` lies about its type and breaks arc 1 against the old stats baselines; one `ExplorerLink` anchor instead. | adopted. |
| Med | `ScoreLoop calm`: fixed axis and `pad` 24 leave a 48 px canvas no plot area; separate `drawCalm*` functions for the cognitive budget. | adopted: `geometry` prop, `axisTop`, `drawCalm*`. |
| Med | `ClaimSlot`: right place, wrong reuse claim (needs the reducer changes). | adopted. |
| Med | `exampleClaim` in the deployment record staples a miner's artefact to the deployer's identity and mixes time frames. | adopted: `deployments/<profile>.example-claim.json`, one transaction's values only. |
| Low | Sticky head loses borders under `border-collapse`; tween must clock on rAF and settle before the fixed-clock capture; `Segmented full` unused; `max` leaves dust at four places. | all adopted. |
| Low | The arc-1 `git grep` misses several phrasings; extend `scripts/rename-guard.test.ts` with a `\bkeys?\b` denylist minus allowed compounds. | adopted. |
| Low | `Observatory` and `Stats` sit near the 80-line cap. | adopted: `EpochRing`, `SinceOpened`, `ChartRows` extractions. |
| A vs B | A; B's benefit is void and its costs (seven E2E runs, two baseline regenerations, `Wallet.tsx` conflicts) are real. | adopted. |

Looks fine (Fable): `explorer.ts` as a pure builder; `RadioCards` on the installed Radix; `Dialog` as the sign-out
shell; discoverable passkeys make sign-out recoverable; the fixed-clock ring is safe; the visual gate commands and the
frozen install are real; `assemble.ts` keeps CRS/artifacts for the miner; no CSP change.
