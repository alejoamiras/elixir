"""Emit the presto-mine design-canvas artboards from the miner's real tokens and component anatomy.

    bun run --cwd packages/ui typecheck >/dev/null; python3 implementations-plan/presto-mine/canvas/build-canvas.py [--embed]

The committed artboards reference the repo's own font files by relative URL (open them from a checkout);
`--embed` inlines the two woff2 files as data URIs, the form the published canvas carries.
"""
import base64
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = HERE
FONTS = {
    'HANKEN': 'node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2',
    'JBMONO': 'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
}
EMBED = '--embed' in sys.argv


def font_src(key):
    rel = FONTS[key]
    if EMBED:
        with open(os.path.join(REPO, rel), 'rb') as f:
            return f'url(data:font/woff2;base64,{base64.b64encode(f.read()).decode()})'
    return f'url(../../../{rel})'


HANKEN_SRC = font_src('HANKEN')
JBMONO_SRC = font_src('JBMONO')

# packages/ui/src/theme.css (dark) + the Tailwind utilities the cockpit uses, as plain CSS.
CSS = f"""
@font-face {{ font-family: "Hanken Grotesk Variable"; font-style: normal; font-weight: 100 900; font-display: block; src: {HANKEN_SRC} format("woff2-variations"); }}
@font-face {{ font-family: "JetBrains Mono Variable"; font-style: normal; font-weight: 100 800; font-display: block; src: {JBMONO_SRC} format("woff2-variations"); }}
:root {{ --ground:#0a0a0b; --raised:#111114; --panel:#17171b; --panel-2:#1e1e24; --ink:#f2efe9; --ink-2:rgba(242,239,233,.64); --ink-3:rgba(242,239,233,.5); --ink-4:rgba(242,239,233,.22); --line:rgba(242,239,233,.1); --line-2:rgba(242,239,233,.18); --uv:#8c6bff; --uv-2:#b39dff; --uv-dim:rgba(140,107,255,.18); --uv-ink:#0a0a0b; --ok:#58c98b; --warn:#e8b54d; --bad:#e5624f;
  --sans:"Hanken Grotesk Variable", ui-sans-serif, system-ui, sans-serif; --mono:"JetBrains Mono Variable", ui-monospace, SFMono-Regular, Menlo, monospace; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; background:var(--ground); color:var(--ink); font: 400 15px/1.55 var(--sans); font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }}
a {{ color: var(--uv-2); text-decoration: none; }} a:hover {{ color: var(--ink); }}
.page {{ width: 1280px; min-height: 100%; background: var(--ground); }}
.shell {{ max-width: 1120px; margin: 0 auto; display:flex; flex-direction:column; }}
.header {{ display:flex; height:52px; align-items:center; gap:20px; border-bottom:1px solid var(--line); padding:0 20px; }}
.brand {{ display:flex; align-items:center; gap:8px; font-weight:600; }}
.nav {{ display:flex; gap:16px; font-size:13px; }}
.nav a {{ padding:4px 0; color:var(--ink-2); }} .nav a.cur {{ color:var(--ink); text-decoration: underline; text-underline-offset: 18px; }}
.right {{ margin-left:auto; display:flex; align-items:center; gap:12px; }}
.badge-warn {{ display:inline-flex; align-items:center; border:1px solid rgba(232,181,77,.45); border-radius:4px; padding:4px 8px; font: 500 11px/1.3 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--warn); white-space:nowrap; }}
.pill {{ display:inline-flex; align-items:center; gap:8px; border:1px solid var(--line-2); border-radius:5px; padding:6px 10px; font: 500 11px/1.3 var(--mono); letter-spacing:.06em; text-transform:uppercase; color:var(--ink-2); white-space:nowrap; }}
.pill i {{ display:inline-block; width:5px; height:5px; background:var(--ink-3); }}
.pill.mining {{ border-color: rgba(140,107,255,.6); color: var(--uv-2); }} .pill.mining i {{ background: var(--uv); }}
.pill .suffix {{ color: var(--uv-2); }} .pill .suffix b {{ font-weight: 600; color: var(--uv); }}
.pill .sep {{ color: var(--ink-4); }}
.content {{ display:flex; flex-direction:column; gap:16px; padding:20px; }}
.grid {{ display:grid; align-items:start; gap:14px; grid-template-columns: 1fr 1fr 1fr 300px; }}
.grid.signed-out {{ opacity:.72; filter: saturate(.55); }}
.span3 {{ grid-column: span 3; }} .rail {{ grid-row: span 2; display:flex; flex-direction:column; gap:14px; }}
.tile {{ min-width:0; border:1px solid var(--line); border-radius:8px; padding:16px 18px; background:var(--raised); }}
.tile.flat {{ background:transparent; }} .tile.dashed {{ border-style:dashed; min-height:72px; text-align:center; }}
.th {{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin:0 0 12px; font: 500 11px/1.3 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); }}
.th .aside {{ margin-left:auto; text-align:right; font-weight:400; letter-spacing:.04em; text-transform:none; color:var(--ink-3); }}
.th.center {{ justify-content:center; margin-bottom:4px; }}
.label {{ font: 500 11px/1.3 var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--ink-3); }}
.mono {{ font-family: var(--mono); }}
.xs {{ font-size:12.5px; line-height:1.4; }} .sm {{ font-size:13px; line-height:1.45; }} .x2 {{ font-size:11px; line-height:1.3; }}
.ink2 {{ color:var(--ink-2); }} .ink3 {{ color:var(--ink-3); }} .ok {{ color:var(--ok); }} .uv {{ color:var(--uv); }} .uv2 {{ color:var(--uv-2); }} .warn {{ color:var(--warn); }}
.btn {{ display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:6px; border:1px solid var(--line-2); background:transparent; color:var(--ink); font: 600 12.5px/1 var(--sans); height:30px; padding:0 12px; white-space:nowrap; }}
.btn.uv {{ border-color:var(--uv); background:var(--uv); color:var(--uv-ink); }}
.btn.primary {{ border-color:var(--ink); background:var(--ink); color:var(--ground); }}
.btn.ghost {{ border-color:transparent; color:var(--ink-2); }}
.btn.link {{ height:auto; border:0; padding:0; font-weight:400; color:var(--ink-2); text-decoration:underline; text-underline-offset:3px; }}
.btn[disabled] {{ opacity:.5; }}
.kpi {{ display:flex; min-width:0; flex-direction:column; gap:4px; }}
.kpi .v {{ font-weight:600; font-size:40px; line-height:1; letter-spacing:-.03em; }}
.kpi .v .unit {{ margin-left:6px; font-size:18px; font-weight:500; letter-spacing:0; color:var(--ink-3); }}
.kpi .dash {{ display:inline-block; width:40px; height:3px; background:var(--ink-3); vertical-align:middle; margin-right:8px; border-radius:1px; }}
.kpi .sub {{ font-size:12.5px; color:var(--ink-3); }}
.kv {{ display:flex; justify-content:space-between; gap:12px; border-top:1px solid var(--line); padding:6px 0; font-size:13px; }}
.kv:first-child {{ border-top:0; }} .kv .k {{ color:var(--ink-2); }} .kv .val {{ font: 400 12.5px/1.4 var(--mono); }}
.segs {{ display:flex; gap:4px; }} .segs span {{ height:6px; flex:1; border-radius:2px; background:var(--panel-2); }} .segs span.f {{ background:rgba(140,107,255,.55); }} .segs span.m {{ background:var(--uv-2); }}
.power {{ display:flex; flex-direction:column; gap:8px; }}
.power .row {{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; }}
.power .readout {{ font: 400 11px/1.3 var(--mono); letter-spacing:.04em; color:var(--ink-3); }}
.track {{ position:relative; height:16px; }}
.track:before {{ content:""; position:absolute; left:0; right:0; top:7px; height:2px; background:var(--panel-2); border-radius:1px; }}
.track .fill {{ position:absolute; left:0; top:7px; height:2px; background:var(--uv); border-radius:1px; }}
.track .thumb {{ position:absolute; top:1px; width:14px; height:14px; border-radius:50%; background:var(--uv); transform:translateX(-50%); }}
.power.off {{ opacity:.45; }} .power.off .fill, .power.off .thumb {{ background:var(--ink-3); }}
.marks {{ position:relative; height:16px; font: 400 11px/1.3 var(--mono); color:var(--ink-2); }}
.marks span {{ position:absolute; transform:translateX(-50%); white-space:nowrap; }} .marks .max {{ color:var(--uv-2); }}
.ledger {{ font: 400 12.5px/1.6 var(--mono); color:var(--ink-2); display:flex; flex-direction:column; gap:2px; }}
.ledger .t {{ color:var(--ink-3); margin-right:12px; }} .ledger .win {{ color:var(--ok); }}
.foot {{ font-size:12.5px; color:var(--ink-2); max-width:1080px; }}
.alert {{ display:grid; gap:2px; width:100%; border-radius:6px; border:1px solid rgba(232,181,77,.45); background:rgba(232,181,77,.08); color:var(--warn); padding:10px 12px; font-size:12.5px; line-height:1.4; text-align:left; }}
.alert.info {{ border-color: rgba(140,107,255,.5); background: var(--uv-dim); color: var(--uv-2); }}
.alert .line {{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 16px; }}
.alert .msg {{ display:flex; align-items:center; gap:10px; }} .alert .dot {{ width:6px; height:6px; border-radius:50%; background:currentColor; flex:none; }}
.alert .acts {{ display:flex; align-items:center; gap:14px; white-space:nowrap; }}
.alert .hint {{ font: 400 11px/1.3 var(--mono); letter-spacing:.04em; opacity:.75; }}
.alert .btn {{ color: var(--ink); }}
.switch {{ display:inline-block; width:32px; height:18px; border-radius:999px; background:var(--panel-2); position:relative; flex:none; }}
.switch:after {{ content:""; position:absolute; top:2px; left:2px; width:14px; height:14px; border-radius:50%; background:var(--ink-3); }}
.switch.on {{ background:var(--uv); }} .switch.on:after {{ left:16px; background:var(--uv-ink); }}
.toggle {{ display:flex; align-items:center; justify-content:space-between; gap:16px; border-top:1px solid var(--line); padding:10px 0; font-size:13px; }}
.toggle .hint {{ display:block; font-size:12.5px; font-weight:400; color:var(--ink-2); margin-top:4px; }}
/* Presto billboard, dark tokens from @alejoamiras/presto-banners styles.ts; fonts="none" means the display face falls back to system-ui. */
.billboard {{ display:flex; align-items:center; gap:18px; padding:18px 22px; border-radius:16px; background:#3446cf; color:#fff; box-shadow: 0 14px 34px -18px rgba(52,70,207,.7); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }}
.billboard .bb-badge {{ width:46px; height:46px; border-radius:50%; background:rgba(255,255,255,.16); display:flex; align-items:center; justify-content:center; flex:none; }}
.billboard .bb-badge svg {{ width:26px; height:26px; }}
.billboard .text {{ flex:1 1 320px; min-width:0; }}
.billboard .title {{ font-size:19px; font-weight:800; letter-spacing:-.015em; line-height:1.12; margin:0; }}
.billboard .title .spark {{ font-style:normal; color:#ffd166; margin-left:2px; }}
.billboard .support {{ font-size:13.5px; font-weight:500; opacity:.86; margin:3px 0 0; max-width:58ch; line-height:1.4; }}
.billboard .actions {{ display:flex; align-items:center; gap:8px; flex:none; margin-left:auto; }}
.billboard .cta {{ display:inline-flex; align-items:center; border-radius:999px; background:#fff; color:#2b3ab0; font-size:14px; font-weight:700; line-height:1; padding:12px 22px; border:1.5px solid transparent; }}
.billboard .x {{ width:28px; height:28px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; color:rgba(255,255,255,.7); }}
.billboard .x svg {{ width:16px; height:16px; }}
/* PLAN B · Presto brand scheme */
.pchip {{ display:inline-flex; align-items:center; gap:6px; background:#3446cf; color:#fff; border-radius:999px; padding:5px 10px 5px 8px; font: 800 11.5px/1 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing:-.01em; white-space:nowrap; }}
.pchip svg {{ width:12px; height:12px; }} .pchip i {{ font-style:normal; color:#ffd066; margin-left:1px; }}
.pchip.sm {{ padding:4px 8px 4px 7px; font-size:10.5px; }} .pchip.sm svg {{ width:10px; height:10px; }}
.pword {{ display:inline-flex; align-items:center; gap:4px; color:#8b99ff; font: 800 11px/1 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing:-.01em; text-transform:none; }}
.pword svg {{ width:11px; height:11px; }} .pword i {{ font-style:normal; color:#ffd066; }}
.ppanel {{ background:#221a33; border:1px solid #372c4e; border-radius:12px; padding:12px 14px; color:#f1ebe0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; display:flex; flex-direction:column; gap:6px; }}
.ppanel .row {{ display:flex; align-items:center; gap:8px; }}
.ppanel .row svg {{ width:16px; height:16px; color:#8b99ff; flex:none; }}
.ppanel .wm {{ font-weight:800; font-size:13.5px; letter-spacing:-.015em; }} .ppanel .wm i {{ font-style:normal; color:#ffd066; }}
.ppanel .st {{ margin-left:auto; display:inline-flex; align-items:center; gap:7px; font-weight:700; font-size:12px; color:#9d93b0; white-space:nowrap; }}
.ppanel .st b {{ width:7px; height:7px; border-radius:50%; background:#3fce8c; display:inline-block; }}
.ppanel .sub {{ font-size:12px; font-weight:500; color:#9d93b0; line-height:1.4; margin:0; }}
.ribbon {{ display:flex; align-items:center; justify-content:center; gap:12px; min-height:44px; padding:7px 12px 7px 16px; background:#262239; border-bottom:1px solid #372c4e; font: 500 12.5px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color:#f1ebe0; }}
.ribbon.warn {{ background:#423432; }} .ribbon.go {{ background:#1f3330; }}
.ribbon svg.bolt {{ width:16px; height:16px; color:#8b99ff; flex:none; }} .ribbon.warn svg.bolt, .ribbon.warn strong {{ color:#ffd87e; }} .ribbon.go svg.bolt, .ribbon.go strong {{ color:#3fce8c; }}
.ribbon p {{ margin:0; min-width:0; }} .ribbon strong {{ font-weight:800; }} .ribbon .sep {{ margin:0 6px; color:#9d93b0; }} .ribbon .sub {{ color:#9d93b0; }}
.ribbon .rb {{ display:inline-flex; align-items:center; border-radius:999px; border:1.5px solid #372c4e; background:transparent; color:#f1ebe0; font: 700 12.5px/1 inherit; font-family:inherit; padding:7px 14px; white-space:nowrap; }}
.ribbon .rb.pri {{ background:#8b99ff; color:#141026; border-color:transparent; }}
.ribbon .st {{ display:inline-flex; align-items:center; gap:7px; font-weight:700; font-size:12px; color:#9d93b0; white-space:nowrap; }}
.ribbon .st b {{ width:7px; height:7px; border-radius:50%; background:#ffd066; display:inline-block; }} .ribbon.go .st b {{ background:#3fce8c; }}
.ribbon .x {{ width:28px; height:28px; border-radius:8px; display:inline-flex; align-items:center; justify-content:center; color:#9d93b0; margin-left:4px; }} .ribbon .x svg {{ width:15px; height:15px; }}
.note {{ font: 400 11px/1.4 var(--mono); color: var(--ink-3); letter-spacing:.02em; }}
.pip {{ width:360px; height:190px; background:var(--ground); color:var(--ink); padding:12px; display:flex; flex-direction:column; justify-content:space-between; }}
.pip .line {{ display:flex; align-items:baseline; justify-content:space-between; gap:8px; white-space:nowrap; font: 400 10px/1.3 var(--mono); color:var(--ink-2); }}
.pip .big {{ font: 600 19px/1 var(--sans); letter-spacing:-.02em; color:var(--ink); }}
"""

