# Deployments

## Bootstrap (fair launch)

A deployment nobody knows about can be mined alone before it is announced, so a legitimate launch is announced
first: publish the miner class id, salt, constructor arguments (`initial_target`, `genesis_seed`, `launch_at`), the
token address and `launch_at` (unix seconds, `ELIXIR_LAUNCH_AT` for `bun run deploy`) well before `launch_at`.
Epoch 0 opens at `launch_at` for everyone at once; claims and rolls before it are refused. The mainnet profile refuses a `launch_at` less than `LAUNCH_NOTICE_SECONDS` (one day) after deployment.
Verify a deployment against its announcement with `epoch_params(0)` (`target`, `seed`, `opened_at`), `constants()`,
`work_vk_hash()`, `bound_token()` (must equal the announced token: a deployer could otherwise announce one token and
bind another) and the class ids and rollup version in `deployments/<profile>.json` (`minerClassId`, `tokenClassId`,
`rollupVersion`). Under a notice period the token must be bound before `launch_at`, and `roll()` refuses an unbound
deployment, so a mainnet instance that opens unbound is dead rather than rollable to a trivial target. Nobody rolls for a reward, so run a keeper that calls `roll()` after `T_MAX`
(the soak driver and the web miner offer it) or an epoch stuck at `N − 1` claims hangs.


Contracts are immutable: a parameter change is a new deployment (`elixir.params.json` → `bun run codegen` →
`bun run contracts:compile` → `bun run deploy`). The machine-readable record of each deployment is
`deployments/<profile>.json`, written by the deploy script (and refused as an overwrite unless
`ELIXIR_DEPLOY_FORCE=1`).

## Public Aztec testnet — `testnet` profile (2026-09-04)

| | |
|---|---|
| Node | `https://v5.testnet.rpc.aztec-labs.com` (L1 chain 11155111, node `5.2.0-nightly.20260815` at deploy time) |
| Miner (`ElixirMiner`) | `0x1e57c92988aa827a6a3b98ae9c78717885f6fed42c4923db7f7778285890665f` |
| Token (aztec-standards `Token` v5.2.0, minter = miner) | `0x2e4c2883e2a77f0a6385c8f8b7c5400cf2f25103bea803f642076ccb80154fa3` |
| Deployer (initializerless Schnorr account, no privilege after `bind_token`) | `0x2c7a1312299762bab96e91d83c26c4bf1754959bf95854df117b42bca4e3c54b` |
| Miner salt / token salt | `0x18069b05…63cd18` / `0x0b434343…731860` (full values in `deployments/testnet.json`) |
| Fees | sponsored FPC (`SPONSORED_FPC_SALT`) |
| Deployed | 2026-09-04T01:27:01Z |

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
| Token | "Elixir Testnet" / `tELX` |

Web miner: `packages/web-miner/.env.production` carries these addresses; the page can be pointed elsewhere
through its Network card or `?node=&miner=&token=`.

Verify from public storage: `bun run epoch:stats` (reads `deployments/testnet.json`) prints every epoch's
target, opening time, claim count, duration and retarget ratio.

## Mainnet

Not deployed. The `mainnet` profile (N = 24, 1 h epochs, target 2^122, `ELX`) exists in `elixir.params.json`;
launch is a later plan (`docs/roadmap.md`).
