# Phase 1 — the prover through Presto

Started 2026-09-09 after the design was approved (Plan A; two codex passes: rework → approve with changes, both
folded into `plan.md`).

## Log

- **Design facts that shaped P1** (from the audits, verified in source): the swap lives inside
  `PrestoWorkProver.prove()` through the SDK's `setForceLocal`, because `mineEpoch` holds its prover for the whole
  nonce loop; `429/503/408/413` are an immediate `fallback('transient')` in the SDK, so the prover gives a busy
  Presto three chances across nonces; the winning `attempt` message is held back until the proof verifies against
  the job's own public inputs; the headless server needs `AZTEC_BB_VERSION=5.2.0` beside `BB_BINARY_PATH` or it
  downloads bb before the first proof.
- **`bb` for `BB_BINARY_PATH` is not the toolchain's `bb` on PATH.** `~/.aztec/versions/5.2.0/node_modules/.bin/bb`
  and `bin/aztec-bb` are Node wrappers that locate the native binary; Presto needs the native executable itself:
  `~/.aztec/versions/5.2.0/node_modules/@aztec/bb.js/build/amd64-linux/bb`, the file `toolchain.lock.json` pins by
  digest. The e2e lane (P3) and the CI action must point at that path.
- **`export-vk.ts` needs `target/yacana_work.json`**, i.e. `bun run --cwd packages/work-circuit compile` first in
  a fresh worktree; the committed `artifacts/yacana_work.json` serves the tests but not `bb write_vk`.
- **Fake-Presto suite**: 5 tests, 84 s (seven real WASM proofs of W at 11 threads); the first `verifyWin` (WASM
  init + VK recomputation) took 3.1 s in-process. Codex's round-2 point that bb.js recomputes the VK per verify
  stands; at the win rate it is noise.
- **Guard collision check**: `setNodeEndpoint` and `setAcceleratorEndpoints` refuse each other's URLs; the
  existing suites needed no change beyond the new `describe`.
- **Loop specs**: threading `{ threads, presto }` through `init`/`reconfigure` changed no invariant; two specs added
  (coalescing asserts the endpoint; same threads + endpoint added is a rebuild).
- **Live gate (homelab, 2026-09-09)**: `presto-server 1.1.1` on a registry port with `PRESTO_HOME` under the scratch
  dir, `BB_BINARY_PATH` at the lock-pinned native `bb`, `AZTEC_BB_VERSION=5.2.0`; `/health` reported
  `aztec_version 5.2.0`, `available_versions ["5.2.0"]`, `schemes [chonk, ultra_honk]`. One W proof natively in
  **1854 ms** (phases detect → serialize → transmit → proving → proved → receive, no fallback) against **9153 ms**
  in WASM × 11 threads; byte-identical to the WASM proof and to bb's committed fixture; `verifyWin` true (first
  call 2687 ms), false on a corrupted copy; `PRESTO_HOME/versions` empty afterwards (no download); teardown by
  SIGTERM left nothing behind.
- **bb.js throws on a non-canonical proof element** (`Non-canonical proof element: value >= field modulus`) rather
  than returning false. First seen when the live test's corrupted copy flipped a field's top bit. The prover now
  checks W's shape *and* canonicity before a native proof reaches the digest (sticky `malformed-response`
  otherwise) and `verifyWin` turns a verifier throw into `false`, so a lying accelerator cannot crash the Worker
  into its replacement budget. A unit case covers both.
- **Suites sharing one bun process share the guard.** `node-guard.test.ts` arms the fetch guard over the realm; the
  prover suite running after it in one `bun test` saw its fake's requests blocked (`network` → sticky, zero
  requests recorded) while passing alone. The prover suites now admit the fake's URLs through
  `setAcceleratorEndpoints`, exactly as the Worker admits Presto's.
