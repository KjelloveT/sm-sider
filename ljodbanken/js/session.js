/* ══════════════════════════════════════════════
   SESSION.JS — Sjølve innspelingsøkta

   Ei økt held mikrofonen open og går frå klipp til klipp. Kvart opptak
   har same gangen: nedteljing, opptak, og eit framlegg til kvar lyden
   byrjar og sluttar.

   Nedteljinga er ikkje pynt. Trykkjer du og snakkar med det same, får
   du med klikket frå museknappen og halve første lyden — og på 141
   klipp orkar ingen å gjere det om att.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.session = (function () {
  'use strict';

  /* Eit opptak som varer lenger enn dette er nesten alltid eitt nokon
     gløymde å stoppe. Vi tek det med, men stoppar sjølve. */
  const MAX_SECONDS = 20;
  const COUNTDOWN_MS = 700;
  const NEXT_DELAY_MS = 900;

  let activeId = null;
  let phase = null;             // 'nedteljing' | 'opptak' | 'handsamar'
  let countLeft = 0;
  let autoAdvance = false;
  let timer = 0;
  let onChange = function () {};

  function setOnChange(fn) { onChange = fn || function () {}; }

  function state() {
    return { id: activeId, phase: phase, count: countLeft };
  }

  function isBusy() { return !!activeId; }
  function micOn() { return LB.record.isOpen(); }
  function level() { return LB.record.level(); }
  function elapsed() { return LB.record.isRecording() ? LB.record.elapsed() : 0; }
  function isAuto() { return autoAdvance; }

  function setAuto(on) {
    autoAdvance = !!on;
    onChange();
  }

  /* ──────────────── Mikrofonen ──────────────── */

  function openMic() {
    return LB.record.openMic().then(() => { onChange(); });
  }

  function closeMic() {
    cancel();
    LB.record.closeMic();
    onChange();
  }

  /* ──────────────── Eitt klipp ──────────────── */

  /**
   * Startar nedteljinga for eit klipp. Held eit anna klipp på med same
   * knappetrykk, blir det stoppa først.
   * @param {string} id
   */
  function record(id) {
    if (activeId === id && phase === 'opptak') { finish(); return Promise.resolve(); }
    if (activeId) cancel();

    return (LB.record.isOpen() ? Promise.resolve() : openMic())
      .then(() => LB.audio.resume())
      .then(() => {
        LB.audio.stop();
        activeId = id;
        phase = 'nedteljing';
        countLeft = 3;
        onChange();
        tickCountdown();
      })
      .catch((err) => {
        activeId = null;
        phase = null;
        onChange();
        LB.util.toast(err.message);
      });
  }

  function tickCountdown() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      countLeft--;
      if (countLeft > 0) { onChange(); tickCountdown(); return; }
      begin();
    }, COUNTDOWN_MS);
    onChange();
  }

  function begin() {
    phase = 'opptak';
    onChange();
    LB.record.start().then(() => {
      onChange();
      clearTimeout(timer);
      timer = setTimeout(() => { if (phase === 'opptak') finish(); }, MAX_SECONDS * 1000);
    }).catch((err) => {
      activeId = null;
      phase = null;
      onChange();
      LB.util.toast(err.message);
    });
  }

  /** Stoppar opptaket og legg klippet i lista. */
  function finish() {
    if (phase !== 'opptak') { cancel(); return; }
    clearTimeout(timer);
    const id = activeId;
    phase = 'handsamar';
    onChange();

    LB.record.stop().then((buffer) => {
      activeId = null;
      phase = null;

      if (!buffer || buffer.duration < 0.05) {
        onChange();
        LB.util.toast('Opptaket blei tomt. Prøv ein gong til.');
        return;
      }

      const bounds = LB.audio.speechBounds(buffer);
      LB.state.put(id, {
        buffer: buffer,
        start: bounds.start,
        end: bounds.end,
        origin: 'mikrofon',
        bytes: null,
        ext: null,
        edited: false,
        peak: LB.audio.peakOf(buffer)
      });
      onChange();
      if (autoAdvance) queueNext(id);
    }).catch((err) => {
      activeId = null;
      phase = null;
      onChange();
      LB.util.toast(err.message);
    });
  }

  /** Neste klipp utan opptak, etter ein liten pust. */
  function queueNext(afterId) {
    const next = LB.state.nextMissing(afterId);
    if (!next) {
      LB.util.toast('Heile lista er spelt inn.');
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!autoAdvance || activeId) return;
      record(next);
    }, NEXT_DELAY_MS);
  }

  /** Bryt av det som måtte vere på gang, utan å lagre noko. */
  function cancel() {
    clearTimeout(timer);
    if (LB.record.isRecording()) {
      // Vi kastar opptaket: stop() gjer det om til lyd, og vi tek ikkje imot.
      LB.record.stop().catch(() => {});
    }
    activeId = null;
    phase = null;
    countLeft = 0;
    onChange();
  }

  return {
    MAX_SECONDS,
    setOnChange, state, isBusy, micOn, level, elapsed,
    isAuto, setAuto, openMic, closeMic,
    record, finish, cancel
  };
})();
