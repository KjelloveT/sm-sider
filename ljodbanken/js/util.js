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

  /* Nedlasting, elementbygging, modalhandtering og korte meldingar ligg i
     js/vyrdepil-util.js. Vi peikar vidare dit i staden for å halde ein kopi. */
  const downloadBlob = Vy.downloadBlob;

  /** Filnamn utan mappe og utan ending. */
  function baseName(path) {
    const last = String(path || '').split('/').pop();
    return last.replace(/\.[^.]+$/, '');
  }

  /* ---- Modalar ---- */
  const openModal = Vy.openModal;
  const closeModal = Vy.closeModal;
  const bindOverlayClose = Vy.bindOverlayClose;
  const isOpen = Vy.modalOpen;

  /* Kort melding nedst på skjermen — sjå Vy.toast() i js/vyrdepil-util.js.
     Handteringa låg tidlegare her, i ni ulike utgåver rundt i repoet. Ho er
     flytta til fellesmodulen så rettingar treffer alle verktøya, og fordi den
     gamle stilen fylte flata med --accent og fall under AA-kravet i dei sju
     mørke temaa (AGENTS.md §3.2). */
  function toast(message) {
    return Vy.toast(message);
  }

  return {
    el, iconButton, clamp,
    formatSeconds, formatBytes, downloadBlob, baseName,
    openModal, closeModal, isOpen, bindOverlayClose, toast
  };
})();
