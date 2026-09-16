# Phase 9 — The transaction dialog (arc 5, `polish-wallet`)

## Build

- `features/dialogs/Frame.tsx` (new): the one frame every money flow shares — `TxDialog` (the 440 px
  `Dialog size="tx"`, an eyebrow, the title, a body line; `locked` while something proves or a wallet is
  asked: no close, no dismiss), `Row`/`Rows` (the summary rows with a second line under the value), `Foot`
  (the line under a stepper), `Actions` (the primary beside its quiet alternative, one mono line under),
  `Primary`, `Quiet`, `Back`, `AmountBelow` (the refusal left, the balance right), `useElapsed`, `hhmm`.
- `features/dialogs/Wallet.tsx` (new): the Ethereum wallet inside a dialog — `ConnectWallet` (one installed
  wallet is one **Connect wallet** button, several are listed by name and icon, none says where to get one),
  `WalletChip` (name · address · network, × disconnects), `YacaAvailable`, `useWalletChain` (the switch as a
  step of its own, with `WrongNetwork`'s note), `useWalletName`, `useYacaBalance`, `noEth`.
- `features/dialogs/Send.tsx`: one screen. `amountRefusal` on input, `recipientRefusal` when the field is
  left (both in `withdraw-form.ts`, in the brief's words), the probe (`session.recipientKnown`) after a
  refusal-free address, advisory; How as two radios; the public note; the button carries the amount and the
  mode and waits on a refusal; a first click with nothing typed shows "Enter an amount."; the proof as a
  locked stepper; the receipt with the block and the transaction linked. The send checks the exact values it
  submits again (`review`) and uses nothing the probe saw.
- `features/dialogs/ToEthereum.tsx`: the connected wallet as the recipient with quiet **Change**, else the
  pasted address in full with "pasted · not your connected wallet" and the check-every-character line;
  `ethRefusal` (`bridge/forms.ts`) under the field on the click; the three rows; **Bridge 3.5 tYACA**; How it
  works as a screen with Back; proving locked; sent with the stations and the proof deadline.
- `features/dialogs/FromEthereum.tsx`: the connect screen, then the chip with what it holds, the standing
  notes (closed for good / the announced upgrade), the amount against the wallet's YACA, the rows, the
  switch step, the payer's ETH read before the wallet is asked, **Confirm in Rabby** as a locked step, then
  the stations with Etherscan.
- `features/dialogs/Claim.tsx`: one dialog for the claim on Ethereum (K1), the forward and the redeem
  (K2) — the rows name the payer and the fixed recipient, the switch is a step, the ETH is read first, the
  wallet's rejection is a red step with **Try again**, a portal refusal is the row's sentence (`revertLine`),
  done links Etherscan.
- `features/dialogs/SendAhead.tsx`: the whole balance by default, the four rows, **Send 3.5 tYACA ahead**,
  How it works (the five stations and the never-opens note on `deadlinePhrase`), the locked proof, the five
  stations after, **Save a recovery file** under Done with its line. `Mine.tsx` opens it; `OldApp.tsx` keeps
  `SendAheadSheet` (now on `AmountField`) until P10.
- `routes/Wallet.tsx`: `MoneyDialogs` and `SendDialog`; `RailTile.tsx`: the claim slot gone (the claim lives
  on the loop's chip and the ledger since P4). Deleted: `ToEthereumSheet`, `DepositSheet`, `SendSheet`,
  `ClaimSlot`, `AmountInput`.
- Specs: `forms.vitest.tsx` (new: the refusals under their fields, the button waiting, the probe's note, the
  public note, the receipt; the address parser stubbed since bb.js cannot run in jsdom), `withdraw.bun.test`
  (the refusal strings, the Ethereum ones too), `bridge-features.vitest` ('the dialogs' under wagmi),
  `cockpit.vitest` (the rail without the slot); `withdraw.e2e.ts` (one screen), `bridge-states.e2e.ts` (the
  switch as a step the wallet confirms once, the refused deposit, the prompt left open as a step), the rig's
  `bridge.e2e.ts` (no review screens); `connectTestWallet` accepts the one-button connect screen.
- `CLAUDE.md`, `docs/threat-model.md`, `docs/upgrades.md`: sheet → dialog.

## Decisions and departures

- The wrong-network step is on every dialog that asks the wallet (deposit, claim, forward, redeem), not the
  claim alone: §9.2.5 names the claim, but the same wallet pays the same way in the other three, and one
  `useWalletChain` serves all four.
- The proving screens replace the form rather than freezing it (§5.4 says "freezes the form"): the dialog
  is locked either way, and the stepper is where the proof's elapsed time and the keep-this-tab-open line
  live (§5.5's proving board).
- The unknown-recipient probe never blocks the send: the brief calls it inline and advisory; the click
  re-validates the exact values and sends.
- The recovery file's re-offer (§9.3.6) is the activity tile's standing **save a recovery file** plus the
  Sent screen's prompt; no timed nag.
- `SendAheadSheet` stays for the old origin until P10 as the plan says; it moves to `AmountField` so
  `AmountInput` can go now.

## The reopen that stuck (canary run 1)

`withdraw.e2e.ts` timed out on its second send: Done, then **Send** again 200 ms later, and the page sat
under a dimmed overlay with no dialog for 20 minutes. The trace (references resolved from the frame
snapshots) shows the closing dialog still mounted when the click landed — Radix keeps an exiting dialog
until its animation ends (the content's 200 ms outlasts the overlay's 150 ms) — and the final DOM holding
the overlay at `data-state=closed` with the content gone: a Presence left waiting for an animation end
that never comes. Reviving the closing dialog was also why the form flashed through the fade-out (the
snapshot right after Done shows the fields inside the closing content: `close()` reset the step at once).

Fix: `useOpening(open)` in `Frame.tsx` — a counter that ticks on every opening — and each dialog mounts
its run on that key (`SendDialog` → `SendRun` and so on). A reopen is a new Radix root with `open` from
its first render, nothing to race; the closed run keeps its last screen through the fade-out and every
field resets by construction, so the on-close resets are gone. `forms.vitest` covers the clean reopen;
the canary covers the real thing.

Canary run 2 got past the reopen and stuck on the **Publicly** radio: an `sr-only` input is a 1 px box
under its label, so a real click — Playwright's `getByRole('radio')` like a finger — lands on the label
and never on the input. The input now covers its segment invisibly (`absolute inset-0 opacity-0`), the
label carries the focus ring through `has-[:focus-visible]`; jsdom never noticed either way.

## Gate (2026-09-16)

| layer | result |
|---|---|
| lint, web-miner typecheck | clean |
| `bun test packages/web-miner packages/bridge` | 247 pass, 3 skip |
| `test:components` (web-miner 107, 22 files) | green |
| `bridge` shard, proverless (the injected wallet) | 1/1 passed, 3.5 min; again after the per-opening change, 3.6 min |
| `canary` shard, real proving (withdraw among it) | 4/4 passed on the third run, 5.1 min (withdraw 103 s, 3 proofs); runs 1–2 above |
| replay (`test:replay`) | 4/4 passed, 42 s |
| `bun run rig -- browser` (the rig's `bridge.e2e.ts`) | 3/3 passed: V5 2.9 min · flip 12 s · V6 1.2 min |

Pass criteria: cancellation boundaries and disabled reasons match the send's ownership — an Aztec send
(Send, Bridge to Ethereum, Send ahead) locks the dialog while the browser proves and offers nothing but
Done after; an Ethereum send (deposit, claim, forward, redeem) locks while the wallet is asked, and before
that its button is off for exactly the reasons the page owns (the wrong network with the switch offered, no
ETH for the gas, an amount the form refuses) while the wallet's own refusal comes back as a step or a line.
