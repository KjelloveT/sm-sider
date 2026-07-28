/* Leitekryss — teiknar rutenettet og ordlista, både på skjerm og på arket. */
window.LK = window.LK || {};

LK.render = (function () {
  'use strict';

  const el = LK.util.el;

  /**
   * Rutenettet som DOM-element.
   * opts: { cellSize, showAnswers, sheet }
   */
  function gridElement(grid, opts) {
    const options = opts || {};
    const node = el('div', 'lk-grid');
    node.style.setProperty('--lk-cols', grid.cols);
    if (options.cellSize) node.style.setProperty('--lk-cell', options.cellSize + 'px');
    if (options.sheet) node.classList.add('lk-grid-sheet');

    const marks = options.showAnswers ? LK.generator.markedCells(grid) : null;

    for (let r = 0; r < grid.rows; r++) {
      const row = grid.letters[r] || '';
      for (let c = 0; c < grid.cols; c++) {
        const cell = el('div', 'lk-cell');
        if (r === 0) cell.classList.add('lk-edge-top');
        if (c === 0) cell.classList.add('lk-edge-left');
        if (marks) {
          if (marks.has(r + ',' + c)) cell.classList.add('lk-cell-mark');
          else cell.classList.add('lk-cell-dim');
        }
        cell.appendChild(el('span', 'lk-cell-letter', row[c] || ''));
        node.appendChild(cell);
      }
    }
    return node;
  }

  /** Orda slik dei skal stå i lista — originalteksten i store bokstavar. */
  function displayText(word) {
    return (word.text || word.word).toUpperCase();
  }

  /**
   * Lista over gøymde ord.
   * opts: { showDirections, markUnplaced, sheet }
   */
  function wordListElement(words, grid, opts) {
    const options = opts || {};
    const list = el('ul', 'lk-word-columns' + (options.sheet ? ' lk-word-columns-sheet' : ''));

    words.forEach(word => {
      const placement = grid ? grid.placements.find(p => p.wordId === word.id) : null;
      const item = el('li', 'lk-word-item');
      item.appendChild(el('span', 'lk-word-text', displayText(word)));

      if (options.showDirections && placement) {
        item.appendChild(el('span', 'lk-muted', ' ' + LK.generator.directionName(placement) +
          ' — rad ' + (placement.row + 1) + ', kolonne ' + (placement.col + 1)));
      }
      if (options.markUnplaced && grid && !placement) {
        item.classList.add('lk-word-missing');
        item.appendChild(el('span', 'lk-muted', ' fekk ikkje plass'));
      }
      list.appendChild(item);
    });
    return list;
  }

  /** Orda som faktisk ligg i rutenettet, i same rekkjefølgje som i lista. */
  function placedWords(words, grid) {
    if (!grid) return words.slice();
    return words.filter(w => grid.placements.some(p => p.wordId === w.id));
  }

  return { gridElement, wordListElement, placedWords, displayText };
})();
