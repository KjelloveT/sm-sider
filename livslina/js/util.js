/* Livslina — util.js. Små hjelparar delte av alle modular. */
window.LL = window.LL || {};

LL.util = (function () {
  'use strict';

  // Kroneformat: 4500 → "4 500 kr". Negative: "−1 200 kr".
  function kr(n) {
    const rounded = Math.round(n || 0);
    const abs = Math.abs(rounded).toLocaleString('nb-NO').replace(/ /g, ' ');
    return (rounded < 0 ? '−' : '') + abs + ' kr';
  }

  // Heiltal med tusenskilje utan "kr"
  function num(n) {
    return Math.round(n || 0).toLocaleString('nb-NO').replace(/ /g, ' ');
  }

  // Fyll data-icon under eit element (wrapper rundt global hydrateIcons)
  function hydrate(root) {
    if (typeof hydrateIcons === 'function') hydrateIcons(root || document);
  }

  // Ikon-markup direkte
  function icon(name, size) {
    return (typeof ICON === 'function') ? ICON(name, size || 18) : '';
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  return { kr, num, hydrate, icon, clamp };
})();
