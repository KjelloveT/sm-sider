/* ══════════════════════════════════════════════
   KAMERA.JS — Kameraet følgjer figuren

   Ein bane kan vere breiare enn skjermen, og då må kameraet flytte seg.
   Tre val som er meir enn standardoppsett:

   1. DØDSONE. Kameraet står stille så lenge figuren er i midtre tredjedel
      av skjermen. Utan det ryklar biletet på kvar minste rørsle, og eit
      bilete som aldri står stille er slitsamt å lese bokstavar i.

   2. INGEN LODDRETT FØLGJING. Verda er 10 fliser høg og skjermen viser
      alle ti. Eit kamera som følgjer figuren opp og ned ville rykt utan
      grunn — det er ingenting utanfor biletet å følgje etter.

   3. LERP, IKKJE HARD LÅS. Kameraet glir etter med litt forsinking. Ei
      hard låsing gjer at heile verda ser ut til å rykke når figuren snur.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Kor stor del av breidda figuren kan røre seg i før kameraet flyttar. */
  const DAUDSONE = 0.34;
  const LERP = 0.09;

  function fest(scene, spelar, bane) {
    const kam = scene.cameras.main;
    kam.setBounds(0, 0, bane.breidd, bane.hogd);

    /* Er banen ikkje breiare enn skjermen, skal kameraet stå heilt i ro.
       Ei følgjing som ikkje har nokon stad å gå gjev berre subpiksel-
       skjelving. */
    if (bane.breidd <= scene.scale.width + 1) {
      kam.stopFollow();
      kam.setScroll(0, 0);
      return kam;
    }

    kam.startFollow(spelar.kropp, true, LERP, 0);
    kam.setDeadzone(scene.scale.width * DAUDSONE, scene.scale.height);
    /* Følgj berre vassrett: y blir låst til toppen av verda. */
    kam.setFollowOffset(0, 0);
    kam.scrollY = 0;
    return kam;
  }

  /** Kallast kvar ramme. Held den loddrette posisjonen i ro. */
  function oppdater(scene) {
    const kam = scene.cameras.main;
    if (kam.scrollY !== 0) kam.scrollY = 0;
  }

  root.JaktaKamera = { fest: fest, oppdater: oppdater, DAUDSONE: DAUDSONE };
})(window);
