/* Tidvis — kompat-lag mot det felles ikon-settet (../js/vyrdepil-icons.js).
   Held TidvisIcons-API-et, men delegerer sjølve ikon-teikninga til ICON(). */
(function () {
  'use strict';

  function svg(name, opts) {
    opts = opts || {};
    return ICON(name, opts.size || '1em');
  }

  function el(name, opts) {
    const span = document.createElement('span');
    span.style.display = 'inline-flex';
    span.innerHTML = svg(name, opts);
    return span.firstChild;
  }

  window.TidvisIcons = {
    svg: svg,
    el: el,
    has: function (n) { return window.VyrdepilIcons ? VyrdepilIcons.has(n) : false; }
  };
})();
