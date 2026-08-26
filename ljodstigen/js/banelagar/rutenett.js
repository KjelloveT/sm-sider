/* ══════════════════════════════════════════════
   RUTENETT.JS — Teikneflata i Banelagar

   INGEN PHASER HER. Ein redigerar treng ikkje ein spelmotor for å teikne
   eit rutenett, og ei side som slepp 1 MB motor opnar raskare på ein
   skule-iPad.

   Cellene er DOM-KNAPPAR med eit utsnitt av atlas.png som bakgrunn. Same
   grafikk som spelet, ingen ny — og kvar celle blir eit element som kan
   få fokus og ein aria-label. Det er noko eit lerret ikkje gjev deg, og
   det er verdt meir enn den vesle ytinga eit lerret ville spart.

   SOKKELEN ER TEIKNA, MEN LÅST. Han kan ikkje redigerast, og det skal
   synast: det er den enklaste måten å forklare at verda byggjer oppå han.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const RADER = 7;
  const BASIS = 3;
  const SKJERM = 16;            // fliser per skjermbreidd

  /* Kva sprite kvart teikn blir vist med i redigeraren. */
  const SPRITE = {
    '=': 'tile_bridge',
    'P': 'tile_block',
    'D': 'tile_door',
    'c': 'tile_coin',
    'T': 'background_tree',
    '#': 'tile_grass',
    '_': 'tile'
  };

  const NAMN = {
    '.': 'tom', '=': 'plattform', 'P': 'bokstavsokkel', 'D': 'dør',
    'c': 'mynt', 'T': 'tre', '@': 'startpunkt', '#': 'grunn', '_': 'stein'
  };

  function lag(vert, opts) {
    opts = opts || {};
    const r = {
      rader: [],
      cellePx: opts.cellePx || 40,
      atlas: opts.atlas,             // { frames, meta } frå atlas.json
      verktoy: '=',
      onEndra: opts.onEndra || function () {},
      celler: []
    };

    let malar = false;

    /* ──────────────── Bakgrunn frå atlaset ──────────────── */

    function bakgrunn(el, spriteNamn) {
      if (!spriteNamn || !r.atlas || !r.atlas.frames[spriteNamn]) {
        el.style.backgroundImage = '';
        return;
      }
      const f = r.atlas.frames[spriteNamn].frame;
      const C = r.cellePx;
      const sx = C / f.w, sy = C / f.h;
      el.style.backgroundImage = 'url("jakta/atlas.png")';
      el.style.backgroundSize = (r.atlas.meta.size.w * sx) + 'px ' +
        (r.atlas.meta.size.h * sy) + 'px';
      el.style.backgroundPosition = (-f.x * sx) + 'px ' + (-f.y * sy) + 'px';
      el.style.backgroundRepeat = 'no-repeat';
    }

    /* ──────────────── Bygging ──────────────── */

    r.settRutenett = function (tekst) {
      r.rader = String(tekst).replace(/\r/g, '').split('\n')
        .filter(function (l) { return l.trim().length > 0 && l.trim().slice(0, 2) !== '//'; });
      /* Alltid RADER høge og like lange — ein redigerar skal ikkje kunne
         lage eit ujamt gitter i det heile. */
      const breidd = Math.max.apply(null, r.rader.map(function (l) { return l.length; }));
      while (r.rader.length < RADER) r.rader.unshift('.'.repeat(breidd));
      r.rader = r.rader.slice(0, RADER).map(function (l) {
        return (l + '.'.repeat(breidd)).slice(0, breidd);
      });
      bygg();
    };

    r.tekst = function () { return r.rader.join('\n'); };
    r.breidd = function () { return r.rader[0] ? r.rader[0].length : 0; };

    r.settBreidd = function (skjermar) {
      const ny = Math.max(1, Math.min(30, skjermar)) * SKJERM;
      const gamal = r.breidd();
      r.rader = r.rader.map(function (l, y) {
        if (ny > gamal) return l + '.'.repeat(ny - gamal);
        return l.slice(0, ny);
      });
      /* Døra og startpunktet må halde seg innanfor. Blir banen smalare,
         flyttar dei til kvar sin ende i staden for å forsvinne — ein
         lærar som dreg i breidda skal ikkje sitje att med ein bane som
         plutseleg manglar starten. */
      const y = RADER - 1;
      if (r.tekst().indexOf('D') === -1) {
        r.rader[y] = r.rader[y].slice(0, ny - 1) + 'D';
      }
      if (r.tekst().indexOf('@') === -1) {
        r.rader[y] = r.rader[y].slice(0, 1) + '@' + r.rader[y].slice(2);
      }
      bygg();
      r.onEndra();
    };

    function bygg() {
      vert.innerHTML = '';
      r.celler = [];
      const breidd = r.breidd();
      const tab = document.createElement('div');
      tab.className = 'bl-gitter';
      tab.style.gridTemplateColumns = 'repeat(' + breidd + ', ' + r.cellePx + 'px)';
      tab.setAttribute('role', 'grid');
      tab.setAttribute('aria-label', 'Baneflata, ' + breidd + ' ruter brei');

      for (let y = 0; y < RADER; y++) {
        const rad = [];
        for (let x = 0; x < breidd; x++) {
          const c = document.createElement('button');
          c.type = 'button';
          c.className = 'bl-celle';
          c.style.width = c.style.height = r.cellePx + 'px';
          c.dataset.x = x; c.dataset.y = y;
          teiknCelle(c, r.rader[y][x]);
          c.addEventListener('pointerdown', function (e) {
            malar = true;
            e.preventDefault();
            mal(x, y);
            c.setPointerCapture && c.releasePointerCapture &&
              c.releasePointerCapture(e.pointerId);
          });
          c.addEventListener('pointerenter', function () { if (malar) mal(x, y); });
          c.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mal(x, y); }
          });
          tab.appendChild(c);
          rad.push(c);
        }
        r.celler.push(rad);
      }

      /* Sokkelen: teikna, men ikkje redigerbar. */
      for (let i = 0; i < BASIS; i++) {
        for (let x = 0; x < breidd; x++) {
          const c = document.createElement('div');
          c.className = 'bl-celle bl-basis';
          c.style.width = c.style.height = r.cellePx + 'px';
          bakgrunn(c, i === 0 ? 'tile_grass' : 'tile');
          if (i === 0 && x === 0) c.title = 'Fast bakke. Denne er lik i alle baner.';
          tab.appendChild(c);
        }
      }
      vert.appendChild(tab);
    }

    function teiknCelle(el, t) {
      el.dataset.teikn = t;
      el.className = 'bl-celle' + (t === '@' ? ' bl-start' : '');
      el.textContent = '';
      bakgrunn(el, SPRITE[t]);
      if (t === '@') el.textContent = '★';
      el.setAttribute('aria-label',
        'Rad ' + (+el.dataset.y + 1) + ', kolonne ' + (+el.dataset.x + 1) + ': ' + (NAMN[t] || t));
    }

    /* ──────────────── Maling ──────────────── */

    function mal(x, y) {
      const t = r.verktoy;
      const gamal = r.rader[y][x];
      if (gamal === t) return;

      /* Det kan berre vere eitt startpunkt og éi dør. Set ein eit nytt,
         forsvinn det gamle — det er meir forståeleg enn ei feilmelding
         om at ein må fjerne det gamle først. */
      if (t === '@' || t === 'D') {
        for (let yy = 0; yy < RADER; yy++) {
          const i = r.rader[yy].indexOf(t);
          if (i !== -1) {
            r.rader[yy] = r.rader[yy].slice(0, i) + '.' + r.rader[yy].slice(i + 1);
            if (r.celler[yy] && r.celler[yy][i]) teiknCelle(r.celler[yy][i], '.');
          }
        }
      }
      r.rader[y] = r.rader[y].slice(0, x) + t + r.rader[y].slice(x + 1);
      teiknCelle(r.celler[y][x], t);
      r.onEndra();
    }

    root.addEventListener('pointerup', function () { malar = false; });
    root.addEventListener('pointercancel', function () { malar = false; });

    /** Marker ruter validatoren klagar på. */
    r.markerFeil = function (punkt) {
      r.celler.forEach(function (rad) {
        rad.forEach(function (c) { c.classList.remove('bl-feil'); });
      });
      (punkt || []).forEach(function (p) {
        if (r.celler[p.y] && r.celler[p.y][p.x]) r.celler[p.y][p.x].classList.add('bl-feil');
      });
    };

    return r;
  }

  root.BanelagarRutenett = { lag: lag, RADER: RADER, BASIS: BASIS, SKJERM: SKJERM, NAMN: NAMN };
})(window);
