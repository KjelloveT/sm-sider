/* ══════════════════════════════════════════════
   LYDFANGST — høyr lyden, trykk bokstaven

   Kjernemodusen: lyd → symbol. Alltid open, og den einaste eleven har
   frå start.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const R = function () { return LjodRender; };

  function run(frame, ctx) {
    const A = LjodAdaptive;
    const q = A.pick(ctx.adaptive, { guarantee: ctx.guarantee });
    if (!q) return Promise.resolve(null);

    frame.setPrompt('Kva bokstav høyrer du?');
    const body = R().clear(frame.body);

    /* Lydknappen står øvst og er stor. Han er ikkje ein hjelpefunksjon
       gøymd i eit hjørne — han er sjølve oppgåva. */
    const play = function () { return LjodAudio.play('f_' + q.ch); };
    const replay = R().replayButton(play);
    body.appendChild(replay);

    const items = q.options.map(function (ch) {
      const node = R().letterTile(ch);
      node.dataset.key = ch;
      return { key: ch, node: node };
    });

    let answered = false;
    const started = performance.now();

    return new Promise(function (resolve) {
      const grid = R().optionGrid(items, function (key, node) {
        if (answered) return;
        answered = true;
        const correct = key === q.ch;
        const latency = performance.now() - started;
        R().lock(grid, true);

        if (correct) {
          R().markCorrect(node);
          R().setMood('happy');
        } else {
          R().markWrong(node);
          R().revealAnswer(grid, q.ch);
          R().setMood('think');
        }

        /* Feil svar: eleven skal høyre den rette lyden om att, ikkje
           berre sjå kva han skulle valt. Neste oppgåve ventar til
           heile tilbakemeldinga er ferdig — sjå R().feedback. */
        R().feedback(correct, correct ? [] : ['f_' + q.ch]).then(function () {
          resolve({ ch: q.ch, correct: correct, latencyMs: latency, chosen: correct ? null : key });
        });
      });
      body.appendChild(grid);

      /* Spel oppgåva med ein gong. unlock() inni play() sørgjer for at
         iPad ikkje sit taus, så lenge dette skjer i kjølvatnet av eit
         trykk lenger oppe i kjeda. */
      play();
    });
  }

  root.LjodMode_lydfangst = {
    id: 'lydfangst',
    label: 'Lydfangst',
    blurb: 'Høyr ein lyd og finn bokstaven',
    needsAudio: true,
    run: run
  };
})(window);
