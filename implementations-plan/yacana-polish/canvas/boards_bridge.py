"""Bridge to and from Ethereum: the transaction dialog's form, progress, claim; the container options."""
from lib import (activity, amount, btn, dialog, dialog_page, note, page, quiet, srow, st, steps)
from boards_signin import head

W = 440
RABBY = '<i style="width:12px;height:12px;border-radius:50%;background:conic-gradient(from 20deg,#f5a623,#7b61ff,#f5a623)"></i>'
WALLET_CHIP = (f'<span class="row" style="gap:8px;border:1px solid var(--line-2);border-radius:6px;padding:6px 10px;font:400 12.5px var(--mono)">{RABBY}'
               'Rabby · 0x90F7…b906<span class="ink3">· Sepolia</span></span>')
PASTED_CHIP = ('<span class="col" style="gap:6px;border:1px solid rgba(232,181,77,.5);border-radius:6px;padding:8px 10px;font:400 12px var(--mono)">'
               '<span class="ink" style="word-break:break-all">0x90F7a3c1E4b2D9f8A7c6B5e4D3c2B1a0F9e8b906</span>'
               '<span class="row" style="gap:8px"><span class="badge warn" style="padding:2px 6px;font-size:10px">pasted · not your connected wallet</span></span></span>')


def actions(primary: str, secondary: str = "") -> str:
    s = quiet(secondary) if secondary else ""
    return f'<div class="row sb" style="margin-top:4px">{primary}{s}</div>'


def to_row(chip: str, change: str = "Change") -> str:
    return f'<div class="srow" style="flex-direction:column;gap:8px"><span class="row sb"><span>To</span>{quiet(change)}</span><span style="text-align:left">{chip}</span></div>'


# ---------------------------------------------------------------- to Ethereum

def to_eth_form(pasted: bool = False):
    to = to_row(PASTED_CHIP, "Use my wallet instead") if pasted else to_row(WALLET_CHIP)
    check = ('<p class="xs warn" style="margin-top:-4px">Check every character. A bridge can\'t be recalled; YACA sent to a wrong address is lost.</p>'
             if pasted else "")
    inner = (head("bridge", "Bridge to Ethereum.")
             + amount("3.50", "tYACA", on=True) + '<div class="under"><span>balance 3.5 tYACA</span></div>'
             + to + check
             + srow("Arrives", "usually within the hour; then you claim it there")
             + srow("Fee", "none here · gas in ETH when you claim, from the wallet that claims")
             + srow("Visible on Ethereum", "the amount and 0x90F7…b906; not this account")
             + actions(btn("Bridge 3.5 tYACA", "uv lg"), "How it works"))
    return dialog_page(inner)


def to_eth_proving():
    inner = (head("bridge", "Bridging 3.5 tYACA.")
             + steps([("Proving privately", "on", "12 s", "In your browser; Presto proves only mining work.", 62),
                      ("Sent", "todo", "", ""),
                      ("Reaching Ethereum", "todo", "usually within the hour", ""),
                      ("Claim on Ethereum", "todo", "", "")])
             + '<p class="xs ink3" style="border-top:1px solid var(--line);padding-top:12px">Keep this tab open while it proves, about 20 s.</p>')
    return page(f'<div style="padding:26px">{dialog(inner, W, close=False)}</div>', W + 52)


def to_eth_sent():
    inner = (head("bridge", "3.5 tYACA on its way.")
             + steps([("Proved and sent", "done", "block 83,120"),
                      ("Reaching Ethereum", "on", "usually within the hour", "V5 must prove it by 17:03. If it doesn't, the balance comes back here."),
                      ("Claim on Ethereum", "todo", "", "With a wallet on Sepolia; it pays the gas in ETH.")])
             + '<p class="xs ink3" style="border-top:1px solid var(--line);padding-top:12px">You can close this. Wallet shows the progress and a <b class="ink2">Claim</b> button when it\'s ready.</p>'
             + actions(btn("Done", "primary")))
    return dialog_page(inner)


