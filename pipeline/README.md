# Pipeline: LaboBib drawings → device SVGs

This pipeline extracts the ~500 laboratory apparatus drawings of the old Windows software
**C-Design + LaboBib** (1995–2000, freeware) as individual SVGs with names, sizes and anchor
points. The result is the device library of Snapparatus.

## Status (2026-10-03)

**582 devices** from 35 palettes. On the data level this matches the original and goes
beyond it in places:

| | Original (C-Design + LaboBib) | Now |
|---|---|---|
| Devices selectable individually | yes (groups) | yes, 582 SVGs |
| Anchor points for assembling | yes, untyped | yes, untyped, at the same positions |
| Consistent scale across devices | yes (1:5) | yes |
| Name per device / search | no, only the palette as a picture | yes |
| Snapping by joint type and angle | no, everything by hand | not yet |

### Known issues

- `SAMMELSU` and parts of `MINILAB` still contain collages of several parts in one SVG
  (object assignment is missing there because the parts consist almost entirely of curves).
- `DEST-0` has no table and goes through the fallback (grouping by distance):
  names `geraet_N`, **no anchor points**.
- Similar variants in the same cell are named `X`, `X_1`, `X_2`.
- The SVGs consist of individual segments (one `<polyline>` per stroke), not connected
  paths. They render correctly but are unsuitable for fills and hit areas.
- The `ns` field of an anchor point is just the nearest joint-size label in the drawing and
  **not reliable** (bottom anchors get a joint size, too).
- File names are not stable IDs: they are derived from the names and change whenever the
  naming logic changes. Project files of the app need separate, fixed IDs.

Device names are German, as in the original library.

## Layout

| Path | Contents |
|---|---|
| `scripts/wmf_to_devices.py` | converter WMF (+ CDW) → device SVGs + manifests |
| `scripts/kontaktblatt.py` | visual check: all devices with names on HTML/PNG contact sheets |
| `scripts/export_all.py` | remote-controls a running C-Design and exports every palette as WMF |
| `scripts/paletten.txt` | the 35 actual equipment palettes (the rest are C-Design examples: molecules, orbitals …) |
| `source/CDW/` | 57 original palettes from the C-Design installer |
| `source/WMF/` | the same palettes, exported as WMF by C-Design itself |
| `source/original/` | manuals (PDF, German), licence and `LABOBIB.INI` of the original |
| `out/devices/` | *generated, not versioned:* device SVGs + one `<PALETTE>_manifest.json` per palette |
| `out/kontaktblatt/` | *generated, not versioned:* `blatt1.png` … |

## Regenerating

Python 3, no third-party packages.

```
cd pipeline/scripts
python wmf_to_devices.py        # source/WMF -> out/devices (palettes from paletten.txt only)
python kontaktblatt.py          # out/devices -> out/kontaktblatt
```

`out/devices` must be empty or absent; otherwise the script stops instead of creating
duplicates (`_1`, `_2`). Other folders and options: `python wmf_to_devices.py --help`.

The WMF export (`export_all.py`) is only needed when new palettes are added; it has been done
for all 57. Start C-Design first and do not touch mouse or keyboard while it runs (requires
`pywin32`, Windows only).

## Data format (interface for the app)

**SVG:** coordinates in 0.01 mm of *drawing size*. LaboBib draws at a **scale of 1:5**, i.e.
100 units = 1 mm in the drawing = 5 mm in reality. All devices share this scale and fit
together without rescaling. Anchor points are included as `<circle class="snap">` (can be
hidden via CSS).

**Manifest** (`<PALETTE>_manifest.json`, a list with one entry per device):

```json
{
  "file": "KOLB-MH1_Mehrhalskolben_250_mL_3_Hals_Kolben_….svg",
  "name": "Mehrhalskolben 250 mL 3-Hals-Kolben mit Mittelschliff NS 29 und 2 NS 29 senkr.",
  "path": ["Mehrhalskolben 250 mL", "3-Hals-Kolben mit Mittelschliff NS 29 und", "2 NS 29 senkr."],
  "ns": null,
  "snaps": [{"x": 1448.2, "y": 2727.9, "ns": "NS 29"}, …],
  "cell_mm": [145.1, 21.1, 190.4, 69.1],
  "w_mm": 29.0, "h_mm": 27.7,
  "labels": ["250 mL"]
}
```

- `path`: the name as a hierarchy (section → column header → caption), suitable for a
  catalogue tree.
- `snaps`: anchor points in SVG coordinates (empty for `DEST-0`).
- `w_mm`/`h_mm`: size in drawing millimetres; `cell_mm`: position of the cell on the original
  palette (`null` for `DEST-0`).

### Meaning of the anchor points (LaboBib manual, p. 7, in `source/original/`)

| Part | Anchor points |
|---|---|
| Female joint (socket) | two: centre of the upper and lower edge of the joint, on its axis |
| Male joint (cone) | one: centre of the upper edge of the joint |
| Vessels (flasks, beakers …) | centre of the bottom |
| Symmetrical devices | additional points on the mirror axis |

The original never snapped automatically: you picked an anchor on the device and one on the
target, and C-Design moved the one exactly onto the other; rotating was up to you. Joint type
(socket/cone/bottom) and direction can be derived from the rules above (not implemented yet).

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

## Licence of the drawings

See [`../LICENSE-LaboBib.txt`](../LICENSE-LaboBib.txt): freeware, free use and
redistribution without any charge.
