/* ══════════════════════════════════════════════
   RENDER.JS — Modell → SVG-DOM

   Renderaren DIFFAR mot det som alt står i dokumentet. Ei full
   gjenoppbygging for kvar endring ville vore kortare kode, men han
   ville rive elementa ut under føtene på nettlesaren kvar gong ein
   peikar rører seg — og alt som held ein peikar til eit element ville
   miste taket.

   Former blir teikna med sine EIGNE SVG-element (<rect>, <ellipse>,
   <polygon>) og ikkje som <path>. Modellen reknar alt om til kurver
   internt, men eksporten skal vere lesbar for eit menneske og for andre
   program: eit rektangel bør sjå ut som eit rektangel i fila.

   Heile scena har `pointer-events: none`. Treffdeteksjonen skjer på
   geometrien i hit.js, ikkje via nettlesaren, fordi vi treng eigne
   reglar for låste lag, grupper og former som berre har strek.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.render = (function () {
  'use strict';

  let sceneEl = null;
  let defsEl = null;
  let artboardEl = null;

  /* id → SVG-element. Held oss frå å byggje treet på nytt kvar gong. */
  const elements = new Map();

  function attach(refs) {
    sceneEl = refs.scene;
    defsEl = refs.defs;
    artboardEl = refs.artboard;
  }

  /* ──────────────── Elementtypar ──────────────── */

  const TAG_FOR = {
    rect: 'rect', ellipse: 'ellipse', line: 'line',
    poly: 'polygon', path: 'path', group: 'g',
    image: 'image', text: 'text', use: 'use'
  };

  function tagFor(node) {
    return TAG_FOR[node.type] || 'path';
  }

  /* ──────────────── Geometri på elementet ──────────────── */

  function applyGeometry(el, node) {
    const g = node.geom || {};
    const r = RV.matrix.round;

    switch (node.type) {
      case 'rect':
        RV.util.setAttrs(el, {
          // Negativ breidd er ugyldig i SVG, så vi normaliserer henne her.
          x: r(g.w < 0 ? g.x + g.w : g.x),
          y: r(g.h < 0 ? g.y + g.h : g.y),
          width: r(Math.abs(g.w)),
          height: r(Math.abs(g.h)),
          rx: g.rx ? r(g.rx) : null,
          ry: g.ry ? r(g.ry) : null
        });
        break;

      case 'ellipse':
        RV.util.setAttrs(el, {
          cx: r(g.cx), cy: r(g.cy),
          rx: r(Math.abs(g.rx)), ry: r(Math.abs(g.ry))
        });
        break;

      case 'line':
        RV.util.setAttrs(el, { x1: r(g.x1), y1: r(g.y1), x2: r(g.x2), y2: r(g.y2) });
        break;

      case 'poly': {
        const pts = RV.geom.polySubpaths(g.cx, g.cy, g.r1, g.r2, g.sides, g.star, g.rotation)[0].points;
        el.setAttribute('points', pts.map(p => r(p.x) + ',' + r(p.y)).join(' '));
        break;
      }

      case 'path':
        el.setAttribute('d', RV.geom.toPathData(g.subpaths || []));
        break;

      case 'image':
        RV.util.setAttrs(el, {
          x: r(g.x), y: r(g.y), width: r(g.w), height: r(g.h),
          preserveAspectRatio: 'none'
        });
        if (el.getAttribute('href') !== g.href) el.setAttribute('href', g.href || '');
        break;

      case 'use':
        el.setAttribute('href', '#sym-' + g.symbol);
        break;

      /*
       * Teksten blir bygd opp på nytt for kvar opptegning. Det er meir
       * arbeid enn å endre attributt, men linjene er <tspan>-element, og
       * å halde eit varierande tal på dei i takt med innhaldet krev meir
       * kode enn det sparer. Tekstnodar er få.
       *
       * Innhaldet går gjennom textContent, aldri innerHTML — dette er
       * det einaste staden i programmet der brukaren sin eigen tekst
       * hamnar i dokumentet.
       */
      case 'text': {
        const lines = String(g.text || '').split('\n');

        /* Valfrie attributt blir fjerna før dei blir sette på nytt.
           Utan det hamnar dei bakarst i den rekkjefølgja brukaren
           tilfeldigvis endra dei, og då gjev to like teikningar to ulike
           filer. Eksporterte SVG-ar bør vere like på byten når innhaldet
           er likt — elles blir dei uleselege å samanlikne i versjonskontroll. */
        ['font-weight', 'font-style', 'text-anchor', 'xml:space']
          .forEach(a => el.removeAttribute(a));

        RV.util.setAttrs(el, {
          x: r(g.x), y: r(g.y),
          'font-family': RV.text.fontStack(g.font),
          'font-size': r(g.size),
          'font-weight': g.weight !== 400 ? g.weight : null,
          'font-style': g.italic ? 'italic' : null,
          'text-anchor': g.align !== 'start' ? g.align : null,
          'xml:space': 'preserve'
        });

        RV.util.clear(el);
        lines.forEach((line, i) => {
          const span = RV.util.svg('tspan', {
            x: r(g.x),
            dy: i === 0 ? null : r(g.size * (g.lineHeight || 1.25))
          });
          // Ei heilt tom linje kollapsar i SVG. Eit mellomrom held ho open.
          span.textContent = line.length ? line : ' ';
          el.appendChild(span);
        });
        break;
      }

      case 'group':
        break;
    }
  }

  /* ──────────────── Stil på elementet ──────────────── */

  function paintValue(paint) {
    if (!paint || paint.type === 'none') return 'none';
    if (paint.type === 'gradient') return 'url(#' + paint.id + ')';
    return paint.color || '#000000';
  }

  function applyStyle(el, node) {
    const fill = node.fill;
    const stroke = node.stroke;
    const hasStroke = stroke && stroke.type !== 'none' && stroke.width > 0;

    RV.util.setAttrs(el, {
      fill: node.type === 'group' ? null : paintValue(fill),
      'fill-opacity': (fill && fill.type !== 'none' && fill.opacity < 1)
        ? RV.matrix.round(fill.opacity) : null,
      stroke: hasStroke ? paintValue(stroke) : (node.type === 'group' ? null : 'none'),
      'stroke-width': hasStroke ? RV.matrix.round(stroke.width) : null,
      'stroke-opacity': (hasStroke && stroke.opacity < 1) ? RV.matrix.round(stroke.opacity) : null,
      'stroke-dasharray': hasStroke && stroke.dash ? stroke.dash : null,
      'stroke-linecap': hasStroke && stroke.cap && stroke.cap !== 'butt' ? stroke.cap : null,
      'stroke-linejoin': hasStroke && stroke.join && stroke.join !== 'miter' ? stroke.join : null,
      'marker-start': markerRef(stroke, 'markerStart', true),
      'marker-end': markerRef(stroke, 'markerEnd', false),
      opacity: node.opacity < 1 ? RV.matrix.round(node.opacity) : null
    });
  }

  function markerRef(stroke, field, atStart) {
    if (!stroke || stroke.type !== 'solid' || !stroke[field]) return null;
    if (!RV.connect.MARKERS[stroke[field]]) return null;
    return 'url(#' + RV.connect.markerId(stroke[field], stroke.color, atStart) + ')';
  }

  function applyCommon(el, node) {
    const t = RV.matrix.toString(node.transform);
    if (t) el.setAttribute('transform', t);
    else el.removeAttribute('transform');

    // Usynlege nodar blir verande i treet. Å fjerne dei ville tvinga
    // ein full ombygging kvar gong nokon slår auget av og på.
    if (node.visible) el.removeAttribute('display');
    else el.setAttribute('display', 'none');

    el.setAttribute('data-id', node.id);

    // Referansebilete er noko brukaren teiknar ETTER, ikkje ein del av
    // teikninga. Merket følgjer med til serialiseringa, som luker dei ut.
    if (node.reference) el.setAttribute('data-ref', '1');
    else el.removeAttribute('data-ref');

    if (node.clip) el.setAttribute('clip-path', 'url(#clip-' + node.id + ')');
    else el.removeAttribute('clip-path');
  }

  /* ──────────────── Diffing ──────────────── */

  function elementFor(node) {
    let el = elements.get(node.id);
    // Byter noden type — t.d. eit rektangel som blir gjort om til sti —
    // må elementet skiftast ut, ikkje berre få nye attributt.
    if (el && el.tagName.toLowerCase() !== tagFor(node)) {
      if (el.parentNode) el.parentNode.removeChild(el);
      elements.delete(node.id);
      el = null;
    }
    if (!el) {
      el = RV.util.svg(tagFor(node));
      elements.set(node.id, el);
    }
    return el;
  }

  /**
   * Byggjer opp éi gruppe med barn i rett rekkjefølgje.
   *
   * Plasseringa går på INDEKS, ikkje på ein peikar til neste
   * syskenelement. Ein slik peikar ville gått i stykker i det ein node
   * blir gruppert: rekursjonen nedover flyttar elementet ut av lista vi
   * står i, og peikaren blir hengande på noko som ikkje lenger er eit
   * barn her. Indeksen les vi på nytt for kvart steg, og han kan difor
   * ikkje bli forelda.
   *
   * Elementet blir plassert FØR vi går inn i gruppa, av same grunn.
   */
  function renderList(parentEl, ids) {
    let index = 0;

    ids.forEach((id) => {
      const node = RV.state.get(id);
      if (!node) return;
      const el = elementFor(node);

      applyCommon(el, node);
      applyStyle(el, node);
      applyGeometry(el, node);

      const at = parentEl.childNodes[index];
      if (at !== el) parentEl.insertBefore(el, at || null);
      index += 1;

      if (node.type === 'group') renderList(el, RV.state.listOf(id));
    });

    // Alt som ligg att bakerst høyrer ikkje heime her lenger. Element som
    // har flytta til ein annan forelder blir sette inn att der.
    while (parentEl.childNodes.length > index) {
      const extra = parentEl.lastChild;
      const extraId = extra.getAttribute && extra.getAttribute('data-id');
      parentEl.removeChild(extra);
      if (extraId && !RV.state.get(extraId)) elements.delete(extraId);
    }
  }

  /* ──────────────── Gradientar ──────────────── */

  function renderDefs() {
    const gradients = RV.state.data.defs.gradients || {};
    RV.util.clear(defsEl);

    Object.keys(gradients).forEach((id) => {
      const g = gradients[id];
      const el = RV.util.svg(g.kind === 'radial' ? 'radialGradient' : 'linearGradient', {
        id: id, gradientUnits: 'userSpaceOnUse'
      });
      if (g.kind === 'radial') {
        RV.util.setAttrs(el, { cx: g.cx, cy: g.cy, r: g.r });
      } else {
        RV.util.setAttrs(el, { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2 });
      }
      (g.stops || []).forEach((s) => {
        el.appendChild(RV.util.svg('stop', {
          offset: s.offset,
          'stop-color': s.color,
          'stop-opacity': s.opacity < 1 ? s.opacity : null
        }));
      });
      defsEl.appendChild(el);
    });

    RV.connect.buildMarkers(defsEl);
    RV.symbol.buildSymbols(defsEl);
    RV.clip.buildClips(defsEl);
  }

  /* ──────────────── Teikneflata ──────────────── */

  function renderArtboard() {
    const doc = RV.state.data.doc;
    RV.util.setAttrs(artboardEl, {
      width: doc.width,
      height: doc.height,
      fill: doc.bg || 'none'
    });
    artboardEl.classList.toggle('rv-artboard-clear', !doc.bg);
  }

  /* ──────────────── Utsida ──────────────── */

  function refresh() {
    // Koplingslinjene må vite kvar boksane står FØR vi teiknar dei.
    RV.connect.refresh();
    renderArtboard();
    renderDefs();
    renderList(sceneEl, RV.state.data.root);
  }

  /** Elementet som viser noden — brukt av eksporten og av overlegget. */
  function elementOf(id) {
    return elements.get(id) || null;
  }

  /**
   * Byggjer eit element utan buffer, frå ei vilkårleg kjelde.
   *
   * Symbol-definisjonane i defs er sitt eige vesle dokument, med sine
   * eigne nodar og sitt eige tre. Dei kan ikkje gå gjennom den diffande
   * vegen, for han er knytt til éin buffer med node-id som nøkkel, og
   * eit symbol og teikninga kan ha same id. Difor denne: same
   * attributt-logikk, men alt blir bygd nytt kvar gong.
   *
   * @param {object} src { get(id), listOf(id) }
   */
  function buildFresh(node, src) {
    const el = RV.util.svg(tagFor(node));
    applyCommon(el, node);
    applyStyle(el, node);
    applyGeometry(el, node);
    el.removeAttribute('data-id');

    if (node.type === 'group') {
      src.listOf(node.id).forEach((cid) => {
        const child = src.get(cid);
        if (child) el.appendChild(buildFresh(child, src));
      });
    }
    return el;
  }

  /** Kastar heile bufferet. Kall etter at ei ny teikning er lasta inn. */
  function invalidate() {
    elements.clear();
    RV.util.clear(sceneEl);
  }

  return { attach, refresh, elementOf, invalidate, paintValue, buildFresh };
})();
