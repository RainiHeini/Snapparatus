#!/usr/bin/env python3
"""
kontaktblatt.py - Visual check ("contact sheet"): all devices with names on HTML sheets (+ PNG via Edge).

  python kontaktblatt.py [devices_folder] [output_folder]

Defaults: pipeline/out/devices -> pipeline/out/kontaktblatt. The PNGs are created with
Microsoft Edge's headless mode (if available); otherwise HTML only.
"""
import os, sys, json, glob, html, subprocess

PER_SHEET, COLS = 150, 10
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'out', 'devices'))
    dst = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(here, '..', 'out', 'kontaktblatt'))
    os.makedirs(dst, exist_ok=True)
    items = []
    for mf in sorted(glob.glob(os.path.join(src, '*_manifest.json'))):
        pal = os.path.basename(mf)[:-len('_manifest.json')]
        for m in json.load(open(mf, encoding='utf-8')):
            items.append((pal, m['file'], m['name']))
    rel = os.path.relpath(src, dst).replace(os.sep, '/')
    css = (f'body{{margin:0;font-family:Arial;background:#fff}}'
           f'.g{{display:grid;grid-template-columns:repeat({COLS},1fr);gap:3px;padding:4px}}'
           '.c{border:1px solid #ccc;text-align:center;height:200px;display:flex;flex-direction:column;'
           'justify-content:flex-end;overflow:hidden}.c img{max-height:160px;max-width:95%;margin:auto}'
           '.c div{font-size:9px;line-height:10px;height:22px;overflow:hidden}')
    sheets = (len(items) + PER_SHEET - 1) // PER_SHEET
    for k in range(sheets):
        chunk = items[k*PER_SHEET:(k+1)*PER_SHEET]
        cells = ''.join(f'<div class="c"><img src="{rel}/{html.escape(f)}"><div>{html.escape(p)}<br>{html.escape(n)}</div></div>'
                        for p, f, n in chunk)
        page = os.path.join(dst, f'blatt{k+1}.html')
        open(page, 'w', encoding='utf-8').write(
            f'<!doctype html><meta charset="utf-8"><title>Kontaktblatt {k+1}</title><style>{css}</style>'
            f'<div class="g">{cells}</div>')
        if os.path.exists(EDGE):
            rows = (len(chunk) + COLS - 1) // COLS
            subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars',
                            f'--window-size=1600,{rows*205+10}', f'--screenshot={page[:-5]}.png',
                            'file:///' + page.replace(os.sep, '/')], capture_output=True)
    print(f"{len(items)} devices on {sheets} sheets -> {dst}")

if __name__ == '__main__':
    main()
