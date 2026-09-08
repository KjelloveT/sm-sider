/* ══════════════════════════════════════════════
   SJEKK.JS — Kvalitetskontroll av protokollen

   REGLAR ER DATA, PREDIKAT ER KODE. Registeret under er åtte funksjonar; alt
   anna — kva felt ein regel gjeld, kva frasar han ser etter, kva han heiter og
   kva han rår til — ligg i `data/reglar.json`. Eit nytt funn frå ein tilsyns-
   rapport skal vere eitt JSON-objekt og null kodeendring.

   Rein regex i JSON hadde ikkje halde: nokre sjekkar er ikkje strengmatching
   (tomt felt, kryssfelt-sjekkar). Rein kode hadde heller ikkje halde: lista
   over vage frasar veks kvar gong nokon les noko nytt.

   SJEKKEN KONTROLLERER FORMA, IKKJE INNHALDET. Han samanliknar svara med feil
   tilsynsstyresmakter faktisk har hatt innvendingar mot. Han kan ikkje sjå om
   eit svar er sant. Det står i grensesnittet òg — ein sjekk som gjev falsk
   tryggleik er verre enn ingen sjekk.

   HAN BLOKKERER ALDRI. Artikkel 30 har ikkje noko skjema, og eit verktøy som
   nektar å eksportere eit uvanleg men holdbart svar blir forlate i staden for
   retta.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const U = function () { return GD.util; };

  /* ──────────────── Predikatregisteret ────────────────

     Kvart predikat får (verdi, param, kontekst) og returnerer true når regelen
     SLÅR TIL — altså når det er noko å seie frå om. */

  const PREDIKAT = {

    /** Feltet er tomt eller berre kvitrom. */
    tom: function (verdi) {
      return U().tom(verdi);
    },

    /** Under `minOrd` ord. Tomme felt blir ikkje flagga her — det er `tom` sin jobb. */
    'for-kort': function (verdi, param) {
      if (U().tom(verdi)) return false;
      return U().ordtal(verdi) <= (param.minOrd || 3);
    },

    /**
     * Verdien matchar ein av `frasar`, normalisert.
     *
     * `heile: true` krev at frasen ER heile svaret. Det er skiljet som gjer
     * regelen brukbar: «Privacy Shield» er eit problem uansett kvar han står,
     * medan «personopplysningar» berre er eit problem når det er alt som står
     * — «personopplysningar om tilsette: namn, fødselsnummer» er eit godt svar
     * som tilfeldigvis inneheld ordet.
     */
    frase: function (verdi, param) {
      if (U().tom(verdi)) return false;
      const n = U().norm(verdi);
      return (param.frasar || []).some(function (f) {
        const nf = U().norm(f);
        return param.heile ? n === nf : n.indexOf(nf) !== -1;
      });
    },

    /** Utfylt, men utan noko som liknar eit tidsuttrykk. */
    'utan-tid': function (verdi) {
      if (U().tom(verdi)) return false;
      const n = U().norm(verdi);
      const tid = /\d+\s*(år|ar|månad|maned|månader|veke|veker|dag|dagar|time|timar)/;
      const hending = /(etter avslutta|etter avslutning|ved opphøyr|ved opphoyr|ved avslutning|etter at|frå|fra)\s/;
      const iso = /\d{4}-\d{2}-\d{2}/;
      const straks = /(straks|umiddelbart|med ein gong|ved registrering)/;
      return !(tid.test(n) || iso.test(n) || straks.test(n) || (hending.test(n) && /\d/.test(n)));
    },

    /**
     * Tilvising til eit dokument som ikkje ligg ved.
     *
     * Berre når tilvisinga står ÅLEINE — «Fem år, jf. lagringsrutinen» er eit
     * fullgodt svar med ei nyttig tilvising, medan «I tråd med lagringsrutinen»
     * er ei tilvising i staden for eit svar. Vi ser difor etter tilvisinga OG
     * at svaret er kort.
     */
    'vis-til-dokument': function (verdi) {
      if (U().tom(verdi)) return false;
      const n = U().norm(verdi);
      const vising = /(i tråd med|i trad med|iht|i henhold til|jf\.?\s|sjå\s|sja\s|som skildra i|som beskrevet i|etter gjeldande|følgjer|folgjer)/;
      if (!vising.test(n)) return false;
      const dok = /(rutine|instruks|policy|prosedyre|plan|reglement|retningslin|avtale|dokument|handbok|håndbok)/;
      if (!dok.test(n)) return false;
      /* Er svaret langt, står tilvisinga truleg ved sida av eit reelt svar. */
      return U().ordtal(verdi) <= 12;
    },

    /**
     * Kryssfelt: feltet må vere utfylt når eit anna felt seier at det er
     * relevant. Brukt til tredjeland → garantiar.
     */
    'krev-anna-felt': function (verdi, param, ktx) {
      if (!U().tom(verdi)) return false;
      const annan = (ktx.aktivitet && ktx.aktivitet[param.naar]) || '';
      if (U().tom(annan)) return false;
      const n = U().norm(annan);
      /* Verdiar som tyder «ikkje aktuelt» skal ikkje utløyse kravet. */
      const avkreftar = (param.naarIkkje || []).some(function (x) {
        return n === U().norm(x);
      });
      return !avkreftar;
    },

    /**
     * Forkortingar som ikkje er forklarte.
     *
     * Tre datasett, ikkje to: den faste kvitlista i regelen, forkortingar
     * protokollen sjølv definerer på forsida, og dei som blir forklarte i same
     * cella — «P360 (Public 360)» tel som definert. Utan alle tre gjev regelen
     * falske treff for alltid, og ein sjekk som ropar ulv sluttar folk å lese.
     */
    'udefinert-forkorting': function (verdi, param, ktx) {
      if (U().tom(verdi)) return false;
      const funne = String(verdi).match(/\b[A-ZÆØÅ]{2,6}\b/g);
      if (!funne) return false;

      const kvit = (param.kvitliste || []).map(function (x) { return x.toUpperCase(); });
      const definerte = ktx.definerteOmgrep || [];

      const ukjende = funne.filter(function (f) {
        if (kvit.indexOf(f) !== -1) return false;
        if (definerte.indexOf(f) !== -1) return false;
        /* Forklart i same cella: «P360 (Public 360)» */
        const forklart = new RegExp(f + '\\s*\\([^)]{3,}\\)');
        if (forklart.test(verdi)) return false;
        return true;
      });

      return ukjende.length > 0 ? ukjende : false;
    },

    /** Same verdi ordrett i minst `minTal` aktivitetar. */
    duplikat: function (verdi, param, ktx) {
      if (U().tom(verdi)) return false;
      const n = U().norm(verdi);
      const like = ktx.alle.filter(function (a) {
        return U().norm(a[ktx.feltId]) === n;
      }).length;
      return like >= (param.minTal || 4);
    }
  };

  /* ──────────────── Køyring ──────────────── */

  /** Kva felt ein regel gjeld. `*art30*` tyder alle lovpålagde felt. */
  function feltaFor(regel) {
    if (regel.felt === '*art30*') {
      return GD.felt.obligatoriske().map(function (f) { return f.id; });
    }
    return Array.isArray(regel.felt) ? regel.felt : [regel.felt];
  }

  /* Forkortingar protokollen sjølv definerer, henta ut av omgrepsfeltet på
     forsida. «P360 = Public 360» og «GSI (Grunnskolens …)» tel begge. */
  function definerteOmgrep() {
    const tekst = GD.state.data.forside.omgrep || '';
    const funne = tekst.match(/\b[A-ZÆØÅ]{2,6}\b/g) || [];
    return funne.filter(function (f, i) { return funne.indexOf(f) === i; });
  }

  /**
   * Køyrer alle reglane mot heile protokollen.
   * @returns {Array} funn: { regel, feltId, aktivitetId, treff, avvist }
   */
  function koeyr() {
    const reglar = GD.innhald.reglar();
    const alle = GD.state.aktivitetar();
    const omgrep = definerteOmgrep();
    const funn = [];

    reglar.forEach(function (regel) {
      const pred = PREDIKAT[regel.predikat];
      if (!pred) {
        console.warn('[Protokollsmia] Ukjend predikat: ' + regel.predikat);
        return;
      }
      const felt = feltaFor(regel);

      alle.forEach(function (a) {
        felt.forEach(function (feltId) {
          const feltDef = GD.felt.get(feltId);
          /* Eit felt som ikkje er synleg for denne aktiviteten skal ikkje
             sjekkast — eit tomt «kva rettsleg plikt» under eit avtalegrunnlag
             er ikkje ein mangel. */
          if (feltDef && !GD.felt.synleg(feltDef, a)) return;

          const treff = pred(a[feltId], regel.param || {}, {
            aktivitet: a,
            alle: alle,
            feltId: feltId,
            definerteOmgrep: omgrep
          });
          if (!treff) return;

          funn.push({
            regel: regel,
            feltId: feltId,
            aktivitetId: a.id,
            aktivitet: a,
            treff: treff === true ? null : treff,
            avvist: GD.state.erAvvist(regel.id, a.id)
          });
        });
      });
    });

    return funn;
  }

  /** Funna gruppert etter regel, sidan same funn i sju rader er éi lærdom. */
  function grupper(funn) {
    const kart = {};
    funn.forEach(function (f) {
      if (!kart[f.regel.id]) kart[f.regel.id] = { regel: f.regel, treff: [] };
      kart[f.regel.id].treff.push(f);
    });
    const RANG = { mangel: 0, aatvaring: 1, merknad: 2 };
    return Object.keys(kart).map(function (k) { return kart[k]; })
      .sort(function (a, b) {
        const ra = RANG[a.regel.nivaa] != null ? RANG[a.regel.nivaa] : 3;
        const rb = RANG[b.regel.nivaa] != null ? RANG[b.regel.nivaa] : 3;
        if (ra !== rb) return ra - rb;
        return b.treff.length - a.treff.length;
      });
  }

  function samandrag(funn) {
    const opne = funn.filter(function (f) { return !f.avvist; });
    return {
      aktivitetar: GD.state.aktivitetar().length,
      manglar: opne.filter(function (f) { return f.regel.nivaa === 'mangel'; }).length,
      aatvaringar: opne.filter(function (f) { return f.regel.nivaa === 'aatvaring'; }).length,
      merknader: opne.filter(function (f) { return f.regel.nivaa === 'merknad'; }).length,
      avviste: funn.filter(function (f) { return f.avvist; }).length
    };
  }

  root.GD = root.GD || {};
  root.GD.sjekk = {
    PREDIKAT: PREDIKAT,
    koeyr: koeyr,
    grupper: grupper,
    samandrag: samandrag,
    definerteOmgrep: definerteOmgrep
  };
})(window);
