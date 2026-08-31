/* ══════════════════════════════════════════════
   ROPET-BOOT.JS — startar leirplassen

   Held tre ting frå kvarandre: kva som må vere på plass før spelet kan
   starte, kva som går gale, og sjølve spelet.

   Ein elev som kjem hit utan å ha valt figur på Ljodstigen-sida, eller
   frå ei maskin utan WebGL, skal få vite kvifor det ikkje verkar og kome
   seg tilbake — ikkje møte ei tom rute.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function feil(melding) {
    const boks = $('ropet-feil'), tekst = $('ropet-feil-tekst'), lastar = $('ropet-lastar');
    if (tekst) tekst.textContent = melding;
    if (boks) boks.hidden = false;
    if (lastar) lastar.hidden = true;
    console.warn('[Bokstavropet] ' + melding);
  }

  function profil() {
    const s = LjodState.read();
    let p = s.lastProfile ? LjodState.getProfile(s.lastProfile) : null;
    if (!p) p = s.profiles[0] || null;
    return p;
  }

  function start() {
    if (!RopetVerd.stott()) {
      feil('Denne maskina teiknar ikkje 3D i nettlesaren. Bokstavropet finst ' +
           'òg som vanleg skjermspel inne på Ljodstigen.');
      return;
    }
    const p = profil();
    if (!p) {
      feil('Vel ein figur på Ljodstigen-sida først, så veit spelet kven som speler.');
      return;
    }

    /* Lyden må låsast opp av eit trykk. Vi ventar ikkje på det — spelet
       startar, og første trykket på styrespaken eller knappen gjer
       resten. Ein figur som ikkje kan gå før han har fått lyd er ein
       figur som ser broten ut. */
    LjodAudio.load(['fonem']).catch(function () { /* tonar held */ });

    RopetVerd.last().then(function () {
      $('ropet-lastar').hidden = true;
      root.RopetSpel = LjodRopet3D.start($('ropet-scene'), p, {
        etterSvar: function () { /* framgangen er alt lagra */ }
      });
    }).catch(function (e) {
      feil('Fekk ikkje lasta leirplassen: ' + e.message);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }
})(window);
