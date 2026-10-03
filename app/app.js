/* Snapparatus - draw laboratory glassware setups.
 * Plain script (no modules) so the app also runs when index.html is opened from disk.
 * World coordinates are device units: 0.01 mm at the LaboBib drawing scale of 1:5. */
(function () {
  'use strict';

  const DATA = window.SNAPPARATUS_DATA;
  const DEV = new Map(DATA.devices.map(d => [d.id, d]));
  const TEMPLATES = window.SNAPPARATUS_TEMPLATES || [];   // [{id, de, en, start, data: project}]
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- texts
  const T = {
    de: {
      new: 'Neu', project: 'Speichern / Öffnen', projectTip: 'Speichern / Öffnen (Strg+S)', save: 'Speichern', open: 'Öffnen',
      saveText: 'Lädt die Zeichnung als Datei herunter. So kannst du später daran weiterarbeiten.',
      download: 'Herunterladen', openText: 'Datei hierher ziehen', pick: 'Datei auswählen …',
      openHint: 'Snapparatus-Datei (.snapparatus.json) oder ein aus Snapparatus exportiertes SVG',
      autosave: 'Außerdem merkt sich die App die aktuelle Zeichnung automatisch in diesem Browser.',
      emptyNoSave: 'Die Zeichnung ist noch leer.',
      newTitle: 'Neue Zeichnung?', newText: 'Die aktuelle Zeichnung wird verworfen.',
      replaceTitle: 'Datei öffnen?', replaceText: 'Die aktuelle Zeichnung wird durch die Datei ersetzt.',
      cancel: 'Abbrechen', saveFirst: 'Erst speichern', discard: 'Verwerfen', replace: 'Ersetzen', undo: 'Rückgängig (Strg+Z)', redo: 'Wiederholen (Strg+Y)',
      text: 'Text', arrow: 'Pfeil', templates: 'Vorlagen', soon: 'Kommt bald', templatesTip: 'Standardaufbau einfügen',
      templatesHint: 'Ein Klick fügt den Aufbau zusätzlich neben der bestehenden Zeichnung ein.', noTemplates: 'Noch keine Vorlagen vorhanden.', export: 'Export', copy: 'Kopieren',
      textTip: 'Beschriftung setzen: auf die Zeichenfläche klicken', arrowTip: 'Pfeil zeichnen: auf der Zeichenfläche ziehen',
      textMode: 'Auf die Zeichenfläche klicken, um eine Beschriftung zu setzen (Esc: abbrechen).',
      arrowMode: 'Auf der Zeichenfläche ziehen, um einen Pfeil zu zeichnen (Esc: abbrechen).',
      label: 'Beschriftung', arrowTitle: 'Pfeil', size: 'Größe', small: 'Klein', medium: 'Mittel', large: 'Groß',
      editText: 'Text bearbeiten', textHint: 'Doppelklick auf den Text bearbeitet ihn. Fertig: daneben klicken oder Esc.',
      arrange: 'Anordnung', toFront: 'Nach vorn', toBack: 'Nach hinten',
      frontTip: 'Eine Stufe nach vorn: vor das nächste Teil, das es überdeckt', backTip: 'Eine Stufe nach hinten: hinter das nächste Teil, das es überdeckt',
      inDrawing: 'In der Zeichnung', setup: 'Apparatur', notesGroup: 'Beschriftungen und Pfeile', listHint: 'Anklicken wählt aus – auch Teile, die verdeckt sind.',
      head: 'Spitze', headEnd: 'Am Ende', headBoth: 'Beidseitig', headNone: 'Ohne',
      arrowHint: 'Die Enden lassen sich ziehen, mit gedrückter Umschalttaste in 15°-Schritten.',
      exportSvg: 'Als SVG speichern', exportPng: 'Als PNG speichern', settings: 'Einstellungen',
      swapSides: 'Seiten tauschen', swapHint: 'Katalog rechts, Eigenschaften links', about: 'Über Snapparatus · Lizenzen',
      credit: 'Zeichnungen: LaboBib · Lizenz',
      aboutHtml: `<p>Kostenloses Werkzeug zum Zeichnen von Laborapparaturen für Lehre, Skripte und Präsentationen.</p>
        <h3>Gerätezeichnungen</h3>
        <p>Alle Gerätezeichnungen stammen aus <a href="https://fontain.userweb.mwn.de/C-Design/LaboBib.htm" target="_blank" rel="noopener"><b>LaboBib</b></a>,
        der Laborgerätebibliothek von <b>Dr. Rainer Rensch</b>, für das Zeichenprogramm <b>C-Design</b>
        (© 1988–1998 FoBasoft GmbH, © 2010 Dr. J. Bauer, Dr. E. Fontain).</p>
        <h3>Lizenz</h3>
        <p>Wortlaut der <i>License.txt</i> aus dem C-Design-Installationspaket:</p>
        <blockquote>Das Programm C-Design und die Laborgerätebebliothek LaboBib sind Freeware und können frei verwendet und weitergegeben werden, solange für die Bereitstellung, Benutzung, oder Verteilung kein Entgelt verlangt wird.<br>Eine Distribution des Programms auf gegen Entgelt zugängliche Medien ist nur mit Zustimmung der Autoren zulässig.<br><br>Haftungsausschluss<br>Es kann weder eine Garantie noch eine juristische Verantwortung oder irgendeine Haftung für die Folgen, die durch eine fehlerhafte Bedienung oder durch Programmfehler entstehen können, übernommen werden.</blockquote>
        <p>Ergänzung des Autors auf der <a href="https://fontain.userweb.mwn.de/C-Design/LaboBib.htm" target="_blank" rel="noopener">LaboBib-Homepage</a>:</p>
        <blockquote>Die Zeichnungen in der Laborgerätebibliothek LaboBib unterliegen dem Urheberrecht und dürfen auf gegen Entgelt zugänglichen Medien ausschließlich mit Zustimmung von Dr. Rainer Rensch verwendet werden.</blockquote>
        <h3>Programm</h3>
        <p>Der Programmcode von Snapparatus steht unter der MIT-Lizenz. Sie gilt nicht für die Gerätezeichnungen.</p>
        <p><a href="https://github.com/RainiHeini/Snapparatus" target="_blank" rel="noopener">Projekt auf GitHub</a></p>`,
      collapse: 'Ein-/ausklappen', zoomFit: 'Alles zeigen', search: 'Gerät suchen …', all: 'Alle',
      results: 'Suchergebnisse', noResults: 'Nichts gefunden.',
      emptyHint: 'Geräte aus dem Katalog hierher ziehen oder anklicken.<br>Schliffe rasten automatisch ein.', jointSize: 'Schliff',
      drawing: 'Zeichnung', parts: n => `${n} ${n === 1 ? 'Teil' : 'Teile'}`, lineWidth: 'Strichstärke',
      thin: 'Dünn', normal: 'Normal', thick: 'Dick',
      howto: 'Teil ziehen: am passenden Schliff rastet es ein und richtet sich aus. Ein Klick im Katalog setzt das Teil an das ausgewählte Gerät an. Eingerastete Teile bleiben zusammen – zum Trennen ein Teil auswählen und am Schliff auf das rote Symbol klicken.',
      pour: 'Ausgießen', pourHint: 'Das Gefäß ist so geneigt, dass Flüssigkeit ausläuft.', pourLength: 'Länge', pourWidth: 'Breite',
      pourEnd: 'Ende', hardEnd: 'Scharf', softEnd: 'Auslaufend', auto: 'Auto', autoTip: 'so breit wie die Flüssigkeit an der Öffnung', widthOpening: 'wie die Öffnung (sie zeigt nach unten)',
      outline: 'Kontur', outlineTip: 'Wasserlinie und Strahl mit feiner Randlinie, gut für Schwarz-Weiß-Druck',
      position: 'Lage', rotation: 'Drehung', rotateHint: 'dreht die ganze Apparatur um dieses Teil', mirror: 'Spiegeln',
      mirrorBtn: 'Horizontal', fill: 'Füllung', level: 'Füllhöhe', color: 'Farbe', joints: 'Anschlüsse',
      duplicate: 'Duplizieren', delete: 'Löschen', detach: 'Aus Apparatur lösen', unlink: 'Hier trennen',
      socket: 'Hülse', cone: 'Kern', rubber: 'passt in jeden Hals', rubberSocket: 'nimmt einen Stiel auf',
      barrel: 'nimmt einen Kolben auf', plunger: 'passt in einen Zylinder', plainNeck: 'Öffnung ohne Schliff', base: 'Standfläche', support: 'Auflage', hose: 'Olive',
      trash: 'Zum Entfernen hierher ziehen', trashOver: 'Loslassen zum Entfernen',
      copied: 'Bild kopiert – in PowerPoint oder Word einfügen (Strg+V).',
      copyFailed: 'Kopieren nicht möglich – bitte „Export → Als PNG speichern“ verwenden.',
      saved: 'Gespeichert.', openFailed: 'Datei konnte nicht geöffnet werden.', nothing: 'Die Zeichnung ist leer.',
      confirmNew: 'Aktuelle Zeichnung verwerfen?', unknownDevices: n => `${n} unbekannte Geräte übersprungen.`,
      fileName: 'apparatur',
    },
    en: {
      new: 'New', project: 'Save / Open', projectTip: 'Save / Open (Ctrl+S)', save: 'Save', open: 'Open',
      saveText: 'Downloads the drawing as a file, so you can continue working on it later.',
      download: 'Download', openText: 'Drop a file here', pick: 'Choose file …',
      openHint: 'Snapparatus file (.snapparatus.json) or an SVG exported from Snapparatus',
      autosave: 'The app also keeps the current drawing automatically in this browser.',
      emptyNoSave: 'The drawing is still empty.',
      newTitle: 'New drawing?', newText: 'The current drawing will be discarded.',
      replaceTitle: 'Open file?', replaceText: 'The current drawing will be replaced by the file.',
      cancel: 'Cancel', saveFirst: 'Save first', discard: 'Discard', replace: 'Replace', undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Y)',
      text: 'Text', arrow: 'Arrow', templates: 'Templates', soon: 'Coming soon', templatesTip: 'Insert a standard setup',
      templatesHint: 'Click a setup to add it next to the current drawing.', noTemplates: 'No templates yet.', export: 'Export', copy: 'Copy',
      textTip: 'Add a label: click on the drawing area', arrowTip: 'Draw an arrow: drag on the drawing area',
      textMode: 'Click on the drawing area to place a label (Esc: cancel).',
      arrowMode: 'Drag on the drawing area to draw an arrow (Esc: cancel).',
      label: 'Label', arrowTitle: 'Arrow', size: 'Size', small: 'Small', medium: 'Medium', large: 'Large',
      editText: 'Edit text', textHint: 'Double-click the text to edit it. Done: click elsewhere or press Esc.',
      arrange: 'Arrange', toFront: 'Bring forward', toBack: 'Send backward',
      frontTip: 'One step forward: in front of the next part it overlaps', backTip: 'One step backward: behind the next part it overlaps',
      inDrawing: 'In the drawing', setup: 'Setup', notesGroup: 'Labels and arrows', listHint: 'Click to select – also parts that are hidden behind others.',
      head: 'Head', headEnd: 'At the end', headBoth: 'Both ends', headNone: 'None',
      arrowHint: 'Drag the ends to change the arrow; hold Shift for 15° steps.',
      exportSvg: 'Save as SVG', exportPng: 'Save as PNG', settings: 'Settings',
      swapSides: 'Swap sides', swapHint: 'Catalogue on the right, properties on the left', about: 'About Snapparatus · Licences',
      credit: 'Drawings: LaboBib · Licence',
      aboutHtml: `<p>Free tool for drawing laboratory setups for teaching, lab manuals and presentations.</p>
        <h3>Equipment drawings</h3>
        <p>All equipment drawings come from <a href="https://fontain.userweb.mwn.de/C-Design/LaboBib.htm" target="_blank" rel="noopener"><b>LaboBib</b></a>,
        the laboratory equipment library by <b>Dr. Rainer Rensch</b>, for the drawing program <b>C-Design</b>
        (© 1988–1998 FoBasoft GmbH, © 2010 Dr. J. Bauer, Dr. E. Fontain).</p>
        <h3>Licence</h3>
        <p>Wording of <i>License.txt</i> from the C-Design installation package (German, authoritative):</p>
        <blockquote lang="de">Das Programm C-Design und die Laborgerätebebliothek LaboBib sind Freeware und können frei verwendet und weitergegeben werden, solange für die Bereitstellung, Benutzung, oder Verteilung kein Entgelt verlangt wird.<br>Eine Distribution des Programms auf gegen Entgelt zugängliche Medien ist nur mit Zustimmung der Autoren zulässig.<br><br>Haftungsausschluss<br>Es kann weder eine Garantie noch eine juristische Verantwortung oder irgendeine Haftung für die Folgen, die durch eine fehlerhafte Bedienung oder durch Programmfehler entstehen können, übernommen werden.</blockquote>
        <p>Addition by the author on the <a href="https://fontain.userweb.mwn.de/C-Design/LaboBib.htm" target="_blank" rel="noopener">LaboBib homepage</a>:</p>
        <blockquote lang="de">Die Zeichnungen in der Laborgerätebibliothek LaboBib unterliegen dem Urheberrecht und dürfen auf gegen Entgelt zugänglichen Medien ausschließlich mit Zustimmung von Dr. Rainer Rensch verwendet werden.</blockquote>
        <p>Unofficial translation: C-Design and the laboratory equipment library LaboBib are freeware and may be used and
        redistributed freely, as long as no fee is charged for providing, using or distributing them. Distribution of the
        program on media available for a fee is only permitted with the consent of the authors. No warranty, legal
        responsibility or liability is accepted. The author adds: the drawings are protected by copyright and may only be
        used on media available for a fee with the consent of Dr. Rainer Rensch.</p>
        <h3>Program</h3>
        <p>The Snapparatus source code is licensed under the MIT licence. It does not apply to the equipment drawings.</p>
        <p><a href="https://github.com/RainiHeini/Snapparatus" target="_blank" rel="noopener">Project on GitHub</a></p>`,
      collapse: 'Collapse / expand', zoomFit: 'Show all', search: 'Search equipment …', all: 'All',
      results: 'Search results', noResults: 'Nothing found.',
      emptyHint: 'Drag or click equipment in the catalogue.<br>Ground glass joints snap together automatically.', jointSize: 'Joint',
      drawing: 'Drawing', parts: n => `${n} ${n === 1 ? 'part' : 'parts'}`, lineWidth: 'Line width',
      thin: 'Thin', normal: 'Normal', thick: 'Thick',
      howto: 'Drag a part: it snaps to a matching joint and aligns itself. Clicking in the catalogue attaches the part to the selected one. Snapped parts stay together – to separate them, select a part and click the red symbol at the joint.',
      pour: 'Pouring', pourHint: 'The vessel is tilted so far that liquid runs out.', pourLength: 'Length', pourWidth: 'Width',
      pourEnd: 'End', hardEnd: 'Sharp', softEnd: 'Fading', auto: 'Auto', autoTip: 'as wide as the liquid at the opening', widthOpening: 'as the opening (it faces down)',
      outline: 'Outline', outlineTip: 'surface and stream with a fine edge line, good for black-and-white prints',
      position: 'Position', rotation: 'Rotation', rotateHint: 'turns the whole setup about this part', mirror: 'Mirror',
      mirrorBtn: 'Horizontal', fill: 'Liquid', level: 'Fill level', color: 'Colour', joints: 'Connections',
      duplicate: 'Duplicate', delete: 'Delete', detach: 'Take out of setup', unlink: 'Separate here',
      socket: 'socket', cone: 'cone', rubber: 'fits any neck', rubberSocket: 'takes a stem',
      barrel: 'takes a plunger', plunger: 'fits a barrel', plainNeck: 'opening without joint', base: 'base', support: 'support', hose: 'olive',
      trash: 'Drag here to remove', trashOver: 'Release to remove',
      copied: 'Image copied – paste it into PowerPoint or Word (Ctrl+V).',
      copyFailed: 'Copying is not possible here – please use “Export → Save as PNG”.',
      saved: 'Saved.', openFailed: 'The file could not be opened.', nothing: 'The drawing is empty.',
      confirmNew: 'Discard the current drawing?', unknownDevices: n => `${n} unknown parts skipped.`,
      fileName: 'setup',
    },
  };
  const t = (k, ...a) => { const v = T[settings.lang][k]; return typeof v === 'function' ? v(...a) : v; };

  // ---------------------------------------------------------------- settings (per browser)
  const store = {
    get(k, d) { try { const v = localStorage.getItem('snapparatus.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('snapparatus.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  // first visit: the first language of the browser's preference list the app speaks, else English
  const firstLang = () => {
    for (const l of navigator.languages || [navigator.language || '']) {
      const k = String(l).slice(0, 2).toLowerCase();
      if (k === 'de' || k === 'en') return k;
    }
    return 'en';
  };
  const settings = Object.assign({ lang: firstLang(),
    swap: false, catalogCollapsed: false, propsCollapsed: false }, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);

  // ---------------------------------------------------------------- drawing state
  // part: {id, dev, x, y, a (degrees), f (mirrored), fill: {on, level, color}}
  // link: {p1, j1, p2, j2} - joint j1 of part p1 is connected to joint j2 of part p2
  // note: {id, type: 'text', x, y (top left), text, size} or {id, type: 'arrow', x1, y1, x2, y2, head}
  // parts and notes share one id counter, so `selected` can name either
  let state = { parts: [], links: [], notes: [], next: 1, lineWidth: 'normal' };
  let selected = null;
  let tool = null;                                      // 'text' | 'arrow' while placing a note
  let editor = null;                                    // inline text editor, while open
  let hoverId = null;                                   // item under the pointer in the parts list
  const undoStack = [], redoStack = [];
  const LINE = { thin: 9, normal: 14, thick: 26 };
  const COLORS = ['#7cc4e8', '#f2c14e', '#e07a5f', '#81b29a', '#b8a1d9', '#f4a6c4', '#9aa5ad', '#ffffff'];
  const TEXT_SIZE = { s: 250, m: 350, l: 500 };          // font size in world units (0.01 mm)
  const FONT = 'Arial, Helvetica, sans-serif';

  const part = id => state.parts.find(p => p.id === id);
  const note = id => state.notes.find(n => n.id === id);
  const dev = p => DEV.get(p.dev);
  const norm = a => ((a % 360) + 360) % 360;
  const rad = a => a * Math.PI / 180;

  function toWorld(p, lx, ly) {
    const fx = p.f ? -lx : lx, c = Math.cos(rad(p.a)), s = Math.sin(rad(p.a));
    return [p.x + c * fx - s * ly, p.y + s * fx + c * ly];
  }
  const dirWorld = (p, d) => norm((p.f ? 180 - d : d) + p.a);
  function jointWorld(p, j) {
    const s = dev(p).snaps[j], [x, y] = toWorld(p, s.x, s.y);
    return { x, y, dir: s.dir == null ? null : dirWorld(p, s.dir), s };
  }
  const SNAPPABLE = new Set(['socket', 'cone', 'base', 'support']);
  const used = (pid, j) => state.links.some(l => (l.p1 === pid && l.j1 === j) || (l.p2 === pid && l.j2 === j));
  function compatible(a, b) {
    if ((a.type === 'socket' && b.type === 'cone') || (a.type === 'cone' && b.type === 'socket')) {
      if (a.system === 'RUBBER' || b.system === 'RUBBER')                 // a rubber cone fits any neck
        return (a.system === 'RUBBER' ? b : a).system !== 'PLUNGER';
      return a.ns === b.ns && a.system === b.system;                     // plungers only fit barrels
    }
    return (a.type === 'base' && b.type === 'support') || (a.type === 'support' && b.type === 'base');
  }
  function component(id, links = state.links) {
    const seen = new Set([id]), todo = [id];
    while (todo.length) {
      const c = todo.pop();
      for (const l of links) {
        const o = l.p1 === c ? l.p2 : l.p2 === c ? l.p1 : null;
        if (o != null && !seen.has(o)) { seen.add(o); todo.push(o); }
      }
    }
    return seen;
  }
  function corners(p) {
    const d = dev(p);
    return [[0, 0], [d.w, 0], [d.w, d.h], [0, d.h]].map(([x, y]) => toWorld(p, x, y));
  }
  function bbox(ids) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) for (const [x, y] of corners(part(id))) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }
  function rotateSet(ids, cx, cy, delta) {
    const c = Math.cos(rad(delta)), s = Math.sin(rad(delta));
    for (const id of ids) {
      const p = part(id), dx = p.x - cx, dy = p.y - cy;
      p.x = cx + c * dx - s * dy; p.y = cy + s * dx + c * dy; p.a = norm(p.a + delta);
    }
  }
  function mirrorSet(ids, cx) {                         // about the vertical line x = cx
    for (const id of ids) { const p = part(id); p.x = 2 * cx - p.x; p.a = norm(-p.a); p.f = !p.f; }
  }
  function insidePart(p, wx, wy) {                     // world point inside the part's rectangle?
    const c = Math.cos(rad(p.a)), s = Math.sin(rad(p.a)), dx = wx - p.x, dy = wy - p.y;
    const lx = (c * dx + s * dy) * (p.f ? -1 : 1), ly = -s * dx + c * dy, d = dev(p);
    return lx >= 0 && lx <= d.w && ly >= 0 && ly <= d.h;
  }
  function centre(id) { const b = bbox([id]); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; }
  const headSize = () => Math.max(110, (LINE[state.lineWidth] || 14) * 9);
  function noteBox(n, dom = true) {
    if (n.type === 'arrow') {
      const h = headSize() / 2;
      return { x0: Math.min(n.x1, n.x2) - h, y0: Math.min(n.y1, n.y2) - h, x1: Math.max(n.x1, n.x2) + h, y1: Math.max(n.y1, n.y2) + h };
    }
    const te = dom && $('notes').querySelector(`.note[data-id="${n.id}"] text`);
    if (te) { const b = te.getBBox(); if (b.width) return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height }; }
    const fs = TEXT_SIZE[n.size] || TEXT_SIZE.m, lines = n.text.split('\n');
    return { x0: n.x, y0: n.y, x1: n.x + fs * 0.55 * Math.max(1, ...lines.map(l => l.length)), y1: n.y + fs * 1.2 * lines.length };
  }
  function drawingBox() {                               // parts and notes together
    const b = bbox(state.parts.map(p => p.id));
    for (const n of state.notes) {
      const c = noteBox(n);
      b.x0 = Math.min(b.x0, c.x0); b.y0 = Math.min(b.y0, c.y0); b.x1 = Math.max(b.x1, c.x1); b.y1 = Math.max(b.y1, c.y1);
    }
    return b;
  }
  const isEmpty = () => !state.parts.length && !state.notes.length;
  function sceneBox(parts, notes) {                     // box of parts and notes that are not on the canvas
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of parts) for (const [x, y] of corners(p)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (const n of notes) { const c = noteBox(n, false); x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1); }
    return { x0, y0, x1, y1 };
  }

  // ---------------------------------------------------------------- undo / autosave
  const snapshot = () => JSON.stringify(state);
  const content = s => { const o = JSON.parse(s); delete o.next; return JSON.stringify(o); };   // the id counter is no change
  let pristine = false;                                 // the start template, not changed yet
  function commit(before) {                             // call after a change; `before` = snapshot taken before it
    if (content(before) === content(snapshot())) return;
    pristine = false;
    undoStack.push(before); if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0; changed();
  }
  function changed() {
    store.set('autosave', state);
    renderAll(); renderProps(); updateButtons();
  }
  const lineKey = k => k === 'slide' ? 'thick' : LINE[k] ? k : 'normal';   // 'slide' was the old name of 'thick'
  function restore(s) {
    pristine = false;
    state = JSON.parse(s); state.notes = state.notes || [];
    if (selected && !part(selected) && !note(selected)) selected = null;
    changed();
  }
  function undo() { if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } }
  function redo() { if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } }
  function updateButtons() {
    document.querySelector('[data-act=undo]').disabled = !undoStack.length;
    document.querySelector('[data-act=redo]').disabled = !redoStack.length;
    $('emptyHint').hidden = !isEmpty();
  }

  // ---------------------------------------------------------------- view (zoom / pan)
  const view = { x: -2000, y: -2000, s: 0.08 };
  const canvas = $('canvas'), world = $('world');
  function applyView() {
    world.setAttribute('transform', `matrix(${view.s},0,0,${view.s},${-view.x * view.s},${-view.y * view.s})`);
    $('zoomLabel').textContent = Math.round(view.s / 0.08 * 100) + ' %';
    if (editor) editor.place();
  }
  function toWorldPt(ev) {
    const r = canvas.getBoundingClientRect();
    return [(ev.clientX - r.left) / view.s + view.x, (ev.clientY - r.top) / view.s + view.y];
  }
  function zoomAt(f, sx, sy) {
    const s = Math.min(1, Math.max(0.01, view.s * f));
    view.x += sx / view.s - sx / s; view.y += sy / view.s - sy / s; view.s = s; applyView();
  }
  function fit() {
    const r = canvas.getBoundingClientRect();
    if (isEmpty()) { view.s = 0.08; view.x = -r.width / 2 / view.s; view.y = -r.height / 2 / view.s; applyView(); return; }
    const b = drawingBox(), m = 600;
    view.s = Math.min(0.25, Math.min(r.width / (b.x1 - b.x0 + 2 * m), r.height / (b.y1 - b.y0 + 2 * m)));
    view.x = (b.x0 + b.x1) / 2 - r.width / 2 / view.s; view.y = (b.y0 + b.y1) / 2 - r.height / 2 / view.s; applyView();
  }

  // ---------------------------------------------------------------- rendering
  const el = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const partEls = new Map();
  const transformOf = p => `translate(${p.x} ${p.y}) rotate(${p.a})${p.f ? ' scale(-1 1)' : ''}`;

  function renderAll() {
    world.style.setProperty('--sw', LINE[state.lineWidth] || 14);
    const layer = $('parts'), ids = new Set(state.parts.map(p => p.id));
    for (const [id, g] of partEls) if (!ids.has(id)) { g.remove(); partEls.delete(id); }
    for (const p of state.parts) {
      let g = partEls.get(p.id);
      if (!g || g.dataset.dev !== p.dev) {
        if (g) g.remove();
        const d = dev(p);
        g = el('g', { class: 'part' }); g.dataset.id = p.id; g.dataset.dev = p.dev;
        g.innerHTML = `<rect class="hit" width="${d.w}" height="${d.h}"/>${d.svg}`;
        partEls.set(p.id, g);
      }
      g.setAttribute('transform', transformOf(p));
      layer.appendChild(g);                             // keeps the z-order of state.parts
    }
    renderFills(); renderNotes(); renderOverlay();
  }
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function noteSvg(n) {                                 // markup of a label or arrow, for the canvas and the export
    if (n.type === 'text') {
      const fs = TEXT_SIZE[n.size] || TEXT_SIZE.m;
      return `<text x="${n.x}" y="${n.y + fs * 0.8}" font-family="${FONT}" font-size="${fs}" fill="#000">` +
        n.text.split('\n').map((l, i) => `<tspan x="${n.x}"${i ? ` dy="${fs * 1.2}"` : ''}>${esc(l) || ' '}</tspan>`).join('') + '</text>';
    }
    const sw = LINE[state.lineWidth] || 14, h = headSize(), L = Math.hypot(n.x2 - n.x1, n.y2 - n.y1) || 1;
    const ux = (n.x2 - n.x1) / L, uy = (n.y2 - n.y1) / L;
    const head = (x, y, dx, dy) => {                    // filled tip at (x, y) pointing along (dx, dy)
      const bx = x - dx * h, by = y - dy * h, w = h * 0.42;
      return `<polygon points="${x},${y} ${bx - dy * w},${by + dx * w} ${bx + dy * w},${by - dx * w}" fill="#000"/>`;
    };
    const end = n.head !== 'none', start = n.head === 'both', cut = Math.min(h * 0.7, L / 2);
    const x1 = n.x1 + (start ? ux * cut : 0), y1 = n.y1 + (start ? uy * cut : 0);
    const x2 = n.x2 - (end ? ux * cut : 0), y2 = n.y2 - (end ? uy * cut : 0);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${sw}" stroke-linecap="round"/>` +
      (end ? head(n.x2, n.y2, ux, uy) : '') + (start ? head(n.x1, n.y1, -ux, -uy) : '');
  }
  function renderNotes() {
    const layer = $('notes'); layer.innerHTML = '';
    for (const n of state.notes) {
      const g = el('g', { class: 'note' }); g.dataset.id = n.id;
      g.innerHTML = noteSvg(n);
      layer.appendChild(g);
      if (n.type === 'text') {                          // the whole text box can be grabbed, not just the glyphs
        const b = g.querySelector('text').getBBox(), p = 60;
        g.insertBefore(el('rect', { class: 'hit', x: b.x - p, y: b.y - p, width: b.width + 2 * p, height: b.height + 2 * p }), g.firstChild);
        if (editor && editor.id === n.id) g.style.visibility = 'hidden';
      } else g.insertBefore(el('line', { class: 'hit', x1: n.x1, y1: n.y1, x2: n.x2, y2: n.y2 }), g.firstChild);
    }
  }
  function renderTransforms(ids) {
    for (const id of ids) { const g = partEls.get(id); if (g) g.setAttribute('transform', transformOf(part(id))); }
    renderFills(); renderOverlay();
  }
  // the liquid of a part lies directly below its own drawing, so a vessel in front also covers what
  // is behind it with its liquid
  const POUR = { on: true, length: 2500, width: null, soft: true };   // width null: as wide as the liquid at the opening
  // the corners of a device's drawing (its path), for finding the glass of a lip
  function outline(d) {
    if (!d._corners) {
      const m = d.svg.match(/ d="([^"]+)"/), n = m ? m[1].match(/-?[\d.]+/g).map(Number) : [];
      d._corners = []; for (let i = 0; i + 1 < n.length; i += 2) d._corners.push([n[i], n[i + 1]]);
    }
    return d._corners;
  }
  function glassTip(p, near, r) {                       // lowest corner of the drawing close to a point (world)
    let best = null;
    for (const [x, y] of outline(dev(p))) {
      const w = toWorld(p, x, y);
      if (Math.hypot(w[0] - near[0], w[1] - near[1]) <= r && w[1] >= near[1] && (!best || w[1] > best[1])) best = w;
    }
    return best;
  }
  // liquid of a part: outline polygons, the rectangle below the level and, when it runs out, the stream.
  // The surface stays horizontal however the vessel is turned. It rises no higher than the lowest
  // place where a neck or the open top begins (the "entry" of an opening); asking for more means the
  // vessel runs over there, and if the rim of that opening lies lower than its entry, it pours out.
  function fillShape(p) {
    const d = dev(p);
    if (!d.fill || !p.fill || !p.fill.on) return null;
    const polys = d.fill.regions.map(r => { const out = []; for (let i = 0; i < r.length; i += 2) out.push(toWorld(p, r[i], r[i + 1])); return out; });
    const all = polys.flat(), ys = all.map(q => q[1]), xs = all.map(q => q[0]);
    const top = Math.min(...ys), bot = Math.max(...ys);
    const want = bot - (p.fill.level / 100) * (bot - top);
    let lvl = want, spill = null, spills = [], x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = bot;
    const unit = (x, y) => { const n = Math.hypot(x, y) || 1; return [x / n, y / n]; };
    // every opening in world coordinates: rim ends (lip = the lower one), and for a neck the corners
    // where it meets the vessel (e1 below the lip, e2 below the upper end of the rim)
    const ops = (d.fill.openings || []).map(o => {
      let a = toWorld(p, o.rim[0], o.rim[1]), b = toWorld(p, o.rim[2], o.rim[3]);
      if (o.entry.length === 1) {                       // a socket's closing line is 1.3 times its width: the glass is inside
        const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], f = 1 / 1.3;
        a = [m[0] + (a[0] - m[0]) * f, m[1] + (a[1] - m[1]) * f]; b = [m[0] + (b[0] - m[0]) * f, m[1] + (b[1] - m[1]) * f];
      }
      const [lip, high] = a[1] >= b[1] ? [a, b] : [b, a];
      const op = { o, lip, high, neck: o.entry.length === 1, entry: Math.max(...o.entry.map(([x, y]) => toWorld(p, x, y)[1])) };
      if (op.neck) {
        const e = toWorld(p, ...o.entry[0]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        op.e = e; op.e1 = [e[0] + lip[0] - mid[0], e[1] + lip[1] - mid[1]]; op.e2 = [e[0] + high[0] - mid[0], e[1] + high[1] - mid[1]];
        op.sill = Math.min(op.e1[1], lip[1]);           // the liquid must rise above the whole lower wall of the neck
      } else op.sill = lip[1];
      return op;
    });
    // it pours through every opening whose lower edge lies below the surface
    const outs = ops.filter(op => want < op.sill - 5);
    if (!outs.length) {                                 // no pouring: the liquid stops where the lowest neck begins
      const cap = Math.max(-Infinity, ...ops.map(op => op.entry));
      if (lvl < cap - 5) lvl = cap;
    } else {
      // the surface stands where the fill level puts it (above an open top: not absurdly high)
      for (const op of outs) if (!op.neck) lvl = Math.max(lvl, op.lip[1] - 0.3 * Math.hypot(op.high[0] - op.lip[0], op.high[1] - op.lip[1]));
      for (const op of outs) if (op.neck) {             // a neck it pours through fills up to the surface too
        const q = [op.e1, op.lip, op.high, op.e2];
        polys.push(q);
        for (const [x, y] of q) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      const pour = Object.assign({}, POUR, p.fill.pour);
      const cx = all.reduce((s, q) => s + q[0], 0) / all.length, cy = all.reduce((s, q) => s + q[1], 0) / all.length;
      spills = outs.map(op => stream(p, op, lvl, pour, cx, cy, unit));
      spill = spills[0];
    }
    return { polys: polys.map(poly => poly.map(q => q.join(',')).join(' ')), x: x0, y: lvl,
      width: x1 - x0, height: y1 - lvl + 1, color: p.fill.color, spill, spills, outline: !!p.fill.outline };
  }
  // the stream out of one opening: it starts between the lowest glass of the opening (lower edge) and
  // the surface where it meets the glass (upper edge, no higher than the opening), then takes on the
  // chosen width. Out of an opening facing down it falls straight; else it bends tightly, then falls.
  function stream(p, op, lvl, pour, cx, cy, unit) {
    const { lip, high } = op, L = pour.length, w = pour.width, rimLen = Math.hypot(high[0] - lip[0], high[1] - lip[1]);
    const rise = lip[1] - high[1], t = rise > 1 ? Math.min(1, (lip[1] - lvl) / rise) : 1;
    const B = [lip[0] + (high[0] - lip[0]) * t, lip[1] + (high[1] - lip[1]) * t];
    const A = glassTip(p, lip, Math.max(300, 0.3 * rimLen)) || lip;
    let dir = unit(-(B[1] - A[1]), B[0] - A[0]);      // across the opening, away from the inside
    if (((A[0] + B[0]) / 2 - cx) * dir[0] + ((A[1] + B[1]) / 2 - cy) * dir[1] < 0) dir = [-dir[0], -dir[1]];
    const base = { on: pour.on, soft: pour.soft };
    if (dir[1] > 0.57) {                                // facing down (more than 35°): falls straight from the part of the
      // opening below the surface, between the glass of the lip (A) and where the surface meets the rim (B)
      const [l, rt] = A[0] <= B[0] ? [A, B] : [B, A], w0 = rt[0] - l[0];
      const top = Math.max(l[1], rt[1]), bottom = top + L, mx = (l[0] + rt[0]) / 2;
      const edge = from => [from, [from[0], bottom]];
      const left = edge(l), right = edge(rt);
      return Object.assign(base, { x1: mx, y1: top, x2: mx, y2: bottom, w0, straight: true,
        d: 'M' + left.map(q => q.join(',')).join(' L') + ' L' + right.reverse().map(q => q.join(',')).join(' L') + ' Z',
        edges: 'M' + left.map(q => q.join(',')).join(' L') + ' M' + right.map(q => q.join(',')).join(' L') });
    }
    if (dir[1] < 0) dir = unit(dir[0] || 1e-6, 0);     // liquid does not climb out: at most level, then down
    const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], w0 = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const wid = w || w0, r = Math.max(w0, wid) * 0.9;  // reach of the bend
    const c = [M[0] + dir[0] * r, M[1] + dir[1] * r], q = [c[0], c[1] + r];   // corner and end of the bend
    const fall = Math.max(L - (q[1] - M[1]), 0);
    const at = s => s <= 1                              // s in 0..2: bend (quadratic), then the straight fall
      ? [[(1 - s) ** 2 * M[0] + 2 * (1 - s) * s * c[0] + s * s * q[0], (1 - s) ** 2 * M[1] + 2 * (1 - s) * s * c[1] + s * s * q[1]],
         unit(2 * (1 - s) * (c[0] - M[0]) + 2 * s * (q[0] - c[0]), 2 * (1 - s) * (c[1] - M[1]) + 2 * s * (q[1] - c[1]))]
      : [[q[0], q[1] + (s - 1) * fall], [0, 1]];
    const t0 = at(0)[1], turn = (B[0] - M[0]) * -t0[1] + (B[1] - M[1]) * t0[0] < 0 ? -1 : 1;   // B lies on this side, all along
    const sideB = [], sideA = [];
    for (let i = 0; i <= 40; i++) {
      const sv = i / 20, [[x, y], [tx, ty]] = at(sv);
      const g = Math.min(1, sv), h = (w0 + (wid - w0) * g * g * (3 - 2 * g)) / 2;   // from the opening to the stream's width
      const nx = -ty * turn, ny = tx * turn;
      const u = Math.min(1, sv / 0.5), m = u * u * (3 - 2 * u);   // from the exact edge at the rim into the stream
      sideB.push([B[0] + (x + nx * h - B[0]) * m, B[1] + (y + ny * h - B[1]) * m]);
      sideA.push([A[0] + (x - nx * h - A[0]) * m, A[1] + (y - ny * h - A[1]) * m]);
    }
    const end = at(2)[0];
    return Object.assign(base, { x1: M[0], y1: M[1], x2: end[0], y2: end[1], w0,
      edges: 'M' + sideB.map(q => q.join(',')).join(' L') + ' M' + sideA.map(q => q.join(',')).join(' L'),
      d: 'M' + sideB.map(q => q.join(',')).join(' L') + ' L' + sideA.reverse().map(q => q.join(',')).join(' L') + ' Z' });
  }
  // markup of a liquid: definitions and what lies below the vessel's drawing (the liquid and the
  // stream, so the glass of neck and lip stays visible over it)
  function shade(hex, k = 0.6) {                        // a darker tone of a colour (the white liquid gets grey)
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v * k));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function liquidSvg(p, id) {
    const f = fillShape(p); if (!f) return null;
    let defs = `<clipPath id="${id}">${f.polys.map(pts => `<polygon points="${pts}"/>`).join('')}</clipPath>`, above = '';
    const dark = shade(f.color), lw = (LINE[state.lineWidth] || 14) * 0.6;
    let below = `<rect class="fill" x="${f.x}" y="${f.y}" width="${f.width}" height="${f.height}" fill="${f.color}" clip-path="url(#${id})"/>`;
    if (f.outline) below += `<line class="fill" x1="${f.x}" y1="${f.y}" x2="${f.x + f.width}" y2="${f.y}" stroke="${dark}" style="stroke-width:${lw}px" clip-path="url(#${id})"/>`;
    const fade = (gid, col, s) => `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}">` +
      `<stop offset="0" stop-color="${col}"/><stop offset="0.55" stop-color="${col}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient>`;
    (f.spills || []).forEach((s, k) => {
      if (!s.on) return;
      if (s.soft) defs += fade(`${id}g${k}`, f.color, s);
      above += `<path class="fill" d="${s.d}" fill="${s.soft ? `url(#${id}g${k})` : f.color}" stroke="none"/>`;
      if (f.outline) {
        if (s.soft) defs += fade(`${id}e${k}`, dark, s);
        above += `<path class="fill" d="${s.edges}" fill="none" stroke="${s.soft ? `url(#${id}e${k})` : dark}" style="stroke-width:${lw}px"/>`;
      }
    });
    return { defs, below: below + above, above: '' };
  }
  function renderFills() {
    const defs = $('defs');
    defs.innerHTML = ''; $('parts').querySelectorAll('.fill').forEach(f => f.remove());
    for (const p of state.parts) {
      const l = liquidSvg(p, 'clip' + p.id); if (!l) continue;
      defs.insertAdjacentHTML('beforeend', l.defs);
      const g = partEls.get(p.id);
      g.insertAdjacentHTML('beforebegin', l.below);
      if (l.above) g.insertAdjacentHTML('afterend', l.above);
    }
  }
  let snapHints = [], activeSnap = null;
  function renderOverlay() {
    const o = $('overlay'); o.innerHTML = '';
    if (selected && part(selected)) {
      o.appendChild(el('polygon', { class: 'sel-box', points: corners(part(selected)).map(q => q.join(',')).join(' ') }));
    }
    if (hoverId != null && hoverId !== selected && (part(hoverId) || note(hoverId))) {
      if (part(hoverId)) o.appendChild(el('polygon', { class: 'hover-box', points: corners(part(hoverId)).map(q => q.join(',')).join(' ') }));
      else { const b = noteBox(note(hoverId)); o.appendChild(el('rect', { class: 'hover-box', x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 })); }
    }
    const r = 7 / view.s, n = selected && note(selected);
    if (n && n.type === 'text' && !editor) {
      const b = noteBox(n), p = 60;
      o.appendChild(el('rect', { class: 'sel-box', x: b.x0 - p, y: b.y0 - p, width: b.x1 - b.x0 + 2 * p, height: b.y1 - b.y0 + 2 * p }));
    } else if (n && n.type === 'arrow' && !(drag && drag.handle)) {
      for (const e of [1, 2]) {                         // grab the ends to change the arrow
        const c = el('circle', { class: 'handle', cx: n['x' + e], cy: n['y' + e], r });
        c.dataset.end = e; o.appendChild(c);
      }
    }
    if (selected && !drag) {                             // a "separate here" button on every connection of the selection
      state.links.forEach((l, i) => {
        if (l.p1 !== selected && l.p2 !== selected) return;
        const w = jointWorld(part(l.p1), l.j1);
        const g = el('g', { class: 'unlink', transform: `translate(${w.x} ${w.y}) scale(${1 / view.s})` });
        g.dataset.link = i;
        g.innerHTML = `<title>${t('unlink')}</title><circle r="12"/>` +           // "unlink" chain icon
          '<g transform="translate(-8.4 -8.4) scale(0.7)"><path d="M9 17H7A5 5 0 0 1 7 7"/>' +
          '<path d="M15 7h2a5 5 0 0 1 4 8"/><path d="M8 12h4"/><path d="m2 2 20 20"/></g>';
        o.appendChild(g);
      });
    }
    for (const g of guides) {
      const m = 400;                                    // a little beyond both things
      o.appendChild(el('line', g.x != null ? { class: 'guide', x1: g.x, y1: g.a - m, x2: g.x, y2: g.b + m }
        : { class: 'guide', x1: g.a - m, y1: g.y, x2: g.b + m, y2: g.y }));
    }
    for (const h of snapHints) {
      o.appendChild(el('circle', { class: 'snap-dot' + (activeSnap && h.pid === activeSnap.tp && h.j === activeSnap.tj ? ' active' : ''),
        cx: h.x, cy: h.y, r }));
    }
  }

  // ---------------------------------------------------------------- dragging and snapping
  // drag: {ids (parts), notes, handle: {id, end, created} for one arrow end, start, nstart, hstart, from: [wx, wy],
  //        before, moved, overTrash}
  let drag = null;

  function findSnap(ids) {
    const moving = new Set(ids), tol = 24 / view.s;
    let best = null; snapHints = [];
    const targets = [];
    for (const p of state.parts) if (!moving.has(p.id)) {
      dev(p).snaps.forEach((s, j) => { if (SNAPPABLE.has(s.type) && !used(p.id, j)) targets.push({ p, j, s, w: jointWorld(p, j) }); });
    }
    const mine = [];
    for (const id of ids) {
      const p = part(id);
      dev(p).snaps.forEach((s, j) => { if (SNAPPABLE.has(s.type) && !used(id, j)) mine.push({ p, j, s, w: jointWorld(p, j) }); });
    }
    for (const t of targets) if (mine.some(m => compatible(m.s, t.s))) snapHints.push({ pid: t.p.id, j: t.j, x: t.w.x, y: t.w.y });
    for (const m of mine) for (const tg of targets) {
      if (!compatible(m.s, tg.s)) continue;
      const dist = Math.hypot(m.w.x - tg.w.x, m.w.y - tg.w.y);
      if (dist < tol && (!best || dist < best.dist)) best = { dist, mp: m.p.id, mj: m.j, mw: m.w, tp: tg.p.id, tj: tg.j, tw: tg.w };
    }
    return best;
  }
  function applySnap(ids, sn) {
    // turn the moving parts about their joint so it points against the target joint, then join them
    const delta = norm(sn.tw.dir + 180 - sn.mw.dir);
    rotateSet(ids, sn.mw.x, sn.mw.y, delta);
    for (const id of ids) { const p = part(id); p.x += sn.tw.x - sn.mw.x; p.y += sn.tw.y - sn.mw.y; }
  }
  // ---------------------------------------------------------------- alignment guides
  // While something is moved freely, it settles gently where it lines up with something else, and
  // a thin line shows with what. Devices line up by their axis (the centre of standing surface,
  // support and upright joints, not of the surrounding box) and by their bottom; labels by their
  // left edge and middle, arrows by their ends. Joints always win; Alt switches the guides off.
  // A feature: {v: position, axis: device axis?, lo, hi: extent across, for drawing the guide}
  let guides = [];
  const upright = d => d != null && (Math.abs(norm(d) - 90) < 3 || Math.abs(norm(d) - 270) < 3);
  function partFeatures(p, xs, ys) {
    const b = bbox([p.id]), size = Math.max(b.x1 - b.x0, b.y1 - b.y0); let axis = false;
    dev(p).snaps.forEach((s, j) => {
      if (!SNAPPABLE.has(s.type)) return;
      const w = jointWorld(p, j);
      if (upright(w.dir)) { xs.push({ v: w.x, axis: true, lo: b.y0, hi: b.y1, size }); axis = true; }
      if (s.type === 'base' || s.type === 'support') ys.push({ v: w.y, axis: true, lo: b.x0, hi: b.x1, size });
    });
    if (!axis) xs.push({ v: (b.x0 + b.x1) / 2, lo: b.y0, hi: b.y1, size });
    ys.push({ v: b.y1, lo: b.x0, hi: b.x1, size });
  }
  function noteFeatures(n, xs, ys, skipEnd = 0) {
    if (n.type === 'arrow') {
      for (const e of [1, 2]) if (e !== skipEnd) {
        xs.push({ v: n['x' + e], lo: n['y' + e], hi: n['y' + e] }); ys.push({ v: n['y' + e], lo: n['x' + e], hi: n['x' + e] });
      }
      return;
    }
    const b = noteBox(n);
    xs.push({ v: b.x0, lo: b.y0, hi: b.y1 }, { v: (b.x0 + b.x1) / 2, lo: b.y0, hi: b.y1 });
    ys.push({ v: b.y0, lo: b.x0, hi: b.x1 }, { v: (b.y0 + b.y1) / 2, lo: b.x0, hi: b.x1 });
  }
  function alignTargets(skipParts, skipNotes, skipEnd = null) {
    const xs = [], ys = [];
    for (const p of state.parts) if (!skipParts.has(p.id)) partFeatures(p, xs, ys);
    for (const n of state.notes) {
      if (skipEnd && n.id === skipEnd.id) noteFeatures(n, xs, ys, skipEnd.end);   // the arrow's other end
      else if (!skipNotes.has(n.id)) noteFeatures(n, xs, ys);
    }
    return { xs, ys };
  }
  // smallest shift that lines a moving feature up with a fixed one; device axes pull a bit further,
  // and a big thing does not line up with a much smaller one (a flask not with its stirring bar,
  // but the bar with the flask)
  function bestShift(mine, theirs, tol) {
    let best = null;
    const big = Math.max(0, ...mine.map(m => m.size || 0));
    for (const m of mine) for (const t of theirs) {
      if (t.size && t.size < 0.25 * big) continue;
      const d = t.v - m.v, lim = tol * (m.axis && t.axis ? 1.6 : 1), score = Math.abs(d) / lim;
      if (score <= 1 && (!best || score < best.score)) best = { d, m, t, score };
    }
    return best;
  }
  function align(ev, mx, my, targets) {               // -> [shift x, shift y], sets the guides
    guides = [];
    if (ev.altKey || !targets) return [0, 0];
    const tol = 7 / view.s, bx = bestShift(mx, targets.xs, tol), by = bestShift(my, targets.ys, tol);
    const sx = bx ? bx.d : 0, sy = by ? by.d : 0;
    if (bx) guides.push({ x: bx.t.v, a: Math.min(bx.t.lo, bx.m.lo + sy), b: Math.max(bx.t.hi, bx.m.hi + sy) });
    if (by) guides.push({ y: by.t.v, a: Math.min(by.t.lo, by.m.lo + sx), b: Math.max(by.t.hi, by.m.hi + sx) });
    return [sx, sy];
  }

  function startDrag(ids, ev, before, notes = [], handle = null) {
    drag = { ids: [...ids], notes: [...notes], handle, start: new Map(), nstart: new Map(), from: toWorldPt(ev), before, moved: false };
    for (const id of drag.ids) { const p = part(id); drag.start.set(id, { x: p.x, y: p.y, a: p.a }); }
    for (const id of drag.notes) drag.nstart.set(id, { ...note(id) });
    if (handle) {
      const n = note(handle.id); drag.hstart = [n['x' + handle.end], n['y' + handle.end]];
      drag.targets = alignTargets(new Set(), new Set([handle.id]), handle);
    } else {                                            // features of what moves (at the start) and of the rest
      const mx = [], my = [];
      for (const id of drag.ids) partFeatures(part(id), mx, my);
      for (const id of drag.notes) noteFeatures(note(id), mx, my);
      drag.mine = { mx, my };
      drag.targets = alignTargets(new Set(drag.ids), new Set(drag.notes));
    }
    canvas.classList.add('dragging');
  }
  function moveHandle(ev, dx, dy) {                     // one end of an arrow; Shift keeps 15° steps
    const { id, end } = drag.handle, n = note(id), o = end === 1 ? [n.x2, n.y2] : [n.x1, n.y1];
    let x = drag.hstart[0] + dx, y = drag.hstart[1] + dy;
    if (ev.shiftKey) {
      const L = Math.hypot(x - o[0], y - o[1]), a = Math.round(Math.atan2(y - o[1], x - o[0]) / (Math.PI / 12)) * Math.PI / 12;
      x = o[0] + L * Math.cos(a); y = o[1] + L * Math.sin(a); guides = [];
    } else {
      const [sx, sy] = align(ev, [{ v: x, lo: y, hi: y }], [{ v: y, lo: x, hi: x }], drag.targets);
      x += sx; y += sy;
    }
    n['x' + end] = x; n['y' + end] = y;
    renderNotes(); renderOverlay();
  }
  function moveDrag(ev) {
    const [wx, wy] = toWorldPt(ev);
    let dx = wx - drag.from[0], dy = wy - drag.from[1];
    if (!drag.moved && Math.hypot(dx, dy) * view.s < 3) return;
    drag.moved = true;                                  // the stacking order stays as the user set it
    if (drag.handle) return moveHandle(ev, dx, dy);
    const shift = (fs, d, e) => fs.map(f => ({ ...f, v: f.v + d, lo: f.lo + e, hi: f.hi + e }));
    const [sx, sy] = align(ev, shift(drag.mine.mx, dx, dy), shift(drag.mine.my, dy, dx), drag.targets);
    dx += sx; dy += sy;
    for (const id of drag.ids) { const p = part(id), s = drag.start.get(id); p.x = s.x + dx; p.y = s.y + dy; p.a = s.a; }
    for (const id of drag.notes) {
      const n = note(id), s = drag.nstart.get(id);
      if (n.type === 'text') { n.x = s.x + dx; n.y = s.y + dy; }
      else { n.x1 = s.x1 + dx; n.y1 = s.y1 + dy; n.x2 = s.x2 + dx; n.y2 = s.y2 + dy; }
    }
    const bin = $('trash'); bin.hidden = false;
    const br = bin.getBoundingClientRect(), pad = 12;
    drag.overTrash = ev.clientX >= br.left - pad && ev.clientX <= br.right + pad && ev.clientY >= br.top - pad && ev.clientY <= br.bottom + pad;
    if (drag.overTrash !== bin.classList.contains('over')) {
      bin.classList.toggle('over', drag.overTrash);
      bin.querySelector('span').textContent = t(drag.overTrash ? 'trashOver' : 'trash');
    }
    activeSnap = drag.overTrash || !drag.ids.length ? null : findSnap(drag.ids);
    if (drag.overTrash) snapHints = [];
    if (activeSnap || drag.overTrash) guides = [];      // a joint beats a guide
    if (activeSnap) applySnap(drag.ids, activeSnap);
    if (drag.notes.length) renderNotes();
    renderTransforms(drag.ids);
  }
  function endDrag() {
    if (!drag) return;
    const bin = $('trash'); bin.hidden = true; bin.classList.remove('over'); bin.querySelector('span').textContent = t('trash');
    if (drag.overTrash) {                               // dropped on the bin: remove what was dragged
      const gone = new Set([...drag.ids, ...drag.notes]);
      state.parts = state.parts.filter(p => !gone.has(p.id));
      state.links = state.links.filter(l => !gone.has(l.p1) && !gone.has(l.p2));
      state.notes = state.notes.filter(n => !gone.has(n.id));
      if (gone.has(selected)) selected = null;
      activeSnap = null;
    }
    if (drag.handle && drag.handle.created) {           // a click instead of a drag: an arrow of default length
      const n = note(drag.handle.id);
      if (Math.hypot(n.x2 - n.x1, n.y2 - n.y1) * view.s < 10) { n.x2 = n.x1 + 1500; n.y2 = n.y1; }
    }
    if (activeSnap) state.links.push({ p1: activeSnap.mp, j1: activeSnap.mj, p2: activeSnap.tp, j2: activeSnap.tj });
    const before = drag.before;
    drag = null; activeSnap = null; snapHints = []; guides = [];
    canvas.classList.remove('dragging');
    commit(before);                                     // no undo step if nothing changed (a new part dropped
    renderAll(); renderProps(); updateButtons();        // on the bin), but the canvas must show it gone
  }

  // the part a setup rests on: the lowest one, as in the lab (ties: the one placed first)
  function bearer(comp) {
    let best = null, low = -Infinity;
    for (const id of [...comp].sort((a, b) => a - b)) {
      const y = Math.max(...corners(part(id)).map(q => q[1]));
      if (y > low + 1) { low = y; best = id; }
    }
    return best;
  }
  // part grabbed on the canvas: whatever is snapped together stays together
  function grabPart(id, ev) {
    selected = id; renderProps();
    startDrag(component(id), ev, snapshot());
  }

  // new part from the catalogue
  function addPart(devId, wx, wy) {
    const d = DEV.get(devId);
    const p = { id: state.next++, dev: devId, x: wx - d.w / 2, y: wy - d.h / 2, a: 0, f: false,
      fill: d.fill ? { on: false, level: 40, color: COLORS[0] } : null };
    state.parts.push(p); selected = p.id;
    return p;
  }

  // attach a new part to the setup containing `target`: the first matching free joint, preferring
  // the selected part itself and joints higher up (where one usually builds on)
  function attachTo(newId, target) {
    const np = part(newId), mine = [];
    dev(np).snaps.forEach((s, j) => { if (SNAPPABLE.has(s.type)) mine.push({ j, s }); });
    const order = [target, ...[...component(target)].filter(id => id !== target)];
    for (const tid of order) {
      const tp = part(tid);
      const free = dev(tp).snaps.map((s, j) => ({ j, s, w: jointWorld(tp, j) }))
        .filter(o => SNAPPABLE.has(o.s.type) && !used(tid, o.j)).sort((a, b) => a.w.y - b.w.y);
      for (const t of free) for (const m of mine) {
        if (!compatible(m.s, t.s)) continue;
        const sn = { mp: newId, mj: m.j, mw: jointWorld(np, m.j), tp: tid, tj: t.j, tw: t.w };
        applySnap([newId], sn);
        state.links.push({ p1: newId, j1: m.j, p2: tid, j2: t.j });
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- canvas events
  let pan = null;
  canvas.addEventListener('pointerdown', ev => {
    canvas.focus();
    if (ev.button === 0) { ev.preventDefault(); window.getSelection().removeAllRanges(); }   // dragging is no text selection
    if (tool && ev.button === 0) {                      // place a label or start an arrow
      ev.preventDefault();
      const [x, y] = toWorldPt(ev), before = snapshot(), id = state.next++;
      if (tool === 'text') {
        const size = lastTextSize, fs = TEXT_SIZE[size];
        state.notes.push({ id, type: 'text', x, y: y - fs * 0.6, text: '', size });
        selected = id; setTool(null); renderAll(); renderProps();
        setTimeout(() => editText(id, before), 0);      // after the click has settled, or it takes the focus away
      } else {
        state.notes.push({ id, type: 'arrow', x1: x, y1: y, x2: x, y2: y, head: 'end' });
        selected = id; setTool(null); renderAll(); renderProps();
        canvas.setPointerCapture(ev.pointerId);
        startDrag([], ev, before, [], { id, end: 2, created: true });
      }
      return;
    }
    const u = ev.target.closest && ev.target.closest('.unlink');
    if (u) { unlink(state.links[+u.dataset.link]); return; }
    const h = ev.target.closest && ev.target.closest('.handle');
    if (h && ev.button === 0) {
      canvas.setPointerCapture(ev.pointerId);
      startDrag([], ev, snapshot(), [], { id: selected, end: +h.dataset.end });
      return;
    }
    const ng = ev.target.closest && ev.target.closest('.note');
    if (ng && ev.button === 0) {
      canvas.setPointerCapture(ev.pointerId);
      selected = +ng.dataset.id; renderOverlay(); renderProps();
      startDrag([], ev, snapshot(), [selected]);
      return;
    }
    const g = ev.target.closest && ev.target.closest('.part');
    if (g && ev.button === 0) {
      canvas.setPointerCapture(ev.pointerId);
      let id = +g.dataset.id;
      const sp = part(selected);                        // a selected part behind others can still be dragged
      if (sp && !component(selected).has(id) && insidePart(sp, ...toWorldPt(ev))) id = selected;
      grabPart(id, ev);
      return;
    }
    if (selected) { selected = null; renderOverlay(); renderProps(); }
    pan = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
    canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove', ev => {
    if (drag && !pending) moveDrag(ev);                 // catalogue drags are followed by the window handler
    else if (pan) { view.x = pan.vx - (ev.clientX - pan.x) / view.s; view.y = pan.vy - (ev.clientY - pan.y) / view.s; applyView(); }
  });
  const stop = () => { if (drag) endDrag(); pan = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('dblclick', ev => {           // the target is the canvas itself (pointer capture)
    const hit = document.elementFromPoint(ev.clientX, ev.clientY), ng = hit && hit.closest('.note');
    if (ng && note(+ng.dataset.id).type === 'text') editText(+ng.dataset.id);
  });
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX - r.left, ev.clientY - r.top);
    renderOverlay();
  }, { passive: false });

  // tools for notes: one label or arrow per click on the toolbar button
  let lastTextSize = 'm';
  function setTool(name) {
    tool = name;
    canvas.classList.toggle('tool-text', name === 'text'); canvas.classList.toggle('tool-arrow', name === 'arrow');
    document.querySelectorAll('[data-act=text], [data-act=arrow]').forEach(b => b.classList.toggle('on', b.dataset.act === name));
    if (name) { if (selected) { selected = null; renderOverlay(); renderProps(); } toast(t(name === 'text' ? 'textMode' : 'arrowMode')); }
  }
  // edit a label in place: a text field over the label; clicking elsewhere or Esc finishes it,
  // an empty label is removed. `before`: snapshot for undo (taken before a new label was added)
  function editText(id, before = snapshot()) {
    const n = note(id); if (!n || editor) return;
    const ta = document.createElement('textarea');
    ta.className = 'inline-edit'; ta.value = n.text; ta.wrap = 'off'; ta.spellcheck = false;
    const grow = () => { ta.style.height = 'auto'; ta.style.width = 'auto'; ta.style.height = ta.scrollHeight + 'px'; ta.style.width = (ta.scrollWidth + 6) + 'px'; };
    editor = {
      id,
      place() {                                         // follows zoom and panning
        const fs = TEXT_SIZE[n.size] || TEXT_SIZE.m;
        ta.style.fontSize = fs * view.s + 'px';
        ta.style.left = (n.x - view.x) * view.s - 1 + 'px';
        ta.style.top = (n.y - 0.146 * fs - view.y) * view.s - 1 + 'px';
        grow();
      },
    };
    const finish = () => {
      if (!editor || editor.id !== id) return;
      editor = null; ta.remove();
      const v = ta.value.replace(/\s+$/, '');
      if (v) n.text = v;
      else { state.notes = state.notes.filter(m => m.id !== id); if (selected === id) selected = null; }
      commit(before); renderAll(); renderProps();
    };
    ta.addEventListener('input', grow);
    ta.addEventListener('blur', finish);
    ta.addEventListener('keydown', e => {
      e.stopPropagation();                              // typing is not a shortcut (Ctrl+Z undoes text here)
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); ta.blur(); }
    });
    $('canvasWrap').appendChild(ta);
    editor.place(); renderNotes(); renderOverlay();
    ta.focus(); ta.select();
  }

  // drag from the catalogue: the part appears as soon as the pointer is over the canvas
  let pending = null;
  function tileDown(devId, ev) {
    ev.preventDefault();
    pending = { devId, x: ev.clientX, y: ev.clientY, created: false, before: snapshot() };
  }
  window.addEventListener('pointermove', ev => {
    if (!pending) return;
    if (!pending.created) {
      const r = canvas.getBoundingClientRect();
      const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!inside) return;
      const [wx, wy] = toWorldPt(ev);
      const p = addPart(pending.devId, wx, wy);
      pending.created = true;
      startDrag([p.id], ev, pending.before);
      renderAll(); renderProps();
    }
    moveDrag(ev);
  });
  window.addEventListener('pointerup', ev => {
    if (!pending) return;
    const p = pending; pending = null;
    if (p.created) { endDrag(); return; }
    if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 4) {   // a click: attach to the selected setup if possible
      const target = part(selected) ? selected : null, r = canvas.getBoundingClientRect();
      const np = addPart(p.devId, view.x + r.width / 2 / view.s, view.y + r.height / 2 / view.s);
      if (target && !attachTo(np.id, target)) {          // no matching joint: put it next to the selection
        const b = bbox([...component(target)]), d = DEV.get(p.devId);
        np.x = b.x1 + 600; np.y = b.y1 - d.h;
      }
      commit(p.before);
    }
  });

  // ---------------------------------------------------------------- actions
  function selectionSetup() { return part(selected) ? [...component(selected)] : []; }
  // the whole setup turns, the selected part is the pivot (it stays where it is)
  function rotateSetup(delta) {
    const ids = selectionSetup(); if (!ids.length) return;
    const before = snapshot(), [cx, cy] = centre(selected);
    rotateSet(ids, cx, cy, delta);
    commit(before);
  }
  function setRotation(target) {
    const p = part(selected); if (p) rotateSetup(norm(target - p.a));
  }
  function mirrorSetup() {
    const ids = selectionSetup(); if (!ids.length) return;
    const before = snapshot(); mirrorSet(ids, centre(selected)[0]); commit(before);
  }
  function deleteSelected() {
    if (!selected) return;
    const before = snapshot(), id = selected;
    state.parts = state.parts.filter(p => p.id !== id);
    state.links = state.links.filter(l => l.p1 !== id && l.p2 !== id);
    state.notes = state.notes.filter(n => n.id !== id);
    selected = null; commit(before);
  }
  function duplicateSelected() {
    const p = part(selected), n = note(selected); if (!p && !n) return;
    const before = snapshot(), q = JSON.parse(JSON.stringify(p || n));
    q.id = state.next++;
    if (p) { q.x += 800; q.y += 400; state.parts.push(q); }
    else if (q.type === 'text') { q.x += 400; q.y += 400; state.notes.push(q); }
    else { q.x1 += 400; q.y1 += 400; q.x2 += 400; q.y2 += 400; state.notes.push(q); }
    selected = q.id; commit(before);
  }
  // separate one connection; the side that does not carry the setup moves off a little along
  // its joint, so the gap is visible
  function unlink(link) {
    const before = snapshot(), all = component(link.p1);
    state.links = state.links.filter(l => l !== link);
    const low = bearer(all);
    const [mover, mj] = component(link.p1).has(low) ? [link.p2, link.j2] : [link.p1, link.j1];
    const w = jointWorld(part(mover), mj), d = rad(w.dir == null ? 270 : w.dir);
    for (const id of component(mover)) { const p = part(id); p.x -= Math.cos(d) * 500; p.y -= Math.sin(d) * 500; }
    commit(before);
  }
  // stacking order: one step = past the next part (or note) that actually overlaps the selected one,
  // so every click changes something visible; notes always lie above the equipment
  function stepTarget(front) {                          // -> [list, index of the selection, index to move to] or null
    const isPart = !!part(selected), list = isPart ? state.parts : note(selected) ? state.notes : null;
    if (!list) return null;
    const box = o => isPart ? bbox([o.id]) : noteBox(o), i = list.findIndex(o => o.id === selected), a = box(list[i]);
    const hits = o => { const b = box(o); return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1; };
    for (let k = front ? i + 1 : i - 1; k >= 0 && k < list.length; k += front ? 1 : -1) if (hits(list[k])) return [list, i, k];
    return null;
  }
  function arrange(front) {
    const st = stepTarget(front); if (!st) return;
    const [list, i, k] = st, before = snapshot(), [o] = list.splice(i, 1);
    list.splice(k, 0, o);                               // in front of / behind list[k] (indices shift by one when removing)
    commit(before);
  }
  function detachSelected() {                           // take the selected part out of its setup
    if (!selected) return;
    const before = snapshot(), id = selected;
    state.links = state.links.filter(l => l.p1 !== id && l.p2 !== id);
    const p = part(id); p.x += 800; commit(before);
  }
  function newDrawing() {
    const clear = () => {
      const before = snapshot();
      state = { parts: [], links: [], notes: [], next: 1, lineWidth: state.lineWidth }; selected = null;
      commit(before); fit();
    };
    if (isEmpty() || pristine) return clear();
    modal(t('newTitle'), `<p>${t('newText')}</p>`, [
      { label: t('cancel') }, { label: t('saveFirst'), cls: 'outline', fn: () => { projectDialog(); return false; } },
      { label: t('discard'), cls: 'danger-fill', fn: clear }]);
  }

  // ---------------------------------------------------------------- templates
  // a template is a saved project; it is always added next to what is already there, never replaces it
  function insertTemplate(tpl) {
    const data = tpl.data, before = snapshot(), ids = new Map();
    const parts = data.parts.filter(p => DEV.has(p.dev)).map(p => {
      const q = JSON.parse(JSON.stringify(p)); ids.set(p.id, q.id = state.next++); return q;
    });
    const notes = (data.notes || []).map(n => ({ ...n, id: state.next++ }));
    const links = (data.links || []).filter(l => ids.has(l.p1) && ids.has(l.p2))
      .map(l => ({ p1: ids.get(l.p1), j1: l.j1, p2: ids.get(l.p2), j2: l.j2 }));
    const tb = sceneBox(parts, notes);
    let dx, dy;
    if (isEmpty()) {                                    // in the middle of the view
      const r = canvas.getBoundingClientRect();
      dx = view.x + r.width / 2 / view.s - (tb.x0 + tb.x1) / 2; dy = view.y + r.height / 2 / view.s - (tb.y0 + tb.y1) / 2;
    } else {                                            // to the right of the drawing, standing on the same line
      const b = drawingBox(); dx = b.x1 + 1000 - tb.x0; dy = b.y1 - tb.y1;
    }
    for (const p of parts) { p.x += dx; p.y += dy; }
    for (const n of notes) {
      if (n.type === 'text') { n.x += dx; n.y += dy; } else { n.x1 += dx; n.y1 += dy; n.x2 += dx; n.y2 += dy; }
    }
    state.parts.push(...parts); state.notes.push(...notes); state.links.push(...links);
    selected = parts.length ? parts[0].id : notes.length ? notes[0].id : null;
    commit(before); fit();
  }
  function previewSvg(data) {                           // small picture of a template for the dialog
    const parts = data.parts.filter(p => DEV.has(p.dev)), notes = data.notes || [], b = sceneBox(parts, notes);
    const m = 0.04 * Math.max(b.x1 - b.x0, b.y1 - b.y0), clipId = 'tplc' + (++previewCount) + '_';
    let defs = '', body = '';
    for (const p of parts) {
      const l = liquidSvg(p, clipId + p.id);
      if (l) { defs += l.defs; body += l.below; }
      body += `<g transform="${transformOf(p)}">${dev(p).svg.replace('<path ', '<path vector-effect="non-scaling-stroke" style="stroke-width:1px" ')}</g>`;
      if (l) body += l.above;
    }
    body += notes.map(noteSvg).join('');
    return `<svg viewBox="${b.x0 - m} ${b.y0 - m} ${b.x1 - b.x0 + 2 * m} ${b.y1 - b.y0 + 2 * m}" preserveAspectRatio="xMidYMid meet">` +
      `<defs>${defs}</defs>${body}</svg>`;
  }
  let previewCount = 0;
  function templatesDialog() {
    if (!TEMPLATES.length) return modal(t('templates'), `<p>${t('noTemplates')}</p>`);
    modal(t('templates'), `<p class="note">${t('templatesHint')}</p><div class="tpl-grid">` +
      TEMPLATES.map((tp, i) => `<button class="tpl" data-tpl="${i}">${previewSvg(tp.data)}<span>${esc(tp[settings.lang] || tp.de)}</span></button>`).join('') +
      '</div>');
    $('modalBody').querySelectorAll('[data-tpl]').forEach(b => { b.onclick = () => { closeModal(); insertTemplate(TEMPLATES[+b.dataset.tpl]); }; });
  }

  // ---------------------------------------------------------------- dialogs
  // modal(title, html, [{label, cls, fn}]): a button closes the dialog unless its fn returns false
  function modal(title, html, actions = []) {
    closeMenus();
    $('modalTitle').textContent = title; $('modalBody').innerHTML = html;
    const box = $('modalActions'); box.innerHTML = '';
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || 'outline'); b.textContent = a.label;
      b.onclick = () => { if (!a.fn || a.fn() !== false) closeModal(); };
      box.appendChild(b);
    });
    $('modal').hidden = false;
    (box.lastElementChild || $('modal').querySelector('.close')).focus();
  }
  function closeModal() { $('modal').hidden = true; }
  $('modal').addEventListener('click', ev => { if (ev.target.id === 'modal') closeModal(); });

  // ---------------------------------------------------------------- export
  function exportSVG(withMeta = true) {
    if (isEmpty()) return null;
    const b = drawingBox(), m = 300;
    const x0 = b.x0 - m, y0 = b.y0 - m, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m;
    let defs = '';
    const parts = state.parts.map(p => {
      const l = liquidSvg(p, 'clip' + p.id); if (l) defs += l.defs;
      const strip = h => (h || '').replace(/ class="fill"/, '');
      return strip(l && l.below) + `<g transform="${transformOf(p)}">${dev(p).svg}</g>` + strip(l && l.above);
    }).join('') + state.notes.map(noteSvg).join('');
    const meta = withMeta ? `<metadata id="snapparatus">${JSON.stringify(projectData()).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</metadata>` : '';
    const sw = LINE[state.lineWidth] || 14;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" ` +
      `width="${(w / 100).toFixed(1)}mm" height="${(h / 100).toFixed(1)}mm">${meta}<defs>${defs}</defs>` +
      `<style>path{stroke-width:${sw}px}</style>${parts}</svg>`;
  }
  function svgToPng(svg, maxPx = 4000) {
    return new Promise((resolve, reject) => {
      const vb = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
      const k = Math.min(0.12, maxPx / Math.max(vb[2], vb[3]));     // ~12 px per drawing mm
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(vb[2] * k); c.height = Math.round(vb[3] * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? resolve(b) : reject(new Error('png')), 'image/png');
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function copyImage() {
    const svg = exportSVG(false); if (!svg) return toast(t('nothing'));
    try {
      const png = await svgToPng(svg, 3000);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      toast(t('copied'));
    } catch (e) { toast(t('copyFailed')); }
  }
  async function exportPng() {
    const svg = exportSVG(false); if (!svg) return toast(t('nothing'));
    download(await svgToPng(svg), t('fileName') + '.png');
  }
  function exportSvgFile() {
    const svg = exportSVG(true); if (!svg) return toast(t('nothing'));
    download(new Blob([svg], { type: 'image/svg+xml' }), t('fileName') + '.svg');
  }

  // ---------------------------------------------------------------- project files
  const projectData = () => ({ format: 'snapparatus', version: 1, lineWidth: state.lineWidth,
    parts: state.parts.map(p => ({ id: p.id, dev: p.dev, x: Math.round(p.x), y: Math.round(p.y), a: +p.a.toFixed(2), f: p.f, fill: p.fill })),
    links: state.links,
    notes: state.notes.map(n => n.type === 'text' ? { id: n.id, type: 'text', x: Math.round(n.x), y: Math.round(n.y), text: n.text, size: n.size }
      : { id: n.id, type: 'arrow', x1: Math.round(n.x1), y1: Math.round(n.y1), x2: Math.round(n.x2), y2: Math.round(n.y2), head: n.head }) });
  let projectName = null;
  function projectDialog(focusOpen = false) {
    const empty = isEmpty(), name = projectName || t('fileName');
    modal(t('project'), `<div class="proj">
      <section><h3>${t('save')}</h3><p>${t('saveText')}</p>
        <div class="name"><input id="projName" value="${name.replace(/"/g, '&quot;')}" ${empty ? 'disabled' : ''}><span>.snapparatus.json</span></div>
        ${empty ? `<p class="note">${t('emptyNoSave')}</p>` : `<button class="btn primary" id="dlBtn">${t('download')}</button>`}</section>
      <section><h3>${t('open')}</h3>
        <div class="drop" id="dropZone">${t('openText')}<button class="btn outline" id="pickBtn">${t('pick')}</button>
          <span class="hint">${t('openHint')}</span></div></section>
      <p class="note">${t('autosave')}</p></div>`);
    if (!empty) {
      $('dlBtn').onclick = () => {
        projectName = ($('projName').value.trim() || t('fileName')).replace(/\.snapparatus\.json$|\.json$/i, '');
        download(new Blob([JSON.stringify(projectData(), null, 1)], { type: 'application/json' }), projectName + '.snapparatus.json');
        closeModal(); toast(t('saved'));
      };
      $('projName').addEventListener('keydown', e => { if (e.key === 'Enter') $('dlBtn').click(); });
    }
    $('pickBtn').onclick = () => $('fileInput').click();
    const dz = $('dropZone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]); });
    (focusOpen || empty ? $('pickBtn') : $('dlBtn')).focus();
  }
  async function openFile(f) {
    let data;
    try {
      const text = await f.text();
      if (text.trimStart().startsWith('<')) {             // exported SVG with the project embedded
        const m = text.match(/<metadata id="snapparatus">([\s\S]*?)<\/metadata>/);
        data = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
      } else data = JSON.parse(text);
      if (!data || data.format !== 'snapparatus') throw new Error('format');
    } catch (e) { closeModal(); return toast(t('openFailed')); }
    const go = () => { loadProject(data); projectName = f.name.replace(/\.snapparatus\.json$|\.json$|\.svg$/i, ''); };
    if (isEmpty() || pristine) { closeModal(); return go(); }
    modal(t('replaceTitle'), `<p>${t('replaceText')}</p>`, [{ label: t('cancel') }, { label: t('replace'), cls: 'primary', fn: go }]);
  }
  function loadProject(data) {
    if (!data || data.format !== 'snapparatus' || !Array.isArray(data.parts)) throw new Error('format');
    const before = snapshot(), known = data.parts.filter(p => DEV.has(p.dev)), ids = new Set(known.map(p => p.id));
    const notes = (data.notes || []).filter(n => (n.type === 'text' && typeof n.text === 'string') || n.type === 'arrow');
    state = { parts: known, links: (data.links || []).filter(l => ids.has(l.p1) && ids.has(l.p2)), notes,
      next: Math.max(0, ...known.map(p => p.id), ...notes.map(n => n.id)) + 1, lineWidth: lineKey(data.lineWidth) };
    selected = null; commit(before); fit();
    if (known.length < data.parts.length) toast(t('unknownDevices', data.parts.length - known.length));
  }
  $('fileInput').addEventListener('change', ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (f) openFile(f);
  });

  // ---------------------------------------------------------------- catalogue
  const REP = { flasks: 'Rundkolben NS 29 250', beakers: 'normale Form 250', condensers: 'Dimroth', distillation: 'Destillationsaufsätze NS29',
    adapters: 'Reduzierstücke 29-14', funnels: 'Trichter NS 29', measuring: 'Messzylinder 100', bottles: 'Steilbrustflaschen (Enghals) 250',
    heating: 'Magnetrührer', stand: 'Laborhebebühne ausgefahren, Kurbel links', drying: 'Trockenrohre NS 29', misc: 'Bunsenbrenner mit Flamme' };
  let curCat = DATA.categories[0].key, curSub = null, curNS = null;
  const NO_SUBGROUPS = new Set(['distillation']);         // too many small groups to help there; joints filter only
  const jointSizes = d => [...new Set(d.snaps.filter(s => s.ns && s.system === 'NS').map(s => s.ns))];
  const thumb = d => `<svg viewBox="${-d.w * 0.04} ${-d.h * 0.04} ${d.w * 1.08} ${d.h * 1.08}" preserveAspectRatio="xMidYMid meet">` +
    d.svg.replace('<path ', '<path vector-effect="non-scaling-stroke" style="stroke-width:1.1px" ') + '</svg>';
  function subKey(d) {                                  // coarse group within a category, from the catalogue path
    const head = d.path[0] || d.name, words = head.split(' '), out = [];
    for (const w of words) { if (/^\d|^NS$|mL$|Liter$/.test(w) || /^\(/.test(w)) break; out.push(w); }
    return out.join(' ') || head;
  }
  function renderRail() {
    const rail = $('rail'); rail.innerHTML = '';
    for (const c of DATA.categories) {
      const devs = DATA.devices.filter(d => d.category === c.key);
      const rep = devs.find(d => d.name.includes(REP[c.key])) || devs[0];
      const b = document.createElement('button');
      b.className = c.key === curCat ? 'on' : ''; b.title = c[settings.lang];
      b.innerHTML = thumb(rep) + `<span>${c[settings.lang]}</span>`;
      b.onclick = () => {
        curCat = c.key; curSub = null; curNS = null; $('search').value = '';
        if (settings.catalogCollapsed) { settings.catalogCollapsed = false; saveSettings(); applyLayout(); }
        renderRail(); renderTiles();
      };
      rail.appendChild(b);
    }
  }
  function renderTiles() {
    const q = $('search').value.trim().toLowerCase();
    let list, title;
    if (q) {
      const words = q.split(/\s+/);
      list = DATA.devices.filter(d => { const s = (d.name + ' ' + d.path.join(' ')).toLowerCase(); return words.every(w => s.includes(w)); });
      title = t('results'); $('subcats').innerHTML = '';
    } else {
      const cat = DATA.categories.find(c => c.key === curCat);
      list = DATA.devices.filter(d => d.category === curCat); title = cat[settings.lang];
      const subs = [...new Set(list.map(subKey))];
      const box = $('subcats'); box.innerHTML = '';
      if (subs.length > 1 && subs.length <= 14 && !NO_SUBGROUPS.has(curCat)) {
        for (const s of [null, ...subs]) {
          const b = document.createElement('button');
          b.textContent = s === null ? t('all') : s; b.className = s === curSub ? 'on' : ''; b.title = b.textContent;
          b.onclick = () => { curSub = s; renderTiles(); };
          box.appendChild(b);
        }
        if (curSub) list = list.filter(d => subKey(d) === curSub);
      }
    }
    // joint size filter: only sizes that occur in the current list
    const sizes = [...new Set(list.flatMap(jointSizes))].sort((a, b) => a - b), nsBox = $('nsFilter');
    nsBox.innerHTML = '';
    if (curNS && !sizes.includes(curNS)) curNS = null;
    if (sizes.length > 1) {
      nsBox.insertAdjacentHTML('beforeend', `<span>${t('jointSize')}</span>`);
      for (const n of [null, ...sizes]) {
        const b = document.createElement('button');
        b.textContent = n === null ? t('all') : 'NS ' + n; b.className = n === curNS ? 'on' : '';
        b.onclick = () => { curNS = n; renderTiles(); };
        nsBox.appendChild(b);
      }
    }
    if (curNS) list = list.filter(d => jointSizes(d).includes(curNS));
    $('catTitle').textContent = title;
    const tiles = $('tiles'); tiles.innerHTML = '';
    if (!list.length) { tiles.innerHTML = `<div class="none">${t('noResults')}</div>`; return; }
    // words all shown names start with ("Krümmer (Bogenstücke) ...") are left off the tiles
    let common = list.length >= 3 ? list[0].name.split(' ') : [];
    for (const d of list) { const w = d.name.split(' '); let i = 0; while (i < common.length && w[i] === common[i]) i++; common = common.slice(0, i); }
    while (common.length && /^[a-zäöü]/.test(common[common.length - 1])) common.pop();   // keep "mit 2 Kernen" readable
    for (const d of list.slice(0, 300)) {
      const div = document.createElement('div');
      const label = d.name.split(' ').slice(common.length).join(' ') || d.name;
      div.className = 'tile'; div.title = d.name;
      div.innerHTML = thumb(d) + `<span>${label}</span>`;
      div.addEventListener('pointerdown', ev => tileDown(d.id, ev));
      tiles.appendChild(div);
    }
  }
  $('search').addEventListener('input', renderTiles);

  // ---------------------------------------------------------------- properties panel
  const actionsGrp = withDetach => `<div class="grp"><div class="t">${t('arrange')}</div><div class="row2" style="margin:0;flex-wrap:wrap">
      <button class="btn outline" data-act="toFront" title="${t('frontTip')}" ${stepTarget(true) ? '' : 'disabled'}><svg viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2" fill="currentColor"/><path d="M15 5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1"/></svg>${t('toFront')}</button>
      <button class="btn outline" data-act="toBack" title="${t('backTip')}" ${stepTarget(false) ? '' : 'disabled'}><svg viewBox="0 0 24 24"><rect x="3" y="3" width="12" height="12" rx="2" fill="currentColor"/><path d="M19 9h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-1"/></svg>${t('toBack')}</button>
    </div></div>
    <div class="grp"><div class="row2" style="margin:0;flex-wrap:wrap">
      <button class="btn outline" data-act="duplicate"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V4h12"/></svg>${t('duplicate')}</button>
      ${withDetach ? `<button class="btn outline" data-act="detach">${t('detach')}</button>` : ''}
      <button class="btn outline danger" data-act="delete"><svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg>${t('delete')}</button>
    </div></div>`;
  const seg = (attr, cur, opts) => `<div class="seg">${opts.map(([k, label]) =>
    `<button data-${attr}="${k}" class="${cur === k ? 'on' : ''}">${label}</button>`).join('')}</div>`;
  // everything in the drawing, front first; snapped setups as one card. Picking a row selects it,
  // which is the way to reach parts hidden behind others
  const ICON_TEXT = '<svg viewBox="0 0 24 24"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>';
  const ICON_ARROW = '<svg viewBox="0 0 24 24"><path d="M5 19 19 5"/><path d="M9 5h10v10"/></svg>';
  const ICON_LINK = '<svg viewBox="0 0 24 24"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8 12h8"/></svg>';
  function partList() {
    if (isEmpty()) return '';
    const z = new Map(state.parts.map((p, i) => [p.id, i])), seen = new Set();
    const row = (id, icon, label, cls = '') => `<button class="pl-row" data-pick="${id}" title="${esc(label)}"><span class="pl-ico ${cls}">${icon}</span><span class="pl-name">${esc(label)}</span></button>`;
    const partRow = p => row(p.id, thumb(dev(p)), dev(p).name);
    let html = '';
    for (const p of [...state.parts].reverse()) {
      if (seen.has(p.id)) continue;
      const ids = [...component(p.id)].sort((a, b) => z.get(b) - z.get(a)); ids.forEach(id => seen.add(id));
      html += ids.length === 1 ? partRow(p)
        : `<div class="pl-group"><div class="pl-head">${ICON_LINK}${t('setup')} · ${t('parts', ids.length)}</div>${ids.map(id => partRow(part(id))).join('')}</div>`;
    }
    if (state.notes.length) {
      html += `<div class="pl-group"><div class="pl-head">${t('notesGroup')}</div>` + [...state.notes].reverse().map(n =>
        n.type === 'text' ? row(n.id, ICON_TEXT, n.text.split('\n').join(' ') || t('label'), 'icon')
          : row(n.id, ICON_ARROW, t('arrowTitle'), 'icon')).join('') + '</div>';
    }
    return `<div class="grp"><div class="t">${t('inDrawing')}</div><div class="plist">${html}</div><div class="hint" style="margin-top:8px">${t('listHint')}</div></div>`;
  }
  function jointLabel(s) {
    if (s.system === 'RUBBER') return t(s.type === 'socket' ? 'rubberSocket' : 'rubber');
    if (s.system === 'PLUNGER') return t(s.type === 'socket' ? 'barrel' : 'plunger');
    if (s.type === 'socket' && !s.ns && s.system === 'NS') return t('plainNeck');
    return t(s.type);
  }
  function pourGrp(p) {                                // shown only while the tilted vessel runs out
    const f = fillShape(p); if (!f || !f.spill) return '';
    const o = Object.assign({}, POUR, p.fill.pour);
    return `<div class="grp"><div class="t">${t('pour')} <input type="checkbox" class="toggle" id="pourOn" ${o.on ? 'checked' : ''}></div>
      <div class="hint" style="margin-bottom:6px">${t('pourHint')}</div>
      <div class="row2"><label>${t('pourLength')}</label><input type="range" id="pourLen" min="400" max="8000" step="100" value="${o.length}"></div>
      ${f.spills.every(s => s.straight) ? `<div class="row2"><label>${t('pourWidth')}</label><span class="hint">${t('widthOpening')}</span></div>`
        : `<div class="row2"><label>${t('pourWidth')}</label><input type="range" id="pourWidth" min="30" max="600" step="10" value="${Math.round(o.width || f.spill.w0)}">
        <button class="btn outline small${o.width ? '' : ' on'}" data-act="pourAuto" title="${t('autoTip')}">${t('auto')}</button></div>`}
      <div class="row2"><label>${t('pourEnd')}</label>${seg('pourend', o.soft ? 'soft' : 'hard', [['hard', t('hardEnd')], ['soft', t('softEnd')]])}</div></div>`;
  }
  function renderProps() {
    const body = $('propsBody'), p = selected && part(selected), n = selected && note(selected);
    if (n) {
      $('propsTitle').textContent = t(n.type === 'text' ? 'label' : 'arrowTitle');
      body.innerHTML = (n.type === 'text'
        ? `<div class="grp"><div class="t">${t('size')}</div>${seg('size', n.size, [['s', t('small')], ['m', t('medium')], ['l', t('large')]])}
             <div class="row2" style="margin-top:10px"><button class="btn outline" data-act="editText">${t('editText')}</button></div>
             <div class="hint">${t('textHint')}</div></div>`
        : `<div class="grp"><div class="t">${t('head')}</div>${seg('head', n.head, [['end', t('headEnd')], ['both', t('headBoth')], ['none', t('headNone')]])}
             <div class="hint" style="margin-top:10px">${t('arrowHint')}</div></div>`) + actionsGrp(false);
      return;
    }
    if (!p) {
      $('propsTitle').textContent = t('drawing');
      body.innerHTML = `<div class="sub">${t('parts', state.parts.length)}</div>
        <div class="grp"><div class="t">${t('lineWidth')}</div><div class="seg" id="lwSeg">
          ${['thin', 'normal', 'thick'].map(k => `<button data-lw="${k}" class="${state.lineWidth === k ? 'on' : ''}">${t(k)}</button>`).join('')}</div></div>
        ${partList()}
        <div class="grp"><div class="hint">${t('howto')}</div></div>`;
    } else {
      const d = dev(p), cat = DATA.categories.find(c => c.key === d.category);
      const joints = d.snaps.filter(s => SNAPPABLE.has(s.type) || s.type === 'hose')
        .map(s => `<span>${jointLabel(s)}${s.ns ? ' NS ' + s.ns : ''}</span>`).join('');
      $('propsTitle').textContent = d.name;
      body.innerHTML = `<div class="sub">${cat[settings.lang]}</div>
        ${joints ? `<div class="grp"><div class="t">${t('joints')}</div><div class="joints">${joints}</div></div>` : ''}
        <div class="grp"><div class="t">${t('position')}</div>
          <div class="row2"><label>${t('rotation')}</label><input type="number" id="rotIn" step="15" value="${Math.round(norm(p.a))}">°
            <button class="btn ico outline" data-act="rotL" title="-15°"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>
            <button class="btn ico outline" data-act="rotR" title="+15°"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg></button></div>
          <div class="hint">${t('rotateHint')}</div>
          <div class="row2"><label>${t('mirror')}</label><button class="btn outline" data-act="mirror"><svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M8 7 3 12l5 5V7z"/><path d="m16 7 5 5-5 5V7z"/></svg>${t('mirrorBtn')}</button></div>
        </div>
        ${d.fill && p.fill ? `<div class="grp"><div class="t">${t('fill')} <input type="checkbox" class="toggle" id="fillOn" ${p.fill.on ? 'checked' : ''}></div>
          <div class="row2"><label>${t('level')}</label><input type="range" id="fillLevel" min="0" max="100" value="${p.fill.level}"><span id="fillVal">${p.fill.level} %</span></div>
          <div class="row2"><label>${t('outline')}</label><input type="checkbox" class="toggle" id="fillOutline" title="${t('outlineTip')}" ${p.fill.outline ? 'checked' : ''}></div>
          <div class="row2"><label>${t('color')}</label><div class="swatches">${COLORS.map(c => `<button data-color="${c}" class="${p.fill.color === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div></div>
        </div>` : ''}
        ${pourGrp(p)}
        ${actionsGrp(state.links.some(l => l.p1 === p.id || l.p2 === p.id))}`;
      const rotIn = $('rotIn');
      rotIn.addEventListener('change', () => setRotation(+rotIn.value || 0));
      if ($('fillOn')) {
        $('fillOn').addEventListener('change', e => { const b = snapshot(); p.fill.on = e.target.checked; commit(b); });
        let liveBefore = null;
        $('fillLevel').addEventListener('input', e => {
          liveBefore = liveBefore || snapshot();
          p.fill.level = +e.target.value; if (!p.fill.on) { p.fill.on = true; $('fillOn').checked = true; }
          $('fillVal').textContent = p.fill.level + ' %'; renderFills();
        });
        $('fillLevel').addEventListener('change', () => { if (liveBefore) { const b = liveBefore; liveBefore = null; commit(b); renderProps(); } });
      }
      if ($('fillOutline')) $('fillOutline').addEventListener('change', e => { const b = snapshot(); p.fill.outline = e.target.checked; commit(b); });
      if ($('pourOn')) {                                  // stream: live while dragging the sliders, one undo step
        const set = (k, v) => { p.fill.pour = Object.assign({}, POUR, p.fill.pour, { [k]: v }); };
        $('pourOn').addEventListener('change', e => { const b = snapshot(); set('on', e.target.checked); commit(b); });
        for (const [id, k] of [['pourLen', 'length'], ['pourWidth', 'width']].filter(([id]) => $(id))) {
          let liveBefore = null;
          $(id).addEventListener('input', e => { liveBefore = liveBefore || snapshot(); set(k, +e.target.value); renderFills(); });
          $(id).addEventListener('change', () => { if (liveBefore) { const b = liveBefore; liveBefore = null; commit(b); } });
        }
      }
    }
  }
  $('propsBody').addEventListener('pointerover', ev => {
    const r = ev.target.closest('[data-pick]'), id = r ? +r.dataset.pick : null;
    if (id !== hoverId) { hoverId = id; renderOverlay(); }
  });
  $('propsBody').addEventListener('pointerleave', () => { if (hoverId != null) { hoverId = null; renderOverlay(); } });
  $('propsBody').addEventListener('click', ev => {
    const pick = ev.target.closest('[data-pick]');
    if (pick) { selected = +pick.dataset.pick; hoverId = null; renderOverlay(); renderProps(); return; }
    const lw = ev.target.closest('[data-lw]');
    if (lw) { const b = snapshot(); state.lineWidth = lw.dataset.lw; commit(b); return; }
    const sz = ev.target.closest('[data-size]');
    if (sz) { const b = snapshot(); note(selected).size = lastTextSize = sz.dataset.size; commit(b); return; }
    const pe = ev.target.closest('[data-pourend]');
    if (pe) { const p = part(selected), b = snapshot(); p.fill.pour = Object.assign({}, POUR, p.fill.pour, { soft: pe.dataset.pourend === 'soft' }); commit(b); return; }
    const hd = ev.target.closest('[data-head]');
    if (hd) { const b = snapshot(); note(selected).head = hd.dataset.head; commit(b); return; }
    const c = ev.target.closest('[data-color]');
    if (c) { const p = part(selected), b = snapshot(); p.fill.color = c.dataset.color; p.fill.on = true; commit(b); }
  });

  // ---------------------------------------------------------------- layout (panel positions)
  // catalogue left and properties right, or the other way round
  function applyLayout() {
    const [catPos, propsPos] = settings.swap ? ['right', 'left'] : ['left', 'right'];
    const slot = { left: $('slotLeft'), right: $('slotRight') }, cat = $('catalog'), props = $('props');
    slot[catPos].appendChild(cat); slot[propsPos].appendChild(props);
    cat.className = `panel pos-${catPos}${settings.catalogCollapsed ? ' collapsed' : ''}`;
    props.className = `panel pos-${propsPos}${settings.propsCollapsed ? ' collapsed' : ''}`;
    $('swapSides').checked = settings.swap;
  }
  $('swapSides').addEventListener('change', e => { settings.swap = e.target.checked; saveSettings(); applyLayout(); });

  // about: credits and licences
  function showAbout() {
    closeMenus();
    $('aboutBody').innerHTML = t('aboutHtml');
    $('aboutDialog').hidden = false;
    $('aboutDialog').querySelector('.close').focus();
  }
  function hideAbout() { $('aboutDialog').hidden = true; }
  $('aboutDialog').addEventListener('click', ev => { if (ev.target.id === 'aboutDialog') hideAbout(); });

  // ---------------------------------------------------------------- language
  function applyLang() {
    document.documentElement.lang = settings.lang;
    document.querySelectorAll('[data-t]').forEach(e => { e.innerHTML = t(e.dataset.t); });
    document.querySelectorAll('[data-tt]').forEach(e => { e.title = t(e.dataset.tt); });
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === settings.lang));
    $('search').placeholder = t('search');
    renderRail(); renderTiles(); renderProps(); applyLayout();
  }
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
    settings.lang = b.dataset.lang; saveSettings(); applyLang();
  }));

  // ---------------------------------------------------------------- buttons, menus, keys
  let toastTimer = null;
  function toast(msg) {
    const e = $('toast'); e.textContent = msg; e.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { e.hidden = true; }, 3500);
  }
  function closeMenus() { $('exportMenu').hidden = true; $('settingsMenu').hidden = true; }
  const ACTIONS = {
    new: newDrawing, project: () => projectDialog(), closeModal, undo, redo,
    exportmenu: () => { const m = $('exportMenu'), h = m.hidden; closeMenus(); m.hidden = !h; },
    settings: () => { const m = $('settingsMenu'), h = m.hidden; closeMenus(); m.hidden = !h; },
    exportSvg: () => { closeMenus(); exportSvgFile(); }, exportPng: () => { closeMenus(); exportPng(); },
    copy: copyImage, zoomIn: () => { const r = canvas.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); renderOverlay(); },
    zoomOut: () => { const r = canvas.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); renderOverlay(); },
    zoomFit: () => { fit(); renderOverlay(); },
    collapseCatalog: () => { settings.catalogCollapsed = !settings.catalogCollapsed; saveSettings(); applyLayout(); },
    collapseProps: () => { settings.propsCollapsed = !settings.propsCollapsed; saveSettings(); applyLayout(); },
    rotL: () => rotateSetup(-15), rotR: () => rotateSetup(15), mirror: mirrorSetup,
    duplicate: duplicateSelected, delete: deleteSelected, detach: detachSelected,
    toFront: () => arrange(true), toBack: () => arrange(false),
    about: showAbout, closeAbout: hideAbout,
    text: () => setTool(tool === 'text' ? null : 'text'), arrow: () => setTool(tool === 'arrow' ? null : 'arrow'),
    editText: () => editText(selected), templates: templatesDialog,
    pourAuto: () => { const p = part(selected); if (!p) return; const b = snapshot(); p.fill.pour = Object.assign({}, POUR, p.fill.pour, { width: null }); commit(b); },
  };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (b && ACTIONS[b.dataset.act]) { ACTIONS[b.dataset.act](); return; }
    if (!ev.target.closest('.menu-wrap')) closeMenus();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && !$('modal').hidden) { closeModal(); return; }     // also from inside a text field
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
    if (mod && k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); }
    else if (mod && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); redo(); }
    else if (mod && k === 's') { ev.preventDefault(); projectDialog(); }
    else if (mod && k === 'o') { ev.preventDefault(); projectDialog(true); }
    else if (typing) return;
    else if (mod && k === 'c') { ev.preventDefault(); copyImage(); }
    else if (k === 'delete' || k === 'backspace') { ev.preventDefault(); deleteSelected(); }
    else if (k === 'r') rotateSetup(ev.shiftKey ? -15 : 15);
    else if (k === 'm') mirrorSetup();
    else if (k === 'escape') {
      if (!$('modal').hidden) return closeModal(); if (!$('aboutDialog').hidden) return hideAbout();
      if (tool) return setTool(null);
      selected = null; renderOverlay(); renderProps(); closeMenus();
    }
  });

  // ---------------------------------------------------------------- start
  const saved = store.get('autosave', null);
  if (saved && Array.isArray(saved.parts)) {
    saved.parts = saved.parts.filter(p => DEV.has(p.dev)); state = Object.assign(state, saved);
    state.notes = state.notes || []; state.lineWidth = lineKey(state.lineWidth);
  }
  applyLang(); renderAll(); updateButtons(); fit();
  const startTemplate = !saved && (TEMPLATES.find(tp => tp.start) || null);
  if (startTemplate) {                                  // first visit: show a finished setup instead of an empty sheet
    insertTemplate(startTemplate);
    undoStack.length = 0; selected = null; pristine = true; renderOverlay(); renderProps(); updateButtons();
  }
  window.addEventListener('resize', () => renderOverlay());
  window.snapparatus = { get state() { return state; }, view, fit, exportSVG };   // for tests and debugging
})();
