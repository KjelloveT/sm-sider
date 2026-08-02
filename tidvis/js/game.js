/* game.js — orkestrering av ei Tidvis-økt: rundeflyt, poeng, og kobling
   mellom modus-modulane, tilstand (state.js), merke (achievements.js),
   lagring (storage.js) og grensesnittet (ui.js).

   Modus-kontrakt (window.TidvisModes[key]):
     flow: 'round' | 'board'
     needsDirection: bool
     startRound(container, session, api)   // for flow==='round'
     startBoard(container, session, api)    // for flow==='board'
*/
(function () {
  'use strict';

  const SNOGG_SECONDS = 60;

  // retning → kjelde/svar-representasjon
  // 'digital24' = 24-timars digital (h: 0–23); 'digital' = 12-timars (h: 1–12)
  const DIRS = {
    a2t:   { src: 'analog',     dst: 'text'      },
    t2a:   { src: 'text',       dst: 'analog'    },
    d2a:   { src: 'digital',    dst: 'analog'    },
    a2d:   { src: 'analog',     dst: 'digital'   },
    d24a:  { src: 'digital24',  dst: 'analog'    },
    a2d24: { src: 'analog',     dst: 'digital24' }
  };
  const DIR_KEYS = ['a2t', 't2a', 'd2a', 'a2d', 'd24a', 'a2d24'];

  function resolveDir(code) {
    if (code === 'mix' || !DIRS[code]) {
      return DIRS[DIR_KEYS[Math.floor(Math.random() * DIR_KEYS.length)]];
    }
    return DIRS[code];
  }

  // bygg ein DOM-node for ei tid i gjeven representasjon (statisk)
  function renderRepr(kind, time, opts) {
    opts = opts || {};
    if (kind === 'analog') {
      return TidvisClock.analog({
        h: time.h, m: time.m,
        size: opts.size || 200,
        accent: opts.accent || 'pink',
        print: !!opts.print,          // svart på kvitt for arbeidsark
        hands: opts.hands !== false   // false = tom skive ('Teikn visarane')
      }).el;
    }
    if (kind === 'digital' || kind === 'digital24') {
      return TidvisClock.lcd({
        time: TidvisTime.toDigital(time),
        label: opts.label || 'DIGITAL',
        size: opts.size
      });
    }
    // text
    const poster = document.createElement('div');
    poster.className = 'poster';
    if (opts.accent) poster.style.background = 'var(--' + opts.accent + ')';
    const big = document.createElement('div');
    big.className = 'poster__big';
    big.textContent = TidvisTime.toText(time);
    poster.appendChild(big);
    return poster;
  }

  const Game = {
    session: null,
    mode: null,
    _timer: null,
    _timeLeft: 0,

    start: function (opts) {
      const isSnogg = opts.mode === 'snogg';
      const modeKey = isSnogg ? 'les' : opts.mode;
      this.mode = window.TidvisModes[modeKey];
      if (!this.mode) { console.error('Tidvis: ukjend modus', opts.mode); return; }

      const session = TidvisState.createSession({
        mode: opts.mode,
        direction: isSnogg ? 'mix' : opts.direction,
        level: opts.level,
        total: isSnogg ? 999 : opts.total,
        stillTarget: opts.stillTarget || 'text',
        paraReprs: opts.paraReprs || ['analog', 'text']
      });
      session.timed = isSnogg;
      this.session = session;

      // lagra valt oppsett (ikkje snøggstart sitt mellombelse)
      if (!isSnogg) {
        const prog = TidvisStorage.getProgress();
        prog.settings = {
          mode: opts.mode, direction: opts.direction,
          level: opts.level, total: opts.total,
          stillTarget: opts.stillTarget,
          paraReprs: opts.paraReprs
        };
        TidvisStorage.setProgress(prog);
      }

      TidvisUI.showGame(session);
      TidvisUI.updateHud(session);

      if (session.timed) this._startTimer();

      if (this.mode.flow === 'board') {
        this._startBoard();
      } else {
        this._nextRound();
      }
    },

    _stage: function () { return TidvisUI.stage(); },

    _nextRound: function () {
      const s = this.session;
      if (s._finished) return;
      if (!s.timed && s.questionIndex >= s.total) { this.finish(); return; }
      const stage = this._stage();
      stage.innerHTML = '';
      s.questionStart = Date.now();
      TidvisUI.updateHud(s, { timeLeft: this._timeLeft });
      this.mode.startRound(stage, s, this._api());
    },

    _startBoard: function () {
      const stage = this._stage();
      stage.innerHTML = '';
      this.session.questionStart = Date.now();
      this.mode.startBoard(stage, this.session, this._api());
      // board-modus set session.total under startBoard — oppdater HUD etterpå
      TidvisUI.updateHud(this.session, { timeLeft: this._timeLeft });
    },

    _api: function () {
      const self = this;
      return {
        session: self.session,
        renderRepr: renderRepr,
        resolveDir: resolveDir,
        submit: function (correct, o) { self._onSubmit(correct, o); },
        advance: function () { self.session.questionIndex++; TidvisUI.updateHud(self.session, { timeLeft: self._timeLeft }); },
        next: function () { self._afterRound(); },
        finish: function () { self.finish(); }
      };
    },

    // kalla av round-modus når eit svar er gjeve
    _onSubmit: function (correct, o) {
      if (this.session._finished) return;
      const res = TidvisState.recordAnswer(this.session, correct, o);
      TidvisUI.flash(res);
      TidvisUI.updateHud(this.session, { timeLeft: this._timeLeft });
      // board-modus styrer sin eigen progresjon; round-modus går vidare via next()
    },

    // round-modus kallar dette når den vil gå til neste oppgåve
    _afterRound: function () {
      const s = this.session;
      if (s._finished) return;
      s.questionIndex++;
      if (!s.timed && s.questionIndex >= s.total) { this.finish(); return; }
      const self = this;
      setTimeout(function () { self._nextRound(); }, 60);
    },

    _startTimer: function () {
      const self = this;
      this._timeLeft = SNOGG_SECONDS;
      TidvisUI.updateHud(this.session, { timeLeft: this._timeLeft });
      this._timer = setInterval(function () {
        self._timeLeft--;
        TidvisUI.updateHud(self.session, { timeLeft: self._timeLeft });
        if (self._timeLeft <= 0) { self.finish(); }
      }, 1000);
    },

    _stopTimer: function () {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    finish: function () {
      this._stopTimer();
      const s = this.session;
      if (!s) return;
      // unngå dobbel-finish
      if (s._finished) return;
      s._finished = true;

      // Utforsk-modus har ingen resultat-skjerm — gå rett til meny
      if (s.mode === 'utforsk') { TidvisUI.show('menu'); return; }

      const progress = TidvisStorage.getProgress();
      // Registrer antal spursmål besvara på dette nivået (for opplåsing av neste nivå)
      if (!progress.levelCompletion) progress.levelCompletion = [0, 0, 0, 0];
      progress.levelCompletion[s.level] = (progress.levelCompletion[s.level] || 0) + s.answeredCount;
      const ev = TidvisAchievements.evaluate(progress, s);
      TidvisStorage.setProgress(ev.progress);
      const isRecord = TidvisStorage.saveHighScore(s.score);
      TidvisStorage.saveToHistory({
        score: s.score, mode: s.mode, level: s.level,
        accuracy: TidvisState.accuracy(s)
      });

      TidvisUI.showResult({
        session: s,
        accuracy: TidvisState.accuracy(s),
        newBadges: ev.newBadges,
        leveledUp: ev.leveledUp,
        fromLevel: ev.fromLevel,
        toLevel: ev.toLevel,
        levelProgress: TidvisAchievements.levelProgress(ev.progress.xp),
        highScore: TidvisStorage.getHighScore(),
        isRecord: isRecord
      });
    },

    abort: function () {
      this._stopTimer();
      if (this.session) this.session._finished = true;
      this.session = null;
    }
  };

  window.TidvisGame = Game;
  window.TidvisGame.renderRepr = renderRepr;
  window.TidvisGame.resolveDir = resolveDir;
})();
