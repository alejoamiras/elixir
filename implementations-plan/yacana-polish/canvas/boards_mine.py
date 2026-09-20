"""The Mine cockpit: signed out, idle, mining (the chart fixed), Presto states, ended; the upgrade card."""
from lib import alert, btn, header, kpi, kv, page, quiet, st, th, tile, trail

LEDGER_LIVE = ('<ol class="ledger">'
               '<li class="win"><span class="t">16:07:40</span><span class="g">★</span><span>#12 score 2.8 · 3.61 s · <b class="uv2">a win</b> · claiming: proving in your browser, about 20 s</span></li>'
               '<li><span class="t">16:07:36</span><span class="g"></span><span>#11 score 1.2 · 3.60 s</span></li>'
               '<li class="ep"><span class="t">16:07:12</span><span class="g">──</span><span>epoch 12 opened · bar 1.6 (×0.83)</span></li>'
               '<li class="ok"><span class="t">16:06:58</span><span class="g">✓</span><span>minted in block <a href="#">83,164 ↗</a> · 4 tYACA, privately</span></li>'
               '<li><span class="t">16:06:31</span><span class="g"></span><span>#9 score 1.9 · 3.72 s</span></li></ol>')
LEDGER_ENDED = ('<ol class="ledger">'
                '<li class="ep"><span class="t">14:02:11</span><span class="g">──</span><span>epoch 41 closed · the last on V5</span></li>'
                '<li class="ok"><span class="t">13:58:12</span><span class="g">✓</span><span>minted in block <a href="#">91,204 ↗</a> · 4 tYACA, privately</span></li>'
                '<li class="win"><span class="t">13:57:50</span><span class="g">★</span><span>#40 score 2.1 · 3.62 s · <b class="uv2">a win</b></span></li>'
                '<li><span class="t">13:57:46</span><span class="g"></span><span>#39 score 1.1 · 3.60 s</span></li></ol>')
LEDGER_EMPTY = '<ol class="ledger"><li class="ep"><span class="t">16:04:12</span><span class="g">──</span><span>epoch 12 opened · bar 1.0</span></li></ol>'


def chart(mining: bool, foot: str = "3.6 s per proof · 12 proofs", window: str = "now") -> str:
    """The score loop: the bar as a step line, a tick at the epoch close, the win a ring with a short drop above the bar."""
    if not mining:
        return ('<div class="ph-chart">Your proofs draw here once you start.<br><span class="ink3" style="display:inline-block;margin-top:6px">The bar is 1.0 · clear it to win</span></div>')
    w, h = 730, 170
    # bar: 2.0 until x=430 (epoch close), then 1.6; y for 2.0 = 60, for 1.6 = 84, baseline 1.0 at y=140
    dots = "".join(f'<line x1="{x}" y1="{y}" x2="{x}" y2="140" stroke="rgba(242,239,233,.28)" stroke-width="1.5"/>'
                   for x, y in ((120, 118), (180, 126), (250, 110), (320, 130), (390, 121), (540, 128), (610, 119), (680, 124)))
    return (f'<svg viewBox="0 0 {w} {h}" style="width:100%;height:auto;display:block" role="img" aria-label="your proofs, live">'
            f'<line x1="40" y1="140" x2="{w-10}" y2="140" stroke="rgba(242,239,233,.14)"/>'
            f'{dots}'
            f'<path d="M40 60 H430 V84 H{w-10}" fill="none" stroke="#8c6bff" stroke-width="2"/>'
            f'<line x1="430" y1="22" x2="430" y2="140" stroke="rgba(232,181,77,.7)" stroke-dasharray="3 3"/>'
            f'<text x="436" y="30" fill="#e8b54d">epoch 12 · bar 2.0 → 1.6</text>'
            f'<line x1="470" y1="52" x2="470" y2="76" stroke="rgba(242,239,233,.28)" stroke-width="1.5"/>'
            f'<circle cx="470" cy="44" r="6" fill="#0a0a0b" stroke="#b39dff" stroke-width="2"/>'
            f'<text x="484" y="49" fill="#b39dff">★ 2.8 · a win</text>'
            f'<text x="10" y="64">2.0</text><text x="10" y="88">1.6</text><text x="10" y="144">1</text>'
            f'<text x="{w-10}" y="100" text-anchor="end" fill="rgba(242,239,233,.5)">the bar · clear it to win</text>'
            f'<text x="40" y="162">{foot}</text><text x="{w-10}" y="162" text-anchor="end">{window}</text>'
            '</svg>')


