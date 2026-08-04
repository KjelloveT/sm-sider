/* Duldord — arkivet over dagane som har vore. */
(function (global) {
  'use strict';

  const { dateForIndex, formatDate } = global.DuldordState;

  /**
   * Byggjer rutenettet over tidlegare dagar. Dagens ord er ikkje med — det
   * ligg alt på hovudskjermen. Nyaste dag kjem fyrst.
   */
  function render(container, todayIndex, onPick) {
    const days = global.DuldordStorage.allDays();
    container.textContent = '';

    if (todayIndex <= 0) {
      const p = document.createElement('p');
      p.className = 'dd-muted';
      p.textContent = 'Det er ingen tidlegare dagar enno. Kom att i morgon.';
      container.appendChild(p);
      return;
    }

    for (let i = todayIndex - 1; i >= 0; i--) {
      const day = days[String(i)];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dd-archive-day';
      if (day && day.status === 'won') btn.classList.add('dd-archive-won');
      else if (day && day.status === 'lost') btn.classList.add('dd-archive-lost');
      else if (day && day.status === 'playing') btn.classList.add('dd-archive-open');

      const num = document.createElement('span');
      num.className = 'dd-archive-num';
      num.textContent = i + 1;

      const date = document.createElement('span');
      date.className = 'dd-archive-date';
      date.textContent = formatDate(dateForIndex(i)).replace(/ \d{4}$/, '');

      btn.append(num, date);

      let label = `Dag ${i + 1}, ${formatDate(dateForIndex(i))}`;
      if (day && day.status === 'won') label += `, løyst på ${day.guesses.length}`;
      else if (day && day.status === 'lost') label += ', ikkje løyst';
      else if (day && day.status === 'playing') label += ', påbyrja';
      else label += ', ikkje spelt';
      btn.setAttribute('aria-label', label);
      btn.title = label;

      btn.addEventListener('click', () => onPick(i));
      container.appendChild(btn);
    }
  }

  global.DuldordArchive = { render };
})(window);
