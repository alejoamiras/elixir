"""The drawn vocabulary of the polish canvas: packages/ui's tokens and component anatomy as plain CSS,
plus the primitives every artboard composes (chrome, tiles, dialogs, steppers, inputs, chips)."""

FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap">'

CSS = r"""
:root{--ground:#0a0a0b;--raised:#111114;--panel:#17171b;--panel-2:#1e1e24;--ink:#f2efe9;--ink-2:rgba(242,239,233,.64);--ink-3:rgba(242,239,233,.5);--ink-4:rgba(242,239,233,.22);--line:rgba(242,239,233,.10);--line-2:rgba(242,239,233,.18);--uv:#8c6bff;--uv-2:#b39dff;--uv-dim:rgba(140,107,255,.18);--uv-ink:#0a0a0b;--ok:#58c98b;--warn:#e8b54d;--bad:#e5624f;--sans:"Hanken Grotesk",ui-sans-serif,system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.55 var(--sans);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
a{color:var(--ink-2);text-decoration:none}
h1,h2,h3{margin:0;font-weight:600;letter-spacing:-.01em;text-wrap:balance}
p{margin:0}
code,.mono{font-family:var(--mono)}
.ink2{color:var(--ink-2)}.ink3{color:var(--ink-3)}.ink4{color:var(--ink-4)}.uv2{color:var(--uv-2)}.ok{color:var(--ok)}.warn{color:var(--warn)}.bad{color:var(--bad)}
.xs{font-size:12.5px;line-height:1.4}.sm{font-size:13px;line-height:1.45}.x2{font-size:11px;line-height:1.3}.md{font-size:14px;line-height:1.5}
.b{font-weight:600}.m{font-weight:500}
.row{display:flex;align-items:center;gap:10px}.col{display:flex;flex-direction:column;gap:10px}
.sb{justify-content:space-between}.wrap{flex-wrap:wrap}
.shell{max-width:1120px;margin:0 auto;display:flex;flex-direction:column;min-height:100%}
.hdr{display:flex;align-items:center;gap:20px;height:52px;border-bottom:1px solid var(--line);padding:0 20px}
.brand{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;color:var(--ink)}
.vtag{font:500 10.5px var(--mono);letter-spacing:.08em;color:var(--ink-3);border:1px solid var(--line);border-radius:4px;padding:2px 6px}
.nav{display:flex;gap:18px;font-size:13px}
.nav a{display:inline-flex;align-items:center;gap:7px;color:var(--ink-2);padding:15px 0 13px;border-bottom:2px solid transparent}
.nav a.on{color:var(--ink);border-bottom-color:var(--ink)}
.nav a .ext{font-size:10px;color:var(--ink-4)}
.nav a svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.hdr .right{margin-left:auto;display:flex;align-items:center;gap:10px}
.gear{width:30px;height:30px;border-radius:6px;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;color:var(--ink-2)}
.gear svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.acct{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:6px;padding:4px 8px 4px 5px;font:400 11.5px var(--mono);color:var(--ink-2)}
.acct i{width:16px;height:16px;border-radius:50%;background:conic-gradient(from 20deg,var(--uv),#3b2a7a,var(--uv-2),var(--uv))}
.body{display:flex;flex-direction:column;gap:16px;padding:20px}
.grid{display:grid;gap:14px}
.tile{min-width:0;border-radius:8px;border:1px solid var(--line);padding:16px 18px;background:var(--raised)}
.tile.flat{background:transparent}
.tile.hi{border-color:var(--uv)}
.lm{font:500 11px/1.3 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
.th{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 12px;font:500 11px/1.3 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
.th .aside{margin-left:auto;text-align:right;font-weight:400;letter-spacing:.04em;text-transform:none}
.eyebrow{font:500 11.5px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--uv-2)}
.kv{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding:7px 0;font-size:13px}
.kv:first-child{border-top:0}
.kv>:first-child{color:var(--ink-2)}.kv>:last-child{font-family:var(--mono);font-size:12.5px;text-align:right}
.kpi{display:flex;flex-direction:column;gap:4px;min-width:0}
.kpi .v{font-size:22px;line-height:1.1;font-weight:600;letter-spacing:-.02em;white-space:nowrap}
.kpi.lg .v{font-size:40px;line-height:1;letter-spacing:-.03em}
.kpi .v .u{margin-left:6px;font-size:.45em;font-weight:500;letter-spacing:0;color:var(--ink-3)}
.kpi .s{font-size:12.5px;line-height:1.4;color:var(--ink-3)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:38px;padding:0 16px;border-radius:6px;border:1px solid var(--line-2);background:transparent;color:var(--ink);font:600 13px var(--sans);white-space:nowrap}
.btn.sm{height:30px;padding:0 12px;font-size:12.5px}
.btn.lg{height:46px;padding:0 22px;font-size:15px}
.btn.full{width:100%}
.btn.primary{border-color:var(--ink);background:var(--ink);color:var(--ground)}
.btn.uv{border-color:var(--uv);background:var(--uv);color:var(--uv-ink)}
.btn.ghost{border-color:transparent;color:var(--ink-2)}
.btn.danger{border-color:rgba(229,98,79,.5);color:var(--bad)}
.btn.dis{opacity:.45}
.btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.btn .spin{width:13px;height:13px;border-radius:50%;border:2px solid rgba(10,10,11,.25);border-top-color:var(--uv-ink)}
.quiet{font-size:13px;color:var(--ink-2);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--ink-4)}
.badge{display:inline-flex;align-items:center;gap:6px;border-radius:4px;border:1px solid var(--line);background:var(--panel);padding:4px 8px;font:400 11px/1.3 var(--mono);color:var(--ink-2);white-space:nowrap}
.badge.warn{border-color:rgba(232,181,77,.45);background:transparent;color:var(--warn);text-transform:uppercase;letter-spacing:.1em;font-weight:500}
.badge.uv{border-color:rgba(140,107,255,.45);background:var(--uv-dim);color:var(--uv-2)}
.badge.net{border-color:var(--line-2);background:transparent;color:var(--ink-2);text-transform:uppercase;letter-spacing:.1em;font-weight:500}
.pill{display:inline-flex;align-items:center;gap:8px;border-radius:5px;border:1px solid var(--line-2);padding:6px 10px;font:500 11px/1.3 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.pill i{display:inline-block;width:5px;height:5px;background:var(--ink-3)}
.pill.mining{border-color:rgba(140,107,255,.6);color:var(--uv-2)}.pill.mining i{background:var(--uv)}
.pill.minted{border-color:rgba(88,201,139,.5);color:var(--ok)}.pill.minted i{background:var(--ok)}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:4px;border:1px solid var(--line);background:var(--panel);padding:4px 8px;font:400 11px/1.3 var(--mono);color:var(--ink-2);white-space:nowrap}
.chip b{font-weight:400;color:var(--ink)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.st{display:inline-flex;align-items:center;gap:6px;border-radius:4px;border:1px solid var(--line-2);padding:4px 9px;font:500 11px/1.3 var(--mono);letter-spacing:.04em;color:var(--ink-2);white-space:nowrap}
.st i{width:5px;height:5px;background:var(--ink-3)}
.st.ok{color:var(--ok);border-color:rgba(88,201,139,.45)}.st.ok i{background:var(--ok)}
.st.on{color:var(--uv-2);border-color:rgba(140,107,255,.6)}.st.on i{background:var(--uv)}
.st.warn{color:var(--warn);border-color:rgba(232,181,77,.5)}.st.warn i{background:var(--warn)}
.st.bad{color:var(--bad);border-color:rgba(229,98,79,.5)}.st.bad i{background:var(--bad)}
.st.dim{color:var(--ink-3);border-color:var(--line)}.st.dim i{background:var(--ink-4)}
.trail{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:400 11px var(--mono);color:var(--ink-3)}
.trail .arr{color:var(--ink-4);padding:0 1px}
.seg{display:inline-flex;overflow:hidden;border-radius:6px;border:1px solid var(--line-2);font-size:13px}
.seg span{padding:6px 14px;color:var(--ink-2)}.seg span.on{background:var(--ink);color:var(--ground);font-weight:600}
.ledger{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;font:400 12.5px/1.5 var(--mono)}
.ledger li{display:flex;gap:12px;padding:3px 0;white-space:nowrap}
.ledger .t{color:var(--ink-2)}.ledger .g{width:12px;text-align:center}
.ledger .win .g{color:var(--uv-2)}.ledger .ok .g{color:var(--ok)}.ledger .ep{color:var(--ink-3)}.ledger .ok{color:var(--ok)}
.ledger a{color:var(--uv-2)}
.mark{width:18px;height:18px;display:inline-block;position:relative}
.mark::before{content:"";position:absolute;left:2px;right:2px;bottom:3px;height:3px;background:var(--ink);border-radius:1px}
.mark::after{content:"";position:absolute;left:6px;top:2px;width:6px;height:6px;border-radius:50%;background:var(--uv)}
svg text{font-family:var(--mono);font-size:10px;fill:var(--ink-3)}
.foot{display:flex;flex-wrap:wrap;gap:4px 16px;border-top:1px solid var(--line);padding-top:12px;font-size:11px;color:var(--ink-2)}
.veil{position:absolute;inset:0;background:rgba(10,10,11,.72)}
.dialog{width:440px;border:1px solid var(--line-2);border-radius:10px;background:var(--raised);padding:26px 26px 22px;display:flex;flex-direction:column;gap:16px;position:relative}
.dialog h2{font-size:22px;line-height:1.2;letter-spacing:-.02em}
.dialog p{color:var(--ink-2);font-size:14px;line-height:1.5;text-wrap:pretty}
.dialog p b{color:var(--ink);font-weight:500}
.dialog .x{position:absolute;right:16px;top:14px;color:var(--ink-3);font-size:16px}
.dialog .back{color:var(--ink-3);font-size:13px;display:inline-flex;align-items:center;gap:6px}
.note{border:1px solid var(--line-2);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;font-size:13px;line-height:1.5;color:var(--ink-2)}
.note b{color:var(--ink);font-weight:500;font-size:13.5px}
.note.warn{border-color:rgba(232,181,77,.5)}.note.warn b{color:var(--warn)}
.note.uv{border-color:rgba(140,107,255,.5)}.note.uv b{color:var(--uv-2)}
.note.bad{border-color:rgba(229,98,79,.5)}.note.bad b{color:var(--bad)}
.note.ok{border-color:rgba(88,201,139,.45)}.note.ok b{color:var(--ok)}
.cb{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--ink-2);line-height:1.45}
.cb i{flex:none;width:16px;height:16px;border-radius:4px;border:1px solid var(--line-2);margin-top:2px;display:inline-flex;align-items:center;justify-content:center}
.cb i.on{background:var(--uv);border-color:var(--uv)}
.cb i.on::after{content:"";width:8px;height:5px;border-left:2px solid var(--uv-ink);border-bottom:2px solid var(--uv-ink);transform:rotate(-45deg);margin-top:-2px}
.amt{border:1px solid var(--line-2);border-radius:8px;padding:14px 16px;display:flex;align-items:baseline;gap:10px;background:var(--panel)}
.amt.on{border-color:var(--uv)}
.amt .n{font-size:34px;line-height:1;font-weight:600;letter-spacing:-.03em;flex:1;min-width:0}
.amt .n.ph{color:var(--ink-4);font-weight:500}
.amt .u{font:500 12px var(--mono);color:var(--ink-3);letter-spacing:.04em}
.amt .mx{align-self:center;font:600 11px var(--mono);letter-spacing:.08em;color:var(--uv-2);border:1px solid rgba(140,107,255,.5);border-radius:4px;padding:4px 8px}
.under{display:flex;justify-content:space-between;gap:12px;font:400 12px var(--mono);color:var(--ink-3);padding:0 2px}
.under a{color:var(--uv-2)}
.srow{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-top:1px solid var(--line);font-size:13px}
.srow:first-child{border-top:0}
.srow>:first-child{color:var(--ink-2);white-space:nowrap}
.srow>:last-child{text-align:right;color:var(--ink);text-wrap:pretty}
.srow .sub{display:block;font-size:12px;color:var(--ink-3)}
.steps{display:flex;flex-direction:column;gap:0}
.step{display:grid;grid-template-columns:18px 1fr auto;gap:0 12px;padding:8px 0;align-items:start}
.step .dot{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--line-2);display:inline-flex;align-items:center;justify-content:center;margin-top:1px;position:relative}
.step .dot::before{content:"";position:absolute;left:7.5px;top:18px;width:1.5px;height:22px;background:var(--line)}
.step:last-child .dot::before{display:none}
.step.done .dot{border-color:var(--ok);background:var(--ok)}
.step.done .dot::after{content:"";width:8px;height:4px;border-left:1.8px solid var(--ground);border-bottom:1.8px solid var(--ground);transform:rotate(-45deg);margin-top:-2px}
.step.on .dot{border-color:var(--uv);box-shadow:0 0 0 3px var(--uv-dim)}
.step.on .dot::after{content:"";width:7px;height:7px;border-radius:50%;background:var(--uv)}
.step.bad .dot{border-color:var(--bad)}.step.bad .dot::after{content:"";width:7px;height:7px;background:var(--bad)}
.step .t{display:block;font-size:14px;color:var(--ink);font-weight:500;line-height:1.35}
.step.todo .t{color:var(--ink-2);font-weight:400}
.step .d{display:block;font-size:12.5px;color:var(--ink-3);line-height:1.45;margin-top:2px;text-wrap:pretty}
.step .r{font:400 11.5px var(--mono);color:var(--ink-3);white-space:nowrap;margin-top:3px;text-align:right}
.step.on .r{color:var(--uv-2)}.step.done .r{color:var(--ok)}
.bar{height:4px;border-radius:2px;background:var(--line-2);overflow:hidden;margin-top:8px}
.bar i{display:block;height:100%;background:var(--uv);border-radius:2px}
.bar.ok i{background:var(--ok)}
.check{display:flex;flex-direction:column;gap:10px}
.check .it{display:grid;grid-template-columns:18px 1fr auto;gap:12px;align-items:center;font-size:14px}
.check .it .k{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--line-2);display:inline-flex;align-items:center;justify-content:center}
.check .it.done .k{background:var(--ok);border-color:var(--ok)}
.check .it.done .k::after{content:"";width:8px;height:4px;border-left:1.8px solid var(--ground);border-bottom:1.8px solid var(--ground);transform:rotate(-45deg);margin-top:-2px}
.check .it.on .k{border-color:var(--uv);box-shadow:0 0 0 3px var(--uv-dim)}
.check .it.on .k::after{content:"";width:7px;height:7px;border-radius:50%;background:var(--uv)}
.check .it.todo{color:var(--ink-3)}
.check .it .r{font:400 11.5px var(--mono);color:var(--ink-3)}
.check .it.on .r{color:var(--uv-2)}
.check .it.bad .k{border-color:var(--bad)}.check .it.bad .k::after{content:"";width:7px;height:7px;background:var(--bad)}.check .it.bad .r{color:var(--bad)}
.act{border:1px solid var(--line);border-radius:8px;padding:12px 14px;display:grid;grid-template-columns:1fr auto;gap:8px 16px;align-items:start;background:var(--raised)}
.act.hi{border-color:var(--uv)}
.act .a{font-size:15px;font-weight:600;letter-spacing:-.01em}
.act .a small{font:400 12px var(--mono);color:var(--ink-3);margin-left:6px;letter-spacing:0}
.act .l{font-size:13px;color:var(--ink-2);margin-top:2px;text-wrap:pretty}
.act .r{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.act .r .when{font:400 11px var(--mono);color:var(--ink-3)}
.act .trail{grid-column:1/-1;margin-top:4px}
.act .more{grid-column:1/-1;border-top:1px solid var(--line);padding-top:10px;margin-top:4px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--ink-2)}
.act .more a{color:var(--uv-2)}
.srl{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:12px 0;border-top:1px solid var(--line)}
.srl:first-child{border-top:0;padding-top:0}
.srl .k{font-size:14px;color:var(--ink);font-weight:500}
.srl .h{font-size:12.5px;color:var(--ink-3);margin-top:2px;text-wrap:pretty}
.sw{width:36px;height:20px;border-radius:10px;border:1px solid var(--line-2);position:relative;flex:none}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--ink-3)}
.sw.on{background:var(--uv);border-color:var(--uv)}.sw.on::after{left:18px;background:var(--uv-ink)}
.field{display:flex;align-items:center;gap:8px;border:1px solid var(--line-2);border-radius:6px;padding:0 12px;height:38px;font:400 13px var(--mono);color:var(--ink);background:var(--panel)}
.field.on{border-color:var(--uv)}
.field .ph{color:var(--ink-4)}
.tabbar{position:absolute;left:0;right:0;bottom:0;height:64px;border-top:1px solid var(--line);background:var(--raised);display:grid;grid-template-columns:repeat(4,1fr);align-items:center;padding-bottom:8px}
.tabbar a{display:flex;flex-direction:column;align-items:center;gap:4px;font:500 10.5px var(--sans);color:var(--ink-3)}
.tabbar a.on{color:var(--ink)}
.tabbar svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.phone{width:390px;min-height:844px;position:relative;background:var(--ground);overflow:hidden}
.phone .top{display:flex;align-items:center;justify-content:space-between;height:52px;padding:0 16px;border-bottom:1px solid var(--line)}
.phone .act{grid-template-columns:1fr}.phone .act .r{flex-direction:row;align-items:center;justify-content:space-between}
.phone .pbody{padding:16px;display:flex;flex-direction:column;gap:14px;padding-bottom:84px}
.sheet{position:absolute;left:0;right:0;bottom:0;border-top:1px solid var(--line-2);border-radius:14px 14px 0 0;background:var(--raised);padding:14px 18px 22px;display:flex;flex-direction:column;gap:14px}
.sheet .grab{width:36px;height:4px;border-radius:2px;background:var(--line-2);margin:0 auto 4px}
.board{padding:28px 30px;display:flex;flex-direction:column;gap:18px}
.board h1{font-size:28px;letter-spacing:-.02em;line-height:1.1}
.board h2{font-size:17px;letter-spacing:-.01em}
.board p{color:var(--ink-2);font-size:14px;line-height:1.55;max-width:78ch;text-wrap:pretty}
.board p b{color:var(--ink);font-weight:500}
.rules{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 22px;counter-reset:r}
.rules>div{display:grid;grid-template-columns:26px 1fr;gap:10px;border-top:1px solid var(--line);padding-top:10px}
.rules>div::before{counter-increment:r;content:counter(r,decimal-leading-zero);font:500 12px var(--mono);color:var(--uv-2);margin-top:3px}
.rules b{display:block;font-size:14.5px;font-weight:600;margin-bottom:2px}
.rules span{font-size:13px;color:var(--ink-2);line-height:1.5}
.deck{display:grid;grid-template-columns:1.1fr 1fr;font-size:13px;border-top:1px solid var(--line-2)}
.deck>div{padding:9px 12px 9px 0;border-bottom:1px solid var(--line);line-height:1.45;text-wrap:pretty}
.deck>div:nth-child(odd){color:var(--ink-3);padding-right:20px}
.deck>div:nth-child(even){color:var(--ink)}
.deck .h{font:500 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);border-bottom:1px solid var(--line-2);padding:8px 0}
.deck .w{color:var(--ink-3);font:400 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;grid-column:1/-1;border-bottom:0;padding:16px 0 4px;color:var(--uv-2)}
.opts{display:grid;gap:18px}
.opt{border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:12px;background:var(--raised)}
.opt.pick{border-color:var(--uv)}
.opt .hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.opt .hd b{font-size:15px}
.opt .hd .tag{font:500 10.5px var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--uv-2);border:1px solid rgba(140,107,255,.5);border-radius:4px;padding:2px 7px}
.opt .pro{font-size:12.5px;color:var(--ink-2);line-height:1.5}
.opt .pro b{color:var(--ink);font-weight:500}
.mini{border:1px solid var(--line);border-radius:8px;background:var(--ground);overflow:hidden;position:relative}
.ann{position:absolute;font:400 11px/1.4 var(--mono);color:var(--warn);border:1px dashed rgba(232,181,77,.6);border-radius:6px;padding:6px 9px;background:rgba(10,10,11,.85);max-width:240px;text-wrap:pretty}
.cockpit{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px}
.cockpit .span2{grid-column:1/-1}
.loop{min-height:230px;display:flex;flex-direction:column}
.ph-chart{flex:1;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;color:var(--ink-3);font:400 12px var(--mono);border:1px dashed var(--line);border-radius:6px;min-height:150px;text-align:center;padding:16px;text-wrap:pretty}
.rail{display:flex;gap:3px;margin:8px 0 12px}
.rail i{flex:1;height:5px;border-radius:2px;background:var(--line-2)}
.rail i.on{background:var(--uv)}.rail i.me{background:var(--uv-2)}
.slider{height:4px;border-radius:2px;background:var(--line-2);position:relative;margin:14px 0 8px}
.slider i{position:absolute;left:0;top:0;height:100%;background:var(--uv);border-radius:2px}
.slider b{position:absolute;top:-6px;width:16px;height:16px;border-radius:50%;background:var(--uv-2);border:2px solid var(--ground);margin-left:-8px}
.ticks{display:flex;justify-content:space-between;font:400 11px var(--mono);color:var(--ink-3)}
.presto{display:flex;align-items:center;gap:12px;border:1px solid rgba(140,107,255,.4);border-radius:8px;padding:10px 12px;background:var(--uv-dim)}
.presto .glyph{width:28px;height:28px;border-radius:7px;background:var(--uv);color:var(--uv-ink);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex:none}
.presto b{font-size:13.5px;font-weight:600;display:block}
.presto span{font-size:12.5px;color:var(--ink-2)}
.hero{display:flex;flex-direction:column;gap:10px;padding:8px 0}
.hero h1{font-size:34px;line-height:1.05;letter-spacing:-.025em}
.hero p{color:var(--ink-2);font-size:15.5px;line-height:1.55;max-width:60ch;text-wrap:pretty}
.hero p b{color:var(--ink);font-weight:500}
.tbl{display:grid;grid-template-columns:130px 236px 1fr 170px;font-size:12.5px;line-height:1.45;border-top:1px solid var(--line-2)}
.tbl>div{padding:8px 10px 8px 0;border-bottom:1px solid var(--line);text-wrap:pretty}
.tbl .h{font:500 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3)}
.tbl .k{font:400 11.5px var(--mono);color:var(--ink-3)}
.tbl .w{grid-column:1/-1;font:500 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--uv-2);padding:18px 0 6px;border-bottom:1px solid var(--line-2)}
.tbl .a{color:var(--ink);font-weight:500}
.kbd{position:absolute;left:0;right:0;bottom:0;height:270px;background:#1c1c21;border-top:1px solid var(--line-2);padding:10px 6px;display:flex;flex-direction:column;gap:8px}
.kbd .r{display:flex;gap:6px;justify-content:center}
.kbd .r span{flex:1;max-width:46px;height:42px;border-radius:5px;background:#3a3a42;display:inline-flex;align-items:center;justify-content:center;font:400 15px var(--sans);color:var(--ink)}
.kbd .r span.d{background:#2a2a30;color:var(--ink-2)}
.kbd .r span.w{max-width:190px}
"""

