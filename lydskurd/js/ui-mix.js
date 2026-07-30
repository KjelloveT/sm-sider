/* ══════════════════════════════════════════════
   UI-MIX.JS — Masterbussen: volum, nivåmålar og normalisering

   Nivåmålaren les frå ein AnalyserNode på masteren, altså heilt sist i
   kjeda — det er nøyaktig det signalet som ville hamna i ei eksportert
   fil. Går han over 1,0, klipper miksen, og då blir varselet ståande
   heilt til brukaren har gjort noko med det.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.uiMix = (function () {
  'use strict';

  /* -1 dBFS. Vi normaliserer ikkje heilt opp til 0, av di mp3-koding kan
     skubbe enkelte toppar litt over og då ville dei klippe likevel. */
  const TARGET = Math.pow(10, -1 / 20);

  let masterSlider = null;
  let masterValue = null;
  let normalizeBtn = null;
  let meterFill = null;
  let meterLabel = null;
  let clipWarn = null;

  let clipped = false;
  let holdPeak = 0;
  let holdUntil = 0;

  /* ──────────────── Nivåmålaren ──────────────── */

  function dbText(peak) {
    if (peak <= 0.00001) return '−∞ dB';
    const db = 20 * Math.log10(peak);
    return (db >= 0 ? '+' : '−') + Math.abs(db).toFixed(1).replace('.', ',') + ' dB';
  }

  /** Kallast frå avspelingsløkka i ui-toolbar.js. */
  function updateMeter() {
    const peak = LS.audio.currentPeak();
    const now = Date.now();

    // Toppen står att eit lite blunk, så auget rekk å sjå henne.
    if (peak >= holdPeak || now > holdUntil) {
      holdPeak = peak;
      holdUntil = now + 900;
    }

    if (peak > 1.0) setClipped(true);
    paintMeter(holdPeak);
  }

  function paintMeter(peak) {
    if (!meterFill) return;
    // Skalaen er i dB frå −48 til +6, som er lettare å lese enn lineært.
    const db = peak <= 0.00001 ? -48 : 20 * Math.log10(peak);
    const pct = LS.util.clamp((db + 48) / 54, 0, 1) * 100;
    meterFill.style.width = pct.toFixed(1) + '%';
    meterFill.classList.toggle('ls-meter-hot', peak > 1.0);
    meterLabel.textContent = dbText(peak);
  }

  function setClipped(on) {
    clipped = on;
    clipWarn.hidden = !on;
  }

  /** Nullstiller varselet og målaren — kallast når avspelinga startar. */
  function resetMeter() {
    holdPeak = 0;
    holdUntil = 0;
    setClipped(false);
    paintMeter(0);
  }

  /* ──────────────── Normalisering ──────────────── */

  function normalize() {
    if (!LS.state.data.clips.length) {
      LS.util.toast('Hent inn lyd før du normaliserer.');
      return;
    }
    normalizeBtn.disabled = true;
    LS.util.toast('Måler toppnivået i miksen …');

    // Vi må måle med master på 1, elles målar vi vår eigen justering.
    const before = LS.state.data.masterGain;
    LS.state.data.masterGain = 1;

    LS.audio.measurePeak().then((peak) => {
      if (peak <= 0.00001) {
        LS.state.data.masterGain = before;
        LS.util.toast('Fann ingen lyd å normalisere — miksen er stille.');
        return;
      }
      LS.state.data.masterGain = before;
      LS.state.pushUndo();
      LS.state.data.masterGain = LS.util.clamp(TARGET / peak, 0, 4);
      syncMaster();
      LS.audio.applyMix();
      setClipped(false);
      LS.util.toast('Master sett til ' + Math.round(LS.state.data.masterGain * 100)
        + '% — toppen ligg no på −1 dB (var ' + dbText(peak) + ').');
    }).catch(() => {
      LS.state.data.masterGain = before;
      LS.util.toast('Klarte ikkje måle toppnivået.');
    }).then(() => {
      normalizeBtn.disabled = false;
    });
  }

  /* ──────────────── Master-volum ──────────────── */

  function syncMaster() {
    if (!masterSlider) return;
    masterSlider.value = LS.state.data.masterGain;
    masterValue.textContent = Math.round(LS.state.data.masterGain * 100) + '%';
  }

  function refresh() {
    syncMaster();
    if (normalizeBtn) normalizeBtn.disabled = !LS.state.data.clips.length;
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup() {
    masterSlider = document.getElementById('masterSlider');
    masterValue = document.getElementById('masterValue');
    normalizeBtn = document.getElementById('normalizeBtn');
    meterFill = document.getElementById('meterFill');
    meterLabel = document.getElementById('meterLabel');
    clipWarn = document.getElementById('clipWarn');

    masterSlider.addEventListener('pointerdown', () => LS.state.pushUndo());
    masterSlider.addEventListener('input', () => {
      LS.state.data.masterGain = parseFloat(masterSlider.value);
      masterValue.textContent = Math.round(LS.state.data.masterGain * 100) + '%';
      LS.audio.applyMix();
    });
    masterSlider.addEventListener('dblclick', () => {
      LS.state.pushUndo();
      LS.state.data.masterGain = 1;
      syncMaster();
      LS.audio.applyMix();
    });

    normalizeBtn.addEventListener('click', normalize);
    document.getElementById('clipWarnDismiss').addEventListener('click', () => setClipped(false));

    refresh();
    paintMeter(0);
  }

  return { setup, refresh, updateMeter, resetMeter, syncMaster, isClipped: () => clipped };
})();
