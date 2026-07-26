/* Ordkryss — ordliste-editoren: leggje til, endre, lime inn og slette ord. */
window.OK = window.OK || {};

OK.uiWords = (function () {
  'use strict';

  const el = OK.util.el;
  const state = OK.state;

  const SAMPLE = [
    ['rev', 'Lurt dyr med raud pels'],
    ['ekorn', 'Klatrar i tre og gøymer nøtter'],
    ['elg', 'Størst av hjortedyra våre'],
    ['gaupe', 'Den einaste ville katten i Noreg'],
    ['hare', 'Skiftar frå brun til kvit om vinteren'],
    ['ugle', 'Nattfugl med store augo'],
    ['grevling', 'Svart og kvit i fjeset, gravar gangar'],
    ['orrfugl', 'Spelar på myra om våren'],
    ['maur', 'Byggjer tue av barnåler'],
    ['bjørk', 'Tre med kvit stamme']
  ];

  let dom = {};

  function init() {
    dom = {
      form: document.getElementById('addForm'),
      answer: document.getElementById('answerInput'),
      clue: document.getElementById('clueInput'),
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
      pasteClose: document.getElementById('pasteClose')
    };

    dom.form.addEventListener('submit', onAdd);
    dom.pasteBtn.addEventListener('click', () => {
      dom.pasteWarn.hidden = true;
      OK.util.openModal(dom.pasteOverlay);
    });
    dom.pasteCancel.addEventListener('click', () => OK.util.closeModal(dom.pasteOverlay));
    dom.pasteClose.addEventListener('click', () => OK.util.closeModal(dom.pasteOverlay));
    dom.pasteConfirm.addEventListener('click', onPasteConfirm);
    OK.util.bindOverlayClose(dom.pasteOverlay);

    dom.sampleBtn.addEventListener('click', onSample);
    dom.clearBtn.addEventListener('click', onClear);

    state.onChange(topic => {
      if (topic === 'words' || topic === 'layout' || topic === 'load') render();
    });
    render();
  }

  /* ---- Validering ---- */

  function validate(rawAnswer, ignoreId) {
    const answer = OK.util.normalizeAnswer(rawAnswer);
    if (!answer) return { error: 'Ordet må innehalde minst éin bokstav.' };
    if (answer.length < 2) return { error: 'Ordet må ha minst to bokstavar.' };
    if (answer.length > 24) return { error: 'Ordet kan ikkje vere lengre enn 24 bokstavar.' };
    const clash = state.data.words.some(w => w.answer === answer && w.id !== ignoreId);
    if (clash) return { error: '«' + answer + '» står i lista frå før.' };
    return { answer: answer };
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
    const check = validate(dom.answer.value);
    if (check.error) {
      showWarn(check.error);
      dom.answer.focus();
      return;
    }
    showWarn('');
    state.addWord(check.answer, dom.clue.value.trim());
    dom.answer.value = '';
    dom.clue.value = '';
    dom.answer.focus();
    invalidateLayout();
    state.emit('words');
  }

  /** Skil ord og forklaring på semikolon, kolon, tabulator, tankestrek eller loddstrek. */
  function parseLine(line) {
    const match = line.match(/^(.*?)\s*[;:\t|–—]\s*(.*)$/);
    if (match) return { answer: match[1], clue: match[2] };
    return { answer: line, clue: '' };
  }

  function onPasteConfirm() {
    const lines = dom.pasteText.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      dom.pasteWarn.textContent = 'Lista er tom.';
      dom.pasteWarn.hidden = false;
      return;
    }
    let added = 0;
    const skipped = [];
    lines.forEach(line => {
      const parsed = parseLine(line);
      const check = validate(parsed.answer);
      if (check.error) {
        skipped.push(parsed.answer);
        return;
      }
      state.addWord(check.answer, parsed.clue);
      added++;
    });

    if (!added) {
      dom.pasteWarn.textContent = 'Ingen av linjene kunne brukast. Kvar linje treng eit ord på minst to bokstavar.';
      dom.pasteWarn.hidden = false;
      return;
    }
    dom.pasteText.value = '';
    OK.util.closeModal(dom.pasteOverlay);
    invalidateLayout();
    state.emit('words');
    OK.util.toast(skipped.length
      ? 'La til ' + added + ' ord. ' + skipped.length + ' linje(r) blei hoppa over.'
      : 'La til ' + added + ' ord.');
  }

  function onSample() {
    if (state.data.words.length && !confirm('Dette byter ut ordlista du har no. Halde fram?')) return;
    state.clearWords();
    SAMPLE.forEach(pair => {
      state.addWord(OK.util.normalizeAnswer(pair[0]), pair[1]);
    });
    if (!state.data.title) {
      state.data.title = 'Dyr i skogen';
      const titleInput = document.getElementById('titleInput');
      if (titleInput) titleInput.value = state.data.title;
    }
    state.emit('words');
  }

  function onClear() {
    if (!state.data.words.length) return;
    if (!confirm('Vil du tømme heile ordlista?')) return;
    state.clearWords();
    state.emit('words');
  }

  /** Endra ord gjer gjeldande layout ugyldig. */
  function invalidateLayout() {
    state.data.layout = null;
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
    const node = el('div', 'ok-word-row');
    node.appendChild(el('span', 'ok-word-index', String(index + 1)));

    const answerInput = el('input', 'ok-text-input ok-word-answer');
    answerInput.type = 'text';
    answerInput.value = word.answer;
    answerInput.maxLength = 30;
    answerInput.setAttribute('aria-label', 'Ord ' + (index + 1));
    answerInput.addEventListener('change', () => {
      const check = validate(answerInput.value, word.id);
      if (check.error) {
        OK.util.toast(check.error);
        answerInput.value = word.answer;
        return;
      }
      if (check.answer === word.answer) {
        answerInput.value = word.answer;
        return;
      }
      state.updateWord(word.id, { answer: check.answer, locked: false });
      invalidateLayout();
      state.emit('words');
    });
    node.appendChild(answerInput);

    const clueInput = el('input', 'ok-text-input ok-word-clue');
    clueInput.type = 'text';
    clueInput.value = word.clue;
    clueInput.maxLength = 160;
    clueInput.placeholder = 'Forklaring';
    clueInput.setAttribute('aria-label', 'Forklaring til ' + word.answer);
    clueInput.addEventListener('change', () => {
      state.updateWord(word.id, { clue: clueInput.value.trim() });
      state.emit('layout');
    });
    node.appendChild(clueInput);

    const placed = state.placementOf(word.id);
    const lockBtn = OK.util.iconButton(word.locked ? 'lock' : 'unlock', '', 'btn ok-icon-btn');
    lockBtn.setAttribute('aria-label', word.locked
      ? 'Lås opp plasseringa til ' + word.answer
      : 'Lås plasseringa til ' + word.answer);
    lockBtn.setAttribute('aria-pressed', word.locked ? 'true' : 'false');
    lockBtn.title = word.locked ? 'Låst — står stille ved «Prøv på nytt»' : 'Lås plasseringa';
    if (word.locked) lockBtn.classList.add('active');
    lockBtn.disabled = !placed;
    lockBtn.addEventListener('click', () => {
      state.updateWord(word.id, { locked: !word.locked });
      state.emit('words');
    });
    node.appendChild(lockBtn);

    const delBtn = OK.util.iconButton('trash2', '', 'btn ok-icon-btn ok-danger');
    delBtn.setAttribute('aria-label', 'Slett ordet ' + word.answer);
    delBtn.addEventListener('click', () => {
      state.removeWord(word.id);
      invalidateLayout();
      state.emit('words');
    });
    node.appendChild(delBtn);

    return node;
  }

  return { init, render, validate };
})();
