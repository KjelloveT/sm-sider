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

  const VERKTOY = [
    { t: '=', namn: 'Plattform', sprite: 'tile_bridge' },
    { t: 'P', namn: 'Bokstavsokkel', sprite: 'tile_block' },
    { t: 'c', namn: 'Mynt', sprite: 'tile_coin' },
    { t: 'T', namn: 'Tre', sprite: 'background_tree' },
    { t: '@', namn: 'Start', sprite: null },
    { t: 'D', namn: 'Dør', sprite: 'tile_door' },
    { t: '.', namn: 'Viskelêr', sprite: null }
  ];

  let atlas = null;
  let gitter = null;
  let bane = null;

  function $(id) { return document.getElementById(id); }

  /* ──────────────── Palett ──────────────── */

  function byggPalett() {
    const vert = $('palett');
    VERKTOY.forEach(function (v, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bl-verktoy' + (i === 0 ? ' active' : '');
      b.dataset.teikn = v.t;
      const ikon = document.createElement('span');
      ikon.className = 'bl-ikon';
      if (v.sprite && atlas && atlas.frames[v.sprite]) {
        const f = atlas.frames[v.sprite].frame, C = 30;
        const sx = C / f.w, sy = C / f.h;
        ikon.style.backgroundImage = 'url("jakta/atlas.png")';
        ikon.style.backgroundSize = (atlas.meta.size.w * sx) + 'px ' + (atlas.meta.size.h * sy) + 'px';
        ikon.style.backgroundPosition = (-f.x * sx) + 'px ' + (-f.y * sy) + 'px';
      } else {
        ikon.textContent = v.t === '@' ? '★' : '✕';
      }
      b.appendChild(ikon);
      b.appendChild(document.createTextNode(v.namn));
      b.addEventListener('click', function () {
        gitter.verktoy = v.t;
        Array.prototype.forEach.call(vert.children, function (c) { c.classList.remove('active'); });
        b.classList.add('active');
      });
      vert.appendChild(b);
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
      laga: bane.laga
    };
  }

  function last(b) {
    bane = JaktaEigne.normaliser(b);
    $('namn').value = bane.namn;
    $('type').value = bane.type;
    $('bokstavar').value = bane.bokstavar.join(' ');
    gitter.settRutenett(bane.rutenett);
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
    }).catch(function () {
      $('status').textContent = 'Fekk ikkje lasta grafikken. Last sida på nytt.';
    });
  }

  root.Banelagar = { start: start, VERKTOY: VERKTOY };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})(window);
