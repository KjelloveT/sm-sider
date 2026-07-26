/* Ordkryss — flettealgoritmen.

   Rein logikk utan DOM: generate(words, options) gjev tilbake ei layout med
   plasseringar, storleik og eventuelle ord som ikkje fekk plass.

   Framgangsmåte: fleire forsøk med randomisert rekkjefølgje. I kvart forsøk
   blir orda sette inn grådig — for kvart ord blir alle lovlege kryss-posisjonar
   skårlagde, og den beste vald. Til slutt vinn forsøket med best totalskår. */
window.OK = window.OK || {};

OK.generator = (function () {
  'use strict';

  const ACROSS = 'across';
  const DOWN = 'down';

  function key(row, col) { return row + ',' + col; }
  function opposite(dir) { return dir === ACROSS ? DOWN : ACROSS; }

  /* ---- Rutenett under arbeid ---- */

  function newGrid() {
    return { cells: new Map(), placements: [], crossings: 0 };
  }

  /**
   * Kan ordet stå her? Gjev tal på kryss, eller -1 om plasseringa er ulovleg.
   * Reglane sikrar at ingen utilsikta ord oppstår ved sida av kvarandre.
   */
  function fits(grid, answer, row, col, dir) {
    const len = answer.length;
    const dr = dir === DOWN ? 1 : 0;
    const dc = dir === ACROSS ? 1 : 0;
    let crossings = 0;

    // Ruta rett før og rett etter ordet må vere tom.
    if (grid.cells.has(key(row - dr, col - dc))) return -1;
    if (grid.cells.has(key(row + dr * len, col + dc * len))) return -1;

    for (let i = 0; i < len; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const cell = grid.cells.get(key(r, c));

      if (cell) {
        // Same bokstav, og ingen anna ord i same retning gjennom ruta.
        if (cell.ch !== answer[i]) return -1;
        if (cell[dir]) return -1;
        crossings++;
      } else {
        // Tom rute: ingen naboar på sidene, elles blir det utilsikta ord.
        if (grid.cells.has(key(r - dc, c - dr))) return -1;
        if (grid.cells.has(key(r + dc, c + dr))) return -1;
      }
    }
    return crossings;
  }

  function place(grid, wordId, answer, row, col, dir, crossings) {
    const dr = dir === DOWN ? 1 : 0;
    const dc = dir === ACROSS ? 1 : 0;
    for (let i = 0; i < answer.length; i++) {
      const k = key(row + dr * i, col + dc * i);
      const cell = grid.cells.get(k) || { ch: answer[i], across: false, down: false };
      cell.ch = answer[i];
      cell[dir] = true;
      grid.cells.set(k, cell);
    }
    grid.placements.push({ wordId, row, col, dir, length: answer.length });
    grid.crossings += crossings;
  }

  function bounds(grid) {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    grid.cells.forEach((_, k) => {
      const parts = k.split(',');
      const r = +parts[0];
      const c = +parts[1];
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    });
    if (minR === Infinity) return { minR: 0, maxR: -1, minC: 0, maxC: -1, width: 0, height: 0 };
    return { minR, maxR, minC, maxC, width: maxC - minC + 1, height: maxR - minR + 1 };
  }

  /* ---- Val av plassering ---- */

  /**
   * Alle lovlege kryss-plasseringar for eit ord, med skår.
   * Skåren premierer mange kryss og straffar vekst og skeive proporsjonar.
   */
  function candidates(grid, answer) {
    const out = [];
    const box = bounds(grid);
    const oldArea = box.width * box.height;

    grid.placements.forEach(p => {
      const dir = opposite(p.dir);
      const pdr = p.dir === DOWN ? 1 : 0;
      const pdc = p.dir === ACROSS ? 1 : 0;

      for (let j = 0; j < p.length; j++) {
        const cr = p.row + pdr * j;
        const cc = p.col + pdc * j;
        const cell = grid.cells.get(key(cr, cc));
        if (!cell) continue;

        for (let i = 0; i < answer.length; i++) {
          if (answer[i] !== cell.ch) continue;
          const row = dir === DOWN ? cr - i : cr;
          const col = dir === ACROSS ? cc - i : cc;
          const crossings = fits(grid, answer, row, col, dir);
          if (crossings < 1) continue;

          const r2 = dir === DOWN ? row + answer.length - 1 : row;
          const c2 = dir === ACROSS ? col + answer.length - 1 : col;
          const w = Math.max(box.maxC, c2) - Math.min(box.minC, col) + 1;
          const h = Math.max(box.maxR, r2) - Math.min(box.minR, row) + 1;
          const growth = w * h - oldArea;

          const score = crossings * 12 - growth * 0.06 - Math.abs(w - h) * 0.5;
          out.push({ row, col, dir, crossings, score });
        }
      }
    });
    return out;
  }

  /* ---- Eitt forsøk ---- */

  function shuffled(list, rnd) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /** Lengste ord først, men med litt slump så forsøka blir ulike. */
  function orderWords(words, rnd) {
    return words.slice().sort((a, b) => {
      const diff = b.answer.length - a.answer.length;
      if (diff !== 0) return diff;
      return rnd() - 0.5;
    });
  }

  function attempt(words, locked, rnd) {
    const grid = newGrid();
    const placedIds = new Set();

    // Låste ord ligg fast: dei blir sette inn nøyaktig der dei stod.
    locked.forEach(p => {
      const word = words.find(w => w.id === p.wordId);
      if (!word) return;
      const crossings = fits(grid, word.answer, p.row, p.col, p.dir);
      if (crossings < 0) return;
      place(grid, word.id, word.answer, p.row, p.col, p.dir, crossings);
      placedIds.add(word.id);
    });

    const rest = orderWords(words.filter(w => !placedIds.has(w.id)), rnd);
    const unplaced = [];

    rest.forEach(word => {
      if (!grid.placements.length) {
        // Første ordet ligg vassrett i origo.
        place(grid, word.id, word.answer, 0, 0, ACROSS, 0);
        placedIds.add(word.id);
        return;
      }
      const options = candidates(grid, word.answer);
      if (!options.length) {
        unplaced.push(word);
        return;
      }
      options.sort((a, b) => b.score - a.score);
      // Litt slump blant dei aller beste, så «Prøv på nytt» gjev variasjon.
      const top = options.filter(o => o.score >= options[0].score - 0.001);
      const pick = top[Math.floor(rnd() * top.length)];
      place(grid, word.id, word.answer, pick.row, pick.col, pick.dir, pick.crossings);
      placedIds.add(word.id);
    });

    // Ord som skal stå frittståande blir lagde under fletta, med ei tom rad imellom.
    const forced = unplaced.filter(w => w.freestanding);
    const stillUnplaced = unplaced.filter(w => !w.freestanding);
    forced.forEach(word => {
      const box = bounds(grid);
      const row = box.maxR + 2;
      place(grid, word.id, word.answer, row, box.minC, ACROSS, 0);
    });

    const box = bounds(grid);
    const score = grid.crossings * 10
      - box.width * box.height * 0.05
      - stillUnplaced.length * 200
      - Math.abs(box.width - box.height) * 1;

    return { grid: grid, box: box, unplaced: stillUnplaced, score: score };
  }

  /* ---- Nummerering ---- */

  /** Nummererer startrutene rad for rad, slik kryssord vanlegvis gjer. */
  function numberPlacements(placements) {
    const sorted = placements.slice().sort((a, b) => (a.row - b.row) || (a.col - b.col));
    const numbers = new Map();
    let next = 1;
    sorted.forEach(p => {
      const k = key(p.row, p.col);
      if (!numbers.has(k)) numbers.set(k, next++);
      p.number = numbers.get(k);
    });
    return sorted;
  }

  /* ---- Offentleg API ---- */

  /**
   * Flett orda saman.
   * @param {Array} words  [{ id, answer, freestanding }] — answer er alt normalisert
   * @param {Object} opts  { locked: [{wordId,row,col,dir}], attempts, timeBudgetMs, rnd }
   * @returns {Object|null} { cols, rows, placements, crossings, unplaced }
   */
  function generate(words, opts) {
    const options = opts || {};
    const usable = words.filter(w => w.answer && w.answer.length > 1);
    if (!usable.length) return null;

    const locked = options.locked || [];
    const rnd = options.rnd || Math.random;
    const attempts = options.attempts || (usable.length > 30 ? 30 : 60);
    const budget = options.timeBudgetMs || 400;
    const started = Date.now();

    let best = null;
    for (let i = 0; i < attempts; i++) {
      const result = attempt(usable, locked, rnd);
      if (!best || result.score > best.score) best = result;
      if (Date.now() - started > budget) break;
    }
    if (!best) return null;

    // Trim til minste rektangel.
    const box = best.box;
    const placements = best.grid.placements.map(p => ({
      wordId: p.wordId,
      row: p.row - box.minR,
      col: p.col - box.minC,
      dir: p.dir,
      length: p.length
    }));

    return {
      cols: box.width,
      rows: box.height,
      crossings: best.grid.crossings,
      placements: numberPlacements(placements),
      unplaced: best.unplaced.map(w => ({ id: w.id }))
    };
  }

  /**
   * Bokstavkart for ei ferdig layout: "rad,kol" -> { ch, number, wordIds }.
   * Brukt av både skjermvisinga, utskrifta og biletnedlastinga.
   */
  function cellMap(layout, words) {
    const map = new Map();
    if (!layout) return map;
    const byId = new Map(words.map(w => [w.id, w]));

    layout.placements.forEach(p => {
      const word = byId.get(p.wordId);
      if (!word) return;
      const dr = p.dir === DOWN ? 1 : 0;
      const dc = p.dir === ACROSS ? 1 : 0;
      for (let i = 0; i < word.answer.length; i++) {
        const k = key(p.row + dr * i, p.col + dc * i);
        const cell = map.get(k) || { ch: word.answer[i], number: null, wordIds: [] };
        cell.ch = word.answer[i];
        cell.wordIds.push(p.wordId);
        if (i === 0 && cell.number == null) cell.number = p.number;
        map.set(k, cell);
      }
    });
    return map;
  }

  return { generate, cellMap, key, ACROSS, DOWN };
})();
