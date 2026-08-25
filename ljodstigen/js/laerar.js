/* ══════════════════════════════════════════════
   LAERAR.JS — Oversikt for læraren

   Dataen finst alt i den adaptive tilstanden, så denne skjermen kostar
   nesten ingenting å lage — og er truleg det ein lærar får mest ut av i
   heile appen: kva bokstavar som sit, kva som ikkje sit, og kva
   forvekslingar som går att hos akkurat denne eleven.

   Skjermen er meint å skrivast ut. Sjå @media print i css/style.css.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const R = function () { return LjodRender; };

  function fmtMs(ms) {
    if (!ms) return '–';
    return (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  }

  function render(host, p) {
    R().clear(host);
    const a = p.adaptive;
    const st = LjodAdaptive.stats(a);
    const av = LjodState.avatarOf(p.avatar);

    const head = R().h('div', 'ljod-laerar-head');
    head.appendChild(R().h('h2', 'heading3 no-mt', 'Oversikt — ' + av.name));
    head.appendChild(R().h('p', 'ljod-muted',
      'Starta ' + p.created + '. Spelt ' + p.days.length + ' dagar. ' +
      'Steg ' + st.step + ' av ' + LjodLetters.STEPS.length + '.'));
    host.appendChild(head);

    /* Samandrag */
    const sum = R().h('div', 'ljod-laerar-sum');
    [['Planta', st.planted], ['Sit godt', st.grown], ['Heilt sikre', st.mastered], ['Av i alt', st.total]]
      .forEach(function (row) {
        const box = R().h('div', 'ljod-stat');
        box.appendChild(R().h('span', 'ljod-stat-num', String(row[1])));
        box.appendChild(R().h('span', 'ljod-stat-label', row[0]));
        sum.appendChild(box);
      });
    host.appendChild(sum);

    /* Bokstav for bokstav */
    host.appendChild(R().h('h3', 'heading4', 'Bokstav for bokstav'));
    const table = R().h('table', 'ljod-table');
    const thead = R().h('thead');
    const hr = R().h('tr');
    ['Bokstav', 'Nivå', 'Rett', 'Feil', 'Snittid', 'Byter med'].forEach(function (t) {
      hr.appendChild(R().h('th', null, t));
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = R().h('tbody');
    LjodLetters.ALPHABET.forEach(function (ch) {
      const it = a.items[ch];
      if (!it || (it.right + it.wrong) === 0) return;
      const tr = R().h('tr');
      tr.appendChild(R().h('td', 'ljod-td-letter', ch.toUpperCase()));
      tr.appendChild(R().h('td', null, LjodShapes.STAGE_NAMES[it.maxBox]));
      tr.appendChild(R().h('td', null, String(it.right)));
      tr.appendChild(R().h('td', null, String(it.wrong)));
      tr.appendChild(R().h('td', null, fmtMs(it.avgMs)));
      const conf = Object.keys(it.errors).sort(function (x, y) { return it.errors[y] - it.errors[x]; });
      tr.appendChild(R().h('td', null, conf.length ? conf.join(' ').toUpperCase() : '–'));
      /* Marker rader som treng merksemd, så auget finn dei utan å lese tal. */
      const total = it.right + it.wrong;
      if (total >= 3 && it.right / total < 0.6) tr.classList.add('is-weak');
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    if (!tbody.childNodes.length) {
      host.appendChild(R().h('p', 'ljod-muted', 'Eleven har ikkje svart på noko enno.'));
    } else {
      host.appendChild(table);
    }

    /* Det læraren skal gjere noko med */
    const trouble = LjodAdaptive.troubleSpots(a).slice(0, 5);
    if (trouble.length) {
      host.appendChild(R().h('h3', 'heading4', 'Verdt å sjå på'));
      const ul = R().h('ul', 'ljod-trouble');
      trouble.forEach(function (t) {
        const li = R().h('li');
        let txt = 'Bokstaven ' + t.ch.toUpperCase() + ': ' + t.right + ' rette av ' +
          (t.right + t.wrong) + '.';
        if (t.confusedWith.length) {
          /* Store bokstavar per bokstav, ikkje på heile strengen — elles
             blir bindeordet til «OG». */
          const conf = t.confusedWith.slice(0, 2).map(function (c) { return c.toUpperCase(); });
          txt += ' Blir oftast bytt med ' + conf.join(' og ') + '.';
        }
        li.textContent = txt;
        ul.appendChild(li);
      });
      host.appendChild(ul);
    }

    host.appendChild(R().h('p', 'ljod-muted ljod-print-note',
      'Alt dette ligg berre i denne nettlesaren og blir ikkje sendt nokon stad.'));
  }

  root.LjodLaerar = { render: render };
})(window);
