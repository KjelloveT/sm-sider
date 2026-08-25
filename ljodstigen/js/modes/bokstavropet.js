/* ══════════════════════════════════════════════
   BOKSTAVROPET — sjå bokstaven, finn lyden

   Motsett veg av Lydfangst. Ein elev som klarer den eine klarer ikkje
   automatisk den andre, så dette er ein eigen modus og ikkje ein
   variant: å kjenne att eit symbol og å hente fram ein lyd frå minnet
   er to ulike operasjonar.

   Kvart alternativ er ein nummerert lyttebrikke. Eleven kan høyre alle
   så mange gonger han vil før han vel — vi måler kva han kan, ikkje kor
   godt han hugsar rekkjefølgja.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const R = function () { return LjodRender; };

  function run(frame, ctx) {
    const A = LjodAdaptive;
    const q = A.pick(ctx.adaptive, { guarantee: ctx.guarantee });
    if (!q) return Promise.resolve(null);

    frame.setPrompt('Kva lyd høyrer denne bokstaven til?');
    const body = R().clear(frame.body);

    body.appendChild(R().letterPlate(q.ch));

    const hint = R().h('p', 'ljod-hint', 'Trykk på ein lyd for å høyre han.');
    body.appendChild(hint);

    let answered = false;
    const started = performance.now();

    return new Promise(function (resolve) {
      const items = q.options.map(function (ch, i) {
        const node = R().h('button', 'ljod-listen');
        node.type = 'button';
        node.dataset.key = ch;
        node.setAttribute('aria-label', 'Lyd nummer ' + (i + 1));
        node.appendChild(LjodShapes.speaker(36));
        node.appendChild(R().h('span', 'ljod-listen-num', String(i + 1)));
        return { key: ch, node: node, index: i };
      });

      /* Første trykk spelar lyden. Andre trykk på same brikke er valet.
         Det gjer at eleven kan lytte fritt utan å velje ved eit uhell —
         den vanlegaste kjelda til «feil» som ikkje handlar om lesing. */
      const heard = {};
      const grid = R().optionGrid(items, function (key, node) {
        if (answered) return;

        if (!heard[key]) {
          heard[key] = true;
          node.classList.add('is-heard');
          LjodAudio.play('f_' + key);
          hint.textContent = 'Trykk ein gong til på lyden du meiner er rett.';
          return;
        }

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
          LjodAudio.play(R().nudgeId())
            .then(function () { return LjodAudio.play('f_' + q.ch); });
        }

        setTimeout(function () {
          resolve({ ch: q.ch, correct: correct, latencyMs: latency, chosen: correct ? null : key });
        }, correct ? 900 : 1900);
      });

      body.appendChild(grid);
    });
  }

  root.LjodMode_bokstavropet = {
    id: 'bokstavropet',
    label: 'Bokstavropet',
    blurb: 'Sjå ein bokstav og finn lyden hans',
    needsAudio: true,
    run: run
  };
})(window);
