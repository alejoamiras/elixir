"""Every crossing state on one board; the send-ahead rows; the wallet's disabled reasons."""
from lib import activity, btn, kpi, page, quiet, st, th, tile

DEADLINE = "until at least Mar 17 (180 days after the upgrade; later if the bridge pauses or the next upgrade comes later)"

# (state, chip, kind, sentence, action)
K1 = [
    ("proving", "proving · 8 s", "on", "Proving privately, about 20 s.", ""),
    ("proving, no hash after a reload", "didn't finish", "warn", "This didn't finish. Nothing left your balance.", "Bridge again"),
    ("sent", "sent", "on", "Sent. Waiting for a block.", ""),
    ("dropped", "not included", "warn", "The node never included it. Nothing left your balance.", "Bridge again"),
    ("proven-pending", "on its way to Ethereum", "on", "Reaches Ethereum usually within the hour, by 17:03 at the latest; then you claim it there.", ""),
    ("witnessed", "reached Ethereum", "on", "Reached Ethereum; reading the bridge for the claim.", ""),
    ("ready", "ready to claim", "ok", "Ready. Claim it on Ethereum with a wallet on Sepolia; that wallet pays the gas in ETH.", "Claim on Ethereum"),
    ("minted-l1", "claimed", "dim", "1 YACA at 0x90F7…b906.", "Etherscan ↗"),
    ("never-proven", "undone", "warn", "V5 didn't prove this in time. The balance is back here.", "Bridge again"),
    ("paused", "paused · until Sep 20", "warn", "The bridge is paused until Sep 20. It moves again when the pause lifts; a pause is 30 days at most, 60 in a version's life.", ""),
    ("headroom, before the upgrade", "waiting for the limit", "warn", "More has left V5 than its exit limit allows for now. It goes through as the limit grows, in order.", ""),
    ("headroom, after the upgrade", "over the limit", "bad", "V5's exit limit froze at the upgrade, and this is beyond it. It cannot leave.", "Details"),
    ("closed", "last day passed", "bad", "V5's last day passed before this was claimed. It cannot leave any more.", ""),
]
K2 = [
    ("proving · sent · dropped · never-proven · paused · headroom · closed", "as above", "dim", "The same sentences, with \"→ V6\" on the row.", ""),
    ("proven-pending", "on its way to Ethereum", "on", "Reaches Ethereum usually within the hour, by 14:03 at the latest; then held there for V6.", ""),
    ("witnessed · held", "held for V6", "on", "Held on Ethereum for V6, out of V5's reach. Yacana forwards it into V6 once V6 opens; you can too, from V6.", "Details: Redeem on Ethereum instead · " + DEADLINE),
    ("held, > 6 h after V6 opened", "longer than usual", "warn", "Yacana hasn't forwarded it yet. Forward it yourself from V6, or check the Ethereum RPC in Settings.", "Forward from V6 (on V6) · Redeem on Ethereum"),
    ("not-registered", "waiting for Yacana", "warn", "V6 is live, but Yacana hasn't opened its contract there yet. You can redeem it on Ethereum " + DEADLINE + ".", "Redeem on Ethereum"),
    ("forwarded", "arriving on V6", "on", "Forwarded into V6; claimable there in a few minutes.", ""),
    ("claimable (on V6)", "ready to claim", "ok", "Arrived from V5. Claim it into your balance: one tap, about 20 s, no fee.", "Claim"),
    ("minted-l2 (on V6)", "claimed", "dim", "3.5 tYACA in your balance. Final once its epoch is proven.", ""),
    ("minted-l1 (redeemed)", "redeemed", "dim", "Redeemed: 3.5 YACA at 0x90F7…b906 on Ethereum.", "Etherscan ↗"),
    ("flip verdict unknown", "can't read the upgrade", "warn", "Can't read the upgrade's state: the Ethereum RPC isn't answering.", "Settings"),
]
K3 = [
    ("proving", "waiting for Rabby", "on", "Confirm the deposit in Rabby. If its prompt is gone, bridge again.", "Bridge again"),
    ("sent · deposited", "crossing to Aztec", "on", "Sent from Rabby; crossing to Aztec, a few minutes.", "Etherscan ↗"),
    ("dropped", "not sent", "warn", "Rabby never sent it, or Ethereum didn't include it in time. Nothing left your wallet.", "Bridge again"),
    ("claimable", "ready to claim", "ok", "Arrived. Claim it into your private balance: one tap, about 20 s, no fee.", "Claim"),
    ("claiming", "claiming · 12 s", "on", "Claiming privately, about 20 s.", ""),
    ("minted-l2", "claimed", "dim", "0.5 tYACA in your balance. Final once its epoch is proven.", ""),
    ("minted-l2, then pruned", "ready to claim", "ok", "V5 didn't prove the claim's epoch, so it was undone. Claim it again: one tap.", "Claim"),
]


