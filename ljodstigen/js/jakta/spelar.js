/* ══════════════════════════════════════════════
   SPELAR.JS — Figuren

   Kenney har ingen gangesyklus: kvar figur er éin ramme. Men pakken har
   LAUSE HENDER — character_handGreen og dei tre andre fargane — så han
   er teikna for Rayman-trikset frå starten: kroppen og hendene er skilde
   objekt, og hendene heng etter i lufta utan å vere feste til noko.

   Det gjer at all rørsle kan lagast utan ei einaste animasjonsramme:

   - HENDENE HENG ETTER. Dei følgjer eit mål ved sida av kroppen, men med
     forsinking. Snur figuren, sving hendene rundt eit augeblink seinare.
     Det er heile illusjonen, og han kostar to sprites.
   - WIGGLE. Kroppen vippar fram og tilbake medan han går, og litt
     raskare di fortare han går.
   - STREKK OG SQUASH. Lang i lufta, flat i landinga.

   FIGUREN SKIFTAR ALDRI UTTRYKK. I Kenney-pakken sit ansiktet i fargen —
   grøn er glad, lilla er lei seg — så eit uttrykksskifte er eit
   identitetsskifte. Og uansett: figuren til eleven skal ikkje sjå trist
   ut på han. Tilbakemelding kjem frå verda, ikkje frå han sjølv.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const FART = 300;
  const HOPPKRAFT = 720;    // klarar to fliser (128 px) med margin
  const COYOTE_MS = 110;
  const BUFFER_MS = 160;

  /* Kor langt ut frå kroppen hendene svevar, i delar av kroppsbreidda. */
  const HAND_UT = 0.62;
  const HAND_NED = 0.10;
  /* Kor stor handa skal vere PÅ SKJERMEN, i delar av kroppsstorleiken.
     Sjå HAND_LUFT i lag(): sprita har mykje tom plass rundt blekket. */
  const HAND_STORLEIK = 0.30;
  const HAND_TREGHEIT = 0.22;   // 0 = heng heilt etter, 1 = klistra fast

  const FARGAR = ['Green', 'Red', 'Yellow', 'Purple'];

  /**
   * @param scene
   * @param x,y     startpunkt
   * @param opts    { farge:'Green', storleik: px }
   */
  function lag(scene, x, y, opts) {
    opts = opts || {};
    const farge = FARGAR.indexOf(opts.farge) !== -1 ? opts.farge : 'Green';
    /* Mindre enn ei flis: figuren skal kome gjennom opningar han ser ut
       til å kome gjennom, og verda skal kjennast stor. */
    const storleik = opts.storleik || 44;

    const kropp = scene.physics.add.sprite(x, y, 'kenney', 'character_round' + farge);
    kropp.setDisplaySize(storleik, storleik);
    /* Kroppen i KJELDEPIKSLAR, og kjelda er 128 px — retina-utgåva, ikkje
       64. Første utgåve sette 40x46 med offset 12,12 som om sprita var
       64 px stor. Det ga ein kropp som dekte y 12..58, medan figuren sitt
       blekk går ned til y=124: føtene låg 66 px UNDER kollisjonen, og
       figuren såg ut til å synke ned i klossane.

       Målt blekk i character_round*: x 23..104, y 0..124. */
    kropp.body.setSize(76, 118).setOffset(26, 6);
    kropp.setCollideWorldBounds(true);
    kropp.setDepth(20);

    /* HENDENE MÅ KOMPENSERE FOR LUFTA RUNDT DEI.
       character_hand* har berre 32x30 px synleg blekk inne i eit
       128x129-sprite — handa fyller ein fjerdedel av breidda. Set ein
       displaySize direkte, blir den synlege handa ein fjerdedel av det
       ein bad om: 15 px blei til under 4 px, og hendene forsvann. */
    const HAND_LUFT = 128 / 32;
    const handSynleg = storleik * HAND_STORLEIK;
    const hender = [0, 1].map(function () {
      const h = scene.add.image(x, y, 'kenney', 'character_hand' + farge);
      h.setDisplaySize(handSynleg * HAND_LUFT, handSynleg * HAND_LUFT);
      h.setDepth(21);
      return h;
    });

    const s = {
      kropp: kropp,
      hender: hender,
      farge: farge,
      storleik: storleik,
      retning: 1,
      strekk: 1,
      vipp: 0,
      gangfase: 0,
      sistPaaGrunn: -1e9,
      sistHoppTrykt: -1e9,
      trygg: { x: x, y: y },
      /* Sett av scena. Kallast når figuren hoppar og når han landar, så
         lyd og partiklar kan hengjast på utan at denne fila veit om dei. */
      onHopp: null,
      onLanding: null
    };

    /* ──────────────── Rørsle ──────────────── */

    s.oppdater = function (tid, delta, inn) {
      const k = s.kropp;
      const paaBakken = k.body.blocked.down || k.body.touching.down;

      /* Vassrett. Joysticken gjev eit tal mellom -1 og 1, så figuren kan
         gå SEINT om eleven berre vippar litt — det er ikkje mogleg med
         knappar, og det er verdt å ha for dei som vil vere forsiktige. */
      const akse = Math.max(-1, Math.min(1, inn.akse || 0));
      k.setVelocityX(akse * FART);
      if (akse < -0.05) s.retning = -1;
      else if (akse > 0.05) s.retning = 1;

      /* Tilgjeving. Tidsstempel, ikkje akkumulert delta: eit vindauge
         som blir trekt frå kvar ramme krympar og veks med
         bildefrekvensen, og 110 ms på ein iPad som fell til 30 fps er
         ikkje 110 ms lenger. */
      if (paaBakken) {
        if (s.sistPaaGrunn < tid - 60 && s.onLanding) s.onLanding();
        s.sistPaaGrunn = tid;
        s.trygg = { x: k.x, y: k.y };
      }
      if (inn.hoppTrykt) s.sistHoppTrykt = tid;

      if ((tid - s.sistPaaGrunn) <= COYOTE_MS && (tid - s.sistHoppTrykt) <= BUFFER_MS) {
        k.setVelocityY(-HOPPKRAFT);
        s.sistPaaGrunn = -1e9;
        s.sistHoppTrykt = -1e9;
        s.strekk = 1.18;
        if (s.onHopp) s.onHopp();
      }

      /* Slepp knappen tidleg, og hoppet blir lågare. Kontroll utan at
         nokon treng å lære seg noko. */
      if (!inn.hopp && k.body.velocity.y < -200) k.setVelocityY(-200);

      teikn(delta, akse, paaBakken);
    };

    /* ──────────────── Utsjånad ──────────────── */

    function teikn(delta, akse, paaBakken) {
      const k = s.kropp;
      const fart = Math.abs(k.body.velocity.x);
      const d = Math.min(delta, 50) / 16.7;   // normalisert til ei 60fps-ramme

      /* Strekk og squash. Målet er 1 på bakken, litt langstrakt i lufta. */
      const maal = paaBakken ? 1 : 1.08;
      s.strekk += (maal - s.strekk) * 0.16 * d;
      k.setDisplaySize(s.storleik / s.strekk, s.storleik * s.strekk);

      /* Wiggle. Fasen går raskare di fortare han går, og står stille når
         han står stille — så vippet ikkje held fram etter at han stoppa. */
      if (paaBakken && fart > 8) {
        s.gangfase += (0.16 + fart / 2600) * d;
        s.vipp += (Math.sin(s.gangfase * 4) * 0.10 - s.vipp) * 0.3 * d;
      } else {
        s.vipp += (0 - s.vipp) * 0.16 * d;
      }
      k.setRotation(s.vipp + (paaBakken ? 0 : k.body.velocity.x / 6000));
      k.setFlipX(s.retning < 0);

      /* Hendene. Målet ligg ute til sidene; dei glir mot det med
         forsinking, og det er forsinkinga som er heile effekten. */
      const ut = s.storleik * HAND_UT;
      const ned = s.storleik * HAND_NED;
      const svev = paaBakken ? Math.sin(s.gangfase * 4) * 3 : -6;
      hender.forEach(function (h, i) {
        const side = i === 0 ? -1 : 1;
        const mx = k.x + side * ut + s.retning * 3;
        const my = k.y + ned + svev * (i === 0 ? 1 : -1);
        h.x += (mx - h.x) * HAND_TREGHEIT * d;
        h.y += (my - h.y) * HAND_TREGHEIT * d;
        h.setVisible(k.visible);
      });
    }

    /* ──────────────── Ingen død ──────────────── */

    /** Fell figuren under banen, kjem han att på siste faste grunn. */
    s.bergOmFalt = function (grense) {
      if (s.kropp.y <= grense) return false;
      s.kropp.setPosition(s.trygg.x, s.trygg.y - 8);
      s.kropp.setVelocity(0, 0);
      s.hender.forEach(function (h) { h.setPosition(s.trygg.x, s.trygg.y); });
      return true;
    };

    s.riv = function () {
      s.hender.forEach(function (h) { h.destroy(); });
      s.kropp.destroy();
    };

    return s;
  }

  root.JaktaSpelar = {
    lag: lag, FART: FART, HOPPKRAFT: HOPPKRAFT,
    COYOTE_MS: COYOTE_MS, BUFFER_MS: BUFFER_MS, FARGAR: FARGAR
  };
})(window);
