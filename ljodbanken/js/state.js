/* ══════════════════════════════════════════════
   STATE.JS — Lista og opptaka

   Alt ligg i minnet så lenge fana er open, og ingen stad elles. Det er
   eit medvite val: eit opptak av stemma di er personopplysningar, og då
   er den tryggaste lagringa ingen lagring. Til gjengjeld kan du når som
   helst laste ned zip-fila og hente henne inn att seinare — det er slik
   du tek pause i arbeidet.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.state = (function () {
  'use strict';

  let list = null;
  const takes = new Map();        // itemId -> take
  const listeners = [];
  let clock = 0;

  /**
   * Eit opptak:
   *   buffer   AudioBuffer, alltid heile opptaket slik det kom inn
   *   start    kvar utsnittet byrjar, i sekund
   *   end      kvar det sluttar
   *   origin   'mikrofon' eller 'fil'
   *   bytes    fila slik ho kom, når opptaket er henta frå ein zip
   *   ext      'mp3' eller 'wav' for dei same
   *   edited   true når brukaren har skore til sjølv
   */

  function setList(next) {
    list = next;
    takes.clear();
    emit();
  }

  function current() { return list; }

  /** Alle klippa i lista, flatt, med banken sin med på lasset. */
  function items() {
    if (!list) return [];
    const out = [];
    list.banks.forEach((bank) => {
      bank.items.forEach((item) => out.push({ item: item, bank: bank }));
    });
    return out;
  }

  function itemById(id) {
    const found = items().find(row => row.item.id === id);
    return found ? found.item : null;
  }

  function bankOf(id) {
    const found = items().find(row => row.item.id === id);
    return found ? found.bank : null;
  }

  /* ──────────────── Opptaka ──────────────── */

  function get(id) { return takes.get(id) || null; }
  function has(id) { return takes.has(id); }

  function put(id, take) {
    // Stempelet lèt lista sjå kva som faktisk har endra seg, så ho slepp
    // å teikne 141 lydkurver om att kvar gong eitt klipp kjem inn.
    take.stamp = ++clock;
    takes.set(id, take);
    emit();
  }

  function remove(id) {
    takes.delete(id);
    emit();
  }

  function clearAll() {
    takes.clear();
    emit();
  }

  /** Lengda på utsnittet, altså det som faktisk blir eksportert. */
  function lengthOf(take) {
    if (!take) return 0;
    return Math.max(0, take.end - take.start);
  }

  function setTrim(id, start, end) {
    const take = takes.get(id);
    if (!take) return;
    take.start = Math.max(0, Math.min(start, take.buffer.duration));
    take.end = Math.max(take.start + 0.02, Math.min(end, take.buffer.duration));
    take.edited = true;
    take.stamp = ++clock;
    emit();
  }

  function count() { return takes.size; }

  function total() { return items().length; }

  /** Kor mange klipp som er gjorde i kvar bank. */
  function bankProgress(bankId) {
    if (!list) return { done: 0, total: 0 };
    const bank = list.banks.find(b => b.id === bankId);
    if (!bank) return { done: 0, total: 0 };
    let done = 0;
    bank.items.forEach(item => { if (takes.has(item.id)) done++; });
    return { done: done, total: bank.items.length };
  }

  /** Det neste klippet utan opptak, etter dette. Null når alt er gjort. */
  function nextMissing(afterId) {
    const rows = items();
    const from = afterId ? rows.findIndex(r => r.item.id === afterId) + 1 : 0;
    for (let i = from; i < rows.length; i++) {
      if (!takes.has(rows[i].item.id)) return rows[i].item.id;
    }
    for (let i = 0; i < from; i++) {
      if (!takes.has(rows[i].item.id)) return rows[i].item.id;
    }
    return null;
  }

  /* ──────────────── Varsling ──────────────── */

  function subscribe(fn) { listeners.push(fn); }

  function emit() { listeners.forEach(fn => fn()); }

  return {
    setList, current, items, itemById, bankOf,
    get, has, put, remove, clearAll, setTrim,
    lengthOf, count, total, bankProgress, nextMissing,
    subscribe, emit
  };
})();
