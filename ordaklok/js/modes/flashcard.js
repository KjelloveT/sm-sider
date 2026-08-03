/* Ordaklok — modus: Hugsekort (Boksekamp)
 * Stort 3D-flip-kort, tre Leitner-knappar: Visste ikkje / Snautt / Lett
 */
(function (root) {
  'use strict';

  const State = OrdaklokState;

  function build(list, queue, options, callbacks) {
    let pos = 0;
    let mountEl = null;
    let questionStartedAt = 0;
    let flipped = false;
    let cardEl = null;
    let leitnerRow = null;
    let hintEl = null;
    let vyrdeEl = null;
    let bubbleEl = null;
    let keyHandler = null;

    function render(host) {
      mountEl = document.createElement('div');
      mountEl.className = 'bk-flashcard-area';
      host.appendChild(mountEl);
      next();
    }

    function next() {
      if (pos >= queue.length) {
        cleanup();
        callbacks.onFinish && callbacks.onFinish();
        return;
      }
      flipped = false;
      questionStartedAt = Date.now();

      const item = queue[pos];
      const pair = list.pairs[item.idx];
      const promptText  = State.getPrompt(pair, item.direction);
      const promptLabel = State.getPromptLabel(list, item.direction);
      const answerText  = State.getAnswer(pair, item.direction);
      const answerLabel = State.getAnswerLabel(list, item.direction);

      mountEl.innerHTML = '';

      // Vyrde (skjult på mobil via CSS)
      const vyrdeWrap = document.createElement('div');
      vyrdeWrap.className = 'bk-flashcard-vyrde';
      vyrdeEl = Vyrde.create({ mood: 'think', alt: 'Vyrde', className: 'bk-vyrde' });
      bubbleEl = document.createElement('div');
      bubbleEl.className = 'bk-bubble bk-bubble-right';
      bubbleEl.textContent = 'Hugsar du dette?';
      vyrdeWrap.appendChild(bubbleEl);
      vyrdeWrap.appendChild(vyrdeEl);
      mountEl.appendChild(vyrdeWrap);

      // Flip-kort
      cardEl = document.createElement('div');
      cardEl.className = 'bk-flashcard';
      cardEl.setAttribute('role', 'button');
      cardEl.setAttribute('aria-label', 'Snu kortet');
      cardEl.setAttribute('tabindex', '0');

      const inner = document.createElement('div');
      inner.className = 'bk-flashcard-inner';

      // Framside
      const front = document.createElement('div');
      front.className = 'bk-flashcard-face front';
      const frontBadge = document.createElement('div');
      frontBadge.className = 'bk-flashcard-badge';
      frontBadge.textContent = promptLabel;
      const frontText = document.createElement('div');
      frontText.className = 'bk-flashcard-text';
      frontText.textContent = promptText;
      OrdaklokText.applyLengthClass(frontText, promptText);
      const frontHint = document.createElement('div');
      frontHint.className = 'bk-flashcard-hint';
      frontHint.textContent = 'Klikk for å snu';
      front.appendChild(frontBadge);
      front.appendChild(frontText);
      front.appendChild(frontHint);

      // Bakside
      const back = document.createElement('div');
      back.className = 'bk-flashcard-face back';
      const backBadge = document.createElement('div');
      backBadge.className = 'bk-flashcard-badge';
      backBadge.textContent = answerLabel;
      const backText = document.createElement('div');
      backText.className = 'bk-flashcard-text';
      backText.textContent = answerText;
      OrdaklokText.applyLengthClass(backText, answerText);
      const backSub = document.createElement('div');
      backSub.className = 'bk-flashcard-sub';
      backSub.textContent = promptLabel + ': ' + promptText;
      back.appendChild(backBadge);
      back.appendChild(backText);
      back.appendChild(backSub);

      inner.appendChild(front);
      inner.appendChild(back);
      cardEl.appendChild(inner);

      cardEl.addEventListener('click', flip);
      cardEl.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
      });
      mountEl.appendChild(cardEl);

      // Leitner-knappar
      leitnerRow = document.createElement('div');
      leitnerRow.className = 'bk-leitner-row';
      leitnerRow.innerHTML =
        '<button type="button" class="bk-leitner-btn hard"   data-rating="hard">Visste ikkje <span class="bk-leitner-key">1</span></button>' +
        '<button type="button" class="bk-leitner-btn snautt" data-rating="ok">Snautt <span class="bk-leitner-key">2</span></button>' +
        '<button type="button" class="bk-leitner-btn easy"   data-rating="easy">Lett <span class="bk-leitner-key">3</span></button>';
      leitnerRow.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-rating]');
        if (btn) submitRating(btn.dataset.rating);
      });
      mountEl.appendChild(leitnerRow);

      // Tastatur
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
      keyHandler = (e) => {
        if (!flipped) {
          if (e.key === ' ' || e.key === 'Enter') {
            // Ikkje "stjel" når kort har fokus — det er allereie handtert
            if (document.activeElement !== cardEl) { e.preventDefault(); flip(); }
          }
          return;
        }
        if (e.key === '1') submitRating('hard');
        else if (e.key === '2') submitRating('ok');
        else if (e.key === '3') submitRating('easy');
      };
      document.addEventListener('keydown', keyHandler);
    }

    function flip() {
      if (flipped) return;
      flipped = true;
      cardEl.classList.add('flipped');
      leitnerRow.classList.add('show');
      if (vyrdeEl) Vyrde.setMood(vyrdeEl, 'happy');
      if (bubbleEl) bubbleEl.textContent = 'Korleis gjekk det?';
    }

    function submitRating(rating) {
      const item = queue[pos];
      const time = Date.now() - questionStartedAt;
      const correct = rating !== 'hard';
      callbacks.onResult(item.idx, { correct, peeked: false, time, rating });
      pos++;
      callbacks.onAdvance && callbacks.onAdvance();
      next();
    }

    function cleanup() {
      if (keyHandler) {
        document.removeEventListener('keydown', keyHandler);
        keyHandler = null;
      }
    }

    return { render, cleanup };
  }

  root.OrdaklokModeFlashcard = {
    id: 'flashcard',
    label: 'Hugsekort',
    description: 'Snu kortet og vurder sjølv. God for læring.',
    icon: OrdaklokState.ICONS.layers,
    supportsLeitner: true,
    mount(host, ctx) {
      const m = build(ctx.list, ctx.queue, ctx.options, ctx.callbacks);
      m.render(host);
      this._unmount = () => { m.cleanup && m.cleanup(); host.innerHTML = ''; };
    },
    unmount() { if (this._unmount) this._unmount(); }
  };
})(window);
