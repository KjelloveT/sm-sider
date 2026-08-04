/* ══════════════════════════════════════════════
   FREEHAND.JS — Teikn på frihand

   Ei rå musespor har hundrevis av punkt, dei fleste av dei støy frå
   handa og frå oppløysinga på peikaren. Legg vi dei rett inn i modellen,
   får vi ei sti som er umogleg å redigere node for node etterpå, og ei
   SVG-fil på hundre kilobyte for ein enkel strek.

   Difor to steg når streken slepp:
     1. Ryddar bort punkt som ikkje seier noko nytt om forma
        (Ramer–Douglas–Peucker).
     2. Gjev dei som står att mjuke handtak (Catmull-Rom), så streken
        blir ei kurve og ikkje ein serie rette hakk.

   Toleransen følgjer zoomnivået. Teiknar brukaren langt inn, meiner han
   detaljane sine, og då skal dei ikkje rundast bort.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

(function () {
  'use strict';

  const MIN_STEP = 1.5;      // px på skjermen mellom to lagra punkt
  const SIMPLIFY = 1.6;      // px på skjermen — kor mykje forma kan rette seg ut

  let points = null;
  let current = null;
  let undoSnapshot = null;

  /* ──────────────── Forenkling ──────────────── */

  /**
   * Ramer–Douglas–Peucker: hald punktet som ligg lengst frå den rette
   * linja mellom endane, og gjenta på kvar side. Ligg ingen lenger unna
   * enn toleransen, er heile stykket rett nok til å bli éi linje.
   */
  function simplify(pts, tol) {
    if (pts.length < 3) return pts.slice();

    const keep = new Array(pts.length).fill(false);
    keep[0] = true;
    keep[pts.length - 1] = true;

    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const range = stack.pop();
      const first = range[0], last = range[1];
      let worst = 0;
      let at = -1;

      for (let i = first + 1; i < last; i++) {
        const d = RV.geom.distanceToSegment(
          pts[i].x, pts[i].y, pts[first].x, pts[first].y, pts[last].x, pts[last].y);
        if (d > worst) { worst = d; at = i; }
      }

      if (worst > tol && at !== -1) {
        keep[at] = true;
        stack.push([first, at], [at, last]);
      }
    }

    return pts.filter((p, i) => keep[i]);
  }

  /**
   * Catmull-Rom-handtak: kvart punkt får ein tangent som peikar langs
   * linja mellom naboane sine. Det gjev ei kurve som går gjennom alle
   * punkta og likevel er mjuk i kvart av dei.
   */
  function toSmoothSubpath(pts) {
    const out = pts.map(p => RV.geom.makePoint(p.x, p.y, 'smooth'));
    const n = out.length;

    for (let i = 0; i < n; i++) {
      const prev = out[i - 1] || out[i];
      const next = out[i + 1] || out[i];
      const dx = (next.x - prev.x) / 6;
      const dy = (next.y - prev.y) / 6;
      out[i].ox = out[i].x + dx;
      out[i].oy = out[i].y + dy;
      out[i].ix = out[i].x - dx;
      out[i].iy = out[i].y - dy;
    }

    // Endane har ingen nabo på utsida — la handtaka deira liggje i ro.
    if (n) {
      out[0].ix = out[0].x; out[0].iy = out[0].y;
      out[n - 1].ox = out[n - 1].x; out[n - 1].oy = out[n - 1].y;
    }
    return RV.geom.makeSubpath(out, false);
  }

  /* ──────────────── Draget ──────────────── */

  function onDown(ctx) {
    undoSnapshot = RV.state.snapshot();
    points = [{ x: ctx.x, y: ctx.y }];

    const node = RV.state.makeNode('path', { subpaths: [] });
    node.name = 'Strek';
    // Ein frihandsstrek er ein STREK. Fyll ville lagt seg som ei flate
    // mellom start og slutt, som aldri er det brukaren ville.
    node.fill = { type: 'none' };
    if (!node.stroke || node.stroke.type === 'none') {
      node.stroke = { type: 'solid', color: '#1a1a1a', opacity: 1, width: 2, dash: '', cap: 'round', join: 'round' };
    } else {
      node.stroke.cap = 'round';
      node.stroke.join = 'round';
    }

    RV.state.add(node, null);
    current = node;
    RV.state.setSelection([node.id]);
    RV.state.emit('nodes');
  }

  function onMove(ctx) {
    if (!current) return;
    const last = points[points.length - 1];
    if (Math.hypot(ctx.x - last.x, ctx.y - last.y) < RV.view.docLength(MIN_STEP)) return;

    points.push({ x: ctx.x, y: ctx.y });

    // Medan brukaren teiknar viser vi den rå streken. Utjamninga kjem
    // når han slepp — å jamne ut for kvart punkt ville fått streken til
    // å krype etter peikaren.
    current.geom.subpaths = [RV.geom.makeSubpath(
      points.map(p => RV.geom.makePoint(p.x, p.y)), false)];
    RV.hit.invalidate();
    RV.state.emit('nodes');
  }

  function onUp(ctx) {
    if (!current) return;

    if (points.length < 2) {
      RV.state.remove(current.id);
    } else {
      const tol = RV.view.docLength(SIMPLIFY);
      current.geom.subpaths = [toSmoothSubpath(simplify(points, tol))];
      RV.state.pushUndoSnapshot(undoSnapshot);
    }

    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');

    current = null;
    points = null;
    undoSnapshot = null;
    if (ctx && !ctx.alt) RV.tools.setActive('select');
  }

  function onCancel() {
    if (current) {
      RV.state.remove(current.id);
      RV.hit.invalidate();
      RV.state.emit('nodes');
    }
    current = null;
    points = null;
    undoSnapshot = null;
  }

  RV.tools.register({
    id: 'freehand',
    name: 'Frihand',
    hint: 'Teikn med peikaren. Streken blir jamna ut når du slepp.',
    icon: 'pencil',
    key: 'b',
    level: 'basic',
    cursor: 'crosshair',
    onDown: onDown,
    onMove: onMove,
    onUp: onUp,
    onCancel: onCancel
  });
})();
