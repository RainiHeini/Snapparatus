# Pipeline: LaboBib drawings → device SVGs

This pipeline extracts the ~500 laboratory apparatus drawings of the old Windows software
**C-Design + LaboBib** (1995–2000, freeware) as individual SVGs with names, sizes and anchor
points. The result is the device library of Snapparatus.

## Status (2026-10-03)

**582 devices** from 35 palettes, each with a stable ID, and **569 ground glass joints**
classified by type, direction and size (333 sockets, 234 cones), plus 185 standing surfaces,
154 hose olives and 22 supports (heating mantles, cork rings, lab jacks, stirrer plates).
146 vessels carry an inner outline for liquid fills. The whole library is bundled for the app
as `app/data/devices.js` (1.3 MB, about 380 KB compressed). On the data level this matches the original and goes beyond it:

| | Original (C-Design + LaboBib) | Now |
|---|---|---|
| Devices selectable individually | yes (groups) | yes, 582 SVGs |
| Anchor points for assembling | yes, untyped | yes, at the same positions, typed |
| Consistent scale across devices | yes (1:5) | yes |
| Name per device / search | no, only the palette as a picture | yes |
| Joint type, size and direction | no, everything by hand | yes (snapping itself is up to the app) |

### Known issues

- `SAMMELSU` and parts of `MINILAB` still contain collages of several parts in one SVG
  (object assignment is missing there because the parts consist almost entirely of curves).
- `DEST-0` has no table and goes through the fallback (grouping by distance):
  names `geraet_N`, **no anchor points**.
- Similar variants in the same cell are named `X`, `X_1`, `X_2`.
- No fill outline yet for Dewar vessels (double wall), cold traps and one gas washing bottle;
  a few non-vessels get one (e.g. a filter flask lid) - harmless, fills are switched on by hand.
- About 230 anchors remain untyped (`point`) and are meant to be ignored by the app: reference
  points of the original on mirror axes (thermometers, stirrer shafts, funnels), stand parts
  (rods and clamps need a sliding attachment, planned separately), plus `MINILAB` and
  `SAMMELSU`. Single misses exist (e.g. one NS 10 cone drawing).
- `MINILAB` parts connect by screw threads, not standard taper joints; their joints carry
  `"system": "MINILAB"` so the app can keep them apart.
- File names are derived from the names and may change; use `id` to reference devices.

Device names are German, as in the original library.

## Layout

| Path | Contents |
|---|---|
| `scripts/wmf_to_devices.py` | converter WMF (+ CDW) → device SVGs + manifests |
| `scripts/joints.py` | classifies anchor points (socket / cone / base / hose) by local geometry |
| `scripts/fill.py` | inner outline of vessels for liquid fills (needs Pillow) |
| `scripts/build_app_data.py` | bundles the library into `app/data/devices.js` |
| `scripts/kontaktblatt.py` | visual check: all devices with names on HTML/PNG contact sheets; `--joints` marks the joints |
| `scripts/export_all.py` | remote-controls a running C-Design and exports every palette as WMF |
| `scripts/paletten.txt` | the 35 actual equipment palettes (the rest are C-Design examples: molecules, orbitals …) |
| `source/CDW/` | 57 original palettes from the C-Design installer |
| `source/WMF/` | the same palettes, exported as WMF by C-Design itself |
| `source/original/` | manuals (PDF, German), licence and `LABOBIB.INI` of the original |
| `out/devices/` | *generated, not versioned:* device SVGs + one `<PALETTE>_manifest.json` per palette |
| `out/kontaktblatt/` | *generated, not versioned:* `blatt1.png` …, with joints: `schliffe1.png` … |

## Regenerating

Python 3 with Pillow (`pip install pillow`, used for the fill outlines).

```
cd pipeline/scripts
python wmf_to_devices.py        # source/WMF -> out/devices (palettes from paletten.txt only)
python build_app_data.py        # out/devices -> app/data/devices.js
python kontaktblatt.py          # out/devices -> out/kontaktblatt
python kontaktblatt.py --joints # same, with joint arrows (blue socket, orange cone, green base, purple hose)
```

