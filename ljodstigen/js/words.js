/* ══════════════════════════════════════════════
   WORDS.JS — Orddata for Ljodstigen

   Berre ord som lèt seg lydere bokstav for bokstav: ingen doble
   konsonantar, ingen digrafar (ng, sj, kj, ei, au), ingen stumme
   bokstavar. Eleven skal kunne dra brikkene på plass og få eit ord
   som faktisk lyder som det ser ut.

   `step` blir rekna ut frå bokstavane, ikkje sett for hand — eit ord
   kan aldri dukke opp før eleven har møtt alle bokstavane i det.

   `tricky` listar bokstavar som i DETTE ordet har ein annan lyd enn
   den kanoniske. Nesten alltid <o>, som er /u/ i sol, mor, bok, god.
   Det er ikkje ein feil i lista — det er norsk rettskriving — men
   Ordbyggjaren held desse orda att til eleven har bygd nokre heilt
   regelrette ord først.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* [ord, trøblete bokstavar] */
  const RAW = [
    ['sol', ['o']], ['mor', ['o']], ['ler', []], ['sal', []], ['mas', []],
    ['ras', []], ['lam', []], ['mel', []], ['sel', []], ['rom', ['o']],
    ['ros', ['o']], ['rose', []], ['mose', []],

    ['is', []], ['ti', []], ['til', []], ['vin', []], ['vil', []],
    ['min', []], ['kan', []], ['kam', []], ['tak', []], ['nase', []],
    ['vase', []], ['kake', []], ['vise', []], ['ost', ['o']], ['sint', []],
    ['salt', []], ['stol', ['o']], ['tre', []],

    ['far', []], ['fem', []], ['fin', []], ['fot', ['o']], ['gul', []],
    ['gås', []], ['god', ['o']], ['dag', []], ['dal', []], ['due', []],
    ['uke', []], ['gate', []], ['måne', []], ['sofa', ['o']], ['mus', []],
    ['sur', []], ['gris', []], ['drage', []],

    ['bil', []], ['bok', ['o']], ['pil', []], ['pose', []], ['hus', []],
    ['hår', []], ['hest', []], ['lys', []], ['by', []], ['fly', []],
    ['øre', []], ['søt', []], ['høne', []], ['pen', []], ['hale', []],
    ['bål', []],

    ['jul', []], ['ja', []], ['jente', []], ['hær', []], ['lære', []]
  ];

  const WORDS = RAW.map(function (row) {
    const text = row[0];
    const letters = text.split('');
    let step = 1;
    letters.forEach(function (ch) {
      const info = LjodLetters.get(ch);
      if (info && info.step > step) step = info.step;
    });
    return {
      text: text,
      letters: letters,
      first: letters[0],
      last: letters[letters.length - 1],
      len: letters.length,
      step: step,
      tricky: row[1],
      clean: row[1].length === 0,
      sound: 'o_' + text
    };
  });

  /** Ord eleven kan møte no. `opts.clean` krev heilt regelrett skrivemåte. */
  function available(step, opts) {
    opts = opts || {};
    return WORDS.filter(function (w) {
      if (w.step > step) return false;
      if (opts.clean && !w.clean) return false;
      if (opts.maxLen && w.len > opts.maxLen) return false;
      if (opts.minLen && w.len < opts.minLen) return false;
      if (opts.letters && !w.letters.every(function (c) { return opts.letters.indexOf(c) !== -1; })) return false;
      return true;
    });
  }

  function byText(text) {
    return WORDS.filter(function (w) { return w.text === text; })[0] || null;
  }

  root.LjodWords = { WORDS: WORDS, available: available, byText: byText };
})(window);
