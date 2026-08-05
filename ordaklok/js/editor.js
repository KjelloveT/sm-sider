/* Ordaklok — editor */
(function () {
  'use strict';

  const Storage = OrdaklokStorage;
  const { ICONS } = OrdaklokState;

  // Kva liste skal vi redigere? (?list=ID, eller ny)
  const params = new URLSearchParams(location.search);
  const listIdParam = params.get('list');

  let currentList = null; // den lista vi redigerer (klone)
  let isNewList = false;

  function init() {
    if (listIdParam) {
      const found = Storage.getList(listIdParam);
      if (found) {
        currentList = JSON.parse(JSON.stringify(found));
        document.getElementById('editorTitle').textContent = 'Rediger liste';
        document.getElementById('deleteBtn').style.display = '';
      } else {
        // Ikkje funne — start ny
        currentList = Storage.newListObject();
        isNewList = true;
      }
    } else {
      currentList = Storage.newListObject({
        title: '',
        labelA: 'Side A',
        labelB: 'Side B',
        pairs: [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }]
      });
      isNewList = true;
    }
    populate();
  }

  function populate() {
    document.getElementById('titleInput').value = currentList.title || '';
    document.getElementById('descriptionInput').value = currentList.description || '';
    document.getElementById('labelAInput').value = currentList.labelA || '';
    document.getElementById('labelBInput').value = currentList.labelB || '';
    syncTableHeaders();
    renderPairs();
  }

  function syncTableHeaders() {
    document.getElementById('thA').textContent = document.getElementById('labelAInput').value || 'Side A';
    document.getElementById('thB').textContent = document.getElementById('labelBInput').value || 'Side B';
  }

  // ---- Tabell-rendering ----
  const tbody = document.getElementById('pairTableBody');

  function renderPairs() {
    tbody.innerHTML = '';
    if (!currentList.pairs || !currentList.pairs.length) {
      currentList.pairs = [{ a: '', b: '' }];
    }
    currentList.pairs.forEach((p, idx) => tbody.appendChild(buildRow(p, idx)));
  }

  function buildRow(pair, idx) {
    const tr = document.createElement('tr');

    const tdNum = document.createElement('td');
    tdNum.className = 'col-num';
    tdNum.textContent = String(idx + 1);
    tr.appendChild(tdNum);

    const tdA = document.createElement('td');
    const inA = document.createElement('input');
    inA.type = 'text';
    inA.value = pair.a || '';
    inA.setAttribute('aria-label', 'Side A, rad ' + (idx + 1));
    inA.addEventListener('input', () => { pair.a = inA.value; });
    inA.addEventListener('keydown', handleKeyNav);
    tdA.appendChild(inA);
    tr.appendChild(tdA);

    const tdB = document.createElement('td');
    const inB = document.createElement('input');
    inB.type = 'text';
    inB.value = pair.b || '';
    inB.setAttribute('aria-label', 'Side B, rad ' + (idx + 1));
    inB.addEventListener('input', () => { pair.b = inB.value; });
    inB.addEventListener('keydown', handleKeyNav);
    tdB.appendChild(inB);
    tr.appendChild(tdB);

    const tdAlts = document.createElement('td');
    const inAlts = document.createElement('input');
    inAlts.type = 'text';
    inAlts.placeholder = 'valfritt';
    inAlts.value = (pair.alts || []).join(', ');
    inAlts.setAttribute('aria-label', 'Alternative svar, rad ' + (idx + 1));
    inAlts.addEventListener('input', () => {
      const list = inAlts.value.split(',').map(s => s.trim()).filter(Boolean);
      if (list.length) pair.alts = list;
      else delete pair.alts;
    });
    inAlts.addEventListener('keydown', handleKeyNav);
    tdAlts.appendChild(inAlts);
    tr.appendChild(tdAlts);

    const tdAct = document.createElement('td');
    tdAct.className = 'col-actions';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.setAttribute('aria-label', 'Fjern rad ' + (idx + 1));
    delBtn.innerHTML = ICONS.trash;
    delBtn.addEventListener('click', () => {
      currentList.pairs.splice(idx, 1);
      if (currentList.pairs.length === 0) currentList.pairs.push({ a: '', b: '' });
      renderPairs();
    });
    tdAct.appendChild(delBtn);
    tr.appendChild(tdAct);

    return tr;
  }

  function handleKeyNav(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Hopp til neste rad sin same kolonne, eller legg til ny rad om vi er sist
    const tr = e.target.closest('tr');
    const cellIdx = Array.from(tr.children).indexOf(e.target.closest('td'));
    const nextTr = tr.nextElementSibling;
    if (nextTr) {
      const nextInput = nextTr.children[cellIdx]?.querySelector('input');
      if (nextInput) nextInput.focus();
    } else {
      addRow();
      const newTr = tbody.lastElementChild;
      const nextInput = newTr.children[cellIdx]?.querySelector('input');
      if (nextInput) nextInput.focus();
    }
  }

  function addRow() {
    currentList.pairs.push({ a: '', b: '' });
    renderPairs();
  }

  document.getElementById('addRowBtn').addEventListener('click', addRow);

  // Live oppdatering av label-headers
  document.getElementById('labelAInput').addEventListener('input', syncTableHeaders);
  document.getElementById('labelBInput').addEventListener('input', syncTableHeaders);

  // ---- Lagre ----
  // Sett før vi sjølve navigerer bort (lagra eller sletta). Utan dette trur
  // beforeunload-vakta lenger nede at brukaren forlèt ulagra arbeid.
  let leaving = false;

  function collectFromForm() {
    currentList.title = document.getElementById('titleInput').value.trim() || 'Namnlaus liste';
    currentList.description = document.getElementById('descriptionInput').value.trim();
    currentList.labelA = document.getElementById('labelAInput').value.trim() || 'Side A';
    currentList.labelB = document.getElementById('labelBInput').value.trim() || 'Side B';
    // Reins par (fjern tomme)
    currentList.pairs = currentList.pairs
      .map(p => ({ a: (p.a || '').trim(), b: (p.b || '').trim(), alts: p.alts }))
      .filter(p => p.a && p.b);
    // Reins alts
    currentList.pairs.forEach(p => {
      if (p.alts) p.alts = p.alts.map(s => s.trim()).filter(Boolean);
      if (!p.alts || !p.alts.length) delete p.alts;
    });
  }

  function save() {
    collectFromForm();
    if (currentList.pairs.length === 0) {
      alert('Lista må ha minst eitt fullstendig ord-par (begge sider fylt ut).');
      return false;
    }
    Storage.saveList(currentList);
    return true;
  }

  function saveAndLeave() {
    if (!save()) return;
    leaving = true;
    location.href = 'index.html';
  }

  document.getElementById('saveBtn').addEventListener('click', saveAndLeave);
  document.getElementById('saveBtn2').addEventListener('click', saveAndLeave);

  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (!currentList.id) return;
    if (confirm(`Slett lista «${currentList.title}»? Dette kan ikkje angrast.`)) {
      Storage.deleteList(currentList.id);
      leaving = true;
      location.href = 'index.html';
    }
  });

  // ---- Eksport ----
  document.getElementById('exportBtn').addEventListener('click', () => {
    collectFromForm();
    if (currentList.pairs.length === 0) {
      alert('Legg til minst eitt par før du eksporterer.');
      return;
    }
    const out = {
      app: 'ordaklok',
      version: 1,
      id: currentList.id,
      title: currentList.title,
      labelA: currentList.labelA,
      labelB: currentList.labelB,
      description: currentList.description || '',
      pairs: currentList.pairs,
      created: currentList.created || new Date().toISOString(),
      updated: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(currentList.title) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function sanitizeFilename(s) {
    return String(s || 'liste').replace(/[^a-zA-Z0-9æøåÆØÅ_\- ]/g, '').replace(/\s+/g, '_').slice(0, 60) || 'liste';
  }

  // ---- Bulk-import ----
  const bulkOverlay = document.getElementById('bulkOverlay');
  const bulkInput = document.getElementById('bulkInput');
  document.getElementById('bulkBtn').addEventListener('click', () => {
    bulkInput.value = '';
    bulkOverlay.classList.add('open');
    setTimeout(() => bulkInput.focus(), 50);
  });
  function closeBulk() { bulkOverlay.classList.remove('open'); }
  document.getElementById('bulkClose').addEventListener('click', closeBulk);
  document.getElementById('bulkCancel').addEventListener('click', closeBulk);
  bulkOverlay.addEventListener('click', (e) => {
    if (e.target === bulkOverlay) closeBulk();
  });
  document.getElementById('bulkApply').addEventListener('click', () => {
    const text = bulkInput.value;
    const newPairs = parseBulk(text);
    if (newPairs.length === 0) {
      alert('Klarte ikkje å tolke nokre par. Sjekk formatet.');
      return;
    }
    // Behald eksisterande utfylte par; legg til nye etter
    const kept = currentList.pairs.filter(p => (p.a || '').trim() && (p.b || '').trim());
    currentList.pairs = kept.concat(newPairs);
    renderPairs();
    closeBulk();
  });

  function parseBulk(text) {
    const lines = String(text).split(/\r?\n/);
    const out = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // Prøv ulike skiljeteikn i prioritert rekkjefølgje
      const seps = [
        /\s*=\s*/,
        /\s*[—–-]\s*/, // em dash, en dash, hyphen
        /\s*:\s*/,
        /\t+/,
        /\s{2,}/
      ];
      let parts = null;
      for (const sep of seps) {
        const m = line.split(sep);
        if (m.length >= 2 && m[0].trim() && m.slice(1).join(' ').trim()) {
          parts = [m[0].trim(), m.slice(1).join(' ').trim()];
          break;
        }
      }
      if (!parts) continue;
      out.push({ a: parts[0], b: parts[1] });
    }
    return out;
  }

  // ---- Del-lenkje ----
  const shareLinkOverlay = document.getElementById('shareLinkOverlay');
  const shareLinkInput = document.getElementById('shareLinkInput');
  const shareLinkInfo = document.getElementById('shareLinkInfo');
  let currentShareUrl = '';

  document.getElementById('shareBtn').addEventListener('click', async () => {
    collectFromForm();
    if (currentList.pairs.length === 0) {
      alert('Legg til minst eitt par før du lagar delelenkje.');
      return;
    }
    shareLinkOverlay.classList.add('open');
    shareLinkInput.value = 'Lagar lenkje…';
    shareLinkInfo.textContent = '';
    try {
      const url = await OrdaklokShare.buildShareUrl(currentList);
      currentShareUrl = url;
      shareLinkInput.value = url;
      shareLinkInfo.textContent = `Lenkje-lengd: ${url.length} teikn.`;
    } catch (e) {
      shareLinkInput.value = 'Klarte ikkje å lage lenkje: ' + e.message;
    }
  });
  document.getElementById('shareLinkClose').addEventListener('click', () => shareLinkOverlay.classList.remove('open'));
  shareLinkOverlay.addEventListener('click', (e) => { if (e.target === shareLinkOverlay) shareLinkOverlay.classList.remove('open'); });
  document.getElementById('shareLinkCopy').addEventListener('click', async () => {
    if (!currentShareUrl) return;
    try {
      await navigator.clipboard.writeText(currentShareUrl);
      shareLinkInfo.textContent = 'Kopiert!';
    } catch {
      shareLinkInput.select();
      document.execCommand('copy');
      shareLinkInfo.textContent = 'Kopiert (med fallback).';
    }
  });
  document.getElementById('shareLinkOpenBtn').addEventListener('click', () => {
    if (currentShareUrl) window.open(currentShareUrl, '_blank', 'noopener');
  });

  // Esc lukkar overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (bulkOverlay.classList.contains('open')) closeBulk();
      if (shareLinkOverlay.classList.contains('open')) shareLinkOverlay.classList.remove('open');
    }
  });

  // Advar ved unsaved changes
  let savedSnapshot = '';
  function snapshot() {
    return JSON.stringify({
      t: document.getElementById('titleInput').value,
      d: document.getElementById('descriptionInput').value,
      la: document.getElementById('labelAInput').value,
      lb: document.getElementById('labelBInput').value,
      p: currentList.pairs
    });
  }
  window.addEventListener('beforeunload', (e) => {
    if (leaving) return;
    if (snapshot() !== savedSnapshot) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  // Etter init, ta snapshot
  setTimeout(() => { savedSnapshot = snapshot(); }, 100);

  // Start
  init();
})();
