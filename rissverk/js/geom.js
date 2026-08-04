/* ══════════════════════════════════════════════
   GEOM.JS — Kurver, former og treff for Rissverk

   Éin representasjon for alt: kubiske bézier-kurver. Ellipsar, avrunda
   hjørne, bogar frå importerte filer og kvadratiske kurver blir alle
   rekna om hit ved første høve.

   Grunnen er at kvar ekstra kurvetype doblar arbeidet i alle modulane
   som kjem etterpå. Node-redigering, deling, treffdeteksjon, flating og
   boolske operasjonar må elles kvar for seg kunne alle typane, og kvar
   kombinasjon er ein ny sjanse til å ta feil. Ei ellipse teikna med
   fire kubiske kurver er umerkeleg frå ei ekte ellipse på skjermen, og
   ho kan redigerast node for node som alt anna.

   Ein sti er ei liste av delstiar:
     { closed: bool, points: [ { x, y, ix, iy, ox, oy, type } ] }
   Handtaka ix/iy og ox/oy er ABSOLUTTE koordinatar, ikkje avstandar
   frå punktet. Det gjer teikning, deling og transformasjon rett fram —
   ein matrise kan leggjast på alle tre punkta likt — mot at flytting av
   eit punkt må hugse å flytte handtaka sine med.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.geom = (function () {
  'use strict';

  /* Magisk tal for å teikne ein kvartsirkel med ei kubisk kurve.
     4/3·(√2−1) — feilen er under 0,02 % av radien. */
  const KAPPA = 0.5522847498307936;

  /* ──────────────── Punkt og delstiar ──────────────── */

  function makePoint(x, y, type) {
    return { x: x, y: y, ix: x, iy: y, ox: x, oy: y, type: type || 'corner' };
  }

  function makeSubpath(points, closed) {
    return { closed: !!closed, points: points || [] };
  }

  function clonePoint(p) {
    return { x: p.x, y: p.y, ix: p.ix, iy: p.iy, ox: p.ox, oy: p.oy, type: p.type };
  }

  function cloneSubpaths(subpaths) {
    return subpaths.map(sp => makeSubpath(sp.points.map(clonePoint), sp.closed));
  }

  /** Flyttar eit punkt og tek handtaka med seg. */
  function movePoint(p, dx, dy) {
    p.x += dx; p.y += dy;
    p.ix += dx; p.iy += dy;
    p.ox += dx; p.oy += dy;
    return p;
  }

  function transformSubpaths(subpaths, m) {
    const apply = RV.matrix.apply;
    return subpaths.map(sp => makeSubpath(sp.points.map((p) => {
      const a = apply(m, p.x, p.y);
      const i = apply(m, p.ix, p.iy);
      const o = apply(m, p.ox, p.oy);
      return { x: a.x, y: a.y, ix: i.x, iy: i.y, ox: o.x, oy: o.y, type: p.type };
    }), sp.closed));
  }

  /**
   * Segmenta i ei delsti, som firer av kontrollpunkt.
   * Ei lukka delsti får eit segment til frå siste punkt tilbake til det
   * første — det er nettopp det «lukka» tyder.
   */
  function segments(sp) {
    const out = [];
    const pts = sp.points;
    for (let i = 0; i < pts.length - 1; i++) {
      out.push([pts[i], pts[i + 1]]);
    }
    if (sp.closed && pts.length > 1) out.push([pts[pts.length - 1], pts[0]]);
    return out;
  }

  /** Er segmentet ei rett linje? Då kan vi skrive L i staden for C. */
  function isStraight(a, b) {
    return near(a.ox, a.x) && near(a.oy, a.y) && near(b.ix, b.x) && near(b.iy, b.y);
  }

  function near(u, v) {
    return Math.abs(u - v) < 1e-7;
  }

  /* ──────────────── Kubiske kurver ──────────────── */

  function cubicAt(x0, y0, x1, y1, x2, y2, x3, y3, t) {
    const u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return {
      x: a * x0 + b * x1 + c * x2 + d * x3,
      y: a * y0 + b * y1 + c * y2 + d * y3
    };
  }

  /**
   * Deler ei kubisk kurve i to ved parameteren t (de Casteljau).
   * Dette er grunnlaget for «legg til punkt på kurva»: begge halvdelane
   * følgjer nøyaktig same bane som originalen, så forma rikkar seg ikkje
   * ein piksel når brukaren set inn eit nytt ankerpunkt.
   */
  function splitCubic(x0, y0, x1, y1, x2, y2, x3, y3, t) {
    const lerp = (a, b) => a + (b - a) * t;
    const ax = lerp(x0, x1), ay = lerp(y0, y1);
    const bx = lerp(x1, x2), by = lerp(y1, y2);
    const cx = lerp(x2, x3), cy = lerp(y2, y3);
    const dx = lerp(ax, bx), dy = lerp(ay, by);
    const ex = lerp(bx, cx), ey = lerp(by, cy);
    const fx = lerp(dx, ex), fy = lerp(dy, ey);
    return {
      left:  [x0, y0, ax, ay, dx, dy, fx, fy],
      right: [fx, fy, ex, ey, cx, cy, x3, y3],
      point: { x: fx, y: fy }
    };
  }

  /**
   * Nøyaktig ramme om ei kubisk kurve.
   *
   * Kontrollpunkta åleine gjev ei for stor ramme — kurva når sjeldan
   * heilt ut til dei. Vi finn i staden der derivatet er null i kvar akse
   * og tek med dei punkta. Det er skilnaden mellom ein markeringsboks
   * som ligg tett inntil forma og ein som flyt rundt henne.
   */
  function cubicBounds(x0, y0, x1, y1, x2, y2, x3, y3) {
    const xs = [x0, x3];
    const ys = [y0, y3];

    [[x0, x1, x2, x3, xs], [y0, y1, y2, y3, ys]].forEach((axis) => {
      const p0 = axis[0], p1 = axis[1], p2 = axis[2], p3 = axis[3], list = axis[4];
      const a = -p0 + 3 * p1 - 3 * p2 + p3;
      const b = 2 * (p0 - 2 * p1 + p2);
      const c = p1 - p0;

      const roots = [];
      if (Math.abs(a) < 1e-12) {
        if (Math.abs(b) > 1e-12) roots.push(-c / b);
      } else {
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const s = Math.sqrt(disc);
          roots.push((-b + s) / (2 * a), (-b - s) / (2 * a));
        }
      }
      roots.forEach((t) => {
        if (t > 0 && t < 1) {
          const u = 1 - t;
          list.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3);
        }
      });
    });

    return {
      x: Math.min.apply(null, xs),
      y: Math.min.apply(null, ys),
      w: Math.max.apply(null, xs) - Math.min.apply(null, xs),
      h: Math.max.apply(null, ys) - Math.min.apply(null, ys)
    };
  }

  /**
   * Bryt ei kurve ned til rette linjestykke, finare der ho svingar mest.
   * Toleransen er i dokumenteiningar — kallaren skal dele ho på
   * zoomnivået, elles blir kurver som er zooma langt inn kantete.
   */
  function flattenCubic(x0, y0, x1, y1, x2, y2, x3, y3, tol, out, depth) {
    out = out || [];
    depth = depth || 0;
    tol = tol || 0.25;

    // Flatheita målt som kor langt kontrollpunkta ligg frå korda.
    const dx = x3 - x0, dy = y3 - y0;
    let d1 = Math.abs((x1 - x3) * dy - (y1 - y3) * dx);
    let d2 = Math.abs((x2 - x3) * dy - (y2 - y3) * dx);
    const sum = (d1 + d2) * (d1 + d2);

    if (depth > 16 || sum < tol * (dx * dx + dy * dy) || (dx === 0 && dy === 0 && sum === 0)) {
      out.push({ x: x3, y: y3 });
      return out;
    }

    const s = splitCubic(x0, y0, x1, y1, x2, y2, x3, y3, 0.5);
    flattenCubic.apply(null, s.left.concat([tol, out, depth + 1]));
    flattenCubic.apply(null, s.right.concat([tol, out, depth + 1]));
    return out;
  }

  /** Kortaste avstand frå eit punkt til eit linjestykke. */
  function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  /* ──────────────── Bogar og kvadratiske kurver ──────────────── */

  /**
   * Gjer ein SVG-boge (A-kommandoen) om til kubiske kurver.
   *
   * Filer frå andre program er fulle av bogar, og utan denne omrekninga
   * ville importen anten mista dei eller tvinga heile resten av kodebasen
   * til å kunne ein kurvetype til. Vi følgjer omrekninga frå endepunkt-
   * til senterform i SVG-spesifikasjonen, og deler bogen i bitar på
   * høgst 90° — over det blir kubisk tilnærming merkbart unøyaktig.
   */
  function arcToCubics(x0, y0, rx, ry, angleDeg, largeArc, sweep, x1, y1) {
    if (rx === 0 || ry === 0) return [[x0, y0, x0, y0, x1, y1, x1, y1]];

    rx = Math.abs(rx);
    ry = Math.abs(ry);
    const phi = angleDeg * Math.PI / 180;
    const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);

    const dx2 = (x0 - x1) / 2, dy2 = (y0 - y1) / 2;
    const x1p = cosPhi * dx2 + sinPhi * dy2;
    const y1p = -sinPhi * dx2 + cosPhi * dy2;

    // Blås opp for små radiar som ikkje rekk fram mellom endepunkta.
    const check = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (check > 1) {
      const s = Math.sqrt(check);
      rx *= s;
      ry *= s;
    }

    const sign = largeArc === sweep ? -1 : 1;
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const co = sign * Math.sqrt(Math.max(0, num / den));
    const cxp = co * (rx * y1p) / ry;
    const cyp = co * -(ry * x1p) / rx;

    const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2;
    const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2;

    const angle = (ux, uy, vx, vy) => {
      const dot = ux * vx + uy * vy;
      const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
      let a = Math.acos(Math.min(1, Math.max(-1, len ? dot / len : 1)));
      if (ux * vy - uy * vx < 0) a = -a;
      return a;
    };

    const theta = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;

    const steps = Math.ceil(Math.abs(delta / (Math.PI / 2)));
    const step = delta / steps;
    const k = (4 / 3) * Math.tan(step / 4);

    const out = [];
    let t = theta;
    let px = x0, py = y0;
    for (let i = 0; i < steps; i++) {
      const t2 = t + step;
      const cosT = Math.cos(t), sinT = Math.sin(t);
      const cosT2 = Math.cos(t2), sinT2 = Math.sin(t2);

      const ex = cx + cosPhi * rx * cosT2 - sinPhi * ry * sinT2;
      const ey = cy + sinPhi * rx * cosT2 + cosPhi * ry * sinT2;

      const d1x = -rx * sinT, d1y = ry * cosT;
      const d2x = -rx * sinT2, d2y = ry * cosT2;

      const c1x = px + k * (cosPhi * d1x - sinPhi * d1y);
      const c1y = py + k * (sinPhi * d1x + cosPhi * d1y);
      const c2x = ex - k * (cosPhi * d2x - sinPhi * d2y);
      const c2y = ey - k * (sinPhi * d2x + cosPhi * d2y);

      out.push([px, py, c1x, c1y, c2x, c2y, ex, ey]);
      px = ex; py = ey; t = t2;
    }
    return out;
  }

  /** Kvadratisk til kubisk — same kurve, berre skriven om. */
  function quadToCubic(x0, y0, qx, qy, x1, y1) {
    return [
      x0, y0,
      x0 + (2 / 3) * (qx - x0), y0 + (2 / 3) * (qy - y0),
      x1 + (2 / 3) * (qx - x1), y1 + (2 / 3) * (qy - y1),
      x1, y1
    ];
  }

  /* ──────────────── Former til stiar ──────────────── */

  /** Ei ellipse som fire kubiske kvartsirklar. */
  function ellipseSubpaths(cx, cy, rx, ry) {
    const ox = rx * KAPPA, oy = ry * KAPPA;
    const pts = [
      makePoint(cx + rx, cy, 'smooth'),
      makePoint(cx, cy + ry, 'smooth'),
      makePoint(cx - rx, cy, 'smooth'),
      makePoint(cx, cy - ry, 'smooth')
    ];
    pts[0].ox = cx + rx; pts[0].oy = cy + oy; pts[0].ix = cx + rx; pts[0].iy = cy - oy;
    pts[1].ox = cx - ox; pts[1].oy = cy + ry; pts[1].ix = cx + ox; pts[1].iy = cy + ry;
    pts[2].ox = cx - rx; pts[2].oy = cy - oy; pts[2].ix = cx - rx; pts[2].iy = cy + oy;
    pts[3].ox = cx + ox; pts[3].oy = cy - ry; pts[3].ix = cx - ox; pts[3].iy = cy - ry;
    return [makeSubpath(pts, true)];
  }

  /** Rektangel, med avrunda hjørne når rx/ry er sette. */
  function rectSubpaths(x, y, w, h, rx, ry) {
    rx = Math.min(Math.abs(rx || 0), Math.abs(w) / 2);
    ry = Math.min(Math.abs(ry == null ? rx : ry), Math.abs(h) / 2);

    if (!rx && !ry) {
      return [makeSubpath([
        makePoint(x, y), makePoint(x + w, y),
        makePoint(x + w, y + h), makePoint(x, y + h)
      ], true)];
    }

    const ox = rx * KAPPA, oy = ry * KAPPA;
    const p = [];
    const add = (px, py, ixv, iyv, oxv, oyv) => {
      const pt = makePoint(px, py, 'corner');
      pt.ix = ixv; pt.iy = iyv; pt.ox = oxv; pt.oy = oyv;
      p.push(pt);
    };

    add(x + rx, y,          x + rx, y,          x + rx, y);
    add(x + w - rx, y,      x + w - rx, y,      x + w - rx + ox, y);
    add(x + w, y + ry,      x + w, y + ry - oy, x + w, y + ry);
    add(x + w, y + h - ry,  x + w, y + h - ry,  x + w, y + h - ry + oy);
    add(x + w - rx, y + h,  x + w - rx + ox, y + h, x + w - rx, y + h);
    add(x + rx, y + h,      x + rx, y + h,      x + rx - ox, y + h);
    add(x, y + h - ry,      x, y + h - ry + oy, x, y + h - ry);
    add(x, y + ry,          x, y + ry,          x, y + ry - oy);
    return [makeSubpath(p, true)];
  }

  function lineSubpaths(x1, y1, x2, y2) {
    return [makeSubpath([makePoint(x1, y1), makePoint(x2, y2)], false)];
  }

  /**
   * Mangekant eller stjerne om eit senter.
   * Ei stjerne er berre ein mangekant med annakvart punkt trekt inn til
   * ein mindre radius — same kode, to former.
   */
  function polySubpaths(cx, cy, r1, r2, sides, star, rotationDeg) {
    const n = Math.max(3, Math.round(sides || 5));
    const count = star ? n * 2 : n;
    const start = ((rotationDeg || 0) - 90) * Math.PI / 180;
    const pts = [];
    for (let i = 0; i < count; i++) {
      const a = start + (i * 2 * Math.PI) / count;
      const r = (star && i % 2) ? r2 : r1;
      pts.push(makePoint(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    return [makeSubpath(pts, true)];
  }

  /** Geometrien til ein node som stiar, uansett nodetype. */
  function toSubpaths(node) {
    const g = node.geom || {};
    switch (node.type) {
      case 'rect':    return rectSubpaths(g.x, g.y, g.w, g.h, g.rx, g.ry);
      case 'ellipse': return ellipseSubpaths(g.cx, g.cy, g.rx, g.ry);
      case 'line':    return lineSubpaths(g.x1, g.y1, g.x2, g.y2);
      case 'poly':    return polySubpaths(g.cx, g.cy, g.r1, g.r2, g.sides, g.star, g.rotation);
      case 'path':    return g.subpaths || [];
      default:        return [];
    }
  }

  /* ──────────────── Til SVG-tekst ──────────────── */

  const r = (n) => RV.matrix.round(n);

  /**
   * Skriv stiane som eit d-attributt. Rette segment blir L og ikkje C —
   * det halverer filstorleiken på typiske diagram og gjer eksporterte
   * filer råd å lese for eit menneske.
   */
  function toPathData(subpaths) {
    const out = [];
    subpaths.forEach((sp) => {
      const pts = sp.points;
      if (!pts.length) return;
      out.push('M', r(pts[0].x), r(pts[0].y));

      segments(sp).forEach((seg, i) => {
        const a = seg[0], b = seg[1];
        const last = sp.closed && i === pts.length - 1;
        if (isStraight(a, b)) {
          // Siste segmentet i ei lukka rett sti treng ikkje skrivast — Z gjer jobben.
          if (!last) out.push('L', r(b.x), r(b.y));
        } else {
          out.push('C', r(a.ox), r(a.oy), r(b.ix), r(b.iy), r(b.x), r(b.y));
        }
      });

      if (sp.closed) out.push('Z');
    });
    return out.join(' ');
  }

  /* ──────────────── Rammer ──────────────── */

  function unionRect(a, b) {
    if (!a) return b;
    if (!b) return a;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return {
      x: x, y: y,
      w: Math.max(a.x + a.w, b.x + b.w) - x,
      h: Math.max(a.y + a.h, b.y + b.h) - y
    };
  }

  function boundsOfSubpaths(subpaths) {
    let box = null;
    subpaths.forEach((sp) => {
      if (sp.points.length === 1) {
        const p = sp.points[0];
        box = unionRect(box, { x: p.x, y: p.y, w: 0, h: 0 });
      }
      segments(sp).forEach((seg) => {
        const a = seg[0], b = seg[1];
        box = unionRect(box, cubicBounds(a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y));
      });
    });
    return box || { x: 0, y: 0, w: 0, h: 0 };
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rectContains(outer, inner) {
    return inner.x >= outer.x && inner.y >= outer.y &&
           inner.x + inner.w <= outer.x + outer.w &&
           inner.y + inner.h <= outer.y + outer.h;
  }

  /* ──────────────── Treff ──────────────── */

  /** Delstiane som lister av punkt — grunnlaget for både treff og boolske op. */
  function flattenSubpaths(subpaths, tol) {
    return subpaths.map((sp) => {
      const pts = sp.points;
      if (!pts.length) return [];
      const poly = [{ x: pts[0].x, y: pts[0].y }];
      segments(sp).forEach((seg) => {
        const a = seg[0], b = seg[1];
        if (isStraight(a, b)) poly.push({ x: b.x, y: b.y });
        else flattenCubic(a.x, a.y, a.ox, a.oy, b.ix, b.iy, b.x, b.y, tol, poly);
      });
      return poly;
    });
  }

  /**
   * Ligg punktet inni forma? Vi brukar nonzero-regelen, som er SVG sin
   * standard: ein sti som kryssar seg sjølv blir fylt heilt, i staden for
   * å få hol der lagga overlappar.
   */
  function pointInPolygons(polys, px, py) {
    let winding = 0;
    polys.forEach((poly) => {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if (a.y <= py) {
          if (b.y > py && (b.x - a.x) * (py - a.y) - (px - a.x) * (b.y - a.y) > 0) winding++;
        } else if (b.y <= py && (b.x - a.x) * (py - a.y) - (px - a.x) * (b.y - a.y) < 0) {
          winding--;
        }
      }
    });
    return winding !== 0;
  }

  /** Kortaste avstand frå punktet til omrisset. */
  function distanceToPolygons(polys, px, py, closed) {
    let best = Infinity;
    polys.forEach((poly) => {
      const n = poly.length;
      const stop = closed ? n : n - 1;
      for (let i = 0; i < stop; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % n];
        const d = distanceToSegment(px, py, a.x, a.y, b.x, b.y);
        if (d < best) best = d;
      }
    });
    return best;
  }

  return {
    KAPPA,
    makePoint, makeSubpath, clonePoint, cloneSubpaths, movePoint,
    transformSubpaths, segments, isStraight,
    cubicAt, splitCubic, cubicBounds, flattenCubic, distanceToSegment,
    arcToCubics, quadToCubic,
    rectSubpaths, ellipseSubpaths, lineSubpaths, polySubpaths, toSubpaths,
    toPathData,
    unionRect, boundsOfSubpaths, rectsOverlap, rectContains,
    flattenSubpaths, pointInPolygons, distanceToPolygons
  };
})();
