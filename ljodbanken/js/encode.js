/* ══════════════════════════════════════════════
   ENCODE.JS — Frå rå lyd til fil

   To format, med kvar sin grunn til å finnast:

   WAV er ukomprimert. Fila blir stor, men lyden kjem ut nøyaktig slik
   ho gjekk inn, og klippet byrjar på det sample det skal.

   MP3 er lite nok til å leggjast i eit repo. Ver merksam på at LAME
   legg om lag 1105 sample — 23 ms — stille framfor lyden. Skal klippa
   skøytast saman til ein lydsprite der millisekundane tel, er WAV det
   rette valet ut herifrå.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.encode = (function () {
  'use strict';

  /** Float −1..1 om til 16-bits heiltal. */
  function toInt16(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      /* Klem til [−1, 1] før vi kvantiserer. Går lyden over taket, ville
         talet elles renne rundt og bli eit smell i staden for den
         forvrenginga brukaren venta. */
      const s = LB.util.clamp(float32[i], -1, 1);
      // Asymmetrisk: 16-bits heiltal går frå −32768 til 32767.
      out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return out;
  }

  /* ──────────────── WAV ──────────────── */

  function encodeWav(buffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const frames = buffer.length;
    const rate = buffer.sampleRate;
    const blockAlign = channels * 2;
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
    u16(16);
    str('data'); u32(dataBytes);

    const data = [];
    for (let ch = 0; ch < channels; ch++) data.push(toInt16(buffer.getChannelData(ch)));

    for (let i = 0; i < frames; i++) {
      for (let ch = 0; ch < channels; ch++) {
        view.setInt16(p, data[ch][i], true);
        p += 2;
      }
    }
    return new Uint8Array(view.buffer);
  }

  /* ──────────────── MP3 ──────────────── */

  function hasMp3() {
    return typeof window.lamejs !== 'undefined' && !!window.lamejs.Mp3Encoder;
  }

  /**
   * Klippa her er sjeldan over eit par sekund, så heile jobben går i éin
   * sving. Det er lista som blir delt opp undervegs i eksporten, ikkje
   * det einskilde klippet.
   * @returns {Uint8Array}
   */
  function encodeMp3(buffer, kbps) {
    if (!hasMp3()) throw new Error('MP3-enkodaren blei ikkje lasta. Vel WAV i staden.');

    const channels = Math.min(2, buffer.numberOfChannels);
    const encoder = new window.lamejs.Mp3Encoder(channels, buffer.sampleRate, kbps);
    const left = toInt16(buffer.getChannelData(0));
    const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : null;

    const parts = [];
    const CHUNK = 1152 * 50;
    let bytes = 0;
    for (let at = 0; at < left.length; at += CHUNK) {
      const end = Math.min(at + CHUNK, left.length);
      const chunk = channels > 1
        ? encoder.encodeBuffer(left.subarray(at, end), right.subarray(at, end))
        : encoder.encodeBuffer(left.subarray(at, end));
      if (chunk.length) { parts.push(chunk); bytes += chunk.length; }
    }
    const tail = encoder.flush();
    if (tail.length) { parts.push(tail); bytes += tail.length; }

    const out = new Uint8Array(bytes);
    let at = 0;
    parts.forEach((part) => { out.set(part, at); at += part.length; });
    return out;
  }

  /** Overslag over kor stor zip-fila blir, før vi gjer jobben. */
  function estimate(format, kbps, seconds, count, rate, channels) {
    if (format === 'mp3') return Math.round(seconds * kbps * 1000 / 8) + count * 400;
    return Math.round(count * 44 + seconds * rate * 2 * channels);
  }

  return { encodeWav, encodeMp3, hasMp3, estimate };
})();