def claim_dialog(stage: str = "ready"):
    rows = (srow("To", "0x90F7…b906", "chosen when you bridged") + srow("Paid by", "Rabby · in Sepolia ETH", "the gas, nothing else")
            + srow("Then", "1 YACA at that address"))
    if stage == "ready":
        inner = head("claim", "Claim 1 YACA on Ethereum.") + rows + actions(btn("Claim with Rabby", "uv lg"), "Not now")
    elif stage == "switch":
        inner = (head("claim", "Claim 1 YACA on Ethereum.") + rows
                 + note("Rabby is on Ethereum mainnet.", "The bridge is on Sepolia. Switch, then claim; Rabby asks you to confirm the switch.", "warn")
                 + actions(btn("Switch Rabby to Sepolia", "uv lg"), "Not now"))
    elif stage == "noeth":
        inner = (head("claim", "Claim 1 YACA on Ethereum.") + rows
                 + note("Rabby has no Sepolia ETH for the gas.", "Add some to 0x90F7…b906, then claim. The YACA waits for you.", "warn")
                 + actions(btn("Claim with Rabby", "uv lg dis"), "Not now"))
    elif stage == "wallet":
        inner = (head("claim", "Claim 1 YACA on Ethereum.")
                 + steps([("Confirm in Rabby", "on", "", "Rabby asks you to confirm the claim and shows the gas."),
                          ("Claiming", "todo", "waiting for Ethereum", ""), ("Claimed", "todo", "", "")])
                 + actions(btn("Waiting for Rabby…", "uv lg dis", busy=True)))
    elif stage == "declined":
        inner = (head("claim", "Claim 1 YACA on Ethereum.")
                 + steps([("Rabby rejected it", "bad", "", "Nothing was claimed; the YACA is still yours to claim."),
                          ("Claiming", "todo", "", ""), ("Claimed", "todo", "", "")])
                 + actions(btn("Try again", "uv lg"), "Not now"))
    else:
        inner = (head("claim", "Claimed.")
                 + steps([("Confirmed in Rabby", "done", ""), ("Claimed", "done", "block 6,912,004", "1 YACA at 0x90F7…b906.")])
                 + actions(btn("Done", "primary"), "View on Etherscan ↗"))
    return dialog_page(inner)


# ---------------------------------------------------------------- from Ethereum

def from_eth_connect(picker: bool = False):
    if not picker:
        inner = (head("bridge", "Bridge from Ethereum.", "Connect the wallet that holds your YACA.")
                 + btn("Connect wallet", "uv lg full") + '<p class="xs ink3">MetaMask, Rabby or any browser wallet. None installed? <a class="uv2" href="#">Get one ↗</a></p>')
    else:
        rows = "".join(f'<div class="row sb" style="border:1px solid var(--line-2);border-radius:8px;padding:12px 14px"><span class="row" style="gap:10px"><i style="width:22px;height:22px;border-radius:6px;background:{c}"></i><b>{n}</b></span><span class="x2 mono ink3">installed</span></div>'
                       for n, c in (("Rabby", "conic-gradient(from 20deg,#f5a623,#7b61ff,#f5a623)"), ("MetaMask", "#f6851b")))
        inner = head("bridge", "Connect a wallet.", "The wallet that holds your YACA on Sepolia.") + f'<div class="col" style="gap:8px">{rows}</div>' + quiet("Cancel")
    return dialog_page(inner)


def from_eth_form(preflip: bool = False, closed: bool = False):
    pre = note("Aztec upgrades to V6 around Sep 18.", "A deposit now lands on V5 and would need sending ahead afterwards. Unless you need it here now, bridge after the upgrade, at yacana.network.", "warn") if preflip else ""
    if closed:
        pre = note("Deposits into V5 are closed for good.", "Aztec upgrades around Sep 18 and Yacana closed V5's deposits ahead of it. Bridge from Ethereum on V6, at yacana.network, once it opens.", "warn")
    inner = (head("bridge", "Bridge from Ethereum.")
             + f'<div class="row sb">{WALLET_CHIP}<span class="row" style="gap:10px"><span class="x2 mono ink3">7 YACA available</span><span class="ink3">✕</span></span></div>'
             + pre
             + amount("0.50", "YACA", on=not closed)
             + srow("Arrives", "a few minutes; then you claim it here", "one tap, no fee")
             + srow("Fee", "gas in ETH from Rabby · none here")
             + srow("Visible on Ethereum", "your wallet and the amount; not this account")
             + actions(btn("Bridge 0.5 YACA", "uv lg" + (" dis" if closed else "")), "How it works"))
    return dialog_page(inner)


