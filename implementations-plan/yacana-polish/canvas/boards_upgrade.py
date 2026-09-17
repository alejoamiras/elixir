"""The upgrade: the send-ahead dialog, the old origin (v5.yacana.network), V6's first login, how it works."""
from lib import (activity, amount, btn, dialog, dialog_page, header, kpi, note, page, quiet, srow, st, steps, th, tile)
from boards_signin import head
from boards_states import DEADLINE, DEADLINE_PRE

W = 440


def send_ahead_form():
    inner = (head("send ahead", "Send ahead to V6.")
             + amount("3.50", "tYACA", on=True) + '<div class="under"><span>balance 3.5 tYACA</span></div>'
             + srow("Leaves V5", "usually within the hour")
             + srow("Then", "held on Ethereum; Yacana forwards it into V6", "or you do, from V6")
             + srow("On V6", "you claim it, one tap")
             + srow("Visible on Ethereum", "the amount, not the account")
             + f'<div class="row sb" style="margin-top:4px">{btn("Send 3.5 tYACA ahead", "uv lg")}{quiet("How it works")}</div>')
    return dialog_page(inner)


def send_ahead_sent():
    inner = (head("send ahead", "3.5 tYACA sent ahead.")
             + steps([("Proved and sent", "done", "block 83,120"),
                      ("Reaching Ethereum", "on", "by 14:03 · in 40 min", "If V5 misses it, the balance comes back here."),
                      ("Held on Ethereum for V6", "todo", "", ""),
                      ("Forwarded into V6", "todo", "", "By Yacana once V6 opens, or by you from V6."),
                      ("You claim it on V6", "todo", "one tap", "")])
             + '<p class="xs ink3" style="border-top:1px solid var(--line);padding-top:12px">You can close this. Wallet follows it here, and on V6 once you log in there.</p>'
             + f'<div class="row sb" style="margin-top:4px">{btn("Done", "primary")}{quiet("Save a recovery file")}</div>'
             + '<p class="x2 mono ink3">a recovery file lets another device pick this send up</p>')
    return dialog_page(inner)


def how_it_works():
    inner = (head("send ahead · how it works", "What happens to 3.5 tYACA.")
             + steps([("Leaves V5, privately", "todo", "about 20 s", "Your browser proves it; mining pauses meanwhile. With Presto, your transaction's private inputs go to Presto on this machine, never elsewhere."),
                      ("Reaches Ethereum with its epoch", "todo", "usually within the hour", "V5 must prove the epoch within its deadline, about 40 min after the send. If it doesn't, the balance comes back here."),
                      ("Held on Ethereum for V6", "todo", "until V6 opens", "Out of V5's reach, held for this account alone. The amount is visible there; the account is not."),
                      ("Forwarded into V6", "todo", "by Yacana, or by you", "Yacana runs a relayer (an address its multisig lists) that forwards held sends once V6 opens. You can forward yours from V6 with an Ethereum wallet paying gas. Forwarding ends the option below."),
                      ("You claim it on V6", "todo", "one tap", "A private claim this page makes, no fee, about 20 s. Same passkey.")])
             + note("If V6 never opens, or Yacana is late", f"This account can redeem it on Ethereum as YACA instead, {DEADLINE_PRE}. A pause or the exit limit can delay it.", "")
             + '<div class="row sb"><span class="x2 mono ink3"><a class="uv2" href="#">the rules, on /faq ↗</a></span></div>')
    return page(f'<div style="padding:26px">{dialog(inner, W, back=True)}</div>', W + 52)


OLD_ROWS = [
    activity("3.5 tYACA", "→ V6", "Held on Ethereum for V6, out of V5's reach. Yacana forwards it into V6 once V6 opens; you can too, from V6.",
             st("held for V6", "on"), "Sep 18", [("sent", "done"), ("reached Ethereum", "done"), ("held for V6", "on"), ("forwarded to V6", "dim"), ("claim on V6", "dim")],
             more=f'<div class="row sb"><span class="xs ink3">Or <a href="#">redeem it on Ethereum</a> as YACA, {DEADLINE}.</span><span class="x2 mono ink3"><a href="#">Details</a></span></div>'),
    activity("2 tYACA", "→ V6", "Reaches Ethereum usually within the hour; then held for V6. V5 must prove it by 14:52, or the balance comes back here.", st("reaching Ethereum", "on"), "Sep 18 14:12",
             [("sent", "done"), ("block 91,204", "done"), ("reaching Ethereum", "on"), ("held for V6", "dim")]),
]