NATIVE = ("mining", "presto")
LIVE = ("mining", "presto", "presto-fallback", "presto-blocked")


def loop_tile(state: str) -> str:
    if state == "ended":
        inner = (th("mining ended on v5 · sep 18 14:02")
                 + '<div class="ph-chart">Mining moved to V6 at yacana.network.<br><span class="ink3" style="display:inline-block;margin-top:6px">Your proofs from this session stay below.</span></div>')
        return tile(inner, "loop")
    foot = "3.6 s per proof · " + ("✦ presto · " if state == "presto" else "") + "12 proofs"
    if state in LIVE:
        claiming = st("claiming · proving · 12 s", "on") if state == "mining" else ""
        right = f'{claiming}{btn("Stop", "sm")}'
        head = "live · since 16:05"
    else:
        right = btn("Start mining", "uv sm")
        head = "your proofs"
    inner = th(head, right) + chart(state in LIVE, foot)
    return tile(inner, "loop")


def rail_tile(state: str) -> str:
    on = state in LIVE
    if state == "ended":
        rows = kv("wins", "4 of 4") + kv("bar", "1.6") + kv("closed", "Sep 18 14:02")
        return tile(th("epoch 41", "the last on V5") + '<div class="rail"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></div>' + rows)
    seg = '<div class="rail"><i class="me"></i><i class="on"></i><i></i><i></i></div>' if on else '<div class="rail"><i></i><i></i><i></i><i></i></div>'
    rows = (kv("wins", "2 of 4" if on else "0 of 4") + kv("bar", "1.6" if on else "1.0")
            + kv("open for", "3 min") + kv("expected close", "5 min") + kv("next bar if it closed now", "×0.62") + kv("anyone can close it", "in 4 min"))
    if state == "presto":
        power = ('<div class="presto" style="margin-top:14px"><span class="glyph">✦</span><div><b>Presto · native prover</b><span>proving on this machine · <a class="uv2" href="#">About Presto ↗</a></span></div></div>')
    else:
        power = ('<div class="row sb" style="margin-top:14px"><span class="lm">power</span><span class="x2 mono ink3">11 threads</span></div>'
                 '<div class="slider"><i style="width:100%"></i><b style="left:100%"></b></div>'
                 '<div class="ticks"><span>eco · 3</span><span>balanced · 6</span><span class="uv2">max · 11</span></div>')
    return tile(th("epoch 12", "opened 16:07:12") + seg + rows + power)


def kpis(state: str) -> str:
    on = state in LIVE or state == "ended"
    return ('<div class="grid" style="grid-template-columns:repeat(3,1fr)">'
            + tile(kpi("rate", "16.2" if on else "—", "proofs/min", "12 proofs this session" if on else "starts with mining"))
            + tile(kpi("next win, at this rate", "~7" if state in LIVE else "—", "s" if state in LIVE else "", "could be now, could be 3× longer" if state in LIVE else ("the bar is 1.0 · about 1 proof per win" if state != "ended" else "")))
            + tile(kpi("best this epoch", "2.8" if on else "—", "of 1.6" if on else "", "1 win · 4 tYACA this session" if on else ""))
            + "</div>")


def balance_tile(state: str, n: str = "3.5") -> str:
    if state == "signed-out":
        inner = th("balance", "private") + kpi("", "—", "tYACA", lg=True) + f'<p class="sm ink2" style="margin-top:10px">Your balance shows once you log in.</p><div style="margin-top:12px">{quiet("Log in")}</div>'
    else:
        inner = th("balance", "private") + kpi("", n, "tYACA", lg=True) + f'<div class="row" style="gap:10px;margin-top:14px">{btn("Send", "primary")}{btn("Wallet →", "ghost")}</div>'
    return tile(inner)


