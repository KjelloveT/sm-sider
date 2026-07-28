/* Leitekryss — små hjelparar (ingen DOM-avhengig tilstand). */
window.LK = window.LK || {};

LK.util = (function () {
  'use strict';

  /** Unik id, med fallback for eldre nettlesarar. */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'lk-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

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

  /** Deterministisk tilfeldig-generator, så same frø gjev same rutenett. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Nytt tilfeldig frø. */
  function newSeed() {
    return Math.floor(Math.random() * 2147483647) + 1;
  }

  /** Stokkar ein kopi av lista med ein gjeven tilfeldig-generator. */
  function shuffle(list, random) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /** Lag eit element med klasse og tekst i eitt kall. */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /** Knapp med ikon framfor teksten. */
  function iconButton(iconName, label, className) {
    const btn = el('button', className || 'btn');
    btn.type = 'button';
    const span = el('span');
    span.innerHTML = ICON(iconName, 16);
    btn.appendChild(span);
    if (label) btn.appendChild(document.createTextNode(label));
    else btn.setAttribute('aria-label', iconName);
    return btn;
  }

  /** Last ned ein Blob som fil. */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Trygt filnamn ut frå ein tittel. */
  function slug(text, fallback) {
    const s = String(text || '').trim().toLowerCase()
      .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'oe').replace(/[å]/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || fallback || 'leitekryss';
  }

  /* ---- Modalar ---- */
  const openStack = [];

  function openModal(overlay) {
    overlay.classList.add('open');
    openStack.push(overlay);
    const focusable = overlay.querySelector('input, textarea, button');
    if (focusable) focusable.focus();
  }

  function closeModal(overlay) {
    overlay.classList.remove('open');
    const i = openStack.indexOf(overlay);
    if (i !== -1) openStack.splice(i, 1);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !openStack.length) return;
    closeModal(openStack[openStack.length - 1]);
  });

  /** Lukk modalen når ein klikkar på det mørke feltet utanfor. */
  function bindOverlayClose(overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  }

  /** Kort melding nedst på skjermen. */
  let toastTimer = null;
  function toast(message) {
    let node = document.getElementById('lkToast');
    if (!node) {
      node = el('div', 'lk-toast');
      node.id = 'lkToast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('open'), 2600);
  }

  return {
    uuid, normalizeWord, rng, newSeed, shuffle,
    el, iconButton, downloadBlob, slug,
    openModal, closeModal, bindOverlayClose, toast
  };
})();
