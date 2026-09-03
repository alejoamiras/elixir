# Codex audit — elixir-core

## Round 1 (fresh session, plan v1 + Fact 11–14 edits landed mid-run)

- Date: 2026-09-03 · model gpt-5.6-sol · effort xhigh · sandbox read-only
- Session `01a0679c-d039-74e1-b861-3f23246f7c0c` · dir `codex-dOXCiT8y` (machine temp)
- Prompt: standard packet (adversarial/security, assumption-attack, implementation critique, plan-space, gates) over plan.md + recon.md
- Verdict: **reject** — see bottom line of the response

### Response (verbatim)

reject (with blocking findings: the full-proof-per-ticket invariant is unproven, the epoch controller permits manipulation and unbounded issuance/load shocks, and Phase 1 cannot yet make a safe go/no-go decision)

## 1. Adversarial / security

- [Critical] “Constant chain load/emission” is false during hashrate changes. If epoch 0 is calibrated to one laptop at 24 claims/hour and 100× capacity arrives, expected claims are roughly 2,400, then 600, 150, and 38 because the ÷4 clamp needs several epochs to converge—about 3,188 rewards versus 96 intended over four hours. A flash-mining attacker can inflate supply and overload the sequencer. Add an explicit per-epoch issuance bound, or redesign around one consumed slot/height per accepted winner.

- [Critical] The grace rule is economically exploitable. A miner can withhold epoch `e` winners, let `roll()` observe too few claims and raise `target[e+1]`, then claim the withheld proofs during grace. Sequencer ordering can produce the same result by placing `roll()` before pending finalizations. Calling this “bounded lag” misses the incentive attack. Use finalized accounting with at least a two-epoch retarget lag, or make post-roll old claims ineligible; test strategic withholding.

- [Critical] Per-field mutation is not sufficient evidence that a ticket costs a full proof. It detects independently ignored fields, but not:

  - correlated proof transformations;
  - alternative point encodings or prover randomness;
  - cheap changes to unconstrained trace/padding rows;
  - stopping after the last hashed field;
  - amortized FFT/MSM work across many proofs.

  Zero masking entities does not imply a unique proof. The security claim needs an explicit assumption about canonical proof generation and Honk malleability.

- [High] Derive the ticket layout from Barretenberg’s pinned serialization and transcript manifest, not experimental indices. For 5.2.0, enumerate every one of the 410 slots by label and phase—Oink commitments, all 25 sumcheck rounds, evaluations, Gemini folds/evaluations, Shplonk `Q`, and final KZG `W`. Non-ZK virtual rounds are processed uniformly by the verifier, contrary to I3’s padding premise ([Sumcheck.md](/Users/alejoamiras/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0/barretenberg/cpp/src/barretenberg/sumcheck/Sumcheck.md:225)). Prefer:

  `digest = Poseidon2(domain, instance_id, public_inputs, canonical_proof[0..409])`

  If any field is genuinely ignored, assert its canonical value in-circuit and still hash the canonicalized 410-field encoding. Include final KZG `W`, so the digest is unavailable until the last PCS step. Generate and checksum the manifest in CI.

- [High] Test the above with repeated same-witness proofs, several mutations per slot, grouped/correlated fuzzing, native-verifier/recursive-verifier differential tests, wrong public inputs/VK/flavour, and an instrumented prover showing exactly when the digest becomes computable. Benchmark “abort immediately before ticket availability” against full proof time. No test can prove that batching is impossible; document that specialized miners may amortize proving-key construction, FFTs, and fixed-base MSMs. The defensible guarantee is “one complete accepting proof transcript per ticket,” not equal hardware cost per ticket.

- [High] The work is not deployment-bound. Include chain ID, miner-contract address, protocol/puzzle version, and preferably recipient or a recipient commitment in the inner public inputs. Otherwise one proof may be replayed against deployments sharing seed/VK, and the secret is merely a bearer credential: it does not bind the transaction sender or recipient. Use the full 254-bit digest for the nullifier and only truncate it for difficulty.

- [High] Seed unpredictability is overstated. `H(seed,last_count,e)` offers only a small set of candidate next seeds, and the sequencer/withholding miners influence which count is finalized before `roll()`. Either use protocol randomness committed after the mining window, or explicitly accept pre-mining/last-look risk. “Timestamp movement by seconds” is also an unsupported trust assumption; inclusion censorship and private-anchor/public-execution skew matter more.

