/* Ordaklok — modus: Fleirval (Boksekamp)
 * Spørsmål-stempel, 2×2 svar-kort med nummerstempel, grøn/raud reveal
 */
(function (root) {
  'use strict';

  const State = OrdaklokState;

  function build(list, queue, options, callbacks) {
    let pos = 0;
    let mountEl = null;
    let questionStartedAt = 0;
    let locked = false;
    let keyHandler = null;
    let revealTimer = null;

    function render(host) {
      mountEl = document.createElement('div');
      mountEl.className = 'bk-mc-area';
      host.appendChild(mountEl);
      next();
    }

    function next() {
      if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
      if (pos >= queue.length) {
        cleanup();
        callbacks.onFinish && callbacks.onFinish();
        return;
      }
      locked = false;
      questionStartedAt = Date.now();

      const item = queue[pos];
      const pair = list.pairs[item.idx];
      const promptText   = State.getPrompt(pair, item.direction);
      const promptLabel  = State.getPromptLabel(list, item.direction);
      const answerLabel  = State.getAnswerLabel(list, item.direction);
      const correctAnswer = State.getAnswer(pair, item.direction);

      // Vel 3 distractors
      const otherIndices = list.pairs.map((_, i) => i).filter(i => i !== item.idx);
      const picked = State.pickN(otherIndices, Math.min(3, otherIndices.length));
      const distractors = picked
        .map(i => State.getAnswer(list.pairs[i], item.direction))
        .filter(s => State.normalizeAnswer(s) !== State.normalizeAnswer(correctAnswer));
      while (distractors.length < 3 && otherIndices.length > 0) {
        const ix = otherIndices[Math.floor(Math.random() * otherIndices.length)];
        const cand = State.getAnswer(list.pairs[ix], item.direction);
        if (State.normalizeAnswer(cand) !== State.normalizeAnswer(correctAnswer) && !distractors.includes(cand)) {
          distractors.push(cand);
        } else if (otherIndices.length === 1) break;
      }
      const choices = State.shuffle([correctAnswer].concat(distractors).slice(0, 4));

      mountEl.innerHTML = '';

      // Topp: Vyrde + prompt
      const top = document.createElement('div');
      top.className = 'bk-mc-top';

      const vyrdeCol = document.createElement('div');
      vyrdeCol.className = 'bk-mc-vyrde';
      const vyrdeImg = Vyrde.create({ mood: 'surprised', alt: 'Vyrde', className: 'bk-vyrde' });
      vyrdeCol.appendChild(vyrdeImg);
      const bub = document.createElement('div');
      bub.className = 'bk-bubble bk-bubble-down';
      bub.textContent = 'Vel rett svar!';
      bub.style.fontSize = '0.78rem';
      vyrdeCol.appendChild(bub);
      top.appendChild(vyrdeCol);

      const promptWrap = document.createElement('div');
      promptWrap.className = 'bk-mc-prompt-wrap';
      const label = document.createElement('div');
      label.className = 'bk-mc-prompt-label';
      label.textContent = 'Kva ' + promptLabel + ' tyder på ' + answerLabel + '?';
      promptWrap.appendChild(label);
      const prompt = document.createElement('div');
      prompt.className = 'bk-mc-prompt';
      prompt.textContent = promptText;
      OrdaklokText.applyLengthClass(prompt, promptText);
      promptWrap.appendChild(prompt);
      top.appendChild(promptWrap);

      mountEl.appendChild(top);

      // Svar-grid
      const opts = document.createElement('div');
      opts.className = 'bk-mc-options';
      opts.dataset.choices = JSON.stringify(choices);

      choices.forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bk-mc-option';
        btn.dataset.value = choice;
        OrdaklokText.applyLengthClass(btn, choice);

        const num = document.createElement('span');
        num.className = 'bk-mc-num';
        num.textContent = (i + 1);
        btn.appendChild(num);

        const txt = document.createElement('span');
        txt.textContent = choice;
        btn.appendChild(txt);

        const marker = document.createElement('span');
        marker.className = 'bk-mc-marker';
        btn.appendChild(marker);

        btn.addEventListener('click', () => pick(btn, choice, opts, correctAnswer));
        opts.appendChild(btn);
      });

      mountEl.appendChild(opts);

      // Resultat-stempel (skjult inntil reveal)
      const resultWrap = document.createElement('div');
      resultWrap.className = 'bk-mc-result';
      mountEl.appendChild(resultWrap);

      // Hopp over-knapp
      const skipRow = document.createElement('div');
      skipRow.className = 'bk-mc-skip-row';
      const skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.className = 'bk-btn bk-btn-ghost bk-btn-small';
      skipBtn.textContent = 'Hopp over';
      skipBtn.addEventListener('click', () => {
        if (locked) return;
        pick(null, '__SKIP__', opts, correctAnswer);
      });
      skipRow.appendChild(skipBtn);
      mountEl.appendChild(skipRow);

      // Tastatur 1-4
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
      keyHandler = (e) => {
        if (locked) return;
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= choices.length) {
          const btn = opts.children[n - 1];
          if (btn) btn.click();
        }
      };
      document.addEventListener('keydown', keyHandler);
    }

    function pick(clickedBtn, value, optsEl, correctAnswer) {
      if (locked) return;
      locked = true;

      const correct = value !== '__SKIP__' &&
        State.normalizeAnswer(value) === State.normalizeAnswer(correctAnswer);

      Array.from(optsEl.children).forEach(el => {
        const isCorrect = State.normalizeAnswer(el.dataset.value) === State.normalizeAnswer(correctAnswer);
        const isClicked = el === clickedBtn;
        if (isCorrect) {
          el.classList.add('correct');
          const m = el.querySelector('.bk-mc-marker');
          if (m) m.appendChild(BKIcons.create('check', 18));
        } else if (isClicked && !correct) {
          el.classList.add('wrong');
          const m = el.querySelector('.bk-mc-marker');
          if (m) m.appendChild(BKIcons.create('x', 18));
        } else {
          el.classList.add('dim');
        }
        el.disabled = true;
      });

      // Resultat-stempel
      const resultWrap = mountEl.querySelector('.bk-mc-result');
      resultWrap.innerHTML = '';
      const stamp = document.createElement('span');
      stamp.className = 'bk-stamp bk-stamp-xl ' + (correct ? 'bk-stamp-green' : 'bk-stamp-red');
      stamp.style.setProperty('--stamp-rot', '5deg');
      stamp.textContent = correct ? 'TREFF!' : 'BOM!';
      resultWrap.appendChild(stamp);
      resultWrap.classList.add('show');

      const time = Date.now() - questionStartedAt;
      const item = queue[pos];

      revealTimer = setTimeout(() => {
        callbacks.onResult(item.idx, { correct, peeked: false, time });
        pos++;
        callbacks.onAdvance && callbacks.onAdvance();
        next();
      }, correct ? 1100 : 1700);
    }

    function cleanup() {
      if (revealTimer) { clearTimeout(revealTimer); revealTimer = null; }
      if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    }

    return { render, cleanup };
  }

  root.OrdaklokModeMC = {
    id: 'mc',
    label: 'Fleirval',
    description: 'Vel rett blant fire alternativ. Raskt og leikt.',
    icon: OrdaklokState.ICONS.list,
    supportsLeitner: true,
    mount(host, ctx) {
      const m = build(ctx.list, ctx.queue, ctx.options, ctx.callbacks);
      m.render(host);
      this._unmount = () => { m.cleanup && m.cleanup(); host.innerHTML = ''; };
    },
    unmount() { if (this._unmount) this._unmount(); }
  };
})(window);
