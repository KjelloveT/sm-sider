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
   * Som addBuffer, men med ein ID som er gjeven på førehand. Prosjektfila
   * brukar dette: klippa der peikar på kjelde-ID-ar som blei skrivne då
   * prosjektet blei lagra, og då må kjeldene kome inn att under same namn.
   */
  function adoptSource(id, name, buffer) {
    const source = {
      id: id,
      name: name || 'Lyd',
      buffer: buffer,
      duration: buffer.duration,
      bytes: bytesOf(buffer),
      peaks: null
    };
    sources.set(id, source);
    return LS.peaks.compute(buffer).then((peaks) => {
      source.peaks = peaks;
      return source;
    });
  }

  /**
   * Gjev ei kjelde ein annan ID. Brukt når brukaren finn att ei lydfil som
   * mangla i eit prosjekt: fila blir dekoda på vanleg vis og får ein ny ID,
   * men klippa ventar den gamle.
   */
  function renameSourceId(fromId, toId, name) {
    const source = sources.get(fromId);
    if (!source) return null;
    sources.delete(fromId);
    source.id = toId;
    if (name) source.name = name;
    sources.set(toId, source);
    return source;
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
   * Legg inn- og utfading på klipp-gainen som ei rampe i tid.
   *
   * Det vanskelege her er at avspelinga kan starte MIDT inne i ei fading.
   * Då kan vi ikkje berre planleggje rampa frå byrjinga — vi må rekne ut
   * kva verdi konvolutten har akkurat i det punktet, setje han der, og
   * rampe vidare derifrå.
   *
   * @param {AudioParam} param   gain-parameteren på klippet
   * @param {object} clip
   * @param {number} base        volumet klippet skal nå på full styrke
   * @param {number} clipStart   ctx-tida der klippet byrjar (kan liggje bak `when`)
   * @param {number} when        ctx-tida der lyden faktisk skal byrje
   */
  function scheduleFades(param, clip, base, clipStart, when) {
    const fadeIn = Math.max(0, clip.fadeIn || 0);
    const fadeOut = Math.max(0, clip.fadeOut || 0);
    const clipEnd = clipStart + clip.srcLen;

    if (!fadeIn && !fadeOut) {
      param.value = base;
      return;
    }

    // Kva er konvolutten verdt på eit gjeve tidspunkt?
    const envAt = (at) => {
      const into = at - clipStart;
      if (fadeIn > 0 && into < fadeIn) return base * Math.max(0, into / fadeIn);
      if (fadeOut > 0 && into > clip.srcLen - fadeOut) {
        return base * Math.max(0, (clipEnd - at) / fadeOut);
      }
      return base;
    };

    param.setValueAtTime(envAt(when), when);

    const fadeInEnd = clipStart + fadeIn;
    if (fadeIn > 0 && fadeInEnd > when) {
      param.linearRampToValueAtTime(base, fadeInEnd);
    }

    if (fadeOut > 0 && clipEnd > when) {
      const fadeOutStart = clipEnd - fadeOut;
      // Held flatt til utfadinga byrjar — men berre om ho ligg framfor oss.
      if (fadeOutStart > when) param.setValueAtTime(base, fadeOutStart);
      param.linearRampToValueAtTime(0, clipEnd);
    }
  }

  /**
   * @param {BaseAudioContext} ctx  AudioContext eller OfflineAudioContext
   * @param {number} fromTime       kvar på tidslinja grafen skal starte
   * @param {number} baseTime       kva ctx-tid fromTime svarar til
   * @returns {{master: GainNode, nodes: AudioBufferSourceNode[]}}
   */
  function buildGraph(ctx, fromTime, baseTime) {
    const data = LS.state.data;
    const nodes = [];
    const trackNodes = new Map();

    const master = ctx.createGain();
    master.gain.value = data.masterGain;
    master.connect(ctx.destination);

    // Er eitt spor sett i solo, teier alle dei andre.
    const anySolo = data.tracks.some(t => t.soloed);

    data.tracks.forEach((track) => {
      const audible = !track.muted && (!anySolo || track.soloed);

      const trackGain = ctx.createGain();
      trackGain.gain.value = audible ? track.gain : 0;

      /* Panneren er ALLTID med, både her og i eksporten, så dei to aldri
         kan skilje seg. StereoPannerNode brukar konstant-effekt-lov, og
         det tyder at ei mono-kjelde blir dempa til 0,707 alt ved pan = 0.
         Det rettar vi opp nede i klipp-gainen, der vi veit kor mange
         kanalar kjelda har — sjå nedanfor. (Manglar StereoPannerNode i
         nettlesaren, hoppar vi over panoreringa i staden for å knekke
         avspelinga.) */
      let panner = null;
      let tail = trackGain;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.value = LS.util.clamp(track.pan, -1, 1);
        trackGain.connect(panner);
        tail = panner;
      }
      tail.connect(master);
      trackNodes.set(track.id, { gain: trackGain, panner: panner });

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
        /* Mono-kompensasjon: panneren over dempar ei mono-kjelde med
           kvadratrota av 2 ved pan = 0. Vi gangar det opp att her, så eit
           spor som står midt i slepp lyden gjennom heilt urørt — same kva
           kjelda har av kanalar. Utan dette kunne ein eksport aldri bli
           identisk med fila som gjekk inn. */
        const monoFix = (panner && source.buffer.numberOfChannels === 1) ? Math.SQRT2 : 1;
        scheduleFades(clipGain.gain, clip, clip.gain * monoFix, clip.timeStart - fromTime + baseTime, when);

        node.connect(clipGain);
        clipGain.connect(trackGain);
        node.start(when, offset, length);
        nodes.push(node);
      });
    });

    return { master: master, nodes: nodes, trackNodes: trackNodes };
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

  /**
   * Skyv nye volum-, panorerings-, mute- og solo-verdiar inn i grafen som
   * spelar no. Utan dette måtte vi byggje grafen på nytt for kvar minste
   * rørsle på ein skyveknapp, og då ville lyden knirke.
   */
  function applyMix() {
    if (!graph || !ctx) return;
    const data = LS.state.data;
    const now = ctx.currentTime;
    const glide = 0.02;   // ei kort rampe, så det ikkje knepper

    graph.master.gain.setTargetAtTime(data.masterGain, now, glide);

    const anySolo = data.tracks.some(t => t.soloed);
    data.tracks.forEach((track) => {
      const nodes = graph.trackNodes.get(track.id);
      if (!nodes) return;
      const audible = !track.muted && (!anySolo || track.soloed);
      nodes.gain.gain.setTargetAtTime(audible ? track.gain : 0, now, glide);
      if (nodes.panner) {
        nodes.panner.pan.setTargetAtTime(LS.util.clamp(track.pan, -1, 1), now, glide);
      }
    });
  }

  /** Analysenode på masteren, brukt av nivåmålaren. */
  let analyser = null;

  function meter() {
    if (!graph || !ctx) return null;
    if (!analyser) {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
    }
    try { graph.master.connect(analyser); } catch (e) { return null; }
    return analyser;
  }

  /**
   * Høgste absoluttverdi i miksen akkurat no, lese frå masteren.
   * Over 1,0 tyder at miksen klipper.
   */
  function currentPeak() {
    if (!analyser || !graph) return 0;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let hi = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i]);
      if (v > hi) hi = v;
    }
    return hi;
  }

  /**
   * Rendrar heile miksen offline for å finne den høgste toppen. Dette er
   * den einaste ærlege måten: overlappande klipp summerer seg, så ein kan
   * ikkje rekne toppen ut frå kjeldene kvar for seg.
   * @returns {Promise<number>} høgste absoluttverdi i miksen
   */
  function measurePeak() {
    const length = LS.state.duration();
    if (length <= 0) return Promise.resolve(0);

    const rate = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(length * rate), rate);
    buildGraph(off, 0, 0);
    return off.startRendering().then((rendered) => {
      let hi = 0;
      for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
        const d = rendered.getChannelData(ch);
        for (let i = 0; i < d.length; i++) {
          const v = Math.abs(d[i]);
          if (v > hi) hi = v;
        }
      }
      return hi;
    });
  }

  /** Stoppar lyden heilt. Spelehovudet blir ikkje flytta av denne. */
  function stop() {
    teardown();
    playing = false;
    if (onEnded) onEnded();
  }

  return {
    context, isSupported, resume,
    getSource, allSources, addBuffer, adoptSource, renameSourceId, decodeFile,
    totalBytes, totalSeconds, pruneUnused, clear,
    buildGraph, applyMix, meter, currentPeak, measurePeak,
    play, pause, stop, isPlaying, currentTime, anchorTime, setOnEnded
  };
})();
