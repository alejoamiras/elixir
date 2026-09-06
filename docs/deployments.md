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

The three pages read this record through `packages/site/site.env` + `deployments/testnet.json` (the miner can
be pointed at another allowlisted node from its Settings; `?node=&miner=&token=` only in e2e builds).

### The site (`yacana.network`, a Cloudflare Worker serving static assets)

One origin, three apps, assembled by `bun run site:build` into `packages/site/dist`: the landing at `/`, the miner
at `/mine/`, the stats at `/stats/` (`/verify` rewrites to it), the CRS / artifacts / slot table once at the root,
`_headers` (COOP, COEP, CORP, the CSP with `connect-src` = the node, `Permissions-Policy`, `nosniff`,
`no-referrer`), `_redirects` (exact deep links → each app's directory) and `build.json` (mode, commit, node
origins, RP ID). Production builds take nothing from the process environment: a build with the e2e flag, a local
or plaintext node origin, or an RP ID other than `site.env`'s fails (`packages/site/src/config.ts`), and a
non-production mode can land neither in `packages/site/dist` nor in a Cloudflare build (`CF_PAGES`).

`packages/site/wrangler.jsonc` is the whole deployment definition: the Worker's name (`yacana`), the custom domain
(`yacana.network`, whose DNS record and certificate Cloudflare creates on the first deploy; the zone must be in the
same account), the assets directory (`dist`) and the SPA fallback; no Worker script runs, the assets service applies
`_headers` and `_redirects`. `workers_dev` is off (no second production origin); versions get preview URLs under
`workers.dev`, which the apps treat as previews (banner, no key creation).

Deploy (owner, from a machine authenticated with `wrangler login`, or with `CLOUDFLARE_API_TOKEN` in the shell and
never in the repo):

```
bun run site:deploy        # = bun run --cwd packages/site deploy: assemble the production site, then wrangler deploy
```

Git-triggered deploys are optional: Workers Builds (dashboard: connect the repository, root directory
`packages/site`, build command `bun install --frozen-lockfile && bun run build`, deploy command `bunx wrangler deploy`,
variable `BUN_VERSION=1.4.0`) runs the same two steps on every push to `main`; nothing else is configured there, the
file carries the rest. `bun run e2e:agent -- bun run site:e2e` serves an e2e assembly with `wrangler dev` and asserts
every path's app, identical headers, `build.json` and the landing's proof.

First production deploy: 2026-09-06, Worker version `ea00520a-65bf-415a-b524-4235442159c6`, commit `aef4edd`
(`build.json`), 624 assets; the custom domain, its DNS record and certificate were created by that deploy. Verified
live: every path with identical policy headers, the landing's strip reading the testnet (epoch 8), a real proof
through "Prove one now" (5.0 s), the stats' deep link, the miner's key screen with keys offered. Cloudflare
injects its Web Analytics beacon into HTML by default; the CSP blocks it (one console error per page) and the
promise is no trackers, so it is turned off in the Worker's Observability settings.

Zone settings (owner, once): `www.yacana.network` as a proxied placeholder DNS record with a Redirect Rule to the
apex (never a second host of the site: the apps treat any host other than `yacana.network` as a preview);
**Always Use HTTPS on** (SSL/TLS → Edge Certificates: the edge redirects a plain-http first visit, which would
otherwise load without `crypto.subtle` or COOP; the site itself sends HSTS in `_headers`); DNSSEC on; after the certificate is active, CAA records for Cloudflare's
CAs (`letsencrypt.org`, `pki.goog`, `ssl.com`, `digicert.com`). The previous `elixir-web-miner.pages.dev` project
stays until `yacana.network` serves (`docs/roadmap.md`).

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
