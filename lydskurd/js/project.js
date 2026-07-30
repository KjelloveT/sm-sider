/* ══════════════════════════════════════════════
   PROJECT.JS — Lagre og opne .lydskurd-prosjektfiler

   Ingenting blir lagra i nettlesaren. Prosjektet blir ei fil brukaren
   lastar ned sjølv og tek vare på der han vil.

   To modusar, fordi rå lyd i base64 blir uhandterleg stort:

     MED LYD    — kvar kjelde blir mp3-komprimert og lagd inn i fila.
                  10 min stereo blir kring 10 MB i staden for 130 MB.
                  Komprimeringa er tapsgjevande, så ei opna fil er ikkje
                  bit-identisk med originalen.

     BERRE OPPSETT — klipp- og spormetadata, pluss namn og lengd på
                  kjeldene. Bittelita fil, men brukaren må finne
                  lydfilene att sjølv når han opnar.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.project = (function () {
  'use strict';

  const FORMAT_VERSION = 1;
  const EMBED_KBPS = 192;

  /* ──────────────── Base64 ──────────────── */

  /* Vi går gjennom bufferen i porsjonar. String.fromCharCode.apply på ein
     heil fleire-megabyte-buffer sprengjer kallstakken i alle nettlesarar. */
  function toBase64(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const CHUNK = 0x8000;
    let text = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      text += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(text);
  }

  function fromBase64(text) {
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes.buffer;
  }

  /* ──────────────── Lagring ──────────────── */

  /** Kjelder som faktisk er i bruk av eit klipp. */
  function usedSources() {
    const ids = new Set(LS.state.data.clips.map(c => c.sourceId));
    return LS.audio.allSources().filter(s => ids.has(s.id));
  }

  function metaOf(source) {
    return {
      id: source.id,
      name: source.name,
      duration: source.duration,
      frames: source.buffer.length,
      channels: source.buffer.numberOfChannels,
      sampleRate: source.buffer.sampleRate
    };
  }

  /**
   * Byggjer prosjektobjektet.
   * @param {object} opts { name, withAudio, onProgress }
   * @returns {Promise<object>}
   */
  function serialize(opts) {
    const options = opts || {};
    const sources = usedSources();
    const data = LS.state.data;

    const project = {
      app: 'lydskurd',
      version: FORMAT_VERSION,
      name: options.name || data.title || 'Utan namn',
      date: new Date().toISOString(),
      withAudio: !!options.withAudio,
      masterGain: data.masterGain,
      tracks: data.tracks.map(t => ({
        id: t.id, name: t.name, gain: t.gain, pan: t.pan,
        muted: !!t.muted, soloed: !!t.soloed
      })),
      clips: data.clips.map(c => ({
        id: c.id, sourceId: c.sourceId, trackId: c.trackId, name: c.name,
        srcStart: c.srcStart, srcLen: c.srcLen, timeStart: c.timeStart,
        gain: c.gain, fadeIn: c.fadeIn, fadeOut: c.fadeOut, reversed: !!c.reversed
      })),
      sources: sources.map(metaOf)
    };

    if (!options.withAudio) return Promise.resolve(project);

    if (!LS.export.hasMp3()) {
      return Promise.reject(new Error('MP3-enkodaren blei ikkje lasta, så lyden kan ikkje leggjast inn i fila. Lagre «berre oppsett» i staden.'));
    }

    // Kjeldene blir komprimerte éi for éi, så framdrifta blir ærleg.
    project.audioFormat = 'mp3';
    project.audioKbps = EMBED_KBPS;
    project.encoderDelay = LS.export.MP3_DELAY;

    let done = 0;
    return sources.reduce((chain, source, i) => chain.then(() => {
      return LS.export.encodeMp3(source.buffer, EMBED_KBPS, (within) => {
        if (options.onProgress) options.onProgress((done + within) / sources.length);
      }).then((blob) => {
        return blob.arrayBuffer().then((ab) => {
          project.sources[i].audio = toBase64(ab);
          done++;
          if (options.onProgress) options.onProgress(done / sources.length);
        });
      });
    }), Promise.resolve()).then(() => project);
  }

  /** Prosjektobjekt til nedlastbar fil. */
  function toBlob(project) {
    return new Blob([JSON.stringify(project)], { type: 'application/json' });
  }

  /* ──────────────── Opning ──────────────── */

  function validate(project) {
    if (!project || project.app !== 'lydskurd') {
      throw new Error('Dette ser ikkje ut som ei Lydskurd-fil.');
    }
    if (project.version > FORMAT_VERSION) {
      throw new Error('Fila er laga med ein nyare versjon av Lydskurd enn denne.');
    }
    if (!Array.isArray(project.tracks) || !Array.isArray(project.clips)) {
      throw new Error('Fila manglar spor eller klipp, og kan ikkje opnast.');
    }
    return project;
  }

  function parse(text) {
    let project;
    try {
      project = JSON.parse(text);
    } catch (e) {
      throw new Error('Klarte ikkje lese fila — ho er ikkje gyldig JSON.');
    }
    return validate(project);
  }

  /**
   * Skjer bort enkodarforseinkinga og klipper bufferen tilbake til den
   * lengda kjelda hadde då prosjektet blei lagra. Utan dette ville alle
   * klippa hoppe 23 ms ut av kurs kvar gong prosjektet blei opna.
   */
  function trimDecoded(buffer, meta, delay) {
    const ctx = LS.audio.context();
    const frames = Math.min(meta.frames || buffer.length, Math.max(0, buffer.length - delay));
    if (frames <= 0) return buffer;

    const channels = Math.min(buffer.numberOfChannels, meta.channels || buffer.numberOfChannels);
    const out = ctx.createBuffer(channels, frames, buffer.sampleRate);
    for (let ch = 0; ch < channels; ch++) {
      const src = buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));
      out.copyToChannel(src.subarray(delay, delay + frames), ch);
    }
    return out;
  }

  /**
   * Legg tilstanden frå prosjektfila inn i state og audio.
   * Kjelder utan innebygd lyd blir ståande som manglande, og lista over
   * dei blir gjeven tilbake så brukarflata kan spørje etter filene.
   *
   * @returns {Promise<{missing: object[]}>}
   */
  function load(project) {
    const ctx = LS.audio.context();
    if (!ctx) return Promise.reject(new Error('Nettlesaren støttar ikkje Web Audio.'));

    const delay = typeof project.encoderDelay === 'number' ? project.encoderDelay : 0;
    const metas = Array.isArray(project.sources) ? project.sources : [];

    // Dekod all innebygd lyd før vi rører tilstanden, så eit halvvegs
    // mislukka opning ikkje øydelegg det brukaren alt hadde.
    const decoded = new Map();
    const missing = [];

    return metas.reduce((chain, meta) => chain.then(() => {
      if (!meta.audio) { missing.push(meta); return null; }
      return ctx.decodeAudioData(fromBase64(meta.audio))
        .then(buffer => { decoded.set(meta.id, trimDecoded(buffer, meta, delay)); })
        .catch(() => { missing.push(meta); });
    }), Promise.resolve()).then(() => {
      LS.state.reset();
      LS.audio.clear();

      LS.state.data.title = project.name || '';
      LS.state.data.masterGain = typeof project.masterGain === 'number' ? project.masterGain : 1;

      project.tracks.forEach((t) => {
        LS.state.data.tracks.push({
          id: t.id || LS.util.uuid(),
          name: t.name || 'Spor',
          gain: typeof t.gain === 'number' ? t.gain : 1,
          pan: typeof t.pan === 'number' ? t.pan : 0,
          muted: !!t.muted,
          soloed: !!t.soloed
        });
      });
      if (!LS.state.data.tracks.length) LS.state.addTrack();

      // Kjeldene blir lagde inn med den ID-en prosjektet brukte, så klippa
      // finn dei att utan omskriving.
      const peakJobs = [];
      metas.forEach((meta) => {
        const buffer = decoded.get(meta.id);
        if (!buffer) return;
        peakJobs.push(LS.audio.adoptSource(meta.id, meta.name, buffer));
      });

      const trackIds = new Set(LS.state.data.tracks.map(t => t.id));
      project.clips.forEach((c) => {
        if (!trackIds.has(c.trackId)) return;     // klipp på eit spor som ikkje finst
        LS.state.data.clips.push({
          id: c.id || LS.util.uuid(),
          sourceId: c.sourceId,
          trackId: c.trackId,
          name: c.name || 'Klipp',
          srcStart: c.srcStart || 0,
          srcLen: c.srcLen || 0,
          timeStart: Math.max(0, c.timeStart || 0),
          gain: typeof c.gain === 'number' ? c.gain : 1,
          fadeIn: c.fadeIn || 0,
          fadeOut: c.fadeOut || 0,
          reversed: !!c.reversed
        });
      });
      LS.state.data.clips.forEach(LS.state.clampFades);

      // Vent på toppdata, elles står bølgjeforma tom når sida teiknar.
      return Promise.all(peakJobs).then(() => ({ missing: missing }));
    });
  }

  /**
   * Koplar ei fil brukaren har peika ut til ei kjelde som mangla.
   * @returns {Promise<{warning: string|null}>}
   */
  function relink(meta, file) {
    return LS.audio.decodeFile(file).then((source) => {
      // Kjelda kom inn med ny ID; klippa peikar på den gamle.
      LS.audio.renameSourceId(source.id, meta.id, meta.name);
      let warning = null;
      const diff = Math.abs(source.duration - (meta.duration || 0));
      if (diff > 0.25) {
        warning = 'Fila «' + file.name + '» er ' + source.duration.toFixed(1).replace('.', ',')
          + ' s, men prosjektet venta ' + (meta.duration || 0).toFixed(1).replace('.', ',')
          + ' s. Klippa kan hamne feil.';
      }
      return { warning: warning };
    });
  }

  return { serialize, toBlob, parse, load, relink, FORMAT_VERSION, EMBED_KBPS };
})();
