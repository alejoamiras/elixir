# Follow-up — what stays after stack #41 merges (2026-09-14)

The backlog the six PRs leave behind, gathered from the plan's "not in this plan" list (§1), the lessons' open
items (phases 11–13), the delivery report's confidence table, and the owner's review rounds. Ordered by what
unlocks what; each item names the evidence it would add. The next blueprint starts from here, on a fresh
worktree off `main`, not from this branch.

## 1. Right after the merge (the owner's calls, in this order)

1. **Production deploys.** `bun run site:deploy` for the apex with the new record (the bridge block, `registryIndex: 5`,
   the first-epoch floor); then `wrangler deploy -c v5/wrangler.jsonc` attaches `v5.yacana.network` to the versioned
   origin. Then sign in with a real passkey on both hosts (one account across the apex and the versioned origin: the
   rig's `origin` case proved it on TLS test domains only).
2. **Dispatch the full rig on CI** (`harness.yml` with `all`): pull requests run only the flip; the migration cases
   (H3 · H4 · H6 · H11), `deposit`, `browser` and `origin` have run green locally only.
3. **A dedicated relayer key.** The rehearsal lists the multisig's EOA as the relayer too. One `set-forwarder` call
   once the second key exists; `YACANA_L1_FORWARDER_KEY` is already the script's env for it.
4. **Forwarding cadence.** The pages promise none: a withdrawal is the holder's claim, a held send-ahead says "Yacana
   forwards it once the next version opens; you can too". Either a cron runs `bun run bridge -- forward` on the
   owner's machine, or the copy stays as is. Decide once, write it into `docs/upgrades.md`.
5. **Keep forwarding the held K2** (1 tYACA in the archive, "no target record"): it lands only once a next testnet
   version is registered.
6. **Close the worktree**: `agent-worktree done yacana-bridge` after the merge (ExitWorktree first).

## 2. The bridge's UI/UX — the next pass over bridging, depositing, sending ahead

What the owner's two review rounds did not reach, and what only a hand on a real wallet will find.

- **A pass by hand with MetaMask on the preview.** Every browser path ran with the injected test wallet; no one has
  bridged to Ethereum, claimed there, deposited and sent ahead with a real wallet on the preview. Expect the
  wallet-picker copy, the chain-switch prompt, the gas estimate moment and the "×" disconnect to want words.
- **The claim, forward and redeem sheets were never drawn.** They follow the sheets' vocabulary (title, sentence,
  the wallet row, the amount block, one button); a design pass would give the claim its own moment (the recipient,
  the gas, "claimed" with the Etherscan link) instead of the held sheet's generic frame.
- **The deposit sheet after the upgrade is announced**: the pre-flip warning, "deposits closed before the upgrade",
  and what the arrival card says to a deposit that lands on the old version. Drawn once (FromEthereum), never
  exercised against an announced migration in the browser.
- **The arrival card after a real flip**: the rig proves it on the isolated network; the public testnet has not
  upgraded since the bridge shipped. First real upgrade: walk the guided path on the preview and keep the pictures.
- **A second-device restore from the recovery file on the preview**, and the discovery of unforwarded sends from
  the served archive on a fresh device (the archive completes a crossing the journal holds; a new device restores
  from the file). Both are rig-proven, neither done by hand.
- **The taking-long dialog's "Open the bridge tile"** lands on this version's wallet page; for a held send-ahead the
  forward lives on the next version's page. Once the record names the next version's origin, the button could go
  there directly.
- **Naming an earlier version.** `versionNameOf` falls back to "another version" for a crossing whose version is
  neither this build's nor the canonical one: on a V6 page an arrival from V5 reads "left another version". The
  continuation record could carry the previous version's index (`continuation.registryIndex`) so it reads "left
  Aztec V5".
- **The exit sheet's ETA follows the testnet's epoch.** "Usually within the hour" is right for 5-minute epochs with
  a few epochs' proof delay; mainnet's hour-long epochs want the words derived from `EXPECTED_EPOCH_SECONDS`, like
  the proof deadline already is.
- **Progressive disclosure on the bridge tile.** The journal card carries its full sentence; a long journal (many
  crossings) could collapse finished cards to their word and stamp, as the stats page's version card does.