def cockpit(state: str, top: str = "", balance: str = "3.5") -> str:
    status = "mining" if state in LIVE else ("ended" if state == "ended" else "")
    hdr = header("mine", account=None if state == "signed-out" else "0x22a9…612a", status=status if state != "signed-out" else "")
    if state == "presto":
        hdr = hdr.replace('<i></i>mining</span>', '<i></i>mining <span class="uv2">✦ presto</span></span>')
    ledger = LEDGER_ENDED if state == "ended" else (LEDGER_LIVE if state in LIVE else LEDGER_EMPTY)
    body = (f'<div class="body">{top}<div class="cockpit">{loop_tile(state)}{rail_tile(state)}'
            f'{kpis(state)}{balance_tile(state, balance)}'
            f'<div class="span2">{tile(th("proofs, newest first", "★ win · claiming · ✓ minted, final once its epoch is proven · ── epoch") + ledger)}</div></div></div>')
    return page(f'<div class="shell">{hdr}{body}</div>', 1440)


def presto_row() -> str:
    """Presto's own billboard (the presto-banners web component, as today); drawn as a stand-in."""
    return ('<div class="presto" style="padding:14px 16px;gap:16px"><span class="glyph" style="width:36px;height:36px;font-size:19px">✦</span>'
            '<div style="flex:1"><b style="font-size:15px">Mine faster with Presto.</b><span>A native prover on this machine, several times faster than the browser. Free, open source.</span></div>'
            f'<span class="row" style="gap:12px;white-space:nowrap">{btn("Get Presto ↗", "uv sm")}<a class="x2 mono ink3" href="#">not now</a></span></div>'
            '<p class="x2 mono ink3" style="margin:6px 0 0">Presto\'s own billboard, the presto-banners component as today</p>')


BLOCKED = "Your browser blocked local access, so this page can't reach Presto. Allow local network access for this site, then retry. Mining in the browser meanwhile."
GONE = "Presto stopped answering. Proving in the browser; retry when it's back."


def presto_notice(text: str, tone: str = "warn", retry: bool = True) -> str:
    return alert(text, tone, "", retry)


PRESTO_REASONS = [
    ("denied", "warn", "Presto hasn't approved yacana.network yet.", "Approve it in the Presto app, then retry. Proving in the browser meanwhile.", True),
    ("cooldown", "warn", "Presto is in a cooldown after a denial.", "Approve yacana.network in the app; Retry works once the cooldown ends, about a minute.", True),
    ("busy", "warn", "Presto is busy: three proofs in a row refused.", "Proving in the browser; Retry tries it again.", True),
    ("invalid proof", "warn", "Presto returned a winning proof that didn't verify.", "Proving in the browser; check the Presto install, then retry.", True),
    ("malformed", "warn", "Presto answered with something this page couldn't use.", "Proving in the browser; Retry tries it again.", True),
    ("update", "warn", "Presto needs an update for this app.", "Open Presto from your menu bar and let it update, then retry.", True),
    ("encrypted off", "warn", "Presto's encrypted connection is off.", "Presto › Settings › Encrypted Connection, then retry.", True),
    ("gone", "warn", "Presto stopped answering.", "Proving in the browser; retry when it's back.", True),
    ("downloading", "info", "Presto is fetching its prover for Aztec 5.2.0.", "The first native proof waits for it; the rate stalls until then.", False),
    ("blocked (probe)", "warn", "Your browser blocked local access, so this page can't reach Presto.", "Allow local network access for this site, then retry. Mining in the browser meanwhile.", True),
    ("bad report (probe)", "warn", "Presto answered, but not with a health report this page understands.", "Proving in the browser; Retry asks again.", True),
]


