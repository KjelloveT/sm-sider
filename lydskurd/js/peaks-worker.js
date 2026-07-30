/* ══════════════════════════════════════════════
   PEAKS-WORKER.JS — Toppberekning på bakgrunnstråd

   Får ein mono-miksa Float32Array og reduserer han til eit par
   min/max-verdiar per «bøtte» av SAMPLES_PER_BUCKET sample. Det er
   dette som gjer at bølgjeforma kan teiknast på nokre millisekund,
   uansett kor lang fila er.

   Workeren rører verken nettverk, lagring eller DOM — han gjer berre
   denne eine utrekninga og sender resultatet tilbake.
   ══════════════════════════════════════════════ */
'use strict';

self.onmessage = function (e) {
  const msg = e.data || {};
  if (msg.type !== 'peaks') return;

  const samples = msg.samples;
  const perBucket = msg.samplesPerBucket || 64;
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

  self.postMessage(
    { type: 'peaks', id: msg.id, samplesPerBucket: perBucket, count: count, min: min, max: max },
    [min.buffer, max.buffer]
  );
};
