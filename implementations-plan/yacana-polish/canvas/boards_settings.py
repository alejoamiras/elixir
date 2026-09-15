"""Settings: Network in place, Mining, Alerts, Account, Appearance, About; the node-change states; the old origin's."""
from lib import btn, field, header, kv, page, quiet, srl, st, steps, switch, th, tile

HOSTS = {"aztec": ("Aztec node", "v5.testnet.rpc.aztec-labs.com", "block 83,117 · 12 s ago"),
         "eth": ("Ethereum RPC", "ethereum-sepolia-rpc.publicnode.com", "Sepolia · 0.4 s")}
SLIDER = ('<div class="row sb"><span class="lm">power</span><span class="x2 mono ink3">11 threads</span></div>'
          '<div class="slider"><i style="width:100%"></i><b style="left:100%"></b></div>'
          '<div class="ticks"><span>eco · 3</span><span>balanced · 6</span><span class="uv2">max · 11</span></div>')


def _tiers(label: str, chip: str, host: str, tag: str, detail: str, right: str) -> str:
    """Line 1 what and how it is; line 2 which host; line 3 the numbers, small."""
    t = f' {tag}' if tag else ""
    return (f'<div class="srl"><div><div class="k row" style="gap:10px;align-items:center">{label}{chip}</div>'
            f'<div class="h" style="margin-top:6px"><span class="mono ink2">{host}</span>{t}</div>'
            f'<div class="h x2 mono ink3" style="margin-top:4px">{detail}</div></div>{right}</div>')


def _edit(label: str, value: str, help_: str, busy: bool = False, cls: str = "") -> str:
    buttons = (btn("Saving…", "primary sm dis", busy=True) if busy else btn("Save", "primary sm") + btn("Cancel", "ghost sm"))
    return (f'<div class="srl" style="flex-direction:column;align-items:stretch;gap:8px"><div class="k">{label}</div>'
            f'<div class="row" style="gap:8px">{field(value, on=not busy)}{buttons}</div>'
            f'<div class="h {cls}">{help_}</div></div>')


def node_row(state: str = "read", kind: str = "aztec") -> str:
    label, host, health = HOSTS[kind]
    if state == "read":
        return _tiers(label, st("healthy", "ok"), host, '<span class="ink3">· default</span>', health, btn("Change", "sm"))
    if state == "edit":
        return _edit(label, "https://my-node.example.net", f'Any https node on this deployment. {quiet("Use the default")}')
    if state == "checking":
        return (f'<div class="srl" style="flex-direction:column;align-items:stretch;gap:8px"><div class="k">{label}</div>'
                f'<div class="row" style="gap:8px">{field("https://my-node.example.net")}{btn("Saving…", "primary sm dis", busy=True)}</div>'
                + steps([("Reachable", "done", "0.6 s"), ("This deployment", "done", ""), ("Switching", "on", "about a minute", "Rebuilding your view of the chain from the new node. Mining pauses until it's done.")])
                + "</div>")
    if state == "error":
        return _edit(label, "https://other.example.net", f"Not this deployment's node (it serves rollup 1782110044). Kept {host}.", cls="bad")
    if state == "failed":
        return _edit(label, "https://my-node.example.net", f"Couldn't rebuild your view from my-node.example.net: it stopped answering. Kept {host}.", cls="bad")
    if state == "silent":
        return _tiers(label, st("no answer · 2 min", "warn"), host, "", "your view is from 14:02 · mining paused",
                      f'<span class="row" style="gap:8px">{btn("Retry", "sm")}{btn("Change", "sm")}</span>')
    if state == "limited":
        return _tiers(label, st("throttled", "warn"), host, "", "block 83,117 · 40 s ago · public nodes throttle busy pages; it recovers on its own", btn("Change", "sm"))
    # custom, in use
    return _tiers(label, st("healthy", "ok"), "my-node.example.net", f'<span class="badge uv" style="padding:1px 6px">custom</span> {quiet("Use the default")}',
                  "block 83,118 · 4 s ago", btn("Change", "sm"))


