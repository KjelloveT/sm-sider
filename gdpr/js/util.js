/* ══════════════════════════════════════════════
   UTIL.JS — Små hjelparar i Protokollsmia

   Det meste ligg i js/vyrdepil-util.js (`Vy`), og denne fila peikar vidare dit
   etter AGENTS.md §5.1.1. Det som står att her er det som er særskilt for
   Protokollsmia.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /** Er verdien tom, eller berre kvitrom? */
  function tom(verdi) {
    return !String(verdi == null ? '' : verdi).trim();
  }

  /**
   * Normaliserer tekst for samanlikning i kvalitetssjekken: små bokstavar,
   * aksentar bort, fleire mellomrom til eitt.
   *
   * Æ, ø og å blir gøymde bak siffer medan aksentane blir strippa, elles
   * ville ringen over å forsvunne og «på» blitt «pa». Same grepet som
   * `leitekryss/js/util.js` brukar på ord til rutenettet.
   */
  function norm(tekst) {
    return String(tekst == null ? '' : tekst)
      .toLowerCase()
      .replace(/æ/g, '').replace(/ø/g, '').replace(/å/g, '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(//g, 'æ').replace(//g, 'ø').replace(//g, 'å')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Talet på ord i ein tekst. Brukt av `for-kort`-regelen i sjekken. */
  function ordtal(tekst) {
    const t = String(tekst == null ? '' : tekst).trim();
    return t ? t.split(/\s+/).length : 0;
  }

  /** Knapp med ikon framfor teksten. */
  function ikonknapp(ikon, tekst, klasse) {
    const btn = Vy.el('button', klasse || 'btn');
    btn.type = 'button';
    const sp = Vy.el('span');
    /* ICON() gjev fast SVG-markup frå vår eigen ikonmodul, aldri brukartekst. */
    if (typeof ICON === 'function') sp.innerHTML = ICON(ikon, 16);
    btn.appendChild(sp);
    if (tekst) btn.appendChild(document.createTextNode(tekst));
    else btn.setAttribute('aria-label', ikon);
    return btn;
  }

  /**
   * Eit skjemafelt: etikett, inndata og plass til hjelpetekst under.
   * Returnerer både wrapperen og sjølve inndatafeltet, så den som kallar
   * slepp å leite han opp att.
   */
  function feltrad(felt, verdi, onEndra) {
    const wrap = Vy.el('div', 'gd-felt');
    const id = 'f_' + felt.id;

    const merkelapp = Vy.el('label', 'gd-etikett', felt.etikett);
    merkelapp.htmlFor = id;
    wrap.appendChild(merkelapp);

    let inn;
    if (felt.type === 'lang') {
      inn = Vy.el('textarea', 'gd-textarea');
      inn.rows = 3;
    } else if (felt.type === 'val' || felt.type === 'jaNei') {
      inn = Vy.el('select', 'gd-select');
      const valg = felt.type === 'jaNei'
        ? ['', 'Nei', 'Ja', 'Veit ikkje']
        : [''].concat(felt.val || []);
      valg.forEach(function (v) {
        const o = Vy.el('option', null, v || '— vel —');
        o.value = v;
        inn.appendChild(o);
      });
    } else {
      inn = Vy.el('input', 'gd-input');
      inn.type = 'text';
    }

    inn.id = id;
    inn.value = verdi == null ? '' : verdi;
    inn.addEventListener('input', function () { onEndra(inn.value); });
    inn.addEventListener('change', function () { onEndra(inn.value); });
    wrap.appendChild(inn);

    /* Plass til rettleiing og til merknader frå sjekken. Står tom til nokon
       fyller han — men han skal finnast frå starten, så innhaldet ikkje
       dyttar skjemaet nedover når det kjem. */
    const under = Vy.el('div', 'gd-felt-under');
    wrap.appendChild(under);

    return { rot: wrap, inn: inn, under: under };
  }

  root.GD = root.GD || {};
  root.GD.util = {
    tom: tom,
    norm: norm,
    ordtal: ordtal,
    ikonknapp: ikonknapp,
    feltrad: feltrad,

    /* ---- Vidare til fellesmodulen ---- */
    el: Vy.el,
    uuid: function () { return Vy.uuid('gd'); },
    slug: function (t, f) { return Vy.slug(t, f || 'protokoll'); },
    escapeHtml: Vy.escapeHtml,
    downloadBlob: Vy.downloadBlob,
    downloadJson: Vy.downloadJson,
    openModal: Vy.openModal,
    closeModal: Vy.closeModal,
    bindOverlayClose: Vy.bindOverlayClose,
    toast: Vy.toast
  };
})(window);