MARK = '<span class="mark" aria-hidden="true"></span>'
CHEV = '<svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
ARROW_L = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>'

ICONS = {
    "mine": '<svg viewBox="0 0 24 24"><path d="M14 4l6 6M4 20l9-9M13 5l6 6"/><path d="M9 9c2-3 6-4 9-3-1 3-2 5-3 6"/></svg>',
    "wallet": '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12h5M3 10h18"/></svg>',
    "stats": '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    "verify": '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    "settings": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    "key": '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M15 8l3 3M18 5l2 2"/></svg>',
    "finger": '<svg viewBox="0 0 24 24"><path d="M6 11a6 6 0 0 1 12 0v3M9 11a3 3 0 0 1 6 0v6M12 11v9M4 15a8 8 0 0 0 16 0"/></svg>',
}


def page(body: str, width: int, extra_css: str = "", height: int | None = None) -> str:
    h = f"min-height:{height}px;" if height else "min-height:100%;"
    return (
        "<!doctype html>\n<html>\n<head>\n  <meta charset=\"utf-8\">\n"
        "  <script src=\"./support.js\"></script>\n</head>\n<body>\n<x-dc>\n<helmet>\n"
        f"  {FONTS}\n  <style>{CSS}{extra_css}</style>\n</helmet>\n"
        f'<div style="width:{width}px;{h}position:relative;background:var(--ground)">{body}</div>\n'
        "</x-dc>\n</body>\n</html>\n"
    )


