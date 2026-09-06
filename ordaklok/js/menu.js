/* Ordaklok — meny / index.html
 * Viser liste-kort, importer JSON, importer delelenkje, last inn dømeliste.
 */
(function () {
  'use strict';

  const { escapeHtml, ICONS } = OrdaklokState;
  const Storage = OrdaklokStorage;

  const listsContainer = document.getElementById('listsContainer');
  const emptyHelp = document.getElementById('emptyHelp');

  function modeLabel(mode) {
    return ({
      type: 'Skriv',
      mc: 'Fleirval',
      flashcard: 'Hugsekort',
      match: 'Tevling'
    })[mode] || mode;
  }

  function makeStamp(text, color) {
    const el = document.createElement('span');
    el.className = 'bk-stamp bk-stamp-' + (color || 'gold');
    el.style.setProperty('--stamp-rot', (Math.random() * 8 - 4).toFixed(1) + 'deg');
    el.style.fontSize = '0.72rem';
    el.style.padding = '4px 10px';
    el.textContent = text;
    return el;
  }

  function bestScoreSummary(listId) {
    const scores = Storage.getScoresForList(listId);
    let best = null;
    for (const m of Object.keys(scores)) {
      const s = scores[m];
      if (typeof s.best === 'number' && (!best || s.best > best.best)) {
        best = { mode: m, best: s.best };
      }
    }
    return best;
  }

  function renderList() {
    const lists = Storage.getLists();
    listsContainer.innerHTML = '';
    if (!lists.length) {
      emptyHelp.style.display = '';
      return;
    }
    emptyHelp.style.display = 'none';

    // Sorter etter sist oppdatert (nyaste først)
    const sorted = lists.slice().sort((a, b) =>
      String(b.updated || '').localeCompare(String(a.updated || ''))
    );

    for (const list of sorted) {
      const card = document.createElement('div');
      card.className = 'bk-list-card';

      // Liten stempel-badge øvre høgre om utvida
      const stats = OrdaklokLeitner.masteryStats(Storage.getLeitner(list.id), list.pairs.length);
      const best = bestScoreSummary(list.id);
      if (list.builtin) {
        const stampWrap = document.createElement('div');
        stampWrap.className = 'bk-list-card-stamp';
        stampWrap.appendChild(makeStamp('STANDARD', 'blue'));
        card.appendChild(stampWrap);
      } else if (stats.mastered > 0 || best) {
        const stampWrap = document.createElement('div');
        stampWrap.className = 'bk-list-card-stamp';
        if (stats.mastered === stats.total && stats.total > 0) {
          stampWrap.appendChild(makeStamp('MEISTRA', 'green'));
        } else if (best) {
          stampWrap.appendChild(makeStamp(best.best + 'p', 'gold'));
        }
        card.appendChild(stampWrap);
      }

      const title = document.createElement('h3');
      title.className = 'bk-list-card-title';
      title.textContent = list.title;
      card.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'bk-list-card-meta';
      meta.innerHTML = `<span><strong>${list.pairs.length}</strong> par</span><span>${escapeHtml(list.labelA)} ↔ ${escapeHtml(list.labelB)}</span>`;
      card.appendChild(meta);

      if (stats.mastered > 0 && stats.mastered < stats.total) {
        const progress = document.createElement('div');
        progress.className = 'bk-list-card-meta';
        progress.style.fontSize = '0.78rem';
        progress.innerHTML = `<span><strong>${stats.mastered}</strong>/${stats.total} meistra</span>`;
        if (best) {
          progress.innerHTML += `<span>Best: ${best.best}p · ${escapeHtml(modeLabel(best.mode))}</span>`;
        }
        card.appendChild(progress);
      } else if (best && stats.mastered === 0) {
        const bestMeta = document.createElement('div');
        bestMeta.className = 'bk-list-card-meta';
        bestMeta.style.fontSize = '0.78rem';
        bestMeta.innerHTML = `<span>Best: ${best.best}p · ${escapeHtml(modeLabel(best.mode))}</span>`;
        card.appendChild(bestMeta);
      }

      if (list.description) {
        const desc = document.createElement('p');
        desc.className = 'bk-muted';
        desc.style.fontSize = '0.85rem';
        desc.style.fontStyle = 'italic';
        desc.textContent = list.description;
        card.appendChild(desc);
      }

      const actions = document.createElement('div');
      actions.className = 'bk-list-card-actions';

      const playBtn = document.createElement('a');
      playBtn.className = 'bk-btn bk-btn-primary bk-btn-small';
      playBtn.href = 'play.html?list=' + encodeURIComponent(list.id);
      playBtn.innerHTML = ICONS.play + '<span> Spel</span>';
      actions.appendChild(playBtn);

      if (!list.builtin) {
        const editBtn = document.createElement('a');
        editBtn.className = 'bk-btn bk-btn-small';
        editBtn.href = 'editor.html?list=' + encodeURIComponent(list.id);
        editBtn.setAttribute('aria-label', 'Rediger ' + list.title);
        editBtn.innerHTML = ICONS.edit;
        actions.appendChild(editBtn);
      }

      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'bk-btn bk-btn-small';
      dupBtn.setAttribute('aria-label', 'Dupliser ' + list.title);
      dupBtn.innerHTML = ICONS.copy;
      dupBtn.addEventListener('click', () => {
        Storage.duplicateList(list.id);
        renderList();
      });
      actions.appendChild(dupBtn);

      const exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.className = 'bk-btn bk-btn-small';
      exportBtn.setAttribute('aria-label', 'Eksporter ' + list.title);
      exportBtn.innerHTML = ICONS.download;
      exportBtn.addEventListener('click', () => exportList(list));
      actions.appendChild(exportBtn);

      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'bk-btn bk-btn-small';
      shareBtn.setAttribute('aria-label', 'Lag delelenkje for ' + list.title);
      shareBtn.innerHTML = ICONS.share;
      shareBtn.addEventListener('click', () => showShareLink(list));
      actions.appendChild(shareBtn);

      if (!list.builtin) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'bk-btn bk-btn-small bk-btn-danger';
        delBtn.setAttribute('aria-label', 'Slett ' + list.title);
        delBtn.innerHTML = ICONS.trash;
        delBtn.addEventListener('click', () => {
          if (confirm(`Vil du slette lista «${list.title}»? Dette kan ikkje angrast.`)) {
            Storage.deleteList(list.id);
            renderList();
          }
        });
        actions.appendChild(delBtn);
      }

      card.appendChild(actions);
      listsContainer.appendChild(card);
    }
  }

  function exportList(list) {
    // Fjern tomme felt for renare eksport
    const out = {
      app: 'ordaklok',
      version: 1,
      id: list.id,
      title: list.title,
      labelA: list.labelA,
      labelB: list.labelB,
      description: list.description || '',
      pairs: list.pairs,
      created: list.created,
      updated: list.updated
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(list.title) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sanitizeFilename(s) {
    return String(s || 'liste').replace(/[^a-zA-Z0-9æøåÆØÅ_\- ]/g, '').replace(/\s+/g, '_').slice(0, 60) || 'liste';
  }

  function exportAllLists() {
    const lists = Storage.getLists();
    if (!lists.length) {
      alert('Du har ingen lister å eksportere.');
      return;
    }
    const out = {
      app: 'ordaklok',
      version: 1,
      exported: new Date().toISOString(),
      lists: lists.map(list => ({
        id: list.id,
        title: list.title,
        labelA: list.labelA,
        labelB: list.labelB,
        description: list.description || '',
        pairs: list.pairs,
        created: list.created,
        updated: list.updated
      }))
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ordaklok_alle_lister_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- Share link modal ----
  const shareLinkOverlay  = document.getElementById('shareLinkOverlay');
  const shareLinkInput    = document.getElementById('shareLinkInput');
  const shareLinkInfo     = document.getElementById('shareLinkInfo');
  const shareLinkClose    = document.getElementById('shareLinkClose');
  const shareLinkQR       = document.getElementById('shareLinkQR');
  const shareLinkQRWarn   = document.getElementById('shareLinkQRWarn');
  const shareLinkQRFail   = document.getElementById('shareLinkQRFail');
  const shareLinkCopyQR   = document.getElementById('shareLinkCopyQR');
  const shareLinkCopyURL  = document.getElementById('shareLinkCopyURL');
  const shareLinkOpen     = document.getElementById('shareLinkOpen');

  let currentShareUrl = '';

  /** Nullstill QR-flata. Vist=false gøymer sjølve lerretet (så ramma ikkje
      blir ståande att som ein liten prikk når det ikkje finst nokon kode). */
  function resetQR(visible) {
    shareLinkQR.width = 0;
    shareLinkQR.height = 0;
    shareLinkQR.style.display = visible ? '' : 'none';
    shareLinkQRWarn.style.display = 'none';
    shareLinkQRFail.style.display = 'none';
    shareLinkCopyQR.disabled = true;
  }

  /**
   * Teiknar QR-koden for lenkja. Ein QR-kode rommar berre eit visst tal teikn
   * (~2 900 på nivå L), og lenkja veks med talet på ord i lista. Blir ho for
   * lang, kastar qrcode() — då seier vi tydeleg frå i staden for å la brukaren
   * stå att med ei tom rute.
   */
  function renderQR(url) {
    try {
      var qr = qrcode(0, 'L');
      qr.addData(url);
      qr.make();
      var modules = qr.getModuleCount();
      var maxSize = 220;
      var scale = Math.max(1, Math.floor(maxSize / modules));
      shareLinkQR.width  = modules * scale;
      shareLinkQR.height = modules * scale;
      var ctx = shareLinkQR.getContext('2d');
      ctx.clearRect(0, 0, shareLinkQR.width, shareLinkQR.height);
      for (var r = 0; r < modules; r++) {
        for (var c = 0; c < modules; c++) {
          ctx.fillStyle = qr.isDark(r, c) ? '#000000' : '#ffffff';
          ctx.fillRect(c * scale, r * scale, scale, scale);
        }
      }
      shareLinkQR.style.display = '';
      shareLinkQRFail.style.display = 'none';
      shareLinkQRWarn.style.display = url.length > 900 ? '' : 'none';
      shareLinkCopyQR.disabled = false;
    } catch (e) {
      resetQR(false);
      shareLinkQRFail.style.display = '';
    }
  }

  async function showShareLink(list) {
    shareLinkInput.value = 'Lagar lenkje…';
    shareLinkInfo.textContent = '';
    resetQR(true);
    shareLinkOverlay.classList.add('open');
    try {
      const url = await OrdaklokShare.buildShareUrl(list);
      currentShareUrl = url;
      shareLinkInput.value = url;
      if (url.length > 8000) {
        shareLinkInfo.textContent = 'NB: Lenkja er svært lang — ho kan ikkje fungere i alle e-postklientar.';
      }
      renderQR(url);
    } catch (e) {
      shareLinkInput.value = 'Klarte ikkje å lage lenkje: ' + e.message;
    }
  }

  function closeShareLink() {
    shareLinkOverlay.classList.remove('open');
  }

  shareLinkClose.addEventListener('click', closeShareLink);
  shareLinkOverlay.addEventListener('click', (e) => {
    if (e.target === shareLinkOverlay) closeShareLink();
  });

  shareLinkCopyQR.addEventListener('click', async () => {
    if (!shareLinkQR.width) return;
    try {
      const blob = await new Promise(res => shareLinkQR.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      shareLinkInfo.textContent = 'QR-kode kopiert som bilete!';
    } catch {
      shareLinkInfo.textContent = 'Klarte ikkje å kopiere bilete — prøv høgreklikk på QR-koden.';
    }
  });

  shareLinkCopyURL.addEventListener('click', async () => {
    if (!currentShareUrl) return;
    try {
      await navigator.clipboard.writeText(currentShareUrl);
      shareLinkInfo.textContent = 'Lenkje kopiert!';
    } catch {
      shareLinkInput.select();
      document.execCommand('copy');
      shareLinkInfo.textContent = 'Lenkje kopiert!';
    }
  });

  shareLinkOpen.addEventListener('click', () => {
    if (currentShareUrl) window.open(currentShareUrl, '_blank', 'noopener');
  });

  // ---- Share import modal (når URL inneheld d/dz) ----
  const shareImportOverlay = document.getElementById('shareImportOverlay');
  const shareImportPreview = document.getElementById('shareImportPreview');
  const shareImportClose = document.getElementById('shareImportClose');
  const shareImportAccept = document.getElementById('shareImportAccept');
  const shareImportCancel = document.getElementById('shareImportCancel');

  let pendingImportList = null;

  function closeShareImport() {
    shareImportOverlay.classList.remove('open');
    // Fjern d/dz frå URL utan å reloade
    const url = new URL(location.href);
    url.searchParams.delete('d');
    url.searchParams.delete('dz');
    history.replaceState({}, '', url.toString());
  }

  shareImportClose.addEventListener('click', closeShareImport);
  shareImportCancel.addEventListener('click', closeShareImport);
  shareImportOverlay.addEventListener('click', (e) => {
    if (e.target === shareImportOverlay) closeShareImport();
  });

  shareImportAccept.addEventListener('click', () => {
    if (!pendingImportList) return;
    const v = OrdaklokState.validateList(pendingImportList);
    if (!v.ok) { alert('Klarte ikkje å lagre: ' + v.error); return; }
    // Gje ny id slik at det ikkje overskriv eksisterande
    v.list.id = 'list_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    Storage.saveList(v.list);
    closeShareImport();
    renderList();
  });

  async function checkShareImport() {
    const params = OrdaklokShare.readParams();
    if (!params.has('d') && !params.has('dz')) return;
    OrdaklokShare.scrubLegacyQuery();
    try {
      const obj = await OrdaklokShare.decodeFromParams(params);
      if (!obj) return;
      const v = OrdaklokState.validateList(obj);
      if (!v.ok) {
        shareImportPreview.textContent = 'Lenkja inneheld ikkje ei gyldig liste: ' + v.error;
        shareImportAccept.disabled = true;
        shareImportOverlay.classList.add('open');
        return;
      }
      pendingImportList = v.list;
      shareImportAccept.disabled = false;
      // Render preview
      shareImportPreview.innerHTML = '';
      const t = document.createElement('h3');
      t.style.fontFamily = 'var(--bk-serif)';
      t.style.margin = '0 0 6px';
      t.textContent = v.list.title;
      shareImportPreview.appendChild(t);
      const m = document.createElement('p');
      m.className = 'bk-muted';
      m.textContent = `${v.list.pairs.length} par · ${v.list.labelA} ↔ ${v.list.labelB}`;
      shareImportPreview.appendChild(m);
      const preview = document.createElement('ul');
      preview.style.margin = '8px 0 0';
      preview.style.paddingLeft = '20px';
      v.list.pairs.slice(0, 5).forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.a} – ${p.b}`;
        preview.appendChild(li);
      });
      if (v.list.pairs.length > 5) {
        const li = document.createElement('li');
        li.className = 'bk-muted';
        li.textContent = `…og ${v.list.pairs.length - 5} til`;
        preview.appendChild(li);
      }
      shareImportPreview.appendChild(preview);
      shareImportOverlay.classList.add('open');
    } catch (e) {
      console.warn('Klarte ikkje å lese delelenkje:', e);
    }
  }

  // ---- Importer JSON ----
  const importJsonBtn = document.getElementById('importJsonBtn');
  const importJsonFile = document.getElementById('importJsonFile');
  importJsonBtn.addEventListener('click', () => importJsonFile.click());
  importJsonFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);

      // Sjekk om det er "alle lister"-format (har 'lists' array)
      if (obj.app === 'ordaklok' && Array.isArray(obj.lists)) {
        // Importer alle lister
        let imported = 0;
        let skipped = 0;
        for (const list of obj.lists) {
          const v = OrdaklokState.validateList(list);
          if (!v.ok) {
            console.warn('Hoppar over ugyldig liste:', v.error);
            skipped++;
            continue;
          }
          const existing = Storage.getList(v.list.id);
          if (existing) {
            v.list.id = 'list_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          }
          Storage.saveList(v.list);
          imported++;
        }
        renderList();
        alert(`Import ferdig: ${imported} lister lagt til${skipped > 0 ? `, ${skipped} hoppa over` : ''}.`);
        return;
      }

      // Ellers, prøv enkeltliste-format
      const v = OrdaklokState.validateList(obj);
      if (!v.ok) { alert('Klarte ikkje å importere: ' + v.error); return; }
      // Sjekk om id allereie finst
      const existing = Storage.getList(v.list.id);
      if (existing) {
        if (!confirm(`Lista «${existing.title}» finst allereie. Vil du overskrive ho?`)) {
          v.list.id = 'list_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        }
      }
      Storage.saveList(v.list);
      renderList();
    } catch (err) {
      alert('Ugyldig JSON-fil: ' + err.message);
    } finally {
      importJsonFile.value = '';
    }
  });

  // ---- Last inn dømeliste ----
  document.getElementById('loadSampleBtn').addEventListener('click', () => {
    const sample = JSON.parse(JSON.stringify(OrdaklokSample.SAMPLE_LIST));
    // Sjekk om allereie finst
    if (Storage.getList(sample.id)) {
      if (!confirm('Dømelista er allereie lagra. Vil du overskrive ho?')) return;
    }
    Storage.saveList(sample);
    renderList();
  });

  // ---- Eksporter alle lister ----
  document.getElementById('exportAllBtn').addEventListener('click', exportAllLists);

  // Esc lukkar overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (shareLinkOverlay.classList.contains('open')) closeShareLink();
      if (shareImportOverlay.classList.contains('open')) closeShareImport();
    }
  });

  // Init
  renderList();
  checkShareImport();
})();
