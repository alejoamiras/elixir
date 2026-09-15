"""The account dialog: start, create, log in, words, welcome back, opening, the errors; sign out."""
from lib import (btn, checkbox, checklist, dialog, dialog_page, field, note, quiet, page)

W = 440


def head(eyebrow: str, title: str, body: str = "") -> str:
    b = f"<p>{body}</p>" if body else ""
    return f'<div class="col" style="gap:8px"><span class="eyebrow">{eyebrow}</span><h2>{title}</h2>{b}</div>'


def links(*items: str) -> str:
    return '<div class="row wrap" style="gap:8px 18px">' + "".join(quiet(i) for i in items) + "</div>"


def start():
    inner = (head("account", "Mine with an account.", "Your balance lives in an account only you can open. It takes a tap.")
             + f'<div class="col" style="gap:10px">{btn("Create account", "uv lg full")}{btn("Log in", "lg full")}</div>'
             + links("Just watch for now"))
    return dialog_page(inner)


PASSKEY_NOTE = note("Your passkey is the only key.",
                    "Keep it in a password manager that syncs (iCloud Keychain, Google Password Manager, 1Password) and it opens this account on the devices that manager syncs to. Lose every copy and the account is lost; Yacana can't recover it.", "warn")


def create(error: bool = False):
    err = note("That didn't work.", "The passkey prompt was dismissed. Try again, or use 12 words.", "bad") if error else ""
    inner = (head("create account", "Create your account.",
                  "A passkey signs you in with your face, fingerprint or device PIN. Nothing to write down.")
             + PASSKEY_NOTE
             + checkbox("I understand my passkey is the only way into this account.", on=error)
             + err
             + btn("Continue with passkey", "uv lg full" + ("" if error else " dis"), icon="finger")
             + links("Use 12 words instead"))
    return page(f'<div style="padding:26px">{dialog(inner, W, back=True)}</div>', W + 52)


def login(old_origin: bool = False):
    n = note("Accounts are restored here, not created.", "The passkey or 12 words from yacana.network open it.", "uv") if old_origin else ""
    inner = (head("log in", "Welcome back.", "Log in with the passkey you created, or your 12 words.")
             + n + btn("Continue with passkey", "uv lg full", icon="finger") + links("Use 12 words instead"))
    return page(f'<div style="padding:26px">{dialog(inner, W, back=True)}</div>', W + 52)


WORDS = ["ripple", "canyon", "shadow", "velvet", "orbit", "maple", "signal", "harbor", "cobalt", "meadow", "lantern", "quartz"]


def words_create(confirm: bool = False):
    cells = "".join(f'<div style="display:flex;gap:8px;align-items:baseline;border:1px solid var(--line);border-radius:6px;padding:8px 10px;font:500 13px var(--mono)"><span class="ink4" style="font-size:10.5px">{i+1:02d}</span><span>{"••••••" if confirm else w}</span></div>'
                    for i, w in enumerate(WORDS))
    grid = f'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">{cells}</div>'
    conf = ""
    if confirm:
        inputs = "".join(f'<div class="col" style="gap:4px"><span class="lm">word {n}</span>{field(v, placeholder=not v, on=bool(v))}</div>'
                         for n, v in ((3, "shadow"), (7, "signal"), (11, "")))
        conf = f'<div class="col" style="gap:8px"><span class="sm ink2">Confirm: type words 3, 7 and 11. Paste is off here.</span><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">{inputs}</div></div>'
    inner = (head("create account · 12 words", "Write down your 12 words.",
                  "Made on this device, never sent anywhere. They are the only way back into this account.")
             + f'<div class="row sb"><span class="lm">your words</span>{btn("Copy", "sm")}</div>' + grid
             + checkbox("I've written them down.", on=confirm) + conf
             + btn("Finish setup", "uv lg full" + ("" if confirm else " dis")) + links("Back up later"))
    return page(f'<div style="padding:26px">{dialog(inner, W, back=True)}</div>', W + 52)


