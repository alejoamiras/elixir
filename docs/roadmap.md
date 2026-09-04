# Roadmap

Source of truth for phases and gates: `implementations-plan/elixir-core/plan.md` §6. This file tracks status and the
backlog that the plan defers.

## Phases (arc A1 = 0–1, A2 = 2–3, A3 = 4–5)

| Phase | What | Status |
|---|---|---|
| 0 | Scaffold + CI (Bun workspace, Biome budgets, hooks, run isolation, per-package PR gates) | done |
| 1 | Feasibility spike: work circuit, proof-layout manifest, real claim tx, ticket-cost measurements → GO / NO-GO | measured; see `implementations-plan/elixir-core/spike-results.md` — owner decision pending |
| 2 | Contracts (`elixir_miner`, token binding, retarget, TXE tests, retarget simulator) | after GO |
| 3 | miner-core (proof → digest, retarget mirror, epoch reader, claim builder, live integration) | after GO |
| 4 | Web miner (React + Vite, Worker-hosted bb.js, embedded wallet, sponsored FPC) | after GO |
| 5 | Testnet soak (≥ 24 closed epochs), docs, mainnet-readiness notes | after GO |

## Deferred (later plans)

- Native / CLI mining via aztec-accelerator on top of miner-core.
- External wallet connection (`@aztec/wallet-sdk`); the embedded wallet ships first.
- Mainnet fee path (fees are sponsored in this plan) and launch operations.
- `/harden security` before any mainnet deployment (no external audit, plan Ask 8).
- Fully pinned toolchain install in CI: `toolchain.lock.json` pins the version installer script and verifies
  nargo, bb and the WASM after install, but the installer's own downloads (`noirup` from a moving branch,
  foundry, `npm install @aztec/*` without an integrity lock) still run unpinned on the runner. Owning the
  install (lockfile + pinned nargo release) closes that.
- An executed same-witness re-derivation measurement (patched bb prover build) — deferred by the owner after Phase 1; Phase 1 reports a timer-derived
  estimate (`spike-results.md` §4b).
- CRS integrity in the browser: hash the downloaded CRS against bb's pinned chunk hashes before handing it to bb.js,
  or bundle a pinned CRS (`spike-results.md` §5).

## Decisions

Recorded in `implementations-plan/elixir-core/plan.md` §8 (decision ledger) and §5 (Asks 1–12, all decided).
