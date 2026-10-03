#!/usr/bin/env python3
"""
export_all.py — Steuert das laufende C-Design fern und exportiert alle CDW-Paletten
als WMF (über C-Designs eigenen WMF-Export). Reine win32-Nachrichten, KEIN pywinauto.

  python export_all.py [CDW_ordner] [WMF_ordner] [--skip-existing] [--only NAME]

Voraussetzung: C-Design läuft. WÄHREND DES LAUFS Maus/Tastatur nicht anfassen.

Robust gegen Hänger: alle Befehle/Klicks per PostMessage (asynchron) statt
SendMessage (synchron) — SendMessage blockiert ewig, sobald ein modaler Dialog offen
ist. Texteingabe per WM_SETTEXT mit Timeout. Auf Dialoge wird mit Timeout gepollt.

Ablauf pro Palette (verifiziert):
  Menü Bibliothek(103) → Öffnen-Dialog → voller CDW-Pfad ins Dateiname-Feld → OK(1)
  Menü Exportieren(107) → Speichern-Dialog → voller WMF-Pfad → OK(1) → ggf. "Ja"
  Menü Neu(101)         → "speichern?" → "Nein"
Der angezeigte Ordner ist egal, weil der VOLLE Pfad ins Dateiname-Feld geht.
"""
import sys, os, re, time, glob, argparse
import win32gui, win32con

CMD_NEU, CMD_BIBLIOTHEK, CMD_EXPORT = 101, 103, 107
IDOK, IDCANCEL = 1, 2
ES_MULTILINE = 0x0004

# ---------- win32-Helfer (schnell, ohne implizite Wartezeiten) ----------
def find_top(cls):
    out = []
    def cb(h, _):
        if win32gui.IsWindowVisible(h) and win32gui.GetClassName(h) == cls:
            out.append(h)
        return True
    win32gui.EnumWindows(cb, None)
    return out

def main_hwnd():
    w = find_top("C-Design_3")
    if not w: raise RuntimeError("C-Design-Fenster nicht gefunden")
    return w[0]

def children(parent, pred):
    out = []
    def cb(h, _):
        try:
            if pred(h): out.append(h)
        except Exception:
            pass
        return True
    win32gui.EnumChildWindows(parent, cb, None)
    return out

def cls_of(h): return win32gui.GetClassName(h)
def txt_of(h): return win32gui.GetWindowText(h)

def filename_edit(dlg):
    """Einzeiliges Dateiname-Edit (im ComboBoxEx32) finden."""
    combos = children(dlg, lambda h: cls_of(h) == "ComboBoxEx32")
    for cb in combos:
        eds = children(cb, lambda h: cls_of(h) == "Edit")
        if eds: return eds[0]
    # Fallback: erstes einzeiliges Edit
    for e in children(dlg, lambda h: cls_of(h) == "Edit"):
        if not (win32gui.GetWindowLong(e, win32con.GWL_STYLE) & ES_MULTILINE):
            return e
    return None

def set_text(hwnd, text):
    win32gui.SendMessageTimeout(hwnd, win32con.WM_SETTEXT, 0, text,
                                win32con.SMTO_ABORTIFHUNG, 2000)

def post_cmd(hwnd, cmd):
    win32gui.PostMessage(hwnd, win32con.WM_COMMAND, cmd, 0)

def button(dlg, text):
    want = text.replace("&", "").lower()
    for b in children(dlg, lambda h: cls_of(h) == "Button"):
        if want in txt_of(b).replace("&", "").lower():
            return b
    return None

def click(hwnd):
    win32gui.PostMessage(hwnd, win32con.BM_CLICK, 0, 0)

