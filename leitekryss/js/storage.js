/* Leitekryss — bibliotek og JSON-filer. All lagring går gjennom VyrdepilStorage. */
window.LK = window.LK || {};

LK.storage = (function () {
  'use strict';

  const GAME = 'leitekryss';
  const LIST = 'leitekryss';

  function all() {
    return VyrdepilStorage.getList(GAME, LIST);
  }

  function get(id) {
    return all().find(item => item.id === id) || null;
  }

  /** Lagrar gjeldande leitekryss — oppdaterer om det alt ligg i biblioteket. */
  function save(name) {
    const entry = LK.state.serialize(name);
    if (LK.state.data.id && get(LK.state.data.id)) {
      VyrdepilStorage.updateListItem(GAME, LIST, entry.id, entry);
    } else {
      VyrdepilStorage.saveListItem(GAME, LIST, entry);
    }
    LK.state.data.id = entry.id;
    return entry;
  }

  function rename(id, name) {
    VyrdepilStorage.updateListItem(GAME, LIST, id, { name: name });
  }

  function remove(id) {
    VyrdepilStorage.deleteListItem(GAME, LIST, id);
    if (LK.state.data.id === id) LK.state.data.id = null;
  }

  /* ---- JSON-fil ---- */

  function exportFile() {
    const entry = LK.state.serialize();
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
    LK.util.downloadBlob(blob, LK.util.slug(entry.title || entry.name, 'leitekryss') + '.json');
  }

  /** Les ei JSON-fil. Kastar feil med melding på nynorsk om fila ikkje passar. */
  function parseFile(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Fila er ikkje gyldig JSON.');
    }
    if (!parsed || parsed.app !== 'leitekryss') {
      throw new Error('Denne fila kjem ikkje frå Leitekryss.');
    }
    if (!Array.isArray(parsed.words) || !parsed.words.length) {
      throw new Error('Fila inneheld ingen ord.');
    }
    return parsed;
  }

  return { all, get, save, rename, remove, exportFile, parseFile };
})();
