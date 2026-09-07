/* ══════════════════════════════════════════════
   STORAGE.JS — Det verktøyet hugsar

   Alt går gjennom VyrdepilStorage. Direkte localStorage er forbode
   inne i eit verktøy (AGENTS.md §2), og grunnen er at framsida skal
   kunne vise brukaren alt som ligg lagra, på ein stad.

   Tre samlingar: heile oppsett med namn, eigne malar (design utan
   innhald), og dei siste innhalda — den siste finst berre for å spare
   nokon for å skrive same lange lenkja to gonger.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.storage = (function () {
  'use strict';

  const APP = 'vitjingsruta';
  const RECENT_MAX = 10;

  function safe(fn, fallback) {
    try { return fn(); } catch (err) { return fallback; }
  }

  function list(key) {
    return safe(() => VyrdepilStorage.getList(APP, key) || [], []);
  }

  function setList(key, arr) {
    safe(() => VyrdepilStorage.setList(APP, key, arr));
  }

  function id() {
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ──────────────── Lagra oppsett ──────────────── */

  function saved() { return list('saved'); }

  function save(entry) {
    const arr = saved();
    const item = {
      id: entry.id || id(),
      name: entry.name || 'Utan namn',
      content: entry.content,
      design: entry.design,
      saved: new Date().toISOString()
    };
    const at = arr.findIndex(x => x.id === item.id);
    if (at >= 0) arr[at] = item; else arr.unshift(item);
    setList('saved', arr);
    return item;
  }

  function remove(entryId) {
    setList('saved', saved().filter(x => x.id !== entryId));
  }

  /* ──────────────── Eigne malar ──────────────── */

  function templates() { return list('templates'); }

  function saveTemplate(name, design) {
    const arr = templates();
    arr.unshift({ id: id(), name: name || 'Utan namn', design: design });
    setList('templates', arr.slice(0, 24));
  }

  function removeTemplate(tid) {
    setList('templates', templates().filter(x => x.id !== tid));
  }

  /* ──────────────── Nyleg innhald ──────────────── */

  function recent() { return list('recent'); }

  function remember(type, label, values) {
    if (!label) return;
    const arr = recent().filter(x => x.label !== label);
    arr.unshift({ type: type, label: label, values: values, at: Date.now() });
    setList('recent', arr.slice(0, RECENT_MAX));
  }

  function clearRecent() { setList('recent', []); }

  function clearAll() {
    safe(() => VyrdepilStorage.clearGame(APP));
  }

  return {
    APP,
    saved, save, remove,
    templates, saveTemplate, removeTemplate,
    recent, remember, clearRecent,
    clearAll
  };
})();
