# Research digest — the patterns the redesign follows (2026-09-15)

Web research by a Fable subagent (no code read). Every claim carries its source. The ten rules at the top are
the ones the brief adopts; §1–8 hold the patterns, the recommendation for Yacana and the pitfalls.

## The ten rules

1. The passkey is the account: one tap on "Create account" opens the OS passkey sheet; the 12-word phrase is a
   text link under it, never a peer button (Coinbase Smart Wallet, Family, Phantom all demote it).
2. A returning device sees "Welcome back → Sign in with a passkey" as the only primary; the create/sign-in
   chooser appears only when no credential exists here (FIDO/Google).
3. Nothing under 1 s gets an indicator; 2–10 s gets a spinner or skeleton; anything longer (the 20–60 s sync)
   gets named stages, a count ("2 of 3"), a soft time expectation and a non-blocking layout (NN/g).
4. Waiting copy describes work being done for the user (labor illusion); it never contains "please wait", "do
   not close" or an exclamation point.
5. Bridge = one review step (amount, route, fee, time, destination) with a verb-named button; after submit, a
   stepper with per-stage ETA and explorer links that lives on the Wallet page, not in a modal (Across, Uniswap,
   Superbridge, NN/g).
6. Claims, "send ahead" and deadlines are cards on Wallet with a count badge on the tab; deadlines are absolute
   + relative and phrased "on or before" / "11:59pm" (Arbitrum, Superbridge, GOV.UK).
7. Mention a risk only next to the control that removes it; critical banners are rare and non-dismissible only
   when truly critical; "sorry" only for data loss (Polaris, GOV.UK, Mailchimp, Microsoft).
8. Node/RPC URLs: single-field inline edit, probe on Save, inline error under the field, keep the last working
   value until the probe passes; reconnecting is a quiet status word, not a red bar (MetaMask, Rabby, Rainbow).
9. Five destinations max, icon + always-visible label on phone, text tabs on desktop, logo top-left links home,
   "Testnet" as a neutral tag (Material 3, Apple HIG, NN/g, GOV.UK).
10. Sign-out for a passkey account is a plain confirm dialog whose title states the consequence and whose button
    repeats the verb; hold-to-confirm is not worth its keyboard/motor cost (NN/g, WCAG 2.5.2).

## 1. Passkey-first onboarding

