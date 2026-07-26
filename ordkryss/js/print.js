/* Ordkryss — utskriftsark, fasitside og nedlasting som bilete. */
window.OK = window.OK || {};

OK.print = (function () {
  'use strict';

  const el = OK.util.el;
  const state = OK.state;

  /* ---- Utskrift ---- */

  /** Rutestorleik i punkt som gjer at rutenettet får plass på A4-breidda. */
  function printCellSize(cols) {
    const usableMm = 170;                       // A4 minus margar
    const px = Math.floor((usableMm * 3.78) / cols);
    return Math.max(14, Math.min(34, px));
  }

  function clueColumn(heading, entries, showAnswers) {
    const box = el('div', 'ok-sheet-clue-col');
    box.appendChild(el('h2', 'ok-sheet-clue-head', heading));
    const list = el('ol', 'ok-clue-list');
    OK.render.fillClueList(list, entries, { showAnswers: showAnswers });
    box.appendChild(list);
    return box;
  }

  function sheet(name, opts) {
    const layout = state.data.layout;
    const words = state.data.words;
    const options = opts || {};
    const node = el('div', 'ok-sheet');
    if (options.answerKey) node.classList.add('ok-sheet-answer');

    const title = state.data.title || 'Kryssord';
    node.appendChild(el('h1', 'ok-sheet-title', options.answerKey ? title + ' — fasit' : title));

    if (options.answerKey) {
      node.appendChild(el('p', 'ok-sheet-name', 'Fasit'));
    } else if (state.data.settings.showNameField) {
      node.appendChild(el('p', 'ok-sheet-name', 'Namn: ' + (name || '__________________________')));
    }

    node.appendChild(OK.render.gridElement(layout, words, {
      showAnswers: !!options.answerKey,
      cellSize: printCellSize(layout.cols)
    }));

    const groups = OK.render.clueGroups(layout, words);
    const clues = el('div', 'ok-sheet-clues');
    clues.appendChild(clueColumn('Vassrett', groups.across, !!options.answerKey));
    clues.appendChild(clueColumn('Loddrett', groups.down, !!options.answerKey));
    node.appendChild(clues);

    return node;
  }

  function buildSheets() {
    const area = document.getElementById('printArea');
    area.textContent = '';
    const names = state.data.names;

    if (names.length) {
      names.forEach(name => area.appendChild(sheet(name, {})));
    } else {
      area.appendChild(sheet('', {}));
    }
    if (state.data.settings.answerKey) {
      area.appendChild(sheet('', { answerKey: true }));
    }
    return area;
  }

  function doPrint() {
    if (!state.data.layout) {
      OK.util.toast('Lag kryssordet først.');
      return;
    }
    buildSheets();
    window.print();
  }

  /* ---- Bilete ---- */

  function gridGeometry() {
    const layout = state.data.layout;
    const cell = 40;
    const pad = 10;
    return {
      layout: layout,
      cell: cell,
      pad: pad,
      width: layout.cols * cell + pad * 2,
      height: layout.rows * cell + pad * 2,
      cells: OK.generator.cellMap(layout, state.data.words)
    };
  }

  function buildSVG() {
    const g = gridGeometry();
    const showAnswers = state.data.showAnswers;
    let body = '';

    for (let r = 0; r < g.layout.rows; r++) {
      for (let c = 0; c < g.layout.cols; c++) {
        const cell = g.cells.get(OK.generator.key(r, c));
        if (!cell) continue;
        const x = g.pad + c * g.cell;
        const y = g.pad + r * g.cell;
        body += '<rect x="' + x + '" y="' + y + '" width="' + g.cell + '" height="' + g.cell +
          '" fill="#ffffff" stroke="#1a1a1a" stroke-width="2"/>';
        if (cell.number != null) {
          body += '<text x="' + (x + 3) + '" y="' + (y + 12) +
            '" font-family="Arial, sans-serif" font-size="10" font-weight="bold" fill="#1a1a1a">' +
            cell.number + '</text>';
        }
        if (showAnswers) {
          body += '<text x="' + (x + g.cell / 2) + '" y="' + (y + g.cell - 10) +
            '" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#1a1a1a">' +
            cell.ch + '</text>';
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + g.width + '" height="' + g.height +
      '" viewBox="0 0 ' + g.width + ' ' + g.height + '">' +
      '<rect width="' + g.width + '" height="' + g.height + '" fill="#ffffff"/>' + body + '</svg>';
  }

  function downloadSVG() {
    if (!state.data.layout) {
      OK.util.toast('Lag kryssordet først.');
      return;
    }
    const blob = new Blob([buildSVG()], { type: 'image/svg+xml' });
    OK.util.downloadBlob(blob, OK.util.slug(state.data.title, 'ordkryss') + '.svg');
  }

  /** Teiknar rutenettet direkte på eit lerret — ingen eksterne bibliotek. */
  function downloadPNG() {
    if (!state.data.layout) {
      OK.util.toast('Lag kryssordet først.');
      return;
    }
    const g = gridGeometry();
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
    ctx.fillStyle = '#1a1a1a';

    for (let r = 0; r < g.layout.rows; r++) {
      for (let c = 0; c < g.layout.cols; c++) {
        const cell = g.cells.get(OK.generator.key(r, c));
        if (!cell) continue;
        const x = g.pad + c * g.cell;
        const y = g.pad + r * g.cell;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, g.cell, g.cell);
        ctx.strokeRect(x, y, g.cell, g.cell);
        ctx.fillStyle = '#1a1a1a';
        if (cell.number != null) {
          ctx.font = 'bold 10px Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(String(cell.number), x + 3, y + 3);
        }
        if (state.data.showAnswers) {
          ctx.font = 'bold 20px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(cell.ch, x + g.cell / 2, y + g.cell / 2 + 3);
        }
      }
    }

    canvas.toBlob(blob => {
      OK.util.downloadBlob(blob, OK.util.slug(state.data.title, 'ordkryss') + '.png');
    }, 'image/png');
  }

  return { doPrint, downloadSVG, downloadPNG, buildSheets };
})();
