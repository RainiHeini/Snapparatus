#!/usr/bin/env python3
"""
kontaktblatt.py - Visual check ("contact sheet"): all devices with names on HTML sheets (+ PNG via Edge).

  python kontaktblatt.py [devices_folder] [output_folder] [--joints]

Defaults: pipeline/out/devices -> pipeline/out/kontaktblatt. The PNGs are created with
Microsoft Edge's headless mode (if available); otherwise HTML only.
--joints draws the classified anchor points on top (sheets named schliffe1.html ...):
blue arrow = socket, orange arrow = cone, green = base, teal = support, purple = hose olive, grey = other;
arrows point outwards, labels give the joint size.
"""
import os, sys, json, glob, html, re, math, subprocess
from concurrent.futures import ThreadPoolExecutor

PER_SHEET, COLS = 150, 10
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
COLOR = {'socket': '#1f6fd1', 'cone': '#e07b00', 'base': '#2e9e44', 'support': '#0f9b9b', 'hose': '#9b3fc4', 'point': '#8a8a8a'}
SHORT = {'socket': 'H', 'cone': 'K'}


def joint_overlay(m, w, h):
    """SVG elements marking the classified anchors of one device (in its own coordinates)."""
    size = max(w, h); r = size * 0.025; L = size * 0.11; fs = size * 0.075; sw = size * 0.012
    out = []
    for s in m['snaps']:
        c = COLOR.get(s.get('type'), '#8a8a8a'); x, y = s['x'], s['y']
        if s.get('dir') is not None:
            a = math.radians(s['dir']); ex, ey = x + L*math.cos(a), y + L*math.sin(a)
            hx, hy = math.cos(a), math.sin(a); px, py = -hy, hx; k = L * 0.35
            out.append(f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{ex:.0f}" y2="{ey:.0f}" stroke="{c}" stroke-width="{sw:.0f}"/>'
                       f'<path d="M{ex:.0f},{ey:.0f} L{ex-hx*k+px*k*0.6:.0f},{ey-hy*k+py*k*0.6:.0f} '
                       f'L{ex-hx*k-px*k*0.6:.0f},{ey-hy*k-py*k*0.6:.0f}Z" fill="{c}"/>')
            if s.get('type') in SHORT:
                label = SHORT[s['type']] + (str(s['ns']) if s.get('ns') else '?')
                out.append(f'<text x="{ex + hx*fs*0.9:.0f}" y="{ey + hy*fs*0.9 + fs*0.35:.0f}" font-size="{fs:.0f}" '
                           f'font-family="Arial" font-weight="bold" fill="{c}" text-anchor="middle" '
                           f'stroke="#fff" stroke-width="{fs*0.25:.0f}" paint-order="stroke">{label}</text>')
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{c}"/>')
    return ''.join(out)


def inline_svg(path, m):
    """Device SVG inlined without its own snap circles, plus the joint overlay; margin for labels."""
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'<circle class="snap"[^>]*/>\n?', '', s)
    W, H = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', s).groups())
    pad = max(W, H) * 0.2
    body = s[s.index('>') + 1:s.rindex('</svg>')]
    return (f'<svg viewBox="{-pad:.0f} {-pad:.0f} {W+2*pad:.0f} {H+2*pad:.0f}" preserveAspectRatio="xMidYMid meet">'
            f'{body}{joint_overlay(m, W, H)}</svg>')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    joints = '--joints' in sys.argv
    here = os.path.dirname(os.path.abspath(__file__))
    src = os.path.abspath(args[0] if len(args) > 0 else os.path.join(here, '..', 'out', 'devices'))
    dst = os.path.abspath(args[1] if len(args) > 1 else os.path.join(here, '..', 'out', 'kontaktblatt'))
    os.makedirs(dst, exist_ok=True)
    items = []
    for mf in sorted(glob.glob(os.path.join(src, '*_manifest.json'))):
        pal = os.path.basename(mf)[:-len('_manifest.json')]
        for m in json.load(open(mf, encoding='utf-8')):
            items.append((pal, m))
    rel = os.path.relpath(src, dst).replace(os.sep, '/')
    css = (f'body{{margin:0;font-family:Arial;background:#fff}}'
           f'.g{{display:grid;grid-template-columns:repeat({COLS},1fr);gap:3px;padding:4px}}'
           '.c{border:1px solid #ccc;text-align:center;height:200px;display:flex;flex-direction:column;'
           'justify-content:flex-end;overflow:hidden}.c img,.c svg{height:160px;max-width:95%;margin:auto}'
           '.c div{font-size:9px;line-height:10px;height:22px;overflow:hidden}')
    prefix = 'schliffe' if joints else 'blatt'
    sheets = (len(items) + PER_SHEET - 1) // PER_SHEET
    shots = []
    for k in range(sheets):
        chunk = items[k*PER_SHEET:(k+1)*PER_SHEET]
        cells = []
        for p, m in chunk:
            pic = inline_svg(os.path.join(src, m['file']), m) if joints else f'<img src="{rel}/{html.escape(m["file"])}">'
            cells.append(f'<div class="c">{pic}<div>{html.escape(p)}<br>{html.escape(m["name"])}</div></div>')
        page = os.path.join(dst, f'{prefix}{k+1}.html')
        open(page, 'w', encoding='utf-8').write(
            f'<!doctype html><meta charset="utf-8"><title>Kontaktblatt {k+1}</title><style>{css}</style>'
            f'<div class="g">{"".join(cells)}</div>')
        if os.path.exists(EDGE):
            rows = (len(chunk) + COLS - 1) // COLS
            shots.append([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                          f'--window-size=1600,{rows*205+10}', f'--screenshot={page[:-5]}.png',
                          'file:///' + page.replace(os.sep, '/')])
    with ThreadPoolExecutor() as pool:                    # screenshots in parallel
        list(pool.map(lambda cmd: subprocess.run(cmd, capture_output=True), shots))
    print(f"{len(items)} devices on {sheets} sheets -> {dst}")


if __name__ == '__main__':
    main()