STAY_OPEN = "On: anyone who can use this browser could open and spend from this account without your passkey. Off: one touch per open."


def settings():
    network = tile(th("network") + node_row("read", "aztec") + node_row("read", "eth"))
    mining = tile(th("mining") + f'<div class="srl" style="flex-direction:column;align-items:stretch;gap:8px">{SLIDER}<div class="h">Applies when proving in the browser; one core stays with the page. With Presto connected, Presto\'s own setting decides.</div></div>'
                  + srl("Presto", "✦ native prover, several times faster · not installed", quiet("Get Presto ↗"))
                  + srl("Pause on battery", "", switch(False)) + srl("Keep proving in a background tab", "", switch(True))
                  + srl("Resume mining when the page opens", "", switch(False)))
    alerts = tile(th("alerts") + srl("Notify on a win", "no amounts in the notification", switch(False)) + srl("Sound on a win", "", switch(False))
                  + srl("Report in the tab title and icon", "", switch(True)) + srl("Mini window", "picture-in-picture", switch(False)))
    account = tile(th("account") + srl("0x22a9db…612a", "passkey", btn("Sign out", "sm"))
                   + srl("Stay open on this device", STAY_OPEN, switch(False)))
    appearance = tile(th("appearance") + '<div class="seg"><span class="on">Dark</span><span>Light</span><span>System</span></div>')
    about = tile(th("about") + kv("source", "0d9d1ea1db43") + kv("build", "production") + kv("bb.js", "5.2.0") + kv("relying party", "yacana.network")
                 + '<p class="xs ink3" style="margin-top:12px;text-wrap:pretty">Yacana runs in your browser. Whoever serves this page controls it; the source is public — run your own build if that matters. <a class="uv2" href="#">More on /faq ↗</a></p>')
    hdr = header("settings", account="0x22a9…612a")
    hdr = hdr.replace('<span class="gear">', '<span class="gear" style="border-color:var(--ink);color:var(--ink)">')
    body = (f'<div class="body"><div class="grid" style="grid-template-columns:1fr 1fr">'
            f'<div class="col" style="gap:14px">{network}{mining}</div><div class="col" style="gap:14px">{alerts}{account}{appearance}{about}</div></div></div>')
    return page(f'<div class="shell">{hdr}{body}</div>', 1440)


def old_settings():
    """v5.yacana.network's Settings: the node and RPC that make it work, the account, nothing about mining."""
    network = tile(th("network") + node_row("read", "aztec") + node_row("read", "eth"))
    account = tile(th("account") + srl("0x22a9db…612a", "passkey · the same account as yacana.network", btn("Sign out", "sm")))
    appearance = tile(th("appearance") + '<div class="seg"><span class="on">Dark</span><span>Light</span><span>System</span></div>')
    about = tile(th("about") + kv("this origin", "v5.yacana.network · retired") + kv("source", "0d9d1ea1db43") + kv("bb.js", "5.2.0")
                 + '<p class="xs ink3" style="margin-top:12px;text-wrap:pretty">The old app, kept so what is still on V5 can leave. Yacana runs in your browser; whoever serves this page controls it. <a class="uv2" href="#">More on /faq ↗</a></p>')
    hdr = header("settings", app="old", version="V5 · retired", account="0x22a9…612a", status=None)
    hdr = hdr.replace('<span class="gear">', '<span class="gear" style="border-color:var(--ink);color:var(--ink)">')
    body = (f'<div class="body" style="max-width:760px;margin:0 auto;width:100%"><div class="col" style="gap:14px">{network}{account}{appearance}{about}</div></div>')
    return page(f'<div class="shell">{hdr}{body}</div>', 1440)


def node_states():
    rows = [node_row(s) for s in ("read", "edit", "checking", "error", "failed", "custom", "silent", "limited")]
    body = ('<div class="board" style="padding:24px"><span class="lm">changing a node · in place, and the states after</span>'
            f'<div class="col" style="gap:14px;max-width:700px">{"".join(tile(r) for r in rows)}</div></div>')
    return page(body, 760)