MARK = '<svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="23" width="22" height="3" rx="1.5" fill="#f2efe9"></rect><circle cx="16" cy="15" r="5" fill="{dot}"></circle></svg>'
BOLT = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M26 5 L12 27 H21 L19 43 L36 19 H25 Z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"></path></svg>'
CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>'


def header(route='mine', pill='idle', mining=False, suffix=False, brand=False):
    dot = '#8c6bff' if mining else 'rgba(242,239,233,.5)'
    nav = ''.join(
        f'<a href="#" class="{"cur" if r == route else ""}">{label}</a>'
        for r, label in [('mine', 'Mine'), ('wallet', 'Wallet'), ('stats', 'Stats ↗'), ('settings', 'Settings')]
    )
    pill_cls = 'pill mining' if mining else 'pill'
    suf = '<span class="sep">·</span><span class="suffix"><b>✦</b> presto</span>' if suffix and not brand else ''
    chip = CHIP if brand else ''
    return f'''<div class="header">
  <span class="brand">{MARK.format(dot=dot)}Yacana</span>
  <nav class="nav">{nav}</nav>
  <span class="right"><span class="badge-warn">testnet · fees sponsored</span><span class="{pill_cls}"><i></i>{pill}{suf}</span>{chip}</span>
</div>'''