def words_login(error: bool = False):
    ta = ('<div class="field" style="height:auto;min-height:92px;align-items:flex-start;padding:10px 12px;line-height:1.6' + (';border-color:var(--bad)' if error else '') + '">'
          '<span>ripple canyon shadow velvet orbit maple signal harbor cobalt meadow lantern quartzz</span></div>' if error else
          '<div class="field" style="height:auto;min-height:92px;align-items:flex-start;padding:10px 12px;line-height:1.6">'
          '<span>ripple canyon shadow velvet orbit maple signal <span class="ph">…</span></span></div>')
    under = ('<div class="under"><span class="bad">Word 12 isn\'t in the list: check "quartzz".</span><span>12 of 12</span></div>' if error
             else '<div class="under"><span>7 of 12</span></div>')
    inner = (head("log in · 12 words", "Enter your 12 words.", "Type or paste the words you saved.")
             + '<p class="sm ink3">You\'re on <b class="ink2">yacana.network</b>. Yacana never asks for your words in chat, email or support.</p>'
             + ta + under
             + btn("Log in", "uv lg full" + (" dis" if error else "")) + links("Back"))
    return page(f'<div style="padding:26px">{dialog(inner, W, back=True)}</div>', W + 52)


def welcome(method: str = "passkey"):
    chip = (f'<div class="row sb" style="border:1px solid var(--line-2);border-radius:8px;padding:12px 14px">'
            f'<span class="row" style="gap:10px"><span class="acct" style="border:0;padding:0"><i></i>0x22a9db…612a</span></span>'
            f'<span class="x2 mono ink3">{"passkey" if method == "passkey" else "12 words"}</span></div>')
    primary = btn("Open with passkey", "uv lg full", icon="finger") if method == "passkey" else btn("Enter 12 words", "uv lg full")
    inner = head("account", "Welcome back.") + chip + primary + links("Just watch for now", "Use a different account")
    return dialog_page(inner)


def account_errors():
    """The six ways the account dialog fails, each a note under the button that stays."""
    d1 = dialog(head("create account", "Create your account.", "A passkey signs you in with your face, fingerprint or device PIN.")
                + note("That didn't work.", "The passkey prompt was dismissed. Try again, or use 12 words.", "bad")
                + btn("Continue with passkey", "uv lg full", icon="finger") + links("Use 12 words instead"), W, back=True)
    d2 = dialog(head("create account", "Create your account.", "A passkey signs you in with your face, fingerprint or device PIN.")
                + note("This device can't make a Yacana passkey.", "Its passkeys can't derive a key. Use 12 words instead; they work everywhere.", "bad")
                + btn("Use 12 words", "uv lg full") + links("Try another device"), W, back=True)
    d3 = dialog(head("create account", "Create your account.", "A passkey signs you in with your face, fingerprint or device PIN.")
                + note("This browser has no passkeys.", "Use a current Chrome, Safari, Edge or Firefox; or use 12 words.", "bad")
                + btn("Use 12 words", "uv lg full") + links("Back"), W, back=True)
    d4 = dialog(head("log in", "Welcome back.", "Log in with the passkey you created, or your 12 words.")
                + note("No passkey for Yacana on this device.", "Log in on the device that has it, or enter your 12 words if the account has them.", "bad")
                + btn("Continue with passkey", "uv lg full", icon="finger") + links("Use 12 words instead"), W, back=True)
    d5 = dialog(head("log in", "Welcome back.")
                + '<div class="row sb" style="border:1px solid var(--line-2);border-radius:8px;padding:12px 14px"><span class="acct" style="border:0;padding:0"><i></i>0x22a9db…612a</span><span class="x2 mono ink3">passkey</span></div>'
                + note("That passkey belongs to a different account.", "This browser holds 0x22a9…612a. Sign that account out first to switch; it asks about backup before it goes.", "warn")
                + btn("Open with passkey", "uv lg full", icon="finger") + links("Use a different account", "Just watch for now"), W)
    d6 = dialog(head("account", "Opening your account.")
                + note("Another tab holds this account.", "Close it, or continue here; that tab stops mining.", "warn")
                + f'<div class="row" style="gap:10px">{btn("Continue here", "uv")}{btn("Cancel", "ghost")}</div>', W, close=False)
    body = ('<div class="board"><span class="lm">the account dialog · every failure</span>'
            '<p>Each failure is one note under the button, one line what happened and one what to do. The button stays. Where a passkey cannot work on this device, the primary becomes the words.</p>'
            f'<div class="grid" style="grid-template-columns:repeat(3,{W}px);gap:22px;align-items:start">{d1}{d2}{d3}{d4}{d5}{d6}</div></div>')
    return page(body, 1440)


