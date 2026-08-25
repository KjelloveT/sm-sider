/* ══════════════════════════════════════════════
   UIEXPORT.JS — Zip ut, zip inn

   Ut: éi fil per klipp, i ei mappe per bank, pluss `innhald.json` med
   heile lista og `innspeling.txt` med rettleiingane. Zip-fila er difor
   ikkje berre lyd — ho er heile arbeidet, og kan hentast inn att her
   seinare om økta må delast over fleire dagar.

   Inn: klipp som alt er ferdige blir lagde inn UENDRA når formatet
   stemmer. Å dekode ei mp3 og enkode henne på nytt kostar litt lyd for
   kvar runde, og på tredje dagen høyrest det.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.uiExport = (function () {
  'use strict';

  let overlay = null;
  let formatSelect = null;
  let bitrateRow = null;
  let bitrateSelect = null;
  let normalizeBox = null;
  let monoBox = null;
  let infoNode = null;
  let progressBox = null;
  let progressFill = null;
  let progressLabel = null;
  let startBtn = null;
  let busy = false;

  /* ──────────────── Dialogen ──────────────── */

  function open() {
    if (!LB.state.count()) {
      LB.util.toast('Du har ikkje spelt inn noko enno.');
      return;
    }
    LB.audio.stop();
    syncInfo();
    progressBox.hidden = true;
    startBtn.disabled = false;
    LB.util.openModal(overlay);
  }

  function close() {
    if (busy) return;
    LB.util.closeModal(overlay);
  }

  function syncInfo() {
    const format = formatSelect.value;
    bitrateRow.hidden = format !== 'mp3';

    let seconds = 0;
    let count = 0;
    LB.state.items().forEach((row) => {
      const take = LB.state.get(row.item.id);
      if (!take) return;
      count++;
      seconds += LB.state.lengthOf(take);
    });

    const ctx = LB.audio.context();
    const rate = ctx ? ctx.sampleRate : 48000;
    const channels = monoBox.checked ? 1 : 2;
    const bytes = LB.encode.estimate(format, parseInt(bitrateSelect.value, 10), seconds, count, rate, channels);

    infoNode.textContent = count + ' klipp, til saman ' + LB.util.formatSeconds(seconds, 1)
      + '. Zip-fila blir om lag ' + LB.util.formatBytes(bytes) + '.';
  }

  /* ──────────────── Sjølve jobben ──────────────── */

  function fileNameFor(list) {
    return (list.id || 'lydliste') + '-lyd.zip';
  }

  /** Eit klipp om til byte, slik det skal liggje i zip-fila. */
  function renderTake(take, format, kbps, mono, normalize) {
    if (take.origin === 'fil' && take.bytes && !take.edited && take.ext === format) {
      return take.bytes;
    }
    let buffer = LB.audio.slice(take.buffer, take.start, take.end);
    if (mono) buffer = LB.audio.toMono(buffer);
    if (normalize) buffer = LB.audio.normalize(buffer);
    return format === 'mp3' ? LB.encode.encodeMp3(buffer, kbps) : LB.encode.encodeWav(buffer);
  }

  function start() {
    const list = LB.state.current();
    const format = formatSelect.value;
    const kbps = parseInt(bitrateSelect.value, 10);
    const mono = monoBox.checked;
    const normalize = normalizeBox.checked;

    if (format === 'mp3' && !LB.encode.hasMp3()) {
      LB.util.toast('MP3-enkodaren blei ikkje lasta. Vel WAV i staden.');
      return;
    }

    const jobs = [];
    LB.state.items().forEach((row) => {
      const take = LB.state.get(row.item.id);
      if (take) jobs.push({ row: row, take: take });
    });

    busy = true;
    startBtn.disabled = true;
    progressBox.hidden = false;
    progressFill.style.width = '0%';
    progressLabel.textContent = 'Byrjar …';

    const files = [];
    const manifest = [];
    let at = 0;

    function step() {
      const until = performance.now() + 40;   // arbeid i korte bolkar
      try {
        while (at < jobs.length && performance.now() < until) {
          const job = jobs[at];
          const name = job.row.bank.id + '/' + job.row.item.id + '.' + format;
          const bytes = renderTake(job.take, format, kbps, mono, normalize);
          files.push({ name: name, bytes: bytes });
          manifest.push({
            id: job.row.item.id,
            bank: job.row.bank.id,
            label: job.row.item.label,
            file: name,
            seconds: Math.round(LB.state.lengthOf(job.take) * 1000) / 1000,
            bytes: bytes.length
          });
          at++;
        }
      } catch (err) {
        busy = false;
        startBtn.disabled = false;
        progressBox.hidden = true;
        LB.util.toast(err.message || 'Klarte ikkje lage fila.');
        return;
      }

      const share = jobs.length ? at / jobs.length : 1;
      progressFill.style.width = Math.round(share * 100) + '%';
      progressLabel.textContent = at + ' av ' + jobs.length + ' klipp';

      if (at < jobs.length) { setTimeout(step, 0); return; }
      finish(list, format, files, manifest);
    }

    setTimeout(step, 0);
  }

  function finish(list, format, files, manifest) {
    const encoder = new TextEncoder();
    files.push({
      name: 'innhald.json',
      bytes: encoder.encode(JSON.stringify({
        app: 'ljodbanken',
        version: 1,
        format: format,
        made: new Date().toISOString().slice(0, 10),
        list: list,
        clips: manifest
      }, null, 2))
    });
    files.push({ name: 'innspeling.txt', bytes: encoder.encode(readme(list, manifest)) });

    const blob = LB.zip.create(files);
    LB.util.downloadBlob(blob, fileNameFor(list));

    busy = false;
    startBtn.disabled = false;
    progressLabel.textContent = 'Ferdig — ' + LB.util.formatBytes(blob.size);
    LB.util.toast('Zip-fila er lasta ned.');
  }

  /** Rettleiingane følgjer med, så fila står støtt på eiga hand. */
  function readme(list, manifest) {
    const lines = [];
    lines.push(list.name || 'Lydliste');
    lines.push('Laga med Ljodbanken, ' + new Date().toISOString().slice(0, 10));
    lines.push('');
    if (list.note) { lines.push(list.note); lines.push(''); }
    lines.push('Klipp i fila: ' + manifest.length + ' av ' + LB.state.total());
    lines.push('');

    list.banks.forEach((bank) => {
      lines.push('== ' + bank.name + ' (' + bank.id + ') ==');
      if (bank.note) lines.push(bank.note);
      lines.push('');
      bank.items.forEach((item) => {
        const done = manifest.some(m => m.id === item.id);
        lines.push((done ? '[x] ' : '[ ] ') + item.id + '  ' + item.label
          + (item.tag ? '  (' + item.tag + ')' : ''));
        if (item.hint) lines.push('     ' + item.hint);
      });
      lines.push('');
    });
    return lines.join('\r\n');
  }

  /* ──────────────── Inn att ──────────────── */

  function importZip(file) {
    file.arrayBuffer()
      .then(ab => LB.zip.read(ab))
      .then(entries => absorb(entries))
      .catch(err => LB.util.toast(err.message || 'Klarte ikkje opne zip-fila.'));
  }

  function absorb(entries) {
    const audio = entries.filter(e => /\.(mp3|wav)$/i.test(e.name));
    if (!audio.length) {
      LB.util.toast('Fann ingen lydklipp i zip-fila.');
      return Promise.resolve();
    }

    const manifest = entries.find(e => e.name === 'innhald.json');
    if (manifest) {
      try {
        const data = JSON.parse(new TextDecoder().decode(manifest.bytes));
        maybeAdoptList(data);
      } catch (e) { /* fila var ikkje lesbar — vi held fram med lyden */ }
    }

    let taken = 0;
    let skipped = 0;

    const jobs = audio.map((entry) => {
      const id = LB.util.baseName(entry.name);
      if (!LB.state.itemById(id)) { skipped++; return Promise.resolve(); }
      const ext = entry.name.split('.').pop().toLowerCase();
      // decodeAudioData et bufferet sitt, så kopien må vere vår eigen.
      const copy = entry.bytes.slice().buffer;
      return LB.audio.decode(copy).then((buffer) => {
        LB.state.put(id, {
          buffer: buffer,
          start: 0,
          end: buffer.duration,
          origin: 'fil',
          bytes: entry.bytes,
          ext: ext,
          edited: false,
          peak: LB.audio.peakOf(buffer)
        });
        taken++;
      }).catch(() => { skipped++; });
    });

    return Promise.all(jobs).then(() => {
      LB.state.emit();
      LB.util.toast('Henta inn ' + taken + ' klipp'
        + (skipped ? ' — ' + skipped + ' høyrde ikkje til lista' : '') + '.');
    });
  }

  /* Zip-fila har lista med seg. Er det ei anna liste enn den som ligg
     framme, er klippa til inga nytte før lista blir bytt — så vi spør. */
  function maybeAdoptList(data) {
    const list = data && data.list;
    const current = LB.state.current();
    if (!list || !list.banks || (current && list.id === current.id)) return;
    const name = list.name || list.id;
    if (!window.confirm('Zip-fila høyrer til lista «' + name + '». Vil du opne henne?')) return;
    LB.list.use(list);
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup() {
    overlay = document.getElementById('exportOverlay');
    formatSelect = document.getElementById('exportFormat');
    bitrateRow = document.getElementById('exportBitrateRow');
    bitrateSelect = document.getElementById('exportBitrate');
    normalizeBox = document.getElementById('exportNormalize');
    monoBox = document.getElementById('exportMono');
    infoNode = document.getElementById('exportInfo');
    progressBox = document.getElementById('exportProgress');
    progressFill = document.getElementById('exportProgressFill');
    progressLabel = document.getElementById('exportProgressLabel');
    startBtn = document.getElementById('exportStart');

    formatSelect.addEventListener('change', syncInfo);
    bitrateSelect.addEventListener('change', syncInfo);
    monoBox.addEventListener('change', syncInfo);
    startBtn.addEventListener('click', start);
    document.getElementById('exportCancel').addEventListener('click', close);
    document.getElementById('exportClose').addEventListener('click', close);
    LB.util.bindOverlayClose(overlay);
  }

  return { setup, open, importZip };
})();