CHIP = f'<span class="pchip">{BOLT}presto<i>✦</i></span>'
CHIP_SM = f'<span class="pchip sm">{BOLT}presto<i>✦</i></span>'
PWORD = f'<span class="pword">{BOLT}presto<i>✦</i></span>'


def presto_panel(sub='Speed is set in the Presto app. Browser threads apply only when proving in the browser.'):
    return f'''<div class="ppanel"><div class="row">{BOLT}<span class="wm">presto<i>✦</i></span><span class="st"><b></b>Native</span></div><p class="sub">{sub}</p></div>'''


def ribbon(title, support, tone='accent', primary=('retry', 'Retry')):
    kind, label = primary
    if kind == 'retry':
        ctl = f'<button class="rb" type="button">{label}</button>'
    elif kind == 'cta':
        ctl = f'<a class="rb pri" href="https://presto.build">{label}</a>'
    else:
        ctl = f'<span class="st"><b></b>{label}</span>'
    cls = 'ribbon' + ('' if tone == 'accent' else f' {tone}')
    bolt = BOLT.replace('<svg ', '<svg class="bolt" ', 1)
    return f'''<div class="{cls}" role="status">{bolt}<p><strong>{title}</strong><span class="sep">·</span><span class="sub">{support}</span></p>{ctl}<span class="x">{CLOSE}</span></div>'''


