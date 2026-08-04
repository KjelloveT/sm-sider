/* ══════════════════════════════════════════════
   HIT.JS — Kva ligg under peikaren?

   Treffdeteksjonen går på GEOMETRIEN, ikkje via nettlesaren sin eigen.
   Det kostar litt meir kode, men gjev oss reglar nettlesaren ikkje har:
   låste lag skal ikkje kunne plukkast, usynlege heller ikkje, ei form
   utan fyll skal kunne takast på streken, og eit klikk inni ei gruppe
   skal velje gruppa og ikkje forma.

   Formene blir flata ut til punktlister og lagra i eit buffer. Utan det
   ville kvar musrørsle rekna om alle kurvene i teikninga på nytt.
   Bufferet blir kasta når noko endrar seg i modellen.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.hit = (function () {
  'use strict';

  /** node-id → { polys, closed, strokeHalf } i dokumentkoordinatar. */
  let cache = new Map();

  function invalidate() {
    cache = new Map();
  }

  /* ──────────────── Flating med buffer ──────────────── */

  function shapeOf(node) {
    let entry = cache.get(node.id);
    if (entry) return entry;

    const world = RV.state.worldMatrix(node.id);
    const subpaths = RV.geom.toSubpaths(node);
    if (!subpaths.length) return null;

    const worldSubpaths = RV.geom.transformSubpaths(subpaths, world);
    // Toleransen er fast i dokumenteiningar. Han treng ikkje følgje zoomen:
    // eit avvik på ein kvart eining er langt under det ein klikk kan skilje.
    const polys = RV.geom.flattenSubpaths(worldSubpaths, 0.25);

    const scale = RV.matrix.meanScale(world);
    const strokeWidth = (node.stroke && node.stroke.type !== 'none') ? (node.stroke.width || 0) : 0;

    entry = {
      polys: polys,
      closed: subpaths.length ? subpaths[0].closed : false,
      strokeHalf: (strokeWidth * scale) / 2,
      bounds: RV.geom.boundsOfSubpaths(worldSubpaths)
    };
    cache.set(node.id, entry);
    return entry;
  }

  /* ──────────────── Kan noden plukkast? ──────────────── */

  function pickable(node) {
    if (!node || !node.visible || node.locked) return false;
    // Ein forelder som er låst eller skjult låser alt inni seg.
    let p = node.parent ? RV.state.get(node.parent) : null;
    while (p) {
      if (!p.visible || p.locked) return false;
      p = p.parent ? RV.state.get(p.parent) : null;
    }
    return true;
  }

  /* ──────────────── Punkt ──────────────── */

  /**
   * Treffer punktet denne noden?
   * @param {number} slop klikkslark i dokumenteiningar
   */
  function hitsNode(node, x, y, slop) {
    if (node.type === 'group') return false;

    /* Bilete og tekst har inga sti-geometri å treffe på. Dei blir tekne
       på RAMMA si — for tekst er det dessutan det brukaren ventar: ein
       vil kunne klikke i mellomrommet mellom to bokstavar og treffe
       teksten, ikkje bomme mellom dei. */
    if (node.type === 'image' || node.type === 'text' || node.type === 'use') {
      const box = RV.state.localBounds(node);
      if (!box) return false;
      const inv = RV.matrix.invert(RV.state.worldMatrix(node.id));
      if (!inv) return false;
      const p = RV.matrix.apply(inv, x, y);
      return p.x >= box.x - slop && p.x <= box.x + box.w + slop &&
             p.y >= box.y - slop && p.y <= box.y + box.h + slop;
    }

    const shape = shapeOf(node);
    if (!shape) return false;

    // Grov avvising først — dei aller fleste nodane ligg ikkje i nærleiken.
    const b = shape.bounds;
    const pad = slop + shape.strokeHalf;
    if (x < b.x - pad || x > b.x + b.w + pad || y < b.y - pad || y > b.y + b.h + pad) return false;

    const hasFill = node.fill && node.fill.type !== 'none';
    if (hasFill && shape.closed && RV.geom.pointInPolygons(shape.polys, x, y)) return true;

    // Streken, eller — for former utan fyll og strek — sjølve omrisset,
    // så eit usynleg objekt framleis kan plukkast opp att.
    const reach = Math.max(shape.strokeHalf, 0) + slop;
    return RV.geom.distanceToPolygons(shape.polys, x, y, shape.closed) <= reach;
  }

  /**
   * Noden under punktet, fremst først.
   * @returns {object|null} sjølve forma, ikkje gruppa ho ligg i
   */
  function nodeAt(x, y, slopPx) {
    const slop = RV.view.docLength(slopPx == null ? 5 : slopPx);
    let found = null;

    function scan(ids) {
      // Bakfrå og fram: det som er teikna sist ligg øvst.
      for (let i = ids.length - 1; i >= 0 && !found; i--) {
        const node = RV.state.get(ids[i]);
        if (!node || !node.visible) continue;
        if (node.type === 'group') {
          // Ei maskert gruppe kan berre treffast innanfor maska — det
          // som ligg utanfor er ikkje synleg, og skal heller ikkje
          // kunne plukkast opp av eit klikk.
          if (node.clip && !insideClip(node, x, y)) continue;
          scan(RV.state.listOf(node.id));
        } else if (hitsNode(node, x, y, slop)) {
          found = node;
        }
      }
    }

    scan(RV.state.data.root);
    return found && pickable(found) ? found : null;
  }

  function insideClip(node, x, y) {
    const inv = RV.matrix.invert(RV.state.worldMatrix(node.id));
    if (!inv) return true;
    const p = RV.matrix.apply(inv, x, y);
    const subpaths = RV.geom.transformSubpaths(
      RV.geom.toSubpaths(node.clip), node.clip.transform);
    if (!subpaths.length) return true;
    return RV.geom.pointInPolygons(RV.geom.flattenSubpaths(subpaths, 0.5), p.x, p.y);
  }

  /**
   * Den ytste gruppa noden ligg i — det brukaren ventar å velje ved
   * eit vanleg klikk. Ligg han ikkje i noka gruppe, er det han sjølv.
   */
  function outermost(id) {
    let node = RV.state.get(id);
    if (!node) return null;
    while (node.parent && RV.state.get(node.parent)) node = RV.state.get(node.parent);
    return node;
  }

  /* ──────────────── Rammemarkering ──────────────── */

  function segmentCrossesRect(ax, ay, bx, by, r) {
    const x1 = r.x, y1 = r.y, x2 = r.x + r.w, y2 = r.y + r.h;
    // Begge endane på same sida av ei kant: kan ikkje krysse.
    if ((ax < x1 && bx < x1) || (ax > x2 && bx > x2) ||
        (ay < y1 && by < y1) || (ay > y2 && by > y2)) return false;
    if ((ax >= x1 && ax <= x2 && ay >= y1 && ay <= y2)) return true;
    if ((bx >= x1 && bx <= x2 && by >= y1 && by <= y2)) return true;

    const sides = [
      [x1, y1, x2, y1], [x2, y1, x2, y2],
      [x2, y2, x1, y2], [x1, y2, x1, y1]
    ];
    return sides.some(s => segmentsCross(ax, ay, bx, by, s[0], s[1], s[2], s[3]));
  }

  function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = cross(cx, cy, dx, dy, ax, ay);
    const d2 = cross(cx, cy, dx, dy, bx, by);
    const d3 = cross(ax, ay, bx, by, cx, cy);
    const d4 = cross(ax, ay, bx, by, dx, dy);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  function cross(ax, ay, bx, by, px, py) {
    return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  }

  /**
   * Nodane som ramma tek. Vi går berre på øvste nivå: ei gruppe blir
   * teken eller ikkje teken som heilheit, slik brukaren ser henne.
   *
   * `contain` krev at heile forma ligg inne. Standard er å ta alt ramma
   * så mykje som rører — det er lettare å treffe, og det er slik dei
   * fleste teikneprogram gjer det.
   */
  function nodesInRect(rect, contain) {
    const out = [];

    RV.state.data.root.forEach((id) => {
      const node = RV.state.get(id);
      if (!node || !pickable(node)) return;
      const bounds = RV.state.worldBounds(id);
      if (!bounds || !RV.geom.rectsOverlap(rect, bounds)) return;

      if (contain) {
        if (RV.geom.rectContains(rect, bounds)) out.push(id);
        return;
      }
      if (touchesRect(node, rect)) out.push(id);
    });

    return out;
  }

  /** Rører noden — eller noko inni henne — ramma? */
  function touchesRect(node, rect) {
    if (node.type === 'group') {
      return RV.state.listOf(node.id).some((cid) => {
        const child = RV.state.get(cid);
        if (!child || !child.visible) return false;
        const b = RV.state.worldBounds(cid);
        return b && RV.geom.rectsOverlap(rect, b) && touchesRect(child, rect);
      });
    }

    const bounds = RV.state.worldBounds(node.id);
    if (!bounds) return false;
    // Ramma omsluttar forma heilt — då rører ho sjølvsagt.
    if (RV.geom.rectContains(rect, bounds)) return true;

    if (node.type === 'image' || node.type === 'text') return RV.geom.rectsOverlap(rect, bounds);

    const shape = shapeOf(node);
    if (!shape) return false;

    // Eit fylt objekt som ligg heilt rundt ramma tel òg som treft.
    if (node.fill && node.fill.type !== 'none' && shape.closed &&
        RV.geom.pointInPolygons(shape.polys, rect.x, rect.y)) return true;

    return shape.polys.some((poly) => {
      const n = poly.length;
      const stop = shape.closed ? n : n - 1;
      for (let i = 0; i < stop; i++) {
        const a = poly[i], b = poly[(i + 1) % n];
        if (segmentCrossesRect(a.x, a.y, b.x, b.y, rect)) return true;
      }
      return false;
    });
  }

  return { invalidate, nodeAt, nodesInRect, outermost, pickable, hitsNode };
})();
