# elixir threat model

What an attacker can and cannot do against the mechanism as built, with the figures measured in this
repository. Attack costs below are *measured upper bounds on security*: they say how expensive the best
attack we implemented or timed is, not that no cheaper one exists. Mainnet operations (fee path, launch,
hardening pass) are a later plan; there is no external audit (owner's decision).

## Actors

Rational miners with modified clients; other miners (griefing, withholding); the sequencer (delay,
censor, order — cannot forge); web users (phishing, XSS, malicious RPC); the supply chain and toolchain.

## The guarantee

**One fresh accepting UltraHonk transcript of the work circuit `W` per ticket.** The ticket is
`Poseidon2(DOM_TICKET ∥ proof[0..410])` over the *entire* proof, and the claim verifies that exact proof
in-circuit against the pinned `W_VK` with deployment-bound public inputs (`domain`, epoch seed, epoch,
`Poseidon2(DOM_SECRET, secret, recipient)`, nonce, `out`). Nothing about a ticket can be learned before the last
transcript element exists.

| threat | defence | measured |
|---|---|---|
| Ticket grinding without proving | digest over the whole proof; exact-VK recursion; deployment-bound inputs; determinism and mutation tests; proof-layout manifest | early abort saves only serialisation: `construct_proof` is 94.9–95.2 % of `bb prove` wall clock; tampering any of the 410 fields fails to prove (410/410 native, 8/8 phases in-browser) |
| Same-witness re-proof through the 4 disabled sumcheck rows | none at the app layer (a bb property) | **not executed** (needs a patched prover); estimate 54–62 % of an honest prove from phase timers — the owner deferred the executed measurement (roadmap) |
| Amortisation (setup, fixed-base tables, witness MSMs) | accepted: bounded *transcript* cost per ticket, not equal hardware cost | — |
| Cross-deployment replay | `domain = Poseidon2(DOM_DEPLOY, chain_id, rollup_version, miner, VERSION)` in the inner public inputs: a fork or upgrade that keeps chain id, address and state cannot reuse work or re-spend tickets | rejected by the verifier in the live suite |
| Double claim / replay | full-width nullifier `Poseidon2(DOM_NULL, digest)` | duplicate nullifier rejected in the live suite |
| Bearer secret | the commitment is `Poseidon2(DOM_SECRET, secret, recipient)`, so a leaked (proof, secret) can only pay the recipient chosen when mining; the secret still dies with its epoch | rejected by the verifier when the recipient differs (live suite) |
| Issuance / load shocks | at most `N` accepted claims and `N × REWARD` per epoch by construction; retarget clamped to [¼, 4] | 10× / 100× / 1000× shocks converge in 2 / 4 / 5 epochs (simulator); 8 concurrent winners against `N = 4`: 4 accepted, 4 reverted in public paying gas (live) |
| Hashrate collapse | anyone may `roll()` after `T_MAX` (×4) | from 2^118, a ÷100 collapse recovers in 5 epochs; from 2^122 the target saturates at 2^128 − 1 and the cadence floors at `N / H` — liveness is kept, cadence is not |
| Withholding / time-warp | clamp + count-capping: stretching an epoch lowers the withholder's ELX/hour; stalling to `T_MAX` needs > 75 % of hashrate | simulated with a strategic miner |
| Roll-seed and closing-digest pre-mining | the escape-hatch seed is public from `opened_at + T_MAX`; on a count close the Nth claimer holding `k` surplus winners can pre-mine each candidate next seed and submit the digest with the best continuation. Bound (independent Poisson work, no censorship, `s` = its share, `p_e` = win probability per proof): expected pre-mined claims `≤ min(N, s/(1−s) · p_{e+1}/p_e)`, so next-epoch capture `≤ N·s + (1−s)·that`; a censoring sequencer removes the bound. `now` in the seed makes the closer hedge across inclusion slots and gives a sequencer-miner the same choice as an option; kept on purpose (codex would drop it). Acceptable at `N = 24`; at `N = 4` one pre-mined claim is a quarter of an epoch — testnet economics only | mean-field simulator over up to 10 slots (`retarget.test.ts`), not an adversarial search |
| Stale claim reverted in public | expected race (§2.4): fee lost, ticket unspent. A claim also caps its own life at `CLAIM_TTL_SECONDS` after its anchor block (`set_expiration_timestamp`), so a claim anchored during an epoch that closed long ago expires in the mempool instead of reverting; the PXE frees a dropped tx's pending delivery index on its next sender sync, whereas a *reverted* claim keeps it until the tx is FINALIZED on L1 (tens of minutes; the miner reports it and stops) | observed live (`lessons/phase-5.md`); expiration asserted in the live suite |
| Closing-claim gas | the Nth claim also retargets and opens the next epoch (≈ 25 % more public gas); a limit estimated from a non-closing state runs out of gas, reverts, pays and leaves the count at `N − 1` | found live; every miner declares the network's per-tx maximum (`claimGasLimits`) |
| Sponsored-fee griefing | any sponsor that pays for arbitrary calls is drainable by public reverts: premature `roll()`, claims sequenced after a close, or stale claims mined against an older, easier epoch. The TTL bounds the last one to epochs open within `CLAIM_TTL_SECONDS`; the rest is fee policy: the mainnet fee path must be self-paid or a sponsor with per-account quotas and an allowlist (`docs/roadmap.md`) | testnet only: the public sponsored FPC |
| Deployer premine / fair launch | a deployment nobody knows about can be mined alone for as long as its deployer likes (a slow premine keeps difficulty flat), and epoch 0's seed is a constructor argument. `launch_at` keeps epoch 0 closed until an announced time and the mainnet profile refuses a launch less than `LAUNCH_NOTICE_SECONDS` (one day) after deployment, so the instance is on chain and inspectable before it opens (`claim` asserts its anchor block is at or after `opened_at`; `roll` likewise), so publishing class id, salt, constructor args, token address and `launch_at` beforehand makes epoch 0 a public race. No Aztec-visible entropy exists for `seed_0`; only the announced deployment is legitimate. Residual: the deployer can stockpile epoch-0 tickets before deploying (bounded to `N` rewards plus the closing seed), as can anyone who reads the announcement during the notice | TXE: claims and rolls before launch refused; `epoch_params(0).opened_at == launch_at` |
| Deployment invariants | `bind_token` refuses the zero address and any token whose `get_minter()` is not this miner; under a notice period it must run before `launch_at`; `roll()` refuses an unbound deployment (otherwise anyone could roll it to a saturated target before it can mint); `bound_token()` and `work_vk_hash()` let anyone check the bound token and the pinned VK against the announcement; the initial target stays a constructor argument (tests mine at easy targets) and is part of the announcement | TXE: wrong minter, zero token and unbound roll rejected; Noir unit tests for the notice rule |
| Sequencer | can delay a claim past the close (fee lost, proof stale) and order `roll()` relative to claims only after `T_MAX`; cannot forge or steal | — |
| Timestamps | `opened_at` / `now` come from the sequencer within protocol bounds; durations are minutes, second-level skew is noise; `open_epoch` asserted in both the private anchor and public execution | same-block roll + claim refused at simulation (TXE), stale in public (live) |
| Lying RPC | cannot be detected by schema validation; it can waste work, never steal (claims are verified on-chain); optional second-node cross-check of `open_epoch`, target, seed and `opened_at` from public storage | web E2E: a disagreeing cross-check node stops the miner before any work; a malformed payload is rejected |
| Web page | strict CSP (`connect-src` limited to the origin and Aztec hosts; the CRS CDN excluded), COOP/COEP, no HTML injection, Worker crash surfaces and recovers on restart; a hosted page can read the tab's secret, proofs and recipient (stated on the page) | — |
| Privacy | a claim reveals: `claims[e]`, `last_digest[e] = digest`, the token's total supply, the siloed ticket nullifier, one note hash for the mint (+ the delivery handshake's record and nullifier); never the recipient or the secret. Caveat: the first mint to a recipient publishes a delivery handshake whose tag derives from the recipient address, so anyone who already knows an address can link its *first* claim to it by dictionary; later claims to the same recipient carry no handshake | asserted as an exact footprint delta over a baseline tx in the live suite |
| Supply chain / toolchain | aztec 5.2.0 only; installer sha256, `bb` / `aztec-nargo` binaries, bb.js WASM and nargo git checkouts pinned in `toolchain.lock.json`; Actions by SHA; 7-day npm min-age; frozen lockfile; `bun audit`; codegen diff in CI | — |
| CRS | transport: pinned sha256 of the exact byte ranges bb.js requests (`crs.lock.json`), verified at build and at runtime before bb.js sees them; ceremony trust is an accepted assumption shared with every Aztec user | CDN and native bb's chunk-verified cache agree |
| Contracts | public functions are counters and a close routine; the only external call is the token mint from its single minter; u128 saturating arithmetic; exact integer retarget with range-checked hints (malicious `(q, r)` rejected); no admin surface after `bind_token`; launch gating; claim TTL | TXE 32/32 incl. 7 generated cross-language vector tests; Noir unit tests incl. off-by-one, unreduced and wrapped hints |
| Cryptography | Poseidon2, UltraHonk, Chonk from bb 5.2.0; distinct domain separators (deploy, work, ticket, nullifier, seed, secret); no custom primitives | — |

## Accepted assumptions

- No malleation of an accepting `W` transcript cheaper than the measured re-proof exists (the external
  audit that would own this question is not planned).
- The BN254 KZG ceremony.
- Hosted dApps see what the tab sees.

## Out of scope here

Mainnet fee path and launch, external-wallet connection, native mining through aztec-accelerator, the
executed disabled-row re-derivation — all on `docs/roadmap.md`.