CHIPS = {
    "signed-in": st("V5 proved an epoch 12 min ago", "ok"),
    "silent": st("no proof from V5 for 3 h", "warn"),
    "quiet": st("V5 stopped proving · Sep 21", "bad"),
    "signed-out": st("V5 proved an epoch 12 min ago", "ok"),
    "gone": st("V5's node has shut down", "bad"),
}


def old_hero(state: str) -> str:
    chip = CHIPS[state]
    if state == "quiet":
        return ('<div class="hero"><div class="row sb wrap"><span class="eyebrow">aztec v5 · retired · sep 18</span>' + chip + '</div>'
                '<h1>V5 has stopped proving. Nothing more can leave.</h1>'
                '<p>What V5 proved in time is on V6, or held on Ethereum for V6, redeemable until at least Mar 17. What was still here when it stopped can no longer leave.</p></div>')
    if state == "gone":
        return ('<div class="hero"><div class="row sb wrap"><span class="eyebrow">aztec v5 · retired · sep 18</span>' + chip + '</div>'
                '<h1>V5\'s node has shut down. Nothing more can leave from here.</h1>'
                '<p>What V5 proved in time is on V6, or held on Ethereum for V6: see it at <b>yacana.network</b>. A device that never held a send restores its recovery file there.</p></div>')
    if state == "silent":
        return ('<div class="hero"><div class="row sb wrap"><span class="eyebrow">aztec v5 · retired · sep 18</span>' + chip + '</div>'
                '<h1>Send what\'s still here ahead.</h1>'
                '<p>Mining moved to V6 at <b>yacana.network</b>. V5 hasn\'t proved an epoch for 3 hours and may have stopped. A send it never proves comes back here; one it proves is held on Ethereum for V6.</p></div>')
    return ('<div class="hero"><div class="row sb wrap"><span class="eyebrow">aztec v5 · retired · sep 18</span>' + chip + '</div>'
            '<h1>Send what\'s still here ahead.</h1>'
            '<p>Mining moved to V6 at <b>yacana.network</b>. Your balance can still leave while V5 keeps proving, and V5 can stop at any time: send it ahead to V6 now, or bridge it to Ethereum.</p></div>')


def old_origin(state: str = "signed-in"):
    hdr = header("mine", app="old", version="V5 · retired", account="0x22a9…612a" if state not in ("signed-out", "gone") else None, status=None)
    if state == "gone":
        card = tile(th("still on V5") + '<p class="md ink2">Logging in here needed V5\'s node, and it is gone. Nothing on this page can change any more.</p>'
                    + f'<div class="row" style="gap:12px;margin-top:12px">{btn("Open yacana.network", "uv")}</div>')
        rows = ""
    elif state == "signed-out":
        card = tile(th("still on V5") + '<p class="md ink2">Log in to see what\'s still here.</p>' + f'<div class="row" style="gap:12px;margin-top:12px">{btn("Log in", "uv")}</div>'
                    + '<p class="xs ink3" style="margin-top:12px">Accounts are restored here, not created. The passkey or 12 words from yacana.network open it.</p>')
        rows = ""
    elif state == "quiet":
        card = tile(th("still on V5", "cannot leave") + kpi("", "1.2", "tYACA", lg=True) + '<p class="sm ink3" style="margin-top:8px">Left here when V5 stopped proving.</p>')
        rows = tile(th("proven in time") + '<div class="col" style="gap:10px">' + OLD_ROWS[0] + "</div>")
    else:
        card = tile(th("still on V5", "private · can leave while V5 proves") + kpi("", "3.5", "tYACA", lg=True)
                    + f'<div class="row" style="gap:14px;margin-top:14px">{btn("Send ahead to V6", "uv lg")}{quiet("or bridge to Ethereum")}</div>'
                    + '<p class="xs ink3" style="margin-top:12px">Then claim it on V6 with one tap, at yacana.network. Same passkey.</p>', "hi")
        rows = tile(th("activity", "2") + '<div class="col" style="gap:10px">' + "".join(OLD_ROWS) + "</div>")
    adv = '<p class="x2 mono ink3">advanced · <a href="#">save a recovery file</a> · <a href="#">restore from a file</a></p>' if state not in ("signed-out", "gone") else ""
    body = f'<div class="body" style="max-width:760px;margin:0 auto;width:100%;padding-top:36px">{old_hero(state)}{card}{rows}{adv}</div>'
    return page(f'<div class="shell">{hdr}{body}</div>', 1440)


