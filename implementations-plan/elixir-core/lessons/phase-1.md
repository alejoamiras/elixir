# Phase 1 lessons — feasibility spike (homelab, AMD Ryzen 5 5600X × 12 threads, 30 GB)

## Item 1 — work circuit

- 2026-09-03 · `packages/work-circuit` is a Nargo workspace: `crates/lib` (generic `work::<L>` + the six domain separators), `crates/elixir_work` (production, `CHAIN_LEN = 2048`), `crates/sweep_{1024,4096}` (calibration only), `crates/verify_w` (plain recursive verifier with the VK embedded, for ACIR inspection and native measurements). Public inputs: `[domain, seed, epoch, miner_commit, nonce, out]`.
- `bb gates` JSON has no `gates` field in 5.2.0; `circuit_size` is the number. Sizes: 75,952 / 151,728 / 303,280 for 1024 / 2048 / 4096 steps (+2 vs the planning probe: the extra `domain` public input and the 6-wide seed hash).
- Native `bb prove` (this box, 12 threads): 0.62 / 1.12 / 2.05 s min; witness 0.33–0.61 s; VK 0.26–0.97 s. Proof 13,120 bytes = 410 fields; VK 3,680 bytes = 115 fields; `write_vk` also emits `vk_hash` (32 bytes).
- bb.js WASM (`BackendType.WasmWorker`, 11 threads): 3.53 / 6.31 / 11.56 s; WASM verify 0.93 / 1.61 / 2.84 s; WASM proofs are byte-identical to native ones. Calibration note: this box is ≈1.8× slower than the owner's M4 Pro natively (1.12 vs 0.63 s at 2048), so 2048 steps ≈ 3.5 s in WASM on M-series — on the ≈3 s target of Ask 2. Keeping `CHAIN_LEN = 2048`.
- Determinism (I8): 10 native proves of the same witness → 1 distinct proof (sha256 `cf4913b7…`); WASM ×3 runs also 1 distinct and equal to native.
- VK pinning (I10): `aztec-nargo compile --print-acir` on `verify_w` shows exactly 77 `ASSERT wN = <const>` opcodes (76 distinct VK witnesses — the 38 zero fields share one witness — plus `key_hash`) and one `BLACKBOX::RECURSIVE_AGGREGATION`, nothing else. Pinned by `src/vk-pinning.test.ts` against the generated `src/generated/vk.ts`.
- `W_VK_HASH = 0x09fdc6464b84a29273e3de10fa5cfadd3c257a66d59630fc499679680b33fb53` (elixir_work, 2048 steps, aztec 5.2.0).
- The Bash guard in this session rejects commands whose program name is a shell variable (`$BB …`) and loops with computed args; every measurement is therefore a Bun script under `packages/work-circuit/scripts/` (which is what `spike:*` wants anyway).
- bb 5.2.0 phase timers: `bb prove --print_bench` / `--bench_out <json>` / `--bench_out_hierarchical` / `--trace_out_perfetto` — the tools for item 4.
