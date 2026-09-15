"""The boards that explain: principles, the IA map, the navigation options, the copy deck, the picks; the phone."""
from lib import ICONS, MARK, btn, header, page, phone, quiet, tabbar, tile, th, kpi, checklist, amount, srow

from boards_signin import head

RULES = [
    ("One account, one primary action.", "A browser holds one account. Every screen has one verb in colour; every alternative is a quiet link."),
    ("The sentence first, the mechanism one level down.", "A card says what is true and what happens next; \"How it works\" opens the stages; the contract's rules live on /faq#rules."),
    ("Say what happens next, not how the machine works.", "\"Reaches Ethereum usually within the hour\" beats \"proven to Ethereum with its epoch\". Balance, send, claim, bridge; not burn, exit, witness."),
    ("Risk only where the user can act, said once.", "The host-trust sentence lives on /faq and in Settings › About. A deadline sits beside the button that meets it."),
    ("Every wait is a stepper.", "Named stages, a checkmark per stage, a time expectation once, a bar where bytes or blocks are known. Never a spinner, never a label on a button as the only status."),
    ("Buttons are verb + noun and carry the amount.", "\"Bridge 3.5 tYACA\", \"Claim on Ethereum\", \"Send 3.5 tYACA ahead\". Sentence case, no period."),
    ("Deadlines are facts, not bets; nothing is \"safe\".", "\"By 14:03 (in 40 min)\" and what happens after it: \"If V5 misses it, the balance comes back here.\" A send is safe once V5 proves it; a balance on V5 never is, so the word never appears."),
    ("Settings edit in place.", "One field per value, Save probes it, the old value stays live until the probe passes, the error sits under the field."),
    ("Four destinations, a gear, an account chip.", "Icon + label on the phone, text tabs on the desktop; the logo is the app's home; Testnet is a neutral tag."),
    ("The old origin has one job.", "Get what's left out: the balance, one button, the activity, the settings that make it work. Nothing else."),
]


def principles():
    rules = "".join(f"<div><div><b>{t}</b><span>{s}</span></div></div>" for t, s in RULES)
    body = ('<div class="board"><span class="lm">yacana polish · the design pass · v2</span><h1>Ten rules, then the flows.</h1>'
            '<p>What the owner saw on the live site, turned into a design the app can be proud of. Read this board, then the flows left to right: account → mine → wallet → the transaction dialog → the upgrade → settings → navigation and the phone. Boards marked A/B/C are picks; the recommended one is outlined. Every sentence on a board was checked against the portal contract and the crossing journal.</p>'
            f'<div class="rules">{rules}</div></div>')
    return page(body, 1000)


def ia_map():
    def col(title, items, never):
        li = "".join(f'<span class="sm ink2">{i}</span>' for i in items)
        nv = f'<span class="x2 mono ink3" style="margin-top:6px">never: {never}</span>' if never else ""
        return f'<div class="col" style="gap:6px;border:1px solid var(--line);border-radius:8px;padding:14px;background:var(--raised)"><b style="font-size:14px">{title}</b>{li}{nv}</div>'
    body = ('<div class="board"><span class="lm">information architecture</span><h1>What shows where, and why.</h1>'
            '<div class="grid" style="grid-template-columns:repeat(4,1fr);gap:12px">'
            + col("Mine", ["your proofs live · the epoch · the bar", "rate · next win · best", "the proofs ledger (★ win · claiming · ✓ minted)", "balance · Send · Wallet →", "the upgrade card when announced; the Presto row when it's in the way"], "account chips, session counts, host warnings, the bridge")
            + col("Wallet", ["balance · Send · Bridge to · Bridge from (a disabled button says why)", "account · method · backed up · Sign out", "Activity: every crossing with its chip, sentence, trail and action; seventeen states, one sentence each", "wins, collapsed", "advanced: recovery file, restore"], "contract addresses, host warnings")
            + col("Settings (gear)", ["Network: Aztec node, Ethereum RPC — edit in place; silent and throttled states", "Mining: power, Presto, battery, background, resume", "Alerts", "Account: stay open (what it means), Sign out", "Appearance · About (the one host line, /faq)"], "diagnostics, paragraphs")
            + col("Dialogs", ["Account: Start → Create / Log in → words → Welcome back → Opening; six failures, one note each", "Transaction: form → progress → done; Send; Claim; Send ahead", "Sign out (also behind \"Use a different account\")"], "a second confirmation, footers")
            + col("v5.yacana.network", ["Send ahead: balance · Send ahead to V6 · or bridge to Ethereum · activity · Log in", "Settings (node, RPC, account with Sign out, about) · Stats ↗ (the apex)"], "the landing, mining, deposits, a Wallet tab, forwarding (that happens on V6)")
            + col("Stats ↗ · Verify ↗", ["the public view, unchanged in this pass", "opens in a new tab: mining lives in this one", "on the phone, Verify is a tab inside Stats"], "")
            + col("/faq", ["the rules (six drawings)", "Who controls this page?", "What if I lose my passkey?", "The upgrade, in full; what a relayer is"], "")
            + col("Disclosure", ["0 · a tag: V6 · Sep 18, ready to claim", "1 · a card: fact, next step, one button", "2 · How it works / Details: stages, times, links", "3 · /faq#rules"], "a fourth level")
            + '</div></div>')
    return page(body, 1200)


