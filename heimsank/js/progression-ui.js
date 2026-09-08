// Heimsank - Progression UI: poeng-display, kategori-forsider, opplåsing,
// merke-galleri og toast-varsel. Brukar Progression + CardData + icons.

const ProgressionUI = (function () {

  function coverBg(rarity) {
    return rarity === 'sjeldgjevt' ? '#87CEEB'
      : rarity === 'segngjeten' ? '#C4A1FF'
      : rarity === 'gudebore' ? '#FFDB58'
      : '#f0f0f0';
  }

  // ---- Poeng-display ----
  function renderPoints() {
    const el = document.getElementById('pointsValue');
    if (el) el.textContent = Progression.getPoints();
  }

  // ---- Kontekst for merke-evaluering (kolleksjons-avhengig, async) ----
  // Lastar kort-data berre for fulle samlingar (cacha) for å avgjere
  // «fullt hus» av ein sjeldsemd / foil. Sjeldsemd ligg ikkje i lagra entry.
  async function computeCtx() {
    const cats = S.cats || [];
    const unlockedCount = cats.filter(c => Progression.isUnlocked(c.id)).length;
    let cols = {};
    try { cols = VyrdepilStorage.getAllCollections('heimsank') || {}; } catch (e) { /* best effort */ }

    let fullCategories = 0;
    const fullRarity = { vanleg: false, sjeldgjevt: false, segngjeten: false, gudebore: false };
    let fullFoil = false;

    await Promise.all(cats.map(async cat => {
      const entries = Array.isArray(cols[cat.id]) ? cols[cat.id] : [];
      if (entries.length < 6) return;
      fullCategories++;
      if (entries.every(e => e.foil === true)) fullFoil = true;
      let cards;
      try { cards = await CardData.loadCategoryCards(cat); } catch (e) { return; }
      const byId = {};
      cards.forEach(c => { byId[c.id] = c; });
      const rarities = entries.map(e => (byId[e.cardId] ? byId[e.cardId].rarity : null));
      ['vanleg', 'sjeldgjevt', 'segngjeten', 'gudebore'].forEach(r => {
        if (rarities.length === 6 && rarities.every(x => x === r)) fullRarity[r] = true;
      });
    }));

    return { unlockedCount, fullCategories, totalCats: cats.length, fullRarity, fullFoil };
  }

  // Bygg kontekst, evaluer merke og vis toast for nye. Trygg å kalle ofte.
  function evaluateAndAnnounce() {
    return computeCtx()
      .then(ctx => announceBadges(Progression.evaluate(ctx)))
      .catch(() => {});
  }

  // ---- Kategori-val (opne kategoriar) ----
  function selectCategory(cat, cardEl) {
    S.selCat = cat;
    document.querySelectorAll('#catsGrid .cat-card').forEach(x => x.classList.remove('selected'));
    cardEl.classList.add('selected');
    const start = document.getElementById('startBtn');
    if (start) start.disabled = false;
  }

  // ---- Forsider ----
  function renderCovers(cats) {
    const grid = document.getElementById('catsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    cats.forEach(cat => {
      const unlocked = Progression.isUnlocked(cat.id);
      const card = document.createElement('div');
      card.className = 'cat-card' + (unlocked ? '' : ' locked');

      const cover = document.createElement('div');
      cover.className = 'cat-cover';
      card.appendChild(cover);

      const name = document.createElement('span');
      name.className = 'cat-name';
      name.textContent = cat.label;
      card.appendChild(name);

      if (unlocked) {
        // Plassholdar medan kort-data lastar
        cover.innerHTML = `<div class="cover-loading">${ICON('loader', 22)}</div>`;
        CardData.loadCategoryCards(cat).then(cards => {
          const pick = CardData.pickCoverCard(cards);
          renderCoverCard(cover, pick, cat);
        }).catch(() => {
          cover.innerHTML = `<div class="cover-fallback">${CAT_ICON(cat.icon, 28)}</div>`;
        });

        card.addEventListener('click', () => selectCategory(cat, card));
        // Behald markering om denne alt er vald
        if (S.selCat && S.selCat.id === cat.id) card.classList.add('selected');
      } else {
        renderCoverBack(cover);
        const cost = Progression.getCost(cat);
        const btn = document.createElement('button');
        const afford = Progression.canAfford(cat);
        btn.className = 'cat-unlock-btn' + (afford ? ' affordable' : '');
        btn.setAttribute('aria-label', `Lås opp ${cat.label} for ${cost} poeng`);
        btn.innerHTML = `${ICON('lock', 13)}<span>Lås opp · ${cost}</span>`;
        btn.addEventListener('click', (e) => handleUnlock(cat, e));
        card.appendChild(btn);
      }

      grid.appendChild(card);
    });
  }

  function renderCoverCard(cover, pick, cat) {
    cover.innerHTML = '';
    if (!pick) {
      cover.innerHTML = `<div class="cover-fallback">${CAT_ICON(cat.icon, 28)}</div>`;
      return;
    }
    const mini = document.createElement('div');
    mini.className = `cover-card ${pick.rarity}`;
    const imgWrap = document.createElement('div');
    imgWrap.className = 'cover-img';
    imgWrap.style.background = coverBg(pick.rarity);
    const img = document.createElement('img');
    img.src = pick.img;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function () {
      this.parentNode.innerHTML = `<div class="cover-fallback">${CAT_ICON(cat.icon, 28)}</div>`;
    };
    imgWrap.appendChild(img);
    mini.appendChild(imgWrap);
    cover.appendChild(mini);
  }

  function renderCoverBack(cover) {
    cover.innerHTML = '';
    const back = document.createElement('div');
    back.className = 'cover-back';
    const img = document.createElement('img');
    img.src = 'Logo - no text.png';
    img.alt = '';
    back.appendChild(img);
    cover.appendChild(back);
    const lock = document.createElement('div');
    lock.className = 'cover-lock';
    lock.innerHTML = ICON('lock', 20);
    cover.appendChild(lock);
  }

  // ---- Opplåsing ----
  function handleUnlock(cat, ev) {
    if (ev) ev.stopPropagation();
    if (Progression.isUnlocked(cat.id)) return;
    if (!Progression.canAfford(cat)) {
      const need = Progression.getCost(cat) - Progression.getPoints();
      toast(`Du treng ${need} poeng til for ${cat.label}.`, 'lock', 'warn');
      return;
    }
    Progression.unlock(cat);
    renderPoints();
    renderCovers(S.cats);
    toast(`${cat.label} er låst opp!`, 'key', 'good');
    evaluateAndAnnounce();
  }

  // ---- Merke ----
  function announceBadges(earned) {
    (earned || []).forEach(b => toast(`Nytt merke: ${b.name}`, b.ico, 'badge'));
  }

  function renderBadgeGallery() {
    const grid = document.getElementById('badgeGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Progression.BADGES.forEach(b => {
      const earned = Progression.hasBadge(b.id);
      const cell = document.createElement('div');
      cell.className = `bdg ${b.color}` + (earned ? '' : ' is-locked');

      const medal = document.createElement('div');
      medal.className = 'bdg-medal';
      medal.innerHTML = ICON(b.ico, 30);
      cell.appendChild(medal);

      const name = document.createElement('div');
      name.className = 'bdg-name';
      name.textContent = b.name;
      cell.appendChild(name);

      const hint = document.createElement('div');
      hint.className = 'bdg-hint';
      hint.textContent = b.hint;
      cell.appendChild(hint);

      if (!earned) {
        const lock = document.createElement('div');
        lock.className = 'bdg-lock';
        lock.innerHTML = ICON('lock', 12);
        cell.appendChild(lock);
      }
      grid.appendChild(cell);
    });
  }

  function openBadgeGallery() {
    renderBadgeGallery();
    document.getElementById('badgeModal').classList.add('open');
  }
  function closeBadgeGallery() {
    document.getElementById('badgeModal').classList.remove('open');
  }

  /* Kort melding — sjå Vy.toast() i js/vyrdepil-util.js. Låg tidlegare her i
     eiga utgåve; flytta til fellesmodulen så rettingar treffer alle verktøya,
     og fordi den gamle stilen fylte flata med --accent og fall under
     AA-kravet i dei sju mørke temaa (AGENTS.md §3.2). */
  function toast(msg, icon, kind) {
    return Vy.toast(msg, { icon: icon, kind: kind });
  }

  // ---- Etter ein kort-vinst (kalla frå main.js afterReveal) ----
  // Deler poeng-tildeling (synkront) frå merke-evaluering (async, via
  // evaluateAndAnnounce etter at samlinga er oppdatert).
  function awardCardPoints(card, foil) {
    const pts = Progression.grantCard(card.rarity, foil);
    renderPoints();
    return pts;
  }

  // Escape lukkar merke-galleriet
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const m = document.getElementById('badgeModal');
      if (m && m.classList.contains('open')) closeBadgeGallery();
    }
  });

  return {
    renderPoints, renderCovers, renderBadgeGallery,
    openBadgeGallery, closeBadgeGallery,
    handleUnlock, toast, announceBadges,
    awardCardPoints, evaluateAndAnnounce
  };
})();

if (typeof window !== 'undefined') {
  window.ProgressionUI = ProgressionUI;
  window.openBadgeGallery = ProgressionUI.openBadgeGallery;
  window.closeBadgeGallery = ProgressionUI.closeBadgeGallery;
}
