/* ══════════════════════════════════════════════
   MAIN.JS — Koplar modulane saman

   Denne fila held INGEN tilstand. Ho abonnerer på endringar frå
   state.js og fordeler dei ut til dei modulane som treng å vite noko.

   Oppdateringane blir samla opp og køyrde éin gong per skjermbilete.
   Ei dra sender frå seg titals meldingar i sekundet, og kvar av dei
   ville elles utløyst ei full opptegning som likevel aldri rakk fram
   til skjermen før den neste kom.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

(function () {
  'use strict';

  const pending = new Set();
  let stageEl = null;
  let coordsEl = null;
  let emptyEl = null;
  let clipboard = null;

  /* ──────────────── Oppdatering ──────────────── */

  const flush = RV.util.rafThrottle(function () {
    const topics = Array.from(pending);
    pending.clear();

    const has = t => topics.indexOf(t) !== -1;
    const loaded = has('load');
    const structure = loaded || has('nodes') || has('doc');

    if (has('view') || loaded || has('doc')) RV.view.apply();
    if (structure) RV.render.refresh();
    if (structure || has('selection') || has('view') || has('hover')) RV.overlay.refresh();

    if (structure || has('selection')) {
      RV.layers.build();
      if (has('selection')) RV.layers.syncSelection();
    }

    if (has('selection') || loaded || has('tool')) RV.props.build();
    else if (has('nodes')) RV.props.sync();

    RV.toolbar.sync();
    if (structure) syncEmpty();
    if (structure) RV.project.autosave();
  });

  function onChange(topic) {
    pending.add(topic);
    flush();
  }

  function syncEmpty() {
    emptyEl.hidden = !RV.state.isEmpty();
  }

  /* ──────────────── Handlingar ──────────────── */

  function removeSelected() {
    const ids = RV.state.topSelection();
    if (!ids.length) return;
    RV.state.pushUndo();
    ids.forEach(id => RV.state.remove(id));
    RV.state.clearSelection();
    RV.hit.invalidate();
    onChange('nodes');
    onChange('selection');
  }

  const PASTE_OFFSET = 12;

  function duplicateSelected() {
    const ids = RV.state.topSelection();
    if (!ids.length) return;
    RV.state.pushUndo();
    const copies = ids.map((id) => {
      const copy = RV.state.duplicate(id);
      if (copy) RV.state.applyWorld(copy.id, RV.matrix.translate(PASTE_OFFSET, PASTE_OFFSET));
      return copy;
    }).filter(Boolean);
    RV.state.setSelection(copies.map(c => c.id));
    RV.hit.invalidate();
    onChange('nodes');
    onChange('selection');
  }

  function groupSelected() {
    const ids = RV.state.topSelection();
    if (ids.length < 2) return;
    RV.state.pushUndo();
    const g = RV.state.group(ids);
    if (!g) {
      RV.util.toast('Formene må liggje i same gruppe for å kunne grupperast.');
      return;
    }
    RV.state.setSelection([g.id]);
    RV.hit.invalidate();
    onChange('nodes');
    onChange('selection');
  }

  function ungroupSelected() {
    const groups = RV.state.selectedNodes().filter(n => n.type === 'group');
    if (!groups.length) return;
    RV.state.pushUndo();
    let freed = [];
    groups.forEach((g) => { freed = freed.concat(RV.state.ungroup(g.id)); });
    RV.state.setSelection(freed);
    RV.hit.invalidate();
    onChange('nodes');
    onChange('selection');
  }

  function reorderSelected(where) {
    const ids = RV.state.topSelection();
    if (!ids.length) return;
    RV.state.pushUndo();
    // Fram: bakfrå og fram, så innbyrdes rekkjefølgje held seg.
    const order = (where === 'up' || where === 'front') ? ids.slice().reverse() : ids;
    let any = false;
    order.forEach((id) => { if (RV.state.reorder(id, where)) any = true; });
    if (any) onChange('nodes');
  }

  const COMBINE_NAMES = {
    union: 'Formene er slegne saman.',
    subtract: 'Skore bort.',
    intersect: 'Overlappet er behalde.',
    exclude: 'Overlappet er fjerna.'
  };

  /**
   * Slår saman former. Resultatet blir linjesegment — kurvene finst
   * ikkje lenger, og det er ikkje råd å rekne dei fram att. Brukaren
   * skal vite det, men berre når det faktisk går tapt noko: var alle
   * formene rette frå før, er det ingenting å seie frå om.
   */
  function combineShapes(op) {
    const hadCurves = RV.state.topSelection().some(hasCurves);
    const error = RV.boolean.apply(op);
    if (error) {
      RV.util.toast(error);
      return;
    }
    onChange('nodes');
    onChange('selection');
    RV.util.toast(COMBINE_NAMES[op] +
      (hadCurves ? ' Kurvene blei til rette linjer — det er slik denne reknemåten verkar.' : ''));
  }

  /** Køyrer ei handling som gjev feilmelding eller null. */
  function run(error, success) {
    if (error) { RV.util.toast(error); return false; }
    RV.gradient.collectGarbage();
    RV.symbol.collectGarbage();
    onChange('nodes');
    onChange('selection');
    if (success) RV.util.toast(success);
    return true;
  }

  function hasCurves(id) {
    const node = RV.state.get(id);
    if (!node) return false;
    if (node.type === 'group') return RV.state.listOf(id).some(hasCurves);
    if (node.type === 'ellipse' || node.type === 'poly') return node.type === 'ellipse';
    if (node.type === 'rect') return !!node.geom.rx;
    if (node.type !== 'path') return false;
    return (node.geom.subpaths || []).some(sp =>
      RV.geom.segments(sp).some(seg => !RV.geom.isStraight(seg[0], seg[1])));
  }

  function nudge(dx, dy) {
    const ids = RV.state.topSelection();
    if (!ids.length) return;
    RV.state.pushUndo();
    const delta = RV.matrix.translate(dx, dy);
    ids.forEach(id => RV.state.applyWorld(id, delta));
    RV.hit.invalidate();
    onChange('nodes');
  }

  function selectAll() {
    RV.state.setSelection(RV.state.data.root.filter((id) => {
      const node = RV.state.get(id);
      return node && node.visible && !node.locked;
    }));
    onChange('selection');
  }

  /* ---- Utklippstavle ---- */

  /* Ei eiga tavle inne i programmet, ikkje systemtavla. Å skrive SVG til
     systemtavla ville kravd løyve frå brukaren og fungert ulikt i kvar
     nettlesar — og det brukaren nesten alltid vil, er å lime inn att i
     same teikning. */
  function copySelected() {
    const ids = RV.state.topSelection();
    if (!ids.length) return;
    clipboard = ids.map((id) => ({
      node: JSON.parse(JSON.stringify(RV.state.get(id))),
      world: RV.state.worldMatrix(id),
      subtree: subtreeOf(id)
    }));
    RV.util.toast(ids.length === 1 ? 'Kopiert.' : ids.length + ' former kopierte.');
  }

  function subtreeOf(id) {
    return (RV.state.listOf(id) || []).map(cid => ({
      node: JSON.parse(JSON.stringify(RV.state.get(cid))),
      subtree: subtreeOf(cid)
    }));
  }

  function pasteClipboard() {
    if (!clipboard || !clipboard.length) return;
    RV.state.pushUndo();
    const made = clipboard.map(entry => insertCopy(entry.node, entry.subtree, null));
    made.forEach(id => RV.state.applyWorld(id, RV.matrix.translate(PASTE_OFFSET, PASTE_OFFSET)));
    RV.state.setSelection(made);
    RV.hit.invalidate();
    onChange('nodes');
    onChange('selection');
  }

  function insertCopy(nodeData, subtree, parentId) {
    const copy = JSON.parse(JSON.stringify(nodeData));
    copy.id = RV.util.nextId('n');
    RV.state.add(copy, parentId);
    (subtree || []).forEach(child => insertCopy(child.node, child.subtree, copy.id));
    return copy.id;
  }

  /* ──────────────── Hurtigtastar ──────────────── */

  function typing(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (RV.color.isOpen()) return;      // fargeveljaren lukkar seg sjølv
      RV.tools.cancel();
      return;
    }

    if (typing(e.target) || RV.util.anyModalOpen()) return;

    /* Det aktive verktøyet får første stikk. Pennen treng Backspace til
       å ta bort siste punkt og Enter til å avslutte stien, og desse må
       ikkje bli fanga av dei allmenne snarvegane under. */
    const tool = RV.tools.active();
    if (tool && tool.onKey && tool.onKey(e)) {
      e.preventDefault();
      onChange('nodes');
      return;
    }

    const mod = e.ctrlKey || e.metaKey;

    if (e.key === ' ' && !mod) {
      RV.tools.setSpace(true);
      e.preventDefault();
      return;
    }

    if (mod) {
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) { act(RV.state.undo, 'Angra.'); e.preventDefault(); return; }
      if ((key === 'z' && e.shiftKey) || key === 'y') { act(RV.state.redo, 'Gjorde om.'); e.preventDefault(); return; }
      if (key === 'd') { duplicateSelected(); e.preventDefault(); return; }
      if (key === 'g') { e.shiftKey ? ungroupSelected() : groupSelected(); e.preventDefault(); return; }
      if (key === 'a') { selectAll(); e.preventDefault(); return; }
      if (key === 'c') { copySelected(); e.preventDefault(); return; }
      if (key === 'v') { pasteClipboard(); e.preventDefault(); return; }
      if (key === 's') { document.getElementById('saveProjectBtn').click(); e.preventDefault(); return; }
      if (key === 'e') { RV.uiExport.open(); e.preventDefault(); return; }
      if (key === '0') { RV.view.fit(); onChange('view'); e.preventDefault(); return; }
      if (key === '1') { RV.view.setZoom(1); onChange('view'); e.preventDefault(); return; }
      if (e.key === ']') { reorderSelected('front'); e.preventDefault(); return; }
      if (e.key === '[') { reorderSelected('back'); e.preventDefault(); return; }
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      removeSelected();
      e.preventDefault();
      return;
    }

    const arrows = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
    };
    if (arrows[e.key]) {
      const step = e.shiftKey ? 10 : 1;
      nudge(arrows[e.key][0] * step, arrows[e.key][1] * step);
      e.preventDefault();
      return;
    }

    const picked = RV.tools.byKey(e.key);
    if (picked) {
      RV.tools.setActive(picked.id);
      e.preventDefault();
    }
  }

  function act(fn, message) {
    if (!fn()) return;
    RV.hit.invalidate();
    onChange('nodes');
    onChange('selection');
    RV.util.toast(message);
  }

  function onKeyUp(e) {
    if (e.key === ' ') RV.tools.setSpace(false);
  }

  /* ──────────────── Knappar ──────────────── */

  function bindButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    on('undoBtn', () => act(RV.state.undo, 'Angra.'));
    on('redoBtn', () => act(RV.state.redo, 'Gjorde om.'));
    on('duplicateBtn', duplicateSelected);
    on('deleteBtn', removeSelected);
    on('groupBtn', groupSelected);
    on('ungroupBtn', ungroupSelected);
    on('raiseBtn', () => reorderSelected('up'));
    on('lowerBtn', () => reorderSelected('down'));
    on('layerUpBtn', () => reorderSelected('up'));
    on('layerDownBtn', () => reorderSelected('down'));
    ['union', 'subtract', 'intersect', 'exclude'].forEach((op) => {
      on(op + 'Btn', () => combineShapes(op));
    });

    on('connectBtn', () => run(RV.connect.connectSelection(), 'Kopla saman.'));
    on('symbolBtn', () => run(RV.symbol.create(), 'Symbolet er laga. Kopier instansen for å bruke det fleire stader.'));

    /* Éin knapp for maske: har det valde ei maske frå før, tek han henne
       bort. To knappar for eit par som utelukkar kvarandre er ein knapp
       for mykje. */
    on('clipBtn', () => {
      const has = RV.clip.hasClip();
      run(has ? RV.clip.release() : RV.clip.apply(),
          has ? 'Maska er teken bort.' : 'Maska er lagd på.');
    });

    on('flipHBtn', () => RV.align.flip('x'));
    on('flipVBtn', () => RV.align.flip('y'));
    on('alignBtn', () => RV.align.open());
    on('exportBtn', () => RV.uiExport.open());

    on('zoomInBtn', () => { RV.view.zoomBy(1.25); onChange('view'); });
    on('zoomOutBtn', () => { RV.view.zoomBy(0.8); onChange('view'); });
    on('zoomFitBtn', () => { RV.view.fit(); onChange('view'); });

    on('gridBtn', () => {
      const v = RV.state.data.view;
      v.grid = !v.grid;
      onChange('view');
    });

    const tipsOverlay = document.getElementById('tipsOverlay');
    RV.util.bindOverlayClose(tipsOverlay);
    on('tipsBtn', () => RV.util.openModal(tipsOverlay));
    on('tipsCloseBtn', () => RV.util.closeModal(tipsOverlay));
  }

  /* ──────────────── Koordinatvising ──────────────── */

  function bindCoords() {
    const show = RV.util.rafThrottle((x, y) => {
      coordsEl.textContent = Math.round(x) + ', ' + Math.round(y);
    });
    stageEl.addEventListener('pointermove', (e) => {
      const p = RV.view.toDoc(e.clientX, e.clientY);
      show(p.x, p.y);
    });
    stageEl.addEventListener('pointerleave', () => { coordsEl.textContent = ''; });
  }

  /* ──────────────── Oppstart ──────────────── */

  document.addEventListener('DOMContentLoaded', function () {
    stageEl = document.getElementById('stage');
    coordsEl = document.getElementById('coordsLabel');
    emptyEl = document.getElementById('emptyNote');

    RV.view.attach({
      svg: document.getElementById('canvas'),
      viewport: document.getElementById('viewport'),
      grid: document.getElementById('gridLayer'),
      ruler: document.getElementById('rulerLayer'),
      stage: stageEl
    });

    RV.render.attach({
      scene: document.getElementById('scene'),
      defs: document.getElementById('canvasDefs'),
      artboard: document.getElementById('artboard')
    });

    RV.overlay.attach({ overlay: document.getElementById('overlayLayer') });

    RV.color.attach();
    RV.props.attach();
    RV.layers.attach();
    RV.align.attach();
    RV.uiExport.attach();
    RV.uiProject.attach();
    RV.import.attach();
    RV.learn.attach();
    RV.toolbar.attach();

    RV.tools.attach(stageEl);
    RV.tools.setActive('select');

    RV.state.onChange(onChange);
    bindButtons();
    bindCoords();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    // Mistar vindauget fokus medan mellomrom er nede, blir tasten hengande.
    window.addEventListener('blur', () => RV.tools.setSpace(false));

    // Flata endrar storleik både ved vindaugsendring og når panela
    // brytar om på smale skjermar. ResizeObserver fangar begge.
    if (window.ResizeObserver) {
      new ResizeObserver(RV.util.rafThrottle(() => { RV.view.apply(); RV.overlay.refresh(); }))
        .observe(stageEl);
    } else {
      window.addEventListener('resize', () => { RV.view.apply(); RV.overlay.refresh(); });
    }

    const restored = RV.project.restore();
    RV.view.fit();
    onChange('load');
    if (restored) RV.util.toast('Henta att teikninga frå sist.');
  });
})();
