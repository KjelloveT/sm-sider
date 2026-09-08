/* Leitekryss — små hjelparar.

   Det aller meste ligg no i js/vyrdepil-util.js (`Vy`). Denne fila peikar
   vidare dit, slik at kallstadene i resten av Leitekryss kan halde fram med å
   skrive `LK.util.el(...)`, men utan at vi held vår eigen kopi av logikken.
   Det som står att her, er det som faktisk er særskilt for Leitekryss. */
window.LK = window.LK || {};

LK.util = (function () {
  'use strict';

  /**
   * Gjer eit ord klart for rutenettet: store bokstavar, berre bokstavar.
   * Mellomrom, bindestrek og skiljeteikn fell bort ("blå ku" -> "BLÅKU").
   * Aksentar utanom æ, ø og å blir jamna ut ("kafé" -> "KAFE") så rutenettet
   * ikkje får bokstavar elevane ikkje kjenner att. Æ, Ø og Å blir gøymde bak
   * siffer medan aksentane blir strippa, elles ville Å-ringen forsvunne òg.
   */
  function normalizeWord(raw) {
    const upper = String(raw || '').toUpperCase()
      .replace(/Æ/g, '1').replace(/Ø/g, '2').replace(/Å/g, '3')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/1/g, 'Æ').replace(/2/g, 'Ø').replace(/3/g, 'Å');
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
    normalizeWord: normalizeWord,
    iconButton: iconButton,

    /* ---- Vidare til fellesmodulen ---- */
    uuid: function () { return Vy.uuid('lk'); },
    rng: Vy.rng,
    newSeed: Vy.newSeed,
    shuffle: Vy.shuffle,
    el: Vy.el,
    downloadBlob: Vy.downloadBlob,
    slug: function (text, fallback) { return Vy.slug(text, fallback || 'leitekryss'); },
    openModal: Vy.openModal,
    closeModal: Vy.closeModal,
    bindOverlayClose: Vy.bindOverlayClose,
    toast: Vy.toast
  };
})();
