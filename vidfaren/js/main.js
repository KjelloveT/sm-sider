/* ══════════════════════════════════════════════
   LANDKJENNING — Hovudlogikk: skjermbyte, modus/nivå-val,
   oppgåvevisning, timer og resultat.
   ══════════════════════════════════════════════ */

(function () {
  const S = { mode: null, level: 'lett', round: null, locked: false, qStart: 0, timer: null, timeout: null };

  const $ = id => document.getElementById(id);

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Oppsett ──────────────────────────────────────────────
  function renderTopStats() {
    $('statHigh').textContent = Progression.getHighScore();
    $('statTotal').textContent = Progression.getEarnedTotal();
    const earned = Progression.BADGES.filter(b => Progression.hasBadge(b.id)).length;
    $('badgeCountTop').textContent = earned;
  }

  function renderModes() {
    const grid = $('modeGrid');
    grid.innerHTML = '';
    Object.values(GeoData.MODES).forEach(m => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lk-mode-card';
      btn.dataset.mode = m.id;
      btn.innerHTML =
        `<span class="lk-mode-ico">${ICON(m.icon, 30)}</span>` +
        `<span class="lk-mode-name">${m.label}</span>`;
      btn.addEventListener('click', () => selectMode(m.id));
      grid.appendChild(btn);
    });
  }

  function selectMode(id) {
    S.mode = id;
    document.querySelectorAll('#modeGrid .lk-mode-card').forEach(c =>
      c.classList.toggle('selected', c.dataset.mode === id));
    refreshStartState();
  }

  function renderLevels() {
    const row = $('levelRow');
    row.innerHTML = '';
    Object.values(GeoData.LEVELS).forEach(l => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lk-level-btn' + (l.id === S.level ? ' selected' : '');
      btn.dataset.level = l.id;
      btn.textContent = l.label;
      btn.addEventListener('click', () => {
        S.level = l.id;
        document.querySelectorAll('#levelRow .lk-level-btn').forEach(b =>
          b.classList.toggle('selected', b.dataset.level === l.id));
        refreshStartState();
      });
      row.appendChild(btn);
    });
  }

  function refreshStartState() {
    const ok = S.mode && GeoData.modeAvailable(S.mode, GeoData.LEVELS[S.level].maxTier);
    $('startBtn').disabled = !ok;
  }

  // ── Runde ────────────────────────────────────────────────
  function startRound() {
    const questions = GeoData.buildRound(S.mode, S.level);
    if (!questions.length) { ProgressionUI.toast('Ingen oppgåver for denne modusen.', 'help', 'warn'); return; }
    S.round = new GeoRound(questions, S.mode, S.level);
    showScreen('gameScreen');
    renderQuestion();
  }

  function renderQuestion() {
    const r = S.round, q = r.current, m = GeoData.MODES[r.mode];
    S.locked = false;

    $('qProgress').textContent = `${r.index + 1} / ${r.total}`;
    $('scoreVal').textContent = r.score;
    $('streakVal').textContent = r.streak;
    $('streakBox').classList.toggle('hot', r.streak >= 3);
    $('qBlurb').textContent = m.blurb;

    // Prompt: visuell (omriss/pin) eller tekst
    const box = $('promptBox');
    box.innerHTML = '';
    box.classList.toggle('is-visual', !!m.visual);
    if (m.id === 'omriss') {
      box.appendChild(GeoMap.outline(q.answer));
    } else if (m.id === 'pin') {
      box.appendChild(GeoMap.worldZoomable({ pin: GeoMap.pinFor(q.answer) }));
    } else if (m.id === 'flagg') {
      const fig = document.createElement('div');
      fig.className = 'lk-flag';
      const img = document.createElement('img');
      img.src = q.answer.flag.replace(/^http:/, 'https:');
      img.alt = '';
      // Fallback: skjul biletramma stille om flagg-lenkja skulle bli broten.
      img.onerror = () => { fig.classList.add('is-broken'); };
      fig.appendChild(img);
      box.appendChild(fig);
    } else {
      // Hovudstad-modus: vis biletet av hovudstaden om vi har eitt.
      if (m.id === 'hovudstad' && q.answer.capitalImg) {
        const fig = document.createElement('div');
        fig.className = 'lk-cap-photo';
        const img = document.createElement('img');
        img.src = q.answer.capitalImg.replace(/^http:/, 'https:') +
          (q.answer.capitalImg.includes('?') ? '&' : '?') + 'width=640';
        img.alt = '';
        // Fallback: om lenkja er broten ein gong i framtida, skjul biletet stille.
        img.onerror = () => { fig.remove(); box.classList.remove('has-photo'); };
        fig.appendChild(img);
        box.appendChild(fig);
        box.classList.add('has-photo');
      }
      const t = document.createElement('div');
      t.className = 'lk-prompt-text';
      t.textContent = q.prompt;
      box.appendChild(t);
    }

    // Svaralternativ
    const grid = $('answerGrid');
    grid.innerHTML = '';
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `lk-ans lk-ans-${i}`;
      btn.dataset.idx = i;
      btn.textContent = opt.name;
      btn.addEventListener('click', () => onAnswer(i));
      grid.appendChild(btn);
    });

    startTimer();
  }

  function startTimer() {
    clearTimers();
    const limit = S.round.timeLimitSec;
    S.qStart = Date.now();
    const fill = $('timerFill');
    fill.style.transition = 'none';
    fill.style.width = '100%';
    // tving reflow før animasjon
    void fill.offsetWidth;
    fill.style.transition = `width ${limit}s linear`;
    fill.style.width = '0%';
    S.timeout = setTimeout(onTimeout, limit * 1000);
  }

  function clearTimers() {
    if (S.timeout) { clearTimeout(S.timeout); S.timeout = null; }
  }

  function revealButtons(correctIdx, chosenIdx) {
    document.querySelectorAll('#answerGrid .lk-ans').forEach(btn => {
      const i = Number(btn.dataset.idx);
      btn.disabled = true;
      if (i === correctIdx) btn.classList.add('correct');
      else if (i === chosenIdx) btn.classList.add('wrong');
      else btn.classList.add('dim');
    });
  }

  function onAnswer(idx) {
    if (S.locked) return;
    S.locked = true;
    clearTimers();
    freezeTimer();
    const timeUsed = Date.now() - S.qStart;
    const res = S.round.answer(idx, timeUsed);
    revealButtons(res.correctIndex, idx);

    $('scoreVal').textContent = S.round.score;
    $('streakVal').textContent = S.round.streak;
    if (res.isCorrect) {
      flashScore(res.points);
      if (res.streakBonus > 0) ProgressionUI.toast(`Streak! +${res.streakBonus}`, 'flame', 'badge');
    }
    ProgressionUI.evaluateAndAnnounce();
    setTimeout(next, res.isCorrect ? 1100 : 1500);
  }

  function onTimeout() {
    if (S.locked) return;
    S.locked = true;
    freezeTimer();
    S.round.timeout();
    revealButtons(S.round.current.correctIndex, -1);
    $('streakVal').textContent = 0;
    ProgressionUI.toast('Tida gjekk ut!', 'clock', 'warn');
    setTimeout(next, 1500);
  }

  function freezeTimer() {
    const fill = $('timerFill');
    const w = getComputedStyle(fill).width;
    fill.style.transition = 'none';
    fill.style.width = w;
  }

  function flashScore(points) {
    const el = $('scoreVal');
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    const pop = document.createElement('span');
    pop.className = 'lk-pop';
    pop.textContent = '+' + points;
    el.parentNode.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }

  function next() {
    S.round.advance();
    if (S.round.done) finishRound();
    else renderQuestion();
  }

  function finishRound() {
    const sum = S.round.finish();
    ProgressionUI.evaluateAndAnnounce();
    renderTopStats();

    $('resScore').textContent = sum.score;
    $('resCorrect').textContent = `${sum.correct}/${sum.total}`;
    $('resAccuracy').textContent = sum.accuracy + '%';
    $('resStreak').textContent = sum.bestStreak;
    $('resRecord').hidden = !sum.record;
    const perfect = sum.correct === sum.total && sum.total > 0;
    $('resultTitle').textContent = perfect ? 'Plettfritt!' : sum.accuracy >= 60 ? 'Godt jobba!' : 'Runde ferdig';
    $('resultMedal').innerHTML = ICON(perfect ? 'crown' : 'trophy', 44);

    showScreen('resultScreen');
  }

  function quit() {
    clearTimers();
    showScreen('setupScreen');
    renderTopStats();
  }

  // ── Oppstart ─────────────────────────────────────────────
  async function init() {
    Progression.load();
    renderModes();
    renderLevels();
    renderTopStats();

    $('startBtn').addEventListener('click', startRound);
    $('quitBtn').addEventListener('click', quit);
    $('againBtn').addEventListener('click', startRound);
    $('menuBtn').addEventListener('click', quit);
    $('badgeBtn').addEventListener('click', () => ProgressionUI.openBadgeGallery());

    try {
      await GeoData.load();
      refreshStartState();
    } catch (e) {
      console.error(e);
      ProgressionUI.toast('Klarte ikkje laste geografidata.', 'help', 'warn');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
