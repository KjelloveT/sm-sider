/* ══════════════════════════════════════════════
   VIEW.JS — Zoom, panorering, rutenett og linjalar

   Her bur den einaste omrekninga mellom det brukaren peikar på og det
   modellen kjenner. Alle verktøy går gjennom `toDoc()`; ingen av dei
   skal rekne på zoom eller panorering sjølve. Feil her ville smitta
   til kvar einaste form som blir teikna, og vere vond å spore attende.

   SVG-flata er IKKJE sett opp med viewBox. Brukarrommet i SVG-en er
   nøyaktig CSS-pikslane til stagen, og all zoom ligg i ein transform på
   <g id="viewport">. Det gjev oss to koordinatsystem i same fila:
   dokumentet inne i viewporten, og skjermen utanfor. Markeringshandtak
   og linjalar blir teikna i skjermrommet, og held difor same storleik
   uansett kor langt inn brukaren har zooma — akkurat som dei skal.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.view = (function () {
  'use strict';

  const MIN_ZOOM = 0.02;
  const MAX_ZOOM = 64;
  const RULER_SIZE = 18;     // px — brei nok til to siffer

  let svgEl = null;
  let viewportEl = null;
  let gridEl = null;
  let rulerEl = null;
  let stageEl = null;

  const view = () => RV.state.data.view;

  function attach(refs) {
    svgEl = refs.svg;
    viewportEl = refs.viewport;
    gridEl = refs.grid;
    rulerEl = refs.ruler;
    stageEl = refs.stage;
  }

  /* ──────────────── Storleik på flata ──────────────── */

  function size() {
    if (!stageEl) return { w: 0, h: 0 };
    return { w: stageEl.clientWidth, h: stageEl.clientHeight };
  }

  /* ──────────────── Omrekning ──────────────── */

  /** Skjermpunkt (clientX/clientY) → dokumentkoordinatar. */
  function toDoc(clientX, clientY) {
    const rect = svgEl.getBoundingClientRect();
    const v = view();
    return {
      x: (clientX - rect.left - v.panX) / v.zoom,
      y: (clientY - rect.top - v.panY) / v.zoom
    };
  }

  /** Skjermpunkt relativt til SVG-flata (ikkje til vindauget). */
  function toStage(clientX, clientY) {
    const rect = svgEl.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  /** Dokumentkoordinatar → punkt i SVG-flata sitt skjermrom. */
  function toScreen(x, y) {
    const v = view();
    return { x: x * v.zoom + v.panX, y: y * v.zoom + v.panY };
  }

  /** Ei lengd i skjermpikslar, uttrykt i dokumenteiningar. */
  function docLength(px) {
    return px / view().zoom;
  }

  /* ──────────────── Zoom og panorering ──────────────── */

  /**
   * Set zoom, og held punktet under peikaren i ro.
   * Utan ankeret ville zooming alltid gått mot venstre hjørne, og
   * brukaren måtte panorere tilbake til det han faktisk såg på.
   */
  function setZoom(zoom, anchorStageX, anchorStageY) {
    const v = view();
    const next = RV.util.clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    if (next === v.zoom) return;

    const s = size();
    const ax = anchorStageX == null ? s.w / 2 : anchorStageX;
    const ay = anchorStageY == null ? s.h / 2 : anchorStageY;

    const docX = (ax - v.panX) / v.zoom;
    const docY = (ay - v.panY) / v.zoom;

    v.zoom = next;
    v.panX = ax - docX * next;
    v.panY = ay - docY * next;
  }

  function zoomBy(factor, anchorStageX, anchorStageY) {
    setZoom(view().zoom * factor, anchorStageX, anchorStageY);
  }

  function panBy(dx, dy) {
    const v = view();
    v.panX += dx;
    v.panY += dy;
  }

  /** Legg heile teikneflata midt i vindauget med litt luft rundt. */
  function fit(padding) {
    const s = size();
    const doc = RV.state.data.doc;
    if (!s.w || !s.h) return;
    const pad = (padding == null ? 32 : padding) + RULER_SIZE;
    const zoom = Math.min((s.w - pad * 2) / doc.width, (s.h - pad * 2) / doc.height);
    const v = view();
    v.zoom = RV.util.clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    v.panX = (s.w - doc.width * v.zoom) / 2;
    v.panY = (s.h - doc.height * v.zoom) / 2;
  }

  /** Zoom til ei ramme i dokumentkoordinatar — brukt av «zoom til det valde». */
  function fitRect(rect, padding) {
    const s = size();
    if (!s.w || !s.h || !rect || !rect.w || !rect.h) return;
    const pad = padding == null ? 48 : padding;
    const v = view();
    v.zoom = RV.util.clamp(
      Math.min((s.w - pad * 2) / rect.w, (s.h - pad * 2) / rect.h), MIN_ZOOM, MAX_ZOOM);
    v.panX = s.w / 2 - (rect.x + rect.w / 2) * v.zoom;
    v.panY = s.h / 2 - (rect.y + rect.h / 2) * v.zoom;
  }

  function zoomPercent() {
    return Math.round(view().zoom * 100);
  }

  /* ──────────────── Snapping til rutenettet ──────────────── */

  /**
   * Rundar av til næraste rutepunkt når rutenettet er på.
   * Snappinga gjeld berre når rutenettet er synleg — det skal aldri skje
   * noko brukaren ikkje kan sjå grunnen til.
   */
  function snapValue(value) {
    const v = view();
    if (!v.grid || !v.snap) return value;
    return Math.round(value / v.gridSize) * v.gridSize;
  }

  function snapPoint(pt) {
    return { x: snapValue(pt.x), y: snapValue(pt.y) };
  }

  /* ──────────────── Opptegning ──────────────── */

  function apply() {
    const v = view();
    viewportEl.setAttribute('transform',
      'translate(' + RV.matrix.round(v.panX) + ' ' + RV.matrix.round(v.panY) +
      ') scale(' + RV.matrix.round(v.zoom) + ')');
    drawGrid();
    drawRulers();
  }

  /**
   * Steget mellom rutelinjene, i dokumenteiningar.
   * Grunnsteget blir dobla til linjene står minst 8 px frå kvarandre på
   * skjermen. Utan det ville eit rutenett på 16 px blitt til ein grå
   * flate så snart brukaren zooma ut.
   */
  function gridStep() {
    const v = view();
    let step = v.gridSize;
    while (step * v.zoom < 8) step *= 2;
    return step;
  }

  function drawGrid() {
    RV.util.clear(gridEl);
    const v = view();
    if (!v.grid) return;

    const s = size();
    const step = gridStep();
    const first = Math.floor((-v.panX / v.zoom) / step) * step;
    const firstY = Math.floor((-v.panY / v.zoom) / step) * step;

    const d = [];
    for (let x = first; ; x += step) {
      const sx = x * v.zoom + v.panX;
      if (sx > s.w) break;
      if (sx >= 0) d.push('M', RV.matrix.round(sx), 0, 'V', s.h);
    }
    for (let y = firstY; ; y += step) {
      const sy = y * v.zoom + v.panY;
      if (sy > s.h) break;
      if (sy >= 0) d.push('M', 0, RV.matrix.round(sy), 'H', s.w);
    }
    gridEl.appendChild(RV.util.svg('path', { class: 'rv-grid-line', d: d.join(' ') }));
  }

  /**
   * Linjalane langs toppen og venstre kant.
   * Steget blir valt slik at etikettane aldri kolliderer: vi går opp
   * gjennom 1-2-5-rekkja til det er minst 56 px mellom to merke.
   */
  function rulerStep() {
    const v = view();
    const targets = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    for (let i = 0; i < targets.length; i++) {
      if (targets[i] * v.zoom >= 56) return targets[i];
    }
    return targets[targets.length - 1];
  }

  function drawRulers() {
    RV.util.clear(rulerEl);
    const s = size();
    if (!s.w || !s.h) return;

    const v = view();
    const step = rulerStep();

    rulerEl.appendChild(RV.util.svg('rect', {
      class: 'rv-ruler-bg', x: 0, y: 0, width: s.w, height: RULER_SIZE
    }));
    rulerEl.appendChild(RV.util.svg('rect', {
      class: 'rv-ruler-bg', x: 0, y: 0, width: RULER_SIZE, height: s.h
    }));

    const ticks = [];

    const firstX = Math.ceil((-v.panX / v.zoom) / step) * step;
    for (let x = firstX; ; x += step) {
      const sx = Math.round(x * v.zoom + v.panX);
      if (sx > s.w) break;
      if (sx < RULER_SIZE) continue;
      ticks.push('M', sx, RULER_SIZE - 5, 'V', RULER_SIZE);
      const label = RV.util.svg('text', { class: 'rv-ruler-text', x: sx + 3, y: RULER_SIZE - 7 });
      label.textContent = String(x);
      rulerEl.appendChild(label);
    }

    const firstY = Math.ceil((-v.panY / v.zoom) / step) * step;
    for (let y = firstY; ; y += step) {
      const sy = Math.round(y * v.zoom + v.panY);
      if (sy > s.h) break;
      if (sy < RULER_SIZE) continue;
      ticks.push('M', RULER_SIZE - 5, sy, 'H', RULER_SIZE);
      // Snudd på hovudet langs venstrekanten, slik linjalar plar vere.
      const label = RV.util.svg('text', {
        class: 'rv-ruler-text', x: 0, y: 0,
        transform: 'translate(' + (RULER_SIZE - 7) + ' ' + (sy - 3) + ') rotate(-90)'
      });
      label.textContent = String(y);
      rulerEl.appendChild(label);
    }

    rulerEl.appendChild(RV.util.svg('path', { class: 'rv-ruler-tick', d: ticks.join(' ') }));
  }

  return {
    attach, apply, size,
    toDoc, toStage, toScreen, docLength,
    setZoom, zoomBy, panBy, fit, fitRect, zoomPercent,
    snapValue, snapPoint,
    MIN_ZOOM, MAX_ZOOM, RULER_SIZE
  };
})();
