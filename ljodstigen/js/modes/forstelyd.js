/* ══════════════════════════════════════════════
   FØRSTE LYD — høyr eit ord, finn bokstaven det byrjar med

   Første posisjon er den lettaste å høyre ut av eit ord, og difor det
   naturlege steget mellom rein attkjenning og lydering. Siste lyd og
   lyden i midten er merkbart vanskelegare og er eigne modusar seinare —
   ikkje ein bryter på denne.

   Ingen bilete. Ordet blir lese, ikkje vist.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const R = function () { return LjodRender; };

  /* Vel eit ord som byrjar på ein bokstav motoren vil øve på. Klarer vi
     ikkje det, tek vi kva som helst ord eleven har bokstavane til —
     betre eit litt skeivt val enn ei tom oppgåve. */
  function pickWord(state, guarantee) {
    const q = LjodAdaptive.pick(state, { guarantee: guarantee });
    if (!q) return null;
    const pool = LjodWords.available(state.step);
    const onTarget = pool.filter(function (w) { return w.first === q.ch; });
    const word = onTarget.length
      ? onTarget[Math.floor(Math.random() * onTarget.length)]
      : pool[Math.floor(Math.random() * pool.length)];
    if (!word) return null;
    /* Fasiten er bokstaven ordet FAKTISK byrjar på. */
    return { word: word, ch: word.first, options: rebuild(state, word.first, q.options) };
  }

  /* Alternativa frå motoren gjeld q.ch. Traff vi ikkje det ordet, må
     fasiten inn i lista, og ein annan må ut. */
  function rebuild(state, ch, options) {
    if (options.indexOf(ch) !== -1) return options;
    const out = options.slice();
    out[Math.floor(Math.random() * out.length)] = ch;
    return out;
  }

  function run(frame, ctx) {
    const q = pickWord(ctx.adaptive, ctx.guarantee);
    if (!q) return Promise.resolve(null);

    frame.setPrompt('Kva bokstav byrjar ordet med?');
    const body = R().clear(frame.body);

    const play = function () { return LjodAudio.play(q.word.sound); };
    body.appendChild(R().replayButton(play, 'Høyr ordet om att'));

    let answered = false;
    const started = performance.now();

    return new Promise(function (resolve) {
      const items = q.options.map(function (ch) {
        const node = R().letterTile(ch);
        node.dataset.key = ch;
        return { key: ch, node: node };
      });

      const grid = R().optionGrid(items, function (key, node) {
        if (answered) return;
        answered = true;
        const correct = key === q.ch;
        const latency = performance.now() - started;
        R().lock(grid, true);

        if (correct) {
          R().markCorrect(node);
          R().setMood('happy');
          LjodAudio.play(R().praiseId());
        } else {
          R().markWrong(node);
          R().revealAnswer(grid, q.ch);
          R().setMood('think');
          /* Vis og spel samanhengen: lyden først, så ordet. Eleven skal
             høyre at /s/ ligg fremst i «sol». */
          LjodAudio.play(R().nudgeId())
            .then(function () { return LjodAudio.play('f_' + q.ch); })
            .then(function () { return LjodAudio.play(q.word.sound); });
        }

        setTimeout(function () {
          resolve({ ch: q.ch, correct: correct, latencyMs: latency, chosen: correct ? null : key });
        }, correct ? 900 : 2400);
      });

      body.appendChild(grid);
      play();
    });
  }

  root.LjodMode_forstelyd = {
    id: 'forstelyd',
    label: 'Første lyd',
    blurb: 'Høyr eit ord og finn bokstaven det byrjar med',
    needsAudio: true,
    run: run
  };
})(window);
