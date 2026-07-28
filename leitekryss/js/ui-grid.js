/* Leitekryss — steg 2: innstillingar for rutenettet, generering og førehandsvising. */
window.LK = window.LK || {};

LK.uiGrid = (function () {
  'use strict';

  const el = LK.util.el;
  const state = LK.state;
  let dom = {};

  function init() {
    dom = {
      difficulty: document.getElementById('difficultySelect'),
      size: document.getElementById('sizeSelect'),
      cross: document.getElementById('crossCheck'),
      generate: document.getElementById('generateBtn'),
      regenerate: document.getElementById('regenerateBtn'),
      toggle: document.getElementById('toggleAnswersBtn'),
      stats: document.getElementById('gridStats'),
      wrap: document.getElementById('gridWrap'),
      empty: document.getElementById('gridEmpty'),
      unplacedBox: document.getElementById('unplacedBox'),
      unplacedList: document.getElementById('unplacedList')
    };

    dom.difficulty.addEventListener('change', () => {
      state.data.settings.difficulty = dom.difficulty.value;
      state.emit('settings');
    });
    dom.size.addEventListener('change', () => {
      state.data.settings.size = dom.size.value === 'auto' ? 'auto' : parseInt(dom.size.value, 10);
      state.emit('settings');
    });
    dom.cross.addEventListener('change', () => {
      state.data.settings.allowCrossing = dom.cross.checked;
      state.emit('settings');
    });

    dom.generate.addEventListener('click', () => generate(true));
    dom.regenerate.addEventListener('click', () => generate(false));
    dom.toggle.addEventListener('click', toggleAnswers);

    state.onChange(topic => {
      if (topic === 'load') syncControls();
      if (topic === 'grid' || topic === 'words' || topic === 'load') render();
    });

    syncControls();
    render();
  }

  function syncControls() {
    const s = state.data.settings;
    dom.difficulty.value = s.difficulty;
    dom.size.value = s.size === 'auto' ? 'auto' : String(s.size);
    dom.cross.checked = s.allowCrossing !== false;
  }

  /* ---- Generering ---- */

  function generate(announce) {
    const words = state.data.words;
    if (words.length < 2) {
      LK.util.toast('Legg til minst to ord først.');
      return;
    }
    const grid = LK.generator.build(words, state.data.settings, LK.util.newSeed());
    if (!grid) {
      LK.util.toast('Fann ingen ord som kunne gøymast.');
      return;
    }
    state.data.grid = grid;
    state.data.showAnswers = false;
    state.emit('grid');

    if (grid.unplaced.length) {
      LK.util.toast(grid.unplaced.length + ' ord fekk ikkje plass. Prøv eit større rutenett.');
    } else if (announce) {
      LK.util.toast('Leitekrysset er klart.');
    }
  }

  function toggleAnswers() {
    if (!state.data.grid) {
      LK.util.toast('Lag leitekrysset først.');
      return;
    }
    state.data.showAnswers = !state.data.showAnswers;
    state.emit('grid');
  }

  /* ---- Rendering ---- */

  function render() {
    const grid = state.data.grid;
    const showAnswers = state.data.showAnswers;

    dom.toggle.setAttribute('aria-pressed', showAnswers ? 'true' : 'false');
    dom.toggle.classList.toggle('active', showAnswers);
    dom.regenerate.disabled = !grid;

    dom.wrap.textContent = '';
    if (!grid) {
      dom.wrap.appendChild(dom.empty);
      dom.empty.hidden = false;
      dom.stats.textContent = '';
      dom.unplacedBox.hidden = true;
      return;
    }
    dom.empty.hidden = true;

    dom.wrap.appendChild(LK.render.gridElement(grid, { showAnswers: showAnswers }));
    renderStats(grid);
    renderUnplaced(grid);

    if (showAnswers) {
      const words = LK.render.placedWords(state.data.words, grid);
      const box = el('div', 'lk-answer-list');
      box.appendChild(el('h3', 'heading4', 'Kvar orda ligg'));
      box.appendChild(LK.render.wordListElement(words, grid, { showDirections: true }));
      dom.wrap.appendChild(box);
    }
  }

  function renderStats(grid) {
    const stats = LK.generator.stats(grid, state.data.settings);
    if (!stats) {
      dom.stats.textContent = '';
      return;
    }
    dom.stats.textContent = stats.words + ' ord gøymde i eit ' + grid.cols + ' × ' + grid.rows +
      '-rutenett · nivå ' + stats.level + ' · omtrent ' + stats.minutes + ' minutt';
  }

  function renderUnplaced(grid) {
    dom.unplacedList.textContent = '';
    dom.unplacedBox.hidden = !grid.unplaced.length;
    if (!grid.unplaced.length) return;

    grid.unplaced.forEach(id => {
      const word = state.getWord(id);
      if (!word) return;
      const row = el('div', 'lk-unplaced-row');
      row.appendChild(el('span', 'lk-unplaced-word', word.word));
      if (word.word.length > grid.cols) {
        row.appendChild(el('span', 'lk-muted',
          'for langt for eit ' + grid.cols + ' × ' + grid.rows + '-rutenett'));
      }

      const delBtn = LK.util.iconButton('trash2', 'Fjern ordet', 'btn lk-btn-small');
      delBtn.addEventListener('click', () => {
        state.removeWord(id);
        state.emit('words');
        generate(false);
      });
      row.appendChild(delBtn);
      dom.unplacedList.appendChild(row);
    });
  }

  return { init, render, generate };
})();
