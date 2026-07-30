/* ══════════════════════════════════════════════
   AUDIO.JS — Lydkontekst og kjelderegister for Lydskurd

   Kjeldene her blir dekoda éin gong og deretter ALDRI endra. Klippa i
   state.js peikar hit med sourceId og held sjølv styr på kva utsnitt
   dei viser. Skal noko snuast eller normaliserast, lagar vi ei ny
   avleidd kjelde i staden for å røre den opphavlege.

   AudioContext blir laga først når brukaren faktisk gjer noko, så
   nettlesaren ikkje klagar over lyd utan brukarhandling.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.audio = (function () {
  'use strict';

  const sources = new Map();   // id -> { id, name, buffer, duration, peaks, bytes }
  let ctx = null;

  /* ──────────────── Kontekst ──────────────── */

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

  /** Nettlesaren pausar konteksten til brukaren har gjort noko. */
  function resume() {
    const c = context();
    if (c && c.state === 'suspended') return c.resume();
    return Promise.resolve();
  }

  /* ──────────────── Kjelder ──────────────── */

  function getSource(id) {
    return sources.get(id) || null;
  }

  function allSources() {
    return Array.from(sources.values());
  }

  /** Kor mange byte lyd vi held i minnet. Float32 = 4 byte per sample per kanal. */
  function bytesOf(buffer) {
    return buffer.length * buffer.numberOfChannels * 4;
  }

  function totalBytes() {
    let sum = 0;
    sources.forEach(s => { sum += s.bytes; });
    return sum;
  }

  /** Samla lengd på all lyd i minnet, i sekund. */
  function totalSeconds() {
    let sum = 0;
    sources.forEach(s => { sum += s.duration; });
    return sum;
  }

  /**
   * Legg til ein ferdig dekoda AudioBuffer som ny kjelde,
   * og reknar ut toppdata før løftet blir innfridd.
   */
  function addBuffer(name, buffer) {
    const source = {
      id: LS.util.uuid(),
      name: name || 'Lyd',
      buffer: buffer,
      duration: buffer.duration,
      bytes: bytesOf(buffer),
      peaks: null
    };
    sources.set(source.id, source);
    return LS.peaks.compute(buffer).then((peaks) => {
      source.peaks = peaks;
      return source;
    });
  }

  /**
   * Les og dekod ei lydfil. decodeAudioData tek seg av mp3, wav, ogg,
   * flac og m4a — kva som faktisk går, varierer med nettlesaren.
   * @returns {Promise<object>} kjelda, med toppdata ferdig utrekna
   */
  function decodeFile(file) {
    const c = context();
    if (!c) return Promise.reject(new Error('Nettlesaren støttar ikkje Web Audio.'));

    return file.arrayBuffer()
      .then(arrayBuffer => c.decodeAudioData(arrayBuffer))
      .then(buffer => addBuffer(LS.util.baseName(file.name), buffer))
      .catch(err => {
        const message = err && err.name === 'EncodingError'
          ? 'Klarte ikkje lese lydfila. Prøv mp3, wav eller ogg.'
          : (err && err.message) || 'Ukjend feil ved lesing av lydfila.';
        throw new Error(message);
      });
  }

  /** Fjernar kjelder ingen klipp lenger brukar, så minnet blir frigjort. */
  function pruneUnused(clips) {
    const used = new Set(clips.map(c => c.sourceId));
    let removed = 0;
    sources.forEach((source, id) => {
      if (!used.has(id)) { sources.delete(id); removed++; }
    });
    return removed;
  }

  function clear() {
    stop();
    sources.clear();
  }

  /* ══════════════════════════════════════════════
     LYDGRAFEN

     buildGraph er hjartet i heile programmet. Både avspeling og
     eksport kallar denne eine funksjonen, så det du høyrer og det du
     lastar ned kan ikkje gå frå kvarandre — dei er same graf, berre
     bygd i to ulike kontekstar.

       AudioBufferSourceNode  (eitt per klipp)
         → GainNode           (klipp-volum)
           → GainNode         (spor-volum, mute og solo)
             → StereoPanner   (panorering)
               → GainNode     (master)
                 → destination
     ══════════════════════════════════════════════ */

  /**
   * @param {BaseAudioContext} ctx  AudioContext eller OfflineAudioContext
   * @param {number} fromTime       kvar på tidslinja grafen skal starte
   * @param {number} baseTime       kva ctx-tid fromTime svarar til
   * @returns {{master: GainNode, nodes: AudioBufferSourceNode[]}}
   */
  function buildGraph(ctx, fromTime, baseTime) {
    const data = LS.state.data;
    const nodes = [];

    const master = ctx.createGain();
    master.gain.value = data.masterGain;
    master.connect(ctx.destination);

    // Er eitt spor sett i solo, teier alle dei andre.
    const anySolo = data.tracks.some(t => t.soloed);

    data.tracks.forEach((track) => {
      const audible = !track.muted && (!anySolo || track.soloed);

      const trackGain = ctx.createGain();
      trackGain.gain.value = audible ? track.gain : 0;

      /* Panneren blir berre kopla inn når han faktisk er i bruk.
         StereoPannerNode brukar konstant-effekt-lov, og det tyder at ei
         MONO-kjelde blir dempa til 0,707 alt ved pan = 0. Med panneren
         utanfor når sporet står midt i, går lyden urørt gjennom — og det
         er føresetnaden for at ein eksport kan bli identisk med kjelda.
         (Manglar StereoPannerNode i nettlesaren, hoppar vi over
         panoreringa i staden for å knekke avspelinga.) */
      const pan = LS.util.clamp(track.pan, -1, 1);
      let tail = trackGain;
      if (pan !== 0 && ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        trackGain.connect(panner);
        tail = panner;
      }
      tail.connect(master);

      LS.state.clipsOnTrack(track.id).forEach((clip) => {
        const source = sources.get(clip.sourceId);
        if (!source) return;

        const clipEnd = clip.timeStart + clip.srcLen;
        if (clipEnd <= fromTime) return;            // ferdigspelt alt

        // Startar vi midt inne i eit klipp, hoppar vi like langt inn i kjelda.
        const skip = Math.max(0, fromTime - clip.timeStart);
        const when = baseTime + Math.max(0, clip.timeStart - fromTime);
        const offset = clip.srcStart + skip;
        const maxLen = Math.max(0, source.duration - offset);
        const length = Math.min(clip.srcLen - skip, maxLen);
        if (length <= 0) return;

        const node = ctx.createBufferSource();
        node.buffer = source.buffer;

        const clipGain = ctx.createGain();
        clipGain.gain.value = clip.gain;

        node.connect(clipGain);
        clipGain.connect(trackGain);
        node.start(when, offset, length);
        nodes.push(node);
      });
    });

    return { master: master, nodes: nodes };
  }

  /* ══════════════════════════════════════════════
     TRANSPORT

     Vi les aldri av spelehovudet med ein timer. Posisjonen blir rekna
     ut frå ctx.currentTime, som er lydkortet si eiga klokke — ein
     setInterval ville drifta frå lyden etter nokre sekund.
     ══════════════════════════════════════════════ */

  const LOOKAHEAD = 0.06;   // litt pusterom til å byggje grafen før lyden startar

  let graph = null;
  let playing = false;
  let startedAt = 0;        // ctx-tid då avspelinga byrja
  let startOffset = 0;      // kvar på tidslinja ho byrja
  let onEnded = null;

  function isPlaying() { return playing; }

  /** Kvar spelehovudet står no, i sekund på tidslinja. */
  function currentTime() {
    if (!playing || !ctx) return startOffset;
    return startOffset + (ctx.currentTime - startedAt);
  }

  /** Der avspelinga sist blei starta — «Stopp» går tilbake hit. */
  function anchorTime() { return startOffset; }

  function teardown() {
    if (!graph) return;
    graph.nodes.forEach((node) => {
      try { node.stop(); } catch (e) { /* alt stoppa */ }
      node.disconnect();
    });
    try { graph.master.disconnect(); } catch (e) { /* alt kopla frå */ }
    graph = null;
  }

  /** Kall med ein funksjon som skal køyrast når avspelinga blir avslutta. */
  function setOnEnded(fn) { onEnded = fn; }

  function play(fromTime) {
    const c = context();
    if (!c) return Promise.resolve(false);

    return resume().then(() => {
      teardown();
      startOffset = Math.max(0, fromTime || 0);
      startedAt = c.currentTime + LOOKAHEAD;
      graph = buildGraph(c, startOffset, startedAt);
      playing = true;
      return true;
    });
  }

  /** Stoppar lyden og lèt spelehovudet bli ståande. */
  function pause() {
    if (!playing) return startOffset;
    const at = currentTime();
    teardown();
    playing = false;
    startOffset = at;
    return at;
  }

  /** Stoppar lyden heilt. Spelehovudet blir ikkje flytta av denne. */
  function stop() {
    teardown();
    playing = false;
    if (onEnded) onEnded();
  }

  return {
    context, isSupported, resume,
    getSource, allSources, addBuffer, decodeFile,
    totalBytes, totalSeconds, pruneUnused, clear,
    buildGraph,
    play, pause, stop, isPlaying, currentTime, anchorTime, setOnEnded
  };
})();
