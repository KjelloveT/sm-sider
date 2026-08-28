/* ══════════════════════════════════════════════
   HAGE.JS — Bokstavhagen, dagsstjerner og merke

   Hagen er heile framgangsvisinga i Ljodstigen. Det finst ingen
   poengsum: vekststeget til kvar plante ER boksen i den adaptive
   motoren, så det eleven ser er nøyaktig det motoren veit. Ingen
   parallell økonomi å balansere, ingenting å jukse i, og ingenting å
   samanlikne med ein annan elev.

   HAGEN VISNAR ALDRI. Vi les maxBox, ikkje box. Ein plante som gjekk
   tilbake fordi eleven bomma ville vore ein straffemekanisme retta mot
   nøyaktig dei elevane appen er til for — sjå adaptive.js.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const R = function () { return LjodRender; };

  /* ──────────────── Hagen ──────────────── */

  /* HAGEN ER I 3D, MED DEN FLATE SOM RESERVE.

     Ei skule-iPad utan WebGL, eit avslått GPU-lag, ei henting som ikkje
     kom fram — alle tre skal ende med ein hage eleven kan sjå, ikkje med
     ei tom rute. Den flate hagen står difor uendra under, og han er det
     som blir teikna medan 3D-hagen lastar.

     Talet under hagen står utanfor lerretet i begge tilfelle. Det er
     framgangen i tekst, og han skal ikkje krevje ein GPU. */
  let hage3d = null;

  function renderGarden(host, p) {
    render2D(host, p);
    if (!LjodHage3D.stott()) return;

    LjodHage3D.last().then(function () {
      if (!host.isConnected) return;
      const flat = host.querySelector('.ljod-garden');
      const vert = R().h('div', 'ljod-hage3d');
      if (flat) host.replaceChild(vert, flat); else host.insertBefore(vert, host.firstChild);
      if (hage3d) hage3d.riv();
      hage3d = LjodHage3D.lag(vert, p);
      host.insertBefore(R().h('p', 'ljod-hint ljod-hage3d-hint',
        'Dra i hagen for å sjå han frå ei anna side.'), vert.nextSibling);
    }).catch(function (e) {
      /* Den flate hagen står allereie. Vi seier frå i konsollen og lèt
         eleven vere i fred. */
      console.warn('[Ljodstigen] 3D-hagen lasta ikkje:', e.message);
    });
  }

  function render2D(host, p) {
    const a = p.adaptive;
    R().clear(host);

    const grid = R().h('div', 'ljod-garden');
    LjodLetters.ALPHABET.forEach(function (ch) {
      const it = a.items[ch];
      const stage = it ? it.maxBox : 0;
      const active = LjodLetters.get(ch).step <= a.step;

      const cell = R().h('div', 'ljod-bed' + (active ? '' : ' is-locked'));
      cell.appendChild(LjodShapes.plant(stage, 52));
      cell.appendChild(R().h('span', 'ljod-bed-letter', ch));

      const stageName = LjodShapes.STAGE_NAMES[stage];
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', active
        ? ('Bokstaven ' + ch.toUpperCase() + ': ' + stageName)
        : ('Bokstaven ' + ch.toUpperCase() + ': ikkje opna enno'));
      cell.title = ch.toUpperCase() + ' — ' + (active ? stageName : 'ikkje opna enno');
      grid.appendChild(cell);
    });
    host.appendChild(grid);

    /* Overskriftstalet er meistring, ikkje poeng. Det går berre opp, og
       kan difor ikkje falle på ein dårleg dag. */
    const st = LjodAdaptive.stats(a);
    const sum = R().h('p', 'ljod-garden-sum');
    sum.textContent = 'Du har ' + st.planted + ' av ' + st.total + ' bokstavar i hagen.' +
      /* «vorte tre» stemde då alle plantene var same plante. No er
         nokre av dei blomar og buskar, og då er «fullvaksen» det ordet
         som gjeld for alle. */
      (st.mastered ? ' ' + st.mastered + ' er fullvaksne.' : '');
    host.appendChild(sum);
  }

  /* ──────────────── Dagsstjerner ──────────────── */

  function renderStars(host, p) {
    R().clear(host);
    const today = LjodState.today();
    const got = (p.stars.date === today) ? p.stars.ids : [];

    const row = R().h('div', 'ljod-stars');
    LjodState.STARS.forEach(function (s) {
      const earned = got.indexOf(s.id) !== -1;
      const cell = R().h('div', 'ljod-star' + (earned ? ' is-earned' : ''));
      cell.appendChild(LjodShapes.star(34, earned));
      cell.appendChild(R().h('span', 'ljod-star-label', s.label));
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', s.label + (earned ? ': teken' : ': ikkje teken enno'));
      row.appendChild(cell);
    });
    host.appendChild(row);

    const streak = LjodState.streakDays(p);
    if (streak >= 2) {
      host.appendChild(R().h('p', 'ljod-streak', 'Du har spelt ' + streak + ' dagar på rad.'));
    }
  }

  /* ──────────────── Merke ──────────────── */

  function renderBadges(host, p) {
    R().clear(host);
    const grid = R().h('div', 'ljod-badges');
    LjodMerke.all().forEach(function (b) {
      const earned = p.badges.indexOf(b.id) !== -1;
      const cell = R().h('div', 'ljod-badge' + (earned ? ' is-earned' : ''));
      cell.appendChild(LjodShapes.badge(44, earned));
      cell.appendChild(R().h('span', 'ljod-badge-title', b.title));
      cell.appendChild(R().h('span', 'ljod-badge-hint', b.hint));
      cell.setAttribute('aria-label', b.title + '. ' + b.hint + (earned ? '. Teke.' : '. Ikkje teke enno.'));
      grid.appendChild(cell);
    });
    host.appendChild(grid);
  }

  /* ──────────────── Feiring ──────────────── */

  /* Canvas berre her, til partiklar. Det er den eine staden DOM ikkje
     har nokon fordel — og den einaste staden vi teiknar noko som ikkje
     ber informasjon. */
  function celebrate(canvas, opts) {
    opts = opts || {};
    if (!canvas || !canvas.getContext) return;
    /* Respekter at nokon har bede om mindre rørsle. */
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth, hgt = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = hgt * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colour = getComputedStyle(canvas).color || '#000';
    const n = opts.count || 26;
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push({
        x: w / 2, y: hgt * 0.55,
        vx: (Math.random() - 0.5) * 7,
        vy: -3 - Math.random() * 6,
        r: 3 + Math.random() * 5,
        life: 1
      });
    }

    let raf = 0;
    const t0 = performance.now();
    function frame(t) {
      const dt = Math.min(32, t - (frame.last || t)); frame.last = t;
      ctx.clearRect(0, 0, w, hgt);
      ctx.fillStyle = colour;
      let alive = 0;
      parts.forEach(function (p) {
        if (p.life <= 0) return;
        alive++;
        p.vy += 0.028 * dt;
        p.x += p.vx * dt / 16;
        p.y += p.vy * dt / 16;
        p.life -= dt / 1100;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (alive && t - t0 < 2200) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, hgt);
    }
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  root.LjodHage = {
    renderGarden: renderGarden,
    /* Den aktive 3D-hagen, om han finst. Meny og innstillingar treng han
       for å teikne på nytt når noko utanfor hagen endrar seg. */
    hage3d: function () { return hage3d; },
    renderStars: renderStars,
    renderBadges: renderBadges,
    celebrate: celebrate
  };
})(window);
