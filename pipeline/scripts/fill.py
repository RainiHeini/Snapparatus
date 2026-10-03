#!/usr/bin/env python3
"""
fill.py - inner outline of a vessel, used by the app to draw liquid fills.

The device is rasterised, its openings are closed (a line across every socket rim and a band
along the top edge), and the inside is flood-filled from just above each standing surface.
Labels and scale marks enclosed by the liquid region count as inside, so a fill is never cut
out around them. If the flood reaches the image border the drawing has a gap there and the
device is reported as not fillable instead of being filled wrongly.

  vessel_regions(strokes, snaps, W, H, hanging=False) -> {"regions": [[x, y, ...], ...], "openings": [[x1, y1, x2, y2], ...]} or None

Requires Pillow.
"""
import math
from PIL import Image, ImageDraw

RES = 8           # drawing units (0.01 mm) per raster pixel
LINE_PX = 3       # rasterised stroke width; closes hairline gaps
TOP_BAND = 25     # units below the topmost stroke that count as the open top
MIN_AREA = 0.02   # a region must cover at least this share of the device box ...
MIN_HEIGHT = 0.15 # ... and this share of its height (skips feet and stand rings)


def _trace(mask, w, h):
    """Outer boundary of the filled (255) pixels, followed along pixel edges (crack following)
    with the region on the right; -> corner points where the direction changes."""
    px = mask.load()
    inside = lambda x, y: 0 <= x < w and 0 <= y < h and px[x, y] == 255
    start = next(((x, y) for y in range(h) for x in range(w) if px[x, y] == 255), None)
    if start is None: return []
    v = start; d = (1, 0); out = [v]                     # along the top edge of the first pixel
    for _ in range(4 * (w + h) * 8 + 4 * w * h):
        r = (-d[1], d[0])                                 # right-hand normal (y points down)
        ahead_r = inside(math.floor(v[0] + 0.5*d[0] + 0.5*r[0]), math.floor(v[1] + 0.5*d[1] + 0.5*r[1]))
        ahead_l = inside(math.floor(v[0] + 0.5*d[0] - 0.5*r[0]), math.floor(v[1] + 0.5*d[1] - 0.5*r[1]))
        if ahead_l: nd = (d[1], -d[0])                    # turn left
        elif ahead_r: nd = d                              # straight on
        else: nd = r                                      # turn right
        if nd != d: out.append(v); d = nd
        v = (v[0] + d[0], v[1] + d[1])
        if v == start: break                              # the start corner cannot occur twice
    return out


def _simplify(pts, tol):
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy)
        imax, dmax = None, tol
        for i in range(a + 1, b):
            p = pts[i]
            d = math.hypot(p[0]-ax, p[1]-ay) if L == 0 else abs(dy*(p[0]-ax) - dx*(p[1]-ay)) / L
            if d > dmax: imax, dmax = i, d
        if imax is not None:
            keep[imax] = True; stack += [(a, imax), (imax, b)]
    return [p for p, k in zip(pts, keep) if k]


def _region_above(img, done, x, y, w, h):
    """Walk up from a standing surface; the first enclosed area of real size is the vessel
    (feet and stand rings - small or flat closed areas - are skipped)."""
    x = min(max(int(x), 1), w - 2); tried = Image.new('L', (w, h), 0)
    for yy in range(min(int(y) - 2, h - 2), max(1, int(y - 0.6 * h)), -1):
        if img.getpixel((x, yy)) != 255 or tried.getpixel((x, yy)) or done.getpixel((x, yy)): continue
        work = img.copy()
        ImageDraw.floodfill(work, (x, yy), 128)
        region = work.point(lambda v: 255 if v == 128 else 0)
        tried.paste(255, mask=region)
        bb = region.getbbox()
        if bb is None or bb[0] == 0 or bb[1] == 0 or bb[2] >= w or bb[3] >= h:
            return None                                   # leaked to the border: gap in the drawing
        if sum(region.histogram()[255:]) < MIN_AREA * w * h or bb[3] - bb[1] < MIN_HEIGHT * h: continue
        # enclosed labels / scale marks belong to the liquid region
        outside = region.copy(); ImageDraw.floodfill(outside, (0, 0), 64)
        return outside.point(lambda v: 0 if v == 64 else 255)
    return None


def vessel_regions(strokes, snaps, W, H, hanging=False):
    """hanging: the vessel has no standing surface (dropping/separating funnel) - start the
    search in the middle of the device instead."""
    seeds = [s for s in snaps if s['type'] == 'base']
    if not seeds and hanging:
        seeds = [{'x': W / 2, 'y': H * f} for f in (0.5, 0.4, 0.6)]
    if not seeds: return None
    w, h = int(W / RES) + 3, int(H / RES) + 3             # 1 px margin all round
    P = lambda x, y: (x / RES + 1, y / RES + 1)
    img = Image.new('L', (w, h), 255); dr = ImageDraw.Draw(img)
    for s in strokes:
        if len(s) >= 2: dr.line([P(*q) for q in s], fill=0, width=LINE_PX, joint='curve')
    openings = []
    for s in snaps:                                       # close every joint and olive
        if s['type'] not in ('socket', 'cone', 'hose') or s.get('dir') is None: continue
        a = math.radians(s['dir']); ux, uy = -math.sin(a), math.cos(a)
        half = (s['width'] or 600) * 0.65
        seg = (s['x'] - ux*half, s['y'] - uy*half, s['x'] + ux*half, s['y'] + uy*half)
        dr.line([P(seg[0], seg[1]), P(seg[2], seg[3])], fill=0, width=LINE_PX + 2)
        if s['type'] == 'socket': openings.append([round(v) for v in seg])   # liquid pours out here
    top = min(q[1] for s in strokes for q in s)          # close the open top (beakers, cylinders)
    dr.rectangle([0, 0, w, P(0, top + TOP_BAND)[1]], fill=0)
    regions = []
    done = Image.new('L', (w, h), 0)
    for sd in seeds:
        region = _region_above(img, done, *P(sd['x'], sd['y']), w, h)
        if region is None: continue
        done.paste(255, mask=region)
        pts = _simplify(_trace(region, w, h), 1.0)
        if len(pts) >= 3:
            regions.append([round((v - 1) * RES) for p in pts for v in p])
        if 'type' not in sd: break                        # funnel: the first body found is the one
    if not regions: return None
    # open top: where the liquid region reaches the closing band
    band_y = top + TOP_BAND
    xs = [r[i] for r in regions for i in range(0, len(r), 2) if r[i+1] <= band_y + 2*RES]
    if xs: openings.append([min(xs), round(band_y), max(xs), round(band_y)])
    return {'regions': regions, 'openings': openings}
