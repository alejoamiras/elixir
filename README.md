# elixir

A privately mineable token on Aztec whose mining work is Barretenberg proving. A miner proves a fixed
Noir circuit per nonce; the ticket is Poseidon2 over the whole UltraHonk proof; a ticket below the
target wins; the winner claims through a private transaction that verifies the proof in-circuit and
mints privately. Epochs close after `N` accepted claims and the target rescales by actual / expected
time, clamped to [¼, 4] — Bitcoin-style difficulty without a native hash to grind.

| | |
|---|---|
| Mechanism, security, phases | `implementations-plan/elixir-core/plan.md` |
| Threat model with the measured figures | `docs/threat-model.md` |
| Deployments (public testnet) | `docs/deployments.md` |
| Web miner | `packages/web-miner/README.md` |
| Roadmap and deferred work | `docs/roadmap.md` |
| Working conventions | `CLAUDE.md` |

## Layout

`packages/work-circuit` (the Noir work circuit `W` and its VK), `packages/contracts` (`ElixirMiner` and the
aztec-standards token), `packages/miner-core` (platform-agnostic TypeScript: proof → ticket, retarget mirror,
epoch reader, claim builder, mining loop), `packages/web-miner` (React page with an embedded wallet),
`packages/deploy` (deploy, soak and epoch-stats scripts), `scripts/run` (run isolation for parallel local
networks).

## Quick start

```
bun install
bun run codegen && bun run contracts:compile   # aztec 5.2.0 toolchain, see CLAUDE.md
bun run lint && bun test                        # unit suites
bun run e2e:agent -- bun test packages/miner-core                     # live suite on an isolated network
bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e        # web miner in headless Chromium
bun run --cwd packages/web-miner dev                                  # the miner against the public testnet
```
