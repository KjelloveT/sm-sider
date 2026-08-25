/* ══════════════════════════════════════════════
   VYRDEPIL — Endringar byggjer lista frå
   json/endringslogg.json (kort oppsummering av
   CHANGELOG.md, éi linje per punkt).
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  const TYPAR = {
    nytt:  { merkelapp: 'Nytt',  klasse: 'er-nytt' },
    endra: { merkelapp: 'Endra', klasse: 'er-endra' },
    fiksa: { merkelapp: 'Fiksa', klasse: 'er-fiksa' }
  };

  const MERKE = {
    verktoy: { merkelapp: 'Nytt verktøy', klasse: 'endr-merke-verktoy' },
    eksperiment: { merkelapp: 'Eksperiment', klasse: 'endr-merke-eksperiment' }
  };

  const MANADER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'desember'];

  /** ISO-dato → «25. august 2026». Ugyldig dato blir ståande som han er. */
  function datoTekst(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return String(iso || '');
    return Number(m[3]) + '. ' + MANADER[Number(m[2]) - 1] + ' ' + m[1];
  }

  function brikke(klasse, tekst) {
    const el = document.createElement('span');
    el.className = klasse;
    el.textContent = tekst;
    return el;
  }

  function punktEl(p) {
    const type = TYPAR[p.t] || TYPAR.endra;
    const li = document.createElement('li');
    li.className = type.klasse;

    const linje1 = document.createElement('div');
    linje1.className = 'endr-linje1';
    linje1.appendChild(brikke('endr-type endr-type-' + p.t, type.merkelapp));

    if (p.kva) linje1.appendChild(brikke('endr-kva', p.kva));

    (p.merke || []).forEach(navn => {
      const m = MERKE[navn];
      if (m) linje1.appendChild(brikke('endr-merke ' + m.klasse, m.merkelapp));
    });
    li.appendChild(linje1);

    const tekst = document.createElement('p');
    tekst.className = 'endr-tekst';
    tekst.textContent = p.tekst || '';
    li.appendChild(tekst);

    return li;
  }

  function versjonEl(v) {
    const boks = document.createElement('section');
    boks.className = 'box2 endr-versjon';

    const hovud = document.createElement('div');
    hovud.className = 'endr-hovud';

    const nr = document.createElement('h2');
    nr.className = 'endr-nr';
    nr.textContent = 'Versjon ' + v.versjon;
    hovud.appendChild(nr);

    const dato = document.createElement('span');
    dato.className = 'endr-dato';
    dato.textContent = datoTekst(v.dato);
    hovud.appendChild(dato);

    if (v.samandrag) {
      const s = document.createElement('p');
      s.className = 'endr-samandrag';
      s.textContent = v.samandrag;
      hovud.appendChild(s);
    }
    boks.appendChild(hovud);

    const ul = document.createElement('ul');
    ul.className = 'endr-punkt';
    (v.punkt || []).forEach(p => ul.appendChild(punktEl(p)));
    boks.appendChild(ul);

    return boks;
  }

  /** Eit punkt høyrer med i filteret anten på type eller på merke. */
  function passar(p, filter) {
    if (filter === 'alle') return true;
    if (TYPAR[filter]) return p.t === filter;
    return (p.merke || []).indexOf(filter) !== -1;
  }

  function teikn(data, filter) {
    const host = document.getElementById('endrListe');
    const tal = document.getElementById('endrTal');
    if (!host) return;

    host.textContent = '';
    let punktTal = 0;
    let versjonTal = 0;

    (data.versjonar || []).forEach(v => {
      const punkt = (v.punkt || []).filter(p => passar(p, filter));
      if (!punkt.length) return;
      punktTal += punkt.length;
      versjonTal++;
      host.appendChild(versjonEl({ versjon: v.versjon, dato: v.dato, samandrag: v.samandrag, punkt: punkt }));
    });

    if (tal) {
      tal.textContent = punktTal
        ? punktTal + ' punkt i ' + versjonTal + (versjonTal === 1 ? ' utgåve' : ' utgåver')
        : 'Ingen punkt i dette utvalet.';
    }
  }

  fetch('json/endringslogg.json')
    .then(r => r.json())
    .then(data => {
      teikn(data, 'alle');

      const filter = document.getElementById('endrFilter');
      if (!filter) return;
      filter.addEventListener('click', e => {
        const knapp = e.target.closest('button[data-filter]');
        if (!knapp) return;
        filter.querySelectorAll('button[data-filter]').forEach(b => {
          const valt = b === knapp;
          b.classList.toggle('active', valt);
          b.setAttribute('aria-pressed', valt ? 'true' : 'false');
        });
        teikn(data, knapp.dataset.filter);
      });
    })
    .catch(e => {
      console.error('Klarte ikkje laste json/endringslogg.json:', e);
      const host = document.getElementById('endrListe');
      if (host) {
        const p = document.createElement('p');
        p.textContent = 'Klarte ikkje hente endringsloggen. Prøv å laste sida på nytt.';
        host.appendChild(p);
      }
    });
})();
