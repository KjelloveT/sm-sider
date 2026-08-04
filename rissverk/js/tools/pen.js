/* ══════════════════════════════════════════════
   PEN.JS — Teikn stiar punkt for punkt

   Pennen er det verktøyet som har flest tilstandar, og difor det som
   lettast blir uforståeleg om ein lèt tilstanden liggje spreidd i
   variablar. Han er difor skriven som ei EKSPLISITT tilstandsmaskin med
   tre tilstandar:

     idle    — ingen sti er i gang
     placing — vi har ein sti og ventar på neste punkt
     pulling — peikaren er nede og dreg ut handtaka til det siste punktet

   Skilnaden mellom eit hjørne og eit mjukt punkt er ikkje eit val
   brukaren tek i ein meny: klikkar han, får han eit hjørne; dreg han,
   får han ei kurve. Det er den same rørsla som i alle andre
   vektorprogram, og ho er verd å halde seg til av di folk har henne i
   fingrane frå før.

   Handtaka blir SPEGLA medan ein dreg, så kurva går jamt gjennom punktet.
   Held ein Alt, blir spegelen broten og punktet får ein knekk — det er
   slik ein lagar ein spiss midt i ei kurve.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

(function () {
  'use strict';

  const CLOSE_RADIUS = 9;    // px — kor nær startpunktet ein må klikke for å lukke
  const DRAG_SLOP = 3;       // px før eit klikk blir rekna som ei dra

  let mode = 'idle';
  let nodeId = null;         // stien vi held på med
  let subpath = null;        // delstien vi legg punkt i
  let atStart = false;       // legg vi til framfrå i staden for bakfrå?
  let downAt = null;         // skjermpunktet der peikaren gjekk ned
  let pointer = null;        // siste kjende peikarposisjon, i lokale koordinatar
  let undoSnapshot = null;
  let hoverClose = false;    // ligg peikaren over startpunktet?

  /* ──────────────── Koordinatar ──────────────── */

  /*
   * Punkta blir lagra i stien sitt EIGNE koordinatsystem. Held brukaren
   * fram på ein sti som ligg i ei rotert gruppe, må kvart nytt punkt
   * reknast inn dit — elles ville stien fått eit knekk i det han gjekk
   * frå gamle til nye punkt.
   */
  function toLocal(ctx) {
    if (!nodeId) return { x: ctx.x, y: ctx.y };
    const inv = RV.matrix.invert(RV.state.worldMatrix(nodeId));
    return inv ? RV.matrix.apply(inv, ctx.x, ctx.y) : { x: ctx.x, y: ctx.y };
  }

  function toScreen(pt) {
    const m = RV.overlay.screenMatrix(nodeId);
    return RV.matrix.apply(m, pt.x, pt.y);
  }

  /** Enden vi byggjer frå — siste punkt, eller det første når vi går bakover. */
  function tip() {
    if (!subpath || !subpath.points.length) return null;
    return atStart ? subpath.points[0] : subpath.points[subpath.points.length - 1];
  }

  function firstPoint() {
    return subpath && subpath.points.length ? (atStart ? subpath.points[subpath.points.length - 1] : subpath.points[0]) : null;
  }

  /* ──────────────── Plassering av punkt ──────────────── */

  /**
   * Kvar punktet skal liggje.
   * Skift låser til 45°-vinklar frå det førre punktet — det er slik ein
   * får rette og halvskrå linjer utan å sikte.
   */
  function placeAt(ctx) {
    const local = toLocal(ctx);
    const anchor = tip();

    if (ctx.shift && anchor) {
      const dx = local.x - anchor.x;
      const dy = local.y - anchor.y;
      const len = Math.hypot(dx, dy);
      const step = Math.PI / 4;
      const angle = Math.round(Math.atan2(dy, dx) / step) * step;
      return { x: anchor.x + Math.cos(angle) * len, y: anchor.y + Math.sin(angle) * len };
    }

    // Snappinga arbeider i dokumentrommet; er stien transformert, må
    // vi innom det og tilbake att.
    const snapped = RV.snap.point(RV.view.snapPoint({ x: ctx.x, y: ctx.y }), ctx.ctrl);
    if (snapped.x === ctx.x && snapped.y === ctx.y) return local;
    return toLocal({ x: snapped.x, y: snapped.y });
  }

  /* ──────────────── Ny og eksisterande sti ──────────────── */

  function startPath(ctx) {
    undoSnapshot = RV.state.snapshot();

    const node = RV.state.makeNode('path', { subpaths: [] });
    node.name = 'Sti';
    // Ein open sti med fyll ser ut som ein feil medan han blir teikna.
    // Fyllet kjem tilbake av seg sjølv når brukaren lukkar stien.
    node.fill = { type: 'none' };
    if (!node.stroke || node.stroke.type === 'none') {
      node.stroke = { type: 'solid', color: '#1a1a1a', opacity: 1, width: 2, dash: '', cap: 'round', join: 'round' };
    }

    subpath = RV.geom.makeSubpath([], false);
    node.geom.subpaths = [subpath];
    RV.state.add(node, null);
    nodeId = node.id;
    atStart = false;

    RV.state.setSelection([node.id]);
    RV.state.emit('selection');
  }

  /**
   * Kan vi halde fram på ein sti som alt finst?
   * Berre frå ein open ENDE — å byrje midt i ville tydd å dele stien,
   * og det høyrer heime i node-verktøyet.
   */
  function tryContinue(ctx) {
    const selected = RV.state.selectedNodes();
    if (selected.length !== 1 || selected[0].type !== 'path') return false;

    const node = selected[0];
    const reach = RV.view.docLength(CLOSE_RADIUS);
    const m = RV.state.worldMatrix(node.id);

    for (let i = 0; i < node.geom.subpaths.length; i++) {
      const sp = node.geom.subpaths[i];
      if (sp.closed || sp.points.length < 1) continue;

      const ends = [
        { pt: sp.points[sp.points.length - 1], fromStart: false },
        { pt: sp.points[0], fromStart: true }
      ];
      for (let e = 0; e < ends.length; e++) {
        const world = RV.matrix.apply(m, ends[e].pt.x, ends[e].pt.y);
        if (Math.hypot(world.x - ctx.x, world.y - ctx.y) <= reach) {
          undoSnapshot = RV.state.snapshot();
          nodeId = node.id;
          subpath = sp;
          atStart = ends[e].fromStart;
          mode = 'placing';
          return true;
        }
      }
    }
    return false;
  }

  /* ──────────────── Peikar ──────────────── */

  function onDown(ctx) {
    downAt = { x: ctx.stageX, y: ctx.stageY };

    if (mode === 'idle') {
      if (!tryContinue(ctx)) startPath(ctx);
      // Stien vi teiknar skal ikkje snappe til seg sjølv.
      RV.snap.begin([nodeId]);
    }

    // Klikk på startpunktet lukkar stien.
    if (subpath.points.length >= 2 && nearFirst(ctx)) {
      closePath();
      return;
    }

    const at = placeAt(ctx);
    const point = RV.geom.makePoint(at.x, at.y, 'corner');
    if (atStart) subpath.points.unshift(point);
    else subpath.points.push(point);

    mode = 'pulling';
    pointer = at;
    RV.hit.invalidate();
    RV.state.emit('nodes');
  }

  function nearFirst(ctx) {
    const first = firstPoint();
    if (!first) return false;
    const s = toScreen(first);
    return Math.hypot(ctx.stageX - s.x, ctx.stageY - s.y) <= CLOSE_RADIUS + 3;
  }

  function onMove(ctx) {
    if (mode === 'idle') {
      RV.tools.updateCursor(tryContinueHover(ctx) ? 'copy' : 'crosshair');
      return;
    }

    pointer = placeAt(ctx);

    if (mode === 'pulling' && downAt) {
      const far = Math.abs(ctx.stageX - downAt.x) > DRAG_SLOP ||
                  Math.abs(ctx.stageY - downAt.y) > DRAG_SLOP;
      if (far) pullHandles(ctx);
    }

    hoverClose = subpath && subpath.points.length >= 2 && nearFirst(ctx);
    RV.tools.updateCursor(hoverClose ? 'pointer' : 'crosshair');
    RV.state.emit('hover');
  }

  /** Er det ein open ende å halde fram frå under peikaren? */
  function tryContinueHover(ctx) {
    const selected = RV.state.selectedNodes();
    if (selected.length !== 1 || selected[0].type !== 'path') return false;
    const node = selected[0];
    const reach = RV.view.docLength(CLOSE_RADIUS);
    const m = RV.state.worldMatrix(node.id);
    return node.geom.subpaths.some((sp) => {
      if (sp.closed || !sp.points.length) return false;
      return [sp.points[0], sp.points[sp.points.length - 1]].some((p) => {
        const w = RV.matrix.apply(m, p.x, p.y);
        return Math.hypot(w.x - ctx.x, w.y - ctx.y) <= reach;
      });
    });
  }

  /**
   * Dreg ut handtaka til det siste punktet.
   * Handtaket som peikar FRAMOVER følgjer peikaren; det bakover blir
   * spegla om punktet, så kurva går jamt gjennom. Alt bryt spegelen.
   */
  function pullHandles(ctx) {
    const point = tip();
    if (!point) return;
    const at = placeAt(ctx);

    const forward = atStart ? 'i' : 'o';
    const backward = atStart ? 'o' : 'i';

    point[forward + 'x'] = at.x;
    point[forward + 'y'] = at.y;

    if (ctx.alt) {
      point.type = 'corner';
    } else {
      point.type = 'smooth';
      point[backward + 'x'] = point.x - (at.x - point.x);
      point[backward + 'y'] = point.y - (at.y - point.y);
    }

    RV.hit.invalidate();
    RV.state.emit('nodes');
  }

  function onUp() {
    if (mode === 'pulling') mode = 'placing';
    downAt = null;
  }

  /* ──────────────── Avslutning ──────────────── */

  function closePath() {
    if (!subpath) return;
    subpath.closed = true;
    // Ein lukka sti er ei flate. Han fortener fyllet han blei nekta
    // medan han var open.
    const node = RV.state.get(nodeId);
    if (node && node.fill.type === 'none') {
      const style = RV.state.data.style.fill;
      if (style && style.type !== 'none') node.fill = JSON.parse(JSON.stringify(style));
    }
    finish();
  }

  /** Legg frå seg pennen. Stien blir verande slik han er. */
  function finish() {
    if (nodeId) {
      const node = RV.state.get(nodeId);
      // Ein sti med eitt einaste punkt er ingen sti — han er eit uhell.
      if (node && subpath && subpath.points.length < 2) {
        RV.state.remove(nodeId);
      } else if (undoSnapshot) {
        RV.state.pushUndoSnapshot(undoSnapshot);
      }
    }
    reset();
    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
  }

  function onCancel() {
    if (mode === 'idle') return;
    // Escape kastar ikkje stien — han avsluttar han. Å miste alt arbeidet
    // på ein tast ville vore ei hard straff for eit feiltrykk.
    finish();
  }

  function reset() {
    RV.snap.end();
    mode = 'idle';
    nodeId = null;
    subpath = null;
    atStart = false;
    downAt = null;
    pointer = null;
    undoSnapshot = null;
    hoverClose = false;
  }

  function onKey(e) {
    if (mode === 'idle') return false;
    if (e.key === 'Enter') { finish(); return true; }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      // Angre siste punkt, ikkje slett heile stien.
      if (subpath.points.length > 1) {
        if (atStart) subpath.points.shift();
        else subpath.points.pop();
        RV.hit.invalidate();
        RV.state.emit('nodes');
      } else {
        finish();
      }
      return true;
    }
    return false;
  }

  /* ──────────────── Teikning i overlegget ──────────────── */

  RV.overlay.addHook(function (layer) {
    if (mode === 'idle' || !subpath) return;

    const m = RV.overlay.screenMatrix(nodeId);
    const toS = p => RV.matrix.apply(m, p.x, p.y);

    // Gummistreken fram til peikaren, med den kurva han faktisk får.
    const anchor = tip();
    if (anchor && pointer && mode === 'placing') {
      const a = toS(anchor);
      const b = toS(pointer);
      const c1 = toS({ x: atStart ? anchor.ix : anchor.ox, y: atStart ? anchor.iy : anchor.oy });
      layer.appendChild(RV.util.svg('path', {
        class: 'rv-pen-preview',
        d: 'M ' + a.x + ' ' + a.y + ' C ' + c1.x + ' ' + c1.y + ' ' + b.x + ' ' + b.y + ' ' + b.x + ' ' + b.y
      }));
    }

    // Handtaka til punktet som blir drege.
    if (anchor && anchor.type === 'smooth') drawHandles(layer, toS, anchor);

    subpath.points.forEach((p, i) => {
      const s = toS(p);
      const isFirst = p === firstPoint();
      layer.appendChild(RV.util.svg('rect', {
        class: 'rv-node' + (isFirst && hoverClose ? ' rv-node-close' : '') +
               (p.type === 'smooth' ? ' rv-node-smooth' : ''),
        x: RV.matrix.round(s.x - 4), y: RV.matrix.round(s.y - 4),
        width: 8, height: 8,
        rx: p.type === 'smooth' ? 4 : 0
      }));
    });
  });

  function drawHandles(layer, toS, p) {
    const a = toS(p);
    [[p.ix, p.iy], [p.ox, p.oy]].forEach((h) => {
      if (h[0] === p.x && h[1] === p.y) return;
      const s = toS({ x: h[0], y: h[1] });
      layer.appendChild(RV.util.svg('line', {
        class: 'rv-handle-arm',
        x1: RV.matrix.round(a.x), y1: RV.matrix.round(a.y),
        x2: RV.matrix.round(s.x), y2: RV.matrix.round(s.y)
      }));
      layer.appendChild(RV.util.svg('circle', {
        class: 'rv-handle-dot',
        cx: RV.matrix.round(s.x), cy: RV.matrix.round(s.y), r: 4
      }));
    });
  }

  RV.tools.register({
    id: 'pen',
    name: 'Penn',
    hint: 'Klikk for hjørne, dra for kurve. Klikk på startpunktet for å lukke stien, Enter for å avslutte han open. Alt medan du dreg gjev eit knekk.',
    icon: 'feather',
    key: 'p',
    level: 'advanced',
    cursor: 'crosshair',
    hidesFrame: true,
    onDown: onDown,
    onMove: onMove,
    onUp: onUp,
    onKey: onKey,
    onCancel: onCancel,
    onLeave: finish
  });
})();
