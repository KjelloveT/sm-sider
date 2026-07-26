/* Ordkryss — generering, visning av rutenettet og handtering av restord. */
window.OK = window.OK || {};

OK.uiLayout = (function () {
  'use strict';

  const el = OK.util.el;
  const state = OK.state;
  let dom = {};
  let selected = null;

  function init() {
    dom = {
      generate: document.getElementById('generateBtn'),
      regenerate: document.getElementById('regenerateBtn'),
      toggle: document.getElementById('toggleAnswersBtn'),
      stats: document.getElementById('gridStats'),
      wrap: document.getElementById('gridWrap'),
      empty: document.getElementById('gridEmpty'),
      cluesBox: document.getElementById('cluesPreview'),
      across: document.getElementById('cluesAcross'),
      down: document.getElementById('cluesDown'),
      unplacedBox: document.getElementById('unplacedBox'),
      unplacedList: document.getElementById('unplacedList')
    };

    dom.generate.addEventListener('click', () => generate(false));
    dom.regenerate.addEventListener('click', () => generate(true));
    dom.toggle.addEventListener('click', () => {
      state.data.showAnswers = !state.data.showAnswers;
      state.emit('layout');
    });

    state.onChange(topic => {
      if (topic === 'words' || topic === 'layout' || topic === 'load') render();
    });
    render();
  }

  /**
   * Køyrer generatoren.
   * @param {boolean} keepLocks true = «Prøv på nytt» (låste ord står stille)
   */
  function generate(keepLocks) {
    const words = state.data.words;
    if (words.length < 2) {
      OK.util.toast('Legg til minst to ord først.');
      return;
    }
    const locked = keepLocks ? state.lockedPlacements() : [];
    if (!keepLocks) {
      state.data.words.forEach(w => { w.locked = false; });
    }

    const layout = OK.generator.generate(words, { locked: locked });
    if (!layout) {
      OK.util.toast('Fann ingen måte å flette orda på.');
      return;
    }
    state.data.layout = layout;
    selected = null;
    state.emit('layout');
    state.emit('words');
  }

  /* ---- Restord ---- */

  function renderUnplaced() {
    const layout = state.data.layout;
    const unplaced = layout ? layout.unplaced : [];
    dom.unplacedList.textContent = '';
    dom.unplacedBox.hidden = !unplaced || !unplaced.length;
    if (!unplaced || !unplaced.length) return;

    unplaced.forEach(entry => {
      const word = state.getWord(entry.id);
      if (!word) return;
      const row = el('div', 'ok-unplaced-row');
      row.appendChild(el('strong', 'ok-unplaced-word', word.answer));

      const remove = OK.util.iconButton('trash2', 'Fjern ordet', 'btn ok-btn-small ok-danger');
      remove.addEventListener('click', () => {
        state.removeWord(word.id);
        state.emit('words');
        generate(true);
      });
      row.appendChild(remove);

      const free = OK.util.iconButton('plusCircle', 'Ta med frittståande', 'btn ok-btn-small');
      free.title = 'Ordet blir lagt under fletta utan kryss';
      free.addEventListener('click', () => {
        state.updateWord(word.id, { freestanding: true });
        generate(true);
      });
      row.appendChild(free);

      dom.unplacedList.appendChild(row);
    });
  }

  /* ---- Rendering ---- */

  function render() {
    const layout = state.data.layout;
    const words = state.data.words;

    dom.toggle.setAttribute('aria-pressed', state.data.showAnswers ? 'true' : 'false');
    dom.toggle.classList.toggle('active', state.data.showAnswers);
    dom.regenerate.disabled = !layout;

    dom.wrap.textContent = '';
    if (!layout) {
      dom.wrap.appendChild(dom.empty);
      dom.empty.hidden = false;
      dom.stats.textContent = words.length >= 2
        ? 'Klar til å flette ' + words.length + ' ord.'
        : '';
      dom.cluesBox.hidden = true;
      dom.unplacedBox.hidden = true;
      return;
    }

    const grid = OK.render.gridElement(layout, words, { showAnswers: state.data.showAnswers });
    grid.addEventListener('click', (e) => {
      const cell = e.target.closest('.ok-cell');
      if (!cell || !cell.dataset.words) return;
      const ids = cell.dataset.words.split(' ');
      // Klikkar du fleire gonger i ei kryssrute, byter du mellom orda som møtest der.
      const next = ids[(ids.indexOf(selected) + 1) % ids.length];
      select(next);
    });
    dom.wrap.appendChild(grid);

    dom.stats.textContent = [
      layout.placements.length + ' ord i rutenettet',
      layout.crossings + ' kryss',
      layout.cols + ' × ' + layout.rows + ' ruter'
    ].join(' · ');

    const groups = OK.render.clueGroups(layout, words);
    OK.render.fillClueList(dom.across, groups.across, {
      showAnswers: state.data.showAnswers, onSelect: select
    });
    OK.render.fillClueList(dom.down, groups.down, {
      showAnswers: state.data.showAnswers, onSelect: select
    });
    dom.cluesBox.hidden = false;

    renderUnplaced();
    OK.render.highlight(document, selected);
  }

  function select(wordId) {
    selected = selected === wordId ? null : wordId;
    OK.render.highlight(document, selected);
  }

  return { init, generate, render };
})();