# ---------------------------------------------------------------- chrome

def nav_link(label: str, key: str, active: str, icon: bool = True, ext: bool = False) -> str:
    ic = ICONS.get(key, "") if icon else ""
    e = '<span class="ext">↗</span>' if ext else ""
    return f'<a class="{"on" if key == active else ""}" href="#">{ic}{label}{e}</a>'


def header(active: str = "mine", right: str = "", version: str = "V5", icons: bool = True,
           account: str | None = "0x22a9…612a", status: str = "", app: str = "miner") -> str:
    """The unified product header: logo → the app's home, four destinations, the gear, the account."""
    if app == "miner":
        links = [nav_link("Mine", "mine", active, icons), nav_link("Wallet", "wallet", active, icons),
                 nav_link("Stats", "stats", active, icons, ext=True), nav_link("Verify", "verify", active, icons, ext=True)]
    elif app == "stats":
        links = [nav_link("Stats", "stats", active, icons), nav_link("Bridge", "bridge", active, False),
                 nav_link("Verify", "verify", active, icons), nav_link("Mine", "mine", active, icons, ext=True)]
    else:  # old origin
        links = [nav_link("Send ahead", "mine", active, icons), nav_link("Stats", "stats", active, icons, ext=True)]
    tag = f'<span class="vtag">{version}</span>' if version else ""
    acct = f'<span class="acct"><i></i>{account}</span>' if account else ""
    pill = f'<span class="pill {status}"><i></i>{status or "idle"}</span>' if status is not None else ""
    gear = f'<span class="gear">{ICONS["settings"]}</span>'
    return (f'<header class="hdr"><a class="brand" href="#">{MARK}Yacana{tag}</a>'
            f'<nav class="nav">{"".join(links)}</nav>'
            f'<span class="right"><span class="badge net">testnet</span>{pill}{right}{acct}{gear}</span></header>')