- [High] The cryptographic trust base is incomplete: KZG CRS integrity, exact Barretenberg/Noir commits, compiler correctness, recursive-verifier implementation, and WASM/native artifact equivalence. At least the inspected proof-layout source marks external audits as not started. Git tags and `bun audit` do not protect these components. Pin commits and artifact hashes, make builds reproducible, and require independent audit of the exact deployed circuit/VK and recursion path.

- [Medium] Privacy is recipient-private, not fully “Zcash-style”: the transaction is recognizable as mining, the mint amount and claim time are public, and RPC/network timing remains linkable. A compromised hosted frontend can obtain the signature-derived secret, proof, and recipient choice. Bind the intended recipient and define the privacy claim narrowly.

## 2. Assumption attack

### Facts

- [High] The version statement conflates two compilers: `aztec-nargo` 5.2.0 uses Noir beta.25, while bare `nargo` is beta.16. The new measurements used beta.25; the requested beta.16 work circuit remains unmeasured. Specify and test the dual-compiler matrix or change the version requirement.

- [Medium] “410 fields” means proof fields excluding separately supplied public inputs. The interface must preserve both. bb.js’s recursive-artifact helper currently returns an empty `proofAsFields` and carries an unresolved recursion TODO ([backend.ts](/Users/alejoamiras/.aztec/versions/5.2.0/node_modules/@aztec/bb.js/src/barretenberg/backend.ts:236)); Phase 1 must prove the exact conversion path.

- [Medium] Fact 11 proves compilation and low main-circuit gate count, not that a valid claim-shaped Chonk transaction proves, verifies, fits ECCVM/translator limits, or is accepted by a node.

- [Medium] Fact 12 directly establishes ACVM behavior, but “therefore TXE never checks” was not measured with TXE and remains listed as an unknown in `recon.md`. Resolve that inconsistency.

- [Medium] The token findings are facts about an older incompatible source revision, not a verified 5.2.0 dependency. Also, `auth_contract` is a transfer authorization hook, not an upgrade mechanism.

### Inferences

- [High] I1 is substantially de-risked by the 19,923-gate probe, but tail capacity, valid recursive aggregation, browser memory, and network acceptance remain open.

- [High] I3 is probably false as written: padding does not imply ignored fields, and “Fiat–Shamir-bound” is not the same as “verifier-constrained” or “available only after full proving.”

- [High] I5’s fallback—downgrading the repository to the token’s Aztec version—violates the explicit 5.2.0 target. Port/vendor the token against 5.2.0 and audit the delta, or block.

- [Medium] I6 ignores memory and oversubscription. Multiple multithreaded backend instances may exhaust memory before wall time becomes relevant.

- [Medium] I7 needs exact fixed-arity vectors, field encoding, length padding, and output truncation tests; “arbitrary-length equivalence” should not be generalized.

### Asks

- [High] Missing: define “Bitcoin-exact.” This is a 128-bit Poseidon threshold with count-based hourly retargeting, not Bitcoin’s 256-bit PoW or 2016-block timespan algorithm.

- [High] Missing: maximum acceptable claims, issuance, fees, and sequencer load under 10×/100×/1000× hashrate shocks and long zero-claim periods.

- [High] Missing: accepted proof malleability/amortization assumptions and the canonical ticket specification.

- [High] Missing: mandatory external audit, CRS/toolchain provenance, immutable-launch ceremony, and migration strategy. `/harden security` should be required, not recommended.

- [Medium] Ask 5 needs a wallet-independent KDF/domain containing chain, contract, and version, plus proof that wallet signatures are deterministic and recoverable.

## 3. Implementation critique

- [High] The public work output is unresolved (`out?`) and absent from `claim`. `WorkProver` must return `{ proofFields, publicInputs }`; the contract must verify the generated, exact PI order. This cannot remain ambiguous past Phase 1.

- [High] Replace handwritten `boundIndices` with generated canonical proof-layout metadata and hash the complete canonical proof plus instance/public inputs. This is simpler and less fragile.

- [Medium] `PublicImmutable` per epoch is reasonable and idiomatic for anchored private reads. The problem is the lifecycle around it. Use a finalized accounting window and retarget lag; add private anchor-time checks and transaction expiration to avoid proving doomed claims.

