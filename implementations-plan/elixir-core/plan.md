# elixir-core — proof-of-proving mining on Aztec

**Tier**: `mid` (user's call). Rubric scored HIGH on novelty, irreversibility (mainnet token) and security sensitivity → rubric says `deep`; recorded as an accepted deviation.
**Budget**: recon 2 agents (done) · `/code-review` low (arc 1) / medium (arcs 2–3) · codex loops until clean, hard stop at 3.
**eli5_mode**: Artifact (URL recorded in Seeds once published).
**Status**: v7 — **APPROVED 2026-09-03** by the owner with the decisions in §5/§8 ("This looks pretty good"; implementation to start on the homelab). Hand-off: `context.md`. Next: arc A1 (Phases 0–1), hard stop after Phase 1.
**Verdicts**: codex R1 `reject` → R2 `conditional approve` (adopted) · fable-role `conditional approve` (adopted) · final fresh-context codex R1 `reject` → R2 **`conditional approve`** (three conditions, adopted in v6). Transcripts: `audit-codex.md`, `audit-fable.md`.

Related: teardown of the prototype this replaces → artifact `https://claude.ai/code/artifact/4be64d08-8d1e-4581-a14a-3152909b3890`; recon → `recon.md`; audits → `audit-codex.md`, `audit-fable.md`.

---

## 1. Goal

A privately mineable token on Aztec whose mining work is **Barretenberg proving**, with **Bitcoin-style difficulty**, **constant perpetual emission**, and **recipient-private mining**. Deliverables: contracts, a platform-agnostic miner core, a web miner with an embedded wallet, tests, testnet deployment with sponsored fees. The *mechanism* is held to a mainnet-grade security bar; mainnet operations (fee path, launch, hardening pass) are a later plan. CLI / native mining arrives later via aztec-accelerator on top of the same miner core.

**"Bitcoin-style" means, precisely**: a 128-bit threshold on a Poseidon2 digest of the proof (the "ticket"); epochs that close after a fixed number of accepted claims `N` (Bitcoin's 2016-block window), so issuance per epoch is `N × REWARD` by construction; a target retargeted by `expected_duration / actual_duration`, clamped to [¼, 4]; a time-based escape hatch for hashrate collapse. It is not Bitcoin's 256-bit SHA256d PoW, and there is no block chain — claims are independent transactions.

**Privacy claim, precisely**: the miner's identity, secret and balance are never public. What is public: that a claim transaction happened, its epoch, the winning digest (pseudorandom, reveals nothing about the miner), the constant reward amount, and the timing. A claim tx is recognisable as a mining claim (function identity and public effects). RPC/network-level timing linkage is the user's own operational concern, as in any Aztec dApp.

**Done means**: a browser user connects a wallet, mines (real UltraHonk proofs in a Worker pool), a winning ticket is claimed through a private Aztec transaction, ELX lands in their private balance, and the on-chain epoch cadence stays near the configured expected duration across ≥ 24 epochs on testnet. Every phase gate is green; the deployment is documented and reproducible from pinned commits.

## 2. The mechanism

### 2.1 Why a proof-hash lottery

Any lottery whose ticket the miner can compute natively becomes native hashing (the prototype's failure). The fix, borrowed from Aleo's puzzle family: **the ticket is a hash of the entire proof.** To learn whether a nonce wins, the miner must produce a complete, accepting UltraHonk proof. Losers are never submitted, so *accepted* claims per epoch are exactly `N` no matter how much prover throughput joins (submitted-but-stale claims are bounded by fee loss, §2.4).

The guarantee this design defends is: **one fresh accepting proof transcript per ticket.** The cheapest *known* way to obtain one (below) costs a full sumcheck plus the polynomial-commitment opening of that transcript; that no cheaper way exists is an accepted assumption owned by the external audit. It does not claim equal hardware cost per ticket. Two amortisations are known and accepted: (a) proving-key construction, CRS loading and fixed-base MSM tables; (b) non-ZK UltraHonk leaves the first 4 sumcheck rows unconstrained (`TRACE_OFFSET = NUM_DISABLED_ROWS_IN_SUMCHECK = 4`, with `sigma = id` on those rows), so a modified prover can re-prove the *same* witness with fresh values in those 16 cells, updating the witness-wire commitments with ~16 scalar multiplications instead of size-`n` MSMs, and obtain a new accepting transcript and therefore a new ticket for roughly half to two-thirds of an honest prove. Phase 1 implements that attack and measures its cost with bb's phase timers — a measured attack cost, i.e. an upper bound on security, not a proven lower bound — and the plan carries the number. A GPU UltraHonk prover would win outright; that is the intended incentive.

### 2.2 Mining loop (miner side, off-chain)

```
params = ElixirMiner.epoch_params(e)               // seed_e, target_e, claims_e (public reads)
domain = Poseidon2(DOM_DEPLOY, chain_id, miner_contract, VERSION)
commit = Poseidon2(DOM_SECRET, secret)
loop while claims_e < N:
  nonce += 1
  witness = W(domain, seed_e, e, commit, nonce)       // fixed Noir circuit, Poseidon2 chain of length L
  proof   = UltraHonk.prove(W, witness)               // the work — bb.js WASM now, native bb later
  digest  = Poseidon2(DOM_TICKET, proof[0..410])      // 254-bit
  if low128(digest) < target_e: claim(e, nonce, secret, proof)   // rare
```

### 2.3 Claim (on-chain, private)

```
private fn claim(e, nonce, out, secret, proof[410], recipient):     // out = W's public output, supplied by the miner
  assert open_epoch (historical read at the anchor block) == e     // doomed claims fail at simulation
  params = epochs[e].read()                                       // PublicImmutable per epoch
  domain = Poseidon2(DOM_DEPLOY, context.chain_id(), self.address(), VERSION)
  commit = Poseidon2(DOM_SECRET, secret)
  verify_honk_proof_non_zk(W_VK, proof, [domain, params.seed, e, commit, nonce, out], W_VK_HASH)   // inline, one circuit
  digest = Poseidon2(DOM_TICKET, proof)                           // 254-bit
  assert low128(digest) < params.target
  push_nullifier(Poseidon2(DOM_NULL, digest))                     // full-width; one claim per transcript
  enqueue record_claim(e, digest)                                 // FIRST: a stale claim reverts before any mint work
  Token.mint_to_private(recipient, REWARD)                        // aztec-standards; this contract is the minter
```

### 2.4 Epochs, closing, retarget (public)

```
state: open_epoch e, epochs[e] = { target, seed, opened_at }, claims[e], last_digest[e]

record_claim(e, digest)  [only_self, enqueued by claim]:
  assert e == open_epoch and claims[e] < N          // else revert: stale claim (Bitcoin orphan analogue)
  claims[e] += 1;  last_digest[e] = digest
  if claims[e] == N: close(e, actual = min(now − opened_at, T_MAX), closing_digest = digest)   // capped: nobody may
                                                     // have called roll(), so the Nth claim can land arbitrarily late

roll()  [permissionless escape hatch]:
  assert now − epochs[e].opened_at ≥ T_MAX           // hashrate collapse: don't wait forever for N claims
  close(e, actual = 4 × EXPECTED_EPOCH_SECONDS, closing_digest = last_digest[e])
  // ≡ ×4 exactly: with T_MAX = 4 × EXPECTED any "elapsed × N / claims" formula is always clamped to ×4, so say so.

close(e, actual, closing_digest):
  // exact integer arithmetic. Invariant: actual ≤ T_MAX (both callers cap it), T_MAX = 4 × EXPECTED,
  // EXPECTED < 2^17 (compile-time asserts). target < 2^128 ⇒ product = target × actual < 2^147, far below p.
  // Quotient q and remainder r are unconstrained hints, then constrained as:
  //   q < 2^130 (range check)  ∧  r < EXPECTED  ∧  q × EXPECTED + r == product  (Field equality)
  // With q and r range-bounded the equality cannot wrap mod p, so (q, r) is the unique Euclidean pair.
  raw    = q                                                       // = floor(target_e × actual / EXPECTED) ; fast epoch → smaller → harder
  lo     = target_e / 4 + (target_e % 4 != 0)                      // ceil without overflow
  hi     = if target_e > (2^128 − 1) / 4 { 2^128 − 1 } else { target_e × 4 }   // saturating ×4 without overflow
  target = max(clamp(raw, lo, hi), 1)                              // EXPECTED_EPOCH_SECONDS > 0 asserted at compile time
  seed   = Poseidon2(DOM_SEED, seed_e, e + 1, closing_digest, now)
  epochs[e+1] = { target, seed, opened_at: now };  open_epoch = e + 1
```

- **Issuance and accepted load are bounded per epoch by construction**: at most `N` accepted claims and **at most** `N × REWARD` minted per closed epoch (exactly `N × REWARD` when the epoch closes on count; fewer on an escape-hatch close). "Constant emission" is the steady-state expectation, not a per-hour guarantee: during a hashrate shock, epochs close fast and wall-clock issuance can briefly reach `N × REWARD` per block while the target ratchets ÷4 per epoch (a 100× shock converges in ⌈log₄ 100⌉ = 4 epochs, 1000× in 5). That is Bitcoin's own delayed-adjustment behaviour, stated here explicitly.
- **Submitted load is not capped by `N`.** Under a shock, many miners may prove winners concurrently and all but the first `N` revert as stale — each a full Chonk tx the sequencer verifies and executes. That traffic is bounded by miner rationality and fee loss (each stale claim costs its sender a fee and a wasted proof), not by the contract; stress-tested in Phase 2/3 as "winner bursts". The miner's own `claims[e] ≥ N − in_flight` stop rule cannot see the mempool and only reduces, never prevents, stale submissions.
- **A claim declares the network's per-tx gas maximum** (Phase 3 finding). The Nth claim also retargets and opens the next epoch, ≈ 25 % more public gas than a plain one, and a wallet estimates limits from a simulation that cannot see which claim will land as the closer: an under-declared closer runs out of gas, reverts, pays, and leaves the count at `N − 1` for the next victim, so the epoch never closes on count. `miner-core`'s `claimGasLimits` (the node's `txsLimits.gas`) is mandatory for every claim path; a successful tx pays for gas used, not declared.
- **No grace window.** A claim proven against epoch `e` after `e` closed reverts. With `N = 24` and 1–2 min of claim proving against a ~2.5 min claim interval, roughly 8 % of winning tickets found near an epoch's end go stale; the simulator reports the expected stale rate for the chosen `N`.
- **Withholding / time-warp is unprofitable under count-capping.** Stretching an epoch to earn a ×4 easier target lowers the withholder's ELX/hour (same `N` share at a slower cadence, then a ÷4 correction next epoch), and stalling to `T_MAX` needs > 75 % of hashrate. The only residual edge is the seed head start below. Simulated with a strategic miner.
- **Seed and last look.** `seed_{e+1}` depends on the closing digest and the close timestamp. The closing digest travels in the closing tx's public call request, so validators and mempool observers can compute `seed_{e+1}` about one slot before inclusion, and `now` is slot-derived. A miner holding a winning ticket at `claims = N − 1` can also delay submission to pre-mine `e+1` against the predicted seed, bounded by the expected inter-arrival of a competing claim (~150 s at `N = 24`/h) and by the risk of the ticket going stale. Net edge is a few percent; accepted and stated. On an **escape-hatch close** every seed input is public in advance (`seed_e`, `e+1`, `last_digest[e]`, and a slot-derived `now`), so from `opened_at + T_MAX` onward anyone can pre-mine candidate seeds for the plausible roll slots, and a sequencer-miner can choose the slot. Mixing `last_digest` adds no entropy; it only stops the digest field being a constant. **Accepted explicitly** for all escape-hatch closes: they happen only after 4× the expected epoch with fewer than `N` claims, i.e. under collapse, and the next epoch is capped at `N` claims at a ×4-eased target; the advantage is simulated (Phase 2) including a sequencer-miner choosing among roll slots.
- **Genesis premine**: constructor arguments and addresses are precomputable, so the deployer can pre-mine epoch 0 before launch. Count-capping bounds this to epoch 0's `N × REWARD` (96 ELX at defaults); `seed_1` then depends on the closing digest and timestamp. Accepted and stated (Ask 12); no fair-launch ceremony.
- **Roll griefing / sequencer ordering**: `roll()` only fires after `T_MAX`; idempotent. A sequencer that is also a miner can order competitors' claims after a close so they revert and pay; one tx of cost per victim, only reachable at boundaries; documented, not preventable at the app layer.

### 2.5 What this buys and what it costs

- Buys: work = proving; difficulty range 2^128; issuance and *accepted* claims capped per epoch; recipient privacy; no randomness beacon; Sybil-neutral; no standing admin surface (one setup authority that expires at token binding, §3.4).
- Costs: a recursive UltraHonk verifier inside an Aztec private function. Measured (`recon.md`): 681,980 gates as a plain Ultra circuit but **19,923 gates as an Aztec private function under Chonk** (ECC work Goblin-offloaded into the tx's ECCVM tail). Unmeasured: the claim transaction's end-to-end proving (does a real claim-shaped Chonk tx prove, verify and get accepted by a node), the ECCVM/translator headroom, wall-clock and memory in-browser. **Phase 1 measures this and returns a hard go/no-go to the user.**

---

## 3. Architecture & Implementation

### 3.1 Repository shape (Bun workspace, my-stack)

```
packages/
  contracts/        Noir · Nargo workspace: elixir_miner (ours) + aztec-standards token as a git dep (AztecProtocol/aztec-standards v5.2.0)
  work-circuit/     Noir program `elixir_work` (W) · VK + VK-hash + proof-layout manifest export · fixture proofs
  miner-core/       TS · platform-agnostic: witness → proof → digest, retarget mirror, epoch reader, claim builder
  web-miner/        React + Vite + Tailwind v4 + shadcn · Worker-hosted bb.js backend · embedded wallet (@aztec/wallets/embedded)
  deploy/           TS · sandbox/testnet deploy (salt-precomputed addresses), calibration, spike and epoch-stats scripts
scripts/run/        run-isolation (registry, resolve-ports, agent.sh)
implementations-plan/elixir-core/   plan, recon, audits, lessons, spike-results
```

Toolchain: **`aztec-nargo` 5.2.0 (Noir 1.0.0-beta.25) and `bb` 5.2.0 only**; bare `nargo` is not used. Commits of aztec-packages, bb.js, noir_js and the `poseidon` crate are pinned; the build reproduces ACIR, VK, VK hash and the proof-layout manifest byte-for-byte in CI.

Reuse per `recon.md`: aztec-standards token as-is (`AztecProtocol/aztec-standards` tag `v5.2.0`, Nargo deps pinned to aztec `v5.2.0`, npm `@aztec-foundation/aztec-standards@5.2.0` for TS artifacts — verified 2026-09-03), aztec-nr state vars, TXE, bb.js backends; nothing from the prototype as code.

### 3.2 Work circuit `elixir_work` (standalone Noir program)

```rust
global CHAIN_LEN: u32 = L;             // calibrated in Phase 1; ≈74 gates/step measured; 2048 → 151,726 gates
fn main(domain: pub Field, seed: pub Field, epoch: pub Field, miner_commit: pub Field, nonce: pub Field) -> pub Field {
    let mut h = Poseidon2::hash([DOM_WORK, domain, seed, epoch, miner_commit, nonce], 6);
    for i in 0..CHAIN_LEN { h = Poseidon2::hash([h, i as Field], 2); }
    h
}
```

- Public inputs, fixed order: `[domain, seed, epoch, miner_commit, nonce, out]`. `domain` binds the proof to chain id, miner-contract address and puzzle `VERSION` (no cross-deployment replay).
- Nonce is absorbed first so every wire depends on it: an *honest* prover cannot reuse wire polynomials across nonces. A modified prover can reuse them within one nonce via the disabled sumcheck rows (§2.1, §3.3); that is the accepted amortisation.
- Proven with `UltraHonkBackend.generateProof(witness, { verifierTarget: 'noir-recursive-no-zk' })`: Poseidon2 transcript, non-ZK. Non-ZK Ultra has zero masking entities; Phase 1 verifies **byte-identical proofs for repeated same-witness runs** (determinism is asserted by test, not assumed).
- Proof: 410 fields (32-byte big-endian each, 13,120 bytes); VK: 115 fields. bb.js's `generateRecursiveProofArtifacts` is a stub (`backend.ts:236`, TODO) — miner-core does the byte→field conversion itself and pins it with a fixture.
- `W_VK`, `W_VK_HASH` are embedded as globals in the contract; changing W = new deployment (the VK is the puzzle).

### 3.3 Ticket definition (security-critical, shared by Noir and TS)

`digest = Poseidon2(DOM_TICKET ∥ proof[0..410])`, 254-bit. Nullifier uses the full digest; the difficulty check uses `low128(digest)`.

Why the whole proof: measured (Fact 14) that flipping any single field of a real proof fails native verification, and the Sumcheck design doc confirms the recursive verifier processes all virtual rounds uniformly (`barretenberg/cpp/src/barretenberg/sumcheck/Sumcheck.md`, "Virtual Rounds and Padding"). Hashing through the final KZG opening `W` means the digest is unavailable until the last prover step, which closes the "compute commitments, check ticket, finish only winners" shortcut.

What is known and accepted: the 4 disabled sumcheck rows give a same-witness re-proof that skips the size-`n` witness MSMs (§2.1). The cheapest known ticket is therefore a fresh sumcheck + Gemini/Shplonk + one KZG opening MSM; Phase 1 item 4 measures that attack's cost (an upper bound on security) and §4 carries the number. What is still assumed (stated in §4): no *cheaper* transformation than that maps one accepting transcript to another for the same VK and public inputs. Phase 1 does not prove this; it tests determinism, single- and multi-field mutation, native-vs-recursive differential behaviour, and the early-abort cost, and publishes a **proof-layout manifest** (every one of the 410 slots labelled by transcript phase, generated from bb's serialisation for the pinned commit, checksummed in CI) so the ticket is defined against a specification rather than experimental indices.

### 3.4 Contract `elixir_miner` (aztec-nr 5.2.0)

Storage
```
deployer:     PublicImmutable<AztecAddress>        // setup authority; useless once token is bound
token:        PublicImmutable<AztecAddress>        // initialized once by bind_token; init nullifier = one-shot + private-readable
epochs:       Map<u64, PublicImmutable<EpochParams { target: u128, seed: Field, opened_at: u64 }>>
claims:       Map<u64, PublicMutable<u32>>
last_digest:  Map<u64, PublicMutable<Field>>
open_epoch:   PublicMutable<u64>
```
Compile-time globals: `N` (claims per epoch), `EXPECTED_EPOCH_SECONDS`, `T_MAX` (= 4 × `EXPECTED`, asserted), `REWARD` (u128, decimals applied), `VERSION`, `W_VK`, `W_VK_HASH`, domain separators.

**Bootstrap (the only admin action, and it expires).** Aztec addresses commit to the initialization hash, i.e. to constructor arguments (`stdlib/src/contract/contract_address.ts:14`), so a miner whose constructor takes the token address and a token whose constructor takes the miner address cannot both be precomputed — no salt solves that fixed point. Sequence: (1) the miner's constructor takes no token, so its address is computable from its class, salt, deployer and the genesis parameters alone; (2) deploy the token with `minter = <that miner address>`; (3) deploy the miner; (4) the deployer calls `bind_token(token)` exactly once (`assert msg_sender == deployer`, then `token.initialize(addr)`; `PublicImmutable`'s initialization nullifier makes any second call revert), after which no function checks `deployer` again. `claim` reads `token` with `PublicImmutable::read`, which asserts the initialization nullifier exists at the claim's anchor block, so a claim anchored before the binding block fails at simulation. `PublicMutable` was rejected here because it cannot be read from a private function in 5.2.0 (`state_vars/public_mutable.nr:10`). Front-running is impossible (the binder must be `deployer`); a wrong binding is unrecoverable and means redeploying. Tests: address derivation matches the precomputed address; non-deployer `bind_token` reverts; second `bind_token` reverts; a claim anchored before the binding block fails and one anchored at or after it succeeds; nothing else reads `deployer`.

| fn | kind | notes |
|---|---|---|
| `constructor(initial_target, genesis_seed)` | public initializer | writes `epochs[0]` with `opened_at = now`, `deployer = msg_sender`; `token` left uninitialized |
| `bind_token(token)` | public, deployer-only, once | see Bootstrap; the setup authority expires here |
| `record_claim(e, digest)` | public, `#[only_self]` | §2.4; closes the epoch on the `N`th claim |
| `roll()` | public, permissionless | escape hatch after `T_MAX` |
| `epoch_params(e)`, `open_epoch()`, `claims_in(e)` | public views | miner reads |
| `claim(e, nonce, out, secret, proof, recipient)` | private | §2.3, **verifier inline**. `out` is W's public output, supplied by the miner (proof fields exclude public inputs); an inconsistent `out` fails verification. Expected ≈ 50–60k gates: verifier ≈ 20k + two Poseidon2 passes over 410 fields (args hash, ticket) ≈ 22k + two historical reads ≈ 8k + nullifier/mint/enqueue. A separate `#[internal("private")]` verifier circuit was the v3 default and is now the *alternative*: an internal self-call is an extra Chonk folding step and kernel iteration (seconds of WASM proving plus its own merge/ECCVM ops) to save ~30k gates in a circuit already far below kernel size. Phase 1 measures both; inline stays unless the split proves faster. |

No standing admin functions, no upgrade hooks, no pause: the only privileged call is `bind_token`, usable once. The deployment is immutable after binding; a parameter mistake means a new deployment and a documented migration (Ask 6). `W_VK`/`W_VK_HASH` are produced by `bun run contracts:codegen-vk` from the compiled work circuit; CI rebuilds and diffs the committed `.nr` against it.

Private reads use `PublicImmutable::read` (≈4k gates, requires the epoch's initialisation nullifier at the claim's anchor block). `DelayedPublicMutable` was rejected: its expiration horizon fails claims proven near boundaries. The private function also asserts `e == open_epoch` at its anchor block via a historical read of `open_epoch` so a doomed claim fails at simulation rather than after proving.

### 3.5 miner-core (TS, `bun:test`)

- `proof.ts`: `proofToFields(bytes) → Field[410]` (pinned by fixture); `computeDigest(fields) → bigint`; `isWinner(digest, target)`.
- `retarget.ts`: TS mirror of `close()` (u128 BigInt, saturating), used by tests, the simulator and the UI's "next target" preview.
- `work.ts`: `WorkProver` interface `{ prove(inputs): Promise<{ proof: Uint8Array; publicInputs: Field[6] }> }`; `BbJsWorkProver` now; a native prover later for aztec-accelerator.
- `epoch.ts`: reads `epoch_params` / `open_epoch` / `claims_in` via aztec.js.
- `claim.ts`: builds the `claim(...)` interaction for a wallet to prove and send.
- `secret.ts`: per-epoch random miner secret (Ask 5): generated with `crypto.getRandomValues` when an epoch starts, held in the Worker and IndexedDB, discarded when the epoch closes. Tickets die with their epoch, so nothing long-lived needs protecting and no wallet signature is involved.
- Constants generated from the compiled work circuit (VK, VK hash, layout manifest) at build time — no hand-copied literals.

### 3.6 web-miner (React + Vite)

- One bb.js `UltraHonkBackend` instance in a dedicated Worker, multithreaded via `threads = hardwareConcurrency − 1` (bb.js multithreads internally; a pool of multithreaded backends oversubscribes — Phase 4 benchmarks one-multithreaded vs a small pool of single-threaded, with peak RSS). The app asserts `crossOriginIsolated` at boot.
- State: Jotai atoms for miner status; TanStack Query for chain reads.
- Flow: the page owns an **embedded wallet** (`@aztec/wallets/embedded`, account created on first visit, keys in IndexedDB) and pays fees through the **sponsored FPC** → read open epoch → generate the epoch secret → mine → on win, the embedded wallet proves `claim` (Chonk, bb.js WASM in-page) → balance refresh; epoch switch mid-proof discards the in-flight nonce and rotates the secret. External wallet connection (`@aztec/wallet-sdk`) is deferred; the UX is the easy part, the mechanism is the hard part (user, 2026-09-03).
- Dashboard: proofs/s, tickets tried, target and difficulty, expected time to win, claims this epoch of `N`, private ELX balance. Copy is design surface (Frontend addendum).
- Chain reads: a lying RPC (well-formed but false epoch parameters) cannot be detected by schema validation; it can only waste mining work, never steal (claims are verified on-chain). The app defaults to the user's own or a trusted node URL, cross-checks `epoch_params` against a second configurable endpoint when one is set, and states this limit in the UI.
- Hosting: Cloudflare Pages, `wrangler.jsonc`, `_headers` with COOP/COEP and a strict CSP. Deploy is a user action, never AFK. A compromised frontend can read the secret, proof and recipient choice — inherent to hosted dApps; documented on the page.

### 3.7 Data & control flow, critical path

1. Miner reads `epoch_params(open_epoch)`; if `now − opened_at ≥ T_MAX`, it sends `roll()`.
2. Worker proves W repeatedly; miner-core hashes each proof; first `low128(digest) < target` wins.
3. Wallet proves the Aztec tx: `claim` (verifier inline) + token `mint_to_private` + kernels, folded by Chonk.
4. Sequencer executes `record_claim(e, digest)` (maybe closing the epoch) and the token's public mint finalisation; the nullifier prevents replay. Either public part reverting reverts the whole tx (Aztec atomicity), tested.
5. Next epoch's params are readable one block after the close.

### 3.8 Alternatives not taken (see Decision ledger §8)

L1-portal verification (first fallback, Appendix B); pay-per-proof with reward auto-adjust (second fallback, Appendix A); fixed slots first-come; time-based epochs with a grace window (v1, rejected after audit); `DelayedPublicMutable`.

---

## 4. Security & Adversarial Considerations

**Threat model**: rational miners with modified clients; other miners (griefing, withholding); the sequencer (delay, censor, order — cannot forge); web users (phishing, XSS, malicious RPC); supply chain and toolchain.

- **Ticket grinding without proving** — the central threat. Defended by: digest over the whole proof through the final opening; exact-`W_VK` recursive verification; deployment-bound public inputs; determinism and mutation tests; proof-layout manifest. **Known shortcut, measured**: same-witness re-proof through the 4 disabled sumcheck rows (§2.1). Phase 1 implements that one attack and reports its cost relative to an honest prove — a measured attack cost, i.e. an *upper bound on security*, not a proven lower bound on ticket cost. **Accepted assumption** (for the external audit, Ask 8, which owns evaluating it): no cheaper malleation than the measured one exists.
- **Amortisation**: specialised miners amortise setup, fixed-base tables and, via the shortcut above, the witness MSMs. Accepted: bounded *transcript* cost per ticket, not equal *hardware* cost.
- **Fee economics**: a claim is a Chonk tx with a ~50–60k-gate app circuit. In this plan fees are sponsored (testnet FPC). Phase 1 still reports gas/resource usage so the later mainnet plan starts from numbers; the mainnet fee path is out of scope (Ask 10).
- **Cross-deployment replay / bearer secret**: `domain` in the inner public inputs; nullifier over the full digest. The secret is a bearer credential for tickets already found — equivalent to a private key; whoever holds it picks the recipient. Recipient binding inside W was considered and rejected (adds nothing while the secret holder chooses the recipient anyway).
- **Issuance / load shocks**: capped per epoch by construction (§2.4); simulated at 10×/100×/1000× and for collapse.
- **Withholding / time-warp**: bounded by clamp; simulated with a strategic miner; documented.
- **Sequencer**: can delay a claim past its epoch close (miner loses the fee; the proof is stale) and can order `roll()` relative to claims only after `T_MAX`. Cannot forge or steal.
- **Timestamps**: `opened_at`/`now` come from the sequencer within protocol bounds; the retarget uses durations of ≥ minutes, so second-level skew is noise; the private-anchor vs public-execution skew is handled by asserting `open_epoch` in both contexts.
- **Replay / double claim**: full-width nullifier on the digest; protocol rejects duplicates.
- **Privacy**: as stated in §1. A public-effects inspection test lists exactly what a claim tx reveals.
- **Miner secret**: per-epoch random value (Ask 5); `@aztec/wallet-sdk`'s `BaseWallet` exposes no message-signing method, and misusing `createAuthWit` as a signer is the pattern wallets warn users about. Losing the secret loses only the current epoch's unclaimed tickets.
- **Web**: strict CSP, no HTML injection, COOP/COEP, wallet-sdk verification, worker crash recovery. A malicious RPC can waste mining work but cannot steal (§3.6); documented in the UI.
- **Supply chain and toolchain**: pinned commits for aztec-packages, bb.js, noir_js, `poseidon`; **content hashes pinned for every shipped binary and WASM** (`aztec-nargo`, `bb`, bb.js WASM blobs) and **GitHub Actions pinned by commit SHA**; `bunfig.toml` `minimumReleaseAge = 604800`; frozen lockfile; `bun audit`; reproducible build check of ACIR/VK/manifest in CI. Two distinct CRS concerns: *transport integrity* (bb's download checksum, verified in Phase 1 or the CRS is pinned locally) and *ceremony trust* (the BN254 KZG setup itself — an accepted assumption shared with every Aztec user). Barretenberg's proof-layout code is marked as not externally audited; an **independent audit of the deployed circuit, VK and recursion path is required before mainnet** (Ask 8).
- **CI least privilege**: `permissions: contents: read`; scoped Cloudflare token on the deploy job only; no publish workflows.
- **Contracts (Aztec-specific)**: public functions are counters and a close routine; the only external call is the token mint from the token's single minter; u128 saturating arithmetic; claim counter bounded by `N`; reorg semantics as for any Aztec tx.
- **Cryptography**: Poseidon2 (bb / `poseidon` v0.3.0), UltraHonk (bb 5.2.0), Chonk. No custom primitives. Distinct domain separators for deploy, work, ticket, nullifier, seed, secret.
- **Mainnet**: out of scope for this plan. When it comes: `/harden security` before mainnet; **no independent external audit** (user's decision, Ask 8), so the accepted cryptographic assumptions in this section rest on our own review and on Phase 1's measurements. No pause: parameter mistakes are fixed by redeploying (Ask 6).

---

## 5. Assumptions

### Facts (verified; citations in `recon.md`)
1. `verify_proof_with_type` exists in the Noir stdlib; `bb_proof_verification` wraps it as `verify_honk_proof_non_zk` (410-field proof, 115-field VK, `PROOF_TYPE_HONK = 0`).
2. Plain UltraHonk proof = 410 fields excluding the separately supplied public inputs (`constants.nr:650-674`); padded to `CONST_PROOF_SIZE_LOG_N = 25` (`barretenberg/cpp/src/barretenberg/constants.hpp:21`, `ultra_flavor.hpp:42-49`).
3. Non-ZK Ultra flavour has `NUM_MASKING_ENTITIES == 0` (`ultra_flavor.hpp:86-87`).
4. bb.js `UltraHonkBackend` supports `verifierTarget: 'noir-recursive-no-zk'`; its `generateRecursiveProofArtifacts` is a stub with an open TODO (`backend.ts:236`).
5. Private functions read public state via `PublicImmutable::read` (~4k gates) and time via `get_anchor_block_header().timestamp()`; public via `context.timestamp()`.
6. Private→private calls: 8 per call, 16 per tx; nullifiers 16 per call.
7. aztec-standards token (`dev`): single `minter: PublicImmutable<AztecAddress>` checked by equality; `mint_to_private(to, amount)`; `auth_contract` is an ARC-403 authorization hook (zero = disabled), **not** an upgrade authority; no admin/upgrade/pause functions; pins aztec `v5.0.0-rc.2`.
8. TXE: `mine_block_at(ts)`, `set_next_block_timestamp`, `advance_next_block_timestamp_by`, `call_private/public`.
9. Toolchain: `aztec-nargo` 5.2.0 = Noir 1.0.0-beta.25; `bb` 5.2.0; bun 1.4.0. (Bare `nargo` on this machine is beta.16 and is not used.)
10. Chonk README: naive recursive verifier > 512K gates; bb.js default WASM CRS 2^19 (overridable).
11. **Measured**: `verify_honk_proof_non_zk` = 681,980 gates as a plain program (`ultra_honk`), **19,923 gates** inside an Aztec private function (`chonk`; baseline fn 5,469). Compiles under `aztec-nargo` 5.2.0. This is the verifier alone; the full `claim` circuit is estimated at 50–60k (§3.4).
12. **Measured** for ACVM execution: `aztec-nargo execute` solves the recursion circuit with an all-zero proof and VK. For TXE: by source inspection only — no `RecursiveAggregation` handling exists in `yarn-project/simulator` or `yarn-project/txe` (codex, fable) — executed as Phase 2's first test.
13. **Measured**: W ≈ 74 gates/step (1024 → 75,950; 2048 → 151,726; 4096 → 303,278); native `bb prove` 0.34 / 0.63 / 1.0 s wall on M4 Pro (14 threads).
14. **Measured**: flipping the lowest bit of any of the 410 proof fields fails native `bb verify` (1024-step proof); zero unconstrained fields.
15. Sumcheck.md documents that the recursive verifier processes all `virtual_log_n` rounds uniformly (constant verifier circuit).
16. ECCVM is a fixed 2^15-row circuit (`constants.hpp:32`; `eccvm/eccvm_flavor.hpp:651` asserts on overflow). The prover network pays nothing extra per claim: ECCVM/translator live inside the client proof. (The per-verification row cost, ~100 short-scalar ops ≈ 800–900 rows per `chonk/README.md:157-163` and `eccvm_builder_types.hpp:13-20`, is an estimate → I11.)
17. Non-ZK UltraHonk disables the first `TRACE_OFFSET = NUM_DISABLED_ROWS_IN_SUMCHECK = 4` rows in sumcheck (`constants.hpp:43-48`, `ultra_flavor.hpp:96`, `sumcheck/sumcheck_round.hpp:63`) and those rows have `sigma = id` (`honk/composer/permutation_lib.hpp:51-52`): their wire values are unconstrained (§2.1).
18. `@aztec/wallet-sdk` `BaseWallet` (`wallet-sdk/dest/base-wallet/base_wallet.d.ts`) exposes `createAuthWit`, `simulateTx`, `sendTx`, … and no message-signing method.
19. The in-circuit verifier defers the final pairing check into `AppIO.pairing_inputs` (`chonk/chonk.cpp:285-291`), aggregated and checked at the decider/tube — an app's pairing points are enforced downstream, not in the app circuit.
20. The 5.2.0 reference token has an admin-settable `minters` map (`noir-contracts/contracts/app/token_contract/src/main.nr:53,141`); aztec-standards' single immutable minter is the reason to use it.
21. `AztecProtocol/aztec-standards` (default branch `main`, pushed 2026-08-26) has tags `v5.2.0`, `v5.2.0-rc.2`, …; `src/token_contract/Nargo.toml` pins `aztec`, `uint_note`, `balance_set`, `compressed_string` to aztec-packages `v5.2.0`; `package.json` is `@aztec-foundation/aztec-standards@5.2.0` with `aztecVersion: 5.2.0`.

### Inferences (unverified — audits, attack these)
- I1. A full claim tx (heaviest supported account and fee path) uses ≤ 2^14 ECCVM rows (bb prints `Num rows in the ECCVM` under verbose); it proves, verifies and is accepted by a 5.2.0 node; in-browser p95 ≤ 2 min and peak memory ≤ 3 GB (the wasm32 ceiling is 4 GB, so 4 would be tautological) on the reference laptop.
- I3. The recursive verifier constrains the same 410 fields the native verifier does (Fact 14 covers native only), with the pairing enforced downstream (Fact 19).
- I5. Retired: `AztecProtocol/aztec-standards` tag `v5.2.0` targets aztec 5.2.0 directly (Fact 21); no port. Residual: its token keeps the single-`minter` model of the defi-wonderland lineage (checked in Phase 2's first compile; if it moved to a `minters` map, fork and pin a `PublicImmutable` minter, ~20 lines).
- I11. One recursive verification costs ≈ 800–900 ECCVM rows; the full claim tx stays ≤ 2^14 rows. Measured in Phase 1.
- I12. Address precomputation: the miner's address depends only on class id, salt, deployer and constructor args that exclude the token (`contract_address.ts:14`), so step (2) of the bootstrap can name it before step (3) deploys it. Tested before Phase 2.
- I10. `W_VK`/`W_VK_HASH` pinning holds because Noir emits constant-equality constraints for the globals; bb takes recursion inputs and the VK from witnesses (`dsl/acir_format/acir_to_constraint_buf.cpp:62-69`, `honk_recursion_constraint.cpp:57-59`). Verified by ACIR inspection in Phase 1.
- I6. A 2^17–2^18-gate W proof takes 2–10 s in bb.js WASM with one multithreaded backend; a page can sustain it without OOM.
- I7. `@aztec/foundation` Poseidon2 equals the Noir `poseidon` crate for every domain-separated invocation the system uses — deploy domain (4 fields), secret commitment (2), work seed (6), chain step (2), ticket digest (411), nullifier (2), epoch seed (5) — each pinned by a Noir↔TS fixture.
- I8. Non-ZK UltraHonk proving is deterministic for a fixed witness (byte-identical repeated proofs).
- I9. bb.js verifies its downloaded CRS against a checksum.

### Asks (resolved at the approval gate — proposed defaults in bold)
1. **Parameters** — *decided: defaults*. `N` = **24** claims per epoch; `EXPECTED_EPOCH_SECONDS` = **3600**; `T_MAX` = **4 × 3600**; `REWARD` = **4 ELX** → ≈96 ELX/hour at steady state, perpetual; decimals **18**. Initial target calibrated so one M-series laptop closes epoch 0 in about an hour (≈ 2^122 for ~1000 proofs/hour). The simulator reports the expected stale-ticket rate for the chosen `N` (~8 % at 24).
2. **Work size** — *decided: default*. `CHAIN_LEN` calibrated for **≈3 s per proof in WASM on M-series** (Phase 1 output; native is ~10× faster). Clarification recorded: this knob sets the fixed cost of one lottery ticket per deployment, like SHA256's cost per hash in Bitcoin; it does not scale. Difficulty scales through the *target* (§2.4), unboundedly, ×/÷4 per epoch.
3. **Aztec version** — *decided*. **5.2.0** everywhere; token = `AztecProtocol/aztec-standards` git dep at tag **`v5.2.0`** (`directory = "src/token_contract"`) and `@aztec-foundation/aztec-standards@5.2.0` for artifacts. No port.
4. **Go/no-go for Phase 1** — *decided with one change (browser time/memory reported, not gated)*. GO requires all of: a valid claim, sent through the embedded wallet running the real prover in a browser page, is accepted by a sandbox node; tampered proofs fail to prove through the recursive path for **every transcript phase** of the layout manifest (native: all 410 fields); **ECCVM rows for the full claim tx ≤ 2^14** (Fact 16); repeated W proofs byte-identical; **early-abort cost ≥ 90 %** of full `generateProof` cost at the point the digest becomes computable; **the known disabled-row attack implemented and measured** (Fact 17), costing ≥ **50 %** of an honest prove — a measured attack cost, without implying cheaper attacks are excluded; **claim gas/resource usage reported** (fees are sponsored in this plan); VK pinning confirmed in ACIR (I10); bootstrap dry run passes (I12). **In-browser claim time and peak memory are reported, not gated** (user, 2026-09-03: "let's be careful with RAM" — a worker OOM on the reference laptop is reported as a finding for the user, not an automatic NO-GO). Anything else is **NO-GO → return to the user** with Appendices B then A.
5. **Miner secret** — *decided*. **Per-epoch random secret** generated locally, kept for the epoch, discarded at close (Fact 18 rules out a wallet-signature KDF; tickets die with their epoch so nothing long-lived needs protecting).
6. **Immutability** — *decided (for now)*. Miner and token immutable, `auth_contract = 0`; parameter mistakes → redeploy + documented migration (new token, no automatic conversion).
7. **Testnet** — *decided*. Current public Aztec testnet at Phase 5; sponsored FPC for all fees in this plan.
8. **Mainnet gate** — *decided*. **No independent external audit.** `/harden security` before any mainnet deployment (later plan). Consequence, stated: the accepted cryptographic assumptions in §4 (no cheaper malleation than the measured disabled-row attack; UltraHonk soundness) are not independently reviewed; Phase 1's measurements and our own review are the evidence.
9. **Tier** — *decided*. `mid` against a `deep` recommendation — acknowledged.
10. **Fee path / wallet** — *decided*. Embedded wallet in the miner page + sponsored FPC; mainnet fee path deferred to a later plan ("don't worry about mainnet yet"). Phase 1 reports gas/resource usage only.
11. **Bootstrap authority** — *decided*. The deploying key calls `bind_token` once, then is irrelevant. (Addresses *are* derivable in advance — the bootstrap relies on that for the miner — but a derivation includes the constructor arguments, so two contracts that each take the other's address have no solution; the bind step only breaks that loop.)
12. **Genesis premine** — *decided*. Accepted and disclosed; bounded to `N × REWARD` = 96 ELX at defaults by count-capping.

---

## 6. Phases with validation gates

Commands are created in Phase 0 and are the project's real tooling from then on. Fast layers (`bun run lint`, `bun test` for touched packages) run after every meaningful step, not only at the gate.

### Phase 0 — Scaffold + CI (my-stack) ✓
Workspace, `bunfig.toml` (min-age, isolated linker), biome with complexity budgets, husky + commitlint + lint-staged, `sort-package-json`, `scripts/run/*`, per-package PR-gate workflows with `changes` jobs, `actionlint.yml`, `CLAUDE.md`, `docs/roadmap.md`, `implementations-plan/index.md`. Root scripts: `lint`, `lint:fix`, `lint:shell`, `lint:actions`, `test`, `test:components`, `test:e2e`, `e2e:agent`, `contracts:compile`, `contracts:test`, `spike:*`.
**Gate**: `bun run lint && bun run lint:actions && bun run lint:shell && bun test` exit 0 on a placeholder test; conventional commits; workflows pass actionlint. Layers: lint/typecheck, unit.

### Phase 1 — Feasibility spike (hard stop, returns to user) ✓
1. `packages/work-circuit`: W with `CHAIN_LEN` sweep {1024, 2048, 4096}; gates; native and bb.js WASM prove times (Node, then browser); **determinism**: 10 repeated proofs per witness byte-identical (I8); ACIR inspection confirming constant-equality constraints pin `W_VK`/`W_VK_HASH` (I10).
2. **Proof-layout manifest** generated from bb's serialisation for the pinned commit (410 slots labelled by phase); mutation tests: every single field, 50 random multi-field combinations, wrong public inputs, wrong VK, ZK-flavour proof against non-ZK verifier — all must fail natively.
3. Spike contract whose claim-shaped private fn is the **full claim shape**: `(e, nonce, out, secret, proof, recipient)`, verifier **inline** (and the `#[internal("private")]` split variant for comparison), both historical reads, the nullifier, the real token `mint_to_private` private call with its public finalizer, the `record_claim` enqueue, and the selected fee path; **real claim tx** on an isolated sandbox with `PXE_PROVER_ENABLED=true`, sent through an embedded wallet (`@aztec/wallets/embedded`) with the sponsored FPC: valid proof accepted by the node; tampered proofs (one per transcript phase of the manifest, plus wrong `out`) fail to prove (differential vs native, I3); ECCVM rows for the full tx from bb verbose output vs the 2^15 cap (I1, I11); claim gas/resource usage (fees sponsored; numbers kept for the later mainnet plan); time and peak memory natively and in a minimal browser page (Playwright, headless Chromium, `crossOriginIsolated` asserted, 1 backend × `n−1` threads vs pool); inline vs split proving time. Also: bootstrap dry run — precomputed miner address equals the deployed one (I12), `bind_token` front-run by a non-deployer reverts.
4. Ticket-cost measurements: (a) early-abort — prover instrumented to stop at each transcript phase → cost to the point the digest becomes computable vs full `generateProof`, **GO ≥ 90 %**; (b) the known disabled-row attack (Fact 17) — implement it and measure its cost with bb's phase timers, **GO if ≥ 50 %** of an honest prove; recorded in §4 as a measured attack cost (upper bound on security), not a lower bound.
5. CRS checksum behaviour (I9); TXE behaviour with an invalid proof (Fact 12 → TXE).
6. `spike-results.md`: measured table + verdict against Ask 4, then **stop and report to the user**.
**Gate**: `spike-results.md` committed with all six sections (items 1–6, including both ticket-cost measurements, fee, ECCVM rows, inline-vs-split, bootstrap dry run) filled from real runs; `bun run spike:*` scripts exit 0; lint green. Layers: unit, integration-live (sandbox), browser.

### Phase 2 — Contracts (after GO) ✓
`elixir_miner` per §3.4 with every deployment parameter (`N`, `EXPECTED_EPOCH_SECONDS`, `T_MAX`, `REWARD`, decimals, initial target, genesis seed, `CHAIN_LEN`, `VERSION`, token name/symbol) coming from one committed config with named profiles (`testnet`, `mainnet`) that generates the Noir globals and drives the deploy script and the miner — a parameter change is a config edit plus a redeploy; aztec-standards token as a git dep at `v5.2.0` (first compile confirms the single-`minter` model); deploy script per the §3.4 bootstrap (precompute the token-less miner address → token with `minter = miner` → miner → `bind_token`). TXE tests (labelled **plumbing-only**, since TXE cannot check proof validity — confirmed with an invalid fixture proof as the first test): bootstrap (address derivation, `bind_token` once/deployer-only, claim before binding reverts, no other read of `deployer`), close on `N`th claim, **count close long after `T_MAX` uses the capped elapsed** (exactly ×4), retarget clamp both ways, **retarget mulDiv at launch-realistic targets 2^118–2^126 with `actual` up to `T_MAX`** (exact quotient; malicious `(q, r)` witnesses rejected by the range checks), escape-hatch `roll()` before/after `T_MAX` applying exactly ×4 and mixing `last_digest`, **clamp helpers at extrema**: `ceil(t/4)` at t ∈ {1, 2, 3, 4, 5, 2^128 − 1} and saturating ×4 at t ≥ 2^126, `claims` never exceeds `N`, stale-epoch claim reverts before any mint work (enqueue order), same-block roll/claim ordering, seed chaining incl. the roll path, nullifier replay rejected, mint amount, unauthorised `record_claim` rejected, either public finalizer failing reverts the whole tx, `contracts:codegen-vk` output matches the committed globals. Retarget simulator (TS mirror) tests: 10× / 100× / 1000× shocks converge within ⌈log₄ k⌉ epochs (2 / 4 / 5), where "converged" means the epoch duration is within ±25 % of `EXPECTED_EPOCH_SECONDS`; collapse (÷100) recovers via escape-hatch closes within 5 epochs where the target has headroom (from 2^118), while from the configured 2^122 three ×4 rolls saturate the target at 2^128 − 1 and the epoch cadence floors at `N / H` (≈ 5 625 s for `N = 24` at H₀/100) — liveness is kept, the cadence is not, both asserted; strategic withholding gain bounded by the clamp; genesis-premine yield ≤ `N × REWARD`; escape-hatch candidate-seed pre-mining incl. a sequencer-miner choosing among roll slots (advantage reported); **winner bursts**: 200 concurrent winners against `N = 24` → exactly 24 accepted, the rest revert as stale, no state corruption (state integrity only — submitted-load behaviour is measured in Phase 3).
**Gate**: `bun run contracts:compile && bun run contracts:test && bun test packages/miner-core/src/retarget*` exit 0; lint. Layers: lint, unit (TXE + bun).

### Phase 3 — miner-core ✓
Package per §3.5 with generated constants and manifest; parity fixtures (digest, retarget, proof bytes→fields); `describe.skipIf(!AZTEC_NODE_URL)` integration on an isolated sandbox: deploy, mine at an easy target, real-proving `claim` → private balance = `REWARD`; tampered field → proving fails; cross-deployment replay (second deployment, same proof) rejected; **public-effects inspection**: list the tx's public effects and assert only `record_claim(e, digest)`, mint finalisation with the constant amount, and nullifiers are visible; **real-prover burst**: 8 concurrent winners against `N = 4` on the sandbox — accepted/rejected counts, fees paid by rejected claims, and sequencer latency recorded.
**Gate**: `bun test packages/miner-core` exit 0; `bun run e2e:agent -- miner-core` exit 0 locally; lint. Layers: unit, integration-live.

### Phase 4 — Web miner ✓
App per §3.6; Vitest (status panel, difficulty formatting, worker reducer, epoch-switch mid-proof and secret rotation); Playwright E2E on the isolated sandbox with the **embedded wallet running the real prover in-page** (not a PXE shortcut) and the sponsored FPC: first visit creates the account, mine at easy target, claim, balance shown; `crossOriginIsolated` asserted; worker crash → recovery; peak memory recorded; malformed **and lying** RPC payloads (wrong epoch params) rejected by schema and cross-check. `wrangler.jsonc` + `_headers` (COOP/COEP/CSP); deploy manual.
**Gate**: `bun run test:components && bun run --cwd packages/web-miner build && bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` exit 0; lint. Layers: unit, e2e-live.

### Phase 5 — Testnet soak + docs + mainnet readiness ✓
Testnet deploy via `packages/deploy` (sponsored FPC); addresses and parameters in `docs/deployments.md`; epoch-stats script; **soak: ≥ 24 closed epochs on the `testnet` parameter profile (N = 4, EXPECTED_EPOCH_SECONDS = 300, T_MAX = 1200, target calibrated so one homelab miner closes an epoch in ≈ 5 min), i.e. ≈ 2 h wall-clock and never more than 2 h — the run stops at 2 h and reports what closed — with hashrate deliberately varied (stop/start the miner, add a second one) so the retarget data is non-trivial**; miner README; threat-model doc from §4 with the measured ticket-cost figures (attack costs, not lower bounds); `docs/roadmap.md` with the deferred items: aztec-accelerator native mining, external-wallet connection, mainnet fee path, `/harden security` before mainnet (no external audit, Ask 8).
**Gate**: deploy script exit 0 with receipts (testnet profile); soak report committed (≥ 24 closed epochs or the 2 h cap, whichever first, with the epoch table); `bun run lint && bun test` green; docs updated in the same PR. Layers: lint, unit, live (testnet).

Failure-retry policy: 3 failures on one step → stop and reassess (human-driven); 5 in `/loop` mode.

---

## 7. Delivery — arcs → stacked PRs

| Arc | Phases | Stacks on | `/code-review` |
|---|---|---|---|
| A1 `elixir-core/scaffold-spike` | 0, 1 | `main` | low |
| A2 `elixir-core/protocol` | 2, 3 | A1 | medium |
| A3 `elixir-core/web-testnet` | 4, 5 | A2 | medium |

`gh stack init --adopt <branch>` at A1; `gh stack add` at each boundary only after that arc's quality loop converged; PRs opened only in the Delivery step (`gh stack submit --auto`, then `gh pr edit` bodies). A1 ends with a user decision (Ask 4) before A2 begins. Merging is the user's call.

---

## 8. Decision ledger

### Design decisions
| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Reward model | Proof-hash lottery | Pay-per-proof (App. A); fixed slots | Only the lottery caps *accepted* claims per epoch (stale submissions are fee-bounded) and keeps difficulty unbounded while making proving the work. User confirmed. |
| Epoch definition | **Count-capped** (`N` claims) with `T_MAX` escape hatch (v2) | Time-based with ×4 clamp and 1-epoch grace (v1) | v1 over-issued ~3,000 claims under a 100× shock and the grace window rewarded withholding (codex C1, C2). Count-capping bounds issuance and accepted claims by construction. |
| Grace window | None (stale claims revert) | 1 epoch | Exploitable by withholding; the close is atomic on the `N`th claim so grace is unnecessary. |
| Where the work proof is verified | Aztec private function (recursion) | L1 portal (App. B); AVM | Measured 19,923 gates under Chonk. Portal kept as first fallback (faithful to the lottery). |
| Ticket domain | All 410 proof fields, full-width digest for the nullifier | Commitments only; hand-picked subset; truncated nullifier | No unconstrained *proof* fields (Fact 14); whole-proof hashing closes partial proving; full-width nullifier avoids 128-bit collisions. The residual same-witness re-proof (Fact 17) is a cost bound, not a free ticket. |
| Verifier placement | Inline in `claim` | Separate `#[internal("private")]` circuit (v3 default) | An internal self-call is an extra folding step + kernel iteration; the ~30k gates saved are irrelevant at kernel scale. Phase 1 measures both. |
| Miner secret | Per-epoch random, local | Wallet-signature KDF (v3) | wallet-sdk has no message signing (Fact 18); tickets die with their epoch. |
| Escape-hatch retarget | ×4 flat, seed mixes `last_digest[e]` | `elapsed × N / claims` formula, digest 0 (v3) | The formula was always clamped to ×4. `last_digest` is public, so it adds no entropy (codex final pass); roll-seed pre-mining is accepted, not prevented. |
| Deployment | Token-less miner constructor + one-shot deployer `bind_token` | Salt-precomputed circular constructors (v1–v4) | Addresses commit to constructor args; the circular version is a fixed point no salt solves (codex final pass, Critical). |
| Genesis | Deployer premine accepted, bounded to epoch 0's `N × REWARD` | Fair-launch ceremony | No in-protocol randomness source; count-capping makes the premine worth 96 ELX. |
| Inner public inputs | `[domain, seed, e, commit, nonce, out]` | Without deployment domain | Cross-deployment replay (codex H). |
| Seed | `H(seed, e+1, closing_digest, now)` | `H(seed, e, count)` | On a count close the closing digest is unknown until the closing proof exists (one-slot last look); on an escape-hatch close every input is public and pre-mining is accepted (§2.4). Count-based seed had only ~N candidates (codex H). |
| Public params from private | `PublicImmutable` per epoch + anchor-time `open_epoch` assertion | `DelayedPublicMutable` | Expiration horizon; doomed claims should fail at simulation. |
| Toolchain | `aztec-nargo` (beta.25) + bb 5.2.0 only | Bare `nargo` beta.16 | Codex: version conflation. |
| Token | aztec-standards **ported** to 5.2.0 | Downgrading the repo to the token's pin | Violates the 5.2.0 target (codex I5). |
| Fallback order | B (L1 portal) then A (pay-per-proof) | A first | Codex: B preserves proof-hash mining; A abandons the lottery. |
| Emission | Constant perpetual | Halvings / cap | User's choice. |
| Tier | `mid` | `deep` | User's choice; recorded. |

### Codex round 1 — adopted / rejected
- **Adopted**: count-capped epochs and per-epoch issuance/load bound (C1); no grace, withholding simulated (C2); "one accepting transcript per ticket" as the stated guarantee, malleability as an explicit accepted assumption, layout manifest, determinism/multi-mutation/differential/early-abort tests (C3, H); deployment domain in inner PI and full-width nullifier (H); seed from closing digest + timestamp (H); pinned commits + reproducible ACIR/VK/manifest, CRS checksum check, external audit before mainnet (H); privacy claim narrowed (M); `aztec-nargo`-only toolchain (H); explicit `{proof, publicInputs}` interface and fixed PI order (H); port the token, never downgrade (H); `/harden security` required (Ask 8); GO redefined, GO-degraded removed (H); one multithreaded backend default + pool benchmark (H); TXE labelled plumbing-only and TXE-invalid-proof check added (M); u128 saturation, stale/same-block/atomic-revert, cross-deployment replay, public-effects, worker-crash, soak tests (gates); Fact 7 corrected (`auth_contract` is ARC-403, no upgrade mechanism).
- **Rejected**: benchmarking the L1 portal's gas and L1→L2 redemption inside Phase 1 — done only if Phase 1 is NO-GO (Fact 11 makes the primary likely; spending A1 on the fallback delays the decision). Recipient commitment inside W — the secret holder chooses the recipient regardless; no added protection. Two-epoch retarget lag — superseded by count-capped epochs.
- **Disputed / open**: whether "Bitcoin-exact" is honest wording → replaced by "Bitcoin-style" with a precise definition (§1). Whether an external audit is mandatory → made an Ask (8), plan blocks mainnet on it, user owns budget.

### Fable-role audit (conditional approve) — adopted / rejected
- **Adopted**: ticket-cost guarantee reframed around the disabled-row same-witness re-proof, lower bound measured in Phase 1 (cond. 1); mulDiv retarget tested at launch targets 2^118–2^126 (cond. 2; v3 already specified the Field-widened quotient); per-epoch random secret replaces the wallet-signature KDF (cond. 3; Fact 18); verifier inline by default, split measured as the alternative (cond. 4); GO criteria restated as ECCVM rows ≤ 2^14 and ≤ 3 GB, claim fee measured, mainnet fee-path Ask 10 (cond. 5); §2.4 load / last-look / roll-seed statements corrected, roll ≡ ×4 stated plainly and mixes `last_digest` (cond. 6); withholding restated as unprofitable; enqueue order (`record_claim` first); `contracts:codegen-vk` + CI diff; ACIR check of VK pinning; wallet-sdk wallet with the real prover in Phase 1 and Phase 4; lying-RPC test; soak wall-clock and hashrate variation stated; Fact 2/11 corrected; Facts 16–20 and I10 added; TXE plumbing-only confirmed by an invalid-proof test.
- **Rejected**: none. (The fable audit reviewed v2/v3 mid-edit; its "load never exceeds N" and last-look findings had partial fixes in v3 and are now fully stated.)

### User decisions at the gate (2026-09-03)
Asks 1, 2, 5, 6, 7, 9, 11, 12: defaults accepted. Ask 3: official `AztecProtocol/aztec-standards` v5.2.0, no port. Ask 4: browser time/memory reported, not gated. Ask 8: no external audit. Ask 10: embedded wallet + sponsored fees; mainnet deferred. Feedback folded into the ELI5: Bitcoin comparison with a worked retarget example, readable epoch diagram, explanation of the disabled-row shortcut and why it cannot be closed at the app layer. Unresolved / disputed: none.

### Owner decisions after Phase 1 (2026-09-03)
Also decided for arcs A2–A3: (4) **no `/code-review`** in the remaining quality loops (token cost) — codex loops only; (5) deployment parameters live in one config with `testnet` and `mainnet` profiles (Phase 2); (6) the testnet soak runs on the `testnet` profile (N = 4, 5-minute epochs) and is capped at 2 h; (7) the web miner stays visually minimal — default shadcn look, no branding work.
Phase 1 verdict accepted as **GO** with: (1) Ask 4's disabled-row re-derivation (4b) **deferred** — the timer-derived estimate in `spike-results.md` §4b stands, the executed patched-prover measurement moves to the roadmap; (2) the web miner **bundles a pinned CRS** (bb.js does no hash check; §5 of the results); (3) the CI hardening delivered in A1 (installer pinning, toolchain hash test, codegen diff) is acknowledged as more than this stage needed — keep it, do not extend it.

### Codex final pass, round 2 (resumed; conditional approve) — adopted
`token` as `PublicImmutable` initialized by `bind_token` (private-readable, one-shot via its initialization nullifier; `PublicMutable` cannot be read from private, `public_mutable.nr:10`), post-bind anchor test, Phase 2 deploy wording fixed; `EXPECTED > 0` asserted, overflow-safe `ceil(t/4)` and saturating ×4 with extrema tests; "lower bound" replaced by "measured attack cost / upper bound on security" in §2.1, §3.3, Ask 4, Phase 1 item 4, Phase 5 and the seeds; ledger "caps chain load" → "caps accepted claims"; §4 fee paragraph in fee-asset/break-even terms. Nothing rejected. **Verdict recorded: conditional approve — conditions met in v6.**

### Codex final pass, round 1 (fresh context; reject) — adopted / rejected
- **Adopted**: token-less miner constructor + one-shot deployer-authorized `bind_token` replacing the impossible circular deployment (Critical); `last_digest` declared in storage; elapsed capped at `T_MAX` on count close and compile-time asserts tying `T_MAX`/`EXPECTED` (High); range-constrained quotient/remainder gadget (High); escape-hatch seed honesty — public inputs, sequencer-miner slot choice, accepted and simulated (High); genesis premine stated, bounded, Ask 12 (High); "lower bound" renamed measured attack cost / upper bound on security, external audit owns the malleation question (High); lying-RPC limitation stated, cross-check option (Medium); binary/WASM hashes and Actions pinned by SHA, CRS transport vs ceremony trust separated (Medium); Fact 12/16 reworded, I11/I12 added; fee gate rewritten in fee-asset units with break-even price, Ask 10 flagged for explicit approval; Ask 11 bootstrap authority; load wording fixed in §2.1/§2.5/§4/ledger; Phase 1 spike now the full claim shape incl. token call, finalizer, reads, nullifier, enqueues, fee path, bootstrap dry run; gates: bootstrap tests, late count close, malicious `(q, r)`, premine and roll-slot simulations, real-prover burst.
- **Rejected**: none.

### Codex round 2 (conditional approve) — adopted
`out` added to `claim`/`verify_ticket` and constrained as W's sixth public input; early-abort ≥ 90 % and per-transcript-phase recursive differential made hard GO gates; ECCVM headroom measured against a named bb capacity constant (or empirically); exact overflow-safe retarget arithmetic (Field-widened product, hinted quotient checked in-circuit, clamp to [⌈t/4⌉, min(4t, 2^128−1)]); wording corrected — cap bounds accepted claims not submitted txs, "at most" `N × REWARD`, wall-clock spikes during catch-up; 1000× shock gate = 5 epochs with a numeric "converged"; escape-hatch seed predictability stated and accepted; winning digest listed as public; Poseidon2 parity fixtures for every domain-separated hash. Nothing rejected.

---

## 9. Post-implementation (self-contained — the implementing session executes this from here)

Runs **per arc at each arc boundary** (A1 after Phase 1, A2 after Phase 3, A3 after Phase 5), scoped to that arc's diff while the arc is the stack tip, then a **final cross-arc pass** after A3.

1. ~~**`/code-review <level> --fix`**~~ — dropped by the owner after A1 (token cost); the loop starts at step 2. Originally: on the arc's diff, level from §7 (A1 low, A2 medium, A3 medium; never `max`). Skim the applied fixes for unintended changes; **commit them separately** from implementation commits.
2. **Codex audit** (`/codex xhigh`): the arc's diff + a summary of the code-review commits + this `plan.md` + the decision ledger (§8) + the arc map ("this is arc N of 3; later arcs build X on it") + the adversarial/security ask (*"What could go wrong? What would an attacker target? What are we trusting that we shouldn't? Where are the supply-chain / crypto / least-privilege weaknesses?"*) + the two rules below, verbatim.
3. **Iterative fix loop**: verify codex's factual claims against the repo first; apply accepted fixes; commit; log the round (consult + verdict) in `lessons/phase-N.md`; **resume the same codex session** with the fix diff for re-review. Repeat until a round yields no new material findings. Still material after 3 rounds → stop and surface to the user.
4. After A3: **final cross-arc pass** in a FRESH codex session over the net diff from plan baseline + code-review commit summaries + cross-arc ask (seams between arcs, duplication across arcs, drift from this plan) + the two rules. Same loop-until-clean. `/code-review` is not repeated over the net diff.
5. **Delivery**: only now open PRs — `gh stack sync` if `main` moved, `gh stack submit --auto`, `gh pr edit` each body (no absolute local paths), `gh pr checks --watch`. Update `implementations-plan/index.md`. `gh stack merge` is the user's call.

**No-over-engineering rule** (verbatim in every post-impl codex prompt): *"Report bugs and small, targeted improvements only. Do not propose speculative abstractions, extra configuration surface, new layers, or rewrites — the smallest change that fixes each real problem. If code works and is clear, leave it alone."*

**Comment-quality rule** (verbatim in every post-impl codex prompt): *"Audit the comments for value per character. Flag any comment that narrates what the code visibly does, restates its line, references implementation plans / phases / reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious invariant or constraint deserves a comment it doesn't have. Comments are permanent context every future reader, human or LLM, pays to re-read: they must be few, dense, and exact."*

---

## Appendix A — Fallback 2: pay-per-proof with reward auto-adjust

Every accepted proof mints `R_e`; `R_{e+1} = clamp(E / units_e, ±25%)` so emission tracks `E` per epoch. Work unit = one private function `work_unit()` (fixed Poseidon2-chain circuit) called `n ∈ [1, 8]` times from a private `mine(n)`; the tx's own Chonk proof is the work, verified by the protocol for free. No recursion, no standalone proofs, browser-friendly today.

Costs: chain load ∝ total throughput / 8 (every share is a tx); difficulty granularity = reward divisor + units per tx; no lottery; abandons the constant-load property. Same scaffold, token, epochs, web miner; different contract core; no `work-circuit` package.

## Appendix B — Fallback 1: L1-portal verification

The miner submits the winning proof to an L1 contract generated by bb (`verifierTarget: 'evm-no-zk'`), which checks `keccak(proof) < target` against a target mirrored from Aztec (or forwards the digest and lets Aztec check it) and sends an L1→L2 message `{digest, commit}`; the Aztec private function consumes the message, opens `commit`, nullifies, mints privately. Preserves proof-hash mining and winners-only verification. Costs: L1 gas per win (~400–600k gas for a Honk verifier), message latency (minutes), Solidity + Foundry infra, and an L1 sender per claim (use a permissionless relayer so the L1 sender need not be the miner). Chosen only if Phase 1 is NO-GO.

---

## Seeds (FINAL — approved scope, 2026-09-03)

ELI5 artifact: `https://claude.ai/code/artifact/6cd79b38-666d-487d-8121-f37178e93fa2` · source `implementations-plan/elixir-core/eli5.html` (redeploy the same source path from the publishing session, or pass the URL as `url`, to update in place).

Recommended: `/goal` (completion is transcript-observable). Run inside the repo's `elixir-core` worktree on the homelab (`agent-worktree new elixir-core`, or a plain `git worktree add .claude/worktrees/elixir-core -b worktree-elixir-core` if the helper is absent). Read `context.md` first.

```
/goal Phases 0 and 1 marked ✓ in implementations-plan/elixir-core/plan.md (the per-phase headers in the file — not the chat), each ✓ backed by its phase's validation gate as written in plan.md reported passing in the transcript; `LESSONS_FILE=implementations-plan/elixir-core/lessons/phase-N.md` printed for each; spike-results.md committed with measured numbers for all Phase 1 items (both ticket-cost measurements, ECCVM rows, claim gas/resource usage, inline-vs-split, bootstrap dry run, browser time and memory labelled by machine) and a GO / NO-GO verdict against Ask 4; arc A1's quality loop done (`/code-review low --fix` applied and committed separately; codex loop converged, evidenced by a resumed codex pass reporting no new material findings quoted in the transcript); `bun run lint` and `bun test` exit 0 in the transcript; then STOP and report the Phase 1 verdict to me — do not begin Phase 2, and do not open any PR, until I answer.
```

```
/loop 15m Drive implementations-plan/elixir-core forward, arc A1 only (phases 0–1). Never idle waiting for my input. Each firing: (1) reality check — read plan.md + lessons/, rebuild the task list from plan.md if empty, `git status`, `git log --oneline -5`; (2) no task in hand → next pending step; after each meaningful edit run `bun run lint` + `bun test` for touched packages, commit conventionally, push the arc branch (no PR); (3) stuck or facing a decision you'd bring to me → `/codex xhigh` (if codex is down, retry every 5 minutes until it answers; never skip or substitute), decide, log the consult in lessons/phase-N.md; hard limits stay hard (no merge, no deploy, no scope beyond plan.md); (4) same step failed 5 times → stop retrying, reassess with codex; (5) phase green = its gate in plan.md passes: paste the result, mark ✓, file lessons, print `LESSONS_FILE=...`; (6) Phase 1 ✓ → run A1's quality loop per plan.md §9 (`/code-review low --fix`, commit separately, codex loop until clean), then write the Phase 1 report (measured numbers, verdict vs Ask 4, what it implies for phases 2–5) and STOP — do not start Phase 2 or open PRs until I decide.
```
