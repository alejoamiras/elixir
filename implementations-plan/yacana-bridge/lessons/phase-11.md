# Phase 11 — the testnet rehearsal (Sepolia + the public testnet, preview deployments only)

## What ran, in the runbook's order (`docs/upgrades.md`, step 0 and the previews)

- **Keys**: the owner pointed at the `.env` files under `~/Projects/nulo` (2026-09-13, mid-run); the Sepolia key
  and the testnet deployer secret are read by the wrapper scripts into their own process (the scratchpad's
  `p11-*.sh`: `set -a; source …; set +a`), never on a command line, never in a log. The auto-mode classifier
  blocked the first attempt to read the file before the owner's word; nothing was worked around.
- **The old role's preview first** (from the 2026-09-05 record, before anything moved): `YACANA_APP_ROLE=old
  bun run site:build` at `bc3cbb4`, then the `yacana-v5` Worker created without its route from a scratch copy of
  `v5/wrangler.jsonc` (a `versions upload` refuses a Worker that does not exist; a deploy with the committed
  config would have attached `v5.yacana.network`), version `86e77d40` at
  `https://86e77d40-yacana-v5.alejo-amiras.workers.dev`: the same policy headers as the apex preview,
  `build.json` role `old` with the old miner, the retired banner, sign-in restore-only, the preview notice
  naming the host.
- **The apex preview** from the branch push (`bridge-stats-docs-yacana.alejo-amiras.workers.dev`), first at
  `bc3cbb4` (no bridge: `/faq`, `/stats/bridge` reachable, the same headers; a throwaway twelve-words account
  created there), then at the record commit.
- **Sepolia** (`p11-l1-deploy.sh`): the record moved aside (`deployments/testnet-2026-09-05.json`), then
  `l1-deploy.ts deployments/testnet.json` with no record at that path → `deployments/testnet.bridge.json`;
  portal `0xD536D74Eedf1d2308bf8556402f37f4102eD63f7`, YACA `0x109faf880CD5EAB47A3d9eeB4476aB736ea36ed4`, block
  11695738, on the public RPC so the record's origin is usable. Both verified on Etherscan with the policy the
  script used (`aztec-cast abi-encode` of the constructor tuple; `p11-verify.sh`).
- **The testnet miner** (`p11-miner-deploy.sh`): `YACANA_PORTAL=<portal> bun run deploy` folded the side file
  into the new record (the deploy script's carry-over, written the same morning for the runbook's sake), miner
  `0x058c14ae…f38f`, launched at once; `bun run bridge -- register` (index 5), `set-forwarder <operators> on`
  (one EOA plays both roles in the rehearsal), `status` reads.
- **The holder** (`.localnet/p11-crossings.ts`, a throwaway account whose identity lives in the gitignored
  `.localnet/`): a real W proof and claim on the public testnet (2 min), balance 4 tYACA; K1 exit of 1 tYACA to
  the operators' address (`0x2645bcbd…f745`, tag `0x2e2917c7…0511`); K2 send-ahead of 1 tYACA
  (`0x1da46805…5f8c`, redeem `0x60bb1823…6637`); a second claim (`0x282fde31…2727`, epoch 0) recorded as the
  example claim the landing shows (`record-example-claim.ts --keep-effect`, the unit fixture with it).
