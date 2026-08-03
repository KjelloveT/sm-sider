/* Ordaklok — modus: Skriv (Boksekamp)
 * Bokstavboksar med skjult input, tjuvtitt, send-svar
 */
(function (root) {
  'use strict';

  const State = OrdaklokState;
  const { normalizeAnswer, isAnswerCorrect } = State;

  function build(list, queue, options, callbacks) {
    let pos = 0;
    let peekedThis = false;
    let lockedAfterAnswer = false;
    let mountEl = null;
    let questionStartedAt = 0;
    let inputEl = null;
    let lbContainer = null;
    let plainInput = null;
    let feedbackEl = null;
    let vyrdeEl = null;
    let bubbleEl = null;
    let resultStampEl = null;
    let advanceTimer = null;

    function render(host) {
      mountEl = document.createElement('div');
      mountEl.className = 'bk-type-area';
      host.appendChild(mountEl);
      next();
    }

    function currentItem() { return queue[pos]; }

    function next() {
      if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
      if (pos >= queue.length) {
        cleanup();
        callbacks.onFinish && callbacks.onFinish();
        return;
      }
      peekedThis = false;
      lockedAfterAnswer = false;
      questionStartedAt = Date.now();

      const item = currentItem();
      const pair = list.pairs[item.idx];
      const promptText  = State.getPrompt(pair, item.direction);
      const promptLabel = State.getPromptLabel(list, item.direction);
      const answerLabel = State.getAnswerLabel(list, item.direction);
      const answer      = State.getAnswer(pair, item.direction);

      mountEl.innerHTML = '';

      // Prompt-label
      const lbl = document.createElement('div');
      lbl.className = 'bk-type-prompt-label';
      lbl.textContent = 'Skriv på ' + answerLabel + ' (' + promptLabel + ')';
      mountEl.appendChild(lbl);

      // Prompt-stempel
      const prompt = document.createElement('div');
      prompt.className = 'bk-type-prompt';
      prompt.textContent = promptText;
      OrdaklokText.applyLengthClass(prompt, promptText);
      mountEl.appendChild(prompt);

      lbContainer = null;
      plainInput = null;

      // Bokstavboksar er upraktiske for setningar/lange svar — bruk plain input
      // automatisk når svaret inneheld mellomrom eller er over ~20 teikn.
      const useBoxes = options.boxes && !OrdaklokText.isLongAnswer(answer);

      if (useBoxes) {
        // Bokstavboksar + skjult input
        lbContainer = document.createElement('div');
        lbContainer.className = 'bk-letter-row';
        lbContainer.addEventListener('click', () => { if (inputEl) inputEl.focus(); });
        mountEl.appendChild(lbContainer);

        inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.className = 'bk-type-input';
        inputEl.autocomplete = 'off';
        inputEl.autocapitalize = 'off';
        inputEl.autocorrect = 'off';
        inputEl.spellcheck = false;
        inputEl.setAttribute('aria-label', 'Skriv svaret');
        mountEl.appendChild(inputEl);

        renderLetterBoxes('', answer, false);

        inputEl.addEventListener('input', () => {
          if (lockedAfterAnswer) return;
          renderLetterBoxes(inputEl.value, answer, false);
        });
        inputEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); tryAnswer(answer, pair, item); }
        });
        setTimeout(() => inputEl.focus(), 30);
      } else {
        // Plain input
        plainInput = document.createElement('input');
        plainInput.type = 'text';
        plainInput.className = 'bk-type-plain';
        plainInput.autocomplete = 'off';
        plainInput.autocapitalize = 'off';
        plainInput.autocorrect = 'off';
        plainInput.spellcheck = false;
        plainInput.placeholder = 'Skriv svaret…';
        plainInput.setAttribute('aria-label', 'Skriv svaret');
        OrdaklokText.applyLengthClass(plainInput, answer);
        plainInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); tryAnswer(answer, pair, item); }
        });
        mountEl.appendChild(plainInput);
        setTimeout(() => plainInput.focus(), 30);
      }

      // Feedback
      feedbackEl = document.createElement('div');
      feedbackEl.className = 'bk-type-feedback';
      mountEl.appendChild(feedbackEl);

      // Knappar
      const actions = document.createElement('div');
      actions.className = 'bk-type-actions';

      const submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.className = 'bk-btn bk-btn-primary';
      submitBtn.innerHTML = '';
      submitBtn.appendChild(BKIcons.create('send', 18));
      const submitTxt = document.createElement('span');
      submitTxt.textContent = 'Send svar';
      submitBtn.appendChild(submitTxt);
      submitBtn.addEventListener('click', () => tryAnswer(answer, pair, item));
      actions.appendChild(submitBtn);

      let peekBtn = null;
      if (options.peek) {
        peekBtn = document.createElement('button');
        peekBtn.type = 'button';
        peekBtn.className = 'bk-btn bk-type-peek-btn';
        peekBtn.appendChild(BKIcons.create('eye', 18));
        const ptxt = document.createElement('span');
        ptxt.textContent = 'Tjuvtitt';
        peekBtn.appendChild(ptxt);
        peekBtn.addEventListener('click', () => {
          peekedThis = true;
          peekBtn.classList.add('active');
          feedbackEl.className = 'bk-type-feedback';
          feedbackEl.textContent = 'Svar: ' + answer;
          if (lbContainer) renderLetterBoxes(inputEl ? inputEl.value : '', answer, true);
          if (vyrdeEl) {
            Vyrde.setMood(vyrdeEl, 'think');
            if (bubbleEl) bubbleEl.textContent = 'Hmm…';
          }
        });
        actions.appendChild(peekBtn);
      }

      const skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.className = 'bk-btn bk-btn-ghost';
      skipBtn.textContent = 'Hopp over';
      skipBtn.addEventListener('click', () => recordAndAdvance(false, false));
      actions.appendChild(skipBtn);

      mountEl.appendChild(actions);

      // Vyrde nedre venstre
      const vyrdeWrap = document.createElement('div');
      vyrdeWrap.className = 'bk-type-vyrde';
      vyrdeEl = Vyrde.create({ mood: 'wave', alt: 'Vyrde', className: 'bk-vyrde' });
      bubbleEl = document.createElement('div');
      bubbleEl.className = 'bk-bubble bk-bubble-left';
      bubbleEl.textContent = 'Kva heiter dette?';
      bubbleEl.style.fontSize = '0.8rem';
      vyrdeWrap.appendChild(vyrdeEl);
      vyrdeWrap.appendChild(bubbleEl);
      mountEl.appendChild(vyrdeWrap);

      // Resultat-stempel (settest når reveal)
      resultStampEl = null;
    }

    function tryAnswer(answer, pair, item) {
      if (lockedAfterAnswer) return;
      const val = (inputEl ? inputEl.value : plainInput.value).trim();
      if (!val) return;
      const correct = isAnswerCorrect(val, pair, item.direction);
      lockedAfterAnswer = true;

      if (lbContainer) renderLetterBoxes(answer, answer, true, correct);
      if (plainInput) {
        plainInput.style.background = correct ? 'var(--bk-grn-soft)' : 'var(--bk-pink-soft)';
        plainInput.style.borderColor = correct ? 'var(--bk-grn)' : 'var(--bk-red)';
        plainInput.disabled = true;
      }

      feedbackEl.className = 'bk-type-feedback ' + (correct ? 'ok' : 'bad');
      if (correct) {
        feedbackEl.textContent = peekedThis ? 'Rett (men du tjuvtitta)' : 'Treff!';
      } else {
        feedbackEl.textContent = 'Rett svar: ' + answer;
      }

      showResultStamp(correct);

      if (vyrdeEl) {
        Vyrde.setMood(vyrdeEl, correct ? 'happy' : 'think');
        if (bubbleEl) bubbleEl.textContent = correct ? 'Bra!' : 'Ikkje stress.';
      }

      advanceTimer = setTimeout(() => recordAndAdvance(correct, peekedThis), correct ? 900 : 1700);
    }

    function showResultStamp(correct) {
      if (resultStampEl) resultStampEl.remove();
      resultStampEl = document.createElement('div');
      resultStampEl.className = 'bk-type-result-stamp';
      const stamp = document.createElement('span');
      stamp.className = 'bk-stamp bk-stamp-xl ' + (correct ? 'bk-stamp-green' : 'bk-stamp-red');
      stamp.style.setProperty('--stamp-rot', '6deg');
      stamp.textContent = correct ? 'TREFF!' : 'BOM!';
      resultStampEl.appendChild(stamp);
      mountEl.appendChild(resultStampEl);
    }

    function recordAndAdvance(correct, peeked) {
      const item = currentItem();
      const time = Date.now() - questionStartedAt;
      callbacks.onResult(item.idx, { correct, peeked, time });
      pos++;
      callbacks.onAdvance && callbacks.onAdvance();
      next();
    }

    function renderLetterBoxes(typed, target, allPeeked, finalCorrect) {
      lbContainer.innerHTML = '';
      const typedNorm = normalizeAnswer(typed);
      let typedPos = 0;
      let typedNormPos = 0;
      let cursorPlaced = false;

      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        const isLetter = /[\p{L}\p{N}]/u.test(ch);
        const span = document.createElement('span');
        span.className = 'bk-letter-box';

        if (!isLetter) {
          span.classList.add('space');
          span.textContent = ch === ' ' ? '' : ch;
          lbContainer.appendChild(span);
          continue;
        }

        const expectedNorm = normalizeAnswer(ch);
        const typedChar = typedNorm[typedNormPos] || '';

        if (allPeeked) {
          if (finalCorrect === true)  span.classList.add('correct');
          if (finalCorrect === false) span.classList.add('wrong');
          if (finalCorrect === undefined) span.classList.add('peek');
          span.textContent = ch;
          typedNormPos++;
          typedPos++;
        } else if (typedChar) {
          span.textContent = typed[typedPos] || ch;
          if (typedChar === expectedNorm) span.classList.add('correct');
          else span.classList.add('wrong');
          typedPos++;
          typedNormPos++;
        } else {
          if (options.highlight && !cursorPlaced) {
            span.classList.add('cursor');
            cursorPlaced = true;
          }
          span.textContent = '';
        }
        lbContainer.appendChild(span);
      }
    }

    function cleanup() {
      if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
    }

    return { render, cleanup };
  }

  root.OrdaklokModeType = {
    id: 'type',
    label: 'Skriv',
    description: 'Tast inn svaret. Tjuvtitt om du står fast.',
    icon: OrdaklokState.ICONS.keyboard,
    supportsLeitner: true,
    mount(host, ctx) {
      const m = build(ctx.list, ctx.queue, ctx.options, ctx.callbacks);
      m.render(host);
      this._unmount = () => { m.cleanup && m.cleanup(); host.innerHTML = ''; };
    },
    unmount() { if (this._unmount) this._unmount(); }
  };
})(window);
