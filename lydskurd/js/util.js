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

  /* Nedlasting, elementbygging, modalhandtering og korte meldingar ligg i
     js/vyrdepil-util.js. Vi peikar vidare dit i staden for å halde ein kopi. */
  const downloadBlob = Vy.downloadBlob;

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
  const openModal = Vy.openModal;
  const closeModal = Vy.closeModal;
  const bindOverlayClose = Vy.bindOverlayClose;

  /* Kort melding nedst på skjermen — sjå Vy.toast() i js/vyrdepil-util.js.
     Handteringa låg tidlegare her, i ni ulike utgåver rundt i repoet. Ho er
     flytta til fellesmodulen så rettingar treffer alle verktøya, og fordi den
     gamle stilen fylte flata med --accent og fall under AA-kravet i dei sju
     mørke temaa (AGENTS.md §3.2). */
  function toast(message) {
    return Vy.toast(message);
  }

  return {
    uuid, el, iconButton, clamp,
    formatTime, formatTick, formatBytes,
    downloadBlob, slug, baseName,
    openModal, closeModal, bindOverlayClose, toast
  };
})();
