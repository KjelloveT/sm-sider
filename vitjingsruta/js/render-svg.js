/* ══════════════════════════════════════════════
   RENDER-SVG.JS — Same scene, skriven som SVG

   SVG-en er den viktige eksporten. Ein QR-kode som skal på ein plakat
   eller eit klasseromsark blir skalert opp, og då er skilnaden mellom
   vektor og piksel skilnaden mellom skarpe kantar og grøt.

   Fila er sjølvberande: fargar, ramme, tekst og logo ligg inni henne.
   Ingen eksterne referansar, så ho opnar seg likt overalt.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.svgRender = (function () {
  'use strict';

  const esc = VR.util.escapeXml;
  const n = VR.util.n;

  function paintAttr(value) {
    if (typeof value === 'string' && value.indexOf('url:') === 0) {
      return 'url(#' + esc(value.slice(4)) + ')';
    }
    return esc(value);
  }

  function defsMarkup(scene) {
    if (!scene.defs.length) return '';
    const parts = scene.defs.map((def) => {
      const stops =
        '<stop offset="0" stop-color="' + esc(def.from) + '"/>' +
        '<stop offset="1" stop-color="' + esc(def.to) + '"/>';
      if (def.type === 'linear') {
        return '<linearGradient id="' + esc(def.id) + '" gradientUnits="userSpaceOnUse" ' +
          'x1="' + n(def.x1) + '" y1="' + n(def.y1) + '" x2="' + n(def.x2) + '" y2="' + n(def.y2) + '">' +
          stops + '</linearGradient>';
      }
      return '<radialGradient id="' + esc(def.id) + '" gradientUnits="userSpaceOnUse" ' +
        'cx="' + n(def.cx) + '" cy="' + n(def.cy) + '" r="' + n(def.r) + '">' +
        stops + '</radialGradient>';
    });
    return '<defs>' + parts.join('') + '</defs>';
  }

  function itemMarkup(item) {
    switch (item.type) {
      case 'path': {
        if (!item.d) return '';
        const rule = item.rule === 'evenodd' ? ' fill-rule="evenodd"' : '';
        return '<path d="' + item.d + '" fill="' + paintAttr(item.fill) + '"' + rule + '/>';
      }
      case 'image':
        if (!item.href) return '';
        return '<image href="' + esc(item.href) + '" x="' + n(item.x) + '" y="' + n(item.y) +
          '" width="' + n(item.w) + '" height="' + n(item.h) +
          '" preserveAspectRatio="none"/>';
      case 'icon': {
        const k = item.size / 24;
        return '<g transform="translate(' + n(item.x) + ' ' + n(item.y) + ') scale(' + n(k) + ')" ' +
          'fill="none" stroke="' + esc(item.stroke) + '" stroke-width="' + n(item.weight) + '" ' +
          'stroke-linecap="round" stroke-linejoin="round">' + item.markup + '</g>';
      }
      case 'text':
        /* textLength held breidda lik den canvas målte, så PNG og SVG
           bryt ikkje frå kvarandre om mottakaren manglar same fonten. */
        return '<text x="' + n(item.x) + '" y="' + n(item.y) + '" fill="' + esc(item.fill) + '" ' +
          'font-family="' + esc(VR.render.FONT_STACK) + '" font-size="' + n(item.size) + '" ' +
          'font-weight="800" text-anchor="middle" dominant-baseline="central" ' +
          'textLength="' + n(item.width) + '" lengthAdjust="spacingAndGlyphs">' +
          esc(item.text) + '</text>';
      default:
        return '';
    }
  }

  /**
   * @param {object} scene
   * @param {{pixelWidth?: number, title?: string}} opts
   */
  function toString(scene, opts) {
    const o = opts || {};
    const px = o.pixelWidth || 1024;
    const h = Math.round(px * scene.h / scene.w);

    const bg = scene.bg
      ? '<rect x="0" y="0" width="' + n(scene.w) + '" height="' + n(scene.h) +
        '" fill="' + esc(scene.bg) + '"/>'
      : '';

    const title = o.title
      ? '<title>' + esc(o.title) + '</title>'
      : '';

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      'width="' + px + '" height="' + h + '" ' +
      'viewBox="0 0 ' + n(scene.w) + ' ' + n(scene.h) + '" ' +
      'shape-rendering="geometricPrecision" role="img">' +
      title + defsMarkup(scene) + bg +
      scene.items.map(itemMarkup).join('') +
      '</svg>\n';
  }

  return { toString: toString };
})();
