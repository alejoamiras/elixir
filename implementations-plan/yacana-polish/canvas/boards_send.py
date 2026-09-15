"""Send to an account: the private transfer inside Aztec, in the same transaction dialog."""
from lib import amount, btn, dialog, dialog_page, note, page, quiet, srow, steps
from boards_signin import head

W = 440
ADDR = "0x1a2b7f3e9c0d4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9c8d"
ADDR_FIELD = f'<div class="field on" style="height:auto;min-height:38px;padding:8px 12px;font-size:12px;word-break:break-all;line-height:1.4">{ADDR}</div>'


def seg(mode: str) -> str:
    on, off = ("Privately", "Publicly") if mode == "private" else ("Publicly", "Privately")
    a = f'<span class="on">{on}</span>' if mode == "private" else f'<span>{off}</span>'
    b = f'<span>{off}</span>' if mode == "private" else f'<span class="on">{on}</span>'
    return f'<div class="row sb" style="padding:9px 0;border-top:1px solid var(--line);font-size:13px"><span class="ink2">How</span><div class="seg" style="font-size:12.5px">{a}{b}</div></div>'


def send_form(mode: str = "private", unknown: bool = False):
    vis = "nothing; a private transfer" if mode == "private" else "the amount and the address, to anyone"
    warn = ""
    if unknown:
        warn = note("Nothing on the chain knows that address as an account.", "Sent privately, it could never be read there. Confirm the address with the recipient before sending.", "warn")
    if mode == "public":
        warn = note("This will be public.", "0x1a2b…9c8d receives 1 tYACA into a public balance. The amount and the address are readable by anyone.", "warn")
    how = "privately" if mode == "private" else "publicly"
    inner = (head("send", "Send to an account.")
             + amount("1.00", "tYACA", on=True) + '<div class="under"><span>balance 3.5 tYACA</span></div>'
             + f'<div class="col" style="gap:6px"><span class="lm">to</span>{ADDR_FIELD}</div>'
             + seg(mode) + warn
             + srow("Fee", "none · Yacana sponsors it")
             + srow("Visible", vis)
             + f'<div class="row sb" style="margin-top:4px">{btn(f"Send 1 tYACA {how}", "uv lg")}{quiet("Cancel")}</div>'
             + '<p class="x2 mono ink3">proves in your browser, about 20 s · mining pauses meanwhile</p>')
    return dialog_page(inner)


def send_errors():
    """The four refusals of the form, each under the field it belongs to; the button waits."""
    def form(amt, under_amt, addr, under_addr):
        ua = f'<div class="under"><span class="bad">{under_amt}</span><span>balance 3.5 tYACA</span></div>' if under_amt else '<div class="under"><span>balance 3.5 tYACA</span></div>'
        fa = f'<div class="field on" style="border-color:var(--bad);font-size:12px;word-break:break-all">{addr}</div>' if under_addr else f'<div class="field on" style="font-size:12px;word-break:break-all">{addr}</div>'
        ub = f'<div class="under"><span class="bad">{under_addr}</span></div>' if under_addr else ""
        return dialog(head("send", "Send to an account.") + amount(amt, "tYACA", on=True) + ua
                      + f'<div class="col" style="gap:6px"><span class="lm">to</span>{fa}{ub}</div>' + seg("private")
                      + f'<div class="row sb" style="margin-top:4px">{btn("Send", "uv lg dis")}{quiet("Cancel")}</div>', W)
    own = "0x22a9db41c7e3f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f612a"
    d1 = form("0.00", "Enter an amount.", ADDR, "")
    d2 = form("5.00", "More than your balance.", ADDR, "")
    d3 = form("1.00", "", own, "That's this account.")
    d4 = form("1.00", "", "0x1a2b7f", "Not an Aztec address: 66 characters, starting with 0x.")
    body = ('<div class="board"><span class="lm">send · the four refusals</span>'
            '<p>Each refusal sits under its field the moment it is known (on blur for the address, on input for the amount); the button waits. The same checks run again on the exact values submitted.</p>'
            f'<div class="grid" style="grid-template-columns:repeat(2,{W}px);gap:22px;align-items:start">{d1}{d2}{d3}{d4}</div></div>')
    return page(body, 2 * W + 100)


def send_sent():
    inner = (head("send", "1 tYACA sent.")
             + steps([("Proved privately", "done", "20 s"), ("Sent", "done", "block 83,140", "1 tYACA to 0x1a2b…9c8d, privately. Your balance: 2.5 tYACA.")])
             + '<p class="xs ink3" style="border-top:1px solid var(--line);padding-top:12px">Final once its epoch is proven, usually within the hour.</p>'
             + f'<div class="row sb" style="margin-top:4px">{btn("Done", "primary")}</div>')
    return dialog_page(inner)
