# Fable review 1 — the polish brief and canvas (2026-09-15)

**Verdict: REVISE.** The structure is right. The safety copy is not yet true to the portal and the journal, and a third of the crossing states have no sentence.

## Findings

1. **high · HowItWorks, Wallet held row, OldOrigin, OldOriginQuiet** — "Any time before V5's last day (Mar 12)" states a date the contract never commits to. `deadline()` is open (`uint256.max`) until both the flip and the version after next are observed, then the *later* of flip + 180 d and that activation, plus every paused second. A date can only move later; and 180 d after Sep 18 is Mar 17. Fix: "Any time until at least Mar 17 (180 days after the upgrade; later if the bridge pauses or the next upgrade comes later)". Never a bare day.

2. **high · OldOrigin hero, MineAnnounced, Disclosure** — "Your balance is safe here while V5 keeps proving" and "Your balance stays yours" reassure about a balance that is not safe: only a *send whose epoch V5 proves* is safe; what sits on V5 is lost the moment V5 stops, and the chip "V5 proving ✓ · last proof 12 min ago" speaks about the past. I found no read for that chip (the session reads the proven checkpoint number, not when it moved); the blueprint must add one or the chip is decoration. Fix: "Your balance can still leave while V5 keeps proving. V5 can stop at any time; send it now." Keep the chip, name its source in §9.

3. **high · SendAheadForm, MineAnnounced, SendAheadSent** — "Leaves V5 · within the hour" (no "usually") and "Lands on V6 · when you log in there, one tap" hide the forward. `docs/upgrades.md` §9: no cron, Yacana forwards by hand once V6 is registered; the holder can forward with an Ethereum wallet paying gas; `not-registered` exists. The Sent stepper goes Held → Lands with no forward step, so a user who logs into V6 the same day sees nothing and has no idea why. Fix: rows "Leaves V5 · usually within the hour" and "Lands on V6 · after Yacana forwards it, usually the day V6 opens; then one tap there"; a stepper step "Forwarded to V6 · by Yacana, or by you from V6".