def billboard():
    return f'''<div class="billboard" role="complementary">
  <div class="bb-badge">{BOLT}</div>
  <div class="text"><h2 class="title">Fast proofs. Like magic<i class="spark">✦</i></h2><p class="support">Install once. This app, and every Aztec or Noir app you open, proves at native speed instead of in your browser.</p></div>
  <div class="actions"><a class="cta" href="https://presto.build">Get Presto</a><span class="x">{CLOSE}</span></div>
</div>'''


def fixit(text, hint=None, info=False, link=None):
    hint_html = f'<span class="hint">{hint}</span>' if hint else ''
    link_html = f'<a class="btn link" href="#">{link}</a>' if link else ''
    return f'''<div class="alert{" info" if info else ""}" role="status">
  <div class="line"><span class="msg"><i class="dot"></i><span>{text}</span></span><span class="acts">{hint_html}{link_html}<button class="btn" type="button">Retry</button></span></div>
</div>'''


# The loop chart: bar at 5.5, y from log10 score over [1, 2.5 × bar]; ticks are the last 3 minutes of proofs.
TICKS = [1.2, 1.9, 1.1, 2.6, 1.4, 3.1, 1.0, 1.7, 2.2, 1.3, 4.1, 1.5, 1.1, 2.9, 1.8, 1.2, 3.6, 1.0, 2.4, 1.6, 1.3, 5.0, 1.1, 2.0, 1.4, 1.9, 1.2, 3.3, 1.0, 2.7, 1.5, 1.1, 4.4, 1.3, 2.1, 1.7, 1.0, 2.5, 1.2, 3.8, 1.4, 1.1, 2.3, 1.6, 1.9, 1.0, 4.9, 1.3, 2.8, 1.2]
import math


