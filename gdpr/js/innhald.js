/* ══════════════════════════════════════════════
   INNHALD.JS — Hentar rettleiinga og reglane

   Teksten ligg i data/*.json og ikkje i koden. Det tyder ei henting, og ei
   henting kan gå gale — på ein måte som er verdt eit eige avsnitt:

   EIN FEILSKRIVEN STI GJEV HTML MED STATUS 200, IKKJE 404.
   `staticwebapp.config.json` skriv om alt som ikkje treffer ei fil til
   index.html med status 200 (`navigationFallback`). Skriv nokon feil i stien
   under, får vi altså ei HTML-side servert som om alt var i orden. `res.ok` er
   sann, og det som faktisk feilar er `res.json()`, med «Unexpected token <».

   Vi sjekkar difor content-type i tillegg, så meldinga seier kva som er gale.
   `/gdpr/data/*` er òg lagt i `navigationFallback.exclude`, som er den ekte
   fiksen — men vakta står her uansett, sidan ho kostar fire linjer.

   OG: serve.ps1 gjev ekte 404 lokalt. Ein feil sti verkar difor perfekt på
   localhost og sviktar berre i produksjon. Det er §6.3 sitt «køyr sjekklista på
   preview-URL-en» i konkret form.

   VERKTØYET SKAL STARTE SJØLV OM HENTINGA FEILAR. Skjemaet er produktet;
   rettleiinga er laget oppå. Feilar ho, seier vi frå éin gong og lèt folk
   arbeide vidare.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const lager = { rettleiing: null, reglar: null };
  const feil = [];

  /**
   * Hentar ei JSON-fil frå data/, med dei fire vaktene over.
   * @returns {Promise<object|null>} null når noko gjekk gale
   */
  function hent(namn, ventaApp) {
    return fetch('data/' + namn + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Fann ikkje data/' + namn + '.json (' + res.status + ').');

        const type = res.headers.get('content-type') || '';
        if (type.indexOf('json') === -1) {
          /* Dette er fallback-fella. Meldinga seier kva som er gale i staden
             for å la JSON.parse kaste noko uforståeleg. */
          throw new Error('data/' + namn + '.json svarte med ' + (type || 'ukjend type') +
            ' i staden for JSON. Sjekk at fila finst og at stien er rett.');
        }
        return res.json();
      })
      .then(function (data) {
        if (!data || typeof data !== 'object') {
          throw new Error('data/' + namn + '.json inneheld ikkje eit objekt.');
        }
        if (ventaApp && data.app !== ventaApp) {
          throw new Error('data/' + namn + '.json er ikkje den fila vi venta (' +
            data.app + ' i staden for ' + ventaApp + ').');
        }
        return data;
      })
      .catch(function (e) {
        feil.push(e.message);
        console.warn('[Protokollsmia] ' + e.message);
        return null;
      });
  }

  /* Kvalitetssjekken (data/reglar.json) er ikkje bygd enno. Fila blir henta
     her når han kjem — å hente henne no ville berre gjeve ein 404 i konsollen
     og ei åtvaring til brukaren om noko han ikkje saknar. */
  function last() {
    return hent('rettleiing', 'gdpr-rettleiing').then(function (data) {
      lager.rettleiing = data;
      return { feil: feil.slice() };
    });
  }

  /** Rettleiinga for eit felt, eller null. Kallaren skal tole null. */
  function forFelt(id) {
    if (!lager.rettleiing) return null;
    return (lager.rettleiing.felt && lager.rettleiing.felt[id]) ||
           (lager.rettleiing.forside && lager.rettleiing.forside[id]) ||
           null;
  }

  function reglar() {
    return (lager.reglar && Array.isArray(lager.reglar.reglar)) ? lager.reglar.reglar : [];
  }

  function harRettleiing() {
    return !!lager.rettleiing;
  }

  root.GD = root.GD || {};
  root.GD.innhald = {
    last: last,
    forFelt: forFelt,
    reglar: reglar,
    harRettleiing: harRettleiing
  };
})(window);
