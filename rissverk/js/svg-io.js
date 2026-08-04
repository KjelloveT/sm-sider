/* ══════════════════════════════════════════════
   SVG-IO.JS — Teikninga ut som SVG

   Eksporten KLONAR elementa som alt står på skjermen, i staden for å
   byggje ei ny fil frå modellen. Det er eit medvite val: to vegar frå
   same modell til same resultat ville før eller seinare gått frå
   kvarandre, og då ville brukaren fått ei fil som ikkje såg ut som det
   han stod og såg på. Med kloning er dei to per definisjon like.

   Det som blir rydda bort undervegs er berre det som høyrer til
   redigeringa: interne id-ar, og lag brukaren har slått av.

   MERK til seinare: når tekst kjem inn (fase 3), vil ei SVG-fil som
   viser til ein systemfont sjå ulik ut på ei maskin som ikkje har
   fonten. PNG-eksporten har same felle motsett veg — fontar blir ikkje
   med når SVG-en går gjennom <img>. Begge må handterast der, ikkje her.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.svgio = (function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ──────────────── Ut ──────────────── */

  /**
   * Heile teikninga som ein sjølvstendig SVG-streng.
   * @param {object} [opts] { pretty: bool }
   */
  function serialize(opts) {
    const doc = RV.state.data.doc;
    const options = opts || {};

    const root = document.createElementNS(SVG_NS, 'svg');
    RV.util.setAttrs(root, {
      xmlns: SVG_NS,
      width: doc.width,
      height: doc.height,
      viewBox: '0 0 ' + doc.width + ' ' + doc.height
    });

    if (RV.state.data.title) {
      const title = document.createElementNS(SVG_NS, 'title');
      title.textContent = RV.state.data.title;
      root.appendChild(title);
    }

    const defs = document.getElementById('canvasDefs');
    if (defs && defs.childNodes.length) root.appendChild(defs.cloneNode(true));

    // Bakgrunnen er ein eigenskap ved teikneflata, ikkje ei form i
    // modellen. Han må difor leggjast inn her, bakarst.
    if (doc.bg) {
      const bg = document.createElementNS(SVG_NS, 'rect');
      RV.util.setAttrs(bg, { x: 0, y: 0, width: doc.width, height: doc.height, fill: doc.bg });
      root.appendChild(bg);
    }

    const scene = document.getElementById('scene');
    Array.from(scene.childNodes).forEach((child) => {
      const copy = child.cloneNode(true);
      if (clean(copy)) root.appendChild(copy);
    });

    const text = new XMLSerializer().serializeToString(root);
    return options.pretty ? prettify(text) : text;
  }

  /**
   * Ryddar eit klona element.
   * @returns {boolean} sant når elementet skal bli med i fila
   */
  function clean(el) {
    if (el.nodeType !== 1) return false;
    // Skjulte lag høyrer ikkje heime i eit ferdig bilete.
    if (el.getAttribute('display') === 'none') return false;
    // Referansebilete heller ikkje — dei var noko å teikne etter.
    if (el.getAttribute('data-ref')) return false;

    el.removeAttribute('data-id');
    el.removeAttribute('data-ref');
    el.removeAttribute('class');

    Array.from(el.childNodes).forEach((child) => {
      // Tekstinnhaldet inni <tspan> er ikkje eit element, men det er
      // sjølve poenget med noden. Berre ELEMENT blir vurderte for
      // fjerning; alt anna får stå.
      if (child.nodeType !== 1) return;
      if (!clean(child) && child.parentNode) child.parentNode.removeChild(child);
    });
    return true;
  }

  /** Linjeskift og innrykk, så fila er til å lese for eit menneske. */
  function prettify(text) {
    return text
      .replace(/></g, '>\n<')
      .split('\n')
      .reduce((acc, line) => {
        if (/^<\//.test(line)) acc.depth = Math.max(0, acc.depth - 1);
        acc.out.push('  '.repeat(acc.depth) + line);
        if (/^<[^/!?][^>]*[^/]>$/.test(line) && !/^<(rect|circle|ellipse|line|path|polygon|polyline|image|use|stop)\b/.test(line)) {
          acc.depth += 1;
        }
        return acc;
      }, { out: [], depth: 0 }).out.join('\n');
  }

  function toBlob() {
    return new Blob([serialize({ pretty: true })], { type: 'image/svg+xml;charset=utf-8' });
  }

  /** Data-URI av teikninga — inngangen til PNG-eksporten. */
  function toDataUri() {
    // encodeURIComponent + unescape ville brote på teikn utanfor Latin-1.
    // TextEncoder-vegen om base64 toler alt, medrekna æ, ø og å i namn.
    const bytes = new TextEncoder().encode(serialize());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return 'data:image/svg+xml;base64,' + btoa(binary);
  }

  return { serialize, toBlob, toDataUri };
})();