def loop_svg(width=730, height=230, live=False, win_at=0.62):
    top, bottom, left, right = 14, 196, 66, 10
    bar = 5.5
    ceil = bar * 2.5
    y = lambda s: bottom - (math.log10(max(1.0, s)) / math.log10(ceil)) * (bottom - top)
    yb = y(bar)
    parts = [f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="JetBrains Mono Variable, ui-monospace, monospace" font-size="11">']
    parts.append(f'<line x1="{left}" x2="{width-right}" y1="{bottom}" y2="{bottom}" stroke="rgba(242,239,233,.18)"/>')
    parts.append(f'<text x="{left-8}" y="{bottom+4}" text-anchor="end" fill="rgba(242,239,233,.5)">1</text>')
    parts.append(f'<line x1="{left}" x2="{width-right}" y1="{yb:.1f}" y2="{yb:.1f}" stroke="#8c6bff" stroke-width="1.5"/>')
    parts.append(f'<text x="{left-8}" y="{yb+4:.1f}" text-anchor="end" fill="rgba(242,239,233,.64)">5.5</text>')
    parts.append(f'<text x="{width-right}" y="{yb-8:.1f}" text-anchor="end" fill="rgba(242,239,233,.5)">the bar · clear it to win</text>')
    parts.append(f'<text x="{left}" y="{height-12}" fill="rgba(242,239,233,.5)">-3 min</text>')
    parts.append(f'<text x="{width-right}" y="{height-12}" text-anchor="end" fill="rgba(242,239,233,.5)">now</text>')
    if live:
        n = len(TICKS)
        for i, s in enumerate(TICKS):
            x = left + (i + 0.5) / n * (width - left - right)
            ys = y(s)
            parts.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{ys-4:.1f}" y2="{ys+4:.1f}" stroke="rgba(242,239,233,.64)" stroke-width="1.5"/>')
        xw = left + win_at * (width - left - right)
        parts.append(f'<text x="{xw:.1f}" y="{y(7.9)+4:.1f}" text-anchor="middle" fill="#58c98b" font-size="13">★</text>')
        parts.append(f'<text x="{xw+9:.1f}" y="{y(7.9)+4:.1f}" fill="#58c98b">7.9</text>')
    else:
        parts.append(f'<text x="{(left+width-right)/2:.0f}" y="{yb+30:.0f}" text-anchor="middle" fill="rgba(242,239,233,.5)">sign in to start proving</text>')
    parts.append('</svg>')
    return ''.join(parts)


def power(threads=11, off=False, readout=None, caption=None):
    cls = 'power off' if off else 'power'
    pct = (threads - 1) / 10 * 100
    ro = f'<span class="readout">{threads} threads{(" · " + readout) if readout else ""}</span>'
    cap = f'<p class="xs ink2" style="margin:0">{caption}</p>' if caption else ''
    return f'''<div class="{cls}">
  <div class="row"><span class="label">power</span>{ro}</div>
  <div class="track"><span class="fill" style="width:{pct:.0f}%"></span><span class="thumb" style="left:{pct:.0f}%"></span></div>
  <div class="marks"><span style="left:14%">eco · 3</span><span style="left:52%">balanced · 6</span><span class="max" style="left:92%">max · 11</span></div>
</div>{cap}'''


def rail(signed_in=False, native=False, brand=False):
    caption = ('Presto’s speed setting in its app decides the threads; this slider applies when proving in the browser.' if native else
               '12 cores, one stays with the page. A change applies at the next proof; the rate readout follows within a minute.' + (' Prover started with 11 threads.' if signed_in else ''))
    readout = '71.4 / min' if signed_in else None
    rows = [('claims', '3 of 4'), ('difficulty', '5.5'), ('open for', '13 min'), ('expected close', '5 min'), ('if it closed now', 'difficulty ×0.40'), ('escape hatch', 'in 7 min')]
    kv = ''.join(f'<div class="kv"><span class="k">{k}</span><span class="val">{v}</span></div>' for k, v in rows)
    return f'''<div class="rail">
  <div class="tile flat dashed"><div class="th center"><span>claim</span></div><p class="xs ink3" style="margin:0">no claim in flight</p></div>
  <div class="tile" style="display:flex;flex-direction:column;gap:20px">
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="th" style="margin:0"><span>epoch 71</span><span class="aside">opened 14:47:24</span></div>
      <div class="segs"><span class="f"></span><span class="f"></span><span class="{"m" if signed_in else "f"}"></span><span></span></div>
      <div>{kv}</div>
    </div>
    {presto_panel() if (native and brand) else power(off=native, readout=readout, caption=caption)}
  </div>
</div>'''


def kpis(signed_in=False):
    if not signed_in:
        return '''<div class="span3" style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:14px">
  <div class="tile"><div class="kpi"><span class="label">rate</span><span class="v"><span class="dash"></span><span class="unit">proofs/min</span></span><span class="sub">no proofs yet</span></div></div>
  <div class="tile"><div class="kpi"><span class="label">next win, at this rate</span><span class="v"><span class="dash"></span></span><span class="sub">the bar is 5.5 · about 6 proofs per win</span></div></div>
  <div class="tile"><div class="kpi"><span class="label">best this epoch</span><span class="v"><span class="dash"></span></span><span class="sub">sign in to start</span></div></div>
</div>'''
    return '''<div class="span3" style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:14px">
  <div class="tile"><div class="kpi"><span class="label">rate</span><span class="v">71.4<span class="unit">proofs/min</span></span><span class="sub">1.2k proofs this session</span></div></div>
  <div class="tile"><div class="kpi"><span class="label">next win, at this rate</span><span class="v">~5<span class="unit">min</span></span><span class="sub">could be now, could be 3× longer</span></div></div>
  <div class="tile"><div class="kpi"><span class="label">best this epoch</span><span class="v">7.9<span class="unit">of 5.5</span></span><span class="sub">1 win · 4 tYACA this session</span></div></div>
</div>'''


def ledger(signed_in=False):
    if not signed_in:
        lines = '<div><span class="t">14:47:24</span>── epoch 71 opened ──</div>'
    else:
        lines = ''.join([
            '<div><span class="t">14:59:02</span>4.4 · 0.84 s</div>',
            '<div><span class="t">14:59:01</span>1.3 · 0.85 s</div>',
            '<div class="win"><span class="t">14:58:40</span>★ 7.9 · 0.84 s · won · minted 4 tYACA</div>',
            '<div><span class="t">14:58:39</span>1.1 · 0.83 s</div>',
            '<div><span class="t">14:47:24</span>── epoch 71 opened ──</div>',
        ])
    return f'''<div class="tile span3"><div class="th"><span>proofs, newest first</span><span class="aside">★ win · ✓ minted · ✗ failed · ── epoch</span></div><div class="ledger">{lines}</div></div>'''


def balance(signed_in=False):
    if not signed_in:
        return '''<div class="tile"><div class="th"><span>balance</span><span class="aside">private</span></div>
  <div class="kpi" style="margin-bottom:12px"><span class="v" style="font-size:22px;line-height:1.1;letter-spacing:-.02em"><span class="dash"></span><span class="unit" style="font-size:19px">tYACA</span></span></div>
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><button class="btn uv" type="button">Sign in</button><button class="btn ghost" type="button" disabled>Wallet →</button></div>
  <p class="xs ink2" style="margin:0">Your balance and your claims appear once an account is open.</p></div>'''
    return '''<div class="tile"><div class="th"><span>balance</span><span class="aside">private</span></div>
  <div class="kpi" style="margin-bottom:12px"><span class="v" style="font-size:22px;line-height:1.1;letter-spacing:-.02em">4<span class="unit" style="font-size:19px">tYACA</span></span><span class="sub">1 claim minted this session</span></div>
  <div style="display:flex;align-items:center;gap:8px"><button class="btn primary" type="button">Send</button><button class="btn" type="button">Withdraw</button><button class="btn ghost" type="button">Wallet →</button></div></div>'''


def loop_tile(signed_in=False, native=False, brand=False):
    if not signed_in:
        aside = '<span class="mono x2 ink3" style="letter-spacing:.04em">— per proof · 11 threads · 0 proofs</span><button class="btn uv" type="button">Sign in to mine</button>'
        head = 'live · last 3 min'
    else:
        rate = (f'0.84 s per proof · {PWORD} · 1.2k proofs · 1 win' if brand else '0.84 s per proof · <span class="uv2">native</span> · 1.2k proofs · 1 win') if native else '2.61 s per proof · 11 threads · 1.2k proofs · 1 win'
        aside = f'<span class="mono x2 ink3" style="letter-spacing:.04em">{rate}</span><button class="btn" type="button">Pop out</button><button class="btn" type="button">Stop</button>'
        head = 'live · last 3 min'
    return f'''<div class="tile span3" style="display:flex;flex-direction:column;gap:16px">
  <div class="th" style="margin:0;height:30px;align-items:center"><span>{head}</span><span class="aside" style="display:flex;align-items:center;gap:12px">{aside}</span></div>
  {loop_svg(live=signed_in)}
</div>'''


FOOT = '<p class="foot" style="margin:0">Whoever serves this page controls it: a compromised host could redirect claims or spend this wallet. Run your own build if that matters. Chain reads come from the node in Settings and can only waste work if the node lies — claims are verified on-chain.</p>'


def page(body, width=1280):
    return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>{CSS}</style>
</helmet>
<div class="page" style="width:{width}px">
{body}
</div>
</x-dc>
</body>
</html>
'''


def cockpit(banner_html, signed_in, native, pill, mining, suffix, brand=False):
    return f'''<div class="shell">
{header('mine', pill, mining, suffix, brand)}
<div class="content">
{banner_html}
<div class="grid{'' if signed_in else ' signed-out'}">
{loop_tile(signed_in, native, brand)}
{rail(signed_in, native, brand)}
{kpis(signed_in)}
{ledger(signed_in)}
{balance(signed_in)}
</div>
{FOOT}
</div>
</div>'''


files = {}
# 1 · Signed out, Presto not installed → the billboard under the header.
files['Main.dc.html'] = page(cockpit(billboard(), False, False, 'idle', False, False))
# 2 · Mining natively.
files['Native.dc.html'] = page(cockpit('', True, True, 'mining', True, True))
# 3 · Presto denied the origin → browser proving, the row.
denied = fixit('Presto has not approved yacana.network yet. Approve it in the Presto app, then retry — proving in the browser meanwhile.', hint='browser · 11 threads', link='how to approve ↗')
files['FixIt.dc.html'] = page(cockpit(denied, True, False, 'mining', True, False))
# 4 · Every row state, at the cockpit's width.
rows = [
    ('permission-blocked', fixit('Your browser blocked local access. Allow local network access for this site, then retry.', hint='browser · 11 threads')),
    ('secure-connection-unavailable · diagnosis https-disabled (only where plaintext health is admitted)', fixit('Presto is installed, but its encrypted connection isn’t on. Presto → Settings → Encrypted Connection, then retry.', hint='browser · 11 threads')),
    ('version-mismatch (an old Presto without the UltraHonk route; never a bb version difference — Presto downloads those)', fixit('Presto needs an update for this app. Open Presto from your menu bar and let it update, then retry.', hint='browser · 11 threads')),
    ('error', fixit('Presto answered, but not with a health report this page understands. Proving in the browser.', hint='browser · 11 threads')),
    ('denied (from the Worker, sticky)', denied),
    ('cooldown', fixit('Presto is still in a cooldown after a denial. Approve yacana.network in the app, then retry.', hint='browser · 11 threads')),
    ('transient × 3', fixit('Presto is busy (three proofs in a row refused). Proving in the browser; Retry tries native again.', hint='browser · 11 threads')),
    ('invalid-proof', fixit('Presto returned a winning proof that did not verify. Proving in the browser; check the Presto install.', hint='browser · 11 threads')),
    ('downloading (phase, info tone; no Retry)', fixit('Presto is fetching bb for Aztec 5.2.0 — the first native proof takes longer.', hint='once', info=True).replace('<button class="btn" type="button">Retry</button>', '')),
]
rows_html = ''.join(f'<div style="display:flex;flex-direction:column;gap:6px"><span class="note">{name}</span>{html}</div>' for name, html in rows)
files['Rows.dc.html'] = page(f'''<div style="padding:24px 20px;display:flex;flex-direction:column;gap:18px;max-width:1120px">
<span class="label">the fix-it row · every state · under the header on Mine, where the node banner sits</span>
{rows_html}
</div>''', width=1120)


# 5 · Settings: the Performance tile in both states beside a placeholder for the untouched node tile.
def perf_tile(native, brand=False):
    prover = (CHIP_SM if brand else '<span class="uv2"><span class="uv">✦</span> Presto · native</span>') if native else 'bb.js WASM · 11 threads'
    cap = 'Presto’s speed setting in its app decides the threads; this slider applies when proving in the browser.' if native else None
    block = presto_panel() if (native and brand) else power(off=native, caption=cap)
    return f'''<div class="tile"><div class="th"><span>performance</span></div>
  <div class="kv"><span class="k">prover</span><span class="val">{prover}</span></div>
  <div style="margin:12px 0 4px">{block}</div>
  <div class="toggle"><span>Pause on battery<span class="hint">not reported by this browser</span></span><span class="switch"></span></div>
  <div class="toggle"><span>Keep proving in a background tab<span class="hint">off: mining pauses while the tab is hidden</span></span><span class="switch on"></span></div>
</div>'''


files['Settings.dc.html'] = page(f'''<div class="shell">
{header('settings', 'mining', True, True)}
<div class="content">
<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:16px;align-items:start">
  <div class="tile flat dashed" style="min-height:360px;display:flex;align-items:center;justify-content:center"><span class="note">node tile · unchanged</span></div>
  {perf_tile(True)}
  <div class="tile flat dashed" style="min-height:120px;display:flex;align-items:center;justify-content:center"><span class="note">behaviour · account · appearance · about — unchanged</span></div>
  <div style="display:flex;flex-direction:column;gap:8px"><span class="note">the same tile while proving in the browser</span>{perf_tile(False)}</div>
</div>
</div>
</div>''')

# 6 · The pop-out, today's layout plus "· native" (its redesign, option C, is the separate fixes work).
files['PopOut.dc.html'] = page(f'''<div class="pip">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <span style="display:flex;align-items:center;gap:8px">{MARK.format(dot='#8c6bff')}<span class="pill mining"><i></i>mining<span class="sep">·</span><span class="suffix"><b>✦</b> presto</span></span></span>
    <button class="btn" type="button">Stop</button>
  </div>
  <svg width="336" height="48" viewBox="0 0 336 48"><line x1="0" x2="336" y1="40" y2="40" stroke="rgba(242,239,233,.18)"/><line x1="0" x2="336" y1="16" y2="16" stroke="#8c6bff" stroke-width="1.5"/>{''.join(f'<line x1="{6+i*6.6:.1f}" x2="{6+i*6.6:.1f}" y1="{40-8*math.log10(s)*3-3:.1f}" y2="{40-8*math.log10(s)*3+3:.1f}" stroke="rgba(242,239,233,.64)" stroke-width="1.5"/>' for i, s in enumerate(TICKS))}<text x="222" y="12" text-anchor="middle" fill="#58c98b" font-size="11" font-family="JetBrains Mono Variable, monospace">★</text></svg>
  <div style="display:flex;flex-direction:column;gap:3px">
    <div class="line" style="justify-content:flex-start;gap:0"><span><span class="big">71.4</span> proofs/min · <span class="uv2">native</span> · epoch 71 · <span style="color:#f2efe9">3</span> of 4 · bar 5.5</span></div>
    <div class="line" style="justify-content:flex-start"><span class="ok">1 win · 4 tYACA</span></div>
    <div class="line" style="align-items:center;gap:10px"><span style="flex:1;height:4px;border-radius:2px;background:var(--panel-2);position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:48%;background:rgba(140,107,255,.55)"></span></span><span>open 2:24 · expected 5:00</span></div>
  </div>
</div>''', width=360)

# PLAN B · exploration: Presto's own brand on the indicator, its ribbon for the fix-it states, no slider while native.
files['NativeB.dc.html'] = page(cockpit('', True, True, 'mining', True, False, brand=True))
denied_b = ribbon('Presto has not approved yacana.network yet', 'Approve it in the Presto app, then retry — proving in the browser meanwhile', 'warn')
files['FixItB.dc.html'] = page(cockpit(denied_b, True, False, 'mining', True, False, brand=True).replace(CHIP, ''))
rows_b = [
    ('offline — Presto’s own ribbon string (the billboard is Plan A’s pitch; B could use this instead)', ribbon('This app proves faster with Presto', 'Install once, nothing to configure', 'accent', ('cta', 'Get Presto'))),
    ('permission-blocked — Presto’s string', ribbon('Your browser blocked local access', 'Allow local network access for this site, then retry', 'warn')),
    ('secure-connection-unavailable — Presto’s string (reachable only with plaintext health admitted)', ribbon('Presto is installed, but its encrypted connection isn’t working', 'Open Presto → Settings → Encrypted Connection, or run the certificate setup again', 'warn')),
    ('version-mismatch — Presto’s string (an old Presto without the UltraHonk route)', ribbon('Presto needs an update for this app', 'Open Presto from your menu bar and let it update', 'warn')),
    ('error — Presto’s string', ribbon('Presto answered, but something went wrong', 'Open Presto from your menu bar, check it is running properly, then retry', 'warn')),
    ('downloading — Presto’s string', ribbon('Presto needs a one-time download for this app', 'It runs on your first proof, then every proof is native', 'accent', ('status', 'Preparing'))),
    ('denied — our wording in Presto’s ribbon (the component has no string for it)', denied_b),
    ('cooldown — ours', ribbon('Presto is still in a cooldown after a denial', 'Approve yacana.network in the app, then retry', 'warn')),
    ('transient × 3 — ours', ribbon('Presto is busy', 'Three proofs in a row refused; proving in the browser, Retry tries native again', 'warn')),
    ('invalid-proof — ours', ribbon('Presto returned a proof that did not verify', 'Proving in the browser; check the Presto install', 'warn')),
    ('available — Presto’s string (B could show this for a moment after the first native proof, instead of nothing)', ribbon('Presto connected', 'proving natively', 'go', ('status', 'Native'))),
]
rows_b_html = ''.join(f'<div style="display:flex;flex-direction:column;gap:6px"><span class="note">{name}</span>{html}</div>' for name, html in rows_b)
files['RowsB.dc.html'] = page(f'''<div style="padding:24px 20px;display:flex;flex-direction:column;gap:18px;max-width:1120px">
<span class="label">plan b · the fix-it states as presto’s ribbon (its component, its dark tokens, its strings where it has them)</span>
{rows_b_html}
</div>''', width=1120)
files['SettingsB.dc.html'] = page(f'''<div class="shell">
{header('settings', 'mining', True, False, brand=True)}
<div class="content">
<div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:16px;align-items:start">
  <div class="tile flat dashed" style="min-height:300px;display:flex;align-items:center;justify-content:center"><span class="note">node tile · unchanged</span></div>
  {perf_tile(True, brand=True)}
</div>
</div>
</div>''')
files['PopOutB.dc.html'] = page(f'''<div class="pip">
  <div style="display:flex;align-items:center;justify-content:space-between">
    <span style="display:flex;align-items:center;gap:8px">{MARK.format(dot='#8c6bff')}<span class="pill mining"><i></i>mining</span>{CHIP_SM}</span>
    <button class="btn" type="button">Stop</button>
  </div>
  <svg width="336" height="48" viewBox="0 0 336 48"><line x1="0" x2="336" y1="40" y2="40" stroke="rgba(242,239,233,.18)"/><line x1="0" x2="336" y1="16" y2="16" stroke="#8c6bff" stroke-width="1.5"/>{''.join(f'<line x1="{6+i*6.6:.1f}" x2="{6+i*6.6:.1f}" y1="{40-8*math.log10(s)*3-3:.1f}" y2="{40-8*math.log10(s)*3+3:.1f}" stroke="rgba(242,239,233,.64)" stroke-width="1.5"/>' for i, s in enumerate(TICKS))}<text x="222" y="12" text-anchor="middle" fill="#58c98b" font-size="11" font-family="JetBrains Mono Variable, monospace">★</text></svg>
  <div style="display:flex;flex-direction:column;gap:3px">
    <div class="line" style="justify-content:flex-start;gap:0"><span><span class="big">71.4</span> proofs/min · <span class="pword">presto<i>✦</i></span> · epoch 71 · <span style="color:#f2efe9">3</span> of 4 · bar 5.5</span></div>
    <div class="line" style="justify-content:flex-start"><span class="ok">1 win · 4 tYACA</span></div>
    <div class="line" style="align-items:center;gap:10px"><span style="flex:1;height:4px;border-radius:2px;background:var(--panel-2);position:relative;overflow:hidden"><span style="position:absolute;left:0;top:0;bottom:0;width:48%;background:rgba(140,107,255,.55)"></span></span><span>open 2:24 · expected 5:00</span></div>
  </div>
</div>''', width=360)

for name, html in files.items():
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(html)

canvas = {
    'artboards': [
        {'file': 'Main.dc.html', 'title': '1 · Mine, signed out, Presto not installed', 'x': 0, 'y': 0, 'w': 1280, 'h': 1000},
        {'file': 'Native.dc.html', 'title': '2 · Mine, proving through Presto', 'x': 1380, 'y': 0, 'w': 1280, 'h': 1000},
        {'file': 'FixIt.dc.html', 'title': '3 · Mine, Presto denied the origin → browser', 'x': 2760, 'y': 0, 'w': 1280, 'h': 1000},
        {'file': 'Rows.dc.html', 'title': '4 · The fix-it row, every state', 'x': 0, 'y': 1160, 'w': 1120, 'h': 760},
        {'file': 'Settings.dc.html', 'title': '5 · Settings · Performance, both states', 'x': 1380, 'y': 1160, 'w': 1280, 'h': 760},
        {'file': 'PopOut.dc.html', 'title': '6 · The pop-out, today’s layout + native', 'x': 2760, 'y': 1160, 'w': 360, 'h': 190},
        {'file': 'NativeB.dc.html', 'title': 'B1 · Plan B: Presto’s brand on the indicator', 'x': 0, 'y': 2200, 'w': 1280, 'h': 1000},
        {'file': 'FixItB.dc.html', 'title': 'B2 · Plan B: Presto’s ribbon for the fix-it state', 'x': 1380, 'y': 2200, 'w': 1280, 'h': 1000},
        {'file': 'RowsB.dc.html', 'title': 'B3 · Plan B: every state as the ribbon', 'x': 2760, 'y': 2200, 'w': 1120, 'h': 1000},
        {'file': 'SettingsB.dc.html', 'title': 'B4 · Plan B: Settings · Performance', 'x': 0, 'y': 3360, 'w': 1280, 'h': 560},
        {'file': 'PopOutB.dc.html', 'title': 'B5 · Plan B: the pop-out', 'x': 1380, 'y': 3360, 'w': 360, 'h': 190},
    ],
    'annotations': [
        {'id': 'n-main', 'x': 0, 'y': -150, 'w': 520, 'text': 'Presto not installed (or unreachable over HTTPS): Presto’s own billboard, in its indigo, under the header where the node banner sits. Dismiss keeps it away 7 days. Cockpit dimmed as today (signed out).'},
        {'id': 'n-native', 'x': 1380, 'y': -150, 'w': 520, 'text': 'Native: the pill gains “✦ presto” (after the first native proof, not before); the rate line says “native”; the rail’s power slider greys out: Presto’s own speed setting decides the threads. Nothing else moves.'},
        {'id': 'n-fixit', 'x': 2760, 'y': -150, 'w': 520, 'text': 'Presto present but in the way: one warn row in the node-banner shape with Retry; the pill drops the ✦; browser proving continues; slider live again.'},
        {'id': 'n-rows', 'x': 0, 'y': 1010, 'w': 520, 'text': 'All row states with Presto’s wording. Only one shows at a time. “downloading” is an info tone with no Retry. The encrypted-connection row is reachable only if Ask 6 admits plaintext health.'},
        {'id': 'n-settings', 'x': 1380, 'y': 1010, 'w': 520, 'text': 'Settings → Performance: a “prover” line; the slider disabled with the reason while native (Ask 4: disabled vs hidden). Node and the other tiles unchanged.'},
        {'id': 'n-b', 'x': 0, 'y': 2050, 'w': 720, 'text': 'PLAN B · exploration, not the default. Presto’s own brand carries “native”: an indigo presto✦ chip beside the pill (its bolt, its display face falling back to system-ui, its gold spark), “presto” in the rate line, and a small Presto panel in place of the greyed slider (the O4 “hidden” alternative). The fix-it states use Presto’s ribbon component with its own strings where it has them; four states (denied, cooldown, busy, invalid proof) have no Presto string and would carry ours inside the ribbon.'},
        {'id': 'n-b2', 'x': 1380, 'y': 2050, 'w': 640, 'text': 'Trade-off: B is louder and unmistakably Presto (good for the install pitch, consistent with the billboard); A keeps one voice inside the cockpit and its own tokens. The ribbon is a full-width top bar by design (square, border-bottom), so under our header it reads as a page-level notice rather than a tile.'},
        {'id': 'n-pip', 'x': 2760, 'y': 1010, 'w': 360, 'text': 'Pop-out, drawn on the option-C layout you picked for the fixes work (two number lines, the epoch bar): this plan only adds “· native” to the first line and the ✦ to the pill.'},
    ],
    'launch': {'view': 'canvas'},
}
open(os.path.join(OUT, 'canvas.json'), 'w', encoding='utf-8').write(json.dumps(canvas, indent=2, ensure_ascii=False))
print('wrote', sorted(os.listdir(OUT)))
