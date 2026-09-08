/* ══════════════════════════════════════════════
   EXPORT-XLSX.JS — Protokollen som rekneark

   To ark, som i Datatilsynet sin mal: ei forside med kontaktopplysningar,
   godkjenning og endringshistorikk, og sjølve protokollen med ei rad per
   behandlingsaktivitet.

   KOLONNEREKKJEFØLGJA ER DATATILSYNET SI, ikkje skjermen si. På skjermen er
   felta grupperte etter kva spørsmål ein stiller seg når ein kartlegg — det
   er rett for eit skjema. I reknearket står dei i mal-rekkjefølgja A til S, så
   den som har sett malen før kjenner seg att, og så fila kan limast rett inn i
   eit arbeid som alt er byrja der.

   `felt.js` ber både `kol` og `breidd`, så denne fila treng ikkje vite noko om
   rekkjefølgje utover å sortere på `kol`.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Kolonnane i mal-rekkjefølgje. Sortert her og ikkje i felt.js, sidan
     skjermen har si eiga rekkjefølgje og ingen av dei to er «den rette». */
  function kolonnar() {
    return GD.felt.AKTIVITET.slice().sort(function (a, b) {
      return a.kol < b.kol ? -1 : (a.kol > b.kol ? 1 : 0);
    });
  }

  /**
   * Overskrifta i kvar kolonne. Vi tek med kva bokstav i artikkel 30 nr. 1
   * kolonnen oppfyller, på ei eiga linje — Datatilsynet skil obligatoriske og
   * valfrie kolonnar med farge, og farge overlever verken svart-kvitt utskrift
   * eller ein skjermlesar. Teksten gjer det.
   */
  function overskrift(f) {
    if (f.art30) return f.etikett + '\n(artikkel 30 nr. 1 bokstav ' + f.art30 + ')';
    return f.etikett + '\n(tillegg, ikkje kravd av artikkel 30)';
  }

  function protokollark(data) {
    const kol = kolonnar();
    const rader = [kol.map(overskrift)];

    data.aktivitetar.forEach(function (a) {
      rader.push(kol.map(function (f) { return a[f.id] || ''; }));
    });

    return {
      namn: 'Artikkel 30 protokoll',
      rader: rader,
      breidder: kol.map(function (f) { return f.breidd; }),
      harOverskrift: true,
      frys: true
    };
  }

  /* Forsida er ikkje ein tabell, men eit sett merkelapp/verdi-par. To kolonnar
     er nok, og det gjer fila lett å lese òg utan formatering. */
  function forsideark(data) {
    const rader = [];
    const f = data.forside;

    rader.push(['Protokoll over behandlingsaktivitetar', '']);
    rader.push(['etter artikkel 30 nr. 1 i personvernforordninga', '']);
    rader.push(['', '']);

    GD.felt.FORSIDEGRUPPER.forEach(function (gruppe) {
      rader.push([gruppe.tittel.toUpperCase(), '']);
      GD.felt.FORSIDE
        .filter(function (x) { return x.gruppe === gruppe.id; })
        .forEach(function (x) {
          rader.push([x.etikett, f[x.id] || '']);
        });
      rader.push(['', '']);
    });

    if (data.endringar.length) {
      rader.push(['ENDRINGSHISTORIKK', '']);
      rader.push(['Namn', 'Dato']);
      data.endringar.forEach(function (e) {
        rader.push([e.namn + '  ' + e.dato, e.skildring]);
      });
      rader.push(['', '']);
    }

    rader.push(['Skriven ut frå Protokollsmia', new Date().toISOString().slice(0, 10)]);

    return {
      namn: 'Protokollforside',
      rader: rader,
      breidder: [46, 60],
      harOverskrift: false,
      frys: false
    };
  }

  /**
   * Byggjer og lastar ned .xlsx-fila.
   * @returns {Promise}
   */
  function lastNed() {
    const data = GD.state.data;
    return GD.xlsx.bygg([forsideark(data), protokollark(data)])
      .then(function (blob) {
        const namn = GD.util.slug(data.forside.verksemd || 'protokoll', 'protokoll');
        GD.util.downloadBlob(blob, namn + '-artikkel30.xlsx');
      });
  }

  root.GD = root.GD || {};
  root.GD.exportXlsx = {
    lastNed: lastNed,
    protokollark: protokollark,
    forsideark: forsideark,
    kolonnar: kolonnar
  };
})(window);
