/* ══════════════════════════════════════════════
   BANE.JS — Byggjer ei bane frå eit ASCII-gitter

   Baneformatet er tekst med vilje. Det er lesbart i ein pull request,
   ein lærar kan endre det utan verktøy, og ei endring i ei bane er ein
   diff ein kan sjå på — i motsetnad til Tiled-JSON, der ein flytta
   plattform blir fire hundre endra tal.

     #  fast grunn          =  plattform
     P  bokstavsokkel       @  start
     D  dør (mål)           c  mynt
     .  luft                T  tre / pynt

   KVA BOKSTAV som hamnar på kvar P blir ikkje avgjort her. Geometrien er
   fast og lik kvar gong; innhaldet kjem frå LjodAdaptive. Sjå oppdrag.js.

   NEDRE RADER ER KONTROLLSONE. Banen blir teikna over dei, aldri i dei:
   fingrane til eleven ligg der, og ein plattform under tommelen er ein
   plattform han ikkje ser.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const FLIS = 64;

  /* Kva sprite kvart teikn blir. Fleire teikn kan peike på same sprite;
     det er kollisjonen og tydinga som skil dei. */
  const SPRITES = {
    '#': 'tile_grass',
    '_': 'tile',
    '=': 'tile_bridge',
    'P': 'tile_block',
    'D': 'tile_door',
    'T': 'background_tree'
  };

  const FASTE = '#_=P';        // teikn som figuren kan stå på

  /* Kommentarlinjer byrjar med «//», ikkje «#»: # er sjølve grunnflisa,
     og ei kommentarsyntaks som kolliderer med eit banesymbol er ei
     kommentarsyntaks som før eller seinare et ei rad med bakke. */
  function parse(tekst) {
    return String(tekst).replace(/\r/g, '').split('\n')
      .filter(function (l) {
        return l.trim().length > 0 && l.trim().slice(0, 2) !== '//';
      });
  }

  /**
   * Byggjer banen inn i ei scene.
   * @returns { faste, soklar, myntar, start, doer, breidd, hogd }
   */
  function bygg(scene, tekst, opts) {
    opts = opts || {};
    const rader = parse(tekst);
    const hogd = rader.length;
    const breidd = Math.max.apply(null, rader.map(function (r) { return r.length; }));

    /* Banen blir skoven ned slik at han fyller frå toppen, og
       kontrollsona ligg under. */
    const yOff = opts.yOffset || 0;

    const faste = scene.physics.add.staticGroup();
    const soklar = [];
    const myntar = [];
    let start = { x: FLIS * 1.5, y: FLIS * 2 };
    let doer = null;

    rader.forEach(function (rad, ry) {
      for (let rx = 0; rx < rad.length; rx++) {
        const t = rad[rx];
        if (t === '.' || t === ' ') continue;
        const x = rx * FLIS + FLIS / 2;
        const y = ry * FLIS + FLIS / 2 + yOff;

        if (t === '@') { start = { x: x, y: y }; continue; }

        if (t === 'c') {
          const m = scene.add.image(x, y, 'kenney', 'tile_coin')
            .setDisplaySize(FLIS * 0.55, FLIS * 0.55).setDepth(8);
          scene.tweens.add({
            targets: m, y: y - 7, duration: 1100, yoyo: true, repeat: -1,
            ease: 'Sine.easeInOut', delay: (rx * 90) % 700
          });
          myntar.push({ bilete: m, x: x, y: y, teken: false });
          continue;
        }

        if (t === 'T') {
          scene.add.image(x, y, 'kenney', 'background_tree')
            .setDisplaySize(FLIS, FLIS * 2).setDepth(1).setAlpha(0.5);
          continue;
        }

        const namn = SPRITES[t];
        if (!namn) continue;

        if (FASTE.indexOf(t) !== -1) {
          const b = faste.create(x, y, 'kenney', namn);
          b.setDisplaySize(FLIS, FLIS).refreshBody();
          b.setDepth(5);
          if (t === 'P') {
            /* Sokkelen er fast grunn OG ein plass for ein bokstav.
               Bokstaven svevar over han og blir sett av oppdrag.js. */
            soklar.push({ blokk: b, x: x, y: y - FLIS * 0.92, bokstav: null, teken: false });
          }
        } else if (t === 'D') {
          doer = scene.add.image(x, y, 'kenney', namn)
            .setDisplaySize(FLIS, FLIS).setDepth(6);
          doer.stengd = true;
          doer.setAlpha(0.45);
        }
      }
    });

    return {
      faste: faste, soklar: soklar, myntar: myntar,
      start: start, doer: doer,
      breidd: breidd * FLIS, hogd: hogd * FLIS + yOff
    };
  }

  root.JaktaBane = { bygg: bygg, parse: parse, FLIS: FLIS, SPRITES: SPRITES };
})(window);
