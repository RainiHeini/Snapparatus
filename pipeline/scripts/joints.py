#!/usr/bin/env python3
"""
joints.py - classify the anchor points of a device by local geometry.

The LaboBib manual (p. 7) places anchors by fixed rules: sockets (female joints) at the
centre of the opening rim and/or the inner end, cones (male joints) at the centre of the wide
upper edge, vessels at the centre of the bottom. This module recovers type, outward
direction and joint size from the drawing itself by scanning cross-sections perpendicular
to the straight edge through the anchor.

  analyze(strokes, anchors) -> [{"x", "y", "type", "dir", "width", "ns"}, ...]

type: "socket" | "cone" | "base" | "hose" | "point"   (socket/cone always carry a standard size)
dir:  outward direction in degrees, SVG convention (0 = +x/right, 90 = +y/down)
x, y: snap position; for sockets this is the centre of the opening rim
"""
import math

STEP = 20            # cross-section spacing (0.01 mm)
EMPTY_AT = 70        # nothing within this distance beyond the edge -> anchor sits on an outer edge
MAX_JOINT = 1.9      # a joint is at most this many widths long
HOSE_MAX = 160       # straight edges narrower than this are hose olive tips (NS 10 is ~200)

# Standard-taper joint sizes and their drawn widths at scale 1:5 (0.01 mm), calibrated on
# devices whose name states the size (SCHLIFFE, STOPFEN, KOLB-1H). Cone: wide upper edge;
# socket: the rim line, which equals the seat width right below the bead.
NS_CONE = {10: 200, 14: 290, 19: 376, 24: 465, 29: 584, 34: 700, 45: 900}
NS_SOCKET = {10: 216, 14: 332, 19: 440, 24: 538, 29: 653, 34: 805, 45: 981}


def _segments(strokes):
    return [(a, b) for s in strokes for a, b in zip(s, s[1:]) if a != b]


def _dist_pt_seg(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; L = dx*dx + dy*dy
    t = 0 if L == 0 else max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / L))
    return math.hypot(a[0]+t*dx-p[0], a[1]+t*dy-p[1])


def _angle(a, b):
    return math.atan2(b[1]-a[1], b[0]-a[0]) % math.pi


def _edges_through(p, segs, tol=12, atol=0.05):
    """Straight edges (chains of collinear segments) with p near their middle, one per
    direction, longest first. -> [(width, unit vector along the edge), ...]"""
    found = {}
    for s in segs:
        if _dist_pt_seg(p, *s) > 25: continue
        a, b = s; th = _angle(a, b); ux, uy = math.cos(th), math.sin(th)
        proj = lambda q: (q[0]-a[0])*ux + (q[1]-a[1])*uy
        off = lambda q: abs(-(q[0]-a[0])*uy + (q[1]-a[1])*ux)
        lo, hi = sorted((proj(a), proj(b)))
        grown = True
        while grown:
            grown = False
            for (c, d) in segs:
                if off(c) > tol or off(d) > tol: continue
                if abs((_angle(c, d) - th + math.pi/2) % math.pi - math.pi/2) > atol: continue
                cl, dl = sorted((proj(c), proj(d)))
                if cl <= hi + tol and dl >= lo - tol and (cl < lo - 1 or dl > hi + 1):
                    lo, hi = min(lo, cl), max(hi, dl); grown = True
        L = hi - lo; t = proj(p)
        if L >= 80 and 0.3 <= (t - lo) / L <= 0.7:
            key = round(math.degrees(th) / 3) % 60          # one edge per direction (3 degree bins)
            if key not in found or L > found[key][0]: found[key] = (L, (ux, uy))
    return sorted(found.values(), key=lambda e: -e[0])


def _width(p, n, u, d, segs, reach):
    """Width of the glass body on the line parallel to the edge at distance d along n:
    outermost walls within reach on both sides of the axis (inner tubes are ignored).
    -> width or None if nothing is there."""
    cx, cy = p[0] + n[0]*d, p[1] + n[1]*d
    left = right = None
    for (a, b) in segs:
        ex, ey = b[0]-a[0], b[1]-a[1]
        den = ex*n[0] + ey*n[1]                       # component of the segment along n
        if abs(den) < 1e-9: continue
        s = ((cx-a[0])*n[0] + (cy-a[1])*n[1]) / den   # fraction along the segment
        if not (0 <= s <= 1): continue
        t = (a[0] + s*ex - cx)*u[0] + (a[1] + s*ey - cy)*u[1]
        if abs(t) > reach: continue
        if t > 8 and (right is None or t > right): right = t
        if t < -8 and (left is None or t < left): left = t
    if left is None or right is None: return None
    return right - left


def _profile(p, n, u, segs, W):
    """Widths every STEP along n until the body ends - nothing there, or only a thin tube
    continues (width below 70 % of the edge) - or MAX_JOINT*W is reached."""
    out = []
    d = STEP
    while d <= MAX_JOINT * W + EMPTY_AT:
        w = _width(p, n, u, d, segs, 0.6 * W + 40)
        if w is not None and w < 0.7 * W: w = None
        out.append((d, w))
        if w is None: break
        d += STEP
    return out


