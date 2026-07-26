/* Ordkryss — bibliotek og JSON-filer. All lagring går gjennom VyrdepilStorage. */
window.OK = window.OK || {};

OK.storage = (function () {
  'use strict';

  const GAME = 'ordkryss';
  const LIST = 'kryssord';

  function all() {
    return VyrdepilStorage.getList(GAME, LIST);
  }

  function get(id) {
    return all().find(item => item.id === id) || null;
  }

  /** Lagrar gjeldande kryssord — oppdaterer om det alt ligg i biblioteket. */
  function save(name) {
    const entry = OK.state.serialize(name);
    if (OK.state.data.id && get(OK.state.data.id)) {
      VyrdepilStorage.updateListItem(GAME, LIST, entry.id, entry);
    } else {
      VyrdepilStorage.saveListItem(GAME, LIST, entry);
    }
    OK.state.data.id = entry.id;
    return entry;
  }

  function rename(id, name) {
    VyrdepilStorage.updateListItem(GAME, LIST, id, { name: name });
  }

  function remove(id) {
    VyrdepilStorage.deleteListItem(GAME, LIST, id);
    if (OK.state.data.id === id) OK.state.data.id = null;
  }

  /* ---- JSON-fil ---- */

  function exportFile() {
    const entry = OK.state.serialize();
    const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
    OK.util.downloadBlob(blob, OK.util.slug(entry.title || entry.name, 'ordkryss') + '.json');
  }

  /** Les ei JSON-fil. Kastar feil med melding på nynorsk om fila ikkje passar. */
  function parseFile(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error('Fila er ikkje gyldig JSON.');
    }
    if (!parsed || parsed.app !== 'ordkryss') {
      throw new Error('Denne fila kjem ikkje frå Ordkryss.');
    }
    if (!Array.isArray(parsed.words) || !parsed.words.length) {
      throw new Error('Fila inneheld ingen ord.');
    }
    return parsed;
  }

  return { all, get, save, rename, remove, exportFile, parseFile };
})();
