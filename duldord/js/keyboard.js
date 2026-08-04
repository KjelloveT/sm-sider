/* Duldord — tastaturet på skjermen. Same oppsett som eit norsk tastatur,
   så æ, ø og å står der fingrane ventar dei. */
(function (global) {
  'use strict';

  const ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'å'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ø', 'æ'],
    ['ENTER', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'BACK']
  ];

  let keyEls = {};
  let onKey = null;

  function build(container, handler) {
    onKey = handler;
    keyEls = {};
    container.textContent = '';

    ROWS.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'dd-keyrow';
      row.forEach(key => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dd-key';
        if (key === 'ENTER' || key === 'BACK') btn.classList.add('dd-key-wide');

        if (key === 'BACK') {
          btn.innerHTML = ICON('arrowLeft', 20);
          btn.setAttribute('aria-label', 'Slett siste bokstav');
        } else if (key === 'ENTER') {
          btn.textContent = 'Gjett';
          btn.setAttribute('aria-label', 'Send inn gjettet');
        } else {
          btn.textContent = key;
          btn.setAttribute('aria-label', `Bokstaven ${key}`);
          keyEls[key] = btn;
        }

        btn.addEventListener('click', () => {
          btn.blur(); // elles blir tasten ståande markert etter eit museklikk
          onKey(key);
        });
        rowEl.appendChild(btn);
      });
      container.appendChild(rowEl);
    });
  }

  /** Fargelegg tastane etter kva vi veit om kvar bokstav. */
  function paint(states) {
    Object.keys(keyEls).forEach(letter => {
      const btn = keyEls[letter];
      btn.classList.remove('dd-correct', 'dd-present', 'dd-absent');
      const state = states[letter];
      if (state) btn.classList.add(`dd-${state}`);
    });
  }

  function bindPhysical(handler) {
    document.addEventListener('keydown', ev => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      // Er ein modal open, skal tastane gå dit — ikkje til brettet
      if (document.querySelector('.modal-overlay.open')) return;

      if (ev.key === 'Enter') { ev.preventDefault(); handler('ENTER'); return; }
      if (ev.key === 'Backspace') { ev.preventDefault(); handler('BACK'); return; }

      const ch = ev.key.toLowerCase();
      if (ch.length === 1 && global.DuldordState.isLetter(ch)) {
        ev.preventDefault();
        handler(ch);
      }
    });
  }

  global.DuldordKeyboard = { build, paint, bindPhysical };
})(window);
