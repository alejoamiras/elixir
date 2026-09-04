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
`Poseidon2(DOM_SECRET, secret)`, nonce, `out`). Nothing about a ticket can be learned before the last
transcript element exists.

| threat | defence | measured |
|---|---|---|
| Ticket grinding without proving | digest over the whole proof; exact-VK recursion; deployment-bound inputs; determinism and mutation tests; proof-layout manifest | early abort saves only serialisation: `construct_proof` is 94.9–95.2 % of `bb prove` wall clock; tampering any of the 410 fields fails to prove (410/410 native, 8/8 phases in-browser) |
| Same-witness re-proof through the 4 disabled sumcheck rows | none at the app layer (a bb property) | **not executed** (needs a patched prover); estimate 54–62 % of an honest prove from phase timers — the owner deferred the executed measurement (roadmap) |
| Amortisation (setup, fixed-base tables, witness MSMs) | accepted: bounded *transcript* cost per ticket, not equal hardware cost | — |
| Cross-deployment replay | `domain = Poseidon2(DOM_DEPLOY, chain_id, miner, VERSION)` in the inner public inputs | rejected by the verifier in the live suite |
| Double claim / replay | full-width nullifier `Poseidon2(DOM_NULL, digest)` | duplicate nullifier rejected in the live suite |
| Bearer secret | the per-epoch secret is a bearer credential for tickets already found (whoever holds it picks the recipient); it dies with its epoch | — |
| Issuance / load shocks | at most `N` accepted claims and `N × REWARD` per epoch by construction; retarget clamped to [¼, 4] | 10× / 100× / 1000× shocks converge in 2 / 4 / 5 epochs (simulator); 8 concurrent winners against `N = 4`: 4 accepted, 4 reverted in public paying gas (live) |
| Hashrate collapse | anyone may `roll()` after `T_MAX` (×4) | from 2^118, a ÷100 collapse recovers in 5 epochs; from 2^122 the target saturates at 2^128 − 1 and the cadence floors at `N / H` — liveness is kept, cadence is not |
| Withholding / time-warp | clamp + count-capping: stretching an epoch lowers the withholder's ELX/hour; stalling to `T_MAX` needs > 75 % of hashrate | simulated with a strategic miner |
| Roll-seed pre-mining | the escape-hatch seed is public from `opened_at + T_MAX`; a sequencer-miner choosing among the next slots gains at most the claims it proves against the candidate seeds during its head start, still ≤ `N` | mean-field simulator over a choice of up to 10 slots (`retarget.test.ts`), not an adversarial search |
| Stale claim reverted in public | expected race (§2.4): fee lost, ticket unspent. Side effect found on the testnet: the claimant's PXE keeps a pending note-delivery index for the reverted tx until it is FINALIZED on L1, and the next claim's constrained delivery is refused meanwhile (tens of minutes). The miner reports it and stops; a griefer cannot cause it for others — only one's own stale claims do | observed live (`lessons/phase-5.md`) |
| Closing-claim gas | the Nth claim also retargets and opens the next epoch (≈ 25 % more public gas); a limit estimated from a non-closing state runs out of gas, reverts, pays and leaves the count at `N − 1` | found live; every miner declares the network's per-tx maximum (`claimGasLimits`) |
| Sequencer | can delay a claim past the close (fee lost, proof stale) and order `roll()` relative to claims only after `T_MAX`; cannot forge or steal | — |
| Timestamps | `opened_at` / `now` come from the sequencer within protocol bounds; durations are minutes, second-level skew is noise; `open_epoch` asserted in both the private anchor and public execution | same-block roll + claim refused at simulation (TXE), stale in public (live) |
| Lying RPC | cannot be detected by schema validation; it can waste work, never steal (claims are verified on-chain); optional second-node cross-check of `open_epoch` and the target from public storage | web E2E: a disagreeing cross-check node stops the miner before any work; a malformed payload is rejected |
| Web page | strict CSP (`connect-src` limited to the origin and Aztec hosts; the CRS CDN excluded), COOP/COEP, no HTML injection, Worker crash surfaces and recovers on restart; a hosted page can read the tab's secret, proofs and recipient (stated on the page) | — |
| Privacy | a claim reveals: `claims[e]`, `last_digest[e] = digest`, the token's total supply, the siloed ticket nullifier, one note hash for the mint (+ the delivery handshake's record and nullifier); never the recipient or the secret | asserted as an exact footprint delta over a baseline tx in the live suite |
| Supply chain / toolchain | aztec 5.2.0 only; installer sha256, `bb` / `aztec-nargo` binaries, bb.js WASM and nargo git checkouts pinned in `toolchain.lock.json`; Actions by SHA; 7-day npm min-age; frozen lockfile; `bun audit`; codegen diff in CI | — |
| CRS | transport: pinned sha256 of the exact byte ranges bb.js requests (`crs.lock.json`), verified at build and at runtime before bb.js sees them; ceremony trust is an accepted assumption shared with every Aztec user | CDN and native bb's chunk-verified cache agree |
| Contracts | public functions are counters and a close routine; the only external call is the token mint from its single minter; u128 saturating arithmetic; exact integer retarget with range-checked hints (malicious `(q, r)` rejected); no admin surface after `bind_token` | TXE 25/25; Noir unit tests incl. off-by-one, unreduced and wrapped hints |
| Cryptography | Poseidon2, UltraHonk, Chonk from bb 5.2.0; distinct domain separators (deploy, work, ticket, nullifier, seed, secret); no custom primitives | — |

## Accepted assumptions

- No malleation of an accepting `W` transcript cheaper than the measured re-proof exists (the external
  audit that would own this question is not planned).
- The BN254 KZG ceremony.
- Hosted dApps see what the tab sees.

## Out of scope here

Mainnet fee path and launch, external-wallet connection, native mining through aztec-accelerator, the
executed disabled-row re-derivation — all on `docs/roadmap.md`.
