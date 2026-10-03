# Snapparatus

Free browser-based tool for drawing laboratory glassware setups for teaching. Snap together
500+ detailed apparatus parts and put the result into your lab manual, worksheet or
PowerPoint.

**[Open Snapparatus in your browser](https://rainiheini.github.io/Snapparatus/)** - no
installation, no account.

> **Status:** working prototype. Snapping, rotating, liquid fills, labels and arrows, export and
> project files work; hoses, pouring and templates are still to come. To use it offline, download
> the repository and open `app/index.html` in Chrome, Edge or Firefox.

## What it will do

- Pick glassware and equipment from a searchable catalogue: round-bottom flasks, condensers,
  distillation heads, adapters, funnels, stands and more.
- Snap parts together at their ground glass joints, then move, rotate and mirror them.
- Copy and paste the drawing straight into PowerPoint or Word, or export SVG/PNG
  (transparent background, high resolution, adjustable line width).
- Fill vessels with coloured liquid (fill level in percent, colour); pour from tilted vessels
  with adjustable stream length and width.
- Add labels and arrows, and bring parts to the front or send them to the back.
- Save your work as a project file and continue later.
- Runs in any modern browser: online via GitHub Pages, or offline by opening `app/index.html`.
  No installation, no account, no server.
- User interface in English and German.

## Roadmap

1. ~~**Device data:** stable IDs, joint types and sizes, clean vector paths, inner outlines for
   fillable vessels.~~ Done.
2. ~~**Core app:** catalogue, canvas, joint-aware snapping with automatic alignment, rotation,
   liquid fills, copy/paste and export, project files.~~ Working prototype.
3. **Teaching features:** ~~labels and arrows~~ (done), hoses between hose connections (e.g. cooling
   water, vacuum) that follow the parts when they move, pouring from tilted vessels (stream
   length and width), templates for standard setups (reflux, distillation, filtration …).
4. **Later:** stand with sliding clamps, English device names.

## Repository layout

| Path | Contents |
|---|---|
| `app/` | the browser app (static HTML/CSS/JS), published to GitHub Pages |
| `pipeline/` | scripts that extract the device library from the original files ([documentation](pipeline/README.md)) |
| `pipeline/source/` | original LaboBib/C-Design files and manuals |

## Credits and licences

The apparatus drawings come from **[LaboBib](https://fontain.userweb.mwn.de/C-Design/LaboBib.htm)** by Dr. Rainer Rensch, a laboratory
equipment library for the chemistry drawing program **C-Design** (FoBasoft GmbH; Dr. J. Bauer,
Dr. E. Fontain), both released as freeware.

- **Source code:** MIT licence, see [LICENSE](LICENSE).
- **Drawings and device data:** original LaboBib/C-Design freeware terms, which allow free
  use and redistribution but no charge of any kind; using the drawings on media available for a fee
  requires the consent of Dr. Rainer Rensch. See [LICENSE-LaboBib.txt](LICENSE-LaboBib.txt).
  The MIT licence does not apply to them.
