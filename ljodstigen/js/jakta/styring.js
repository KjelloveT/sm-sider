/* ══════════════════════════════════════════════
   STYRING.JS — Joystick og hoppknapp

   Første utgåve delte heile nedre tredjedel i tre store soner. Det var
   for mykje: sonene åt opp skjermen, og fingrane låg over spelflata.
   No er det ein liten joystick nede til venstre og ein rund hoppknapp
   nede til høgre — resten av skjermen er spel.

   VI BRUKAR PHASER SITT INPUT-SYSTEM, ikkje eigne vindaugslyttarar.
   Lerretet blir skalert med FIT og sentrert med svarte kantar rundt, og
   Phaser reknar om frå skjerm- til lerretkoordinatar for oss. Gjer vi
   det sjølve med getBoundingClientRect, må vi ta høgd for både skalering
   og brevkantar — og det blir feil den dagen nokon endrar skaleringa.

   JOYSTICKEN ER FLYTTBAR. Basen står teikna nede til venstre, men tek
   eleven på ein annan stad i venstre halvdel, flyttar han seg dit. Ein
   seksåring ser ikkje ned på hendene medan han speler, og ein joystick
   som berre verkar på nøyaktig rett punkt er ein joystick som ikkje
   verkar.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const BASE_R = 52;        // radius på joystick-basen
  const KNOTT_R = 30;
  const DAUDSONE = 0.22;    // under dette tel utslaget som «ingen retning»
  const HOPP_R = 46;

  function lag(scene, opts) {
    opts = opts || {};
    const W = scene.scale.width;
    const H = scene.scale.height;

    /* Kvileposisjonar. Godt inne frå kanten, så tommelen ikkje hamnar
       utanfor skjermen på ein iPad med avrunda hjørne. */
    const hvileX = opts.joyX || (BASE_R + 34);
    const hvileY = opts.joyY || (H - BASE_R - 26);
    const hoppX = opts.hoppX || (W - HOPP_R - 34);
    const hoppY = opts.hoppY || (H - HOPP_R - 26);

    const state = { akse: 0, hopp: false, hoppNy: false };
    let joyPeikar = null;     // id-en til fingeren som styrer joysticken
    let hoppPeikar = null;

    /* ──────────────── Teikning ──────────────── */

    const lag_ = scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const base = scene.add.circle(hvileX, hvileY, BASE_R, 0xffffff, 0.55)
      .setStrokeStyle(4, 0x1a1a1a, 0.55);
    const knott = scene.add.circle(hvileX, hvileY, KNOTT_R, 0x1a1a1a, 0.34)
      .setStrokeStyle(3, 0x1a1a1a, 0.7);
    const hoppKnapp = scene.add.circle(hoppX, hoppY, HOPP_R, 0xffffff, 0.55)
      .setStrokeStyle(4, 0x1a1a1a, 0.55);
    /* Ein pil opp, teikna med strekar — ingen bokstav, sidan knappen skal
       kunne brukast av ein som ikkje les enno. */
    const hoppIkon = scene.add.graphics();
    hoppIkon.lineStyle(6, 0x1a1a1a, 0.6);
    hoppIkon.beginPath();
    hoppIkon.moveTo(hoppX, hoppY + 14);
    hoppIkon.lineTo(hoppX, hoppY - 14);
    hoppIkon.moveTo(hoppX - 13, hoppY - 2);
    hoppIkon.lineTo(hoppX, hoppY - 16);
    hoppIkon.lineTo(hoppX + 13, hoppY - 2);
    hoppIkon.strokePath();

    lag_.add([base, knott, hoppKnapp, hoppIkon]);
    [base, knott, hoppKnapp, hoppIkon].forEach(function (o) {
      o.setScrollFactor(0).setDepth(1000);
    });

    /* ──────────────── Trykk ──────────────── */

    function erPaaHopp(p) {
      return Phaser.Math.Distance.Between(p.worldX || p.x, p.worldY || p.y, hoppX, hoppY)
        <= HOPP_R * 1.6;
    }

    function settKnott(x, y) {
      const dx = x - base.x, dy = y - base.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const k = d > BASE_R ? BASE_R / d : 1;
      knott.setPosition(base.x + dx * k, base.y + dy * k);
      const ut = (knott.x - base.x) / BASE_R;
      state.akse = Math.abs(ut) < DAUDSONE ? 0 : ut;
    }

    function slippJoy() {
      joyPeikar = null;
      base.setPosition(hvileX, hvileY);
      knott.setPosition(hvileX, hvileY);
      state.akse = 0;
    }

    scene.input.on('pointerdown', function (p) {
      if (hoppPeikar === null && erPaaHopp(p)) {
        hoppPeikar = p.id;
        if (!state.hopp) state.hoppNy = true;
        state.hopp = true;
        hoppKnapp.setFillStyle(0x1a1a1a, 0.28);
        return;
      }
      if (joyPeikar === null && p.x < scene.scale.width * 0.62) {
        joyPeikar = p.id;
        /* Flytt basen dit fingeren landa — sjå kommentaren øvst. */
        base.setPosition(p.x, p.y);
        settKnott(p.x, p.y);
      }
    });

    scene.input.on('pointermove', function (p) {
      if (p.id === joyPeikar) settKnott(p.x, p.y);
    });

    function opp(p) {
      if (p.id === joyPeikar) slippJoy();
      if (p.id === hoppPeikar) {
        hoppPeikar = null;
        state.hopp = false;
        hoppKnapp.setFillStyle(0xffffff, 0.55);
      }
    }
    scene.input.on('pointerup', opp);
    scene.input.on('pointerupoutside', opp);

    /* ──────────────── Tastatur ──────────────── */

    const piler = scene.input.keyboard.createCursorKeys();
    const rom = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    let tastHoppFor = false;

    function les() {
      const kbHopp = piler.up.isDown || rom.isDown;
      const kbNy = kbHopp && !tastHoppFor;
      tastHoppFor = kbHopp;

      let akse = state.akse;
      if (piler.left.isDown) akse = -1;
      else if (piler.right.isDown) akse = 1;

      const ut = {
        akse: akse,
        hopp: state.hopp || kbHopp,
        hoppTrykt: state.hoppNy || kbNy
      };
      state.hoppNy = false;   // eit trykk blir lese éin gong
      return ut;
    }

    function vis(paa) { lag_.setVisible(paa !== false); }

    return { les: les, vis: vis, _state: state, BASE_R: BASE_R, HOPP_R: HOPP_R };
  }

  root.JaktaStyring = { lag: lag, BASE_R: BASE_R, HOPP_R: HOPP_R };
})(window);
