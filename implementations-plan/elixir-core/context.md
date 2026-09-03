# context.md — hand-off for whoever implements `elixir-core`

Read this first, then `plan.md`. Everything below is what a fresh agent would otherwise have to reconstruct from a
conversation it never saw. Nothing here overrides `plan.md`; where they disagree, `plan.md` wins and this file is stale.

## 1. Where things stand (2026-09-03)

- **Plan approved** by the owner on 2026-09-03 with the decisions recorded in `plan.md` §5 (Asks 1–12, all marked *decided*)
  and §8 "User decisions at the gate". Nothing is implemented yet; the repo holds only planning artifacts.
- The plan went through: codex round 1 `reject` → round 2 `conditional approve`; independent Claude ("fable") audit
  `conditional approve`; fresh-context final codex `reject` → `conditional approve`. Every condition was adopted; the
  ledger in §8 says what changed and why. Transcripts: `audit-codex.md`, `audit-fable.md`.
- ELI5 for humans (the owner's decision layer, kept in sync with the plan): https://claude.ai/code/artifact/6cd79b38-666d-487d-8121-f37178e93fa2
  — its source is `eli5.html` here; to update it from a new session pass that URL as `url` to the Artifact tool.
- Next step: **arc A1 = Phase 0 (scaffold) + Phase 1 (feasibility spike)**, then STOP and report the GO / NO-GO to the
  owner. Do not start Phase 2 or open a PR before the owner answers. The seeds at the bottom of `plan.md` encode this.

## 2. What this is, in one paragraph

A privately mineable token on Aztec whose mining work is Barretenberg proving. A miner proves a fixed Noir circuit
(a Poseidon2 chain) for each nonce; the ticket is Poseidon2 over the whole 410-field non-ZK UltraHonk proof; a ticket
below the 128-bit target wins; the winner sends a private Aztec transaction whose `claim` function verifies the proof
in-circuit (measured ≈ 20k gates under Chonk), checks the ticket, nullifies it and mints 4 ELX privately. Epochs close
after 24 accepted claims and the target rescales by actual/expected time (clamp ¼…4), Bitcoin style. The prototype this
replaces (a teammate's `harsh-elixir`, native Poseidon2 grinding checked in a public function) rewarded GPUs, not the
prover; teardown: https://claude.ai/code/artifact/4be64d08-8d1e-4581-a14a-3152909b3890. **Nothing from it is ported.**

## 3. Facts you can rely on without re-measuring

All in `recon.md` with citations; the ones that shape Phase 1:

| Fact | Value |
|---|---|
| Recursive UltraHonk verifier, plain Ultra circuit | 681,980 gates |
| Same call inside an Aztec private function (`bb gates --scheme chonk`) | **19,923 gates** (empty private fn: 5,469) |
| Work circuit W, ≈ gates per Poseidon2 step | ≈ 74 (1024 → 75,950; 2048 → 151,726; 4096 → 303,278) |
| Native `bb prove` of W on M4 Pro, 14 threads | 0.34 / 0.63 / 1.0 s |
| Proof layout | 410 fields × 32 bytes big-endian, public inputs separate; padded to `CONST_PROOF_SIZE_LOG_N = 25` |
| Unconstrained proof fields (native verifier, 1-bit flips) | **none** of 410 |
| Does simulation / TXE check `recursive_aggregation`? | **No** (ACVM measured; TXE by source inspection) → proof validity needs real proving |
| Non-ZK Ultra disabled sumcheck rows | first 4 rows, `sigma = id` → same-witness re-proof shortcut (plan §2.1, Phase 1 item 4b) |
| ECCVM | fixed 2^15 rows; one verification ≈ 800–900 rows (estimate, measure) |
| Private→private calls | 8 per call, 16 per tx |
| Token | `AztecProtocol/aztec-standards` tag `v5.2.0`, single immutable `minter`, `mint_to_private(to, amount)`; npm `@aztec-foundation/aztec-standards@5.2.0` |
| `@aztec/wallet-sdk` `BaseWallet` | no message signing (hence per-epoch random secret) |
| `PublicMutable` | cannot be read from private in 5.2.0 → `token` is a `PublicImmutable` initialised by `bind_token` |

The probe sources and exact commands are in `probes/` (see its README). Reuse them for Phase 1 items 1–4.

## 4. Machine prerequisites (homelab)

- **Aztec 5.2.0 toolchain**: `VERSION=5.2.0 aztec-up` (or the equivalent installer) → `aztec`, `aztec-nargo`
  (= Noir 1.0.0-beta.25; do **not** use a bare `nargo`), `aztec-txe`, `aztec-noir-profiler`, and
  `bb` at `~/.aztec/current/node_modules/.bin/bb` (5.2.0). The v5 sandbox is a native process (no Docker).
- **Bun ≥ 1.4** (`bun --version`), `gh` + the `gh-stack` extension (`gh extension install github/gh-stack`),
  `shellcheck`, `actionlint`; Biome is a project dev-dependency (Phase 0 adds it).
- **codex CLI** logged in (`codex login status`). Rule from the owner: if a codex call fails or codex is down,
  **retry every 5 minutes until it answers**; never skip or substitute. `/codex` runs at `xhigh`.
- Playwright + headless Chromium for the browser measurements in Phase 1 and Phase 4 (`bunx playwright install chromium`).
- Optional for the RAM/time numbers "on the reference laptop": that is the owner's M4 Pro (48 GB). On the homelab,
  measure natively and in headless Chromium anyway and **label the machine**; browser time/memory are reported, not gated.
- Sources the plan cites are in the aztec-packages checkout that `aztec-nargo` fetches to
  `~/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0/` (Noir side) and `~/.aztec/versions/5.2.0/node_modules/@aztec/`
  (TS side). If absent, one `aztec-nargo compile` of any contract depending on aztec-nr `v5.2.0` populates the former.

## 5. Conventions that apply here (owner's global rules, condensed)

- **Worktrees**: one clone, parallel work in `.claude/worktrees/<slug>` on branch `worktree-<slug>`; use
  `agent-worktree new elixir-core` (aa-skills helper) if available, then `agent-worktree register` / `status`. The plan
  was drafted in the root clone because the repo had no origin yet; implementation should happen in the worktree.
- **Run isolation**: never hardcode ports, never `pkill -f`. Claim ports from `~/.agents/ports.md`, spawn services
  detached in their own process group, tear down only what you own. Phase 0 creates `scripts/run/*` from the my-stack
  skill; the `run-isolation` skill has the rationale. A sandbox already listening on 8080 is somebody else's.
- **Commit signing**: follow `~/.agents/machine.md` on the machine. On the homelab signing is non-interactive → keep
  signing normally. Conventional commits, small and frequent. Never push to `main` from an autonomous session; push the
  arc branch. PRs are opened only in the Delivery step after the quality loops.
- **Stack**: Bun 1.4 native-first, Biome for lint+format, `bun:test` for TS, Vitest for React components, Playwright for
  E2E, React + Vite + Tailwind v4 + shadcn for the web miner, Cloudflare Pages for hosting (deploy is the owner's action).
  Supply chain: `bunfig.toml` `minimumReleaseAge = 604800`, frozen lockfile in CI, `bun audit`. The `my-stack` skill has
  the exact scaffold sequence and templates; Phase 0 is that skill applied.
- **Comments**: say what the code cannot; never reference plans, phases or reviews in code comments.
- **Lessons**: log every meaningful attempt in `lessons/phase-N.md`; after 5 failures on one step (autonomous mode)
  stop and reassess with codex. Keep `implementations-plan/index.md` current.
- **Testing philosophy**: smallest set of tests that proves the behaviour and catches the expected failures; for code
  that touches external systems always one real-data integration test under `describe.skipIf(!ENV)`.

## 6. Pitfalls already paid for

- `bb prove` needs `-k <vk>` from a prior `bb write_vk`, else "Unable to open file: ./target/vk".
- `bb --output_format` accepts only `binary|json`; the binary proof *is* the field array.
- `bb gates --scheme ultra_honk` rejects Aztec function bytecode ("does not support CallData/ReturnData block
  constraints"); use `--scheme chonk` on a function extracted with `probes/extract-aztec-fn.ts`. `client_ivc` is not a
  scheme name.
- Contract artifacts name functions `__aztec_nr_internals__<fn>`.
- `aztec-nargo execute` happily "solves" a recursion circuit with a garbage proof: never trust simulation for proof validity.
- bb.js `generateRecursiveProofArtifacts` is a stub; convert proof bytes to fields yourself (32-byte chunks).
- The `bb_proof_verification` Noir lib (`barretenberg/noir/bb_proof_verification` in the aztec-packages checkout) has no
  dependencies; a `path =` dep works. It exports `verify_honk_proof_non_zk` (410-field proof, 115-field VK, type 0).
- Aztec addresses commit to constructor arguments: two contracts cannot each take the other's address at construction.
  Hence the token-less miner constructor + one-shot `bind_token` in plan §3.4.
- Edit scripts that mutate the plan: use absolute paths and end with an explicit write; two planning edits silently did
  nothing because of a drifted cwd / a missing write.

## 7. Phase 1 in practice (what "spike" means here)

Build `packages/work-circuit` and a spike contract, then measure everything in plan §6 Phase 1 items 1–6 with real
proving on an isolated sandbox (`PXE_PROVER_ENABLED=true`), through an embedded wallet (`@aztec/wallets/embedded`)
paying with the sponsored FPC (`SponsoredFeePaymentMethod` from `@aztec/aztec.js/fee/testing`;
`getSponsoredFPCAddress` lives in `@aztec/cli`). Write `spike-results.md` with the measured table and the verdict against
Ask 4. Then stop. The hard GO criteria are listed in Ask 4; browser time and memory are reported, not gated.

## 8. If you must deviate

Small deviations: decide with `/codex xhigh`, log the consult in `lessons/`, proceed. Anything that changes the
mechanism (§2), the security assumptions (§4) or the decided Asks (§5) is the owner's call: stop and surface it.
