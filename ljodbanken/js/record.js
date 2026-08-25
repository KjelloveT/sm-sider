/* ══════════════════════════════════════════════
   RECORD.JS — Opptak frå mikrofon

   Mikrofonen blir slått på når brukaren ber om det, og han blir
   verande på mellom klippa. Det er poenget med heile verktøyet: skal
   du ta opp 141 klipp på rad, kan du ikkje gje løyve og vente på ein
   ny straum for kvart av dei. Han blir sløkt når du slår han av, når
   sida blir lukka, og når noko går gale.

   Lyden går rett frå mikrofonen inn i minnet. Han blir aldri sendt
   nokon stad.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.record = (function () {
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
      // Så rå lyd som råd. Nettlesaren si støydemping er laga for tale
      // i møte, og ho et byrjinga av korte lydar som /k/ og /t/.
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    };
    /* `exact` gjer at vi får ein feil i staden for ein annan mikrofon om
       den valde er kopla frå. Ei stille innspeling frå feil mikrofon er
       verre enn ei feilmelding. */
    if (wantedDevice) audio.deviceId = { exact: wantedDevice };
    return { audio: audio };
  }

  /* Nettlesarane er ikkje samde om kva MediaRecorder kan skrive. Vi tek
     det første dei godtek. Formatet har lite å seie her — vi dekodar
     opptaket til rå lyd med ein gong det er ferdig. */
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

  function openMic() {
    if (stream) return Promise.resolve();
    if (!isSupported()) {
      return Promise.reject(new Error('Nettlesaren din støttar ikkje opptak frå mikrofon.'));
    }

    return navigator.mediaDevices.getUserMedia(constraints()).then((granted) => {
      stream = granted;
      const ctx = LB.audio.context();
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
    if (!stream) return Promise.reject(new Error('Mikrofonen er ikkje på.'));
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
   * Stoppar opptaket og gjer det om til rå lyd.
   * Mikrofonen blir IKKJE sleppt — neste klipp skal takast med det same.
   * @returns {Promise<AudioBuffer|null>} null når opptaket blei tomt
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

        blob.arrayBuffer()
          .then(ab => LB.audio.decode(ab))
          .then(resolve)
          .catch(() => reject(new Error('Klarte ikkje lese opptaket.')));
      };
      try { recorder.stop(); } catch (err) { reject(new Error('Klarte ikkje stoppe opptaket.')); }
    });
  }

  return {
    isSupported, isOpen, isRecording, elapsed,
    inputs, device, useDevice,
    openMic, closeMic, level, start, stop
  };
})();
