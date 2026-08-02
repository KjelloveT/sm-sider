/* print.js — byggjer arbeidsarka som DOM i #printArea og kallar window.print().
   Same arkobjekt frå TidvisSheet blir rendra to gonger: ein gong som oppgåve
   og ein gong med answerKey: true som fasit. */
(function () {
  'use strict';

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function el(cls, tag) {
    const e = document.createElement(tag || 'div');
    if (cls) e.className = cls;
    return e;
  }
  function txt(tag, cls, text) {
    const e = el(cls, tag);
    if (text != null) e.textContent = text;
    return e;
  }

  function sizeOf(cfg) {
    return TidvisSheet.SIZES[cfg.size] || TidvisSheet.SIZES.medium;
  }

  // representasjon i utskriftsdrakt — svart på kvitt, mm-basert storleik
  function repr(kind, time, mm, opts) {
    opts = opts || {};
    if (kind === 'analog') {
      return TidvisGame.renderRepr('analog', time, {
        size: mm + 'mm', print: true, hands: opts.hands !== false
      });
    }
    if (kind === 'digital' || kind === 'digital24') {
      const node = TidvisGame.renderRepr('digital', time, {
        label: ' ', size: Math.max(5, Math.round(mm * 0.34)) + 'mm'
      });
      node.classList.add('tv-sheet__lcd');
      return node;
    }
    const node = TidvisGame.renderRepr('text', time, {});
    node.classList.add('tv-sheet__poster');
    return node;
  }

  // ei tid uttrykt som rein tekst i den forma fasiten skal ha
  function answerText(form, time) {
    if (form === 'text') return TidvisTime.toText(time);
    return TidvisTime.toDigital(time);
  }

  /* ---- Oppgåvenodar ---- */

  function taskHead(task, cfg) {
    if (!cfg.numbering) return null;
    return txt('div', 'tv-task__no', String(task.no) + '.');
  }

  function choiceNode(task, cfg, mm, answerKey) {
    const node = el('tv-task tv-task--choice');
    const head = taskHead(task, cfg);
    if (head) node.appendChild(head);
    const src = el('tv-task__src');
    src.appendChild(repr(task.src, task.time, mm));
    node.appendChild(src);

    const list = el('tv-choice');
    task.options.forEach(function (opt, i) {
      const isAnswer = i === task.answer;
      const row = el('tv-choice__opt' + (answerKey && isAnswer ? ' is-answer' : ''));
      row.appendChild(el('tv-box'));
      row.appendChild(txt('span', 'tv-choice__label',
        LETTERS[i] + ') ' + answerText(task.optionForm, opt)));
      list.appendChild(row);
    });
    node.appendChild(list);
    return node;
  }

  function blankNode(form, time, answerKey) {
    const box = el('tv-blank tv-blank--' + (form === 'text' ? 'line' : 'digital'));
    if (form === 'text') {
      if (answerKey) box.appendChild(txt('span', 'tv-blank__fill', TidvisTime.toText(time)));
      return box;
    }
    const digits = TidvisTime.toDigital(time);
    const hh = el('tv-blank__cell');
    const mmCell = el('tv-blank__cell');
    if (answerKey) {
      hh.textContent = digits.slice(0, 2);
      mmCell.textContent = digits.slice(3);
    }
    box.appendChild(hh);
    box.appendChild(txt('span', 'tv-blank__colon', ':'));
    box.appendChild(mmCell);
    return box;
  }

  function writeNode(task, cfg, mm, answerKey) {
    const node = el('tv-task tv-task--write');
    const head = taskHead(task, cfg);
    if (head) node.appendChild(head);
    const src = el('tv-task__src');
    src.appendChild(repr(task.src, task.time, mm));
    node.appendChild(src);
    const ans = el('tv-task__answer');
    ans.appendChild(blankNode(task.answerForm, task.time, answerKey));
    node.appendChild(ans);
    return node;
  }

  function drawNode(task, cfg, mm, answerKey) {
    const node = el('tv-task tv-task--draw');
    const head = taskHead(task, cfg);
    if (head) node.appendChild(head);
    const prompt = el('tv-task__prompt');
    prompt.appendChild(txt('span', 'tv-task__prompttext',
      task.prompt === 'text' ? TidvisTime.toText(task.time) : TidvisTime.toDigital(task.time)));
    node.appendChild(prompt);
    const face = el('tv-task__src');
    face.appendChild(repr('analog', task.time, mm, { hands: !!answerKey }));
    node.appendChild(face);
    return node;
  }

  function matchNode(task, cfg, mm, answerKey) {
    const node = el('tv-match');
    const usesAnalog = task.leftRepr === 'analog' || task.rightRepr === 'analog';
    const cellMm = usesAnalog ? Math.min(mm, 34) : mm;

    const left = el('tv-match__col');
    task.times.forEach(function (time, i) {
      const row = el('tv-match__row');
      row.appendChild(txt('span', 'tv-match__tag', String(i + 1)));
      const body = el('tv-match__body');
      body.appendChild(repr(task.leftRepr, time, cellMm));
      row.appendChild(body);
      left.appendChild(row);
    });

    const right = el('tv-match__col tv-match__col--right');
    task.order.forEach(function (srcIndex, j) {
      const row = el('tv-match__row');
      const body = el('tv-match__body');
      body.appendChild(repr(task.rightRepr, task.times[srcIndex], cellMm));
      row.appendChild(body);
      row.appendChild(txt('span', 'tv-match__tag', LETTERS[j]));
      right.appendChild(row);
    });

    const cols = el('tv-match__cols');
    cols.appendChild(left);
    cols.appendChild(right);
    node.appendChild(cols);

    if (answerKey) {
      const key = el('tv-match__key');
      task.times.forEach(function (_, i) {
        let pos = -1;
        task.order.forEach(function (srcIndex, j) { if (srcIndex === i) pos = j; });
        key.appendChild(txt('span', 'tv-match__keyitem', (i + 1) + ' → ' + LETTERS[pos]));
      });
      node.appendChild(key);
    }
    return node;
  }

  /* ---- Ark ---- */

  function blockNode(block, cfg, answerKey) {
    const size = sizeOf(cfg);
    const node = el('tv-sheet__block tv-sheet__block--' + block.kind);
    node.appendChild(txt('p', 'tv-sheet__instr', block.instruction));

    if (block.kind === 'match') {
      block.tasks.forEach(function (task) {
        node.appendChild(matchNode(task, cfg, size.mm, answerKey));
      });
      return node;
    }

    const grid = el('tv-sheet__grid');
    grid.style.setProperty('--cols', String(size.cols));
    block.tasks.forEach(function (task) {
      if (block.kind === 'choice') grid.appendChild(choiceNode(task, cfg, size.mm, answerKey));
      else if (block.kind === 'write') grid.appendChild(writeNode(task, cfg, size.mm, answerKey));
      else grid.appendChild(drawNode(task, cfg, size.mm, answerKey));
    });
    node.appendChild(grid);
    return node;
  }

  function footNode() {
    const foot = el('tv-sheet__foot');
    const logo = document.createElement('img');
    logo.src = '../_resources/vyrdepil.png';
    logo.alt = '';
    logo.className = 'tv-sheet__logo';
    foot.appendChild(logo);
    foot.appendChild(txt('span', 'tv-sheet__foottext', 'Tidvis · Vyrdepil'));
    return foot;
  }

  function sheetNode(sheet, cfg, opts) {
    const options = opts || {};
    const answerKey = !!options.answerKey;
    const node = el('tv-sheet' + (answerKey ? ' tv-sheet--answer' : ''));
    node.setAttribute('data-size', cfg.size);

    const head = el('tv-sheet__head');
    const title = cfg.title || 'Klokka';
    head.appendChild(txt('h1', 'tv-sheet__title', answerKey ? title + ' — fasit' : title));

    let meta = '';
    if (answerKey) meta = sheet.pupil ? 'Fasit — ' + sheet.pupil : 'Fasit';
    else if (sheet.pupil) meta = 'Namn: ' + sheet.pupil;
    else if (cfg.nameField) meta = 'Namn: ______________________     Dato: ____________';
    if (meta) head.appendChild(txt('p', 'tv-sheet__meta', meta));
    node.appendChild(head);

    const body = el('tv-sheet__body');
    sheet.blocks.forEach(function (block) {
      body.appendChild(blockNode(block, cfg, answerKey));
    });
    node.appendChild(body);

    if (cfg.footer) node.appendChild(footNode());
    return node;
  }

  /* ---- Utskrift ---- */

  // fyller #printArea: alle oppgåveark først, så fasitsidene bakerst
  function buildSheets(config) {
    const cfg = TidvisSheet.normalize(config);
    const area = document.getElementById('printArea');
    if (!area) return null;
    area.textContent = '';

    const sheets = TidvisSheet.build(cfg);
    sheets.forEach(function (sheet) {
      area.appendChild(sheetNode(sheet, cfg, {}));
    });

    if (cfg.answerKey === 'each') {
      sheets.forEach(function (sheet) {
        area.appendChild(sheetNode(sheet, cfg, { answerKey: true }));
      });
    } else if (cfg.answerKey === 'one') {
      area.appendChild(sheetNode(sheets[0], cfg, { answerKey: true }));
    }
    return area;
  }

  function hasTasks(config) {
    const cfg = TidvisSheet.normalize(config);
    return TidvisSheet.TYPE_ORDER.some(function (kind) {
      const t = cfg.types[kind];
      return t.on && t.count > 0;
    });
  }

  function doPrint(config) {
    if (!hasTasks(config)) return false;
    buildSheets(config);
    window.print();
    return true;
  }

  window.TidvisPrint = {
    buildSheets: buildSheets,
    sheetNode: sheetNode,
    doPrint: doPrint,
    hasTasks: hasTasks
  };
})();
