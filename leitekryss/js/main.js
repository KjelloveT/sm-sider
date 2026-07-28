/* Leitekryss — knyter modulane saman: utskrift, bibliotek og import/eksport. */
window.LK = window.LK || {};

(function () {
  'use strict';

  const el = LK.util.el;
  const state = LK.state;
  let dom = {};

  function init() {
    dom = {
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

    LK.uiWords.init();
    LK.uiGrid.init();
    LK.uiSheet.init();
    LK.names.init();

    dom.print.addEventListener('click', LK.print.doPrint);
    dom.png.addEventListener('click', LK.print.downloadPNG);
    dom.svg.addEventListener('click', LK.print.downloadSVG);
    dom.exportBtn.addEventListener('click', onExport);
    dom.importBtn.addEventListener('click', () => dom.importFile.click());
    dom.importFile.addEventListener('change', onImportFile);

    dom.save.addEventListener('click', onSaveClick);
    dom.saveConfirm.addEventListener('click', onSaveConfirm);
    dom.saveCancel.addEventListener('click', () => LK.util.closeModal(dom.saveOverlay));
    dom.saveClose.addEventListener('click', () => LK.util.closeModal(dom.saveOverlay));
    LK.util.bindOverlayClose(dom.saveOverlay);

    state.onChange(topic => {
      if (topic === 'library' || topic === 'load') renderLibrary();
    });

    renderLibrary();
  }

  /* ---- Lagring ---- */

  function onSaveClick() {
    if (!state.data.words.length) {
      LK.util.toast('Legg til ord først.');
      return;
    }
    dom.saveName.value = state.data.title || '';
    LK.util.openModal(dom.saveOverlay);
  }

  function onSaveConfirm() {
    const name = dom.saveName.value.trim() || state.data.title || 'Utan namn';
    LK.storage.save(name);
    LK.util.closeModal(dom.saveOverlay);
    state.emit('library');
    LK.util.toast('Lagra «' + name + '».');
  }

  function onExport() {
    if (!state.data.words.length) {
      LK.util.toast('Legg til ord først.');
      return;
    }
    LK.storage.exportFile();
  }

  function onImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = LK.storage.parseFile(String(reader.result));
        state.load(parsed);
        state.data.id = null;               // importert fil er ikkje lagra enno
        emitAll();
        LK.util.toast('Importerte «' + (parsed.name || parsed.title || 'leitekryss') + '».');
      } catch (err) {
        LK.util.toast(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function emitAll() {
    state.emit('load');
    state.emit('words');
    state.emit('grid');
    state.emit('names');
  }

  /* ---- Bibliotek ---- */

  function renderLibrary() {
    const items = LK.storage.all().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    dom.libList.textContent = '';
    dom.libEmpty.hidden = items.length > 0;

    items.forEach(item => {
      const row = el('div', 'lk-lib-row');
      const info = el('div', 'lk-lib-info');
      info.appendChild(el('strong', null, item.name || 'Utan namn'));
      const count = (item.words || []).length;
      const date = item.date ? new Date(item.date).toLocaleDateString('nn-NO') : '';
      info.appendChild(el('span', 'lk-muted', count + ' ord' + (date ? ' · ' + date : '')));
      row.appendChild(info);

      const actions = el('div', 'lk-lib-actions');

      const openBtn = LK.util.iconButton('folderOpen', 'Opne', 'btn lk-btn-small');
      openBtn.addEventListener('click', () => {
        state.load(item);
        emitAll();
        LK.util.toast('Opna «' + (item.name || 'leitekryss') + '».');
      });
      actions.appendChild(openBtn);

      const renameBtn = LK.util.iconButton('edit', '', 'btn lk-icon-btn');
      renameBtn.setAttribute('aria-label', 'Gi nytt namn til ' + (item.name || 'leitekrysset'));
      renameBtn.addEventListener('click', () => {
        const next = prompt('Nytt namn:', item.name || '');
        if (next == null) return;
        const trimmed = next.trim();
        if (!trimmed) return;
        LK.storage.rename(item.id, trimmed);
        state.emit('library');
      });
      actions.appendChild(renameBtn);

      const delBtn = LK.util.iconButton('trash2', '', 'btn lk-icon-btn lk-danger');
      delBtn.setAttribute('aria-label', 'Slett ' + (item.name || 'leitekrysset'));
      delBtn.addEventListener('click', () => {
        if (!confirm('Vil du slette «' + (item.name || 'Utan namn') + '»?')) return;
        LK.storage.remove(item.id);
        state.emit('library');
      });
      actions.appendChild(delBtn);

      row.appendChild(actions);
      dom.libList.appendChild(row);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
