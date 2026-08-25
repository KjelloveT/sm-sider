/* ══════════════════════════════════════════════
   LETTERS.JS — Bokstavdata for Ljodstigen

   Éin post per bokstav i det norske alfabetet. Kvar post held:
     ch      — bokstaven, liten
     up      — bokstaven, stor
     phoneme — id-en til lydklippet i banken «fonem»
     name    — id-en til lydklippet i banken «namn» (bokstavnamnet)
     type    — 'vokal' | 'hald' | 'lukke'
     step    — kva bokstavsteg han høyrer til (1–5)

   «hald» er lydar som kan haldast: /s/, /m/, /l/, /r/, /f/, /v/, /n/, /j/.
   «lukke» er /p/, /t/, /k/, /b/, /d/, /g/ — dei kan ikkje strekkjast, og
   difor blir dei innspelte så korte som råd. Skiljet er ikkje kosmetisk:
   ein lukkelyd med vokalhale ("bø" i staden for /b/) gjer lydering umogleg,
   fordi eleven får "bø-i-lø" i staden for "bil".
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Bokstavstigen. Steg 1 er valt slik at alle lydane utanom /a/ kan
     haldast, OG slik at bokstavane lagar ekte nynorske ord med ein gong —
     sol, mor, ler, sal. Ein elev som kan tre av dei kan lese eit ord. */
  const STEPS = [
    ['s', 'o', 'l', 'e', 'm', 'r', 'a'],
    ['i', 'n', 't', 'v', 'k'],
    ['f', 'u', 'd', 'g', 'å'],
    ['b', 'p', 'h', 'y', 'ø'],
    ['j', 'æ', 'c', 'q', 'w', 'x', 'z']
  ];

  const VOWELS = ['a', 'e', 'i', 'o', 'u', 'y', 'æ', 'ø', 'å'];
  const STOPS  = ['p', 't', 'k', 'b', 'd', 'g'];

  const ALPHABET = 'abcdefghijklmnopqrstuvwxyzæøå'.split('');

  /* Bokstavar som blir bytte om på. Motoren set aldri to bokstavar frå
     same sett opp mot kvarandre før begge sit kvar for seg — elles lærer
     eleven forvekslinga i staden for bokstaven. */
  const CONFUSABLES = [
    ['b', 'd', 'p', 'q'],
    ['m', 'n'],
    ['u', 'y'],
    ['o', 'ø'],
    ['i', 'j'],
    ['v', 'w'],
    ['æ', 'ø', 'å'],
    ['k', 'g'],
    ['t', 'd'],
    ['f', 'v'],
    ['a', 'o'],
    ['n', 'h']
  ];

  function stepOf(ch) {
    for (let i = 0; i < STEPS.length; i++) {
      if (STEPS[i].indexOf(ch) !== -1) return i + 1;
    }
    return STEPS.length;
  }

  function typeOf(ch) {
    if (VOWELS.indexOf(ch) !== -1) return 'vokal';
    if (STOPS.indexOf(ch) !== -1) return 'lukke';
    return 'hald';
  }

  const LETTERS = {};
  ALPHABET.forEach(function (ch) {
    LETTERS[ch] = {
      ch: ch,
      up: ch.toUpperCase(),
      phoneme: 'f_' + ch,
      name: 'n_' + ch,
      type: typeOf(ch),
      step: stepOf(ch)
    };
  });

  /** Alle bokstavane til og med eit gitt steg. */
  function upTo(step) {
    const out = [];
    for (let i = 0; i < STEPS.length && i < step; i++) out.push.apply(out, STEPS[i]);
    return out;
  }

  /** Bokstavar som blir forveksla med `ch`. */
  function confusablesFor(ch) {
    const out = [];
    CONFUSABLES.forEach(function (set) {
      if (set.indexOf(ch) === -1) return;
      set.forEach(function (other) {
        if (other !== ch && out.indexOf(other) === -1) out.push(other);
      });
    });
    return out;
  }

  function isConfusable(a, b) {
    return confusablesFor(a).indexOf(b) !== -1;
  }

  root.LjodLetters = {
    ALPHABET: ALPHABET,
    STEPS: STEPS,
    LETTERS: LETTERS,
    get: function (ch) { return LETTERS[ch]; },
    upTo: upTo,
    confusablesFor: confusablesFor,
    isConfusable: isConfusable
  };
})(window);