Palettes are converted in parallel (one process per palette); a full run takes about 15 s.
Commit the regenerated `app/data/devices.js`; the app reads only that file.

`out/devices` must be empty or absent; otherwise the script stops instead of creating
duplicates (`_1`, `_2`). Other folders and options: `python wmf_to_devices.py --help`.

The WMF export (`export_all.py`) is only needed when new palettes are added; it has been done
for all 57. Start C-Design first and do not touch mouse or keyboard while it runs (requires
`pywin32`, Windows only).

## Data format (interface for the app)

**SVG:** coordinates in 0.01 mm of *drawing size*. LaboBib draws at a **scale of 1:5**, i.e.
100 units = 1 mm in the drawing = 5 mm in reality. All devices share this scale and fit
together without rescaling. The drawing is a single `<path>` (strokes joined where they meet
end to end, invisible points dropped) plus `<text>` labels. Anchor points are included as
`<circle class="snap">` (can be hidden via CSS).

**Manifest** (`<PALETTE>_manifest.json`, a list with one entry per device):

```json
{
  "id": "kuehler-1/1-25",
  "file": "KUEHLER-1_Kuehler_NS_29_Schrauboliven_Dimroth_Kuehler.svg",
  "name": "Kühler NS 29 (Schrauboliven) Dimroth-Kühler",
  "path": ["Kühler NS 29 (Schrauboliven)", "Dimroth-Kühler"],
  "ns": null,
  "snaps": [
    {"x": 446.2, "y": 40.1,   "type": "socket", "dir": 270, "width": 654, "ns": 29, "system": "NS"},
    {"x": 446.6, "y": 7202.8, "type": "cone",   "dir": 90,  "width": 584, "ns": 29, "system": "NS"},
    {"x": 2042.3, "y": 1576.2, "type": "hose",  "dir": 45,  "width": 107, "ns": null}
  ],
  "cell_mm": [1.1, 25.1, 31.6, 113.1],
  "w_mm": 21.2, "h_mm": 82.5,
  "labels": ["RD14", "45°", "RD14", "45°"]
}
```

- `id`: stable device ID - palette, position of its cell on the original palette (mm) and,
  if a cell holds several devices, their index from left to right. Use it in project files.
- `path`: the name as a hierarchy (section → column header → caption), suitable for a
  catalogue tree.
- `ns` (device): joint size mentioned in the drawing's labels, informational only.
- `snaps`: anchor points in SVG coordinates (empty for `DEST-0`):
  - `type`: `socket` (female joint), `cone` (male joint), `base` (standing surface of a
    vessel), `support` (where a vessel stands or sits: `"shape"` is `flat` for lab jacks and
    stirrer plates, `bowl` for heating mantles, `ring` for cork rings), `hose` (hose olive tip)
    or `point` (other reference point, not meant for snapping);
  - `dir`: outward direction in degrees, SVG convention (0 = right, 90 = down). A cone fits a
    socket of the same `ns` and `system` when their directions are opposite; sockets sit at
    the centre of the opening rim, cones at the centre of their wide edge, so the two points
    coincide when assembled;
  - `width`: drawn width of the joint edge; `ns`: standard taper size (10, 14, 19, 24, 29,
    34, 45), always set for sockets and cones;
  - `system`: `NS` for standard taper joints, `MINILAB` for the screw-thread micro kit.
- `fill`: for vessels, `{"regions": [[x, y, x, y, ...], ...], "openings": [[x1, y1, x2, y2], ...]}`
  - closed inner outlines (one per vessel body, e.g. three for a spider with flasks) and the
  openings liquid can pour out of; `null` for everything else. Enclosed labels and scale marks
  count as inside, so a fill clipped to the outline is never cut out around them.
