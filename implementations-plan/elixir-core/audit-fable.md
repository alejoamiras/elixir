# Fable-role audit — elixir-core

- Date: 2026-09-03 · role: independent top-tier Claude reviewer (blueprint "fable" leg) · model: `fable` (three earlier attempts on fable/opus/opus died with HTTP 529 Overloaded)
- Input: plan v2→v3 (the audit ran while codex round-2 edits landed), `recon.md`, `audit-codex.md` (told not to repeat codex's findings)
- Verdict: **conditional approve** — six conditions, all adopted in plan v4 (see plan §8 "Fable-role audit")

## Report (verbatim)

Checked against `~/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0/` and `~/.aztec/versions/5.2.0/node_modules/@aztec/`. Codex round 1 findings are not repeated; where v2 claims to address one, I say whether it actually does.

### 1. Adversarial / security

**[High] The ticket is malleable per witness without touching the nonce; "nonce-first hashing" defends against nothing an attacker would do.** Non-ZK UltraHonk in 5.2.0 disables the first `TRACE_OFFSET = NUM_DISABLED_ROWS_IN_SUMCHECK = 4` rows in sumcheck (`barretenberg/cpp/src/barretenberg/constants.hpp:43-48`, `flavor/ultra_flavor.hpp:96`; `sumcheck/sumcheck_round.hpp:63`), and those rows have identity `sigma = id` in the permutation (`honk/composer/permutation_lib.hpp:51-52`), so their wire values cancel in the grand product. A modified prover can set arbitrary values in those 16 cells for the *same* witness and get a fresh accepting proof with a fresh digest. Cost of the fresh proof: sumcheck + Gemini/Shplonk/KZG for the new transcript, but the ~7–8 witness-commitment MSMs of size n are replaced by ~16 scalar mults (delta commitments), and `z_perm`/lookup commitments are unchanged. That is roughly 1.5–2× cheaper per ticket than an honest prove. This does not break "one complete accepting transcript per ticket", but it falsifies §3.2's "no polynomial reuse" claim, and none of the v2 tests (field mutation, multi-field mutation, determinism, early-abort) detects it — they all mutate proof bytes or measure the honest prover's phases. Codex C3 called out "unconstrained trace/padding rows"; v2 answered with an assumption statement, not a measurement. Fix: reframe the guarantee as "ticket cost ≥ sumcheck + PCS opening of a fresh transcript; witness-commitment MSMs are amortisable", and make Phase 1 item 4 report that lower bound (bb's phase timers already give it) so the §4 threat model carries a number.

**[Medium] "Load never exceeds N claims per epoch" (§2.4) is false; only *accepted* claims are capped.** Under a 1000× shock the epoch closes in one block; ~240 winning tickets per block are submitted at the stale target, 24 succeed, the rest revert in the public phase, each a full Chonk tx the sequencer must verify and execute. Reverted txs pay fees, so it is not a free DoS, and it is self-limiting, but the plan's statement and the miner's `claims ≥ N − in_flight` rule (which cannot see the mempool) both overstate the bound. State "issuance is capped; submitted load is bounded by miner rationality and fee loss".

**[Medium] Closing-miner last look is understated and mempool-wide.** `record_claim(e, digest)` puts the digest in the tx's public call request, so the closing digest is visible to every validator (and any mempool observer) one slot before inclusion; `now` is slot-derived (`yarn-project/sequencer-client/src/global_variable_builder/global_builder.ts:58`), so seed_{e+1} is computable by everyone at that point. Separately, the holder of a winning ticket at `claims = N−1` can delay submission and pre-mine e+1 against the predicted seed, bounded not by "one block" but by the expected inter-arrival of a competing claim (~150 s at N=24/h, i.e. ~4 slots) and the risk of the ticket going stale. Net edge is a few percent; accept, but document it correctly.

**[Medium] Roll-path seed is fully predictable.** `close(..., closing_digest = 0)` and slot-derived `now` mean seed_{e+1} for every candidate roll slot is known to everyone from `opened_at + T_MAX` onward. Anyone can pre-mine e+1 at the ×4 target before the roll lands and submit roll + N claims together. Only reachable in collapse, so mostly harmless, but it is a gift to whoever is still mining. Either accept explicitly or mix the last accepted digest of epoch e into the roll seed (nonzero when `claims[e] > 0`).

**[Low] The escape-hatch formula is dead under the defaults.** `(now − opened_at) × N / max(claims, 1)` with `T_MAX = 4 × EXPECTED` always yields ratio ≥ 4 → clamped to ×4 regardless of `claims`. Not a bug, but the plan should say "roll ≡ ×4" rather than present a formula that never influences the result.

**Positive correction to §2.4 withholding.** Under count-capping, stretching an epoch to earn ×4 *reduces* the withholder's ELX/hour (same N-share at a slower cadence, then a ¼ correction next epoch), and stalling to T_MAX requires >75% of hashrate. The plan's "bounded by the clamp" is weaker than the truth; say it is unprofitable except for the seed head start.

**Epoch-close atomicity / ordering.** Two Nth claims in one block: public execution is sequential, the second fails `e == open_epoch`, and because app calls execute after the account's `end_setup()` (`aztec-nr/aztec/src/authwit/account.nr:68`) the whole revertible phase drops — correct as planned. Sequencer ordering at T_MAX (roll before claims) is fee-loss griefing at one tx of cost; only reachable in collapse; acceptable. Note the mild adverse incentive: a sequencer-miner profits from ordering competitor claims *after* the close (they revert and pay).

**`record_claim` only_self + digest.** Sound: the digest is computed inside the proven private circuit and the public call is self-enqueued. Public exposure of the digest (nullifier preimage) reveals nothing beyond the tx itself.

**Full-width nullifier.** Sound as replay protection; deterministic proofs (I8) make it "one claim per honest proof". Given the malleability above, it is really "one claim per transcript", which is fine — each transcript is a separate lottery ticket.

**Goblin offload capacity.** ECCVM is a *fixed* 2^15-row circuit (`constants.hpp:32`; `eccvm/eccvm_flavor.hpp:651` hard-asserts on overflow). One Ultra recursive verifier adds ~100 short-scalar ops (`chonk/README.md:157-163`), ≈ 800–900 rows (32 wNAF digits, 4 additions/row, 8 precompute rows/point: `eccvm/eccvm_builder_types.hpp:13-20`) — ~2.5% of the cap. I1 is likely fine. Prover-network cost of many claims per block: zero marginal, the ECCVM/translator live inside the client proof; the rollup verifies a constant-size Chonk proof per tx.

**Still trusted, shouldn't be:** (a) that the honest bb prover's proof is the only accepting proof per witness; (b) that wallet-sdk can sign a message (§2 below); (c) that u128 arithmetic covers the retarget (§3 below); (d) fee economics — no measurement of claim-tx fee vs. 4 ELX, and no mainnet fee path for a miner who starts with zero balance (Ask 7 only covers testnet).

### 2. Assumption attack

**Facts**
- Fact 11 [Medium]: 19,923 gates covers the verifier only. `claim` also hashes 410 proof fields twice (args hash + ticket digest ≈ 137 Poseidon2 permutations each ≈ 11k gates each), two historical reads (~8k), low128 decomposition, nullifier, mint call. Expect ~50–60k. Still small; say so.
- Fact 2 [Low]: padding is `CONST_PROOF_SIZE_LOG_N = 25` (`constants.hpp:21`), not something in `constants.nr:650-674`.
- Fact 14 [Low]: true but irrelevant to same-witness malleability (above).
- Fact 12: confirmed — no `RecursiveAggregation` handling in `yarn-project/simulator` or `txe`.

**Inferences**
- I1 [Low]: "≥ 2× headroom" is ill-defined. Define GO as "ECCVM rows for the full claim tx with the heaviest supported account/fee path ≤ 2^14" (bb prints `Num rows in the ECCVM` under verbose). "≤ 4 GB" is the wasm32 ceiling, i.e. tautological; use ≤ 3 GB.
- I3 [Low]: the in-circuit verifier defers the final pairing into `AppIO.pairing_inputs` (`chonk/chonk.cpp:285-291`), aggregated and checked at the decider/tube. Fine, but the plan should name that the app's pairing points are only enforced downstream.
- I5 [Medium]: the 5.2.0 reference token (`noir-contracts/contracts/app/token_contract/src/main.nr:53,141`) has an admin-settable `minters` map, so aztec-standards' immutable single minter is a real reason to port. But time-box it: if the port delta is large, forking the reference token and replacing `minters` with a `PublicImmutable<AztecAddress>` is a ~20-line change on 5.2.0-native code.
- I6/I7/I8/I9: fine, testable as written.
- Silently assumed [Low]: VK/key_hash pinning. bb requires recursion inputs to be witnesses (`dsl/acir_format/acir_to_constraint_buf.cpp:62-69`) and takes the VK from witnesses (`honk_recursion_constraint.cpp:57-59`), so pinning relies on Noir emitting constant-equality constraints for the globals. Almost certainly true; verify by ACIR inspection in Phase 1.

**Asks**
- Ask 5 [High]: `@aztec/wallet-sdk`'s `BaseWallet` exposes no message-signing method (`~/.aztec/versions/5.2.0/node_modules/@aztec/wallet-sdk/dest/base-wallet/base_wallet.d.ts`: `createAuthWit`, `simulateTx`, `sendTx`, …). Abusing `createAuthWit` on a fixed hash is exactly the pattern wallets warn users about. The fallback (random secret in IndexedDB) must be the default; better, a per-epoch random secret — unclaimed tickets die with the epoch anyway, so nothing long-lived needs protecting.
- Missing Ask [Medium]: fee economics and mainnet fee path (claim fee vs REWARD; FPC or fee-juice bootstrap for new miners).
- Ask 1 [Low]: with N=24 and browser claim proving of 1–2 min against a 2.5-min claim interval, ~8% of tickets near epoch end will go stale; the simulator should report the expected stale rate for the chosen N.

### 3. Implementation critique

- **[Medium] The verify_ticket/claim split default is backwards.** An `#[internal("private")]` self-call is a separate circuit and therefore an extra Chonk folding step plus kernel iteration — seconds of WASM proving and its own merge/ECCVM ops — to save ~30k gates in an app circuit that is already far below kernel size. Default to inline; keep the split only if Phase 1 shows otherwise.
- **[High] Retarget arithmetic as specified is wrong at launch parameters.** `target × ratio` in u128 overflows for any `target > 2^128/14400 ≈ 2^114`. The Ask 1 calibration (one laptop, ~1000 proofs/h, 24 wins) implies `target ≈ 2^122`. Saturating the product then dividing gives a wrong, too-small target from epoch 0. Specify a mulDiv (hi/lo split, or Field product with a constrained quotient/remainder) and clamp *after*; test at 2^118–2^126.
- **[Low] Enqueue order**: enqueue `record_claim` before the token's `_finalize_mint_to_private` so a stale claim reverts before the mint's public work.
- **[Low] VK codegen gap**: the contract embeds `W_VK`/`W_VK_HASH` as globals but no step produces the `.nr`; add `contracts:codegen-vk` and a CI check that the committed file equals the rebuilt VK.
- PublicImmutable per epoch + `public_storage_historical_read` for `open_epoch` (`aztec-nr/aztec/src/history/storage.nr:13`) is the idiomatic pattern; correct.
- Worker layout (one multithreaded backend) is the right default. Package boundaries are sensible and match recon's reuse map; nothing duplicates it.

### 4. Plan-space and phases

Phase 1 is nearly right. Add: (a) the same-witness lower-bound measurement (reframe item 4); (b) claim-tx fee/gas and ECCVM row count for the full tx; (c) ACIR check of VK pinning; (d) run the claim through the wallet-sdk reference wallet, not only PXE with `PXE_PROVER_ENABLED`. Nothing in the six items is superfluous. Arcs: A1 fine; A2 is the heavy one (token port is the elastic item — time-box it); A3's ≥24-epoch soak is a ≥24-hour wall-clock gate that will block the PR — acceptable, but say it, and vary hashrate during the soak or the retarget data is trivial.

### 5. Validation gates

Real and mostly sufficient. No test exists for: same-witness malleability cost; retarget overflow at launch-realistic targets (only "extrema"); roll-path seed predictability; fee economics; a lying (not malformed) RPC; sequencer ordering advantage (untestable — document). Phase 4's "test wallet" must be a wallet-sdk wallet running the real prover, or the browser completion criterion is not exercised.

### Verdict

conditional approve (with conditions: (1) reframe the ticket-cost guarantee around the disabled-row/same-witness re-proof and measure its lower bound in Phase 1 item 4; (2) replace the u128 saturating retarget with a specified mulDiv and test at launch targets; (3) drop Ask 5's wallet-signature KDF for a per-epoch random local secret; (4) invert the verify_ticket default to inline; (5) restate ECCVM/memory GO criteria in rows and ≤ 3 GB, and add claim-fee measurement plus a mainnet fee-path Ask; (6) correct §2.4's load claim, the last-look statement, and the roll-seed predictability.)
