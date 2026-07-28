/* ══════════════════════════════════════════════
   VYRDEPIL — Framsida byggjer spel/verktøy-grids
   frå json/apps.json (same kjelde som toppmenyen).
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Kor lenge «Nytt»- og «Oppdatert»-merket heng ved før det fell av av seg sjølv. */
  const BADGE_DAYS = 45;

  function svg(inner, size) {
    return `<svg width="${size}" height="${size}" style="vertical-align:-5px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  /** Talet på dagar sidan ein ISO-dato. Ugyldig dato tel som uendeleg lenge sidan. */
  function daysSince(iso) {
    const then = Date.parse(String(iso) + 'T00:00:00');
    if (isNaN(then)) return Infinity;
    return (Date.now() - then) / 86400000;
  }

  /** «Nytt» vinn over «Oppdatert». Kjem-snart-korta får ikkje merke. */
  function badgeFor(app) {
    if (app.disabled) return null;
    if (daysSince(app.added) <= BADGE_DAYS) return { text: 'Nytt', cls: 'card-flag card-flag-new' };
    if (daysSince(app.updated) <= BADGE_DAYS) return { text: 'Oppdatert', cls: 'card-flag card-flag-updated' };
    return null;
  }

  function card(app) {
    const el = document.createElement(app.disabled ? 'div' : 'a');
    el.className = 'card' + (app.disabled ? ' disabled' : '');
    if (!app.disabled && app.href) el.href = app.href;

    if (app.img) {
      const img = document.createElement('img');
      img.src = app.img;
      img.alt = app.name;
      el.appendChild(img);
    } else if (app.icon) {
      const span = document.createElement('span');
      span.className = 'card-icon';
      span.innerHTML = svg(app.icon, 48).replace(' style="vertical-align:-5px;"', '');
      el.appendChild(span);
    }

    const badge = badgeFor(app);
    if (badge) {
      const flag = document.createElement('span');
      flag.className = badge.cls;
      flag.textContent = badge.text;
      el.appendChild(flag);
    }

    const h = document.createElement('h2');
    h.className = 'card-title';
    h.textContent = app.name;
    el.appendChild(h);

    (app.desc || []).forEach(d => {
      const p = document.createElement('p');
      p.className = 'card-desc';
      p.textContent = d;
      el.appendChild(p);
    });

    const tag = document.createElement('span');
    if (app.disabled) {
      tag.className = 'coming-tag';
      tag.textContent = app.comingTag || 'Kjem snart';
    } else {
      tag.className = 'card-btn';
      tag.textContent = app.btn || 'Opne →';
    }
    el.appendChild(tag);
    return el;
  }

  fetch('json/apps.json')
    .then(r => r.json())
    .then(data => {
      const host = document.getElementById('appSections');
      if (!host) return;
      (data.categories || []).forEach(cat => {
        const apps = (data.apps || []).filter(a => a.cat === cat.id);
        if (!apps.length) return;
        const h2 = document.createElement('h2');
        h2.className = 'heading2';
        const ic = document.createElement('span');
        ic.innerHTML = svg(cat.icon, 28);
        h2.appendChild(ic);
        h2.appendChild(document.createTextNode(' ' + cat.label));
        host.appendChild(h2);
        const grid = document.createElement('div');
        grid.className = 'card-grid';
        apps.forEach(a => grid.appendChild(card(a)));
        host.appendChild(grid);
      });
    })
    .catch(e => console.error('Klarte ikkje laste json/apps.json:', e));
})();
