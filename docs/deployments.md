# Deployments

## Bootstrap (fair launch)

A deployment nobody knows about can be mined alone before it is announced, so a legitimate launch is announced
first: publish the miner class id, salt, constructor arguments (`initial_target`, `genesis_seed`, `launch_at`), the
token address and `launch_at` (unix seconds, `ELIXIR_LAUNCH_AT` for `bun run deploy`) well before `launch_at`.
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


Contracts are immutable: a parameter change is a new deployment (`elixir.params.json` → `bun run codegen` →
`bun run contracts:compile` → `bun run deploy`). The machine-readable record of each deployment is
`deployments/<profile>.json`, written by the deploy script (and refused as an overwrite unless
`ELIXIR_DEPLOY_FORCE=1`).

## Public Aztec testnet — `testnet` profile (2026-09-04, hardened contract)

Supersedes the 01:27 UTC deployment of the pre-hardening contract (miner `0x1e57c929…90665f`), which stays on chain
but no longer matches the artifact; the 2 h soak in `docs/soak-report.md` ran against it.

| | |
|---|---|
| Node | `https://v5.testnet.rpc.aztec-labs.com` (L1 chain 11155111, node `5.2.0-nightly.20260815` at deploy time) |
| Miner (`ElixirMiner`) | `0x06ccc95e0260aa0cbd6c382ce0521563f6c2dead02470b5dd0332adbc3190015` |
| Token (aztec-standards `Token` v5.2.0, minter = miner, `bound_token()`) | `0x1fa8ff38a247fa569ef5c83109282491b64fbba4a81a77e684854a0ad4858f68` |
| Deployer (initializerless Schnorr account, no privilege after `bind_token`) | `0x2c7a1312299762bab96e91d83c26c4bf1754959bf95854df117b42bca4e3c54b` |
| Miner salt / token salt | `0x1b357136…9d75c` / `0x052b87dd…0d22` (full values in `deployments/testnet.json`) |
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

Web miner: `packages/web-miner/.env.production` carries these addresses; the page can be pointed elsewhere
through its Network card or `?node=&miner=&token=`.

Verify from public storage: `bun run epoch:stats` (reads `deployments/testnet.json`) prints every epoch's
target, opening time, claim count, duration and retarget ratio.

## Mainnet

Not deployed. The `mainnet` profile (N = 24, 1 h epochs, target 2^122, `ELX`) exists in `elixir.params.json`;
launch is a later plan (`docs/roadmap.md`).
