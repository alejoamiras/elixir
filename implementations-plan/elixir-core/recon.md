# Recon — elixir-core (Phase 0.4)

Base: this repo is empty (fresh `git init`, one empty commit on `main`). Recon therefore mapped the four sources the plan can reuse from, not this tree:

1. `~/Projects/harsh-elixir` — the prototype being replaced (teardown: see the artifact linked in `plan.md`).
2. aztec-packages **v5.2.0** — `~/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0/` (Noir side) and `~/.aztec/versions/5.2.0/node_modules/@aztec/` (TS side). `noir/noir-repo` is an uninitialised submodule; stdlib facts were fetched from `noir-lang/noir` at the pinned commit `75061fab`.
3. `@defi-wonderland/aztec-standards` — fetched from GitHub (`dev` branch), not on disk.
4. `my-stack` skill templates (scaffold, CI, run isolation).

Two read-only agents, both `sonnet`. Budget as announced: 2 recon agents.

## Reuse map

| Capability needed | Found | Verdict | Justification |
|---|---|---|---|
| PoW hash-grind contract (`ElixirMiner`) | harsh-elixir `packages/elixir/contracts/elixir_miner/src/main.nr` | **build new** | Design is being replaced (hash grind → proof-of-proving). Keep only: miner identity bound into the work input, permissionless lazy epoch roll. |
| Token | harsh-elixir 47-line stub; aztec-standards `src/token_contract/src/main.nr`; aztec-packages reference `noir-contracts/contracts/app/token_contract` | **reuse-as-is: aztec-standards** | Single-minter model (`minter: PublicImmutable<AztecAddress>`, `_validate_minter` at main.nr:531-533) accepts a contract as minter. `mint_to_private(to, amount)` at main.nr:410. Version gap: aztec-standards pins aztec `v5.0.0-rc.2`, we target 5.2.0 → Ask. |
| Difficulty / target arithmetic in TS | harsh-elixir `packages/elixir/src/mining.ts` | **build new** | Different rule (Bitcoin retarget on a u128 target vs 2× step on a Field). Nothing to salvage but the idea of a TS mirror + parity test. |
| In-circuit Poseidon2 | `poseidon` crate v0.3.0 (`poseidon::poseidon2::Poseidon2::hash`), stdlib blackbox `std::hash::poseidon2_permutation` | **reuse-as-is** | ~77–83 gates per 2-field hash (flamegraph `noir-protocol-circuits/crates/blob/flamegraph/main_gates.svg`). |
| Recursive Honk verification in a private fn | `barretenberg/noir/bb_proof_verification/src/lib.nr` (`verify_honk_proof_non_zk`, `verify_honk_proof`); stdlib `verify_proof_with_type` | **adapt (spike first)** | Library exists and is unused by any app contract in the repo. Cost unknown for app circuits; README says naive verifier >512K gates. See "Load-bearing unknowns". |
| Private read of per-epoch public params | `PublicImmutable::read` from private (`state_vars/public_immutable.nr:318`, ~4k gates + init-nullifier check); `DelayedPublicMutable::get_current_value` (`delayed_public_mutable.nr:503`, timestamp-based expiration) | **reuse-as-is: PublicImmutable per epoch** | Per-epoch immutables avoid the delay/expiration window that a slow-proving claim tx would fall out of. |
| Time in contracts | public `context.timestamp()` (`public_context.nr:592`); private `context.get_anchor_block_header().timestamp()` (`private_context.nr:446`, `block_header.nr:32-42`) | **reuse-as-is** | Time-based epochs are feasible on both sides. |
| Replay protection | `context.push_nullifier_unsafe` (`private_context.nr:395`); `SingleUseClaim` (`state_vars/single_use_claim.nr:66`) | **reuse-as-is** | One nullifier per accepted ticket. |
| Private → public accounting | `self.enqueue(...)` (`contract_self_private.nr:302`); `#[internal("public")]`, `#[only_self]` (`macros/functions/mod.nr:365-372`) | **reuse-as-is** | `record_claim(epoch)` enqueued from the private claim. |
| Private → private cross-contract call (mint) | `self.call(Token::at(a).mint_to_private(...))` (`contract_self_private.nr:254`); callee sees `msg_sender() == caller contract` (`private_context.nr:1193-1200`) | **reuse-as-is** | |
| Standalone UltraHonk proving (miner side) | `@aztec/bb.js` `UltraHonkBackend` (`backend.ts:157-277`), `verifierTarget: 'noir-recursive-no-zk'` (`backend.ts:84-90`) | **reuse-as-is** | Non-ZK Ultra flavour has zero masking entities (`ultra_flavor.hpp:86-87`) → deterministic proof for a given witness. |
| Aztec tx proving (claim side) | `AztecClientBackend` (`backend.ts:307-443`); `PXE_PROVER_ENABLED` (`pxe/src/config/index.ts:61-104`); SAB + COOP/COEP (`docs/examples/webapp-tutorial/vite.config.ts:33-38`) | **reuse-as-is** | Default WASM CRS `2**19` (`bb.js/src/barretenberg/index.ts:8-10`), overridable via `srsSize`. |
| Contract tests | TXE `TestEnvironment` (`aztec-nr/aztec/src/test/helpers/test_environment.nr:74`): `new`, `deploy(...).with_public_initializer`, `call_private`, `call_public`, `mine_block`, `mine_block_at(ts)`, `set_next_block_timestamp`, `advance_next_block_timestamp_by` | **reuse-as-is** | Pattern: `noir-contracts/contracts/app/token_contract/src/test/utils.nr`. |
| Fee payment on testnet | `SponsoredFeePaymentMethod` (`@aztec/aztec.js/fee/testing`); `getSponsoredFPCAddress` (`@aztec/cli/src/utils/setup_contracts.ts:13-18`) | **reuse-as-is** | |
| Scaffold, CI, run isolation | my-stack skill templates | **reuse-as-is** | biome, husky, commitlint, per-package PR gates, `scripts/run/*`. |
| Web miner UI | harsh-elixir `packages/web-miner` (Svelte 5) | **build new** | Stack is React + Vite; the old UI never touched the chain and its account/balance logic is wrong (teardown). Its Worker partitioning idea (slot-per-worker) is irrelevant to a nonce lottery. |

