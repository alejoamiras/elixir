# Codex audit — yacana-fidelity

Session `01a078e4-520f-7c82-9dfd-b2c5efe85ae9` (GPT-6 Astra, xhigh, read-only; files in `~/.cache/tmp/codex-UzqcfWr9`).
The prompt carried plan.md, recon.md, the touched files and the live/binder screenshots (the sandbox could read the
images), with the adversarial, assumption-attack, implementation-critique and fidelity asks.

## Round 1

Verdict: **reject** (blocking findings: understated wallet exposure; nondeterministic, optional screenshot gate;
unsupported animation mechanism; weakened chart coverage). Eight findings; my triage after verifying each against the
code:

| # | finding | verified | disposition |
|---|---|---|---|
| 1 | `/stats/` shares the wallet's origin: a compromised Plot release reaches `yacana-keys` (IndexedDB) and can decrypt sealed masters with the non-extractable device key (use, not export); the CSP admits the node; "at most mislabel a chart" is false | yes (`keys/store.ts`: `DB_NAME = 'yacana-keys'`, AES-GCM device key in the same DB) | **adopted**: the Security section now states wallet compromise as the impact, the mitigations as probability-only, a separate stats origin before mainnet on the roadmap, and the owner's explicit acceptance as Ask 1 |
| 2 | the screenshot fixture is nondeterministic: `mockNode` forwards block reads, the page's clock is `max(block.timestamp, Date.now())`, addresses / SHA / ports vary; `clock.install` runs; platform suffix removal does not normalise pixels; the tolerance fallback hides regressions | yes (`Observatory.tsx:55`, `helpers.ts` forwards, `e2e.yml` dispatch-only) | **adopted**: a fixture-only spec (recorded RPC, `setFixedTime`, fixed record, fonts awaited, animations off, full page, zero tolerance beyond anti-aliasing, no masks); the tolerance fallback deleted |
| 3 | the gate is not enforced: `e2e.yml` is dispatch-only; a PR can replace baselines or enlarge masks | yes | **adopted**: the visual spec runs in `web-stats.yml`'s PR gate (no node needed), missing baselines fail, updates are explicit and reviewed as images |
| 4 | figure-level `data-count` / `data-tone` pass with empty charts; Plot supports per-datum `ariaLabel`; jsdom cannot assert geometry or tooltips | yes (Plot's `ariaLabel` and `className` channels in `style.js`; my own probe had used them wrongly) | **adopted**: tests count real marks through `ariaLabel` / `className`; tooltips and layout asserted in Playwright; closed-only charts never claim an open-epoch halo |
| 5 | chart semantics: capping durations at `T_MAX` turns the fixture's 26 136 s into 1 200; emission's time axis undefined; difficulty should be a step; retarget baseline 1 | yes | **adopted**: log-scale real durations with `T_MAX` as a rule, elapsed-time emission from the oldest loaded row, step-line difficulty, `y1: 1` retarget, domain guards |
| 6 | per-mark keyed transitions do not exist across `Plot.plot()` re-renders | yes | **adopted**: the whole-figure cross-fade is the mechanism, only on row-set changes, never on the freshness tick, instant under reduced motion; the hook owns measurement / resize / replacement / cleanup |
| 7 | `Section` presets cannot place headings in the left column; double insets (padded page + padded frames); the KPI size unstated; `WalletCard` has no Withdraw / Receive; a second record formatter | yes | **adopted**: thin `Section` wrapper with local compositions; 1120 outer with the inset applied once; `Kpi size="lg"` named; the key tile's buttons navigate to the wallet route; `VerifyTile` reuses the Verify route's formatting |
| 8 | P1.1's shared changes reach every surface, so miner-only screenshots cannot validate that PR; `gh pr edit` cannot upload images; post-sync reruns | yes | **adopted**: every surface (miner cockpit / key screen / wallet / settings, landing, stats) is rendered and reviewed at P1.1; screenshots are committed under the plan dir and linked by raw URL; the fast gates rerun after `gh stack sync` |

Assumption attack: Plot **does** inject a `<style>` (Fact 4 corrected) and hard-codes `font-family="system-ui"` on the
SVG (theming through Plot's `style` option and explicit mark colours); drift is five values, not two (tile radius 10 vs
8, `md` KPI line-height 1.2 vs 1.1, unit tone); `ScoreLoop`'s `hero` prop is already used by `Demo.tsx` (recon
corrected); the reader bounds fields, not their order (domain guards added). Inferences re-rated: theming high,
per-node transitions unsupported (replaced), cross-machine pixel stability low (the arc-3 PR's CI run is the test,
with baselines from CI as the fallback), the intermediate miner composition moderate (judged on screenshots). Four
Asks surfaced and recorded (wallet-origin risk, the meaning of "dynamic", intermediate / mobile compositions, baseline
ownership).

