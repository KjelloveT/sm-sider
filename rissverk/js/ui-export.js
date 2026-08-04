/* ══════════════════════════════════════════════
   UI-EXPORT.JS — Vindauget for å lagre bilete
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.uiExport = (function () {
  'use strict';

  const SCALES = [1, 2, 4];

  let overlayEl, nameEl, scaleFieldEl, scalesEl, sizeNoteEl;
  let scale = 2;

  function attach() {
    overlayEl = document.getElementById('exportOverlay');
    nameEl = document.getElementById('exportName');
    scaleFieldEl = document.getElementById('exportScaleField');
    scalesEl = document.getElementById('exportScales');
    sizeNoteEl = document.getElementById('exportSizeNote');

    RV.util.bindOverlayClose(overlayEl);
    document.getElementById('exportCancelBtn')
      .addEventListener('click', () => RV.util.closeModal(overlayEl));
    document.getElementById('exportGoBtn').addEventListener('click', save);

    document.querySelectorAll('input[name="exportFormat"]').forEach((radio) => {
      radio.addEventListener('change', syncFormat);
    });

    SCALES.forEach((s) => {
      const btn = RV.util.el('button', 'btn rv-preset-btn', s + '×');
      btn.type = 'button';
      btn.dataset.scale = s;
      btn.addEventListener('click', () => { scale = s; syncScales(); });
      scalesEl.appendChild(btn);
    });
  }

  function open() {
    nameEl.value = RV.util.slug(RV.state.data.title, 'teikning');
    syncFormat();
    RV.util.openModal(overlayEl);
  }

  function format() {
    const picked = document.querySelector('input[name="exportFormat"]:checked');
    return picked ? picked.value : 'svg';
  }

  function syncFormat() {
    const png = format() === 'png';
    scaleFieldEl.hidden = !png;
    if (png) syncScales();
  }

  function syncScales() {
    const size = RV.export.pngSize(scale);
    scalesEl.querySelectorAll('.rv-preset-btn').forEach((btn) => {
      const on = Number(btn.dataset.scale) === scale;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.disabled = RV.export.pngSize(Number(btn.dataset.scale)).tooBig;
    });
    sizeNoteEl.textContent = size.w + ' × ' + size.h + ' pikslar';
  }

  function save() {
    const name = RV.util.slug(nameEl.value, 'teikning');

    if (RV.state.isEmpty()) {
      RV.util.toast('Teikninga er tom.');
      return;
    }

    if (format() === 'svg') {
      RV.export.saveSvg(name);
      RV.util.closeModal(overlayEl);
      RV.util.toast('Lagra som SVG.');
      return;
    }

    const btn = document.getElementById('exportGoBtn');
    btn.disabled = true;
    RV.export.savePng(name, scale)
      .then(() => {
        RV.util.closeModal(overlayEl);
        RV.util.toast('Lagra som PNG.');
      })
      .catch((err) => RV.util.toast(err.message || 'Klarte ikkje å lagre biletet.'))
      .then(() => { btn.disabled = false; });
  }

  return { attach, open };
})();
