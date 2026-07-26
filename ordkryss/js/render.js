/* Ordkryss — teiknar rutenett og forklaringar (DOM, ingen forretningslogikk). */
window.OK = window.OK || {};

OK.render = (function () {
  'use strict';

  const el = OK.util.el;

  /**
   * Byggjer rutenettet som eit element.
   * @param {Object} layout
   * @param {Array} words
   * @param {Object} opts { showAnswers, cellSize, interactive }
   */
  function gridElement(layout, words, opts) {
    const options = opts || {};
    const wrap = el('div', 'ok-grid');
    wrap.style.setProperty('--ok-cols', layout.cols);
    if (options.cellSize) wrap.style.setProperty('--ok-cell', options.cellSize + 'px');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', 'Kryssord med ' + layout.cols + ' ruter i breidda og ' + layout.rows + ' i høgda');

    const cells = OK.generator.cellMap(layout, words);

    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const cell = cells.get(OK.generator.key(r, c));
        if (!cell) {
          wrap.appendChild(el('div', 'ok-cell ok-cell-empty'));
          continue;
        }
        const node = el('div', 'ok-cell');
        // Kvar rute teiknar berre høgre og nedre kant. Venstre og øvre kant
        // kjem berre der det ikkje er ei rute frå før, så ingen linje blir
        // teikna to gonger — det er det som gjer rutenettet beint.
        if (!cells.has(OK.generator.key(r, c - 1))) node.classList.add('ok-edge-left');
        if (!cells.has(OK.generator.key(r - 1, c))) node.classList.add('ok-edge-top');
        node.dataset.words = cell.wordIds.join(' ');
        if (cell.number != null) node.appendChild(el('span', 'ok-cell-num', String(cell.number)));
        if (options.showAnswers) node.appendChild(el('span', 'ok-cell-letter', cell.ch));
        wrap.appendChild(node);
      }
    }
    return wrap;
  }

  /** Forklaringane sorterte etter nummer, delte i vassrett og loddrett. */
  function clueGroups(layout, words) {
    const byId = new Map(words.map(w => [w.id, w]));
    const groups = { across: [], down: [] };
    layout.placements.forEach(p => {
      const word = byId.get(p.wordId);
      if (!word) return;
      groups[p.dir].push({
        wordId: word.id,
        number: p.number,
        clue: word.clue,
        answer: word.answer,
        locked: word.locked
      });
    });
    groups.across.sort((a, b) => a.number - b.number);
    groups.down.sort((a, b) => a.number - b.number);
    return groups;
  }

  /**
   * Fyller ei <ol> med forklaringar.
   * @param {Object} opts { showAnswers, onSelect }
   */
  function fillClueList(list, entries, opts) {
    const options = opts || {};
    list.textContent = '';
    entries.forEach(entry => {
      const li = el('li', 'ok-clue');
      li.dataset.word = entry.wordId;
      li.appendChild(el('span', 'ok-clue-num', entry.number + '.'));

      const text = el('span', 'ok-clue-text', entry.clue || '(inga forklaring)');
      if (!entry.clue) text.classList.add('ok-muted');
      li.appendChild(text);

      if (options.showAnswers) li.appendChild(el('span', 'ok-clue-answer', entry.answer));
      if (entry.locked) {
        const lock = el('span', 'ok-clue-lock');
        lock.innerHTML = ICON('lock', 14);
        lock.title = 'Låst plassering';
        li.appendChild(lock);
      }
      if (options.onSelect) {
        li.tabIndex = 0;
        li.classList.add('ok-clue-clickable');
        li.addEventListener('click', () => options.onSelect(entry.wordId));
        li.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            options.onSelect(entry.wordId);
          }
        });
      }
      list.appendChild(li);
    });
  }

  /** Marker rutene og forklaringa som høyrer til eitt ord. */
  function highlight(root, wordId) {
    root.querySelectorAll('.ok-cell.selected').forEach(n => n.classList.remove('selected'));
    root.querySelectorAll('.ok-clue.selected').forEach(n => n.classList.remove('selected'));
    if (!wordId) return;
    root.querySelectorAll('.ok-cell').forEach(node => {
      const ids = (node.dataset.words || '').split(' ');
      if (ids.indexOf(wordId) !== -1) node.classList.add('selected');
    });
    root.querySelectorAll('.ok-clue').forEach(node => {
      if (node.dataset.word === wordId) node.classList.add('selected');
    });
  }

  return { gridElement, clueGroups, fillClueList, highlight };
})();
