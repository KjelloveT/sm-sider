/* ══════════════════════════════════════════════
   AUDIO.JS — Lydkontekst, avspeling og handsaming av klipp

   Opptaket blir dekoda éin gong og deretter aldri endra. Skjer du til
   klippet, er det berre to tal — `start` og `slutt` — som flyttar seg.
   Difor kan du alltid dra grensene ut att, og difor kan eit klipp
   skjerast om og om igjen utan at lyden blir dårlegare.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.audio = (function () {
  'use strict';

  let ctx = null;
  let node = null;          // kjelda som spelar akkurat no
  let onEnded = null;

  function context() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    return ctx;
  }

  function isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
  }

  /** Nettlesaren held konteksten i pause til brukaren har gjort noko. */
  function resume() {
    const c = context();
    if (c && c.state === 'suspended') return c.resume();
    return Promise.resolve();
  }

  function decode(arrayBuffer) {
    const c = context();
    if (!c) return Promise.reject(new Error('Nettlesaren din støttar ikkje lyd.'));
    return c.decodeAudioData(arrayBuffer);
  }

  /* ──────────────── Avspeling ──────────────── */

  function stop() {
    if (node) {
      const dying = node;
      node = null;
      dying.onended = null;
      try { dying.stop(); } catch (e) { /* alt stoppa */ }
    }
    if (onEnded) { const fn = onEnded; onEnded = null; fn(); }
  }

  function isPlaying() { return !!node; }

  /**
   * Spelar eit utsnitt av eit klipp. Berre eitt klipp spelar om gongen —
   * to lydar oppå kvarandre er alltid ein feil i dette verktøyet.
   * @param {AudioBuffer} buffer
   * @param {number} from   sekund inn i klippet
   * @param {number} to     sekund inn i klippet
   * @param {function} [done] kalla når avspelinga er ferdig eller broten
   */
  function play(buffer, from, to, done) {
    stop();
    const c = context();
    if (!c || !buffer) return;

    const start = Math.max(0, from || 0);
    const end = Math.min(buffer.duration, to == null ? buffer.duration : to);
    if (end - start <= 0.001) { if (done) done(); return; }

    resume();
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    onEnded = done || null;
    source.onended = () => { if (node === source) { node = null; stop(); } };
    node = source;
    source.start(0, start, end - start);
  }

  /* ──────────────── Handsaming ──────────────── */

  /** Nytt klipp med berre utsnittet i seg. Brukt på veg ut til fil. */
  function slice(buffer, from, to) {
    const rate = buffer.sampleRate;
    const first = Math.max(0, Math.floor(from * rate));
    const last = Math.min(buffer.length, Math.ceil(to * rate));
    const frames = Math.max(1, last - first);
    const c = context();
    const out = c.createBuffer(buffer.numberOfChannels, frames, rate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      out.getChannelData(ch).set(buffer.getChannelData(ch).subarray(first, last));
    }
    return out;
  }

  /** Blandar ned til éin kanal. Ein lydbank til tale treng ikkje stereo. */
  function toMono(buffer) {
    if (buffer.numberOfChannels === 1) return buffer;
    const c = context();
    const out = c.createBuffer(1, buffer.length, buffer.sampleRate);
    const mix = out.getChannelData(0);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) mix[i] += data[i] / buffer.numberOfChannels;
    }
    return out;
  }

  /**
   * Skalerer klippet så det høgste utslaget hamnar like under taket.
   * Klippa i ein lydbank blir spelte etter kvarandre, og eit som ligg
   * seks desibel under naboen høyrest ut som ein feil i appen.
   */
  function normalize(buffer, ceiling) {
    const top = ceiling == null ? 0.891 : ceiling;   // −1 dBFS
    let peak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
    }
    if (peak < 0.0001 || Math.abs(peak - top) < 0.001) return buffer;

    const gain = top / peak;
    const c = context();
    const out = c.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const from = buffer.getChannelData(ch);
      const to = out.getChannelData(ch);
      for (let i = 0; i < from.length; i++) to[i] = from[i] * gain;
    }
    return out;
  }

  /** Høgste utslag i klippet, 0..1. */
  function peakOf(buffer) {
    let peak = 0;
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
    return peak;
  }

  /**
   * Finn kvar lyden faktisk byrjar og sluttar, så vi kan foreslå eit
   * utsnitt utan stille i endane.
   *
   * Terskelen er relativ til klippets eige toppnivå, ikkje ein fast
   * desibelverdi. Ein mikrofon som står lågt gir eit klipp der alt er
   * svakt — med fast terskel ville heile klippet blitt rekna som stille.
   *
   * @returns {{start: number, end: number}} i sekund
   */
  function speechBounds(buffer, padding) {
    const data = buffer.getChannelData(0);
    const rate = buffer.sampleRate;
    const win = Math.max(1, Math.round(rate * 0.01));     // 10 ms
    const pad = padding == null ? 0.04 : padding;

    let peak = 0;
    const frames = [];
    for (let i = 0; i < data.length; i += win) {
      let hi = 0;
      const stop = Math.min(data.length, i + win);
      for (let k = i; k < stop; k++) {
        const v = Math.abs(data[k]);
        if (v > hi) hi = v;
      }
      frames.push(hi);
      if (hi > peak) peak = hi;
    }
    if (!frames.length || peak < 0.005) return { start: 0, end: buffer.duration };

    const threshold = Math.max(peak * 0.08, 0.004);
    let first = 0;
    let last = frames.length - 1;
    while (first < frames.length && frames[first] < threshold) first++;
    while (last > first && frames[last] < threshold) last--;
    if (first >= frames.length) return { start: 0, end: buffer.duration };

    const start = Math.max(0, (first * win) / rate - pad);
    const end = Math.min(buffer.duration, ((last + 1) * win) / rate + pad);
    return { start: start, end: end };
  }

  /**
   * Kurve til teikning: eitt topp-par per piksel. Meir enn det kan
   * skjermen likevel ikkje vise.
   */
  function peaks(buffer, columns) {
    const data = buffer.getChannelData(0);
    const per = data.length / columns;
    const out = new Float32Array(columns * 2);
    for (let x = 0; x < columns; x++) {
      const from = Math.floor(x * per);
      const to = Math.min(data.length, Math.floor((x + 1) * per));
      let lo = 0;
      let hi = 0;
      for (let i = from; i < to; i++) {
        const v = data[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      out[x * 2] = lo;
      out[x * 2 + 1] = hi;
    }
    return out;
  }

  return {
    context, isSupported, resume, decode,
    play, stop, isPlaying,
    slice, toMono, normalize, peakOf, speechBounds, peaks
  };
})();
