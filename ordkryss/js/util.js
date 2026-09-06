/* Ordkryss — små hjelparar.

   Det aller meste ligg no i js/vyrdepil-util.js (`Vy`). Denne fila peikar
   vidare dit, slik at kallstadene i resten av Ordkryss kan halde fram med å
   skrive `OK.util.el(...)`, men utan at vi held vår eigen kopi av logikken.
   Det som står att her, er det som faktisk er særskilt for Ordkryss. */
window.OK = window.OK || {};

OK.util = (function () {
  'use strict';

  /**
   * Gjer eit svar klart for rutenettet: store bokstavar, berre bokstavar.
   * Mellomrom, bindestrek og skiljeteikn fell bort ("t-skjorte" -> "TSKJORTE").
   */
  function normalizeAnswer(raw) {
    const upper = String(raw || '').toUpperCase();
    let out = '';
    for (const ch of upper) {
      if (/\p{L}/u.test(ch)) out += ch;
    }
    return out;
  }

  /** Knapp med ikon framfor teksten. */
  function iconButton(iconName, label, className) {
    const btn = Vy.el('button', className || 'btn');
    btn.type = 'button';
    const span = Vy.el('span');
    /* ICON() gjev fast SVG-markup frå vår eigen ikonmodul, aldri brukartekst. */
    span.innerHTML = ICON(iconName, 16);
    btn.appendChild(span);
    if (label) btn.appendChild(document.createTextNode(label));
    else btn.setAttribute('aria-label', iconName);
    return btn;
  }

  return {
    normalizeAnswer: normalizeAnswer,
    iconButton: iconButton,

    /* ---- Vidare til fellesmodulen ---- */
    uuid: function () { return Vy.uuid('ok'); },
    el: Vy.el,
    downloadBlob: Vy.downloadBlob,
    slug: function (text, fallback) { return Vy.slug(text, fallback || 'ordkryss'); },
    openModal: Vy.openModal,
    closeModal: Vy.closeModal,
    bindOverlayClose: Vy.bindOverlayClose,
    toast: Vy.toast
  };
})();