def from_eth_progress(stage: str = "wallet"):
    if stage == "wallet":
        items = [("Confirm in Rabby", "on", "", "Rabby asks you to confirm the deposit and shows the gas."), ("Crossing to Aztec", "todo", "a few minutes", ""), ("Claim here", "todo", "one tap", "")]
        foot = ""
    else:
        items = [("Sent from Rabby", "done", "Etherscan ↗"), ("Crossing to Aztec", "on", "a few minutes", ""), ("Claim here", "todo", "one tap, no fee", "")]
        foot = '<p class="xs ink3" style="border-top:1px solid var(--line);padding-top:12px">You can close this. Wallet shows a <b class="ink2">Claim</b> button when it arrives.</p>' + actions(btn("Done", "primary"))
    inner = head("bridge", "Bridging 0.5 YACA.") + steps(items) + foot
    return page(f'<div style="padding:26px">{dialog(inner, W, close=stage != "wallet")}</div>', W + 52)


# ---------------------------------------------------------------- the wallet rows, state by state

FINAL = '<span class="x2 mono ink3">final once its epoch is proven, usually within the hour</span>'


def claim_here_states():
    """The Wallet row through an arrival: ready → claiming → claimed (one artboard, three rows)."""
    r1 = activity("0.5 YACA", "→ here · from Rabby 0x90F7…b906", "Arrived. Claim it into your private balance: one tap, about 20 s, no fee.",
                  st("ready to claim", "ok"), "16:02", [("sent from Rabby", "done"), ("crossed to Aztec", "done"), ("claim", "on"), ("in your balance", "dim")],
                  more=f'<div class="row sb"><span>{btn("Claim", "uv sm")}</span><span class="x2 mono ink3"><a href="#">Etherscan ↗</a></span></div>', cls="hi")
    r2 = activity("0.5 YACA", "→ here · from Rabby 0x90F7…b906", "Claiming privately, about 20 s.",
                  st("claiming · 12 s", "on"), "16:02", [("sent from Rabby", "done"), ("crossed to Aztec", "done"), ("claiming", "on"), ("in your balance", "dim")],
                  more='<div class="bar" style="margin-top:0"><i style="width:58%"></i></div>')
    r3 = activity("0.5 YACA", "→ here", "0.5 tYACA in your balance.", st("claimed", "dim"), "16:03",
                  [("sent from Rabby", "done"), ("crossed to Aztec", "done"), ("claimed", "done"), ("in your balance", "done")], more=FINAL)
    body = ('<div class="board" style="padding:24px"><span class="lm">the wallet row through an arrival</span>'
            f'<div class="col" style="gap:12px;max-width:760px">{r1}{r2}{r3}</div></div>')
    return page(body, 820)


EXIT_TO = "→ Ethereum · 0x90F7…b906"
T_PROVED = [("sent", "done"), ("block 83,131", "done")]


