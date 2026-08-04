/* ══════════════════════════════════════════════
   LEARN.JS — Lær vektorteikning

   Retta mot elevar som skal FORSTÅ vektorgrafikk, ikkje berre bruke
   programmet. Difor to ting, og ikkje meir:

   1. Ei kort forklaring av kva ein bézier-kurve er, med ei levande
      teikning ein kan dra i. Å lese om handtak hjelper lite; å dra i
      eit og sjå kurva svinge er heile innsikta på fem sekund.

   2. Namn på det ein ser. Når node-verktøyet er framme og
      «vis-meg»-modus står på, får ankerpunkt og handtak etikettar. Ein
      elev som ikkje veit at det heiter eit handtak, kan heller ikkje
      spørje om det.

   Vi lagar IKKJE eit oppgåvesett med fasit. Rissverk er eit
   teikneprogram, og eit teikneprogram som rettar arbeidet ditt er noko
   heilt anna. Læraren gjev oppgåva; programmet skal berre vere til å
   forstå.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.learn = (function () {
  'use strict';

  let overlayEl = null;
  let showLabels = false;

  /* ──────────────── Den levande demonstrasjonen ──────────────── */

  /* Ei kurve med fire punkt ein kan dra i. Tala er i eit 320×200-rom. */
  const DEMO = {
    p0: { x: 40, y: 150 },
    c1: { x: 40, y: 40 },
    c2: { x: 280, y: 40 },
    p3: { x: 280, y: 150 }
  };

  let demoSvg = null;
  let dragging = null;

  function buildDemo() {
    const wrap = RV.util.el('div', 'rv-demo');

    demoSvg = RV.util.svg('svg', {
      class: 'rv-demo-svg', viewBox: '0 0 320 200',
      role: 'application',
      'aria-label': 'Ei bézier-kurve du kan dra i. Bruk piltastane når eit punkt er valt.'
    });

    wrap.appendChild(demoSvg);
    drawDemo();

    demoSvg.addEventListener('pointerdown', (e) => {
      const p = demoPoint(e);
      const near = Object.keys(DEMO).find(k =>
        Math.hypot(DEMO[k].x - p.x, DEMO[k].y - p.y) < 16);
      if (!near) return;
      dragging = near;
      RV.util.capturePointer(demoSvg, e);
      e.preventDefault();
    });

    demoSvg.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = demoPoint(e);
      DEMO[dragging].x = RV.util.clamp(p.x, 8, 312);
      DEMO[dragging].y = RV.util.clamp(p.y, 8, 192);
      drawDemo();
    });

    demoSvg.addEventListener('pointerup', (e) => {
      dragging = null;
      RV.util.releasePointer(demoSvg, e);
    });

    return wrap;
  }

  function demoPoint(e) {
    const r = demoSvg.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * 320,
      y: (e.clientY - r.top) / r.height * 200
    };
  }

  function drawDemo() {
    RV.util.clear(demoSvg);
    const d = DEMO;
    const r = RV.matrix.round;

    // Armane frå ankerpunkta ut til handtaka.
    [[d.p0, d.c1], [d.p3, d.c2]].forEach((pair) => {
      demoSvg.appendChild(RV.util.svg('line', {
        class: 'rv-demo-arm',
        x1: r(pair[0].x), y1: r(pair[0].y), x2: r(pair[1].x), y2: r(pair[1].y)
      }));
    });

    demoSvg.appendChild(RV.util.svg('path', {
      class: 'rv-demo-curve',
      d: 'M ' + r(d.p0.x) + ' ' + r(d.p0.y) +
         ' C ' + r(d.c1.x) + ' ' + r(d.c1.y) + ' ' +
                 r(d.c2.x) + ' ' + r(d.c2.y) + ' ' +
                 r(d.p3.x) + ' ' + r(d.p3.y)
    }));

    [['p0', 'anchor'], ['p3', 'anchor'], ['c1', 'handle'], ['c2', 'handle']].forEach((pair) => {
      const p = d[pair[0]];
      demoSvg.appendChild(RV.util.svg('circle', {
        class: pair[1] === 'anchor' ? 'rv-demo-anchor' : 'rv-demo-handle',
        cx: r(p.x), cy: r(p.y), r: pair[1] === 'anchor' ? 6 : 5
      }));
    });

    const label = (text, at, dx, dy) => {
      const t = RV.util.svg('text', {
        class: 'rv-demo-label', x: r(at.x + dx), y: r(at.y + dy)
      });
      t.textContent = text;
      demoSvg.appendChild(t);
    };
    label('ankerpunkt', d.p0, -6, 22);
    label('handtak', d.c1, -4, -12);
  }

  /* ──────────────── Vindauget ──────────────── */

  function build() {
    const body = document.getElementById('learnBody');
    RV.util.clear(body);

    body.appendChild(RV.util.el('p', null,
      'Ei vektorteikning er ikkje laga av pikslar. Ho er laga av PUNKT og av reglar for korleis linja går mellom dei. Difor kan du forstørre henne så mykje du vil utan at ho blir uskarp — maskina reknar ut linja på nytt kvar gong.'));

    body.appendChild(RV.util.el('h3', 'rv-tips-head', 'Prøv sjølv'));
    body.appendChild(RV.util.el('p', null,
      'Under er éi einaste kurve. Dei to store prikkane er ANKERPUNKT — der kurva startar og sluttar. Dei to små er HANDTAK. Dra i eit handtak og sjå kva som skjer: kurva blir dregen mot handtaket, som om det var ein magnet.'));

    body.appendChild(buildDemo());

    body.appendChild(RV.util.el('p', 'rv-muted',
      'Legg merke til at kurva aldri når fram til handtaket. Handtaket bestemmer RETNINGA kurva forlèt ankerpunktet i, og kor lenge ho held den retninga.'));

    body.appendChild(RV.util.el('h3', 'rv-tips-head', 'Slik arbeider du med det'));
    const list = RV.util.el('ul', 'rv-tips-notes');
    [
      'Med pennen (P) lagar du punkta sjølv: eit klikk gjev eit hjørne, og dreg du medan du klikkar, får punktet handtak og kurva blir mjuk.',
      'Med punktverktøyet (A) kan du gå tilbake til ei form du har laga og dra i punkta hennar. Klikk på ei kurve for å setje inn eit nytt punkt der.',
      'Eit MJUKT punkt har handtaka sine på line, så kurva glir gjennom utan knekk. Eit HJØRNE har dei fritt, så kurva kan skifte retning brått. Alt-klikk på eit punkt byter mellom dei to.',
      'Alle former er eigentleg det same: eit rektangel er fire punkt utan handtak, og ein sirkel er fire punkt med handtak. Prøv å opne ein sirkel med punktverktøyet og sjå.'
    ].forEach(t => list.appendChild(RV.util.el('li', null, t)));
    body.appendChild(list);

    if (typeof hydrateIcons === 'function') hydrateIcons(body);
  }

  /* ──────────────── Etikettar på flata ──────────────── */

  function setLabels(on, skipSave) {
    showLabels = !!on;
    const btn = document.getElementById('learnLabelsBtn');
    if (btn) {
      btn.classList.toggle('active', showLabels);
      btn.setAttribute('aria-pressed', String(showLabels));
    }
    // Ein elev som treng namna, treng dei òg i morgon.
    if (!skipSave) {
      const store = VyrdepilStorage.getGameState(RV.toolbar.STORE_KEY) || {};
      store.labels = showLabels;
      VyrdepilStorage.setGameState(RV.toolbar.STORE_KEY, store);
    }
    RV.state.emit('hover');
  }

  function labelsOn() {
    return showLabels;
  }

  /*
   * Namn på det som er under peikaren, teikna rett på flata.
   * Berre når node-verktøyet er framme — det er der orda trengst, og
   * berre der dei har noko å peike på.
   */
  RV.overlay.addHook(function (layer) {
    if (!showLabels) return;
    const tool = RV.tools.active();
    if (!tool || tool.id !== 'node') return;

    const nodes = layer.querySelectorAll('.rv-node');
    const handles = layer.querySelectorAll('.rv-handle-dot');
    if (!nodes.length) return;

    const put = (text, x, y) => {
      const t = RV.util.svg('text', { class: 'rv-learn-label', x: RV.matrix.round(x), y: RV.matrix.round(y) });
      t.textContent = text;
      layer.appendChild(t);
    };

    // Berre det første av kvart slag får etikett. Eit ord ved kvart
    // einaste punkt ville dekt heile forma.
    const first = nodes[0];
    put('ankerpunkt', +first.getAttribute('x') + 12, +first.getAttribute('y') - 4);
    if (handles.length) {
      put('handtak', +handles[0].getAttribute('cx') + 10, +handles[0].getAttribute('cy') - 6);
    }
  });

  /* ──────────────── Oppkopling ──────────────── */

  function attach() {
    overlayEl = document.getElementById('learnOverlay');
    RV.util.bindOverlayClose(overlayEl);

    document.getElementById('learnBtn').addEventListener('click', () => {
      build();
      RV.util.openModal(overlayEl);
    });
    document.getElementById('learnCloseBtn')
      .addEventListener('click', () => RV.util.closeModal(overlayEl));

    const labels = document.getElementById('learnLabelsBtn');
    labels.addEventListener('click', () => setLabels(!showLabels));

    const store = VyrdepilStorage.getGameState(RV.toolbar.STORE_KEY);
    setLabels(!!(store && store.labels), true);
  }

  return { attach, setLabels, labelsOn, build };
})();
