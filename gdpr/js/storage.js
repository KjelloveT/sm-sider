/* ══════════════════════════════════════════════
   STORAGE.JS — Biblioteket og filene

   All lagring går gjennom `VyrdepilStorage` (AGENTS.md §2). Ingen direkte
   localStorage her inne.

   PROTOKOLLSMIA ER EIT OPPLÆRINGSVERKTØY, ikkje eit arkiv. Det er verdt å seie
   høgt fordi det avgjer kva lagringa er til for: ho skal berge arbeidet ditt
   over ei omlasting og ein kaffipause, ikkje vere staden verksemda oppbevarer
   protokollen sin. Den ferdige protokollen høyrer heime i eit dokumentarkiv,
   eksportert ut herifrå.

   Difor: eksport til fil er den viktige vegen ut, og han skal vere lett å
   finne. Sjå `gdpr/personvern.html` for kva dette tyder på ei delt maskin.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const GAME = 'gdpr';
  const LIST = 'protokollar';

  /** Alle lagra protokollar i denne nettlesaren. */
  function alle() {
    try {
      return VyrdepilStorage.getList(GAME, LIST) || [];
    } catch (e) {
      return [];
    }
  }

  /** Lagrar den aktive protokollen. Oppdaterer dersom han finst frå før. */
  function lagre(namn) {
    const post = GD.state.serialize(namn);
    const finst = alle().some(function (p) { return p.id === post.id; });
    if (finst) VyrdepilStorage.updateListItem(GAME, LIST, post.id, post);
    else VyrdepilStorage.saveListItem(GAME, LIST, post);
    return post;
  }

  function hent(id) {
    return alle().filter(function (p) { return p.id === id; })[0] || null;
  }

  function slett(id) {
    VyrdepilStorage.deleteListItem(GAME, LIST, id);
  }

  /** Tømmer alt Protokollsmia har lagra. Knytt til slett-knappen. */
  function slettAlt() {
    VyrdepilStorage.clearGame(GAME);
  }

  /* ──────────────── Fil ──────────────── */

  function eksporter() {
    const post = GD.state.serialize();
    GD.util.downloadJson(post, GD.util.slug(post.name, 'protokoll') + '.json');
  }

  /**
   * Les ei fil. Kastar med ei melding på nynorsk som seier kva som er gale —
   * ikkje «Unexpected token», som ikkje hjelper nokon.
   */
  function lesFil(tekst) {
    let parsa;
    try {
      parsa = JSON.parse(tekst);
    } catch (e) {
      throw new Error('Fila er ikkje gyldig JSON. Er ho open i eit anna program, eller halvvegs lasta ned?');
    }
    if (!parsa || typeof parsa !== 'object') {
      throw new Error('Fila inneheld ikkje ein protokoll.');
    }
    if (parsa.app !== GD.state.APP) {
      throw new Error('Denne fila kjem ikkje frå Protokollsmia.');
    }
    if (parsa.version > GD.state.VERSJON) {
      throw new Error('Fila er laga med ein nyare versjon av Protokollsmia enn denne. Oppdater sida og prøv på nytt.');
    }
    return parsa;
  }

  root.GD = root.GD || {};
  root.GD.storage = {
    alle: alle,
    lagre: lagre,
    hent: hent,
    slett: slett,
    slettAlt: slettAlt,
    eksporter: eksporter,
    lesFil: lesFil
  };
})(window);
