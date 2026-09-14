# Yacana bridge and migration — mechanism, states, pitfalls (design spec, draft 2)

Draft 2 folds in the Codex adversarial review (session `01a0921e-1323-7dd0-abca-ec0ef6ab50f4`, response at
`the session scratchpad (codex dir codex-lqc1BEE0, response.md)`). What changed from draft 1 is marked **[v2]**.

Yacana: a privately mineable token on Aztec (aztec-standards `Token`, minter = the immutable `yacana_miner`).
Aztec's Alpha rollups do not carry state between versions. Every version has its own L1 Rollup/Inbox/Outbox;
the L1 Registry names the canonical one; old rollups keep existing and can be bridged out of while they prove.

## 0. Decisions taken (owner)

- Architecture A + B, permanent from launch: (A) private relay through Ethereum for migration, (B) an ERC-20
  `YACA` on Ethereum minted only by the portal.
- The previous version's app keeps running at `v5.yacana.network` (the last V5 build); `yacana.network/mine`
  becomes the V6 build. One build carries one aztec.js. Passkeys use RP ID `yacana.network`, so the same
  passkey signs in on the subdomain. **[v2]** That origin can open the same master key, so it must stay trusted
  software (same pipeline, CSP, headers), and `packages/site/src/browser/host.ts` must name it explicitly
  (key *restore* allowed there, key *creation* apex-only).
- Ethereum transactions: a Yacana relayer forwards every exit; wagmi/viem in the app for self-serve forwarding
  and deposits. Ethereum reads: browser → a public JSON-RPC, a setting beside the node setting.
- Governance: a plain multisig, no timelock. Powers: write-once map version → L2 miner; pause (bounded).
- No pending list: consume and forward are one atomic call; a migration exit waits in V_N's Outbox.
- **[v2]** No epoch cutoff. A *retire* message from the portal stops mining on the old chain instead (§3).

## 1. Contracts

