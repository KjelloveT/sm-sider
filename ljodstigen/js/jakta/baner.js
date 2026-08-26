/* ══════════════════════════════════════════════
   BANER.JS — Banedata

   Sjå bane.js for teikna.

   BANEFILA TEIKNAR IKKJE BAKKEN. Dei tre nedste radene er ein fast
   sokkel som blir lagd av byggjaren, lik i kvar bane. Her skriv ein
   berre det som står PÅ han — plattformer, soklar, myntar, døra. Det
   sparer tre identiske ###-rader i kvar fil, og gjer at kontrollane
   trygt kan liggje oppå sokkelen: der er det berre jord.

   Gitteret er 16 breitt og 7 høgt. Nedste rad (rad 6) er bakkenivå:
   der står figuren, soklane og døra. Radene over er luft.

   HOPPET NÅR 153 PX, altså to fliser og litt. Ingen plattform ligg meir
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
        '// verd1-01 — heilt flat. To soklar, ei plattform å hoppe på.',
        '................',
        '................',
        '................',
        '................',
        '..........c.....',
        '.........===....',
        '.@...P......P..D'
      ].join('\n')
    },
    {
      id: 'verd1-02',
      verd: 1,
      namn: 'Trappa',
      type: 'lyd',
      rutenett: [
        '// verd1-02 — to steg opp, kvart eitt innan rekkjevidd',
        '................',
        '................',
        '................',
        '........c.......',
        '.......===......',
        '...c.===........',
        '.@.P.........P.D'
      ].join('\n')
    },
    {
      id: 'verd1-03',
      verd: 1,
      namn: 'Utsikta',
      type: 'lyd',
      rutenett: [
        '// verd1-03 — to skjermar. Første gong bokstaven kan vere utanfor',
        '// biletet, og første gong pila trengst.',
        '................................',
        '................................',
        '.............c..................',
        '............===.................',
        '..........c.....................',
        '..........===...................',
        '.@....P..........P.........P...D'
      ].join('\n')
    },
    {
      id: 'verd2-01',
      verd: 2,
      namn: 'Tre på rad',
      type: 'rekkje',
      rutenett: [
        '// verd2-01 — tre soklar, tre bokstavar etter kvarandre',
        '................................',
        '................................',
        '................................',
        '................................',
        '.....c............c.............',
        '....===..........===............',
        '.@..P........P.........P.......D'
      ].join('\n')
    },
    {
      id: 'verd2-02',
      verd: 2,
      namn: 'Opp og ned',
      type: 'rekkje',
      rutenett: [
        '// verd2-02 — soklane ligg i ulik høgd. Trappa er tett, så',
        '// kvart steg er innan rekkjevidd frå det førre.',
        '................................',
        '................................',
        '.........P......................',
        '........===...........c.........',
        '.....c.===...........===........',
        '....===...........P.............',
        '.@...............===.....P.....D'
      ].join('\n')
    },
    {
      id: 'verd2-03',
      verd: 2,
      namn: 'Den lange vegen',
      type: 'rekkje',
      rutenett: [
        '// verd2-03 — fire skjermar. Myntar på plattformer langs vegen.',
        '................................................................',
        '................................................................',
        '................................................................',
        '................................................................',
        '........c.................c.................c...................',
        '.......===...............===...............===..................',
        '.@..P.............P.............P.............P................D'
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
