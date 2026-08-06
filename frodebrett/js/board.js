/* Frødebrett — spelmodul: lagoppsett, brett, spørsmål, poenggjeving,
 * daglegdobbel, finalerunde og vinnar. */
(function (root) {
  'use strict';

  const FB = root.FB;
  const S = FB.state;
  const Store = root.FrodebrettStorage;

  const Board = {};

  // ===== LAGOPPSETT =====

  Board.bindTeamSetup = function () {
    FB.el('btn-add-team').addEventListener('click', () => Board.addTeamInput());
    Board.updateTeamRemoveButtons();
  };

  Board.addTeamInput = function () {
    const container = FB.el('teams-container');
    const count = container.children.length;
    if (count >= 6) return;

    const row = document.createElement('div');
    row.className = 'team-input';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-input team-name';
    input.placeholder = 'Lag ' + (count + 1);
    input.maxLength = 20;

    const btn = document.createElement('button');
    btn.className = 'btn btn-icon btn-remove-team';
    btn.setAttribute('aria-label', 'Fjern lag');
    btn.textContent = '×';

    row.appendChild(input);
    row.appendChild(btn);
    container.appendChild(row);
    Board.updateTeamRemoveButtons();
  };

  Board.updateTeamRemoveButtons = function () {
    const rows = document.querySelectorAll('.team-input');
    rows.forEach(row => {
      const btn = row.querySelector('.btn-remove-team');
      if (btn) {
        btn.style.display = rows.length > 2 ? 'inline-flex' : 'none';
        btn.onclick = () => Board.removeTeamInput(btn);
      }
    });
  };

  Board.removeTeamInput = function (btn) {
    if (document.querySelectorAll('.team-input').length > 2) {
      btn.parentElement.remove();
      Board.updateTeamRemoveButtons();
    }
  };

  // ===== FRØDEVAL =====

  Board.loadQuizList = function () {
    const quizzes = Store.getQuizzes();
    const container = FB.el('quiz-list');
    container.innerHTML = '';

    if (quizzes.length === 0) {
      const p = document.createElement('p');
      p.className = 'fb-muted';
      p.textContent = 'Ingen frøder funne. Lag ein i editoren!';
      container.appendChild(p);
      return;
    }

    quizzes.forEach(quiz => {
      const card = document.createElement('button');
      card.className = 'quiz-card';
      card.type = 'button';

      const h = document.createElement('h3');
      h.textContent = quiz.title;
      card.appendChild(h);

      const meta = document.createElement('p');
      const nQ = quiz.categories.reduce((sum, c) => sum + c.questions.length, 0);
      meta.textContent = quiz.categories.length + ' kategoriar · ' + nQ + ' spørsmål'
        + (quiz.final ? ' · finalerunde' : '');
      card.appendChild(meta);

      card.addEventListener('click', () => Board.selectQuiz(quiz));
      container.appendChild(card);
    });
  };

  Board.selectQuiz = function (quiz) {
    S.currentQuiz = quiz;
    Board.startGame();
  };

  // ===== SPELSTART =====

  Board.startGame = function () {
    const inputs = document.querySelectorAll('.team-name');
    S.teams = [];
    inputs.forEach((input, i) => {
      const name = input.value.trim() || ('Lag ' + (i + 1));
      const color = FB.TEAM_COLORS[i % FB.TEAM_COLORS.length];
      S.teams.push({ id: i + 1, name, score: 0, color });
    });
    Store.saveTeams(S.teams.map(t => ({ name: t.name })));

    S.answeredCells.clear();
    S.finalBets = {};
    S.activeTeamId = S.teams.length ? S.teams[0].id : null;
    Board.initializeDailyDouble();

    FB.hide('team-setup');
    FB.hide('quiz-selection');
    FB.show('game-board');

    Board.renderScoreBoard();
    Board.renderGameBoard();
  };

  Board.initializeDailyDouble = function () {
    const total = S.currentQuiz.categories.length * FB.POINTS.length;
    S.dailyDoubleCell = Math.floor(Math.random() * total);
  };

  // ===== POENGTAVLE + TUR =====

  Board.renderScoreBoard = function () {
    const container = FB.el('teams-score');
    container.innerHTML = '';

    S.teams.forEach(team => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'team-score' + (team.id === S.activeTeamId ? ' is-active' : '');
      card.setAttribute('aria-label', 'Sett ' + team.name + ' på tur');

      const badge = document.createElement('span');
      badge.className = 'team-badge';
      badge.style.background = team.color;
      badge.style.color = FB.textOn(team.color);
      badge.textContent = team.name;
      card.appendChild(badge);

      const pts = document.createElement('span');
      pts.className = 'team-points';
      pts.textContent = team.score;
      card.appendChild(pts);

      card.addEventListener('click', () => {
        S.activeTeamId = team.id;
        Board.renderScoreBoard();
      });
      container.appendChild(card);
    });

    Board.renderTurnIndicator();
  };

  Board.renderTurnIndicator = function () {
    const el = FB.el('turn-indicator');
    if (!el) return;
    const team = S.teams.find(t => t.id === S.activeTeamId);
    el.innerHTML = '';
    if (!team) { el.textContent = ''; return; }
    const label = document.createElement('span');
    label.className = 'turn-label';
    label.textContent = 'På tur:';
    const name = document.createElement('span');
    name.className = 'turn-name';
    name.style.background = team.color;
    name.style.color = FB.textOn(team.color);
    name.textContent = team.name;
    el.appendChild(label);
    el.appendChild(name);
  };

  Board.advanceTurn = function () {
    if (!S.teams.length) return;
    const idx = S.teams.findIndex(t => t.id === S.activeTeamId);
    const next = S.teams[(idx + 1) % S.teams.length];
    S.activeTeamId = next.id;
  };

  // ===== BRETT =====

  Board.renderGameBoard = function () {
    const grid = FB.el('jeopardy-grid');
    grid.innerHTML = '';
    const cats = S.currentQuiz.categories;
    grid.style.setProperty('--cols', cats.length);

    cats.forEach((category, ci) => {
      const color = FB.CAT_COLORS[ci % FB.CAT_COLORS.length];
      const header = document.createElement('div');
      header.className = 'jeopardy-category';
      header.style.background = color;
      header.style.color = FB.textOn(color);
      header.style.gridColumn = ci + 1;
      header.style.gridRow = 1;
      header.textContent = category.name;
      grid.appendChild(header);
    });

    requestAnimationFrame(Board.autoFitCategoryText);

    FB.POINTS.forEach((points, rowIndex) => {
      cats.forEach((category, ci) => {
        const question = category.questions.find(q => q.points === points);
        const cellKey = category.name + '-' + points;
        const isAnswered = S.answeredCells.has(cellKey);

        const cell = document.createElement('div');
        cell.className = 'jeopardy-cell';
        cell.style.gridColumn = ci + 1;
        cell.style.gridRow = rowIndex + 2;

        if (isAnswered || !question) {
          cell.classList.add('answered');
        } else {
          cell.style.borderColor = FB.CAT_COLORS[ci % FB.CAT_COLORS.length];
          cell.textContent = points;
          cell.setAttribute('role', 'button');
          cell.setAttribute('tabindex', '0');
          cell.dataset.col = ci;
          cell.dataset.row = rowIndex;
          const cellIndex = ci * FB.POINTS.length + rowIndex;
          const open = () => Board.selectQuestion(category, question, cellIndex);
          cell.addEventListener('click', open);
          cell.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
          });
        }
        grid.appendChild(cell);
      });
    });
  };

  Board.autoFitCategoryText = function () {
    document.querySelectorAll('.jeopardy-category').forEach(header => {
      let fontSize = 1.3;
      header.style.fontSize = fontSize + 'rem';
      while (header.scrollHeight > header.clientHeight && fontSize > 0.55) {
        fontSize -= 0.05;
        header.style.fontSize = fontSize + 'rem';
      }
    });
  };

  // ===== SPØRSMÅL =====

  Board.selectQuestion = function (category, question, cellIndex) {
    const isDD = cellIndex === S.dailyDoubleCell;
    S.currentQuestion = {
      category: category.name,
      question: question.question,
      answer: question.answer,
      basePoints: question.points,
      points: isDD ? question.points * 2 : question.points,
      isDailyDouble: isDD
    };
    S.answeredCells.add(category.name + '-' + question.points);
    Board.showQuestion();
  };

  Board.showQuestion = function () {
    const q = S.currentQuestion;
    FB.el('question-category').textContent = q.category;
    FB.el('question-text').textContent = q.question;
    FB.el('answer-text').textContent = q.answer;

    const pointsEl = FB.el('question-points');
    pointsEl.textContent = q.points + ' poeng';

    const banner = FB.el('dd-banner');
    banner.classList.toggle('hidden', !q.isDailyDouble);
    if (q.isDailyDouble) {
      banner.classList.remove('dd-animate');
      void banner.offsetWidth; // restart animasjon
      banner.classList.add('dd-animate');
    }

    FB.hide('question-answer');
    FB.show('btn-reveal-modal');
    FB.hide('btn-confirm-award');
    FB.hide('btn-final-modal');

    S.pendingAward = null;
    Board.showPointControls();
    FB.openOverlay('question-modal');
  };

  Board.closeQuestion = function () {
    FB.closeOverlay('question-modal');
    Board.renderGameBoard();
  };

  // ===== POENGGJEVING (med stadfest, UX2) =====

  Board.showPointControls = function () {
    const container = FB.el('modal-point-controls');
    container.innerHTML = '';
    const pts = S.currentQuestion ? S.currentQuestion.points : 100;

    S.teams.forEach(team => {
      const row = Board.buildAwardRow(team, pts);
      container.appendChild(row);
    });
    FB.show('modal-point-controls');
  };

  // Bygg ei rad med −/0/+ som set eit *ventande* val (ingen poeng før stadfest).
  Board.buildAwardRow = function (team, pts) {
    const row = document.createElement('div');
    row.className = 'award-row';
    row.dataset.teamId = team.id;
    if (team.id === S.activeTeamId) row.classList.add('is-active');

    const badge = document.createElement('span');
    badge.className = 'team-badge';
    badge.style.background = team.color;
    badge.style.color = FB.textOn(team.color);
    badge.textContent = team.name;
    row.appendChild(badge);

    const btns = document.createElement('div');
    btns.className = 'award-btns';

    [['minus', -pts, '−' + pts], ['zero', 0, '0'], ['plus', pts, '+' + pts]].forEach(([type, value, label]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'award-btn award-' + type;
      btn.textContent = label;
      btn.setAttribute('aria-label', team.name + ' ' + label);
      btn.addEventListener('click', () => Board.setPending(team.id, value, btn, btns));
      btns.appendChild(btn);
    });

    row.appendChild(btns);
    return row;
  };

  Board.setPending = function (teamId, value, btn, btnsContainer) {
    if (!S.pendingAward) S.pendingAward = {};
    btnsContainer.querySelectorAll('.award-btn').forEach(b => b.classList.remove('selected'));
    if (S.pendingAward[teamId] === value) {
      delete S.pendingAward[teamId]; // klikk på nytt = angre val
    } else {
      S.pendingAward[teamId] = value;
      btn.classList.add('selected');
    }
    const any = S.pendingAward && Object.keys(S.pendingAward).length > 0;
    FB.el('btn-confirm-award').classList.toggle('hidden', !any);
  };

  Board.confirmAward = function () {
    if (S.pendingAward) {
      Object.entries(S.pendingAward).forEach(([teamId, value]) => {
        const team = S.teams.find(t => t.id === Number(teamId));
        if (team) team.score += value;
      });
    }
    S.pendingAward = null;
    Board.advanceTurn();
    Board.renderScoreBoard();
    Board.closeQuestion();
  };

  Board.bindQuestionModal = function () {
    FB.el('btn-reveal-modal').addEventListener('click', () => {
      FB.show('question-answer');
      FB.hide('btn-reveal-modal');
    });
    FB.el('btn-confirm-award').addEventListener('click', () => Board.confirmAward());
    FB.el('btn-close-modal').addEventListener('click', () => Board.closeQuestion());
    FB.el('btn-back-modal').addEventListener('click', () => Board.closeQuestion());
    FB.el('btn-final-modal').addEventListener('click', () => { Board.closeQuestion(); Board.startFinalRound(); });
  };

  Board.allQuestionsAnswered = function () {
    const total = S.currentQuiz.categories.reduce((s, c) => s + c.questions.length, 0);
    return S.answeredCells.size >= total;
  };

  // ===== SPELKONTROLLAR =====

  Board.bindGameControls = function () {
    FB.el('btn-end-game').addEventListener('click', () => {
      if (confirm('Er du sikker på at du vil avslutte spelet?')) Board.endGame();
    });
    FB.el('btn-go-final').addEventListener('click', () => {
      if (!S.currentQuiz || !S.currentQuiz.final) {
        alert('Denne frøden har ingen finalerunde!');
        return;
      }
      Board.startFinalRound();
    });
  };

  // ===== FINALERUNDE =====

  Board.startFinalRound = function () {
    if (!S.currentQuiz.final) { alert('Denne frøden har ingen finalerunde!'); return; }

    FB.closeOverlay('question-modal');
    FB.hide('jeopardy-grid');
    FB.hide('game-controls');
    FB.hide('turn-indicator');
    FB.show('final-round');

    FB.el('final-category-display').textContent = S.currentQuiz.final.category;
    FB.el('final-clue-display').textContent = S.currentQuiz.final.hint || '';

    FB.show('final-betting');
    FB.hide('final-question');
    FB.hide('final-answer');
    FB.show('btn-reveal-final');
    FB.hide('btn-final-points');
    FB.hide('btn-end-game-final');

    Board.setupBettingControls();
  };

  Board.setupBettingControls = function () {
    const container = FB.el('betting-controls');
    container.innerHTML = '';
    S.finalBets = {};

    S.teams.forEach(team => {
      const box = document.createElement('div');
      box.className = 'team-betting';

      const label = document.createElement('h5');
      const badge = document.createElement('span');
      badge.className = 'team-badge';
      badge.style.background = team.color;
      badge.style.color = FB.textOn(team.color);
      badge.textContent = team.name;
      label.appendChild(badge);
      const sc = document.createElement('span');
      sc.className = 'betting-score';
      sc.textContent = team.score + ' poeng';
      label.appendChild(sc);
      box.appendChild(label);

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'form-input bet-input';
      input.min = 0;
      input.max = Math.max(0, team.score);
      input.value = 0;
      input.setAttribute('aria-label', 'Innsats for ' + team.name);
      input.addEventListener('input', () => {
        let v = parseInt(input.value, 10) || 0;
        if (v < 0) v = 0;
        if (v > team.score) v = team.score;
        input.value = v;
        S.finalBets[team.id] = v;
      });
      box.appendChild(input);

      container.appendChild(box);
      S.finalBets[team.id] = 0;
    });

    const cont = document.createElement('button');
    cont.type = 'button';
    cont.className = 'btn btn-accent';
    cont.textContent = 'Vis spørsmål';
    cont.addEventListener('click', () => Board.showFinalQuestion());
    container.appendChild(cont);
  };

  Board.showFinalQuestion = function () {
    FB.hide('final-betting');
    FB.show('final-question');
    FB.el('final-clue-display').textContent = S.currentQuiz.final.hint || '';
    FB.el('final-question-display').textContent = S.currentQuiz.final.question;
    FB.el('final-answer-display').textContent = S.currentQuiz.final.answer;
    FB.hide('final-answer');
    FB.show('btn-reveal-final');
    FB.hide('btn-final-points');
  };

  Board.bindFinalRound = function () {
    FB.el('btn-reveal-final').addEventListener('click', () => {
      FB.show('final-answer');
      FB.hide('btn-reveal-final');
      FB.show('btn-final-points');
    });
    FB.el('btn-final-points').addEventListener('click', () => Board.processFinalResults());
    FB.el('btn-confirm-final').addEventListener('click', () => Board.confirmFinal());
    FB.el('btn-end-game-final').addEventListener('click', () => Board.endGame());
    FB.el('btn-winner-close').addEventListener('click', () => {
      FB.closeOverlay('winner-modal');
      Board.resetGame();
    });
  };

  Board.processFinalResults = function () {
    const container = FB.el('final-point-controls');
    container.innerHTML = '';
    S.pendingAward = null;

    S.teams.forEach(team => {
      const bet = S.finalBets[team.id] || 0;
      const row = Board.buildAwardRow(team, bet);
      const sub = document.createElement('span');
      sub.className = 'award-bet';
      sub.textContent = 'satsa ' + bet;
      row.querySelector('.team-badge').after(sub);
      container.appendChild(row);
    });

    FB.show('final-point-controls');
    FB.hide('btn-final-points');
    FB.show('btn-confirm-final');
    FB.hide('btn-end-game-final');
  };

  Board.confirmFinal = function () {
    if (S.pendingAward) {
      Object.entries(S.pendingAward).forEach(([teamId, value]) => {
        const team = S.teams.find(t => t.id === Number(teamId));
        if (team) team.score += value;
      });
    }
    S.pendingAward = null;
    FB.hide('btn-confirm-final');
    FB.show('btn-end-game-final');
  };

  Board.endGame = function () {
    if (!S.teams.length) { Board.resetGame(); return; }
    const winner = S.teams.reduce((a, b) => (a.score >= b.score ? a : b));
    Board.showWinnerModal(winner);
  };

  Board.showWinnerModal = function (winner) {
    FB.el('winner-name').textContent = winner.name;
    FB.el('winner-name').style.color = 'var(--text)';
    FB.el('winner-score').textContent = winner.score + ' poeng';

    // Podium (topp 3)
    const ranked = [...S.teams].sort((a, b) => b.score - a.score);
    [['podium-1st', 0], ['podium-2nd', 1], ['podium-3rd', 2]].forEach(([id, idx]) => {
      const el = FB.el(id);
      const t = ranked[idx];
      el.innerHTML = '';
      if (!t) { el.style.visibility = 'hidden'; return; }
      el.style.visibility = 'visible';
      const nm = document.createElement('span');
      nm.className = 'podium-name';
      nm.textContent = t.name;
      const pl = document.createElement('span');
      pl.className = 'podium-place';
      pl.textContent = idx + 1;
      el.appendChild(nm);
      el.appendChild(pl);
    });

    FB.openOverlay('winner-modal');
  };

  Board.resetGame = function () {
    S.currentQuiz = null;
    S.teams = [];
    S.currentQuestion = null;
    S.dailyDoubleCell = null;
    S.answeredCells.clear();
    S.finalBets = {};
    S.activeTeamId = null;
    S.pendingAward = null;

    FB.hide('game-board');
    FB.hide('final-round');
    FB.closeOverlay('question-modal');
    FB.hide('modal-point-controls');
    FB.hide('final-point-controls');
    FB.show('team-setup');
    FB.show('quiz-selection');
    FB.show('game-controls');
    FB.show('turn-indicator');
    FB.show('jeopardy-grid');

    document.querySelectorAll('.team-name').forEach(i => { i.value = ''; });
  };

  // ===== TASTATUR I SPEL =====

  // Skriv brukaren i eit tekstfelt, skal snarvegane liggje unna
  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  Board.handleGameKeyboard = function (e) {
    const modalOpen = FB.isOverlayOpen('question-modal');

    if (e.key === 'Escape') {
      if (modalOpen) Board.closeQuestion();
      else if (!FB.el('final-round').classList.contains('hidden')) Board.endGame();
      return;
    }

    if (isTyping(e.target)) return;

    if (modalOpen) {
      if (e.key === 'Enter') {
        const reveal = FB.el('btn-reveal-modal');
        if (!reveal.classList.contains('hidden')) { reveal.click(); return; }
        const confirm = FB.el('btn-confirm-award');
        if (!confirm.classList.contains('hidden')) { confirm.click(); return; }
      }
      // Taltastar 1–6: ventande +poeng til lag N (UX3)
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= S.teams.length) {
        const team = S.teams[n - 1];
        const row = document.querySelector('.award-row[data-team-id="' + team.id + '"]');
        if (row) {
          const plusBtn = row.querySelector('.award-plus');
          if (plusBtn) plusBtn.click();
        }
      }
      return;
    }

    if (e.key === ' ' && !FB.el('team-setup').classList.contains('hidden')) {
      e.preventDefault();
      FB.el('btn-add-team').click();
    }
  };

  FB.Board = Board;
})(window);
