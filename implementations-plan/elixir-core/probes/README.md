# Planning-time probes (2026-09-03, aztec 5.2.0 toolchain)

Scratch experiments that turned the plan's biggest inferences into measured facts. They are the starting
point for Phase 1, not finished tooling. Toolchain: `aztec-nargo` (Noir 1.0.0-beta.25) and
`bb` = `~/.aztec/current/node_modules/.bin/bb` (5.2.0). All numbers on an M4 Pro, 14 threads.

| File | What it measured | Result |
|---|---|---|
| `probe_a_recursion_plain.nr` | `verify_honk_proof_non_zk` in a plain `bin` program, `bb gates --scheme ultra_honk` | **681,980 gates** |
| `probe_b_recursion_aztec_contract.nr` | same call inside an Aztec `#[external("private")]` fn, bytecode extracted with `extract-aztec-fn.ts`, `bb gates --scheme chonk` | **19,923 gates** (baseline fn 5,469) |
| `work_circuit.nr` | Poseidon2 chain W (`CHAIN_LEN` 1024 / 2048 / 4096), `ultra_honk` gates; native `bb prove -t noir-recursive-no-zk` | 75,950 / 151,726 / 303,278 gates; 0.34 / 0.63 / 1.0 s |
| `mutate-proof-fields.ts` | flip the lowest bit of each of the 410 proof fields (32-byte big-endian) of the 1024-step proof and `bb verify` | fails for all 410 → zero unconstrained fields |
| (inline) `aztec-nargo execute` with an all-zero proof/VK for probe A | ACVM checks recursion? | **No** — "Circuit witness successfully solved" |

## Recipes

```bash
BB=~/.aztec/current/node_modules/.bin/bb
LIB=~/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0/barretenberg/noir/bb_proof_verification   # path dep

# plain program gates
aztec-nargo compile && $BB gates -b target/<pkg>.json --scheme ultra_honk

# aztec function gates (Mega/Chonk)
aztec-nargo compile && bun extract-aztec-fn.ts target/<pkg>-<Contract>.json verify_ticket && $BB gates -b target/fn-verify_ticket.json --scheme chonk

# work circuit: witness, vk, proof (vk is REQUIRED by prove), verify
aztec-nargo execute                       # -> target/<pkg>.gz
$BB write_vk -b target/<pkg>.json --scheme ultra_honk -t noir-recursive-no-zk -o target/vk
$BB prove -b target/<pkg>.json -w target/<pkg>.gz -k target/vk/vk --scheme ultra_honk -t noir-recursive-no-zk -o target/out   # proof = 410 x 32 bytes, public_inputs separate
$BB verify -p target/out/proof -i target/out/public_inputs -k target/vk/vk --scheme ultra_honk -t noir-recursive-no-zk
```

Gotchas: `bb prove` fails with "Unable to open file: ./target/vk" without `-k`; `--output_format` accepts only
`binary|json` in 5.2.0 (no fields dump — the binary proof IS the 410 fields, 32 bytes each, big-endian);
`bb gates --scheme ultra_honk` refuses Aztec function bytecode; `client_ivc` is not a scheme name (use `chonk`);
contract artifacts name functions `__aztec_nr_internals__<fn>`; the `bb_proof_verification` lib's `Nargo.toml`
has no deps, so a `path =` dependency to the checkout works.
