/* ══════════════════════════════════════════════
   QR.JS — Innpakking rundt qrcode-generator

   Biblioteket i _libs/qrcode-arase/ gjer tekst om til ei matrise av
   modular og kan teikne henne som svarte firkantar. Vi vil ha noko meir:
   for å gje augene si eiga form må vi vite KVA kvar modul er, ikkje berre
   om han er mørk. Difor legg denne fila ei sone-klassifisering oppå.

   Justeringsmønstera står ikkje i noko API vi kan nå, så tabellen med
   posisjonar ligg her. Han er ein del av standarden og endrar seg ikkje.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.qr = (function () {
  'use strict';

  const LEVELS = ['L', 'M', 'Q', 'H'];

  /* Største datamengd i byte-modus, versjon 40. Grensa vi faktisk møter
     er som regel lågare, men dette er taket — det er det teljaren viser. */
  const MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 };

  /* Sentrum for justeringsmønstera, versjon 1–40 (indeks 0 = versjon 1). */
  const ALIGN = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
    [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
    [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86],
    [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
    [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
  ];

  function maxBytes(ecc) { return MAX_BYTES[ecc] || MAX_BYTES.H; }

  /* Alle sentrum-par unntatt dei tre som ville lagt seg oppå eit auge. */
  function alignCentres(version, size) {
    const row = ALIGN[version - 1] || [];
    const out = [];
    for (let i = 0; i < row.length; i++) {
      for (let j = 0; j < row.length; j++) {
        const r = row[i], c = row[j];
        const nearTopLeft = r <= 8 && c <= 8;
        const nearTopRight = r <= 8 && c >= size - 9;
        const nearBottomLeft = r >= size - 9 && c <= 8;
        if (nearTopLeft || nearTopRight || nearBottomLeft) continue;
        out.push([r, c]);
      }
    }
    return out;
  }

  /**
   * Byggjer ein kode.
   * @param {string} text
   * @param {{ecc?: string, minVersion?: number}} opts
   * @returns {object|null} null når teksten ikkje får plass
   */
  function build(text, opts) {
    const o = opts || {};
    const ecc = LEVELS.indexOf(o.ecc) >= 0 ? o.ecc : 'M';
    const minVersion = VR.util.clamp(parseInt(o.minVersion, 10) || 0, 0, 40);

    let raw = null;
    try {
      raw = qrcode(minVersion, ecc);
      raw.addData(String(text), 'Byte');
      raw.make();
    } catch (err) {
      /* Biblioteket kastar når innhaldet ikkje får plass i versjon 40 —
         eller når det ikkje får plass i den versjonen vi har låst til. */
      return null;
    }

    const size = raw.getModuleCount();
    const version = (size - 17) / 4;

    /* Vi les ut heile matrisa éin gong. isDark() er eit funksjonskall per
       oppslag, og teiknaren spør om kvar modul mange gonger — ein gong for
       forma si eiga skuld og fleire gonger som nabo. */
    const dark = new Uint8Array(size * size);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (raw.isDark(r, c)) dark[r * size + c] = 1;
      }
    }

    const centres = alignCentres(version, size);

    function inBox(r, c, top, left, side) {
      return r >= top && r < top + side && c >= left && c < left + side;
    }

    /* Kva slag modul er dette? Rekkjefølgja er viktig: augene og
       skiljesona blir sjekka før justering og timing, fordi dei overlappar. */
    function zone(r, c) {
      if (r < 0 || c < 0 || r >= size || c >= size) return 'quiet';

      const eye =
        inBox(r, c, 0, 0, 7) ? 'tl' :
        inBox(r, c, 0, size - 7, 7) ? 'tr' :
        inBox(r, c, size - 7, 0, 7) ? 'bl' : null;
      if (eye) return 'finder';

      const sep =
        (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
      if (sep) return 'separator';

      for (let i = 0; i < centres.length; i++) {
        if (inBox(r, c, centres[i][0] - 2, centres[i][1] - 2, 5)) return 'alignment';
      }

      if (r === 6 || c === 6) return 'timing';
      return 'data';
    }

    return {
      size: size,
      version: version,
      ecc: ecc,
      text: String(text),
      bytes: VR.util.byteLength(text),
      alignCentres: centres,
      isDark: (r, c) =>
        r >= 0 && c >= 0 && r < size && c < size && dark[r * size + c] === 1,
      zone: zone,
      /* Augekvadrata er 7×7 med hjørnet sitt her. */
      eyes: [
        { id: 'tl', row: 0, col: 0 },
        { id: 'tr', row: 0, col: size - 7 },
        { id: 'bl', row: size - 7, col: 0 }
      ]
    };
  }

  /**
   * Vel feilrettingsnivå automatisk: høgast mogleg som framleis rommar
   * innhaldet. Ligg det ein logo oppå, må vi ha luft å ta av — då er H
   * ikkje pynt, det er det som gjer koden lesbar i det heile.
   */
  function autoEcc(text, opts) {
    const o = opts || {};
    const floorIndex = o.hasLogo ? 2 : 0;   // logo ⇒ minst Q
    for (let i = LEVELS.length - 1; i >= floorIndex; i--) {
      if (build(text, { ecc: LEVELS[i], minVersion: o.minVersion })) return LEVELS[i];
    }
    return LEVELS[floorIndex] || 'L';
  }

  return { LEVELS, build, autoEcc, maxBytes };
})();