BADGE_TAB = '<span style="position:relative">Wallet<span style="position:absolute;top:-30px;left:26px;min-width:16px;height:16px;border-radius:8px;background:var(--uv);color:var(--uv-ink);font:600 10px/16px var(--mono);text-align:center;padding:0 4px">2</span></span>'


def nav_options():
    a = header("mine", account="0x22a9…612a", status="mining")
    b = header("mine", account="0x22a9…612a", status="mining", icons=False)
    rail = ('<div style="display:grid;grid-template-columns:64px 1fr;height:120px;border-bottom:1px solid var(--line)">'
            '<div style="border-right:1px solid var(--line);display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:12px">'
            + "".join(f'<span style="display:flex;flex-direction:column;align-items:center;gap:3px;font:500 9.5px var(--sans);color:{"var(--ink)" if k == "mine" else "var(--ink-3)"}"><span style="width:20px;height:20px;stroke:currentColor;fill:none">{ICONS[k].replace("<svg", "<svg width=20 height=20 style=stroke:currentColor;fill:none;stroke-width:1.6")}</span>{l}</span>' for l, k in (("Mine", "mine"), ("Wallet", "wallet"), ("Stats", "stats"), ("Verify", "verify")))
            + f'</div><div class="row sb" style="padding:0 20px;height:52px;border-bottom:1px solid var(--line)"><span class="brand">{MARK}Yacana<span class="vtag">V5</span></span><span class="row"><span class="badge net">testnet</span><span class="pill mining"><i></i>mining</span><span class="acct"><i></i>0x22a9…612a</span><span class="gear">{ICONS["settings"]}</span></span></div></div>')
    ph = f'<div class="phone" style="min-height:160px;width:390px;border:1px solid var(--line);border-radius:12px"><div class="top"><span class="brand">{MARK}Yacana<span class="vtag">V5</span></span><span class="row" style="gap:8px"><span class="badge net">testnet</span><span class="acct"><i></i>0x22a9</span><span class="gear">{ICONS["settings"]}</span></span></div>{tabbar("mine").replace("Wallet</a>", BADGE_TAB + "</a>")}</div>'

    def opt(tag, name, mini, pro, pick=False):
        return f'<div class="opt {"pick" if pick else ""}"><div class="hd"><b>{name}</b><span class="tag">{tag}</span></div><div class="mini">{mini}</div><p class="pro">{pro}</p></div>'
    body = ('<div class="board"><span class="lm">option 4 · navigation</span><h1>Four destinations, a gear, an account chip.</h1>'
            '<p>The logo is the app\'s home (/mine on the miner, /stats on the stats app, the top on the landing). Stats and Verify open in a new tab because mining lives in this one; the ↗ says so. "testnet · fees sponsored" becomes a neutral "testnet" tag; sponsorship is said where a fee would be expected. The phone\'s bar carries the Wallet badge; Verify is a tab inside Stats there.</p>'
            '<div class="opts" style="grid-template-columns:1fr">'
            + opt("A · recommended", "Text with 14 px icons, a gear, an account chip", a, "<b>Icons give the four destinations a shape at a glance and carry over to the phone's bar unchanged.</b> The gear keeps Settings off the tab row (it is a rarely-used destination); the account chip answers \"who am I\" and opens Wallet (Settings on the old origin, which has no Wallet).", True)
            + opt("B", "Text-only tabs, unified across the apps", b, "Today's look, with the gear, the chip and the logo link. Cleaner, but the four words compete equally and the phone bar needs icons anyway.")
            + opt("C", "An icon rail on the left (desktop)", rail, "Room for growth (Material 3's rail); but four destinations don't need it, and the cockpit's width matters more than a rail.")
            + f'</div><span class="lm">the phone · a bottom bar with icon and label, the badge on the item</span>{ph}</div>')
    return page(body, 1500)


