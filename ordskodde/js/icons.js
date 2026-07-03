/* Ordskodde — kompat-lag mot det felles ikon-settet (../js/vyrdepil-icons.js).
   Held OrdskoddeIcons-API-et, men delegerer sjølve ikon-teikninga til ICON().
   inject() set ikonet FRAMFOR eksisterande innhald (aldri innerHTML), so
   knappetekst blir bevart. */
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

  function inject(rootEl) {
    (rootEl || document).querySelectorAll('[data-icon]').forEach(node => {
      if (node.querySelector('svg')) return;
      node.insertBefore(el(node.dataset.icon, { size: node.dataset.iconSize || '1.1em' }), node.firstChild);
    });
  }

  window.OrdskoddeIcons = {
    svg, el, inject,
    has: n => (window.VyrdepilIcons ? VyrdepilIcons.has(n) : false)
  };
})();
