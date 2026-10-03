# Snapparatus

Free browser-based tool for drawing laboratory glassware setups for teaching. Snap together
500+ detailed apparatus parts and put the result into your lab manual, worksheet or
PowerPoint.

> **Status:** early development. The device library has been extracted; the app itself is
> not usable yet.

## What it will do

- Pick glassware and equipment from a searchable catalogue: round-bottom flasks, condensers,
  distillation heads, adapters, funnels, stands and more.
- Snap parts together at their ground glass joints, then move, rotate and mirror them.
- Copy and paste the drawing straight into PowerPoint or Word, or export SVG/PNG
  (transparent background, high resolution, adjustable line width).
- Add labels and arrows; fill vessels with coloured liquid (fill level, colour, pouring).
- Save your work as a project file and continue later.
- Runs in any modern browser: online via GitHub Pages, or offline by opening `app/index.html`.
  No installation, no account, no server.
- User interface in English and German.

## Roadmap

1. **Device data:** stable IDs, clean vector paths, inner outlines for fillable vessels.
2. **Core app:** catalogue, canvas, snapping, copy/paste and export, project files.
3. **Teaching features:** labels and arrows, liquid fills, templates for standard setups
   (reflux, distillation, filtration …).
4. **Later:** joint-aware snapping (only matching joint types and sizes connect, parts
   rotate to the angle of a side arm).

## Repository layout

| Path | Contents |
|---|---|
| `app/` | the browser app (static HTML/CSS/JS), published to GitHub Pages |
| `pipeline/` | scripts that extract the device library from the original files ([documentation](pipeline/README.md)) |
| `pipeline/source/` | original LaboBib/C-Design files and manuals |

## Credits and licences

The apparatus drawings come from **LaboBib** by Dr. R. Rensch, a laboratory equipment library
for the chemistry drawing program **C-Design** (FoBasoft GmbH; Dr. J. Bauer, Dr. E. Fontain),
both released as freeware.

- **Source code:** MIT licence, see [LICENSE](LICENSE).
- **Drawings and device data:** original LaboBib/C-Design freeware terms, which allow free
  use and redistribution but no charge of any kind. See [LICENSE-LaboBib.txt](LICENSE-LaboBib.txt).
  The MIT licence does not apply to them.
