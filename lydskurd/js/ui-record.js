/* ══════════════════════════════════════════════
   UI-RECORD.JS — Dialogen for mikrofonopptak
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.uiRecord = (function () {
  'use strict';

  let overlay = null;
  let trackSelect = null;
  let deviceSelect = null;
  let startAtLabel = null;
  let meterFill = null;
  let statusLine = null;
  let timerLabel = null;
  let micBtn = null;
  let recBtn = null;
  let closeBtn = null;
  let doneBtn = null;
  let countdownBox = null;

  let rafId = 0;
  let countdownTimer = 0;

  /* ──────────────── Løkka som teiknar nivå og tid ──────────────── */

  function tick() {
    if (!LS.record.isOpen()) { rafId = 0; return; }

    const level = LS.record.level();
    meterFill.style.width = Math.round(Math.min(1, level) * 100) + '%';
    meterFill.classList.toggle('ls-meter-hot', level > 0.98);

    if (LS.record.isRecording()) {
      timerLabel.textContent = LS.util.formatTime(LS.record.elapsed(), 1);
    }
    rafId = requestAnimationFrame(tick);
  }

  function startTicking() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  /* ──────────────── Tilstand i dialogen ──────────────── */

  function setStatus(text, kind) {
    statusLine.textContent = text;
    statusLine.className = 'ls-rec-status' + (kind ? ' ls-rec-' + kind : '');
  }

  function syncButtons() {
    const open = LS.record.isOpen();
    const rec = LS.record.isRecording();

    micBtn.hidden = open;
    recBtn.hidden = !open;
    recBtn.textContent = '';
    const span = LS.util.el('span');
    span.innerHTML = ICON(rec ? 'stop' : 'mic', 16);
    recBtn.appendChild(span);
    recBtn.appendChild(document.createTextNode(rec ? 'Stopp opptaket' : 'Start opptak'));
    recBtn.classList.toggle('ls-rec-active', rec);

    trackSelect.disabled = rec;
    deviceSelect.disabled = rec;
    closeBtn.disabled = rec;
    doneBtn.disabled = rec;
    overlay.classList.toggle('ls-recording', rec);
  }

  /* Lista over mikrofonar blir fylt når dialogen blir opna, og på nytt
     når løyvet er gjeve — namna er tomme før det, av di nettlesaren ikkje
     vil at ei side skal kunne kjenne att maskina på lydkorta sine. */
  function fillDevices() {
    const chosen = deviceSelect.value;
    LS.record.inputs().then((list) => {
      deviceSelect.textContent = '';
      const auto = document.createElement('option');
      auto.value = '';
      auto.textContent = 'Standard';
      deviceSelect.appendChild(auto);
      list.forEach((input) => {
        const option = document.createElement('option');
        option.value = input.deviceId;
        option.textContent = input.label;
        deviceSelect.appendChild(option);
      });
      // Held valet om mikrofonen framleis finst; elles fell vi til standard.
      deviceSelect.value = list.some(i => i.deviceId === chosen) ? chosen : '';
      if (deviceSelect.value !== chosen) LS.record.useDevice(deviceSelect.value);
    });
  }

  function changeDevice() {
    if (LS.record.isRecording()) return;
    setStatus('Byter mikrofon …', null);
    LS.record.useDevice(deviceSelect.value).then(() => {
      syncButtons();
      if (LS.record.isOpen()) {
        setStatus('Mikrofonen er bytt. Snakk litt og sjå at målaren rører seg.', 'live');
        startTicking();
      } else {
        setStatus('Mikrofonen er av. Trykk «Slå på mikrofonen» for å sjekke lyden før du tek opp.', null);
      }
    }).catch((err) => {
      setStatus(err.message, 'error');
      syncButtons();
    });
  }

  function fillTracks() {
    trackSelect.textContent = '';
    LS.state.data.tracks.forEach((t, i) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = (i + 1) + '. ' + t.name;
      trackSelect.appendChild(opt);
    });
    // Eit tomt spor er som regel det ein vil ta opp på.
    const empty = LS.state.data.tracks.find(t => !LS.state.clipsOnTrack(t.id).length);
    if (empty) trackSelect.value = empty.id;
  }

  function syncStartAt() {
    startAtLabel.textContent = LS.util.formatTime(LS.state.data.view.playhead, 1);
  }

  /* ──────────────── Opne og lukke ──────────────── */

  function open() {
    if (!LS.record.isSupported()) {
      LS.util.toast('Nettlesaren din støttar ikkje opptak frå mikrofon.');
      return;
    }
    if (LS.audio.isPlaying()) LS.uiToolbar.pause();

    fillTracks();
    fillDevices();
    syncStartAt();
    meterFill.style.width = '0%';
    timerLabel.textContent = '0:00,0';
    countdownBox.hidden = true;
    setStatus('Mikrofonen er av. Trykk «Slå på mikrofonen» for å sjekke lyden før du tek opp.', null);
    syncButtons();
    LS.util.openModal(overlay);
  }

  function close() {
    if (LS.record.isRecording()) return;
    clearTimeout(countdownTimer);
    LS.record.closeMic();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    syncButtons();
    LS.util.closeModal(overlay);
  }

  /* ──────────────── Mikrofonen ──────────────── */

  function turnOnMic() {
    setStatus('Ventar på løyve til å bruke mikrofonen …', null);
    micBtn.disabled = true;

    LS.record.openMic().then(() => {
      micBtn.disabled = false;
      setStatus('Mikrofonen er på. Snakk litt og sjå at målaren rører seg.', 'live');
      syncButtons();
      startTicking();
      fillDevices();
    }).catch((err) => {
      micBtn.disabled = false;
      setStatus(err.message, 'error');
      syncButtons();
    });
  }

  /* ──────────────── Opptaket ──────────────── */

  function toggleRecord() {
    if (LS.record.isRecording()) { finishRecording(); return; }
    countdownThenRecord(3);
  }

  function countdownThenRecord(from) {
    if (from <= 0) {
      countdownBox.hidden = true;
      beginRecording();
      return;
    }
    countdownBox.hidden = false;
    countdownBox.textContent = String(from);
    recBtn.disabled = true;
    countdownTimer = setTimeout(() => countdownThenRecord(from - 1), 700);
  }

  function beginRecording() {
    recBtn.disabled = false;
    LS.record.start().then(() => {
      setStatus('Tek opp no.', 'recording');
      syncButtons();
      startTicking();
    }).catch((err) => {
      setStatus(err.message, 'error');
      syncButtons();
    });
  }

  function finishRecording() {
    setStatus('Handsamar opptaket …', null);
    recBtn.disabled = true;

    LS.record.stop().then((source) => {
      recBtn.disabled = false;
      if (!source) {
        setStatus('Opptaket blei tomt. Prøv igjen.', 'error');
        syncButtons();
        return;
      }
      placeClip(source);
      syncButtons();
    }).catch((err) => {
      recBtn.disabled = false;
      setStatus(err.message, 'error');
      syncButtons();
    });
  }

  /** Legg opptaket på tidslinja der spelehovudet står. */
  function placeClip(source) {
    const trackId = trackSelect.value;
    const track = LS.state.getTrack(trackId) || LS.state.data.tracks[0];
    if (!track) return;

    const wanted = LS.state.data.view.playhead;
    // Same regel som elles: klipp kan ikkje leggje seg oppå kvarandre.
    let at = LS.state.fitInTrack(track.id, wanted, source.duration, null);
    let moved = false;
    if (at == null) { at = LS.state.trackEnd(track.id); moved = true; }
    else if (Math.abs(at - wanted) > 0.001) moved = true;

    LS.state.pushUndo();
    const clip = LS.state.makeClip(source.id, track.id, at, 0, source.duration, source.name);
    LS.state.addClip(clip);
    LS.state.setSelection([clip.id]);
    LS.state.emit('clips');

    syncStartAt();
    setStatus('Opptaket ligg på «' + track.name + '» ved ' + LS.util.formatTime(at, 1) + '.'
      + (moved ? ' Det blei flytta, av di det var opptatt der spelehovudet stod.' : '')
      + ' Du kan ta opp meir, eller lukke.', 'done');
    timerLabel.textContent = '0:00,0';
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup() {
    overlay = document.getElementById('recordOverlay');
    trackSelect = document.getElementById('recordTrack');
    deviceSelect = document.getElementById('recordDevice');
    startAtLabel = document.getElementById('recordStartAt');
    meterFill = document.getElementById('recordMeterFill');
    statusLine = document.getElementById('recordStatus');
    timerLabel = document.getElementById('recordTimer');
    micBtn = document.getElementById('recordMicBtn');
    recBtn = document.getElementById('recordToggleBtn');
    closeBtn = document.getElementById('recordClose');
    doneBtn = document.getElementById('recordDone');
    countdownBox = document.getElementById('recordCountdown');

    const openBtn = document.getElementById('recordBtn');
    if (!LS.record.isSupported()) {
      openBtn.disabled = true;
      openBtn.title = 'Nettlesaren din støttar ikkje opptak frå mikrofon';
    }

    openBtn.addEventListener('click', open);
    micBtn.addEventListener('click', turnOnMic);
    deviceSelect.addEventListener('change', changeDevice);
    if (navigator.mediaDevices && 'ondevicechange' in navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', () => {
        if (overlay.classList.contains('open')) fillDevices();
      });
    }
    recBtn.addEventListener('click', toggleRecord);
    closeBtn.addEventListener('click', close);
    doneBtn.addEventListener('click', close);
    LS.util.bindOverlayClose(overlay);

    // Lukkar brukaren fana midt i eit opptak, skal mikrofonen likevel sleppast.
    window.addEventListener('pagehide', () => LS.record.closeMic());
  }

  return { setup, open };
})();
