/* ══════════════════════════════════════════════
   UI-PROJECT.JS — Knappar for prosjektfil og dokumentoppsett
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.uiProject = (function () {
  'use strict';

  const PRESETS = [
    { w: 512, h: 512, label: 'Ikon 512' },
    { w: 1024, h: 1024, label: 'Logo 1024' },
    { w: 1920, h: 1080, label: 'Skjerm 16:9' },
    { w: 1123, h: 794, label: 'A4 liggjande' },
    { w: 794, h: 1123, label: 'A4 ståande' }
  ];

  let docOverlay, widthEl, heightEl, transparentEl, bgFieldEl, bgSwatchEl;
  let bgColor = '#ffffff';

  function attach() {
    docOverlay = document.getElementById('docOverlay');
    widthEl = document.getElementById('docWidth');
    heightEl = document.getElementById('docHeight');
    transparentEl = document.getElementById('docTransparent');
    bgFieldEl = document.getElementById('docBgField');
    bgSwatchEl = document.getElementById('docBgSwatch');

    RV.util.bindOverlayClose(docOverlay);
    document.getElementById('docCancelBtn')
      .addEventListener('click', () => RV.util.closeModal(docOverlay));
    document.getElementById('docSaveBtn').addEventListener('click', applyDoc);

    transparentEl.addEventListener('change', syncBg);
    bgSwatchEl.addEventListener('click', () => {
      RV.color.open(bgSwatchEl, { color: bgColor, opacity: 1 }, (hex) => {
        bgColor = hex;
        bgSwatchEl.style.background = hex;
      });
    });

    const presetRow = document.getElementById('docPresets');
    PRESETS.forEach((p) => {
      const btn = RV.util.el('button', 'btn rv-preset-btn', p.label);
      btn.type = 'button';
      btn.title = p.w + ' × ' + p.h + ' px';
      btn.addEventListener('click', () => {
        widthEl.value = p.w;
        heightEl.value = p.h;
      });
      presetRow.appendChild(btn);
    });

    /* ---- Prosjektfil ---- */
    document.getElementById('saveProjectBtn').addEventListener('click', () => {
      if (RV.state.isEmpty()) { RV.util.toast('Teikninga er tom.'); return; }
      RV.project.save(RV.state.data.title || 'teikning');
      RV.util.toast('Prosjektfila er lagra.');
    });

    const fileInput = document.getElementById('openProjectFile');
    document.getElementById('openProjectBtn').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      // Nullstill med ein gong, elles blir ikkje same fila lesen to gonger.
      fileInput.value = '';
      if (!file) return;

      RV.project.openFile(file).then((error) => {
        if (error) { RV.util.toast(error); return; }
        RV.view.fit();
        RV.state.emit('view');
        RV.util.toast('Opna «' + RV.util.baseName(file.name) + '».');
      });
    });

    /* ---- Dokumentstorleik ---- */
    document.getElementById('docBtn').addEventListener('click', open);
  }

  function open() {
    const doc = RV.state.data.doc;
    widthEl.value = doc.width;
    heightEl.value = doc.height;
    transparentEl.checked = !doc.bg;
    bgColor = doc.bg || '#ffffff';
    bgSwatchEl.style.background = bgColor;
    syncBg();
    RV.util.openModal(docOverlay);
  }

  function syncBg() {
    bgFieldEl.hidden = transparentEl.checked;
  }

  function applyDoc() {
    RV.state.pushUndo();
    RV.state.setDoc(
      RV.util.parseNum(widthEl.value, 512),
      RV.util.parseNum(heightEl.value, 512),
      transparentEl.checked ? null : bgColor
    );
    RV.util.closeModal(docOverlay);
    RV.view.fit();
    RV.state.emit('doc');
    RV.state.emit('view');
  }

  return { attach, open };
})();
