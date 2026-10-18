"""Compose App Store screenshots (1290x2796) from raw simulator captures.

Each shot: caption on a Grange ground + the real capture in a phone frame
that runs off the bottom edge, plus an optional pulled-out chip.
Renders HTML through headless Chrome.

Raw captures live in app-store-screenshots/raw (iPhone 17 Pro Max simulator,
1320x2868, status bar overridden to 9:41). Re-capture with
`xcrun simctl io <udid> screenshot`, then: python3 scripts/app-store-shots.py
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "app-store-screenshots", "raw")
OUT = os.path.join(ROOT, "app-store-screenshots")
os.makedirs(OUT, exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

GREEN_D, GREEN_L = "#7EF0B2", "#16A34A"

SHOTS = [
    dict(name="1-payment", raw="A-donut.png", dark=True,
         head='Know the real payment.<br>Not just the P&amp;I.',
         sub="Principal, interest, tax, insurance, HOA. All of it.",
         chip=None),
    dict(name="2-pricepoint", raw="E-pp-final.png", dark=False,
         head='Guess the price.<br><span class="acc">Before it sells.</span>',
         sub="Real homes for sale near you. Closest call wins.",
         chip=None),
    dict(name="3-cash-to-close", raw="B-ctc.png", dark=True,
         head='See every dollar to close.<br>Before you offer.',
         sub="Down payment, closing costs, prepaids. No surprises.",
         chip=None),
    dict(name="4-rate-points", raw="C-rate.png", dark=False,
         head='Buy down the rate?<br><span class="acc">Know if it pays.</span>',
         sub="Breakeven on every rate and point option.",
         chip=None),
    dict(name="5-payoff", raw="D-equity.png", dark=True,
         head='Pay $300 extra.<br><span class="acc">Finish 61 months early.</span>',
         sub="See the interest you save and the equity you build.",
         chip=None),
]

TEMPLATE = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=block" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1290px;height:2796px;overflow:hidden}
body{font-family:Inter,sans-serif;background:%(bg)s;position:relative}
.grid{position:absolute;inset:0;background-image:
  linear-gradient(%(grid)s 2px,transparent 2px),linear-gradient(90deg,%(grid)s 2px,transparent 2px);
  background-size:86px 86px}
.cap{position:absolute;top:150px;left:70px;right:70px;text-align:center}
h1{font-size:96px;line-height:1.1;font-weight:800;letter-spacing:-2.5px;color:%(ink)s}
h1 .acc{color:%(acc)s}
p{margin-top:34px;font-size:42px;font-weight:500;color:%(subc)s;letter-spacing:-0.3px}
.phone{position:absolute;left:115px;top:620px;width:1060px;height:2300px;border-radius:150px;
  background:#0b0f19;padding:22px;box-shadow:0 60px 120px rgba(10,17,32,%(shadow)s)}
.screen{width:1016px;height:2207px;border-radius:130px;overflow:hidden;background:#fff}
.screen img{width:1016px;display:block}
.chip{position:absolute;top:%(chip_top)spx;%(chip_side)s:40px;background:#fff;border-radius:9999px;
  padding:34px 54px;box-shadow:0 30px 70px rgba(10,17,32,.35);display:flex;gap:26px;align-items:baseline}
.chip .l{font-size:40px;font-weight:600;color:#1a2238}
.chip .v{font-size:56px;font-weight:800;color:#16A34A;letter-spacing:-1px}
</style></head><body><div class="grid"></div>
<div class="cap"><h1>%(head)s</h1><p>%(sub)s</p></div>
<div class="phone"><div class="screen"><img src="file://%(raw)s"></div></div>
%(chip)s
</body></html>"""

def render(shot):
    dark = shot["dark"]
    chip_html, side, top = "", "right", 0
    if shot.get("chip"):
        side, top = shot["chip_pos"]
        l, v = shot["chip"]
        chip_html = f'<div class="chip"><span class="l">{l}</span><span class="v">{v}</span></div>'
    html = TEMPLATE % dict(
        bg="linear-gradient(180deg,#3B6BF5 0%,#2B4FCE 100%)" if dark else "#f4f9fc",
        grid="rgba(255,255,255,.05)" if dark else "rgba(59,107,245,.06)",
        ink="#ffffff" if dark else "#0a1120",
        acc=GREEN_D if dark else "#3B6BF5",
        subc="rgba(255,255,255,.82)" if dark else "#4a5672", sub=shot["sub"],
        shadow=".45" if dark else ".22",
        head=shot["head"], raw=os.path.join(RAW, shot["raw"]),
        chip=chip_html, chip_side=side, chip_top=top,
    )
    path = os.path.join(OUT, "raw", "_" + shot["name"] + ".html")
    open(path, "w").write(html)
    png = os.path.join(OUT, "screenshot-" + shot["name"] + ".png")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--allow-file-access-from-files", "--force-device-scale-factor=1",
                    "--window-size=1290,2796", "--virtual-time-budget=6000",
                    f"--screenshot={png}", "file://" + path],
                   check=True, capture_output=True)
    os.remove(path)
    print(png)

for s in SHOTS:
    if len(sys.argv) == 1 or s["name"] in sys.argv[1:]:
        render(s)
