/* ══════════════════════════════════════════════
   PIL.JS — Peikar mot det eleven leitar etter

   Ein bane på fleire skjermar er ein bane ein seksåring kan gå seg bort
   i. Pila peikar mot næraste sokkel som står att, og mot døra når alt er
   samla.

   Kenney-pakken har tile_arrowLeft og tile_arrowRight. Dei blei med i
   atlaset med vilje: då vraklista blei skriven, fanga eit «arrow»-mønster
   både item_arrow (eit pilskot, som ikkje høyrer heime i eit spel utan
   farar) og tile_arrow* (vegvisarar). Sistnemnde blei uttrykkeleg berga.

   PILA VISER SEG BERRE NÅR HO TRENGST. Er målet på skjermen, er ho
   borte — ein peikar mot noko du alt ser er støy, og det er nettopp den
   typen støy som lærer eit barn å ignorere hjelpa.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const MARG = 76;      // kor langt inn frå kanten pila ligg
  const STORLEIK = 52;

  function lag(scene) {
    const p = {
      bilete: scene.add.image(0, 0, 'kenney', 'tile_arrowRight')
        .setScrollFactor(0).setDepth(900).setAlpha(0).setDisplaySize(STORLEIK, STORLEIK),
      synleg: false
    };

    /* Ein liten puls, så pila blir lagt merke til utan å blinke. */
    scene.tweens.add({
      targets: p.bilete, scaleX: { from: p.bilete.scaleX, to: p.bilete.scaleX * 1.14 },
      scaleY: { from: p.bilete.scaleY, to: p.bilete.scaleY * 1.14 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    /**
     * @param maal  { x, y } eller null
     */
    p.pek = function (maal) {
      const kam = scene.cameras.main;
      if (!maal) { skjul(); return; }

      const venstreKant = kam.scrollX;
      const hogreKant = kam.scrollX + kam.width;
      /* Litt margin: eit mål så vidt innanfor kanten er eit mål eleven
         ikkje har sett enno. */
      const innanfor = maal.x > venstreKant + 40 && maal.x < hogreKant - 40;
      if (innanfor) { skjul(); return; }

      const tilHogre = maal.x >= hogreKant;
      p.bilete.setFrame(tilHogre ? 'tile_arrowRight' : 'tile_arrowLeft');
      p.bilete.x = tilHogre ? kam.width - MARG : MARG;
      p.bilete.y = kam.height * 0.30;
      if (!p.synleg) {
        p.synleg = true;
        scene.tweens.add({ targets: p.bilete, alpha: 0.85, duration: 220 });
      }
    };

    function skjul() {
      if (!p.synleg) return;
      p.synleg = false;
      scene.tweens.add({ targets: p.bilete, alpha: 0, duration: 180 });
    }

    p.skjul = skjul;
    return p;
  }

  /**
   * Næraste sokkel som står att, elles døra når ho er open.
   *
   * VI PEIKAR MOT DEN NÆRASTE, IKKJE MOT FASITEN. Ei pil rett på rett
   * sokkel ville gjort oppgåva til å følgje ei pil i staden for å høyre
   * etter — og då øver eleven på noko heilt anna enn bokstavlydar.
   * Pila seier «det er noko den vegen», ikkje «det er dette svaret».
   */
  function finnMaal(bane, oppdrag, spelarX) {
    if (!oppdrag) return null;
    if (oppdrag.ferdig) {
      return (bane.doer && !bane.doer.stengd) ? { x: bane.doer.x, y: bane.doer.y } : null;
    }
    const att = bane.soklar.filter(function (s) { return !s.teken; });
    if (!att.length) return null;
    let naerast = att[0];
    let best = Math.abs(att[0].x - spelarX);
    for (let i = 1; i < att.length; i++) {
      const d = Math.abs(att[i].x - spelarX);
      if (d < best) { best = d; naerast = att[i]; }
    }
    return { x: naerast.x, y: naerast.y };
  }

  root.JaktaPil = { lag: lag, finnMaal: finnMaal };
})(window);
