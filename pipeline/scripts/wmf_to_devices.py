#!/usr/bin/env python3
"""
wmf_to_devices.py — All-in-one, dependency-free (standard Python only).

Takes a palette WMF exported from C-Design (nested table with several
devices) and produces: one SVG per device (glass outline + scale + labels as
real <text>) plus a manifest.json with name (hierarchy path), NS size, snap anchors.

  python wmf_to_devices.py <palette.wmf | folder> <output_folder> [--only scripts/paletten.txt]

Splitting: cell tree (frame lines that cross a rectangle edge to edge,
recursively) instead of a global grid -> rowspan/colspan and sub-tables stay intact.

No libwmf, no wmf2svg, no server needed — the WMF parser is built in here.
WMF coordinates are 0.01 mm (inch=2540). SVG width/height in mm (/100 * 10 -> /10).
"""
import sys, os, re, json, struct, glob

# ---------- WMF parser (only MoveTo/LineTo/TextOut + object/font table) ----------
def _s16(b, o): return struct.unpack('<h', b[o:o+2])[0]
def _u16(b, o): return struct.unpack('<H', b[o:o+2])[0]
def _u32(b, o): return struct.unpack('<I', b[o:o+4])[0]

import math
import joints
import fill
# all WMF records that DRAW geometry (for the completeness check)
_DRAW = {0x0214, 0x0213, 0x0325, 0x0324, 0x0538, 0x0418, 0x0817, 0x081A,
         0x0830, 0x041B, 0x061C, 0x0521, 0x0a32}
# known NON-drawing records (state/objects) -> no warning
_HARMLESS = {0x012D, 0x01F0, 0x02FA, 0x02FB, 0x02FC, 0x02FD, 0x0104, 0x0209,
             0x0102, 0x0103, 0x0106, 0x0107, 0x0201, 0x020B, 0x020C, 0x012E,
             0x0211, 0x0231, 0x0127, 0x0202, 0x0105, 0x020A, 0x020D, 0x020E,
             0x0149, 0x0248, 0x0628, 0x040C, 0x0035, 0x01F9, 0x0F43, 0x0142}

def _ellipse_pts(l, t, r, b, n=48):
    cx, cy, rx, ry = (l+r)/2, (t+b)/2, (r-l)/2, (b-t)/2
    return [(cx+rx*math.cos(2*math.pi*i/n), cy+ry*math.sin(2*math.pi*i/n)) for i in range(n+1)]

def _arc_pts(l, t, r, b, xs, ys, xe, ye, n=32):
    cx, cy, rx, ry = (l+r)/2, (t+b)/2, (r-l)/2, (b-t)/2
    a0 = math.atan2(ys-cy, xs-cx); a1 = math.atan2(ye-cy, xe-cx)
    if a1 <= a0: a1 += 2*math.pi
    return [(cx+rx*math.cos(a0+(a1-a0)*i/n), cy+ry*math.sin(a0+(a1-a0)*i/n)) for i in range(n+1)]

def parse_wmf(path, warn=True):
    """-> (bbox(l,t,r,b), polylines[[(x,y)..]], texts[(x,y,str,fonth,align)])"""
    d = open(path, 'rb').read(); off = 0; bbox = None
    if d[:4] == bytes.fromhex('d7cdc69a'):              # placeable header
        l, t, r, b = struct.unpack('<hhhh', d[6:14]); bbox = (l, t, r, b); off = 22
    off += 18                                            # standard header
    cur = (0, 0); pls = []; seg = None; texts = []
    objs = []; font = {'h': 200}; align = 0; unhandled = {}
    def addobj(o):
        for i in range(len(objs)):
            if objs[i] is None: objs[i] = o; return
        objs.append(o)
    while off + 6 <= len(d):
        size = _u32(d, off); func = _u16(d, off+4); p = off + 6
        if func == 0x0214:                              # MoveTo (y,x)
            cur = (_s16(d, p+2), _s16(d, p))
            if seg and len(seg) >= 2: pls.append(seg)
            seg = [cur]
        elif func == 0x0213:                            # LineTo (y,x)
            cur = (_s16(d, p+2), _s16(d, p))
            if seg is None: seg = [cur]
            seg.append(cur)
        elif func == 0x0325:                            # Polyline
            n = _u16(d, p); pls.append([(_s16(d, p+2+4*i), _s16(d, p+4+4*i)) for i in range(n)])
        elif func == 0x0324:                            # Polygon (closed)
            n = _u16(d, p); pp = [(_s16(d, p+2+4*i), _s16(d, p+4+4*i)) for i in range(n)]; pls.append(pp + [pp[0]])
        elif func == 0x0538:                            # PolyPolygon
            cnt = _u16(d, p); counts = [_u16(d, p+2+2*i) for i in range(cnt)]; q = p+2+2*cnt
            for c in counts:
                pp = [(_s16(d, q+4*i), _s16(d, q+2+4*i)) for i in range(c)]; pls.append(pp + [pp[0]]); q += 4*c
        elif func == 0x041B:                            # Rectangle (b,r,t,l)
            b_, r_, t_, l_ = (_s16(d, p+2*i) for i in range(4)); pls.append([(l_, t_), (r_, t_), (r_, b_), (l_, b_), (l_, t_)])
        elif func == 0x061C:                            # RoundRect (eh,ew,b,r,t,l) -> approximated as rectangle
            b_, r_, t_, l_ = (_s16(d, p+4+2*i) for i in range(4)); pls.append([(l_, t_), (r_, t_), (r_, b_), (l_, b_), (l_, t_)])
        elif func == 0x0418:                            # Ellipse (b,r,t,l)
            b_, r_, t_, l_ = (_s16(d, p+2*i) for i in range(4)); pls.append(_ellipse_pts(l_, t_, r_, b_))
        elif func in (0x0817, 0x081A, 0x0830):          # Arc/Pie/Chord (ye,xe,ys,xs,b,r,t,l)
            ye, xe, ys, xs, b_, r_, t_, l_ = (_s16(d, p+2*i) for i in range(8)); pls.append(_arc_pts(l_, t_, r_, b_, xs, ys, xe, ye))
        elif func == 0x0a32:                            # ExtTextOut (y,x,count,opts,[rect],str)
            y = _s16(d, p); x = _s16(d, p+2); cnt = _u16(d, p+4); opts = _u16(d, p+6)
            q = p+8 + (8 if opts & 6 else 0); s = d[q:q+cnt].decode('latin-1', 'replace').strip('\x00').strip()
            texts.append((x, y, s, font['h'], align))
        elif func == 0x02FB: addobj({'type': 'font', 'h': abs(_s16(d, p))})
        elif func == 0x02FA: addobj({'type': 'pen'})
        elif func == 0x02FC: addobj({'type': 'brush'})
        elif func == 0x012D:                            # SelectObject
            i = _u16(d, p)
            if i < len(objs) and objs[i] and objs[i].get('type') == 'font': font = objs[i]
        elif func == 0x01F0:                            # DeleteObject
            i = _u16(d, p)
            if i < len(objs): objs[i] = None
        elif func == 0x012E: align = _u16(d, p)         # SetTextAlign
        elif func == 0x0521:                            # TextOut (count,str,y,x)
            cnt = _u16(d, p); s = d[p+2:p+2+cnt].decode('latin-1', 'replace').strip('\x00').strip()
            pad = cnt + (cnt & 1); y = _s16(d, p+2+pad); x = _s16(d, p+2+pad+2)
            texts.append((x, y, s, font['h'], align))
        elif func not in _HARMLESS and func != 0:
            unhandled[func] = unhandled.get(func, 0) + 1   # unknown record -> possibly geometry!
        if func == 0: break
        off += size * 2
    if seg and len(seg) >= 2: pls.append(seg)
    if warn and unhandled:
        print("  WARNING unknown WMF records (possibly missing geometry): "
              + ", ".join(f"0x{f:04x}x{c}" for f, c in sorted(unhandled.items())))
    return bbox, pls, texts