DECK = [
    ("Sign-in", "Sign in to mine. / Your account lives in a passkey on this device, synced by your platform. Your balance follows the account, not the browser; nothing is written down.", "Mine with an account. / Your balance lives in an account only you can open. It takes a tap."),
    ("Sign-in", "Sign up with a passkey · Use twelve words instead · I already have a passkey · I have twelve words · Not now — just watch", "Create account · Log in · then Continue with passkey · Use 12 words instead · Just watch for now"),
    ("Sign-in", "I understand my passkey is the only way back into this account. There is no backup of a passkey. + Keep the passkey synced. Lose every copy of the passkey and the account and its balance are lost with it.", "Your passkey is the only key. Keep it in a password manager that syncs and it opens this account on the devices that manager syncs to. Lose every copy and the account is lost; Yacana can't recover it. ☐ I understand my passkey is the only way into this account. (unchecked; the button waits for it)"),
    ("Sign-in", "Welcome back. · Use another passkey · Enter twelve words instead · Create a new account", "Welcome back. · Open with passkey · Just watch for now · Use a different account (opens Sign out first, with its backup check)"),
    ("Sign-in", "(one error for everything)", "That didn't work: the passkey prompt was dismissed · This device can't make a Yacana passkey: use 12 words · This browser has no passkeys · No passkey for Yacana on this device · That passkey belongs to a different account · Another tab holds this account"),
    ("Opening", "A minute the first time. The proving keys are 20 MB, fetched once and kept. After that, opening takes a few seconds.", "Opening your account. ✓ Passkey confirmed · Preparing your miner (first time only, 13 of 20 MB) · Syncing your private balance — reading your notes from the chain, usually under a minute · Ready to mine · Mining starts when this finishes."),
    ("Everywhere", "Whoever serves this page controls it: run your own build if that matters. (six places)", "Once, in Settings › About: Yacana runs in your browser. Whoever serves this page controls it; the source is public — run your own build if that matters. + /faq"),
    ("Mine", "Sign in to mine (the cockpit dimmed) · −3 min", "Start mining (full contrast) · since 16:05 → last 3 min"),
    ("Mine", "1 claim this session · account 0x22a9…612a", "(removed — the KPI already says 1 win · 4 tYACA this session)"),
    ("Mine", "escape hatch · if it closed now", "closes anyway · next bar if it closed now"),
    ("Mine", "✓ claim in block 83,164 · 4 tYACA minted", "★ a win · claiming, about 20 s → ✓ minted in block 83,164 ↗ · 4 tYACA, privately"),
    ("Mine", "Presto’s speed setting in its app decides the threads; this slider applies when proving in the browser.", "✦ Presto · native prover · 12 threads, set in the Presto app · Open Presto ↗ / Presto stopped answering. Proving in the browser meanwhile · Retry when it's back"),
    ("Mine", "Your browser blocked local access. Allow local network access for this site, then retry. (on page load)", "(at Start mining) Presto is installed, but the browser blocks local access. Allow it for this site, then retry; or mine in the browser."),
    ("Header", "testnet · fees sponsored (amber)", "testnet (a neutral tag)"),
    ("Wallet", "nothing crossing · Withdrawals to Ethereum, deposits from it and moves to the next Aztec version show here, with where they are.", "Nothing crossing yet. Bridges and send-aheads show here, with where they are. (on V6: Sent ahead from V5 on another device? It shows here once Yacana forwards it; until then, restore its recovery file.)"),
    ("Wallet", "mining claims · 12", "wins · 12"),
    ("Wallet", "Yacana may forward send-aheads to V6 by hand; feel free to bridge or send ahead yourself.", "(on the row) Held on Ethereum for V6, out of V5's reach. Yacana forwards it into V6 once V6 opens; you can too, from V6. Or redeem it on Ethereum as YACA, until at least Mar 17 (…)."),
    ("Wallet", "(a disabled button, no reason)", "Deposits are closed until V6 opens, at yacana.network. / The Ethereum RPC isn't answering: bridging waits until it does. Settings"),
    ("Wallet", "Send (a sheet in two steps)", "Send to an account. · 1.00 tYACA · to 0x… · Privately | Publicly · Fee: none · Yacana sponsors it · Visible: nothing; a private transfer · Send 1 tYACA privately"),
    ("To Ethereum", "bridge to ethereum · step 1 of 2 → step 2 of 2 · fees: none here · gas on Ethereum when you claim · claimable: usually within the hour · undone if the epoch is never proven", "Bridge to Ethereum (one screen) · Arrives: usually within the hour; then you claim it there · Fee: none here · gas in ETH when you claim, from the wallet that claims"),
    ("To Ethereum", "Public on Ethereum. 0x90F7…b906 receives 1 YACA; anyone can see that.", "Visible on Ethereum · the amount and 0x90F7…b906; not this account"),
    ("To Ethereum", "Proving and sending… (the button) · ✓ burned in block 83,074 (on the amount) · pending: claim on Ethereum · 0xEf4d…5f2d — from the wallet page", "● Proving privately · 12 s (a bar; in your browser, Presto proves only mining work) → ✓ Proved and sent · block 83,074 → ● Reaching Ethereum · usually within the hour, by 17:03 at the latest → ○ Claim on Ethereum"),
    ("To Ethereum", "Progress stays in Wallet; claim it there once it is proven.", "You can close this. Wallet shows the progress and a Claim button when it's ready."),
    ("To Ethereum", "Proven. Claim it on Ethereum with a wallet: one transaction, you pay the gas.", "Ready. Claim it on Ethereum with a wallet on Sepolia; that wallet pays the gas in ETH."),
    ("Claim", "(the wallet's own prompts)", "To · 0x90F7…b906 · chosen when you bridged · Paid by · Rabby, in Sepolia ETH · Then · 1 YACA at that address / Rabby is on Ethereum mainnet: Switch Rabby to Sepolia / Rabby rejected it. Nothing was claimed."),
    ("From Ethereum", "Connect injected · Connect Rabby", "Connect wallet (one button; a picker when several are installed)"),
    ("From Ethereum", "each lands with a tap (+ a bar) · These are yours on this version: each claims privately on a tap, about 20 s, the fee sponsored.", "(the row) Arrived. Claim it into your private balance: one tap, about 20 s, no fee."),
    ("From Ethereum", "Deposit · Waiting for your wallet · deposit… · Keep this tab open, or come back: the arrival card offers the Claim.", "Bridge 0.5 YACA · ● Confirm in Rabby → ● Crossing to Aztec → ○ Claim here · You can close this. Wallet shows a Claim button when it arrives."),
    ("Send ahead", "Leaves V5 once its epoch is proven. Lands on Vthe next version with a tap. · all · 3.5 · the whole balance by default", "Send ahead to V6. · 3.50 tYACA · MAX · balance 3.5 tYACA · Leaves V5: usually within the hour · Then: held on Ethereum; Yacana forwards it into V6 (or you do, from V6) · On V6: you claim it, one tap"),
    ("Send ahead", "Its proof is due on Ethereum by 14:03, or the burn is undone; then it is held there for the next version.", "● Reaching Ethereum · by 14:03 (in 40 min) — If V5 misses it, the balance comes back here. → ○ Held on Ethereum for V6 → ○ Forwarded into V6 → ○ You claim it on V6"),
    ("Send ahead", "forwarded to the next version — by hand, or by you", "Forwarded into V6 · by Yacana, or by you from V6. (How it works: Yacana runs a relayer, an address its multisig lists; forwarding ends the option to redeem.)"),
    ("Upgrade", "Sending it ahead now is a bet that V5 proves one more epoch; leaving it is a sure loss. Anything still on V5 when it goes quiet is lost — it goes quiet after the upgrade, without notice.", "V5 keeps proving for a while after an upgrade, then stops without notice. A send it proves is held on Ethereum for V6; one it never proves comes back here; what's still here when it stops can't leave. + V5 proved an epoch 12 min ago / no proof from V5 for 3 h"),
    ("Old origin", "Mining has ended on this version. Yacana lives at yacana.network now; this is the old app, kept open so your balance can leave: send ahead to the next version, or to Ethereum, from the wallet. (+ the bet)", "Mining moved to V6 at yacana.network. Your balance can still leave while V5 keeps proving, and V5 can stop at any time: send it ahead to V6 now, or bridge it to Ethereum."),
    ("Old origin", "Open with passkey or words · This is another origin, so the passkey asks once and twelve words are typed again. Accounts are restored here, not created.", "Log in · Accounts are restored here, not created. The passkey or 12 words from yacana.network open it."),
    ("Old origin", "(after the last day) …", "V5's last day has passed. Nothing more can leave. What V5 proved in time is on V6, or held on Ethereum for it. What was still here can no longer leave."),
    ("Settings", "Another node · Check · Use this node · Applies at once; your account's view of the chain is rebuilt from the new node (about a minute) and mining carries on. The page checks any node against this deployment before it reads a number from it.", "Change · Save · Cancel · ✓ Reachable · ✓ This deployment · ● Switching · rebuilding your view, about a minute / no answer for 2 min · Retry · Change / answering slowly · rate-limited"),
    ("Settings", "off: one touch per open · on: sealed under a device key", "On: anyone who can use this browser could open and spend from this account without your passkey. Off: one touch per open."),
    ("Settings", "Copy diagnostics (shortened) · The last 200 lines, addresses shortened. It names this account's claims and the node's host.", "(removed)"),
    ("Sign out", "Hold to sign out · Can't hold? Sign out with a click · Signing out returns to the sign-in screen…", "Sign out? · Your passkey logs you back in. Your balance stays with the account. Mining stops. · Sign out / Cancel"),
    ("Sheets", "step titles at 22 % ink, their details at 64 %", "titles ink-2, the active one ink, details ink-3"),
]