- [Medium] Splitting `verify_ticket` from `claim` is worth testing, but it only reduces the largest individual app circuit. It does not reduce transaction-wide ECCVM/translator work. Benchmark split versus inline before freezing the boundary.

- [High] `hardwareConcurrency - 1` backends, each internally multithreaded, is likely oversubscribed and memory-heavy. Benchmark one multithreaded backend against a small pool of single-threaded backends and include peak RSS.

- [Low] The package split is generally coherent; the main duplication is public accounting alongside the token’s public supply update, which is acceptable if their invariant is tested.

## 4. Plan-space

- [High] The primary remains the best research bet and the 19,923-gate result is encouraging. Appendix A is not a semantic fallback: it abandons the lottery, makes chain load proportional to proving throughput, and invites fee/throughput pressure.

- [High] The L1 portal is the more faithful fallback. It preserves proof-hash mining and verifies only winners. Privacy can be improved with a recipient commitment and permissionless relayer; the L1 sender need not be the miner. Its costs are gas, message latency, and more infrastructure. Phase 1 should benchmark generated-verifier gas and an L1→L2 private redemption path rather than relegating it behind Appendix A.

- [High] The GO threshold is wrong. `≤2^19` app gates says little after Goblin offload, and two minutes is only a loose timeout. Require valid/tampered end-to-end proofs, actual node acceptance, ECCVM/translator safety margin, p50/p95 time, peak memory, browser/device matrix, tx fee/size, and no worker OOM. “GO-degraded” is not GO because the native claimer does not yet exist and contradicts the browser completion criterion.

## 5. Validation gates

Using a diagnosis-style pass/fail discipline, each load-bearing unknown needs an executable failure signal. Missing gates include:

- [Critical] withholding/grace/roll-order attacks; hashrate shocks; maximum issuance/load; zero-claim and maximum-target recovery.
- [High] u128 overflow, rounding, saturation, `claims` overflow, long skipped epochs, and target extrema.
- [High] same-block roll/claim, stale/future claims, sequencer delay, expiry, reorg, concurrent replay, and atomic rollback when either public finalizer fails.
- [High] cross-chain/deployment replay and recipient redirection.
- [High] repeated-proof determinism, canonical encodings, correlated malleability, final-KZG dependency, early-abort cost, and batched/custom-prover benchmarks.
- [High] valid and invalid inner proofs through the real recursive Chonk path; TXE tests must be labeled plumbing-only.
- [High] clean-build reproduction of ACIR, VK, VK hash, proof manifest, WASM/native outputs, and pinned dependency commits.
- [Medium] public-effect inspection proving what recipient, amount, epoch, function identity, and timing metadata leak.
- [Medium] browser memory/concurrency, worker crash recovery, epoch switching mid-proof, and malicious/stale RPC data.
- [Medium] multi-epoch testnet soak with observed retarget behavior; one deployment receipt is not a mainnet-readiness gate.

What looks fine:

- Rejecting native preimage grinding is correct.
- Exact-VK recursive verification of winners is the right primitive.
- The new Chonk gate measurement materially improves feasibility.
- Private minting, siloed nullifiers, permissionless rolling, generated constants, and real-prover integration are good foundations.
- `PublicImmutable` and the package boundaries are sensible once the epoch protocol is repaired.

reject (with blocking findings: the full-proof-per-ticket invariant is unproven, the epoch controller permits manipulation and unbounded issuance/load shocks, and Phase 1 cannot yet make a safe go/no-go decision)

## Round 2 (resumed session, plan v2)

- Date: 2026-09-03 · same session `01a0679c-d039-74e1-b861-3f23246f7c0c` · response-1.md
- Verdict: **conditional approve** — conditions listed at the bottom; all adopted in plan v3 (see §8)

### Response (verbatim)

## Original blocking findings

1. **Full-proof-per-ticket invariant — partially addressed.**

The design is now defensible: whole-proof hashing through final KZG `W`, a generated layout manifest, determinism checks, and explicit reliance on externally audited non-malleability are the right structure.

Residuals:

- The early-abort benchmark has no GO threshold. Phase 1 could report that the digest becomes available after 30% of reference proving cost and still return GO. Require a threshold—e.g. ≥90% of `generateProof` cost, with only serialization/return remaining.
- Native mutation covers all fields, but recursive differential testing mentions only “a tampered proof.” Test at least every transcript phase—or all 410 fields through a cheaper outer-recursion harness—before accepting I3.
- Non-malleability necessarily remains conditional on the external audit. That is now appropriately acknowledged and blocks mainnet.

2. **Manipulable/unbounded epoch controller — partially addressed.**

The original grace-withholding exploit and unbounded accepted issuance are fixed. Remaining qualifications:

- The cap bounds **accepted reward-bearing claims**, not submitted transactions. Under a hashrate shock, many miners can concurrently prove and submit winners; all but the first `N` revert. Network/mempool/sequencer load therefore is not bounded by `N`. Correct the claim and stress-test winner bursts; this may be acceptable as fee-bounded stale-work traffic.
- An escape-hatch epoch closes with fewer than `N` claims, so issuance is **at most**, not “exactly,” `N × REWARD` per closed epoch. “Constant emission” is steady-state expected emission; collapse permanently under-emits.
- Wall-clock issuance can still spike to `N × REWARD` per block while difficulty catches up. That is Bitcoin-like delayed adjustment, but should be stated explicitly.

3. **Phase 1 insufficient for safe go/no-go — partially addressed.**

It is substantially stronger and now tests the real recursive transaction. The remaining defects are the missing early-abort threshold above, incomplete recursive mutation coverage, and an undefined meaning of “ECCVM/translator headroom ≥2×.” The plan must identify the actual capacity/network limit against which that ratio is calculated; the recon found no explicit maximum.

## New material findings

- [Critical] `out` is still unavailable in the contract interface. The recursive verifier needs `[domain, seed, e, commit, nonce, out]`, but `claim` accepts no `out`, and `verify_ticket` refers to an undefined value. Proof fields exclude public inputs. Add `out` as a private `claim`/`verify_ticket` argument and require it to equal `publicInputs[5]`; otherwise the claim-shaped circuit cannot compile without recomputing W.

- [High] Retarget arithmetic remains underspecified. Integer evaluation of `actual / EXPECTED` becomes zero whenever an epoch is fast. Define an exact overflow-safe computation, preferably with a widened intermediate:

  `new_target = clamp(floor(target × actual / expected), ceil(target/4), saturating(target×4))`

  Specify rounding and handle multiplication before narrowing to `u128`. “Saturating” plus extrema tests does not resolve ambiguous arithmetic.

- [High] The seed is not always unknowable before close. On escape-hatch closure, `closing_digest = 0`, while the earliest close time is known and the roller/sequencer can predict or influence `now`. That enables seed-candidate precomputation and potentially more than the stated one-block last look. Either use future protocol randomness/a two-step roll, or explicitly accept this separate escape-hatch advantage.

- [Medium] The 1000× simulation gate cannot require convergence within four epochs under a maximum ÷4 adjustment: `ceil(log₄(1000)) = 5`. Define “converged” numerically and use the corresponding bound.

- [Medium] The exact privacy disclosure now includes the public winning `digest` because `record_claim(e, digest)` exposes it. It remains pseudorandom and does not reveal the recipient, but §1 should list it.

- [Medium] Poseidon parity I7 omits several actual arities/encodings: deployment domain, secret commitment, nullifier, and seed derivation. Generate fixtures for every domain-separated hash invocation, not only arities 2, 6, and 411.

The rejected choices are reasonable: recipient binding adds little against a holder of the bearer secret; count-capping removes the need for the two-epoch lag; and postponing the L1 fallback spike until a primary NO-GO is proportionate.

conditional approve (with conditions: add and constrain `out`; make early-abort and recursive-differential results hard Phase 1 gates; define measurable ECCVM capacity and overflow-safe retarget arithmetic; correct the accepted-load and emission claims; fix the 1000× convergence gate; and mitigate or explicitly accept escape-hatch seed precomputation)

## Final fresh-context pass, round 1 (NEW session, plan v4)

- Date: 2026-09-03 · model gpt-5.6-sol · effort xhigh · read-only · first attempt succeeded (retry loop armed, unused)
- Session `01a067da-5834-7741-8aaf-664d292a7dda` · dir `codex-VjfPv9HV` (machine temp)
- Verdict: **reject** — deployment circularity (Critical) + retarget arithmetic (High); all findings adopted in plan v5