def tabbar(active: str) -> str:
    items = [("Mine", "mine"), ("Wallet", "wallet"), ("Stats", "stats"), ("Settings", "settings")]
    return '<nav class="tabbar">' + "".join(
        f'<a class="{"on" if k == active else ""}" href="#">{ICONS[k]}{l}</a>' for l, k in items) + "</nav>"


def phone(body: str, active: str = "wallet", title: str = "", right: str = "", sheet: str = "") -> str:
    top = (f'<div class="top"><span class="brand">{MARK}Yacana<span class="vtag">V5</span></span>'
           f'<span class="row" style="gap:8px"><span class="badge net">testnet</span>{right}<span class="gear">{ICONS["settings"]}</span></span></div>')
    veil = '<div class="veil"></div>' if sheet else ""
    sh = f'<div class="sheet"><div class="grab"></div>{sheet}</div>' if sheet else ""
    return f'<div class="phone">{top}<div class="pbody">{body}</div>{tabbar(active)}{veil}{sh}</div>'


# ---------------------------------------------------------------- primitives

def th(label: str, aside: str = "") -> str:
    a = f'<span class="aside">{aside}</span>' if aside else ""
    return f'<h2 class="th"><span>{label}</span>{a}</h2>'


def tile(inner: str, cls: str = "", style: str = "") -> str:
    return f'<div class="tile {cls}" style="{style}">{inner}</div>'


