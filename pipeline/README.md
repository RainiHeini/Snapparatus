# Pipeline: LaboBib-Zeichnungen → Geräte-SVGs

Diese Pipeline löst die rund 500 Laborgeräte-Zeichnungen der alten Windows-Software
**C-Design + LaboBib** (1995–2000, Freeware) als einzelne SVGs mit Namen, Maßen und
Ankerpunkten heraus. Daraus entsteht die Gerätebibliothek von Snapparatus.

## Stand (2026-10-03)

**582 Geräte** aus 35 Paletten. Auf Datenebene ist damit der Stand des Originals erreicht,
teils übertroffen:

| | Original (C-Design + LaboBib) | Jetzt |
|---|---|---|
| Geräte einzeln auswählbar | ja (Gruppen) | ja, 582 SVGs |
| Ankerpunkte zum Zusammensetzen | ja, ohne Typ | ja, ohne Typ, an denselben Stellen |
| Maßstab untereinander stimmig | ja (1:5) | ja |
| Namen pro Gerät / Suche | nein, nur Tabelle als Bild | ja |
| Einrasten nach Kern/Hülse, Winkel | nein, alles von Hand | noch nicht |

### Bekannte Restmängel

- `SAMMELSU` und Teile von `MINILAB` enthalten noch Collagen mehrerer Teile in einem SVG
  (dort fehlt die Objektzuordnung, weil die Teile fast nur aus Kurven bestehen).
- `DEST-0` hat keine Tabelle und läuft über den Fallback (Gruppieren nach Abstand):
  Namen `geraet_N`, **keine Ankerpunkte**.
- Gleichartige Varianten in derselben Zelle heißen `X`, `X_1`, `X_2`.
- Die SVGs bestehen aus Einzelsegmenten (jede Strecke ein `<polyline>`), nicht aus
  zusammenhängenden Pfaden. Sieht korrekt aus, ist aber für Füllung/Klickfläche ungünstig.
- Das Feld `ns` an den Ankerpunkten ist nur der nächstgelegene NS-Text der Zeichnung und
  **nicht verlässlich** (auch Bodenpunkte bekommen eine NS-Angabe).
- Dateinamen sind keine stabilen IDs: Sie entstehen aus den Namen und ändern sich, wenn sich
  die Namenslogik ändert. Für Projektdateien der App braucht es eigene, feste IDs.

## Ordner

| Ordner / Datei | Inhalt |
|---|---|
| `scripts/wmf_to_devices.py` | Konverter WMF (+ CDW) → Geräte-SVGs + Manifeste |
| `scripts/kontaktblatt.py` | Sichtkontrolle: alle Geräte mit Namen auf HTML/PNG-Blättern |
| `scripts/export_all.py` | steuert ein laufendes C-Design fern und exportiert alle Paletten als WMF |
| `scripts/paletten.txt` | die 35 echten Geräte-Paletten (Rest sind C-Design-Beispiele: Moleküle, Orbitale …) |
| `source/CDW/` | 57 Original-Paletten aus dem C-Design-Installer |
| `source/WMF/` | dieselben Paletten, von C-Design selbst als WMF exportiert |
| `source/original/` | Handbücher (PDF), Lizenz und `LABOBIB.INI` des Originals |
| `out/devices/` | *erzeugt, nicht versioniert:* Geräte-SVGs + je Palette `<PALETTE>_manifest.json` |
| `out/kontaktblatt/` | *erzeugt, nicht versioniert:* `blatt1.png` … |

## Neu erzeugen

Python 3 ohne Zusatzpakete. Auf dem Entwicklungsrechner:
`%LOCALAPPDATA%\Programs\Python\Python311\python.exe` (das `python` im PATH ist der
defekte Windows-Store-Platzhalter).

```
cd pipeline/scripts
python wmf_to_devices.py        # source/WMF -> out/devices (nur Paletten aus paletten.txt)
python kontaktblatt.py          # out/devices -> out/kontaktblatt
```

`out/devices` muss dazu leer sein bzw. fehlen; das Script bricht sonst ab, statt Dubletten
(`_1`, `_2`) zu erzeugen. Andere Ordner/Optionen: `python wmf_to_devices.py --help`.