### Response (verbatim)

Reject — v4 is materially improved, but the specified deployment cannot be constructed and the retarget arithmetic is not yet soundly specified.

## Adversarial / Security (§4)

- [High] Mixing `last_digest` does not make an escape-hatch seed unpredictable. It is already public, as are the old seed and epoch; only the slot-derived timestamp varies. A sequencer-miner can pre-mine candidate next-epoch seeds and choose/delay the roll slot. This applies whether `claims[e]` is zero or nonzero, contradicting §2.4’s narrower acceptance. Either introduce delayed protocol randomness or explicitly accept and simulate this advantage.

- [High] `genesis_seed` permits an unlimited deployer premine. Contract addresses and constructor inputs are precomputable, so the deployer can generate epoch-0 work proofs long before launch. Add an explicit fair-launch mechanism or record deployer premine as an accepted trust assumption.

- [High] Phase 1 measures the cost of one implemented disabled-row attack; it cannot establish a “lower bound” or prove that an optimized prover gains “nothing more.” Rename it a measured attack cost/upper bound on security, retain the no-cheaper-malleation assumption, and make the external audit responsible for evaluating it.

- [Medium] “Malicious RPC data treated as untrusted” is unsupported. Schema validation cannot detect correctly shaped false epoch parameters. Specify a trusted endpoint, authenticated state proof, or fail-safe cross-source strategy; otherwise state that a malicious RPC can waste mining work.

- [Medium] Commit pinning and `bun audit` do not cover compiler binaries, downloaded WASM, GitHub Actions, or the KZG ceremony trust assumption. Pin hashes for shipped binaries/WASM and action commits, and distinguish CRS transport integrity from cryptographic setup trust.

## Assumption Attack (§5)

### Facts

- [High] The claimed bound `actual ≤ T_MAX × N` is false. If nobody calls `roll()`, the Nth claim may arrive arbitrarily later; no protocol rule supplies that bound.

- [Medium] Fact 12 presents the TXE result as confirmed by a future Phase 2 test. Until executed, only ACVM behavior and source inspection are established.

- [Low] Fact 16 mixes an exact `2^15` capacity with an estimated 800–900-row marginal cost. The estimate belongs under Inferences until measured for the complete transaction.

### Inferences

- [Critical] The deployment sequence silently assumes mutually dependent immutable addresses can be precomputed. Aztec addresses commit to the initialization hash and therefore constructor arguments ([5.2.0 address derivation](/Users/alejoamiras/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0/yarn-project/stdlib/src/contract/contract_address.ts:14)). The miner address depends on `token`; the token address depends on `minter = miner`. Choosing salts does not solve this cryptographic fixed-point problem.

- [High] The proposed quotient check is not sufficient unless `q` is range-constrained: `q × EXPECTED + r == product` is a field equality, and `r < EXPECTED` alone does not prove Euclidean division.

- [Medium] Comparing a fee denominated in the fee asset with “10% of REWARD” denominated in ELX is dimensionally meaningless without an ELX/fee-asset price assumption.

### Asks

- [High] Missing: deployment/bootstrap authority and its front-running model.

- [High] Missing: genesis fairness or explicit acceptance of deployer premining.

- [High] Ask 10 is still unresolved. “Miners bring fee juice” is operationally viable but must be explicitly approved; Phase 1 should report gas/fee-asset units and a break-even ELX price, not a raw percentage.

## Implementation Critique (§3)

- [Critical] Replace the circular constructors. A reasonable pattern is an address-independent miner deployment followed by a one-shot, deployer-authorized token binding that permanently locks, then deploy the token with the known miner address. Test front-running and prove no setup authority survives.

- [High] Cap count-close elapsed time at `T_MAX`; values above it produce the same ×4 clamp anyway. Then implement a range-constrained quotient/remainder gadget and compile-time assertions relating `T_MAX` and `EXPECTED`.

- [Medium] `last_digest` is required by §2.4 but absent from §3.4’s storage declaration.

- [Medium] Phase 1’s “claim-shaped” spike does not explicitly include the real token private call, mint finalizer, historical reads, nullifier, both public enqueues, and selected fee path. Those must be included for its performance GO decision.

## Ledger Check (§8)

