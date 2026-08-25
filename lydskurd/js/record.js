/* ══════════════════════════════════════════════
   RECORD.JS — Opptak frå mikrofon

   Mikrofonen blir slått på når brukaren ber om det, og slått AV att med
   ein gong han er ferdig. Det er ikkje berre høflegheit: så lenge ein
   MediaStreamTrack lever, viser nettlesaren opptaksmerket i fana og
   operativsystemet reknar mikrofonen som i bruk. Vi slepper han difor
   i alle utgangar — også når noko går gale.

   Lyden blir aldri sendt nokon stad. Han går rett frå mikrofonen inn i
   minnet, og blir eit klipp på tidslinja som alle andre.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.record = (function () {
  'use strict';

  let stream = null;
  let recorder = null;
  let chunks = [];
  let analyser = null;
  let sourceNode = null;
  let startedAt = 0;
  let wantedDevice = '';        // '' = la nettlesaren velje sjølv

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      && typeof window.MediaRecorder !== 'undefined');
  }

  function isOpen() { return !!stream; }
  function isRecording() { return !!recorder && recorder.state === 'recording'; }

  /** Kor lenge opptaket har vart, i sekund. */
  function elapsed() {
    return startedAt ? (performance.now() - startedAt) / 1000 : 0;
  }

  /* ──────────────── Kva mikrofon ──────────────── */

  /**
   * Mikrofonane maskina har.
   *
   * Namna er tomme før brukaren har gjeve løyve til opptak — nettlesaren
   * vil ikkje at ei side skal kunne kjenne att maskina di på lista over
   * lydkort. Vi kallar difor denne på nytt etter at mikrofonen er opna,
   * og då står namna der.
   *
   * @returns {Promise<Array<{deviceId: string, label: string}>>}
   */
  function inputs() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    return navigator.mediaDevices.enumerateDevices()
      .then(list => list.filter(d => d.kind === 'audioinput').map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || ('Mikrofon ' + (i + 1))
      })))
      .catch(() => []);
  }

  function device() { return wantedDevice; }

  /**
   * Vel mikrofon. Er han alt open, må straumen takast opp att — ein
   * MediaStream kan ikkje byte kjelde undervegs.
   * @returns {Promise<void>}
   */
  function useDevice(id) {
    if (id === wantedDevice) return Promise.resolve();
    wantedDevice = id || '';
    if (!stream) return Promise.resolve();
    closeMic();
    return openMic();
  }

  function constraints() {
    const audio = {
      // Vi vil ha lyden så rå som råd. Nettlesaren sin ekkokansellering
      // er laga for tale i møte og kan gjere musikk og song stygg.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    };
    /* `exact` gjer at vi får ein feil i staden for ein annan mikrofon om
       den valde er kopla frå. Eit opptak frå feil mikrofon er verre enn
       ei feilmelding. */
    if (wantedDevice) audio.deviceId = { exact: wantedDevice };
    return { audio: audio };
  }

  /* ──────────────── Format ──────────────── */

  /* Nettlesarane er ikkje samde om kva MediaRecorder kan skrive. Vi tek
     det første dei godtek, og lèt nettlesaren velje sjølv om ingen av dei
     slår til. Opus i webm er det vanlege i Chrome og Edge, ogg i Firefox. */
  function pickMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4'
    ];
    for (let i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return '';
  }

  /* ──────────────── Mikrofonen ──────────────── */

  /**
   * Ber om tilgang og held straumen open, så nivåmålaren kan vise at
   * mikrofonen faktisk fangar lyd før opptaket byrjar.
   * @returns {Promise<void>}
   */
  function openMic() {
    if (stream) return Promise.resolve();
    if (!isSupported()) {
      return Promise.reject(new Error('Nettlesaren din støttar ikkje opptak frå mikrofon.'));
    }

    return navigator.mediaDevices.getUserMedia(constraints()).then((granted) => {
      stream = granted;
      const ctx = LS.audio.context();
      if (ctx) {
        sourceNode = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        sourceNode.connect(analyser);
        // Analysenoden blir med vilje IKKJE kopla til høgtalarane —
        // det ville gjeve hyl med ein gong.
      }
    }).catch((err) => {
      closeMic();
      throw new Error(describeError(err));
    });
  }

  function describeError(err) {
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Nettlesaren fekk ikkje lov til å bruke mikrofonen. Du må gje løyve i adressefeltet.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'Fann ingen mikrofon. Sjekk at han er kopla til.';
    }
    if (name === 'NotReadableError') {
      return 'Mikrofonen er i bruk av eit anna program.';
    }
    if (name === 'OverconstrainedError') {
      return 'Den valde mikrofonen finst ikkje lenger. Vel ein annan i lista.';
    }
    return (err && err.message) || 'Klarte ikkje opne mikrofonen.';
  }

  /** Slepper mikrofonen heilt. Trygg å kalle når som helst. */
  function closeMic() {
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch (e) { /* alt stoppa */ }
    }
    recorder = null;
    chunks = [];
    startedAt = 0;

    if (sourceNode) { try { sourceNode.disconnect(); } catch (e) {} sourceNode = null; }
    analyser = null;

    if (stream) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      stream = null;
    }
  }

  /** Høgste utslag frå mikrofonen akkurat no, 0..1. */
  function level() {
    if (!analyser) return 0;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let hi = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i]);
      if (v > hi) hi = v;
    }
    return hi;
  }

  /* ──────────────── Opptaket ──────────────── */

  function start() {
    if (!stream) return Promise.reject(new Error('Mikrofonen er ikkje open.'));
    if (isRecording()) return Promise.resolve();

    chunks = [];
    const mimeType = pickMimeType();
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType: mimeType })
                          : new MediaRecorder(stream);
    } catch (err) {
      return Promise.reject(new Error('Klarte ikkje starte opptaket: ' + (err.message || err.name)));
    }

    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.start();
    startedAt = performance.now();
    return Promise.resolve();
  }

  /**
   * Stoppar opptaket og gjer det om til ei kjelde i lydregisteret.
   * Mikrofonen blir IKKJE sleppt her — brukaren kan ville ta opp meir.
   * @returns {Promise<object|null>} kjelda, eller null om opptaket var tomt
   */
  function stop() {
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: type });
        chunks = [];
        startedAt = 0;

        if (!blob.size) { resolve(null); return; }

        const ctx = LS.audio.context();
        blob.arrayBuffer()
          .then(ab => ctx.decodeAudioData(ab))
          .then(buffer => LS.audio.addBuffer(newName(), buffer))
          .then(resolve)
          .catch(() => reject(new Error('Klarte ikkje lese opptaket.')));
      };
      try { recorder.stop(); } catch (err) { reject(new Error('Klarte ikkje stoppe opptaket.')); }
    });
  }

  /** Opptak 1, Opptak 2 … ut frå kva som alt finst. */
  function newName() {
    const taken = LS.audio.allSources().filter(s => /^Opptak \d+$/.test(s.name)).length;
    return 'Opptak ' + (taken + 1);
  }

  return {
    isSupported, isOpen, isRecording, elapsed,
    inputs, device, useDevice,
    openMic, closeMic, level, start, stop
  };
})();
