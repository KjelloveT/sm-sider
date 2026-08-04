/* Duldord — statistikkruta og deling av resultatet. */
(function (global) {
  'use strict';

  const { MAX_GUESSES, scoreGuess } = global.DuldordState;

  // Rutene i delingsteksten. Vi brukar geometriske teikn framfor emoji:
  // fyld rute = rett plass, skravert = rett bokstav feil plass, tom = ikkje i ordet.
  const SHARE_CHARS = { correct: '■', present: '▨', absent: '□' };

  function render(todayIndex, lastResult) {
    const s = global.DuldordStorage.stats(todayIndex);
    const pct = s.played ? Math.round((s.won / s.played) * 100) : 0;

    const grid = document.getElementById('statGrid');
    grid.textContent = '';
    [
      ['Spelte', s.played],
      ['Løyste', `${pct} %`],
      ['Rekkje', s.streak],
      ['Beste rekkje', s.best]
    ].forEach(([label, value]) => {
      const cell = document.createElement('div');
      cell.className = 'dd-stat';
      const v = document.createElement('span');
      v.className = 'dd-stat-value';
      v.textContent = value;
      const l = document.createElement('span');
      l.className = 'dd-stat-label';
      l.textContent = label;
      cell.append(v, l);
      grid.appendChild(cell);
    });

    const max = Math.max(1, ...s.dist);
    const dist = document.getElementById('statDist');
    dist.textContent = '';
    s.dist.forEach((count, i) => {
      const row = document.createElement('div');
      row.className = 'dd-distrow';

      const num = document.createElement('span');
      num.className = 'dd-distnum';
      num.textContent = i + 1;

      const bar = document.createElement('span');
      bar.className = 'dd-distbar';
      bar.style.width = `${Math.max(8, (count / max) * 100)}%`;
      if (lastResult && lastResult.status === 'won' && lastResult.guesses === i + 1) {
        bar.classList.add('dd-distbar-current');
      }
      bar.textContent = count;

      row.append(num, bar);
      dist.appendChild(row);
    });
  }

  /** Resultatet som ei tekstblokk spelaren kan lime inn kvar som helst. */
  function shareText(dayNumber, guesses, answer, status) {
    const score = status === 'won' ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
    const lines = guesses.map(guess =>
      scoreGuess(guess, answer).map(state => SHARE_CHARS[state]).join('')
    );
    return [`Duldord ${dayNumber} — ${score}`, '', ...lines].join('\n');
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Reserveløysing for nettlesarar utan clipboard-API eller utan HTTPS
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('Kopiering feila'));
    });
  }

  global.DuldordStats = { render, shareText, copy };
})(window);
