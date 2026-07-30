/* ══════════════════════════════════════════════
   PEAKS.JS — Innpakning rundt toppberekninga

   Blandar kjelda ned til mono på hovudtråden (ei rask memcpy-liknande
   løkke) og sender kopien vidare til workeren, som gjer den tunge
   min/max-jobben. Kopien blir OVERFØRT, ikkje kopiert enno ein gong —
   difor treng vi ein eigen buffer og kan ikkje sende getChannelData()
   direkte: det ville kople frå sjølve AudioBufferen.

   Fell tilbake til synkron utrekning om workeren ikkje kan startast
   (t.d. når sida blir opna rett frå fil-systemet).
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.peaks = (function () {
  'use strict';

  const SAMPLES_PER_BUCKET = 64;

  let worker = null;
  let workerBroken = false;
  let nextJob = 1;
  const pending = new Map();

  function ensureWorker() {
    if (worker || workerBroken) return worker;
    try {
      worker = new Worker('js/peaks-worker.js');
      worker.onmessage = (e) => {
        const msg = e.data || {};
        const resolve = pending.get(msg.id);
        if (!resolve) return;
        pending.delete(msg.id);
        resolve({
          samplesPerBucket: msg.samplesPerBucket,
          count: msg.count,
          min: msg.min,
          max: msg.max
        });
      };
      worker.onerror = () => {
        // Workeren er ute av spel — resten av økta reknar synkront.
        workerBroken = true;
        worker = null;
        pending.forEach(resolve => resolve(null));
        pending.clear();
      };
    } catch (err) {
      workerBroken = true;
      worker = null;
    }
    return worker;
  }

  /** Blandar alle kanalar ned til éin Float32Array. Berre til visning. */
  function toMono(buffer) {
    const len = buffer.length;
    const channels = buffer.numberOfChannels;
    const out = new Float32Array(len);
    if (channels === 1) {
      out.set(buffer.getChannelData(0));
      return out;
    }
    for (let ch = 0; ch < channels; ch++) {
      const src = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) out[i] += src[i];
    }
    const scale = 1 / channels;
    for (let i = 0; i < len; i++) out[i] *= scale;
    return out;
  }

  /** Same utrekning som i workeren, brukt som naudløysing. */
  function computeSync(samples, perBucket) {
    const count = Math.max(1, Math.ceil(samples.length / perBucket));
    const min = new Float32Array(count);
    const max = new Float32Array(count);
    for (let b = 0; b < count; b++) {
      const from = b * perBucket;
      const to = Math.min(from + perBucket, samples.length);
      let lo = 0;
      let hi = 0;
      if (from < to) {
        lo = samples[from];
        hi = lo;
        for (let i = from + 1; i < to; i++) {
          const v = samples[i];
          if (v < lo) lo = v;
          else if (v > hi) hi = v;
        }
      }
      min[b] = lo;
      max[b] = hi;
    }
    return { samplesPerBucket: perBucket, count: count, min: min, max: max };
  }

  /**
   * Reknar ut toppdata for ein AudioBuffer.
   * @returns {Promise<{samplesPerBucket:number,count:number,min:Float32Array,max:Float32Array,sampleRate:number}>}
   */
  function compute(buffer) {
    const samples = toMono(buffer);
    const w = ensureWorker();

    if (!w) {
      const result = computeSync(samples, SAMPLES_PER_BUCKET);
      result.sampleRate = buffer.sampleRate;
      return Promise.resolve(result);
    }

    const id = nextJob++;
    return new Promise((resolve) => {
      pending.set(id, (result) => {
        if (result) {
          result.sampleRate = buffer.sampleRate;
          resolve(result);
        } else {
          // Workeren fall frå medan jobben stod i kø.
          const sync = computeSync(samples, SAMPLES_PER_BUCKET);
          sync.sampleRate = buffer.sampleRate;
          resolve(sync);
        }
      });
      w.postMessage(
        { type: 'peaks', id: id, samples: samples, samplesPerBucket: SAMPLES_PER_BUCKET },
        [samples.buffer]
      );
    });
  }

  /**
   * Høgste absoluttverdi i eit tidsspenn av kjelda. Brukt av
   * bølgjeform-teikninga, som spør om éin piksel om gongen.
   */
  function rangeAt(peaks, fromSec, toSec) {
    const perSecond = peaks.sampleRate / peaks.samplesPerBucket;
    let a = Math.floor(fromSec * perSecond);
    let b = Math.ceil(toSec * perSecond);
    if (b <= a) b = a + 1;
    if (a < 0) a = 0;
    if (b > peaks.count) b = peaks.count;
    if (a >= peaks.count) return { min: 0, max: 0 };

    let lo = peaks.min[a];
    let hi = peaks.max[a];
    for (let i = a + 1; i < b; i++) {
      if (peaks.min[i] < lo) lo = peaks.min[i];
      if (peaks.max[i] > hi) hi = peaks.max[i];
    }
    return { min: lo, max: hi };
  }

  /** Høgste absoluttverdi i heile kjelda — grunnlag for normalisering seinare. */
  function peakOf(peaks) {
    let hi = 0;
    for (let i = 0; i < peaks.count; i++) {
      const a = Math.abs(peaks.min[i]);
      const b = Math.abs(peaks.max[i]);
      if (a > hi) hi = a;
      if (b > hi) hi = b;
    }
    return hi;
  }

  return { compute, rangeAt, peakOf, SAMPLES_PER_BUCKET };
})();
