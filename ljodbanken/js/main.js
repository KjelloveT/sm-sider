/* ══════════════════════════════════════════════
   MAIN.JS — Set delane saman

   Modulane veit ingenting om kvarandre sine knappar. Her blir dei
   kopla: verktøyraden, teiknesløyfa som held den aktive rada levande,
   og vakta som spør før du lukkar fana med opptak i minnet.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

(function () {
  'use strict';

  let micBtn = null;
  let micSelect = null;
  let autoBox = null;
  let frame = 0;

  /* ──────────────── Teiknesløyfa ──────────────── */

  /* Berre den aktive rada blir teikna om, og berre så lenge noko er i
     gang. Ei sløyfe som går heile tida ville halde ein bærbar PC vaken
     for ingenting. */
  function loop() {
    const active = LB.session.state();
    if (!active.id) { frame = 0; return; }
    LB.render.updateRow(active.id);
    frame = requestAnimationFrame(loop);
  }

  function onSessionChange() {
    LB.render.updateAll();
    syncMic();
    const active = LB.session.state();
    if (active.id) {
      if (!frame) frame = requestAnimationFrame(loop);
      LB.render.scrollTo(active.id);
    }
  }

  function syncMic() {
    const on = LB.session.micOn();
    micBtn.textContent = '';
    const span = LB.util.el('span');
    span.innerHTML = ICON(on ? 'mic' : 'micOff', 16);
    micBtn.appendChild(span);
    micBtn.appendChild(document.createTextNode(on ? 'Mikrofonen er på' : 'Slå på mikrofonen'));
    micBtn.classList.toggle('lb-mic-on', on);
  }

  /* ──────────────── Kva mikrofon ──────────────── */

  /* Lista blir fylt tre gonger: ved oppstart, etter at løyvet er gjeve
     (då først kjem namna fram), og når nokon koplar til eller frå ein
     mikrofon medan økta går. */
  function fillInputs() {
    const chosen = micSelect.value;
    LB.record.inputs().then((list) => {
      micSelect.textContent = '';
      const auto = LB.util.el('option', null, 'Standard');
      auto.value = '';
      micSelect.appendChild(auto);
      list.forEach((input) => {
        const option = LB.util.el('option', null, input.label);
        option.value = input.deviceId;
        micSelect.appendChild(option);
      });
      // Held valet om mikrofonen framleis finst; elles fell vi til standard.
      micSelect.value = list.some(i => i.deviceId === chosen) ? chosen : '';
      if (micSelect.value !== chosen) LB.record.useDevice(micSelect.value);
    });
  }

  /* ──────────────── Verktøyraden ──────────────── */

  function toggleMic() {
    if (LB.session.micOn()) { LB.session.closeMic(); return; }
    micBtn.disabled = true;
    LB.session.openMic()
      .then(() => { micBtn.disabled = false; syncMic(); fillInputs(); })
      .catch((err) => { micBtn.disabled = false; syncMic(); LB.util.toast(err.message); });
  }

  function nextMissing() {
    const id = LB.state.nextMissing(null);
    if (!id) { LB.util.toast('Alle klippa er spelte inn.'); return; }
    LB.render.scrollTo(id);
    LB.session.record(id);
  }

  function setup() {
    if (!LB.audio.isSupported()) {
      LB.util.toast('Nettlesaren din støttar ikkje Web Audio. Verktøyet vil ikkje verke her.');
    }

    LB.render.setup();
    LB.trim.setup();
    LB.uiExport.setup();
    LB.list.setup();

    micBtn = document.getElementById('micBtn');
    micSelect = document.getElementById('micSelect');
    autoBox = document.getElementById('autoAdvance');

    if (!LB.record.isSupported()) {
      micBtn.disabled = true;
      micBtn.title = 'Nettlesaren din støttar ikkje opptak frå mikrofon';
    }

    micBtn.addEventListener('click', toggleMic);
    micSelect.addEventListener('change', () => {
      LB.session.useDevice(micSelect.value).then(() => {
        if (micSelect.value) LB.util.toast('Mikrofonen er bytt. Ta ein prøve før du held fram.');
      });
    });
    if (navigator.mediaDevices && 'ondevicechange' in navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', fillInputs);
    }
    autoBox.addEventListener('change', () => LB.session.setAuto(autoBox.checked));
    document.getElementById('nextBtn').addEventListener('click', nextMissing);
    document.getElementById('filterSelect').addEventListener('change', (e) => LB.render.setFilter(e.target.value));

    document.getElementById('exportBtn').addEventListener('click', LB.uiExport.open);

    const zipInput = document.getElementById('zipFile');
    document.getElementById('importZipBtn').addEventListener('click', () => zipInput.click());
    zipInput.addEventListener('change', () => {
      if (zipInput.files[0]) LB.uiExport.importZip(zipInput.files[0]);
      zipInput.value = '';
    });

    const listInput = document.getElementById('listFile');
    document.getElementById('listOpenBtn').addEventListener('click', () => listInput.click());
    listInput.addEventListener('change', () => {
      if (listInput.files[0]) LB.list.openFile(listInput.files[0]);
      listInput.value = '';
    });

    document.getElementById('listNewBtn').addEventListener('click', () => LB.list.openEditor('ny'));
    document.getElementById('listEditBtn').addEventListener('click', () => LB.list.openEditor('endre'));
    document.getElementById('listSaveBtn').addEventListener('click', () => {
      const list = LB.state.current();
      if (list) LB.list.saveToFile(list);
    });
    document.getElementById('listBuiltinBtn').addEventListener('click', () => {
      LB.list.use(LB.list.normalize(LB.builtinList));
    });

    const tipsOverlay = document.getElementById('tipsOverlay');
    document.getElementById('tipsBtn').addEventListener('click', () => LB.util.openModal(tipsOverlay));
    document.getElementById('tipsClose').addEventListener('click', () => LB.util.closeModal(tipsOverlay));
    document.getElementById('tipsDone').addEventListener('click', () => LB.util.closeModal(tipsOverlay));
    LB.util.bindOverlayClose(tipsOverlay);

    LB.session.setOnChange(onSessionChange);
    LB.state.subscribe(() => LB.render.updateAll());

    LB.list.use(LB.list.normalize(LB.builtinList), true);
    syncMic();
    fillInputs();

    /* Opptaka ligg berre i minnet. Går fana, går dei — så vi seier frå.
       Nettlesaren viser si eiga tekst; vår er berre eit signal om at
       det finst noko å miste. */
    window.addEventListener('beforeunload', (e) => {
      if (!LB.state.count()) return;
      e.preventDefault();
      e.returnValue = '';
    });

    // Mikrofonen skal sleppast sjølv om fana blir lukka midt i eit opptak.
    window.addEventListener('pagehide', () => LB.record.closeMic());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
