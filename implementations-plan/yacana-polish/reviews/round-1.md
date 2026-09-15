# Round 1 — the brief v1 and the 57-board canvas v1

Inputs: `brief.md` v1, `recon.md`, `research.md`, the renders of every artboard (`canvas/gen.py` → `render.ts`).
Legs: Codex (GPT-6 Astra, effort high, 20 renders attached; session `01a0a555-d714-73a3-b5e7-8c3786da31cf`,
transcript `codex-1.md`) and a Fable subagent on the full render set (`fable-1.md`). Both verdicts: **REVISE**.

## Codex — findings, checked against the code

| # | Finding | Verified? | Verdict |
|---|---|---|---|
| 1 | "Sends proven in time are safe" is false: `redeem` runs `_requireOpen` (deadline, pause, headroom); `deadline()` is `max` until the flip **and** the version after next are recorded, so "Mar 12" cannot be a fixed last day. | Yes — `YacanaPortal.sol` `deadline()`, `_requireOpen`, `redeem`. | **Accept.** Never "safe". The last day shows only once set; before that "no last day yet · not before <flip + 180 d>" (the floor is a true lower bound). Held rows carry the live deadline; a held send past it renders as `closed`. |
| 2 | "Safe here while V5 keeps proving", "stops for good", the green chip turn an observation into a guarantee; silence must read as unknown, not stopped. | Yes — FAQ: "keeps proving for hours or days, without notice of when it stops". | **Accept.** Chip: "V5 proved an epoch 12 min ago" / "no proof from V5 for 3 h" / "V5 stopped proving · Sep 21" only when the runbook's stop is recorded. Card: "then stops, without notice. A send it never proves comes back to V5." |
| 3 | Destination and delivery overpromised: `_forwardTarget` picks the canonical registered version (may skip V6); login alone does not claim; forwarding gives up the redeem. | Yes — `_forwardTarget`, runbook step 9, H7. | **Accept.** "lands on V6 when you log in" → "then you claim it on V6, one tap". "V6" is the expected destination. How it works names the relayer and says forwarding ends the Ethereum redeem. |
| 4 | Recovery file is demoted though the runbook says a device that never held a send needs it once V5's node is gone. | Yes — `docs/upgrades.md` step 10. | **Accept, scaled.** After a send-ahead on the old origin, the sent state offers "Save a recovery file" with the reason in one line; the old origin's footer keeps it. Not a primary action. |
| 5 | The copy deck omits `dropped`, `witnessed`, `headroom`, `closed`, `not-registered`; the pause row promises movement. | Yes — `journal.ts` has 17 states; the brief names 2. | **Accept.** A state table (kind × state → line, chip, action) in §5.4; an "every state" board for exits and one for send-aheads; growing vs frozen limit distinguished; the pause row says "until <date>". |
| 6 | "Every device" / "synced by your device" are unverifiable; `NoPrfError` exists; "use 12 words" implies words recover a passkey account. | Yes — `keys/passkey.ts`. | **Accept.** "on the devices your password manager syncs it to"; the tile says "passkey", never "synced"; three create errors (cancelled / this device can't make a Yacana passkey → words / no passkey here → the device that has it, or words if the account has them). |
| 7 | "Use a different account logs out first" can discard an unbacked account. | Yes — brief §5.1. | **Accept.** It opens the sign-out dialog (which warns when unbacked); the stored record is replaced only after the new account opens. |
| 8 | Gas prerequisites, network, and the phone's missing privacy line. | Yes. | **Accept.** "Gas: paid by that wallet, in ETH on Sepolia"; a wrong-network row with Switch; declined-in-wallet and no-ETH rows; the phone keeps "Visible on Ethereum"; "no fee" → "no fee · Yacana sponsors it". |
| 9 | A claim in a block can be pruned with its epoch (`recheckClaim`); "claimed" is not final. | Yes — `session.ts:521`. | **Accept.** "claimed" rows carry "final once its epoch is proven" until settled; a pruned claim returns to "ready to claim" with the reason. Same for the mining ledger's ✓. |
| 10 | The wallet's Send flow is absent from the pass. | Yes. | **Accept.** Send boards: form with the live summary, privately/publicly, the unknown-recipient note inline, sent. |
| 11 | Node silence, rate limiting, stale balances, a rebuild failing after a good probe; "sealed under a device key" hides what Stay open means. | Yes. | **Accept.** Row: "last block 12 s ago"; silent → "no answer for 2 min · Retry · Change"; rate-limited → its own line; switch failure returns to the previous node with the reason. Stay open: "Anyone who can use this browser could open and spend from this account without your passkey." |
| 12 | Opening: intent, cache loss, fake percentages, cancel semantics. | Partly. | **Accept, scaled.** Start mining → opening → mining starts. Bars only where bytes or blocks are known; other stages show elapsed time. Cancel before a transaction is submitted, close-and-track after. |
| 13 | Cockpit jargon: epoch, escape hatch, bar ×0.62, "Preparing the prover"; MineFlipped keeps a live slider. | Partly. | **Partial.** "epoch" stays (the whole product's word: stats, landing, FAQ). "escape hatch" → "closes anyway in 4 min"; "if it closed now" → "next bar if it closed now"; "Preparing the prover" → "Preparing your miner". MineFlipped loses the slider and "once you start". The ledger shows "claiming…" between ★ and ✓. |
| 14 | Stepper title/detail concatenate; active steps use completed wording; ink-4 text at ≈1.9:1. | Yes — `lib.py` `.step .t/.d` inline; `--ink-4` is 0.22 alpha. | **Accept.** Fixed the stepper; "Proving to Ethereum" while active; ink-4 only for placeholders and separators. |
| 15 | Options: the sheet needs keyboard/focus states; the phone drops Verify; 5/6/8 framed unfairly. | Partly. | **Partial.** A phone board with the keyboard up and focus return; Verify is reachable from Stats on the phone (say so). Option 6 gains C "hide the slider". Option 8 reframed: the checkbox is friction, not comprehension. |
| 16 | Fixtures: "4" vs five rows, timestamps out of order; §9 mixes defects and decisions. | Yes — `boards_wallet.py`. | **Accept.** Fixtures made consistent; §9 split into defects / decisions / capabilities. |

## Fable — findings, checked against the code

| # | Finding | Verified? | Verdict |
|---|---|---|---|
| 1 | "V5's last day (Mar 12)" is a date the contract never commits to; the floor is flip + 180 d = Mar 17 and the deadline can only move later. | Yes — `deadline()`. | **Accept.** The sentence everywhere: "until at least Mar 17 (180 days after the upgrade; later if the bridge pauses or the next upgrade comes later)"; the date once set. |
| 2 | "Safe here while V5 keeps proving" / "stays yours" reassure about a balance that is not safe; the chip "last proof 12 min ago" has no data source today. | Yes — the session reads the checkpoint number, not when it moved. | **Accept.** No "safe" anywhere; "Your balance can still leave while V5 keeps proving, and V5 can stop at any time"; the chip becomes "V5 proved an epoch 12 min ago" / "no proof from V5 for 3 h" / "V5 stopped proving · Sep 21", its source a §9.3 item. |
| 3 | Send-ahead hides the forward step; "within the hour" without "usually"; `not-registered` exists. | Yes — runbook step 9, `_forwardTarget`. | **Accept.** Rows "Leaves V5 · usually within the hour", "Then · held on Ethereum; Yacana forwards it into V6 (or you do, from V6)", "On V6 · you claim it, one tap"; the stepper gains "Forwarded into V6". |
| 4 | Six states have no sentence; a hashless `proving` row never moves (`afterTx` needs `f.tx`). | Yes — `journal.ts:135`. | **Accept.** The state table (§5.4, board States); ExitEdge and AheadRows boards; "didn't finish · Bridge again" for the hashless row, its expiry a §9.1 defect. |
| 5 | "Use a different account" can delete an unbacked words account silently. | Yes. | **Accept.** It opens the Sign out dialog with its gate. |
| 6 | One error screen for five failures (PRF, no WebAuthn, download, node silent/429, another tab). | Yes — `passkey.ts`, `ChainViewHeldError`. | **Accept.** The AccountErrors board (six notes) and two OpeningError boards; the PRF case makes the words primary. |
| 7 | The claim needs Sepolia and Sepolia ETH; "To · Rabby" conflates the fixed recipient with the paying wallet. | Yes — `ensureChain`, kind-1 mints to the recipient. | **Accept.** Rows "To · 0x90F7…b906 · chosen when you bridged", "Paid by · Rabby · in Sepolia ETH"; the switch as a state; the rejection as a red step. |
| 8 | The disabled reasons (RPC silent, unregistered, deposits closed, paused) and `TakingLongDialog` were dropped without a word. | Yes — `BridgeTile.tsx:160`, `DepositSheet.tsx:299`, `takingLong`. | **Accept.** WalletReasons board; FromEthClosed; the held row's "longer than usual" state with Forward from V6 / Redeem; "can't read the upgrade" for an unknown flip verdict. |
| 9 | "V5 must prove the epoch by 14:03" before the send: no epoch exists yet. | Yes. | **Accept.** Pre-send: "within its epoch's deadline, about 40 min after the send"; the real time after. |
| 10 | Presto has nine states; the brief draws three and contradicts itself on when it probes. | Yes — `presto.ts` `noticeFor`. | **Accept, scaled.** Probe once at Start mining (the owner's ask); the row has three states: native, fixing (the SDK's line + Retry), browser fallback with the slider back and the pill's ✦ gone (board MinePrestoFallback). |
| 11 | The consent checkbox drawn pre-checked is theatre. | Yes. | **Accept.** Unchecked; the button disabled until ticked; option 8 reframed as friction, not proof. |
| 12 | A fresh device's empty journal on V6 hides a held send that needs the recovery file. | Yes — runbook step 10. | **Accept.** WalletEmptyV6's hint line. |
| 13 | "Send" vs "send ahead" vs "sent from Rabby"; "claim" for mining and for bridges. | Partly. | **Partial.** The transfer dialog is titled "Send to an account."; the button stays "Send" (beside "Bridge…" it is unambiguous); mining "claims" become "wins" in the wallet and the ledger says "claiming" then "minted". "Epoch" stays. |
| 14 | The phone sheet drops the privacy row and How it works. | Yes. | **Accept.** The sheet carries the same rows and scrolls; PhoneKeyboard shows the keyboard case. |
| 15 | "forward it myself" is dead on the old origin (`holderMayForward` needs the live version); no Sign out there. | Yes — `BridgeTile.tsx:26`. | **Accept.** The link is gone; OldSettings has Account + Sign out; the chip opens Settings there. |
| 16 | After a send, wins mined since need sending too. | Yes. | **Accept.** The "sent" card offers "Send 1.2 tYACA ahead · 1.2 tYACA mined since" (board MineSent). |
| 17 | A pasted address goes to an irreversible burn with no second look. | Yes. | **Accept.** ToEthFormPasted: the full address, the "pasted · not your connected wallet" tag, "Check every character…". |
| 18 | The stepper concatenates title and detail. | Yes. | **Accept.** Fixed in `lib.py`. |
| 19 | MineMining still draws the collision it claims to fix. | Yes. | **Accept.** The ring sits at the proof's x, right of the step, its drop ending above the bar. |
| 20 | TESTNET in amber reads as a warning; "Mining ended" as a filled button reads as an action. | Yes. | **Accept.** A neutral tag; the ended state is a pill and a header, no button. |
| 21 | "Copy" on the seed vs "paste off" in the confirm. | Partly. | **Reject.** Paste is off only in the confirm-by-typing step; Copy stays because password managers are where phrases live (MetaMask, Rainbow offer it). Documented in §5.1. |
| 22 | The phone loses Verify and the Wallet badge; the buttons shorten. | Yes. | **Accept.** Verify is a tab inside Stats on the phone (said on Nav); the badge on the tab item; "Bridge to Ethereum" stays a verb. |
| 23 | "Yacana's relayer" is jargon. | Yes. | **Accept.** Rows say "Yacana forwards it"; How it works defines the relayer once. |

Complaints answered only in name (#6, #16, #24, #30): all four now drawn or said (MineMining; the stepper's "in your browser; Presto proves only mining work"; no "safe"; the relayer defined).

## Self-review of the renders

- The stepper's detail ran into its title on every board with a detail (HowItWorks, NodeStates, ToEthSent, ClaimWallet): fixed in `lib.py`.
- "proved › … › proven to Ethereum" mixes two words for two different proofs; retail users cannot tell them apart. Trail vocabulary becomes: sent · in a block · on Ethereum · claim.
- "What was still here is gone" (OldOriginQuiet) overstates: nothing can leave, the notes are not erased. → "What was still here can no longer leave."
- "Whole balance by default" under the Send-ahead amount is a designer's note, not UI: dropped.
- "Move out" as the old origin's tab reads like an eviction: → "Send ahead".
- The announced-upgrade card is four sentences; the second half repeats How it works: cut to two.
- Welcome's "passkey · synced" chip: "synced" claims what the page can't know.

## The v2 change list

1. Copy: no "safe"; "usually" on every usual time; the deadline sentence; the forward step; the relayer defined once; "Yacana forwards it".
2. States: the table of seventeen states with chip, sentence, action (§5.4, board States); ExitEdge, AheadRows, WalletReasons boards; "didn't finish", "longer than usual", "waiting for Yacana", "can't read the upgrade".
3. Account: six failure notes; the checkbox unchecked; "Use a different account" through Sign out; "passkey", never "synced"; the words error.
4. Opening: "Preparing your miner"; two failure boards; "Mining starts when this finishes".
5. Claim: To (fixed at the send) / Paid by (Sepolia ETH) / Then; the network switch; the rejection.
6. Send: four boards in the transaction dialog.
7. Bridge to: the pasted-address state; the proving step says "in your browser".
8. Bridge from: the closed state.
9. Mine: the chart's ring beside the step; "closes anyway"; the ledger's "claiming" and "minted"; the Presto fallback row; the ended cockpit; the "sent" upgrade card with wins mined since.
10. Old origin: "Send ahead" tab; the silent state; OldSettings with Sign out; no forward link; the quiet copy.
11. Settings: Stay open said plainly; silent, throttled and failed-rebuild rows.
12. System: the stepper fixed; ink-4 for placeholders only; the testnet tag neutral; the phone sheet with every row and the keyboard case; the Wallet badge on the phone.
13. The brief: §9 split into defects, decisions, capabilities.
