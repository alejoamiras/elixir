# Phase 1 spike results — elixir-core

Machine for every number below unless stated: **homelab**, AMD Ryzen 5 5600X (6 cores / 12 threads), 30 GB RAM,
Linux, aztec 5.2.0 (`aztec-nargo` = Noir 1.0.0-beta.25, bb 5.2.0 whose binary reports `5.2.0-nightly.20260807`),
Bun 1.4.0. The owner's reference laptop (M4 Pro, 48 GB) proves W natively ≈1.8× faster than this box (0.63 s vs
1.12 s at 2048 steps, planning probe vs this run); scale accordingly. Scripts: `bun run spike:work`,
`bun run spike:gates`, `bun run spike:claim` (with `BB_VERBOSE=1 LOG_LEVEL=verbose`), `bun run spike:browser`.

## 1. Work circuit W (`packages/work-circuit`)

| CHAIN_LEN | circuit size | native `bb prove` (12 thr) | bb.js WASM prove (11 thr) | WASM verify |
|---|---|---|---|---|
| 1024 | 75,952 | 0.62 s | 3.53 s | 0.93 s |
| **2048 (production)** | **151,728** | **1.12 s** | **6.31 s** | 1.61 s |
| 4096 | 303,280 | 2.05 s | 11.56 s | 2.84 s |

- Proof 13,120 bytes = 410 fields; VK 115 fields; `W_VK_HASH = 0x09fdc6464b84a29273e3de10fa5cfadd3c257a66d59630fc499679680b33fb53`.
- Calibration (Ask 2, ≈3 s per proof in WASM on M-series): 2048 steps ≈ 6.3 s here ⇒ ≈3.5 s on the M4 Pro. **Kept `CHAIN_LEN = 2048`.**
- Determinism (I8): 10 native proves of one witness → 1 distinct proof (sha256 `cf4913b7…`); 3 WASM proves identical to each other and byte-identical to the native proof. ✓
- VK pinning (I10): the verifier's ACIR is exactly 77 `ASSERT wN = const` opcodes (76 distinct VK witnesses + key hash) feeding one `RECURSIVE_AGGREGATION`; enforced by `src/vk-pinning.test.ts`. ✓

## 2. Proof-layout manifest and mutation tests

- `src/generated/proof-layout.json` (sha256 `2c913f7e…f6c3`, pinned by test): io (pairing inputs) 0..7, oink commitments 8..39, sumcheck univariates 40..239 (25 × 8), sumcheck evaluations 240..280 (41), Gemini folds 281..376 (24 × 4), Gemini evals 377..401 (25), Shplonk Q 402..405, KZG W 406..409. Derived from bb's `honk/proof_length.hpp` + `bbapi_ultra_honk.cpp` (the exported proof keeps the 8-field pairing block) and cross-checked against the fixture's limb widths.
- Native mutation (`bb verify`): 410 single lowest-bit flips → 0 survive; 50 random 2–8-field flips → 0 survive; nonce ±1 in the public inputs → fails; VK of the 1024-step circuit → fails; ZK-flavour proof (458 fields) against the non-ZK verifier → fails with W_VK and with its own VK. ✓

## 3. Real claim transaction (`packages/contracts/elixir_spike`, `packages/deploy/scripts/spike-claim.ts`)

Isolated local network (own anvil + `aztec start --local-network` on registry-claimed ports), `@aztec/wallets/embedded`
with `proverEnabled: true` (native bb through bb.js), fees via the sponsored FPC, fresh initializerless Schnorr accounts.

