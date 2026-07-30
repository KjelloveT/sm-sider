/* ══════════════════════════════════════════════
   EXPORT.JS — Miks ned til WAV eller MP3

   Miksen blir rendra i ein OfflineAudioContext med NØYAKTIG same
   buildGraph som avspelinga brukar. Det er heile grunnen til at fila du
   lastar ned ikkje kan skilje seg frå det du høyrde: det er ikkje to
   implementasjonar som skal halde seg i takt, det er éin.

   Vi rendrar i lydkontekstens eiga samplingsrate. decodeAudioData har
   alt lagt kjeldene om til den raten, så ingenting blir resampla på veg
   ut — og då kan ei fil som går uendra gjennom kome ut bit for bit lik.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.export = (function () {
  'use strict';

  /* ──────────────── Rendring ──────────────── */

  /**
   * Rendrar heile prosjektet til éin AudioBuffer.
   * @returns {Promise<AudioBuffer>}
   */
  function renderMix() {
    const length = LS.state.duration();
    if (length <= 0) return Promise.reject(new Error('Det er ingen lyd å eksportere.'));

    const live = LS.audio.context();
    const rate = live ? live.sampleRate : 48000;
    const frames = Math.ceil(length * rate);

    const off = new OfflineAudioContext(2, frames, rate);
    LS.audio.buildGraph(off, 0, 0);
    return off.startRendering();
  }

  /* ──────────────── WAV ──────────────── */

  /**
   * 16-bits PCM i ei RIFF/WAVE-innpakning. Formatet er ukomprimert, så
   * det er stort — men det er òg det einaste som ikkje kastar noko bort,
   * og det kan opnast av alt.
   */
  function encodeWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const frames = buffer.length;
    const rate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const dataBytes = frames * blockAlign;

    const view = new DataView(new ArrayBuffer(44 + dataBytes));
    let p = 0;
    const str = (s) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
    const u32 = (v) => { view.setUint32(p, v, true); p += 4; };
    const u16 = (v) => { view.setUint16(p, v, true); p += 2; };

    str('RIFF'); u32(36 + dataBytes); str('WAVE');
    str('fmt '); u32(16);
    u16(1);                      // 1 = PCM utan komprimering
    u16(channels);
    u32(rate);
    u32(rate * blockAlign);      // byte per sekund
    u16(blockAlign);
    u16(8 * bytesPerSample);
    str('data'); u32(dataBytes);

    const data = [];
    for (let ch = 0; ch < channels; ch++) data.push(buffer.getChannelData(ch));

    for (let i = 0; i < frames; i++) {
      for (let ch = 0; ch < channels; ch++) {
        /* Klem til [-1, 1] før vi kvantiserer. Går miksen over, ville
           talet elles renne rundt og bli eit høgt smell i staden for
           den forvrengninga brukaren venta. */
        const s = LS.util.clamp(data[ch][i], -1, 1);
        // Asymmetrisk skalering: 16-bits heiltal går frå -32768 til 32767.
        view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        p += 2;
      }
    }
    return new Blob([view.buffer], { type: 'audio/wav' });
  }

  /* ──────────────── MP3 ──────────────── */

  function hasMp3() {
    return typeof window.lamejs !== 'undefined' && !!window.lamejs.Mp3Encoder;
  }

  /* Enkodarforseinking i LAME: 576 + 529 = 1105 sample blir lagde framfor
     lyden, og litt polstring bak. For ei fil brukaren lastar ned er det
     uten betydning, men prosjektfila lagrar kjeldene som mp3 — og der ville
     forseinkinga forskyve KVART klipp med 23 ms om vi ikkje trekte henne
     frå att. Verdien blir difor skriven inn i prosjektfila, så ho kan
     endrast om vi ein gong byter enkodar. */
  const MP3_DELAY = 1105;

  /** Float −1..1 om til dei 16-bits heiltala lamejs vil ha. */
  function toInt16(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = LS.util.clamp(float32[i], -1, 1);
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  /**
   * @param {AudioBuffer} buffer
   * @param {number} kbps        bitrate, t.d. 192
   * @param {function} onProgress kalla med 0..1
   * @returns {Promise<Blob>}
   */
  function encodeMp3(buffer, kbps, onProgress) {
    if (!hasMp3()) {
      return Promise.reject(new Error('MP3-enkodaren blei ikkje lasta. Prøv WAV i staden.'));
    }

    const channels = Math.min(2, buffer.numberOfChannels);
    const encoder = new window.lamejs.Mp3Encoder(channels, buffer.sampleRate, kbps);
    const left = toInt16(buffer.getChannelData(0));
    const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : null;

    /* Enkodinga skjer i porsjonar med setTimeout mellom, ikkje i éi lang
       løkke. Ei mp3 på fem minutt tek fleire sekund, og utan pauser ville
       heile fana stå frosen — og framdriftsvisinga aldri kome fram. */
    const CHUNK = 57600;   // eit heilt tal mp3-rammer (1152 × 50)
    const parts = [];
    let at = 0;

    return new Promise((resolve, reject) => {
      function step() {
        try {
          const end = Math.min(at + CHUNK, left.length);
          const l = left.subarray(at, end);
          const r = right ? right.subarray(at, end) : undefined;
          const chunk = channels > 1
            ? encoder.encodeBuffer(l, r)
            : encoder.encodeBuffer(l);
          if (chunk.length) parts.push(new Int8Array(chunk));
          at = end;

          if (onProgress) onProgress(at / left.length);

          if (at < left.length) {
            setTimeout(step, 0);
          } else {
            const tail = encoder.flush();
            if (tail.length) parts.push(new Int8Array(tail));
            resolve(new Blob(parts, { type: 'audio/mpeg' }));
          }
        } catch (err) {
          reject(err);
        }
      }
      step();
    });
  }

  /* ──────────────── Overslag ──────────────── */

  /** Kor stor blir fila? Til visning i dialogen, før vi gjer jobben. */
  function estimate(format, kbps) {
    const seconds = LS.state.duration();
    if (seconds <= 0) return 0;
    if (format === 'mp3') return Math.round(seconds * kbps * 1000 / 8);
    const live = LS.audio.context();
    const rate = live ? live.sampleRate : 48000;
    return Math.round(44 + seconds * rate * 2 * 2);
  }

  return { renderMix, encodeWav, encodeMp3, hasMp3, estimate, MP3_DELAY };
})();
