/* ══════════════════════════════════════════════
   BATCH.JS — Mange kodar på ein gong

   Bruksmønsteret som gjorde dette verdt å byggje: stasjonsark. Ein lærar
   har åtte stasjonar med kvar si lenkje, og skal ha åtte kodar med
   etikett under, på eitt ark, i same stil.

   Kvar linje er ein kode. Står det ei loddrett strek i linja, er det
   som står før streken etiketten og det som står etter innhaldet.

   ZIP-en er for dei som skal bruke kodane kvar for seg. Arket er for dei
   som skal henge dei på veggen — og det er dei fleste.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.batch = (function () {
  'use strict';

  const MAX_ROWS = 60;

  /**
   * «Stasjon 1 | vyrdepil.no/ordkryss» → { label, value }
   * Ei linje utan strek blir sin eigen etikett.
   */
  function parse(text, type) {
    const rows = [];
    String(text || '').split(/\r?\n/).forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      const at = line.indexOf('|');
      const label = at >= 0 ? line.slice(0, at).trim() : line;
      const value = at >= 0 ? line.slice(at + 1).trim() : line;
      if (!value) return;
      rows.push({ label: label, value: value, type: type });
    });
    return rows.slice(0, MAX_ROWS);
  }

  /* Innhaldet i ei linje går gjennom den same typen som resten av
     verktøyet, så ei lenkje utan protokoll får han her òg. */
  function contentFor(row) {
    const type = VR.content.byId(row.type);
    const first = type.fields[0];
    const values = {};
    values[first.name] = row.value;
    if (row.type === 'wifi') values.security = 'WPA';
    return { type: row.type, values: values };
  }

  function sceneFor(row, design, logo) {
    const text = VR.content.build(contentFor(row));
    if (!text) return null;
    const ecc = design.ecc === 'auto'
      ? VR.qr.autoEcc(text, { hasLogo: !!logo, minVersion: design.minVersion })
      : design.ecc;
    const qr = VR.qr.build(text, { ecc: ecc, minVersion: design.minVersion });
    if (!qr) return null;
    return VR.render.buildScene(qr, design, logo);
  }

  /**
   * Bygg alle kodane. Rapporterer kva som ikkje let seg lage i staden for
   * å hoppe stille over det — ei tom rute på eit ark er verre enn ei
   * melding om kvifor ho er tom.
   */
  function buildAll(rows, design, logo) {
    const ok = [], failed = [];
    rows.forEach((row) => {
      const scene = sceneFor(row, design, logo);
      if (scene) ok.push({ row: row, scene: scene });
      else failed.push(row);
    });
    return { ok: ok, failed: failed };
  }

  /* ──────────────── ZIP ──────────────── */

  function toBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  async function zip(built, opts) {
    if (typeof JSZip === 'undefined') throw new Error('ZIP-biblioteket er ikkje lasta.');
    const o = opts || {};
    const px = o.pixelWidth || 1024;
    const archive = new JSZip();
    const used = {};

    for (let i = 0; i < built.length; i++) {
      const item = built[i];
      let name = VR.util.slug(item.row.label, 'kode-' + (i + 1));
      /* To stasjonar kan heite det same. Filnamn kan ikkje. */
      if (used[name]) { used[name]++; name = name + '-' + used[name]; }
      else used[name] = 1;

      if (o.format === 'svg') {
        archive.file(name + '.svg', VR.svgRender.toString(item.scene, { pixelWidth: px }));
      } else {
        const blob = await toBlob(VR.canvasRender.toCanvas(item.scene, px));
        archive.file(name + '.png', blob);
      }
    }

    const out = await archive.generateAsync({ type: 'blob' });
    VR.util.downloadBlob(out, VR.util.slug(o.name, 'qr-kodar') + '.zip');
  }

  /* ──────────────── Kodearket ──────────────── */

  /**
   * Byggjer arket som DOM i ein skjult container. Utskrifta går gjennom
   * nettlesaren sin eigen sideskift-handtering, som er langt betre til
   * dette enn noko vi kunne rekna ut sjølve.
   */
  function sheet(built, container, columns) {
    VR.util.clear(container);
    const cols = VR.util.clamp(parseInt(columns, 10) || 3, 1, 5);
    container.style.setProperty('--vr-sheet-cols', cols);

    built.forEach((item) => {
      const cell = VR.util.el('figure', 'vr-sheet-cell');
      const img = new Image();
      img.alt = item.row.label;
      img.src = VR.canvasRender.toCanvas(item.scene, 700).toDataURL('image/png');
      cell.appendChild(img);
      const cap = VR.util.el('figcaption', 'vr-sheet-caption', item.row.label);
      cell.appendChild(cap);
      container.appendChild(cell);
    });
    return built.length;
  }

  return { parse, contentFor, buildAll, zip, sheet, MAX_ROWS };
})();
