/* Ordkryss — små hjelparar (ingen DOM-avhengig tilstand). */
window.OK = window.OK || {};

OK.util = (function () {
  'use strict';

  /** Unik id, med fallback for eldre nettlesarar. */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'ok-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

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
    return s || fallback || 'ordkryss';
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
    let node = document.getElementById('okToast');
    if (!node) {
      node = el('div', 'ok-toast');
      node.id = 'okToast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('open'), 2600);
  }

  return {
    uuid, normalizeAnswer, el, iconButton, downloadBlob, slug,
    openModal, closeModal, bindOverlayClose, toast
  };
})();
