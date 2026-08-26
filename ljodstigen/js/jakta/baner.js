/* ══════════════════════════════════════════════
   BANER.JS — Banedata

   Sjå bane.js for teikna. Gitteret er 16 breitt og 8 høgt; dei to
   nedste radene på skjermen er kontrollsone og har ingen geometri, så
   fingrane til eleven aldri ligg over noko han treng å sjå.

   HOPPET NÅR TO FLISER (128 px) med margin. Ingen plattform ligg meir
   enn to fliser over den under. Første utgåve hadde plattformer tre og
   fire fliser opp, og då såg det ut som om kollisjonen var øydelagd —
   figuren nådde dei rett og slett aldri.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const BANER = [
    {
      id: 'verd1-01',
      verd: 1,
      namn: 'Lysninga',
      type: 'lyd',
      rutenett: [
        '// verd1-01 — heilt flat, alt innan rekkjevidd',
        '................',
        '................',
        '..........c.....',
        '....c.....==....',
        '.@...P......P..D',
        '################',
        '################',
        '################'
      ].join('\n')
    },
    {
      id: 'verd1-02',
      verd: 1,
      namn: 'Steget',
      type: 'lyd',
      rutenett: [
        '// verd1-02 — eitt steg opp, eitt ned',
        '................',
        '.........c......',
        '......P..===..P.',
        '..c...==......==',
        '.@.............D',
        '#####...########',
        '#####...########',
        '#####...########'
      ].join('\n')
    },
    {
      id: 'verd2-01',
      verd: 2,
      namn: 'Tre på rad',
      type: 'ord',
      rutenett: [
        '// verd2-01 — tre soklar, eit heilt ord',
        '................',
        '....c......c....',
        '...P...P...P....',
        '...==..==..==..D',
        '.@..............',
        '################',
        '################',
        '################'
      ].join('\n')
    }
  ];

  function hent(id) {
    return BANER.filter(function (b) { return b.id === id; })[0] || BANER[0];
  }

  function forVerd(n) {
    return BANER.filter(function (b) { return b.verd === n; });
  }

  root.JaktaBaner = { BANER: BANER, hent: hent, forVerd: forVerd };
})(window);