def opening(stage: int = 3):
    items = [("Passkey confirmed", "done", ""),
             ("Preparing your miner", "done" if stage > 2 else "on", "first time only"),
             ("Syncing your private balance", "on" if stage == 3 else ("done" if stage > 3 else "todo"), "block 83,102 of 83,117" if stage == 3 else ""),
             ("Ready to mine", "done" if stage > 3 else "todo", "")]
    bar = ""
    if stage == 2:
        items[1] = ("Preparing your miner", "on", "13 of 20 MB")
        items[2] = ("Syncing your private balance", "todo", "")
        bar = '<div class="bar"><i style="width:64%"></i></div>'
    elif stage == 3:
        bar = '<div class="bar"><i style="width:91%"></i></div>'
    sub = ('<p class="sm ink3">Reading your notes from the chain. Usually under a minute; the first time takes longer.</p>'
           if stage == 3 else ('<p class="sm ink3">Kept on this device; next time this step is skipped.</p>' if stage == 2 else ""))
    inner = (head("account", "Opening your account.")
             + checklist(items) + bar + sub
             + '<div class="row sb" style="border-top:1px solid var(--line);padding-top:14px"><span class="xs ink3">Mining starts when this finishes. Cancel keeps you watching the chain.</span>'
             + btn("Cancel", "sm") + "</div>")
    return page(f'<div style="padding:26px">{dialog(inner, W, close=False)}</div>', W + 52)


def opening_error(kind: str = "prover"):
    if kind == "prover":
        items = [("Passkey confirmed", "done", ""), ("Preparing your miner", "bad", "download failed"), ("Syncing your private balance", "todo", ""), ("Ready to mine", "todo", "")]
        n = note("The miner's files didn't download.", "The connection dropped at 13 of 20 MB. Retry keeps what arrived.", "bad")
        act = f'<div class="row" style="gap:10px">{btn("Retry", "uv")}{btn("Cancel", "ghost")}</div>'
    else:
        items = [("Passkey confirmed", "done", ""), ("Preparing your miner", "done", ""), ("Syncing your private balance", "bad", "no answer for 2 min"), ("Ready to mine", "todo", "")]
        n = note("The Aztec node isn't answering.", "v5.testnet.rpc.aztec-labs.com stopped answering, or is rate-limiting this page. Retry, or use another node.", "bad")
        act = f'<div class="row" style="gap:10px">{btn("Retry", "uv")}{btn("Change node", "ghost")}{btn("Cancel", "ghost")}</div>'
    inner = head("account", "Opening your account.") + checklist(items) + n + act
    return page(f'<div style="padding:26px">{dialog(inner, W, close=False)}</div>', W + 52)


def signout(method: str = "passkey", mining: bool = True):
    tail = " Mining stops." if mining else ""
    if method == "passkey":
        body = "Your passkey logs you back in. Your balance stays with the account." + tail
        buttons = f'<div class="row" style="gap:10px">{btn("Sign out", "danger")}{btn("Cancel", "ghost")}</div>'
    elif method == "words":
        body = "Your 12 words log you back in. Your balance stays with the account." + tail
        buttons = f'<div class="row" style="gap:10px">{btn("Sign out", "danger")}{btn("Cancel", "ghost")}</div>'
    else:
        body = "Your 12 words are the only way back in, and they are not backed up yet. Yacana keeps no copy."
        buttons = f'<div class="row" style="gap:10px">{btn("Back up my 12 words", "uv")}{btn("Cancel", "ghost")}</div>' + '<p class="x2 mono ink3">sign out anyway · after the backup</p>'
    inner = head("account · 0x22a9db…612a", "Sign out?", body) + buttons
    return dialog_page(inner)


def signout_hold():
    inner = (head("account · 0x22a9db…612a", "Sign out?", "Your passkey logs you back in. Your balance stays with the account.")
             + '<div class="col" style="gap:6px"><span class="btn danger full" style="position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:58%;background:rgba(229,98,79,.18)"></span><span style="position:relative">Hold to sign out</span></span>'
             + '<div class="under"><span>hold 1.2 s · release to cancel</span><span><a href="#">sign out with a click</a></span></div></div>'
             + btn("Cancel", "ghost"))
    return dialog_page(inner)
