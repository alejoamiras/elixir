# Roadmap

Source of truth for phases and gates: `implementations-plan/elixir-core/plan.md` §6. This file tracks status and the
backlog that the plan defers.

## Phases (arc A1 = 0–1, A2 = 2–3, A3 = 4–5)

| Phase | What | Status |
|---|---|---|
| 0 | Scaffold + CI (Bun workspace, Biome budgets, hooks, run isolation, per-package PR gates) | in progress |
| 1 | Feasibility spike: work circuit, proof-layout manifest, real claim tx, ticket-cost measurements → GO / NO-GO | pending |
| 2 | Contracts (`elixir_miner`, token binding, retarget, TXE tests, retarget simulator) | after GO |
| 3 | miner-core (proof → digest, retarget mirror, epoch reader, claim builder, live integration) | after GO |
| 4 | Web miner (React + Vite, Worker-hosted bb.js, embedded wallet, sponsored FPC) | after GO |
| 5 | Testnet soak (≥ 24 closed epochs), docs, mainnet-readiness notes | after GO |

## Deferred (later plans)

- Native / CLI mining via aztec-accelerator on top of miner-core.
- External wallet connection (`@aztec/wallet-sdk`); the embedded wallet ships first.
- Mainnet fee path (fees are sponsored in this plan) and launch operations.
- `/harden security` before any mainnet deployment (no external audit, plan Ask 8).
- Content-hash pinning of the aztec binaries and bb.js WASM blobs in CI (plan §4) once Phase 1 fixes the exact
  artifacts the build depends on.

## Decisions

Recorded in `implementations-plan/elixir-core/plan.md` §8 (decision ledger) and §5 (Asks 1–12, all decided).
