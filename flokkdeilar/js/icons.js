/* Flokkdeilar — kompat-lag mot det felles ikon-settet (../js/vyrdepil-icons.js).
   Gamle Icons.html/create/inject blir kartlagt til ICON()/hydrateIcons().
   randomGroupIcon er spelspesifikk og blir teken vare på. */
const Icons = (() => {
  function html(name, size) { return ICON(name, size || 18); }
  function create(name, size) { const s = document.createElement('span'); s.innerHTML = ICON(name, size || 18); return s.firstChild; }
  function inject(root) { hydrateIcons(root); }
  const GROUP_ICONS = ['star', 'zap', 'feather', 'sun', 'moon', 'cloud', 'flame', 'snowflake',
    'gem', 'anchor', 'fish', 'mountain', 'waves', 'droplets', 'diamond', 'shuffle'];
  function randomGroupIcon() { return GROUP_ICONS[Math.floor(Math.random() * GROUP_ICONS.length)]; }
  return { html, create, inject, randomGroupIcon };
})();
