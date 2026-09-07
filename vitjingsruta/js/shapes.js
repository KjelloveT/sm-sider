/* ══════════════════════════════════════════════
   SHAPES.JS — Formene, som SVG-path-data

   Her ligg all geometri i verktøyet, og han finst berre éin gong.
   Grunnen står i planen: eit verktøy som teiknar PNG med canvas-kall og
   SVG med strengbygging får to teiknarar som driv frå kvarandre, og
   brukaren oppdagar det først når fila er sendt til trykk.

   Løysinga er at alt blir uttrykt som SVG-path-data. SVG-eksporten
   skriv strengen rett inn i eit <path d="…">, og canvas byggjer ein
   Path2D av den same strengen. Ei form kan ikkje sjå ulik ut i dei to
   når ho ER den same strengen.

   Eininga er éin modul. Koden veit ingenting om pikslar.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.shapes = (function () {
  'use strict';

  const n = VR.util.n;

  /* ──────────────── Grunnformer ──────────────── */

  function rect(x, y, w, h) {
    return 'M' + n(x) + ',' + n(y) + 'h' + n(w) + 'v' + n(h) + 'h' + n(-w) + 'Z';
  }

  /**
   * Firkant med radius per hjørne, med klokka frå øvst til venstre.
   * SVG tolkar ein boge med radius 0 som ei rett linje, så vi treng ingen
   * særhandsaming av skarpe hjørne.
   */
  function roundRect(x, y, w, h, r) {
    const max = Math.min(w, h) / 2;
    const tl = VR.util.clamp(r[0], 0, max), tr = VR.util.clamp(r[1], 0, max);
    const br = VR.util.clamp(r[2], 0, max), bl = VR.util.clamp(r[3], 0, max);
    return 'M' + n(x + tl) + ',' + n(y) +
      'H' + n(x + w - tr) + 'A' + n(tr) + ',' + n(tr) + ' 0 0 1 ' + n(x + w) + ',' + n(y + tr) +
      'V' + n(y + h - br) + 'A' + n(br) + ',' + n(br) + ' 0 0 1 ' + n(x + w - br) + ',' + n(y + h) +
      'H' + n(x + bl) + 'A' + n(bl) + ',' + n(bl) + ' 0 0 1 ' + n(x) + ',' + n(y + h - bl) +
      'V' + n(y + tl) + 'A' + n(tl) + ',' + n(tl) + ' 0 0 1 ' + n(x + tl) + ',' + n(y) + 'Z';
  }

  function circle(cx, cy, r) {
    if (r <= 0) return '';
    return 'M' + n(cx - r) + ',' + n(cy) +
      'A' + n(r) + ',' + n(r) + ' 0 1 0 ' + n(cx + r) + ',' + n(cy) +
      'A' + n(r) + ',' + n(r) + ' 0 1 0 ' + n(cx - r) + ',' + n(cy) + 'Z';
  }

  function diamond(x, y, w, h) {
    return 'M' + n(x + w / 2) + ',' + n(y) +
      'L' + n(x + w) + ',' + n(y + h / 2) +
      'L' + n(x + w / 2) + ',' + n(y + h) +
      'L' + n(x) + ',' + n(y + h / 2) + 'Z';
  }

  /**
   * Den vesle konkave biten som fyller hakket der to naboar møtest.
   * Utan han står det eit kvitt kryss igjen mellom fire modular, og den
   * samanbundne forma ser ut som fire runde klossar i staden for éin kropp.
   *
   * @param {number} px,py hjørnepunktet dei to naboane deler
   * @param {number} sx,sy retning inn i den tomme cella (±1)
   */
  function notch(px, py, sx, sy, r) {
    if (r <= 0) return '';
    const ax = px + sx * r, ay = py;
    const bx = px, by = py + sy * r;
    /* Sveipretninga snur når vi speglar i berre éin akse. */
    const sweep = (sx * sy > 0) ? 1 : 0;
    return 'M' + n(px) + ',' + n(py) +
      'L' + n(ax) + ',' + n(ay) +
      'A' + n(r) + ',' + n(r) + ' 0 0 ' + sweep + ' ' + n(bx) + ',' + n(by) +
      'Z';
  }

  /* ──────────────── Modulane ──────────────── */

  const MODULE_SHAPES = [
    { id: 'square', label: 'Kvadrat' },
    { id: 'rounded', label: 'Avrunda' },
    { id: 'dot', label: 'Prikk' },
    { id: 'diamond', label: 'Rombe' },
    { id: 'classy', label: 'Skrå' },
    { id: 'liquid', label: 'Samanbunden' }
  ];

  /**
   * Path-data for alle datamodulane i koden.
   *
   * @param {object} qr        resultatet frå VR.qr.build
   * @param {object} mod       { shape, radius, gap }
   * @param {number} ox,oy     kvar modul (0,0) startar
   * @param {function} skip    (r, c) => true for modular som ikkje skal teiknast
   * @param {boolean} eyesOwnShape  hopp over augene (dei blir teikna for seg)
   */
  function modulesPath(qr, mod, ox, oy, skip, eyesOwnShape) {
    const gap = VR.util.clamp(mod.gap || 0, 0, 0.12);
    const s = 1 - gap;
    const o = gap / 2;
    const radius = VR.util.clamp(mod.radius == null ? 0.35 : mod.radius, 0, 1);
    const out = [];

    const isEye = (r, c) => eyesOwnShape && qr.zone(r, c) === 'finder';
    const on = (r, c) => qr.isDark(r, c) && !isEye(r, c) && !(skip && skip(r, c));

    for (let r = 0; r < qr.size; r++) {
      for (let c = 0; c < qr.size; c++) {
        if (!on(r, c)) continue;
        const x = ox + c + o;
        const y = oy + r + o;

        /* Timing-mønsteret er ei linje av enkeltmodular som vekslar mørk
           og lys, og skannaren måler modulbreidda på han. Blir kvar av dei
           ein sirkel, måler han for smalt. Difor står funksjonsmodulane
           som heile kvadrat sjølv når resten er runde — det er same valet
           kommersielle QR-designarar gjer, og det ser ut som ein detalj i
           designet framfor ein feil. */
        const z = qr.zone(r, c);
        /* Justeringsmønstera blir teikna for seg når dei har fått eiga
           form — då skal dei ikkje òg liggje her. */
        if (mod.alignmentOwnShape && z === 'alignment') continue;
        if (mod.solidFunctional !== false && (z === 'timing' || z === 'alignment')) {
          out.push(rect(ox + c, oy + r, 1, 1));
          continue;
        }

        switch (mod.shape) {
          case 'dot':
            out.push(circle(x + s / 2, y + s / 2, s / 2));
            break;
          case 'diamond':
            out.push(diamond(x, y, s, s));
            break;
          case 'rounded':
            out.push(roundRect(x, y, s, s, [radius * s / 2, radius * s / 2, radius * s / 2, radius * s / 2]));
            break;
          case 'classy': {
            const k = radius * s / 2;
            out.push(roundRect(x, y, s, s, [k, 0, k, 0]));
            break;
          }
          case 'liquid': {
            /* Eit hjørne blir runda berre når ingen av dei to naboane som
               deler det er der. Er dei det, skal kanten vere rett — då renn
               modulane saman i staden for å stå som separate klossar. */
            const N = on(r - 1, c), S = on(r + 1, c);
            const W = on(r, c - 1), E = on(r, c + 1);
            const k = radius * s / 2;
            out.push(roundRect(x, y, s, s, [
              (!N && !W) ? k : 0,
              (!N && !E) ? k : 0,
              (!S && !E) ? k : 0,
              (!S && !W) ? k : 0
            ]));
            /* Hakket mot ein diagonal nabo som manglar. */
            if (gap === 0) {
              if (N && W && !on(r - 1, c - 1)) out.push(notch(x, y, -1, -1, k));
              if (N && E && !on(r - 1, c + 1)) out.push(notch(x + s, y, 1, -1, k));
              if (S && W && !on(r + 1, c - 1)) out.push(notch(x, y + s, -1, 1, k));
              if (S && E && !on(r + 1, c + 1)) out.push(notch(x + s, y + s, 1, 1, k));
            }
            break;
          }
          default:
            out.push(rect(x, y, s, s));
        }
      }
    }
    return out.join('');
  }

  /* ──────────────── Augene ──────────────── */

  const EYE_FRAMES = [
    { id: 'square', label: 'Kvadrat' },
    { id: 'rounded', label: 'Avrunda' },
    { id: 'circle', label: 'Sirkel' },
    { id: 'leaf', label: 'Blad' },
    { id: 'cut', label: 'Eitt hjørne' }
  ];

  /* Ein «liten prikk» som kjerne stod her ei stund. Han vart teken ut:
     skannaren måler forholdet 1:1:3:1:1 tvers over auget, og ein kjerne
     som er mindre enn dei tre modulane sine gjer det talet feil. Han
     feila i alle kombinasjonar vi målte, ikkje berre nokre. */
  const EYE_PUPILS = [
    { id: 'square', label: 'Kvadrat' },
    { id: 'rounded', label: 'Avrunda' },
    { id: 'circle', label: 'Sirkel' }
  ];

  /* Ytre ramme: 7×7 med eit 5×5 hol. Holet blir teikna med motsett
     retning slik at evenodd-fyllinga lèt det stå ope. */
  function eyeFrame(style, x, y, radius) {
    const outer = 7, inner = 5;
    const ix = x + 1, iy = y + 1;
    const k = radius * 2.2;

    switch (style) {
      case 'circle':
        return circle(x + 3.5, y + 3.5, 3.5) + circle(ix + 2.5, iy + 2.5, 2.5);
      case 'rounded':
        return roundRect(x, y, outer, outer, [k, k, k, k]) +
          roundRect(ix, iy, inner, inner, [k * 0.7, k * 0.7, k * 0.7, k * 0.7]);
      case 'leaf':
        return roundRect(x, y, outer, outer, [3.5, 0, 3.5, 0]) +
          roundRect(ix, iy, inner, inner, [2.5, 0, 2.5, 0]);
      case 'cut':
        return roundRect(x, y, outer, outer, [0, 3.5, 3.5, 3.5]) +
          roundRect(ix, iy, inner, inner, [0, 2.5, 2.5, 2.5]);
      default:
        return rect(x, y, outer, outer) + rect(ix, iy, inner, inner);
    }
  }

  function eyePupil(style, x, y, radius) {
    const px = x + 2, py = y + 2;
    switch (style) {
      case 'circle': return circle(px + 1.5, py + 1.5, 1.5);
      case 'rounded': {
        const k = radius * 1.5;
        return roundRect(px, py, 3, 3, [k, k, k, k]);
      }
      default: return rect(px, py, 3, 3);
    }
  }

  /* ──────────────── Justeringsmønster ──────────────── */

  /* 5×5 ring med ein 3×3 luke og ein 1×1 kjerne. Same triks som augene:
     luka blir eit hol via evenodd. */
  function alignmentPath(qr, style, ox, oy, radius) {
    if (style === 'module') return '';
    const out = [];
    qr.alignCentres.forEach((p) => {
      const x = ox + p[1] - 2, y = oy + p[0] - 2;
      if (style === 'circle') {
        out.push(circle(x + 2.5, y + 2.5, 2.5));
        out.push(circle(x + 2.5, y + 2.5, 1.5));
        out.push(circle(x + 2.5, y + 2.5, 0.5));
      } else {
        const k = radius * 1.6;
        out.push(roundRect(x, y, 5, 5, [k, k, k, k]));
        out.push(roundRect(x + 1, y + 1, 3, 3, [k * 0.6, k * 0.6, k * 0.6, k * 0.6]));
        out.push(roundRect(x + 2, y + 2, 1, 1, [0, 0, 0, 0]));
      }
    });
    return out.join('');
  }

  return {
    rect, roundRect, circle, diamond,
    MODULE_SHAPES, EYE_FRAMES, EYE_PUPILS,
    modulesPath, eyeFrame, eyePupil, alignmentPath
  };
})();