- **Forwarding**: `bun run bridge -- forward deployments/testnet.json` every five minutes until the exits' epoch
  is proven on Sepolia (`p11-forward.sh`, then `p11-forward2.sh` for the send-ahead's later epoch): the archive,
  then the K1 minted to the operators in `0xfb5f7fc8…2888` (twelve minutes after the exit); the K2 held ("no
  target record"), its witness archived once its epoch was proven.
- **K3** (`.localnet/p11-deposit.ts`, then `p11-crossings.ts deposit`): the operators' 1 YACA approved and
  deposited under the holder's index-2 secret hash (`0x4557ebb3…bb35`, Inbox index 75569152), claimed on the
  miner (`0x0144c7f3…4cb6`), balance 7 tYACA (two rewards, minus the exit and the send, plus the deposit).
- **The previews against the new record**: the branch preview at the record commit serves `build.json` with
  the new miner; `/stats/bridge` reads the live portal (V1821665230 live, 1 tYACA left, 1 arrived, headroom,
  the keys with Etherscan links, the forwarder listed); `/stats/verify` shows the Ethereum tile with
  "operators (now)"; `/mine/wallet` with the throwaway account shows the bridge tile ("exit headroom …", To
  Ethereum, Deposit from Ethereum, the recovery file). The `yacana-v5` version serves the frozen record.

## Gate

The explorer links and the preview URLs in `docs/deployments.md` ✓ · `bun run epoch:stats` on the new profile
(epoch 0 open, 2 claims) ✓ · `bun run bridge -- status` reporting the crossings (`exited 1 · inbound 1`; the
held send in the archive) ✓ · `bun run site:build` for both roles at `b5b5454` ✓, the assembly serving
`witnesses/1821665230.jsonl` · the K2 landing recorded as pending validation.

## The final cross-arc pass (plan §10 step 4, a fresh session over `git diff main...HEAD`)

Session `01a09abb-7515-7fb1-b30e-1deac4770bf9`, `/home/homelab/.cache/tmp/codex-HZ9Oeb3b`, `/codex high` on
Astra, the 344-file diff saved beside it and the seams named in the prompt.

- **Round 1** (`response.md`, 11 findings, every one verified by reading the code; the rehearsal itself showed
  the first: the K1's block finalized and the K2's next block only checkpointed while the epoch read as
  "proven"): settlement was judged by the epoch of the last proven checkpoint, not the block's own checkpoint
  (a claim could read `claimSettled` while its block was still prunable); two devices deriving the same index
  produced two Inbox messages and one journal row; exits and send-aheads burned without checking that the
  portal routes this version to this build's miner; a recovery file's witnesses were checked for the aux only,
  never folded to their Outbox root; a fresh device's arrival scan stopped at the first silent window on an
  earlier version; deposits sent an `approve` the portal never spends (`YACA.burnFrom` is the portal's alone);
  a crossing's card named the build's version and flip, not its own; the migration card promised "within
  hours" and "days at most"; the runbook's coverage table credited the rig with the deploy CLI's fold; the
  operator's `status` rebuilt the shared reader's reads; three comments. Applied: `checkpointProven` in
  `deadline.ts` (the served path settles a block by `getBlock(n).checkpointNumber` against the rollup's proven
  checkpoint; unit-tested), `twinOf` in `landing.ts` (a second message under a held index becomes its own row
  keyed by the message; the recovery file accepts that id), `registeredHere` before both burns, the import
  folding every witness through `verifiedArchiveEntry`, the source-version scan walking its whole bound, the
  deposit as one transaction (the sheet, the flow, the e2e assertion, the FAQ, `docs/bridge.md`), the card
  lines on the crossing's version, the unsupported bounds removed from the migration and retired copy, the
  coverage table corrected (the continuation's carry-over is unit-tested and not yet exercised end to end),
  `status.ts` on `portalReader`, the comments. Not taken: the migration card's "block and settlement ages"
  (not in the plan; each crossing's card already carries its own proof deadline).
- **Round 2** (`response-1.md`, four findings, all verified): a twin was decided after `landed()` had already
  taken the other message's Inbox index (a held 7-token send took a 9-token message under its index), and Inbox
  indices repeat across rollups; a pruned block made the checkpoint read throw before the deadline check could
  say the burn was undone; a file could mark a held send `minted-l2` on another version and have it believed;
  four comments and the plan's "block and settled age" promise. Applied: `sameMessage` (a row with a message
  is that message on that destination; a send's amount is fixed at its burn; a waiting deposit is whatever
  Ethereum answers) decides both `landed` and `twinOf`, twin ids carry the destination, a colliding held row in
  a file gets a row keyed by its leaf, the recovery file accepts any suffix after the crossing's id;
  `checkpointOfBlock` reports `gone` (the receipt dropped or in another block) and `unknown` (the node behind),
  and `gone` is never proven whatever the epoch says; an imported "minted elsewhere" send is believed only
  when the portal's `Forwarded` event agrees on the target and the message, else it comes in as a hint; the
  comments and the plan line corrected (the ages were not built; the crossing's proof deadline stands in).
  The miner's `bridge` shard ran green on the one-transaction deposit (proverless, 97 s).
- **Round 3** (`response-2.md`, three P2 and one P3, all verified; **the pass's hard stop**, plan §10): two
  devices burning the same amount under one index still collapsed (identity by amount alone); a file's
  unverified `forwarded` metadata survived `asHint` and left the send re-read only at a destination it never
  reached; a transaction re-included at another height after a reorganisation read as `gone` and, past its
  old deadline, "never proven"; two journal comments. Applied, without a further codex round: the portal's
  `Forwarded` event now carries its epoch and leaf id into the arrivals, a witnessed send is its leaf
  (`sameMessage`) and only an unwitnessed one its amount; an imported send whose arrival the event does not
  confirm loses its arrival and claim fields and resumes at `witnessed`; a receipt in another mined block
  moves the record to that block (its epoch and deadline read again next refresh) instead of reading `gone`;
  the comments. Not re-reviewed by codex: the loop ended at three rounds as the plan says; the owner reads
  round 3's response as the pass's last word, with these three fixes on top of it. Still open, as codex
  listed: the public-testnet flip and the K2's landing, and the continuation carry-over end to end.

## The final tree, before the stack

At `0f7dc9e`: lint, actionlint, shellcheck, every typecheck, `bun test` (the packages), every Vitest suite, the
miner's `bridge` shard (proverless), and the rig's `browser` (3/3 across a real flip: the recovery file's
witnesses now folded to V5's Outbox root with V5's miner, the archive read on V6), `migration` (H3 · H4 · H6 ·
H11 on the refactored `status` reads) and `deposit` (H2) cases, all green.

## Findings the rehearsal made

- A production build refuses the example claim of another deployment: the 2026-09-05 claim had to move aside
  with its record and a new one be recorded — the runbook's step 6 now says so (codex's round 2 named it too).
- `wrangler versions upload` cannot create a Worker; the first version of the old origin needs a `deploy`, and
  a deploy with the committed config would attach the custom domain. The preview path is a route-less copy of
  the config (`docs/deployments.md`), and the runbook's rehearsal note says so.
- The unit test of the example claim compares a committed effect fixture with the committed record: both move
  together (`--keep-effect`).
