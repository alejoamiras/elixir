# Roadmap

Source of truth for phases and gates: `implementations-plan/elixir-core/plan.md` §6. This file tracks status and the
backlog that the plan defers.

## Phases (arc A1 = 0–1, A2 = 2–3, A3 = 4–5)

| Phase | What | Status |
|---|---|---|
| 0 | Scaffold + CI (Bun workspace, Biome budgets, hooks, run isolation, per-package PR gates) | done |
| 1 | Feasibility spike: work circuit, proof-layout manifest, real claim tx, ticket-cost measurements → GO / NO-GO | GO (owner, 2026-09-03); `implementations-plan/elixir-core/spike-results.md` |
| 2 | Contracts (`elixir_miner`, token binding, retarget, TXE tests, retarget simulator) | done |
| 3 | miner-core (proof → digest, retarget mirror, epoch reader, claim builder, live integration, concurrent burst) | done |
| 4 | Web miner (React + Vite + shadcn, Worker-hosted bb.js, embedded wallet, sponsored FPC, pinned CRS, Playwright E2E) | done |
| 5 | Testnet soak on the `testnet` profile (≤ 2 h), docs, mainnet-readiness notes | in progress |

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
- Web miner storage: the embedded wallet uses the deprecated IndexedDB stores (`@aztec/kv-store/deprecated/indexeddb`);
  moving to the SQLite-OPFS default needs its worker and WASM assets emitted unhashed by the build.
- Web miner E2E does not record peak browser memory (Phase 1's spike page did: 2,387 MiB process-tree RSS
  for wallet + W proving + in-page claim); the persistent-context RSS watcher from `spike-browser.ts` can be
  ported into the Playwright fixture.
- Testnet soak operations: the soak driver (`packages/deploy/scripts/soak.ts`) mines from one machine with a
  hashrate schedule; a second machine or a second deployment profile would exercise multi-miner races beyond the
  8-wallet local burst.

## Decisions

Recorded in `implementations-plan/elixir-core/plan.md` §8 (decision ledger) and §5 (Asks 1–12, all decided).