def exit_row_states():
    """The main path of a bridge to Ethereum: proving → on its way → ready → claimed; and undone."""
    r1 = activity("1 tYACA", EXIT_TO, "Proving privately, about 20 s.", st("proving · 8 s", "on"), "16:09",
                  [("proving", "on"), ("sent", "dim"), ("reached Ethereum", "dim"), ("claim on Ethereum", "dim")], more='<div class="bar" style="margin-top:0"><i style="width:40%"></i></div>')
    r2 = activity("1 tYACA", EXIT_TO, "Reaches Ethereum usually within the hour; then you claim it there. V5 must prove it by 17:03, or the balance comes back here.", st("reaching Ethereum", "on"), "16:09",
                  T_PROVED + [("reaching Ethereum", "on"), ("claim on Ethereum", "dim")])
    r3 = activity("1 tYACA", EXIT_TO, "Ready. Claim it on Ethereum with a wallet on Sepolia; that wallet pays the gas in ETH.", st("ready to claim", "ok"), "16:51",
                  T_PROVED + [("reached Ethereum", "done"), ("claim on Ethereum", "on")],
                  more=f'<div class="row sb"><span>{btn("Claim on Ethereum", "uv sm")}</span><span class="x2 mono ink3"><a href="#">Details</a></span></div>', cls="hi")
    r4 = activity("1 tYACA", EXIT_TO, "1 YACA at 0x90F7…b906.", st("claimed", "dim"), "17:02",
                  T_PROVED + [("reached Ethereum", "done"), ("claimed on Ethereum", "done")], more='<div class="row sb"><span class="x2 mono ink3"><a href="#">Etherscan ↗</a></span></div>')
    r5 = activity("1 tYACA", EXIT_TO, "V5 didn't prove this in time. The balance is back here.", st("undone", "warn"), "Sep 13",
                  [("sent", "done"), ("block 83,131", "done"), ("proof missed · 17:03", "warn")], more=f'<div class="row sb"><span>{btn("Bridge again", "sm")}</span></div>')
    body = ('<div class="board" style="padding:24px"><span class="lm">a bridge to Ethereum · the main path</span>'
            f'<div class="col" style="gap:12px;max-width:760px">{r1}{r2}{r3}{r4}{r5}</div></div>')
    return page(body, 820)


def exit_edge_states():
    """The states a user meets rarely, each with its sentence and its way out."""
    r0 = activity("1 tYACA", EXIT_TO, "The page closed while this was sent. Checking the chain for it.", st("checking", "on"), "Sep 13",
                  [("sent?", "on")], more='<div class="row sb"><span class="x2 mono ink3">found on the chain, it carries on from where it is</span></div>')
    r1 = activity("1 tYACA", EXIT_TO, "This didn't finish. Nothing left your balance.", st("didn't finish", "warn"), "Sep 13",
                  [("proving", "warn")], more=f'<div class="row sb"><span>{btn("Bridge again", "sm")}</span><span class="x2 mono ink3">the send never reached the chain</span></div>')
    r2 = activity("1 tYACA", EXIT_TO, "The node never included it. Nothing left your balance.", st("not included", "warn"), "Sep 13",
                  [("sent", "done"), ("not included", "warn")], more=f'<div class="row sb"><span>{btn("Bridge again", "sm")}</span></div>')
    r3 = activity("1 tYACA", EXIT_TO, "The bridge is paused until Sep 20: claims wait until it lifts. Yacana can pause for 60 days in all over V5's life, and can lift a pause early.",
                  st("paused · until Sep 20", "warn"), "Sep 13", T_PROVED + [("reached Ethereum", "done"), ("paused", "warn"), ("claim on Ethereum", "dim")],
                  more='<div class="row sb"><span class="x2 mono ink3">why a bridge can pause · <a href="#">/faq#rules</a></span></div>')
    r4 = activity("1 tYACA", EXIT_TO, "More has left V5 than its exit limit allows right now. The limit grows by the hour while V5 is current, and this turns ready to claim once it fits; others may use the room first.",
                  st("waiting for the limit", "warn"), "Sep 13", T_PROVED + [("reached Ethereum", "done"), ("waiting for the limit", "warn"), ("claim on Ethereum", "dim")],
                  more='<div class="row sb"><span class="x2 mono ink3">Claim appears once it fits · <a href="#">/faq#rules</a></span></div>')
    r5 = activity("1 tYACA", EXIT_TO, "V5's exit limit froze at the upgrade, and this is beyond it. It cannot leave.",
                  st("over the limit", "bad"), "Sep 19", T_PROVED + [("reached Ethereum", "done"), ("over the frozen limit", "bad")],
                  more='<div class="row sb"><span class="x2 mono ink3">what the limit is · <a href="#">/faq#rules</a></span></div>')
    r5b = activity("1 tYACA", EXIT_TO, "The 180 days are over. The next Aztec upgrade closes V5's exits, later only by the days the bridge was paused. Claim it now.",
                   st("could close any day", "bad"), "Mar 18", T_PROVED + [("reached Ethereum", "done"), ("claim on Ethereum", "bad")],
                   more=f'<div class="row sb"><span>{btn("Claim on Ethereum", "uv sm")}</span><span class="x2 mono ink3">why it can close · <a href="#">/faq#rules</a></span></div>', cls="hi")
    r6 = activity("1 tYACA", EXIT_TO, "V5's last day passed before this was claimed. It cannot leave any more.",
                  st("last day passed", "bad"), "Mar 20", T_PROVED + [("reached Ethereum", "done"), ("last day passed", "bad")])
    body = ('<div class="board" style="padding:24px"><span class="lm">a bridge to Ethereum · the rare states</span>'
            f'<div class="col" style="gap:12px;max-width:760px">{r0}{r1}{r2}{r3}{r4}{r5}{r5b}{r6}</div></div>')
    return page(body, 820)


