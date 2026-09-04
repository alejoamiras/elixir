# Contract hardening pass (2026-09-04)

Owner's ask, after the Phase 5 hand-off: "run a harden security on the smart contracts … be adversarial and
harden the smart contract", then "make an exhaustive adversarial evaluation of the smart contracts". Scope: the
miner contract (`packages/contracts/elixir_miner`), its retarget and ticket modules, the work circuit's public
inputs and the in-circuit verifier boundary, the token binding, and the client behaviour the contract relies
on. Method: own review first, then a fresh codex session (xhigh, read-only) briefed to break every surface,
resumed until it reported no new material findings, with every adopted change re-tested (TXE, live suite on
an isolated network, web E2E on a production build).

Codex session `01a06c8c-5e83-7772-a4f4-b3b80e383757` (transcripts under the session's scratch dir; the
verdict lines are quoted below).

## Own review (before codex)

Held up: `only_self` recorder, internal closer, count cap and same-block orderings, roll vs close ordering,
canonical `low128`, exact retarget with range-checked hints, `actual ≤ T_MAX`, full-digest nullifier, public
inputs bound through Fiat–Shamir so the ticket over proof fields alone is binding, ZK-flavour proofs excluded
by length and type, `PublicImmutable` initialization nullifier making `bind_token` one-shot (verified in
aztec-nr 5.2.0), token minter check on mint.

Found: (1) a claim only needs an anchor block where its epoch was open and stays valid for `MAX_TX_LIFETIME`
(one day), so cheap work against an old, easier epoch could be submitted to revert at a fee sponsor's
expense — fixed with a claim TTL (`set_expiration_timestamp(anchor.timestamp() + CLAIM_TTL_SECONDS)`), which
also turns such claims into drops the PXE recovers from on its next sync instead of reverts it waits on
until L1 finality; (2) the plan's "premine bounded to `N × REWARD`" claim was false — every later seed depends
only on the deployer's own closing digest and a slot-derived timestamp, and a deployment nobody knows about can
be mined alone at flat difficulty.

## Codex round 1 — "FIX FIRST — direct forgery/accounting paths held up, but fair launch and fee sponsorship remain exploitable."

| # | finding | decision |
|---|---|---|
| 1 | HIGH unbounded deployer premine (a slow premine keeps difficulty flat; my `4^k` bound only covered fast closes) | `launch_at` constructor argument; `claim` asserts its anchor block is at or after `epochs[e].opened_at`; `roll` likewise; announced bootstrap documented (`docs/deployments.md`) |
| 2 | HIGH TTL narrows but cannot close sponsor griefing (any reverting public call drains a general sponsor) | TTL kept (600 s testnet / 1800 s mainnet, `CLAIM_TTL_SECONDS` profile parameter, exposed by `constants()`); fee policy recorded as a mainnet requirement (threat model, roadmap); forced-expiry live test on the roadmap |
| 3 | MEDIUM closing-digest + timestamp seed is grindable at `N − 1` | accepted with a stated bound (round 2); `now` kept, see round 3 |
| 4 | MEDIUM constructor and `bind_token` enforce no deployment invariants | `bind_token` refuses the zero address and any token whose `get_minter()` is not this miner; the initial target stays a constructor argument (tests) and is part of the announcement |
| 5 | LOW winning tickets are bearer instruments | commitment is now `Poseidon2(DOM_SECRET, secret, recipient)`: a leaked (proof, secret) pays only the committed recipient; no change to `W` |

"Checked, no issue": nonce/out/epoch/seed/domain/commitment bound by the proof; no reentrancy hook on mint;
retarget stays inside `[⌈t/4⌉, min(4t, 2^128 − 1)]` under timestamps, late closes, rolls and alternation;
`only_self`, count ordering, replay nullifier, canonical `low128`, cross-deployment binding, proof length and
type, pinned VK and hash; no cheaply variable UltraHonk fields beyond the accepted disabled-row re-proof.

## Codex round 2 (fix critique + exhaustive sweep) — "FIX FIRST — supply integrity survives, but launch gating does not create a trustless fair launch, and first-time private mint delivery leaks the recipient to dictionary testing."

