/* ui.js — grensesnitt for Tidvis: meny/oppsett, spel-HUD, mikro-feedback,
   resultat, merkegalleri og tema-synk mot den globale neo-header-temaet.
   Byggjer skjermane dynamisk inni .tv-rota (#tv-root). */
(function () {
  'use strict';

  // parts: [første del, andre del (aksent)] — vises som splittext utan ikon
  const TILES = [
    { id: 'les',
      parts: ['Les',   ' av'],
      desc:  'Klokka visast som analog, digital eller tekst. Kva tid er det? Vel rett svar blant fire alternativ.',
      cls:   '' },
    { id: 'still',
      parts: ['Still', ' visarane'],
      desc:  'Ei tid blir gjeven som tekst eller digital. Dra time- og minuttvisaren til rett stilling på urskiva.',
      cls:   't-teal' },
    { id: 'para',
      parts: ['Par',   ' saman'],
      desc:  'Finn kva som høyrer saman — match same tid på tvers av analog, digital og tekst i to kolonnar.',
      cls:   't-blue' },
    { id: 'utforsk',
      parts: ['Ut',    'forsk'],
      desc:  'Alle tre klokketypane samstundes. Endre visarane eller trykk +/− på digital — dei andre følgjer med.',
      cls:   't-yellow' }
  ];
  const DIRS = [
    { id: 'a2t',   name: 'Analog → Tekst' },
    { id: 't2a',   name: 'Tekst → Analog' },
    { id: 'd2a',   name: 'Digital → Analog' },
    { id: 'a2d',   name: 'Analog → Digital' },
    { id: 'd24a',  name: 'Digital 24t → Analog' },
    { id: 'a2d24', name: 'Analog → Digital 24t' },
    { id: 'mix',   name: 'Bland alt' }
  ];
  const TOTALS = [5, 10, 15, 20];

  // ---- DOM-hjelparar ----
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
  function button(cls, label, iconName) {
    const b = el(cls, 'button');
    b.type = 'button';
    if (iconName) b.appendChild(TidvisIcons.el(iconName, { size: '1.2em' }));
    if (label) b.appendChild(document.createTextNode(label));
    return b;
  }

  const UI = {
    root: null,
    elMenu: null, elGame: null, elResult: null,
    elStage: null,
    hud: null,
    sel: { mode: 'les', direction: 'a2t', level: 0, total: 10, stillTarget: 'text', paraReprs: ['analog', 'text'] },
    _baseXp: 0,
    _flow: 'round',
    _fb: null,
    _modal: null,
    // live-klokker i hero
    _liveAnalog: null,
    _liveLcdWrap: null,
    _liveTextEl: null,
    _liveClockTimer: null,

    init: function () {
      this.root = document.getElementById('tv-root');
      if (!this.root) { console.error('Tidvis: fann ikkje #tv-root'); return; }

      const prog = TidvisStorage.getProgress();
      if (prog.settings) {
        this.sel.mode = prog.settings.mode || 'les';
        this.sel.direction = prog.settings.direction || 'a2t';
        this.sel.level = prog.settings.level != null ? prog.settings.level : 0;
        this.sel.total = prog.settings.total || 10;
        this.sel.stillTarget = prog.settings.stillTarget || 'text';
        this.sel.paraReprs = (prog.settings.paraReprs && prog.settings.paraReprs.length >= 2)
          ? prog.settings.paraReprs : ['analog', 'text'];
        // 'snogg' er flytta til Snøggstart-knapp i hero; normaliser til 'les'
        if (this.sel.mode === 'snogg') this.sel.mode = 'les';
      }

      this.elMenu = el('tv-screen', 'section');
      this.elMenu.id = 'tv-menu';
      this.elGame = el('tv-screen', 'section');
      this.elGame.id = 'tv-game';
      this.elGame.hidden = true;
      this.elResult = el('tv-screen', 'section');
      this.elResult.id = 'tv-result';
      this.elResult.hidden = true;

      this.root.appendChild(this.elMenu);
      this.root.appendChild(this.elGame);
      this.root.appendChild(this.elResult);

      this._themeSync();
      this.show('menu');
    },

    show: function (name) {
      if (name === 'menu') {
        // Rebuild menyen kvar gong så låsestatus er oppdatert
        this.buildMenu();
        this._startLiveClock();
      } else {
        this._stopLiveClock();
      }
      this.elMenu.hidden = name !== 'menu';
      this.elGame.hidden = name !== 'game';
      this.elResult.hidden = name !== 'result';
    },

    // ---------- TEMA ----------
    _themeSync: function () {
      const root = this.root;
      function resolve() {
        const body = document.body;
        const cur = body.getAttribute('data-theme');
        const dark = body.getAttribute('data-dark-theme') || 'space';
        root.setAttribute('data-theme', cur === dark ? 'dark' : 'light');
      }
      resolve();
      document.addEventListener('theme-changed', resolve);
      window.addEventListener('theme-changed', resolve);
      const obs = new MutationObserver(resolve);
      obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    },

    // ---------- MENY / OPPSETT ----------
    buildMenu: function () {
      const self = this;
      this.elMenu.innerHTML = '';

      // ============================================================
      // HERO-BOKS: logo + live klokker + snøggstart + sjå merke
      // ============================================================
      const heroCard = el('card tv-menu-herobox');

      // Logo + tittel på same rad
      const titleRow = el('tv-game-title-row');

      const logo = document.createElement('img');
      logo.src = '../_resources/tidvis.png';
      logo.alt = 'Tidvis';
      logo.className = 'tv-hero__logo';
      titleRow.appendChild(logo);

      const titleEl = document.createElement('h1');
      titleEl.className = 'tv-logo tv-game-title';
      titleEl.appendChild(document.createTextNode('Tid'));
      const titleAccent = document.createElement('span');
      titleAccent.className = 'tv-game-title__accent';
      titleAccent.textContent = 'vis';
      titleEl.appendChild(titleAccent);
      titleRow.appendChild(titleEl);

      heroCard.appendChild(titleRow);

      heroCard.appendChild(txt('p', 'tv-lead',
        'Tren på å lese klokka — analog, digital og tekst på nynorsk. Samle poeng, streak og merke.'));

      // Live-klokker (3 i rad)
      const liveClocks = el('tv-live-clocks');

      // Analog
      const anaItem = el('tv-live-clocks__item');
      anaItem.appendChild(txt('div', 'tv-live-clocks__label', 'ANALOG'));
      const liveClock = TidvisClock.analog({ h: 12, m: 0, size: 120, accent: 'teal' });
      this._liveAnalog = liveClock;
      anaItem.appendChild(liveClock.el);
      liveClocks.appendChild(anaItem);

      // Digital
      const digItem = el('tv-live-clocks__item');
      digItem.appendChild(txt('div', 'tv-live-clocks__label', 'DIGITAL'));
      const liveLcd = TidvisClock.lcd({ time: '12:00', label: ' ', size: 'clamp(21px,3vw,32px)' });
      this._liveLcdWrap = liveLcd;
      digItem.appendChild(liveLcd);
      liveClocks.appendChild(digItem);

      // Tekst
      const txtItem = el('tv-live-clocks__item');
      txtItem.appendChild(txt('div', 'tv-live-clocks__label', 'TEKST'));
      const liveText = el('tv-live-clocks__text');
      liveText.textContent = 'klokka tolv';
      this._liveTextEl = liveText;
      txtItem.appendChild(liveText);
      liveClocks.appendChild(txtItem);

      heroCard.appendChild(liveClocks);

      // CTA: Snøggstart + Sjå merke
      const heroCta = el('tv-menu-herobox__cta');
      const snoggBtn = button('btn btn--yellow btn--lg', 'Snøggstart', 'zap');
      snoggBtn.addEventListener('click', function () { self.startSnogg(); });
      const badgeBtn = button('btn btn--ghost btn--lg', 'Sjå merke', 'trophy');
      badgeBtn.addEventListener('click', function () { self.showBadges(); });
      const sheetBtn = button('btn btn--blue btn--lg', 'Lag arbeidsark', 'printer');
      sheetBtn.addEventListener('click', function () { TidvisExport.open(); });
      heroCta.appendChild(snoggBtn);
      heroCta.appendChild(badgeBtn);
      heroCta.appendChild(sheetBtn);
      heroCard.appendChild(heroCta);

      this.elMenu.appendChild(heroCard);

      // ============================================================
      // OPPSETT-BOKS: modus, retning, vanskegrad, tal, start
      // ============================================================
      const setupCard = el('card tv-menu-setup');

      // Modus
      setupCard.appendChild(this._sectionHead('Vel modus'));
      const tiles = el('tiles');
      TILES.forEach(function (t) {
        tiles.appendChild(self._tile(t));
      });
      setupCard.appendChild(tiles);

      // Retning (berre les)
      this._dirSection = el('');
      this._dirSection.appendChild(this._sectionHead('Retning'));
      const seg = el('seg');
      DIRS.forEach(function (d) {
        const chip = el('chip', 'button');
        chip.type = 'button';
        chip.dataset.dir = d.id;
        chip.appendChild(TidvisIcons.el('arrowSwap', { size: 16 }));
        chip.appendChild(document.createTextNode(d.name));
        if (d.id === self.sel.direction) chip.classList.add('is-active');
        chip.addEventListener('click', function () {
          self.sel.direction = d.id;
          seg.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
          chip.classList.add('is-active');
        });
        seg.appendChild(chip);
      });
      this._dirSection.appendChild(seg);
      setupCard.appendChild(this._dirSection);

      // Målformat for Still visarane
      this._stillTargetSection = el('');
      this._stillTargetSection.appendChild(this._sectionHead('Vis målet som'));
      const stillSeg = el('seg');
      const STILL_TARGETS = [
        { id: 'text',      name: 'Tekst' },
        { id: 'digital',   name: 'Digital 12t' },
        { id: 'digital24', name: 'Digital 24t' }
      ];
      STILL_TARGETS.forEach(function (t) {
        const chip = el('chip', 'button');
        chip.type = 'button';
        chip.dataset.target = t.id;
        chip.textContent = t.name;
        if (t.id === self.sel.stillTarget) chip.classList.add('is-active');
        chip.addEventListener('click', function () {
          self.sel.stillTarget = t.id;
          stillSeg.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
          chip.classList.add('is-active');
        });
        stillSeg.appendChild(chip);
      });
      this._stillTargetSection.appendChild(stillSeg);
      setupCard.appendChild(this._stillTargetSection);

      // Representasjonar for Par saman (velg min 2)
      this._paraReprsSection = el('');
      this._paraReprsSection.appendChild(this._sectionHead('Representasjonar (vel minst to)'));
      const paraReprsWrap = el('seg seg--wrap');
      const PARA_REPRS = [
        { id: 'analog',    name: 'Analog' },
        { id: 'text',      name: 'Tekst' },
        { id: 'digital',   name: 'Digital 12t' },
        { id: 'digital24', name: 'Digital 24t' }
      ];
      PARA_REPRS.forEach(function (r) {
        const chip = el('chip chip--toggle', 'button');
        chip.type = 'button';
        chip.dataset.repr = r.id;
        chip.appendChild(TidvisIcons.el('check', { size: 14 }));
        chip.appendChild(document.createTextNode(r.name));
        if (self.sel.paraReprs.indexOf(r.id) !== -1) chip.classList.add('is-active');
        chip.addEventListener('click', function () {
          const idx = self.sel.paraReprs.indexOf(r.id);
          if (idx !== -1) {
            // fjern: berre om minst 3 er vald (aldri under 2)
            if (self.sel.paraReprs.length > 2) {
              self.sel.paraReprs = self.sel.paraReprs.filter(function (x) { return x !== r.id; });
              chip.classList.remove('is-active');
            }
          } else {
            self.sel.paraReprs = self.sel.paraReprs.concat([r.id]);
            chip.classList.add('is-active');
          }
        });
        paraReprsWrap.appendChild(chip);
      });
      this._paraReprsSection.appendChild(paraReprsWrap);
      setupCard.appendChild(this._paraReprsSection);

      // Vanskegrad
      this._levelSection = el('');
      this._levelSection.appendChild(this._sectionHead('Vanskegrad'));
      const levels = el('levels');
      const prog = TidvisStorage.getProgress();

      // Valider at valt nivå er open; reset til 0 om låst
      const selectedLocked = self.sel.level > 0 && (!prog.levelCompletion || (prog.levelCompletion[self.sel.level - 1] || 0) < 5);
      if (selectedLocked) self.sel.level = 0;

      TidvisTime.LEVEL_NAMES.forEach(function (name, i) {
        // Sjekk om nivået er låst: nivå 0 er alltid open, nivå N krev >=5 spursmål på nivå N-1
        const isLocked = i > 0 && (!prog.levelCompletion || (prog.levelCompletion[i - 1] || 0) < 5);

        const lvl = el('lvl' + (isLocked ? ' is-locked' : ''), 'button');
        lvl.type = 'button';
        lvl.dataset.level = String(i);
        if (isLocked) lvl.disabled = true;

        const no = el('lvl__no');
        no.appendChild(document.createTextNode(String(i + 1)));
        const sp = txt('span', '', 'nivå');
        no.appendChild(sp);
        lvl.appendChild(no);
        lvl.appendChild(txt('div', 'lvl__name', name));

        // Hint: vis låsing-melding eller normaleksempel
        let hint = TidvisTime.LEVEL_HINTS[i];
        if (isLocked) {
          const need = 5 - (prog.levelCompletion[i - 1] || 0);
          hint = 'Løs ' + need + ' fleire på nivå ' + i;
        }
        lvl.appendChild(txt('div', 'lvl__hint', hint));

        const pips = el('lvl__pips');
        for (let p = 0; p < 4; p++) {
          const pip = el(p <= i ? 'on' : '', 'i');
          pips.appendChild(pip);
        }
        lvl.appendChild(pips);

        // Vis lås-ikon om låst
        if (isLocked) {
          const lock = el('lvl__lock');
          lock.appendChild(TidvisIcons.el('lock', { size: 16 }));
          lvl.appendChild(lock);
        }

        if (i === self.sel.level) lvl.classList.add('is-active');
        if (!isLocked) {
          lvl.addEventListener('click', function () {
            self.sel.level = i;
            levels.querySelectorAll('.lvl').forEach(function (c) { c.classList.remove('is-active'); });
            lvl.classList.add('is-active');
          });
        }
        levels.appendChild(lvl);
      });
      this._levelSection.appendChild(levels);
      setupCard.appendChild(this._levelSection);

      // Tal på oppgåver
      this._totalSection = el('');
      this._totalSection.appendChild(this._sectionHead('Tal på oppgåver'));
      const tseg = el('seg');
      TOTALS.forEach(function (n) {
        const chip = el('chip', 'button');
        chip.type = 'button';
        chip.textContent = String(n);
        if (n === self.sel.total) chip.classList.add('is-active');
        chip.addEventListener('click', function () {
          self.sel.total = n;
          tseg.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
          chip.classList.add('is-active');
        });
        tseg.appendChild(chip);
      });
      this._totalSection.appendChild(tseg);
      setupCard.appendChild(this._totalSection);

      // Start-knapp
      const startBtn = button('btn btn--pink btn--lg btn--block', 'Start spelet', 'arrowRight');
      startBtn.addEventListener('click', function () { self.start(); });
      setupCard.appendChild(startBtn);

      this.elMenu.appendChild(setupCard);

      this._syncMenuVisibility();
    },

    _sectionHead: function (text) {
      return txt('div', 'tv-section-head', text);
    },

    // kept for internal legacy calls
    _sectionLabel: function (text) {
      return this._sectionHead(text);
    },

    _tile: function (t) {
      const self = this;
      const tile = el('tile ' + t.cls, 'button');
      tile.type = 'button';
      tile.dataset.mode = t.id;

      // Splittext-namn (utan ikon): "Les" + " av" der siste del er raud aksent
      const nameDiv = el('tile__name');
      nameDiv.appendChild(document.createTextNode(t.parts[0]));
      if (t.parts[1]) {
        const accent = document.createElement('span');
        accent.className = 'tv-tile-accent';
        accent.textContent = t.parts[1];
        nameDiv.appendChild(accent);
      }
      tile.appendChild(nameDiv);
      tile.appendChild(txt('div', 'tile__desc', t.desc));
      if (t.id === this.sel.mode) {
        tile.classList.add('is-active');
        this._addCheck(tile);
      }
      tile.addEventListener('click', function () {
        self.sel.mode = t.id;
        self.elMenu.querySelectorAll('.tile').forEach(function (x) {
          x.classList.remove('is-active');
          const c = x.querySelector('.tile__check');
          if (c) c.remove();
        });
        tile.classList.add('is-active');
        self._addCheck(tile);
        self._syncMenuVisibility();
      });
      return tile;
    },

    _addCheck: function (tile) {
      const chk = el('tile__check');
      chk.appendChild(TidvisIcons.el('check', { size: 18 }));
      tile.appendChild(chk);
    },

    _syncMenuVisibility: function () {
      const mode = this.sel.mode;
      const needsDir        = mode === 'les';
      const needsStillTarget= mode === 'still';
      const needsParaReprs  = mode === 'para';
      const usesTotal       = mode === 'les' || mode === 'still';
      const usesLevel       = mode !== 'utforsk';
      if (this._dirSection)         this._dirSection.hidden         = !needsDir;
      if (this._stillTargetSection) this._stillTargetSection.hidden = !needsStillTarget;
      if (this._paraReprsSection)   this._paraReprsSection.hidden   = !needsParaReprs;
      if (this._totalSection)       this._totalSection.hidden       = !usesTotal;
      if (this._levelSection)       this._levelSection.hidden       = !usesLevel;
    },

    // ---------- LIVE-KLOKKER ----------
    _startLiveClock: function () {
      this._stopLiveClock();
      const self = this;
      function tick() {
        if (!self._liveAnalog) return;
        const now = new Date();
        let h = now.getHours() % 12;
        if (h === 0) h = 12;
        const m = now.getMinutes();
        self._liveAnalog.setTime(h, m);
        if (self._liveLcdWrap) {
          const val = self._liveLcdWrap.querySelector('.val');
          if (val) val.textContent = TidvisTime.toDigital({ h: h, m: m });
        }
        if (self._liveTextEl) {
          self._liveTextEl.textContent = TidvisTime.toText({ h: h, m: m });
        }
      }
      tick();
      this._liveClockTimer = setInterval(tick, 1000);
    },

    _stopLiveClock: function () {
      if (this._liveClockTimer) {
        clearInterval(this._liveClockTimer);
        this._liveClockTimer = null;
      }
    },

    // ---------- START ----------
    start: function () {
      const prog = TidvisStorage.getProgress();
      this._baseXp = prog.xp || 0;
      // Utforsk har éitt fast nivå: alle minutt (nivå 3)
      const level = this.sel.mode === 'utforsk' ? 3 : this.sel.level;
      TidvisGame.start({
        mode: this.sel.mode,
        direction: this.sel.direction,
        level: level,
        total: this.sel.total,
        stillTarget: this.sel.stillTarget,
        paraReprs: this.sel.paraReprs.slice()
      });
    },

    startSnogg: function () {
      const prog = TidvisStorage.getProgress();
      this._baseXp = prog.xp || 0;
      TidvisGame.start({ mode: 'snogg', level: this.sel.level });
    },

    // ---------- SPEL-SKJERM ----------
    showGame: function (session) {
      const self = this;
      this._flow = (window.TidvisModes[session.mode === 'snogg' ? 'les' : session.mode] || {}).flow || 'round';
      this.elGame.innerHTML = '';

      // topbar
      const top = el('tv-topbar');
      const home = el('iconbtn', 'button');
      home.type = 'button';
      home.setAttribute('aria-label', 'Tilbake til meny');
      home.appendChild(TidvisIcons.el('home', { size: 22 }));
      home.addEventListener('click', function () {
        TidvisGame.abort();
        self.show('menu');
      });
      top.appendChild(home);

      this.hud = {};

      // Utforsk-modus: berre tittel, ikkje poeng/streak/nivå
      if (session.mode === 'utforsk') {
        const titleEl = document.createElement('h2');
        titleEl.className = 'tv-utforsk-topbar-title';
        titleEl.appendChild(document.createTextNode('Ut'));
        const accent = document.createElement('span');
        accent.className = 'tv-utforsk-topbar-accent';
        accent.textContent = 'forsk';
        titleEl.appendChild(accent);
        top.appendChild(titleEl);
      } else {
        // Normal spel: poeng, streak, og XP-nivå
        top.appendChild(this._stat('score', 'star', 's-yellow', 'Poeng'));
        top.appendChild(this._stat('streak', 'flame', 's-pink', 'Streak'));

        // xp
        const xpwrap = el('xpwrap');
        const xprow = el('xprow');
        const lv = txt('span', 'lv', 'Nivå 1');
        const xpv = txt('span', '', '0 / 200');
        xprow.appendChild(lv); xprow.appendChild(xpv);
        const xpbar = el('xpbar');
        const xpi = el('', 'i');
        xpbar.appendChild(xpi);
        xpwrap.appendChild(xprow); xpwrap.appendChild(xpbar);
        top.appendChild(xpwrap);
        this.hud.lv = lv; this.hud.xpv = xpv; this.hud.xpi = xpi;
      }

      // progress pill
      const pill = el('pill');
      const pillIco = TidvisIcons.el(session.timed ? 'clock' : session.mode === 'utforsk' ? 'grid' : 'target', { size: 16 });
      pill.appendChild(pillIco);
      const pillTxt = txt('span', '', '');
      pill.appendChild(pillTxt);
      top.appendChild(pill);
      this.hud.pill = pillTxt;

      this.elGame.appendChild(top);

      // scene
      this.elStage = el('');
      this.elGame.appendChild(this.elStage);

      this.show('game');
    },

    _stat: function (key, ico, icoCls, label) {
      const stat = el('stat');
      const box = el('stat__ico ' + icoCls);
      box.appendChild(TidvisIcons.el(ico, { size: 21 }));
      stat.appendChild(box);
      const col = el('');
      const v = txt('div', 'stat__v', '0');
      const l = txt('div', 'stat__l', label);
      col.appendChild(v); col.appendChild(l);
      stat.appendChild(col);
      this.hud[key] = v;
      return stat;
    },

    stage: function () { return this.elStage; },

    updateHud: function (session, extra) {
      if (!this.hud) return;
      extra = extra || {};
      // Utforsk-modus har ikkje poeng/streak/XP-element — berre pill
      if (this.hud.score) this.hud.score.textContent = String(session.score);
      if (this.hud.streak) this.hud.streak.textContent = String(session.streak);

      if (this.hud.lv) {
        const liveXp = this._baseXp + session.xp;
        const lp = TidvisAchievements.levelProgress(liveXp);
        this.hud.lv.textContent = 'Nivå ' + lp.level;
        this.hud.xpv.textContent = lp.into + ' / ' + lp.need;
        this.hud.xpi.style.width = Math.round(lp.frac * 100) + '%';
      }

      if (session.timed) {
        const t = extra.timeLeft != null ? extra.timeLeft : 0;
        this.hud.pill.textContent = t + ' sek';
      } else if (this._flow === 'board') {
        this.hud.pill.textContent = session.total === 0
          ? 'Utforsk'
          : session.questionIndex + ' / ' + session.total;
      } else {
        const cur = Math.min(session.questionIndex + 1, session.total);
        this.hud.pill.textContent = cur + ' / ' + session.total;
      }
    },

    // ---------- MIKRO-FEEDBACK ----------
    flash: function (result) {
      // stage-shake ved feil
      if (!result.correct && this.elStage) {
        this.elStage.classList.add('is-shake');
        const s = this.elStage;
        setTimeout(function () { s.classList.remove('is-shake'); }, 360);
      }

      if (this._fb) { this._fb.remove(); this._fb = null; }

      const overlay = el('tv-fb-overlay');
      overlay.style.background = 'transparent';
      overlay.style.pointerEvents = 'none';

      const fb = el('feedback');
      const burst = el('burst ' + (result.correct ? 'ok' : 'no'));
      burst.appendChild(TidvisIcons.el(result.correct ? 'check' : 'x', { size: 46 }));
      fb.appendChild(burst);
      fb.appendChild(txt('div', 'fb-title', result.correct ? 'Rett!' : 'Feil'));

      if (result.correct && result.comboBonus) {
        const combo = el('combo');
        combo.appendChild(TidvisIcons.el('flame', { size: 20 }));
        combo.appendChild(document.createTextNode('Combo ×' + result.combo + ' · +' + result.comboBonus));
        fb.appendChild(combo);
      } else if (result.correct && result.gained) {
        fb.appendChild(txt('div', 'label-strong', '+' + result.gained + ' poeng'));
      }

      overlay.appendChild(fb);
      this.root.appendChild(overlay);
      this._fb = overlay;

      const dur = result.correct ? 600 : 720;
      setTimeout(function () {
        if (overlay.parentNode) overlay.remove();
      }, dur);
    },

    // ---------- RESULTAT ----------
    showResult: function (sum) {
      const self = this;
      const s = sum.session;
      this.elResult.innerHTML = '';

      const title = txt('h2', '', sum.accuracy >= 80 ? 'Bra jobba!' : (sum.accuracy >= 50 ? 'Godt gått!' : 'Hald fram!'));
      title.style.fontSize = 'clamp(30px,5vw,46px)';
      this.elResult.appendChild(title);

      // stats
      const stats = el('tv-result-stats');
      stats.appendChild(this._resultStat('star', 's-yellow', String(s.score), 'Poeng'));
      stats.appendChild(this._resultStat('check', 's-teal', s.correctCount + ' / ' + s.answeredCount, 'Treff (' + sum.accuracy + '%)'));
      stats.appendChild(this._resultStat('flame', 's-pink', String(s.bestStreak), 'Lengste streak'));
      this.elResult.appendChild(stats);

      // midt: nytt merke / nivå-opp + rekord + xp
      const mid = el('tv-result-mid');

      const leftCard = el('card');
      leftCard.style.padding = '18px';
      if (sum.newBadges && sum.newBadges.length) {
        const nb = el('tv-newbadge card');
        const b = TidvisAchievements.badgeById(sum.newBadges[0]);
        const medal = el('bdg__medal');
        medal.appendChild(TidvisIcons.el(b.ico, { size: 38 }));
        nb.appendChild(medal);
        const col = el('');
        col.appendChild(txt('div', 'tv-eyebrow', 'NYTT MERKE'));
        col.appendChild(txt('div', 'serif', b.name));
        if (sum.newBadges.length > 1) {
          col.appendChild(txt('div', 'label-strong', '+ ' + (sum.newBadges.length - 1) + ' til'));
        }
        nb.appendChild(col);
        mid.appendChild(nb);
      } else {
        leftCard.appendChild(txt('div', 'tv-eyebrow muted', 'FRAMGANG'));
        leftCard.appendChild(txt('div', 'serif', 'Nivå ' + sum.toLevel));
        const xpbar = el('xpbar');
        xpbar.style.marginTop = '12px';
        const xpi = el('', 'i');
        xpi.style.width = Math.round(sum.levelProgress.frac * 100) + '%';
        xpbar.appendChild(xpi);
        leftCard.appendChild(xpbar);
        mid.appendChild(leftCard);
      }

      const rightCard = el('card tv-result-score' + (sum.isRecord ? ' is-record' : ''));
      const icoBox = el('rs-ico');
      icoBox.appendChild(TidvisIcons.el('trophy', { size: 36 }));
      rightCard.appendChild(icoBox);
      rightCard.appendChild(txt('div', 'rs-score', String(sum.highScore)));
      rightCard.appendChild(txt('div', 'rs-label', sum.isRecord ? 'Ny rekord!' : 'Toppscore'));
      if (sum.leveledUp) {
        const lvpill = el('pill');
        lvpill.style.cssText = 'background:var(--teal);margin-top:4px;';
        lvpill.appendChild(TidvisIcons.el('rocket', { size: 14 }));
        lvpill.appendChild(document.createTextNode('Nivå opp → ' + sum.toLevel));
        rightCard.appendChild(lvpill);
      }
      mid.appendChild(rightCard);
      this.elResult.appendChild(mid);

      // cta
      const cta = el('tv-result-cta');
      const again = button('btn btn--pink btn--lg', 'Spel igjen', 'refresh');
      again.addEventListener('click', function () {
        if (s.mode === 'snogg') self.startSnogg(); else self.start();
      });
      const menu = button('btn btn--ghost btn--lg', 'Meny', 'home');
      menu.addEventListener('click', function () { self.show('menu'); });
      const badges = button('btn btn--blue btn--lg', 'Sjå merke', 'trophy');
      badges.addEventListener('click', function () { self.showBadges(); });
      cta.appendChild(again); cta.appendChild(menu); cta.appendChild(badges);
      this.elResult.appendChild(cta);

      this.show('result');
      if (sum.accuracy >= 50 || (sum.newBadges && sum.newBadges.length)) {
        this._confetti();
      }
    },

    _resultStat: function (ico, icoCls, value, label) {
      const card = el('card');
      const box = el('stat__ico ' + icoCls);
      box.appendChild(TidvisIcons.el(ico, { size: 34 }));
      card.appendChild(box);
      const col = el('');
      col.appendChild(txt('div', 'stat__v', value));
      col.appendChild(txt('div', 'stat__l', label));
      card.appendChild(col);
      return card;
    },

    _confetti: function () {
      const root = this.root;
      const colors = ['--pink', '--yellow', '--teal', '--blue', '--purple', '--green'];
      const n = 26;
      for (let i = 0; i < n; i++) {
        const c = el('confetti');
        const size = 8 + Math.random() * 10;
        c.style.width = size + 'px';
        c.style.height = size + 'px';
        c.style.left = (Math.random() * 100) + '%';
        c.style.top = '-20px';
        c.style.background = 'var(' + colors[i % colors.length] + ')';
        c.style.borderRadius = Math.random() < 0.5 ? '50%' : '3px';
        c.style.transition = 'transform 1.6s ease-in, opacity 1.6s ease-in';
        c.style.zIndex = '40';
        root.appendChild(c);
        const dx = (Math.random() * 2 - 1) * 120;
        const dy = root.clientHeight + 40;
        const rot = (Math.random() * 720 - 360);
        requestAnimationFrame(function () {
          c.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)';
          c.style.opacity = '0';
        });
        setTimeout(function () { if (c.parentNode) c.remove(); }, 1800);
      }
    },

    // ---------- MERKEGALLERI ----------
    showBadges: function () {
      const self = this;
      const prog = TidvisStorage.getProgress();
      const unlocked = prog.unlocked || [];

      const overlay = el('tv-fb-overlay');
      overlay.style.background = 'rgba(26,23,20,.45)';
      overlay.style.zIndex = '50';
      overlay.style.overflow = 'auto';

      const panel = el('card');
      panel.style.background = 'var(--surface)';
      panel.style.padding = 'clamp(18px,3vw,28px)';
      panel.style.maxWidth = '720px';
      panel.style.width = '100%';
      panel.style.maxHeight = '90%';
      panel.style.overflow = 'auto';

      const head = el('row');
      head.style.justifyContent = 'space-between';
      head.style.marginBottom = '16px';
      const h = txt('h2', '', 'Merke');
      h.style.fontSize = '28px';
      head.appendChild(h);
      const count = el('pill');
      count.appendChild(TidvisIcons.el('trophy', { size: 16 }));
      count.appendChild(document.createTextNode(unlocked.length + ' / ' + TidvisAchievements.BADGES.length));
      head.appendChild(count);
      panel.appendChild(head);

      const grid = el('badges');
      TidvisAchievements.BADGES.forEach(function (b) {
        const isUnlocked = unlocked.indexOf(b.id) !== -1;
        const bdg = el('bdg ' + b.color + (isUnlocked ? '' : ' is-locked'));
        const medal = el('bdg__medal');
        medal.appendChild(TidvisIcons.el(b.ico, { size: 38 }));
        bdg.appendChild(medal);
        bdg.appendChild(txt('div', 'bdg__name', b.name));
        bdg.appendChild(txt('div', 'bdg__hint', b.hint));
        if (!isUnlocked) {
          const lock = el('bdg__lock');
          lock.appendChild(TidvisIcons.el('lock', { size: 16 }));
          bdg.appendChild(lock);
        }
        grid.appendChild(bdg);
      });
      panel.appendChild(grid);

      const close = button('btn btn--ink btn--lg btn--block', 'Lukk', 'x');
      close.style.marginTop = '18px';
      function dismiss() {
        if (overlay.parentNode) overlay.remove();
        document.removeEventListener('keydown', onKey);
      }
      function onKey(e) { if (e.key === 'Escape') dismiss(); }
      close.addEventListener('click', dismiss);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) dismiss(); });
      document.addEventListener('keydown', onKey);
      panel.appendChild(close);

      overlay.appendChild(panel);
      this.root.appendChild(overlay);
    }
  };

  window.TidvisUI = UI;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { UI.init(); });
  } else {
    UI.init();
  }
})();