## Facts established (5.2.0 unless noted)

**Protocol limits** (`noir-protocol-circuits/crates/types/src/constants.nr`; TS mirror `constants/src/constants.gen.ts:33-52`)

| Constant | Value |
|---|---|
| `MAX_PRIVATE_CALL_STACK_LENGTH_PER_CALL` | 8 |
| `MAX_PRIVATE_CALL_STACK_LENGTH_PER_TX` | 16 |
| `MAX_ENQUEUED_CALLS_PER_TX` / `_PER_CALL` | 32 / 32 |
| `MAX_NULLIFIERS_PER_TX` / `_PER_CALL` | 64 / 16 |
| `MAX_NOTE_HASHES_PER_TX` / `_PER_CALL` | 64 / 16 |
| `RECURSIVE_PROOF_LENGTH` (plain UltraHonk, Poseidon2 transcript, padded, size-independent) | 410 fields |
| `RECURSIVE_ZK_PROOF_LENGTH` | 458 fields |
| `ULTRA_VK_LENGTH_IN_FIELDS` | 115 fields |
| `PROOF_TYPE_HONK` / `PROOF_TYPE_HONK_ZK` | 0 / 6 (6 confirmed from `recursion_constraint.hpp:32`) |
| `DEFAULT_UPDATE_DELAY` = `MAX_TX_LIFETIME` | 86400 s |

**Proving system naming**: client proving is "Chonk" (HyperNova folding + Goblin), `constants.nr:673`, `chonk/README.md`. `createChonkProof` in `bb-prover/src/prover/client/bb_private_kernel_prover.ts:378` logs `client-ivc-proof-generation` with `duration`.