def _nearest_ns(width, table, tol=0.09):
    ns, ref = min(table.items(), key=lambda kv: abs(kv[1] - width))
    return ns if abs(ref - width) <= tol * ref else None


def _classify(p, W, u, segs, at_bottom):
    """Classify one anchor against one candidate edge. -> dict of fields or None."""
    x, y = p
    rec = {'width': round(W)}
    local = [s for s in segs if _dist_pt_seg(p, *s) <= MAX_JOINT * W + W + 200]
    sides = []
    for sgn in (1, -1):
        n = (-u[1]*sgn, u[0]*sgn)
        prof = _profile(p, n, u, local, W)
        end = next((d for d, w in prof if w is None), None)
        sides.append({'n': n, 'end': end, 'w': [w for d, w in prof if w is not None],
                      'dir': round(math.degrees(math.atan2(n[1], n[0])) % 360, 1)})
    free = [s for s in sides if s['end'] is not None and s['end'] <= EMPTY_AT]
    joint_len = MAX_JOINT * W + EMPTY_AT

    def flush(s): return bool(s['w']) and abs(s['w'][0] - W) <= 0.04 * W   # body continues the edge
    def narrows(s): return len(s['w']) >= 3 and s['w'][-1] < s['w'][0] - 0.02 * W
    def widens(s): return len(s['w']) >= 3 and s['w'][-1] > s['w'][0] + 0.02 * W
    def short(s): return s['end'] is not None and s['end'] <= joint_len
    def bead(s): return bool(s['w']) and s['w'][0] > 1.04 * W            # rim bead wider than the rim line
    def socket_inner(s):                                  # anchor at the inner end -> snap at the rim
        ws = s['w']; seat = ws[-1]
        for i in range(1, len(ws)):                       # seat = width just before the bead jump
            if ws[i] > ws[i-1] * 1.03: seat = ws[i-1]; break
        d = s['end'] - STEP
        return dict(rec, type='socket', dir=s['dir'], width=round(seat), ns=_nearest_ns(seat, NS_SOCKET),
                    x=round(x + s['n'][0]*d, 1), y=round(y + s['n'][1]*d, 1))
    def cone(s): return dict(rec, type='cone', dir=s['dir'], ns=_nearest_ns(W, NS_CONE))

    if len(free) == 1:                                    # anchor on an outer edge of the device
        f = free[0]; o = sides[1] if f is sides[0] else sides[0]
        if W < HOSE_MAX: return dict(rec, type='hose', dir=f['dir'])
        if flush(o) and short(o) and widens(o): return socket_inner(o)
        if at_bottom and abs(f['dir'] - 90) <= 20 and _nearest_ns(W, NS_SOCKET) is None:
            return dict(rec, type='base', dir=90)
        if bead(o): return dict(rec, type='socket', dir=f['dir'], ns=_nearest_ns(W, NS_SOCKET))
        if flush(o) and short(o) and narrows(o): return cone(o)
        if at_bottom and abs(f['dir'] - 90) <= 20: return dict(rec, type='base', dir=90)
        if _nearest_ns(W, NS_SOCKET): return dict(rec, type='socket', dir=f['dir'], ns=_nearest_ns(W, NS_SOCKET))
    elif not free:                                        # anchor inside the outline
        for s in sorted(sides, key=lambda s: s['end'] if s['end'] is not None else 1e9):
            if not (short(s) and flush(s)): continue
            if narrows(s): return cone(s)
            if widens(s): return socket_inner(s)
    return None


def analyze(strokes, anchors, bbox=None):
    segs = _segments(strokes)
    if bbox is None:
        xs = [q[0] for s in strokes for q in s]; ys = [q[1] for s in strokes for q in s]
        bbox = (min(xs), min(ys), max(xs), max(ys))
    result = []
    for (x, y) in anchors:
        rec = {'x': round(x, 1), 'y': round(y, 1), 'type': 'point', 'dir': None, 'width': None, 'ns': None}
        at_bottom = y >= bbox[3] - 80
        edges = _edges_through((x, y), segs)
        found = None
        for W, u in edges:                                # several lines may cross the anchor
            c = _classify((x, y), W, u, segs, at_bottom)
            if c and not (c['type'] in ('socket', 'cone') and c['ns'] is None):
                found = c; break
            found = found or c
        if found: rec.update(found)
        elif at_bottom: rec.update(type='base', dir=90)
        result.append(rec)
    for r in result:
        # anything at the very bottom pointing down is a standing surface, unless it is a cone
        if r['type'] == 'socket' and r['dir'] is not None and abs(r['dir'] - 90) <= 20 and r['y'] >= bbox[3] - 80:
            r.update(type='base', dir=90, ns=None)
        # joint-like edges without a standard size are plain anchors
        if r['type'] in ('socket', 'cone') and r['ns'] is None:
            r['type'] = 'point'
    # a socket anchored at both rim and inner end yields the same rim twice -> keep one
    dedup = []
    for r in result:
        if r['type'] == 'socket' and any(o['type'] == 'socket' and math.hypot(o['x']-r['x'], o['y']-r['y']) < 60 for o in dedup):
            continue
        dedup.append(r)
    return dedup