| Step | Result |
|---|---|
| Bootstrap dry run (I12) | precomputed miner address == deployed address ✓; `bind_token` by a non-deployer → "not deployer" ✓; second `bind_token` → duplicate initialization nullifier ✓ |
| Chonk gates (`bb gates --scheme chonk`) | `claim` (inline verifier, both reads, nullifier, mint call, enqueue) **30,207**; `claim_split` 21,076 + `verify_ticket` 22,951 |
| Valid claim (inline) | accepted by the node; wall clock **10.2 s** end to end (ClientIVC proof 5.3 s), private balance = 4 ELX, `claims_in(0) = 1` ✓ |
| **ECCVM rows, full claim tx** | **6,259** (token deploy 4,392; `bind_token` 2,853); cap 2^15 = 32,768, GO bound 2^14 = 16,384 ✓ |
| Goblin ultra ops, claim tx | 953 (deploy 802, bind 565) |
| Replay of the same claim | rejected: nullifier collision at simulation ✓ |
| All-zero proof, simulate only | **accepted** — the ACVM does not evaluate the recursion black box (Fact 12), also shown by the `#[test]` in `crates/verify_w` |
| Wrong `out` (winning ticket) | rejected at proving: "Failed to verify the generated proof!" ✓ |
| Tampered, one per phase, each still a winning ticket | io, oink, gemini_folds, shplonk, kzg (commitment limbs): "Deserialized point is not on the curve" at proving; sumcheck_univariates, sumcheck_evaluations, gemini_evals (scalars): "Failed to verify the generated proof!" — 8/8 rejected, none reached the node ✓ |
| `claim_split` (separate only_self verifier circuit) | accepted; 10.1 s, ClientIVC 5.26 s, 6,160 ECCVM rows — not faster than inline. **Inline stays.** |
| Claim fee (receipt `transactionFee`, local network, sponsored by the FPC) | inline claim **62,693,849,472,000,000** fee-juice wei (≈ 0.0627 FJ); `claim_split` 58,524,892,272,000,000 (≈ 0.0585 FJ). Mainnet pricing is out of scope (Ask 10). |
| Bun process RSS during the run | ≤ 0.94 GiB (the native bb prover runs in its own process) |
| In-browser claim (`spike:browser`: Vite dev server with COOP/COEP, headless Chromium 151 via Playwright, `crossOriginIsolated = true`, 11 threads, IndexedDB stores) | **accepted**: wallet + PXE boot 5.9 s; bb.js init incl. CRS download 20.5 s (first use); W proofs in-page **3.4 s / 3.2 s** (faster than Bun's WASM runtime, 6.3 s); claim proved in-page (Chonk in WASM) and mined in **21.9 s**; private balance 4 ELX; page total 57.2 s; **peak RSS of the whole Chromium process tree 2,387 MiB** (sampled every 0.5 s). Machine: homelab (Ryzen 5 5600X), not the reference laptop. |

## 4. Ticket-cost measurements (`packages/work-circuit/scripts/ticket-cost.ts`, median of 5 native proves)

| phase | share of prove |
|---|---|
| create_circuit | 11.7 % |
| ProverInstance (trace, permutation polys) | 4.4 % |
| commit_to_wires (w_l, w_r, w_o) | 21.4 % |
| lookup counts/tags + w_4 commits | 8.3 % |
| z_perm grand product + commit | 11.4 % |
| sumcheck | 6.5 % |
| PCS (Gemini + Shplonk + KZG) | 36.6 % |

- (a) Early abort: the digest needs `KZG:W`, the last transcript entry, so it is computable at **100 %** of the prove (94.9 % of `bb prove` wall clock; the rest is I/O). GO ≥ 90 % ✓.
- (b) Same-witness re-derivation through the 4 disabled sumcheck rows: **≈ 62 %** of an honest prove must be redone (z_perm, sumcheck, PCS, w_4/lookup commits), **≈ 54 %** if the w_4/lookup block is also skipped. This is an attacker-favourable implementation estimate from honest-prover phase timers, not an executed re-derivation and not a cryptographic lower bound for an optimised incremental prover: `beta, gamma` are sampled after the wire commitments (`oink_prover.cpp:40,163`), so any commitment change re-randomises z_perm, sumcheck and the PCS (codex consult, verified against source). bb has no prover-resume path; an executed re-derivation needs a patched C++ build (a follow-up, owner's call). GO ≥ 50 % ✓ on the estimate.

## 5. CRS and simulation

- CRS (I9): native bb verifies SHA-256 chunk hashes on download (`get_bn254_crs.cpp`); cache loads only with `BB_VERIFY_CRS=1`; **bb.js's WASM path does no hash check** (HTTPS only). Phase 4 must hash the CRS bytes against bb's pinned chunk hashes before handing them to bb.js, or bundle a pinned CRS.
- Simulation (Fact 12): the ACVM accepts an all-zero proof (Noir `#[test]` under `aztec-nargo test`; PXE `simulate` of `claim` with a zero proof). TXE shares that simulator. Proof-validity tests must prove.

## 6. Verdict against Ask 4

| GO criterion | Result |
|---|---|
| Valid claim through the embedded wallet with the real prover accepted by a node | ✓ from Bun (native bb) and ✓ from a headless Chromium page (WASM) |
| Tampered proofs fail to prove for every transcript phase (native: all 410 fields) | ✓ 8/8 phases, 410/410 native |
| ECCVM rows for the full claim tx ≤ 2^14 | ✓ 6,259 |
| Repeated W proofs byte-identical | ✓ |
| Early-abort cost ≥ 90 % | ✓ 100 % |
| Disabled-row re-derivation ≥ 50 % of an honest prove | ✓ ≈ 54–62 %, estimate (see 4b) |
| Claim gas/resource usage reported | ✓ fee 62.7e15 FJ wei (inline), 6,259 ECCVM rows, 953 Goblin ops, ClientIVC 5.3 s |
| VK pinning confirmed in ACIR | ✓ |
| Bootstrap dry run | ✓ |
| In-browser claim time and peak memory (reported, not gated) | claim 21.9 s in-page, W proof 3.2–3.4 s, peak Chromium tree 2.4 GiB on this box (the plan's reference figures, ≤ 2 min p95 and ≤ 3 GB on the M4 Pro, are not gated; both look comfortably met here) |

**Verdict: GO.** Every hard criterion of Ask 4 holds on real runs. Caveats the owner should weigh: (1) the
disabled-row re-derivation figure is a timer-derived estimate, not an executed attack (§4b); (2) the browser CRS
is not hash-checked by bb.js (§5); (3) all timings are from the homelab, roughly 1.8× slower than the reference laptop
natively, while in-browser W proving here was faster than Bun's WASM runtime; (4) `claim_split` brings nothing, so
the inline verifier stays; (5) the Chonk claim circuit is 30.2k gates, half the plan's 50–60k estimate.
