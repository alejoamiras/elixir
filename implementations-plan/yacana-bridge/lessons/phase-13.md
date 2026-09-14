# Phase 13 — the owner's copy pass (arc 6, branch `bridge-copy` on `bridge-fidelity`)

Why: the owner walked the arc-5 preview and the drawn-vs-built gallery (2026-09-14) and sent a list: the exit
sheet read as a hand-forwarded transfer, not as a bridge the user completes; the journal, the tile and the stats
page said "forward", "headroom", "the flip" and "the operators" where a user expects "claim", "the limit", "the
upgrade" and "the governance multisig"; the stats page had paragraphs where figures would do; the governance rules
sat on a stats page; versions were named by the rollup's number. A copy proposal and a "rules" design canvas went
back; the owner approved four picks (A claim on Ethereum, B the rules on the FAQ with diagrams, C names by
Registry index, D a sixth PR) and two rounds of canvas corrections (the multisig, the relayer, the upgrade; the
forward-rule diagram redrawn once it was shown to say the portal could target an old version, which it cannot).

## What landed

- **P13.1** (`da42872`) — versions by Registry index: `bridge.registryIndex` on the record, written by `register`
  and by the rig's `run.ts`; `VITE_VERSION_INDEX` from the site config; `versionName` / `ownVersionName` in
  `packages/site/src/browser/version-name.ts`; the miner's `versionNameOf(number, canonical)`; the stats page
  from the portal's `registryIndex`; the announcement lines. The testnet record's index (5) was read from the
  portal's registry over its public RPC and committed (`4cf59b9`), so the testnet build names itself V5.
- **P13.2** (`f1c23ad`) — the miner: "Bridge to Ethereum" / "Bridge from Ethereum" on the balance tile; the exit
  sheet as a bridge (burned · proven within the hour · claimed on Ethereum by you; fees and claimable rows;
  "Public on Ethereum."); the journal's words (ready to claim, claimed, waiting for the limit, last day passed)
  and the proof's ETA; "Claim on Ethereum" as a proven withdrawal's primary action through the held sheet (copy
  by kind); the tile's foot line only under a silent RPC or an announced migration; the taking-long dialog for a
  held send-ahead only, naming the authorized relayer instead of the pasted call (`forward-call.ts` removed);
  the old app says "last day". The rig's browser case claims the withdrawal through the test wallet from the
  card (`claim-ethereum` → `forward-go` → `forward-done`) instead of the operator's `ctl.forward()`; the shard
  keeps `ctl.forward()` for its chain-switch count.
- **P13.3** (`86549e8`) — `/stats/bridge`: one-line KPI subs ("on the way to Ethereum · burned here, not yet
  claimed there"; "N withdrawals claimed · M send-aheads held"); the version card as line, bar, launched, last
  day and one `<details>` for the exit limit's sentence; the portal panel as five rows (state, deposits,
  crossings, exit limit, pause) with `<abbr>` tooltips on the dotted words; the keys as chips (multisig, relayer)
  and "the rules →" to `/faq#rules`; the phases and coins tiles without their paragraphs; Verify's labels; the
  visual baselines re-captured; the stats e2e names the version by the card's `data-index`.
- **P13.4** (`4cf59b9`) — the FAQ's fourth section "The rules": six rows from `faq-copy.ts` (`FaqRule`: the
  question, one line with the policy's numbers, the diagram id, the reasons), each a native `<details>` whose
  summary is the line and the chevron ("how it works" / "less"), opening on the picture and the reasons; the six
  pictures in `features/RuleDiagrams.tsx` as inline SVG on the theme's fill/stroke tokens (the exit limit, the
  pause budget, a version's life, the forward rule, the three bridges) and one grid (who may do what), named by
  the build's version through `versionTrio()`, with a horizontal scroll under 640 px; "Who can stop it?" folded
  in, "What does Yacana hold?" moved in. The deck's vocabulary across the panels and questions.

## Decisions and their reasons

- **The proof's ETA is the one time promised.** The owner asked for "~1 h until proven and then claimable"; the
  plan's P7 rule (no relayer cadence, no hourly switch) forbade promising Yacana's timing, not Aztec's. The
  epoch's proof is Aztec's: the sheet says "within the hour", the journal "by HH:MM at the latest" once the
  deadline is known. The gallery spec's ban on "within the hour" went with it; its ban on "relayer" narrowed to
  the journal (the dialog names the authorized relayer on purpose).
