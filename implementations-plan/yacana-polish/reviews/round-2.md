# Review round 2 (2026-09-15): the brief v2 and the 79-board canvas

Reviewers: Codex (GPT-6 Astra, `xhigh`, the same session as round 1, resumed with 20 v2 renders attached;
`codex-2` is its reply) and a Fable 5.1 subagent (`fable-2.md`; it read the brief, the 79 renders, the portal,
the journal and the session). Both said **REVISE**. Every finding below was checked against the code before a
verdict; the third column says what v3 does. Verdicts: **accept** (v3 does it), **partial** (v3 does part, the
rest is a blueprint item), **reject** (with the reason).

## Codex, round-1 findings against v2

Codex marked 1 FIXED (7), 1 REGRESSED (5: the state table introduced a hashless retry, an arrival guarantee and
a queue), 14 PARTLY. The PARTLY residues, each closed in v3 unless noted: OldOriginQuiet's expired "held" row
(the board is now "V5 stopped proving", days after the flip, when the held row is still right; the last day is
a row state, §5.4 K2 closed) · §8's "safe once proved" (gone: a proven send still needs forwarding or
redeeming) · the observation clock (§9.3.1: the time comes from Ethereum, the proof event's block timestamp) ·
V6 as an unconditional destination (said once in §5.9: the portal forwards to the canonical registered later
version) · "a recovery file finishes this send" ("lets another device pick this send up"; §9.3.6 says what the
file carries and that a restore re-reads the chain) · the hashless retry, the arrival guarantee and the queue
(new findings 1, 2, 4 below) · login failures that infer unavailable facts and the PRF path (finding 7) ·
insufficient ETH (board ClaimNoEth) and the keyboard board (finding 6) · the pruned-claim sentence naming V5
("The claim's epoch wasn't proven in time") · Send's submission safeguards and the public-send advice
(finding 5) · "never throttles you" and the switch pausing mining (finding 9) · the unconditional "Mining
starts" footer (Opening2 is the Log in variant: "You can start mining when this finishes") · "closes anyway"
("anyone can close it") · the seed indices and the `default` chip (ink-3) · the fixtures (MineSent 1.2 tYACA,
the old origin's 14:12 send with its 14:52 deadline) · §9.1's storage policy and probe timing (moved to §9.2).

## Codex, new findings in v2

| # | Sev | Finding | Checked | Verdict · v3 |
|---|---|---|---|---|
| 1 | high | A missing hash does not mean unsent: `session.ts` `txByTag()` recovers it, `factReads` calls it when `!c.txHash`; expiring the record invites a duplicate transfer. | `session.ts:189`, the `tx` fact at line 292: confirmed. round-1.md's verification was wrong. | **accept**. K1/K2 get two states: `checking` ("The page closed while this was sent. Checking the chain for it.", no action) and `didn't finish` only once nothing is on the chain after the send's own expiry; §9.1.10 rewritten; §9.1.13 keeps "didn't finish" re-adoptable by tag. A K3 deposit whose prompt is gone no longer says "bridge again" (only `not sent` does). |
| 2 | high | "By 17:03 at the latest" reads as an arrival guarantee. | Wording. | **accept**. "Reaches Ethereum usually within the hour; then you claim it there. V5 must prove it by 17:03, or the balance comes back here." on every row, stepper and deck line. |
| 3 | high | The pause copy: `_pause` stacks from `pausedUntil` (a continuous pause can exceed 30 d within the 60 d budget); `unpause` refunds unused seconds (a computed deadline can move earlier); redeem is also gated by pause and headroom. | `YacanaPortal.sol:477–503`, `_requireOpen` on `redeem`: confirmed. | **accept**. The row: "Yacana can pause for 60 days in all over V5's life, and can lift a pause early." The held row's redeem: "while the bridge is open". §9.3.4: the floor never moves earlier, the computed date can; a shown date is re-read at every refresh. §9.2.14 lists what `deposit`, `forward` and `redeem` need. |
| 4 | high | "In order; nothing to do" invents a queue: `_requireOpen` checks headroom at execution. | Confirmed. | **accept**. "More has left V5 than its exit limit allows right now. The limit grows by the hour while V5 is current, and this turns ready to claim once it fits; others may use the room first." (K2: "waiting for the limit" before the flip, "over the limit" after it, since the cap freezes at the flip: closing pass 5). |
| 5 | high | Blur validation is insufficient; "or send publicly" suggests privacy fixes a wrong recipient. | `SendSheet.tsx` validates a snapshot and checks the recipient before submit: confirmed. | **accept**. The note ends "Confirm the address with the recipient before sending."; the address shows in full; §5.4: the code validates the exact submitted address, amount and mode and freezes the form while it proves; board SendErrors draws the four refusals. |
| 6 | high | PhoneKeyboard drops the summary rows. | `bridge_sheet(keyboard=True)` omitted them: confirmed. | **accept**. The sheet keeps every row and scrolls; the button is sticky above the keyboard. |
| 7 | medium | "Dismissed" and "no passkey here" are one WebAuthn error; `ChainViewHeldError` has no takeover. | WebAuthn privacy rule; `wallet.ts:99–117` (a blocked delete waits for the other connection): confirmed. | **accept**. Log in: "Sign-in didn't complete. No passkey was used. If this device has none for Yacana, log in where you created it, or enter your 12 words."; the held tab: "Close that tab, then retry here." **Retry**; the PRF failure at log in has its own note ("This device can't open your passkey… Open the account on the device or browser where it works", Try again: words would open a different account, closing pass 4). |
| 8 | medium | WalletReasons conflates unregistered, paused and closed; `deposit()` needs registration; `depositsClosed` is permanent. | `deposit` requires `v.registered && !v.depositsClosed`: confirmed. | **accept**. Three reasons: unregistered disables both bridges; "Deposits into V5 are closed for good."; a pause disables Bridge from Ethereum (`deposit` requires `!isPaused`, closing pass 1) and warns on the rest ("deposits wait until it lifts, and so do claims on Ethereum"). FromEthClosed reworded. |
| 9 | medium | "Your own node never throttles you" is false; `switchNodeLive` pauses mining; the proving chip's time is not evidence. | `switchNodeLive` → `c?.pause('switch')`: confirmed. | **accept**. The sentence is gone; "Mining pauses until it's done."; §9.3.1: the chip's time is the proof event's block timestamp on Ethereum. |
| 10 | medium | "Closes anyway" means `roll()` becomes callable; MineSent's 3.5 balance; OldOrigin's 14:03 deadline for a 14:12 send; "V5" in the pruned-claim sentence. | `escapeHatchIn` "seconds until anyone may roll": confirmed. | **accept**. "anyone can close it · in 4 min"; MineSent shows 1.2 tYACA; the old origin's send is due 14:52; the pruned claim names no version. |

Codex's three conditions for APPROVE (evidence-based states and deadlines; safe retry, Send and recovery;
the phone keeping the full summary) were re-checked by Codex on v3's renders: the closing pass at the end of
this file lists what v3 still got wrong and what v3.1 does about it.

## Fable, round-1 findings against v2

Fable: 18 FIXED, 4 PARTLY (4: headroom and the hashless row; 6: the two undecidable notes; 10: Presto's one
line for nine reasons; 13: "claims 2 of 4" beside "wins"), 1 NOT FIXED with the rejection accepted (21), 0
REGRESSED. All four PARTLY residues are closed by the new findings below.

## Fable, new findings in v2

| # | Sev | Finding | Checked | Verdict · v3 |
|---|---|---|---|---|
| 1 | high | "Until at least Mar 17" has no successor: once the floor passes with the version after next unobserved, the first call that observes it sets `deadline` to that block's timestamp, and V5 closes in that block. "Later if the next upgrade comes later" reads as time gained. | `deadline()` = later(afterNext, flip + floor) + paused; `_sync` writes `block.timestamp` for the observed index: confirmed. | **accept**. Four readings (§5.9, §9.3.4): pre-flip "for at least 180 days after the upgrade; after that, until the upgrade after V6 lands"; post-flip "until at least Mar 17 (…); after that day, until the upgrade after V6 lands"; the date once that upgrade is scheduled before the floor; past the floor with none, the red chip `could close any day` · "The 180 days are over. V5's exits close the day the upgrade after V6 lands. Claim it now." (K1 and K2 rows, boards States, ExitEdge, AheadRows). |
| 2 | high | OldOriginQuiet mixed "V5 stopped proving" (days after the flip) with "last day passed" (months later); the held row's redeem was offered after the real last day; the runbook has no recorded stop. | `docs/upgrades.md` "Then": the origin stays up until the deadline, then comes down; no stop step: confirmed. | **accept**. The board is "V5 has stopped proving. Nothing more can leave." with the held row and its redeem intact; K2 `closed` is a row state; §9.3.9 says the runbook lacks the step (add it, or the age rule). |
| 3 | medium | Headroom "in order; nothing to do": no queue; for kind 1 nothing goes through by itself. | As Codex 4. | **accept** (as Codex 4, with "this turns ready to claim once it fits"). |
| 4 | medium | `takingLong` counts from `updatedAt` (held-at), so a send held before the flip reads "longer than usual" while V6 does not exist; `TakingLongDialog` has the bug. | `bridge/copy.ts:161`: `now - c.updatedAt > 6 h`: confirmed. | **accept**. §9.1.12: the clock starts at the later of held-at and V6's `VersionRegistered`, runs only while `canonicalRegistered`; §5.9 says so beside the row. |
| 5 | medium | The account dialog's two undecidable notes; "Continue here" promises a takeover. | As Codex 7. | **accept** (as Codex 7). |
| 6 | medium | §9.1.10 expiring hashless records on load labels a real burn "didn't finish"; keep it re-adoptable by tag. | As Codex 1. | **accept** (as Codex 1; §9.1.13 for the re-adoption). |
| 7 | medium | MinePrestoFallback: one line for nine reasons; `causeText` has denied, cooldown, busy, invalid proof, update, encrypted; `noticeFor` has `downloading`, during which the pill has no ✦. | `presto.ts:150–215`: confirmed (eleven texts counting the probe's). | **accept**. Board PrestoReasons: a line per reason with Retry where it helps; "fetching its prover" is not a fault; the pill always says what proved. §5.3 and the deck carry them. |
| 8 | medium | WalletPhone keeps the desktop's two columns; the sentence wraps eight lines beside the chip. | The v2 render: confirmed. | **accept**. On the phone the row is one column: amount and sentence, then the chip and the time, then the trail. |
| 9 | medium | A missing board: V5's node goes away long before the deadline (runbook step 10); the old origin then fails before sign-in, and "Change node" has no answer. | `docs/upgrades.md` step 10 "once V5's node is gone": confirmed. | **accept**. Board OldOriginGone: "V5's node has shut down. Nothing more can leave from here." with "Open yacana.network"; no log in, no Change node; §9.3.10 asks for a served "node retired" flag so the page can tell it from a timeout. |
| 10 | medium | Rule 7's "a send is safe once V5 proves it" is false: a proven send can still end over the limit, paused or closed. | The table's own rows. | **accept**. Rule 7, §8, the Main and Disclosure boards: "a proven send still needs forwarding or redeeming before V5's last day". |
| 11 | low | Vocabulary: "on its way to Ethereum" vs "reaching Ethereum"; "arriving on V6" vs "arriving"; kind-2 rows inherit "Bridge again"; "claims 2 of 4" beside "wins". | Boards. | **accept**. One word per state: "reaching Ethereum", "arriving", "Send ahead again"; the epoch tile counts "wins". |
| 12 | low | The mining ledger's ✓ carries no "final once its epoch is proven". | Boards. | **accept**. The ledger's legend: "✓ minted, final once its epoch is proven". |
| 13 | low | "V5 didn't prove the claim's epoch" should name the claim's version. | The claim lands on the current version. | **accept**, version-neutral: "The claim's epoch wasn't proven in time, so the claim was undone." |
| 14 | low | K3 dropped: a deposit included after its deadline reverts and the gas is spent. | `deposit()` reverts on the deadline; the gas is paid. | **accept**. "No YACA left your wallet; if it was sent, the gas is spent." |
| 15 | low | The words login: a BIP39 checksum failure ("one is off") and a valid-but-wrong phrase opening an empty account. | `validateMnemonic`. | **accept**. Board WordsLogInChecksum; the empty-account hint in §5.1 and the deck. |
| 16 | low | NodeStates "Mining carries on". | As Codex 9. | **accept**. |
| 17 | low | Fixtures: MineSent's balance; MineFlipped's ledger "claiming" at 16:07 after the end at 14:02. | Boards. | **accept**. MineSent 1.2 tYACA; the ended cockpit's ledger is from before 14:02. |
| 18 | low | SendForm has no place for `review()`'s refusals; say "mining pauses while it proves". | `SendSheet.tsx` `review()`. | **accept**. Board SendErrors (four refusals under their fields); the form's footer "proves in your browser, about 20 s · mining pauses meanwhile". |
| 19 | low | ToEthProving's "Keep this tab open" is right; rule 5 says never. | Rule 5 said never "do not close". | **accept**. Rule 5 amended: "keep this tab open" only while the browser is still proving, never after a send. |
| 20 | low | A portal revert between the refresh and the transaction surfaces as the wallet's raw error; `revert.ts` names them. | There is no `revert.ts`; the names are in the portal ABI (`packages/portal/abi`). | **accept the fix, correct the source**: §9.2.15 maps the ABI's revert names to the row's sentences. |
| 21 | low | "Belongs to a different account" cannot arise: Open with passkey restricts `allowCredentials` to the stored id; Log in is offered only when nothing is stored. | `session.ts:346` `allow: [record.credentialId]`: confirmed. | **accept**. The dialog is replaced by the PRF-at-login note; §5.1 says why the case does not exist. |
| 22 | low | Pre-flip, "Mar 17" is 180 days after an announced date; the flip can move it. | Wording. | **accept**. Pre-flip copy has no date ("for at least 180 days after the upgrade"); the date appears once the flip is recorded. |

Fable's three conditions for APPROVE (the post-floor deadline state and the old origin split; the three
sentences against the contract and the session; the two undecidable notes and Presto's per-reason lines) are
all in v3.

## Self-review after v3

- Every "safe" is gone from the brief, the boards and the rules, including the meta text the reviewers found.
- Every date on a board is consistent with its fixture: the 17:03 deadline follows a 16:09 send in block
  83,131; the old origin's 14:52 deadline follows its 14:12 send; the flip is Sep 18 14:02; "could close any
  day" rows are dated Mar 18.
- The state table now has 25 rows (K1 14, K2 12, K3 7, plus the "as above" line) for the journal's 17 states:
  the extra rows are readings of one state (checking vs didn't finish; headroom before and after the flip;
  ready and held after the 180 days) that the page can tell apart from the portal's numbers.
- What v3 does not do, on purpose: the recovery file's format, the relayer's schedule, and whether Presto could
  prove the PXE's transactions stay in §9.3, for the blueprint.

## The v3 change list (generator and brief)

1. K1/K2 `checking` before `didn't finish`; the K3 deposit's prompt-gone sentence without "bridge again".
2. "V5 must prove it by 17:03, or the balance comes back here." everywhere; no "at the latest".
3. The pause copy from the contract; a pause only warns; redeem "while the bridge is open"; §9.2.14.
4. The exit limit without a queue; K2's own headroom and closed rows.
5. Send: the full address, "Confirm the address with the recipient", submit-time validation, SendErrors, the
   proving footer.
6. PhoneKeyboard keeps the rows; the button sticks above the keyboard.
7. AccountErrors: "Sign-in didn't complete", "Close that tab, then retry", the PRF-at-login note instead of the
   impossible "different account"; "dismissed or timed out".
8. WalletReasons: unregistered disables both bridges; deposits closed for good; the pause warns.
9. NodeStates: "Mining pauses until it's done"; no "never throttles you"; `default` in ink-3.
10. The epoch tile: "anyone can close it"; "wins"; the ended ledger from before the end; the ledger's legend.
11. Fixtures: MineSent 1.2 tYACA; the old origin's 14:52; Mar 18 for the post-floor rows.
12. The deadline's four readings, `could close any day` on K1 and K2 (States, ExitEdge, AheadRows), no date
    before the flip, the cliff explained in §5.9 and §9.3.4.
13. The old origin: "V5 has stopped proving" (the held row stays) and OldOriginGone.
14. `takingLong`'s clock (§9.1.12), the re-adoptable "didn't finish" (§9.1.13), the ABI revert mapping
    (§9.2.15), the proving chip's Ethereum timestamp (§9.3.1), the payer's ETH (§9.3.8), the recorded stop
    (§9.3.9), the node-retired flag (§9.3.10), the recovery file's contents (§9.3.6).
15. PrestoReasons; WordsLogInChecksum and the empty-account hint; Opening2 from Log in; the phone's one-column
    row; one word per state; rule 5 and rule 7 amended.

84 artboards, up from 79: ClaimNoEth, WordsLogInChecksum, PrestoReasons, SendErrors, OldOriginGone.

## The closing pass (Codex, round 3, on v3's renders)

Codex read v3 against its three conditions and said **REVISE** with six findings; each was checked and v3.1
applies all six. It was not re-reviewed after that: the owner's review of the canvas is the next gate.

| # | Sev | Finding | Checked | Verdict · v3.1 |
|---|---|---|---|---|
| 1 | high | A pause also stops deposits: `deposit()` requires `!isPaused`; "a pause disables nothing" was false. | `YacanaPortal.sol:422`: confirmed. | **accept**. WalletReasons: a pause disables Bridge from Ethereum and warns on the rest ("deposits wait until it lifts, and so do claims on Ethereum. A bridge to Ethereum can start now; its claim waits."); §9.2.14 rewritten. |
| 2 | high | After the floor, observing the next transition sets the deadline to that moment **plus paused seconds**, and `<=` admits that block; a schedule records nothing. | `deadline()`, `_requireOpen` `<=`: confirmed. | **accept**. "The next Aztec upgrade closes V5's exits, later only by the days the bridge was paused. Claim it now."; the third reading is "once the upgrade after V6 has landed", never "scheduled"; §5.9 and §9.3.4 say the deadline becomes the observation plus paused seconds. |
| 3 | high | "No log after expiry" needs evidence: `txByTag` returning nothing does not prove non-inclusion from a node that is behind; `Crossing` stores no expiry. | `journal.ts` `Crossing`: no expiry field: confirmed. | **accept**. §9.1.10: the record persists the enforced expiry before the send; "didn't finish" only when the node is synced past it with no log; otherwise "checking" stays, no retry. |
| 4 | high | The PRF-at-login note offered 12 words for a stored passkey account; words open a different account. | The stored record is a passkey account. | **accept**. "This device can't open your passkey. Its passkeys can't derive the key. Open the account on the device or browser where it works; the balance is unchanged." **Try again**; "Use a different account" through Sign out. |
| 5 | medium | K2's headroom row treated a frozen limit as a wait. | `cap()` freezes at the flip: confirmed. | **accept**. K2 has "waiting for the limit" before the flip and "over the limit" after, like K1; "It cannot be forwarded or redeemed." |
| 6 | medium | The phone sheet never names Sepolia and its keyboard variant drops How it works. | Boards. | **accept**. "To · Rabby · 0x90F7…b906 · Sepolia"; How it works stays in the scrollable form above the sticky button. |