# ---------------------------------------------------------------- the container options (A/B/C)

def container_options():
    mini_a = ('<div class="mini" style="height:230px"><div style="position:absolute;inset:0;background:rgba(10,10,11,.72)"></div>'
              '<div class="dialog" style="width:220px;padding:14px;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);gap:8px"><span class="eyebrow">bridge</span><b style="font-size:13px">Bridge to Ethereum.</b>'
              '<div class="amt" style="padding:8px 10px"><span class="n" style="font-size:18px">3.50</span><span class="u" style="font-size:9px">tYACA</span></div>'
              '<div class="srow" style="font-size:10px;padding:5px 0"><span>Arrives</span><span>usually within the hour</span></div><span class="btn uv sm" style="font-size:11px;height:26px">Bridge 3.5 tYACA</span></div></div>')
    mini_b = ('<div class="mini" style="height:230px"><div style="position:absolute;inset:0;background:rgba(10,10,11,.6)"></div>'
              '<div style="position:absolute;right:0;top:0;bottom:0;width:46%;background:var(--raised);border-left:1px solid var(--line-2);padding:14px;display:flex;flex-direction:column;gap:8px"><span class="eyebrow">bridge</span><b style="font-size:13px">Bridge to Ethereum.</b>'
              '<div class="amt" style="padding:8px 10px"><span class="n" style="font-size:18px">3.50</span><span class="u" style="font-size:9px">tYACA</span></div><span class="btn uv sm" style="font-size:11px;height:26px">Bridge 3.5 tYACA</span></div></div>')
    mini_c = ('<div class="mini" style="height:230px;padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="col" style="gap:8px"><span class="eyebrow">bridge</span><b style="font-size:13px">Bridge to Ethereum.</b>'
              '<div class="amt" style="padding:8px 10px"><span class="n" style="font-size:18px">3.50</span><span class="u" style="font-size:9px">tYACA</span></div><span class="btn uv sm" style="font-size:11px;height:26px">Bridge 3.5 tYACA</span></div>'
              '<div class="col" style="gap:6px;font-size:11px;color:var(--ink-2)"><span class="lm">how it works</span><span>Proving privately · 20 s</span><span>Sent · a block</span><span>Reaching Ethereum · usually within the hour</span><span>Claim on Ethereum · your wallet</span></div></div>')

    def opt(tag, name, mini, pro, pick=False):
        return (f'<div class="opt {"pick" if pick else ""}"><div class="hd"><b>{name}</b><span class="tag">{tag}</span></div>{mini}<p class="pro">{pro}</p></div>')
    body = ('<div class="board"><span class="lm">option 2 · the transaction container</span><h1>Where a bridge happens.</h1>'
            '<p>The same frame carries bridge to, bridge from, claim, send and send ahead. After "sent", the Wallet row owns the progress in every option.</p>'
            '<div class="opts" style="grid-template-columns:repeat(3,1fr)">'
            + opt("A · recommended", "Centred dialog", mini_a, "<b>Focused, one thing at a time; the crypto norm (Uniswap, Across, Rainbow). Nothing behind it competes with the amount.</b> Costs the context of the page while open.", True)
            + opt("B", "Right-side sheet", mini_b, "Today's frame, redesigned. Keeps the page visible; but a drawer reads as detail or settings, not as a transaction, and the eye splits between the form and the cockpit behind it.")
            + opt("C", "A page of its own", mini_c, "Room for the form and the explanation side by side; NN/g's answer for multi-step flows. But the flow is one screen now, and a page loses the wallet's activity list where the progress lives.")
            + '</div></div>')
    return page(body, 1200)
