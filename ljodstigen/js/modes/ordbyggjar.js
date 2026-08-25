/* ══════════════════════════════════════════════
   ORDBYGGJAREN — høyr eit ord, bygg det av bokstavlydar

   Toppen av stigen i v1: her går eleven frå å kjenne att til å byggje.

   TRYKK, IKKJE DRA. Dra-og-slepp er standard i slike spel og er feil
   val for målgruppa: det krev at ein seksåring held fingeren nede og
   treffer eit mål samtidig, og det feilar oftast for dei elevane som
   alt strevar mest. Her trykkjer eleven på ei brikke, og ho legg seg i
   neste ledige rute. Trykk på ei fylt rute sender brikka tilbake.
   Ingen presisjon kravd, alt kan angrast.

   Kvar brikke seier lyden sin når ho landar. Det er sjølve poenget:
   eleven høyrer ordet byggje seg opp lyd for lyd.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const R = function () { return LjodRender; };

  /* Kva ord eleven er klar for. Vi strammar krava og slakkar dei
     gradvis, så vi alltid har eit ord å gje — ei tom oppgåve er verre
     enn eit litt for lett ord. */
  function pickWord(p) {
    const a = p.adaptive;
    const known = LjodLetters.upTo(a.step).filter(function (ch) {
      return LjodAdaptive.item(a, ch).maxBox >= 2;
    });
    const built = (p.counters.wordsBuilt || 0);

    /* Dei første orda er heilt regelrette og korte. <o> som seier /u/
       (sol, mor, bok) kjem først når eleven har bygd nokre ord der
       bokstav og lyd står ein-til-ein. */
    const tries = [
      { clean: true,  maxLen: 3, letters: known },
      { clean: true,  maxLen: built >= 5 ? 4 : 3, letters: known },
      { clean: built < 8, maxLen: 4, letters: known },
      { clean: false, maxLen: 4, letters: known },
      { clean: false, maxLen: 4 },
      {}
    ];
    for (let i = 0; i < tries.length; i++) {
      const opts = tries[i];
      if (opts.letters && !opts.letters.length) continue;
      const pool = LjodWords.available(a.step, opts);
      if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
    }
    return null;
  }

  /* Brikkene: bokstavane i ordet, stokka, pluss ein distraktor når
     eleven er komen eit stykke. Fleire distraktorar ville gjort
     oppgåva til ei leiting i staden for ei lydering. */
  function tilesFor(word, a, extra) {
    const set = word.letters.slice();
    if (extra) {
      const pool = LjodLetters.upTo(a.step).filter(function (c) {
        return set.indexOf(c) === -1 && !LjodLetters.isConfusable(word.letters[0], c);
      });
      if (pool.length) set.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    for (let i = set.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = set[i]; set[i] = set[j]; set[j] = t;
    }
    return set;
  }

  function run(frame, ctx) {
    const p = ctx.profile;
    const word = pickWord(p);
    if (!word) return Promise.resolve(null);

    frame.setPrompt('Bygg ordet du høyrer.');
    const body = R().clear(frame.body);

    const play = function () { return LjodAudio.play(word.sound); };
    body.appendChild(R().replayButton(play, 'Høyr ordet om att'));

    /* Rutene */
    const slotRow = R().h('div', 'ljod-slots');
    const slots = [];
    for (let i = 0; i < word.len; i++) {
      const s = R().h('button', 'ljod-slot');
      s.type = 'button';
      s.dataset.index = String(i);
      s.setAttribute('aria-label', 'Rute ' + (i + 1) + ' av ' + word.len + ', tom');
      slotRow.appendChild(s);
      slots.push({ node: s, ch: null, from: null });
    }
    body.appendChild(slotRow);

    /* Brikkene */
    const tray = R().h('div', 'ljod-tray');
    const built = (p.counters.wordsBuilt || 0);
    const tiles = tilesFor(word, p.adaptive, built >= 3).map(function (ch, i) {
      const t = R().letterTile(ch, { size: 'md' });
      t.dataset.tile = String(i);
      tray.appendChild(t);
      return { node: t, ch: ch, used: false };
    });
    body.appendChild(tray);

    const started = performance.now();
    let firstAttempt = null;   // resultatet vi rapporterer til motoren
    let done = false;

    return new Promise(function (resolve) {

      function refreshSlot(i) {
        const s = slots[i];
        R().clear(s.node);
        if (s.ch) {
          s.node.appendChild(R().h('span', 'ljod-glyph', s.ch));
          s.node.setAttribute('aria-label', 'Rute ' + (i + 1) + ', bokstaven ' + s.ch.toUpperCase() + '. Trykk for å ta han ut.');
          s.node.classList.add('is-filled');
        } else {
          s.node.setAttribute('aria-label', 'Rute ' + (i + 1) + ' av ' + word.len + ', tom');
          s.node.classList.remove('is-filled');
        }
        s.node.classList.remove('is-right', 'is-wrong');
      }

      function nextEmpty() {
        for (let i = 0; i < slots.length; i++) if (!slots[i].ch) return i;
        return -1;
      }

      function placeTile(t) {
        if (done || t.used) return;
        const i = nextEmpty();
        if (i === -1) return;
        t.used = true;
        t.node.classList.add('is-used');
        t.node.disabled = true;
        slots[i].ch = t.ch;
        slots[i].from = t;
        refreshSlot(i);
        /* Brikka seier lyden sin når ho landar. */
        LjodAudio.play('f_' + t.ch);
        if (nextEmpty() === -1) setTimeout(check, 420);
      }

      function pullTile(i) {
        if (done) return;
        const s = slots[i];
        if (!s.ch) return;
        s.from.used = false;
        s.from.node.classList.remove('is-used');
        s.from.node.disabled = false;
        s.ch = null; s.from = null;
        refreshSlot(i);
      }

      function check() {
        const guess = slots.map(function (s) { return s.ch; });
        const correct = guess.join('') === word.text;

        if (firstAttempt === null) {
          firstAttempt = {
            correct: correct,
            latencyMs: performance.now() - started,
            /* Éin post per rute, så motoren kan flytte kvar bokstav for
               seg. Ein elev kan ha `s` og `l` på plass og bomme på `o`. */
            letters: slots.map(function (s, i) {
              return {
                ch: word.letters[i],
                correct: s.ch === word.letters[i],
                chosen: s.ch === word.letters[i] ? null : s.ch
              };
            })
          };
        }

        if (correct) {
          done = true;
          slots.forEach(function (s) { s.node.classList.add('is-right'); });
          R().setMood('happy');
          LjodMerke.noteWord(p, word.text);
          /* Lyder ordet seint, så heilt. Det er her lydering blir til
             lesing, og det er verdt dei tre sekunda. */
          LjodAudio.soundOut(word)
            .then(function () { return LjodAudio.play(R().praiseId()); })
            .then(function () {
              setTimeout(function () {
                resolve(Object.assign({ word: word }, firstAttempt));
              }, 500);
            });
          return;
        }

        /* Feil: dei rette rutene blir ståande, dei gale blir tømde.
           Eleven mistar aldri alt han fekk til. */
        R().setMood('think');
        slots.forEach(function (s, i) {
          if (s.ch === word.letters[i]) { s.node.classList.add('is-right'); }
          else { s.node.classList.add('is-wrong'); }
        });
        LjodAudio.play(R().nudgeId()).then(play);
        setTimeout(function () {
          slots.forEach(function (s, i) {
            if (s.ch !== word.letters[i]) pullTile(i);
            else s.node.classList.remove('is-wrong');
          });
        }, 1400);
      }

      tiles.forEach(function (t) {
        t.node.addEventListener('click', function () { placeTile(t); });
      });
      slots.forEach(function (s, i) {
        s.node.addEventListener('click', function () { pullTile(i); });
      });

      play();
    });
  }

  root.LjodMode_ordbyggjar = {
    id: 'ordbyggjar',
    label: 'Ordbyggjaren',
    blurb: 'Høyr eit ord og bygg det av bokstavar',
    needsAudio: true,
    run: run
  };
})(window);
