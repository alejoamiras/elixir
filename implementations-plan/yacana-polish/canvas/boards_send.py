"""Send to an account: the private transfer inside Aztec, in the same transaction dialog."""
from lib import amount, btn, dialog, dialog_page, field, note, page, quiet, srow, steps
from boards_signin import head

W = 440


def seg(mode: str) -> str:
    on, off = ("Privately", "Publicly") if mode == "private" else ("Publicly", "Privately")
    a = f'<span class="on">{on}</span>' if mode == "private" else f'<span>{off}</span>'
    b = f'<span>{off}</span>' if mode == "private" else f'<span class="on">{on}</span>'
    return f'<div class="row sb" style="padding:9px 0;border-top:1px solid var(--line);font-size:13px"><span class="ink2">How</span><div class="seg" style="font-size:12.5px">{a}{b}</div></div>'


def send_form(mode: str = "private", unknown: bool = False):
    vis = "nothing; a private transfer" if mode == "private" else "the amount and the address, to anyone"
    warn = ""
    if unknown:
        warn = note("Nothing on the chain knows that address as an account.", "Sent privately, it could never be read there. Check the address, or send publicly.", "warn")
    if mode == "public":
        warn = note("This will be public.", "0x1a2b…9c8d receives 1 tYACA into a public balance. The amount and the address are readable by anyone.", "warn")
    how = "privately" if mode == "private" else "publicly"
    inner = (head("send", "Send to an account.")
             + amount("1.00", "tYACA", on=True) + '<div class="under"><span>balance 3.5 tYACA</span></div>'
             + f'<div class="col" style="gap:6px"><span class="lm">to</span>{field("0x1a2b7f…9c8d", on=True)}</div>'
             + seg(mode) + warn
             + srow("Fee", "none · Yacana sponsors it")
             + srow("Visible", vis)
             + f'<div class="row sb" style="margin-top:4px">{btn(f"Send 1 tYACA {how}", "uv lg")}{quiet("Cancel")}</div>')
    return dialog_page(inner)


def send_sent():
    inner = (head("send", "1 tYACA sent.")
             + steps([("Proved privately", "done", "20 s"), ("Sent", "done", "block 83,140", "1 tYACA to 0x1a2b…9c8d, privately. Your balance: 2.5 tYACA.")])
             + '<p class="xs ink3" style="border-top:1px solid var(--line);padding-top:12px">Final once its epoch is proven, usually within the hour.</p>'
             + f'<div class="row sb" style="margin-top:4px">{btn("Done", "primary")}</div>')
    return dialog_page(inner)
