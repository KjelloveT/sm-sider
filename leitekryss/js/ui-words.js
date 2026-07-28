/* Leitekryss — ordliste-editoren: leggje til, endre, lime inn og slette ord. */
window.LK = window.LK || {};

LK.uiWords = (function () {
  'use strict';

  const el = LK.util.el;
  const state = LK.state;
  let dom = {};

  function init() {
    dom = {
      form: document.getElementById('addForm'),
      input: document.getElementById('wordInput'),
      warn: document.getElementById('addWarn'),
      list: document.getElementById('wordList'),
      empty: document.getElementById('wordEmpty'),
      count: document.getElementById('wordCount'),
      pasteBtn: document.getElementById('pasteBtn'),
      sampleBtn: document.getElementById('sampleBtn'),
      clearBtn: document.getElementById('clearWordsBtn'),
      pasteOverlay: document.getElementById('pasteOverlay'),
      pasteText: document.getElementById('pasteText'),
      pasteWarn: document.getElementById('pasteWarn'),
      pasteConfirm: document.getElementById('pasteConfirm'),
      pasteCancel: document.getElementById('pasteCancel'),
      pasteClose: document.getElementById('pasteClose'),
      sampleOverlay: document.getElementById('sampleOverlay'),
      sampleList: document.getElementById('sampleList'),
      sampleCancel: document.getElementById('sampleCancel'),
      sampleClose: document.getElementById('sampleClose')
    };

    dom.form.addEventListener('submit', onAdd);
    dom.pasteBtn.addEventListener('click', () => {
      dom.pasteWarn.hidden = true;
      LK.util.openModal(dom.pasteOverlay);
    });
    dom.pasteCancel.addEventListener('click', () => LK.util.closeModal(dom.pasteOverlay));
    dom.pasteClose.addEventListener('click', () => LK.util.closeModal(dom.pasteOverlay));
    dom.pasteConfirm.addEventListener('click', onPasteConfirm);
    LK.util.bindOverlayClose(dom.pasteOverlay);

    dom.sampleBtn.addEventListener('click', openSamples);
    dom.sampleCancel.addEventListener('click', () => LK.util.closeModal(dom.sampleOverlay));
    dom.sampleClose.addEventListener('click', () => LK.util.closeModal(dom.sampleOverlay));
    LK.util.bindOverlayClose(dom.sampleOverlay);

    dom.clearBtn.addEventListener('click', onClear);

    state.onChange(topic => {
      if (topic === 'words' || topic === 'grid' || topic === 'load') render();
    });
    render();
  }

  /* ---- Validering ---- */

  function validate(raw, ignoreId) {
    const word = LK.util.normalizeWord(raw);
    if (!word) return { error: 'Ordet må innehalde minst éin bokstav.' };
    if (word.length < 2) return { error: 'Ordet må ha minst to bokstavar.' };
    if (word.length > LK.generator.MAX_SIZE) {
      return { error: 'Ordet kan ikkje vere lengre enn ' + LK.generator.MAX_SIZE + ' bokstavar.' };
    }
    const clash = state.data.words.some(w => w.word === word && w.id !== ignoreId);
    if (clash) return { error: '«' + word + '» står i lista frå før.' };
    return { word: word };
  }

  function showWarn(message) {
    if (!message) {
      dom.warn.hidden = true;
      return;
    }
    dom.warn.textContent = message;
    dom.warn.hidden = false;
  }

  /* ---- Hendingar ---- */

  function onAdd(e) {
    e.preventDefault();
    const check = validate(dom.input.value);
    if (check.error) {
      showWarn(check.error);
      dom.input.focus();
      return;
    }
    showWarn('');
    state.addWord(dom.input.value.trim());
    dom.input.value = '';
    dom.input.focus();
    invalidateGrid();
    state.emit('words');
  }

  /** Ei linje kan innehalde fleire ord skilde med komma eller semikolon. */
  function splitList(text) {
    return text.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
  }

  function onPasteConfirm() {
    const parts = splitList(dom.pasteText.value);
    if (!parts.length) {
      dom.pasteWarn.textContent = 'Lista er tom.';
      dom.pasteWarn.hidden = false;
      return;
    }
    let added = 0;
    let skipped = 0;
    parts.forEach(part => {
      if (validate(part).error) {
        skipped++;
        return;
      }
      state.addWord(part);
      added++;
    });

    if (!added) {
      dom.pasteWarn.textContent = 'Ingen av orda kunne brukast. Kvart ord treng minst to bokstavar.';
      dom.pasteWarn.hidden = false;
      return;
    }
    dom.pasteText.value = '';
    LK.util.closeModal(dom.pasteOverlay);
    invalidateGrid();
    state.emit('words');
    LK.util.toast(skipped
      ? 'La til ' + added + ' ord. ' + skipped + ' blei hoppa over.'
      : 'La til ' + added + ' ord.');
  }

  /* ---- Døme-ordlister ---- */

  function openSamples() {
    dom.sampleList.textContent = '';
    LK.samples.forEach(sample => {
      const row = el('div', 'lk-source-row');
      const text = el('div', 'lk-source-text');
      text.appendChild(el('strong', null, sample.title));
      text.appendChild(el('span', 'lk-muted', sample.note + ' · ' + sample.words.length + ' ord'));
      row.appendChild(text);

      const btn = LK.util.iconButton('sparkles', 'Bruk', 'btn lk-btn-small');
      btn.addEventListener('click', () => useSample(sample));
      row.appendChild(btn);
      dom.sampleList.appendChild(row);
    });
    LK.util.openModal(dom.sampleOverlay);
  }

  function useSample(sample) {
    if (state.data.words.length &&
        !confirm('Dette byter ut ordlista du har no. Halde fram?')) return;
    state.clearWords();
    sample.words.forEach(word => state.addWord(word));
    if (!state.data.title) {
      state.data.title = sample.title;
      const titleInput = document.getElementById('titleInput');
      if (titleInput) titleInput.value = state.data.title;
    }
    LK.util.closeModal(dom.sampleOverlay);
    state.emit('words');
    LK.util.toast('Henta «' + sample.title + '».');
  }

  function onClear() {
    if (!state.data.words.length) return;
    if (!confirm('Vil du tømme heile ordlista?')) return;
    state.clearWords();
    state.emit('words');
  }

  /** Endra ord gjer gjeldande rutenett ugyldig. */
  function invalidateGrid() {
    state.data.grid = null;
  }

  /* ---- Rendering ---- */

  function render() {
    const words = state.data.words;
    dom.list.textContent = '';
    dom.empty.hidden = words.length > 0;
    dom.count.textContent = words.length === 0 ? 'Ingen ord enno' : words.length + ' ord i lista';
    words.forEach((word, index) => dom.list.appendChild(row(word, index)));
  }

  function row(word, index) {
    const node = el('div', 'lk-word-row');
    node.appendChild(el('span', 'lk-word-index', String(index + 1)));

    const input = el('input', 'lk-text-input lk-word-input');
    input.type = 'text';
    input.value = word.text;
    input.maxLength = 30;
    input.setAttribute('aria-label', 'Ord ' + (index + 1));
    input.addEventListener('change', () => {
      const check = validate(input.value, word.id);
      if (check.error) {
        LK.util.toast(check.error);
        input.value = word.text;
        return;
      }
      state.updateWord(word.id, { text: input.value.trim(), word: check.word });
      invalidateGrid();
      state.emit('words');
    });
    node.appendChild(input);

    const letters = el('span', 'lk-word-letters', word.word);
    letters.title = 'Slik ser ordet ut i rutenettet';
    node.appendChild(letters);

    const delBtn = LK.util.iconButton('trash2', '', 'btn lk-icon-btn lk-danger');
    delBtn.setAttribute('aria-label', 'Slett ordet ' + word.word);
    delBtn.addEventListener('click', () => {
      state.removeWord(word.id);
      state.emit('words');
    });
    node.appendChild(delBtn);

    return node;
  }

  return { init, render, validate };
})();