def wait_dialog(exclude=(), timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        for h in find_top("#32770"):
            if h not in exclude:
                return h
        time.sleep(0.15)
    return None

def wait_gone(hwnd, timeout=20):
    end = time.time() + timeout
    while time.time() < end:
        if not win32gui.IsWindow(hwnd) or not win32gui.IsWindowVisible(hwnd):
            return True
        time.sleep(0.15)
    return False

# ---------- ein Palette exportieren ----------
def export_one(main, cdw_path, wmf_path):
    # 0) etwaige Reste wegräumen
    h = wait_dialog(timeout=0.5)
    if h: post_cmd(h, IDCANCEL); wait_gone(h, 3)

    # 1) Bibliothek -> Öffnen
    post_cmd(main, CMD_BIBLIOTHEK)
    dlg = wait_dialog(timeout=15)
    if not dlg: return "kein Öffnen-Dialog"
    ed = filename_edit(dlg)
    if not ed: return "kein Dateiname-Feld (Öffnen)"
    set_text(ed, cdw_path); time.sleep(0.2)
    post_cmd(dlg, IDOK)
    if not wait_gone(dlg, 20): return "Öffnen-Dialog blieb offen"
    time.sleep(1.0)                       # Datei laden lassen

    # 2) Exportieren -> Speichern  (Typ ist bereits WMF)
    post_cmd(main, CMD_EXPORT)
    dlg = wait_dialog(timeout=15)
    if not dlg: return "kein Export-Dialog"
    ed = filename_edit(dlg)
    if not ed: return "kein Dateiname-Feld (Export)"
    before = os.path.getmtime(wmf_path) if os.path.exists(wmf_path) else 0
    set_text(ed, wmf_path); time.sleep(0.2)
    post_cmd(dlg, IDOK); time.sleep(0.8)
    ov = wait_dialog(exclude=(dlg,), timeout=2)          # "Überschreiben?"
    if ov:
        b = button(ov, "Ja")
        if b: click(b)
        wait_gone(ov, 5)
    wait_gone(dlg, 10)
    # auf Datei warten
    ok = False; end = time.time() + 20
    while time.time() < end:
        if os.path.exists(wmf_path) and os.path.getmtime(wmf_path) > before and os.path.getsize(wmf_path) > 0:
            ok = True; break
        time.sleep(0.3)

    # 3) Neu -> Nein
    post_cmd(main, CMD_NEU)
    pr = wait_dialog(timeout=8)
    if pr:
        b = button(pr, "Nein")
        if b: click(b)
        wait_gone(pr, 5)
    time.sleep(0.6)
    return "ok" if ok else "WMF nicht erschienen"

def run(cdw_dir, wmf_dir, skip_existing=False, only=None):
    os.makedirs(wmf_dir, exist_ok=True)
    main = main_hwnd()
    seen = {}                                  # Windows ist case-insensitiv -> entduplizieren
    for f in glob.glob(os.path.join(cdw_dir, "*.CDW")) + glob.glob(os.path.join(cdw_dir, "*.cdw")):
        seen[os.path.normcase(f)] = f
    files = sorted(seen.values())
    if only: files = [f for f in files if only.lower() in os.path.basename(f).lower()]
    print(f"{len(files)} Paletten -> {wmf_dir}\n", flush=True)
    results = {}
    for i, cdw in enumerate(files, 1):
        name = os.path.splitext(os.path.basename(cdw))[0]
        wmf = os.path.abspath(os.path.join(wmf_dir, name + ".wmf"))
        if skip_existing and os.path.exists(wmf):
            print(f"[{i:2d}/{len(files)}] {name:14s} übersprungen", flush=True); results[name] = "skip"; continue
        try:
            r = export_one(main, os.path.abspath(cdw), wmf)
        except Exception as e:
            r = f"FEHLER {e}"
        results[name] = r
        print(f"[{i:2d}/{len(files)}] {name:14s} {r}", flush=True)
    ok = sum(1 for v in results.values() if v == "ok")
    bad = [k for k, v in results.items() if v not in ("ok", "skip")]
    print(f"\nFertig: {ok}/{len(files)} ok. Probleme: {bad}", flush=True)
    return results

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("cdw_dir", nargs="?", default=os.path.normpath(os.path.join(here, '..', 'source', 'CDW')))
    ap.add_argument("wmf_dir", nargs="?", default=os.path.normpath(os.path.join(here, '..', 'source', 'WMF')))
    ap.add_argument("--skip-existing", action="store_true")
    ap.add_argument("--only", default=None)
    a = ap.parse_args()
    run(a.cdw_dir, a.wmf_dir, a.skip_existing, a.only)
