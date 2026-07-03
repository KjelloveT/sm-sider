/* Klassekart — kompat-lag mot det felles ikon-settet (../js/vyrdepil-icons.js).
   Gamle Icons.html/create/inject blir kartlagt til ICON()/hydrateIcons(). */
const Icons = (() => {
  function html(name, size) { return ICON(name, size || 18); }
  function create(name, size) { const s = document.createElement('span'); s.innerHTML = ICON(name, size || 18); return s.firstChild; }
  function inject(root) { hydrateIcons(root); }
  return { html, create, inject };
})();
