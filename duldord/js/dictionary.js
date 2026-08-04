/* Duldord — ordlista som avgjer kva som er eit gyldig gjett.
   Ho er på drygt hundre kilobyte og blir difor henta fyrst når ho trengst,
   altså ved det fyrste gjettet, ikkje når sida lastar. */
(function (global) {
  'use strict';

  let words = null;
  let pending = null;

  function load() {
    if (words) return Promise.resolve(words);
    if (pending) return pending;
    pending = fetch('data/gjettbare.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        words = new Set(data.ord);
        return words;
      })
      .catch(err => {
        // Klarer vi ikkje å hente lista, er det betre å sleppe alle gjett
        // gjennom enn å låse spelaren ute frå spelet.
        console.warn('Duldord: fekk ikkje lasta ordlista, godtek alle ord.', err);
        words = null;
        return null;
      })
      .finally(() => { pending = null; });
    return pending;
  }

  /** Byrjar nedlastinga i bakgrunnen utan at nokon ventar på henne. */
  function warm() { load(); }

  function isValid(word) {
    return load().then(set => !set || set.has(word));
  }

  global.DuldordDictionary = { warm, isValid };
})(window);