- [High] The ledger incorrectly says digest zero caused roll-seed predictability and that the new seed is “unknowable before close.” A nonzero but public `last_digest` adds no entropy.

- [Medium] §2.1, §2.5, §4, and the ledger still say chain load is capped or exactly `N`, contradicting §2.4’s correct statement that only accepted claims are capped.

- [Medium] The rejected grace window, two-epoch lag, recipient binding, and delayed mutable storage remain correctly rejected. Inline verification is a sensible default, subject to the planned benchmark.

## Gates (§6)

- [High] Add a deployment-address derivation test and an end-to-end immutable bootstrap test before Phase 2.

- [High] Add tests for count closure long after `T_MAX`, malicious quotient/remainder witnesses, and the exact elapsed cap.

- [Medium] Add genesis-premine and roll candidate-seed simulations, including a sequencer-miner choosing among slots.

- [Medium] The 200-winner TXE test proves state integrity, not submitted-load behavior. Add a smaller real-prover sandbox burst measuring acceptance, rejection, fees, and sequencer latency.

- [Medium] Replace the Phase 1 fee percentage gate with fee-asset cost, transaction resource usage, and stated break-even assumptions.

What looks fine:

- Count-capping, no grace, and record-before-mint correctly bound accepted issuance and preserve atomicity.
- Deployment-bound inner public inputs close cross-deployment replay.
- Whole-proof hashing through the final opening and a full-width nullifier are sound transcript/replay choices.
- Per-epoch random secrets, inline verification, `PublicImmutable` epoch parameters, real-prover integration, and the mandatory external mainnet audit are appropriate.

reject (with blocking findings: the token/miner constructor dependency makes the specified deployment impossible, and the retarget relies on a false elapsed-time bound plus an insufficiently constrained field-division check)

## Final fresh-context pass, round 2 (resumed, plan v5)

- Date: 2026-09-03 · same session `01a067da-5834-7741-8aaf-664d292a7dda` · response-1.md · first attempt succeeded
- Verdict: **conditional approve** — three conditions (PublicImmutable token binding + anchor test; retarget helper safeguards; wording sweep), all adopted in plan v6. **This is the gate verdict.**

### Response (verbatim)

## Blocker status

- [High] Deployment — **partially addressed**. The circular address dependency is gone, but `token: PublicMutable` cannot be read from a private function in Aztec 5.2.0; the type explicitly disallows private reads ([source](/Users/alejoamiras/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0/noir-projects/aztec-nr/aztec/src/state_vars/public_mutable.nr:10)). Therefore `claim` cannot assert/read the bound token as specified. Use `PublicImmutable<AztecAddress>` initialized by `bind_token`; its initialization nullifier already enforces one-time binding and permits historical private reads. Test that claims become possible only after the binding block is available as an anchor. Phase 2 also still says “then miner with `token`,” contradicting the token-less constructor.

- [Low] Retarget — **addressed**. The elapsed cap and range-constrained quotient/remainder establish the intended integer division without field wrap. Residual: assert `EXPECTED_EPOCH_SECONDS > 0`, and specify overflow-safe implementations for `ceil(target/4)` and saturating `target×4`; the extrema tests should pin both.

## New material findings

- [Medium] The security qualification was not propagated consistently. §2.1, §3.3, Ask 4, Phase 1 item 4, Phase 5, and the `/goal` seed still call the disabled-row result a “lower bound,” while §4 correctly calls it a measured attack cost/upper bound on security. This affects the meaning of the hard GO gate: it should say “known disabled-row attack costs ≥50% of honest proving,” without implying that cheaper attacks were excluded.

- [Low] The ledger still says the lottery/count-capping “caps chain load” in the Reward model and Epoch definition rows. Only accepted claims and issuance are capped; submitted Chonk transactions are not.

- [Low] §4’s fee paragraph still says the fee is measured “vs `REWARD`,” despite the corrected fee-asset/break-even methodology elsewhere.

The remaining changes are narrow and do not require another architectural redesign.

conditional approve (with conditions: make the one-shot bound token privately readable—prefer `PublicImmutable.initialize/read`—and test post-bind anchor behavior; add the missing retarget parameter/clamp safeguards; replace the remaining lower-bound, chain-load, and fee-comparison overclaims with the qualified v5 wording)