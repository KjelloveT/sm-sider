/* ══════════════════════════════════════════════
   MAIN.JS — Banelagar

   Eit forenkla Mario Maker for Bokstavjakta. Læraren teiknar geometrien;
   kva bokstavar som dukkar opp vel den adaptive motoren — med mindre han
   låser dei sjølv.

   VALIDERING MEDAN EIN TEIKNAR. Same validator som dei innebygde banene.
   Ein sokkel som ikkje kan nåast blir merkt med ein gong, med ei setning
   om kvifor. Ein lærar skal ikkje oppdage at banen er umogleg først når
   ein elev sit fast i han.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Verktøy som ikkje er ein kloss i biblioteket: startpunktet og
     viskelêret. Dei har ikkje eit sprite, så dei står her. */
  const REIDSKAP = [
    { t: '@', namn: 'Start', teikn: '★' },
    { t: '.', namn: 'Viskelêr', teikn: '✕' }
  ];

  let atlas = null;
  let gitter = null;
  let bane = null;

  function $(id) { return document.getElementById(id); }

  /* ──────────────── Palett ──────────────── */

  /* HUNDRE OG FEMTI KLOSSAR I EI RAD ER INGEN MENY. Dei ligg i grupper,
     éi open om gongen, med eit søkjefelt over. Det er skilnaden mellom
     eit bibliotek ein kan bla i og ei veggflate.

     Namnet står på kvar knapp. Det er ikkje pynt: det er slik læraren
     kan seie «stigen bør kunne klatrast» og vi veit begge kva kloss det
     gjeld. Sprite-nøkkelen ligg i title-attributtet for same grunn. */
  function ikonFor(el, spriteNamn, px) {
    const f = atlas && atlas.frames[spriteNamn] && atlas.frames[spriteNamn].frame;
    if (!f) return false;
    /* Sideforhold: eit tre er dobbelt så høgt som breitt, og skal ikkje
       stå og skjelve i ei kvadratisk rute. Skalér etter den lengste sida. */
    const k = px / Math.max(f.w, f.h);
    el.style.backgroundImage = 'url("jakta/atlas.png")';
    el.style.backgroundSize = (atlas.meta.size.w * k) + 'px ' + (atlas.meta.size.h * k) + 'px';
    el.style.backgroundPosition = (-f.x * k) + 'px ' + (-f.y * k) + 'px';
    return true;
  }

  function velgVerktoy(t, knapp) {
    gitter.verktoy = t;
    const gamle = document.querySelectorAll('.bl-verktoy.active');
    Array.prototype.forEach.call(gamle, function (c) { c.classList.remove('active'); });
    knapp.classList.add('active');
  }

  function lagKnapp(t, namn, spriteNamn, tittel) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bl-verktoy';
    b.dataset.teikn = t;
    b.dataset.sok = (namn + ' ' + (spriteNamn || '')).toLowerCase();
    if (tittel) b.title = tittel;
    const ikon = document.createElement('span');
    ikon.className = 'bl-ikon';
    if (!spriteNamn || !ikonFor(ikon, spriteNamn, 30)) ikon.textContent = t === '@' ? '★' : '✕';
    b.appendChild(ikon);
    const merkelapp = document.createElement('span');
    merkelapp.className = 'bl-verktoy-namn';
    merkelapp.textContent = namn;
    b.appendChild(merkelapp);
    b.addEventListener('click', function () { velgVerktoy(t, b); });
    return b;
  }

  function byggPalett() {
    const vert = $('palett');
    vert.innerHTML = '';

    JaktaBlokker.GRUPPER.forEach(function (g, gi) {
      const boks = document.createElement('details');
      boks.className = 'bl-gruppe';
      boks.open = gi === 0;

      const tittel = document.createElement('summary');
      tittel.textContent = g.namn + ' (' + g.blokker.length + ')';
      boks.appendChild(tittel);

      if (g.hint) {
        const h = document.createElement('p');
        h.className = 'ljod-hint';
        h.textContent = g.hint;
        boks.appendChild(h);
      }

      const rad = document.createElement('div');
      rad.className = 'bl-palett';

      /* Startpunktet og viskelêret høyrer saman med dei fem som gjer
         noko — det er den gruppa ein arbeider i mest. */
      if (g.id === 'funksjon') {
        REIDSKAP.forEach(function (v) {
          rad.appendChild(lagKnapp(v.t, v.namn, null, null));
        });
      }

      g.blokker.forEach(function (b) {
        /* Klossar med funksjon er teikn i rutenettet; resten er pynt, og
           då er sjølve spritenamnet verktøyet. Sjå mal() i rutenett.js. */
        rad.appendChild(lagKnapp(b.f || b.s, b.n, b.s, b.s));
      });

      /* TRELLEKKJE: berre éi gruppe open om gongen. Med tolv opne
         grupper er stolpen fem skjermar lang, og då er han tilbake til
         problemet han skulle løyse. */
      boks.addEventListener('toggle', function () {
        if (!boks.open) return;
        const andre = vert.querySelectorAll('.bl-gruppe[open]');
        Array.prototype.forEach.call(andre, function (a) {
          if (a !== boks) a.open = false;
        });
        vert.parentNode.scrollTop = boks.offsetTop - vert.offsetTop;
      });

      boks.appendChild(rad);
      vert.appendChild(boks);
    });

    /* Første knappen — Start — er vald frå byrjinga, så noko alltid er det. */
    const forste = vert.querySelector('.bl-verktoy[data-teikn="="]');
    if (forste) velgVerktoy('=', forste);
  }

  /* Søket opnar gruppene som har treff og lukkar dei som ikkje har det.
     Med hundre og femti klossar er det raskare å skrive «lykt» enn å
     hugse om ho ligg under Natur eller Bygningar. */
  function filtrer(ord) {
    const q = String(ord || '').trim().toLowerCase();
    const grupper = document.querySelectorAll('.bl-gruppe');
    Array.prototype.forEach.call(grupper, function (g) {
      let treff = 0;
      const knappar = g.querySelectorAll('.bl-verktoy');
      Array.prototype.forEach.call(knappar, function (k) {
        const vis = !q || k.dataset.sok.indexOf(q) !== -1;
        k.hidden = !vis;
        if (vis) treff++;
      });
      g.hidden = q && !treff;
      if (q) g.open = true;
    });
  }

  /* ──────────────── Validering ──────────────── */

  function valider() {
    const res = JaktaValidator.sjekk(gitter.tekst());
    const boks = $('status');
    boks.className = 'bl-status ' + (res.ok ? 'is-ok' : 'is-feil');
    boks.textContent = '';

    /* Plukk ut koordinatane frå meldingane, så feilen kan markerast i
       rutenettet og ikkje berre skildrast i ord. */
    const punkt = [];
    res.feil.forEach(function (f) {
      const m = f.match(/rad (\d+), kolonne (\d+)/);
      if (m) punkt.push({ y: +m[1] - 1, x: +m[2] - 1 });
    });
    gitter.markerFeil(punkt);

    if (res.ok) {
      boks.textContent = 'Banen er spelbar.';
    } else {
      const ul = document.createElement('ul');
      res.feil.slice(0, 4).forEach(function (f) {
        const li = document.createElement('li');
        li.textContent = f;
        ul.appendChild(li);
      });
      boks.appendChild(ul);
    }
    $('lagre').disabled = !res.ok;
    $('proev').disabled = !res.ok;
    return res.ok;
  }

  /* ──────────────── Lista over eigne baner ──────────────── */

  function visListe() {
    const vert = $('mine');
    vert.innerHTML = '';
    const alle = JaktaEigne.alle();
    if (!alle.length) {
      const p = document.createElement('p');
      p.className = 'ljod-hint';
      p.textContent = 'Ingen eigne baner enno. Teikn ein og trykk Lagre.';
      vert.appendChild(p);
      return;
    }
    alle.forEach(function (b) {
      const kort = document.createElement('div');
      kort.className = 'bl-kort';

      const tittel = document.createElement('strong');
      tittel.textContent = b.namn;
      kort.appendChild(tittel);

      const meta = document.createElement('span');
      meta.className = 'bl-kort-meta';
      const bredde = (b.rutenett.split('\n')[0] || '').length / 16;
      meta.textContent = bredde.toFixed(0) + ' skjermar · ' +
        ({ lyd: 'Finn bokstaven', rekkje: 'Fleire bokstavar', ord: 'Heilt ord' }[b.type]) +
        (b.bokstavar.length ? ' · ' + b.bokstavar.join(' ') : ' · adaptivt');
      kort.appendChild(meta);

      const rad = document.createElement('div');
      rad.className = 'bl-kort-knappar';
      [
        ['Opne', function () { last(b); }],
        ['Spel', function () { root.location.href = 'jakta.html?bane=eigen:' + b.id; }],
        ['Del', function () { eksporter(b); }],
        ['Slett', function () {
          if (!confirm('Slette «' + b.namn + '»?')) return;
          JaktaEigne.slett(b.id); visListe();
        }]
      ].forEach(function (k) {
        const kn = document.createElement('button');
        kn.type = 'button';
        kn.className = 'btn';
        kn.textContent = k[0];
        kn.addEventListener('click', k[1]);
        rad.appendChild(kn);
      });
      kort.appendChild(rad);
      vert.appendChild(kort);
    });
  }

  /* ──────────────── Lagring og deling ──────────────── */

  function samle() {
    return {
      id: bane.id,
      namn: $('namn').value.trim() || 'Ny bane',
      type: $('type').value,
      bokstavar: $('bokstavar').value.toLowerCase().split(/[^a-zæøå]+/)
        .filter(function (c) { return c.length === 1 && LjodLetters.get(c); }),
      rutenett: gitter.tekst(),
      pynt: gitter.pyntListe(),
      laga: bane.laga
    };
  }

  function last(b) {
    bane = JaktaEigne.normaliser(b);
    $('namn').value = bane.namn;
    $('type').value = bane.type;
    $('bokstavar').value = bane.bokstavar.join(' ');
    gitter.settRutenett(bane.rutenett, bane.pynt);
    $('breidd').textContent = (gitter.breidd() / 16);
    valider();
    $('rutenett-vert').scrollLeft = 0;
  }

  function eksporter(b) {
    const tekst = JaktaEigne.tilJson(b);
    const blob = new Blob([tekst], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ljodstigen-bane-' + b.namn.replace(/[^a-zA-Zæøå0-9]+/g, '-').toLowerCase() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importer(fil) {
    const les = new FileReader();
    les.onload = function () {
      const res = JaktaEigne.fraaJson(les.result);
      if (!res.ok) { alert(res.grunn); return; }
      JaktaEigne.lagre(res.bane);
      visListe();
      last(res.bane);
    };
    les.readAsText(fil);
  }

  /* ──────────────── Oppstart ──────────────── */

  function start() {
    fetch('jakta/atlas.json').then(function (r) { return r.json(); }).then(function (a) {
      atlas = a;
      gitter = BanelagarRutenett.lag($('rutenett-vert'), {
        atlas: atlas,
        cellePx: 40,
        onEndra: valider
      });
      byggPalett();

      bane = JaktaEigne.normaliser({ rutenett: JaktaEigne.tom(2) });
      last(bane);
      visListe();

      $('breiddPluss').addEventListener('click', function () {
        gitter.settBreidd(Math.round(gitter.breidd() / 16) + 1);
        $('breidd').textContent = gitter.breidd() / 16;
      });
      $('breiddMinus').addEventListener('click', function () {
        gitter.settBreidd(Math.round(gitter.breidd() / 16) - 1);
        $('breidd').textContent = gitter.breidd() / 16;
      });
      $('lagre').addEventListener('click', function () {
        if (!valider()) return;
        bane = JaktaEigne.lagre(samle());
        visListe();
        $('status').textContent = 'Lagra «' + bane.namn + '».';
      });
      $('nybane').addEventListener('click', function () {
        bane = JaktaEigne.normaliser({ rutenett: JaktaEigne.tom(2) });
        last(bane);
      });
      $('proev').addEventListener('click', function () {
        if (!valider()) return;
        bane = JaktaEigne.lagre(samle());
        visListe();
        root.location.href = 'jakta.html?bane=eigen:' + bane.id;
      });
      $('importfil').addEventListener('change', function (e) {
        if (e.target.files[0]) importer(e.target.files[0]);
        e.target.value = '';
      });
      $('importer').addEventListener('click', function () { $('importfil').click(); });
      $('sok').addEventListener('input', function (e) { filtrer(e.target.value); });
    }).catch(function () {
      $('status').textContent = 'Fekk ikkje lasta grafikken. Last sida på nytt.';
    });
  }

  root.Banelagar = { start: start, filtrer: filtrer };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})(window);
