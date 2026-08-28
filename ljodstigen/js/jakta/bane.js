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

   ── TERRENGET ER EIT FLISEKART, IKKJE SPRITES ──

   Ein bane kan vere 30 skjermar brei. Det er 480 × 10 = 4 800 fliser, og
   like mange sprites med kvar sin statiske kropp er uspelbart på ein
   skule-iPad. Phaser sitt flisekart teiknar berre det kameraet ser og
   tek heile kollisjonen med eitt kall.

   Interaktive ting — soklar, myntar, døra — blir verande sprites. Dei
   skal kunne tintast, plukkast og teljast, og det er få av dei.

   Overlappet som spelekoden gjorde før (kvar flis teikna 5 px for stor,
   så konturane fall saman) finst ikkje lenger her. Eit flisekart legg
   flisene kant i kant, og fiksen ligg i flisesettet: flisene er skorne
   til strekmidten av bygg_ljodstigen_atlas.py.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const FLIS = 64;

  /* Teikn som figuren kan stå på, og som difor høyrer til flisekartet. */
  const TERRENG = { '#': 0, '_': 1, '=': 2 };
  const TOM = -1;

  /* Grunn med noko oppå seg skal vere ei blank flis, ikkje ei med
     graskant. Berre den øvste raden i ein haug har den takka toppen —
     slik det er i Sample.png frå Kenney. Det blir avgjort her og ikkje i
     banefila, så den som teiknar ei bane slepp å tenkje på det. */
  function terrengIndeks(t, over) {
    if (t === '#') return (over === '#' || over === '_') ? 1 : 0;
    return TERRENG[t];
  }

  /* Kommentarlinjer byrjar med «//», ikkje «#»: # er sjølve grunnflisa,
     og ei kommentarsyntaks som kolliderer med eit banesymbol er ei
     kommentarsyntaks som før eller seinare et ei rad med bakke. */
  function parse(tekst) {
    return String(tekst).replace(/\r/g, '').split('\n')
      .filter(function (l) {
        return l.trim().length > 0 && l.trim().slice(0, 2) !== '//';
      });
  }

  /* ── PYNTELAGET ──

     Alt læraren har teikna av klossar UTAN funksjon. Dei ligg ikkje i
     rutenettet, og det er heile poenget: validatoren reknar ut kva
     figuren kan nå, og ein kloss som berre er teikna skal ikkje kunne
     stengje ein veg. Dei kolliderer ikkje, og eleven går rett gjennom.

     Får ein av dei ein funksjon seinare, flyttar han til rutenettet og
     får sitt eige teikn — og då er det validatoren sin jobb igjen.

     Sprita har ulike storleikar (128×128, 128×256, 256×128). Vi held
     sideforholdet og forankrar i BOTNEN av ruta, så eit tre veks oppover
     ut av ruta i staden for å bli klemt ned i ein kvadrat. */
  function pyntLag(scene, pynt) {
    const ut = [];
    (pynt || []).forEach(function (p) {
      const rx = p[0], ry = p[1], namn = p[2];
      const ramme = scene.textures.getFrame('kenney', namn);
      if (!ramme) return;
      const skala = FLIS / ramme.width;
      const bilete = scene.add.image(
        rx * FLIS + FLIS / 2,
        (ry + 1) * FLIS,
        'kenney', namn
      );
      bilete.setOrigin(0.5, 1);
      bilete.setDisplaySize(FLIS, ramme.height * skala);
      /* Under flisekartet (5) og under figuren: pynt skal aldri dekkje
         ein sokkel eleven leitar etter. */
      bilete.setDepth(2);
      ut.push(bilete);
    });
    return ut;
  }

  /**
   * Byggjer banen inn i ei scene.
   * @param opts { basisRader, pynt }
   * @returns { lag, soklar, myntar, start, doer, pynt, breidd, hogd, rader }
   */
  function bygg(scene, tekst, opts) {
    opts = opts || {};
    const rader = parse(tekst);
    const basisRader = opts.basisRader || 0;
    const radTal = rader.length;
    const breidd = Math.max.apply(null, rader.map(function (r) { return r.length; }));
    const hogd = radTal + basisRader;

    /* ── Flisekartet ── */

    const gitter = [];
    for (let ry = 0; ry < hogd; ry++) {
      const rad = new Array(breidd).fill(TOM);
      if (ry < radTal) {
        for (let rx = 0; rx < breidd; rx++) {
          const t = rader[ry][rx] || '.';
          if (!(t in TERRENG)) continue;
          const over = ry > 0 ? (rader[ry - 1][rx] || '.') : '.';
          rad[rx] = terrengIndeks(t, over);
        }
      } else {
        /* SOKKELEN: tre rader fast bakke, like i kvar bane. Han blir lagd
           her og ikkje i banefila, av to grunnar. Den som teiknar ei bane
           skal sleppe å skrive tre identiske ###-rader kvar gong. Og
           kontrollane ligg oppå sokkelen — der er det berre jord, så
           ingenting eleven treng å sjå blir dekt av fingrane hans. */
        rad.fill(ry === radTal ? 0 : 1);
      }
      gitter.push(rad);
    }

    const kart = scene.make.tilemap({
      data: gitter, tileWidth: FLIS, tileHeight: FLIS
    });
    const flisesett = kart.addTilesetImage('flisesett', 'flisesett', FLIS, FLIS, 0, 0);
    const lag = kart.createLayer(0, flisesett, 0, 0);
    lag.setDepth(5);
    /* Alt som ikkje er tomt kolliderer. Éin operasjon for heile banen,
       uansett kor brei han er. */
    lag.setCollisionByExclusion([TOM]);

    /* ── Objekt ── */

    const soklar = [];
    const myntar = [];
    let start = { x: FLIS * 1.5, y: radTal * FLIS - FLIS * 0.6 };
    let doer = null;

    rader.forEach(function (rad, ry) {
      for (let rx = 0; rx < rad.length; rx++) {
        const t = rad[rx];
        const x = rx * FLIS + FLIS / 2;
        const y = ry * FLIS + FLIS / 2;

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

        if (t === 'P') {
          /* Sokkelen er eit sprite og ikkje ei flis: han skal kunne
             tintast grønt eller raudt, og eit flisekart gjev oss ikkje
             det like enkelt per rute. */
          const b = scene.physics.add.staticImage(x, y, 'kenney', 'tile_block');
          b.setDisplaySize(FLIS, FLIS).refreshBody();
          b.setDepth(6);
          soklar.push({ blokk: b, x: x, y: y - FLIS * 0.92, bokstav: null, teken: false });
          continue;
        }

        if (t === 'D') {
          doer = scene.add.image(x, y, 'kenney', 'tile_door')
            .setDisplaySize(FLIS, FLIS).setDepth(6);
          doer.stengd = true;
          doer.setAlpha(0.45);
        }
      }
    });

    return {
      lag: lag, kart: kart,
      pynt: pyntLag(scene, opts.pynt),
      soklar: soklar, myntar: myntar,
      start: start, doer: doer, rader: rader,
      breidd: breidd * FLIS, hogd: hogd * FLIS,
      basisTopp: radTal * FLIS
    };
  }

  root.JaktaBane = {
    bygg: bygg, parse: parse, pyntLag: pyntLag, FLIS: FLIS,
    TERRENG: TERRENG, TOM: TOM, terrengIndeks: terrengIndeks
  };
})(window);
