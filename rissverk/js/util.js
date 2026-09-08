/* ══════════════════════════════════════════════
   UTIL.JS — Små hjelparar for Rissverk

   Ingen kunnskap om teikninga bur her. Alt som veit noko om former,
   lag eller markering ligg i state.js.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.util = (function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /* ──────────────── Id-ar ──────────────── */

  /* Kort og lesbar, ikkje ein full uuid. Id-ane hamnar i eksporterte
     SVG-filer, og «n17» er venlegare å lese enn 36 teikn med bindestrekar. */
  let counter = 0;
  function nextId(prefix) {
    counter += 1;
    return (prefix || 'n') + counter.toString(36);
  }

  /** Sørgjer for at teljaren ligg over alt som alt finst etter ei innlasting. */
  function seedIds(ids) {
    ids.forEach((id) => {
      const n = parseInt(String(id).replace(/^[a-z]+/i, ''), 36);
      if (!isNaN(n) && n > counter) counter = n;
    });
  }

  /* ──────────────── DOM ──────────────── */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /** SVG-element med attributt i eitt kall. */
  function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) setAttrs(node, attrs);
    return node;
  }

  function setAttrs(node, attrs) {
    Object.keys(attrs).forEach((key) => {
      const v = attrs[key];
      if (v == null || v === false) node.removeAttribute(key);
      else node.setAttribute(key, v);
    });
    return node;
  }

  /** Knapp med ikon, valfri tekst. Utan tekst får han aria-label. */
  function iconButton(iconName, label, className, title) {
    const btn = el('button', className || 'btn');
    btn.type = 'button';
    const span = el('span');
    span.setAttribute('data-icon', iconName);
    btn.appendChild(span);
    if (label) btn.appendChild(document.createTextNode(label));
    else btn.setAttribute('aria-label', title || iconName);
    if (title) btn.title = title;
    if (typeof hydrateIcons === 'function') hydrateIcons(btn);
    return btn;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ──────────────── Peikarfangst ──────────────── */

  /*
   * setPointerCapture kastar når peikaren alt er sleppt eller teken frå
   * oss av nettlesaren. Skjer det midt i ein handterar, blir resten av
   * han aldri køyrd — og eit drag som ikkje fekk kopla på lyttarane sine
   * er eit drag som ikkje verkar. Difor går all fangst gjennom desse to.
   */
  function capturePointer(el, e) {
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ingen fangst å få */ }
  }

  function releasePointer(el, e) {
    try {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    } catch (err) { /* alt sleppt */ }
  }

  /* ──────────────── Tal ──────────────── */

  function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
  }

  /** Tal til visning, med komma som desimalskiljeteikn. */
  function num(value, decimals) {
    const d = decimals == null ? 1 : decimals;
    const s = Number(value || 0).toFixed(d);
    return s.replace(/\.?0+$/, '').replace('.', ',') || '0';
  }

  /** Les eit tal frå eit felt der brukaren kan ha skrive komma. */
  function parseNum(text, fallback) {
    const n = parseFloat(String(text == null ? '' : text).replace(',', '.'));
    return isNaN(n) ? (fallback || 0) : n;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' kB';
    return num(bytes / (1024 * 1024), 1) + ' MB';
  }

  /* ──────────────── Fargar ──────────────── */

  /**
   * Fargar blir lagra som hex pluss eit eige alfa-tal, ikkje som rgba().
   * Grunnen er SVG: fyllfarge og gjennomsikt er to skilde attributt der
   * (fill og fill-opacity), og held vi dei skilde heilt fram til
   * serialiseringa, slepp vi å rekne fram og tilbake.
   */
  function hexToRgb(hex) {
    let h = String(hex || '').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const p = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return '#' + p(r) + p(g) + p(b);
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    if (delta) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: max ? delta / max : 0, v: max };
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return { r: (rgb[0] + m) * 255, g: (rgb[1] + m) * 255, b: (rgb[2] + m) * 255 };
  }

  /**
   * Les ein farge frå ei CSS-variabel i det aktive temaet.
   * Verdiane kan vere hex, rgb() eller namn — vi går vegen om nettlesaren
   * sin eigen fargeomrekning i staden for å parse alle formene sjølve.
   */
  function themeColor(varName) {
    const raw = getComputedStyle(document.body).getPropertyValue(varName).trim();
    if (!raw) return null;
    if (raw[0] === '#') {
      const c = hexToRgb(raw);
      return c ? rgbToHex(c.r, c.g, c.b) : null;
    }
    const probe = el('span');
    probe.style.color = raw;
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const m = computed.match(/(\d+(?:\.\d+)?)/g);
    return m && m.length >= 3 ? rgbToHex(+m[0], +m[1], +m[2]) : null;
  }

  /* ──────────────── Filer ──────────────── */

  /* Nedlasting, elementbygging, modalhandtering og korte meldingar ligg i
     js/vyrdepil-util.js. Vi peikar vidare dit i staden for å halde ein kopi. */
  const downloadBlob = Vy.downloadBlob;

  function slug(text, fallback) {
    const s = String(text || '').trim().toLowerCase()
      .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'oe').replace(/[å]/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s || fallback || 'rissverk';
  }

  function baseName(filename) {
    return String(filename || '').replace(/\.[^.]+$/, '') || 'Teikning';
  }

  /* ──────────────── Modalar ──────────────── */

  const openModal = Vy.openModal;
  const closeModal = Vy.closeModal;
  const bindOverlayClose = Vy.bindOverlayClose;
  const anyModalOpen = Vy.anyModalOpen;

  /* ──────────────── Kort melding ──────────────── */

  /* Kort melding nedst på skjermen — sjå Vy.toast() i js/vyrdepil-util.js.
     Handteringa låg tidlegare her, i ni ulike utgåver rundt i repoet. Ho er
     flytta til fellesmodulen så rettingar treffer alle verktøya, og fordi den
     gamle stilen fylte flata med --accent og fall under AA-kravet i dei sju
     mørke temaa (AGENTS.md §3.2). */
  function toast(message) {
    return Vy.toast(message);
  }

  /* ──────────────── Tidsstyring ──────────────── */

  /**
   * Køyrer funksjonen éin gong per skjermoppdatering, uansett kor mange
   * gonger han blir bedt om det. Peikarhendingar kjem tettare enn skjermen
   * kan teikne, og utan dette ville kvar musrørsle utløyst ei full
   * opptegning som likevel aldri nådde fram til auget.
   */
  function rafThrottle(fn) {
    let pending = false;
    let lastArgs = null;
    return function () {
      lastArgs = arguments;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        fn.apply(null, lastArgs);
      });
    };
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  return {
    SVG_NS,
    nextId, seedIds,
    el, svg, setAttrs, iconButton, clear,
    capturePointer, releasePointer,
    clamp, num, parseNum, formatBytes,
    hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, themeColor,
    downloadBlob, slug, baseName,
    openModal, closeModal, anyModalOpen, bindOverlayClose, toast,
    rafThrottle, debounce
  };
})();
