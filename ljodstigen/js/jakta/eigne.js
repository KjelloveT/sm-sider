/* ══════════════════════════════════════════════
   EIGNE.JS — Baner læraren har laga

   Delt av spelet og Banelagar, så begge les og skriv same format.

   Ligg på eininga gjennom VyrdepilStorage — same API som Klassekart
   brukar til oppsetta sine. Ingen server, ingen konto, ingenting som
   forlèt maskina.

   INNHALDET ER ADAPTIVT SOM STANDARD. Læraren teiknar geometrien, og
   LjodAdaptive vel bokstavane, akkurat som i dei innebygde banene. Men
   `bokstavar` lar han låse utvalet — «vi jobbar med s, o og l denne
   veka». Svara går inn i motoren uansett; det er berre kva bokstavar som
   dukkar opp som er fast.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const APP = 'ljodstigen';
  const LISTE = 'eigneBaner';
  const VERSJON = 1;

  function nyId() {
    return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function tom(breiddSkjermar) {
    const breidd = (breiddSkjermar || 1) * 16;
    const rader = [];
    for (let y = 0; y < 7; y++) {
      let r = '';
      for (let x = 0; x < breidd; x++) {
        r += (y === 6 && x === 1) ? '@' : (y === 6 && x === breidd - 1) ? 'D' : '.';
      }
      rader.push(r);
    }
    return rader.join('\n');
  }

  function normaliser(b) {
    b = b || {};
    return {
      id: b.id || nyId(),
      namn: String(b.namn || 'Ny bane').slice(0, 40),
      type: ['lyd', 'rekkje', 'ord'].indexOf(b.type) !== -1 ? b.type : 'lyd',
      /* Låste bokstavar. Tom liste = adaptivt, som er standarden. */
      bokstavar: Array.isArray(b.bokstavar)
        ? b.bokstavar.filter(function (c) { return LjodLetters.get(c); }) : [],
      rutenett: String(b.rutenett || tom(1)),
      laga: b.laga || new Date().toISOString().slice(0, 10)
    };
  }

  function alle() {
    let liste = [];
    try { liste = VyrdepilStorage.getList(APP, LISTE) || []; } catch (e) { liste = []; }
    return liste.map(normaliser);
  }

  function hent(id) {
    return alle().filter(function (b) { return b.id === id; })[0] || null;
  }

  function lagre(bane) {
    const b = normaliser(bane);
    const liste = alle();
    const i = liste.findIndex(function (x) { return x.id === b.id; });
    if (i === -1) liste.push(b); else liste[i] = b;
    VyrdepilStorage.setList(APP, LISTE, liste);
    return b;
  }

  function slett(id) {
    VyrdepilStorage.setList(APP, LISTE, alle().filter(function (b) { return b.id !== id; }));
  }

  /* ──────────────── Deling ──────────────── */

  /* Eksportformatet har app og version på toppnivå, jf. AGENTS.md §5.2:
     det gjev ein migreringsveg og lèt oss skilje filer frå ulike spel
     når nokon importerer noko heilt anna. */
  function tilJson(bane) {
    const b = normaliser(bane);
    return JSON.stringify({
      app: APP, version: VERSJON, type: 'bane',
      bane: { namn: b.namn, type: b.type, bokstavar: b.bokstavar, rutenett: b.rutenett, laga: b.laga }
    }, null, 1) + '\n';
  }

  /**
   * @returns { ok, bane } eller { ok:false, grunn }
   */
  function fraaJson(tekst) {
    let d;
    try { d = JSON.parse(tekst); } catch (e) {
      return { ok: false, grunn: 'Fila er ikkje gyldig JSON.' };
    }
    if (!d || d.app !== APP || !d.bane) {
      return { ok: false, grunn: 'Dette ser ikkje ut som ei Ljodstigen-bane.' };
    }
    const b = normaliser(Object.assign({}, d.bane, { id: nyId() }));
    const sjekk = JaktaValidator.sjekk(b.rutenett);
    if (!sjekk.ok) {
      return { ok: false, grunn: 'Banen i fila er ikkje spelbar: ' + sjekk.feil[0] };
    }
    return { ok: true, bane: b };
  }

  root.JaktaEigne = {
    APP: APP, LISTE: LISTE,
    nyId: nyId, tom: tom, normaliser: normaliser,
    alle: alle, hent: hent, lagre: lagre, slett: slett,
    tilJson: tilJson, fraaJson: fraaJson
  };
})(window);
