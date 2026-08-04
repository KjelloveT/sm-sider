/* Duldord — bindeleddet: styrer kva dag som er open, tek imot tastetrykk
   og held brett, tastatur, lagring og modalar i takt. */
(function (global) {
  'use strict';

  const S = global.DuldordState;
  const Board = global.DuldordBoard;
  const Keyboard = global.DuldordKeyboard;
  const Store = global.DuldordStorage;
  const Stats = global.DuldordStats;
  const Archive = global.DuldordArchive;
  const Dict = global.DuldordDictionary;

  const el = {};
  const state = {
    todayIndex: 0,
    dayIndex: 0,       // dagen som er open no (kan vere ein arkivdag)
    answer: '',
    guesses: [],
    current: '',
    status: 'playing',
    busy: false,       // sann medan rutene snur
    heroHidden: false,
    yearOver: false    // årgangen er brukt opp; då finst det ingen «i dag»
  };

  let messageTimer = null;

  // ── meldingar ────────────────────────────────────────────────────────────
  function say(text, sticky) {
    clearTimeout(messageTimer);
    el.message.textContent = text;
    el.message.classList.toggle('dd-message-on', Boolean(text));
    if (text && !sticky) messageTimer = setTimeout(() => say(''), 2200);
  }

  // ── modalar ──────────────────────────────────────────────────────────────
  function openModal(overlay) {
    overlay.classList.add('open');
    const focusable = overlay.querySelector('button, [href], input, select, textarea');
    if (focusable) focusable.focus();
  }
  function closeModal(overlay) {
    overlay.classList.remove('open');
  }
  function wireModal(overlay) {
    overlay.addEventListener('click', ev => {
      if (ev.target === overlay || ev.target.closest('[data-close]')) closeModal(overlay);
    });
  }

  // ── skjermbilete ─────────────────────────────────────────────────────────
  function hideHero() {
    if (state.heroHidden) return;
    state.heroHidden = true;
    el.hero.classList.add('dd-hero-gone');
  }

  function updateHeader() {
    const isToday = !state.yearOver && state.dayIndex === state.todayIndex;
    el.dayNum.textContent = `Dag ${state.dayIndex + 1}`;
    el.dayNum.classList.toggle('dd-daynum-archive', !isToday);
    el.dayDate.textContent = isToday
      ? 'Dagens ord'
      : S.formatDate(S.dateForIndex(state.dayIndex));

    // Arkivet opnar seg fyrst når dagens ord er ferdigspelt. Er årgangen omme,
    // finst det ikkje noko dagens ord å vente på, og arkivet er alltid ope.
    if (state.yearOver) {
      el.archiveBtn.hidden = false;
    } else {
      const todayDay = Store.getDay(state.todayIndex);
      el.archiveBtn.hidden = state.todayIndex <= 0 || !todayDay || todayDay.status === 'playing';
    }

    el.backBtn.hidden = isToday || state.yearOver;
  }

  function updateFootnote() {
    const total = S.wordCount();
    if (!state.yearOver && state.dayIndex === state.todayIndex) {
      el.footnote.textContent = `Dag ${state.dayIndex + 1} av ${total} i den fyrste årgangen.`;
    } else {
      el.footnote.textContent = 'Du speler ein tidlegare dag.';
    }
  }

  function repaint() {
    Board.render(state.guesses, state.current, state.answer);
    Keyboard.paint(S.letterStates(state.guesses, state.answer));
    updateHeader();
    updateFootnote();
  }

  // ── last inn ein dag ─────────────────────────────────────────────────────
  function openDay(index) {
    state.dayIndex = index;
    state.answer = S.wordForIndex(index);
    const saved = Store.getDay(index);
    state.guesses = saved ? saved.guesses.slice() : [];
    state.status = saved ? saved.status : 'playing';
    state.current = '';
    state.busy = false;

    repaint();
    say('');

    if (state.status === 'won') {
      say(`Du fann ordet på ${state.guesses.length}.`, true);
    } else if (state.status === 'lost') {
      say(`Ordet var «${state.answer}».`, true);
    } else if (state.guesses.length) {
      hideHero();
    }
    el.shareWrap.hidden = state.status === 'playing';
  }

  // ── inndata ──────────────────────────────────────────────────────────────
  function handleKey(key) {
    if (state.busy || state.status !== 'playing') return;

    if (key === 'ENTER') return submit();
    if (key === 'BACK') {
      state.current = state.current.slice(0, -1);
      Board.render(state.guesses, state.current, state.answer);
      return;
    }
    if (state.current.length >= S.WORD_LENGTH) return;

    hideHero();
    state.current += key;
    Board.render(state.guesses, state.current, state.answer);
  }

  function submit() {
    const guess = state.current;
    const rowIndex = state.guesses.length;

    if (guess.length < S.WORD_LENGTH) {
      Board.shake(rowIndex);
      say('Ordet må ha fem bokstavar.');
      return;
    }

    state.busy = true;
    Dict.isValid(guess).then(valid => {
      if (!valid) {
        state.busy = false;
        Board.shake(rowIndex);
        say('Det ordet står ikkje i ordlista.');
        return;
      }
      accept(guess, rowIndex);
    });
  }

  function accept(guess, rowIndex) {
    state.guesses.push(guess);
    state.current = '';

    const won = guess === state.answer;
    const done = won || state.guesses.length >= S.MAX_GUESSES;
    state.status = won ? 'won' : (done ? 'lost' : 'playing');
    Store.saveDay(state.dayIndex, state.guesses, state.status);

    Board.reveal(rowIndex, guess, state.answer).then(() => {
      Keyboard.paint(S.letterStates(state.guesses, state.answer));
      state.busy = false;

      if (won) {
        Board.bounce(rowIndex);
        say(`Du fann ordet på ${state.guesses.length}.`, true);
      } else if (done) {
        say(`Ordet var «${state.answer}».`, true);
      }

      if (done) {
        el.shareWrap.hidden = false;
        updateHeader();
        setTimeout(() => showStats(), 1400);
      }
    });
  }

  // ── modal-innhald ────────────────────────────────────────────────────────
  function showStats() {
    const last = state.status !== 'playing'
      ? { status: state.status, guesses: state.guesses.length }
      : null;
    Stats.render(state.todayIndex, last);
    el.shareWrap.hidden = state.status === 'playing';
    openModal(el.statsOverlay);
  }

  function showArchive() {
    Archive.render(el.archiveGrid, state.todayIndex, index => {
      closeModal(el.archiveOverlay);
      hideHero();
      hideNotice();
      openDay(index);
    });
    openModal(el.archiveOverlay);
  }

  // ── oppstart ─────────────────────────────────────────────────────────────
  function cacheElements() {
    ['hero', 'dayNum', 'dayDate', 'message', 'board', 'keyboard', 'footnote',
      'archiveBtn', 'statsBtn', 'helpBtn', 'shareBtn', 'shareLabel', 'shareWrap',
      'archiveGrid', 'helpOverlay', 'statsOverlay', 'archiveOverlay']
      .forEach(id => { el[id] = document.getElementById(id); });
  }

  /** Melding i staden for brett — før startdatoen og etter at årgangen er brukt opp. */
  function showNotice(title, body) {
    el.board.hidden = true;
    el.keyboard.hidden = true;
    el.message.hidden = true;
    el.footnote.hidden = true;
    el.notice = document.createElement('div');
    el.notice.className = 'box1 dd-notice';
    const h = document.createElement('h2');
    h.className = 'heading3 no-mt';
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = body;
    el.notice.append(h, p);
    el.board.parentNode.insertBefore(el.notice, el.board);
  }

  function hideNotice() {
    if (el.notice) { el.notice.remove(); el.notice = null; }
    el.board.hidden = false;
    el.keyboard.hidden = false;
    el.message.hidden = false;
    el.footnote.hidden = false;
  }

  function init() {
    cacheElements();
    hydrateIcons();

    // Ein «attende til i dag»-knapp blir laga her framfor i HTML-en, av di
    // han berre gjev meining når ein arkivdag er open.
    el.backBtn = document.createElement('button');
    el.backBtn.type = 'button';
    el.backBtn.className = 'btn dd-iconbtn';
    el.backBtn.innerHTML = ICON('home', 18);
    el.backBtn.setAttribute('aria-label', 'Attende til dagens ord');
    el.backBtn.title = 'Attende til dagens ord';
    el.backBtn.hidden = true;
    el.backBtn.addEventListener('click', () => openDay(state.todayIndex));
    el.archiveBtn.parentNode.insertBefore(el.backBtn, el.archiveBtn);

    [el.helpOverlay, el.statsOverlay, el.archiveOverlay].forEach(wireModal);
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
    });

    state.todayIndex = S.todayIndex();

    if (state.todayIndex < 0) {
      showNotice('Duldord er ikkje i gang enno',
        `Fyrste ord kjem ${S.formatDate(S.dateForIndex(0))}.`);
      return;
    }

    Board.build(el.board);
    Keyboard.build(el.keyboard, handleKey);
    Keyboard.bindPhysical(handleKey);
    Dict.warm();

    el.helpBtn.addEventListener('click', () => openModal(el.helpOverlay));
    el.statsBtn.addEventListener('click', showStats);
    el.archiveBtn.addEventListener('click', showArchive);
    el.shareBtn.addEventListener('click', () => {
      const text = Stats.shareText(state.dayIndex + 1, state.guesses, state.answer, state.status);
      Stats.copy(text)
        .then(() => { el.shareLabel.textContent = 'Kopiert!'; })
        .catch(() => { el.shareLabel.textContent = 'Fekk ikkje kopiert'; })
        .finally(() => setTimeout(() => { el.shareLabel.textContent = 'Kopier resultatet'; }, 2000));
    });

    if (state.todayIndex >= S.wordCount()) {
      // Årgangen er brukt opp. Det finst ikkje noko dagens ord, men brettet er
      // bygd, så arkivet kan framleis opne kva som helst av dei gamle dagane.
      state.yearOver = true;
      state.todayIndex = S.wordCount();
      showNotice('Årgangen er ferdig',
        `Alle ${S.wordCount()} orda i den fyrste årgangen er brukte. Ei ny liste kjem, ` +
        'og i mellomtida ligg heile året i arkivet.');
      el.archiveBtn.hidden = false;
      return;
    }

    openDay(state.todayIndex);

    // Fyrste gong: opne hjelpa av seg sjølv
    if (!Object.keys(Store.allDays()).length) openModal(el.helpOverlay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
