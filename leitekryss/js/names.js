/* Leitekryss — hentar elevnamn frå Flokkdeilar, Klassekart eller innliming.
   Namna blir kopierte éin gong; dei er ikkje kopla til dei andre appane. */
window.LK = window.LK || {};

LK.names = (function () {
  'use strict';

  const el = LK.util.el;
  const state = LK.state;
  let dom = {};

  function init() {
    dom = {
      openBtn: document.getElementById('namesBtn'),
      clearBtn: document.getElementById('clearNamesBtn'),
      info: document.getElementById('namesInfo'),
      chips: document.getElementById('nameChips'),
      overlay: document.getElementById('namesOverlay'),
      sources: document.getElementById('namesSources'),
      paste: document.getElementById('namesPaste'),
      pasteConfirm: document.getElementById('namesPasteConfirm'),
      cancel: document.getElementById('namesCancel'),
      close: document.getElementById('namesClose')
    };

    dom.openBtn.addEventListener('click', open);
    dom.cancel.addEventListener('click', () => LK.util.closeModal(dom.overlay));
    dom.close.addEventListener('click', () => LK.util.closeModal(dom.overlay));
    dom.pasteConfirm.addEventListener('click', onPaste);
    dom.clearBtn.addEventListener('click', () => apply([], ''));
    LK.util.bindOverlayClose(dom.overlay);

    state.onChange(topic => {
      if (topic === 'names' || topic === 'load') render();
    });
    render();
  }

  /* ---- Kjelder ---- */

  function elevar(count) {
    return count + (count === 1 ? ' elev' : ' elevar');
  }

  function cleanNames(list) {
    const seen = new Set();
    const out = [];
    list.forEach(raw => {
      const name = String(raw || '').trim();
      if (!name || seen.has(name)) return;
      seen.add(name);
      out.push(name);
    });
    return out;
  }

  /** Klasselister frå Flokkdeilar. */
  function flokkdeilarLists() {
    return VyrdepilStorage.getList('flokkdeilar', 'lister').map(item => ({
      label: item.name || 'Utan namn',
      source: 'Flokkdeilar',
      names: cleanNames((item.students || []).map(s => (s && s.name) || s))
    }));
  }

  /** Lagra oppsett og opne faner frå Klassekart. */
  function klassekartLists() {
    const out = [];
    VyrdepilStorage.getList('klassekart', 'oppsett').forEach(item => {
      const students = (item.data && item.data.students) || [];
      out.push({
        label: item.name || 'Utan namn',
        source: 'Klassekart',
        names: cleanNames(students.map(s => (s && s.name) || s))
      });
    });
    const gameState = VyrdepilStorage.getGameState('klassekart');
    const tabs = (gameState && gameState.tabs) || [];
    tabs.forEach(tab => {
      const students = (tab.data && tab.data.students) || [];
      out.push({
        label: (tab.name || 'Fane') + ' (open fane)',
        source: 'Klassekart',
        names: cleanNames(students.map(s => (s && s.name) || s))
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
    return lists.filter(l => l.names.length);
  }

  /* ---- Modal ---- */

  function open() {
    dom.sources.textContent = '';
    const lists = allSources();

    if (!lists.length) {
      dom.sources.appendChild(el('p', 'lk-muted',
        'Fann ingen klasselister i Flokkdeilar eller Klassekart i denne nettlesaren. Du kan lime inn namn nedanfor.'));
    } else {
      dom.sources.appendChild(el('span', 'lk-field-label', 'Klasselister i nettlesaren'));
      lists.forEach(list => {
        const row = el('div', 'lk-source-row');
        const text = el('div', 'lk-source-text');
        text.appendChild(el('strong', null, list.label));
        text.appendChild(el('span', 'lk-muted', ' ' + list.source + ' · ' + elevar(list.names.length)));
        row.appendChild(text);

        const btn = LK.util.iconButton('users', 'Bruk', 'btn lk-btn-small');
        btn.addEventListener('click', () => {
          apply(list.names, list.source + ': ' + list.label);
          LK.util.closeModal(dom.overlay);
        });
        row.appendChild(btn);
        dom.sources.appendChild(row);
      });
    }
    LK.util.openModal(dom.overlay);
  }

  function onPaste() {
    const names = cleanNames(dom.paste.value.split(/\r?\n/));
    if (!names.length) {
      LK.util.toast('Skriv minst eitt namn.');
      return;
    }
    apply(names, 'Innliming');
    dom.paste.value = '';
    LK.util.closeModal(dom.overlay);
  }

  function apply(names, source) {
    state.data.names = names;
    state.data.nameSource = names.length ? source : '';
    if (!names.length) state.data.settings.uniquePerPupil = false;
    state.emit('names');
    if (names.length) LK.util.toast('Henta ' + names.length + ' namn.');
  }

  /* ---- Rendering ---- */

  function render() {
    const names = state.data.names;
    dom.chips.textContent = '';
    dom.clearBtn.hidden = !names.length;

    if (!names.length) {
      dom.info.textContent = 'Utan namn blir det eitt ark med blank namnelinje. Hentar du namn, får kvar elev sitt eige ark.';
      return;
    }
    dom.info.textContent = elevar(names.length) + ' · kjelde: ' + (state.data.nameSource || 'ukjend')
      + '. Kvar elev får eit ferdig namngjeve ark.';
    names.forEach(name => dom.chips.appendChild(el('span', 'lk-chip', name)));
  }

  return { init, render };
})();
