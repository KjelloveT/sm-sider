/* ══════════════════════════════════════════════
   AUDIO.JS — Lyd i Ljodstigen

   Lyden ligg som fire lydsprites: éin MP3 per bank pluss eit JSON-kart
   med offset og lengd. Fire nettverkskall i staden for tre hundre.

   PLASSHALDARLYD. Så lenge ein bank manglar MP3-fila, lagar vi tonar
   med Web Audio i staden. Kvar id gjev alltid same tone, og dei fire
   bankane har kvar si klangfarge. Det er ikkje tale, og det skal ikkje
   late som — men det gjer at heile spelet kan spelast og testast før
   nokon har vore i studio. Fjern ingenting her når opptaka kjem: det er
   òg naudløysinga om ei fil skulle mangle i produksjon.

   TRE TING SOM MÅ VERE RETTE:
   1. AudioContext startar suspended på iPad. resume() MÅ kallast inne i
      ein click-handler. Det er den vanlegaste grunnen til at lyd ikkje
      verkar på nettbrett, og han feilar heilt stille.
   2. Alt blir dekoda ferdig før første oppgåve.
   3. Feilar noko, seier vi frå. Appen skal aldri berre vere taus.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const BANKS = ['fonem', 'namn', 'ord', 'ros'];
  const PATH = 'lyd/';

  /* Klangfarge per bank, så plasshaldarane er til å skilje frå kvarandre. */
  const TONE = {
    fonem: { type: 'sine',     base: 300, ms: 420 },
    namn:  { type: 'triangle', base: 380, ms: 380 },
    ord:   { type: 'sawtooth', base: 200, ms: 620 },
    ros:   { type: 'square',   base: 520, ms: 300 }
  };

  /* Bankar der ein plasshaldartone er BETRE enn stille, fordi lyden ber
     informasjon oppgåva treng: utan noko å høyre er Ordbyggjaren umogleg
     å prøve i det heile. Ros er derimot pynt — der er stille langt betre
     enn eit pip midt i ekte tale. */
  const TONE_WHEN_MISSING = { fonem: true, namn: true, ord: true, ros: false };

  let ctx = null;
  const buffers = {};     // bank -> AudioBuffer
  const maps = {};        // bank -> { id: [startSek, lengdSek] }
  const missing = new Set();   // bankar utan ekte lyd
  let ready = false;
  let playing = [];       // aktive kjelder, så stop() faktisk stoppar

  function context() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    return ctx;
  }

  /** MÅ kallast frå ein click/touch-handler, elles er iPad taus. */
  function unlock() {
    const c = context();
    if (c && c.state === 'suspended') return c.resume();
    return Promise.resolve();
  }

  function bankOf(id) {
    const p = String(id).split('_')[0];
    return p === 'f' ? 'fonem' : p === 'n' ? 'namn' : p === 'o' ? 'ord' : 'ros';
  }

  /* ──────────────── Lasting ──────────────── */

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + url);
      /* navigationFallback i staticwebapp.config.json skriv om ukjende
         stiar til index.html med status 200. Får vi HTML her, finst ikkje
         fila — sei det tydeleg framfor å la JSON.parse feile kryptisk. */
      const ct = r.headers.get('content-type') || '';
      if (ct.indexOf('html') !== -1) throw new Error('fekk HTML, ikkje JSON: ' + url);
      return r.json();
    });
  }

  function fetchBuffer(url) {
    const c = context();
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status + ' ' + url);
      const ct = r.headers.get('content-type') || '';
      if (ct.indexOf('html') !== -1) throw new Error('fekk HTML, ikkje lyd: ' + url);
      return r.arrayBuffer();
    }).then(function (buf) {
      return new Promise(function (res, rej) { c.decodeAudioData(buf, res, rej); });
    });
  }

  function loadBank(bank) {
    return Promise.all([
      fetchJson(PATH + bank + '.json'),
      fetchBuffer(PATH + bank + '.mp3')
    ]).then(function (r) {
      maps[bank] = r[0].clips || r[0];
      buffers[bank] = r[1];
    }).catch(function (err) {
      /* Ikkje ein feil å bråke om: banken finst berre ikkje enno. */
      missing.add(bank);
      console.info('[Ljodstigen] «' + bank + '» manglar lyd, brukar plasshaldartone. (' + err.message + ')');
    });
  }

  /**
   * Last alle bankar. onProgress(ferdig, totalt) undervegs.
   * Resolvar alltid — manglande bankar blir plasshaldarar, ikkje krasj.
   */
  function load(onProgress) {
    if (!context()) {
      BANKS.forEach(function (b) { missing.add(b); });
      ready = true;
      return Promise.resolve({ ok: false, missing: BANKS.slice() });
    }
    let done = 0;
    return Promise.all(BANKS.map(function (b) {
      return loadBank(b).then(function () {
        done++;
        if (onProgress) onProgress(done, BANKS.length);
      });
    })).then(function () {
      ready = true;
      return { ok: missing.size === 0, missing: BANKS.filter(function (b) { return missing.has(b); }) };
    });
  }

  /* ──────────────── Avspeling ──────────────── */

  function stop() {
    playing.forEach(function (n) { try { n.stop(); } catch (e) {} });
    playing = [];
  }

  /* Ei lovnad som ALLTID blir innfridd.

     onended fyrer ikkje om AudioContext-en blir suspendert medan lyden
     går — fana hamnar i bakgrunnen, skjermen blir slått av, eller
     nettlesaren stoppar lyd av eigen vilje. Utan denne vakta ville
     Ordbyggjaren hengje for alltid etter eit rett ord, sidan han ventar
     på at ordet skal bli ferdig lydert. Ein elev ville sett ei flate
     som aldri gjekk vidare, utan feilmelding. */
  function endedOr(node, seconds) {
    return new Promise(function (res) {
      let done = false;
      const finish = function () { if (!done) { done = true; res(); } };
      node.onended = finish;
      setTimeout(finish, Math.round(seconds * 1000) + 400);
    });
  }

  /* Same id gjev alltid same tone. Ein enkel strenghash held. */
  function pitchFor(id, base) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    /* Halvtonar over grunntonen, halde innanfor eit hyggeleg register. */
    return base * Math.pow(2, (h % 24) / 12);
  }

  function playTone(id) {
    const c = context();
    if (!c) return Promise.resolve();
    const spec = TONE[bankOf(id)] || TONE.fonem;
    const dur = spec.ms / 1000;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = spec.type;
    osc.frequency.value = pitchFor(id, spec.base);
    /* Mjuk inn- og utgang: harde kantar klikkar stygt i høgtalarar. */
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.02);
    gain.gain.setValueAtTime(0.18, c.currentTime + dur - 0.05);
    gain.gain.linearRampToValueAtTime(0, c.currentTime + dur);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(); osc.stop(c.currentTime + dur);
    playing.push(osc);
    return endedOr(osc, dur);
  }

  function playClip(id) {
    const bank = bankOf(id);
    const map = maps[bank];
    const buf = buffers[bank];
    if (!map || !buf || !map[id]) {
      /* Manglar banken, spelar vi tone berre der lyden ber informasjon.
         Elles teier vi: eit syntetisk pip etter kvart einaste svar,
         blanda inn mellom ekte innspelt tale, høyrest ut som ein feil. */
      if (!TONE_WHEN_MISSING[bank]) return Promise.resolve();
      return playTone(id);
    }

    const c = context();
    const at = map[id][0], dur = map[id][1];
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0, at, dur);
    playing.push(src);
    return endedOr(src, dur);
  }

  /** Spel éin lyd. Resolvar når han er ferdig. */
  function play(id) {
    if (!id) return Promise.resolve();
    return unlock().then(function () { return playClip(id); });
  }

  /** Spel fleire etter kvarandre, med valfri pause imellom (ms). */
  function playSeq(ids, gapMs) {
    const gap = gapMs == null ? 120 : gapMs;
    return ids.reduce(function (chain, id) {
      return chain.then(function () {
        return play(id).then(function () {
          return new Promise(function (r) { setTimeout(r, gap); });
        });
      });
    }, Promise.resolve());
  }

  /** Lyder eit ord: kvar lyd for seg, så heile ordet. */
  function sound_out(word, gapMs) {
    const ids = word.letters.map(function (ch) { return 'f_' + ch; });
    return playSeq(ids, gapMs == null ? 260 : gapMs).then(function () {
      return new Promise(function (r) { setTimeout(r, 260); });
    }).then(function () { return play(word.sound); });
  }

  root.LjodAudio = {
    BANKS: BANKS,
    unlock: unlock,
    load: load,
    play: play,
    playSeq: playSeq,
    soundOut: sound_out,
    stop: stop,
    isReady: function () { return ready; },
    /* Kva bankar som køyrer på plasshaldartone. Menyen viser dette. */
    missingBanks: function () { return BANKS.filter(function (b) { return missing.has(b); }); },
    hasRealAudio: function () { return ready && missing.size === 0; }
  };
})(window);