Per Aztec version (immutable, redeployed each version):
- `yacana_miner`: `claim` (mining; refuses once retired), `exit(amount, kind, …, nonce)` (private:
  `Token.burn_private` via authwit, `message_portal(PORTAL, content)`, and a public enqueue that records the
  exit's public fields as a log and bumps counters), `claim_from_l1(amount, secret, recipient, leaf_index)`
  (private; allowed after retirement), `retire(leaf_index)` (public; consumes the portal's retire message),
  public counters `exited_total`, `exits_count`, `claimed_from_l1_total`, `retired`. Constructor: the previous
  version's epoch index, target and seed only. **[v2]** No supply figure is carried: supply per chain is a
  stats computation, never a contract fact.
- `token`: aztec-standards, unchanged.

On Ethereum, once: `YACA` (minter/burner = the portal); `YacanaPortal`; the multisig (a Safe).

## 2. Message kinds

- K1 `to-L1`: content = H(1, recipientL1, amount, tag). Consume → `YACA.mint(recipient, amount)`. Public:
  amount, recipient, tag. **[v2]** `tag = H(secret_i)` so the seed scan also finds K1 exits.
- K2 `to-next`: content = H(2, amount, secretHash). Consume → require the successor is canonical and
  registered → `Inbox(successor).sendL2Message(l2[successor], H(4, amount, secretHash), secretHash)`.
- K3 `deposit`: `deposit(amount, secretHash, expectedVersion, deadline)` **[v2]**: reverts unless the
  canonical version is `expectedVersion` and `block.timestamp ≤ deadline`; `YACA.burnFrom(msg.sender)` →
  `sendL2Message(l2[expectedVersion], H(4, amount, secretHash), secretHash)`.
- K4 inbound (from K2 or K3): `claim_from_l1` consumes and mints privately.
- K5 `retire` **[v2]**: `portal.retire(N)` (anyone): requires `Registry.getCanonicalRollup() ≠ rollup(N)`;
  records `flipAt[N] = block.timestamp` (first call only); sends `Inbox(N).sendL2Message(l2[N], H(5, N), 0)`.
  On L2, `miner.retire(leaf)` consumes it (sender = the portal) and sets `retired`.
- K6 `redeem` **[v2]**: a K2 unforwarded 30 days after `flipAt[N]`: `redeemToL1(leaf, preimage, secret,
  recipientL1)` mints YACA to whoever proves the secret. No K2 is ever confiscated while the deadline holds.
- Secrets: `secret_i = H(seed, "yacana/exit/v1", version, i)`, sequential `i`, gap limit 20, next index =
  max seen on chain + 1 (a collision between two devices yields two messages claimable with one secret,
  harmless). Cryptographic wiring: Aztec's `compute_secret_hash`, the content encodings and the fixed portal
  sender address, with cross-language test vectors before implementation.

## 3. Portal rules

`forward(N, leaf, preimage)` (per leaf; a batch continues past a failed leaf):
1. `l2[N]` set; the Outbox message's sender actor == `l2[N]`, version == N; the Outbox nullifies by
   `leafId = 2^depth + leafIndex` and needs the epoch's checkpoint count with the path.
2. Deadline **[v2]**: `now ≤ max(flipAt[successor of N's successor], flipAt[N] + 180 d) + pausedDays[N]`,
   i.e. exits from N close at the later of "the version after next is canonical" and 180 days after N's
   flip, extended by every paused day. (Open: never / one hop / this. Drawn as this.)
3. Not paused (per version or global; a global pause counts against every version's budget).
4. Rate limit **[v2]**: `exited[N] + amount ≤ cap(N, now) + inbound[N]`, where `inbound` counts K2 arrivals
   and K3 deposits into N, and `cap(t) = REWARD × N_CLAIMS × (3 × (t − launchAt) / EXPECTED + ALLOWANCE)`. A
   blocked exit keeps its place and lands as the cap grows: the cap is a tripwire that slows a drain until the
   operators pause, never a closed door (honest bursts can exceed the schedule: epochs close on N claims with
   no minimum duration, and the ×4 clamp only bounds the target's speed).
5. K2 only: the successor is canonical and `l2[successor]` set, else revert (the leaf waits).

Successor **[v2]**: Registry versions are identifiers (truncated hashes), never counters. The portal stores
each registered version's index in the Registry's history and defines the successor as the version at
index + 1 (`Registry.getVersion`).

Pause: per version or global; auto-expires after 30 days; at most 60 paused days per version over its life;
paused days extend the deadline.

Trust, disclosed on the stats record **[v2]**: the multisig chooses which L2 contract may issue YACA per
version (write-once, but the first write is trusted); a wrong choice could mint up to that version's cap.
The app refuses to claim on a version whose `l2[]` differs from its build's miner.

## 4. The life of a version

- T0 launch on V_N: K1 and K3 live. K2 hidden until an upgrade is announced.
- T1 announced: config `migration: {toIndex, announcedAt, expectedFlipAt, oldAppUrl}` + the app watches the
  Registry. K2 appears; the banner says move early; deposits into V_N warn, and close 24 h before.
- T2 flip: Registry canonical = successor. Anyone (the bot first) calls `retire(N)`; V_N's miner consumes it
  and refuses claims from then on (the leak: mining between the flip and the consumption, minutes, bounded by
  N claims per epoch). Yacana deploys the successor's miner + token, sets `l2[successor]`, ships the new build
  at the apex and the last V_N build at `vN.yacana.network`; the bot forwards the K2 backlog.
- T3 V_N still proves: everything on V_N can still leave; the bot archives the Outbox witnesses of every
  pending exit, the wallet keeps its own.
- T4 V_N quiet: unburned balances and exits in never-proven epochs are gone; proven exits with a saved witness
  still forward.
- T5 the deadline: exits from V_N close.

## 5. Journeys and states

See the canvas: the journey map (six moments × four surfaces) and the state table (every card state, its
sentence, action, source of truth, and what follows). Journeys: J1 withdraw to Ethereum, J2 deposit from
Ethereum, J3 move to the next version, J4 the old app after the flip (mining retired on chain, exits work
while V_N proves, then the dead state), J5 first open on the new version (scan, claim), J6 paused, J7 RPC
silent (new Ethereum-bound exits held back so a burn never rides stale eligibility). **[v2]** Added states:
dropped (send again), witness saved / witness unavailable, successor not registered, redeemable after 30 d,
sponsor unavailable, closed by the deadline, wrong deployment, restored from file.

## 6. Pitfalls (Codex's blockers, and where each landed)

1 version arithmetic → successor by Registry index · 2 lazy cutoff → no cutoff, retire on L2 · 3 late-user
promise → true again: exits work while V_N proves · 4 one-hop confiscation → 180 d floor + paused days + K6
redemption · 5 first-write fraud → disclosed on the record, bounded by the cap · 6 net accounting underflow →
`exited + amount ≤ cap + inbound` · 7 cap as issuance bound → a growing rate limit, exits keep their place ·
8 deposit destination drift → expectedVersion + deadline, deposits close 24 h before a flip · 9 checkpoint →
epoch index, target, seed only · 10 pending recovery → the exit publishes its public fields; witnesses kept by
the wallet, the file and the relayer · 11 seed recovery → domain-separated derivation, K1 tag, gap limit ·
12 pause semantics → auto-expire, global counts per version, days extend the deadline · 13 old origin →
trusted software, host guard · 14 relocation → host.ts allowance, key restore only · 15 crypto wiring →
Aztec hashes, vectors · 16 leaf id and batching → per-leaf, continue on failure · 17 states → added ·
18 privacy → amount and timing linkage disclosed on the review.

## 7. Stats

On Ethereum (ERC-20 supply) · on Aztec V_N (minted − exited + claimed_from_l1, from the node) · in transit
(proven, not forwarded) · waiting to be claimed (forwarded or deposited, unclaimed: `forwarded − claimed`) ·
bridge (open/paused, relayer's last forward, pause budget) · left V_N (exited, waiting for headroom). Per
version: minted, left to Ethereum, moved on, came from Ethereum, still there, pending exits and whether their
witnesses are archived, when exits close. The record: YACA, portal, registry, the operators, the trust lines.

## Draft 3 deltas (take two, after Codex round 2 and two Fable reviews, 2026-09-11)

- The verb is **Send ahead** ("Commit" is the launch lottery's word in this app and implies reversibility).
- A send is safe only once V5 proves its epoch to Ethereum; each epoch has a proof deadline
  (`getTimestampForEpoch(e + proofSubmissionEpochs + 1)`) the card shows. A missed deadline prunes the epoch: the
  burn is undone and the balance is back on V5 (never "lost" until V5 stops for good).
- Upgrade detection uses several signals (Registry via RPC ≠ the build's rollup, the node's rollup version, the
  miner's `retired` flag, V5's block and proof age); silence renders "unknown", never "nothing".
- V6 may run before it is canonical if the GSE names it; forwarding still waits for the flip by rule. No on-chain
  lifetime signal for V5: show block age, proof age, per-send deadlines.
- One consent on the send sheet: hourly automatic sends of new wins until the upgrade, and the landing claim on V6
  at sign-in (`claim_from_l1`, fee sponsored on testnet; mainnet fee path open). "Claim" appears only on failure.
- Redemption (K6) binds the payout: content commits to a redeem key derived from the seed; `redeemToL1` needs a
  signature over (leaf, recipient), so a revealed secret cannot be front-run.
- Account addresses differ per Aztec version (account class id): the key store keys the address by class id and
  re-derives; the V6 arrival card says so; the V5 build persists `{balance, block, at}` per poll for "last seen".
- The old origin keeps node + RPC settings, recovery file import/export and self-forward under "advanced"; the host
  guard names it; key creation stays apex-only; words are retyped there.
- The V5 build at the apex detects the V6 build via `build.json` and shows "this tab is the old app".
- Stats: the observatory is the canonical version only; `/stats/bridge` shows flows per version, not balances
  ("left to Ethereum, net"); the limit reads "N tYACA may leave V5 right now · grows M an hour; exits beyond it wait".
- The exit limit of a retired version stops growing at `flipAt[N]`: whatever is mined in the gap between the flip
  and the retire message's consumption cannot enlarge what may ever leave V_N.