- **Light theme.** The rules' diagrams and the new tooltips were drawn and checked on the dark theme; their tokens
  follow the light one, but nobody looked. One pass with `.light` at the four widths.
- **The FAQ on a phone.** The diagrams scroll horizontally under 640 px by design; the who-may grid too. Check
  the reading order and whether the summary line's "how it works" chevron is reachable with a thumb.
- **The stats page's coins chart across versions.** Drawn only while one version has minted (a send-ahead lands on
  the next version without a claim there, so no version's epochs and flows add up). A per-pool chart (all versions'
  emission against all YACA) is the honest replacement once V6 exists.

## 3. Copy and the rules — the questions the owner left open

- **The timings on the rules canvas** ("I don't quite understand the timings … maybe fix them after"): the last
  day is `max(V(i+2) live, upgrade + 180 d) + paused days`; a withdrawal the old version never proved is undone
  onto it. The pages say this as the portal enforces it. If the owner wants a *different* rule (a fixed window, a
  shorter floor, no version-after-next clause), that is a portal change with its own plan (§4 below), not copy.
- **"Redeem any time"** in the plan's ledger (D8, D22) means "no waiting period"; the pages now say "any time
  before the last day, while the bridge is not paused". Bring the ledger's words in line when the plan is next
  touched.
- **The forward rule's reason** is stated three times (the journal's held card, the taking-long dialog, the FAQ's
  rule 5) in slightly different words. One sentence, reused.
- **The old app's "last day has passed"** where the canvas said "no longer proves": a passed deadline is what the
  page knows. If the owner wants the canvas's line, the old app would need the rollup's proving status, which it
  cannot read.

## 4. Raising confidence to "high" (from the delivery report's table)

| leg | today | what raises it |
|---|---|---|
| Portal (Solidity) | high on tested paths | Fuzz and invariant tests on the cap's growth and the pause budget; `/harden security` on the portal and the miner's bridge functions; an external audit before mainnet. |
| Upgrade rig | high locally, moderate as a stand-in for Aztec | `all` on CI (item 1.2); one real testnet upgrade against the runbook (retire, continuation, the old origin's take-down: steps 7–10 have never run outside the rig). |
| Guided path | moderate–high | The MetaMask pass (2), the second-device restore (2), a real flip. |
| Versioned origin | moderate–high | The two deploys and a real passkey on both hosts (1.1). |
| Governance | EOAs | The Safe as the governance multisig with its signers and threshold (A4); the dedicated relayer key (1.3). |
| CI | high | A real-proving canary of the bridge functions (exit, claim from L1) beside the mining canary. |
| Design | high for composition, moderate for polish | The owner's eye over `fidelity.md` pairs and the preview; the MetaMask pass. |

## 5. Not built, by the plan's decisions

The relayer bot (forwarding stays by hand under a relayer key and the in-app self-forward); the hourly automatic
send-ahead of new wins (sends are manual, landing is one tap); an indexer (the pages read the portal's logs, at
most 120 blocks sampled); the mainnet fee path for claims (a fee-payer function ships, the sponsored FPC stays on
testnet); Sepolia-only rig runs; fixed denominations; the Safe (A4). Each is a plan of its own when its day comes.

## 6. Small things worth an hour

- `bridge register` writes the Registry index into the record; a record registered before this stack needs the
  one-off read (`registryIndexOf` over the registry, no key) — done for `testnet.json`, not for the older profiles.
- The screenshot tooling that produced `screens/` and the gallery (`shots-static.ts`, `compact.ts`, the job files)
  lives in a session scratchpad, not the repo. Commit a `scripts/shots/` if the pictures are to be refreshed again.
- The stats page's `Term` tooltip (hover + focus + Escape, `aria-describedby`) is local to `Bridge.tsx`; move it to
  `packages/ui` the first time a second page wants one.
- The rules' diagrams carry their geometry in code; the canvas that drew them is in the session scratchpad
  (`rules-canvas/gen.py`) and published at the design artifact. Commit the generator beside `canvas/` if the
  drawings are to be edited as drawings again.
- Four aztec nodes from the nulo worktrees were still running on the homelab at delivery (not this plan's).
