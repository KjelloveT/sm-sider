/* ══════════════════════════════════════════════
   UI-FORSIDE.JS — Kven fører protokollen

   Artikkel 30 nr. 1 bokstav a gjeld heile protokollen og ikkje den einskilde
   behandlingsaktiviteten: namnet på og kontaktopplysningane til den
   behandlingsansvarlege, personvernombodet og — dersom verksemda er etablert
   utanfor EØS — representanten. Difor er dette ei eiga side og ikkje ein kolonne.

   Godkjenning og endringshistorikk er ikkje kravde av artikkel 30, men står i
   Datatilsynet sin mal og er verdt å ha: artikkelen krev at protokollen er
   oppdatert, og då må ein kunne sjå kva som er endra og kven som har godkjent
   utgåva.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const U = function () { return GD.util; };
  let vert = null;

  function init(hostId) {
    vert = document.getElementById(hostId);
    if (!vert) return;
    GD.state.onChange(function (emne) {
      if (emne === 'load') teikn();
    });
    teikn();
  }

  function teikn() {
    if (!vert) return;
    vert.textContent = '';
    const u = U();

    GD.felt.FORSIDEGRUPPER.forEach(function (gruppe) {
      const boks = u.el('section', 'gd-gruppe');
      boks.appendChild(u.el('h3', 'heading4 no-mt', gruppe.tittel));

      if (gruppe.naarTrengst) {
        boks.appendChild(u.el('p', 'gd-hjelp', gruppe.naarTrengst));
      }

      if (gruppe.id === 'omgrep') {
        boks.appendChild(feltFor(gruppe.id));
        vert.appendChild(boks);
        return;
      }

      const rutenett = u.el('div', 'gd-rutenett');
      GD.felt.FORSIDE
        .filter(function (f) { return f.gruppe === gruppe.id; })
        .forEach(function (f) { rutenett.appendChild(feltFor(gruppe.id, f)); });
      boks.appendChild(rutenett);
      vert.appendChild(boks);
    });

    vert.appendChild(endringsbolk());

    if (root.GD.uiRettleiing) GD.uiRettleiing.hekt(vert);
  }

  function feltFor(gruppeId, felt) {
    const u = U();
    const f = felt || GD.felt.FORSIDE.filter(function (x) { return x.gruppe === gruppeId; })[0];
    const rad = u.feltrad(f, GD.state.data.forside[f.id], function (verdi) {
      GD.state.settForside(f.id, verdi);
    });

    if (f.art30) {
      const merke = u.el('span', 'gd-krav gd-krav-maa', 'Art. 30 nr. 1 ' + f.art30);
      rad.rot.querySelector('.gd-etikett').appendChild(merke);
    }
    rad.under.dataset.felt = f.id;
    return rad.rot;
  }

  /* ──────────────── Endringshistorikk ──────────────── */

  function endringsbolk() {
    const u = U();
    const boks = u.el('section', 'gd-gruppe');
    boks.appendChild(u.el('h3', 'heading4', 'Endringshistorikk'));
    boks.appendChild(u.el('p', 'gd-hjelp',
      'Protokollen skal haldast oppdatert. Skriv opp kva som er endra, når og av kven, så er det mogleg å sjå kva utgåve tilsynet fekk.'));

    const tabell = u.el('table', 'gd-endringar');
    const thead = u.el('thead');
    const hr = u.el('tr');
    ['Namn', 'Dato', 'Kva er endra', ''].forEach(function (t) {
      hr.appendChild(u.el('th', null, t));
    });
    thead.appendChild(hr);
    tabell.appendChild(thead);

    const tbody = u.el('tbody');
    GD.state.data.endringar.forEach(function (e, i) {
      const tr = u.el('tr');
      tr.appendChild(u.el('td', null, e.namn));
      tr.appendChild(u.el('td', null, e.dato));
      tr.appendChild(u.el('td', null, e.skildring));
      const td = u.el('td');
      const slett = u.ikonknapp('trash', null, 'btn gd-ikonknapp gd-fare');
      slett.setAttribute('aria-label', 'Slett denne linja i endringshistorikken');
      slett.addEventListener('click', function () {
        GD.state.slettEndring(i);
        teikn();
      });
      td.appendChild(slett);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    tabell.appendChild(tbody);

    if (GD.state.data.endringar.length) boks.appendChild(tabell);
    else boks.appendChild(u.el('p', 'gd-muted', 'Ingen endringar er førte opp enno.'));

    /* Skjemaet for ei ny linje. Dato er førehandsutfylt med i dag — det er
       nesten alltid rett, og eit felt du berre må stadfeste er raskare enn eit
       du må fylle ut. */
    const skjema = u.el('div', 'gd-rutenett');
    const namn = u.feltrad({ id: 'nyNamn', type: 'tekst', etikett: 'Namn' }, '', function () {});
    const dato = u.feltrad({ id: 'nyDato', type: 'tekst', etikett: 'Dato' },
      new Date().toISOString().slice(0, 10), function () {});
    const kva = u.feltrad({ id: 'nyKva', type: 'tekst', etikett: 'Kva er endra' }, '', function () {});
    skjema.appendChild(namn.rot);
    skjema.appendChild(dato.rot);
    skjema.appendChild(kva.rot);
    boks.appendChild(skjema);

    const rad = u.el('div', 'gd-knapperad');
    const legg = u.ikonknapp('plus', 'Legg til linje', 'btn');
    legg.addEventListener('click', function () {
      if (U().tom(kva.inn.value)) {
        u.toast('Skriv kva som er endra.');
        kva.inn.focus();
        return;
      }
      GD.state.leggEndring({
        namn: namn.inn.value.trim(),
        dato: dato.inn.value.trim(),
        skildring: kva.inn.value.trim()
      });
      teikn();
    });
    rad.appendChild(legg);
    boks.appendChild(rad);

    return boks;
  }

  root.GD = root.GD || {};
  root.GD.uiForside = { init: init, teikn: teikn };
})(window);
