# Codex audits — yacana-second-pass

Foreign reviewer: GPT-6 Astra via `/codex`, effort `high`, read-only sandbox in the worktree.

## Round 1 — 2026-09-07 (session `01a07da6-026f-7e01-9918-38bd4f362d7b`, files `~/.cache/tmp/codex-zgA8YKRe`)

Packet: plan.md (outline A), outline-b.md, recon.md, CLAUDE.md, the named sources; the four asks (adversarial /
security, assumption attack, implementation critique, A vs B) and the gate check.

**Verdict: `reject`** (blocking: private-receive regression, inaccessible backup recovery, nonexistent deployment
claim, incomplete validation gates).

### Findings and disposition

| # | sev | finding | verified | disposition |
|---|---|---|---|---|
| 1 | High | Deleting `session.addSender` and the senders card breaks private receiving between Yacana accounts: the PXE finds a sender's notes only after `registerSender` (`withdraw.e2e.ts:22-34`, `session.ts:229-232`). | yes: the E2E registers A on B before A sends to B | **adopted**. The senders card stays, reworded and demoted: on the wallet page under the balance as "Expecting a private transfer from another Yacana account? Add their address so this account can find their notes." with the input; the test id stays. The Aztec 5 "constrained delivery" the owner cited applies to the sender's tagging, not to the recipient's discovery of a new sender. Surfaced to the owner as Ask 1. |
| 2 | High | Removing `Recovery` (`Wallet.tsx:12-35,216`) removes the only "back up now" entry while sign-out is disabled until backup: a dead end. Hold button: cancel on pointercancel/blur/hidden/unmount/disabled; suppress key repeat; an assistive alternative to sustained keydown; `aria-pressed` is a toggle semantic. | yes | **adopted**. The sign-out dialog's disabled state carries a "Back up the twelve words" button that opens the existing backup flow, then returns to the dialog. `HoldButton`: the cancel list verbatim; keyboard = hold Space/Enter with repeat ignored; an `aria-describedby` hint "hold for a second"; progress via `aria-valuenow` on `role="progressbar"` inside, not `aria-pressed`; assistive users get a second "Sign out" button revealed after the hold once (a plain button that appears when the hold completes, or immediately when `prefers-reduced-motion`), so the gesture is never the only path. |
| 3 | Med | Explorer: require an https base in production, encode path segments, validate identifiers (hex of the right length) so a lying node cannot craft odd paths; `config.ts:81` uses `||`, which turns the promised empty override into the fallback. | yes (`config.ts:81` `env[key] \|\| fallback`) | **adopted**: `explorer.ts` validates `0x` + 64 hex for addresses/ids/hashes and a positive integer for blocks, `encodeURIComponent`s, refuses non-https bases in production; the empty override is expressed as `VITE_EXPLORER_URL=off` (explicit, no `\|\|` ambiguity). |
| 4 | Med | "Copy diagnostics": the log carries raw exception messages (`controller.ts:499-502`, `session.ts`) and activity correlation; the grep proves nothing. | yes | **adopted in part**: the export is bounded (last 200 lines), redacts anything matching `0x[0-9a-f]{40,}` beyond the first 6 + last 4, and the button says "Copy diagnostics (last 200 lines; addresses shortened)"; clipboard rejection shows an inline error. The "activity correlation" point is inherent to a log the user chooses to copy; noted, not changed. |
| 5 | Med | Send: keep the snapshot through confirmation and the sent view; keep the public-balance assertion; keep the "refresh failure cannot fail a sent transfer" guarantee; "Mining resumed" must reflect controller state. | yes | **adopted**: the sent step renders the snapshot; the balance line reads the store, "Mining resumed" reads `miner.phase === 'mining'` and otherwise says "Mining is paused"; the E2E's public-balance assertion stays. |
| 6 | Med | Delivery: `gh stack sync` rebases and force-pushes before the plan's gates; `bun.lock` may carry unrelated moves; removing landing deps does not remove packages the miner still needs. | yes (`gh stack sync --help`) | **adopted**: order is `gh stack rebase` → fast gates → `gh stack push`; the lockfile diff is reviewed for unrelated version changes at P3.1's gate; the plan no longer claims a bundle shrink beyond the landing's own chunks. |
| 7 | High | Copy overclaims: the canvas drops the first-claim handshake qualification (`copy.ts` chain body) and says "who claimed" is private; "every number read from public storage" is false for derived metrics; "20 min cap" implies a deadline (`main.nr:192-207` allows arbitrarily late closes; only the retarget math is capped). | yes | **adopted**: the ledger's private column reads "who claimed (a first claim carries Aztec's delivery handshake, which someone who already knows that address can match)"; Verify's paragraph says "every number on this page is read or derived from public storage"; the duration rule and the table read "20 min · anyone may close it after this" and the `rolled` sentence "past the 20-minute mark". |
| 8 | High | The deploy script binds and launches; it never claims (`deploy.ts:145-175`). There is no launch-claim receipt; the isolated E2E deployment (`run-setup.ts:85`, `initialTarget: 1n`) does not produce one either without mining. | yes | **adopted**: `exampleClaim` is captured by a script, not the deploy: `packages/deploy/scripts/record-example-claim.ts <txHash>` reads the effect from the node and writes `exampleClaim {block, txHash, nullifier, noteHash, epoch, claims:[a,b]}` into the profile's record; the owner runs it once against testnet with a claim from the soak (a real-data `describe.skipIf(!AZTEC_NODE_URL)` test covers it); the landing renders the ledger only when the field is present and labels it "one claim, as the chain recorded it · epoch N" (the historical epoch, never today's counter, per finding 9). The isolated E2E asserts the absent-field rendering. |
| 9 | High | Mixing historical hashes with today's `a → b` counter fabricates an event; label it an example, never "the last claim". | yes | **adopted** (folded into 8): header "public · one claim, as recorded", rows nullifier / note hash / claims in epoch N `a → b` from the record. |
| 10 | High | The reducer keeps 60 s of samples (`SAMPLE_SPAN_MS`, `reducer.ts:130,150`); a 180 s window has nothing to draw. `attempt` clears `minted` on the next proof (`:169`), so a ten-second ✓ dies at the next proof (~6 s). `ScoreLoop height={48}` with 12 px padding leaves 24 px of plot. | yes | **adopted**: `SAMPLE_SPAN_MS` becomes 180 000 (memory: ~30 samples at 6 s); `minted` gets `at` and the slot keeps its ✓ for ten seconds from `minted.at` regardless of `attempt` (the reducer no longer nulls `minted` on attempt; `claimed`/`startJob` reset it); the pop-out strip takes `pad={4}` through a `compact` geometry (padding and font as props of the frame). |
| 11 | Med | Rail: reserve the slot's height and define state precedence (error vs stepper vs ✓ vs a new claim during the acknowledgement); grid stretch can still move the loop. | yes | **adopted**: the slot has `min-h-[72px]`; precedence notice > stepper > ✓ (≤ 10 s) > idle; a new claim replaces the ✓; the bounding-box E2E stays. |
| 12 | Med | `Chip href` + `LinkedHash` is right; keep shortening outside the generic component; `Segmented full` is unused once radio cards exist. | yes | **adopted**: `Segmented full` dropped from the plan; `LinkedHash` lives in `packages/site/src/browser/explorer.tsx` beside the URL builder (site, not ui), taking the short form as a prop. |
| 13 | Med | Tween: cancel RAFs, animate display values only, never round-trip bigint through floats into transaction inputs; PiP needs its own window for RAF/visibility; sticky `thead` needs the scrollport on the wrapper that carries `max-h` and both overflow axes. | yes | **adopted**: `useTweenedNumber` returns a display number; balances tween the formatted decimal, the send form reads the store; `ScoreLoop` takes `win?: Window` for the pop-out; the table wrapper gets `max-h-[460px] overflow-auto` (one element). |
| 14 | Med | Outline A, with corrected gates; B roughly doubles E2E time and moves the baselines twice. | agreed | **adopted**: A. |
| 15 | High | Root `typecheck` excludes the app and ui sources (`tsconfig.json` `exclude`); every gate must run each touched package's `typecheck`. P1.1 lacks tween tests; P1.2 needs retention/mint-expiry/PiP checks; P1.3–P1.4 must prove backup → sign-out and private receipt discovery. | yes | **adopted**: gates list per-package `typecheck`; the named specs added. |
| 16 | High | `PLAYWRIGHT_VISUAL_IN_IMAGE=1` only inside the image; class assertions do not prove sticky scrolling; `site.e2e.ts:71` tests the demo and must be replaced; network silence does not prove a prover-free bundle (inspect emitted assets); the isolated E2E is dispatch-only in CI. | yes | **adopted**: P2.2 gate states the env only in the image; a Playwright scroll assertion (`scrollTop` > 0 with the header still at the top); `site.e2e.ts`'s demo test becomes "the landing serves no bb.js or CRS and the miner still does"; P3.1's gate greps `packages/web-landing/dist/assets` for `bb.js`/`barretenberg`/`.wasm` and asserts none; the plan notes the E2E layer is run locally at arc boundaries (CI's `e2e.yml` is dispatch-only). |
| 17 | Med | Sign-out with other saved records lands on Welcome back (`KeyScreen.tsx:237`), not first-run sign-up; "synced by your platform" cannot be unconditional. | yes | **adopted**: the wallet note says "Signing out returns to the sign-in screen"; the sign-up copy says "a passkey on this device, synced where your platform syncs passkeys". |

Asks raised by codex and surfaced to the owner: (1) keep the senders card, reworded; (2) the example claim's
provenance (a soak claim the owner names); (3) the "back up first" path inside the sign-out dialog. (1) and (3) are
resolved by the adopted design; (2) needs the owner's tx hash before arc 3's E2E.

## Final fresh-context pass, round 1 — 2026-09-07 (session `01a07db7-0821-7540-bded-47736db0ada7`, files `~/.cache/tmp/codex-o3eWZj2Q`)

Packet: the revised plan, both audit transcripts with dispositions, recon.md, the four asks (adversarial, assumption
attack, implementation critique, contradictions and drift).

**Verdict: `reject`** (blocking: contradictory mint lifecycle, insufficient example-claim provenance, unsafe
rename-guard scope, incomplete validation gates).

| # | sev | finding | verified | disposition |
|---|---|---|---|---|
| 1 | High | The example claim's `a → b` read "at the block" can include later transactions; an arbitrary tx hash does not prove a claim against this deployment. | yes (`live.test.ts:177-228` shows the claim's own writes) | **adopted**: the script requires the effect's own writes to `claims[e]` and `last_digest[e]`, finds the ticket nullifier by value from the digest, and the file carries `miner`/`chainId`/`rollupVersion`, rejected at build time on mismatch. |
| 2 | High | The plain confirm "after the hold" arrives after `session.forget` reloads; timer completion is not WCAG up-event completion; eligibility must be enforced in both handlers. | yes | **adopted**: the hold commits on the release after the fill completes (abortable), an always-present "Can't hold? Sign out with a click" link swaps in a plain button, one `signOut()` re-checks eligibility for both. |
| 3 | Med | Diagnostics are line-bounded, not byte-bounded; URLs can carry credentials. | yes | **adopted**: 16 KB and 400 chars per line caps, URL userinfo/query stripped, described as a shortened log. |
| 4 | Low | Validate the class version, use safe integers, parse the base URL, render plain text when disabled or invalid. | yes | **adopted**. |
| 5 | Med (Facts) | `controller.ts:90-98` searches the ticket nullifier by value; index 1 is a fallback, not an ordering. | yes | **adopted** (Facts corrected; the script searches by value). |
| 6 | Med (Facts) | The miner's standalone build has base `/`; only the assembled build is `/mine/`. | yes (`web-miner/vite.config.ts`) | **adopted**: diagnose in both builds. |
| 7 | Med (Facts) | `setFixedTime` freezes wall time, not timers or rAF; the visual gate needs an explicit settled signal. | yes | **adopted**: `data-settled` on `<main>`, awaited by the visual spec. |
| 8 | Med (Inf.) | `<base href>` conflicts with `base-uri 'none'` (`headers.ts:30`); `fonts.check()` can be true for a face that never loaded. | yes | **adopted**: the `<base>` candidate dropped for absolutised `url()`s; the gate asserts a loaded `FontFace` and successful font resources. |
| 9 | Med (Inf.) | `axisTop` needs a visible-window contract (the reducer only trims on new proofs; the pop-out's window is shorter). | yes | **adopted**: the renderer filters by its own window before `axisTop`; empty → `2.5 × difficulty`. |
| 10 | Med (Asks) | The success criterion required a real linked claim while Ask 1 allowed shipping without one. | yes | **adopted**: the criterion now reads "a verified example when recorded, honest dashes when not". |
| 11 | High | `startJob` clearing `minted` defeats the ten-second ✓ because `start()` follows `claimed` at once (`controller.ts:482`). | yes | **adopted**: neither `attempt` nor `startJob` clears `minted`; `submit` clears, `claimed` replaces; the test drives claimed → start → attempt → expiry and claimed → submit. |
| 12 | High | The rename guard would catch `yacana-keys`, the AAD prefix `yacana-key:` and WebAuthn's `'public-key'` (`keys/store.ts:27,108`, `keys/passkey.ts:17`). | yes | **adopted**: the guard scans user-facing copy only, with an explicit exemption list of persistent and protocol strings. |
| 13 | Med | Neither tsconfig compiles `.tsx` under `packages/site`; `ProofLedger`'s `chain?: string` cannot carry links. | yes (`packages/site/tsconfig.json` has no `jsx`) | **adopted**: `jsx: react-jsx` in both configs, the site's `typecheck` in `TC1`; `ProofLine.links?: {block, tx}` rendered by `ProofLedger` as anchors. |
| 14 | Low | The stats extractions, `calm`/`geometry`/`win` are fine; the supplied window must own listeners and cancellation. | agreed | noted in the architecture (the `win` prop's contract). |
| 15 | High | Delivery still named `gh stack sync` in two places. | yes | **adopted**: `sync` removed everywhere; rebase → gates → push. |
| 16 | Med | P3.2's fixture state had no second build; P2.2's live deployment has one epoch and cannot prove overflow or the escape-hatch wording. | yes | **adopted**: two mandatory e2e builds in P3.2; the overflow, sticky and wording assertions move to the replayed 48-epoch fixture in P2.2. |
| 17 | Low | The rejected choices remain defensible. | agreed | no change. |

Round 2 is a resume of the same session over the revision diff (below).

## Final fresh-context pass, round 2 — resumed over the revision

**Verdict: `conditional approve`** (conditions: correct claim extraction, provide the overflow fixture, fix
retained-mint consumers, reconcile stale gate instructions). All five adopted:

| # | sev | finding | verified | disposition |
|---|---|---|---|---|
| 1 | High | The effect holds the **siloed** ticket nullifier and **public-data-tree leaf** slots; the script must use `ticketNullifier(digest, miner)` (`proof.ts:52-53`) and `computePublicDataTreeLeafSlot` (`live.test.ts:212-221`), and needs a captured-effect unit test. | yes | **adopted** verbatim. |
| 2 | Med | The visual fixture has nine epochs (`visual.e2e.ts:56`, `visual-setup.ts:68`), not 48; the overflow and escape-hatch assertions are unprovable on it. | yes | **adopted**: P2.2 re-records the fixture over a ≥ 20-epoch soak history with an escape-hatch close, regenerates the baselines from it. |
| 3 | Med | Retaining `minted` makes `pillStatus` (`status.ts:8`) show a stale `minted` after a stop; `submit` is a command, `winner` is the event. | yes | **adopted**: ten-second freshness applied in `pillStatus` too; `winner` clears `minted`; tests extended. |
| 4 | Med | "`gh stack rebase` (or `sync`)" survived in Post-implementation step 0. | yes | **adopted**: removed. |
| 5 | Med | The `HoldButton` and `SignOutDialog` specs still described timer completion and a "plain confirm after a hold". | yes | **adopted**: specs and E2E rewritten for release-based commit, early-release cancel, the independent click path, eligibility on both. |

Looks fine (codex): deployment-bound example and honest absent rendering; release-based sign-out with the shared
eligibility check; the rename exemptions, JSX/typecheck coverage, explorer validation and diagnostics limits; the
visible-window axis, the font verification, the mandatory dual landing builds.

**Final verdict carried to the gate: `conditional approve`, all conditions adopted in plan.md.**
