/* Duldord — brettet: rutene, fargane og animasjonane. */
(function (global) {
  'use strict';

  const { WORD_LENGTH, MAX_GUESSES, scoreGuess } = global.DuldordState;
  const FLIP_STEP = 260;   // forseinking mellom kvar rute som snur
  const FLIP_TIME = 520;   // heile snuinga for ei rute

  let boardEl = null;
  const rows = [];

  function build(container) {
    boardEl = container;
    boardEl.textContent = '';
    rows.length = 0;

    for (let r = 0; r < MAX_GUESSES; r++) {
      const row = document.createElement('div');
      row.className = 'dd-row';
      const tiles = [];
      for (let c = 0; c < WORD_LENGTH; c++) {
        const tile = document.createElement('div');
        tile.className = 'dd-tile';
        const inner = document.createElement('span');
        inner.className = 'dd-tile-face';
        tile.appendChild(inner);
        row.appendChild(tile);
        tiles.push(tile);
      }
      boardEl.appendChild(row);
      rows.push({ row, tiles });
    }
  }

  function setTile(tile, letter, state) {
    tile.querySelector('.dd-tile-face').textContent = letter || '';
    tile.classList.remove('dd-correct', 'dd-present', 'dd-absent', 'dd-filled');
    if (state) tile.classList.add(`dd-${state}`);
    else if (letter) tile.classList.add('dd-filled');
  }

  /** Teiknar heile brettet på nytt utan animasjon. */
  function render(guesses, current, answer) {
    rows.forEach(({ tiles }, r) => {
      if (r < guesses.length) {
        const states = scoreGuess(guesses[r], answer);
        tiles.forEach((tile, c) => setTile(tile, guesses[r][c], states[c]));
      } else if (r === guesses.length) {
        tiles.forEach((tile, c) => setTile(tile, current[c] || '', null));
      } else {
        tiles.forEach(tile => setTile(tile, '', null));
      }
    });
  }

  /** Snur rutene i ei rad etter tur. Løftet blir innfridd når siste rute er ferdig. */
  function reveal(rowIndex, guess, answer) {
    const { tiles } = rows[rowIndex];
    const states = scoreGuess(guess, answer);

    return new Promise(resolve => {
      tiles.forEach((tile, c) => {
        setTimeout(() => {
          tile.classList.add('dd-flip');
          // Fargen blir sett midtvegs, medan ruta står på kant
          setTimeout(() => setTile(tile, guess[c], states[c]), FLIP_TIME / 2);
          setTimeout(() => tile.classList.remove('dd-flip'), FLIP_TIME);
        }, c * FLIP_STEP);
      });
      setTimeout(resolve, (tiles.length - 1) * FLIP_STEP + FLIP_TIME);
    });
  }

  function shake(rowIndex) {
    const { row } = rows[rowIndex];
    row.classList.remove('dd-shake');
    void row.offsetWidth; // tving fram ein reflow så animasjonen kan startast på nytt
    row.classList.add('dd-shake');
    setTimeout(() => row.classList.remove('dd-shake'), 600);
  }

  function bounce(rowIndex) {
    const { tiles } = rows[rowIndex];
    tiles.forEach((tile, c) => {
      setTimeout(() => {
        tile.classList.add('dd-bounce');
        setTimeout(() => tile.classList.remove('dd-bounce'), 700);
      }, c * 90);
    });
  }

  global.DuldordBoard = { build, render, reveal, shake, bounce };
})(window);
