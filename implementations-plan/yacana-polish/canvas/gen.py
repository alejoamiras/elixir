"""Writes every artboard (*.dc.html) and canvas.json into this folder. `python3 gen.py`; then seed.sh.

Eight pages: the picks first (a sticky note per pick beside the boards that draw it), then one page per
flow, then the reference boards. A pick's boards are copies of flow boards under their own names, so every
flow page stays complete.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import boards_bridge as B  # noqa: E402
import boards_meta as X  # noqa: E402
import boards_mine as M  # noqa: E402
import boards_send as SD  # noqa: E402
import boards_settings as S  # noqa: E402
import boards_signin as A  # noqa: E402
import boards_states as ST  # noqa: E402
import boards_upgrade as U  # noqa: E402
import boards_wallet as W  # noqa: E402

GAP_X, GAP_Y = 90, 140
NOTE_W = 340

# (page id, page name, intro note, rows); a row is a list of (name, html, w, h, title) and may start with a
# note string, which sits left of the row's boards.
PAGES = [
    ("picks", "1 · Start here · the picks", (
        "READ ME FIRST. Eight questions, each with an A/B/C. A is drawn and recommended; the note beside each row "
        "says what B and C would be. Answer with the pick's number and a letter (\"2A, 5B\"), or say what you'd change. "
        "Every other page is a flow; boards read left to right."), [
        [("Picks", X.picks(), 1200, 860, "The picks · A/B/C")],
        [("PICK 1 · Arrival on /mine.\nA (drawn, recommended): page-first. The live cockpit is the landing; Start mining opens the "
          "account dialog on the click; a stored account gets Welcome back.\nB: dialog-first, as today, redesigned.\nC: an onboarding "
          "route /mine/start with \"Just watch\" to the cockpit."),
         ("Pick1-Arrival", M.mine_signed_out(), 1440, 960, "Pick 1 · A · page-first: the cockpit, signed out"),
         ("Pick1-Dialog", A.start(), 492, 360, "Pick 1 · A · the dialog on the click")],
        [("PICK 2 · Where a transaction happens.\nA (recommended): a centred 440 px dialog; form → progress → done; after \"sent\" "
          "the Wallet row owns the progress.\nB: the right-side sheet (today), redesigned.\nC: a page per flow.\nThe board draws all three small."),
         ("Pick2-Container", B.container_options(), 1200, 660, "Pick 2 · the container · A/B/C")],
        [("PICK 3 · The bridge form.\nA (drawn, recommended): one screen with the live summary rows; the button carries the amount; "
          "a pasted address shows in full with a tag.\nB: two steps, the review compact (three rows)."),
         ("Pick3-BridgeForm", B.to_eth_form(), 492, 660, "Pick 3 · A · one screen"),
         ("Pick3-Pasted", B.to_eth_form(pasted=True), 492, 780, "Pick 3 · A · a pasted address")],
        [("PICK 4 · Navigation.\nA (recommended): text tabs with 14 px icons, a gear, an account chip.\nB: text-only tabs, unified "
          "across the apps.\nC: an icon rail on the left.\nThe board draws all three headers."),
         ("Pick4-Nav", X.nav_options(), 1500, 1000, "Pick 4 · navigation · A/B/C")],
        [("PICK 5 · Sign out.\nA (recommended): a plain confirm dialog, with the backup gate when the words aren't backed up.\n"
          "B: hold-to-confirm, restyled (1.2 s, the progress under the label)."),
         ("Pick5-A", A.signout(), 492, 300, "Pick 5 · A · confirm"),
         ("Pick5-B", A.signout_hold(), 492, 360, "Pick 5 · B · hold"),
         ("Pick5-Words", A.signout("unbacked"), 492, 340, "Pick 5 · A · the backup gate")],
        [("PICK 6 · Power with Presto connected (the cockpit's epoch tile; Settings keeps its slider either way).\n"
          "A (drawn, recommended): the Presto row replaces the slider; the slider returns when Presto drops out.\nB: the slider "
          "stays, dimmed, with a one-liner.\nC: hide the slider and show no row; the pill's ✦ is the only sign."),
         ("Pick6-Presto", M.mine_presto(), 1440, 960, "Pick 6 · A · the Presto row"),
         ("Pick6-Fallback", M.mine_presto_fallback(), 1440, 1040, "Pick 6 · A · Presto dropped out: the banner, the slider back")],
        [("PICK 7 · The old origin (v5.yacana.network).\nA (drawn, recommended): one \"Send ahead\" page, Settings with Account and "
          "Sign out, Stats ↗ to the apex. No Wallet tab, no landing, no mining.\nB: keep a Wallet tab too."),
         ("Pick7-OldOrigin", U.old_origin(), 1440, 1020, "Pick 7 · A · v5.yacana.network")],
        [("PICK 8 · Passkey consent.\nA (drawn, recommended): keep the one checkbox, unchecked, the button disabled until it's "
          "ticked; friction on purpose.\nB: drop the checkbox; the note carries the fact, and the words flow has its own "
          "confirm-by-typing."),
         ("Pick8-Consent", A.create(), 492, 720, "Pick 8 · A · the checkbox")],
    ]),
    ("account", "2 · Account", "The account dialog from Start to Opening, every failure, and Sign out. Left to right is the flow.", [
        [("Start", A.start(), 492, 360, "Start"),
         ("Create", A.create(), 492, 720, "Create"),
         ("CreateError", A.create(error=True), 492, 800, "Create · error"),
         ("LogIn", A.login(), 492, 400, "Log in"),
         ("LogInOld", A.login(old_origin=True), 492, 480, "Log in on v5"),
         ("Welcome", A.welcome(), 492, 380, "Welcome back")],
        [("Words", A.words_create(), 492, 620, "12 words"),
         ("WordsConfirm", A.words_create(confirm=True), 492, 760, "Confirm the words"),
         ("WordsLogIn", A.words_login(), 492, 520, "Enter the words"),
         ("WordsLogInError", A.words_login(error="list"), 492, 540, "Words · not in the list"),
         ("WordsLogInChecksum", A.words_login(error="checksum"), 492, 560, "Words · one is off")],
        [("AccountErrors", A.account_errors(), 1440, 1020, "Every failure")],
        [("Opening2", A.opening(2, intent="login"), 492, 440, "Opening · the miner (from Log in)"),
         ("Opening3", A.opening(3), 492, 460, "Opening · syncing"),
         ("OpeningErrorProver", A.opening_error("prover"), 492, 480, "Opening · download failed"),
         ("OpeningErrorNode", A.opening_error("node"), 492, 500, "Opening · node silent")],
        [("SignOut", A.signout(), 492, 300, "Sign out"),
         ("SignOutHold", A.signout_hold(), 492, 360, "Sign out · hold (B)"),
         ("SignOutWords", A.signout("unbacked"), 492, 340, "Sign out · not backed up")],
    ]),
    ("mine", "3 · Mine", ("The cockpit signed out, idle (Presto's billboard), mining (the chart, the claiming chip), with Presto, "
                          "with Presto blocked or dropped out (banners under the header), and every Presto reason."), [
        [("MineSignedOut", M.mine_signed_out(), 1440, 960, "Signed out"),
         ("MineIdle", M.mine_idle(), 1440, 1100, "Idle · Presto's billboard")],
        [("MineMining", M.mine_mining(), 1440, 960, "Mining · the chart · claiming"),
         ("MinePresto", M.mine_presto(), 1440, 960, "Presto connected")],
        [("MinePrestoBlocked", M.mine_presto_blocked(), 1440, 1040, "Presto blocked · the banner"),
         ("MinePrestoFallback", M.mine_presto_fallback(), 1440, 1120, "Presto dropped out · the banner, the slider back")],
        [("PrestoReasons", M.presto_reasons(), 760, 1300, "Presto · every reason, as a banner")],
    ]),
    ("wallet", "4 · Wallet", ("The Wallet, its empty states, the disabled reasons, then the activity row state by state: a bridge to "
                              "Ethereum (main path, rare states), a send ahead, an arrival."), [
        [("Wallet", W.wallet(), 1440, 1260, "Wallet · activity"),
         ("WalletEmpty", W.wallet("empty"), 1440, 720, "Wallet · empty")],
        [("WalletEmptyV6", W.wallet("empty-v6"), 1440, 760, "Wallet · empty on V6"),
         ("WalletReasons", ST.wallet_reasons(), 700, 1140, "A disabled button says why")],
        [("ExitRows", B.exit_row_states(), 820, 900, "A bridge to Ethereum · the main path"),
         ("ExitEdge", B.exit_edge_states(), 820, 1460, "A bridge to Ethereum · the rare states"),
         ("AheadRows", ST.ahead_rows(), 820, 1400, "A send ahead, row by row"),
         ("ArrivalRows", B.claim_here_states(), 820, 580, "An arrival, row by row")],
    ]),
    ("dialog", "5 · Bridge, claim, send", "The transaction dialog: Send, Bridge to Ethereum, the claim on Ethereum, Bridge from Ethereum. Each row is one flow, left to right.", [
        [("SendForm", SD.send_form(), 492, 700, "Send · form"),
         ("SendPublic", SD.send_form("public"), 492, 800, "Send · publicly"),
         ("SendUnknown", SD.send_form(unknown=True), 492, 820, "Send · unknown recipient"),
         ("SendSent", SD.send_sent(), 492, 420, "Send · sent"),
         ("SendErrors", SD.send_errors(), 1000, 1020, "Send · the four refusals")],
        [("ToEthForm", B.to_eth_form(), 492, 660, "Bridge to Ethereum · form"),
         ("ToEthFormPasted", B.to_eth_form(pasted=True), 492, 780, "· pasted address"),
         ("ToEthProving", B.to_eth_proving(), 492, 480, "· proving"),
         ("ToEthSent", B.to_eth_sent(), 492, 520, "· sent")],
        [("ClaimReady", B.claim_dialog("ready"), 492, 440, "Claim on Ethereum"),
         ("ClaimSwitch", B.claim_dialog("switch"), 492, 580, "· wrong network"),
         ("ClaimNoEth", B.claim_dialog("noeth"), 492, 580, "· no ETH for the gas"),
         ("ClaimWallet", B.claim_dialog("wallet"), 492, 440, "· in the wallet"),
         ("ClaimDeclined", B.claim_dialog("declined"), 492, 460, "· rejected in the wallet"),
         ("ClaimDone", B.claim_dialog("done"), 492, 380, "· claimed")],
        [("FromEthConnect", B.from_eth_connect(), 492, 340, "Bridge from Ethereum · connect"),
         ("FromEthPicker", B.from_eth_connect(picker=True), 492, 380, "· the picker"),
         ("FromEthForm", B.from_eth_form(), 492, 640, "· form"),
         ("FromEthFormPreflip", B.from_eth_form(preflip=True), 492, 780, "· upgrade announced"),
         ("FromEthClosed", B.from_eth_form(closed=True), 492, 780, "· deposits closed"),
         ("FromEthWallet", B.from_eth_progress("wallet"), 492, 420, "· confirm in the wallet"),
         ("FromEthSent", B.from_eth_progress("sent"), 492, 460, "· crossing")],
        [("Container", B.container_options(), 1200, 660, "Option 2 · the container")],
    ]),
    ("upgrade", "6 · The upgrade and v5", ("Mine before, during and after the upgrade; the send-ahead dialog and How it works; "
                                            "v5.yacana.network in every state; V6's first login; the four levels of disclosure."), [
        [("MineAnnounced", M.mine_announced(), 1440, 1240, "Mine · upgrade announced"),
         ("MineSent", M.mine_sent(), 1440, 1240, "Mine · after a send ahead"),
         ("MineFlipped", M.mine_flipped(), 1440, 1200, "Mine · upgraded, not announced")],
        [("SendAheadForm", U.send_ahead_form(), 492, 580, "Send ahead · form"),
         ("SendAheadSent", U.send_ahead_sent(), 492, 640, "· sent"),
         ("HowItWorks", U.how_it_works(), 492, 900, "· how it works"),
         ("Disclosure", U.disclosure_board(), 1200, 1340, "The upgrade · four levels")],
        [("OldOrigin", U.old_origin(), 1440, 1020, "v5.yacana.network"),
         ("OldOriginSilent", U.old_origin("silent"), 1440, 1020, "· no proof for 3 h")],
        [("OldOriginSignedOut", U.old_origin("signed-out"), 1440, 620, "· signed out"),
         ("OldOriginQuiet", U.old_origin("quiet"), 1440, 840, "· V5 stopped proving")],
        [("OldOriginGone", U.old_origin("gone"), 1440, 640, "· V5's node gone"),
         ("V6FirstLogin", U.v6_first_login(), 1440, 780, "V6 · first login")],
    ]),
    ("settings", "7 · Settings", "Settings (the slider is here too), the old origin's Settings, and the node row in every state.", [
        [("Settings", S.settings(), 1440, 1160, "Settings"),
         ("OldSettings", S.old_settings(), 1440, 860, "Settings on v5.yacana.network")],
        [("NodeStates", S.node_states(), 760, 1420, "Changing a node, and the states after")],
    ]),
    ("reference", "8 · Rules, IA, states, copy", "The ten rules, what shows where, every crossing state with its sentence, the navigation options, the copy deck before → after.", [
        [("Main", X.principles(), 1000, 960, "Ten rules"),
         ("IA", X.ia_map(), 1200, 820, "What shows where")],
        [("States", ST.state_table(), 1200, 2440, "Every crossing state"),
         ("Nav", X.nav_options(), 1500, 1000, "Option 4 · navigation")],
        [("CopyDeck", X.copy_deck(), 1200, 3760, "The copy deck")],
    ]),
]


def main():
    boards, notes, pages = [], [], []
    for pid, name, intro, rows in PAGES:
        pages.append({"id": pid, "name": name})
        notes.append({"id": f"{pid}-intro", "x": 0, "y": -150, "w": 900, "text": f"{name.upper()} — {intro}", "page": pid})
        y = 0
        for row in rows:
            x, tallest = 0, 0
            for item in row:
                if isinstance(item, str):
                    notes.append({"id": f"{pid}-note-{len(notes)}", "x": 0, "y": y, "w": NOTE_W, "text": item, "page": pid})
                    x = NOTE_W + 60
                    continue
                bname, html, w, h, title = item
                with open(os.path.join(HERE, f"{bname}.dc.html"), "w") as f:
                    f.write(html)
                boards.append({"file": f"{bname}.dc.html", "x": x, "y": y, "w": w, "h": h, "title": title, "page": pid})
                x += w + GAP_X
                tallest = max(tallest, h)
            y += tallest + GAP_Y + 60
    canvas = {"artboards": boards, "annotations": notes, "pages": pages, "launch": {"view": "canvas", "page": "picks"}}
    with open(os.path.join(HERE, "canvas.json"), "w") as f:
        json.dump(canvas, f, indent=1)
    print(f"{len(boards)} artboards, {len(notes)} notes, {len(pages)} pages")


if __name__ == "__main__":
    main()
