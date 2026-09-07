/* ══════════════════════════════════════════════
   UTIL.JS — Småting Vitjingsruta byggjer på

   Fargeomrekningane er porta frå rissverk/js/util.js. Dei ligg her og
   ikkje der fordi dei to verktøya er sjølvstendige sider; ein dag bør
   dei begge hente frå ei felles fil i rot-js/, men det er ei rydding
   som fortener sin eigen gjennomgang.

   Kontrastrekninga er derimot ny, og ho er ikkje pynt: ein QR-kode med
   for lite skilnad mellom modul og bakgrunn ser fin ut på skjermen og
   let seg ikkje lese på papir.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.util = (function () {
  'use strict';

  /* ──────────────── DOM ──────────────── */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function capturePointer(node, e) {
    try { node.setPointerCapture(e.pointerId); } catch (err) { /* ingen fangst å få */ }
  }

  function releasePointer(node, e) {
    try {
      if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
    } catch (err) { /* alt sleppt */ }
  }

  function debounce(fn, ms) {
    let t = 0;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  /* ──────────────── Tal ──────────────── */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* Tre desimalar er nok i ei path-streng der eininga er ein modul.
     Fleire gjer berre SVG-fila større utan at nokon ser skilnaden. */
  function n(v) {
    const r = Math.round(v * 1000) / 1000;
    return String(r);
  }

  /* ──────────────── Fargar ──────────────── */

  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    let h = hex.trim();
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const p = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
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

  /* Les ein farge frå ei CSS-variabel i det aktive temaet. Verdien kan vere
     hex, rgb() eller eit namn, så vi går vegen om nettlesaren sin eigen
     omrekning i staden for å parse alle formene sjølve. */
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

  /* WCAG relativ luminans. */
  function luminance(hex) {
    const c = hexToRgb(hex);
    if (!c) return 0;
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  /* Kontrastforhold mellom to fargar, 1:1 til 21:1. */
  function contrast(a, b) {
    const la = luminance(a), lb = luminance(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* Svart eller kvit tekst oppå ein farge vi sjølve har valt.
     Trygt her, i motsetnad til --text-on-accent: fargen er ein fast hex
     brukaren har plukka, ikkje ein temavariabel som skiftar under føtene. */
  function textColorOn(hex) {
    return luminance(hex) > 0.42 ? '#111111' : '#ffffff';
  }

  /* ──────────────── Tekst og filer ──────────────── */

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function slug(text, fallback) {
    const s = String(text || '').trim().toLowerCase()
      .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return s || (fallback || 'vitjingsruta');
  }

  /* Talet på byte teksten tek i UTF-8 — det er den eininga QR-formatet
     reknar i, ikkje talet på teikn. «æ» er eitt teikn og to byte. */
  function byteLength(text) {
    return new TextEncoder().encode(String(text || '')).length;
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

  return {
    el, clear, capturePointer, releasePointer, debounce,
    clamp, n,
    hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, themeColor,
    luminance, contrast, textColorOn,
    escapeXml, slug, byteLength, downloadBlob
  };
})();
