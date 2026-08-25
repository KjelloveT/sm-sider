/* ══════════════════════════════════════════════
   UTIL.JS — Små hjelparar for Ljodbanken
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.util = (function () {
  'use strict';

  /** Lag eit element med klasse og tekst i eitt kall. */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /** Knapp med ikon, og tekst berre når han skal synast. */
  function iconButton(iconName, label, className, title) {
    const btn = el('button', className || 'btn');
    btn.type = 'button';
    const span = el('span');
    span.innerHTML = ICON(iconName, 16);
    btn.appendChild(span);
    if (label) btn.appendChild(document.createTextNode(label));
    if (title) { btn.title = title; if (!label) btn.setAttribute('aria-label', title); }
    return btn;
  }

  function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
  }

  /** Sekund som «0,74 s». Klippa her er korte, så desimalane tel. */
  function formatSeconds(seconds, decimals) {
    const d = decimals == null ? 2 : decimals;
    return (Math.max(0, seconds || 0)).toFixed(d).replace('.', ',') + ' s';
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' kB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
  }

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

  /** Filnamn utan mappe og utan ending. */
  function baseName(path) {
    const last = String(path || '').split('/').pop();
    return last.replace(/\.[^.]+$/, '');
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
    if (overlay.dataset.onclose === 'stopAudio') LB.audio.stop();
  }

  function isOpen(overlay) { return overlay.classList.contains('open'); }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !openStack.length) return;
    closeModal(openStack[openStack.length - 1]);
  });

  function bindOverlayClose(overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  }

  /* ---- Kort melding nedst på skjermen ---- */
  let toastTimer = null;
  function toast(message) {
    let node = document.getElementById('lbToast');
    if (!node) {
      node = el('div', 'lb-toast');
      node.id = 'lbToast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('open'), 3000);
  }

  return {
    el, iconButton, clamp,
    formatSeconds, formatBytes, downloadBlob, baseName,
    openModal, closeModal, isOpen, bindOverlayClose, toast
  };
})();
