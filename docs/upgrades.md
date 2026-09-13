# The day Aztec moves on: the runbook

Aztec ships a new rollup version; the Registry names it canonical (the flip); the old version keeps running for
a while, then its operators stop it. Yacana's miner is deployed per version; balances move between versions
through the portal (`docs/bridge.md`). This is what the operators do, in the order the upgrade rig runs it:
`bun run rig -- migration` (`packages/harness/tests/migration.bun.test.ts`) is the executable form of the chain
side below, `bun run rig -- browser` the holder's side through the page, `bun run rig -- all` every case.

Every write here is `bun run bridge -- <command>` with `YACANA_L1_PRIVATE_KEY` in the shell (the operators key;
for `forward`, the listed forwarder's key, kept in the shell as `YACANA_L1_FORWARDER_KEY` and passed as
`YACANA_L1_PRIVATE_KEY=$YACANA_L1_FORWARDER_KEY`), `YACANA_RECORD` pointing at the version's record, and the
record's RPC or `YACANA_L1_RPC_URL`. Reads (`status`) need no key. Keys are never on a command line, never in
the repo, never echoed.

## Once: the bridge

0. **Deploy and list.** `bun packages/deploy/scripts/l1-deploy.ts deployments/<profile>.json` writes the record's
   `bridge` block (`docs/bridge.md`, "The record"); `bun run bridge -- register` puts the profile's version on the
   portal; `bun run bridge -- set-forwarder <address> on` lists the forwarder key's address. The miner is deployed
   with `YACANA_PORTAL` set to the portal, so a portal comes before its first miner.

## Before: Aztec announces V6

1. **Announce.** Add the `migration` block to `deployments/<profile>.json` (`toIndex`: the Registry index V6 will
   take, the current canonical index plus one; `announcedAt`; `expectedFlipAt`, unix seconds, Aztec's word as
   given) and redeploy the site (a push to `main`, or `bun run site:deploy`). Announcing is a redeploy: the
   miner's migration card, the stats pages and the landing carry the line from the build's record. Nothing on
   chain changes.
2. **Watch.** `bun run bridge -- status` reads every registered version's standing: registered miner, flip,
   pause, headroom, deadline, deposits. The stats bridge page is the same read for everyone.

## The day before: close deposits into V5

3. `bun run bridge -- close-deposits <V5>` (one-way). A deposit into a version about to stop would strand its Inbox
   message; the miner's deposit sheet reads the portal and refuses before it asks the wallet.

## Minute one after the flip

4. `bun run bridge -- note-transitions`: the portal records the Registry's new index as observed now. The cap of
   V5 freezes at that moment and its deadline clock starts; until this call the cap keeps growing, which is why
   it is the first thing after the flip (any state-changing portal call would record it too).
5. `YACANA_RECORD=deployments/<v5 profile>.json YACANA_DEPLOYER_SECRET=… bun run bridge -- retire <V5>`: the
   retire message into V5's Inbox (once; a rerun reports the index it already sent), then the miner consumes it on
   the record's node, after which no claim mints on V5. Without the secret the command sends the message and
   prints the second step. The miner's page sees the flip through the Registry and stops mining before the message
   lands; the retire message makes it final.

Holders who have not sent ahead can still do so: V5 settles epochs until its operators stop it, and a send-ahead
after the flip lands like any other once its epoch is proven (rig case H4). The page says what is lost and when.

## Deploy V6

6. `YACANA_CONTINUE_FROM=deployments/<v5 profile>.json YACANA_PORTAL=<portal> AZTEC_NODE_URL=<V6 node>
   YACANA_DEPLOYER_SECRET=… bun run deploy`: the V6 miner as V5's continuation (it starts at the epoch V5 left off,
   with V5's last target), bound to the same portal. The record is `deployments/<v6 profile>.json`.
7. `YACANA_RECORD=deployments/<v6 profile>.json bun run bridge -- register`: V6 on the portal, with its miner and
   the record's launch time. Write-once; the portal accepts a launch time from a week behind to 90 days ahead of
   the registration, so register within the week after the deploy. From here the portal forwards held sends into
   V6.
8. **The apex, the old origin.** Deploy the V6 site to the apex (`bun run site:deploy`); build the V5 record's last
   commit with `YACANA_APP_ROLE=old bun run site:build` (into `packages/site/dist-old`) and deploy it to the
   `yacana-v5` Worker (`packages/site/v5/wrangler.jsonc`: `v5.yacana.network`). An open V5 tab learns from
   `build.json` that it is behind and asks for a reload. The old origin restores accounts (never creates one),
   sends ahead and exits; mining there has ended. Keep it up until V5's deadline has passed, then take it down.

## Forward

9. `YACANA_L1_PRIVATE_KEY=$YACANA_L1_FORWARDER_KEY bun run bridge -- forward deployments/<v5 profile>.json
   deployments/<v6 profile>.json [--batch 20]`: every settled exit is archived to
   `deployments/witnesses/<v5 profile>.jsonl` first, then every held send-ahead is forwarded into V6 (the target
   record names the miner the portal must route to; a mismatch holds every send-ahead) and every exit to
   Ethereum. Rerun as later epochs settle; `--from-archive` once V5's node is gone. Holders may forward their own
   from the V6 page, or redeem to Ethereum instead; nothing waits on Yacana.
10. **The witness archive.** Commit `deployments/witnesses/<v5 profile>.jsonl` and redeploy the site: it is served
    at `/witnesses/<V5 version>.jsonl`, and a holder's page on V6 reads an old send's witness from there once V5's
    node is gone.

## Then

- V5's deadline: the later of the version after next's observed activation and 180 days after the flip, plus
  paused seconds. `status` shows it. After it, nothing leaves V5; take the old origin down.
- The rehearsal: every step above runs on a preview deployment first (`docs/deployments.md`: the branch alias is
  a preview host with its own passkeys; a version of the `v5` Worker serving the frozen record proves the role
  and the headers). Production deploys (the apex, the `v5` custom domain) happen after the merge, never from a
  branch.

## What each step exercises on the rig

| step | command | rig case |
|---|---|---|
| list a forwarder | `set-forwarder` | the run helper every browser e2e uses (`packages/deploy/src/bridge/run.ts`) |
| register | `register` | every case; `skip-version.bun.test.ts` (H7: a version Yacana never registers is skipped, the send lands on the next) |
| close deposits | `close-deposits` | `deposit.bun.test.ts` (H2: a deposit lands where it named; after the close the next is refused) |
| observe the flip | `note-transitions` | `migration.bun.test.ts` (H3), `skip-version.bun.test.ts`, `never-settled.bun.test.ts` (H5), `browser.bun.test.ts` |
| retire | `retire` (L1, then L2) | `migration.bun.test.ts` (H3: no claim mints after; a rerun resumes), `browser.bun.test.ts` |
| pause | `pause`, `pause-all`, `unpause` | `bridge.bun.test.ts` (H9: held exits, the budget charged), `migration.bun.test.ts` (`pause-all` reaches every version) |
| forward | `forward` | `migration.bun.test.ts` (H11: a stranger refused, a wrong target held, the forwarder and the holder accepted, all from the archive with the source node gone), `bridge.bun.test.ts` (H1, H6, H10), `never-settled.bun.test.ts` (an unproven epoch forwards nothing) |
| the holder's side | — | `browser.bun.test.ts` (V5, the flip, V6 through the page), `origin.bun.test.ts` (one passkey across the apex and the old origin) |
