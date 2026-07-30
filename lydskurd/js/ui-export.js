/* ══════════════════════════════════════════════
   UI-EXPORT.JS — Dialogen for å lagre miksen som lydfil
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.uiExport = (function () {
  'use strict';

  let overlay = null;
  let nameInput = null;
  let bitrateField = null;
  let bitrateSelect = null;
  let infoLine = null;
  let progressWrap = null;
  let progressFill = null;
  let progressLabel = null;
  let startBtn = null;
  let cancelBtn = null;
  let mp3Radio = null;
  let busy = false;

  function format() {
    const picked = overlay.querySelector('input[name="exportFormat"]:checked');
    return picked ? picked.value : 'wav';
  }

  function kbps() {
    return parseInt(bitrateSelect.value, 10) || 192;
  }

  /* ──────────────── Dialogen ──────────────── */

  function syncInfo() {
    const fmt = format();
    bitrateField.hidden = fmt !== 'mp3';

    const seconds = LS.state.duration();
    const bytes = LS.export.estimate(fmt, kbps());
    infoLine.textContent = 'Lengd ' + LS.util.formatTime(seconds, 1)
      + ' · om lag ' + LS.util.formatBytes(bytes)
      + (fmt === 'wav' ? ' · 16-bits WAV, ukomprimert' : ' · MP3, ' + kbps() + ' kbit/s');
  }

  function setProgress(fraction, text) {
    progressWrap.hidden = false;
    progressFill.style.width = Math.round(LS.util.clamp(fraction, 0, 1) * 100) + '%';
    progressLabel.textContent = text;
  }

  function setBusy(on) {
    busy = on;
    startBtn.disabled = on;
    cancelBtn.disabled = on;
    nameInput.disabled = on;
    bitrateSelect.disabled = on;
    overlay.querySelectorAll('input[name="exportFormat"]').forEach(r => { r.disabled = on; });
  }

  function open() {
    if (!LS.state.data.clips.length) {
      LS.util.toast('Hent inn lyd før du eksporterer.');
      return;
    }
    if (!nameInput.value.trim()) {
      nameInput.value = LS.state.data.title || 'lydskurd-miks';
    }
    progressWrap.hidden = true;
    setBusy(false);
    syncInfo();
    LS.util.openModal(overlay);
  }

  function close() {
    if (busy) return;      // ikkje lat brukaren gå medan enkodaren jobbar
    LS.util.closeModal(overlay);
  }

  /* ──────────────── Sjølve eksporten ──────────────── */

  function run() {
    const fmt = format();
    const rate = kbps();
    const base = LS.util.slug(nameInput.value, 'lydskurd-miks');

    setBusy(true);
    setProgress(0.05, 'Miksar ned …');

    /* Ei kort pause, så nettlesaren får teikna framdriftsvisinga før
       rendringa legg beslag på hovudtråden. */
    setTimeout(() => {
      LS.export.renderMix().then((rendered) => {
        if (fmt === 'wav') {
          setProgress(0.85, 'Skriv WAV-fila …');
          const blob = LS.export.encodeWav(rendered);
          finish(blob, base + '.wav');
          return null;
        }
        setProgress(0.35, 'Enkodar MP3 …');
        return LS.export.encodeMp3(rendered, rate, (done) => {
          setProgress(0.35 + done * 0.6, 'Enkodar MP3 … ' + Math.round(done * 100) + '%');
        }).then((blob) => finish(blob, base + '.mp3'));
      }).catch((err) => {
        setBusy(false);
        progressWrap.hidden = true;
        LS.util.toast(err.message || 'Klarte ikkje eksportere lyden.');
      });
    }, 60);
  }

  function finish(blob, filename) {
    setProgress(1, 'Ferdig — ' + LS.util.formatBytes(blob.size));
    LS.util.downloadBlob(blob, filename);
    setBusy(false);
    LS.util.toast('Lagra ' + filename + ' (' + LS.util.formatBytes(blob.size) + ').');
    setTimeout(() => { if (!busy) LS.util.closeModal(overlay); }, 900);
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup() {
    overlay = document.getElementById('exportOverlay');
    nameInput = document.getElementById('exportName');
    bitrateField = document.getElementById('exportBitrateField');
    bitrateSelect = document.getElementById('exportBitrate');
    infoLine = document.getElementById('exportInfo');
    progressWrap = document.getElementById('exportProgress');
    progressFill = document.getElementById('exportProgressFill');
    progressLabel = document.getElementById('exportProgressLabel');
    startBtn = document.getElementById('exportStart');
    cancelBtn = document.getElementById('exportCancel');
    mp3Radio = document.getElementById('exportFormatMp3');

    // Manglar enkodaren, skal MP3 ikkje kunne veljast i det heile.
    if (!LS.export.hasMp3()) {
      mp3Radio.disabled = true;
      mp3Radio.closest('.ls-radio-row').classList.add('ls-radio-off');
      document.getElementById('exportMp3Note').hidden = false;
    }

    document.getElementById('exportBtn').addEventListener('click', open);
    document.getElementById('exportClose').addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    startBtn.addEventListener('click', run);

    overlay.querySelectorAll('input[name="exportFormat"]').forEach(r => {
      r.addEventListener('change', syncInfo);
    });
    bitrateSelect.addEventListener('change', syncInfo);
    LS.util.bindOverlayClose(overlay);
  }

  return { setup, open };
})();
