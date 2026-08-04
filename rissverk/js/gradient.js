/* ══════════════════════════════════════════════
   GRADIENT.JS — Fargeovergangar

   Ein gradient bur i `defs.gradients` og blir peika på frå fyllet eller
   streken med `{ type: 'gradient', id: '…' }`. Han er altså ein RESSURS
   og ikkje ein eigenskap ved forma. Grunnen er at SVG gjer det slik, og
   at det let fleire former dele same overgang seinare.

   KOORDINATSYSTEMET er `userSpaceOnUse` og ikkje `objectBoundingBox`.
   Det siste er lettare å lage — gradienten strekkjer seg automatisk over
   forma — men han følgjer ikkje med når forma blir roterta eller skalert
   ujamt, og han lèt seg ikkje dra i på lerretet. Med faste koordinatar
   kan brukaren ta tak i to handtak og bestemme retninga sjølv, som i
   alle andre teikneprogram.

   Ein følgje av det valet: gradienten ligg i forma sitt EIGE
   koordinatsystem. Blir forma flytta med matrisa si, følgjer overgangen
   med av seg sjølv, utan at vi treng gjere noko.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.gradient = (function () {
  'use strict';

  /* ──────────────── Nye overgangar ──────────────── */

  /**
   * Lagar ein overgang som spenner over ramma til noden.
   * Startfargen er den forma alt har, så overgangen kjenst som ei
   * utviding av fargen han hadde og ikkje som noko heilt nytt.
   */
  function create(node, kind, fromPaint) {
    const box = RV.state.localBounds(node) || { x: 0, y: 0, w: 100, h: 100 };
    const base = (fromPaint && fromPaint.type === 'solid')
      ? fromPaint.color : '#8ecae6';

    const id = RV.util.nextId('g');
    const stops = [
      { offset: 0, color: base, opacity: 1 },
      { offset: 1, color: fade(base), opacity: 1 }
    ];

    const gradient = kind === 'radial'
      ? {
          kind: 'radial',
          cx: box.x + box.w / 2, cy: box.y + box.h / 2,
          r: Math.max(box.w, box.h) / 2,
          stops: stops
        }
      : {
          kind: 'linear',
          x1: box.x, y1: box.y + box.h / 2,
          x2: box.x + box.w, y2: box.y + box.h / 2,
          stops: stops
        };

    RV.state.data.defs.gradients[id] = gradient;
    return id;
  }

  /** Ein mørkare variant av fargen, som andre stoppunkt. */
  function fade(hex) {
    const rgb = RV.util.hexToRgb(hex) || { r: 40, g: 40, b: 40 };
    const hsv = RV.util.rgbToHsv(rgb.r, rgb.g, rgb.b);
    const dark = RV.util.hsvToRgb(hsv.h, Math.min(1, hsv.s * 1.15), Math.max(0.12, hsv.v * 0.45));
    return RV.util.rgbToHex(dark.r, dark.g, dark.b);
  }

  function get(id) {
    return RV.state.data.defs.gradients[id] || null;
  }

  /**
   * Overgangen som er i bruk på det valde, om det er éin.
   * @returns {{id:string, gradient:object, part:string}|null}
   */
  function active() {
    const ids = RV.state.topSelection();
    if (ids.length !== 1) return null;
    const node = RV.state.get(ids[0]);
    if (!node) return null;

    for (const part of ['fill', 'stroke']) {
      const paint = node[part];
      if (paint && paint.type === 'gradient' && get(paint.id)) {
        return { id: paint.id, gradient: get(paint.id), part: part, node: node };
      }
    }
    return null;
  }

  /* ──────────────── Stoppunkt ──────────────── */

  function sortStops(gradient) {
    gradient.stops.sort((a, b) => a.offset - b.offset);
  }

  /** Legg eit stoppunkt der brukaren peika, med fargen han ville fått der. */
  function addStop(gradient, offset) {
    const at = RV.util.clamp(offset, 0, 1);
    gradient.stops.push({ offset: at, color: colorAt(gradient, at), opacity: 1 });
    sortStops(gradient);
    return gradient.stops.findIndex(s => s.offset === at);
  }

  function removeStop(gradient, index) {
    // To stoppunkt er minstemålet — utan dei er det ingen overgang.
    if (gradient.stops.length <= 2) return false;
    gradient.stops.splice(index, 1);
    return true;
  }

  /** Fargen overgangen har på ein gitt plass, blanda mellom naboane. */
  function colorAt(gradient, offset) {
    const stops = gradient.stops;
    if (!stops.length) return '#000000';
    if (offset <= stops[0].offset) return stops[0].color;
    if (offset >= stops[stops.length - 1].offset) return stops[stops.length - 1].color;

    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (offset >= a.offset && offset <= b.offset) {
        const span = b.offset - a.offset;
        const t = span ? (offset - a.offset) / span : 0;
        const ca = RV.util.hexToRgb(a.color) || { r: 0, g: 0, b: 0 };
        const cb = RV.util.hexToRgb(b.color) || { r: 0, g: 0, b: 0 };
        return RV.util.rgbToHex(
          ca.r + (cb.r - ca.r) * t,
          ca.g + (cb.g - ca.g) * t,
          ca.b + (cb.b - ca.b) * t);
      }
    }
    return stops[0].color;
  }

  /** CSS-gradient til førehandsvisinga i panelet. */
  function toCss(gradient) {
    const stops = gradient.stops
      .map(s => s.color + ' ' + Math.round(s.offset * 100) + '%')
      .join(', ');
    return gradient.kind === 'radial'
      ? 'radial-gradient(circle, ' + stops + ')'
      : 'linear-gradient(to right, ' + stops + ')';
  }

  /* ──────────────── Rydding ──────────────── */

  /**
   * Kastar overgangar ingen brukar lenger.
   *
   * Utan dette ville kvart einaste forsøk på ein gradient blitt liggjande
   * att i fila for alltid — og prosjektfila ville vakse for kvar gong
   * brukaren ombestemte seg.
   */
  function collectGarbage() {
    const brukt = {};
    RV.state.walk((node) => {
      ['fill', 'stroke'].forEach((part) => {
        if (node[part] && node[part].type === 'gradient') brukt[node[part].id] = true;
      });
    });

    const gradients = RV.state.data.defs.gradients;
    Object.keys(gradients).forEach((id) => {
      if (!brukt[id]) delete gradients[id];
    });
  }

  /* ──────────────── Handtak på lerretet ──────────────── */

  const GRAB = 8;

  /** Dei to punkta som styrer overgangen, i nodens eige rom. */
  function handles(gradient) {
    return gradient.kind === 'radial'
      ? [{ x: gradient.cx, y: gradient.cy, key: 'centre' },
         { x: gradient.cx + gradient.r, y: gradient.cy, key: 'radius' }]
      : [{ x: gradient.x1, y: gradient.y1, key: 'start' },
         { x: gradient.x2, y: gradient.y2, key: 'end' }];
  }

  function handleAt(stageX, stageY) {
    const found = active();
    if (!found) return null;
    const m = RV.overlay.screenMatrix(found.node.id);

    const list = handles(found.gradient);
    for (let i = 0; i < list.length; i++) {
      const at = RV.matrix.apply(m, list[i].x, list[i].y);
      if (Math.hypot(stageX - at.x, stageY - at.y) <= GRAB) {
        return { key: list[i].key, found: found };
      }
    }
    return null;
  }

  /** Flytt eit handtak. Punktet kjem inn i dokumentkoordinatar. */
  function moveHandle(found, key, docX, docY) {
    const inv = RV.matrix.invert(RV.state.worldMatrix(found.node.id));
    if (!inv) return;
    const p = RV.matrix.apply(inv, docX, docY);
    const g = found.gradient;

    if (key === 'start') { g.x1 = p.x; g.y1 = p.y; }
    else if (key === 'end') { g.x2 = p.x; g.y2 = p.y; }
    else if (key === 'centre') {
      // Senteret dreg radius-handtaket med seg, elles ville sirkelen
      // endra storleik kvar gong ein berre ville flytte han.
      g.cx = p.x; g.cy = p.y;
    } else if (key === 'radius') {
      g.r = Math.max(1, Math.hypot(p.x - g.cx, p.y - g.cy));
    }
  }

  /* Handtaka og linja mellom dei, teikna oppå forma. */
  RV.overlay.addHook(function (layer) {
    const tool = RV.tools.active();
    if (!tool || tool.id !== 'select') return;
    const found = active();
    if (!found) return;

    const m = RV.overlay.screenMatrix(found.node.id);
    const list = handles(found.gradient).map(h =>
      Object.assign(RV.matrix.apply(m, h.x, h.y), { key: h.key }));
    const r = RV.matrix.round;

    layer.appendChild(RV.util.svg('line', {
      class: 'rv-gradient-line',
      x1: r(list[0].x), y1: r(list[0].y), x2: r(list[1].x), y2: r(list[1].y)
    }));

    // Radial: vis sirkelen så brukaren ser kvar overgangen sluttar.
    if (found.gradient.kind === 'radial') {
      layer.appendChild(RV.util.svg('circle', {
        class: 'rv-gradient-ring',
        cx: r(list[0].x), cy: r(list[0].y),
        r: r(Math.hypot(list[1].x - list[0].x, list[1].y - list[0].y))
      }));
    }

    list.forEach((h, i) => {
      layer.appendChild(RV.util.svg('circle', {
        class: 'rv-gradient-handle',
        cx: r(h.x), cy: r(h.y), r: 6,
        fill: colorAt(found.gradient, i === 0 ? 0 : 1)
      }));
    });
  });

  return {
    create, get, active, addStop, removeStop, colorAt, toCss,
    sortStops, collectGarbage, handles, handleAt, moveHandle, fade
  };
})();
