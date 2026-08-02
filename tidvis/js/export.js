/* export.js — eksportdialogen for arbeidsark: val, namneliste og levande
   førehandsvising av det same DOM-treet som print.js skriv ut.
   Innstillingane blir lagra i progress.exportSettings; elevnamn blir aldri
   lagra — dei er ein eingongskopi frå Flokkdeilar/Klassekart eller innliming. */
(function () {
  'use strict';

  /* ---- DOM-hjelparar ---- */

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
    if (iconName && window.TidvisIcons) b.appendChild(TidvisIcons.el(iconName, { size: '1.2em' }));
    if (label) b.appendChild(document.createTextNode(label));
    return b;
  }

  /* ---- Kontrollar ---- */

  // ein rad med chips der nøyaktig eitt val er aktivt
  function segRow(items, current, onPick) {
    const seg = el('seg seg--wrap');
    items.forEach(function (item) {
      const chip = el('chip', 'button');
      chip.type = 'button';
      chip.textContent = item.name;
      if (item.id === current) chip.classList.add('is-active');
      chip.addEventListener('click', function () {
        seg.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        onPick(item.id);
      });
      seg.appendChild(chip);
    });
    return seg;
  }

  // av/på-chip med hakeikon
  function toggleChip(label, active, onToggle) {
    const chip = el('chip chip--toggle' + (active ? ' is-active' : ''), 'button');
    chip.type = 'button';
    if (window.TidvisIcons) chip.appendChild(TidvisIcons.el('check', { size: 14 }));
    chip.appendChild(document.createTextNode(label));
    chip.addEventListener('click', function () {
      const on = !chip.classList.contains('is-active');
      chip.classList.toggle('is-active', on);
      onToggle(on);
    });
    return chip;
  }

  function numberField(label, value, min, max, onChange) {
    const wrap = el('tv-ex-num');
    const lab = txt('label', 'tv-ex-num__label', label);
    const input = el('tv-ex-input tv-ex-input--num', 'input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    lab.appendChild(input);
    input.addEventListener('input', function () {
      let n = parseInt(input.value, 10);
      if (isNaN(n)) return;
      n = Math.max(min, Math.min(max, n));
      onChange(n);
    });
    input.addEventListener('blur', function () {
      let n = parseInt(input.value, 10);
      if (isNaN(n)) n = min;
      n = Math.max(min, Math.min(max, n));
      input.value = String(n);
      onChange(n);
    });
    wrap.appendChild(lab);
    return wrap;
  }

  function textField(label, value, onChange) {
    const wrap = el('tv-ex-text');
    const lab = txt('label', 'tv-ex-num__label', label);
    const input = el('tv-ex-input', 'input');
    input.type = 'text';
    input.value = value;
    input.addEventListener('input', function () { onChange(input.value); });
    lab.appendChild(input);
    wrap.appendChild(lab);
    return wrap;
  }

  /* ---- Val-lister ---- */

  const SRC_ITEMS = [
    { id: 'analog',    name: 'Analog' },
    { id: 'digital',   name: 'Digital 12t' },
    { id: 'digital24', name: 'Digital 24t' },
    { id: 'text',      name: 'Tekst' },
    { id: 'mix',       name: 'Bland' }
  ];
  const ANSWER_FORMS = [
    { id: 'digital',   name: 'Digital rute __:__' },
    { id: 'digital24', name: 'Digital 24t' },
    { id: 'text',      name: 'Tekstlinje' }
  ];
  const PROMPT_FORMS = [
    { id: 'text',      name: 'Tekst' },
    { id: 'digital',   name: 'Digital 12t' },
    { id: 'digital24', name: 'Digital 24t' }
  ];
  const OPTION_COUNTS = [
    { id: 3, name: '3' }, { id: 4, name: '4' }, { id: 6, name: '6' }
  ];
  const PAIR_COUNTS = [
    { id: 4, name: '4' }, { id: 5, name: '5' }, { id: 6, name: '6' }, { id: 8, name: '8' }
  ];
  const ANSWER_KEYS = [
    { id: 'none', name: 'Ingen' },
    { id: 'one',  name: 'Eitt fasitark' },
    { id: 'each', name: 'Fasit per ark' }
  ];

  function levelItems() {
    return TidvisTime.LEVEL_NAMES.map(function (name, i) {
      return { id: i, name: (i + 1) + '. ' + name };
    });
  }
  function sizeItems() {
    return TidvisSheet.SIZE_ORDER.map(function (id) {
      return { id: id, name: TidvisSheet.SIZES[id].name };
    });
  }

  /* ---- Namnekjelder (eingongskopi, ikkje ei kopling) ---- */

  function cleanNames(list) {
    const seen = {};
    const out = [];
    list.forEach(function (raw) {
      const name = String(raw || '').trim();
      if (!name || seen[name]) return;
      seen[name] = true;
      out.push(name);
    });
    return out;
  }

  function nameOf(s) { return (s && s.name) || s; }

  function flokkdeilarLists() {
    return VyrdepilStorage.getList('flokkdeilar', 'lister').map(function (item) {
      return {
        label: item.name || 'Utan namn',
        source: 'Flokkdeilar',
        names: cleanNames((item.students || []).map(nameOf))
      };
    });
  }

  function klassekartLists() {
    const out = [];
    VyrdepilStorage.getList('klassekart', 'oppsett').forEach(function (item) {
      const students = (item.data && item.data.students) || [];
      out.push({
        label: item.name || 'Utan namn',
        source: 'Klassekart',
        names: cleanNames(students.map(nameOf))
      });
    });
    const gameState = VyrdepilStorage.getGameState('klassekart');
    const tabs = (gameState && gameState.tabs) || [];
    tabs.forEach(function (tab) {
      const students = (tab.data && tab.data.students) || [];
      out.push({
        label: (tab.name || 'Fane') + ' (open fane)',
        source: 'Klassekart',
        names: cleanNames(students.map(nameOf))
      });
    });
    return out;
  }

  function allSources() {
    let lists = [];
    try {
      lists = lists.concat(flokkdeilarLists(), klassekartLists());
    } catch (e) {
      lists = [];
    }
    return lists.filter(function (l) { return l.names.length; });
  }

  function elevar(n) { return n + (n === 1 ? ' elev' : ' elevar'); }

  /* ---- Dialogen ---- */

  const Export = {
    cfg: null,
    _overlay: null,
    _preview: null,
    _countLine: null,
    _namesInfo: null,
    _sheetsField: null,
    _seedInput: null,
    _instrBox: null,

    open: function () {
      const self = this;
      this.cfg = this._loadConfig();

      const overlay = el('tv-fb-overlay tv-ex-overlay');
      const panel = el('card tv-ex');

      // topprad
      const head = el('tv-ex__head');
      const h = txt('h2', 'tv-ex__title', 'Lag arbeidsark');
      head.appendChild(h);
      const closeX = button('btn btn--ghost btn--sm', '', 'x');
      closeX.setAttribute('aria-label', 'Lukk');
      closeX.addEventListener('click', function () { self.close(); });
      head.appendChild(closeX);
      panel.appendChild(head);

      panel.appendChild(txt('p', 'tv-ex__lead',
        'Set saman eit A4-ark av dei same oppgåvetypane som i spelet. '
        + 'Skriv ut, eller vel «Lagre som PDF» i utskriftsdialogen.'));

      const body = el('tv-ex__body');
      const controls = el('tv-ex__controls');
      this._buildControls(controls);
      body.appendChild(controls);

      const side = el('tv-ex__side');
      side.appendChild(txt('div', 'tv-section-head', 'Førehandsvising'));
      this._preview = el('tv-ex-preview');
      side.appendChild(this._preview);
      this._countLine = txt('p', 'tv-ex__count', '');
      side.appendChild(this._countLine);
      body.appendChild(side);

      panel.appendChild(body);

      // knapperad
      const cta = el('tv-ex__cta');
      const printBtn = button('btn btn--pink btn--lg', 'Skriv ut / Lagre som PDF', 'printer');
      printBtn.addEventListener('click', function () { self.print(); });
      const closeBtn = button('btn btn--ghost btn--lg', 'Lukk', 'x');
      closeBtn.addEventListener('click', function () { self.close(); });
      cta.appendChild(printBtn);
      cta.appendChild(closeBtn);
      panel.appendChild(cta);

      overlay.appendChild(panel);
      this._overlay = overlay;

      function onKey(e) { if (e.key === 'Escape') self.close(); }
      this._onKey = onKey;
      document.addEventListener('keydown', onKey);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) self.close(); });

      const root = (window.TidvisUI && TidvisUI.root) || document.body;
      root.appendChild(overlay);
      this.refresh();
    },

    close: function () {
      if (this._onKey) document.removeEventListener('keydown', this._onKey);
      if (this._overlay && this._overlay.parentNode) this._overlay.remove();
      this._overlay = null;
    },

    print: function () {
      if (!TidvisPrint.hasTasks(this.cfg)) {
        this._flashCount('Slå på minst éin oppgåvetype først.');
        return;
      }
      this._save();
      TidvisPrint.doPrint(this.cfg);
    },

    /* ---- Lagring ---- */

    _loadConfig: function () {
      const prog = TidvisStorage.getProgress();
      const cfg = TidvisSheet.normalize(prog.exportSettings || {});
      // seed og namn blir aldri henta frå lagringa
      cfg.seed = (prog.exportSettings && prog.exportSettings.seed) || TidvisSheet.randomSeed();
      cfg.names = [];
      cfg.nameSource = '';
      return TidvisSheet.normalize(cfg);
    },

    _save: function () {
      const prog = TidvisStorage.getProgress();
      const store = TidvisSheet.normalize(this.cfg);
      delete store.names;
      delete store.nameSource;
      prog.exportSettings = store;
      TidvisStorage.setProgress(prog);
    },

    /* ---- Kontrollpanelet ---- */

    _buildControls: function (host) {
      const self = this;

      // --- Oppgåvetypar ---
      host.appendChild(txt('div', 'tv-section-head', 'Oppgåvetypar og mengd'));
      TidvisSheet.TYPE_ORDER.forEach(function (kind) {
        host.appendChild(self._typeCard(kind));
      });

      // --- Vanskegrad ---
      host.appendChild(txt('div', 'tv-section-head', 'Vanskegrad'));
      const levelWrap = el('tv-ex-block');
      levelWrap.appendChild(segRow(levelItems(), this.cfg.level, function (id) {
        self.cfg.level = id;
        TidvisSheet.TYPE_ORDER.forEach(function (k) {
          if (!self.cfg.perTypeLevel) self.cfg.types[k].level = id;
        });
        self.refresh();
      }));
      const perType = el('seg');
      perType.appendChild(toggleChip('Eige nivå per oppgåvetype', this.cfg.perTypeLevel, function (on) {
        self.cfg.perTypeLevel = on;
        host.querySelectorAll('.tv-ex-typelevel').forEach(function (n) { n.hidden = !on; });
        self.refresh();
      }));
      levelWrap.appendChild(perType);
      levelWrap.appendChild(txt('p', 'tv-ex-hint',
        'Eksporten låser ingen nivå — nivålåsen i spelet gjeld elevane si framgang.'));
      host.appendChild(levelWrap);

      // --- Storleik ---
      host.appendChild(txt('div', 'tv-section-head', 'Storleik og tettleik'));
      const sizeWrap = el('tv-ex-block');
      sizeWrap.appendChild(segRow(sizeItems(), this.cfg.size, function (id) {
        self.cfg.size = id;
        self.refresh();
      }));
      this._capacityLine = txt('p', 'tv-ex-hint', '');
      sizeWrap.appendChild(this._capacityLine);
      host.appendChild(sizeWrap);

      // --- Arkoppsett ---
      host.appendChild(txt('div', 'tv-section-head', 'Arkoppsett'));
      const setup = el('tv-ex-block');
      setup.appendChild(textField('Tittel', this.cfg.title, function (v) {
        self.cfg.title = v;
        self.refresh();
      }));

      this._instrBox = el('tv-ex-instr');
      setup.appendChild(this._instrBox);

      const setupToggles = el('seg seg--wrap');
      this._nameFieldChip = toggleChip('Namn- og datolinje', this.cfg.nameField, function (on) {
        self.cfg.nameField = on;
        self.refresh();
      });
      setupToggles.appendChild(this._nameFieldChip);
      setupToggles.appendChild(toggleChip('Nummerering', this.cfg.numbering, function (on) {
        self.cfg.numbering = on;
        self.refresh();
      }));
      setupToggles.appendChild(toggleChip('Bunntekst med logo', this.cfg.footer, function (on) {
        self.cfg.footer = on;
        self.refresh();
      }));
      setup.appendChild(setupToggles);
      host.appendChild(setup);

      // --- Ark og elevnamn ---
      host.appendChild(txt('div', 'tv-section-head', 'Tal på ark og elevnamn'));
      const sheetsWrap = el('tv-ex-block');
      const numRow = el('tv-ex-row');
      this._sheetsField = numberField('Tal på ark', this.cfg.sheets, 1, 30, function (n) {
        self.cfg.sheets = n;
        self.refresh();
      });
      numRow.appendChild(this._sheetsField);
      sheetsWrap.appendChild(numRow);

      const uniqSeg = el('seg');
      uniqSeg.appendChild(toggleChip('Unike oppgåver per ark', this.cfg.unique, function (on) {
        self.cfg.unique = on;
        self.refresh();
      }));
      sheetsWrap.appendChild(uniqSeg);

      const nameRow = el('tv-ex-row');
      const namesBtn = button('btn btn--blue btn--sm', 'Hent namn', 'users');
      namesBtn.addEventListener('click', function () { self._openNames(); });
      nameRow.appendChild(namesBtn);
      const clearBtn = button('btn btn--ghost btn--sm', 'Tøm namn', 'trash2');
      clearBtn.addEventListener('click', function () { self._applyNames([], ''); });
      this._clearNamesBtn = clearBtn;
      nameRow.appendChild(clearBtn);
      sheetsWrap.appendChild(nameRow);
      this._namesInfo = txt('p', 'tv-ex-hint', '');
      sheetsWrap.appendChild(this._namesInfo);
      this._nameChips = el('tv-ex-chips');
      sheetsWrap.appendChild(this._nameChips);
      host.appendChild(sheetsWrap);

      // --- Seed ---
      host.appendChild(txt('div', 'tv-section-head', 'Utval'));
      const seedWrap = el('tv-ex-block');
      const seedRow = el('tv-ex-row');
      const seedField = numberField('Seed', this.cfg.seed, 1, 2147483646, function (n) {
        self.cfg.seed = n;
        self.refresh({ keepSeed: true });
      });
      this._seedInput = seedField.querySelector('input');
      seedRow.appendChild(seedField);
      const newSeed = button('btn btn--yellow btn--sm', 'Nytt utval', 'refresh');
      newSeed.addEventListener('click', function () {
        self.cfg.seed = TidvisSheet.randomSeed();
        self._seedInput.value = String(self.cfg.seed);
        self.refresh({ keepSeed: true });
      });
      seedRow.appendChild(newSeed);
      seedWrap.appendChild(seedRow);
      seedWrap.appendChild(txt('p', 'tv-ex-hint',
        'Same seed gjev nøyaktig same ark att seinare.'));
      host.appendChild(seedWrap);

      // --- Fasit ---
      host.appendChild(txt('div', 'tv-section-head', 'Fasit'));
      const keyWrap = el('tv-ex-block');
      keyWrap.appendChild(segRow(ANSWER_KEYS, this.cfg.answerKey, function (id) {
        self.cfg.answerKey = id;
        self.refresh();
      }));
      keyWrap.appendChild(txt('p', 'tv-ex-hint', 'Fasitsidene kjem samla bakerst.'));
      host.appendChild(keyWrap);
    },

    // eitt kort per oppgåvetype: av/på, mengd og typespesifikke val
    _typeCard: function (kind) {
      const self = this;
      const t = this.cfg.types[kind];
      const card = el('tv-ex-type');

      const head = el('tv-ex-type__head');
      const seg = el('seg');
      seg.appendChild(toggleChip(TidvisSheet.TYPE_NAMES[kind], t.on, function (on) {
        t.on = on;
        card.classList.toggle('is-off', !on);
        if (on && t.count < 1) {
          t.count = kind === 'match' ? 1 : 6;
          countInput.value = String(t.count);
        }
        self.refresh();
      }));
      head.appendChild(seg);

      const countLabel = kind === 'match' ? 'Tal blokker per ark' : 'Tal per ark';
      const countField = numberField(countLabel, t.count, 0, 30, function (n) {
        t.count = n;
        self.refresh();
      });
      const countInput = countField.querySelector('input');
      head.appendChild(countField);
      card.appendChild(head);

      const opts = el('tv-ex-type__opts');

      if (kind === 'choice' || kind === 'write') {
        opts.appendChild(txt('div', 'tv-ex-label', 'Klokka visast som'));
        opts.appendChild(segRow(SRC_ITEMS, t.src, function (id) { t.src = id; self.refresh(); }));
      }
      if (kind === 'choice') {
        opts.appendChild(txt('div', 'tv-ex-label', 'Tal alternativ'));
        opts.appendChild(segRow(OPTION_COUNTS, t.options, function (id) { t.options = id; self.refresh(); }));
      }
      if (kind === 'write') {
        opts.appendChild(txt('div', 'tv-ex-label', 'Svarform'));
        opts.appendChild(segRow(ANSWER_FORMS, t.answerForm, function (id) { t.answerForm = id; self.refresh(); }));
      }
      if (kind === 'draw') {
        opts.appendChild(txt('div', 'tv-ex-label', 'Målet gjeve som'));
        opts.appendChild(segRow(PROMPT_FORMS, t.prompt, function (id) { t.prompt = id; self.refresh(); }));
      }
      if (kind === 'match') {
        opts.appendChild(txt('div', 'tv-ex-label', 'Tal par'));
        opts.appendChild(segRow(PAIR_COUNTS, t.pairs, function (id) { t.pairs = id; self.refresh(); }));
        opts.appendChild(txt('div', 'tv-ex-label', 'Representasjonar (vel minst to)'));
        const reprSeg = el('seg seg--wrap');
        TidvisSheet.REPRS.forEach(function (r) {
          const active = t.reprs.indexOf(r) !== -1;
          const chip = toggleChip(TidvisSheet.REPR_NAMES[r], active, function (on) {
            if (!on) {
              if (t.reprs.length > 2) {
                t.reprs = t.reprs.filter(function (x) { return x !== r; });
              } else {
                chip.classList.add('is-active');   // aldri under to
                return;
              }
            } else if (t.reprs.indexOf(r) === -1) {
              t.reprs = t.reprs.concat([r]);
            }
            self.refresh();
          });
          reprSeg.appendChild(chip);
        });
        opts.appendChild(reprSeg);
      }

      // eige nivå for denne typen (synleg berre når per-type-nivå er på)
      const lvlWrap = el('tv-ex-typelevel');
      lvlWrap.hidden = !this.cfg.perTypeLevel;
      lvlWrap.appendChild(txt('div', 'tv-ex-label', 'Vanskegrad for denne typen'));
      lvlWrap.appendChild(segRow(levelItems(), t.level, function (id) { t.level = id; self.refresh(); }));
      opts.appendChild(lvlWrap);

      card.appendChild(opts);
      if (!t.on) card.classList.add('is-off');
      return card;
    },

    /* ---- Namneliste ---- */

    _applyNames: function (names, source) {
      this.cfg.names = names;
      this.cfg.nameSource = names.length ? source : '';
      if (names.length) {
        this.cfg.sheets = Math.min(30, names.length);
        this.cfg.nameField = false;   // namnet står påtrykt
        if (this._nameFieldChip) this._nameFieldChip.classList.remove('is-active');
      }
      const input = this._sheetsField && this._sheetsField.querySelector('input');
      if (input) input.value = String(this.cfg.sheets);
      this.refresh();
    },

    _openNames: function () {
      const self = this;
      const overlay = el('tv-fb-overlay tv-ex-overlay');
      const panel = el('card tv-ex-names');

      const head = el('tv-ex__head');
      head.appendChild(txt('h2', 'tv-ex__title', 'Hent elevnamn'));
      panel.appendChild(head);
      panel.appendChild(txt('p', 'tv-ex-hint',
        'Namna blir kopierte éin gong til dette arket. Dei blir ikkje lagra, '
        + 'og dei er ikkje kopla til Flokkdeilar eller Klassekart.'));

      const lists = allSources();
      if (!lists.length) {
        panel.appendChild(txt('p', 'tv-ex-hint',
          'Fann ingen klasselister i Flokkdeilar eller Klassekart i denne nettlesaren. '
          + 'Du kan lime inn namn nedanfor.'));
      } else {
        panel.appendChild(txt('div', 'tv-section-head', 'Klasselister i nettlesaren'));
        lists.forEach(function (list) {
          const row = el('tv-ex-source');
          const text = el('tv-ex-source__text');
          text.appendChild(txt('strong', '', list.label));
          text.appendChild(txt('span', 'tv-ex-hint', ' ' + list.source + ' · ' + elevar(list.names.length)));
          row.appendChild(text);
          const use = button('btn btn--blue btn--sm', 'Bruk', 'users');
          use.addEventListener('click', function () {
            self._applyNames(list.names, list.source + ': ' + list.label);
            overlay.remove();
          });
          row.appendChild(use);
          panel.appendChild(row);
        });
      }

      panel.appendChild(txt('div', 'tv-section-head', 'Lim inn namn'));
      const area = el('tv-ex-input tv-ex-textarea', 'textarea');
      area.rows = 6;
      area.placeholder = 'Eitt namn per linje';
      panel.appendChild(area);

      const cta = el('tv-ex__cta');
      const ok = button('btn btn--pink btn--sm', 'Bruk namna', 'check');
      ok.addEventListener('click', function () {
        const names = cleanNames(area.value.split(/\r?\n/));
        if (!names.length) return;
        self._applyNames(names, 'Innliming');
        overlay.remove();
      });
      const cancel = button('btn btn--ghost btn--sm', 'Avbryt', 'x');
      cancel.addEventListener('click', function () { overlay.remove(); });
      cta.appendChild(ok);
      cta.appendChild(cancel);
      panel.appendChild(cta);

      overlay.appendChild(panel);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
      (this._overlay || document.body).appendChild(overlay);
    },

    /* ---- Oppdatering ---- */

    // NB: cfg-objektet blir aldri bytt ut — kontrollane held referansar rett
    // inn i cfg.types[...], så ei normalisering her ville kopla dei frå.
    refresh: function () {
      this._save();
      this._renderInstructions();
      this._renderNames();
      this._renderPreview();
      this._renderCounts();
    },

    _renderInstructions: function () {
      const self = this;
      const box = this._instrBox;
      if (!box) return;
      box.textContent = '';
      let any = false;
      TidvisSheet.TYPE_ORDER.forEach(function (kind) {
        const t = self.cfg.types[kind];
        if (!t.on || t.count < 1) return;
        any = true;
        box.appendChild(textField('Instruksjon — ' + TidvisSheet.TYPE_NAMES[kind],
          self.cfg.instructions[kind], function (v) {
            self.cfg.instructions[kind] = v;
            self._renderPreview();
            self._save();
          }));
      });
      box.hidden = !any;
    },

    _renderNames: function () {
      const names = this.cfg.names;
      if (this._clearNamesBtn) this._clearNamesBtn.hidden = !names.length;
      if (this._nameChips) {
        this._nameChips.textContent = '';
        names.forEach(function (n) {
          this._nameChips.appendChild(txt('span', 'tv-ex-chip', n));
        }, this);
      }
      if (!this._namesInfo) return;
      this._namesInfo.textContent = names.length
        ? elevar(names.length) + ' · kjelde: ' + (this.cfg.nameSource || 'ukjend')
          + '. Kvart ark får namnet påtrykt.'
        : 'Utan namneliste blir det ' + this.cfg.sheets
          + (this.cfg.sheets === 1 ? ' ark' : ' ark') + ' med blank namnelinje.';
    },

    _renderPreview: function () {
      const host = this._preview;
      if (!host) return;
      host.textContent = '';
      if (!TidvisPrint.hasTasks(this.cfg)) {
        host.appendChild(txt('p', 'tv-ex-hint', 'Slå på minst éin oppgåvetype for å sjå arket.'));
        return;
      }
      const cfg = this.cfg;
      const sheets = TidvisSheet.build(cfg);
      const stage = el('tv-ex-preview__stage');
      const node = TidvisPrint.sheetNode(sheets[0], cfg, {});
      stage.appendChild(node);
      host.appendChild(stage);

      // skaler arket ned til breidda på førehandsvisingsfeltet
      const avail = host.clientWidth;
      const natural = node.offsetWidth || 1;
      const k = Math.min(1, avail / natural);
      stage.style.transform = 'scale(' + k + ')';
      stage.style.width = natural + 'px';
      host.style.height = Math.round(node.offsetHeight * k) + 'px';
    },

    _renderCounts: function () {
      const m = TidvisSheet.measure(this.cfg);
      const cap = TidvisSheet.capacityPerPage(this.cfg);
      if (this._capacityLine) {
        this._capacityLine.textContent = cap
          ? '≈ ' + cap + ' oppgåver får plass per side med denne storleiken.'
          : 'Slå på ein oppgåvetype for å sjå kor mange som får plass.';
      }
      if (!this._countLine) return;
      const arkCount = this.cfg.names.length || this.cfg.sheets;
      const parts = [];
      parts.push(m.tasks + (m.tasks === 1 ? ' oppgåve' : ' oppgåver') + ' per ark');
      parts.push('Arket blir ' + m.pages + (m.pages === 1 ? ' side' : ' sider'));
      parts.push(arkCount + (arkCount === 1 ? ' ark' : ' ark') + ' totalt');
      if (this.cfg.answerKey === 'each') parts.push('fasit per ark');
      else if (this.cfg.answerKey === 'one') parts.push('eitt fasitark');
      this._countLine.textContent = parts.join(' · ') + '.';
    },

    _flashCount: function (message) {
      if (!this._countLine) return;
      this._countLine.textContent = message;
    }
  };

  window.TidvisExport = Export;
})();
