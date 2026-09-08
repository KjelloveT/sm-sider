/* ══════════════════════════════════════════════
   PRINT.JS — Protokollen på papir

   Arket blir bygd i `#printArea`, som ligg utanfor `.page-wrapper` og er
   `display: none` på skjerm. Same mønster som leitekryss og tidvis.

   EI RAD PER AKTIVITET, IKKJE NITTEN KOLONNAR. Ein tabell med nitten kolonnar
   på A4 gjev tre millimeter per kolonne, og det er uleseleg. På papir blir kvar
   behandlingsaktivitet difor eit eige avsnitt med merkelapp og verdi under
   kvarandre. Reknearket er staden for kolonneforma — papiret er staden for å
   lese.

   TOMME FELT BLIR TEKNE MED, med ein tydeleg strek. Eit felt som manglar i eit
   dokument tilsynet får, skal vere synleg som eit hol og ikkje som noko som
   ikkje fanst. Det er skilnaden på ein protokoll som er ufullstendig og ein som
   ser komplett ut.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const U = function () { return GD.util; };

  function bygg() {
    const u = U();
    const omraade = document.getElementById('printArea');
    if (!omraade) return null;
    omraade.textContent = '';

    const data = GD.state.data;

    omraade.appendChild(forside(data));
    if (data.aktivitetar.length) omraade.appendChild(aktivitetsark(data));

    return omraade;
  }

  function forside(data) {
    const u = U();
    const ark = u.el('section', 'gd-ark');

    ark.appendChild(u.el('h1', null, 'Protokoll over behandlingsaktivitetar'));
    ark.appendChild(u.el('p', 'gd-ark-under',
      'etter artikkel 30 nr. 1 i personvernforordninga'));

    const f = data.forside;

    GD.felt.FORSIDEGRUPPER.forEach(function (gruppe) {
      const felt = GD.felt.FORSIDE.filter(function (x) { return x.gruppe === gruppe.id; });
      const harNoko = felt.some(function (x) { return !u.tom(f[x.id]); });

      /* Grupper som ikkje gjeld — typisk representanten — blir tekne med som
         ei linje som seier at dei ikkje er aktuelle. Eit tilsyn skal sleppe å
         lure på om vi gløymde dei eller vurderte dei. */
      ark.appendChild(u.el('h2', null, gruppe.tittel));
      if (!harNoko) {
        ark.appendChild(u.el('p', 'gd-ark-tom', 'Ikkje utfylt.'));
        return;
      }

      const tabell = u.el('table');
      const tbody = u.el('tbody');
      felt.forEach(function (x) {
        if (u.tom(f[x.id])) return;
        const tr = u.el('tr');
        tr.appendChild(u.el('th', null, x.etikett));
        tr.appendChild(u.el('td', null, f[x.id]));
        tbody.appendChild(tr);
      });
      tabell.appendChild(tbody);
      ark.appendChild(tabell);
    });

    if (data.endringar.length) {
      ark.appendChild(u.el('h2', null, 'Endringshistorikk'));
      const tabell = u.el('table');
      const thead = u.el('thead');
      const hr = u.el('tr');
      ['Namn', 'Dato', 'Kva er endra'].forEach(function (t) { hr.appendChild(u.el('th', null, t)); });
      thead.appendChild(hr);
      tabell.appendChild(thead);
      const tbody = u.el('tbody');
      data.endringar.forEach(function (e) {
        const tr = u.el('tr');
        tr.appendChild(u.el('td', null, e.namn));
        tr.appendChild(u.el('td', null, e.dato));
        tr.appendChild(u.el('td', null, e.skildring));
        tbody.appendChild(tr);
      });
      tabell.appendChild(tbody);
      ark.appendChild(tabell);
    }

    ark.appendChild(u.el('p', 'gd-ark-fot',
      data.aktivitetar.length + ' behandlingsaktivitetar. Skriven ut ' +
      new Date().toISOString().slice(0, 10) + ' frå Protokollsmia.'));

    return ark;
  }

  function aktivitetsark(data) {
    const u = U();
    const ark = u.el('section', 'gd-ark');
    ark.appendChild(u.el('h1', null, 'Behandlingsaktivitetar'));

    data.aktivitetar.forEach(function (a, i) {
      const blokk = u.el('div', 'gd-ark-aktivitet');
      blokk.appendChild(u.el('h2', null,
        (i + 1) + '. ' + (a.kvaGjeld || a.formaal || 'Utan namn')));

      const tabell = u.el('table');
      const tbody = u.el('tbody');

      GD.felt.AKTIVITET.forEach(function (felt) {
        /* Felt som ikkje er synlege i skjemaet skal heller ikkje på papir —
           eit tomt «kva rettsleg plikt» under eit avtalegrunnlag er støy. */
        if (!GD.felt.synleg(felt, a)) return;

        const verdi = a[felt.id];
        const tomt = u.tom(verdi);

        /* Berre lovpålagde felt blir tekne med når dei er tomme. Eit tomt
           tillegg er eit val; eit tomt artikkel 30-felt er ein mangel. */
        if (tomt && !felt.art30) return;

        const tr = u.el('tr');
        const th = u.el('th');
        th.appendChild(document.createTextNode(felt.etikett));
        if (felt.art30) {
          th.appendChild(u.el('span', 'gd-ark-krav', ' (art. 30 nr. 1 ' + felt.art30 + ')'));
        }
        tr.appendChild(th);
        tr.appendChild(u.el('td', tomt ? 'gd-ark-tom' : null, tomt ? '— ikkje utfylt —' : verdi));
        tbody.appendChild(tr);
      });

      tabell.appendChild(tbody);
      blokk.appendChild(tabell);
      ark.appendChild(blokk);
    });

    return ark;
  }

  function skrivUt() {
    const u = U();
    if (!GD.state.aktivitetar().length) {
      u.toast('Legg til minst éin behandlingsaktivitet før du skriv ut.', { kind: 'warn' });
      return;
    }
    bygg();
    window.print();
  }

  root.GD = root.GD || {};
  root.GD.print = { bygg: bygg, skrivUt: skrivUt };
})(window);