# ---------- grid cut: table -> cells -> devices ----------
def grid_lines(pls, TW, TH):
    hori = sorted({round(s[0][1]) for s in pls if len(s) == 2 and abs(s[0][1]-s[1][1]) < 5 and abs(s[1][0]-s[0][0]) > 0.25*TW})
    vert = sorted({round(s[0][0]) for s in pls if len(s) == 2 and abs(s[0][0]-s[1][0]) < 5 and abs(s[1][1]-s[0][1]) > 0.12*TH})
    return hori, vert

def is_scale_number(t): return bool(re.fullmatch(r'\d{1,4}', t.strip()))
def is_variant(t):
    """pure size spec (NS 29, 500 mL, 1 Liter, 45°) instead of a device name"""
    return bool(re.fullmatch(r'(NS\s?\d+(/\d+)?|[\d,.]+\s*(mL|ml|Liter|L)|-?\d+\s*°)(\s*[,/]\s*(NS\s?\d+|[\d,.]+\s*(mL|Liter)))*', t.strip()))

def merge_char_texts(texts):
    """C-Design exports labels CHARACTER BY CHARACTER (each letter a text record,
    spaces as empty string; rotated angles like -75° as well). Consecutive
    single characters of the same font height in proximity are joined into one string;
    'o' as superscript after digits = degree sign."""
    out = []; last = None                      # last = (x, y) of the last appended character
    for (x, y, s, h, al) in texts:
        if out and len(s) <= 1:
            px, py, ps, ph, pal = out[-1]
            same = ph == h or (s == 'o' and h < ph and ps[-1:].isdigit())
            if same and (x-last[0])**2 + (y-last[1])**2 <= (1.3*ph)**2 and (ps[-1:] != 'o' or not s.isdigit()):
                out[-1] = (px, py, ps + (s or ' '), ph, pal); last = (x, y); continue
        out.append((x, y, s, h, al)); last = (x, y)
    return [(x, y, re.sub(r'(?<=\d)o$', '°', s.strip()), h, al) for (x, y, s, h, al) in out if s.strip()]

def clean_name(t):
    t = re.sub(r'\s+', '_', t.strip()); t = re.sub(r'[^\w\-]', '', t); return t or None

_UML = str.maketrans({'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue', 'ß': 'ss'})
def fn_safe(name):
    """File name: transliterate umlauts (Kühler->Kuehler), ASCII-clean the rest."""
    return re.sub(r'[^A-Za-z0-9]+', '_', name.translate(_UML)).strip('_')[:80] or 'geraet'

def is_frame(seg, w, h):
    """Table/separator line: exactly axis-parallel 2-point line, long.
    Device tubes are polylines (>2 points, round ends) or slightly slanted."""
    if len(seg) != 2: return False
    (x0, y0), (x1, y1) = seg
    return (abs(y1-y0) < 3 and abs(x1-x0) > 0.30*w) or (abs(x1-x0) < 3 and abs(y1-y0) > 0.22*h)

