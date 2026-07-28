/* Leitekryss — utskriftsark, fasitsider og nedlasting som bilete. */
window.LK = window.LK || {};

LK.print = (function () {
  'use strict';

  const el = LK.util.el;
  const state = LK.state;

  const INSTRUCTIONS = {
    lett: 'Orda ligg vassrett eller loddrett.',
    middels: 'Orda ligg vassrett, loddrett eller på skrå.',
    vanskeleg: 'Orda ligg vassrett, loddrett eller på skrå — og nokre står baklengs.'
  };

  /* ---- Utskrift ---- */

  /** Rutestorleik i punkt som gjer at rutenettet får plass på A4-breidda. */
  function printCellSize(cols) {
    const usableMm = 170;                       // A4 minus margar
    const px = Math.floor((usableMm * 3.78) / cols);
    return Math.max(12, Math.min(34, px));
  }

  /** Rutenettet for ein elev — eige oppsett når læraren har bede om det. */
  function gridFor(index) {
    const base = state.data.grid;
    if (!state.data.settings.uniquePerPupil || index == null) return base;
    const seed = ((base.seed || 1) + (index + 1) * 7919) % 2147483647;
    return LK.generator.build(state.data.words, state.data.settings, seed) || base;
  }

  function wordListSection(grid) {
    const mode = state.data.settings.showWordList;
    const words = LK.render.placedWords(state.data.words, grid);
    if (mode === 'ingen') return null;

    const box = el('div', 'lk-sheet-words');
    if (mode === 'tal') {
      box.appendChild(el('p', 'lk-sheet-count',
        'Finn ' + words.length + ' gøymde ord i rutenettet.'));
      return box;
    }
    box.appendChild(el('h2', 'lk-sheet-words-head', 'Ord du skal finne'));
    box.appendChild(LK.render.wordListElement(words, grid, { sheet: true }));
    return box;
  }

  function sheet(name, grid, opts) {
    const options = opts || {};
    const node = el('div', 'lk-sheet');
    if (options.answerKey) node.classList.add('lk-sheet-answer');

    const title = state.data.title || 'Leitekryss';
    node.appendChild(el('h1', 'lk-sheet-title', options.answerKey ? title + ' — fasit' : title));

    if (options.answerKey) {
      node.appendChild(el('p', 'lk-sheet-name', name ? 'Fasit — ' + name : 'Fasit'));
    } else if (state.data.settings.showNameField) {
      node.appendChild(el('p', 'lk-sheet-name', 'Namn: ' + (name || '__________________________')));
    }

    if (!options.answerKey) {
      node.appendChild(el('p', 'lk-sheet-hint',
        INSTRUCTIONS[state.data.settings.difficulty] || INSTRUCTIONS.middels));
    }

    node.appendChild(LK.render.gridElement(grid, {
      showAnswers: !!options.answerKey,
      cellSize: printCellSize(grid.cols),
      sheet: true
    }));

    if (options.answerKey) {
      const box = el('div', 'lk-sheet-words');
      box.appendChild(el('h2', 'lk-sheet-words-head', 'Kvar orda ligg'));
      box.appendChild(LK.render.wordListElement(
        LK.render.placedWords(state.data.words, grid), grid,
        { sheet: true, showDirections: true }));
      node.appendChild(box);
    } else {
      const words = wordListSection(grid);
      if (words) node.appendChild(words);
    }

    return node;
  }

  function buildSheets() {
    const area = document.getElementById('printArea');
    area.textContent = '';
    const names = state.data.names;
    const unique = state.data.settings.uniquePerPupil && names.length > 0;
    const answerKey = state.data.settings.answerKey;

    if (!names.length) {
      const grid = state.data.grid;
      area.appendChild(sheet('', grid, {}));
      if (answerKey) area.appendChild(sheet('', grid, { answerKey: true }));
      return area;
    }

    const grids = names.map((name, i) => unique ? gridFor(i) : state.data.grid);
    names.forEach((name, i) => area.appendChild(sheet(name, grids[i], {})));

    if (answerKey) {
      if (unique) {
        names.forEach((name, i) => area.appendChild(sheet(name, grids[i], { answerKey: true })));
      } else {
        area.appendChild(sheet('', state.data.grid, { answerKey: true }));
      }
    }
    return area;
  }

  function doPrint() {
    if (!state.data.grid) {
      LK.util.toast('Lag leitekrysset først.');
      return;
    }
    if (state.data.settings.uniquePerPupil && state.data.names.length > 3) {
      LK.util.toast('Lagar ' + state.data.names.length + ' ulike rutenett …');
    }
    buildSheets();
    window.print();
  }

  /* ---- Bilete ---- */

  function geometry() {
    const grid = state.data.grid;
    const cell = 40;
    const pad = 10;
    return {
      grid: grid,
      cell: cell,
      pad: pad,
      width: grid.cols * cell + pad * 2,
      height: grid.rows * cell + pad * 2,
      marks: state.data.showAnswers ? LK.generator.markedCells(grid) : null
    };
  }

  function escapeXml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildSVG() {
    const g = geometry();
    let body = '';

    for (let r = 0; r < g.grid.rows; r++) {
      const row = g.grid.letters[r] || '';
      for (let c = 0; c < g.grid.cols; c++) {
        const x = g.pad + c * g.cell;
        const y = g.pad + r * g.cell;
        const marked = g.marks && g.marks.has(r + ',' + c);
        body += '<rect x="' + x + '" y="' + y + '" width="' + g.cell + '" height="' + g.cell +
          '" fill="' + (marked ? '#d8d8d8' : '#ffffff') + '" stroke="#1a1a1a" stroke-width="2"/>';
        body += '<text x="' + (x + g.cell / 2) + '" y="' + (y + g.cell / 2 + 7) +
          '" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="' +
          (g.marks && !marked ? '400' : 'bold') + '" fill="' +
          (g.marks && !marked ? '#8a8a8a' : '#1a1a1a') + '">' +
          escapeXml(row[c] || '') + '</text>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + g.width + '" height="' + g.height +
      '" viewBox="0 0 ' + g.width + ' ' + g.height + '">' +
      '<rect width="' + g.width + '" height="' + g.height + '" fill="#ffffff"/>' + body + '</svg>';
  }

  function downloadSVG() {
    if (!state.data.grid) {
      LK.util.toast('Lag leitekrysset først.');
      return;
    }
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    LK.util.downloadBlob(blob, LK.util.slug(state.data.title, 'leitekryss') + '.svg');
  }

  /** Teiknar rutenettet direkte på eit lerret — ingen eksterne bibliotek. */
  function downloadPNG() {
    if (!state.data.grid) {
      LK.util.toast('Lag leitekrysset først.');
      return;
    }
    const g = geometry();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = g.width * scale;
    canvas.height = g.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, g.width, g.height);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < g.grid.rows; r++) {
      const row = g.grid.letters[r] || '';
      for (let c = 0; c < g.grid.cols; c++) {
        const x = g.pad + c * g.cell;
        const y = g.pad + r * g.cell;
        const marked = g.marks && g.marks.has(r + ',' + c);
        ctx.fillStyle = marked ? '#d8d8d8' : '#ffffff';
        ctx.fillRect(x, y, g.cell, g.cell);
        ctx.strokeRect(x, y, g.cell, g.cell);
        ctx.fillStyle = (g.marks && !marked) ? '#8a8a8a' : '#1a1a1a';
        ctx.font = (g.marks && !marked ? '' : 'bold ') + '20px Arial, sans-serif';
        ctx.fillText(row[c] || '', x + g.cell / 2, y + g.cell / 2 + 2);
      }
    }

    canvas.toBlob(blob => {
      LK.util.downloadBlob(blob, LK.util.slug(state.data.title, 'leitekryss') + '.png');
    }, 'image/png');
  }

  return { doPrint, downloadSVG, downloadPNG, buildSheets };
})();
