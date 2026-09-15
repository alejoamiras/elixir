"""The Wallet: balance, account, one Activity list (deposits included), wins, phone."""
from lib import activity, btn, header, kpi, page, phone, quiet, st, th, tile
from boards_states import DEADLINE

FINAL = '<span class="x2 mono ink3">final once its epoch is proven, usually within the hour</span>'

ROW_EXIT_PROVING = activity("2 tYACA", "→ Ethereum · 0x90F7…b906",
                            "Reaches Ethereum usually within the hour, by 17:03 at the latest; then you claim it there.",
                            st("on its way to Ethereum", "on"), "16:09 · Sep 15",
                            [("sent", "done"), ("block 83,131", "done"), ("reaching Ethereum", "on"), ("claim on Ethereum", "dim")])
ROW_DEPOSIT_READY = activity("0.5 YACA", "→ here · from Rabby 0x90F7…b906",
                             "Arrived. Claim it into your private balance: one tap, about 20 s, no fee.",
                             st("ready to claim", "ok"), "16:02 · Sep 15",
                             [("sent from Rabby", "done"), ("crossed to Aztec", "done"), ("claim", "on"), ("in your balance", "dim")],
                             more=f'<div class="row sb"><span>{btn("Claim", "uv sm")}</span><span class="x2 mono ink3"><a href="#">Etherscan ↗</a> · <a href="#">Details</a></span></div>', cls="hi")
ROW_EXIT_READY = activity("1 tYACA", "→ Ethereum · 0x90F7…b906",
                          "Ready. Claim it on Ethereum with a wallet on Sepolia; that wallet pays the gas in ETH.",
                          st("ready to claim", "ok"), "15:20 · Sep 15",
                          [("sent", "done"), ("block 83,120", "done"), ("reached Ethereum", "done"), ("claim on Ethereum", "on")],
                          more=f'<div class="row sb"><span>{btn("Claim on Ethereum", "uv sm")}</span><span class="x2 mono ink3"><a href="#">Details</a></span></div>', cls="hi")
ROW_AHEAD_HELD = activity("3.5 tYACA", "→ V6",
                          "Held on Ethereum for V6, out of V5's reach. Yacana forwards it into V6 once V6 opens; you can too, from V6.",
                          st("held for V6", "on"), "Sep 14",
                          [("sent", "done"), ("reached Ethereum", "done"), ("held for V6", "on"), ("forwarded to V6", "dim"), ("claim on V6", "dim")],
                          more=f'<div class="row sb"><span class="xs ink3">Or <a href="#">redeem it on Ethereum</a> as YACA, {DEADLINE}.</span><span class="x2 mono ink3"><a href="#">Details</a></span></div>')
ROW_DONE = activity("0.5 YACA", "→ here", "0.5 tYACA in your balance.", st("claimed", "dim"), "Sep 14", more=FINAL)

ADVANCED = '<span class="x2 mono ink3">advanced · <a href="#">save a recovery file</a> · <a href="#">restore from a file</a></span>'


def balance_tile(sym="tYACA", n="3.5"):
    return tile(th("balance", "private") + kpi("", n, sym, lg=True)
                + f'<div class="row wrap" style="gap:10px;margin-top:14px">{btn("Send", "primary")}{btn("Bridge to Ethereum")}{btn("Bridge from Ethereum")}</div>')


def account_tile(backed: str = "passkey"):
    if backed == "passkey":
        line = '<span class="x2 mono ink3">passkey</span>'
    elif backed == "words":
        line = '<span class="x2 mono ok">12 words · backed up ✓</span>'
    else:
        line = f'<span class="x2 mono warn">12 words · not backed up</span> {quiet("Back up now")}'
    return tile(th("account") + f'<div class="row sb" style="border:1px solid var(--line-2);border-radius:8px;padding:12px 14px"><div class="col" style="gap:4px"><span class="acct" style="border:0;padding:0;font-size:13px;color:var(--ink)"><i></i>0x22a9db…612a <span class="uv2">↗</span></span>{line}</div>{btn("Sign out", "sm")}</div>')


def wins_row(n: str) -> str:
    return (f'<div class="row sb" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px"><span class="row" style="gap:8px"><span class="lm">wins · {n}</span><span class="ink4">›</span></span>{ADVANCED}</div>')


def activity_tile(rows: list[str], aside: str = "5 · newest first"):
    return tile(th("activity", aside) + '<div class="col" style="gap:10px">' + "".join(rows) + "</div>" + wins_row("12"))


def wallet(state: str = "active"):
    rows = [ROW_EXIT_PROVING, ROW_DEPOSIT_READY, ROW_EXIT_READY, ROW_AHEAD_HELD, ROW_DONE] if state == "active" else []
    if rows:
        act = activity_tile(rows)
    else:
        hint = ('<p class="xs ink3" style="margin-top:10px;text-align:center">Sent ahead from V5 on another device? It shows here once Yacana forwards it; until then, <a class="uv2" href="#">restore its recovery file</a>.</p>'
                if state == "empty-v6" else "")
        act = tile(th("activity") + '<div class="ph-chart" style="min-height:90px">Nothing crossing yet.<br><span class="ink3">Bridges and send-aheads show here, with where they are.</span></div>' + hint + wins_row("1" if state == "empty" else "0"))
    version = "V6" if state == "empty-v6" else "V5"
    hdr = header("wallet", version=version, account="0x22a9…612a", status="mining" if state == "active" else "")
    if state == "active":
        hdr = hdr.replace('>Wallet</a>', '>Wallet <span class="badge uv" style="padding:1px 6px;font-size:10px">2</span></a>')
    bal = balance_tile() if state != "empty-v6" else balance_tile(n="0")
    body = f'<div class="body"><div class="grid" style="grid-template-columns:1fr 1fr">{bal}{account_tile()}</div>{act}</div>'
    return page(f'<div class="shell">{hdr}{body}</div>', 1440)


BADGE_TAB = '<span style="position:relative">Wallet<span style="position:absolute;top:-30px;left:26px;min-width:16px;height:16px;border-radius:8px;background:var(--uv);color:var(--uv-ink);font:600 10px/16px var(--mono);text-align:center;padding:0 4px">2</span></span>'


def wallet_phone():
    body = (tile(th("balance", "private") + kpi("", "3.5", "tYACA", lg=True) + f'<div class="col" style="gap:8px;margin-top:12px">{btn("Send", "primary full")}{btn("Bridge to Ethereum", "full")}{btn("Bridge from Ethereum", "full")}</div>')
            + tile(th("activity", "5") + '<div class="col" style="gap:10px">' + ROW_EXIT_PROVING + ROW_DEPOSIT_READY + "</div>"))
    html = page(phone(body, "wallet", right='<span class="pill mining"><i></i>mining</span>'), 390, height=844)
    return html.replace("Wallet</a>", BADGE_TAB + "</a>", 1)