def _simplify(pts, tol):
    """Douglas-Peucker: drop points closer than tol to the line between their neighbours."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:                                          # iterative, long chains would hit the recursion limit
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx-ax, by-ay; L = math.hypot(dx, dy)
        imax, dmax = None, tol
        for i in range(a + 1, b):
            p = pts[i]
            d = math.hypot(p[0]-ax, p[1]-ay) if L == 0 else abs(dy*(p[0]-ax) - dx*(p[1]-ay)) / L
            if d > dmax: imax, dmax = i, d
        if imax is not None:
            keep[imax] = True; stack += [(a, imax), (imax, b)]
    return [p for p, k in zip(pts, keep) if k]

def merge_strokes(strokes, snap=0.6, tol=1.5):
    """Join strokes that meet end to end at a point no other stroke touches (so junctions stay
    separate), then drop points without visible effect. Round caps and joins make the result
    look identical to the input."""
    key = lambda p: (round(p[0]/snap), round(p[1]/snap))
    chains = [list(s) for s in strokes if len(s) >= 2]
    ends = {}
    for i, c in enumerate(chains):
        for e in (0, -1): ends.setdefault(key(c[e]), []).append(i)
    alive = [True] * len(chains)
    def take(i):
        alive[i] = False
        for e in (0, -1):
            lst = ends[key(chains[i][e])]
            if i in lst: lst.remove(i)
    out = []
    for i in range(len(chains)):
        if not alive[i]: continue
        take(i); cur = chains[i]
        for side in (1, 0):                               # grow forward, then backward
            while True:
                k = key(cur[-1] if side else cur[0]); cand = ends.get(k, [])
                if len(cand) != 1: break                  # dead end or junction
                j = cand[0]; nxt = chains[j]; take(j)
                if key(nxt[0]) != k: nxt = nxt[::-1]      # orient to continue from k
                cur = cur + nxt[1:] if side else nxt[::-1][:-1] + cur
        closed = len(cur) > 3 and key(cur[0]) == key(cur[-1])
        pts = _simplify(cur, tol)
        if closed and key(pts[0]) != key(pts[-1]): pts.append(pts[0])
        out.append(pts)
    return out

def path_data(strokes, ox, oy):
    """SVG path data for a list of strokes, coordinates relative to (ox, oy), 0.01 mm integers."""
    parts = []
    for s in strokes:
        pts = [(round(x-ox), round(y-oy)) for x, y in s]
        parts.append('M' + ' '.join(f'{x} {y}' for x, y in pts[:1]) + 'L' + ' '.join(f'{x} {y}' for x, y in pts[1:]))
    return ''.join(parts)

def emit_svg(strokes, texts, ox, oy, W, H, snaps=()):
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
         f'width="{W//12}" height="{H//12}">',
         f'<path fill="none" stroke="black" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" '
         f'd="{path_data(merge_strokes(strokes), ox, oy)}"/>']
    for (x, y, s, h, al) in texts:
        anc = 'end' if al & 6 == 2 else 'middle' if al & 6 == 6 else 'start'
        base = (y-oy) + (0 if (al & 0x18) == 8 else h*0.85)
        s = s.replace('&', '&amp;').replace('<', '&lt;')
        o.append(f'<text x="{x-ox}" y="{base:.0f}" font-family="Arial" font-size="{h}" text-anchor="{anc}">{s}</text>')
    for sp in snaps:                                    # snap points (class "snap", can be shown/hidden via CSS)
        attrs = ''.join(f' data-{k}="{sp[k]}"' for k in ('type', 'dir', 'ns', 'system', 'shape') if sp.get(k) is not None)
        o.append(f'<circle class="snap" cx="{sp["x"]}" cy="{sp["y"]}" r="30" fill="red"{attrs}/>')
    o.append('</svg>')
    return "\n".join(o)

def _bbox(strokes):
    xs = [p[0] for s in strokes for p in s]; ys = [p[1] for s in strokes for p in s]
    return min(xs), min(ys), max(xs), max(ys)

def cluster_strokes(strokes, thr):
    """Union-find over point proximity: connected strokes = one device (no cropping)."""
    n = len(strokes); par = list(range(n))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    G = {}
    for si, s in enumerate(strokes):
        for (x, y) in s: G.setdefault((int(x//thr), int(y//thr)), []).append((x, y, si))
    for (cx, cy), pts in G.items():
        nb = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1): nb += G.get((cx+dx, cy+dy), [])
        for (x, y, si) in pts:
            for (x2, y2, sj) in nb:
                if si != sj and (x-x2)**2 + (y-y2)**2 <= thr*thr: par[find(si)] = find(sj)
    groups = {}
    for i in range(n): groups.setdefault(find(i), []).append(i)
    return list(groups.values())

def merge_overlapping(groups, dev, gap):
    """Merges clusters whose bounding boxes (expanded by gap) overlap.
    Joins parts of ONE device (coil inside jacket, joint below body),
    keeps separate devices (spacing > gap) separate."""
    bbs = [_bbox([dev[i] for i in g]) for g in groups]
    n = len(groups); par = list(range(n))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for i in range(n):
        ax0, ay0, ax1, ay1 = bbs[i]
        for j in range(i+1, n):
            bx0, by0, bx1, by1 = bbs[j]
            if not (ax1+gap < bx0 or bx1+gap < ax0 or ay1+gap < by0 or by1+gap < ay0):
                par[find(i)] = find(j)
    merged = {}
    for i in range(n): merged.setdefault(find(i), []).extend(groups[i])
    return list(merged.values())

def section_title(texts, dbb):
    """Largest font above the device whose x range overlaps = section/column title."""
    x0, y0, x1, y1 = dbb
    cands = [(h, abs(y0-ty), s) for (tx, ty, s, h, al) in texts
             if ty < y0 and x0-200 <= tx <= x1+200 and not is_scale_number(s) and clean_name(s)]
    if not cands: return None
    cands.sort(key=lambda c: (-c[0], c[1]))     # largest font, then nearest
    return cands[0][2].strip()

def centroid(s):
    return sum(p[0] for p in s)/len(s), sum(p[1] for p in s)/len(s)

# ---------- cell tree: split nested table recursively ----------
# LaboBib palettes are NOT a regular grid: cells can span several
# rows/columns (rowspan/colspan) and have their own subdivisions.
# Therefore: a rectangle is only split by lines that REALLY cross it edge to edge;
# the pieces are split further recursively. Device walls
# (even long, straight ones) never reach the cell border -> no false cuts.
CLUSTER_THR = 0.012       # point distance (fraction of sheet width) below which strokes are connected
SUPPORT_PALETTES = {'STATMAT1': 'flat', 'RUEHREN-1': 'flat', 'HEIZEN-1': 'bowl'}   # lab jacks, stirrers, mantles
# palettes whose devices are vessels that can hold a liquid fill (MINILAB left out for now:
# its closed screw caps and instrument boxes would be "filled" too)
FILL_PALETTES = {'BECHERGL', 'DESTIL-1', 'DEWARGEF', 'EINLEIT1', 'ERLENMEY', 'EXTRAKT1', 'FLASCHEN',
                 'KOLB-1H', 'KOLB-MH1', 'KOLB-MH2', 'MESSZYLI', 'MISCHZYL', 'SAMMELSU', 'STANDZYL',
                 'TRENNEN1', 'TRENNEN2', 'TROPFTRI'}
# palettes made of separate tables where the title stands only above the first one
NAME_PREFIX = {'KRUEMM': 'Krümmer (Bogenstücke)'}
# devices without any heading in the original, named by hand (stable ID -> catalogue path).
# GEFSYMB holds the old EU hazard symbols (pre-GHS) in two rows; the pairs Xn/Xi, F/F+ and T/T+
# share one pictogram, the original only told them apart by the code letter.
NAMES_BY_ID = {
    'gefsymb/1-1': ['Gefahrensymbole (alt, vor GHS)', 'Gesundheitsschädlich (Xn)'],
    'gefsymb/7-1': ['Gefahrensymbole (alt, vor GHS)', 'Ätzend (C)'],
    'gefsymb/13-1': ['Gefahrensymbole (alt, vor GHS)', 'Explosionsgefährlich (E)'],
    'gefsymb/19-1': ['Gefahrensymbole (alt, vor GHS)', 'Leichtentzündlich (F)'],
    'gefsymb/25-1': ['Gefahrensymbole (alt, vor GHS)', 'Giftig (T)'],
    'gefsymb/1-7': ['Gefahrensymbole (alt, vor GHS)', 'Reizend (Xi)'],
    'gefsymb/7-7': ['Gefahrensymbole (alt, vor GHS)', 'Umweltgefährlich (N)'],
    'gefsymb/13-7': ['Gefahrensymbole (alt, vor GHS)', 'Brandfördernd (O)'],
    'gefsymb/19-7': ['Gefahrensymbole (alt, vor GHS)', 'Hochentzündlich (F+)'],
    'gefsymb/25-7': ['Gefahrensymbole (alt, vor GHS)', 'Sehr giftig (T+)'],
}
# vessel palettes where a missing bottom anchor is added at the lowest point
ADD_BASE_PALETTES = {'KOLB-1H', 'KOLB-MH1', 'KOLB-MH2', 'FLASCHEN', 'ERLENMEY', 'BECHERGL', 'TRENNEN1'}
MERGE_GAP = 0.006         # bounding-box gap (fraction of sheet width) below which parts are ONE device
FRAME_TOL = 60          # 0.6 mm: tolerance for "touches the edge"
MIN_SEG = 200           # 2 mm: shorter axis-parallel pieces are never frames

def frame_segments(pls):
    """All axis-parallel sub-segments >= MIN_SEG, collinear ones merged.
    -> hori: [(y, x0, x1)], vert: [(x, y0, y1)]"""
    H = {}; V = {}
    for s in pls:
        for (x0, y0), (x1, y1) in zip(s, s[1:]):
            if abs(y1-y0) < 3 and abs(x1-x0) >= MIN_SEG:
                H.setdefault(round((y0+y1)/2), []).append((min(x0, x1), max(x0, x1)))
            elif abs(x1-x0) < 3 and abs(y1-y0) >= MIN_SEG:
                V.setdefault(round((x0+x1)/2), []).append((min(y0, y1), max(y0, y1)))
    def merge(d):
        keys = sorted(d); out = []; i = 0
        while i < len(keys):              # bundle closely spaced coordinates (double lines)
            grp = [keys[i]]; j = i+1
            while j < len(keys) and keys[j]-grp[-1] <= 3: grp.append(keys[j]); j += 1
            k = round(sum(grp)/len(grp)); iv = sorted(x for g in grp for x in d[g])
            cur = list(iv[0])
            for a, b in iv[1:]:
                if a <= cur[1] + FRAME_TOL: cur[1] = max(cur[1], b)
                else: out.append((k, cur[0], cur[1])); cur = [a, b]
            out.append((k, cur[0], cur[1])); i = j
        return out
    return merge(H), merge(V)

def root_frames(hori, vert, TW, TH):
    """Outermost closed frames: connected components of the long lines
    whose bounding box is bounded by a line on all 4 sides."""
    minlen = 0.05*min(TW, TH)
    segs = [('h', y, a, b) for (y, a, b) in hori if b-a >= minlen] + \
           [('v', x, a, b) for (x, a, b) in vert if b-a >= minlen]
    n = len(segs); par = list(range(n))
    def find(i):
        while par[i] != i: par[i] = par[par[i]]; i = par[i]
        return i
    def touches(s, t):
        if s[0] == t[0]:
            return abs(s[1]-t[1]) <= FRAME_TOL and not (s[3] < t[2]-FRAME_TOL or t[3] < s[2]-FRAME_TOL)
        h, v = (s, t) if s[0] == 'h' else (t, s)
        return (h[2]-FRAME_TOL <= v[1] <= h[3]+FRAME_TOL) and (v[2]-FRAME_TOL <= h[1] <= v[3]+FRAME_TOL)
    for i in range(n):
        for j in range(i+1, n):
            if touches(segs[i], segs[j]): par[find(i)] = find(j)
    comps = {}
    for i in range(n): comps.setdefault(find(i), []).append(segs[i])
    roots = []
    for c in comps.values():
        xs = [v for s in c for v in ((s[2], s[3]) if s[0] == 'h' else (s[1],))]
        ys = [v for s in c for v in ((s[2], s[3]) if s[0] == 'v' else (s[1],))]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        if (x1-x0) < 0.1*TW or (y1-y0) < 0.1*TH: continue
        def edge(kind, pos, a, b):
            return any(s[0] == kind and abs(s[1]-pos) <= FRAME_TOL and s[2] <= a+FRAME_TOL and s[3] >= b-FRAME_TOL for s in c)
        if edge('h', y0, x0, x1) and edge('h', y1, x0, x1) and edge('v', x0, y0, y1) and edge('v', x1, y0, y1):
            roots.append((x0, y0, x1, y1))
    return roots

def split_rect(rect, hori, vert, depth=0):
    """Split rectangle by all lines that cross it edge to edge; recursively."""
    x0, y0, x1, y1 = rect
    ys = sorted({y for (y, a, b) in hori if y0+FRAME_TOL < y < y1-FRAME_TOL and a <= x0+FRAME_TOL and b >= x1-FRAME_TOL})
    xs = sorted({x for (x, a, b) in vert if x0+FRAME_TOL < x < x1-FRAME_TOL and a <= y0+FRAME_TOL and b >= y1-FRAME_TOL})
    if (not ys and not xs) or depth > 12: return [rect]
    out = []
    Y = [y0] + ys + [y1]; X = [x0] + xs + [x1]
    for i in range(len(Y)-1):
        for j in range(len(X)-1):
            sub = (X[j], Y[i], X[j+1], Y[i+1])
            if sub[2]-sub[0] < 2*FRAME_TOL or sub[3]-sub[1] < 2*FRAME_TOL: continue
            out += split_rect(sub, hori, vert, depth+1)
    return out

def leaf_cells(pls, TW, TH, texts=()):
    hori, vert = frame_segments(pls)
    roots = root_frames(hori, vert, TW, TH)
    cells = []
    for r in roots: cells += split_rect(r, hori, vert)
    # tables nested inside a cell: a closed frame whose top-left corner lies inside the cell
    # (its right and bottom edges may be the cell's own). Its cells are added; the outer cell
    # keeps what lies outside it - every stroke and text later goes to the SMALLEST cell around it.
    T = FRAME_TOL
    def has_h(y, a, b): return any(abs(yy-y) <= T and aa <= a+T and bb >= b-T for (yy, aa, bb) in hori)
    def has_v(x, a, b): return any(abs(xx-x) <= T and aa <= a+T and bb >= b-T for (xx, aa, bb) in vert)
    nested = []
    head_h = max((t[3] for t in texts), default=0)        # heading font size of the palette
    for c in list(cells):
        cw, ch = c[2]-c[0], c[3]-c[1]
        for (y, a, b) in hori:
            if not (c[1]+T < y < c[3]-T and c[0]-T <= a < c[2]-T and b > a+0.1*cw): continue
            for (x, va, vb) in vert:
                if abs(x-a) > T or abs(va-y) > T or vb < y+0.1*ch: continue        # top-left corner at (a, y)
                r = (a, y, min(b, c[2]), min(vb, c[3]))
                if (r[2]-r[0])*(r[3]-r[1]) > 0.9*cw*ch or r in nested: continue
                big = [t for t in texts if r[0] <= t[0] <= r[2] and r[1] <= t[1] <= r[3] and t[3] >= 0.6 * head_h]
                inner = any(r[1]+T < yy < r[3]-T and aa <= r[0]+T and bb >= r[2]-T for (yy, aa, bb) in hori)
                if big and inner and has_h(r[3], r[0], r[2]) and has_v(r[2], r[1], r[3]):   # heading + rule below it
                    nested.append(r)
    for r in nested: cells += split_rect(r, hori, vert)
    cells = list(dict.fromkeys(cells))
    return cells, hori, vert, roots

# ---------- snap points from the matching CDW file ----------
def _f32(b, o): return struct.unpack('<f', b[o:o+4])[0]

def load_cdw_geometry(path):
    """CDW /g/ block -> (t=1 lines, t=8 anchor points, object number per line).
    Byte 5 of the record header is the object number: each device of a palette has its
    own; 0 = frames and the joints generated at runtime."""
    d = open(path, 'rb').read(); g = d[d.find(b'/g/')+5:]
    def hdr(o): return o+6 <= len(g) and g[o+1] == 0 and g[o+2] == 0x14 and g[o+3] == 0 and g[o+4] == 0 and g[o] <= 8
    lines = []; anchors = []; objs = []; o = 0; n = len(g)
    while o+14 <= n:
        if not hdr(o): o += 1; continue
        t = g[o]
        if t == 1:
            a, b = _f32(g, o+6), _f32(g, o+10); x, y = _f32(g, o+22), _f32(g, o+26); P = _f32(g, o+30)
            if max(abs(x), abs(y), abs(P)) < 20000: lines.append((x, y, x+a*P, y+b*P)); objs.append(g[o+5])
            o += 36
        elif t == 8: anchors.append((_f32(g, o+6), _f32(g, o+10))); o += 14
        elif t == 2: o += 40
        else: o += 6
    return lines, anchors, objs

def _seg_vote(clines, pls, binw=40):
    """2D voting: each CDW line is paired with all WMF segments of the same length and
    direction; each pair votes for a shift (dx, dy). The true shift
    gets by far the most votes. (Separate 1D correlation of
    x and y locked onto wrong optima with regular table lines.)"""
    import math, collections
    H = collections.defaultdict(list)
    for s in pls:
        for a, b in zip(s, s[1:]):
            L = math.hypot(b[0]-a[0], b[1]-a[1])
            if L < 150: continue
            H[(round(L/20), round((math.atan2(b[1]-a[1], b[0]-a[0]) % math.pi)/0.02))].append((a, b))
    V = collections.Counter()
    for (x0, y0, x1, y1) in clines:
        X0, Y0, X1, Y1 = 100*x0, 100*y0, 100*x1, 100*y1
        L = math.hypot(X1-X0, Y1-Y0)
        if L < 150: continue
        kl, ka = round(L/20), round((math.atan2(Y1-Y0, X1-X0) % math.pi)/0.02)
        seen = set()
        for dl in (-1, 0, 1):
            for da in (-1, 0, 1):
                for (a, b) in H.get((kl+dl, ka+da), ()):
                    for p in (a, b):
                        k = (round((p[0]-X0)/binw), round((p[1]-Y0)/binw))
                        if k not in seen: seen.add(k); V[k] += 1
    if not V: return None
    (kx, ky), _ = V.most_common(1)[0]
    return kx*binw, ky*binw

def cdw_to_wmf(lines, pls):
    """Affine CDW->WMF: scale 100 (mm->0.01mm) + global offset via 2D segment voting,
    then least-squares refinement. -> (bx, by, fit) with fit = fraction of CDW line ends
    that lie within <= 0.5 mm of a WMF point after mapping (quality measure)."""
    import statistics
    v = _seg_vote(lines, pls)
    if v is None: return 0, 0, 0.0
    bx, by = v
    cell = 100; G = {}
    for s in pls:
        for x, y in s: G.setdefault((int(x//cell), int(y//cell)), []).append((x, y))
    ends = [(100*x, 100*y) for L in lines for (x, y) in ((L[0], L[1]), (L[2], L[3]))]
    def nearest(px, py, r):
        bd = r*r; bp = None; gx, gy = int(px//cell), int(py//cell); k = int(r//cell)+1
        for ax in range(-k, k+1):
            for ay in range(-k, k+1):
                for q in G.get((gx+ax, gy+ay), ()):
                    dd = (q[0]-px)**2 + (q[1]-py)**2
                    if dd < bd: bd = dd; bp = q
        return bp
    for _ in range(3):
        d = [(q[0]-x-bx, q[1]-y-by) for (x, y) in ends for q in [nearest(x+bx, y+by, 70)] if q]
        if not d: break
        bx += statistics.median(t[0] for t in d); by += statistics.median(t[1] for t in d)
    fit = sum(1 for (x, y) in ends if nearest(x+bx, y+by, 50)) / max(len(ends), 1)
    return bx, by, fit

def label_strokes(strokes, clines, cobj, bx, by, tol=30):
    """Each WMF stroke that lies on a (registered) CDW line gets its
    object number (majority over its points). Strokes without a hit (curves, circles,
    joints = object 0) stay unlabeled."""
    import collections
    cell = 100; G = {}
    for (x0, y0, x1, y1), ob in zip(clines, cobj):
        if ob == 0: continue
        X0, Y0, X1, Y1 = 100*x0+bx, 100*y0+by, 100*x1+bx, 100*y1+by
        k = max(1, int(math.hypot(X1-X0, Y1-Y0) // 25))
        for i in range(k+1):
            px, py = X0+(X1-X0)*i/k, Y0+(Y1-Y0)*i/k
            G.setdefault((int(px//cell), int(py//cell)), []).append((px, py, ob))
    out = {}
    for s in strokes:
        votes = collections.Counter()
        pts = list(s) + [((a[0]+b[0])/2, (a[1]+b[1])/2) for a, b in zip(s, s[1:])]
        for (x, y) in pts:
            gx, gy = int(x//cell), int(y//cell); best = None; bd = tol*tol
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for (px, py, ob) in G.get((gx+dx, gy+dy), ()):
                        d = (px-x)**2 + (py-y)**2
                        if d <= bd: bd = d; best = ob
            if best is not None: votes[best] += 1
        if votes: out[id(s)] = votes.most_common(1)[0][0]
    return out

def split_by_object(g, ds, stroke_obj, min_strokes=4):
    """Split a spatial group with strokes of several CDW objects into devices.
    Unlabeled strokes go to the nearest labeled one. Parts that touch
    (attached joint, side arm) or lie almost entirely inside the other (coil inside jacket)
    stay ONE device - separate devices always have a gap."""
    import collections
    cnt = collections.Counter(stroke_obj[id(ds[i])] for i in g if id(ds[i]) in stroke_obj)
    objs = [o for o, c in cnt.items() if c >= min_strokes]
    if len(objs) < 2: return [g]
    part = {o: [] for o in objs}
    lab = [(i, stroke_obj.get(id(ds[i]))) for i in g]
    known = [(i, o) for i, o in lab if o in part]
    for i, o in lab:
        if o in part: part[o].append(i); continue
        # nearest labeled stroke (distance between points)
        best = min(known, key=lambda k: min((p[0]-q[0])**2 + (p[1]-q[1])**2 for p in ds[i] for q in ds[k[0]]))
        part[best[1]].append(i)
    parts = [p for p in part.values() if p]
    bbs = [_bbox([ds[i] for i in p]) for p in parts]
    def inner_frac(a, b):                       # fraction of the area of a that lies in b
        ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
        return ix*iy / max((a[2]-a[0])*(a[3]-a[1]), 1)
    n = len(parts); par = list(range(n))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    def touching(a, b, tol=40):                  # do the parts touch (<= 0.4 mm)?
        A = [ds[i] for i in parts[a]]; B = [ds[i] for i in parts[b]]
        ba, bb = bbs[a], bbs[b]
        if ba[0] > bb[2]+tol or bb[0] > ba[2]+tol or ba[1] > bb[3]+tol or bb[1] > ba[3]+tol: return False
        segs = [(p, q) for s in B for p, q in zip(s, s[1:])] or [(p, p) for s in B for p in s]
        for s in A:
            for (x, y) in s:
                if not (bb[0]-tol <= x <= bb[2]+tol and bb[1]-tol <= y <= bb[3]+tol): continue
                for (p, q) in segs:
                    dx, dy = q[0]-p[0], q[1]-p[1]; L = dx*dx+dy*dy
                    t = 0 if L == 0 else max(0, min(1, ((x-p[0])*dx + (y-p[1])*dy) / L))
                    if (p[0]+t*dx-x)**2 + (p[1]+t*dy-y)**2 <= tol*tol: return True
        return False
    for i in range(n):
        for j in range(n):
            if i != j and (inner_frac(bbs[i], bbs[j]) >= 0.8 or (i < j and touching(i, j))):
                par[find(i)] = find(j)
    merged = {}
    for i in range(n): merged.setdefault(find(i), []).extend(parts[i])
    return list(merged.values())

def extract_grid(path, outdir, min_geom=10, cdw_path=None):
    bbox, pls, texts = parse_wmf(path)
    texts = merge_char_texts(texts)
    l, t, r, b = bbox; TW, TH = r-l, b-t
    cells, hori, vert, roots = leaf_cells(pls, TW, TH, texts)
    if len(cells) < 2: return None                    # no table -> fallback (clustering)
    def inside(c, x, y, tol=0):
        return c[0]-tol <= x <= c[2]+tol and c[1]-tol <= y <= c[3]+tol
    def is_gridline(s):
        """Frame line = axis-parallel, lies on a cell edge and BOTH end points sit
        on cell corners (even if the line runs across several cells)."""
        if len(s) != 2: return False
        (ax, ay), (bx, by) = s
        if abs(ay-by) < 3:
            lo, hi = min(ax, bx), max(ax, bx)
            ends = {v for c in cells if abs(ay-c[1]) <= 3 or abs(ay-c[3]) <= 3 for v in (c[0], c[2])}
        elif abs(ax-bx) < 3:
            lo, hi = min(ay, by), max(ay, by)
            ends = {v for c in cells if abs(ax-c[0]) <= 3 or abs(ax-c[2]) <= 3 for v in (c[1], c[3])}
        else: return False
        return bool(ends) and any(abs(lo-e) <= FRAME_TOL for e in ends) and any(abs(hi-e) <= FRAME_TOL for e in ends)
    dev = [s for s in pls if not is_gridline(s)]
    # label box ("RG-24mL", "AK-13"): closed axis-parallel rectangle around a
    # text. Not part of the device and would join neighbouring devices when clustering.
    def is_label_box(s):
        if len(s) != 5 or s[0] != s[-1]: return None
        xs = {p[0] for p in s}; ys = {p[1] for p in s}
        if len(xs) != 2 or len(ys) != 2: return None
        x0, x1 = sorted(xs); y0, y1 = sorted(ys)
        return next((T for T in texts if x0 <= T[0] <= x1 and y0-T[3] <= T[1] <= y1
                     and (y1-y0) <= 2.5*T[3]), None)
    label_texts = set(); label_boxes = []                      # (x0, y0, x1, y1, text)
    for s in list(dev):
        T = is_label_box(s)
        if T:
            dev.remove(s); label_texts.add(T)
            label_boxes.append((min(p[0] for p in s), min(p[1] for p in s), max(p[0] for p in s), max(p[1] for p in s), T[2]))
    def own_label(cell, gbb):
        """Label box that belongs to THIS device: in the same cell, horizontally
        overlapping, nearest vertically (usually directly below)."""
        c = [(min(abs(b[1]-gbb[3]), abs(gbb[1]-b[3])), b[4]) for b in label_boxes
             if inside(cell, (b[0]+b[2])/2, (b[1]+b[3])/2) and min(b[2], gbb[2]) - max(b[0], gbb[0]) > 0]
        return min(c)[1] if c else None
    def root_of(c): return next((r for r in roots if r[0] <= c[0]+3 and r[1] <= c[1]+3 and r[2] >= c[2]-3 and r[3] >= c[3]-3), None)
    area = [(c[2]-c[0])*(c[3]-c[1]) for c in cells]
    def home(x, y):                                       # smallest cell containing the point
        inner = [i for i, c in enumerate(cells) if inside(c, x, y)]
        return min(inner, key=lambda i: area[i]) if inner else None
    stroke_home = [home(*centroid(s)) for s in dev]
    text_home = {T: home(T[0], T[1]) for T in texts}
    cell_info = []
    for i, c in enumerate(cells):
        st = [s for s, hm in zip(dev, stroke_home) if hm == i]
        tx = [(x, y, s, h) for (x, y, s, h, al) in texts if text_home[(x, y, s, h, al)] == i and not is_scale_number(s) and clean_name(s)]
        cell_info.append({'rect': c, 'idx': i, 'strokes': st, 'txt': tx, 'is_dev': len(st) >= min_geom, 'root': root_of(c)})
    def encloses(a, b): return a != b and a[0] <= b[0]+3 and a[1] <= b[1]+3 and a[2] >= b[2]-3 and a[3] >= b[3]-3
    for ci in cell_info: ci['outer'] = any(encloses(ci['rect'], o) for o in cells)
    # a cell around other cells (frame around a table, cell holding a sub-table) is never a heading
    hdr_cells = [ci for ci in cell_info if not ci['is_dev'] and ci['txt'] and not ci['outer']]
    def cell_text(ci):
        """Join the text pieces of a cell in reading order (line, then x).
        C-Design exports justified text in fragments ("REAK","TION","SGEF","AESSE"):
        pieces without a gap are appended without a space."""
        out = ''; px = None; ph = None
        for (x, y, s, h) in sorted(ci['txt'], key=lambda t: (round(t[1]/max(t[3], 1)*2), t[0])):
            if not out: out = s
            elif out.endswith('-') and px is not None and x < px: out += s          # "Dimroth-"+"Kühler" (new line)
            elif px is not None and x >= px and x - px < 0.35*h: out += s          # fragment without gap
            else: out += ' ' + s
            px = x + len(s)*0.60*h; ph = h
        return re.sub(r'\s+', ' ', out).strip()
    def split_title_to_column(ci, col):
        if len(ci['txt']) != 1: return None
        x, y, txt, h = ci['txt'][0]
        if ',' in txt or '(' in txt or ' ' not in txt.strip(): return None   # "X (Y)" is one name
        CONN = {'und', 'mit', 'od.', 'oder', 'für', 'an', 'auf', '/', '-', 'u.', 'nach', 'zur', 'ohne'}
        if any(w.lower() in CONN for w in txt.split()): return None      # a phrase, not a pair of names
        cw = 0.62*h                                    # mean character width (capitals)
        # device columns directly below the title cell
        cols = sorted({(c['rect'][0], c['rect'][2]) for c in cell_info if c['is_dev']
                       and abs(c['rect'][1]-ci['rect'][3]) <= FRAME_TOL
                       and c['rect'][0] >= ci['rect'][0]-FRAME_TOL and c['rect'][2] <= ci['rect'][2]+FRAME_TOL})
        if len(cols) < 2: return None
        pos = x; buckets = {c: [] for c in cols}
        for wd in txt.split(' '):
            cx = pos + len(wd)*cw/2
            tgt = min(cols, key=lambda c: 0 if c[0] <= cx <= c[1] else min(abs(cx-c[0]), abs(cx-c[1])))
            buckets[tgt].append(wd); pos += (len(wd)+1)*cw
        def namelike(ws): return any(re.fullmatch(r'[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\-]{3,}', w) for w in ws)
        if any(not namelike(b) for b in buckets.values()): return None   # every column needs a real name
        mine = next((b for c, b in buckets.items() if abs(c[0]-col[0]) <= FRAME_TOL and abs(c[1]-col[1]) <= FRAME_TOL), None)
        return ' '.join(mine) if mine else None
    def pick_column_text(ci, gbb):
        """Header cell with several texts side by side (NS 29 | NS 19 | NS 14 without
        separator lines): pick the text above THIS device (nearest center)."""
        if len(ci['txt']) < 2: return None
        if any(t[2].lstrip().startswith('(') for t in ci['txt']): return None   # "X (Y)" is one name
        ys = [t[1] for t in ci['txt']]; hs = [t[3] for t in ci['txt']]
        if max(ys)-min(ys) > 0.6*max(hs): return None            # multi-line -> one text
        if ci['rect'][2]-ci['rect'][0] < 1.6*(gbb[2]-gbb[0]): return None
        gcx = (gbb[0]+gbb[2])/2
        best = min(ci['txt'], key=lambda t: abs(t[0] + len(t[2])*0.3*t[3] - gcx))
        return best[2]
    hdr_h = max([h for ci in hdr_cells for (x, y, t, h) in ci['txt']], default=300)
    def name_path(dcell, in_texts, gbb):
        """Hierarchy path: [section, title, ..., label in the cell].
        Header cells above (x-overlapping) from top to bottom; a cell
        spanning several columns is distributed word by word onto the column if needed."""
        dx0, dy0, dx1, dy1 = dcell; dw = dx1-dx0
        root = root_of(dcell); rw = (root[2]-root[0]) if root else TW
        above = [ci for ci in hdr_cells if ci['rect'][3] <= dy0+FRAME_TOL and ci['root'] == root
                 and min(ci['rect'][2], dx1) - max(ci['rect'][0], dx0) >= 0.5*dw]
        chain = []; have_wide = False; last_wide = None; top = None
        gap = False; have_col = False; have_sec = False
        for ci in sorted(above, key=lambda ci: -ci['rect'][3]):   # only in the own table block, nearest first
            w = ci['rect'][2]-ci['rect'][0]; wide = w >= 0.9*rw; sec = w > 1.3*dw
            if top is not None and ci['rect'][3] < top - FRAME_TOL: gap = True   # device rows lie in between
            # across such a gap a heading only applies if the device has none of its kind yet:
            # a column header exactly over this column, or one heading spanning several columns
            aligned = abs(ci['rect'][0]-dx0) <= FRAME_TOL and abs(ci['rect'][2]-dx1) <= FRAME_TOL
            if gap and not wide and not (aligned and not have_col) and not (sec and not have_sec): continue
            top = ci['rect'][1] if top is None else min(top, ci['rect'][1])
            if sec: have_sec = True
            elif not wide: have_col = True
            # block-wide section titles: only the nearest counts - unless another one sits
            # directly on top of it (title + section stacked); narrow column headers always count
            if wide and have_wide and not (last_wide and abs(ci['rect'][3]-last_wide[1]) <= FRAME_TOL): continue
            txt = (split_title_to_column(ci, (dx0, dx1)) if w > dw*1.6 and ci['rect'][3] >= dy0-FRAME_TOL else None)                   or pick_column_text(ci, gbb) or cell_text(ci)
            if txt: chain.append((not wide, ci['rect'][1], txt))     # section (wide) before column header
            if wide: have_wide = True; last_wide = ci['rect']
        # chain starts with a pure variant ("NS 14")? -> find base title: neighbour cell to the left in
        # the same row (ADAPTER) or nearest non-variant title above (VERTEIL1),
        # whose own variant spec at the end is replaced ("... NS 29" + "NS 14" -> "... NS 14")
        if chain and is_variant(chain[-1][2]):
            vh = next((ci for ci in above if cell_text(ci) == chain[-1][2]), None)
            if vh:
                vr = vh['rect']
                same_row = [ci for ci in hdr_cells if ci['root'] == vh['root'] and ci['rect'][2] <= vr[0]+FRAME_TOL
                            and min(ci['rect'][3], vr[3]) - max(ci['rect'][1], vr[1]) > 0.5*(vr[3]-vr[1])
                            and not is_variant(cell_text(ci))]
                abv = [ci for ci in hdr_cells if ci['rect'][3] <= vr[1]+FRAME_TOL and not is_variant(cell_text(ci))
                       and min(ci['rect'][2], vr[2]) - max(ci['rect'][0], vr[0]) >= 0.5*(vr[2]-vr[0])]
                base = (max(same_row, key=lambda ci: ci['rect'][2]) if same_row else
                        max(abv, key=lambda ci: ci['rect'][3]) if abv else None)
                if base:
                    bt = re.sub(r'\s*(NS\s?\d+(/\d+)?|[\d,.]+\s*(mL|Liter|L))\s*$', '', cell_text(base)).strip()
                    if bt: chain.append((False, -1, bt))
        path = [t for _, _, t in sorted(chain)]                       # sections top -> bottom, then column headers
        # label in the device cell (large font, not a scale value) = lowest level
        gmx = (gbb[2]-gbb[0])*0.3
        is_angle = lambda t: re.fullmatch(r'-?\d{1,3}\s*°', t.strip()) is not None   # big angle labels ("105°")
        cap = [(y, x, t) for (x, y, t, h, al) in in_texts if (h >= 0.6*hdr_h or (is_angle(t) and h >= 0.45*hdr_h))
               and not is_scale_number(t) and (clean_name(t) or is_angle(t))
               and x <= gbb[2]+gmx and x + len(t)*0.6*h >= gbb[0]-gmx]   # text extent overlaps THIS device
        if cap:
            cap.sort(); path.append(re.sub(r'\s+', ' ', ' '.join(t for _, _, t in cap)))
        path = [p for i, p in enumerate(path)                         # "Trichter" + "Trichter und Filter" -> the latter
                if not (i+1 < len(path) and path[i+1].lower().startswith(p.lower()))]
        out = []                                                      # "Labor-" unter "THERMOMETER" -> "Laborthermometer"
        for p in path:
            if p.endswith('-') and out and ' ' not in out[-1].strip():
                out[-1] = p[:-1] + out[-1].lower()
            elif out and out[-1].endswith('-'):
                out[-1] = out[-1] + p
            else: out.append(p)
        return out
    _SMALL = {'und', 'für', 'mit', 'od.', 'oder', 'an', 'auf', 'nach', 'zur', 'zum', 'ohne', 'u.'}
    def pretty(t):
        """Make ALL-CAPS titles readable: words >= 4 letters in mixed case, short
        abbreviations (NS, KPG, OD.) stay, filler words lowercase."""
        def w(m):
            x = m.group(0)
            if x.lower() in _SMALL: return x.lower()
            if len(x) >= 4 and x.isupper(): return x[0] + x[1:].lower()
            return x
        return re.sub(r'[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.]*', w, t)
    def split_cell(ds):
        """A cell can contain several devices WITHOUT a separator line -> split by gap."""
        groups = cluster_strokes(ds, CLUSTER_THR*TW)
        groups = merge_overlapping(groups, ds, MERGE_GAP*TW)
        if stroke_obj:
            groups = [h for g in groups for h in split_by_object(g, ds, stroke_obj)]
        groups = [g for g in groups if len(g) >= min_geom]
        return [[ds[i] for i in g] for g in groups] or [ds]
    os.makedirs(outdir, exist_ok=True)
    pal = os.path.splitext(os.path.basename(path))[0]
    stroke_obj = {}                                   # id(stroke) -> CDW object number
    # map snap points from the matching CDW (t=8) to WMF coordinates
    snaps_xy = []
    if cdw_path and os.path.exists(cdw_path):
        clines, canch, cobj = load_cdw_geometry(cdw_path)
        bx, by, fit = cdw_to_wmf(clines, pls) if clines else (0, 0, 0.0)
        if fit >= 0.9:
            stroke_obj.update(label_strokes(dev, clines, cobj, bx, by))
            seen_a = set()
            for ax, ay in canch:
                k = (round(ax), round(ay))
                if k not in seen_a: seen_a.add(k); snaps_xy.append((100*ax+bx, 100*ay+by))
        else:
            print(f"  WARN snap transform unreliable (only {fit:.0%} coverage) -> no snap points")
    manifest = []; n = 0
    def bbox_dist(bb, x, y):
        return math.hypot(max(bb[0]-x, 0, x-bb[2]), max(bb[1]-y, 0, y-bb[3]))
    def stroke_dist(ds, x, y):
        return min(math.hypot(p[0]-x, p[1]-y) for s in ds for p in s)
    for ci in sorted(cell_info, key=lambda ci: (ci['rect'][1], ci['rect'][0])):
        if not ci['is_dev']: continue
        devs = sorted(split_cell(ci['strokes']), key=lambda ds: (_bbox(ds)[0], _bbox(ds)[1]))   # stable order
        bbs = [_bbox(ds) for ds in devs]
        # snap point -> exactly ONE device: the nearest (inside/<= 3 mm from the bounding box,
        # on a tie the one with the nearest stroke). Never one point in two devices.
        owner = {}
        for (sx, sy) in snaps_xy:
            hm = home(sx, sy)
            if hm != ci['idx'] and not (hm is None and inside(ci['rect'], sx, sy, 300)): continue
            cand = [(bbox_dist(bb, sx, sy), stroke_dist(ds, sx, sy), j) for j, (ds, bb) in enumerate(zip(devs, bbs))]
            cand = [c for c in cand if c[0] <= 300]
            if cand: owner.setdefault(min(cand)[2], []).append((sx, sy))
        for j, ds in enumerate(devs):
            gx0, gy0, gx1, gy1 = bbs[j]
            pad = 40; ox, oy = gx0-pad, gy0-pad; W, H = gx1-gx0+2*pad, gy1-gy0+2*pad
            mx = (gx1-gx0)*0.12
            dt = [T for T in texts if text_home[T] == ci['idx'] and gx0-mx <= T[0] <= gx1+mx
                  and gy0-40 <= T[1] <= gy1+40 and T not in label_texts]
            vol = next((T[2] for T in dt if re.search(r'\d\s*(mL|ml|Liter|L)', T[2])), '')
            ns = next((re.search(r'NS\s?\d+', T[2]).group() for T in dt if re.search(r'NS\s?\d+', T[2])), '')
            ct = [T for T in texts if text_home[T] == ci['idx']]
            lab = own_label(ci['rect'], (gx0, gy0, gx1, gy1))
            if lab:                                               # own label box instead of all cell labels
                ct = [T for T in ct if T not in label_texts and T[3] < 0.6*hdr_h]
            path = [pretty(p) for p in name_path(ci['rect'], ct, (gx0, gy0, gx1, gy1))] + ([lab] if lab else [])
            for extra in [ns, vol]:
                if extra and not any(extra.replace(' ', '') in p.replace(' ', '') for p in path): path.append(extra)
            name = " ".join(path).strip() or "Gerät"
            while re.search(r'\b(\S.*?)\s+\1\b', name):           # "X X" -> "X"
                name = re.sub(r'\b(\S.*?)\s+\1\b', r'\1', name, count=1)
            pts = []; seen = set()
            for (sx, sy) in owner.get(j, []):
                key = (round((sx-ox)/40), round((sy-oy)/40))
                if key in seen: continue
                seen.add(key); pts.append((sx-ox, sy-oy))
            local = [[(px-ox, py-oy) for px, py in st] for st in ds]
            prefix = NAME_PREFIX.get(pal)
            if prefix and not name.startswith(prefix.split()[0]):
                name = f'{prefix} {name}'; path = [prefix] + path
            cork_ring = pal == 'KOLB-MH2' and gy1-gy0 < 0.5*(gx1-gx0)   # the only flat, wide parts there
            snaps = joints.analyze(local, pts, (gx0-ox, gy0-oy, gx1-ox, gy1-oy),
                                   support='ring' if cork_ring else SUPPORT_PALETTES.get(pal))
            if cork_ring:                                 # the shared heading only names the first column
                m = re.search(r'\d[\d,.]*\s*(mL|Liter|L)\b', name)
                size = m.group(0) if m else ''
                name = f'Korkring für Kolben {size}'.strip()
                path = ['Korkringe für Kolben', size or name]
            for sp in snaps:                                  # MINILAB parts use screw threads, not NS joints
                if sp['type'] in ('socket', 'cone'): sp['system'] = 'MINILAB' if pal == 'MINILAB' else 'NS'
            hanging = pal in ('TROPFTRI', 'EXTRAKT1')
            if pal in ADD_BASE_PALETTES and not any(sp['type'] in ('base', 'support') for sp in snaps):
                # vessels the original left without a bottom anchor (e.g. some round-bottom flasks):
                # add one at the lowest point, so they can stand on supports and be filled - but only
                # if the bottom is broad like a vessel's, not the tip of a tube
                low = max(py for st in local for _, py in st)
                xs = [px for st in local for px, py in st if py >= low - 5]
                band = [px for st in local for px, py in st if py >= low - 0.03 * H]
                if max(band) - min(band) >= 0.3 * (W - 80):
                    snaps.append({'x': round(sum(xs) / len(xs), 1), 'y': round(low, 1), 'type': 'base', 'dir': 90,
                                  'width': None, 'ns': None, 'added': True})
            vessel = (fill.vessel_regions(local, snaps, W, H, hanging=hanging)
                      if pal in FILL_PALETTES and 'Kühler' not in name else None)   # coolant jackets are not vessels
            # stable ID: palette + cell position in the original (mm) + index within the cell
            dev_id = f"{pal.lower()}/{ci['rect'][0]/100:.0f}-{ci['rect'][1]/100:.0f}" + (f"-{j}" if len(devs) > 1 else '')
            if dev_id in NAMES_BY_ID:
                path = NAMES_BY_ID[dev_id]; name = 'Gefahrensymbol ' + path[-1]
            svg = emit_svg(ds, dt, ox, oy, W, H, snaps)
            safe = fn_safe(name)
            fn = f"{pal}_{safe}.svg"; k = 1
            while os.path.exists(os.path.join(outdir, fn)):
                fn = f"{pal}_{safe}_{k}.svg"; k += 1
            open(os.path.join(outdir, fn), 'w', encoding='utf-8').write(svg)
            manifest.append({'id': dev_id, 'file': fn, 'name': name, 'path': path, 'ns': ns or None, 'snaps': snaps,
                             'fill': vessel,
                             'cell_mm': [round(v/100, 1) for v in ci['rect']],
                             'w_mm': round(W/100, 1), 'h_mm': round(H/100, 1), 'labels': [T[2] for T in dt]})
            n += 1
    json.dump(manifest, open(os.path.join(outdir, pal + '_manifest.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print(f"{pal}: {n} devices from {len(cells)} cells -> {outdir}")
    return manifest

def extract(path, outdir, min_geom=15, thr=90):
    bbox, pls, texts = parse_wmf(path)
    l, t, r, b = bbox; TW, TH = r-l, b-t
    frames = [s for s in pls if is_frame(s, TW, TH)]
    dev = [s for s in pls if not is_frame(s, TW, TH)]
    groups = cluster_strokes(dev, thr)
    big = [g for g in groups if len(g) >= min_geom]
    small = [g for g in groups if len(g) < min_geom]
    bboxes = [_bbox([dev[i] for i in g]) for g in big]
    # assign mini clusters (scale ticks, label boxes) to the nearest device
    def center(bb): return ((bb[0]+bb[2])/2, (bb[1]+bb[3])/2)
    bcent = [center(b) for b in bboxes]
    for g in small:
        sb = _bbox([dev[i] for i in g]); sc = center(sb)
        if not big: break
        j = min(range(len(big)), key=lambda k: (sc[0]-bcent[k][0])**2 + (sc[1]-bcent[k][1])**2)
        # only assign if it lies in/near the device (otherwise frame remnant -> discard)
        bx = bboxes[j]; mx, my = (bx[2]-bx[0])*0.25, (bx[3]-bx[1])*0.25
        if bx[0]-mx <= sc[0] <= bx[2]+mx and bx[1]-my <= sc[1] <= bx[3]+my:
            big[j] = big[j] + g
    os.makedirs(outdir, exist_ok=True)
    pal = os.path.splitext(os.path.basename(path))[0]
    manifest = []; n = 0
    for g in big:
        ds = [dev[i] for i in g]
        gx0, gy0, gx1, gy1 = _bbox(ds)
        # a real device needs a minimum size in BOTH axes (filters blobs,
        # header bars (very flat) and tiny remnants)
        if (gx1-gx0) < 0.025*TW or (gy1-gy0) < 0.035*TH: continue
        pad = 40; ox, oy = gx0-pad, gy0-pad; W, H = gx1-gx0+2*pad, gy1-gy0+2*pad
        mx, my = (gx1-gx0)*0.12, (gy1-gy0)*0.05
        dt = [T for T in texts if gx0-mx <= T[0] <= gx1+mx and gy0-my <= T[1] <= gy1+my]
        vol = next((T[2] for T in dt if 'mL' in T[2] or 'Liter' in T[2]), '')
        ns = next((re.search(r'NS\s?\d+', T[2]).group() for T in dt if re.search(r'NS\s?\d+', T[2])), '')
        sect = section_title(texts, (gx0, gy0, gx1, gy1)) or ''
        parts = [x for x in [sect, ns, vol] if x]
        name = " ".join(parts).strip() or "geraet"
        svg = emit_svg(ds, dt, ox, oy, W, H)
        safe = fn_safe(name)
        fn = f"{pal}_{safe}.svg"; k = 1
        while os.path.exists(os.path.join(outdir, fn)):
            fn = f"{pal}_{safe}_{k}.svg"; k += 1
        open(os.path.join(outdir, fn), 'w', encoding='utf-8').write(svg)
        manifest.append({'id': f"{pal.lower()}/x{(gx0+gx1)/200:.0f}-y{(gy0+gy1)/200:.0f}", 'file': fn, 'name': name,
                         'path': parts or [name], 'ns': ns or None, 'snaps': [],
                         'cell_mm': None, 'w_mm': round(W/100, 1), 'h_mm': round(H/100, 1),
                         'labels': [T[2] for T in dt]})
        n += 1
    json.dump(manifest, open(os.path.join(outdir, pal + '_manifest.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print(f"{pal}: {n} devices -> {outdir}")
    return manifest

def find_cdw(wmf_path, cdw_dir):
    """find the matching CDW file (same base name) -> snap points."""
    base = os.path.splitext(os.path.basename(wmf_path))[0]
    for ext in ('.CDW', '.cdw'):
        p = os.path.join(cdw_dir, base + ext)
        if os.path.exists(p): return p
    return None

def convert_palette(job):
    """One palette: grid extraction, or clustering as fallback. -> number of devices."""
    f, dst, cdw_dir = job
    cdw = find_cdw(f, cdw_dir or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(f))), 'CDW'))
    m = extract_grid(f, dst, cdw_path=cdw)             # grid first (frame to frame)
    if m is None:
        m = extract(f, dst)                             # fallback: clustering (no snaps)
    return len(m)

if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description="WMF palette(s) -> individual SVGs + manifest (with snap points from the CDW)")
    here = os.path.dirname(os.path.abspath(__file__))
    ap.add_argument("src", nargs="?", default=os.path.normpath(os.path.join(here, '..', 'source', 'WMF')),
                    help="WMF file or folder (default: pipeline/source/WMF)")
    ap.add_argument("dst", nargs="?", default=os.path.normpath(os.path.join(here, '..', 'out', 'devices')),
                    help="output folder, must be empty (default: pipeline/out/devices)")
    ap.add_argument("--cdw", default=None, help="folder with the CDW files (for snap points); "
                    "default: sibling folder 'CDW' next to the WMFs")
    ap.add_argument("--only", default=os.path.join(here, 'paletten.txt'),
                    help="file with palette names (one per line); default: paletten.txt, --only '' = all")
    a = ap.parse_args()
    if a.only: a.only = {l.split('#')[0].strip().upper() for l in open(a.only, encoding='utf-8') if l.split('#')[0].strip()}
    src, dst = a.src, a.dst
    if os.path.isdir(dst) and any(f.endswith('.svg') for f in os.listdir(dst)):
        sys.exit(f"Output folder {dst} already contains SVGs - please empty it or specify another folder "
                 "(otherwise duplicates with _1, _2 ... are created).")
    if src.lower().endswith('.wmf'): files = [src]
    else:   # Windows is case-insensitive: *.wmf and *.WMF return the same files -> deduplicate
        files = sorted({os.path.normcase(f): f for f in glob.glob(os.path.join(src, '*.wmf')) + glob.glob(os.path.join(src, '*.WMF'))}.values())
    if a.only: files = [f for f in files if os.path.splitext(os.path.basename(f))[0].upper() in a.only]
    # palettes are independent and file names carry the palette prefix -> process them in parallel,
    # largest first so the long ones do not end up last
    from concurrent.futures import ProcessPoolExecutor
    os.makedirs(dst, exist_ok=True)
    files.sort(key=lambda f: -os.path.getsize(f))
    jobs = [(f, dst, a.cdw) for f in files]
    with ProcessPoolExecutor(max_workers=min(len(jobs), os.cpu_count() or 1)) as pool:
        total = sum(pool.map(convert_palette, jobs))
    print(f"\nTotal: {total} devices from {len(files)} palette(s).")
