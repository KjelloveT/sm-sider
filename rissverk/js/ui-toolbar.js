/* ══════════════════════════════════════════════
   UI-TOOLBAR.JS — Verktøyraden, avansert-brytaren og Tips-vindauget

   Verktøyknappane blir BYGDE frå registeret i tool-manager, ikkje
   skrivne i HTML. Difor treng eit nytt verktøy berre melde seg inn éin
   stad for å dukke opp både i raden, i hurtigtastane og i Tips.

   Tips-vindauget er heller ikkje skrive for hand: det les same registeret
   og dei same knappane, så det kan ikkje kome i utakt med det som
   faktisk finst i programmet.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.toolbar = (function () {
  'use strict';

  const STORE_KEY = 'rissverk';

  let groupEl = null;
  let advancedBtn = null;
  let zoomLabel = null;
  let gridBtn = null;

  /* Knappane som berre gjev meining når noko er valt. */
  const NEEDS_SELECTION = ['duplicateBtn', 'deleteBtn', 'groupBtn', 'ungroupBtn',
                           'raiseBtn', 'lowerBtn', 'flipHBtn', 'flipVBtn',
                           'layerUpBtn', 'layerDownBtn'];

  /* Å slå saman former krev minst to å slå saman. */
  const NEEDS_TWO = ['unionBtn', 'subtractBtn', 'intersectBtn', 'excludeBtn'];

  /* ──────────────── Oppsett ──────────────── */

  function attach() {
    groupEl = document.getElementById('toolGroup');
    advancedBtn = document.getElementById('advancedBtn');
    zoomLabel = document.getElementById('zoomLabel');
    gridBtn = document.getElementById('gridBtn');

    restoreAdvanced();
    buildTools();
    buildTips();

    advancedBtn.addEventListener('click', () => {
      const next = !RV.tools.isAdvanced();
      RV.tools.setAdvanced(next);
      saveAdvanced(next);
      buildTools();
      syncAdvanced();
      RV.props.build();
    });
  }

  /* ──────────────── Verktøyknappane ──────────────── */

  function buildTools() {
    RV.util.clear(groupEl);
    RV.tools.visible().forEach((tool) => {
      const btn = RV.util.iconButton(tool.icon, null, 'btn rv-icon-btn rv-tool-btn',
        tool.name + (tool.key ? ' (' + tool.key.toUpperCase() + ')' : ''));
      btn.dataset.tool = tool.id;
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => RV.tools.setActive(tool.id));
      groupEl.appendChild(btn);
    });
    syncTools();
  }

  function syncTools() {
    const active = RV.tools.active();
    groupEl.querySelectorAll('.rv-tool-btn').forEach((btn) => {
      const on = active && btn.dataset.tool === active.id;
      btn.classList.toggle('active', !!on);
      btn.setAttribute('aria-pressed', String(!!on));
    });
  }

  /* ──────────────── Avansert-modus ──────────────── */

  function restoreAdvanced() {
    const saved = VyrdepilStorage.getGameState(STORE_KEY);
    RV.tools.setAdvanced(!!(saved && saved.advanced));
    syncAdvanced();
  }

  function saveAdvanced(on) {
    const state = VyrdepilStorage.getGameState(STORE_KEY) || {};
    state.advanced = on;
    VyrdepilStorage.setGameState(STORE_KEY, state);
  }

  function syncAdvanced() {
    const on = RV.tools.isAdvanced();
    advancedBtn.classList.toggle('active', on);
    advancedBtn.setAttribute('aria-pressed', String(on));
    document.querySelectorAll('[data-level="advanced"]').forEach((el) => {
      el.hidden = !on;
    });
  }

  /* ──────────────── Løpande oppdatering ──────────────── */

  function sync() {
    syncTools();

    const has = RV.state.topSelection().length > 0;
    NEEDS_SELECTION.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !has;
    });

    const sel = RV.state.selectedNodes();
    const fleire = RV.state.topSelection().length >= 2;
    NEEDS_TWO.forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !fleire;
    });

    const groupBtn = document.getElementById('groupBtn');
    if (groupBtn) groupBtn.disabled = !fleire;

    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) connectBtn.disabled = RV.state.topSelection().length !== 2;

    const symbolBtn = document.getElementById('symbolBtn');
    if (symbolBtn) symbolBtn.disabled = !has;

    /* Maske-knappen byter meining etter kva som er valt. */
    const clipBtn = document.getElementById('clipBtn');
    if (clipBtn) {
      const harMaske = RV.clip.hasClip();
      clipBtn.disabled = !harMaske && !fleire;
      clipBtn.classList.toggle('active', harMaske);
      const tekst = harMaske ? 'Ta bort maska' : 'Skjer det under til den øvste forma';
      clipBtn.title = tekst;
      clipBtn.setAttribute('aria-label', harMaske ? 'Ta bort maska' : 'Maske');
    }
    const ungroupBtn = document.getElementById('ungroupBtn');
    if (ungroupBtn) ungroupBtn.disabled = !sel.some(n => n.type === 'group');

    document.getElementById('undoBtn').disabled = !RV.state.canUndo();
    document.getElementById('redoBtn').disabled = !RV.state.canRedo();

    zoomLabel.textContent = RV.view.zoomPercent() + ' %';

    const grid = RV.state.data.view.grid;
    gridBtn.classList.toggle('active', grid);
    gridBtn.setAttribute('aria-pressed', String(grid));
  }

  /* ──────────────── Tips ──────────────── */

  const SHORTCUTS = [
    ['Ctrl + Z', 'Angre'],
    ['Ctrl + Shift + Z', 'Gjer om'],
    ['Ctrl + D', 'Dupliser'],
    ['Ctrl + G', 'Grupper'],
    ['Ctrl + Shift + G', 'Løys opp gruppa'],
    ['Ctrl + A', 'Vel alt'],
    ['Delete', 'Slett det valde'],
    ['Piltastar', 'Flytt eitt hakk — med Skift ti hakk'],
    ['Mellomrom + dra', 'Panorer flata'],
    ['Ctrl + rullehjul', 'Zoom inn og ut'],
    ['Ctrl + 0', 'Tilpass til vindauget'],
    ['Ctrl + 1', 'Vis i verkeleg storleik'],
    ['Skift medan du teiknar', 'Held forma proporsjonal'],
    ['Alt medan du teiknar', 'Teiknar frå midten'],
    ['Alt-klikk', 'Vel forma inni ei gruppe'],
    ['Ctrl medan du dreg', 'Slår av snapping og hjelpelinjer'],
    ['Enter', 'Avsluttar stien du teiknar med pennen'],
    ['Escape', 'Avbryt det du held på med']
  ];

  function buildTips() {
    const body = document.getElementById('tipsBody');
    RV.util.clear(body);

    body.appendChild(RV.util.el('h3', 'rv-tips-head', 'Verktøya'));
    const tools = RV.util.el('dl', 'rv-tips-list');
    RV.tools.all().forEach((tool) => {
      const dt = RV.util.el('dt', 'rv-tips-term');
      const icon = RV.util.el('span', 'rv-tips-icon');
      icon.setAttribute('data-icon', tool.icon);
      icon.setAttribute('data-icon-size', '16');
      dt.appendChild(icon);
      dt.appendChild(document.createTextNode(
        tool.name + (tool.key ? ' (' + tool.key.toUpperCase() + ')' : '')));
      if (tool.level === 'advanced') {
        dt.appendChild(RV.util.el('span', 'rv-tips-badge', 'avansert'));
      }
      tools.appendChild(dt);
      tools.appendChild(RV.util.el('dd', 'rv-tips-def', tool.hint || ''));
    });
    body.appendChild(tools);

    body.appendChild(RV.util.el('h3', 'rv-tips-head', 'Hurtigtastar'));
    const keys = RV.util.el('dl', 'rv-tips-list');
    SHORTCUTS.forEach((s) => {
      const dt = RV.util.el('dt', 'rv-tips-term');
      dt.appendChild(RV.util.el('kbd', null, s[0]));
      keys.appendChild(dt);
      keys.appendChild(RV.util.el('dd', 'rv-tips-def', s[1]));
    });
    body.appendChild(keys);

    body.appendChild(RV.util.el('h3', 'rv-tips-head', 'Godt å vite'));
    const notes = RV.util.el('ul', 'rv-tips-notes');
    [
      'Teikninga blir lagra i nettlesaren din medan du arbeider, så du finn ho att om du kjem tilbake seinare. Vil du ta vare på henne for godt, bør du lagre ho som prosjektfil.',
      'SVG er vektor og kan endrast seinare. PNG er eit bilete og kan ikkje det — men det kan opnast overalt.',
      'Trykk «Avansert» for å få fram fleire verktøy og fleire innstillingar i panelet.',
      'Du kan dra ei SVG-fil rett inn på flata. Ho kjem inn som former du kan redigere punkt for punkt — fint til å ta opp att ein gammal logo eller eit ikon.',
      'Med to former valde kan du slå dei saman, skjere den eine bort frå den andre, eller behalde berre overlappet. Merk at kurver blir til rette linjer i same slengen — det er slik reknemåten verkar.',
      'Ein overgang (gradient) får to handtak rett på forma. Dra i dei for å styre retninga, og klikk på stripa i panelet for fleire fargar undervegs.',
      'Vel to former og trykk lenkje-knappen for å kople dei med ei pil. Pila følgjer med når du flyttar formene — nyttig i diagram.',
      'Eit symbol er ei form du kan bruke mange stader og endre éin gong. Løys opp éin instans, endre han, og trykk «Oppdater symbolet» — så følgjer alle dei andre etter.',
      'Trykk «Lær» oppe til høgre for å sjå kva ei bézier-kurve eigentleg er. Du kan dra i han sjølv.',
      'Dreg du inn eit PNG- eller JPG-bilete, blir det liggjande låst og nedtona som eit kalkerark. Det blir aldri med i det du lagrar — teikn oppå det.',
      'Formene legg seg etter kantane og midten på det som alt står på flata. Hald Ctrl nede medan du dreg om du vil plassere heilt fritt.',
      'Ingenting blir sendt til nokon tenar. Alt skjer på maskina di.'
    ].forEach(t => notes.appendChild(RV.util.el('li', null, t)));
    body.appendChild(notes);

    if (typeof hydrateIcons === 'function') hydrateIcons(body);
  }

  return { attach, sync, buildTools, syncAdvanced, STORE_KEY };
})();
