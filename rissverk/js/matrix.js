/* ══════════════════════════════════════════════
   MATRIX.JS — Affine 2×3-matriser for Rissverk

   Alle objekt i teikninga ber ei matrise i staden for eit sett med
   x/y/rotasjon/skalering. Det er eit medvite val: rotasjon og skalering
   kan ikkje lagrast kvar for seg utan at rekkjefølgja mellom dei blir
   tvitydig. Skalerer du eit rotert objekt langs sin eigen akse, får du
   eit anna resultat enn om du roterer eit skalert objekt — og med
   separate felt finst det ingen måte å seie kva brukaren meinte.
   Matrisa hugsar heile historia i seks tal.

   Forma er den same som SVG brukar:
       x' = a·x + c·y + e
       y' = b·x + d·y + f
   lagra som talrekkja [a, b, c, d, e, f].
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.matrix = (function () {
  'use strict';

  function identity() {
    return [1, 0, 0, 1, 0, 0];
  }

  function isIdentity(m) {
    return m[0] === 1 && m[1] === 0 && m[2] === 0 &&
           m[3] === 1 && m[4] === 0 && m[5] === 0;
  }

  function clone(m) {
    return [m[0], m[1], m[2], m[3], m[4], m[5]];
  }

  /**
   * m1 · m2 — verkar som «gjer m2 først, så m1».
   * Rekkjefølgja er den same som når du nøstar <g transform> i SVG.
   */
  function mul(m1, m2) {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }

  /** Set saman fleire matriser frå venstre mot høgre. */
  function mulAll(list) {
    return list.reduce((acc, m) => mul(acc, m), identity());
  }

  /**
   * Den omvende matrisa. Gjev null når matrisa er singulær — det skjer
   * om eit objekt blir skalert heilt flatt til null i ei retning, og då
   * finst det ingen veg tilbake til dokumentkoordinatar.
   */
  function invert(m) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (!det || !isFinite(det)) return null;
    return [
      m[3] / det,
      -m[1] / det,
      -m[2] / det,
      m[0] / det,
      (m[2] * m[5] - m[3] * m[4]) / det,
      (m[1] * m[4] - m[0] * m[5]) / det
    ];
  }

  /* ──────────────── Byggjeklossar ──────────────── */

  function translate(tx, ty) {
    return [1, 0, 0, 1, tx || 0, ty || 0];
  }

  function scale(sx, sy) {
    return [sx, 0, 0, (sy == null ? sx : sy), 0, 0];
  }

  /** Rotasjon i grader, valfritt om eit punkt. */
  function rotate(deg, cx, cy) {
    const r = deg * Math.PI / 180;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    const m = [cos, sin, -sin, cos, 0, 0];
    if (cx == null && cy == null) return m;
    return mulAll([translate(cx, cy), m, translate(-cx, -cy)]);
  }

  /** Skalering om eit fast punkt — grunnlaget for alle skaleringshandtak. */
  function scaleAround(sx, sy, cx, cy) {
    return mulAll([translate(cx, cy), scale(sx, sy), translate(-cx, -cy)]);
  }

  /** Spegling om ei loddrett eller vassrett linje gjennom eit punkt. */
  function flip(axis, cx, cy) {
    return axis === 'x' ? scaleAround(-1, 1, cx, cy) : scaleAround(1, -1, cx, cy);
  }

  /* ──────────────── Punkt og rektangel ──────────────── */

  function apply(m, x, y) {
    return {
      x: m[0] * x + m[2] * y + m[4],
      y: m[1] * x + m[3] * y + m[5]
    };
  }

  /** Som apply, men utan translasjon — for retningar og storleikar. */
  function applyVector(m, x, y) {
    return { x: m[0] * x + m[2] * y, y: m[1] * x + m[3] * y };
  }

  /**
   * Rammer inn eit rektangel etter transformasjonen.
   * Merk at resultatet er ei akseparallell ramme: eit rotert kvadrat får
   * ei større ramme enn kvadratet sjølv. Det er rett for treffdeteksjon
   * og for «tilpass til vindauge», men skal aldri brukast til å teikne
   * markeringsboksen — han følgjer objektets eigne aksar.
   */
  function transformRect(m, rect) {
    const pts = [
      apply(m, rect.x, rect.y),
      apply(m, rect.x + rect.w, rect.y),
      apply(m, rect.x + rect.w, rect.y + rect.h),
      apply(m, rect.x, rect.y + rect.h)
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  /* ──────────────── Ut- og innlesing ──────────────── */

  /** Kortar ned tal så SVG-filene ikkje blir fulle av flyttalsstøy. */
  function round(n) {
    return Math.abs(n) < 1e-9 ? 0 : Math.round(n * 1e6) / 1e6;
  }

  function toString(m) {
    if (isIdentity(m)) return '';
    return 'matrix(' + m.map(round).join(' ') + ')';
  }

  /**
   * Les eit SVG-transform-attributt. Handterer matrix, translate, scale,
   * rotate, skewX og skewY i vilkårleg rekkjefølgje — slik dei faktisk
   * dukkar opp i filer frå andre program.
   */
  function fromString(text) {
    let m = identity();
    if (!text) return m;
    const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const name = match[1];
      const args = match[2].trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
      let step = null;
      if (name === 'matrix' && args.length >= 6) {
        step = args.slice(0, 6);
      } else if (name === 'translate') {
        step = translate(args[0] || 0, args[1] || 0);
      } else if (name === 'scale') {
        step = scale(args[0] == null ? 1 : args[0], args[1]);
      } else if (name === 'rotate') {
        step = args.length >= 3 ? rotate(args[0], args[1], args[2]) : rotate(args[0] || 0);
      } else if (name === 'skewX') {
        step = [1, 0, Math.tan((args[0] || 0) * Math.PI / 180), 1, 0, 0];
      } else if (name === 'skewY') {
        step = [1, Math.tan((args[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      }
      if (step) m = mul(m, step);
    }
    return m;
  }

  /* ──────────────── Analyse ──────────────── */

  /**
   * Plukkar matrisa frå kvarandre til lesbare tal. Brukt av
   * eigenskapspanelet, som skal vise «rotasjon: 30°» sjølv om
   * modellen berre kjenner seks koeffisientar.
   *
   * Dekomposisjonen er ikkje eintydig — same matrise kan skrivast som
   * ulike kombinasjonar av rotasjon, skalering og skeiving. Vi vel
   * QR-forma (roter først, så skaler og skeiv), som er den som stemmer
   * med korleis brukaren har bygd opp transformasjonen i praksis.
   */
  function decompose(m) {
    const a = m[0], b = m[1], c = m[2], d = m[3];
    const scaleX = Math.sqrt(a * a + b * b);
    const det = a * d - b * c;
    // Nesten flatt objekt: gi opp skeivinga og rapporter det vi kan.
    const scaleY = scaleX ? det / scaleX : Math.sqrt(c * c + d * d);
    const skewX = scaleX ? Math.atan2(a * c + b * d, scaleX * scaleX) : 0;
    return {
      x: m[4],
      y: m[5],
      rotation: Math.atan2(b, a) * 180 / Math.PI,
      scaleX: scaleX,
      scaleY: scaleY,
      skewX: skewX * 180 / Math.PI
    };
  }

  /**
   * Kor mykje matrisa forstørrar lengder, i snitt over alle retningar.
   * Strekbreidder må gangast med dette for å bli teikna rett, og
   * treffdeteksjonen brukar det til å rekne om ein klikk-radius frå
   * skjermpikslar til dokumenteiningar.
   */
  function meanScale(m) {
    return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
  }

  return {
    identity, isIdentity, clone, mul, mulAll, invert,
    translate, scale, rotate, scaleAround, flip,
    apply, applyVector, transformRect,
    toString, fromString, round,
    decompose, meanScale
  };
})();
