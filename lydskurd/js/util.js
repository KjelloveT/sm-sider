/* ══════════════════════════════════════════════
   UTIL.JS — Små hjelparar for Lydskurd

   Ingen DOM-avhengig tilstand her. Alt som treng å vite
   noko om redigeringa bur i state.js.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.util = (function () {
  'use strict';

  /** Unik id, med fallback for eldre nettlesarar. */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'ls-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
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

  function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
  }

  /**
   * Tid som m:ss,t — t.d. 1:04,3. Tidslinjer treng ikkje timar;
   * går det over 60 minutt, veks minutt-talet berre vidare.
   */
  function formatTime(seconds, decimals) {
    const s = Math.max(0, seconds || 0);
    const min = Math.floor(s / 60);
    const rest = s - min * 60;
    const d = decimals == null ? 1 : decimals;
    const restText = rest.toFixed(d).replace('.', ',');
    return min + ':' + (rest < 10 ? '0' : '') + restText;
  }

  /** Kort tid utan desimalar, til tidslinjalen. */
  function formatTick(seconds) {
    const s = Math.max(0, Math.round(seconds));
    const min = Math.floor(s / 60);
    const rest = s - min * 60;
    return min + ':' + (rest < 10 ? '0' : '') + rest;
  }

  /** Menneskeleg filstorleik. */
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' kB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
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
    return s || fallback || 'lydskurd';
  }

  /** Filnamn utan ending — brukt som klippnamn ved import. */
  function baseName(filename) {
    return String(filename || '').replace(/\.[^.]+$/, '') || 'Lydklipp';
  }

  /* ---- Modalar ---- */
  const openStack = [];

  function openModal(overlay) {
    overlay.classList.add('open');
    openStack.push(overlay);
    const focusable = overlay.querySelector('input, textarea, select, button');
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

  /* ---- Kort melding nedst på skjermen ---- */
  let toastTimer = null;
  function toast(message) {
    let node = document.getElementById('lsToast');
    if (!node) {
      node = el('div', 'ls-toast');
      node.id = 'lsToast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('open'), 3000);
  }

  return {
    uuid, el, iconButton, clamp,
    formatTime, formatTick, formatBytes,
    downloadBlob, slug, baseName,
    openModal, closeModal, bindOverlayClose, toast
  };
})();
