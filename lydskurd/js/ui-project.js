/* ══════════════════════════════════════════════
   UI-PROJECT.JS — Lagre prosjekt, opne prosjekt, finne att filer
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.uiProject = (function () {
  'use strict';

  let saveOverlay = null;
  let saveName = null;
  let saveInfo = null;
  let saveProgress = null;
  let saveProgressFill = null;
  let saveProgressLabel = null;
  let saveStart = null;
  let saveCancel = null;
  let openFile = null;

  let relinkOverlay = null;
  let relinkList = null;
  let relinkFile = null;
  let pendingMissing = [];
  let relinkTarget = null;
  let busy = false;

  function withAudio() {
    const picked = saveOverlay.querySelector('input[name="saveMode"]:checked');
    return !picked || picked.value === 'audio';
  }

  /* ──────────────── Lagringsdialogen ──────────────── */

  function syncSaveInfo() {
    const seconds = LS.audio.totalSeconds();
    if (withAudio()) {
      // MP3 ved 192 kbit/s, plus ein tredjedel på for base64-innpakninga.
      const bytes = seconds * LS.project.EMBED_KBPS * 1000 / 8 * 4 / 3;
      saveInfo.textContent = 'Om lag ' + LS.util.formatBytes(bytes)
        + '. Lyden blir komprimert til mp3 inni fila, så kvaliteten blir litt lågare når du opnar prosjektet att.';
    } else {
      saveInfo.textContent = 'Nokre få kilobyte. Du må finne lydfilene att sjølv når du opnar prosjektet.';
    }
  }

  function setSaveBusy(on) {
    busy = on;
    saveStart.disabled = on;
    saveCancel.disabled = on;
    saveName.disabled = on;
    saveOverlay.querySelectorAll('input[name="saveMode"]').forEach(r => { r.disabled = on; });
  }

  function openSave() {
    if (!LS.state.data.clips.length) {
      LS.util.toast('Det er ingenting å lagre enno.');
      return;
    }
    if (!saveName.value.trim()) saveName.value = LS.state.data.title || 'lydskurd-prosjekt';
    saveProgress.hidden = true;
    setSaveBusy(false);
    syncSaveInfo();
    LS.util.openModal(saveOverlay);
  }

  function runSave() {
    const embed = withAudio();
    const name = saveName.value.trim() || 'lydskurd-prosjekt';

    setSaveBusy(true);
    saveProgress.hidden = false;
    saveProgressFill.style.width = '5%';
    saveProgressLabel.textContent = embed ? 'Komprimerer lyden …' : 'Skriv fila …';

    setTimeout(() => {
      LS.project.serialize({
        name: name,
        withAudio: embed,
        onProgress: (p) => {
          saveProgressFill.style.width = Math.round(5 + p * 90) + '%';
          saveProgressLabel.textContent = 'Komprimerer lyden … ' + Math.round(p * 100) + '%';
        }
      }).then((project) => {
        const blob = LS.project.toBlob(project);
        LS.state.data.title = name;
        saveProgressFill.style.width = '100%';
        saveProgressLabel.textContent = 'Ferdig — ' + LS.util.formatBytes(blob.size);
        LS.util.downloadBlob(blob, LS.util.slug(name, 'lydskurd-prosjekt') + '.lydskurd');
        setSaveBusy(false);
        LS.util.toast('Prosjektet er lagra (' + LS.util.formatBytes(blob.size) + ').');
        setTimeout(() => { if (!busy) LS.util.closeModal(saveOverlay); }, 900);
      }).catch((err) => {
        setSaveBusy(false);
        saveProgress.hidden = true;
        LS.util.toast(err.message || 'Klarte ikkje lagre prosjektet.');
      });
    }, 60);
  }

  /* ──────────────── Opning ──────────────── */

  function handleOpen(file) {
    if (!file) return;
    LS.util.toast('Opnar prosjektet …');

    file.text()
      .then(text => LS.project.parse(text))
      .then(project => LS.project.load(project))
      .then((result) => {
        LS.state.emit('load');
        pendingMissing = result.missing;
        if (pendingMissing.length) {
          showRelink();
          LS.util.toast(pendingMissing.length + (pendingMissing.length === 1
            ? ' lydfil manglar i prosjektet.' : ' lydfiler manglar i prosjektet.'));
        } else {
          LS.util.toast('Prosjektet er opna.');
        }
      })
      .catch((err) => LS.util.toast(err.message || 'Klarte ikkje opne prosjektet.'));
  }

  /* ──────────────── Finne att filer ──────────────── */

  function showRelink() {
    relinkList.textContent = '';

    pendingMissing.forEach((meta) => {
      const row = LS.util.el('div', 'ls-relink-row');
      const text = LS.util.el('div', 'ls-relink-text');
      text.appendChild(LS.util.el('strong', null, meta.name));
      text.appendChild(LS.util.el('span', 'ls-muted',
        ' — ' + LS.util.formatTime(meta.duration || 0, 1)
        + ((meta.channels === 1) ? ', mono' : ', stereo')));

      const clipCount = LS.state.data.clips.filter(c => c.sourceId === meta.id).length;
      text.appendChild(LS.util.el('div', 'ls-muted',
        clipCount === 1 ? 'Brukt av 1 klipp' : 'Brukt av ' + clipCount + ' klipp'));

      const btn = LS.util.iconButton('upload', 'Finn fila', 'btn ls-btn-small');
      btn.addEventListener('click', () => {
        relinkTarget = meta;
        relinkFile.click();
      });

      row.appendChild(text);
      row.appendChild(btn);
      row.dataset.sourceId = meta.id;
      relinkList.appendChild(row);
    });

    LS.util.openModal(relinkOverlay);
  }

  function handleRelinkFile(file) {
    const meta = relinkTarget;
    relinkTarget = null;
    if (!meta || !file) return;

    LS.project.relink(meta, file).then((result) => {
      if (result.warning) LS.util.toast(result.warning);
      else LS.util.toast('«' + meta.name + '» er kopla til att.');

      pendingMissing = pendingMissing.filter(m => m.id !== meta.id);
      LS.state.emit('load');

      if (!pendingMissing.length) {
        LS.util.closeModal(relinkOverlay);
        LS.util.toast('Alle lydfilene er på plass.');
      } else {
        showRelink();
      }
    }).catch((err) => LS.util.toast(err.message || 'Klarte ikkje lese fila.'));
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup() {
    saveOverlay = document.getElementById('saveOverlay');
    saveName = document.getElementById('saveName');
    saveInfo = document.getElementById('saveInfo');
    saveProgress = document.getElementById('saveProgress');
    saveProgressFill = document.getElementById('saveProgressFill');
    saveProgressLabel = document.getElementById('saveProgressLabel');
    saveStart = document.getElementById('saveStart');
    saveCancel = document.getElementById('saveCancel');
    openFile = document.getElementById('openProjectFile');

    relinkOverlay = document.getElementById('relinkOverlay');
    relinkList = document.getElementById('relinkList');
    relinkFile = document.getElementById('relinkFile');

    document.getElementById('saveProjectBtn').addEventListener('click', openSave);
    document.getElementById('openProjectBtn').addEventListener('click', () => openFile.click());
    document.getElementById('saveClose').addEventListener('click', () => { if (!busy) LS.util.closeModal(saveOverlay); });
    saveCancel.addEventListener('click', () => { if (!busy) LS.util.closeModal(saveOverlay); });
    saveStart.addEventListener('click', runSave);

    saveOverlay.querySelectorAll('input[name="saveMode"]').forEach(r => {
      r.addEventListener('change', syncSaveInfo);
    });

    // Manglar enkodaren, kan lyden ikkje leggjast inn i fila.
    if (!LS.export.hasMp3()) {
      const audioMode = document.getElementById('saveModeAudio');
      audioMode.disabled = true;
      audioMode.closest('.ls-radio-row').classList.add('ls-radio-off');
      document.getElementById('saveModeMeta').checked = true;
    }

    openFile.addEventListener('change', () => {
      if (openFile.files.length) handleOpen(openFile.files[0]);
      openFile.value = '';
    });
    relinkFile.addEventListener('change', () => {
      if (relinkFile.files.length) handleRelinkFile(relinkFile.files[0]);
      relinkFile.value = '';
    });

    document.getElementById('relinkClose').addEventListener('click', () => LS.util.closeModal(relinkOverlay));
    document.getElementById('relinkLater').addEventListener('click', () => LS.util.closeModal(relinkOverlay));

    LS.util.bindOverlayClose(saveOverlay);
    LS.util.bindOverlayClose(relinkOverlay);
  }

  return { setup, openSave };
})();