- **Diagram prose is HTML, not SVG text.** The canvas's explanatory lines fit 880 px with V5/V6/V7; named by
  "this version" / "the one after" on a build without an index they overflowed the frame. The first build of
  the page showed it (the landing had been built before the record carried its index). Prose that wraps now
  sits under the picture as a paragraph; the pictures keep labels only.
- **`versionTrio()` falls back to words**, never to the rollup's number: `V1821665230 goes quiet` is what the
  first screenshot said.
- **The testnet record's index** was a one-off read (no key, the record's own public RPC, `registryIndexOf` over
  the registry); `register` writes it for every version from now on, so no operator command was added.

## Codex rounds (plan §10, the arc's diff against `bridge-fidelity`, GPT-6 Astra at `high`)

Session `01a0a085-2122-79f3-a096-3ccb9f5ec512`. Prompts and responses in the session scratchpad
(`codex-arc6-prompt.md`, `codex-arc6-followup-*.md`, `codex-arc6-round*.out`).

- **Round 1** — "request changes": 13 findings, 12 accepted, 1 partly (`80ee64e`). Real bugs: Stop during a
  claim dropped the phase to idle while the submission ran, so Start resumed mining and `drain` missed the
  claim (the flag is now set without a dispatch, a recovery test pins it); the rig's deposit step expected the
  picker after the claim had connected the wallet; "redeem any time" where the portal binds a redeem to the
  pause, the limit and the last day; "may leave now" on a paused or closed version; "send-aheads held" counting
  the Forwarded events; "nothing has crossed" ignoring deposits; the pause picture said forwards *into* the
  paused version; the claim sheet's wallet row carried the deposit's note; a `VV5` in the announcement; two
  stale comments and two stale words. Accepted with a change: `<abbr title>` is not an accessible tooltip —
  the dotted word became a button whose explanation opens on hover and focus. Weighed: the proof's deadline
  is now "its proof is due by HH:MM, or the burn is undone" (the estimate stays "usually within the hour").
- **Round 2** — "request changes": 5 findings, all accepted (`b38149b`). Stop still restarted through the
  claim's recovery paths (`readRebuilt` → `start()`, `pauseUntilFinal` → `resumeWhenClear`): both honour the
  flag now, a second test covers the reverted claim. The portal row judged "last day passed" on the device's
  extrapolated clock: Ethereum's clock at the read, like the card. Three sentences still promised ("within
  the hour", "claim it there any time" on `witnessed`, "nothing is lost"); the tooltip could not be hovered
  into or dismissed. On the naming question: no chain-derived crossing is later than a fresh canonical, but a
  recovery import has no ordering, so the fallback is "another version" and the comment asserts nothing.
- **Round 3 (the hard stop)** — two findings, both accepted (`ec7a4e5`): a hidden tab during a claim
  re-armed the restart Stop had cancelled (`pause()` now keeps the flag's word; the test hides and shows the
  tab around the claim's end); Escape could not close a tooltip opened by hovering (a document listener while
  it is shown, removed when it closes). The loop ends here per plan §10; nothing is left open from the review.
  What the rounds taught: a copy pass is not copy-only — "claim" as the user's own step moved a real
  behaviour (Stop during a claim) and the review found its three restart paths one at a time; and every
  "any time" a sentence promises has a gate in the portal worth naming.

## Gate

Green on `ec7a4e5` (2026-09-14), every run on the homelab, each e2e on its own isolated network:

- `bun run lint`; `typecheck` in site, ui, web-landing, web-miner, web-stats; `bun run test:components`
  (ui 12 files, landing 3, miner 20 / 94 tests, stats 12 / 84); `bun test` 457 tests across 98 files.
- The stats visual gate 8/8 in check mode against the baselines re-captured after round 1 (`c545cbc`); round 3
  changed only hidden tooltip markup.
- `E2E_PROVERLESS=1 E2E_SHARD=bridge` shard 1/1; `bun run rig -- browser` 3/3 with the withdrawal claimed
  through the test wallet from the card (`80ee64e`+); the stats, landing and site e2e and `bun run rig --
  origin` once before the review (`478f654`) and once after it (the tail run, `ec7a4e5`).
- Two gate failures on the way, both stale assertions: the wallet-connect helper expected the wallet's name
  where the account chip now stands (`478f654`); the rig's deposit step expected the picker after the claim
  had connected the wallet, and its held card the old sentence (`80ee64e`, `b38149b`).
