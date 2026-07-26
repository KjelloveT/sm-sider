/* Ordkryss — knyter modulane saman: arkval, bibliotek, import/eksport. */
window.OK = window.OK || {};

(function () {
  'use strict';

  const el = OK.util.el;
  const state = OK.state;
  let dom = {};

  function init() {
    dom = {
      title: document.getElementById('titleInput'),
      nameField: document.getElementById('nameFieldCheck'),
      answerKey: document.getElementById('answerKeyCheck'),
      print: document.getElementById('printBtn'),
      png: document.getElementById('pngBtn'),
      svg: document.getElementById('svgBtn'),
      save: document.getElementById('saveBtn'),
      exportBtn: document.getElementById('exportBtn'),
      importBtn: document.getElementById('importBtn'),
      importFile: document.getElementById('importFile'),
      libList: document.getElementById('libList'),
      libEmpty: document.getElementById('libEmpty'),
      saveOverlay: document.getElementById('saveOverlay'),
      saveName: document.getElementById('saveNameInput'),
      saveConfirm: document.getElementById('saveConfirm'),
      saveCancel: document.getElementById('saveCancel'),
      saveClose: document.getElementById('saveClose')
    };

    OK.uiWords.init();
    OK.uiLayout.init();
    OK.names.init();

    dom.title.addEventListener('input', () => {
      state.data.title = dom.title.value.trim();
    });
    dom.nameField.addEventListener('change', () => {
      state.data.settings.showNameField = dom.nameField.checked;
    });
    dom.answerKey.addEventListener('change', () => {
      state.data.settings.answerKey = dom.answerKey.checked;
    });

    dom.print.addEventListener('click', OK.print.doPrint);
    dom.png.addEventListener('click', OK.print.downloadPNG);
    dom.svg.addEventListener('click', OK.print.downloadSVG);
    dom.exportBtn.addEventListener('click', onExport);
    dom.importBtn.addEventListener('click', () => dom.importFile.click());
    dom.importFile.addEventListener('change', onImportFile);

    dom.save.addEventListener('click', onSaveClick);
    dom.saveConfirm.addEventListener('click', onSaveConfirm);
    dom.saveCancel.addEventListener('click', () => OK.util.closeModal(dom.saveOverlay));
    dom.saveClose.addEventListener('click', () => OK.util.closeModal(dom.saveOverlay));
    OK.util.bindOverlayClose(dom.saveOverlay);

    state.onChange(topic => {
      if (topic === 'library' || topic === 'load') renderLibrary();
      if (topic === 'load') syncControls();
    });

    renderLibrary();
    syncControls();
  }

  /** Set kontrollane i tråd med tilstanden (etter innlasting av eit lagra kryssord). */
  function syncControls() {
    dom.title.value = state.data.title;
    dom.nameField.checked = state.data.settings.showNameField;
    dom.answerKey.checked = state.data.settings.answerKey;
  }

  /* ---- Lagring ---- */

  function onSaveClick() {
    if (!state.data.words.length) {
      OK.util.toast('Legg til ord først.');
      return;
    }
    dom.saveName.value = state.data.title || '';
    OK.util.openModal(dom.saveOverlay);
  }

  function onSaveConfirm() {
    const name = dom.saveName.value.trim() || state.data.title || 'Utan namn';
    OK.storage.save(name);
    OK.util.closeModal(dom.saveOverlay);
    state.emit('library');
    OK.util.toast('Lagra «' + name + '».');
  }

  function onExport() {
    if (!state.data.words.length) {
      OK.util.toast('Legg til ord først.');
      return;
    }
    OK.storage.exportFile();
  }

  function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = OK.storage.parseFile(String(reader.result));
        state.load(parsed);
        state.data.id = null;               // importert fil er ikkje lagra enno
        state.emit('load');
        state.emit('words');
        state.emit('layout');
        state.emit('names');
        OK.util.toast('Importerte «' + (parsed.name || parsed.title || 'kryssord') + '».');
      } catch (err) {
        OK.util.toast(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ---- Bibliotek ---- */

  function renderLibrary() {
    const items = OK.storage.all().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    dom.libList.textContent = '';
    dom.libEmpty.hidden = items.length > 0;

    items.forEach(item => {
      const row = el('div', 'ok-lib-row');
      const info = el('div', 'ok-lib-info');
      info.appendChild(el('strong', null, item.name || 'Utan namn'));
      const count = (item.words || []).length;
      const date = item.date ? new Date(item.date).toLocaleDateString('nn-NO') : '';
      info.appendChild(el('span', 'ok-muted', count + ' ord' + (date ? ' · ' + date : '')));
      row.appendChild(info);

      const actions = el('div', 'ok-lib-actions');

      const openBtn = OK.util.iconButton('folderOpen', 'Opne', 'btn ok-btn-small');
      openBtn.addEventListener('click', () => {
        state.load(item);
        state.emit('load');
        state.emit('words');
        state.emit('layout');
        state.emit('names');
        OK.util.toast('Opna «' + (item.name || 'kryssord') + '».');
      });
      actions.appendChild(openBtn);

      const renameBtn = OK.util.iconButton('edit', '', 'btn ok-icon-btn');
      renameBtn.setAttribute('aria-label', 'Gi nytt namn til ' + (item.name || 'kryssordet'));
      renameBtn.addEventListener('click', () => {
        const next = prompt('Nytt namn:', item.name || '');
        if (next == null) return;
        const trimmed = next.trim();
        if (!trimmed) return;
        OK.storage.rename(item.id, trimmed);
        state.emit('library');
      });
      actions.appendChild(renameBtn);

      const delBtn = OK.util.iconButton('trash2', '', 'btn ok-icon-btn ok-danger');
      delBtn.setAttribute('aria-label', 'Slett ' + (item.name || 'kryssordet'));
      delBtn.addEventListener('click', () => {
        if (!confirm('Vil du slette «' + (item.name || 'Utan namn') + '»?')) return;
        OK.storage.remove(item.id);
        state.emit('library');
      });
      actions.appendChild(delBtn);

      row.appendChild(actions);
      dom.libList.appendChild(row);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
