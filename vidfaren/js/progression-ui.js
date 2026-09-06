/* ══════════════════════════════════════════════
   LANDKJENNING — Progresjon-UI: merkegalleri + toast
   Mønster lånt frå heimsank/js/progression-ui.js.
   ══════════════════════════════════════════════ */

const ProgressionUI = (function () {

  /* Kort melding — sjå Vy.toast() i js/vyrdepil-util.js. Låg tidlegare her i
     eiga utgåve; flytta til fellesmodulen så rettingar treffer alle verktøya,
     og fordi den gamle stilen fylte flata med --accent og fall under
     AA-kravet i dei sju mørke temaa (AGENTS.md §3.2). */
  function toast(msg, icon, kind) {
    return Vy.toast(msg, { icon: icon, kind: kind });
  }

  function announceBadges(earned) {
    (earned || []).forEach(b => toast('Nytt merke: ' + b.name, b.ico, 'badge'));
  }

  /** Evaluer merke og vis toast for nye. Trygg å kalle ofte. */
  function evaluateAndAnnounce() {
    announceBadges(Progression.evaluate());
  }

  // ---- Merkegalleri ----
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
      medal.innerHTML = ICON(b.ico, 28);
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

    const count = document.getElementById('badgeCount');
    if (count) {
      const earned = Progression.BADGES.filter(b => Progression.hasBadge(b.id)).length;
      count.textContent = `${earned} / ${Progression.BADGES.length}`;
    }
  }

  function openBadgeGallery() {
    renderBadgeGallery();
    document.getElementById('badgeModal').classList.add('open');
  }
  function closeBadgeGallery() {
    document.getElementById('badgeModal').classList.remove('open');
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const m = document.getElementById('badgeModal');
      if (m && m.classList.contains('open')) closeBadgeGallery();
    }
  });

  return {
    toast, announceBadges, evaluateAndAnnounce,
    renderBadgeGallery, openBadgeGallery, closeBadgeGallery
  };
})();

if (typeof window !== 'undefined') {
  window.ProgressionUI = ProgressionUI;
  window.openBadgeGallery = ProgressionUI.openBadgeGallery;
  window.closeBadgeGallery = ProgressionUI.closeBadgeGallery;
}
