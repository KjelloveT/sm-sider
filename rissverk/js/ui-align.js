/* ══════════════════════════════════════════════
   UI-ALIGN.JS — Juster og fordel

   Med to eller fleire former valde justerer vi mot den felles ramma.
   Med berre éi form valt justerer vi mot TEIKNEFLATA i staden — det er
   den einaste tolkinga som gjev meining, og han er ofte den ein vil:
   «legg logoen midt på arket».

   Alt går gjennom applyWorld, så ei form inni ei rotert gruppe hamnar
   der ho faktisk ser ut til å skulle hamne.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.align = (function () {
  'use strict';

  let overlayEl = null;
  let gridEl = null;
  let noteEl = null;

  const ACTIONS = [
    { id: 'left',    icon: 'chevronsLeft',  label: 'Venstrekant' },
    { id: 'centerX', icon: 'arrowLeftRight', label: 'Midt vassrett' },
    { id: 'right',   icon: 'chevronsRight', label: 'Høgrekant' },
    { id: 'top',     icon: 'arrowUp',       label: 'Overkant' },
    { id: 'centerY', icon: 'arrowSwap',     label: 'Midt loddrett' },
    { id: 'bottom',  icon: 'arrowDown',     label: 'Underkant' },
    { id: 'distX',   icon: 'grid3x3',       label: 'Fordel vassrett' },
    { id: 'distY',   icon: 'list',          label: 'Fordel loddrett' }
  ];

  function attach() {
    overlayEl = document.getElementById('alignOverlay');
    gridEl = document.getElementById('alignGrid');
    noteEl = document.getElementById('alignNote');

    RV.util.bindOverlayClose(overlayEl);
    document.getElementById('alignCloseBtn')
      .addEventListener('click', () => RV.util.closeModal(overlayEl));

    ACTIONS.forEach((a) => {
      const btn = RV.util.iconButton(a.icon, a.label, 'btn rv-align-btn', a.label);
      btn.addEventListener('click', () => run(a.id));
      gridEl.appendChild(btn);
    });
  }

  function open() {
    const n = RV.state.topSelection().length;
    noteEl.textContent = n === 0
      ? 'Vel minst éi form først.'
      : (n === 1
        ? 'Éi form er valt — ho blir justert mot teikneflata.'
        : n + ' former er valde. Dei blir justerte mot kvarandre.');
    // Fordeling treng minst tre former for å ha noko å fordele mellom.
    gridEl.querySelectorAll('.rv-align-btn').forEach((btn, i) => {
      const dist = ACTIONS[i].id.indexOf('dist') === 0;
      btn.disabled = n === 0 || (dist && n < 3);
    });
    RV.util.openModal(overlayEl);
  }

  /* ──────────────── Utrekning ──────────────── */

  function run(action) {
    const ids = RV.state.topSelection();
    if (!ids.length) return;

    const boxes = ids.map(id => ({ id: id, box: RV.state.worldBounds(id) })).filter(b => b.box);
    if (!boxes.length) return;

    const doc = RV.state.data.doc;
    const target = boxes.length === 1
      ? { x: 0, y: 0, w: doc.width, h: doc.height }
      : RV.state.boundsOf(ids);
    if (!target) return;

    RV.state.pushUndo();

    if (action === 'distX' || action === 'distY') distribute(boxes, action === 'distX');
    else boxes.forEach(b => moveInto(b, target, action));

    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.props.build();
    RV.util.toast('Justert.');
  }

  function moveInto(entry, target, action) {
    const b = entry.box;
    let dx = 0, dy = 0;

    if (action === 'left')    dx = target.x - b.x;
    if (action === 'right')   dx = (target.x + target.w) - (b.x + b.w);
    if (action === 'centerX') dx = (target.x + target.w / 2) - (b.x + b.w / 2);
    if (action === 'top')     dy = target.y - b.y;
    if (action === 'bottom')  dy = (target.y + target.h) - (b.y + b.h);
    if (action === 'centerY') dy = (target.y + target.h / 2) - (b.y + b.h / 2);

    if (dx || dy) RV.state.applyWorld(entry.id, RV.matrix.translate(dx, dy));
  }

  /**
   * Fordeler formene med like store MELLOMROM, ikkje like store steg
   * mellom sentruma. Med former av ulik storleik er det mellomromma
   * auget les som «jamt fordelt».
   */
  function distribute(boxes, horizontal) {
    const key = horizontal ? 'x' : 'y';
    const size = horizontal ? 'w' : 'h';

    const sorted = boxes.slice().sort((a, b) => a.box[key] - b.box[key]);
    const first = sorted[0].box;
    const last = sorted[sorted.length - 1].box;

    const span = (last[key] + last[size]) - first[key];
    const used = sorted.reduce((sum, b) => sum + b.box[size], 0);
    const gap = (span - used) / (sorted.length - 1);

    let cursor = first[key] + first[size] + gap;
    for (let i = 1; i < sorted.length - 1; i++) {
      const entry = sorted[i];
      const delta = cursor - entry.box[key];
      if (delta) {
        RV.state.applyWorld(entry.id,
          horizontal ? RV.matrix.translate(delta, 0) : RV.matrix.translate(0, delta));
      }
      cursor += entry.box[size] + gap;
    }
  }

  /* ──────────────── Spegling ──────────────── */

  function flip(axis) {
    const ids = RV.state.topSelection();
    if (!ids.length) return;
    const box = RV.state.boundsOf(ids);
    if (!box) return;

    RV.state.pushUndo();
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const delta = RV.matrix.flip(axis, cx, cy);
    ids.forEach(id => RV.state.applyWorld(id, delta));

    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.props.build();
  }

  return { attach, open, flip };
})();
