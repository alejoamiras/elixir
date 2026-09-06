# Roadmap

Source of truth for phases and gates: `implementations-plan/elixir-core/plan.md` §6. This file tracks status and the
backlog that the plan defers.

## Phases (arc A1 = 0–1, A2 = 2–3, A3 = 4–5)

| Phase | What | Status |
|---|---|---|
| 0 | Scaffold + CI (Bun workspace, Biome budgets, hooks, run isolation, per-package PR gates) | done |
| 1 | Feasibility spike: work circuit, proof-layout manifest, real claim tx, ticket-cost measurements → GO / NO-GO | GO (owner, 2026-09-03); `implementations-plan/elixir-core/spike-results.md` |
| 2 | Contracts (`yacana_miner`, token binding, retarget, TXE tests, retarget simulator) | done |
| 3 | miner-core (proof → digest, retarget mirror, epoch reader, claim builder, live integration, concurrent burst) | done |
| 4 | Web miner (React + Vite + shadcn, Worker-hosted bb.js, embedded wallet, sponsored FPC, pinned CRS, Playwright E2E) | done |
| 5 | Testnet soak on the `testnet` profile (2 h, 21 epochs closed, `docs/soak-report.md`), docs, mainnet-readiness notes | done |

## Deferred (later plans)

- Native / CLI mining via aztec-accelerator on top of miner-core.
- External wallet connection (`@aztec/wallet-sdk`); the embedded wallet ships first.
- Mainnet fee path (fees are sponsored in this plan) and launch operations. Any sponsor that pays for arbitrary
  calls is drainable by public reverts (premature `roll()`, claims sequenced after a close): self-paid fees, or a
  sponsor with per-account quotas and a function allowlist (`docs/threat-model.md`).
- Live forced-expiry test: a claim held past `CLAIM_TTL_SECONDS` must be dropped, its PXE delivery index freed
  on the next sender sync, and a second claim from the same account accepted (the expiration itself is asserted
  in the live suite today).
- `/harden security` before any mainnet deployment (no external audit, plan Ask 8).
- Fully pinned toolchain install in CI: `toolchain.lock.json` pins the version installer script and verifies
  nargo, bb and the WASM after install, but the installer's own downloads (`noirup` from a moving branch,
  foundry, `npm install @aztec/*` without an integrity lock) still run unpinned on the runner. Owning the
  install (lockfile + pinned nargo release) closes that.
- An executed same-witness re-derivation measurement (patched bb prover build) — deferred by the owner after Phase 1; Phase 1 reports a timer-derived
  estimate (`spike-results.md` §4b).
- Web miner storage: the embedded wallet uses the deprecated IndexedDB stores (`@aztec/kv-store/deprecated/indexeddb`);
  moving to the SQLite-OPFS default needs its worker and WASM assets emitted unhashed by the build.
- **Claiming after a public revert** (Phase 5 finding): a stale claim that reverts in public leaves the miner's
  PXE with a pending note-delivery index for a nullifier that never landed; the next claim's constrained delivery
  asserts it and is refused until the reverted tx is FINALIZED on L1 (tens of minutes on the testnet). The web
  miner recovers by rebuilding the key's chain view (`resetAccountView`: drop the PXE namespace, reopen, re-register,
  re-sync; the reverted tx is absent from the chain's logs, so the fresh view never learns of the index), with an
  honest pause until finality as the fallback; the soak driver rotates to a fresh account. Residual: one device per
  key at a time (two PXEs on one account desync their delivery indexes). Upstream: [aztec-packages#25418](https://github.com/AztecProtocol/aztec-packages/issues/25418). A
  contract redesign without constrained delivery remains the other option: the standard token's
  `initialize_transfer_commitment(to, miner)` followed by a public `mint_to_commitment(commitment, reward)`; it needs
  a redeploy and a privacy-footprint review (the public-effects test would change).
- Passkey backup before mainnet: a passkey key has no backup by design today (the page says so); a synced
  passkey follows its platform account, a lost authenticator loses the key. Before mainnet: an export path or a
  words-backed second factor.
- Key rotation and account discovery: `deriveAccountFields` keeps its index parameter; the miner uses index 0 only.
- External wallet connection for launch mode (`@aztec/wallet-sdk`): the landing links the CLI commit path.
- Testnet soak operations: the soak driver (`packages/deploy/scripts/soak.ts`) mines from one machine with a
  hashrate schedule; a second machine or a second deployment profile would exercise multi-miner races beyond the
  8-wallet local burst.

## Decisions

Recorded in `implementations-plan/elixir-core/plan.md` §8 (decision ledger) and §5 (Asks 1–12, all decided).
