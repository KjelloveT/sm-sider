/* ══════════════════════════════════════════════
   FELT.JS — Feltkatalogen i Protokollsmia

   Her ligg STRUKTUREN til protokollen: kva felt som finst, kva rekkjefølgje
   dei kjem i, kva slag inndata dei tek, og kva bokstav i artikkel 30 nr. 1
   kvart felt oppfyller.

   PROSAEN LIGG IKKJE HER. Forklaringar, døme og vanlege feil bur i
   `data/rettleiing.json` og blir kopla på med feltet sin `id`. Grunnen til
   skiljet: koden forgreinar på strukturen — han må vite at `slettefrist` er
   obligatorisk og at `tredjeland` er ei ja/nei-rute — og då skal ein skrivefeil
   i ein id vere noko du kan grep-e, ikkje eit mysterium som først syner seg når
   nokon opnar sida. Prosa er det motsette: ho skal kunne rettast utan å røre
   kode, og ho er for lang til å bu i ein JS-modul under 400 linjer.

   REKKJEFØLGJA ER DATATILSYNET SI. Kolonnane A til S i malen deira, i same
   orden, så `.xlsx`-eksporten kan skrivast rett ut og kjennast att av nokon
   som har sett malen før.

   OBLIGATORISK ELLER IKKJE. Datatilsynet skil dei med farge i reknearket:
   oransje kolonnar skal med etter artikkel 30, grøne er nyttige tillegg. Det
   skiljet er ikkje kosmetisk — det avgjer kva som blir flagga som ein MANGEL
   i kvalitetssjekken, og kva som berre er eit godt råd. `art30`-feltet under
   ber bokstaven når feltet er lovpålagt, og er null når det ikkje er det.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Bokstavane i artikkel 30 nr. 1, til rettleiinga og til sjekken.
     Bokstav a (namn og kontaktopplysningar) høyrer til forsida, ikkje til
     den einskilde behandlingsaktiviteten — sjå FORSIDE lenger nede. */
  const ART30 = {
    a: 'namn og kontaktopplysningar',
    b: 'formålet med behandlinga',
    c: 'kategoriar av registrerte og av personopplysningar',
    d: 'kategoriar av mottakarar',
    e: 'overføringar til tredjestat eller internasjonal organisasjon',
    f: 'planlagde tidsfristar for sletting',
    g: 'generell skildring av tekniske og organisatoriske sikringstiltak'
  };

  /* ──────────────── Behandlingsaktiviteten ────────────────

     `type` styrer kva inndatafelt som blir teikna:
       tekst    — éi linje
       lang     — textarea
       val      — nedtrekksliste, `val`-lista under
       fleirval — fleire avkryssingar, `val`-lista under
       jaNei    — ja / nei / veit ikkje

     `breidd` er kolonnebreidda i .xlsx. Eininga er talet på teikn i breidda
     til det breiaste sifferet i standardfonten — ikkje pikslar, ikkje punkt.
     Formatet har ingen auto-fit, så breiddene må forfattast. Lange fritekst-
     felt får 45–55, korte 22–28. */
  const AKTIVITET = [
    { id: 'internansvar', kol: 'A', art30: null, type: 'tekst', breidd: 24,
      etikett: 'Internt ansvarleg' },

    { id: 'funksjonsomraade', kol: 'B', art30: null, type: 'tekst', breidd: 26,
      etikett: 'Funksjonsområde' },

    { id: 'kvaGjeld', kol: 'C', art30: null, type: 'tekst', breidd: 28,
      etikett: 'Kva gjeld behandlinga' },

    { id: 'formaal', kol: 'D', art30: 'b', type: 'lang', breidd: 46,
      etikett: 'Formålet med behandlinga' },

    { id: 'registrerte', kol: 'E', art30: 'c', type: 'lang', breidd: 34,
      etikett: 'Kategoriar av registrerte' },

    { id: 'opplysningar', kol: 'F', art30: 'c', type: 'lang', breidd: 40,
      etikett: 'Kategoriar av personopplysningar' },

    { id: 'kjelde', kol: 'G', art30: null, type: 'lang', breidd: 28,
      etikett: 'Kvar kjem opplysningane frå?' },

    { id: 'mottakarar', kol: 'H', art30: 'd', type: 'lang', breidd: 34,
      etikett: 'Kategoriar av mottakarar' },

    { id: 'grunnlag6', kol: 'I', art30: null, type: 'val', breidd: 30,
      etikett: 'Behandlingsgrunnlag etter artikkel 6',
      val: [
        'Artikkel 6 nr. 1 bokstav a — samtykke',
        'Artikkel 6 nr. 1 bokstav b — avtale',
        'Artikkel 6 nr. 1 bokstav c — rettsleg plikt',
        'Artikkel 6 nr. 1 bokstav d — vitale interesser',
        'Artikkel 6 nr. 1 bokstav e — allmenn interesse eller offentleg mynde',
        'Artikkel 6 nr. 1 bokstav f — rettkomen interesse'
      ] },

    { id: 'grunnlagVising', kol: 'J', art30: null, type: 'lang', breidd: 34,
      etikett: 'Kva rettsleg plikt, allmenn interesse eller rettkomen interesse?',
      /* Berre relevant for bokstav c, e og f. Dei tre krev at du kan peike på
         noko konkret utanfor forordninga — ei lov, ei oppgåve, ei interesse. */
      visNaar: { felt: 'grunnlag6', inneheld: ['bokstav c', 'bokstav e', 'bokstav f'] } },

    { id: 'grunnlag910', kol: 'K', art30: null, type: 'val', breidd: 32,
      etikett: 'Behandlingsgrunnlag etter artikkel 9 eller 10',
      val: [
        'Ikkje aktuelt — ingen særlege kategoriar',
        'Artikkel 9 nr. 2 bokstav a — uttrykkeleg samtykke',
        'Artikkel 9 nr. 2 bokstav b — arbeidsrett og trygderett',
        'Artikkel 9 nr. 2 bokstav c — vitale interesser',
        'Artikkel 9 nr. 2 bokstav d — stiftingar og foreiningar',
        'Artikkel 9 nr. 2 bokstav e — openbert offentleggjorde av den registrerte',
        'Artikkel 9 nr. 2 bokstav f — rettskrav',
        'Artikkel 9 nr. 2 bokstav g — vesentleg allmenn interesse',
        'Artikkel 9 nr. 2 bokstav h — helse- og omsorgsformål',
        'Artikkel 9 nr. 2 bokstav i — folkehelse',
        'Artikkel 9 nr. 2 bokstav j — arkiv, forsking og statistikk',
        'Artikkel 10 — straffedomar og lovbrot'
      ] },

    { id: 'system', kol: 'L', art30: null, type: 'lang', breidd: 30,
      etikett: 'I kva system blir opplysningane behandla?' },

    { id: 'slettefrist', kol: 'M', art30: 'f', type: 'lang', breidd: 34,
      etikett: 'Planlagde tidsfristar for sletting' },

    { id: 'sikringstiltak', kol: 'N', art30: 'g', type: 'lang', breidd: 52,
      etikett: 'Tekniske og organisatoriske sikringstiltak' },

    { id: 'hoegRisiko', kol: 'O', art30: null, type: 'jaNei', breidd: 22,
      etikett: 'Kan behandlinga innebere høg personvernrisiko?' },

    { id: 'databehandlarar', kol: 'P', art30: null, type: 'lang', breidd: 30,
      etikett: 'Namn på databehandlarar' },

    { id: 'fellesansvar', kol: 'Q', art30: 'a', type: 'lang', breidd: 32,
      etikett: 'Felles behandlingsansvarleg — namn og kontaktopplysningar' },

    { id: 'tredjeland', kol: 'R', art30: 'e', type: 'lang', breidd: 30,
      etikett: 'Tredjeland eller internasjonale organisasjonar opplysningane blir overførte til' },

    { id: 'garantiar', kol: 'S', art30: 'e', type: 'lang', breidd: 40,
      etikett: 'Nødvendige garantiar ved overføring til tredjeland' }
  ];

  /* ──────────────── Forsida ────────────────

     Artikkel 30 nr. 1 bokstav a gjeld heile protokollen, ikkje kvar aktivitet.
     Difor bur desse felta på forsida, akkurat som i Datatilsynet sin mal.

     `omgrep` er ikkje med i malen deira. Vi har lagt det til fordi det irske
     datatilsynet fann udefinerte forkortingar som ein gjennomgåande svakheit i
     tilsynet sitt i 2022: ein protokoll skal kunne lesast av ein utanforståande
     utan å gjette. Feltet er òg det som gjer at kvalitetssjekken kan skilje ei
     forkorting som ER forklart frå ei som ikkje er det, i staden for å flagge
     alle og bli ignorert. */
  const FORSIDE = [
    { id: 'verksemd',        gruppe: 'ansvarleg',  type: 'tekst', etikett: 'Namn på verksemda', art30: 'a' },
    { id: 'orgnr',           gruppe: 'ansvarleg',  type: 'tekst', etikett: 'Organisasjonsnummer' },
    { id: 'adresse',         gruppe: 'ansvarleg',  type: 'lang',  etikett: 'Postadresse', art30: 'a' },
    { id: 'telefon',         gruppe: 'ansvarleg',  type: 'tekst', etikett: 'Telefon', art30: 'a' },
    { id: 'epost',           gruppe: 'ansvarleg',  type: 'tekst', etikett: 'E-post', art30: 'a' },

    { id: 'ombodNamn',       gruppe: 'ombod',      type: 'tekst', etikett: 'Namn', art30: 'a' },
    { id: 'ombodTelefon',    gruppe: 'ombod',      type: 'tekst', etikett: 'Telefon' },
    { id: 'ombodEpost',      gruppe: 'ombod',      type: 'tekst', etikett: 'E-post' },

    { id: 'repNamn',         gruppe: 'representant', type: 'tekst', etikett: 'Namn', art30: 'a' },
    { id: 'repAdresse',      gruppe: 'representant', type: 'lang',  etikett: 'Postadresse' },
    { id: 'repEpost',        gruppe: 'representant', type: 'tekst', etikett: 'E-post' },

    { id: 'godkjentNamn',    gruppe: 'godkjenning', type: 'tekst', etikett: 'Godkjend av' },
    { id: 'godkjentRolle',   gruppe: 'godkjenning', type: 'tekst', etikett: 'Rolle' },
    { id: 'godkjentDato',    gruppe: 'godkjenning', type: 'tekst', etikett: 'Dato' },
    { id: 'versjon',         gruppe: 'godkjenning', type: 'tekst', etikett: 'Versjon' },

    { id: 'omgrep',          gruppe: 'omgrep',     type: 'lang',  etikett: 'Forkortingar og omgrep' }
  ];

  /* Gruppene på forsida, i den rekkjefølgja dei blir teikna. `naarTrengst`
     forklarer kvifor ei gruppe kan stå tom — representanten gjeld berre
     verksemder utanfor EØS, og ombodet berre dei som er pålagde å ha eitt. */
  const FORSIDEGRUPPER = [
    { id: 'ansvarleg',    tittel: 'Behandlingsansvarleg',
      naarTrengst: null },
    { id: 'ombod',        tittel: 'Personvernombod',
      naarTrengst: 'Fyll ut dersom verksemda har eller er pålagd å ha personvernombod.' },
    { id: 'representant', tittel: 'Representanten til den behandlingsansvarlege',
      naarTrengst: 'Fyll ut dersom den behandlingsansvarlege er etablert utanfor EØS.' },
    { id: 'godkjenning',  tittel: 'Godkjenning',
      naarTrengst: 'Kven har godkjent protokollen, og kva utgåve er dette?' },
    { id: 'omgrep',       tittel: 'Forkortingar og omgrep',
      naarTrengst: 'Skriv opp forkortingar og interne namn du brukar i protokollen, med forklaring. Ein protokoll skal kunne lesast av nokon utanfrå.' }
  ];

  /* ──────────────── Oppslag ──────────────── */

  const kart = {};
  AKTIVITET.forEach(function (f) { kart[f.id] = f; });
  FORSIDE.forEach(function (f) { kart[f.id] = f; });

  function get(id) {
    return kart[id] || null;
  }

  /** Alle felt som er lovpålagde etter artikkel 30 nr. 1. */
  function obligatoriske() {
    return AKTIVITET.filter(function (f) { return !!f.art30; });
  }

  /**
   * Skal feltet visast, gjeve det aktiviteten er fylt ut med no?
   * Felt utan `visNaar` er alltid synlege.
   */
  function synleg(felt, aktivitet) {
    if (!felt.visNaar) return true;
    const verdi = String((aktivitet && aktivitet[felt.visNaar.felt]) || '').toLowerCase();
    return felt.visNaar.inneheld.some(function (n) { return verdi.indexOf(n) !== -1; });
  }

  /** Tom aktivitet med alle felt til stades, så resten av koden slepp å sjekke. */
  function tomAktivitet(uuid) {
    const a = { id: uuid };
    AKTIVITET.forEach(function (f) { a[f.id] = ''; });
    return a;
  }

  root.GD = root.GD || {};
  root.GD.felt = {
    ART30: ART30,
    AKTIVITET: AKTIVITET,
    FORSIDE: FORSIDE,
    FORSIDEGRUPPER: FORSIDEGRUPPER,
    get: get,
    obligatoriske: obligatoriske,
    synleg: synleg,
    tomAktivitet: tomAktivitet
  };
})(window);