def presto_reasons():
    """Presto's row, one line per reason the SDK reports (presto.ts causeText, statusText, noticeFor)."""
    rows = ""
    for key, tone, title, body, retry in PRESTO_REASONS:
        rows += (f'<div class="col" style="gap:6px"><span class="lm">{key}</span>'
                 f'{presto_notice(f"{title} {body}", "uv" if tone == "info" else "warn", retry)}</div>')
    body = ('<div class="board" style="padding:24px"><span class="lm">presto · the banner for every reason it steps aside</span>'
            '<p>A banner under the header, in today\'s notice shape, never inside the chart or the epoch tile. The pill says what actually proved (✦ only on a native proof). Every fallback keeps mining in the browser and says why in one line; Retry rebuilds the prover. "downloading" is the one that is not a fault. Start mining never waits for the probe (it runs beside the first proofs); the row ↔ slider swap in the epoch tile follows the sticky state, not one refused proof; only the pill\'s ✦ follows what proved.</p>'
            f'<div class="col" style="gap:14px;max-width:700px">{rows}</div></div>')
    return page(body, 760)


CLAIM_CHIPS = [
    ("proving", st("claiming · proving · 12 s", "on") + btn("Stop", "sm")),
    ("sent", st("claiming · sent · 41 s", "on") + btn("Stop", "sm")),
    ("in a block", st("claiming · in a block · 58 s", "on") + btn("Stop", "sm")),
    ("Stop pressed meanwhile", st("stopping · claim finishing · 61 s", "on") + btn("Stop", "sm dis")),
]
WIN = '#12 score 2.8 · 3.61 s · <b class="uv2">a win</b>'
CLAIM_LINES = [
    ("proving", "win", "★", f"{WIN} · claiming: proving in your browser, about 20 s"),
    ("proving · Presto", "win", "★", f"{WIN} · claiming: proving through Presto ✦"),
    ("sent", "win", "★", f"{WIN} · claiming: sent to the node · drops in 9:41 if no block takes it"),
    ("in a block", "win", "★", f"{WIN} · claiming: in a block · syncing the note"),
    ("minted", "ok", "✓", 'minted in block <a href="#">83,164 ↗</a> · 4 tYACA, privately'),
    ("the epoch closed first (reverted)", "win", "★", f"{WIN} · <span class=\"warn\">didn't land: the epoch closed first · the sponsor paid, your proof is unspent · re-syncing, about a minute</span>"),
    ("refused at simulation", "win", "★", f"{WIN} · <span class=\"warn\">didn't go out: the epoch closed before it was sent · nothing paid · mining continues</span>"),
    ("expired", "win", "★", f"{WIN} · <span class=\"warn\">dropped: no block took it in 10 min · nothing paid · mining continues</span>"),
    ("delivery blocked", "win", "★", f"{WIN} · <span class=\"warn\">didn't land: an earlier reverted claim blocks this account · claims wait for Ethereum's finality, about 40 min</span>"),
    ("other", "win", "★", f"{WIN} · <span class=\"warn\">claim failed: &lt;the error's first line&gt; · mining paused</span> · <a href=\"#\">Retry</a>"),
    ("discarded before the claim", "win", "★", f"{WIN} · <span class=\"ink3\">not claimed: the epoch closed before the claim went out</span>"),
]
CLAIM_BANNERS = [
    ("re-syncing (recovering)", alert("A claim reverted: someone closed the epoch first. Re-syncing this account from the chain; mining resumes in about a minute.", "uv", "", False)),
    ("claims paused until finality", alert("Claims from this account wait until the reverted one is final on Ethereum. Mining resumes about 16:48.", "warn", "in 38 min", False)),
]


def claim_outcomes():
    """A claim on Mine: the chip per step, the ledger line per outcome, the two banners after a lost race."""
    chips = "".join(f'<div class="col" style="gap:6px"><span class="lm">{k}</span>{tile(th("live · since 16:05", r), "", "padding:12px 16px 4px")}</div>' for k, r in CLAIM_CHIPS)
    lines = "".join(f'<div class="col" style="gap:6px"><span class="lm">{k}</span>{tile(f"<ol class=ledger><li class={c} style=white-space:normal><span class=t>16:07:40</span><span class=g>{g}</span><span>{t}</span></li></ol>", "", "padding:10px 16px")}</div>'
                    for k, c, g, t in CLAIM_LINES)
    banners = "".join(f'<div class="col" style="gap:6px"><span class="lm">{k}</span>{b}</div>' for k, b in CLAIM_BANNERS)
    body = ('<div class="board" style="padding:24px"><span class="lm">a claim · the chip, the ledger line, the banners</span>'
            '<p>The chip in the loop tile\'s header carries the claim\'s step and one clock counted from the win (proving → sent → in a block), and stays while Stop waits for the claim. The ledger line carries the same step, then one of seven outcomes: minted, the code\'s five failure classes (reverted, expired, delivery blocked, other, discarded) and a refusal at simulation, before anything was sent or paid. A lost race re-syncs the account (a banner under the header, mining paused a minute); a delivery still blocked after that waits for Ethereum\'s finality.</p>'
            f'<div class="col" style="gap:14px;max-width:700px">{chips}{lines}{banners}</div></div>')
    return page(body, 760)