**Recursion**: stdlib exposes only `verify_proof_with_type<N,M,K>(vk: [Field;N], proof: [Field;M], public_inputs: [Field;K], key_hash: Field, proof_type: u32)` (`noir_stdlib/src/lib.nr:83-98`); `proof_type` must be a compile-time constant. Wrapper lib `bb_proof_verification` ships `verify_honk_proof_non_zk` (len 410, type 0) and `verify_honk_proof` (len 458, type 6). The `#[recursive]` attribute / `--recursive` flag no longer exist; recursion-friendliness is chosen at proving time via `verifierTarget`.

**Cost data points**: Poseidon2 hash ≈ 77–83 gates; historical public read from private ≈ 4k gates (`public_immutable.nr:290`); archive membership ≈ 3k (`private_context.nr:468`); naive UltraHonk recursive verifier "exceeds 512K gates" (`chonk/README.md:139-160`, analysis assumes inner N = 2^21; proof is padded so verifier cost is roughly inner-size independent).

**Token (aztec-standards, `dev`)**: `@defi-wonderland/aztec-standards@5.0.0-rc.2`, aztec deps pinned `v5.0.0-rc.2`; constructors `constructor_with_minter(name, symbol, decimals, minter, auth_contract)` and `constructor_with_initial_supply(...)`; `mint_to_private`, `mint_to_public`, `mint_to_commitment`. TS artifacts built by `scripts/build-package.sh`.

**Local toolchain (this machine)**: aztec CLI 5.2.0 (`aztec`, `aztec-nargo`, `aztec-txe`, `aztec-noir-profiler`, `aztec-bb`), `bb` 5.2.0, nargo 1.0.0-beta.16, bun 1.4.0, biome not installed globally (project-local), shellcheck + actionlint present, 48 GB RAM. A sandbox not owned by this session answers on 8080; gates must claim their own ports.

## Measured during planning (probe, 2026-09-03, aztec 5.2.0 toolchain)

Scratch projects compiled with `aztec-nargo` (nargo 1.0.0-beta.25) and measured with `bb gates` 5.2.0:

| Circuit | Scheme | `circuit_size` |
|---|---|---|
| Plain Noir program calling `verify_honk_proof_non_zk` once | `ultra_honk` (UltraCircuitBuilder) | **681,980** |
| Aztec contract `#[external("private")] fn baseline(x) -> x+1` | `chonk` (MegaCircuitBuilder) | 5,469 |
| Aztec contract `#[external("private")] fn verify_ticket(vk, proof, pi, key_hash)` calling `verify_honk_proof_non_zk` once | `chonk` | **19,923** |

So an Aztec app private function CAN contain the recursion blackbox (it compiles and builds), and under Chonk the ECC work is Goblin-offloaded: the verifier adds ≈14.5k gates to the function circuit, not ~680k. The offloaded ECC ops land in the tx's ECCVM/translator (the Chonk tail every Aztec tx already pays for); their marginal cost is measured in Phase 1. `bb gates --scheme ultra_honk` refuses Aztec function bytecode ("does not support CallData/ReturnData block constraints. Use MegaCircuitBuilder"), which is itself confirmation that app circuits are Mega circuits. Method: extract `functions[].bytecode` for `__aztec_nr_internals__<fn>` from the contract artifact into a program-shaped JSON, then `bb gates -b <file> --scheme chonk`.

Further probes, same session:

| Probe | Result |
|---|---|
| `aztec-nargo execute` of the recursion program with an all-zero proof/VK | **Succeeds** ("Circuit witness successfully solved") → simulation/TXE never check `recursive_aggregation` |
| Work circuit W gates (`ultra_honk`): `CHAIN_LEN` 1024 / 2048 / 4096 | 75,950 / 151,726 / 303,278 → ≈74 gates per Poseidon2 step |
| Native `bb prove -t noir-recursive-no-zk` wall time, M4 Pro 14 threads (needs `bb write_vk` first, `-k vk`) | 0.34 s / 0.63 s / 1.0 s |
| Proof binding: flip lowest bit of each of the 410 proof fields (32-byte big-endian) of the 1024-step proof, `bb verify` | fails for all 410 → **no unconstrained fields**; ticket may bind the whole proof |