def copy_deck():
    rows = '<div class="h">before</div><div class="h">after</div>'
    last = None
    for where, before, after in DECK:
        if where != last:
            rows += f'<div class="w">{where}</div>'
            last = where
        rows += f"<div>{before}</div><div>{after}</div>"
    body = ('<div class="board"><span class="lm">the copy deck</span><h1>Before → after.</h1>'
            '<p>Every sentence the owner flagged, and the ones next to them. The voice: plain, second person, what happens next, numbers when they help, verbs on buttons, no jargon (burn, exit, witness, commit) outside /faq. "Usually" wherever the protocol only usually does it; a deadline only once it exists; never "safe".</p>'
            f'<div class="deck">{rows}</div></div>')
    return page(body, 1200)


def picks():
    rows = [
        ("1", "Arrival on /mine", "Page-first: the live cockpit with Start mining; the dialog opens on the click; a stored account gets the lock screen.", "Dialog-first (today), redesigned.", "An onboarding route /mine/start (Bazaar's page) with \"Just watch\" to the cockpit."),
        ("2", "The transaction container", "Centred dialog (440 px) → a bottom sheet on the phone (it scrolls; the keyboard pushes the button up); form → progress → done.", "The right-side sheet, redesigned.", "A full page per flow."),
        ("3", "The bridge form", "One screen with the live summary; the button carries the amount; a pasted address shows in full with a \"not your connected wallet\" tag.", "Two steps, the review compact.", "—"),
        ("4", "Navigation", "Text + 14 px icons, a gear, an account chip; phone bottom bar with four icon + label items, the badge on the item.", "Text-only tabs, unified.", "An icon rail on the left."),
        ("5", "Sign out", "A confirm dialog (with the backup gate for unbacked words).", "Hold-to-confirm restyled (mono progress under the label, 1.2 s).", "—"),
        ("6", "Power with Presto", "The Presto row replaces the slider; the slider returns when Presto drops out.", "The slider dimmed with a one-liner.", "Hide the slider, no row; the pill's ✦ is the only sign."),
        ("7", "The old origin", "One \"Send ahead\" page + Settings (with Account and Sign out) + Stats ↗.", "Keep a Wallet tab too.", "—"),
        ("8", "Passkey consent", "Keep the one checkbox, unchecked, the button disabled until it's ticked. It is friction on purpose, not proof of understanding.", "Drop it; the note carries the fact and the words flow has its own confirm-by-typing.", "—"),
    ]
    cells = "".join(f'<div class="mono uv2" style="font-size:12px">{n}</div><div><b>{q}</b></div><div class="ok" style="color:var(--ink)"><span class="uv2 mono" style="font-size:10.5px;letter-spacing:.08em">A · RECOMMENDED</span><br>{a}</div><div class="ink2"><span class="ink3 mono" style="font-size:10.5px;letter-spacing:.08em">B</span><br>{b}</div><div class="ink2"><span class="ink3 mono" style="font-size:10.5px;letter-spacing:.08em">C</span><br>{c}</div>'
                    for n, q, a, b, c in rows)
    body = ('<div class="board"><span class="lm">the picks</span><h1>Eight questions for the owner.</h1>'
            '<p>Each row is drawn somewhere on the canvas; the recommended option is what the flows assume. Say A/B/C per row, or "all A".</p>'
            f'<div style="display:grid;grid-template-columns:28px 1.1fr 1.6fr 1.2fr 1.2fr;gap:10px 16px;font-size:13px;line-height:1.45;border-top:1px solid var(--line-2);padding-top:12px">{cells}</div></div>')
    return page(body, 1200)


