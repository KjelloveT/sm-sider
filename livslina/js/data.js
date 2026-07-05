/* Livslina — data.js
 * Hentar og validerer grunndata.json, linjer.json og hendingar.json.
 * Eksponerer oppslag av kronebeløp via punktnøklar (t.d. "events.phoneScreenRepair").
 */
window.LL = window.LL || {};

LL.data = (function () {
  'use strict';

  let base = null;         // grunndata.json
  let programs = null;     // linjer.json .programs
  let events = null;       // hendingar.json .events
  let summerEvents = null; // hendingar.json .summerEvents

  async function loadAll() {
    const [g, l, h] = await Promise.all([
      fetch('data/grunndata.json').then(r => r.json()),
      fetch('data/linjer.json').then(r => r.json()),
      fetch('data/hendingar.json').then(r => r.json()).catch(() => ({ events: [], summerEvents: [] }))
    ]);
    base = g;
    programs = l.programs || [];
    events = h.events || [];
    summerEvents = h.summerEvents || [];
    return { base, programs, events };
  }

  function getBase() { return base; }
  function getPrograms() { return programs; }
  function getProgram(id) { return programs.find(p => p.id === id) || null; }
  function getEvents() { return events; }
  function getSummerEvents() { return summerEvents; }

  // Oppslag: "events.phoneScreenRepair" → objektet i grunndata
  function node(path) {
    const parts = path.split('.');
    let cur = base;
    for (const p of parts) {
      if (cur == null) return null;
      cur = cur[p];
    }
    return cur;
  }

  // Hent talverdi frå ein grunndata-node. Prioriterer gameValue-felta.
  function value(path, variant) {
    const n = node(path);
    if (n == null) return 0;
    if (typeof n === 'number') return n;
    if (variant && typeof n[variant] === 'number') return n[variant];
    if (typeof n.gameValue === 'number') return n.gameValue;
    // fall-back: aldersdelte gameValue-felt
    if (typeof n.gameValue14_17 === 'number') return n.gameValue14_17;
    return 0;
  }

  // Utstyrsstipend for eit rate-namn ("rate1".."rate5")
  function equipmentGrant(rate) {
    const n = node('grants.equipmentGrantPerYear');
    return (n && typeof n[rate] === 'number') ? n[rate] : 0;
  }

  // Familieprofil frå grunndata
  function familyProfile(id) {
    const n = node('family.profiles');
    return (n && n[id]) ? n[id] : null;
  }
  function familyProfileIds() {
    const n = node('family.profiles');
    return n ? Object.keys(n) : [];
  }

  return {
    loadAll,
    getBase, getPrograms, getProgram, getEvents, getSummerEvents,
    node, value, equipmentGrant, familyProfile, familyProfileIds
  };
})();