def kpi(label: str, value: str, unit: str = "", sub: str = "", lg: bool = False) -> str:
    u = f'<span class="u">{unit}</span>' if unit else ""
    s = f'<span class="s">{sub}</span>' if sub else ""
    l = f'<span class="lm">{label}</span>' if label else ""
    return f'<div class="kpi{" lg" if lg else ""}">{l}<span class="v">{value}{u}</span>{s}</div>'


def kv(label: str, value: str) -> str:
    return f'<div class="kv"><span>{label}</span><span>{value}</span></div>'


def btn(label: str, cls: str = "", icon: str = "", busy: bool = False) -> str:
    ic = ICONS.get(icon, icon) if icon else ""
    sp = '<span class="spin"></span>' if busy else ""
    return f'<span class="btn {cls}">{sp}{ic}{label}</span>'


def quiet(label: str) -> str:
    return f'<a class="quiet" href="#">{label}</a>'


def chip(label: str, value: str = "") -> str:
    v = f"<b>{value}</b>" if value else ""
    return f'<span class="chip"><span>{label}</span>{v}</span>'


def st(label: str, kind: str = "dim") -> str:
    return f'<span class="st {kind}"><i></i>{label}</span>'


def trail(items: list[tuple[str, str]]) -> str:
    return '<div class="trail">' + '<span class="arr">›</span>'.join(st(l, k) for l, k in items) + "</div>"