| # | finding | decision |
|---|---|---|
| 1 | MEDIUM launch fairness is procedural; the silent clamp of a past `launch_at` should be an assertion | `LAUNCH_NOTICE_SECONDS` profile parameter (testnet 0, mainnet 86400): with a notice the constructor asserts `launch_at ≥ now + notice`; without one the clamp stays so tests launch at once. No Aztec-visible entropy for `seed_0`: the residual (stockpiling epoch-0 tickets before deploying, bounded to `N` rewards plus the closing seed) is stated |
| 2 | MEDIUM privacy: the first constrained delivery to a recipient publishes a handshake whose tag derives from the recipient address | not a contract property; documented in the threat model's Privacy row |
| 3 | MEDIUM TTL limits but does not solve sponsor draining; "frees at once" overstated | wording corrected (freed on the PXE's next sync after the node reports the drop); fee policy as in round 1 |
| 4 | LOW–MEDIUM seed grinding: `E[R] ≤ min(N, s/(1−s) · p_{e+1}/p_e)` under independent Poisson work and no censorship; drop `now` (sequencer option value) | bound recorded; `now` kept: without it a non-sequencer closer knows the next seed exactly, with it the closer must hedge across inclusion slots. Codex's dissent recorded |
| 5 | LOW `get_minter()` is an attestation a malicious token can fake; pin class ids; consider a `PROFILE_HASH` | deployment record carries `minerClassId`, `tokenClassId`, `rollupVersion`, `launchAt`; `work_vk_hash()` view added; no profile hash (`constants()` + `epoch_params(0)` + `work_vk_hash()` + class ids cover every parameter) |

Sweep (one line each): anchor races none; `EpochParams` packing none; `bind_token` sender none; kernel
limits and enqueue ordering none; recipient forms — self-loss only; reorgs none; roll economics — liveness
needs a keeper (documented); parameter edges none; maps none; **domain replay across rollup forks sharing
chain id, address and state — adopted**: the deploy domain now includes `context.version()` (the rollup
version), mirrored in miner-core and the pinned vectors; TXE masks recursive-proof failures (known); modified
clients: no supply exploit.

## Codex round 3 — "material findings remain: token binding is not enforced as part of launch integrity"

| # | finding | decision |
|---|---|---|
| 1 | MEDIUM unbound rolling: `roll()` never read `token`, so after launch anyone could roll an unbound deployment to a saturated target before binding | `roll()` asserts the token is bound; under a notice period `bind_token` must run before `launch_at`, so a mainnet instance that opens unbound is dead rather than rollable |
| 2 | MEDIUM decoy token: a deployer could announce token A (minter = miner) and bind token B | `bound_token()` view; the deploy tooling asserts it equals the token it deployed; the announcement check in `docs/deployments.md` names it |
| 3 | coverage: the positive-notice constructor branch compiled only with notice 0 | the rule is a pure function (`launch.nr::opened_at_for`) with Noir unit tests for both branches, independent of the generated profile |

Confirmed: `context.version()` is the tx context's rollup version and the rollup validator rejects a mismatch,
so a modified client cannot pick it; the notice addition fails closed on u64 overflow. Recipient binding, the
domain mirroring, the views, the TTL wording and the roll/fill test introduce no new hole.

## Codex round 4 — "no new material findings"

Unbound target saturation and token substitution confirmed closed; `opened_at_for` "preserves the intended
rules and fails closed on u64 overflow". Non-material: the bind-before-launch deadline was only exercised
under the testnet profile — extracted into `launch.nr::binding_allowed` with unit tests, like the launch rule.

## Round 5 (owner-directed): the launch lottery

The owner judged launch gating alone weak ("it just removes the deployer as the person that can front-run
the first epoch") and asked for a `launch()` step introducing what randomness there is. A first cut mixed the
launcher's address and the launch slot's timestamp into `seed_0`; codex round 5 ("material findings remain:
deterministic launcher grinding and a deployer-controlled late-binding delay") showed it was *worse* than a
public seed: both inputs are choosable before the launch, so the first launcher pre-mines its branch for the
whole notice period and invalidates everyone else's stockpile (5 % of hashrate expects ≈ 29 winners over a
24 h notice, enough for all 24 claims); and dropping the bind-before-launch rule let the deployer stall the
launch while mining. Replaced by a RANDAO-style lottery (`launch.nr`): commit `Poseidon2(DOM_LAUNCH, preimage)`
before `launch_at`, reveal inside `REVEAL_WINDOW_SECONDS` after it (mainnet 600 s, testnet 0), `launch()` after
the window; `seed_0 = Poseidon2(DOM_SEED, genesis_seed, 0, mix, now)` with the mix folding every reveal in
order. Plainly: the last revealer keeps a one-bit option per commitment, each branch costs its own pre-mining
inside the window, so the head start is bounded by the window and shrinks as honest participants reveal late.
The binding deadline is back (`binding_allowed`), `roll()` refuses an unlaunched epoch, `genesis()` and
`launch_lottery()` are views, `bun run launch -- commit|reveal|open` runs the phases from a throwaway account.
Residuals (3) seed grinding and (5) handshake linkability have no fix and are written up in plain language
in the threat model.

## Codex round 6 — "material findings remain: the lottery does not universally bound pre-mining to the reveal window and permits copy/order grinding"

| # | finding | decision |
|---|---|---|
| 1 | HIGH the window bound needs an honest, uncensored, late reveal; with none the head start is the notice plus the window, and a sequencer can censor reveals and pick the launch slot | true of any RANDAO-style scheme; no fundless bond can compel a reveal. Documented plainly; the launch announcement should ask miners to commit and reveal late. Still better than a public seed whenever anyone honest takes part |
| 2 | MEDIUM commitment copying: `H(DOM_LAUNCH, preimage)` could be cloned into many addresses and revealed once the preimage is public | commitment is `Poseidon2(DOM_LAUNCH, miner, sender, preimage)` in the contract and `launch.ts` |
| 3 | MEDIUM order-dependent folding gives ~e·k! branches | the mix is the sum of revealed commitments (commutative): `2^k` |

Confirmed: non-reveals and commit spam cannot block or delay a launch (nothing is iterated); concurrent
launches yield one success; the binding deadline fails closed; `W = 0` immediate launches are consistent.
The positive reveal path is covered by Noir unit tests only (the testnet profile has no window).

## Codex round 7 — "material findings remain: the commutative mix exposes the supposed reveal entropy during commitment"

| # | finding | decision |
|---|---|---|
| 1 | HIGH the mix summed the *commitment*, public before `launch_at`, so a full set of reveals produced a sum known during the whole notice | the reveal now folds `Poseidon2(DOM_LAUNCH, 2, miner, sender, preimage)`, unknowable until the preimage is out; the commitment (tag 1) only verifies it. Unit test: contribution ≠ commitment |
| 2 | doc mismatch ("order-dependent mixing") | corrected |

## Codex round 8 — "no new material findings"

Commitment and contribution derivations match between Noir and TypeScript; copying, cross-deployment
replay and reveal-order manipulation are closed; what remains is the documented `2^k` subset option.

## Tests added

TXE (`src/test/mod.nr`) plus Noir unit tests, 54 in the contract crate: claim and roll before launch refused; launch before the window closes, unbound or twice refused; commitments once per address and only before `launch_at`; reveals only inside a window; `bound_token()` reports the binding; the launch rules, lottery phases, commutative mixing and contribution ≠ commitment (`launch.nr`); `epoch_params(0).opened_at ==
launch_at`; a past `launch_at` means now; `bind_token` rejects the zero address and a token minted by someone
else; `constants()[4]` is the TTL; a roll (×4) followed by an instant fill (÷4) returns exactly to the starting
target. The obsolete "bound token refuses the miner at claim time" test was removed (the bind itself refuses
now). Live suite: the claim's `expirationTimestamp` equals `anchor + CLAIM_TTL_SECONDS`; every ticket is mined
for its claimant. Cross-language vectors re-pinned for the 3-input commitment and the 5-input domain.

## Not changed, on purpose

- No commit/reveal or post-close entropy for seeds: no Aztec-visible randomness; the residuals are bounded and
  stated.
- `initial_target` stays a constructor argument; tests need easy targets and the announcement pins it.
- The Phase 1 spike drivers keep the spike contract's 2-input commitment and 4-input domain inline.

## Deployment consequence

The public testnet deployment (`deployments/testnet.json`, 2026-09-04 01:27 UTC) predates this pass: its
constructor signature, domain and commitment differ, so the hardened miner does not talk to it. A redeploy is
the owner's call (`ELIXIR_DEPLOY_FORCE=1`, optionally `ELIXIR_LAUNCH_AT`).
