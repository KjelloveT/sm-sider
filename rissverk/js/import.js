/* ══════════════════════════════════════════════
   IMPORT.JS — Hent inn filer: SVG og referansebilete

   Éin knapp og éin slepp-sone for begge slag. Brukaren skal ikkje måtte
   velje kva slags import han vil gjere før han veit kva fil han har —
   filtypen fortel oss det.

   REFERANSEBILETE er noko anna enn ei form. Det kjem inn LÅST og
   halvgjennomsiktig, og det blir aldri eksportert. Meininga er å teikne
   OPPÅ det: ein skisse på papir, ein logo som skal teiknast på nytt.
   Ville brukaren hatt biletet med i resultatet, ville han ikkje trengt
   eit vektorprogram til det.

   Biletet blir lagra som data-URI. Det gjer prosjektfila større, men
   alternativet — å peike på ei fil på maskina — ville gjeve ei
   prosjektfil som slutta å virke i det brukaren flytta biletet.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.import = (function () {
  'use strict';

  /* Eit referansebilete på fleire megabyte ville sprengt autolagringa
     med ein gong. Vi skalerer difor ned store bilete før dei blir lagra
     — dei skal berre teiknast etter, ikkje trykkjast. */
  const MAX_SIDE = 1600;
  const MAX_BYTES = 8 * 1024 * 1024;

  let stageEl = null;

  /* ──────────────── Oppkopling ──────────────── */

  function attach() {
    stageEl = document.getElementById('stage');

    const input = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', () => input.click());

    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      input.value = '';                       // så same fila kan veljast på nytt
      files.forEach(handleFile);
    });

    // Dra og slepp rett på flata.
    ['dragenter', 'dragover'].forEach((type) => {
      stageEl.addEventListener(type, (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        stageEl.classList.add('rv-stage-drop');
      });
    });

    ['dragleave', 'dragend'].forEach((type) => {
      stageEl.addEventListener(type, () => stageEl.classList.remove('rv-stage-drop'));
    });

    stageEl.addEventListener('drop', (e) => {
      stageEl.classList.remove('rv-stage-drop');
      if (!hasFiles(e)) return;
      e.preventDefault();
      const at = RV.view.toDoc(e.clientX, e.clientY);
      Array.from(e.dataTransfer.files).forEach(file => handleFile(file, at));
    });
  }

  function hasFiles(e) {
    return e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1;
  }

  /* ──────────────── Fordeling ──────────────── */

  function handleFile(file, at) {
    if (!file) return;

    if (file.size > MAX_BYTES) {
      RV.util.toast('Fila er for stor (' + RV.util.formatBytes(file.size) + '). Grensa er 8 MB.');
      return;
    }

    const name = String(file.name || '');

    if (/\.rissverk$/i.test(name)) {
      RV.project.openFile(file).then((error) => {
        if (error) RV.util.toast(error);
        else { RV.view.fit(); RV.state.emit('view'); RV.util.toast('Opna «' + RV.util.baseName(name) + '».'); }
      });
      return;
    }

    if (file.type === 'image/svg+xml' || /\.svg$/i.test(name)) {
      importSvg(file, at);
      return;
    }

    if (/^image\//.test(file.type)) {
      importImage(file, at);
      return;
    }

    RV.util.toast('Rissverk kan hente inn SVG, PNG, JPG og WEBP.');
  }

  /* ──────────────── SVG ──────────────── */

  function importSvg(file, at) {
    file.text().then((text) => {
      RV.state.pushUndo();
      const result = RV.svgImport.parse(text, { name: RV.util.baseName(file.name), at: at });

      if (result.error) {
        RV.state.undo();                      // ta bort det tomme angre-steget
        RV.util.toast(result.error);
        return;
      }

      RV.hit.invalidate();
      RV.state.emit('nodes');
      RV.state.emit('selection');
      RV.util.toast('Henta inn ' + result.nodes +
        (result.nodes === 1 ? ' form frå SVG-en.' : ' former frå SVG-en.'));
    }).catch(() => RV.util.toast('Klarte ikkje å lese fila.'));
  }

  /* ──────────────── Referansebilete ──────────────── */

  function importImage(file, at) {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        const shrunk = shrink(img);
        RV.state.pushUndo();

        const doc = RV.state.data.doc;
        // Legg biletet så det fyller flata utan å gå utanfor henne.
        const scale = Math.min(doc.width / shrunk.w, doc.height / shrunk.h, 1);
        const w = shrunk.w * scale;
        const h = shrunk.h * scale;
        const pos = at
          ? { x: at.x - w / 2, y: at.y - h / 2 }
          : { x: (doc.width - w) / 2, y: (doc.height - h) / 2 };

        const node = RV.state.makeNode('image', {
          x: pos.x, y: pos.y, w: w, h: h, href: shrunk.href
        });
        node.name = RV.util.baseName(file.name);
        node.fill = { type: 'none' };
        node.stroke = { type: 'none' };
        // Låst og nedtona frå start: dette er noko å teikne ETTER, ikkje
        // noko å dra rundt på ved eit uhell.
        node.opacity = 0.5;
        node.locked = true;
        node.reference = true;

        // Bakarst, så alt anna blir teikna oppå.
        RV.state.add(node, null, 0);
        RV.hit.invalidate();
        RV.state.emit('nodes');
        RV.util.toast('Referansebiletet er lagt inn låst og nedtona. Lås det opp i lagpanelet om du vil flytte det.');
      };

      img.onerror = () => RV.util.toast('Klarte ikkje å lese biletet.');
      img.src = reader.result;
    };

    reader.onerror = () => RV.util.toast('Klarte ikkje å lese fila.');
    reader.readAsDataURL(file);
  }

  /** Skalerer ned store bilete, så autolagringa ikkje sprengjer. */
  function shrink(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w <= MAX_SIDE && h <= MAX_SIDE) return { w: w, h: h, href: img.src };

    const scale = MAX_SIDE / Math.max(w, h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    // JPEG på eit referansebilete: gjennomsikt spelar inga rolle når
    // biletet berre skal ligge under og bli teikna etter.
    return { w: canvas.width, h: canvas.height, href: canvas.toDataURL('image/jpeg', 0.82) };
  }

  return { attach, handleFile };
})();