4. **high · §5.4, ExitRows** — six journal states have no board and no sentence: `headroom` before the flip ("waiting for the limit", it goes through as the limit grows), `headroom` after the flip ("over the frozen limit", permanent), `closed` (last day passed: gone), `dropped` (never included: bridge again), `not-registered` (V6 live, Yacana not there yet: redeem), `forwarded` (in V6's Inbox, not claimable for a few minutes). Two of them are money-loss states. Add a `proving` row that survived a reload with no hash: the journal never moves it (`afterTx` needs `f.tx`). Fix: one row each on ExitRows; for the stuck proof, "Didn't finish. Nothing left your balance: bridge again" and §9 gets "expire hashless `proving` records on load".

5. **high · Welcome, §5.1** — "Use a different account" logs out first. For a 12-words account that is "not backed up" the record holds the only copy of the entropy; deleting it is silent loss. SignOut has the gate ("Back up my 12 words"); this path does not. Fix: route "Use a different account" through the Sign out dialog, same gate, same body.

6. **high · CreateError, Opening2/3** — one error screen ("prompt dismissed") for a flow with five distinct failures: the passkey cannot do PRF (`passkey.ts`: the account cannot be made with it, offer the words), no WebAuthn in this browser, the proving keys fail to download or fail their pin, the node silent or `429` during the sync (the dialog has no failed step), and "another tab holds this account" (`ChainViewHeldError`). Fix: an error table in §5.1, each as a note under the button or a failed checklist step with Retry; the PRF case switches the primary to "Use 12 words".

7. **medium · ClaimReady, ClaimWallet** — the claim needs the wallet on Sepolia (`ensureChain` prompts a switch) and Sepolia ETH; neither is on the board (research §3 names exactly this pitfall). "To · Rabby 0x90F7…b906" conflates the recipient fixed at send with the connected wallet: kind-1 forwards mint to the recipient whatever wallet pays. Fix: rows "To · 0x90F7…b906 (chosen when you bridged)", "Paid by · Rabby, in Sepolia ETH"; stepper step "Switch to Sepolia" when needed; error "Rabby rejected it. Nothing was claimed."

8. **medium · Wallet, FromEthForm, ExitRows** — today the buttons disable for reasons the redesign drops: the RPC silent or the version unregistered (to Ethereum), deposits closed the day before the flip or the portal paused (from Ethereum, `deposit()` requires `!isPaused`). Three equal buttons with no disabled reason, no "closed" form state, the RPC's "new withdrawals are held back" line gone, and `TakingLongDialog` (held > 6 h, the one nudge toward a silent RPC) dropped without a word. Fix: a one-line reason under a disabled button ("Deposits are closed until V6 opens" / "The Ethereum RPC isn't answering; bridging waits — Settings"); a held row past 6 h reads "Longer than usual. Forward it yourself from V6, or check the Ethereum RPC"; an `unknown` flip verdict gets "Can't read the upgrade's state (Ethereum RPC)".

9. **medium · HowItWorks** — "V5 must prove the epoch by 14:03" before the send: the epoch and its deadline exist only once the transaction is in a block. Fix: pre-send "within its epoch's deadline, about 40 min after the send"; the real time after.

10. **medium · MinePresto, MinePrestoBlocked, §5.3** — `presto.ts` has nine states (not approved for this site — the common first run —, cooldown, needs update, encrypted connection off, bb downloading, busy, invalid proof, stopped answering → browser fallback); the brief draws three, and the Presto row has no fallback state while the pill "follows what actually proved". §5.3 also contradicts itself: probe "at Start mining, never on load" but the not-installed billboard "after sign-in". Fix: probe at Ready; the row has three states — native, fixing (the `noticeFor` line + Retry), browser fallback; the pill drops ✦ on fallback.

11. **medium · Create** — the consent checkbox is drawn checked. Option 8 A keeps the checkbox; pre-checked it is theatre. Fix: unchecked, the button disabled until checked (Bazaar's).

12. **medium · V6FirstLogin, WalletEmpty** — a fresh device finds forwarded and deposited arrivals by scanning (`landing()`), but a held send needs the recovery file; "Nothing crossing yet" on V6 is then false for the user who sent ahead elsewhere. Fix: on a continuation with an empty journal, "Sent ahead from V5 on another device? It shows here once forwarded; until then, restore its recovery file."

13. **medium · Mine, Wallet** — "Send" (a private transfer) beside "Send 3.5 tYACA ahead" and "Sent from Rabby" during an upgrade: one verb, three destinations. "Claim" is the mining ledger's word ("claim in block 83,164"), the arrival's and the exit's. Fix: the transfer button "Send to an account"; mining claims become "wins" everywhere ("Wins · 12", "win minted in block …").

14. **medium · PhoneBridge** — the sheet drops "Visible on Ethereum" and "How it works": the privacy disclosure vanishes on the phone. Fix: the sheet scrolls; the rows are the same set.

15. **medium · OldOrigin, §5.9** — "forward it myself" is a dead action on the old origin (`BridgeTile.tsx:26`: forwarding happens from the live version only) and no Sign out exists there (Settings lists node, RPC, appearance, about; the account chip points at a Wallet the origin does not have). Fix: drop the link; an Account section with Sign out in the old origin's Settings, the chip opens it.

16. **medium · MineAnnounced** — "Mining continues here until the upgrade" without today's "wins after this need sending ahead too": the user sends the whole balance once and thinks they are done. Fix: the card re-offers "1.2 tYACA mined since — send those too" once something was sent.

17. **medium · ToEthForm, option 3** — one screen is right for the connected-wallet case; a *pasted* address goes to an irreversible burn with no second look. Fix: when the address was pasted, the chip shows the full checksum and a "not your connected wallet" tag; the button stays "Bridge 3.5 tYACA".

18. **low · ToEthSent, ClaimWallet, FromEthWallet, HowItWorks, NodeStates** — the step detail runs into its title ("Proven to EthereumThen you claim it there."). A render bug, but the canvas is the spec. Fix the generator before the blueprint reads it.

19. **low · MineMining** — the board draws the win ring at the step's x with its drop line through the step: the collision §5.3 says it fixes. Draw the fix.

20. **low · Nav, MineFlipped** — TESTNET in amber outline reads as a warning (rule 9: neutral); "Mining ended" as a filled uv button reads as an action. Fix: ink-2 outline; a pill.

21. **low · Words, WordsLogIn** — "Copy" on the seed while restore says "no clipboard reads": one threat model, two rules. Drop Copy or label it "Copy (less safe)".

22. **low · WalletPhone, Nav** — the phone loses Verify and the Wallet badge; buttons shorten to "To Ethereum" while the desktop says "Bridge to Ethereum". Keep the verb; badge the phone item.

23. **low · §8, Wallet row** — "Yacana's relayer" is jargon the user never meets elsewhere. Say "Yacana forwards it" on the row; define "relayer" once in How it works.

## What looks right

- Page-first arrival, Start mining in colour, Log in quiet; the lock screen for a stored account.
- One record slot, fail-closed create/login, `excludeCredentials`.
- The opening as a checklist with a determinate bar where bytes or blocks exist; "You can cancel and keep watching" instead of "do not close".
- One Activity list that finally holds deposits; the chips trail; the tab badge.
- The one-screen bridge with the amount on the button; one 440 px frame for every transaction.
- The in-place node edit with the old value live until the probe passes.
- Sign out as a plain dialog with the backup gate.
- The four-level ladder, and six host warnings collapsed to one line in About.
- "V5 didn't prove this in time. The balance is back here." — the right register.

## Complaints not answered

None is unanswered outright; four are answered only in name:

- **#6** — the MineMining board still draws the collision (finding 19).
- **#16** — answered by a bug note (§9.7) only; say it in the design: the transaction stepper never shows ✦.
- **#24** — the replacement copy reintroduces "safe" (finding 2).
- **#30** — "relayer" swapped in but never defined (finding 23).
