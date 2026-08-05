/* Flokkdeilar — kompat-lag mot det felles ikon-settet (../js/vyrdepil-icons.js).
   Gamle Icons.html/create/inject blir kartlagt til ICON()/hydrateIcons().
   Gruppeikona er spelspesifikke og blir tekne vare på. */
const Icons = (() => {
  function html(name, size) { return ICON(name, size || 18); }
  function create(name, size) { const s = document.createElement('span'); s.innerHTML = ICON(name, size || 18); return s.firstChild; }
  function inject(root) { hydrateIcons(root); }

  /* Lett kjennelege, tydeleg ulike motiv — store nok i tal til at kvar
     gruppe kan få sitt eige ikon sjølv i store klassar. */
  const GROUP_ICONS = [
    'star', 'zap', 'feather', 'sun', 'moon', 'cloud', 'flame', 'snowflake',
    'gem', 'anchor', 'fish', 'mountain', 'waves', 'droplets', 'diamond', 'heart',
    'leaf', 'flower2', 'treePine', 'treeDeciduous', 'rocket', 'crown', 'trophy', 'medal',
    'award', 'bird', 'owl', 'rabbit', 'apple', 'cake', 'candy', 'egg',
    'key', 'compass', 'globe', 'umbrella', 'sailboat', 'plane', 'tent', 'music',
    'palette', 'lightbulb', 'bolt', 'shell', 'sparkles', 'wheat', 'footprints', 'ticket',
    'gift', 'target', 'clock', 'hourglass', 'brain', 'book', 'backpack', 'coins',
    'flag', 'mapPin', 'iceCreamCone', 'partyPopper'
  ];

  function shuffled(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Returnerer `count` ikon som alle er ulike — og som heller ikkje kolliderer
     med ikona i `exclude` (t.d. låste grupper). Har vi fleire grupper enn ikon,
     startar vi ein ny runde med heile settet stokka på nytt. */
  function pickGroupIcons(count, exclude) {
    const used = new Set(exclude || []);
    const out = [];
    let pool = shuffled(GROUP_ICONS.filter(i => !used.has(i)));

    while (out.length < count) {
      if (pool.length === 0) pool = shuffled(GROUP_ICONS);
      out.push(pool.pop());
    }
    return out;
  }

  function randomGroupIcon() { return GROUP_ICONS[Math.floor(Math.random() * GROUP_ICONS.length)]; }

  return { html, create, inject, randomGroupIcon, pickGroupIcons, GROUP_ICONS };
})();
