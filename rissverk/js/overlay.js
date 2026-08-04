/* ══════════════════════════════════════════════
   OVERLAY.JS — Markering, handtak og rammemarkering

   Alt her blir teikna i SKJERMROMMET, utanfor viewporten. Difor held
   handtaka same storleik same kor langt brukaren har zooma inn, og
   markeringsstreken blir aldri tjukkare enn éin piksel.

   Markeringsboksen følgjer objektet sine EIGNE aksar. Eit rotert
   rektangel får ein rotert boks, ikkje ein rett boks rundt. Det er
   skilnaden mellom å kunne dra i eit hjørne og faktisk skalere forma
   langs si eiga side, og å skalere ho på skrå slik ho aldri var meint.

   Ved fleirval fell vi tilbake til ein akseparallell boks: fleire objekt
   med kvar sine rotasjonar har ingen felles akse å følgje.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.overlay = (function () {
  'use strict';

  const HANDLE = 9;          // px, sida i eit skaleringshandtak
  const ROTATE_GAP = 22;     // px frå ramma ut til rotasjonshandtaket
  const GRAB = 6;            // px slark rundt eit handtak

  let layerEl = null;
  let marquee = null;        // ramme i SKJERMkoordinatar, eller null
  let hoverId = null;

  /* Verktøy som teiknar sitt eige — pennen sin gummistrek, node-verktøyet
     sine ankerpunkt, hjelpelinjene frå snappinga. Dei melder seg inn her
     i staden for at overlegget skal måtte kjenne kvart einskilt verktøy.
     Kroken får laget å teikne i, og blir kalla ved kvar opptegning. */
  const hooks = [];

  function addHook(fn) {
    hooks.push(fn);
  }

  /** Dei åtte skaleringshandtaka, i einingsrommet til ramma. */
  const HANDLES = [
    { u: 0,   v: 0,   name: 'nw' },
    { u: 0.5, v: 0,   name: 'n'  },
    { u: 1,   v: 0,   name: 'ne' },
    { u: 1,   v: 0.5, name: 'e'  },
    { u: 1,   v: 1,   name: 'se' },
    { u: 0.5, v: 1,   name: 's'  },
    { u: 0,   v: 1,   name: 'sw' },
    { u: 0,   v: 0.5, name: 'w'  }
  ];

  function attach(refs) {
    layerEl = refs.overlay;
  }

  /* ──────────────── Ramma om det valde ──────────────── */

  /** Matrisa frå dokument til skjerm. */
  function viewMatrix() {
    const v = RV.state.data.view;
    return [v.zoom, 0, 0, v.zoom, v.panX, v.panY];
  }

  /**
   * Ramma som handtaka står på.
   *   rect — i det rommet matrisa `m` går ut frå
   *   m    — frå det rommet til skjermen
   *   oriented — sant når ramma følgjer objektet sine eigne aksar
   */
  function frame() {
    const ids = RV.state.topSelection();
    if (!ids.length) return null;

    if (ids.length === 1) {
      const node = RV.state.get(ids[0]);
      const local = RV.state.localBounds(node);
      if (!local) return null;
      return {
        rect: local,
        m: RV.matrix.mul(viewMatrix(), RV.state.worldMatrix(node.id)),
        oriented: true,
        ids: ids
      };
    }

    const box = RV.state.boundsOf(ids);
    if (!box) return null;
    return { rect: box, m: viewMatrix(), oriented: false, ids: ids };
  }

  /** Eit punkt i ramma sitt einingsrom (0–1) omsett til skjermen. */
  function pointAt(f, u, v) {
    return RV.matrix.apply(f.m, f.rect.x + u * f.rect.w, f.rect.y + v * f.rect.h);
  }

  function corners(f) {
    return [pointAt(f, 0, 0), pointAt(f, 1, 0), pointAt(f, 1, 1), pointAt(f, 0, 1)];
  }

  /* ──────────────── Handtak under peikaren ──────────────── */

  /**
   * @returns {object|null} { kind: 'scale'|'rotate', u, v, name }
   * Rotasjonssona ligg litt UTANFOR kvart hjørne. Det er ein liten
   * flekk, men han er der brukarar leitar etter han, og han krev ingen
   * modusbrytar for å nå.
   */
  function handleAt(stageX, stageY) {
    const f = frame();
    if (!f) return null;
    const reach = HANDLE / 2 + GRAB;

    for (let i = 0; i < HANDLES.length; i++) {
      const h = HANDLES[i];
      const p = pointAt(f, h.u, h.v);
      if (Math.abs(stageX - p.x) <= reach && Math.abs(stageY - p.y) <= reach) {
        return { kind: 'scale', u: h.u, v: h.v, name: h.name };
      }
    }

    for (let i = 0; i < HANDLES.length; i++) {
      const h = HANDLES[i];
      if (h.u === 0.5 || h.v === 0.5) continue;   // berre hjørna roterer
      const p = rotateSpot(f, h);
      if (Math.hypot(stageX - p.x, stageY - p.y) <= HANDLE / 2 + GRAB) {
        return { kind: 'rotate', u: h.u, v: h.v, name: h.name };
      }
    }
    return null;
  }

  /** Punktet der rotasjonssona til eit hjørne ligg — litt på utsida. */
  function rotateSpot(f, h) {
    const corner = pointAt(f, h.u, h.v);
    const inner = pointAt(f, h.u === 0 ? 0.25 : 0.75, h.v === 0 ? 0.25 : 0.75);
    const dx = corner.x - inner.x;
    const dy = corner.y - inner.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: corner.x + (dx / len) * ROTATE_GAP, y: corner.y + (dy / len) * ROTATE_GAP };
  }

  /** Peikarform som følgjer kor handtaket faktisk ligg etter ein rotasjon. */
  function cursorFor(handle) {
    if (!handle) return '';
    if (handle.kind === 'rotate') return 'grab';
    const f = frame();
    if (!f) return '';
    const at = pointAt(f, handle.u, handle.v);
    const mid = pointAt(f, 0.5, 0.5);
    const angle = Math.atan2(at.y - mid.y, at.x - mid.x) * 180 / Math.PI;
    const names = ['ew', 'nwse', 'ns', 'nesw'];
    const i = Math.round(((angle + 360) % 180) / 45) % 4;
    return names[i] + '-resize';
  }

  /* ──────────────── Rammemarkering og hover ──────────────── */

  function setMarquee(rect) {
    marquee = rect;
  }

  function setHover(id) {
    hoverId = id;
  }

  /* ──────────────── Opptegning ──────────────── */

  function outlinePath(id) {
    const node = RV.state.get(id);
    if (!node) return null;
    const local = RV.state.localBounds(node);
    if (!local) return null;
    const m = RV.matrix.mul(viewMatrix(), RV.state.worldMatrix(id));
    const pts = [
      RV.matrix.apply(m, local.x, local.y),
      RV.matrix.apply(m, local.x + local.w, local.y),
      RV.matrix.apply(m, local.x + local.w, local.y + local.h),
      RV.matrix.apply(m, local.x, local.y + local.h)
    ];
    return 'M ' + pts.map(p => RV.matrix.round(p.x) + ' ' + RV.matrix.round(p.y)).join(' L ') + ' Z';
  }

  function refresh() {
    RV.util.clear(layerEl);

    // Verktøy med eige grensesnitt — penn og node-redigering — skal ikkje
    // ha skaleringsramma oppå. To sett handtak på same form ville vore
    // uråd å sikte på.
    const tool = RV.tools.active();
    const ownUI = !!(tool && tool.hidesFrame);

    if (!ownUI && hoverId && !RV.state.isSelected(hoverId)) {
      const d = outlinePath(hoverId);
      if (d) layerEl.appendChild(RV.util.svg('path', { class: 'rv-hover-outline', d: d }));
    }

    // Kvart valt objekt får sitt eige omriss, i tillegg til den felles ramma.
    // Ved fleirval er det einaste måten å sjå kva som faktisk er med.
    const ids = RV.state.topSelection();
    if (!ownUI && ids.length > 1) {
      ids.forEach((id) => {
        const d = outlinePath(id);
        if (d) layerEl.appendChild(RV.util.svg('path', { class: 'rv-select-outline', d: d }));
      });
    }

    if (!ownUI) {
      const f = frame();
      if (f) drawFrame(f);
    }

    hooks.forEach(fn => fn(layerEl));

    if (marquee) {
      layerEl.appendChild(RV.util.svg('rect', {
        class: 'rv-marquee',
        x: RV.matrix.round(marquee.x), y: RV.matrix.round(marquee.y),
        width: RV.matrix.round(marquee.w), height: RV.matrix.round(marquee.h)
      }));
    }
  }

  function drawFrame(f) {
    const pts = corners(f);
    layerEl.appendChild(RV.util.svg('path', {
      class: 'rv-frame',
      d: 'M ' + pts.map(p => RV.matrix.round(p.x) + ' ' + RV.matrix.round(p.y)).join(' L ') + ' Z'
    }));

    // Ei form som er skrumpa heilt saman har ingen retning å skalere langs.
    const w = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const h = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
    if (w < 2 && h < 2) return;

    HANDLES.forEach((hd) => {
      // Sidehandtaka forsvinn når det ikkje er plass til dei.
      if (hd.u === 0.5 && w < HANDLE * 3) return;
      if (hd.v === 0.5 && h < HANDLE * 3) return;
      const p = pointAt(f, hd.u, hd.v);
      layerEl.appendChild(RV.util.svg('rect', {
        class: 'rv-handle',
        x: RV.matrix.round(p.x - HANDLE / 2),
        y: RV.matrix.round(p.y - HANDLE / 2),
        width: HANDLE, height: HANDLE
      }));
    });
  }

  /** Matrisa frå dokument til skjerm — verktøykrokane treng henne. */
  function screenMatrix(nodeId) {
    return nodeId
      ? RV.matrix.mul(viewMatrix(), RV.state.worldMatrix(nodeId))
      : viewMatrix();
  }

  return {
    attach, refresh, frame, pointAt, corners,
    handleAt, cursorFor, setMarquee, setHover,
    addHook, viewMatrix, screenMatrix,
    HANDLE, HANDLES
  };
})();