- `w_mm`/`h_mm`: size in drawing millimetres; `cell_mm`: position of the cell on the original
  palette (`null` for `DEST-0`).

**App data** (`app/data/devices.js`): `window.SNAPPARATUS_DATA = {categories, devices}`;
categories with German and English labels, devices with `id`, `category`, `name`, `path`,
`w`, `h` (0.01 mm), `svg` (inner markup), `snaps` and `fill` as above.

### Meaning of the anchor points (LaboBib manual, p. 7, in `source/original/`)

| Part | Anchor points |
|---|---|
| Female joint (socket) | two: centre of the upper and lower edge of the joint, on its axis |
| Male joint (cone) | one: centre of the upper edge of the joint |
| Vessels (flasks, beakers …) | centre of the bottom |
| Symmetrical devices | additional points on the mirror axis |

The original never snapped automatically: you picked an anchor on the device and one on the
target, and C-Design moved the one exactly onto the other; rotating was up to you.
`joints.py` derives type, direction and size from these rules plus the drawing: it scans
cross-sections perpendicular to the straight edge through each anchor. A rim bead (wider than
the rim line) marks a socket opening; a body that continues the edge and narrows to a tip
marks a cone; a body that widens towards an opening marks a socket anchored at its inner end
(the snap point is moved to the rim). Anchors without a joint get a second look: a U-shaped
bottom with free space below is a standing surface, the end of a narrow tube a hose olive.
Supports are only assigned where the device kind is known to offer one (`SUPPORT_PALETTES`
and cork rings in `wmf_to_devices.py`), because a stirrer plate and a bath rim, or a heating
mantle and a flask bottom, look alike in the drawing. The rim line of a socket and the wide edge of a cone
have fixed drawn widths per joint size:

| NS | 10 | 14 | 19 | 24 | 29 | 34 | 45 |
|---|---|---|---|---|---|---|---|
| socket rim | 216 | 332 | 440 | 538 | 653 | 805 | 981 |
| cone edge | 200 | 290 | 376 | 465 | 584 | 700 | 900 |

## How the converter works

Instead of fully re-implementing the binary CDW format, the pipeline lets C-Design render the
drawings itself (WMF export, including the ground glass joints that are only generated at
runtime) and uses the CDW files only for what the WMF lacks.

- **Reading WMF:** lines, arcs, texts. C-Design exports labels character by character; they
  are merged back into words (`-75°`, `Magnetrührer`).
- **Splitting the table:** the palettes are nested tables (cells spanning several rows or
  columns). A rectangle is only split by lines that run all the way through it, recursively
  down to the smallest cells. Device walls never reach the cell border, so no device is cut
  in two.
- **Separating devices:** byte 5 of every CDW record is the **object number** (a "group" in
  the manual; this is how C-Design knows which device was clicked; 0 = frames and joints).
  Every WMF stroke gets the number of the CDW line it lies on. Parts that touch (an attached
  joint) or lie inside each other (a cooling coil inside its jacket) stay one device. Without
  object information, strokes are grouped by distance.
- **Names:** taken from the header cells above the device plus the caption inside the cell;
  label boxes such as `RG-24mL` are removed from the drawing and used as the name.
- **Anchor points:** taken from the CDW. The offset CDW → WMF is found by letting lines of
  equal length and direction "vote" for a shift. Check: at least 90 % of the CDW lines must
  then lie on WMF lines, otherwise no anchor points are written (currently 100 % in every
  palette). Every anchor belongs to exactly one device.

### Fill outlines

`fill.py` rasterises the device (0.08 mm per pixel), closes every joint and olive and the open
top, and flood-fills from just above each standing surface (funnels: from the middle). Feet and
stand rings are skipped (too small or too flat), a flood that reaches the border means a gap in
the drawing and yields no outline. Only palettes listed in `FILL_PALETTES` are considered.

## Licence of the drawings

See [`../LICENSE-LaboBib.txt`](../LICENSE-LaboBib.txt): freeware, free use and
redistribution without any charge.
