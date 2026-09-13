# Fidelity — the "Yacana Bridge Take Two" canvas against the built screens

The spec is `canvas/` (28 artboards as `.dc.html`, `canvas.json`, the `shot-*.png` of the seven the owner saw).
One row per artboard except `Main` (the canvas's start page, not a screen): the component(s) it maps to, what
changed in this pass, and the built screen's screenshot beside the artboard once the gate ran (P12, plan §6).
Copy rule: plan §6 P7's overrides win over the canvas (no relayer cadence, no hourly switch, "Send ahead",
redeem any time, the forwarding rule and its reason); everything else reads as drawn.

Shared vocabulary (`packages/ui`): `HeroCard` (the moment's card: eyebrow, title, body, trail, side column,
tone), `Trail` (the stations as chips or inline), `JournalCard` (a crossing in the wallet), `AmountBlock` +
`MaxChip` (a sheet's figure), `Stepper` (the vertical steps with their timings; `warn` added), `Note` (the
boxed aside), `Timeline` (a version's phases), `StackedBar` (where a version's coins are), `Kpi` (as before).

| artboard | component(s) | what changed | built screen |
|---|---|---|---|
| MineAnnounced | `web-miner/features/MigrationCard` (announced) on Mine | the hero card: eyebrow with the expected day, the title in two sentences, the body with the loss line, the four-station trail, the side column with the one large button, "some of it →" / "what happens, step by step →", the mining-continues line | pending |
| MineCommitted | `MigrationCard` (sent) | tone `ok`; "N sent ahead and proven. M mined since."; the trail with the held station on; the side with "Send M ahead now" (no automatic send: the switch is dropped per D12) | pending |
| MineFlipDetected | `MigrationCard` (flipped) | tone `warn`; "Mining here has ended. Send what is left ahead now."; the side with the button, the V5 last-block/last-proof line and the four vertical steps (V6 canonical · V5 retired · Yacana opens on V6 · the V6 app here) | pending |
| CommitSheet | `web-miner/features/SendAheadSheet` (form) | the eyebrow + two-sentence title, the amount block (all · some of it →), the four vertical steps with timings and notes, the privacy line, the "If V6 never opens" note (redeem any time, per D8/D22), Send / Not now, the loss line; no "Handle the rest for me" switch (D12) | pending |
| CommittedSheet | `SendAheadSheet` (sent) | "Sent ahead." with the amount block in `ok` tone (✓ burned in block N), the steps with the proving one on and its deadline, Done + "save a recovery file ⤓", the closing line | pending |
| V6Arriving | `web-miner/features/ArrivalCard` (on Mine, arriving) | a hero card: "N landed. M on its way.", the per-arrival steps, the four-station trail with "landing · 1 of 2 left", the progress bar, the "claiming · pause" status on the side and the v5 line; arrivals claim on a tap (D12): the side carries the Claim button when one is claimable | pending |
| V6Arrived | `ArrivalCard` (landed) | tone `ok`: "N landed.", the steps all done, the trail all done, the side with "Send what is left on V5 ahead ↗" and the v5 line | pending |
| ArrivalStates | `ArrivalCard` states + `web-miner/bridge/copy.ts` | one hero card per state with its trail: sent-unproven (deadline on the side), undone (`bad`, Send ahead again), waiting for Yacana, on its way (the plan's copy: forwarded by hand), arriving (claiming), arrived (`ok`), taking long (`warn`, Forward it myself), the exceptions (sponsor, paused, RPC silent, unknown, exit limit, landed elsewhere, lost) | pending |
| TakingLong | `web-miner/features/TakingLongDialog` | the dialog as drawn: eyebrow, title, the two columns (with an Ethereum wallet · from anywhere with the call to paste), the "last forwarded" line and Wait; the copy per D22 (no relayer: "Yacana forwards by hand") | pending |
| OldApp | `web-miner/features/Retired` + the old role's Mine | the one page: eyebrow, h1 "Send what is still here ahead.", the paragraph, the "still on v5" tile with the large balance and the one large button + "or to Ethereum", the advanced row | pending |
| OldAppSignIn | the old role's sign-in | the sign-in tile as drawn: "sign in · same passkey or words", Open with passkey, I have twelve words / Just look, the origin note | pending |
| OldAppCommitted | `Retired` (sent) | the "sent ahead" tile in `ok` tone: the amount block, the steps (not yet proven by V5 · by HH:MM …), the "nothing is left" line | pending |
| OldAppQuiet | `Retired` (quiet) | "V5 no longer proves. Nothing can leave.", the dead tile (`.dead`), the "proven in time · safe" tile | pending |
| OldTabNotice | `web-miner/features/OldTabNotice` | the announcement-style bar: "This tab is the old app." with Reload for V6 and the v5 link | pending |
| Wallet | `web-miner/routes/Wallet` balance tile + `BridgeTile` (empty) | Send / To Ethereum beside the balance; "Deposit from Ethereum →" on the balance tile's account row; the bridge tile's empty state ("nothing crossing") and its foot row (Deposit · Restore an exit from its file · YACA / portal links) | pending |
| WalletCrossing | `BridgeTile` (one crossing) | the journal card as drawn inside the bridge tile, "crossing · Sepolia" as the aside | pending |
| JournalStates | `BridgeTile` lines via `JournalCard` + `copy.ts` | every journal state as a journal card with its inline trail and tone: proving, proven · on its way, minted, taking long, deposit on its way, deposit arriving, paused, RPC silent, lost | pending |
| ToEthereum | `web-miner/features/ToEthereumSheet` (form) | title + sub, the amount block with max, the address field, the three vertical steps with their timings, Review + "Mining pauses while it is proved." | pending |
| ToEthereumReview | `ToEthereumSheet` (review) | "to ethereum · step 2 of 2", the amount block quiet with "→ 8.00 YACA", the kv rows (to, from, fees, time), the Public-on-Ethereum note, Send to Ethereum / Back | pending |
| ToEthereumSent | `ToEthereumSheet` (sent) | "On its way.", the amount block `ok` (✓ burned in block N), the steps (burned done · being proven on · minted todo), balance now, Done + the resumed line | pending |
| FromEthereum | `web-miner/features/DepositSheet` (connect) | the head, "Connect an Ethereum wallet" + the injected-wallets line, the one-transaction line (the plan's deposit is one tx) | pending |
| FromEthereumForm | `DepositSheet` (form) | the wallet chip with the YACA balance there, the amount block with max, the three steps (deposit · crossing · arrives on a tap), the Public-on-Ethereum note, the Deposit button | pending |
| FromEthereumPreFlip | `DepositSheet` (form, announced) | the warning box at the top: the expected version and that a deposit lands on V5 and needs sending ahead again | pending |
| FromEthereumSent | `DepositSheet` (sent) | "On its way.", the amount block with "→ N tYACA · private", the steps (deposited done · crossing on · arrives on a tap), Done | pending |
| StatsBridge | `web-stats/features/Bridge` + `bridge-beat` | the six KPI tiles, the dated phases timeline, the "where the coins are" chart, one version card per version with the stacked bar and the two kv rows, the portal panel (state · forwarded · waiting · exit limit · pause), the bridge-on-Ethereum panel (the keys, the rules) | pending |
| StatsAnnounce | `web-stats/features/Announcement` | the one-line bar as drawn (violet border, bold lead, the two links) | pending |
| LandingAnnounce | `web-landing/App` Announcement | the same bar above the hero | pending |
| FAQ | `web-landing/routes/Faq` + `copy.faq` | the page as drawn: the eyebrow + h1, three sections (Mining · When Aztec upgrades · To Ethereum and back), the six panels as the strip with the coin marks, the questions as two-column rows | pending |
