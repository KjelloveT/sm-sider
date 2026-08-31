/* ══════════════════════════════════════════════
   SHAPES.JS — Plasshaldargrafikk

   ALT her er mellombels. Rein geometri: sirklar, firkantar, trekantar,
   strekar. Ingen teikning, ingen illustrasjon, ingen tid brukt på
   uttrykk før vi veit at spelet fungerer med elevar.

   Alt teiknar seg med currentColor og var(--border), så figurane følgjer
   dei 21 fargetemaa utan at nokon treng å halde ei fargeliste i takt.

   Byt ut denne fila når spelet er testa. Ingen annan fil treng å endrast:
   resten av koden spør berre etter «figur nr. N» og «plante på steg N».
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function svg(size, viewBox) {
    const s = el('svg', {
      width: size, height: size,
      viewBox: viewBox || '0 0 100 100',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 6,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false'
    });
    return s;
  }

  /* ──────────────── Profilfigurar ──────────────── */

  const AVATAR_PARTS = {
    circle:   function () { return [el('circle', { cx: 50, cy: 50, r: 32 })]; },
    square:   function () { return [el('rect', { x: 20, y: 20, width: 60, height: 60, rx: 6 })]; },
    triangle: function () { return [el('path', { d: 'M50 18 L82 78 H18 Z' })]; },
    diamond:  function () { return [el('path', { d: 'M50 16 L84 50 L50 84 L16 50 Z' })]; },
    cross:    function () { return [el('path', { d: 'M50 18 V82 M18 50 H82' })]; },
    arch:     function () { return [el('path', { d: 'M22 80 V50 a28 28 0 0 1 56 0 V80' })]; },
    star:     function () { return [el('path', { d: 'M50 16 L61 42 L88 44 L67 62 L74 88 L50 74 L26 88 L33 62 L12 44 L39 42 Z' })]; },
    hex:      function () { return [el('path', { d: 'M50 15 L82 33 V67 L50 85 L18 67 V33 Z' })]; }
  };

  /** SVG for ein profilfigur. */
  function avatar(shape, size) {
    const s = svg(size || 64);
    (AVATAR_PARTS[shape] || AVATAR_PARTS.circle)().forEach(function (p) { s.appendChild(p); });
    return s;
  }

  /* ──────────────── Skogen ──────────────── */

  /* Seks steg som svarar til maxBox 0–5. Kvart steg legg noko synleg
     til det førre, så framgangen er lesbar for ein som ikkje kan lese. */
  const PLANT_STAGES = [
    /* 0 — frø: berre eit korn i jorda */
    function () { return [el('circle', { cx: 50, cy: 76, r: 7 })]; },
    /* 1 — spire */
    function () { return [el('path', { d: 'M50 84 V58' })]; },
    /* 2 — to blad */
    function () {
      return [el('path', { d: 'M50 84 V50' }),
              el('circle', { cx: 34, cy: 54, r: 9 }),
              el('circle', { cx: 66, cy: 54, r: 9 })];
    },
    /* 3 — knopp */
    function () {
      return [el('path', { d: 'M50 84 V46' }),
              el('circle', { cx: 34, cy: 58, r: 9 }),
              el('circle', { cx: 66, cy: 58, r: 9 }),
              el('path', { d: 'M50 44 L60 30 H40 Z' })];
    },
    /* 4 — blomst */
    function () {
      return [el('path', { d: 'M50 84 V44' }),
              el('circle', { cx: 32, cy: 58, r: 9 }),
              el('circle', { cx: 68, cy: 58, r: 9 }),
              el('circle', { cx: 50, cy: 30, r: 15 }),
              el('circle', { cx: 50, cy: 30, r: 5 })];
    },
    /* 5 — tre */
    function () {
      return [el('path', { d: 'M50 86 V56' }),
              el('path', { d: 'M50 56 L74 56 L50 22 L26 56 Z' }),
              el('path', { d: 'M50 46 L66 46 L50 24 L34 46 Z' })];
    }
  ];

  /** SVG for ein plante på gitt vekststeg (0–5). */
  function plant(stage, size) {
    const i = Math.max(0, Math.min(PLANT_STAGES.length - 1, stage | 0));
    const s = svg(size || 56);
    /* Jordlinja gjer at frøet ikkje ser ut til å sveve. */
    s.appendChild(el('path', { d: 'M14 90 H86', 'stroke-width': 4, opacity: 0.35 }));
    PLANT_STAGES[i]().forEach(function (p) { s.appendChild(p); });
    return s;
  }

  const STAGE_NAMES = ['frø', 'spire', 'to blad', 'knopp', 'blomst', 'tre'];

  /* ──────────────── Merke ──────────────── */

  /* Eitt skjold, med tal på kor mange kantar. Alle merka ser like ut
     med vilje — dei skal skiljast på tittelen, ikkje på ein illustrasjon
     ingen har teikna enno. */
  function badge(size, earned) {
    const s = svg(size || 48);
    s.appendChild(el('path', {
      d: 'M50 14 L80 26 V52 c0 18 -14 28 -30 34 c-16 -6 -30 -16 -30 -34 V26 Z',
      fill: earned ? 'currentColor' : 'none',
      'fill-opacity': earned ? 0.15 : 0
    }));
    if (earned) s.appendChild(el('path', { d: 'M36 50 L46 60 L66 38' }));
    else s.appendChild(el('circle', { cx: 50, cy: 50, r: 6, opacity: 0.4 }));
    return s;
  }

  /** Stjerne til dagsstjernene. */
  function star(size, filled) {
    const s = svg(size || 32);
    s.appendChild(el('path', {
      d: 'M50 16 L61 42 L88 44 L67 62 L74 88 L50 74 L26 88 L33 62 L12 44 L39 42 Z',
      fill: filled ? 'currentColor' : 'none',
      'fill-opacity': filled ? 0.9 : 0,
      opacity: filled ? 1 : 0.35
    }));
    return s;
  }

  /** Høgtalar til lydknappen. */
  function speaker(size) {
    const s = svg(size || 32);
    s.appendChild(el('path', { d: 'M28 40 H42 L58 26 V74 L42 60 H28 Z' }));
    s.appendChild(el('path', { d: 'M68 38 a18 18 0 0 1 0 24' }));
    s.appendChild(el('path', { d: 'M76 30 a30 30 0 0 1 0 40' }));
    return s;
  }

  root.LjodShapes = {
    avatar: avatar,
    plant: plant,
    badge: badge,
    star: star,
    speaker: speaker,
    STAGE_NAMES: STAGE_NAMES,
    MAX_STAGE: PLANT_STAGES.length - 1
  };
})(window);
