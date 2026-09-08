/* ══════════════════════════════════════════════
   MAIN.JS — Kopling

   Startar modulane, bind knappane, og held biblioteket ved like.
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  const U = function () { return GD.util; };

  /* ──────────────── Tema ────────────────

     Protokollsmia har berre ei lys utgåve. Men `applyStoredTheme()` i
     js/neobrutalisme.js les eit lagra temaval frå localStorage og set det
     globalt på <body> — så ein som har valt «dracula» på ei anna Vyrdepil-side
     ville kome hit med mørke fargevariablar under eit stilark som berre er
     tenkt for lyst. Resultatet er ikkje eit stygt tema; det er uleseleg tekst.

     Vi pinnar difor temaet eksplisitt, og gjer det både med ein gong og etter
     at DOM-en er lasta, sidan applyStoredTheme() køyrer på DOMContentLoaded og
     elles ville vunne over oss.

     Temaknappen i toppmenyen er skrudd av med `no-theme` på <neo-header>. Ein
     knapp som ikkje gjer noko er verre enn ingen knapp. */
  const TEMA = 'classic';

  function pinnTema() {
    document.body.setAttribute('data-theme', TEMA);
    document.body.setAttribute('data-light-theme', TEMA);
    document.body.setAttribute('data-dark-theme', TEMA);
  }

  /* ──────────────── Biblioteket ──────────────── */

  function teiknBibliotek() {
    const vert = document.getElementById('bibliotek');
    if (!vert) return;
    const u = U();
    vert.textContent = '';

    const liste = GD.storage.alle();
    if (!liste.length) {
      vert.appendChild(u.el('p', 'gd-muted',
        'Ingen lagra protokollar i denne nettlesaren enno.'));
      return;
    }

    const boks = u.el('div', 'gd-liste');
    liste.slice().reverse().forEach(function (p) {
      const rad = u.el('div', 'gd-rad');

      const opne = u.el('button', 'gd-rad-knapp');
      opne.type = 'button';
      opne.style.all = 'unset';
      opne.style.cursor = 'pointer';
      opne.style.display = 'block';
      opne.appendChild(u.el('div', 'gd-rad-tittel', p.name || 'Utan namn'));
      opne.appendChild(u.el('div', 'gd-rad-under',
        (Array.isArray(p.aktivitetar) ? p.aktivitetar.length : 0) + ' aktivitetar · lagra ' +
        String(p.date || '').slice(0, 10)));
      opne.addEventListener('click', function () {
        GD.state.load(p);
        u.toast('Protokollen er opna.');
      });
      rad.appendChild(opne);

      const styring = u.el('div', 'gd-rad-styring');
      const slett = u.ikonknapp('trash', null, 'btn gd-ikonknapp gd-fare');
      slett.setAttribute('aria-label', 'Slett denne protokollen frå nettlesaren');
      slett.addEventListener('click', function () {
        GD.storage.slett(p.id);
        teiknBibliotek();
        u.toast('Sletta frå nettlesaren.');
      });
      styring.appendChild(slett);
      rad.appendChild(styring);

      boks.appendChild(rad);
    });
    vert.appendChild(boks);
  }

  /* ──────────────── Knappane ──────────────── */

  function bind() {
    const u = U();

    const nyBtn = document.getElementById('nyAktivitet');
    if (nyBtn) {
      nyBtn.addEventListener('click', function () {
        GD.state.leggTil();
        document.getElementById('skjema').scrollIntoView({ block: 'start' });
      });
    }

    const lagreBtn = document.getElementById('lagre');
    if (lagreBtn) {
      lagreBtn.addEventListener('click', function () {
        const namn = GD.state.data.forside.verksemd;
        if (U().tom(namn)) {
          u.toast('Skriv namnet på verksemda på forsida først, så veit vi kva protokollen heiter.', { kind: 'warn' });
          return;
        }
        GD.storage.lagre(namn);
        teiknBibliotek();
        u.toast('Lagra i nettlesaren.');
      });
    }

    const nyProtokoll = document.getElementById('nyProtokoll');
    if (nyProtokoll) {
      nyProtokoll.addEventListener('click', function () {
        GD.state.nullstill();
        u.toast('Ny, tom protokoll.');
      });
    }

    const eksportBtn = document.getElementById('eksporterJson');
    if (eksportBtn) {
      eksportBtn.addEventListener('click', function () {
        GD.storage.eksporter();
      });
    }

    /* Import går gjennom eit skjult filfelt. `value = ''` til slutt, elles kan
       ikkje same fila veljast to gonger på rad. */
    const importBtn = document.getElementById('importerBtn');
    const importFil = document.getElementById('importerFil');
    if (importBtn && importFil) {
      importBtn.addEventListener('click', function () { importFil.click(); });
      importFil.addEventListener('change', function (e) {
        const fil = e.target.files && e.target.files[0];
        if (!fil) return;
        const lesar = new FileReader();
        lesar.onload = function () {
          try {
            GD.state.load(GD.storage.lesFil(String(lesar.result)));
            u.toast('Protokollen er opna.');
          } catch (err) {
            u.toast(err.message, { kind: 'warn', ms: 6000 });
          }
        };
        lesar.readAsText(fil);
        e.target.value = '';
      });
    }

    const sjekkBtn = document.getElementById('koeyrSjekk');
    if (sjekkBtn) {
      sjekkBtn.addEventListener('click', function () { GD.uiSjekk.teikn(); });
    }

    const utBtn = document.getElementById('skrivUt');
    if (utBtn) utBtn.addEventListener('click', function () { GD.print.skrivUt(); });

    const htmlBtn = document.getElementById('eksporterHtml');
    if (htmlBtn) htmlBtn.addEventListener('click', function () { GD.exportHtml.lastNed(); });

    /* .xlsx lastar JSZip på etterspurnad, så knappen kan bruke eit augeblikk
       første gongen. Vi seier frå i staden for å la han sjå daud ut. */
    const xlsxBtn = document.getElementById('eksporterXlsx');
    if (xlsxBtn) {
      xlsxBtn.addEventListener('click', function () {
        if (!GD.state.aktivitetar().length) {
          u.toast('Legg til minst éin behandlingsaktivitet først.', { kind: 'warn' });
          return;
        }
        xlsxBtn.disabled = true;
        GD.exportXlsx.lastNed()
          .catch(function (e) { u.toast(e.message, { kind: 'warn', ms: 6000 }); })
          .then(function () { xlsxBtn.disabled = false; });
      });
    }

    const slettAlt = document.getElementById('slettAlt');
    if (slettAlt) {
      slettAlt.addEventListener('click', function () {
        const overlegg = document.getElementById('slettAltOverlegg');
        if (overlegg) u.openModal(overlegg);
      });
    }
    const slettAltJa = document.getElementById('slettAltJa');
    if (slettAltJa) {
      slettAltJa.addEventListener('click', function () {
        GD.storage.slettAlt();
        GD.state.nullstill();
        teiknBibliotek();
        u.closeModal(document.getElementById('slettAltOverlegg'));
        u.toast('Alt Protokollsmia hadde lagra er sletta.');
      });
    }

    /* Lukk-knappane og klikk utanfor på alle overlegg. Escape er handtert
       globalt i Vy. */
    Array.prototype.forEach.call(document.querySelectorAll('.modal-overlay'), function (o) {
      u.bindOverlayClose(o);
      Array.prototype.forEach.call(o.querySelectorAll('[data-lukk]'), function (b) {
        b.addEventListener('click', function () { u.closeModal(o); });
      });
    });
  }

  /* ──────────────── Faner ──────────────── */

  function bindFaner() {
    const faner = document.querySelectorAll('[data-fane]');
    const flater = document.querySelectorAll('[data-flate]');
    Array.prototype.forEach.call(faner, function (fane) {
      fane.addEventListener('click', function () {
        const maal = fane.dataset.fane;
        Array.prototype.forEach.call(faner, function (f) {
          const aktiv = f === fane;
          f.classList.toggle('active', aktiv);
          f.setAttribute('aria-selected', aktiv ? 'true' : 'false');
        });
        Array.prototype.forEach.call(flater, function (fl) {
          fl.hidden = fl.dataset.flate !== maal;
        });
      });
    });
  }

  /* ──────────────── Oppstart ──────────────── */

  function start() {
    pinnTema();
    GD.uiForside.init('forside');
    GD.uiListe.init('aktivitetsliste');
    GD.uiSkjema.init('skjema');
    bind();
    bindFaner();
    teiknBibliotek();
    GD.vegvisar.init('vegvisar');

    /* Rettleiinga kjem etter at skjemaet står. Verktøyet skal vere brukbart
       sjølv om hentinga feilar — skjemaet er produktet, rettleiinga er laget
       oppå. Difor ei melding og ikkje ein stopp. */
    GD.innhald.last().then(function (res) {
      GD.uiForside.teikn();
      GD.uiSkjema.teikn();
      if (res.feil.length) {
        U().toast('Rettleiingsteksten kunne ikkje lastast. Du kan framleis fylle ut protokollen.',
          { kind: 'warn', ms: 7000 });
      }
    });

    GD.state.onChange(function (emne) {
      if (emne === 'load') teiknBibliotek();
    });
  }

  pinnTema();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
