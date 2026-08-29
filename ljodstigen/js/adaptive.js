/* ══════════════════════════════════════════════
   ADAPTIVE.JS — Progresjonsmotoren i Ljodstigen

   Bygd på same idé som ordaklok/js/leitner.js (boks 0-5 med forfall),
   men med fire skilnader som betyr alt for eit spel som blir spelt i
   ti minutt om gongen av ein seksåring:

   1. TO KLOKKER. Eit element må passere både ei øktklokke (kjem att
      etter N mellomliggjande oppgåver) og ei dagsklokke (Leitner).
      Ordaklok har berre dagsklokka, og der er 1 dag kortaste intervall.
      Eleven møter difor aldri same bokstav to gonger i same økt.

   2. FART TEL. Rett-men-treig forfremjar ikkje. Målet er automatisering,
      ikkje at eleven greier å resonnere seg fram til svaret.

   3. FEILBEVISSTE DISTRAKTORAR. Vi hugsar kva eleven faktisk forvekslar,
      og set aldri to forvekslingsbokstavar opp mot kvarandre før begge
      sit kvar for seg.

   4. FRUSTRASJONSVAKT. To feil på rad tvingar fram ei oppgåve eleven
      garantert klarer. Tre på rad senkar vanskegraden stille.

   maxBox fell aldri. Det er det skogen viser - sjå skog.js.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;

  /* Dagsklokka: kor lenge eit element kviler mellom økter. */
  const DAY_INTERVAL = [0, 0, 1 * DAY, 2 * DAY, 4 * DAY, 8 * DAY];

  /* Øktklokka: kor mange andre oppgåver som skal kome imellom. */
  const SESSION_GAP = [0, 3, 6, 12, 25, 40];

  /* Over dette reknar vi svaret som tenkt fram, ikkje automatisert. */
  const FAST_MS = 4000;

  const MAX_BOX = 5;

  /* Kor mange svaralternativ eleven får, etter kor godt bokstaven sit. */
  function optionCountFor(box) {
    if (box <= 1) return 2;
    if (box <= 3) return 4;
    return 6;
  }

  /* ──────────────── Tilstand ──────────────── */

  function newItem() {
    return { box: 0, maxBox: 0, due: 0, nextAt: 0, right: 0, wrong: 0, avgMs: 0, errors: {} };
  }

  function item(state, ch) {
    if (!state.items[ch]) state.items[ch] = newItem();
    return state.items[ch];
  }

  function newState() {
    return {
      items: {},          // ch -> item
      step: 1,            // kor langt i bokstavstigen
      counter: 0,         // øktklokka si teljing
      streakWrong: 0,
      modesSeen: []
    };
  }

  function clamp(n, lo, hi) {
    n = Math.round(+n || 0);
    return n < lo ? lo : (n > hi ? hi : n);
  }

  /* Toler tilstand frå ein eldre versjon eller frå ei halvskriven fil. */
  function hydrate(raw) {
    const s = newState();
    if (!raw || typeof raw !== 'object') return s;
    if (raw.items && typeof raw.items === 'object') {
      Object.keys(raw.items).forEach(function (ch) {
        const it = raw.items[ch] || {};
        s.items[ch] = {
          box: clamp(it.box, 0, MAX_BOX),
          maxBox: clamp(it.maxBox != null ? it.maxBox : it.box, 0, MAX_BOX),
          due: +it.due || 0,
          nextAt: +it.nextAt || 0,
          right: +it.right || 0,
          wrong: +it.wrong || 0,
          avgMs: +it.avgMs || 0,
          errors: (it.errors && typeof it.errors === 'object') ? it.errors : {}
        };
      });
    }
    s.step = clamp(raw.step, 1, LjodLetters.STEPS.length) || 1;
    s.counter = +raw.counter || 0;
    s.modesSeen = Array.isArray(raw.modesSeen) ? raw.modesSeen : [];
    return s;
  }

  /* ──────────────── Svar ──────────────── */

  /**
   * Registrer eit svar.
   * @param ch          bokstaven oppgåva gjaldt
   * @param correct     var svaret rett
   * @param latencyMs   kor lang tid eleven brukte
   * @param chosen      kva bokstav eleven valde når svaret var feil
   */
  function record(state, ch, correct, latencyMs, chosen) {
    const it = item(state, ch);
    state.counter++;

    if (correct) {
      it.right++;
      state.streakWrong = 0;
      /* Fart tel: berre eit raskt, sikkert svar flyttar bokstaven opp. */
      if (latencyMs <= FAST_MS && it.box < MAX_BOX) it.box++;
    } else {
      it.wrong++;
      state.streakWrong++;
      if (it.box > 0) it.box--;
      if (chosen) it.errors[chosen] = (it.errors[chosen] || 0) + 1;
    }

    /* maxBox er skogen sitt minne. Han går berre opp. Eit tre som
       visnar fordi eleven bomma er ein straffemekanisme retta mot
       nøyaktig dei elevane appen er til for. */
    if (it.box > it.maxBox) it.maxBox = it.box;

    it.avgMs = it.avgMs ? Math.round(it.avgMs * 0.7 + latencyMs * 0.3) : latencyMs;
    it.due = Date.now() + (DAY_INTERVAL[it.box] || 0);
    it.nextAt = state.counter + (SESSION_GAP[it.box] || 0);

    maybeAdvanceStep(state);
    return it;
  }

  /* ──────────────── Bokstavstigen ──────────────── */

  /* Neste steg opnar når alle bortsett frå éin bokstav i det gjeldande
     steget sit. Å krevje alle ville la éin vanskeleg bokstav (typisk r
     eller ein vokal) stengje eleven ute frå nytt stoff i vekevis. */
  function maybeAdvanceStep(state) {
    if (state.step >= LjodLetters.STEPS.length) return false;
    const set = LjodLetters.STEPS[state.step - 1];
    const solid = set.filter(function (ch) { return item(state, ch).maxBox >= 3; }).length;
    if (solid >= set.length - 1) { state.step++; return true; }
    return false;
  }

  function activeLetters(state) {
    return LjodLetters.upTo(state.step);
  }

  /* ──────────────── Val av oppgåve ──────────────── */

  /* Rangering: forfalne på øktklokka først, så lågaste boks. Ein bokstav
     som nettopp var oppe blir skyvd bak i køen. */
  function rank(state, letters, now) {
    return letters.map(function (ch) {
      const it = item(state, ch);
      return {
        ch: ch,
        box: it.box,
        sessionDue: it.nextAt <= state.counter,
        dayDue: (it.due || 0) <= now
      };
    }).sort(function (a, b) {
      if (a.sessionDue !== b.sessionDue) return a.sessionDue ? -1 : 1;
      if (a.dayDue !== b.dayDue) return a.dayDue ? -1 : 1;
      if (a.box !== b.box) return a.box - b.box;
      return 0;
    });
  }

  /**
   * Vel neste oppgåve.
   * @returns { ch, options:[ch...], guaranteed:bool, optionCount }
   */
  function pick(state, opts) {
    opts = opts || {};
    const now = opts.now || Date.now();
    const pool = (opts.pool || activeLetters(state)).slice();
    if (!pool.length) return null;

    /* Frustrasjonsvakt: to feil på rad, og eleven får noko han kan.
       Dette er den viktigaste enkeltmekanismen i heile motoren.

       opts.guarantee tvingar det same fram utan at eleven har bomma.
       Økta brukar det på siste oppgåve, så han alltid sluttar på ein
       siger — det er den som avgjer om appen blir opna i morgon. */
    const guaranteed = opts.guarantee === true || state.streakWrong >= 2;
    let ch;
    if (guaranteed) {
      ch = pool.slice().sort(function (a, b) {
        return item(state, b).maxBox - item(state, a).maxBox;
      })[0];
    } else {
      const ranked = rank(state, pool, now);
      /* Litt tilfeldigheit blant dei tre fremste, så økta ikkje blir
         identisk kvar gong og eleven ikkje lærer rekkjefølgja i staden
         for bokstavane. */
      const top = ranked.slice(0, Math.min(3, ranked.length));
      ch = top[Math.floor(Math.random() * top.length)].ch;
    }

    const box = item(state, ch).box;
    const count = guaranteed ? 2 : optionCountFor(box);
    return {
      ch: ch,
      guaranteed: guaranteed,
      optionCount: count,
      options: distractors(state, ch, count, pool)
    };
  }

  /* ──────────────── Distraktorar ──────────────── */

  /* Ein forvekslingsbokstav blir berre brukt når BEGGE sit kvar for seg
     (boks >= 3). Elles trenar vi inn forvekslinga i staden for bokstaven:
     eleven som ikkje kan b lærer ingenting av å velje mellom b og d. */
  function mayConfuse(state, target, other) {
    if (!LjodLetters.isConfusable(target, other)) return true;
    return item(state, target).maxBox >= 3 && item(state, other).maxBox >= 3;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function distractors(state, target, count, pool) {
    const others = pool.filter(function (c) { return c !== target; });
    const allowed = others.filter(function (c) { return mayConfuse(state, target, c); });
    const errs = item(state, target).errors;

    /* Bokstavar eleven faktisk har forveksla med denne, først. Men berre
       dei som boks-regelen over slepper gjennom. */
    const seen = allowed.filter(function (c) { return errs[c]; })
      .sort(function (a, b) { return errs[b] - errs[a]; });
    const rest = shuffle(allowed.filter(function (c) { return !errs[c]; }));

    const picked = seen.concat(rest).slice(0, Math.max(0, count - 1));
    /* Har vi ikkje nok lovlege alternativ (tidleg i steg 1), fyll opp med
       kva som helst framfor å vise færre knappar enn lova. */
    if (picked.length < count - 1) {
      shuffle(others).forEach(function (c) {
        if (picked.length < count - 1 && picked.indexOf(c) === -1) picked.push(c);
      });
    }
    return shuffle(picked.concat([target]));
  }

  /* ──────────────── Modusar ──────────────── */

  const MODES = [
    { id: 'lydfangst',    label: 'Lydfangst',    needs: 0, box: 0 },
    { id: 'bokstavropet', label: 'Bokstavropet', needs: 3, box: 2 },
    { id: 'ordbyggjar',   label: 'Ordbyggjaren', needs: 3, box: 3 },
    { id: 'forstelyd',    label: 'Første lyd',   needs: 5, box: 3 }
  ];

  function solidCount(state, minBox) {
    return Object.keys(state.items).filter(function (ch) {
      return state.items[ch].maxBox >= minBox;
    }).length;
  }

  function unlockedModes(state) {
    return MODES.filter(function (m) {
      return m.needs === 0 || solidCount(state, m.box) >= m.needs;
    });
  }

  /* Appen foreslår, eleven vel. Autonomi er halve motivasjonen på dette
     trinnet, så forslaget er aldri ei tvang. */
  function suggestMode(state) {
    const open = unlockedModes(state);
    const fresh = open.filter(function (m) { return state.modesSeen.indexOf(m.id) === -1; });
    if (fresh.length) return fresh[0].id;
    return open[open.length - 1].id;
  }

  /* ──────────────── Oversikt ──────────────── */

  function stats(state) {
    const all = LjodLetters.ALPHABET;
    let planted = 0, grown = 0, mastered = 0;
    all.forEach(function (ch) {
      const b = (state.items[ch] || newItem()).maxBox;
      if (b >= 1) planted++;
      if (b >= 3) grown++;
      if (b >= MAX_BOX) mastered++;
    });
    return { planted: planted, grown: grown, mastered: mastered, total: all.length, step: state.step };
  }

  /* Bokstavar som går att som feil. Grunnlaget for læraroversikta. */
  function troubleSpots(state) {
    return Object.keys(state.items).map(function (ch) {
      const it = state.items[ch];
      const total = it.right + it.wrong;
      const confusedWith = Object.keys(it.errors).sort(function (a, b) {
        return it.errors[b] - it.errors[a];
      });
      return {
        ch: ch, box: it.box, maxBox: it.maxBox,
        right: it.right, wrong: it.wrong, avgMs: it.avgMs,
        rate: total ? it.right / total : 0,
        confusedWith: confusedWith
      };
    }).filter(function (r) { return r.wrong > 0; })
      .sort(function (a, b) { return a.rate - b.rate; });
  }

  root.LjodAdaptive = {
    DAY_INTERVAL: DAY_INTERVAL, SESSION_GAP: SESSION_GAP, FAST_MS: FAST_MS, MAX_BOX: MAX_BOX,
    MODES: MODES,
    newState: newState, hydrate: hydrate, item: item,
    record: record, pick: pick, stats: stats,
    activeLetters: activeLetters, unlockedModes: unlockedModes, suggestMode: suggestMode,
    solidCount: solidCount, troubleSpots: troubleSpots, optionCountFor: optionCountFor
  };
})(window);
