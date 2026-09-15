"""Writes every artboard (*.dc.html) and canvas.json into this folder. `python3 gen.py`; then seed.sh."""
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

# (name, html, w, h, title)
ROWS: list[list[tuple]] = [
    [  # the reading boards
        ("Main", X.principles(), 1000, 960, "Ten rules"),
        ("Picks", X.picks(), 1200, 860, "The picks · A/B/C"),
        ("IA", X.ia_map(), 1200, 820, "What shows where"),
        ("States", ST.state_table(), 1200, 1880, "Every crossing state"),
    ],
    [  # the account dialog
        ("Start", A.start(), 492, 360, "Account · start"),
        ("Create", A.create(), 492, 720, "Account · create"),
        ("CreateError", A.create(error=True), 492, 800, "Account · create · error"),
        ("AccountErrors", A.account_errors(), 1440, 1020, "Account · every failure"),
        ("LogIn", A.login(), 492, 400, "Account · log in"),
        ("LogInOld", A.login(old_origin=True), 492, 480, "Account · log in on v5"),
        ("Words", A.words_create(), 492, 620, "Account · 12 words"),
        ("WordsConfirm", A.words_create(confirm=True), 492, 760, "Account · confirm words"),
        ("WordsLogIn", A.words_login(), 492, 520, "Account · enter words"),
        ("WordsLogInError", A.words_login(error=True), 492, 540, "Account · words · error"),
        ("Welcome", A.welcome(), 492, 380, "Account · welcome back"),
        ("Opening2", A.opening(2), 492, 440, "Opening · the miner"),
        ("Opening3", A.opening(3), 492, 460, "Opening · syncing"),
        ("OpeningErrorProver", A.opening_error("prover"), 492, 480, "Opening · download failed"),
        ("OpeningErrorNode", A.opening_error("node"), 492, 500, "Opening · node silent"),
        ("SignOut", A.signout(), 492, 300, "Sign out · A"),
        ("SignOutHold", A.signout_hold(), 492, 360, "Sign out · B (hold)"),
        ("SignOutWords", A.signout("unbacked"), 492, 340, "Sign out · not backed up"),
    ],
    [  # mine
        ("MineSignedOut", M.mine_signed_out(), 1440, 960, "Mine · signed out"),
        ("MineIdle", M.mine_idle(), 1440, 1040, "Mine · idle · Presto row"),
        ("MineMining", M.mine_mining(), 1440, 960, "Mine · mining · the chart"),
        ("MinePresto", M.mine_presto(), 1440, 960, "Mine · Presto connected"),
        ("MinePrestoBlocked", M.mine_presto_blocked(), 1440, 960, "Mine · Presto blocked at Start"),
        ("MinePrestoFallback", M.mine_presto_fallback(), 1440, 1040, "Mine · Presto dropped out"),
    ],
    [  # wallet
        ("Wallet", W.wallet(), 1440, 1260, "Wallet · activity"),
        ("WalletEmpty", W.wallet("empty"), 1440, 720, "Wallet · empty"),
        ("WalletEmptyV6", W.wallet("empty-v6"), 1440, 760, "Wallet · empty on V6"),
        ("WalletReasons", ST.wallet_reasons(), 700, 1140, "A disabled button says why"),
        ("WalletPhone", W.wallet_phone(), 390, 1200, "Wallet · phone"),
        ("ExitRows", B.exit_row_states(), 820, 900, "A bridge to Ethereum · the main path"),
        ("ExitEdge", B.exit_edge_states(), 820, 1120, "A bridge to Ethereum · the rare states"),
        ("AheadRows", ST.ahead_rows(), 820, 1200, "A send ahead, row by row"),
        ("ArrivalRows", B.claim_here_states(), 820, 580, "An arrival, row by row"),
    ],
    [  # the transaction dialog
        ("SendForm", SD.send_form(), 492, 660, "Send · form"),
        ("SendPublic", SD.send_form("public"), 492, 760, "Send · publicly"),
        ("SendUnknown", SD.send_form(unknown=True), 492, 780, "Send · unknown recipient"),
        ("SendSent", SD.send_sent(), 492, 420, "Send · sent"),
        ("ToEthForm", B.to_eth_form(), 492, 660, "Bridge to Ethereum · form"),
        ("ToEthFormPasted", B.to_eth_form(pasted=True), 492, 780, "· pasted address"),
        ("ToEthProving", B.to_eth_proving(), 492, 480, "· proving"),
        ("ToEthSent", B.to_eth_sent(), 492, 520, "· sent"),
        ("ClaimReady", B.claim_dialog("ready"), 492, 440, "Claim on Ethereum"),
        ("ClaimSwitch", B.claim_dialog("switch"), 492, 580, "· wrong network"),
        ("ClaimWallet", B.claim_dialog("wallet"), 492, 440, "· in the wallet"),
        ("ClaimDeclined", B.claim_dialog("declined"), 492, 460, "· rejected in the wallet"),
        ("ClaimDone", B.claim_dialog("done"), 492, 380, "· claimed"),
        ("FromEthConnect", B.from_eth_connect(), 492, 340, "Bridge from Ethereum · connect"),
        ("FromEthPicker", B.from_eth_connect(picker=True), 492, 380, "· the picker"),
        ("FromEthForm", B.from_eth_form(), 492, 640, "· form"),
        ("FromEthFormPreflip", B.from_eth_form(preflip=True), 492, 780, "· form, upgrade announced"),
        ("FromEthClosed", B.from_eth_form(closed=True), 492, 780, "· deposits closed"),
        ("FromEthWallet", B.from_eth_progress("wallet"), 492, 420, "· confirm in the wallet"),
        ("FromEthSent", B.from_eth_progress("sent"), 492, 460, "· crossing"),
        ("Container", B.container_options(), 1200, 660, "Option 2 · the container"),
    ],
    [  # the upgrade
        ("MineAnnounced", M.mine_announced(), 1440, 1240, "Mine · upgrade announced"),
        ("MineSent", M.mine_sent(), 1440, 1240, "Mine · after a send ahead"),
        ("MineFlipped", M.mine_flipped(), 1440, 1200, "Mine · upgraded, not announced"),
        ("SendAheadForm", U.send_ahead_form(), 492, 580, "Send ahead · form"),
        ("SendAheadSent", U.send_ahead_sent(), 492, 640, "· sent"),
        ("HowItWorks", U.how_it_works(), 492, 900, "· how it works"),
        ("OldOrigin", U.old_origin(), 1440, 1020, "v5.yacana.network"),
        ("OldOriginSilent", U.old_origin("silent"), 1440, 1020, "· no proof for 3 h"),
        ("OldOriginSignedOut", U.old_origin("signed-out"), 1440, 620, "· signed out"),
        ("OldOriginQuiet", U.old_origin("quiet"), 1440, 840, "· last day passed"),
        ("V6FirstLogin", U.v6_first_login(), 1440, 780, "V6 · first login"),
        ("Disclosure", U.disclosure_board(), 1200, 1340, "The upgrade · four levels"),
    ],
    [  # settings
        ("Settings", S.settings(), 1440, 1100, "Settings"),
        ("OldSettings", S.old_settings(), 1440, 780, "Settings on v5.yacana.network"),
        ("NodeStates", S.node_states(), 760, 1420, "Changing a node, and the states after"),
    ],
    [  # navigation, copy, phone
        ("Nav", X.nav_options(), 1500, 1180, "Option 4 · navigation"),
        ("CopyDeck", X.copy_deck(), 1200, 3140, "The copy deck"),
        ("PhoneSignIn", X.phone_signin(), 390, 844, "Phone · start"),
        ("PhoneOpening", X.phone_opening(), 390, 844, "Phone · opening"),
        ("PhoneBridge", X.phone_bridge(), 390, 844, "Phone · bridge"),
        ("PhoneKeyboard", X.phone_keyboard(), 390, 844, "Phone · the keyboard up"),
    ],
]

GAP_X, GAP_Y = 90, 140


def main():
    boards, y = [], 0
    for row in ROWS:
        x, tallest = 0, 0
        for name, html, w, h, title in row:
            with open(os.path.join(HERE, f"{name}.dc.html"), "w") as f:
                f.write(html)
            boards.append({"file": f"{name}.dc.html", "x": x, "y": y, "w": w, "h": h, "title": title})
            x += w + GAP_X
            tallest = max(tallest, h)
        y += tallest + GAP_Y
    canvas = {
        "artboards": boards,
        "annotations": [{"id": "brief", "x": 0, "y": -130, "w": 620,
                         "text": "Yacana polish — the design pass, v2. Rows: the rules, the picks, the IA, every crossing state · the account dialog and its failures · Mine · Wallet and the activity rows · the transaction dialog (send, bridge to, claim, bridge from) · the upgrade and v5 · Settings · navigation, the copy deck, the phone. Every board is what the app would show; A/B/C boards are picks (the recommended one is outlined)."}],
        "launch": {"view": "canvas"},
    }
    with open(os.path.join(HERE, "canvas.json"), "w") as f:
        json.dump(canvas, f, indent=1)
    print(f"{len(boards)} artboards")


if __name__ == "__main__":
    main()