def upgrade_card(kind: str = "announced", amount_s: str = "3.5 tYACA", chip: str = "ok") -> str:
    if kind == "announced":
        return tile('<div class="col" style="gap:10px"><span class="eyebrow">aztec v6 · expected around sep 18</span>'
                    '<h2 style="font-size:24px;letter-spacing:-.02em">Aztec upgrades to V6 around Sep 18.</h2>'
                    '<p class="md ink2" style="max-width:72ch;text-wrap:pretty">Mining continues here until then. Send your balance ahead when you\'re ready: V5 proves it out, it\'s held on Ethereum for V6, and you claim it on V6 with one tap. After the upgrade V5 keeps proving for a while, then stops without notice; send ahead before it does.</p>'
                    f'<div class="row" style="gap:14px">{btn("Send ahead", "uv")}{quiet("How it works")}</div></div>', "hi")
    if kind == "sent":
        return tile('<div class="col" style="gap:10px"><span class="eyebrow">aztec v6 · expected around sep 18</span>'
                    f'<h2 style="font-size:24px;letter-spacing:-.02em">{amount_s} sent ahead.</h2>'
                    '<p class="md ink2" style="max-width:72ch">Held on Ethereum for V6 once V5 proves it; you claim it on V6 with one tap. Wins mined since then stay here until you send them too.</p>'
                    + trail([("sent", "done"), ("reaching Ethereum", "on"), ("held for V6", "dim"), ("forwarded to V6", "dim"), ("claim on V6", "dim")])
                    + f'<div class="row" style="gap:14px;margin-top:4px">{btn("Send 1.2 tYACA ahead", "uv sm")}<span class="sm ink2">1.2 tYACA mined since</span>{quiet("Wallet · details")}</div></div>', "hi")
    chips = {"ok": st("V5 proved an epoch 12 min ago", "ok"), "warn": st("no proof from V5 for 3 h", "warn"), "bad": st("V5 stopped proving · Sep 21", "bad")}
    return tile('<div class="col" style="gap:10px"><div class="row sb wrap"><span class="eyebrow">aztec v6 is live · sep 18 14:02</span>' + chips[chip] + '</div>'
                '<h2 style="font-size:24px;letter-spacing:-.02em">Mining has ended on V5. Send what\'s left ahead.</h2>'
                '<p class="md ink2" style="max-width:72ch;text-wrap:pretty">V5 keeps proving for a while after an upgrade, then stops without notice. A send it proves is held on Ethereum for V6; one it never proves comes back here; what\'s still here when it stops can\'t leave.</p>'
                f'<div class="row" style="gap:14px">{btn(f"Send {amount_s} ahead", "uv")}{quiet("How it works")}</div></div>', "hi").replace('class="tile hi"', 'class="tile hi" style="border-color:var(--warn)"')


def mine_signed_out():
    return cockpit("signed-out")


def mine_idle():
    return cockpit("idle", top=presto_row())


def mine_mining():
    return cockpit("mining")


def mine_presto():
    return cockpit("presto")


def mine_presto_blocked():
    return cockpit("presto-blocked", top=presto_notice(BLOCKED))


def mine_presto_fallback():
    return cockpit("presto-fallback", top=presto_notice(GONE))


def mine_announced():
    return cockpit("mining", top=upgrade_card("announced"))


def mine_sent():
    return cockpit("mining", top=upgrade_card("sent"), balance="1.2")


def mine_flipped():
    return cockpit("ended", top=upgrade_card("flipped"))