- FIDO's two required patterns are "Sign In with a Passkey" and "Create, View, and Manage Passkeys in Account
  Settings"; a dedicated "Sign in with a passkey" button should sit "alongside recognizable Sign in with Google
  or Sign in with Apple buttons", and fallback must "allow people to enter another identifier to sign in or
  create an account" — [Passkey Central required patterns](https://www.passkeycentral.org/design-guidelines/required-patterns/),
  [Sign in with a passkey](https://www.passkeycentral.org/design-guidelines/required-patterns/sign-in-with-a-passkey),
  [FIDO 2023 PDF](https://fidoalliance.org/wp-content/uploads/2023/05/FIDO-Alliance-UX-Guidelines-for-Passkey-Creation-and-Sign-ins.pdf).
- Google: "rich descriptive prompts" (illustration, headline, message, CTA); the FIDO icon "in buttons or links
  allowing users to sign in with a passkey"; describe passkeys as "your fingerprint, face, or screen lock" —
  [UI design](https://developers.google.com/identity/passkeys/ux/user-interface-design),
  [Communicating passkeys](https://developers.google.com/identity/passkeys/ux/communicating-passkeys),
  [User journeys](https://developers.google.com/identity/passkeys/ux/user-journeys).
- Single-account rule: "Prevent creating duplicate passkeys for the same passkey provider using
  excludeCredentials" — [web.dev checklist](https://web.dev/articles/passkey-checklist).
- Apple: "one-step account creation and sign-in using Face ID or Touch ID" — [developer.apple.com/passkeys](https://developer.apple.com/passkeys/).
- Wallets: Coinbase Smart Wallet "Create a smart wallet" → "Sign up" → OS passkey sheet; sign-in on any device
  by "email passcodes, passkeys, or a recovery phrase" — [walkthrough](https://splits.org/changelog/coinbase-smart-wallet-passkeys/),
  [Coinbase help](https://help.coinbase.com/en/wallet/getting-started/smart-wallet-passkeys). Family: "just a phone
  number or email", then "add a passkey or password" — [family.co](https://family.co/blog/family-accounts). Phantom:
  "Create a New Wallet" vs "I already have a wallet"; "Continue with Apple/Google/Email" first, "Create a
  Recovery Phrase Wallet" last — [Phantom help](https://help.phantom.com/hc/en-us/articles/8071074929043-Create-a-new-wallet-in-Phantom).
  Rainbow: "Create a new wallet" — [Rainbow](https://rainbow.me/support/extension/get-started-with-the-rainbow-extension).
  Obsidion (Aztec): "passkeys, Google, or Apple with no seed phrases" — [obsidion.xyz](https://obsidion.xyz/) (low confidence).
- Recommendation: first run shows "Create account" (primary) and "Sign in" (secondary); "Create account" opens the
  passkey sheet immediately; "Sign in" shows "Sign in with a passkey" plus a link "Use a recovery phrase
  instead". A device with a stored credential skips the chooser: "Welcome back" + one primary + "Use a different
  account". One account at a time; block a second passkey on the same provider.
- Pitfalls: a username field just to enable autofill; "passkey" as jargon without the biometric association; the
  phrase as an equal path; no recovery statement at creation.

## 2. Loading and progress

- 0.1 s / 1 s / 10 s limits; beyond 10 s "they should be given feedback indicating when the computer expects to
  be done" — [NN/g response times](https://www.nngroup.com/articles/response-times-3-important-limits/).
- Looped animation for 2–10 s, percent-done for ≥10 s; "show step counts instead of percentages when durations
  are unpredictable"; estimates like "This might take at least a minute"; label the work; offer a way to stop;
  never static "Loading…" — [NN/g progress indicators](https://www.nngroup.com/articles/progress-indicators/).
- Skeletons for full-page loads under 10 s, spinners for a module, progress bars for process-like waits over
  10 s — [NN/g skeleton screens](https://www.nngroup.com/articles/skeleton-screens/).
- People "prefer websites with longer waits to those that return instantaneous results" when effort is shown —
  [Buell & Norton, The Labor Illusion](https://ideas.repec.org/a/inm/ormnsc/v57y2011i9p1564-1579.html).
- An indicator "can switch from an indeterminate to a determinate state" — [Material 3 progress](https://m3.material.io/components/progress-indicators/guidelines).
  "Above all else, you don't want to scare off the user" — [Microsoft writing style](https://learn.microsoft.com/en-us/windows/apps/design/style/writing-style).
- Recommendation for the 20–60 s sync: a stage list with a checkmark per stage, a "Step 2 of 3" counter, "Usually
  under a minute" once, neutral colour, navigation left open.
- Pitfalls: a bar that races to 90 % then hangs; a spinner past 10 s; skeletons for a 40 s wait; copy that reads
  as a warning ("Do not close this tab"); one "Loading" hiding the stage names.

## 3. Bridge and transfer flows

- Across: Connect Wallet → chains → amount (max "shown automatically") → review of "the estimated fees and
  bridging time" → "Confirm transaction" → wallet popup → status tracker — [Across guide](https://across.to/blog/crypto-bridging-made-simple).
  Uniswap: "Review" shows estimated fee and time, then "Approve and swap", then confirm in wallet, then track in
  the activity section — [Uniswap support](https://support.uniswap.org/hc/en-us/articles/31092864580877-How-to-bridge-tokens-using-the-Uniswap-web-app).
- Claim-on-destination: Arbitrum shows a countdown, the withdrawal sits under "Transactions" with a "Claim"
  button, and warns you need ETH — [Arbitrum quickstart](https://docs.arbitrum.io/arbitrum-bridge/quickstart). OP Stack:
  initiate → prove → 7-day window → finalize — [Optimism](https://www.optimism.io/blog/increasing-confidence-in-the-op-mainnet-bridge-with-two-step-withdrawals);
  Superbridge names the three transactions and puts "Finalize" in the activity feed — [Superbridge help](https://help.superbridge.app/en/articles/9748050-how-to-bridge-off-a-rollup-to-the-settlement-chain-withdraw).
  StarkGate: "Complete transfer" on Ethereum, or a relayer does it for a fee; history in the wallet widget —
  [StarkGate](https://www.starknet.io/blog/simple-guide-on-starkgate-1-click-withdraw/), [Argent X](https://support.argent.xyz/hc/en-us/articles/15068405381277-Withdrawing-assets-from-Argent-X-using-Starkgate).
- Status vocabulary: PENDING / DONE / FAILED with sub-statuses and an explorer link per crossing — [LI.FI status](https://docs.li.fi/li.fi-api/li.fi-api/status-of-a-transaction).
  MetaMask's "Activity" tab with "speed up"/"cancel" in the detail — [MetaMask help](https://support.metamask.io/manage-crypto/transactions/how-to-speed-up-or-cancel-a-pending-transaction/).
- Connect wallet: EIP-6963 announce/request with name, icon, rdns so a dapp can "populate a user-friendly wallet
  selection modal" — [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963); wagmi's `multiInjectedProviderDiscovery` —
  [wagmi](https://wagmi.sh/react/api/createConfig); RainbowKit lists them under "Installed" — [RainbowKit](https://rainbowkit.com/docs/custom-wallet-list).
- Container: "if it requires multiple steps to begin with, it probably justifies dedicating a full page to it" —
  [NN/g modal vs nonmodal](https://www.nngroup.com/articles/modal-nonmodal-dialog/); wizards show the steps and use
  descriptive labels — [NN/g wizards](https://www.nngroup.com/articles/wizards/).
- Recommendation: one review screen (amount, from → to, destination, fee, time, one verb button); after submit a
  crossing card on Wallet with a 3–4 stage stepper, per-stage ETA, explorer links and the "Claim on Ethereum"
  button in the card; the Wallet tab carries a count badge. "Connect wallet" is one button opening an EIP-6963
  picker, with a "Switch network" step when needed.
- Pitfalls: needing ETH for the claim discovered at the wallet popup; a stepper of contract calls; status only in
  a toast; two confirmations; the claim living on a page the user does not revisit.

## 4. Progressive disclosure and safety copy

- "Initially, show users only a few of the most important options"; beyond 2 disclosure levels usability drops —
  [NN/g](https://www.nngroup.com/articles/progressive-disclosure/), [IxDF](https://ixdf.org/literature/topics/progressive-disclosure).
- Banners: critical tone "thoughtfully and sparingly", dismissible "unless they contain critical information" —
  [Polaris Banner](https://shopify.dev/docs/api/app-home/web-components/feedback-and-status-indicators/banner).
- Warning text only for "legal consequences of an action, or lack of action" — [GOV.UK warning text](https://design-system.service.gov.uk/components/warning-text/).
  Deadlines: "on or before", "11:59pm" — [GOV.UK style](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/style-guides/a-to-z-style-guide/).
- "Sorry" only for data loss, blocked use, or needing support — [Microsoft](https://learn.microsoft.com/en-us/style-guide/a-z-word-list-term-collections/s/sorry).
  "Never use exclamation points in failure messages or alerts" — [Mailchimp](https://styleguide.mailchimp.com/grammar-and-mechanics/).
  Tone varies "based on the situation" — [Apple HIG Writing](https://developer.apple.com/design/human-interface-guidelines/writing).
- Stripe writes irreversibility as flat facts: "A PaymentIntent can't be canceled after it has succeeded" —
  [Stripe refunds](https://docs.stripe.com/refunds).
- Recommendation: funds-held and migration states in a fixed order — fact, what happens next, the one action.
  Risk only beside the control that removes it; the exit limit as a bar; irreversibility one sentence in the
  review; secondary mechanics one level down under "How this works".
- Pitfalls: red banners for scheduled events; "Warning" on things the user cannot act on; three-level
  disclosure; relative-only deadlines; reassurance that overstates ("your funds are safe") when the honest state
  is "held until X".

## 5. Settings and RPC editing

- MetaMask: RPC URLs per network, "Add RPC URL" → URL + nickname → Save; probe error "Could not fetch chain ID.
  Is your RPC URL correct?" — [MetaMask help](https://support.metamask.io/configure/networks/how-to-add-a-custom-network-rpc/),
  [issue #13167](https://github.com/MetaMask/metamask-extension/issues/13167). Rabby: Custom RPC → paste → Save;
  one-click enable/disable — [QuickNode guide](https://www.quicknode.com/guides/ethereum-development/wallets/how-to-set-a-custom-provider-in-rabby).
  Rainbow: Settings → Networks — [Rainbow](https://rainbow.me/support/extension/custom-networks-on-the-browser-extension).
- Inline edit "switches between reading and editing on the same page" — [Atlassian](https://atlassian.design/components/inline-edit/usage);
  errors "close to the error's source" — [NN/g](https://www.nngroup.com/articles/error-message-guidelines/).
- Connection states need a word each; debounce a reconnecting banner; keep last-known data visible —
  [SSE connection-status guide](https://www.server-sent-events.com/frontend-consumption-client-patterns/error-handling-and-reconnection-ux/showing-connection-status-in-the-ui/).
- Recommendation: two rows (Aztec node, Ethereum RPC), a read view with "Edit" and a "Use default" chip; Edit
  reveals one field plus Save/Cancel; Save probes and shows the result under the field; the previous value stays
  active until the probe passes; "Custom" tag with one-click revert.
- Pitfalls: validating syntax but not the endpoint; switching before the probe; a red bar on a 2 s hiccup;
  hiding the default.

## 6. Navigation for 4–5 destinations

- "Navigation bars can have three to five destinations" — [Material 3 navigation bar](https://m3.material.io/components/navigation-bar/guidelines).
- Apple: "Use a tab bar to support navigation, not to provide actions"; "Include tab labels … Use single words";
  avoid "More"; five or fewer — [Apple HIG tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars).
- Logos link home; left-aligned logos are "6 times more likely" to get users home in one click — [NN/g](https://www.nngroup.com/articles/homepage-links/).
- Environment badges: GOV.UK's phase banner tag + one sentence — [phase banner](https://design-system.service.gov.uk/components/phase-banner/).
- Recommendation: desktop top bar with logo (home), text tabs, the node status word, a neutral "Testnet" tag;
  phone bottom bar with icon + always-visible label. The old origin gets a phase-banner-style line on every page.
- Pitfalls: a sixth destination; icon-only tabs; hiding the bar during a claim; a red "Testnet"; the old origin
  looking identical to the new one.

## 7. Sign-out confirmation

- Confirm before actions "that cannot be undone", prefer undo — [NN/g confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/).
- Hold-to-confirm descends from slide-to-unlock and "Swipe to place your order"; a 2 s hold reserved "for
  exceptional cases" like wiping data; keyboard support "is not a straightforward task" —
  [dzialowski.eu](https://www.dzialowski.eu/hold-to-confirm-button/); sustained gestures exclude users with tremor —
  [Siteimprove](https://www.siteimprove.com/blog/motor-impairments-and-mobile-ui-the-touch-target-problem/);
  WCAG 2.5.2 pointer cancellation — [WCAG](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html).
- MetaMask "Lock" is temporary; "Reset" warns about the recovery phrase — [MetaMask reset](https://support.metamask.io/configure/wallet/how-to-reset-your-wallet/).
- Recommendation: a standard dialog: title states the consequence, body says what signing back in takes, buttons
  "Cancel" / "Sign out" (destructive style). No hold-to-confirm.
- Pitfalls: treating sign-out like wallet deletion; a hold button with no keyboard path; "Are you sure?" with
  Yes/No; signing out mid-claim without saying so.

## 8. Microcopy

- "It's almost always best to use a verb" on buttons; plain language — [Apple HIG Writing](https://developer.apple.com/design/human-interface-guidelines/writing).
- Sentence-style capitalization; present tense; second person; "Turn on" not "Enable"; errors say what happened,
  then what to do — [Material writing](https://m2.material.io/design/communication/writing.html).
- CTAs "start with a strong verb"; grade-7 reading level; one term per concept — [Shopify content](https://shopify.dev/docs/apps/design/content).
- Active voice; no periods on buttons; dialog buttons answer the title; "We couldn't upload the picture. If this
  happens again, try restarting the app." — [Microsoft writing style](https://learn.microsoft.com/en-us/windows/apps/design/style/writing-style).
  Messages "close to the error's source", constructive, non-blaming, "hide or minimize … error codes" — [NN/g](https://www.nngroup.com/articles/error-message-guidelines/).
- Recommendation: a glossary of one term each ("proof", "claim", "node", "fee sponsored", "send ahead"); buttons
  verb + noun, sentence case, no period; fees and deadlines as line items; errors: what happened, what to do,
  "Details" for the cause.
- Pitfalls: "Error:" prefixes; hex codes in the first line; "Enable"/"Disable"; an exclamation point near money;
  explaining the proof deadline in the button label.

## Gaps and confidence

Bazaar has no public UX documentation (its code was read separately, `recon.md` §C). Obsidion's claims rest on
its own site (low). Apple's HIG has no passkeys page. Stripe and Linear publish no UI content style guide.
