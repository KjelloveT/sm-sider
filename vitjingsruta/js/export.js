/* ══════════════════════════════════════════════
   EXPORT.JS — Ut av nettlesaren

   PNG blir teikna i den storleiken brukaren ber om, ikkje skalert opp
   frå førehandsvisinga. Ein QR-kode består av harde kantar, og ei
   oppskalering gjer dei til grå trapper som skannaren må gjette på.

   Utskrifta går om eit <img> med data-URI framfor å prente lerretet
   direkte. Det er same mønsteret som Ordskodde brukar, og det er det
   som oppfører seg likt i alle nettlesarar.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.exporter = (function () {
  'use strict';

  function filename(base, ext) {
    return VR.util.slug(base, 'vitjingsruta') + '.' + ext;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async function png(scene, pixelWidth, name) {
    const canvas = VR.canvasRender.toCanvas(scene, pixelWidth);
    const blob = await canvasToBlob(canvas);
    if (blob) VR.util.downloadBlob(blob, filename(name, 'png'));
    return blob;
  }

  function svg(scene, pixelWidth, name, title) {
    const text = VR.svgRender.toString(scene, { pixelWidth: pixelWidth, title: title });
    VR.util.downloadBlob(new Blob([text], { type: 'image/svg+xml' }), filename(name, 'svg'));
    return text;
  }

  /**
   * Legg biletet i utklippstavla. Ikkje alle nettlesarar har
   * ClipboardItem, og i dei gjer vi det einaste fornuftige alternativet:
   * lastar ned fila i staden, og seier frå om det.
   */
  async function copy(scene, pixelWidth, name) {
    const canvas = VR.canvasRender.toCanvas(scene, pixelWidth);
    const blob = await canvasToBlob(canvas);
    if (!blob) throw new Error('Klarte ikkje lage biletet.');
    if (!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write)) {
      VR.util.downloadBlob(blob, filename(name, 'png'));
      return 'downloaded';
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return 'copied';
  }

  function print(scene, printImg, caption, captionEl) {
    const canvas = VR.canvasRender.toCanvas(scene, 1400);
    printImg.src = canvas.toDataURL('image/png');
    if (captionEl) captionEl.textContent = caption || '';
    printImg.onload = () => window.print();
  }

  /* ──────────────── Oppsett som fil ──────────────── */

  function toJson(state) {
    return JSON.stringify({
      app: 'vitjingsruta',
      version: 1,
      name: state.name || '',
      content: state.content,
      design: state.design
    }, null, 2);
  }

  function saveJson(state) {
    VR.util.downloadBlob(
      new Blob([toJson(state)], { type: 'application/json' }),
      filename(state.name || 'vitjingsruta-oppsett', 'json')
    );
  }

  /**
   * Les eit oppsett tilbake. Vi krev at «app» stemmer — ei fil frå eit
   * anna Vyrdepil-verktøy ville elles blitt tolka som eit halvtomt
   * oppsett i staden for å bli avvist.
   */
  function parseJson(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw new Error('Fila er ikkje gyldig JSON.');
    }
    if (!data || data.app !== 'vitjingsruta') {
      throw new Error('Dette er ikkje eit oppsett frå Vitjingsruta.');
    }
    return {
      name: typeof data.name === 'string' ? data.name : '',
      content: data.content && data.content.type
        ? { type: data.content.type, values: data.content.values || {} }
        : null,
      design: VR.design.normalise(data.design)
    };
  }

  return { png, svg, copy, print, saveJson, toJson, parseJson, filename };
})();
