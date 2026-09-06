# Deployments

## Bootstrap (fair launch)

A deployment nobody knows about can be mined alone before it is announced, so a legitimate launch is announced
first: publish the miner class id, salt, constructor arguments (`initial_target`, `genesis_seed`, `launch_at`), the
token address and `launch_at` (unix seconds, `YACANA_LAUNCH_AT` for `bun run deploy`) well before `launch_at`.
Epoch 0 does not exist until the launch lottery ran (`AZTEC_NODE_URL=… bun run launch -- commit|reveal|open`):
anyone commits a hash before `launch_at`, reveals inside the `REVEAL_WINDOW_SECONDS` after it, and anyone opens
epoch 0 once the window closed; `seed_0` folds every reveal, so the announcement alone lets nobody pre-mine it for
more than the window. The token must be bound before `launch_at`. Claims and rolls before the launch are refused. The mainnet profile refuses a `launch_at` less than `LAUNCH_NOTICE_SECONDS` (one day) after deployment.
Verify a deployment against its announcement with `epoch_params(0)` (`target`, `seed`, `opened_at`), `constants()`,
`work_vk_hash()`, `bound_token()` (must equal the announced token: a deployer could otherwise announce one token and
bind another) and the class ids and rollup version in `deployments/<profile>.json` (`minerClassId`, `tokenClassId`,
`rollupVersion`). `launch()` refuses an unbound deployment and `roll()` an unlaunched one, so an instance cannot be rolled
towards a trivial target before it can mint. `genesis()` shows the announced target, seed input and launch time. Nobody rolls for a reward, so run a keeper that calls `roll()` after `T_MAX`
(the soak driver and the web miner offer it) or an epoch stuck at `N − 1` claims hangs.


Contracts are immutable: a parameter change is a new deployment (`yacana.params.json` → `bun run codegen` →
`bun run contracts:compile` → `bun run deploy`). The machine-readable record of each deployment is
`deployments/<profile>.json`, written by the deploy script (and refused as an overwrite unless
`YACANA_DEPLOY_FORCE=1`).

## Public Aztec testnet — `testnet` profile (2026-09-05, Yacana)

First deployment under the Yacana name: new domain tags (`YACA/*`), genesis seed, work-circuit VK
(`W_VK_HASH` `0x1d1043617e4762fe8a2bb2ecf572de706ae890fdb4a4ff0d8f298e24722ece7b`) and token metadata; the contract
logic is the hardened one of the archived pre-rename deployment below.

| | |
|---|---|
| Node | `https://v5.testnet.rpc.aztec-labs.com` (L1 chain 11155111, node `5.2.0-nightly.20260815` at deploy time) |
| Miner (`YacanaMiner`) | `0x2091605cff5bb6658821ef6df7a268e7b499ff326cafba8a5696102212565e3e` |
| Token (aztec-standards `Token` v5.2.0, minter = miner, `bound_token()`) | `0x2f83633f946bdf7ea294183c9c49dfb4172646b1edf81a6fb4b4f305bbd42d88` |
| Deployer (initializerless Schnorr account, no privilege after `bind_token`) | `0x2c7a1312299762bab96e91d83c26c4bf1754959bf95854df117b42bca4e3c54b` |
| Miner salt / token salt | `0x0f4915a7…fa94c` / `0x17a20a0f…6c686` (full values in `deployments/testnet.json`) |
| Miner class id / token class id | `0x20680945…bebb9` / `0x10fd5603…fecbf` |
| Rollup version (in the deploy domain) | 1821665230 |
| Fees | sponsored FPC (`SPONSORED_FPC_SALT`) |
| Deployed / launched | 2026-09-05T16:38:35.518Z / epoch 0 opened 2026-09-05T16:39:00Z (`launchAt` 1788626340, immediate: no notice or reveal window in this profile) |

Parameters (the `testnet` profile, also embedded in the contract as compile-time globals):