Der WMF-Export (`export_all.py`) ist nur nötig, wenn neue Paletten dazukommen; er ist für
alle 57 erledigt. Dafür C-Design starten und während des Laufs Maus und Tastatur nicht
anfassen (benötigt `pywin32`).

## Datenformat (Schnittstelle für die App)

**SVG:** Koordinaten in 0,01 mm *Zeichnungsmaß*. LaboBib zeichnet im **Maßstab 1:5**,
d. h. 100 Einheiten = 1 mm Zeichnung = 5 mm in echt. Alle Geräte haben denselben Maßstab
und passen daher ohne Skalierung aneinander. Ankerpunkte sind als
`<circle class="snap">` enthalten (per CSS ausblendbar).

**Manifest** (`<PALETTE>_manifest.json`, eine Liste, ein Eintrag pro Gerät):

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

- `path`: Name als Hierarchie (Abschnitt → Spaltenkopf → Beschriftung), gut für einen
  Katalog-Baum.
- `snaps`: Ankerpunkte in SVG-Koordinaten (leer bei `DEST-0`).
- `w_mm`/`h_mm`: Größe in Zeichnungs-mm; `cell_mm`: Lage der Zelle auf der Original-Palette
  (`null` bei `DEST-0`).

### Bedeutung der Ankerpunkte (LaboBib-Handbuch, S. 7, in `source/original/`)

| Teil | Ankerpunkte |
|---|---|
| Schliffhülse | zwei: Mitte der Ober- und Unterkante des Schliffs, auf der Achse |
| Schliffkern | einer: Mitte der oberen Schliffkante |
| Gefäße (Kolben, Becherglas, …) | Mitte des Bodens |
| symmetrische Geräte | zusätzliche Punkte auf der Spiegelachse |

Im Original rastete nichts automatisch ein: Man wählte einen Ankerpunkt am Gerät und einen am
Ziel, C-Design schob das eine exakt auf das andere; Drehen musste man selbst. Aus den Regeln
oben lassen sich Typ (Hülse/Kern/Boden) und Richtung der Schliffe ableiten (noch nicht
umgesetzt).

## Wie der Konverter arbeitet

Statt das CDW-Binärformat vollständig nachzubauen, lässt die Pipeline C-Design selbst rendern
(WMF-Export, inkl. der erst zur Laufzeit erzeugten Schliffe) und nutzt die CDW nur für das,
was im WMF fehlt.

- **WMF lesen:** Linien, Bögen, Texte. C-Design exportiert Beschriftungen zeichenweise; sie
  werden wieder zu Wörtern zusammengesetzt (`-75°`, `Magnetrührer`).
- **Tabelle zerlegen:** Die Paletten sind verschachtelte Tabellen (Zellen über mehrere
  Zeilen/Spalten). Ein Rechteck wird nur von Linien geteilt, die es vollständig
  durchlaufen, rekursiv bis zu den kleinsten Zellen. Gerätewände reichen nie bis zum
  Zellenrand, daher werden keine Geräte zerschnitten.
- **Geräte trennen:** Byte 5 jedes CDW-Records ist die **Objektnummer** (im Handbuch
  „Gruppe“; so erkennt auch C-Design, welches Gerät angeklickt wurde; 0 = Rahmen und
  Schliffe). Jeder WMF-Strich bekommt die Nummer der CDW-Linie, auf der er liegt. Teile, die
  sich berühren (angesetzter Schliff) oder ineinander liegen (Kühlschlange im Mantel),
  bleiben ein Gerät. Ohne Objektinfo wird nach Abstand gruppiert.
- **Namen:** aus den Überschriftszellen über dem Gerät plus Beschriftung in der Zelle;
  Beschriftungsrahmen wie `RG-24mL` werden aus der Zeichnung entfernt und als Name genutzt.
- **Ankerpunkte:** aus der CDW. Die Verschiebung CDW → WMF wird bestimmt, indem Linien
  gleicher Länge und Richtung für eine Verschiebung „abstimmen“. Prüfung: Mindestens 90 %
  der CDW-Linien müssen danach auf WMF-Linien liegen, sonst werden keine Ankerpunkte
  ausgegeben (aktuell 100 % in allen Paletten). Jeder Punkt gehört genau einem Gerät.

## Lizenz der Zeichnungen

Siehe `../LICENSE-LaboBib.txt`: Freeware, freie Nutzung und Weitergabe ohne Entgelt.