def phone_signin():
    sheet = (head("account", "Mine with an account.", "Your balance lives in an account only you can open. It takes a tap.")
             + f'<div class="col" style="gap:10px">{btn("Create account", "uv lg full")}{btn("Log in", "lg full")}</div>'
             + f'<div class="row" style="justify-content:center">{quiet("Just watch for now")}</div>')
    body = (tile(th("your proofs", btn("Start mining", "uv sm")) + '<div class="ph-chart" style="min-height:120px">Your proofs draw here once you start.</div>')
            + tile(th("epoch 12", "opened 16:07") + '<div class="rail"><i></i><i></i><i></i><i></i></div>' + '<div class="kv"><span>bar</span><span>1.0</span></div><div class="kv"><span>expected close</span><span>5 min</span></div>'))
    return page(phone(body, "mine", sheet=sheet), 390, height=844)


def bridge_sheet(keyboard: bool = False) -> str:
    rows = (srow("To", "Rabby · 0x90F7…b906") + srow("Arrives", "usually within the hour; then you claim it there")
            + srow("Fee", "none here · gas in ETH when you claim") + srow("Visible on Ethereum", "the amount and 0x90F7…b906; not this account"))
    tail = f'<div class="row sb">{btn("Bridge 3.5 tYACA", "uv lg")}{quiet("How it works")}</div>'
    if keyboard:
        return head("bridge", "Bridge to Ethereum.") + amount("3.5", "tYACA", on=True) + '<div class="under"><span>balance 3.5 tYACA</span></div>' + f'<div class="row sb" style="margin-top:2px">{btn("Bridge 3.5 tYACA", "uv lg full")}</div>'
    return head("bridge", "Bridge to Ethereum.") + amount("3.50", "tYACA", on=True) + rows + tail


