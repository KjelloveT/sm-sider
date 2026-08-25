/* ══════════════════════════════════════════════
   UILIST.JS — Lag di eiga liste

   Ei liste er berre data: eit namn, ei felles rettleiing, og nokre
   bankar med klipp i. Du kan skrive henne her, lagre henne som ei
   `.json`-fil, og opne henne att neste gong — eller sende henne til
   nokon andre som skal spele inn same settet.

   Klippa blir skrivne som éi linje kvar:

       id | tekst | merkelapp | instruks

   Det er ikkje det finaste skjemaet, men det er det einaste som lèt
   deg lime inn hundre klipp frå eit rekneark utan å klikke hundre
   gonger. Berre `id` og `tekst` må vere med.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.list = (function () {
  'use strict';

  const ID_PATTERN = /^[A-Za-z0-9ÆØÅæøå_-]+$/;

  let overlay = null;
  let nameInput = null;
  let idInput = null;
  let noteInput = null;
  let banksNode = null;
  let statusNode = null;
  let draft = null;             // { name, id, note, banks: [{id, name, note, text}] }

  /* ──────────────── Ta lista i bruk ──────────────── */

  /**
   * Byter ut lista som ligg framme. Opptak som alt er gjorde høyrer til
   * den gamle lista, så dei blir borte — difor spør vi først.
   */
  function use(list, quiet) {
    if (LB.state.count() && !quiet) {
      if (!window.confirm('Du har ' + LB.state.count() + ' opptak i minnet. Dei følgjer den lista som ligg framme no, og blir borte når du byter. Halde fram?')) {
        return false;
      }
    }
    LB.audio.stop();
    LB.session.cancel();
    LB.state.setList(list);
    LB.render.build();
    document.getElementById('listName').textContent = list.name || 'Namnlaus liste';
    document.getElementById('listNote').textContent = list.note || '';
    document.getElementById('listNote').hidden = !list.note;
    return true;
  }

  /* ──────────────── Lesing og skriving av fil ──────────────── */

  /** Kastar med ei forklaring brukaren kan gjere noko med. */
  function validate(data) {
    if (!data || typeof data !== 'object') throw new Error('Fila inneheldt inga liste.');
    if (!Array.isArray(data.banks) || !data.banks.length) throw new Error('Lista har ingen bankar.');

    const seen = new Set();
    data.banks.forEach((bank) => {
      if (!bank.id || !ID_PATTERN.test(bank.id)) throw new Error('Banken «' + (bank.name || bank.id) + '» har ein id som ikkje kan brukast som mappenamn.');
      if (!Array.isArray(bank.items) || !bank.items.length) throw new Error('Banken «' + (bank.name || bank.id) + '» har ingen klipp.');
      bank.items.forEach((item) => {
        if (!item.id || !ID_PATTERN.test(item.id)) throw new Error('Klippet «' + (item.label || item.id) + '» har ein id som ikkje kan brukast som filnamn.');
        if (seen.has(item.id)) throw new Error('Id-en «' + item.id + '» er brukt to gonger. Kvar id må vere unik i heile lista.');
        seen.add(item.id);
      });
    });
    return data;
  }

  function saveToFile(list) {
    const payload = {
      app: 'ljodbanken',
      version: 1,
      id: list.id,
      name: list.name,
      note: list.note,
      banks: list.banks
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    LB.util.downloadBlob(blob, (list.id || 'lydliste') + '.json');
  }

  function openFile(file) {
    file.text().then((text) => {
      let data;
      try { data = validate(JSON.parse(text)); }
      catch (err) { LB.util.toast(err.message || 'Fila kunne ikkje lesast.'); return; }
      if (use(normalize(data))) LB.util.toast('Lista «' + (data.name || data.id) + '» er opna.');
    }).catch(() => LB.util.toast('Klarte ikkje lese fila.'));
  }

  /** Fyller ut det som manglar, så resten av koden slepp å sjekke. */
  function normalize(data) {
    return {
      app: 'ljodbanken',
      version: 1,
      id: data.id || 'lydliste',
      name: data.name || 'Namnlaus liste',
      note: data.note || '',
      banks: data.banks.map(bank => ({
        id: bank.id,
        name: bank.name || bank.id,
        note: bank.note || '',
        items: bank.items.map(item => ({
          id: item.id,
          label: item.label || item.id,
          tag: item.tag || '',
          hint: item.hint || ''
        }))
      }))
    };
  }

  /* ──────────────── Redigering ──────────────── */

  function slug(text) {
    return String(text || '').trim().toLowerCase()
      .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function draftFrom(list) {
    return {
      name: list.name || '',
      id: list.id || '',
      note: list.note || '',
      banks: list.banks.map(bank => ({
        id: bank.id,
        name: bank.name,
        note: bank.note || '',
        text: bank.items.map(itemToLine).join('\n')
      }))
    };
  }

  function itemToLine(item) {
    const parts = [item.id, item.label];
    if (item.tag || item.hint) parts.push(item.tag || '');
    if (item.hint) parts.push(item.hint);
    return parts.join(' | ');
  }

  function blankDraft() {
    return {
      name: '', id: '', note: '',
      banks: [{ id: 'bank1', name: 'Første bank', note: '', text: '' }]
    };
  }

  function openEditor(mode) {
    const list = LB.state.current();
    draft = (mode === 'endre' && list) ? draftFrom(list) : blankDraft();
    nameInput.value = draft.name;
    idInput.value = draft.id;
    noteInput.value = draft.note;
    renderBanks();
    setStatus('');
    LB.util.openModal(overlay);
  }

  function renderBanks() {
    banksNode.textContent = '';
    draft.banks.forEach((bank, index) => banksNode.appendChild(bankBlock(bank, index)));
  }

  function bankBlock(bank, index) {
    const box = LB.util.el('div', 'lb-edit-bank');

    const head = LB.util.el('div', 'lb-edit-bank-head');
    head.appendChild(LB.util.el('span', 'lb-edit-bank-nr', 'Bank ' + (index + 1)));
    const dropBtn = LB.util.iconButton('trash2', null, 'btn lb-icon-btn lb-danger', 'Slett banken');
    dropBtn.addEventListener('click', () => {
      if (draft.banks.length === 1) { setStatus('Lista må ha minst éin bank.', true); return; }
      draft.banks.splice(index, 1);
      renderBanks();
    });
    head.appendChild(dropBtn);
    box.appendChild(head);

    const grid = LB.util.el('div', 'lb-edit-grid');
    grid.appendChild(field('Namn', bank.name, 'text', (value) => { bank.name = value; }));
    grid.appendChild(field('Id (blir mappenamn)', bank.id, 'text', (value) => { bank.id = value; }));
    box.appendChild(grid);

    box.appendChild(field('Rettleiing for banken', bank.note, 'textarea', (value) => { bank.note = value; }));

    const clips = LB.util.el('label', 'lb-field');
    clips.appendChild(LB.util.el('span', 'lb-field-label', 'Klipp — ei linje per klipp: id | tekst | merkelapp | instruks'));
    const area = LB.util.el('textarea', 'lb-input lb-clip-area');
    area.rows = 8;
    area.value = bank.text;
    area.spellcheck = false;
    area.placeholder = 'f_a | a | vokal | Hald 0,5–0,7 s. Rein vokal.';
    area.addEventListener('input', () => {
      bank.text = area.value;
      count.textContent = countLines(area.value) + ' klipp';
    });
    clips.appendChild(area);
    const count = LB.util.el('span', 'lb-field-hint', countLines(bank.text) + ' klipp');
    clips.appendChild(count);
    box.appendChild(clips);

    return box;
  }

  function field(labelText, value, kind, onInput) {
    const label = LB.util.el('label', 'lb-field');
    label.appendChild(LB.util.el('span', 'lb-field-label', labelText));
    const input = LB.util.el(kind === 'textarea' ? 'textarea' : 'input', 'lb-input');
    if (kind === 'textarea') input.rows = 2; else input.type = 'text';
    input.value = value || '';
    input.addEventListener('input', () => onInput(input.value));
    label.appendChild(input);
    return label;
  }

  function countLines(text) {
    return String(text || '').split('\n').filter(line => line.trim()).length;
  }

  function setStatus(message, isError) {
    statusNode.textContent = message;
    statusNode.classList.toggle('lb-error', !!isError);
  }

  /* ──────────────── Frå skjema til liste ──────────────── */

  function collect() {
    const name = nameInput.value.trim() || 'Namnlaus liste';
    const id = slug(idInput.value) || slug(name) || 'lydliste';

    const banks = draft.banks.map((bank, index) => {
      const bankId = slug(bank.id) || ('bank' + (index + 1));
      const items = [];
      bank.text.split('\n').forEach((line) => {
        const raw = line.trim();
        if (!raw) return;
        const parts = raw.split('|').map(p => p.trim());
        if (!parts[0]) return;
        items.push({
          id: parts[0],
          label: parts[1] || parts[0],
          tag: parts[2] || '',
          hint: parts[3] || ''
        });
      });
      return { id: bankId, name: bank.name.trim() || ('Bank ' + (index + 1)), note: bank.note.trim(), items: items };
    });

    return validate({ app: 'ljodbanken', version: 1, id: id, name: name, note: noteInput.value.trim(), banks: banks });
  }

  function tryCollect() {
    try { return normalize(collect()); }
    catch (err) { setStatus(err.message, true); return null; }
  }

  function apply() {
    const list = tryCollect();
    if (!list) return;
    if (!use(list)) return;
    LB.util.closeModal(overlay);
    LB.util.toast('Lista «' + list.name + '» ligg framme, med ' + LB.state.total() + ' klipp.');
  }

  function saveDraft() {
    const list = tryCollect();
    if (!list) return;
    saveToFile(list);
    setStatus('Lista er lasta ned som ' + list.id + '.json.');
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup() {
    overlay = document.getElementById('listOverlay');
    nameInput = document.getElementById('listEditName');
    idInput = document.getElementById('listEditId');
    noteInput = document.getElementById('listEditNote');
    banksNode = document.getElementById('listEditBanks');
    statusNode = document.getElementById('listEditStatus');

    nameInput.addEventListener('input', () => { draft.name = nameInput.value; });
    idInput.addEventListener('input', () => { draft.id = idInput.value; });
    noteInput.addEventListener('input', () => { draft.note = noteInput.value; });

    document.getElementById('listAddBank').addEventListener('click', () => {
      draft.banks.push({ id: 'bank' + (draft.banks.length + 1), name: 'Ny bank', note: '', text: '' });
      renderBanks();
    });
    document.getElementById('listApply').addEventListener('click', apply);
    document.getElementById('listSave').addEventListener('click', saveDraft);
    document.getElementById('listCancel').addEventListener('click', () => LB.util.closeModal(overlay));
    document.getElementById('listEditClose').addEventListener('click', () => LB.util.closeModal(overlay));
    LB.util.bindOverlayClose(overlay);
  }

  return { setup, use, openEditor, openFile, saveToFile, validate, normalize };
})();