def note(title: str, body: str, kind: str = "") -> str:
    t = f"<b>{title}</b>" if title else ""
    return f'<div class="note {kind}">{t}<span>{body}</span></div>'


def checkbox(label: str, on: bool = False) -> str:
    return f'<label class="cb"><i class="{"on" if on else ""}"></i><span>{label}</span></label>'


def amount(value: str, unit: str, placeholder: bool = False, max_chip: bool = True, on: bool = False) -> str:
    mx = '<span class="mx">MAX</span>' if max_chip else ""
    return (f'<div class="amt {"on" if on else ""}"><span class="n {"ph" if placeholder else ""}">{value}</span>'
            f'<span class="u">{unit}</span>{mx}</div>')


def srow(label: str, value: str, sub: str = "") -> str:
    s = f'<span class="sub">{sub}</span>' if sub else ""
    return f'<div class="srow"><span>{label}</span><span>{value}{s}</span></div>'


def steps(items: list[tuple]) -> str:
    """(title, state, right, detail?) rows; state in done|on|todo|bad."""
    out = []
    for it in items:
        title, state, right = it[0], it[1], it[2]
        detail = it[3] if len(it) > 3 else ""
        bar = it[4] if len(it) > 4 else None
        d = f'<span class="d">{detail}</span>' if detail else ""
        b = f'<div class="bar"><i style="width:{bar}%"></i></div>' if bar is not None else ""
        out.append(f'<div class="step {state}"><span class="dot"></span><span><span class="t">{title}</span>{d}{b}</span><span class="r">{right}</span></div>')
    return '<div class="steps">' + "".join(out) + "</div>"