| parameter | value |
|---|---|
| `N` (accepted claims per epoch) | 4 |
| `EXPECTED_EPOCH_SECONDS` | 300 |
| `T_MAX` (escape hatch, = 4 × expected) | 1200 |
| `REWARD` | 4 tYACA (4 × 10^18, 18 decimals) |
| `INITIAL_TARGET` | 2^124 (≈ 16 proofs per winning ticket) |
| `GENESIS_SEED` | `0x594143412f746573746e6574` ("YACA/testnet") |
| `CHAIN_LEN` (work circuit) | 2048 |
| `VERSION` (domain separator) | 1 |
| `CLAIM_TTL_SECONDS` | 600 |
| `LAUNCH_NOTICE_SECONDS` / `REVEAL_WINDOW_SECONDS` | 0 / 0 (mainnet: 86400 / 600) |
| Token | "Yacana Testnet" / `tYACA` |

Web miner: `packages/web-miner/.env.production` carries these addresses; the page can be pointed elsewhere
through its Network card or `?node=&miner=&token=`.

Verify from public storage: `bun run epoch:stats` (reads `deployments/testnet.json`) prints every epoch's
target, opening time, claim count, duration and retarget ratio; `packages/deploy/src/deployment-record.test.ts`
checks the record's shape and that its `params` match `yacana.params.json`.

## Mainnet

Not deployed. The `mainnet` profile (N = 24, 1 h epochs, target 2^122, `YACA`) exists in `yacana.params.json`;
launch is a later plan (`docs/roadmap.md`).

## Archived — Elixir (pre-rename) public testnet, `testnet` profile (2026-09-04, hardened contract)

The protocol was renamed from Elixir to Yacana on 2026-09-05 (new domain separators, VK and token metadata), so this
deployment no longer matches the artifacts in the repo. It stays on chain; its record is kept byte-for-byte as
`deployments/elixir-testnet-2026-09-04.json`.

Supersedes the 01:27 UTC deployment of the pre-hardening contract (miner `0x1e57c929…90665f`), which stays on chain
but no longer matches the artifact; the 2 h soak in `docs/soak-report.md` ran against it.

| | |
|---|---|
| Node | `https://v5.testnet.rpc.aztec-labs.com` (L1 chain 11155111, node `5.2.0-nightly.20260815` at deploy time) |
| Miner (`ElixirMiner`) | `0x06ccc95e0260aa0cbd6c382ce0521563f6c2dead02470b5dd0332adbc3190015` |
| Token (aztec-standards `Token` v5.2.0, minter = miner, `bound_token()`) | `0x1fa8ff38a247fa569ef5c83109282491b64fbba4a81a77e684854a0ad4858f68` |
| Deployer (initializerless Schnorr account, no privilege after `bind_token`) | `0x2c7a1312299762bab96e91d83c26c4bf1754959bf95854df117b42bca4e3c54b` |
| Miner salt / token salt | `0x1b357136…9d75c` / `0x052b87dd…0d22` (full values in `deployments/elixir-testnet-2026-09-04.json`) |
| Miner class id / token class id | `0x25ce05d8…52ccd` / `0x10fd5603…fecbf` |
| Rollup version (in the deploy domain) | 1821665230 |
| Fees | sponsored FPC (`SPONSORED_FPC_SALT`) |
| Deployed / launched | 2026-09-04T15:04:27Z / epoch 0 opened 2026-09-04T15:05:24Z (`launchAt` 1788534324, immediate: no notice or reveal window in this profile) |

Parameters (the `testnet` profile, also embedded in the contract as compile-time globals):

| parameter | value |
|---|---|
| `N` (accepted claims per epoch) | 4 |
| `EXPECTED_EPOCH_SECONDS` | 300 |
| `T_MAX` (escape hatch, = 4 × expected) | 1200 |
| `REWARD` | 4 tELX (4 × 10^18, 18 decimals) |
| `INITIAL_TARGET` | 2^124 (≈ 16 proofs per winning ticket) |
| `GENESIS_SEED` | `0x454c582f746573746e6574` ("ELX/testnet") |
| `CHAIN_LEN` (work circuit) | 2048 |
| `VERSION` (domain separator) | 1 |
| `CLAIM_TTL_SECONDS` | 600 |
| `LAUNCH_NOTICE_SECONDS` / `REVEAL_WINDOW_SECONDS` | 0 / 0 (mainnet: 86400 / 600) |
| Token | "Elixir Testnet" / `tELX` |

Verify from public storage: `bun run epoch:stats -- deployments/elixir-testnet-2026-09-04.json` prints every
epoch's target, opening time, claim count, duration and retarget ratio.
