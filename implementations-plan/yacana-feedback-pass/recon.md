# Recon: yacana-feedback-pass

Base: `main` at `06b25d7` (the polish arc 7/7). One reuse-sweep explorer plus the driver's own greps (the
second explorer was blocked by the worktree guard; its sweep was rerun by the driver from the worktree). Two
explorer claims were wrong and are corrected below (marked **corrected**).

## Reuse map

| Capability needed | Existing code (or absence + search trail) | Verdict |
|---|---|---|
| Tooltip / popover primitive | None in `packages/ui/src/components` (dir listing; `grep -rniE "tooltip\|popover\|hovercard" packages` → only `web-stats/src/features/Bridge.tsx:57` `Term`, a hand-rolled button + `role="tooltip"` span). `radix-ui@^1.6.7` is already a `packages/ui` dependency and its `dist/index.d.ts` exports `Tooltip`, `Popover`, `HoverCard` (checked in the worktree's `node_modules`). | **build new** `tooltip.tsx` + `popover.tsx` on radix, in the `dialog.tsx` / `switch.tsx` wrapper shape (`data-slot`, `cn()`, flat exports). Justification: nothing to reuse; `Term` is stats-local and hover-only. `Term` moves onto the new primitive only if free (not in scope). |
| Persisted user settings | `web-miner/src/settings.ts`: one `localStorage` key `yacana.settings`, `DEFAULTS`, `BOOLEANS`, `parseSettings` (foreign values degrade per field), `settingsAtom` patch writer, `useSettings`. `Session.setStayOpen` writes outside React via `saveSettings({...loadSettings(), …})`. Sign out (`session.forget`) never clears settings. | **reuse-as-is**; one new non-boolean key with bespoke parsing, like `theme`. |
| Browser permission state (LNA) | None in our code (`grep -rn "navigator.permissions" packages/*/src` → 0). `@alejoamiras/presto-core` `dist/lib/presto-transport.js:144-168` queries `{name:'loopback-network'}` then falls back to `'local-network-access'`, only to classify an explicit denial; not exported. | **build new**: a 15-line `lnaState()` in `presto.ts` mirroring the SDK's two names, returning `granted \| prompt \| denied \| unknown`. |
| Presto probe / state / copy | `web-miner/src/presto.ts` (`probePresto`, `prestoAtom`, `prestoSticky`, `prestoEligible`, `noticeFor`, `PROVING`), `session.ts:852-885` (`startMining` → `reprobePresto`, `retryPresto`), `boot.ts:283` (`prestoFor`: the prover is built with Presto only if a probe already said eligible), `tx-prover` forced local while unprobed (`session.ts:717`). | **adapt**. **corrected**: gating `reprobePresto` alone is not enough. Four places hand out the endpoint: `startMining` → `reprobePresto`, `boot.ts:283` `prestoFor` (the Worker's endpoint; the Worker then registers Presto's URLs in its own guard, `prover.worker.ts:30-34`), the TxProver mirror (`session.ts:717`), and `retryPresto` (the banner's Retry). All four go behind one consent gate. |
| Presto surfaces | `features/PrestoBanner.tsx` (billboard web component after an `offline` probe; fix-it `Alert`), `RailTile.tsx` `PrestoRow` / `PowerRow`, `routes/Settings.tsx` `PrestoRow` + `MiningTile`, `prestoWords`. | **adapt** all four. The billboard stays (owner's answer), now only reachable after a consented probe. |
| Claim interval on the chart | No span is retained: `reducer.ts` `claiming()` sets `claim`, `claimed()`/`failed()` null it. Clocks: `samples[].t`, `winAt`, `sinceT` are `performance.now()`; `ClaimProgress.wonAt/since` are `Date.now()`. `claimed` and `failed` events carry `Partial<Clock>` (`t` available). `ScoreLoop` draws only ticks, wins, the bar. | **build new**: `claimSpans` on `MinerState` on the samples' clock (`t0 = winAt`, `t1 = e.t`), trimmed with `SAMPLE_SPAN_MS`; a `spans` prop + `drawSpans` in `score-loop.tsx`, geometry in `score-loop-model.ts`. |
| Canvas hover hit-testing | None anywhere (`score-loop.tsx` has no pointer handlers; web-stats charts are Observable Plot SVG with `Plot.tip(pointerX)`; landing diagrams are SVG). | **build new**: nearest-tick lookup in `score-loop-model.ts` (pure, tested), an absolutely positioned DOM tooltip over the canvas (not drawn in canvas, so it themes and is accessible). |
| Wins list data | `state.ts:73-81` `ClaimRecord {epoch, block, at, txHash?, nullifier?, settled?}`; **corrected**: it IS persisted: `main.tsx:55-82` loads/saves `yacana.claims.<chain>.<version>.<miner>[.<account>]` in `localStorage`. Today's list: `routes/Wallet.tsx` `WinsRow` + `WinsList`. | **adapt**: move `WinsList`'s rows into a dialog; delete `WinsRow`. |
| Read-only list in the 440 px dialog | `features/dialogs/Frame.tsx` `TxDialog`, `Foot`; every consumer is a form or a stepper, none a list. | **reuse-as-is** the frame; the list body is the existing `WinsList` `<ol>`. |
| Direction icons | `packages/ui/src/components/icons.tsx` (`Icon`, six hand-drawn names, 24 grid, 1.6 stroke). `lucide-react` is a dependency, imported directly in `dialog.tsx`, `sheet.tsx`, `toaster.tsx`. No arrow icons anywhere (glyphs `↗ → ★ ✓` instead). | **reuse** `lucide-react` (`ArrowDownIcon`, `ArrowUpIcon`, `ArrowRightIcon`), imported directly as `dialog.tsx` does. |
| Balance and its change | `balanceAtom` overwritten by `controller.readChain()`; `minted()` calls `refresh()`. **corrected**: Mine's `BalanceCard` already tweens with `useTweenedNumber`. `MinerState.minted {at, …}` stays fresh for `MINTED_FRESH_MS = 10_000`. `<Toaster/>` is mounted, no `toast()` caller. | **reuse-as-is**: the "+N · just now" line reads `minerAtom.minted` + `PARAMS.REWARD`; no new state. |
| Stepper | `packages/ui/src/components/stepper.tsx`. Consumers (`grep -rn "<Stepper"`): `dialogs/{FromEthereum,ToEthereum,Send,Claim,SendAhead}.tsx`, `account/Opening.tsx`, `components/NodeTile.tsx`, two ui specs. `detail` is passed on **pending** steps in every "How it works" screen (all-pending explainers), and on a **done** last step in `Send.tsx` (`send`) and `Claim.tsx` (`done`). `Opening.tsx` strips `detail` itself and prints one sub-line outside the stepper. `Preflight` is a separate component. No `stepper.vitest.tsx`. | **adapt**: new rail geometry for all; the "only the running step speaks" rule must spare explainers and a done last step (see plan D3). |
| Power slider | `power-slider.tsx` (`powerRange`, `clampThreads`, `powerLabels`, `mergedLabels`); consumers `RailTile.tsx` `PowerRow`, `Settings.tsx` `MiningTile`; spec `power-slider.vitest.tsx` asserts only the disabled state and "11 threads". | **adapt**: labels → preset buttons; `mergedLabels` keeps its job (two presets on one value merge into one button). |
| Activity row | `ui/src/components/activity-row.tsx`, `ui/src/bridge-types.ts` (`RowLine`…), `web-miner/src/bridge/rows.ts` (`ActivityRowView`, `unitOf`), `bridge/copy.ts` (`whoOf`, trail words), `features/ActivityList.tsx`, shared by `features/OldApp.tsx`. | **adapt** in place; one component, both origins. |
| Depositor of a found deposit | `portal/src/YacanaPortal.sol:124` `event Deposited(version, address indexed sender, …)`; `bridge/src/portal-reader.ts:304-310` drops `sender`; `web-miner/src/bridge/landing.ts:171` zero-fills `ethAddress`. `ethAddress` is required `HEX20` in the recovery file (`recovery.ts:89`), matched against witnesses (`recovery.ts:142`, `witness.ts:209-213`), read by `Claim.tsx`, `session.ts:427`. | **adapt**: carry `sender` through the reader and into the landed crossing; keep the field required (the recovery format is shared with the old origin's deployed build). Display treats the zero address as unknown. **Not** "make it optional" as the board said. |
| Dialog overflow check | `web-miner/e2e/replay/dialog-geometry.replay.ts` asserts `scrollWidth - clientWidth <= 0` for the page and `[data-testid=sign-in]`, on the account screens only, never on the opening checklist. `SignInDialog.tsx:223` is the only `overflow-y-auto` dialog. | **adapt**, **corrected**: that spec cannot reach the opening checklist (signed-out lane). The assertion reuses its `fits` helper from `e2e/opening.e2e.ts`; the fix follows the reproduction. |
| Plan-folder curated layer | `implementations-plan/lessons.md`, `follow-ups.md`, `archive/` did not exist (created at homing). `yacana-bridge/follow-up.md` exists; nothing in it touches these surfaces (`grep -n -i "presto\|stepper\|activity\|slider" implementations-plan/yacana-bridge/follow-up.md` → 0). | n/a |

## Tests that assert on what changes

| Surface | Files |
|---|---|
| Presto rows, billboard, copy | `web-miner/e2e/presto.e2e.ts` (all four tests rely on **Start mining probing by itself**: `presto:'on'` then `start` → `native`), `e2e/replay/signed-out.replay.ts:69-82` (fix-it row via a fake Presto), `src/presto-banner.vitest.tsx`, `src/presto-indicator.vitest.tsx`, `src/settings.vitest.tsx` ("Get Presto", standing words) |
| Epoch rows, loop header | `e2e/miner.e2e.ts`, `e2e/states.e2e.ts`, `e2e/canary.e2e.ts`, `e2e/replay/{setup,signed-out.replay}.ts` (`epoch-claims`), `src/cockpit.vitest.tsx`, `src/sign-in.vitest.tsx` |
| Stepper / deposit dialog | `e2e/bridge.e2e.ts`, `e2e/bridge-states.e2e.ts` (`deposit-done`), `src/bridge-features.vitest.tsx`, `ui/.../signature.vitest.tsx`, `ui/.../bridge-primitives.vitest.tsx` |
| Activity row / `whoOf` | `tests/activity-rows.bun.test.ts`, `ui/.../bridge-primitives.vitest.tsx` ("→ Ethereum", "Etherscan") |
| Slider labels | `ui/.../signature.vitest.tsx` ("eco ·" etc.), `src/presto-indicator.vitest.tsx` |
| `ethAddress` fixtures | `bridge/src/{journal,recovery,witness}.test.ts`, `web-miner/tests/bridge-{facts,reads,store,versions}.bun.test.ts`, `tests/activity-rows.bun.test.ts`, `src/{bridge-features,gallery}.vitest.tsx` |
| Wins on the Wallet | none by testid (`wins-row`, `wins-list`, `claims-history` → 0 hits in tests) |
| Layout order / bounding boxes on Mine | **corrected** (the first sweep grepped `boundingBox` and missed it): `e2e/miner.e2e.ts:78-117` `placed()` reads `getBoundingClientRect` and asserts the cockpit's child order `[loop, rail, kpis, stack]` and that the balance sits **under** the rail (`key.top > r.bottom`). D5·A inverts that; the spec is rewritten in the same phase (shard `cockpit`). |
| Opening checklist in a browser | `e2e/opening.e2e.ts` (shard `canary`) is the only lane that reaches it: the replay lane is signed-out only and fails on any spawned Worker (`e2e/replay/fixtures.ts:1-5`). The overflow assertion for F6 goes there, not in `dialog-geometry.replay.ts`. |
| Titles as identity | `e2e/proof-inventory.ts` enumerates every e2e title per file; a new or renamed title must be added or the shard fails. |
| Replay recording | `e2e/replay/recording.json` holds network only (0 copy hits); copy changes do not force a re-record, SDK or layout-fetch changes do |

Shards (`e2e/shards.json`): `cockpit` = miner, passkey · `chain` = states, switch, **presto** · `canary` = canary,
withdraw, words, opening · `bridge` = bridge-states. `bridge.e2e.ts` and `origin.e2e.ts` run through the rig.

## Collision / dedup risks

- Two Presto rows already exist (`RailTile.PrestoRow`, `Settings.PrestoRow`) with different anatomy. The ask, remembered,
  found, not-found and blocked states must be **one** component in `packages/ui` (`PrestoCard`) used by both, or the
  two will drift again.
- `web-stats` `Term` is a second tooltip implementation the moment `packages/ui` gets one. Left alone in this plan,
  noted in `follow-ups.md`.
- The score loop is drawn in two places (the tile and the pop-out `PipView`); spans and the single-path ticks must
  come from the shared draw code, not the tile.
- `prestoWords` (Settings) and the rail's row would each grow a state machine for the same `PrestoState`; one
  `prestoStanding(state, consent)` selector in `presto.ts` feeds both.
