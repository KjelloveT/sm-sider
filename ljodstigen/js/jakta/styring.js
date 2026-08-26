/* ══════════════════════════════════════════════
   STYRING.JS — Kontrollane i Bokstavjakta

   Spelet blir mest brukt på iPad, så trykk er hovudvegen og tastatur er
   for PC og testing.

   TRE SONER, INGEN MINDRE ENN EIN TREDJEDEL AV BREIDDA:

     ┌─────────────────────────────────────────┐
     │              spelflate                  │
     ├───────────┬───────────┬─────────────────┤
     │     ←     │     →     │      HOPP       │
     └───────────┴───────────┴─────────────────┘

   Ein virtuell d-pad ville vore meir kjent, men han er feil for
   målgruppa: knappane blir små, og tommelen driv av utan at eit barn
   merkar det. Her kan fingeren gli fritt inne i sona.

   VI LYTTAR PÅ HEILE VINDAUGET, ikkje på kvar sone for seg. Sklir
   fingeren frå «venstre» til «høgre» utan å sleppe, skal figuren snu —
   det gjer han berre om éin lyttar følgjer peikaren heile vegen. Med ein
   lyttar per sone ville trykket blitt hengande i den første sona.

   FLEIRE FINGRAR SAMSTUNDES. Å gå og hoppe på same tid er ikkje ein
   spesialmanøver, det er det ein gjer heile tida. Kvar peikar blir spora
   for seg.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Kor stor del av høgda nedanfrå som er kontrollsone. Resten er
     spelflate og tek ikkje imot styringstrykk. */
  const SONE_HOGD = 0.34;

  function lag(scene, opts) {
    opts = opts || {};
    const el = opts.element || scene.game.canvas;

    /* Kva som er trykt akkurat no. Ikkje kva som blei trykt sist. */
    const state = { venstre: false, hogre: false, hopp: false, hoppNy: false };
    const peikarar = {};          // pointerId -> 'venstre' | 'hogre' | 'hopp'

    function sone(x, y, rect) {
      const relY = (y - rect.top) / rect.height;
      if (relY < 1 - SONE_HOGD) return null;      // over kontrollsona
      const relX = (x - rect.left) / rect.width;
      if (relX < 1 / 3) return 'venstre';
      if (relX < 2 / 3) return 'hogre';
      return 'hopp';
    }

    function oppdater() {
      const v = Object.keys(peikarar).map(function (k) { return peikarar[k]; });
      state.venstre = v.indexOf('venstre') !== -1;
      state.hogre = v.indexOf('hogre') !== -1;
      const hopp = v.indexOf('hopp') !== -1;
      /* Hoppet skal utløysast av at knappen blir TRYKT, ikkje av at han
         er nede: elles hoppar figuren igjen med ein gong han landar,
         berre fordi fingeren aldri blei løfta. */
      if (hopp && !state.hopp) state.hoppNy = true;
      state.hopp = hopp;
    }

    function ned(e) {
      const r = el.getBoundingClientRect();
      const s = sone(e.clientX, e.clientY, r);
      if (!s) return;
      peikarar[e.pointerId] = s;
      oppdater();
      /* Hindrar at iPad tolkar trykket som scroll eller dobbelttrykk-zoom. */
      if (e.cancelable) e.preventDefault();
    }

    function flytt(e) {
      if (!(e.pointerId in peikarar)) return;
      const r = el.getBoundingClientRect();
      const s = sone(e.clientX, e.clientY, r);
      if (s) peikarar[e.pointerId] = s;
      else delete peikarar[e.pointerId];   // dregen opp i spelflata: slepp
      oppdater();
    }

    function opp(e) {
      delete peikarar[e.pointerId];
      oppdater();
    }

    const maal = root;   // heile vindauget, sjå kommentaren øvst
    maal.addEventListener('pointerdown', ned, { passive: false });
    maal.addEventListener('pointermove', flytt, { passive: true });
    maal.addEventListener('pointerup', opp, { passive: true });
    maal.addEventListener('pointercancel', opp, { passive: true });
    /* Dreg fingeren ut av vindauget, skal figuren stoppe. Utan denne
       blir han ståande og gå til eleven trykkjer ein annan stad. */
    maal.addEventListener('pointerleave', opp, { passive: true });

    /* Tastatur for PC og for testing. */
    const piler = scene.input.keyboard.createCursorKeys();
    const romtast = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE);

    let taastHoppFor = false;

    function les() {
      const kbVenstre = piler.left.isDown;
      const kbHogre = piler.right.isDown;
      const kbHopp = piler.up.isDown || romtast.isDown;
      const kbHoppNy = kbHopp && !taastHoppFor;
      taastHoppFor = kbHopp;

      const ut = {
        venstre: state.venstre || kbVenstre,
        hogre: state.hogre || kbHogre,
        hopp: state.hopp || kbHopp,
        hoppTrykt: state.hoppNy || kbHoppNy
      };
      state.hoppNy = false;      // eit trykk blir lese éin gong
      return ut;
    }

    function riv() {
      maal.removeEventListener('pointerdown', ned);
      maal.removeEventListener('pointermove', flytt);
      maal.removeEventListener('pointerup', opp);
      maal.removeEventListener('pointercancel', opp);
      maal.removeEventListener('pointerleave', opp);
    }

    return { les: les, riv: riv, SONE_HOGD: SONE_HOGD, _state: state };
  }

  root.JaktaStyring = { lag: lag, SONE_HOGD: SONE_HOGD };
})(window);