def checklist(items: list[tuple[str, str, str]]) -> str:
    return '<div class="check">' + "".join(
        f'<div class="it {s}"><span class="k"></span><span>{t}</span><span class="r">{r}</span></div>' for t, s, r in items) + "</div>"


def activity(amount_s: str, small: str, line: str, right: str, when: str, trail_items=None, more: str = "", cls: str = "") -> str:
    t = trail(trail_items) if trail_items else ""
    m = f'<div class="more">{more}</div>' if more else ""
    return (f'<div class="act {cls}"><div><div class="a">{amount_s}<small>{small}</small></div><div class="l">{line}</div></div>'
            f'<div class="r">{right}<span class="when">{when}</span></div>{t}{m}</div>')


def srl(k: str, h: str, right: str) -> str:
    hh = f'<div class="h">{h}</div>' if h else ""
    return f'<div class="srl"><div><div class="k">{k}</div>{hh}</div>{right}</div>'


def switch(on: bool) -> str:
    return f'<span class="sw {"on" if on else ""}"></span>'


def field(value: str, placeholder: bool = False, on: bool = False) -> str:
    return f'<div class="field {"on" if on else ""}"><span class="{"ph" if placeholder else ""}">{value}</span></div>'


def dialog(inner: str, w: int = 440, close: bool = True, back: bool = False) -> str:
    x = '<span class="x">✕</span>' if close else ""
    b = f'<a class="back" href="#">{ARROW_L}Back</a>' if back else ""
    return f'<div class="dialog" style="width:{w}px">{x}{b}{inner}</div>'


def dialog_page(inner: str, w: int = 440, pad: int = 26) -> str:
    """A dialog alone on its artboard (the cockpit behind it is another board)."""
    return page(f'<div style="padding:{pad}px">{dialog(inner, w)}</div>', w + pad * 2)


def annotation(text: str, x: int, y: int, w: int = 240) -> str:
    return f'<span class="ann" style="left:{x}px;top:{y}px;max-width:{w}px">{text}</span>'
