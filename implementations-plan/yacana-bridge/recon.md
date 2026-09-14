# recon — yacana-bridge (Phase 0.4, main @ 2026-09-12, clean)

Four read-only agents: a reuse sweep over this repo (below), and three research mappers persisted under
`research/` (`aztec-upgrade.md`, `cross-chain.md`, `web-miner.md`). Paths are repo-relative; the pinned Aztec
sources are under `~/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0/` ("the 5.2.0 sources").

## Reuse map

| capability | what exists | verdict |
|---|---|---|
| Authwit for a third-party burn | `EmbeddedWallet.createAuthWit` (`@aztec/wallets/src/embedded/embedded_wallet.ts:193`), `computeAuthWitMessageHash` (`@aztec/aztec.js/src/utils/authwit.ts`); the token's `burn_private` is `#[authorize_once("from","_nonce")]` (aztec-standards `token_contract/src/main.nr:468-492`); this app only self-calls at nonce 0 (`packages/web-miner/src/chain.ts` `sendWithdraw`, `session.ts` `withdraw`) | **adapt**: a `sendAhead`-shaped sibling of `sendWithdraw` that creates the authwit for the miner's call to `burn_private`; the token and the SDK need nothing |
| L1↔L2 messaging in Noir | none in `packages/contracts` (grep `EthAddress|message_portal|l1_to_l2|l2_to_l1|portal` → 0). Reference: `noir-contracts/contracts/app/token_bridge_contract/src/{main,config}.nr` + the `token_portal_content_hash_lib` crate; L1 side `l1-contracts/test/portals/TokenPortal.sol` | **build new**, mirroring `TokenBridge`/`TokenPortal.sol` line for line (portal address in `PublicImmutable<EthAddress>`, `message_portal`, `consume_l1_to_l2_message`, content hashes byte-identical to Solidity) |
| Public storage reads in the browser | fixed fields: `fixedSlot` + `readSlot` in `packages/miner-core/src/reader.ts` (`readTotalSupply`, `readOpenEpochNumber`…); map fields need the slot table (`slots.ts`, `scripts/gen-slots.ts`, `packages/site/src/browser/slots.ts`); consumers `packages/web-stats/src/beats.ts` `BeatReads.fixed()` | **reuse-as-is** for the new counters (`exited_total`, `exits_count`, `claimed_from_l1_total`, `retired`): a layout entry + a `readX()` + a fixed-beat call. The exit log is read from the node's public logs, not storage |
| A user-set Ethereum RPC | the node setting: `packages/site/src/browser/{connection,node,node-health}.ts`, `packages/web-miner/src/components/NodeTile.tsx`, `settings.ts`; the guard `node-guard.ts` admits same-origin, the node, the accelerators set, leased candidates — nothing else; CSP already `connect-src 'self' data: https:` (`headers.ts`) | **adapt**: a second persistent admitted endpoint in the guard (`setEthRpcEndpoint`), a `Connection.ethRpcUrl` (or sibling key), an `EthRpcTile` cloned from `NodeTile`; no CSP change (touching `headers.ts` fails the pinning test for nothing) |
| Keys and account derivation | `packages/miner-core/src/keys/derive.ts` (HKDF, no chain/rollup input: the same master derives the same keys on every version); `packages/web-miner/src/keys/store.ts` (`MasterRecord.account.address`, `openMaster` fails closed on a mismatch; IndexedDB `yacana-keys` NOT per rollup); `wallet.ts` `pxeNamespace = yacana-pxe-<chainId>-<rollupVersion>-<rollupAddress>` (per rollup); `boot.ts` `viewBuiltOn` → `resetAccountView` on a new namespace; `assertDeployment` in `reader.ts:52`; `host.ts` exact-match production host | **adapt**: keys unchanged; the stored address must be keyed by account class id (the address embeds the account contract class, which changes per version — research/web-miner.md); `hostKind` gains the versioned origin; words are re-entered on the other origin, passkeys restore |
| Deployment tooling | `packages/deploy/src/deploy.ts` (`deployYacana`, `deployments/<profile>.json`, refuses overwrite), `scripts/record-rollup-address.ts`, `launch.ts`; `packages/site/src/vite-base.ts` `siteConfig()` (`YACANA_PROFILE`); precedent for a frozen old record: `deployments/elixir-testnet-2026-09-04.json` (docs/deployments.md) | **adapt**: `deployYacana` grows the checkpoint constructor args and the portal address; a second profile = the old version's frozen record; the site build gains a profile/out-dir parameter |
| The isolated network | `scripts/run/isolated-node.ts` boots `aztec-anvil` + `aztec start --local-network --l1-rpc-urls`, returns `{nodeUrl, l1RpcUrl, runId, runRoot, teardown}`, sets `AZTEC_NODE_URL` and `L1_RPC_URL` for the child; `toolchainBin()` resolves `~/.aztec/versions/5.2.0/bin/*` where `aztec-forge` (1.4.1), `aztec-cast`, `aztec-anvil` already live; ports via `registry.ts`, data under `.localnet/` | **reuse-as-is** for L1 exposure and the Foundry binaries; **build new**: the upgrade harness (a second rollup, governance, a second node) — research/aztec-upgrade.md |
| E2E harnesses | per-app Playwright configs (`testMatch: *.e2e.ts`, `globalSetup` → Bun `run-setup.ts` → `.run.json`); `packages/web-miner/e2e/run-setup.ts` deploys a throwaway easy-target Yacana; `tests/*.bun.test.ts` for WASM/crypto suites; no viem/ethers in any package (only `@aztec/viem` 2.38.2 transitively) | **build new**: a bridge suite threading `l1RpcUrl` into `.run.json`; pin viem at the version the Aztec packages pin |
| Second origin | `packages/site/www/wrangler.jsonc` + `deploy:www` (a second Worker on `www.yacana.network`, documented in docs/deployments.md); `assemble.ts` builds one `dist` for one profile | **adapt**: `packages/site/v5/` (or a parameterised assemble) with its own `wrangler.jsonc` on `v5.yacana.network` serving the frozen build; headers/CSP/`_redirects` verbatim |
| Docs | `docs/deployments.md` (the operator precedent: tables, exact commands, verification), `docs/threat-model.md` (threat/defence/measured rows), `docs/roadmap.md`; README table | **reuse the shape**: `docs/bridge.md` (design) + `docs/upgrades.md` (runbook), threat-model rows added |
| CI | `_changes.yml` reusable filter; `contracts.yml` (codegen diff, compile, layouts diff, TXE, artifacts diff, site build); `miner-core.yml` (lint, audit, typecheck, unit); `e2e.yml` (workflow_dispatch, three isolated-network jobs); `setup-aztec` composite pins the toolchain | **adapt**: `portal.yml` (forge build/test via `setup-aztec`'s bin dir), a fourth `e2e.yml` job for the harness, `contracts.yml` filter widened |
| Solidity/Foundry | none in the repo; the 5.2.0 sources' `l1-contracts` (foundry.toml, `test/portals/TokenPortal.sol`, `src/core/messagebridge/*`, `src/governance/*`) | **build new** `packages/portal` (Foundry: OpenZeppelin + the Aztec interfaces vendored or installed by tag) |

## Conventions to match

- Biome: cognitive ≤ 15, ≤ 80 non-blank lines per production function, never suppressed.
- Tests: `*.test.ts` (bun + Vitest — no regex/undefined in `toMatchObject`, no fake timers), `*.vitest.tsx` (jsdom), `*.bun.test.ts` (WASM/crypto, under `tests/`), `*.e2e.ts` (Playwright only); external-system code gets one `describe.skipIf(!ENV)` live test.
- Run isolation: registry ports, owned process groups, `.localnet/` data; long runs in tmux.
- Proof validity is only checked by real proving; tests about proofs must prove.
- Comments say what the code cannot; no plan/phase/review references.
- Conventional commits, signed (non-interactive here); PRs only at Delivery.

## Collision risks

1. A bespoke approval mechanism instead of authwits: the token and the SDK already do it.
2. A CSP change for the RPC: unnecessary; the guard is the gate.
3. Bridge state on the miner vs a separate contract: the token's minter is the miner (immutable), so `claim_from_l1` and `retire` must live on the miner; the exit's burn could live elsewhere, at the cost of two registered addresses per version. Decision in the ledger.
4. A second key vault: the master already derives version-independent keys; only the stored address must be keyed by class id.
5. A second site pipeline: parameterise `assemble.ts` and follow `www/`, do not fork it.
6. Slot-table machinery for plain counters: fixed slots suffice.
7. A new Foundry-resolution helper: `toolchainBin('aztec-forge')` already resolves it.

## Search trails for absences

- No authwit use in app code: `grep -rn "authwit|Authwit|AuthWit" packages --include=*.ts,*.tsx,*.nr` → one comment in `chain.ts`.
- No L1↔L2 messaging in Noir: `grep -rniE "ethaddress|message_portal|l1_to_l2|l2_to_l1|portal" packages/contracts` → 0.
- No Solidity/Foundry: `find . -iname "*.sol" -o -iname foundry.toml` (excl. node_modules) → 0; no `@aztec/l1-artifacts` dependency declared.
- No viem/ethers in any `package.json`; `node_modules/viem` absent; `node_modules/@aztec/viem` present transitively.
- No second wrangler config beyond `www/`; `assemble.ts`, `vite-base.ts`, `config.ts`, `wrangler.jsonc` assume one profile/one dist.
- No FAQ or bridge docs anywhere under `docs/` or the apps.
