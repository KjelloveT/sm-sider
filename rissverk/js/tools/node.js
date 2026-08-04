/* ══════════════════════════════════════════════
   NODE.JS — Direktemarkering: rediger stien punkt for punkt

   Dette er det mest omtenksame verktøyet i programmet, av di det er det
   einaste som lèt brukaren endre sjølve FORMA og ikkje berre kvar ho
   ligg. Tre avgjerder er verdt å grunngje:

   1. Former blir gjorde om til stiar først når du faktisk redigerer
      dei. Eit rektangel er eit <rect> i fila så lenge det er eit
      rektangel — det er lesbart, og breidd og høgd står att som tal ein
      kan skrive inn. I det du dreg i eit hjørne, er det ikkje lenger
      eit rektangel, og då må det bli ein sti. Vi seier frå når det skjer.

   2. Å setje inn eit punkt på ei kurve deler kurva med de Casteljau i
      staden for å berre leggje eit punkt oppå. Forma rikkar seg då ikkje
      ein einaste piksel. Alternativet — å skyte inn eit punkt og gjette
      på handtaka — gjev eit lite hopp akkurat der brukaren såg.

   3. Å FJERNE eit punkt kan ikkje gjerast utan at forma endrar seg, men
      ho skal endre seg så lite som råd. Vi lèt naboane sine handtak
      vekse for å ta over strekket punktet heldt, i staden for å late
      kurva falle saman til ei rett linje.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

(function () {
  'use strict';

  const GRAB = 7;            // px slark rundt eit ankerpunkt
  const HANDLE_GRAB = 6;     // px slark rundt eit handtak
  const DRAG_SLOP = 3;

  let targetId = null;       // stien vi redigerer
  let selection = [];        // [{ sp, pt }] — indeksar, ikkje objekt
  let mode = null;           // null | 'maybe' | 'points' | 'handle' | 'marquee'
  let grabbed = null;        // { sp, pt, which } for handtaksdrag
  let start = null;
  let origin = null;         // kopi av alle punkt ved dra-start
  let undoSnapshot = null;
  let moved = false;
  let hover = null;

  /* ──────────────── Stien vi arbeider på ──────────────── */

  function target() {
    return targetId ? RV.state.get(targetId) : null;
  }

  function subpaths() {
    const node = target();
    return node && node.type === 'path' ? node.geom.subpaths : [];
  }

  function pointAt(ref) {
    const sp = subpaths()[ref.sp];
    return sp ? sp.points[ref.pt] : null;
  }

  function sameRef(a, b) {
    return a && b && a.sp === b.sp && a.pt === b.pt;
  }

  function isSelected(ref) {
    return selection.some(r => sameRef(r, ref));
  }

  /**
   * Sikrar at noden vi peikar på er ein sti.
   * @returns {boolean} sant når vi har noko å redigere
   */
  function adopt(node) {
    if (!node) { targetId = null; selection = []; return false; }

    if (node.type === 'path') {
      if (targetId !== node.id) selection = [];
      targetId = node.id;
      return true;
    }

    if (node.type === 'group' || node.type === 'image') {
      targetId = null;
      selection = [];
      return false;
    }

    // Rektangel, ellipse, linje eller mangekant: gjer om til sti.
    RV.state.pushUndo();
    const converted = RV.geom.toSubpaths(node);
    node.type = 'path';
    node.geom = { subpaths: converted };
    targetId = node.id;
    selection = [];
    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.util.toast('Forma er gjord om til ein sti så du kan endre punkta.');
    return true;
  }

  /* ──────────────── Treff ──────────────── */

  function screen(pt) {
    return RV.matrix.apply(RV.overlay.screenMatrix(targetId), pt.x, pt.y);
  }

  /** Ankerpunktet under peikaren. */
  function anchorAt(stageX, stageY) {
    const list = subpaths();
    for (let s = 0; s < list.length; s++) {
      const points = list[s].points;
      for (let p = 0; p < points.length; p++) {
        const at = screen(points[p]);
        if (Math.hypot(stageX - at.x, stageY - at.y) <= GRAB) return { sp: s, pt: p };
      }
    }
    return null;
  }

  /**
   * Handtaket under peikaren.
   * Berre handtak på VALDE punkt er synlege, og difor er det berre dei
   * som kan takast. Elles ville brukaren treft usynlege ting.
   */
  function handleAt(stageX, stageY) {
    for (let i = 0; i < selection.length; i++) {
      const ref = selection[i];
      const point = pointAt(ref);
      if (!point) continue;
      const arms = [['i', point.ix, point.iy], ['o', point.ox, point.oy]];
      for (let a = 0; a < arms.length; a++) {
        if (arms[a][1] === point.x && arms[a][2] === point.y) continue;
        const at = screen({ x: arms[a][1], y: arms[a][2] });
        if (Math.hypot(stageX - at.x, stageY - at.y) <= HANDLE_GRAB) {
          return { sp: ref.sp, pt: ref.pt, which: arms[a][0] };
        }
      }
    }
    return null;
  }

  /**
   * Punktet på ei kurve som ligg nærast peikaren.
   * @returns {object|null} { sp, seg, t, point }
   */
  function segmentAt(stageX, stageY) {
    const list = subpaths();
    const reach = RV.view.docLength(GRAB);
    const inv = RV.matrix.invert(RV.overlay.screenMatrix(targetId));
    if (!inv) return null;
    const local = RV.matrix.apply(inv, stageX, stageY);

    let best = null;
    list.forEach((sp, s) => {
      RV.geom.segments(sp).forEach((seg, i) => {
        const a = seg[0], b = seg[1];
        // Grov søk langs kurva, så finpuss rundt det beste treffet.
        for (let step = 0; step <= 24; step++) {
          const t = step / 24;
          const q = RV.geom.cubicAt(a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y, t);
          const d = Math.hypot(local.x - q.x, local.y - q.y);
          if (!best || d < best.d) best = { d: d, sp: s, seg: i, t: t };
        }
      });
    });

    if (!best || best.d > reach * 1.6) return null;
    return refine(best, local);
  }

  /** Snevrar inn parameteren rundt det beste grove treffet. */
  function refine(best, local) {
    const sp = subpaths()[best.sp];
    const seg = RV.geom.segments(sp)[best.seg];
    const a = seg[0], b = seg[1];
    let lo = Math.max(0, best.t - 1 / 24);
    let hi = Math.min(1, best.t + 1 / 24);

    for (let i = 0; i < 20; i++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      const q1 = RV.geom.cubicAt(a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y, m1);
      const q2 = RV.geom.cubicAt(a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y, m2);
      if (Math.hypot(local.x - q1.x, local.y - q1.y) <
          Math.hypot(local.x - q2.x, local.y - q2.y)) hi = m2;
      else lo = m1;
    }

    const t = (lo + hi) / 2;
    return { sp: best.sp, seg: best.seg, t: t,
             point: RV.geom.cubicAt(a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y, t) };
  }

  /* ──────────────── Redigering ──────────────── */

  /**
   * Set inn eit punkt på ei kurve utan at forma endrar seg.
   * de Casteljau gjev oss dei to halvdelane av kurva; vi skriv handtaka
   * deira tilbake på naboane og set det nye punktet imellom.
   */
  function insertPoint(hitInfo) {
    const sp = subpaths()[hitInfo.sp];
    const points = sp.points;
    const aIndex = hitInfo.seg;
    const bIndex = (hitInfo.seg + 1) % points.length;
    const a = points[aIndex];
    const b = points[bIndex];

    const split = RV.geom.splitCubic(a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y, hitInfo.t);
    const L = split.left, R = split.right;

    a.ox = L[2]; a.oy = L[3];
    b.ix = R[4]; b.iy = R[5];

    const mid = RV.geom.makePoint(L[6], L[7], 'smooth');
    mid.ix = L[4]; mid.iy = L[5];
    mid.ox = R[2]; mid.oy = R[3];

    points.splice(aIndex + 1, 0, mid);
    return { sp: hitInfo.sp, pt: aIndex + 1 };
  }

  /**
   * Tek bort dei valde punkta.
   * Naboane får handtaka sine strekte, så kurva held mest mogleg av
   * forma si i staden for å rette seg ut til ei linje.
   */
  function removeSelected() {
    if (!selection.length) return;
    RV.state.pushUndo();

    const list = subpaths();
    // Bakfrå, så indeksane framfor held seg medan vi slettar.
    const byPath = {};
    selection.forEach((ref) => {
      (byPath[ref.sp] = byPath[ref.sp] || []).push(ref.pt);
    });

    Object.keys(byPath).forEach((key) => {
      const sp = list[key];
      if (!sp) return;
      byPath[key].sort((a, b) => b - a).forEach((index) => {
        const points = sp.points;
        if (points.length <= 2) return;   // ein sti treng to punkt for å finnast
        const prev = points[index - 1] || (sp.closed ? points[points.length - 1] : null);
        const next = points[index + 1] || (sp.closed ? points[0] : null);
        const gone = points[index];

        // Strekk naboane sine handtak halvvegs mot der punktet låg.
        if (prev && prev.ox === prev.x && prev.oy === prev.y && next) {
          prev.ox = prev.x + (gone.x - prev.x) * 0.4;
          prev.oy = prev.y + (gone.y - prev.y) * 0.4;
        }
        if (next && next.ix === next.x && next.iy === next.y && prev) {
          next.ix = next.x + (gone.x - next.x) * 0.4;
          next.iy = next.y + (gone.y - next.y) * 0.4;
        }
        points.splice(index, 1);
      });
    });

    // Delstiar som er blitt for korte forsvinn.
    const node = target();
    node.geom.subpaths = list.filter(sp => sp.points.length >= 2);
    selection = [];

    if (!node.geom.subpaths.length) {
      RV.state.remove(node.id);
      targetId = null;
    }

    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
  }

  /** Byter mellom hjørne og mjukt punkt. */
  function toggleSmooth(ref) {
    const point = pointAt(ref);
    if (!point) return;
    RV.state.pushUndo();

    if (point.type === 'smooth') {
      point.type = 'corner';
      // Handtaka blir ståande — å nulle dei ville retta ut kurva brått.
    } else {
      point.type = 'smooth';
      const sp = subpaths()[ref.sp];
      const points = sp.points;
      const prev = points[ref.pt - 1] || (sp.closed ? points[points.length - 1] : null);
      const next = points[ref.pt + 1] || (sp.closed ? points[0] : null);
      if (prev && next) {
        // Tangenten går langs linja mellom naboane — same regel som
        // frihandsverktøyet brukar når det jamnar ut ein strek.
        const dx = (next.x - prev.x) / 6;
        const dy = (next.y - prev.y) / 6;
        point.ox = point.x + dx; point.oy = point.y + dy;
        point.ix = point.x - dx; point.iy = point.y - dy;
      }
    }
    RV.hit.invalidate();
    RV.state.emit('nodes');
  }

  /* ──────────────── Peikar ──────────────── */

  function onDown(ctx) {
    moved = false;
    start = { x: ctx.stageX, y: ctx.stageY, local: toLocal(ctx) };

    // 1. Eit handtak på eit valt punkt.
    const handle = handleAt(ctx.stageX, ctx.stageY);
    if (handle) {
      undoSnapshot = RV.state.snapshot();
      grabbed = handle;
      captureOrigin();
      mode = 'handle';
      return;
    }

    // 2. Eit ankerpunkt.
    const anchor = anchorAt(ctx.stageX, ctx.stageY);
    if (anchor) {
      if (ctx.alt) { toggleSmooth(anchor); mode = null; return; }
      undoSnapshot = RV.state.snapshot();
      if (ctx.shift) {
        const at = selection.findIndex(r => sameRef(r, anchor));
        if (at === -1) selection.push(anchor);
        else selection.splice(at, 1);
      } else if (!isSelected(anchor)) {
        selection = [anchor];
      }
      captureOrigin();
      mode = 'maybe';
      RV.state.emit('hover');
      return;
    }

    // 3. Ei kurve — sett inn eit nytt punkt der.
    if (targetId) {
      const onCurve = segmentAt(ctx.stageX, ctx.stageY);
      if (onCurve) {
        RV.state.pushUndo();
        selection = [insertPoint(onCurve)];
        captureOrigin();
        undoSnapshot = null;
        mode = 'maybe';
        RV.hit.invalidate();
        RV.state.emit('nodes');
        return;
      }
    }

    // 4. Ei anna form — ta henne i staden.
    const node = RV.hit.nodeAt(ctx.x, ctx.y);
    if (node) {
      const leaf = ctx.alt ? node : (RV.hit.outermost(node.id) || node);
      if (adopt(leaf.type === 'group' ? node : leaf)) {
        RV.state.setSelection([targetId]);
        RV.state.emit('selection');
        return;
      }
    }

    /* 5. Tom flate — dra ei ramme rundt punkt.
       Stien vi redigerer blir IKKJE sleppt her. Ei rammemarkering
       byrjar nesten alltid utanfor forma, og slepte vi stien med ein
       gong peikaren gjekk ned der, ville ramma aldri hatt punkt å ta. */
    if (!ctx.shift) selection = [];
    mode = 'marquee';
  }

  function toLocal(ctx) {
    if (!targetId) return { x: ctx.x, y: ctx.y };
    const inv = RV.matrix.invert(RV.state.worldMatrix(targetId));
    return inv ? RV.matrix.apply(inv, ctx.x, ctx.y) : { x: ctx.x, y: ctx.y };
  }

  function captureOrigin() {
    origin = subpaths().map(sp => sp.points.map(RV.geom.clonePoint));
  }

  function restore() {
    if (!origin) return;
    const list = subpaths();
    origin.forEach((points, s) => {
      if (!list[s]) return;
      points.forEach((p, i) => {
        if (list[s].points[i]) Object.assign(list[s].points[i], RV.geom.clonePoint(p));
      });
    });
  }

  function onMove(ctx) {
    if (!mode) {
      updateHover(ctx);
      return;
    }

    if (mode === 'maybe') {
      const far = Math.abs(ctx.stageX - start.x) > DRAG_SLOP ||
                  Math.abs(ctx.stageY - start.y) > DRAG_SLOP;
      if (!far) return;
      mode = 'points';
    }

    if (mode === 'points') dragPoints(ctx);
    else if (mode === 'handle') dragHandle(ctx);
    else if (mode === 'marquee') dragMarquee(ctx);
  }

  function updateHover(ctx) {
    const handle = handleAt(ctx.stageX, ctx.stageY);
    const anchor = handle ? null : anchorAt(ctx.stageX, ctx.stageY);
    const onCurve = (!handle && !anchor && targetId) ? segmentAt(ctx.stageX, ctx.stageY) : null;

    hover = onCurve ? { kind: 'curve', at: onCurve } : null;
    RV.tools.updateCursor(handle || anchor ? 'move' : (onCurve ? 'copy' : 'default'));
    RV.state.emit('hover');
  }

  function dragPoints(ctx) {
    restore();
    const local = toLocal(ctx);
    let dx = local.x - start.local.x;
    let dy = local.y - start.local.y;

    if (ctx.shift) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }

    selection.forEach((ref) => {
      const point = pointAt(ref);
      if (point) RV.geom.movePoint(point, dx, dy);
    });

    moved = true;
    RV.hit.invalidate();
    RV.state.emit('nodes');
  }

  /**
   * Dreg eit handtak. Er punktet mjukt, følgjer det andre handtaket med
   * på motsett side — det er nettopp det som gjer punktet mjukt. Alt
   * bryt sambandet for denne rørsla.
   */
  function dragHandle(ctx) {
    const point = pointAt(grabbed);
    if (!point) return;
    const local = toLocal(ctx);
    const which = grabbed.which;
    const other = which === 'i' ? 'o' : 'i';

    point[which + 'x'] = local.x;
    point[which + 'y'] = local.y;

    if (point.type === 'smooth' && !ctx.alt) {
      // Behald lengda på det andre handtaket, snu berre retninga.
      const dx = local.x - point.x;
      const dy = local.y - point.y;
      const len = Math.hypot(dx, dy) || 1;
      const otherLen = Math.hypot(point[other + 'x'] - point.x, point[other + 'y'] - point.y);
      point[other + 'x'] = point.x - (dx / len) * otherLen;
      point[other + 'y'] = point.y - (dy / len) * otherLen;
    } else if (ctx.alt) {
      point.type = 'corner';
    }

    moved = true;
    RV.hit.invalidate();
    RV.state.emit('nodes');
  }

  function dragMarquee(ctx) {
    const rect = {
      x: Math.min(start.x, ctx.stageX), y: Math.min(start.y, ctx.stageY),
      w: Math.abs(ctx.stageX - start.x), h: Math.abs(ctx.stageY - start.y)
    };
    RV.overlay.setMarquee(rect);

    selection = [];
    subpaths().forEach((sp, s) => {
      sp.points.forEach((p, i) => {
        const at = screen(p);
        if (at.x >= rect.x && at.x <= rect.x + rect.w &&
            at.y >= rect.y && at.y <= rect.y + rect.h) selection.push({ sp: s, pt: i });
      });
    });
    RV.state.emit('hover');
  }

  function onUp() {
    if (mode === 'marquee') {
      RV.overlay.setMarquee(null);
      // Fanga ramma ingen punkt, var dette eit klikk ut i det tomme —
      // og då slepper vi stien, slik brukaren venta i utgangspunktet.
      if (!selection.length) {
        targetId = null;
        RV.state.clearSelection();
        RV.state.emit('selection');
      }
      RV.state.emit('hover');
    } else if (moved && undoSnapshot) {
      RV.state.pushUndoSnapshot(undoSnapshot);
      RV.state.emit('nodes');
    }
    mode = null;
    grabbed = null;
    undoSnapshot = null;
    moved = false;
  }

  function onKey(e) {
    if (!targetId) return false;

    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
      removeSelected();
      return true;
    }

    if (e.key === 'Enter' && selection.length === 1) {
      toggleSmooth(selection[0]);
      return true;
    }

    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      selection = [];
      subpaths().forEach((sp, s) => sp.points.forEach((p, i) => selection.push({ sp: s, pt: i })));
      RV.state.emit('hover');
      return true;
    }

    // Piltastar flyttar dei valde punkta, ikkje heile forma.
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && selection.length) {
      const step = e.shiftKey ? 10 : 1;
      RV.state.pushUndo();
      selection.forEach((ref) => {
        const point = pointAt(ref);
        if (point) RV.geom.movePoint(point, arrows[e.key][0] * step, arrows[e.key][1] * step);
      });
      RV.hit.invalidate();
      RV.state.emit('nodes');
      return true;
    }

    return false;
  }

  function onEnter() {
    // Er alt éi form valt, går vi rett i gang med henne.
    const selected = RV.state.selectedNodes();
    if (selected.length === 1) adopt(selected[0]);
    RV.state.emit('hover');
  }

  function onLeave() {
    selection = [];
    targetId = null;
    mode = null;
    hover = null;
  }

  function onCancel() {
    if (moved) { restore(); RV.hit.invalidate(); RV.state.emit('nodes'); }
    RV.overlay.setMarquee(null);
    selection = [];
    mode = null;
    grabbed = null;
    moved = false;
  }

  /* ──────────────── Teikning i overlegget ──────────────── */

  RV.overlay.addHook(function (layer) {
    const active = RV.tools.active();
    if (!active || active.id !== 'node' || !targetId) return;
    const node = target();
    if (!node || node.type !== 'path') return;

    const m = RV.overlay.screenMatrix(targetId);
    const toS = p => RV.matrix.apply(m, p.x, p.y);
    const r = RV.matrix.round;

    // Sjølve stien, teikna tynt oppå, så punkta har noko å sitje på.
    const world = RV.geom.transformSubpaths(node.geom.subpaths, m);
    layer.appendChild(RV.util.svg('path', {
      class: 'rv-node-path', d: RV.geom.toPathData(world)
    }));

    // Handtaka til dei valde punkta.
    selection.forEach((ref) => {
      const point = pointAt(ref);
      if (!point) return;
      const a = toS(point);
      [['i', point.ix, point.iy], ['o', point.ox, point.oy]].forEach((arm) => {
        if (arm[1] === point.x && arm[2] === point.y) return;
        const s = toS({ x: arm[1], y: arm[2] });
        layer.appendChild(RV.util.svg('line', {
          class: 'rv-handle-arm', x1: r(a.x), y1: r(a.y), x2: r(s.x), y2: r(s.y)
        }));
        layer.appendChild(RV.util.svg('circle', {
          class: 'rv-handle-dot', cx: r(s.x), cy: r(s.y), r: 4
        }));
      });
    });

    // Ankerpunkta. Mjuke punkt er runde, hjørne er firkanta — forma på
    // punktet fortel kva slag punkt det er, utan at noko må forklarast.
    node.geom.subpaths.forEach((sp, s) => {
      sp.points.forEach((p, i) => {
        const at = toS(p);
        const on = isSelected({ sp: s, pt: i });
        layer.appendChild(RV.util.svg('rect', {
          class: 'rv-node' + (on ? ' rv-node-selected' : '') +
                 (p.type === 'smooth' ? ' rv-node-smooth' : ''),
          x: r(at.x - 4), y: r(at.y - 4), width: 8, height: 8,
          rx: p.type === 'smooth' ? 4 : 0
        }));
      });
    });

    // Der eit nytt punkt vil hamne om ein klikkar no.
    if (hover && hover.kind === 'curve' && !mode) {
      const at = toS(hover.at.point);
      layer.appendChild(RV.util.svg('circle', {
        class: 'rv-node-insert', cx: r(at.x), cy: r(at.y), r: 5
      }));
    }
  });

  RV.tools.register({
    id: 'node',
    name: 'Punkt',
    hint: 'Dra i ankerpunkt og handtak. Klikk på ei kurve for å setje inn eit punkt, Alt-klikk på eit punkt for å veksle mellom hjørne og mjukt, Delete for å ta det bort.',
    icon: 'anchor',
    key: 'a',
    level: 'advanced',
    cursor: 'default',
    hidesFrame: true,
    onDown: onDown,
    onMove: onMove,
    onUp: onUp,
    onKey: onKey,
    onEnter: onEnter,
    onLeave: onLeave,
    onCancel: onCancel
  });
})();
