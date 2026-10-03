/* Snapparatus - draw laboratory glassware setups.
 * Plain script (no modules) so the app also runs when index.html is opened from disk.
 * World coordinates are device units: 0.01 mm at the LaboBib drawing scale of 1:5. */
(function () {
  'use strict';

  const DATA = window.SNAPPARATUS_DATA;
  const DEV = new Map(DATA.devices.map(d => [d.id, d]));
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- texts
  const T = {
    de: {
      new: 'Neu', open: 'Öffnen', save: 'Speichern', undo: 'Rückgängig (Strg+Z)', redo: 'Wiederholen (Strg+Y)',
      text: 'Text', arrow: 'Pfeil', templates: 'Vorlagen', soon: 'Kommt bald', export: 'Export', copy: 'Kopieren',
      exportSvg: 'Als SVG speichern', exportPng: 'Als PNG speichern', settings: 'Einstellungen',
      catalogPos: 'Katalog', propsPos: 'Eigenschaften', left: 'links', right: 'rechts', top: 'oben',
      collapse: 'Ein-/ausklappen', zoomFit: 'Alles zeigen', search: 'Gerät suchen …', all: 'Alle',
      results: 'Suchergebnisse', noResults: 'Nichts gefunden.',
      emptyHint: 'Geräte aus dem Katalog hierher ziehen oder anklicken.<br>Schliffe rasten automatisch ein.', jointSize: 'Schliff',
      drawing: 'Zeichnung', parts: n => `${n} ${n === 1 ? 'Teil' : 'Teile'}`, lineWidth: 'Strichstärke',
      thin: 'Dünn', normal: 'Normal', slide: 'Folie',
      howto: 'Teil ziehen: am passenden Schliff rastet es ein und richtet sich aus. Ein Klick im Katalog setzt das Teil an das ausgewählte Gerät an. Eingerastete Teile bleiben zusammen – zum Trennen ein Teil auswählen und am Schliff auf das rote Symbol klicken.',
      position: 'Lage', rotation: 'Drehung', rotateHint: 'dreht die ganze Apparatur um dieses Teil', mirror: 'Spiegeln',
      mirrorBtn: 'Horizontal', fill: 'Füllung', level: 'Füllhöhe', color: 'Farbe', joints: 'Anschlüsse',
      duplicate: 'Duplizieren', delete: 'Löschen', detach: 'Aus Apparatur lösen', unlink: 'Hier trennen',
      socket: 'Hülse', cone: 'Kern', base: 'Standfläche', support: 'Auflage', hose: 'Olive',
      trash: 'Zum Entfernen hierher ziehen', trashOver: 'Loslassen zum Entfernen',
      copied: 'Bild kopiert – in PowerPoint oder Word einfügen (Strg+V).',
      copyFailed: 'Kopieren nicht möglich – bitte „Export → Als PNG speichern“ verwenden.',
      saved: 'Gespeichert.', openFailed: 'Datei konnte nicht geöffnet werden.', nothing: 'Die Zeichnung ist leer.',
      confirmNew: 'Aktuelle Zeichnung verwerfen?', unknownDevices: n => `${n} unbekannte Geräte übersprungen.`,
      fileName: 'apparatur',
    },
    en: {
      new: 'New', open: 'Open', save: 'Save', undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Y)',
      text: 'Text', arrow: 'Arrow', templates: 'Templates', soon: 'Coming soon', export: 'Export', copy: 'Copy',
      exportSvg: 'Save as SVG', exportPng: 'Save as PNG', settings: 'Settings',
      catalogPos: 'Catalogue', propsPos: 'Properties', left: 'left', right: 'right', top: 'top',
      collapse: 'Collapse / expand', zoomFit: 'Show all', search: 'Search equipment …', all: 'All',
      results: 'Search results', noResults: 'Nothing found.',
      emptyHint: 'Drag or click equipment in the catalogue.<br>Ground glass joints snap together automatically.', jointSize: 'Joint',
      drawing: 'Drawing', parts: n => `${n} ${n === 1 ? 'part' : 'parts'}`, lineWidth: 'Line width',
      thin: 'Thin', normal: 'Normal', slide: 'Slide',
      howto: 'Drag a part: it snaps to a matching joint and aligns itself. Clicking in the catalogue attaches the part to the selected one. Snapped parts stay together – to separate them, select a part and click the red symbol at the joint.',
      position: 'Position', rotation: 'Rotation', rotateHint: 'turns the whole setup about this part', mirror: 'Mirror',
      mirrorBtn: 'Horizontal', fill: 'Liquid', level: 'Fill level', color: 'Colour', joints: 'Connections',
      duplicate: 'Duplicate', delete: 'Delete', detach: 'Take out of setup', unlink: 'Separate here',
      socket: 'socket', cone: 'cone', base: 'base', support: 'support', hose: 'olive',
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
  const settings = Object.assign({ lang: (navigator.language || 'de').startsWith('de') ? 'de' : 'en',
    posCatalog: 'left', posProps: 'right', catalogCollapsed: false, propsCollapsed: false }, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);

  // ---------------------------------------------------------------- drawing state
  // part: {id, dev, x, y, a (degrees), f (mirrored), fill: {on, level, color}}
  // link: {p1, j1, p2, j2} - joint j1 of part p1 is connected to joint j2 of part p2
  let state = { parts: [], links: [], next: 1, lineWidth: 'normal' };
  let selected = null;
  const undoStack = [], redoStack = [];
  const LINE = { thin: 9, normal: 14, slide: 26 };
  const COLORS = ['#7cc4e8', '#f2c14e', '#e07a5f', '#81b29a', '#b8a1d9', '#f4a6c4', '#9aa5ad', '#ffffff'];

  const part = id => state.parts.find(p => p.id === id);
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
    if ((a.type === 'socket' && b.type === 'cone') || (a.type === 'cone' && b.type === 'socket'))
      return a.ns === b.ns && a.system === b.system;
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
  function centre(id) { const b = bbox([id]); return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]; }

  // ---------------------------------------------------------------- undo / autosave
  const snapshot = () => JSON.stringify(state);
  const content = s => { const o = JSON.parse(s); delete o.next; return JSON.stringify(o); };   // the id counter is no change
  function commit(before) {                             // call after a change; `before` = snapshot taken before it
    if (content(before) === content(snapshot())) return;
    undoStack.push(before); if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0; changed();
  }
  function changed() {
    store.set('autosave', state);
    renderAll(); renderProps(); updateButtons();
  }
  function restore(s) { state = JSON.parse(s); if (selected && !part(selected)) selected = null; changed(); }
  function undo() { if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } }
  function redo() { if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } }
  function updateButtons() {
    document.querySelector('[data-act=undo]').disabled = !undoStack.length;
    document.querySelector('[data-act=redo]').disabled = !redoStack.length;
    $('emptyHint').hidden = state.parts.length > 0;
  }

  // ---------------------------------------------------------------- view (zoom / pan)
  const view = { x: -2000, y: -2000, s: 0.08 };
  const canvas = $('canvas'), world = $('world');
  function applyView() {
    world.setAttribute('transform', `matrix(${view.s},0,0,${view.s},${-view.x * view.s},${-view.y * view.s})`);
    $('zoomLabel').textContent = Math.round(view.s / 0.08 * 100) + ' %';
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
    if (!state.parts.length) { view.s = 0.08; view.x = -r.width / 2 / view.s; view.y = -r.height / 2 / view.s; applyView(); return; }
    const b = bbox(state.parts.map(p => p.id)), m = 600;
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
    renderFills(); renderOverlay();
  }
  function renderTransforms(ids) {
    for (const id of ids) { const g = partEls.get(id); if (g) g.setAttribute('transform', transformOf(part(id))); }
    renderFills(); renderOverlay();
  }
  function renderFills() {
    const defs = $('defs'), layer = $('fills');
    defs.innerHTML = ''; layer.innerHTML = '';
    for (const p of state.parts) {
      const d = dev(p);
      if (!d.fill || !p.fill || !p.fill.on) continue;
      // outline in world coordinates; the liquid surface stays horizontal however the vessel is turned
      const polys = d.fill.regions.map(r => { const out = []; for (let i = 0; i < r.length; i += 2) out.push(toWorld(p, r[i], r[i + 1])); return out; });
      const ys = polys.flat().map(q => q[1]), xs = polys.flat().map(q => q[0]);
      const top = Math.min(...ys), bot = Math.max(...ys), lvl = bot - (p.fill.level / 100) * (bot - top);
      const cp = el('clipPath', { id: 'clip' + p.id });
      for (const poly of polys) cp.appendChild(el('polygon', { points: poly.map(q => q.join(',')).join(' ') }));
      defs.appendChild(cp);
      layer.appendChild(el('rect', { x: Math.min(...xs), y: lvl, width: Math.max(...xs) - Math.min(...xs), height: bot - lvl + 1,
        fill: p.fill.color, 'clip-path': `url(#clip${p.id})` }));
    }
  }
  let snapHints = [], activeSnap = null;
  function renderOverlay() {
    const o = $('overlay'); o.innerHTML = '';
    if (selected && part(selected)) {
      o.appendChild(el('polygon', { class: 'sel-box', points: corners(part(selected)).map(q => q.join(',')).join(' ') }));
    }
    const r = 7 / view.s;
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
    for (const h of snapHints) {
      o.appendChild(el('circle', { class: 'snap-dot' + (activeSnap && h.pid === activeSnap.tp && h.j === activeSnap.tj ? ' active' : ''),
        cx: h.x, cy: h.y, r }));
    }
  }

  // ---------------------------------------------------------------- dragging and snapping
  let drag = null;   // {ids, start: Map id->{x,y,a}, from: [wx, wy], before, moved, detach}

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
  function startDrag(ids, ev, before) {
    drag = { ids: [...ids], start: new Map(), from: toWorldPt(ev), before, moved: false };
    for (const id of drag.ids) { const p = part(id); drag.start.set(id, { x: p.x, y: p.y, a: p.a }); }
    canvas.classList.add('dragging');
  }
  function moveDrag(ev) {
    const [wx, wy] = toWorldPt(ev), dx = wx - drag.from[0], dy = wy - drag.from[1];
    if (!drag.moved && Math.hypot(dx, dy) * view.s < 3) return;
    if (!drag.moved) {                                  // dragged parts go on top
      drag.moved = true;
      state.parts.sort((a, b) => (drag.ids.includes(a.id) ? 1 : 0) - (drag.ids.includes(b.id) ? 1 : 0));
      renderAll();
    }
    for (const id of drag.ids) { const p = part(id), s = drag.start.get(id); p.x = s.x + dx; p.y = s.y + dy; p.a = s.a; }
    const bin = $('trash'); bin.hidden = false;
    const br = bin.getBoundingClientRect(), pad = 12;
    drag.overTrash = ev.clientX >= br.left - pad && ev.clientX <= br.right + pad && ev.clientY >= br.top - pad && ev.clientY <= br.bottom + pad;
    if (drag.overTrash !== bin.classList.contains('over')) {
      bin.classList.toggle('over', drag.overTrash);
      bin.querySelector('span').textContent = t(drag.overTrash ? 'trashOver' : 'trash');
    }
    activeSnap = drag.overTrash ? null : findSnap(drag.ids);
    if (drag.overTrash) snapHints = [];
    if (activeSnap) applySnap(drag.ids, activeSnap);
    renderTransforms(drag.ids);
  }
  function endDrag() {
    if (!drag) return;
    const bin = $('trash'); bin.hidden = true; bin.classList.remove('over'); bin.querySelector('span').textContent = t('trash');
    if (drag.overTrash) {                               // dropped on the bin: remove what was dragged
      const gone = new Set(drag.ids);
      state.parts = state.parts.filter(p => !gone.has(p.id));
      state.links = state.links.filter(l => !gone.has(l.p1) && !gone.has(l.p2));
      if (gone.has(selected)) selected = null;
      activeSnap = null;
    }
    if (activeSnap) state.links.push({ p1: activeSnap.mp, j1: activeSnap.mj, p2: activeSnap.tp, j2: activeSnap.tj });
    const before = drag.before;
    drag = null; activeSnap = null; snapHints = [];
    canvas.classList.remove('dragging');
    commit(before); renderOverlay();
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
    const u = ev.target.closest && ev.target.closest('.unlink');
    if (u) { unlink(state.links[+u.dataset.link]); return; }
    const g = ev.target.closest && ev.target.closest('.part');
    if (g && ev.button === 0) {
      canvas.setPointerCapture(ev.pointerId);
      grabPart(+g.dataset.id, ev);
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
  canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX - r.left, ev.clientY - r.top);
    renderOverlay();
  }, { passive: false });

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
      const target = selected, r = canvas.getBoundingClientRect();
      const np = addPart(p.devId, view.x + r.width / 2 / view.s, view.y + r.height / 2 / view.s);
      if (target && !attachTo(np.id, target)) {          // no matching joint: put it next to the selection
        const b = bbox([...component(target)]), d = DEV.get(p.devId);
        np.x = b.x1 + 600; np.y = b.y1 - d.h;
      }
      commit(p.before);
    }
  });

  // ---------------------------------------------------------------- actions
  function selectionSetup() { return selected ? [...component(selected)] : []; }
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
    selected = null; commit(before);
  }
  function duplicateSelected() {
    const p = part(selected); if (!p) return;
    const before = snapshot(), q = JSON.parse(JSON.stringify(p));
    q.id = state.next++; q.x += 800; q.y += 400;
    state.parts.push(q); selected = q.id; commit(before);
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
  function detachSelected() {                           // take the selected part out of its setup
    if (!selected) return;
    const before = snapshot(), id = selected;
    state.links = state.links.filter(l => l.p1 !== id && l.p2 !== id);
    const p = part(id); p.x += 800; commit(before);
  }
  function newDrawing() {
    if (state.parts.length && !confirm(t('confirmNew'))) return;
    const before = snapshot();
    state = { parts: [], links: [], next: 1, lineWidth: state.lineWidth }; selected = null; fileHandle = null;
    commit(before); fit();
  }

  // ---------------------------------------------------------------- export
  function exportSVG(withMeta = true) {
    if (!state.parts.length) return null;
    const b = bbox(state.parts.map(p => p.id)), m = 300;
    const x0 = b.x0 - m, y0 = b.y0 - m, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m;
    const fills = $('fills').outerHTML.replace(/ id="fills"/, ''), defs = $('defs').innerHTML;
    const parts = state.parts.map(p => `<g transform="${transformOf(p)}">${dev(p).svg}</g>`).join('');
    const meta = withMeta ? `<metadata id="snapparatus">${JSON.stringify(projectData()).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</metadata>` : '';
    const sw = LINE[state.lineWidth] || 14;
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" ` +
      `width="${(w / 100).toFixed(1)}mm" height="${(h / 100).toFixed(1)}mm">${meta}<defs>${defs}</defs>` +
      `<style>path{stroke-width:${sw}px}</style>${fills}${parts}</svg>`;
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
    links: state.links });
  let fileHandle = null;
  async function saveProject() {
    const text = JSON.stringify(projectData(), null, 1);
    if (window.showSaveFilePicker) {
      try {
        if (!fileHandle) fileHandle = await window.showSaveFilePicker({ suggestedName: t('fileName') + '.snapparatus.json',
          types: [{ description: 'Snapparatus', accept: { 'application/json': ['.json'] } }] });
        const w = await fileHandle.createWritable(); await w.write(text); await w.close();
        return toast(t('saved'));
      } catch (e) { if (e.name === 'AbortError') return; fileHandle = null; }
    }
    download(new Blob([text], { type: 'application/json' }), t('fileName') + '.snapparatus.json');
  }
  function loadProject(data) {
    if (!data || data.format !== 'snapparatus' || !Array.isArray(data.parts)) throw new Error('format');
    const before = snapshot(), known = data.parts.filter(p => DEV.has(p.dev)), ids = new Set(known.map(p => p.id));
    state = { parts: known, links: (data.links || []).filter(l => ids.has(l.p1) && ids.has(l.p2)),
      next: Math.max(0, ...known.map(p => p.id)) + 1, lineWidth: data.lineWidth || 'normal' };
    selected = null; commit(before); fit();
    if (known.length < data.parts.length) toast(t('unknownDevices', data.parts.length - known.length));
  }
  $('fileInput').addEventListener('change', async ev => {
    const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
    try {
      const text = await f.text();
      if (text.trimStart().startsWith('<')) {             // exported SVG with the project embedded
        const m = text.match(/<metadata id="snapparatus">([\s\S]*?)<\/metadata>/);
        loadProject(JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&')));
      } else loadProject(JSON.parse(text));
      fileHandle = null;
    } catch (e) { toast(t('openFailed')); }
  });

  // ---------------------------------------------------------------- catalogue
  const REP = { flasks: 'Rundkolben NS 29 250', beakers: 'normale Form 250', condensers: 'Dimroth', distillation: 'Destillationsaufsätze NS29',
    adapters: 'Reduzierstücke 29-14', funnels: 'Trichter NS 29', measuring: 'Messzylinder 100', bottles: 'Steilbrustflaschen (Enghals) 250',
    heating: 'Magnetrührer', stand: 'Stativmaterial', drying: 'Trockenrohre NS 29', misc: 'Sammelsurium' };
  let curCat = DATA.categories[0].key, curSub = null, curNS = null;
  const jointSizes = d => [...new Set(d.snaps.filter(s => s.ns && s.system === 'NS').map(s => s.ns))];
  const thumb = d => `<svg viewBox="${-d.w * 0.04} ${-d.h * 0.04} ${d.w * 1.08} ${d.h * 1.08}" preserveAspectRatio="xMidYMid meet">` +
    d.svg.replace('<path ', '<path vector-effect="non-scaling-stroke" style="stroke-width:1.1px" ') + '</svg>';
  function subKey(d) {                                  // coarse group within a category, from the catalogue path
    const words = d.path[0].split(' '), out = [];
    for (const w of words) { if (/^\d|^NS$|mL$|Liter$/.test(w) || /^\(/.test(w)) break; out.push(w); }
    return out.join(' ') || d.path[0];
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
      if (subs.length > 1 && subs.length <= 14) {
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
    for (const d of list.slice(0, 300)) {
      const div = document.createElement('div');
      div.className = 'tile'; div.title = d.name;
      div.innerHTML = thumb(d) + `<span>${d.name}</span>`;
      div.addEventListener('pointerdown', ev => tileDown(d.id, ev));
      tiles.appendChild(div);
    }
  }
  $('search').addEventListener('input', renderTiles);

  // ---------------------------------------------------------------- properties panel
  function renderProps() {
    const body = $('propsBody'), p = selected && part(selected);
    if (!p) {
      $('propsTitle').textContent = t('drawing');
      body.innerHTML = `<div class="sub">${t('parts', state.parts.length)}</div>
        <div class="grp"><div class="t">${t('lineWidth')}</div><div class="seg" id="lwSeg">
          ${['thin', 'normal', 'slide'].map(k => `<button data-lw="${k}" class="${state.lineWidth === k ? 'on' : ''}">${t(k)}</button>`).join('')}</div></div>
        <div class="grp"><div class="hint">${t('howto')}</div></div>`;
    } else {
      const d = dev(p), cat = DATA.categories.find(c => c.key === d.category);
      const joints = d.snaps.filter(s => SNAPPABLE.has(s.type) || s.type === 'hose')
        .map(s => `<span>${t(s.type)}${s.ns ? ' NS ' + s.ns : ''}</span>`).join('');
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
          <div class="row2"><label>${t('color')}</label><div class="swatches">${COLORS.map(c => `<button data-color="${c}" class="${p.fill.color === c ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div></div>
        </div>` : ''}
        <div class="grp"><div class="row2" style="margin:0;flex-wrap:wrap">
          <button class="btn outline" data-act="duplicate"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V4h12"/></svg>${t('duplicate')}</button>
          ${state.links.some(l => l.p1 === p.id || l.p2 === p.id) ? `<button class="btn outline" data-act="detach">${t('detach')}</button>` : ''}
          <button class="btn outline danger" data-act="delete"><svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg>${t('delete')}</button>
        </div></div>`;
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
        $('fillLevel').addEventListener('change', () => { if (liveBefore) { const b = liveBefore; liveBefore = null; commit(b); } });
      }
    }
  }
  $('propsBody').addEventListener('click', ev => {
    const lw = ev.target.closest('[data-lw]');
    if (lw) { const b = snapshot(); state.lineWidth = lw.dataset.lw; commit(b); return; }
    const c = ev.target.closest('[data-color]');
    if (c) { const p = part(selected), b = snapshot(); p.fill.color = c.dataset.color; p.fill.on = true; commit(b); }
  });

  // ---------------------------------------------------------------- layout (panel positions)
  function applyLayout() {
    const slots = { left: $('slotLeft'), right: $('slotRight'), top: $('slotTop') };
    const cat = $('catalog'), props = $('props');
    slots[settings.posCatalog].appendChild(cat); slots[settings.posProps].appendChild(props);
    cat.className = `panel pos-${settings.posCatalog}${settings.catalogCollapsed ? ' collapsed' : ''}`;
    props.className = `panel pos-${settings.posProps}${settings.propsCollapsed ? ' collapsed' : ''}`;
    for (const [sel, key] of [['posCatalog', 'posCatalog'], ['posProps', 'posProps']]) {
      $(sel).innerHTML = ['left', 'right', 'top'].map(v => `<option value="${v}" ${settings[key] === v ? 'selected' : ''}>${t(v)}</option>`).join('');
    }
  }
  function setPosition(which, value) {
    const other = which === 'posCatalog' ? 'posProps' : 'posCatalog';
    if (settings[other] === value) settings[other] = settings[which];   // never both in the same place
    settings[which] = value; saveSettings(); applyLayout();
  }
  $('posCatalog').addEventListener('change', e => setPosition('posCatalog', e.target.value));
  $('posProps').addEventListener('change', e => setPosition('posProps', e.target.value));

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
    new: newDrawing, open: () => $('fileInput').click(), save: saveProject, undo, redo,
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
    text: () => toast(t('soon')), arrow: () => toast(t('soon')), templates: () => toast(t('soon')),
  };
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (b && ACTIONS[b.dataset.act]) { ACTIONS[b.dataset.act](); return; }
    if (!ev.target.closest('.menu-wrap')) closeMenus();
  });
  document.addEventListener('keydown', ev => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    const mod = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
    if (mod && k === 'z' && !ev.shiftKey) { ev.preventDefault(); undo(); }
    else if (mod && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); redo(); }
    else if (mod && k === 's') { ev.preventDefault(); saveProject(); }
    else if (mod && k === 'o') { ev.preventDefault(); $('fileInput').click(); }
    else if (typing) return;
    else if (mod && k === 'c') { ev.preventDefault(); copyImage(); }
    else if (k === 'delete' || k === 'backspace') { ev.preventDefault(); deleteSelected(); }
    else if (k === 'r') rotateSetup(ev.shiftKey ? -15 : 15);
    else if (k === 'm') mirrorSetup();
    else if (k === 'escape') { selected = null; renderOverlay(); renderProps(); closeMenus(); }
  });

  // ---------------------------------------------------------------- start
  const saved = store.get('autosave', null);
  if (saved && Array.isArray(saved.parts)) {
    saved.parts = saved.parts.filter(p => DEV.has(p.dev)); state = Object.assign(state, saved);
  }
  applyLang(); renderAll(); updateButtons(); fit();
  window.addEventListener('resize', () => renderOverlay());
  window.snapparatus = { get state() { return state; }, view, fit, exportSVG };   // for tests and debugging
})();