def phone_bridge():
    body = tile(th("balance", "private") + kpi("", "3.5", "tYACA", lg=True))
    return page(phone(body, "wallet", sheet=bridge_sheet()), 390, height=844)


KEYS = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [".", "0", "⌫"]]


def phone_keyboard():
    """The sheet with the keyboard up: the amount focused, the button above the keyboard, the rows hidden below it."""
    kb = '<div class="kbd">' + "".join('<div class="r">' + "".join(f'<span class="{"d" if k in (".", "⌫") else ""}">{k}</span>' for k in row) + "</div>" for row in KEYS) + "</div>"
    body = tile(th("balance", "private") + kpi("", "3.5", "tYACA", lg=True))
    html = page(phone(body, "wallet", sheet=bridge_sheet(keyboard=True)), 390, height=844)
    html = html.replace('<div class="sheet">', '<div class="sheet" style="bottom:270px">', 1)
    return html.replace('<nav class="tabbar">', kb + '<nav class="tabbar" style="display:none">', 1)


def phone_opening():
    sheet = (head("account", "Opening your account.")
             + checklist([("Passkey confirmed", "done", ""), ("Preparing your miner", "done", ""), ("Syncing your private balance", "on", "block 83,102 of 83,117"), ("Ready to mine", "todo", "")])
             + '<div class="bar"><i style="width:91%"></i></div><p class="sm ink3">Reading your notes from the chain. Usually under a minute.</p>'
             + f'<div class="row sb"><span class="xs ink3">Mining starts when this finishes.</span>{btn("Cancel", "sm")}</div>')
    body = tile(th("your proofs") + '<div class="ph-chart" style="min-height:120px">Your proofs draw here once you start.</div>')
    return page(phone(body, "mine", sheet=sheet), 390, height=844)
