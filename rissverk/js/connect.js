/* ══════════════════════════════════════════════
   CONNECT.JS — Koplingslinjer og pilspissar

   Ei koplingslinje er ei vanleg linje som HUGSAR kva ho er festa til.
   Ho lagrar to node-id-ar, og endepunkta blir rekna ut på nytt kvar
   gong noko flyttar seg. Difor kan brukaren dra ein boks rundt i eit
   diagram utan at pilene blir liggjande att.

   Utrekninga er med vilje enkel: vi trekkjer ei linje mellom SENTRA i
   dei to objekta, og skjer henne der ho kryssar ramma til kvart av dei.
   Det gjev ei pil som peikar mot midten og stoppar pent på kanten, som
   er det ein ventar i eit boks-og-pil-diagram. Å følgje det verkelege
   omrisset ville vore rettare for runde og skeive former, men mykje
   dyrare — og på ein boks er svaret nøyaktig det same.

   PILSPISSANE er SVG-markørar. Dei arvar ikkje strekfargen av seg
   sjølve, så vi lagar ein markør per (form, farge) og gjenbrukar han.
   Alternativet, `context-stroke`, er nyare enn vi vil krevje.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.connect = (function () {
  'use strict';

  /* Formene på pilspissane. `path` er teikna i eit 10×10-rom der
     linja kjem inn frå venstre og enden ligg på x = 10. */
  const MARKERS = {
    arrow:  { d: 'M0,1 L9,5 L0,9 z',              refX: 9,   fill: true },
    open:   { d: 'M0,1 L9,5 L0,9',                refX: 9,   fill: false },
    dot:    { d: 'M5,5 m-3.5,0 a3.5,3.5 0 1,0 7,0 a3.5,3.5 0 1,0 -7,0', refX: 5, fill: true },
    bar:    { d: 'M8,1 L8,9',                     refX: 8,   fill: false },
    diamond:{ d: 'M0,5 L4.5,1 L9,5 L4.5,9 z',     refX: 9,   fill: true }
  };

  const CHOICES = [
    { value: '', label: 'Ingen' },
    { value: 'arrow', label: 'Pil' },
    { value: 'open', label: 'Open pil' },
    { value: 'dot', label: 'Prikk' },
    { value: 'bar', label: 'Strek' },
    { value: 'diamond', label: 'Rombe' }
  ];

  /* ──────────────── Markørar i defs ──────────────── */

  /** Id-en til ein markør. Same form og farge gjev same markør. */
  function markerId(kind, color, atStart) {
    return 'm' + kind + (atStart ? 's' : 'e') + String(color).replace('#', '');
  }

  /**
   * Byggjer alle markørane teikninga faktisk brukar.
   * Vi lagar dei på nytt for kvar opptegning i staden for å halde eit
   * register: talet på ulike markørar er lite, og eit register som kan
   * kome i utakt med teikninga er verre enn litt arbeid om att.
   */
  function buildMarkers(defsEl) {
    const brukt = {};

    RV.state.walk((node) => {
      const s = node.stroke;
      if (!s || s.type !== 'solid') return;
      [['markerStart', true], ['markerEnd', false]].forEach((pair) => {
        const kind = s[pair[0]];
        if (kind && MARKERS[kind]) brukt[markerId(kind, s.color, pair[1])] = {
          kind: kind, color: s.color, atStart: pair[1]
        };
      });
    });

    Object.keys(brukt).forEach((id) => {
      const spec = brukt[id];
      const shape = MARKERS[spec.kind];

      const marker = RV.util.svg('marker', {
        id: id,
        viewBox: '0 0 10 10',
        // Startmarkørar blir spegla, så pila peikar ut av linja.
        refX: spec.atStart ? 10 - shape.refX : shape.refX,
        refY: 5,
        markerWidth: 5, markerHeight: 5,
        orient: spec.atStart ? 'auto-start-reverse' : 'auto',
        markerUnits: 'strokeWidth'
      });

      marker.appendChild(RV.util.svg('path', {
        d: shape.d,
        fill: shape.fill ? spec.color : 'none',
        stroke: shape.fill ? 'none' : spec.color,
        'stroke-width': shape.fill ? null : 1.6,
        'stroke-linecap': shape.fill ? null : 'round'
      }));

      defsEl.appendChild(marker);
    });
  }

  /* ──────────────── Koplingar ──────────────── */

  /** Lagar ei kopling mellom to nodar. */
  function link(fromId, toId) {
    const style = RV.state.data.style;
    const node = RV.state.makeNode('line', { x1: 0, y1: 0, x2: 0, y2: 0, from: fromId, to: toId });
    node.name = 'Kopling';
    node.fill = { type: 'none' };
    node.stroke = Object.assign(
      { type: 'solid', color: '#1a1a1a', opacity: 1, width: 2, dash: '', cap: 'round', join: 'round' },
      style.stroke && style.stroke.type !== 'none' ? { color: style.stroke.color, width: style.stroke.width } : {},
      { markerEnd: 'arrow' });
    return node;
  }

  /**
   * Reknar ut endepunkta til alle koplingar.
   *
   * @returns {boolean} sant når noko faktisk flytta seg — så vi slepp å
   *   teikne på nytt når ingenting har endra seg
   */
  function refresh() {
    let changed = false;

    RV.state.walk((node) => {
      if (node.type !== 'line' || !node.geom.from || !node.geom.to) return;

      const a = RV.state.worldBounds(node.geom.from);
      const b = RV.state.worldBounds(node.geom.to);
      // Er den eine enden borte, blir koplinga ei vanleg linje att.
      if (!a || !b) {
        delete node.geom.from;
        delete node.geom.to;
        changed = true;
        return;
      }

      const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
      const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };

      const start = edgePoint(a, ac, bc);
      const end = edgePoint(b, bc, ac);

      // Endepunkta ligg i dokumentrommet; linja kan ha si eiga matrise.
      const inv = RV.matrix.invert(RV.state.worldMatrix(node.id));
      if (!inv) return;
      const p1 = RV.matrix.apply(inv, start.x, start.y);
      const p2 = RV.matrix.apply(inv, end.x, end.y);

      if (moved(node.geom.x1, p1.x) || moved(node.geom.y1, p1.y) ||
          moved(node.geom.x2, p2.x) || moved(node.geom.y2, p2.y)) {
        node.geom.x1 = p1.x; node.geom.y1 = p1.y;
        node.geom.x2 = p2.x; node.geom.y2 = p2.y;
        changed = true;
      }
    });

    return changed;
  }

  function moved(a, b) {
    return Math.abs((a || 0) - b) > 1e-6;
  }

  /**
   * Der linja frå `centre` mot `towards` går ut gjennom ramma.
   * Vi finn kor mykje av vegen vi kan gå før vi treffer den næraste
   * kanten, og stoppar der.
   */
  function edgePoint(box, centre, towards) {
    const dx = towards.x - centre.x;
    const dy = towards.y - centre.y;
    if (!dx && !dy) return centre;

    const halfW = box.w / 2 || 0.01;
    const halfH = box.h / 2 || 0.01;

    // Kor stor del av vektoren som får plass innanfor kvar akse.
    const tx = dx ? halfW / Math.abs(dx) : Infinity;
    const ty = dy ? halfH / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);

    return { x: centre.x + dx * t, y: centre.y + dy * t };
  }

  /** Er noden ei kopling? Brukt av panelet, som då skjuler X/Y-felta. */
  function isLink(node) {
    return !!(node && node.type === 'line' && node.geom.from && node.geom.to);
  }

  /**
   * Koplar dei to valde formene.
   * @returns {string|null} feilmelding, eller null
   */
  function connectSelection() {
    const ids = RV.state.topSelection();
    if (ids.length !== 2) return 'Vel nøyaktig to former å kople saman.';
    if (ids.some(id => RV.connect.isLink(RV.state.get(id)))) {
      return 'Ei kopling kan ikkje koplast vidare.';
    }

    // Teiknerekkjefølgja avgjer retninga: pila går frå det bakarste
    // til det fremste, som er den rekkjefølgja brukaren teikna dei i.
    const order = RV.state.data.root.filter(id => ids.indexOf(id) !== -1);
    const from = order[0] || ids[0];
    const to = order[1] || ids[1];

    RV.state.pushUndo();
    const node = link(from, to);
    // Bakarst, så koplinga ikkje ligg oppå boksane ho bind saman.
    RV.state.add(node, null, 0);
    refresh();
    RV.state.setSelection([node.id]);
    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
    return null;
  }

  return { MARKERS, CHOICES, buildMarkers, refresh, link, isLink, connectSelection, markerId };
})();
