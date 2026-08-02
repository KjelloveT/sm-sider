/* sheet.js — arbeidsark som data. Reine funksjonar: ingen DOM, ingen document.
   Genererer oppgåvesett frå eit seed slik at same seed alltid gjev same ark
   (og dermed same fasit). print.js rendrar objekta herifrå. */
(function () {
  'use strict';

  // rekkjefølgja blokkene får på arket — instruksjonslinja skil seg per type
  const TYPE_ORDER = ['choice', 'write', 'draw', 'match'];

  const TYPE_NAMES = {
    choice: 'Fleirval',
    write:  'Skriv svaret',
    draw:   'Teikn visarane',
    match:  'Par saman'
  };

  // klokkestorleik → kolonnetal på A4 (170 mm brukbar breidd)
  const SIZES = {
    small:  { id: 'small',  name: 'Liten',       mm: 26, cols: 4 },
    medium: { id: 'medium', name: 'Medium',      mm: 36, cols: 3 },
    large:  { id: 'large',  name: 'Stor',        mm: 48, cols: 2 },
    xlarge: { id: 'xlarge', name: 'Ekstra stor', mm: 62, cols: 2 }
  };
  const SIZE_ORDER = ['small', 'medium', 'large', 'xlarge'];

  const REPRS = ['analog', 'digital', 'digital24', 'text'];
  const REPR_NAMES = {
    analog: 'Analog', digital: 'Digital 12t', digital24: 'Digital 24t', text: 'Tekst'
  };

  const INSTRUCTIONS = {
    choice: 'Kryss av for rett tid.',
    write:  'Skriv kva klokka er.',
    draw:   'Teikn visarane på urskiva.',
    match:  'Trekk strek mellom para som høyrer saman.'
  };

  const DEFAULTS = {
    title: 'Klokka',
    seed: 0,
    sheets: 1,
    unique: true,
    names: [],
    nameSource: '',
    size: 'medium',
    level: 0,
    perTypeLevel: false,
    nameField: true,
    numbering: true,
    footer: true,
    answerKey: 'one',            // 'none' | 'one' | 'each'
    instructions: INSTRUCTIONS,
    types: {
      choice: { on: true,  count: 9, level: 0, src: 'analog', options: 4 },
      write:  { on: false, count: 6, level: 0, src: 'analog', answerForm: 'digital' },
      draw:   { on: false, count: 6, level: 0, prompt: 'text' },
      match:  { on: false, count: 1, level: 0, pairs: 5, reprs: ['analog', 'text'] }
    }
  };

  /* ---- PRNG ---- */

  // mulberry32 — kompakt, rask og god nok for oppgåvetrekking
  function mulberry32(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    return Math.floor(Math.random() * 900000) + 100000;
  }

  // per-elev-variasjon: same mønster som Leitekryss brukar
  function seedFor(base, index) {
    return ((base + (index + 1) * 7919) % 2147483647) || 1;
  }

  /* ---- Konfigurasjon ---- */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function clampInt(v, lo, hi, fallback) {
    const n = parseInt(v, 10);
    if (isNaN(n)) return fallback;
    return Math.max(lo, Math.min(hi, n));
  }

  // fyller ut manglande felt og klemmer verdiar innanfor lovlege grenser
  function normalize(config) {
    const cfg = clone(DEFAULTS);
    const src = config || {};
    for (const k in src) {
      if (k === 'types' || k === 'instructions') continue;
      if (src[k] !== undefined) cfg[k] = src[k];
    }
    if (src.instructions) {
      for (const k in INSTRUCTIONS) {
        if (src.instructions[k] != null) cfg.instructions[k] = src.instructions[k];
      }
    }
    if (src.types) {
      TYPE_ORDER.forEach(function (kind) {
        const t = src.types[kind];
        if (!t) return;
        for (const k in t) if (t[k] !== undefined) cfg.types[kind][k] = t[k];
      });
    }

    cfg.title = String(cfg.title == null ? '' : cfg.title);
    cfg.seed = clampInt(cfg.seed, 1, 2147483646, randomSeed());
    cfg.sheets = clampInt(cfg.sheets, 1, 30, 1);
    cfg.level = clampInt(cfg.level, 0, 3, 0);
    if (!SIZES[cfg.size]) cfg.size = 'medium';
    cfg.names = (cfg.names || []).filter(function (n) { return !!String(n || '').trim(); });
    if (cfg.answerKey !== 'none' && cfg.answerKey !== 'one' && cfg.answerKey !== 'each') {
      cfg.answerKey = 'one';
    }

    TYPE_ORDER.forEach(function (kind) {
      const t = cfg.types[kind];
      t.on = !!t.on;
      t.count = clampInt(t.count, 0, 30, 0);
      t.level = clampInt(t.level, 0, 3, cfg.level);
      if (kind === 'choice') {
        t.options = [3, 4, 6].indexOf(t.options) === -1 ? 4 : t.options;
        if (REPRS.indexOf(t.src) === -1 && t.src !== 'mix') t.src = 'analog';
      }
      if (kind === 'write') {
        if (REPRS.indexOf(t.src) === -1 && t.src !== 'mix') t.src = 'analog';
        if (['digital', 'digital24', 'text'].indexOf(t.answerForm) === -1) t.answerForm = 'digital';
      }
      if (kind === 'draw') {
        if (['digital', 'digital24', 'text'].indexOf(t.prompt) === -1) t.prompt = 'text';
      }
      if (kind === 'match') {
        t.pairs = [4, 5, 6, 8].indexOf(t.pairs) === -1 ? 5 : t.pairs;
        t.reprs = (t.reprs || []).filter(function (r) { return REPRS.indexOf(r) !== -1; });
        if (t.reprs.length < 2) t.reprs = ['analog', 'text'];
      }
    });

    return cfg;
  }

  function levelFor(cfg, kind) {
    return cfg.perTypeLevel ? cfg.types[kind].level : cfg.level;
  }

  /* ---- Oppgåvegenerering ---- */

  // Éin straum per ark: same PRNG blir sett på TidvisTime og brukt her, slik at
  // eit seed alltid gjev nøyaktig same ark.
  let rng = Math.random;

  function pickSrc(src) {
    if (src !== 'mix') return src;
    return REPRS[Math.floor(rng() * REPRS.length)];
  }

  function timeFor(use24, level) {
    return use24 ? TidvisTime.randomTime24(level) : TidvisTime.randomTime(level);
  }

  // kva form alternativa/fasiten får når kjelda er gjeven som `src`
  function counterForm(src) {
    return src === 'text' ? 'digital' : 'text';
  }

  function makeChoice(t, level) {
    const src = pickSrc(t.src);
    const time = timeFor(src === 'digital24', level);
    const n = t.options;
    const options = TidvisTime.distractorTimes(time, level, n - 1).concat([time]);
    TidvisTime.shuffle(options);
    let answer = options.indexOf(time);
    if (answer === -1) answer = 0;
    return {
      kind: 'choice', level: level, src: src, time: time,
      options: options, answer: answer, optionForm: counterForm(src)
    };
  }

  function makeWrite(t, level) {
    const src = pickSrc(t.src);
    const use24 = src === 'digital24' || t.answerForm === 'digital24';
    return {
      kind: 'write', level: level, src: src,
      time: timeFor(use24, level),
      answerForm: t.answerForm
    };
  }

  function makeDraw(t, level) {
    return {
      kind: 'draw', level: level, prompt: t.prompt,
      time: timeFor(t.prompt === 'digital24', level)
    };
  }

  // ei par-saman-blokk: to ulike representasjonar, venstre i rekkje,
  // høgre stokka om. `order[j]` = kva venstre-indeks høgre rad j svarar til.
  function makeMatch(t, level) {
    const pool = t.reprs.slice();
    TidvisTime.shuffle(pool);
    const leftRepr = pool[0];
    const rightRepr = pool[1];
    const use24 = leftRepr === 'digital24' || rightRepr === 'digital24';

    const times = [];
    const seen = {};
    let guard = 0;
    while (times.length < t.pairs && guard < 300) {
      guard++;
      const cand = timeFor(use24, level);
      const k = TidvisTime.key(cand);
      if (seen[k]) continue;
      seen[k] = true;
      times.push(cand);
    }

    const order = times.map(function (_, i) { return i; });
    for (let tries = 0; tries < 8; tries++) {
      TidvisTime.shuffle(order);
      const identity = order.every(function (v, i) { return v === i; });
      if (!identity || times.length < 2) break;
    }

    return {
      kind: 'match', level: level,
      leftRepr: leftRepr, rightRepr: rightRepr,
      times: times, order: order
    };
  }

  function makeTask(kind, t, level) {
    if (kind === 'choice') return makeChoice(t, level);
    if (kind === 'write') return makeWrite(t, level);
    if (kind === 'draw') return makeDraw(t, level);
    return makeMatch(t, level);
  }

  /* ---- Ark ---- */

  function buildOne(cfg, seed, pupil, index) {
    rng = mulberry32(seed);
    TidvisTime.setRng(rng);
    try {
      const blocks = [];
      let no = 0;
      TYPE_ORDER.forEach(function (kind) {
        const t = cfg.types[kind];
        if (!t.on || t.count < 1) return;
        const level = levelFor(cfg, kind);
        const tasks = [];
        for (let i = 0; i < t.count; i++) {
          const task = makeTask(kind, t, level);
          task.no = ++no;
          tasks.push(task);
        }
        blocks.push({
          kind: kind, level: level,
          instruction: cfg.instructions[kind] || INSTRUCTIONS[kind],
          tasks: tasks
        });
      });
      return { seed: seed, pupil: pupil || '', index: index, blocks: blocks };
    } finally {
      TidvisTime.resetRng();
      rng = Math.random;
    }
  }

  function build(config) {
    const cfg = normalize(config);
    const names = cfg.names;
    const count = names.length ? names.length : cfg.sheets;
    const out = [];
    for (let i = 0; i < count; i++) {
      const seed = cfg.unique ? seedFor(cfg.seed, i) : cfg.seed;
      out.push(buildOne(cfg, seed, names[i] || '', i));
    }
    return out;
  }

  /* ---- Plassrekning ---- */

  const PAGE_H = 269;   // A4-høgd minus 14 mm margar
  const HEAD_H = 26;    // tittel + namnelinje
  const FOOT_H = 12;    // bunntekst
  const INSTR_H = 9;    // instruksjonslinje per blokk

  const GRID_GAP = 4;   // .tv-sheet__grid gap

  // høgd i mm for éi rad i rutenettet, gapet medrekna
  function cellHeight(kind, t, sizeMm) {
    if (kind === 'choice') return sizeMm + 10 + t.options * 4.4 + GRID_GAP;
    if (kind === 'write')  return sizeMm + 10 + 5 + GRID_GAP;
    if (kind === 'draw')   return sizeMm + 10 + 3.5 + GRID_GAP;
    return sizeMm + 10 + GRID_GAP;
  }

  // par-saman-radene bruker ei mindre urskive så to kolonnar får plass
  function matchRowHeight(sizeMm, t) {
    const usesAnalog = t.reprs.indexOf('analog') !== -1;
    return (usesAnalog ? Math.min(sizeMm, 34) : 10) + 5;
  }

  // grov, men ærleg: kor mange mm arket krev, og kor mange sider det blir
  function measure(config) {
    const cfg = normalize(config);
    const size = SIZES[cfg.size];
    let contentMm = 0;
    let tasks = 0;

    TYPE_ORDER.forEach(function (kind) {
      const t = cfg.types[kind];
      if (!t.on || t.count < 1) return;
      contentMm += INSTR_H;
      if (kind === 'match') {
        contentMm += t.count * (t.pairs * matchRowHeight(size.mm, t) + 6);
        tasks += t.count * t.pairs;
      } else {
        const rows = Math.ceil(t.count / size.cols);
        contentMm += rows * cellHeight(kind, t, size.mm);
        tasks += t.count;
      }
    });

    const totalMm = HEAD_H + contentMm + (cfg.footer ? FOOT_H : 0);
    const pages = Math.max(1, Math.ceil(totalMm / PAGE_H));
    return { totalMm: totalMm, pages: pages, tasks: tasks, cols: size.cols };
  }

  // kor mange oppgåver av den valde miksen som får plass på éi side
  function capacityPerPage(config) {
    const cfg = normalize(config);
    const size = SIZES[cfg.size];
    let sumH = 0, kinds = 0;

    TYPE_ORDER.forEach(function (kind) {
      const t = cfg.types[kind];
      if (!t.on || t.count < 1 || kind === 'match') return;
      sumH += cellHeight(kind, t, size.mm);
      kinds++;
    });
    const usable = PAGE_H - HEAD_H - FOOT_H;
    if (!kinds) {
      // berre par saman: rekn i par i staden
      const t = cfg.types.match;
      if (!t.on || t.count < 1) return 0;
      return Math.max(1, Math.floor((usable - INSTR_H) / matchRowHeight(size.mm, t)));
    }
    const avg = sumH / kinds;
    const rows = Math.max(1, Math.floor((usable - INSTR_H * kinds) / avg));
    return rows * size.cols;
  }

  window.TidvisSheet = {
    build: build,
    normalize: normalize,
    measure: measure,
    capacityPerPage: capacityPerPage,
    mulberry32: mulberry32,
    randomSeed: randomSeed,
    seedFor: seedFor,
    levelFor: levelFor,
    counterForm: counterForm,
    TYPE_ORDER: TYPE_ORDER,
    TYPE_NAMES: TYPE_NAMES,
    SIZES: SIZES,
    SIZE_ORDER: SIZE_ORDER,
    REPRS: REPRS,
    REPR_NAMES: REPR_NAMES,
    INSTRUCTIONS: INSTRUCTIONS,
    DEFAULTS: DEFAULTS
  };
})();
