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

  /* KVIFOR FLISENE BLIR TEIKNA STØRRE ENN RUTA DEI LIGG I.

     Kenney-flisene har konturstreken heilt ute i kanten av sprita —
     målt ligg han 3-6 px inn frå kanten på ei 128 px-flis. Legg ein dei
     kant i kant, får ein to strekar med kvitt imellom, og rutenettet
     ser ut som ei samling laushengande øyer. Sample.png frå pakken viser
     korleis det skal sjå ut: ein samanhengande vegg med ENKLE strekar.

     Vi teiknar difor kvar flis 5 px større enn ruta, sentrert. Nabofliser
     overlappar då akkurat nok til at strekane fell saman. Fysikk-kroppen
     held seg på 64, så rutenettlogikken er urørt. */
  const OVERLAPP = 5;

  /* Kva sprite kvart teikn blir. Fleire teikn kan peike på same sprite;
     det er kollisjonen og tydinga som skil dei. */
  const SPRITES = {
    '#': 'tile_grass',      // berre øvste rad — sjå flisFor()
    '_': 'tile',
    '=': 'tile_bridge',
    'P': 'tile_block',
    'D': 'tile_door',
    'T': 'background_tree'
  };

  /* Grunn med noko oppå seg skal vere ei blank flis, ikkje ei med
     gras-kant. Berre den øvste raden i ein haug har den takka toppen —
     slik det er i Sample.png. Det blir avgjort her og ikkje i banefila,
     så den som teiknar ei bane slepp å tenkje på det. */
  function flisFor(teikn, rader, rx, ry) {
    if (teikn !== '#') return SPRITES[teikn];
    const over = ry > 0 ? (rader[ry - 1][rx] || '.') : '.';
    return (over === '#' || over === '_') ? 'tile' : 'tile_grass';
  }

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

    /* ── SOKKELEN ──
       Tre rader fast bakke heilt nedst, like i kvar bane. Han blir lagd
       her og ikkje i banefila, av to grunnar:

       Den som teiknar ei bane skal sleppe å skrive tre identiske rader
       med ### kvar gong. Han teiknar berre det som står PÅ bakken.

       Og kontrollane ligg oppå sokkelen. Joysticken dekkjer dei to
       nedste radene, men det gjer ikkje noko: der er det berre jord,
       ingenting eleven treng å sjå. Verda byrjar over fingrane hans.

       Berre øvste rad har kollisjon. Dei to under er reint visuelle —
       figuren kan ikkje kome dit uansett, og to lag statiske kroppar til
       hadde vore reine kostnader. */
    const basisRader = opts.basisRader || 0;
    const basisTopp = rader.length;
    for (let i = 0; i < basisRader; i++) {
      const ry = basisTopp + i;
      const y = ry * FLIS + FLIS / 2 + yOff;
      for (let rx = 0; rx < breidd; rx++) {
        const x = rx * FLIS + FLIS / 2;
        if (i === 0) {
          const b = faste.create(x, y, 'kenney', 'tile_grass');
          b.setDisplaySize(FLIS + OVERLAPP, FLIS + OVERLAPP).refreshBody();
          b.body.setSize(FLIS, FLIS);
          b.body.position.set(x - FLIS / 2, y - FLIS / 2);
          b.setDepth(5);
        } else {
          scene.add.image(x, y, 'kenney', 'tile')
            .setDisplaySize(FLIS + OVERLAPP, FLIS + OVERLAPP).setDepth(4);
        }
      }
    }
    /* Startpunktet står på sokkelen om banefila ikkje seier noko anna. */
    start = { x: FLIS * 1.5, y: basisTopp * FLIS + yOff - FLIS * 0.6 };

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

        const namn = flisFor(t, rader, rx, ry);
        if (!namn) continue;

        if (FASTE.indexOf(t) !== -1) {
          const b = faste.create(x, y, 'kenney', namn);
          /* Teikna større enn ruta, men kollisjonen held seg på 64:
             setSize etter refreshBody, elles arvar kroppen den store
             visinga og figuren stoppar i lufta. */
          b.setDisplaySize(FLIS + OVERLAPP, FLIS + OVERLAPP).refreshBody();
          b.body.setSize(FLIS, FLIS);
          b.body.position.set(x - FLIS / 2, y - FLIS / 2);
          b.setDepth(5);
          if (t === 'P') {
            /* Sokkelen er fast grunn OG ein plass for ein bokstav.
               Bokstaven svevar over han og blir sett av oppdrag.js. */
            soklar.push({ blokk: b, x: x, y: y - FLIS * 0.92, bokstav: null, teken: false });
          }
        } else if (t === 'D') {
          doer = scene.add.image(x, y, 'kenney', namn)
            .setDisplaySize(FLIS + OVERLAPP, FLIS + OVERLAPP).setDepth(6);
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

  root.JaktaBane = { bygg: bygg, parse: parse, FLIS: FLIS, OVERLAPP: OVERLAPP, SPRITES: SPRITES, flisFor: flisFor };
})(window);
