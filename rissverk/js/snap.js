/* ══════════════════════════════════════════════
   SNAP.JS — Snapping mot andre objekt, med hjelpelinjer

   Snappinga ser på KANTAR OG SENTER, ikkje på punkt. Det er kantane
   auget les når det avgjer om to ting står på line, og difor kantane
   brukaren prøver å treffe.

   Kandidatane blir bygde éin gong når draget tek til, ikkje for kvar
   musrørsle. Ei teikning kan ha hundrevis av objekt, og å rekne ut
   rammene deira seksti gonger i sekundet ville gjort draget hakkete
   nettopp når brukaren siktar mest nøye.

   Terskelen er i SKJERMpikslar og ikkje i dokumenteiningar. Zoomar du
   inn, vil du plassere noko nøyaktig, og då skal snappinga sleppe taket;
   zoomar du ut, vil du grovsortere, og då skal ho ta lettare. Same
   terskel i dokumenteiningar ville gjort det motsett.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.snap = (function () {
  'use strict';

  const THRESHOLD = 7;       // px på skjermen
  const MAX_CANDIDATES = 400;

  let candidates = null;     // { x: [...], y: [...] } i dokumentkoordinatar
  let guides = [];           // hjelpelinjer å teikne, i dokumentkoordinatar
  let enabled = true;

  /* ──────────────── Kandidatar ──────────────── */

  /**
   * Byggjer lista over verdiar det er verdt å snappe til.
   * @param {string[]} exclude nodane som blir dregne — dei skal ikkje
   *   snappe til seg sjølve
   */
  function begin(exclude) {
    const skip = {};
    (exclude || []).forEach((id) => {
      RV.state.descendants(id).forEach(d => { skip[d] = true; });
    });

    const xs = [];
    const ys = [];

    // Teikneflata er alltid verdt å sikte mot: kantane og midten.
    const doc = RV.state.data.doc;
    push(xs, 0, 'flate'); push(xs, doc.width / 2, 'flate'); push(xs, doc.width, 'flate');
    push(ys, 0, 'flate'); push(ys, doc.height / 2, 'flate'); push(ys, doc.height, 'flate');

    let count = 0;
    RV.state.walk((node) => {
      if (skip[node.id] || !node.visible || count > MAX_CANDIDATES) return;
      // Berre objekt på øvste nivå og direkte synlege former — å ta med
      // kvart punkt i kvar gruppe ville gjeve fleire linjer enn hjelp.
      if (node.parent && RV.state.get(node.parent)) return;

      const b = RV.state.worldBounds(node.id);
      if (!b) return;
      count += 1;

      push(xs, b.x, node.id); push(xs, b.x + b.w / 2, node.id); push(xs, b.x + b.w, node.id);
      push(ys, b.y, node.id); push(ys, b.y + b.h / 2, node.id); push(ys, b.y + b.h, node.id);
    });

    candidates = { x: xs, y: ys };
    guides = [];
  }

  function push(list, value, source) {
    list.push({ value: value, source: source });
  }

  function end() {
    candidates = null;
    guides = [];
  }

  function setEnabled(on) {
    enabled = !!on;
  }

  /* ──────────────── Sjølve snappinga ──────────────── */

  /** Næraste kandidat innanfor terskelen, eller null. */
  function nearest(list, value, tolerance) {
    let best = null;
    for (let i = 0; i < list.length; i++) {
      const d = Math.abs(list[i].value - value);
      if (d <= tolerance && (!best || d < best.d)) best = { d: d, value: list[i].value };
    }
    return best;
  }

  /**
   * Snappar ei ramme som blir flytta, og finn den forskyvinga som
   * trengst. Vi prøver alle tre kantane i kvar retning — venstre,
   * midten og høgre — og tek den som treffer best. Det er difor ei form
   * kan leggje seg med SENTERET på line med kanten av ei anna.
   *
   * @param {object} box ramma slik ho ville lege utan snapping
   * @param {boolean} off held brukaren Ctrl nede?
   * @returns {{dx:number, dy:number}}
   */
  function moveBox(box, off) {
    guides = [];
    if (!enabled || off || !candidates) return { dx: 0, dy: 0 };

    const tol = RV.view.docLength(THRESHOLD);
    const edgesX = [box.x, box.x + box.w / 2, box.x + box.w];
    const edgesY = [box.y, box.y + box.h / 2, box.y + box.h];

    let bestX = null;
    edgesX.forEach((edge) => {
      const hit = nearest(candidates.x, edge, tol);
      if (hit && (!bestX || hit.d < bestX.d)) bestX = { d: hit.d, delta: hit.value - edge, line: hit.value };
    });

    let bestY = null;
    edgesY.forEach((edge) => {
      const hit = nearest(candidates.y, edge, tol);
      if (hit && (!bestY || hit.d < bestY.d)) bestY = { d: hit.d, delta: hit.value - edge, line: hit.value };
    });

    if (bestX) guides.push({ axis: 'x', value: bestX.line });
    if (bestY) guides.push({ axis: 'y', value: bestY.line });

    return { dx: bestX ? bestX.delta : 0, dy: bestY ? bestY.delta : 0 };
  }

  /** Snappar eit enkelt punkt — brukt av pennen og node-verktøyet. */
  function point(pt, off) {
    guides = [];
    if (!enabled || off || !candidates) return { x: pt.x, y: pt.y };

    const tol = RV.view.docLength(THRESHOLD);
    const hitX = nearest(candidates.x, pt.x, tol);
    const hitY = nearest(candidates.y, pt.y, tol);

    if (hitX) guides.push({ axis: 'x', value: hitX.value });
    if (hitY) guides.push({ axis: 'y', value: hitY.value });

    return { x: hitX ? hitX.value : pt.x, y: hitY ? hitY.value : pt.y };
  }

  function activeGuides() {
    return guides;
  }

  /* ──────────────── Hjelpelinjene ──────────────── */

  /* Linjene går tvers over heile flata og ikkje berre mellom dei to
     objekta. Ei kort linje krev at auget finn ut kva ho knyter saman;
     ei gjennomgåande linje syner det med ein gong. */
  RV.overlay.addHook(function (layer) {
    if (!guides.length) return;
    const size = RV.view.size();

    guides.forEach((g) => {
      const at = g.axis === 'x'
        ? RV.view.toScreen(g.value, 0).x
        : RV.view.toScreen(0, g.value).y;
      const rounded = Math.round(at) + 0.5;   // skarp éinpiksel-linje

      const ends = g.axis === 'x'
        ? { x1: rounded, y1: 0, x2: rounded, y2: size.h }
        : { x1: 0, y1: rounded, x2: size.w, y2: rounded };

      layer.appendChild(RV.util.svg('line', Object.assign({ class: 'rv-guide' }, ends)));
    });
  });

  return { begin, end, moveBox, point, activeGuides, setEnabled, THRESHOLD };
})();