def v6_first_login():
    row = activity("3.5 tYACA", "from V5", "Arrived from V5. Claim it into your balance: one tap, about 20 s, no fee.",
                   st("ready to claim", "ok"), "Sep 19", [("left V5", "done"), ("reached Ethereum", "done"), ("forwarded to V6", "done"), ("claim", "on")],
                   more=f'<div class="row sb"><span>{btn("Claim", "uv sm")}</span><span class="x2 mono ink3"><a href="#">Details</a></span></div>', cls="hi")
    from boards_wallet import account_tile, wins_row
    bal = tile(th("balance", "private") + kpi("", "0", "tYACA", lg=True) + '<p class="sm ink2" style="margin-top:8px">3.5 tYACA from V5 are waiting below.</p>'
               + f'<div class="row wrap" style="gap:10px;margin-top:14px">{btn("Send", "primary dis")}{btn("Bridge to Ethereum", "dis")}{btn("Bridge from Ethereum")}</div>'
               + '<p class="xs ink3" style="margin-top:8px">Send and Bridge to Ethereum wake up once something is in the balance.</p>')
    hdr = header("wallet", version="V6", account="0x22a9…612a")
    hdr = hdr.replace('>Wallet</a>', '>Wallet <span class="badge uv" style="padding:1px 6px;font-size:10px">1</span></a>')
    body = f'<div class="body"><div class="grid" style="grid-template-columns:1fr 1fr">{bal}{account_tile()}</div>{tile(th("activity", "1") + row + wins_row("0"))}</div>'
    return page(f'<div class="shell">{hdr}{body}</div>', 1440)


def disclosure_board():
    from boards_mine import upgrade_card
    lvl0 = ('<div class="row" style="gap:10px"><span class="vtag">V5</span><span class="badge uv">V6 · Sep 18</span><span class="badge net">testnet</span></div>')
    body = ('<div class="board"><span class="lm">the upgrade · progressive disclosure</span><h1>Four levels, never a bet.</h1>'
            '<p>Level 0 is a tag; level 1 a card with the fact, the next step and the one consequence of not acting; level 2 the stages with times; level 3 the contract\'s rules on /faq. The live chip (V5 proved an epoch 12 min ago) does the reassuring: it is true and it updates, and silence reads as silence ("no proof from V5 for 3 h"). Nothing says "safe": a proven send still needs forwarding or redeeming before V5\'s last day, and a balance on V5 can lose its way out at any time.</p>'
            '<div class="grid" style="grid-template-columns:1fr 1fr;gap:18px">'
            f'<div class="col"><span class="lm">level 0 · the header</span>{lvl0}<span class="lm" style="margin-top:8px">level 1 · the card on Mine and Wallet</span>{upgrade_card("announced")}{upgrade_card("flipped")}</div>'
            f'<div class="col"><span class="lm">level 2 · how it works</span>{dialog(head("send ahead · how it works", "What happens to 3.5 tYACA.") + steps([("Leaves V5, privately", "todo", "about 20 s"), ("Reaches Ethereum with its epoch", "todo", "usually within the hour", "Within its epoch\'s deadline, about 40 min after the send. If V5 misses it, the balance comes back here."), ("Held on Ethereum for V6", "todo", "until V6 opens"), ("Forwarded into V6", "todo", "by Yacana, or by you"), ("You claim it on V6", "todo", "one tap")]), 440)}'
            '<span class="lm" style="margin-top:8px">level 3 · /faq#rules</span><div class="mini" style="padding:14px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-2)"><b class="ink" style="font-size:14px">The rules</b><span>The exit limit · The pause budget · A version\'s life · Who may do what · The forward rule · Three bridges</span><span class="x2 mono ink3">six drawings, one line each, opened by a chevron</span></div></div>'
            '</div></div>')
    return page(body, 1200)
