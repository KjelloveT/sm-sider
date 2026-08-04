/* ══════════════════════════════════════════════
   UI-LAYERS.JS — Lagpanelet

   Panelet viser treet SNUDD: det som er teikna sist ligg øvst i lista,
   slik folk ventar av eit lagpanel. Modellen har motsett rekkjefølgje,
   fordi SVG-fila teiknar bakfrå og fram. Vendinga skjer berre her, på
   den eine staden der ho høyrer heime, og aldri i modellen.

   Dra-og-slepp går på peikarhendingar og ikkje på nettlesaren si eiga
   HTML5-draging. Den siste kan ikkje seie kvar mellom to rader du er, og
   ho oppfører seg ulikt på nettbrett — som er ein reell brukssituasjon
   her.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.layers = (function () {
  'use strict';

  const DRAG_SLOP = 4;
  const INSIDE_ZONE = 0.34;   // del av radhøgda i midten som tyder «inn i gruppa»

  let listEl = null;
  let emptyEl = null;

  const collapsed = new Set();   // gruppe-id-ar som er slått saman
  let drag = null;
  let indicator = null;

  const TYPE_ICON = {
    rect: 'square', ellipse: 'circle', line: 'minus', poly: 'star',
    path: 'pencil', group: 'package', image: 'image', text: 'type'
  };

  function attach() {
    listEl = document.getElementById('layerList');
    emptyEl = document.getElementById('layersEmpty');
    listEl.addEventListener('pointerdown', onPointerDown);
  }

  /* ──────────────── Bygging ──────────────── */

  /**
   * Alt panelet faktisk viser, som ein streng.
   *
   * Ei dra sender frå seg «nodes» for kvart musesteg, men treet står
   * stille — det er berre matriser som endrar seg. Utan denne
   * samanlikninga ville panelet blitt bygd opp på nytt seksti gonger i
   * sekundet, og dra-indikatoren ville forsvunne under fingeren.
   */
  function signature() {
    const parts = [];
    RV.state.walk((node) => {
      parts.push(node.id, node.name, node.type,
        node.visible ? 1 : 0, node.locked ? 1 : 0,
        collapsed.has(node.id) ? 1 : 0);
    });
    return parts.join('');
  }

  let lastSignature = null;

  function build(force) {
    if (!listEl) return;

    const sig = signature();
    if (!force && sig === lastSignature) return;
    lastSignature = sig;

    RV.util.clear(listEl);

    const empty = RV.state.isEmpty();
    emptyEl.hidden = !empty;
    listEl.hidden = empty;
    if (empty) return;

    buildList(null, 0);
  }

  function buildList(parentId, depth) {
    // Snudd: fremste node øvst i panelet.
    RV.state.listOf(parentId).slice().reverse().forEach((id) => {
      const node = RV.state.get(id);
      if (!node) return;
      listEl.appendChild(buildRow(node, depth));
      if (node.type === 'group' && !collapsed.has(id)) buildList(id, depth + 1);
    });
  }

  function buildRow(node, depth) {
    const row = RV.util.el('div', 'rv-layer');
    row.dataset.id = node.id;
    row.dataset.depth = depth;
    row.style.paddingLeft = (6 + depth * 14) + 'px';
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', depth + 1);
    row.setAttribute('aria-selected', String(RV.state.isSelected(node.id)));
    row.classList.toggle('rv-layer-selected', RV.state.isSelected(node.id));
    row.classList.toggle('rv-layer-hidden', !node.visible);

    // Trekant for grupper — plassen står tom for vanlege former, så
    // namna på same nivå held seg på linje.
    if (node.type === 'group') {
      const twist = RV.util.iconButton(
        collapsed.has(node.id) ? 'chevR' : 'chevronDown', null,
        'rv-layer-twist', collapsed.has(node.id) ? 'Opne gruppa' : 'Slå saman gruppa');
      twist.dataset.action = 'twist';
      row.appendChild(twist);
    } else {
      row.appendChild(RV.util.el('span', 'rv-layer-twist-space'));
    }

    const icon = RV.util.el('span', 'rv-layer-icon');
    icon.setAttribute('data-icon', TYPE_ICON[node.type] || 'square');
    icon.setAttribute('data-icon-size', '14');
    row.appendChild(icon);

    const name = RV.util.el('span', 'rv-layer-name', node.name);
    name.dataset.action = 'name';
    name.title = node.name;
    row.appendChild(name);

    const eye = RV.util.iconButton(node.visible ? 'eye' : 'eyeOff', null,
      'rv-layer-btn', node.visible ? 'Skjul' : 'Vis');
    eye.dataset.action = 'visible';
    eye.classList.toggle('rv-layer-btn-off', !node.visible);
    row.appendChild(eye);

    const lock = RV.util.iconButton(node.locked ? 'lock' : 'unlock', null,
      'rv-layer-btn', node.locked ? 'Lås opp' : 'Lås');
    lock.dataset.action = 'locked';
    lock.classList.toggle('rv-layer-btn-off', !node.locked);
    row.appendChild(lock);

    if (typeof hydrateIcons === 'function') hydrateIcons(row);
    return row;
  }

  /* ──────────────── Klikk ──────────────── */

  function onPointerDown(e) {
    const row = e.target.closest('.rv-layer');
    if (!row) return;
    const id = row.dataset.id;
    const action = e.target.closest('[data-action]');
    const what = action ? action.dataset.action : null;

    if (what === 'twist') {
      if (collapsed.has(id)) collapsed.delete(id);
      else collapsed.add(id);
      build();
      return;
    }

    if (what === 'visible' || what === 'locked') {
      const node = RV.state.get(id);
      if (!node) return;
      RV.state.pushUndo();
      node[what] = !node[what];
      // Eit skjult eller låst objekt kan ikkje vere valt — elles ville
      // tastar og handtak framleis verke på noko brukaren ikkje ser.
      if ((what === 'visible' && !node.visible) || (what === 'locked' && node.locked)) {
        RV.state.descendants(id).forEach((d) => {
          const i = RV.state.data.selection.indexOf(d);
          if (i !== -1) RV.state.data.selection.splice(i, 1);
        });
      }
      RV.hit.invalidate();
      RV.state.emit('nodes');
      RV.state.emit('selection');
      return;
    }

    if (what === 'name' && e.detail >= 2) {
      startRename(row, id);
      return;
    }

    // Vanleg klikk: marker, og gjer klar for ei mogleg dra.
    if (e.shiftKey) RV.state.toggleSelection(id);
    else if (!RV.state.isSelected(id)) RV.state.setSelection([id]);
    RV.state.emit('selection');

    drag = { id: id, startY: e.clientY, active: false, pointerId: e.pointerId };
    RV.util.capturePointer(listEl, e);
    listEl.addEventListener('pointermove', onPointerMove);
    listEl.addEventListener('pointerup', onPointerUp);
  }

  /* ──────────────── Omdøyping ──────────────── */

  function startRename(row, id) {
    const node = RV.state.get(id);
    if (!node) return;
    const nameEl = row.querySelector('.rv-layer-name');

    const input = RV.util.el('input', 'rv-text-input rv-layer-rename');
    input.value = node.name;
    input.maxLength = 60;
    row.replaceChild(input, nameEl);
    input.focus();
    input.select();

    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      if (save && input.value.trim()) {
        RV.state.pushUndo();
        node.name = input.value.trim();
        RV.state.emit('nodes');
      }
      // Alltid tvungen: avbryt brukaren omdøypinga, er signaturen
      // uendra, og panelet ville blitt ståande med skrivefeltet ope.
      build(true);
    };

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
  }

  /* ──────────────── Dra og slepp ──────────────── */

  function onPointerMove(e) {
    if (!drag) return;
    if (!drag.active) {
      if (Math.abs(e.clientY - drag.startY) < DRAG_SLOP) return;
      drag.active = true;
      listEl.classList.add('rv-layers-dragging');
    }
    showDrop(findDrop(e.clientY));
  }

  function onPointerUp(e) {
    listEl.removeEventListener('pointermove', onPointerMove);
    listEl.removeEventListener('pointerup', onPointerUp);
    RV.util.releasePointer(listEl, e);

    if (drag && drag.active) {
      const drop = findDrop(e.clientY);
      if (drop) applyDrop(drag.id, drop);
    }
    listEl.classList.remove('rv-layers-dragging');
    clearIndicator();
    drag = null;
  }

  /**
   * Kvar hamnar noden om han blir sleppt her?
   * @returns {object|null} { parentId, index, intoGroup }
   */
  function findDrop(clientY) {
    const rows = Array.from(listEl.querySelectorAll('.rv-layer'));
    if (!rows.length) return { parentId: null, index: 0 };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const r = row.getBoundingClientRect();
      if (clientY > r.bottom) continue;

      const id = row.dataset.id;
      const node = RV.state.get(id);
      if (!node) continue;

      const rel = (clientY - r.top) / r.height;

      // Midt på ei gruppe: legg noden INNI henne.
      if (node.type === 'group' && rel > INSIDE_ZONE && rel < 1 - INSIDE_ZONE) {
        return { parentId: id, index: RV.state.listOf(id).length, intoGroup: true, row: row };
      }

      const list = RV.state.listOf(node.parent);
      const at = list.indexOf(id);
      // Panelet er snudd: «over rada» tyder lenger fram i lista.
      const index = rel < 0.5 ? at + 1 : at;
      return { parentId: node.parent, index: index, above: rel < 0.5, row: row };
    }

    const last = rows[rows.length - 1];
    const lastNode = RV.state.get(last.dataset.id);
    return { parentId: lastNode ? lastNode.parent : null, index: 0, row: last, above: false };
  }

  function applyDrop(id, drop) {
    const node = RV.state.get(id);
    if (!node) return;
    if (drop.parentId === id || RV.state.isAncestor(id, drop.parentId)) return;

    // Same plass som før — ikkje lag eit angre-steg av ingenting.
    const list = RV.state.listOf(node.parent);
    const at = list.indexOf(id);
    if (drop.parentId === node.parent && (drop.index === at || drop.index === at + 1)) return;

    RV.state.pushUndo();
    // Fjernar vi noden framfrå, glir alt bak han eitt hakk fram.
    let index = drop.index;
    if (drop.parentId === node.parent && at !== -1 && at < index) index -= 1;
    RV.state.moveTo(id, drop.parentId, index);
    RV.hit.invalidate();
    RV.state.emit('nodes');
  }

  function showDrop(drop) {
    clearIndicator();
    if (!drop || !drop.row) return;

    if (drop.intoGroup) {
      drop.row.classList.add('rv-layer-drop-into');
      indicator = drop.row;
      return;
    }

    const line = RV.util.el('div', 'rv-layer-drop-line');
    const r = drop.row.getBoundingClientRect();
    const host = listEl.getBoundingClientRect();
    line.style.top = ((drop.above ? r.top : r.bottom) - host.top + listEl.scrollTop) + 'px';
    listEl.appendChild(line);
    indicator = line;
  }

  function clearIndicator() {
    if (!indicator) return;
    if (indicator.classList.contains('rv-layer')) indicator.classList.remove('rv-layer-drop-into');
    else if (indicator.parentNode) indicator.parentNode.removeChild(indicator);
    indicator = null;
  }

  /* ──────────────── Synking ──────────────── */

  /** Berre markeringa har endra seg — då treng vi ikkje byggje treet på nytt. */
  function syncSelection() {
    if (!listEl) return;
    listEl.querySelectorAll('.rv-layer').forEach((row) => {
      const on = RV.state.isSelected(row.dataset.id);
      row.classList.toggle('rv-layer-selected', on);
      row.setAttribute('aria-selected', String(on));
    });
  }

  return { attach, build, syncSelection };
})();
