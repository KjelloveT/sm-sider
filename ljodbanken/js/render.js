/* ══════════════════════════════════════════════
   RENDER.JS — Lista på skjermen

   Lista kan vere lang — Ljodstigen har 141 klipp — så vi byggjer henne
   éin gong og rører berre den rada som faktisk endra seg. Å byggje alt
   på nytt for kvart opptak ville rive fokus ut av knappen du står på,
   og skrolla deg til toppen midt i økta.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.render = (function () {
  'use strict';

  const rows = new Map();        // itemId -> nodane til rada
  const bankNodes = new Map();   // bankId -> { section, counter }
  let listRoot = null;
  let filter = 'alle';
  let progressFill = null;
  let progressLabel = null;

  /* ──────────────── Bygging ──────────────── */

  function build() {
    rows.clear();
    bankNodes.clear();
    listRoot.textContent = '';

    const list = LB.state.current();
    if (!list) return;

    list.banks.forEach((bank) => {
      const section = LB.util.el('section', 'lb-bank');
      section.dataset.bank = bank.id;

      const head = LB.util.el('div', 'lb-bank-head');
      head.appendChild(LB.util.el('h2', 'heading4 no-mt', bank.name));
      const counter = LB.util.el('span', 'lb-bank-count');
      head.appendChild(counter);
      section.appendChild(head);

      if (bank.note) section.appendChild(LB.util.el('p', 'lb-bank-note', bank.note));

      const holder = LB.util.el('div', 'lb-rows');
      bank.items.forEach((item) => holder.appendChild(buildRow(item, bank)));
      section.appendChild(holder);

      listRoot.appendChild(section);
      bankNodes.set(bank.id, { section: section, counter: counter });
    });

    updateAll();
  }

  function buildRow(item, bank) {
    const root = LB.util.el('article', 'lb-row');
    root.dataset.id = item.id;

    const main = LB.util.el('div', 'lb-row-main');
    const top = LB.util.el('div', 'lb-row-top');
    top.appendChild(LB.util.el('code', 'lb-id', item.id));
    top.appendChild(LB.util.el('span', 'lb-label', item.label));
    if (item.tag) top.appendChild(LB.util.el('span', 'lb-tag', item.tag));
    main.appendChild(top);
    if (item.hint) main.appendChild(LB.util.el('p', 'lb-hint', item.hint));

    const status = LB.util.el('div', 'lb-row-status');

    const actions = LB.util.el('div', 'lb-row-actions');
    const recBtn = LB.util.iconButton('mic', null, 'btn lb-icon-btn lb-rec-btn', 'Ta opp');
    const playBtn = LB.util.iconButton('play', null, 'btn lb-icon-btn', 'Spel av');
    const trimBtn = LB.util.iconButton('crop', null, 'btn lb-icon-btn', 'Skjer til');
    const dropBtn = LB.util.iconButton('trash2', null, 'btn lb-icon-btn lb-danger', 'Slett opptaket');

    recBtn.addEventListener('click', () => onRecord(item.id));
    playBtn.addEventListener('click', () => onPlay(item.id));
    trimBtn.addEventListener('click', () => LB.trim.open(item.id));
    dropBtn.addEventListener('click', () => onDrop(item.id, item.label));

    actions.appendChild(recBtn);
    actions.appendChild(playBtn);
    actions.appendChild(trimBtn);
    actions.appendChild(dropBtn);

    root.appendChild(main);
    root.appendChild(status);
    root.appendChild(actions);

    rows.set(item.id, {
      root: root, status: status, bank: bank,
      recBtn: recBtn, playBtn: playBtn, trimBtn: trimBtn, dropBtn: dropBtn
    });
    return root;
  }

  /* ──────────────── Handlingar ──────────────── */

  function onRecord(id) {
    const active = LB.session.state();
    if (active.id === id) {
      if (active.phase === 'opptak') LB.session.finish();
      else LB.session.cancel();
      return;
    }
    LB.session.record(id);
  }

  function onPlay(id) {
    const take = LB.state.get(id);
    if (!take) return;
    if (LB.audio.isPlaying()) { LB.audio.stop(); return; }
    LB.audio.play(take.buffer, take.start, take.end);
  }

  function onDrop(id, label) {
    if (!LB.state.has(id)) return;
    if (!window.confirm('Slette opptaket av «' + label + '»?')) return;
    LB.audio.stop();
    LB.state.remove(id);
  }

  /* ──────────────── Oppdatering ──────────────── */

  function updateAll() {
    rows.forEach((row, id) => updateRow(id));
    bankNodes.forEach((nodes, bankId) => {
      const p = LB.state.bankProgress(bankId);
      nodes.counter.textContent = p.done + ' av ' + p.total;
      nodes.counter.classList.toggle('lb-bank-done', p.total > 0 && p.done === p.total);
      nodes.section.hidden = !anyVisibleInBank(bankId);
    });
    updateProgress();
  }

  function anyVisibleInBank(bankId) {
    const list = LB.state.current();
    if (!list) return false;
    const bank = list.banks.find(b => b.id === bankId);
    if (!bank) return false;
    return bank.items.some(item => matchesFilter(item.id));
  }

  function matchesFilter(id) {
    if (filter === 'manglar') return !LB.state.has(id);
    if (filter === 'ferdige') return LB.state.has(id);
    return true;
  }

  function updateProgress() {
    const done = LB.state.count();
    const total = LB.state.total();
    const share = total ? Math.round((done / total) * 100) : 0;
    progressFill.style.width = share + '%';
    progressLabel.textContent = done + ' av ' + total + ' klipp er spelte inn';
  }

  /** Éi rad, slik ho ser ut akkurat no. */
  function updateRow(id) {
    const row = rows.get(id);
    if (!row) return;

    const take = LB.state.get(id);
    const active = LB.session.state();
    const isActive = active.id === id;

    row.root.hidden = !matchesFilter(id) && !isActive;
    row.root.dataset.state = isActive ? 'aktiv' : (take ? 'ferdig' : 'tom');

    /* Lista kan ha hundre rader, og kvar ferdig rad har ei lydkurve som
       må reknast ut for å teiknast. Er ingenting endra sidan sist, er
       den billegaste teikninga å la vere. */
    const signature = [row.root.hidden, row.root.dataset.state,
      take ? take.stamp + ':' + take.start.toFixed(3) + ':' + take.end.toFixed(3) : '-'].join('|');
    if (!isActive && row.signature === signature) return;
    row.signature = signature;

    row.playBtn.disabled = !take;
    row.trimBtn.disabled = !take;
    row.dropBtn.disabled = !take;
    row.recBtn.disabled = isActive && active.phase === 'handsamar';

    const live = isActive && active.phase === 'opptak';
    setRecIcon(row.recBtn, live ? 'stop' : 'mic',
      live ? 'Stopp opptaket' : (take ? 'Ta opp på nytt' : 'Ta opp'));
    row.recBtn.classList.toggle('lb-rec-live', live);

    if (isActive) { drawActive(row, active); return; }

    delete row.status.dataset.mode;
    row.status.textContent = '';

    if (!take) {
      row.status.appendChild(LB.util.el('span', 'lb-muted', 'Ikkje spelt inn'));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'lb-mini';
    canvas.width = 132;
    canvas.height = 34;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Lydkurve for opptaket');
    row.status.appendChild(canvas);
    drawMini(canvas, take);

    const meta = LB.util.el('div', 'lb-take-meta');
    meta.appendChild(LB.util.el('span', 'lb-len', LB.util.formatSeconds(LB.state.lengthOf(take))));
    if (take.peak != null && take.peak < 0.03) {
      const warn = LB.util.el('span', 'lb-quiet', 'svakt');
      warn.title = 'Opptaket er veldig svakt. Sjekk mikrofonen, eller ta det om att.';
      meta.appendChild(warn);
    }
    if (take.origin === 'fil') meta.appendChild(LB.util.el('span', 'lb-from-file', 'frå fil'));
    row.status.appendChild(meta);
  }

  /* Ikonet blir berre bytt når det FAKTISK endrar seg.
     Den aktive rada blir teikna om for kvar ramme, og bygde vi innhaldet
     i knappen på nytt kvar gong, ville SVG-en under fingeren bli bytt ut
     mellom mousedown og mouseup. Då finst det ikkje lenger noko felles
     opphav for dei to hendingane, nettlesaren fyrer aldri `click`, og
     stoppknappen let seg ikkje trykkje. */
  function setRecIcon(btn, iconName, title) {
    if (btn.dataset.icon === iconName && btn.title === title) return;
    btn.dataset.icon = iconName;
    btn.textContent = '';
    const span = LB.util.el('span');
    span.innerHTML = ICON(iconName, 16);
    btn.appendChild(span);
    btn.title = title;
    btn.setAttribute('aria-label', title);
  }

  /* Den aktive rada blir teikna om for kvar ramme medan opptaket går, så
     nedteljinga og nivåmålaren rører seg. */
  function drawActive(row, active) {
    if (row.status.dataset.mode !== active.phase) {
      row.status.textContent = '';
      row.status.dataset.mode = active.phase;

      if (active.phase === 'nedteljing') {
        row.status.appendChild(LB.util.el('div', 'lb-countdown'));
      } else if (active.phase === 'opptak') {
        const meter = LB.util.el('div', 'lb-meter');
        meter.appendChild(LB.util.el('div', 'lb-meter-fill'));
        row.status.appendChild(meter);
        row.status.appendChild(LB.util.el('output', 'lb-timer', '0,0 s'));
      } else {
        row.status.appendChild(LB.util.el('span', 'lb-muted', 'Handsamar …'));
      }
    }

    if (active.phase === 'nedteljing') {
      row.status.firstChild.textContent = String(active.count);
    } else if (active.phase === 'opptak') {
      const level = LB.session.level();
      const fill = row.status.querySelector('.lb-meter-fill');
      fill.style.width = Math.round(Math.min(1, level) * 100) + '%';
      fill.classList.toggle('lb-meter-hot', level > 0.98);
      row.status.querySelector('.lb-timer').textContent =
        LB.session.elapsed().toFixed(1).replace('.', ',') + ' s';
    }
  }

  /** Kurva i lista viser heile opptaket, med utsnittet markert. */
  function drawMini(canvas, take) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const styles = getComputedStyle(document.body);
    const ink = styles.getPropertyValue('--text').trim() || '#000000';
    const accent = styles.getPropertyValue('--accent').trim() || '#000000';

    ctx.clearRect(0, 0, w, h);
    const peaks = LB.audio.peaks(take.buffer, w);
    const mid = h / 2;
    const seconds = take.buffer.duration;

    for (let x = 0; x < w; x++) {
      const at = (x / w) * seconds;
      const inside = at >= take.start && at <= take.end;
      ctx.fillStyle = inside ? accent : ink;
      ctx.globalAlpha = inside ? 1 : 0.25;
      const top = mid - peaks[x * 2 + 1] * (mid - 1);
      const bottom = mid - peaks[x * 2] * (mid - 1);
      ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
    }
    ctx.globalAlpha = 1;
  }

  /* ──────────────── Oppstart ──────────────── */

  function setFilter(value) {
    filter = value;
    updateAll();
  }

  /* Rullar berre når rada faktisk er utanfor synsfeltet.
     Rullar vi kvar gong, flyttar knappane seg under handa til den som
     står klar til å trykkje stopp — og eit klikk som byrjar på ein knapp
     og endar ein annan stad blir ikkje til noko klikk. */
  function scrollTo(id) {
    const row = rows.get(id);
    if (!row || row.root.hidden) return;
    const box = row.root.getBoundingClientRect();
    const height = window.innerHeight || document.documentElement.clientHeight;
    if (box.top >= 80 && box.bottom <= height - 20) return;
    row.root.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function setup() {
    listRoot = document.getElementById('lbList');
    progressFill = document.getElementById('progressFill');
    progressLabel = document.getElementById('progressLabel');

    /* Lydkurvene er teikna med fargane frå temaet. Byter brukaren tema,
       står dei att i dei gamle fargane til noko anna endrar rada — så vi
       gløymer kva vi teikna og teiknar alt om att. */
    new MutationObserver(() => {
      rows.forEach((row) => { row.signature = null; });
      updateAll();
      if (LB.util.isOpen(document.getElementById('trimOverlay'))) LB.trim.redraw();
    }).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  }

  return { setup, build, updateAll, updateRow, setFilter, scrollTo };
})();
