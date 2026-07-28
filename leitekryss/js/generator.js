/* Leitekryss — plasserer orda i rutenettet og fyller resten med bokstavar.
   Alt er deterministisk ut frå eit frø, så same frø gjev same rutenett. */
window.LK = window.LK || {};

LK.generator = (function () {
  'use strict';

  const MIN_SIZE = 8;
  const MAX_SIZE = 25;
  const ATTEMPTS = 10;

  /** Retningane orda kan liggje i, per vanskegrad. [radsteg, kolonnesteg] */
  const DIRECTIONS = {
    lett: [[0, 1], [1, 0]],
    middels: [[0, 1], [1, 0], [1, 1], [-1, 1]],
    vanskeleg: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]]
  };

  const DIFFICULTY_LABEL = { lett: 'Lett', middels: 'Middels', vanskeleg: 'Vanskeleg' };

  /** Bokstavar vi fell tilbake på om ordlista er svært kort. */
  const FALLBACK_LETTERS = 'ADEIKLMNORSTUVÅ';

  function directionsFor(difficulty) {
    return DIRECTIONS[difficulty] || DIRECTIONS.middels;
  }

  /* ---- Storleik ---- */

  /** Rutenett som er stort nok til orda, men ikkje større enn naudsynt. */
  function autoSize(words) {
    let longest = 0;
    let total = 0;
    words.forEach(w => {
      longest = Math.max(longest, w.word.length);
      total += w.word.length;
    });
    const byArea = Math.ceil(Math.sqrt(total * 2.4));
    const size = Math.max(MIN_SIZE, byArea);
    return Math.min(MAX_SIZE, Math.max(size, longest + 1, longest));
  }

  /* ---- Plassering ---- */

  function fits(cells, size, word, row, col, dir, allowCrossing) {
    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const r = row + dir[0] * i;
      const c = col + dir[1] * i;
      if (r < 0 || c < 0 || r >= size || c >= size) return null;
      const existing = cells[r * size + c];
      if (!existing) continue;
      if (!allowCrossing || existing !== word[i]) return null;
      crossings++;
    }
    return crossings;
  }

  /** Alle lovlege plasseringar for eit ord, med tal på delte bokstavar. */
  function candidates(cells, size, word, dirs, allowCrossing) {
    const out = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        for (let d = 0; d < dirs.length; d++) {
          const crossings = fits(cells, size, word, r, c, dirs[d], allowCrossing);
          if (crossings != null) out.push({ row: r, col: c, dir: dirs[d], crossings: crossings });
        }
      }
    }
    return out;
  }

  /** Vel tilfeldig, men med overvekt på plasseringar som kryssar andre ord. */
  function pick(list, random) {
    let total = 0;
    for (let i = 0; i < list.length; i++) total += 1 + list[i].crossings * 3;
    let roll = random() * total;
    for (let i = 0; i < list.length; i++) {
      roll -= 1 + list[i].crossings * 3;
      if (roll <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function attempt(words, size, dirs, allowCrossing, random) {
    const cells = new Array(size * size).fill('');
    const placements = [];
    const unplaced = [];
    let crossings = 0;

    // Lengste ord først — dei er vanskelegast å få plass til.
    const ordered = LK.util.shuffle(words, random)
      .sort((a, b) => b.word.length - a.word.length);

    ordered.forEach(entry => {
      const options = candidates(cells, size, entry.word, dirs, allowCrossing);
      if (!options.length) {
        unplaced.push(entry.id);
        return;
      }
      const chosen = pick(options, random);
      for (let i = 0; i < entry.word.length; i++) {
        const r = chosen.row + chosen.dir[0] * i;
        const c = chosen.col + chosen.dir[1] * i;
        cells[r * size + c] = entry.word[i];
      }
      crossings += chosen.crossings;
      placements.push({
        wordId: entry.id,
        row: chosen.row,
        col: chosen.col,
        dr: chosen.dir[0],
        dc: chosen.dir[1],
        len: entry.word.length
      });
    });

    return { cells: cells, placements: placements, unplaced: unplaced, crossings: crossings };
  }

  /* ---- Fyllbokstavar ---- */

  /** Bokstavpose henta frå orda sjølve, så fyllet ikkje skil seg ut. */
  function letterPool(words) {
    let pool = '';
    words.forEach(w => { pool += w.word; });
    const distinct = new Set(pool.split(''));
    if (distinct.size < 8) pool += FALLBACK_LETTERS;
    return pool;
  }

  function fill(cells, size, pool, random) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i]) continue;
      cells[i] = pool[Math.floor(random() * pool.length)];
    }
    return cells;
  }

  /* ---- Bygging ---- */

  /**
   * Lagar eit rutenett av orda.
   * words: [{ id, word }], settings frå LK.state, seed: heiltal.
   */
  function build(words, settings, seed) {
    const usable = words.filter(w => w.word && w.word.length >= 2);
    if (!usable.length) return null;

    const dirs = directionsFor(settings.difficulty);
    const allowCrossing = settings.allowCrossing !== false;
    const random = LK.util.rng(seed);

    let size = settings.size === 'auto'
      ? autoSize(usable)
      : Math.max(MIN_SIZE, Math.min(MAX_SIZE, parseInt(settings.size, 10) || autoSize(usable)));

    let best = null;
    let bestSize = size;
    const grows = settings.size === 'auto' ? 4 : 1;

    for (let g = 0; g < grows; g++) {
      for (let a = 0; a < ATTEMPTS; a++) {
        const result = attempt(usable, size, dirs, allowCrossing, random);
        if (!best ||
            result.unplaced.length < best.unplaced.length ||
            (result.unplaced.length === best.unplaced.length && result.crossings > best.crossings)) {
          best = result;
          bestSize = size;
        }
        if (!result.unplaced.length) break;
      }
      if (best && !best.unplaced.length) break;
      if (size >= MAX_SIZE) break;
      size = Math.min(MAX_SIZE, size + 2);
    }

    const cells = fill(best.cells.slice(), bestSize, letterPool(usable), random);
    const letters = [];
    for (let r = 0; r < bestSize; r++) {
      letters.push(cells.slice(r * bestSize, (r + 1) * bestSize).join(''));
    }

    return {
      cols: bestSize,
      rows: bestSize,
      letters: letters,
      placements: best.placements,
      unplaced: best.unplaced,
      crossings: best.crossings,
      seed: seed,
      difficulty: settings.difficulty
    };
  }

  /** Ruter som høyrer til eit gøymt ord — nøkkel "rad,kolonne". */
  function markedCells(grid) {
    const marks = new Set();
    if (!grid) return marks;
    grid.placements.forEach(p => {
      for (let i = 0; i < p.len; i++) {
        marks.add((p.row + p.dr * i) + ',' + (p.col + p.dc * i));
      }
    });
    return marks;
  }

  /* ---- Vanskegrad og tidsbruk ---- */

  const DIRECTION_NAME = {
    '0,1': 'vassrett', '1,0': 'loddrett', '0,-1': 'baklengs',
    '-1,0': 'oppover', '1,1': 'på skrå', '-1,1': 'på skrå',
    '-1,-1': 'på skrå', '1,-1': 'på skrå'
  };

  /**
   * Grovt overslag over kor lenge ei økt tek, og kor hardt det er.
   * Byggjer på tal ord, storleik, retningar og kor tett orda ligg.
   */
  function stats(grid, settings) {
    if (!grid) return null;
    const found = grid.placements.length;
    const area = grid.cols * grid.rows;
    const letters = grid.placements.reduce((sum, p) => sum + p.len, 0);
    const density = area ? letters / area : 0;

    const perWord = { lett: 0.4, middels: 0.7, vanskeleg: 1.0 }[settings.difficulty] || 0.7;
    const sizeFactor = 0.7 + area / 500;
    const minutes = Math.max(2, Math.round(found * perWord * sizeFactor));

    // Nivået kan skyve seg eitt hakk opp når rutenettet er stort eller tett pakka.
    const levels = ['Lett', 'Middels', 'Vanskeleg', 'Krevjande'];
    let index = ['lett', 'middels', 'vanskeleg'].indexOf(settings.difficulty);
    if (index < 0) index = 1;
    if (found >= 18 || density > 0.55 || area >= 400) index++;
    const level = levels[Math.min(levels.length - 1, index)];

    return {
      words: found,
      minutes: minutes,
      level: level,
      density: density,
      size: grid.cols,
      baseLabel: DIFFICULTY_LABEL[settings.difficulty] || 'Middels'
    };
  }

  /** Kort skildring av retninga eit ord ligg i (brukt i fasiten på skjermen). */
  function directionName(placement) {
    return DIRECTION_NAME[placement.dr + ',' + placement.dc] || 'på skrå';
  }

  return { build, markedCells, stats, directionName, directionsFor, autoSize, MIN_SIZE, MAX_SIZE };
})();
