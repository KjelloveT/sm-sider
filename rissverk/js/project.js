/* ══════════════════════════════════════════════
   PROJECT.JS — Prosjektfil og autolagring

   Prosjektfila er heile modellen, med {app, version} øvst slik
   retningslinjene krev. Ho ber MEIR enn SVG-fila: lagnamn, låste lag,
   skjulte lag og teikneflata sin storleik. Ei SVG-fil er resultatet,
   prosjektfila er arbeidet.

   Autolagringa går til VyrdepilStorage og er meint som ei tryggleiksline,
   ikkje som arkivet. Ho har ei hard grense: localStorage tek berre nokre
   få megabyte til saman for HEILE Vyrdepil, og ei teikning som veks forbi
   grensa skal ikkje få lov til å skuve ut andre spel sine data. Går ho
   over, sluttar vi å lagre og seier tydeleg frå — det er ærlegare enn å
   feile stille og la brukaren tru arbeidet er trygt.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.project = (function () {
  'use strict';

  const APP = 'rissverk';
  const VERSION = 1;
  const EXT = '.rissverk';

  const AUTOSAVE_LIMIT = 1500000;   // teikn — om lag 1,5 MB serialisert
  const AUTOSAVE_DELAY = 1200;      // ms etter siste endring

  let autosaveBlocked = false;

  /* ──────────────── Ut og inn ──────────────── */

  function payload() {
    const d = RV.state.data;
    return {
      app: APP,
      version: VERSION,
      title: d.title,
      doc: d.doc,
      nodes: d.nodes,
      root: d.root,
      children: d.children,
      defs: d.defs
    };
  }

  function save(filename) {
    const text = JSON.stringify(payload(), null, 1);
    const blob = new Blob([text], { type: 'application/json' });
    RV.util.downloadBlob(blob, RV.util.slug(filename, 'teikning') + EXT);
  }

  /**
   * Sjekkar at fila er vår, og at ho ikkje er nyare enn programmet.
   * @returns {string|null} feilmelding på nynorsk, eller null når alt er greitt
   */
  function validate(obj) {
    if (!obj || typeof obj !== 'object') {
      return 'Fila er ikkje ei gyldig prosjektfil.';
    }
    if (obj.app !== APP) {
      return 'Denne fila høyrer til ' + (obj.app ? '«' + obj.app + '»' : 'eit anna verktøy') +
             ', ikkje til Rissverk.';
    }
    if (typeof obj.version !== 'number') {
      return 'Fila manglar versjonsnummer og kan ikkje opnast.';
    }
    if (obj.version > VERSION) {
      return 'Fila er laga med ein nyare versjon av Rissverk (versjon ' + obj.version +
             '). Oppdater sida og prøv på nytt.';
    }
    if (!obj.nodes || !obj.root) {
      return 'Fila manglar sjølve teikninga.';
    }
    return null;
  }

  /** @returns {string|null} feilmelding, eller null når fila blei opna */
  function load(obj) {
    const error = validate(obj);
    if (error) return error;

    RV.state.load(obj);
    RV.render.invalidate();
    RV.hit.invalidate();
    RV.state.emit('load');
    return null;
  }

  function openFile(file) {
    return file.text().then((text) => {
      let obj;
      try {
        obj = JSON.parse(text);
      } catch (e) {
        return 'Fila er øydelagd og kan ikkje lesast.';
      }
      return load(obj);
    });
  }

  /* ──────────────── Autolagring ──────────────── */

  const store = () => VyrdepilStorage.getGameState(RV.toolbar.STORE_KEY) || {};

  function autosaveNow() {
    if (autosaveBlocked) return;

    const text = JSON.stringify(payload());
    if (text.length > AUTOSAVE_LIMIT) {
      autosaveBlocked = true;
      clearAutosave();
      RV.util.toast('Teikninga er for stor til å lagrast i nettlesaren. Lagra ho som prosjektfil.');
      return;
    }

    const state = store();
    state.drawing = text;
    state.savedAt = Date.now();
    try {
      VyrdepilStorage.setGameState(RV.toolbar.STORE_KEY, state);
    } catch (e) {
      // Full lagringsplass er ikkje ein feil brukaren kan gjere noko med
      // der og då — men han skal vite at nettet under han er borte.
      autosaveBlocked = true;
      RV.util.toast('Nettlesaren har ikkje meir lagringsplass. Lagra teikninga som prosjektfil.');
    }
  }

  const autosave = RV.util.debounce(autosaveNow, AUTOSAVE_DELAY);

  /** Hentar att teikninga frå førre økt. @returns {boolean} */
  function restore() {
    const state = store();
    if (!state.drawing) return false;
    try {
      const obj = JSON.parse(state.drawing);
      return load(obj) === null;
    } catch (e) {
      return false;
    }
  }

  function clearAutosave() {
    const state = store();
    delete state.drawing;
    delete state.savedAt;
    VyrdepilStorage.setGameState(RV.toolbar.STORE_KEY, state);
  }

  /** Ny og tom teikning. */
  function reset() {
    RV.state.reset();
    RV.render.invalidate();
    RV.hit.invalidate();
    autosaveBlocked = false;
    clearAutosave();
    RV.state.emit('load');
  }

  return {
    APP, VERSION, EXT,
    save, load, openFile, validate, payload,
    autosave, autosaveNow, restore, clearAutosave, reset
  };
})();