def state_table():
    def rows(title, items):
        out = f'<div class="w">{title}</div>'
        for s, chip, kind, line, action in items:
            a = f'<span class="a">{action}</span>' if action else '<span class="ink3">—</span>'
            out += f'<div class="k">{s}</div><div>{st(chip, kind)}</div><div>{line}</div><div>{a}</div>'
        return out
    hdr = '<div class="h">journal state</div><div class="h">chip</div><div class="h">the sentence on the row</div><div class="h">the action</div>'
    body = ('<div class="board"><span class="lm">the activity row · every state</span><h1>Seventeen states, one sentence each.</h1>'
            '<p>The journal (<code>packages/bridge/src/journal.ts</code>) has seventeen states over three kinds of crossing. Every one has a chip, a sentence and, where the user can act, one action. Times are the epoch\'s real deadline once the send is in a block; "usually within the hour" before. Money-loss states are red and say what happened; nothing says "safe".</p>'
            f'<div class="tbl">{hdr}{rows("to Ethereum (kind 1)", K1)}{rows("send ahead (kind 2)", K2)}{rows("from Ethereum (kind 3)", K3)}</div></div>')
    return page(body, 1200)


AHEAD = "→ V6"
T_AHEAD = [("sent", "done"), ("block 91,204", "done"), ("reached Ethereum", "done")]


def ahead_rows():
    """The send-ahead row from held to claimed on V6, with the two waits that need the user."""
    r1 = activity("3.5 tYACA", AHEAD, "Held on Ethereum for V6, out of V5's reach. Yacana forwards it into V6 once V6 opens; you can too, from V6.",
                  st("held for V6", "on"), "Sep 18", T_AHEAD + [("held for V6", "on"), ("forwarded to V6", "dim"), ("claim on V6", "dim")],
                  more=f'<div class="row sb"><span class="xs ink3">Or <a href="#">redeem it on Ethereum</a> as YACA, {DEADLINE}.</span><span class="x2 mono ink3"><a href="#">Details</a></span></div>')
    r2 = activity("3.5 tYACA", AHEAD, "Yacana hasn't forwarded it yet. Forward it yourself from V6, or check the Ethereum RPC in Settings.",
                  st("longer than usual", "warn"), "Sep 18", T_AHEAD + [("held for V6", "warn"), ("forwarded to V6", "dim"), ("claim on V6", "dim")],
                  more=f'<div class="row sb"><span>{btn("Forward to V6", "sm")}</span><span class="x2 mono ink3">on V6 · Rabby pays the gas · <a href="#">redeem on Ethereum instead</a></span></div>')
    r3 = activity("3.5 tYACA", AHEAD, "V6 is live, but Yacana hasn't opened its contract there yet. You can redeem it on Ethereum meanwhile.",
                  st("waiting for Yacana", "warn"), "Sep 18", T_AHEAD + [("held for V6", "warn"), ("V6 not open yet", "dim")],
                  more=f'<div class="row sb"><span>{btn("Redeem on Ethereum", "sm")}</span><span class="x2 mono ink3">{DEADLINE}</span></div>')
    r4 = activity("3.5 tYACA", "from V5", "Forwarded into V6; claimable here in a few minutes.", st("arriving", "on"), "Sep 19",
                  [("left V5", "done"), ("reached Ethereum", "done"), ("forwarded to V6", "done"), ("claim", "dim")])
    r5 = activity("3.5 tYACA", "from V5", "Arrived from V5. Claim it into your balance: one tap, about 20 s, no fee.", st("ready to claim", "ok"), "Sep 19",
                  [("left V5", "done"), ("reached Ethereum", "done"), ("forwarded to V6", "done"), ("claim", "on")],
                  more=f'<div class="row sb"><span>{btn("Claim", "uv sm")}</span><span class="x2 mono ink3"><a href="#">Details</a></span></div>', cls="hi")
    r6 = activity("3.5 tYACA", "from V5", "3.5 tYACA in your balance.", st("claimed", "dim"), "Sep 19",
                  [("left V5", "done"), ("reached Ethereum", "done"), ("forwarded to V6", "done"), ("claimed", "done")],
                  more='<span class="x2 mono ink3">final once its epoch is proven, usually within the hour</span>')
    body = ('<div class="board" style="padding:24px"><span class="lm">a send ahead, row by row · the last three on V6</span>'
            f'<div class="col" style="gap:12px;max-width:760px">{r1}{r2}{r3}{r4}{r5}{r6}</div></div>')
    return page(body, 820)


def wallet_reasons():
    """The balance tile when a money action can't run: the button is disabled and says why, in one line."""
    def bal(reason, dis):
        b = "".join(btn(l, "primary" if l == "Send" else "") if l not in dis else btn(l, "dis") for l in ("Send", "Bridge to Ethereum", "Bridge from Ethereum"))
        return tile(th("balance", "private") + kpi("", "3.5", "tYACA", lg=True)
                    + f'<div class="row wrap" style="gap:10px;margin-top:14px">{b}</div><p class="xs ink3" style="margin-top:8px">{reason}</p>')
    t1 = bal("Deposits are closed until V6 opens, at yacana.network.", {"Bridge from Ethereum"})
    t2 = bal(f'The Ethereum RPC isn\'t answering: bridging waits until it does. {quiet("Settings")}', {"Bridge to Ethereum", "Bridge from Ethereum"})
    t3 = bal("Bridging to Ethereum opens once Yacana registers V5 on Ethereum, at launch.", {"Bridge to Ethereum"})
    t4 = bal("The bridge is paused until Sep 20 (30 days at most a call). Sends inside Aztec still run.", {"Bridge to Ethereum", "Bridge from Ethereum"})
    body = ('<div class="board" style="padding:24px"><span class="lm">the balance tile · when a button is off, it says why</span>'
            f'<div class="col" style="gap:12px;max-width:640px">{t1}{t2}{t3}{t4}</div></div>')
    return page(body, 700)