## Load-bearing unknowns (become the Phase 1 spike)

1. **Claim-tx proving time and ECCVM headroom** with one recursive verification in the tx: native (PXE, `PXE_PROVER_ENABLED=true`) and in-browser WASM. The gate count is settled (above); what remains is whether the offloaded ECC ops fit the Chonk tail comfortably and what wall-clock the wallet pays. Determines browser claimability.
2. **Whether `recursive_aggregation` is checked during ACVM simulation** (TXE / `nargo execute`). If not, TXE cannot detect an invalid work proof and the claim path needs a real-proving integration test (`PXE_PROVER_ENABLED=true`).
3. **Work-circuit calibration**: gates per Poseidon2 chain step in UltraHonk and native/WASM proving time for 2^16, 2^17, 2^18 gate circuits on M-series and a mid-range laptop.
4. **ECCVM/op-queue headroom**: how many recursive verifications per tx fit before the Chonk tail circuit overflows (only matters if >1 claim per tx is ever wanted; plan assumes 1).

## Search trails for absence claims

- No app contract or aztec-nr helper calls `verify_proof`: `grep -rn verify_proof noir-projects/noir-contracts/ noir-projects/aztec-nr/` → 0 hits; all 30+ call sites are in `noir-protocol-circuits/crates/{types,private-kernel-lib,rollup-lib}` and `mock-protocol-circuits`.
- No explicit max-gates-per-private-circuit constant: grepped `1 << 19|1 << 20|2\^19|CIRCUIT_SIZE|MAX_CIRCUIT|DYADIC_CIRCUIT|max circuit` over `noir-protocol-circuits/`, `bb-prover/src`, `bb.js/src`, `pxe/src`, `simulator/src`; `AZTEC_TRACE_STRUCTURE|TraceStructure|structured_trace` over `barretenberg/cpp/src/barretenberg/` → 0 hits. Only `1 << 21` at `bb-prover/src/prover/server/bb_prover.ts:542` (AVM stats log) and `DEFAULT_BB_CRS_SIZE = 2**19` / `IOS_BB_CRS_SIZE = 2**18` in bb.js.
- No `max_block_number` mechanism in 5.2.0: `grep -rln max_block_number aztec-nr` → 0 (replaced by `set_expiration_timestamp`, `private_context.nr:648-650`).
- No bare `push_nullifier`: `grep -rn "fn push_nullifier(" aztec-nr` → 0 (`push_nullifier_unsafe`, `push_nullifier_for_note_hash` exist).
- No `SharedMutable` in 5.2.0 (renamed `DelayedPublicMutable`, `state_vars/mod.nr:41`).
- No conditional or looped private→private call in any shipped private function: AST-ish scan of every `#[external("private")]` body for `if … self.call(` and `for … self.call(` → 0; public-only analogues at `amm_contract/src/main.nr:168-169`, `avm_test_contract/src/main.nr:798-804`. Nothing forbids it (`private_call_requests` is a `BoundedVec`).
- No stated browser memory requirement for Chonk proving: `grep -rn -i "memory requirement|GB of memory|gigabytes" docs/docs-developers/` → 0.
- `SponsoredFeePaymentMethod` not in `@aztec/protocol-contracts`: `grep -rln -i sponsored protocol-contracts/src` → 0; it lives in `@aztec/aztec.js/fee/testing`.
- harsh-elixir: no tests, CI, lint or lockfile (`find` for `*.test.*`, `*.spec.*`, `biome.json`, `.github`, `vitest.config*`, `playwright.config*`; `grep '#\[test'` on contracts → 0).
