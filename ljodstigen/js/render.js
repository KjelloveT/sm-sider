/* ══════════════════════════════════════════════
   RENDER.JS — Felles DOM-byggjarar

   Alle oppgåveflater er DOM, ikkje canvas. Grunnen er ikkje smak:
   ein seksåring treng svært store trykkflater, oppgåva må kunne
   navigerast med tastatur, og dei 21 fargetemaa verkar gjennom
   CSS-variablar. Alt tre får vi gratis i DOM og må skrivast for hand
   på eit lerret.

   All tekst blir sett med textContent (AGENTS.md §5.3).
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ──────────────── Lydknapp ──────────────── */

  /* Eleven kan spele lyden om att så mange gonger han vil, utan at det
     tel som feil eller kostar noko. Å måtte høyre to gonger er ikkje
     eit nederlag, og appen skal ikkje oppføre seg som om det er det. */
  function replayButton(onPlay, label) {
    const b = h('button', 'ljod-replay');
    b.type = 'button';
    b.setAttribute('aria-label', label || 'Høyr om att');
    b.appendChild(LjodShapes.speaker(40));
    b.appendChild(h('span', 'ljod-replay-text', 'Høyr om att'));
    b.addEventListener('click', function () {
      b.classList.add('is-playing');
      Promise.resolve(onPlay()).then(function () { b.classList.remove('is-playing'); });
    });
    return b;
  }

  /* ──────────────── Bokstavbrikke ──────────────── */

  /**
   * Ei stor, trykkbar bokstavflate.
   * @param ch    bokstaven
   * @param opts  { upper:bool, size:'lg'|'md'|'sm', label:string }
   */
  function letterTile(ch, opts) {
    opts = opts || {};
    const b = h('button', 'ljod-tile ljod-tile-' + (opts.size || 'lg'));
    b.type = 'button';
    b.dataset.ch = ch;
    const info = LjodLetters.get(ch);
    const glyph = h('span', 'ljod-glyph', opts.upper ? info.up : info.ch);
    b.appendChild(glyph);
    /* Skjermlesaren skal seie «bokstaven s», ikkje berre «s», som lett
       blir lese som eit ord. */
    b.setAttribute('aria-label', opts.label || ('Bokstaven ' + info.up));
    return b;
  }

  /** Ei ikkje-trykkbar bokstavflate, til å vise fram. */
  function letterPlate(ch, opts) {
    opts = opts || {};
    const d = h('div', 'ljod-plate');
    const info = LjodLetters.get(ch);
    d.appendChild(h('span', 'ljod-glyph', opts.upper ? info.up : info.ch));
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', 'Bokstaven ' + info.up);
    return d;
  }

  /* ──────────────── Rutenett med val ──────────────── */

  /**
   * Byggjer eit rutenett av svaralternativ.
   * @param items   [{ key, node }]
   * @param onPick  (key, node) => void
   */
  function optionGrid(items, onPick) {
    const grid = h('div', 'ljod-options ljod-options-' + items.length);
    grid.setAttribute('role', 'group');
    items.forEach(function (it) {
      it.node.addEventListener('click', function () { onPick(it.key, it.node); });
      grid.appendChild(it.node);
    });
    return grid;
  }

  /** Sperr eller opne alle knappane i eit rutenett. */
  function lock(grid, on) {
    Array.prototype.forEach.call(grid.querySelectorAll('button'), function (b) {
      b.disabled = !!on;
    });
  }

  /* ──────────────── Tilbakemelding ──────────────── */

  /* Rett svar blir markert på flata eleven trykte. Feil svar markerer
     BÅDE det gale valet og fasiten — eleven skal aldri sitje att utan
     å ha sett kva som var rett. */
  function markCorrect(node) { if (node) node.classList.add('is-right'); }
  function markWrong(node)   { if (node) node.classList.add('is-wrong'); }

  function revealAnswer(grid, key) {
    const n = grid.querySelector('[data-key="' + cssEscape(key) + '"]');
    if (n) n.classList.add('is-answer');
  }

  function cssEscape(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  /* ──────────────── Oppgåveramme ──────────────── */

  /**
   * Standard ramme rundt ei oppgåve: instruksjon, innhald, framdrift.
   * Returnerer { root, body, setPrompt, setProgress }.
   */
  function taskFrame(opts) {
    opts = opts || {};
    const root_ = h('div', 'ljod-task');

    const head = h('div', 'ljod-task-head');
    const prompt = h('p', 'ljod-prompt', opts.prompt || '');
    head.appendChild(prompt);
    root_.appendChild(head);

    const body = h('div', 'ljod-task-body');
    root_.appendChild(body);

    const foot = h('div', 'ljod-task-foot');
    const bar = h('div', 'ljod-progress');
    const fill = h('div', 'ljod-progress-fill');
    bar.appendChild(fill);
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Kor langt du er komen i økta');
    foot.appendChild(bar);
    root_.appendChild(foot);

    return {
      root: root_,
      head: head,
      body: body,
      foot: foot,
      setPrompt: function (t) { prompt.textContent = t; },
      setProgress: function (done, total) {
        fill.style.width = Math.round(100 * done / total) + '%';
        bar.setAttribute('aria-valuenow', String(done));
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', String(total));
      }
    };
  }

  /* ──────────────── Ros ──────────────── */

  const PRAISE = ['r_bra', 'r_rett', 'r_flott', 'r_gjort', 'r_derja', 'r_nettopp', 'r_klarte', 'r_flink'];
  const NUDGE  = ['r_prov', 'r_nesten', 'r_saman', 'r_vanskeleg'];

  function praiseId()  { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; }
  function nudgeId()   { return NUDGE[Math.floor(Math.random() * NUDGE.length)]; }

  /* Vyrde reagerer på svaret. Gjenbruk av den globale maskoten —
     ingen ny figur er teikna for dette spelet. */
  function setMood(mood) {
    const el = document.querySelector('[data-vyrde]');
    if (el && root.Vyrde && Vyrde.setMood) Vyrde.setMood(el, mood);
  }

  root.LjodRender = {
    h: h, clear: clear,
    replayButton: replayButton,
    letterTile: letterTile, letterPlate: letterPlate,
    optionGrid: optionGrid, lock: lock,
    markCorrect: markCorrect, markWrong: markWrong, revealAnswer: revealAnswer,
    taskFrame: taskFrame,
    praiseId: praiseId, nudgeId: nudgeId,
    PRAISE: PRAISE, NUDGE: NUDGE,
    setMood: setMood
  };
})(window);
