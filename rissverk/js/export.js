/* ══════════════════════════════════════════════
   EXPORT.JS — SVG og PNG ut av programmet

   PNG-vegen går om <img> og eit lerret. Det er den einaste måten å
   rasterisere SVG i nettlesaren utan eit bibliotek, men han har to
   feller som må kjennast:

     1. Biletet må vere ei DATA-URI, ikkje ein blob-URL. Ei blob-URL
        gjer lerretet «tainted» i somme nettlesarar, og då nektar
        toBlob() å gje frå seg noko som helst.
     2. Ingenting som SVG-en viser UTOVER seg sjølv blir med — ingen
        eksterne bilete, og ingen fontar som ikkje er innebygde. Difor
        må alt vere sjølvstendig i fila før vi kjem hit.

   Gjennomsikt: lerretet startar tomt, så teikningar utan bakgrunn får
   ekte gjennomsikt i PNG-en. Bakgrunnsfargen, om han finst, ligg alt i
   SVG-en som eit rektangel.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.export = (function () {
  'use strict';

  /* Lerret over ~16 000 px på ei side blir avvist av nettlesaren, og
     resultatet er eit tomt bilete utan feilmelding. Vi stoppar før det. */
  const MAX_SIDE = 12000;

  /* ──────────────── SVG ──────────────── */

  function saveSvg(filename) {
    RV.util.downloadBlob(RV.svgio.toBlob(), filename + '.svg');
  }

  /* ──────────────── PNG ──────────────── */

  /**
   * @param {number} scale 1, 2 eller 4
   * @returns {Promise<Blob>}
   */
  function renderPng(scale) {
    const doc = RV.state.data.doc;
    const w = Math.round(doc.width * scale);
    const h = Math.round(doc.height * scale);

    if (w > MAX_SIDE || h > MAX_SIDE) {
      return Promise.reject(new Error(
        'Biletet blir for stort (' + w + '×' + h + ' px). Vel ein mindre storleik.'));
    }

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Nettlesaren klarte ikkje å lage biletet.'));
        }, 'image/png');
      };

      img.onerror = () => reject(new Error('Klarte ikkje å teikne SVG-en som bilete.'));
      img.src = RV.svgio.toDataUri();
    });
  }

  function savePng(filename, scale) {
    return renderPng(scale).then(blob => {
      RV.util.downloadBlob(blob, filename + (scale === 1 ? '' : '@' + scale + 'x') + '.png');
      return blob;
    });
  }

  /** Kor stort PNG-et blir — vist i eksportvindauget før ein trykkjer. */
  function pngSize(scale) {
    const doc = RV.state.data.doc;
    return {
      w: Math.round(doc.width * scale),
      h: Math.round(doc.height * scale),
      tooBig: doc.width * scale > MAX_SIDE || doc.height * scale > MAX_SIDE
    };
  }

  return { saveSvg, savePng, renderPng, pngSize, MAX_SIDE };
})();