Fidelity judgment adopted as the "Fidelity decisions" table: desktop proportions matched; the binder's fabricated
numbers, example hashes, histogram and older privacy copy never copied; "recent epochs" wording kept; no seven
viewport-height screens; no six cramped mobile KPIs; the demo's proving / error states preserved; restrained
refresh motion.

Rejected: nothing. One note: codex's "keep retarget replacing inter-claim timing" agrees with the surfaces plan's
ledger.

## Round 2 (resumed, the revised plan)

Verdict, quoted: **"conditional approve (with conditions: make the visual runner independently executable, correct
Plot's mark/scale contracts, pin the rendering environment, and resolve the owner Asks)."** Seven conditions; my
triage after probing the Plot claims against the installed 0.6.17:

| # | condition | verified | disposition |
|---|---|---|---|
| 1 | the node-free visual runner has no build path: Playwright projects share the config's `globalSetup` (which deploys contracts), `assemble()` builds all three apps and fetches CRS / artifacts, the prebuild generates 512 chunks, `VITE_SOURCE_COMMIT` is ignored by the site config | yes | **adopted**: its own `playwright.visual.config.ts` (no global setup) and `visual-setup.ts` (stats-only e2e build into `e2e/.visual-dist`, the layouts fixture and chunk 0 only, a fixed commit through a new e2e-mode override, an owned port and teardown); unexpected RPC requests fail |
| 2 | zero-tolerance reproducibility: the lockfile pins Chromium but system libraries move; `threshold: 0.2` is a perceived-colour tolerance, not anti-aliasing | yes | **adopted**: baselines recorded and checked in the pinned `mcr.microsoft.com/playwright` image locally (Docker) and in CI; `threshold: 0`; P3.3's gate proves three deliberate regressions fail |
| 3 | `barY` on a log scale draws nothing without an explicit positive `y1`; escape-hatch annotations must use the observed retarget (saturation at `U128_MAX` eases by less than ×4) and sit at the successor boundary | yes (probe: 0 rects implicit, 3 with `y1`) | **adopted**: `y1: 10` baseline with hollow markers for invalid durations; annotations from the row's retarget at the successor boundary |
| 4 | `className` is a constant on the mark's `<g>`, not per datum | yes (probe: `g.bar` 1, `rect.bar` 0) | **adopted**: separate marks for `roll` / `claims` / `halo` / `point`; tests count the labelled children |
| 5 | Plot accepts CSS variables (`fill: var(--uv)`, `--plot-background`), so reading `DARK` once would break the light theme; `background: transparent` does not set the tooltip fill | yes (probe: variables pass through) | **adopted**: theme through variables in Plot's `style` and on every mark; `--plot-background: var(--panel)` |
| 6 | the cross-fade needs an explicit figure height, an inert outgoing SVG, removal on end / interruption / unmount, and a redraw-vs-animate split (claims change without a new epoch; selection and resize redraw at once) | yes | **adopted** |
| 7 | benchmark the visual job against the 15-minute budget; upload diff artifacts; capture intermediate and mobile layouts | yes | **adopted**: a clean-checkout timing in P3.3's gate, artifacts on failure, 1024 and 390 captures beside 1280 / 1440 |

Stale wording removed ("`Kpi` unchanged", the dispatch-only visual run). The four Asks stay for the owner at the
approval gate. Rejected: nothing.
