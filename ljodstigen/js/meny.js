/* ══════════════════════════════════════════════
   MENY.JS — Startskjermen

   Profilval, modusval, skogen, merka og læraroversikta.

   Heile denne skjermen skal kunne brukast med lyden av. Eit klasserom
   har ikkje alltid hovudtelefonar til alle, og ein elev som ikkje finn
   fram i menyen utan lyd kjem aldri til oppgåvene.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const R = function () { return LjodRender; };
  let current = null;   // vald profil

  function $(id) { return document.getElementById(id); }

  /* ──────────────── Profilar ──────────────── */

  function avatarButton(av, selected) {
    const b = R().h('button', 'ljod-avatar' + (selected ? ' is-active' : ''));
    b.type = 'button';
    b.dataset.avatar = av.id;
    b.dataset.tone = av.tone;
    b.appendChild(LjodShapes.avatar(av.shape, 56));
    b.appendChild(R().h('span', 'ljod-avatar-name', av.name));
    b.setAttribute('aria-label', 'Figuren ' + av.name);
    return b;
  }

  function renderProfiles() {
    const host = $('profiles');
    if (!host) return;
    R().clear(host);
    const s = LjodState.read();

    s.profiles.forEach(function (p) {
      const av = LjodState.avatarOf(p.avatar);
      const st = LjodAdaptive.stats(p.adaptive);
      const card = R().h('div', 'ljod-profile' + (current && current.id === p.id ? ' is-active' : ''));
      card.dataset.tone = av.tone;

      const pick = R().h('button', 'ljod-profile-pick');
      pick.type = 'button';
      pick.appendChild(LjodShapes.avatar(av.shape, 56));
      pick.appendChild(R().h('span', 'ljod-profile-name', av.name));
      pick.appendChild(R().h('span', 'ljod-profile-sum', st.planted + ' av ' + st.total + ' bokstavar'));
      pick.setAttribute('aria-label', 'Vel ' + av.name + ', ' + st.planted + ' av ' + st.total + ' bokstavar');
      pick.addEventListener('click', function () { select(p.id); });
      card.appendChild(pick);

      const del = R().h('button', 'ljod-profile-del');
      del.type = 'button';
      del.textContent = 'Slett';
      del.setAttribute('aria-label', 'Slett ' + av.name);
      del.addEventListener('click', function () {
        if (!confirm('Slette ' + av.name + ' og alt som er lagra?')) return;
        LjodState.deleteProfile(p.id);
        if (current && current.id === p.id) current = null;
        refresh();
      });
      card.appendChild(del);

      host.appendChild(card);
    });

    /* Ledige figurar å opprette. */
    const taken = s.profiles.map(function (p) { return p.avatar; });
    const free = LjodState.AVATARS.filter(function (a) { return taken.indexOf(a.id) === -1; });
    if (free.length) {
      const add = R().h('div', 'ljod-newprofile');
      add.appendChild(R().h('p', 'ljod-hint', 'Vel ein figur for å byrje:'));
      const row = R().h('div', 'ljod-avatar-row');
      free.forEach(function (av) {
        const b = avatarButton(av, false);
        b.addEventListener('click', function () {
          const p = LjodState.createProfile(av.id);
          select(p.id);
        });
        row.appendChild(b);
      });
      add.appendChild(row);
      host.appendChild(add);
    }
  }

  function select(id) {
    current = LjodState.getProfile(id);
    const s = LjodState.read();
    s.lastProfile = id;
    LjodState.write(s);
    refresh();
    const panel = $('player');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ──────────────── Modusar ──────────────── */

  function renderModes() {
    const host = $('modes');
    if (!host) return;
    R().clear(host);
    if (!current) return;

    const allOpen = LjodState.read().allModes;
    const open = allOpen
      ? LjodAdaptive.MODES.map(function (m) { return m.id; })
      : LjodAdaptive.unlockedModes(current.adaptive).map(function (m) { return m.id; });
    const suggested = LjodAdaptive.suggestMode(current.adaptive);
    /* Kva som er opna av eleven sjølv, uavhengig av brytaren. Ein modus
       som berre er open fordi alt er opna skal ikkje sjå ut som noko
       eleven har fortent. */
    const earned = LjodAdaptive.unlockedModes(current.adaptive).map(function (m) { return m.id; });

    LjodAdaptive.MODES.forEach(function (m) {
      const def = window['LjodMode_' + m.id];
      const unlocked = open.indexOf(m.id) !== -1;

      const card = R().h(unlocked ? 'a' : 'div', 'ljod-mode' + (unlocked ? '' : ' is-locked'));
      if (unlocked) {
        card.href = 'spel.html?p=' + encodeURIComponent(current.id) + '&m=' + encodeURIComponent(m.id);
      }
      card.appendChild(R().h('span', 'ljod-mode-title', m.label));
      card.appendChild(R().h('span', 'ljod-mode-blurb', def ? def.blurb : ''));

      if (unlocked && earned.indexOf(m.id) === -1) {
        card.appendChild(R().h('span', 'ljod-mode-flag ljod-flag-open', 'Opna av lærar'));
      } else if (unlocked && m.id === suggested) {
        /* Appen foreslår, eleven vel. Forslaget er ei brikke, ikkje ein
           låst veg — autonomi er halve motivasjonen på dette trinnet. */
        card.appendChild(R().h('span', 'ljod-mode-flag', 'Framlegg'));
      }
      if (!unlocked) {
        card.appendChild(R().h('span', 'ljod-mode-flag', 'Opnar seg snart'));
        card.setAttribute('aria-disabled', 'true');
      }
      host.appendChild(card);
    });
  }

  /* ──────────────── Panel ──────────────── */

  function refresh() {
    renderProfiles();
    const panel = $('player');
    if (!panel) return;

    if (!current) { panel.hidden = true; return; }
    panel.hidden = false;

    const av = LjodState.avatarOf(current.avatar);
    const title = $('playerName');
    if (title) title.textContent = av.name;

    renderModes();
    LjodSkog.renderStars($('stars'), current);
    LjodSkog.renderSkog($('garden'), current);
    LjodSkog.renderBadges($('badges'), current);
    LjodLaerar.render($('laerar'), current);
  }

  /* ──────────────── Fontveljar ──────────────── */

  /* Ligg ved sida av temaveljaren i ånda: eit val som høyrer heime i ein
     app for dei som strevar med lesing, ikkje gøymd i ei innstilling. */
  function wireFont() {
    const host = $('fontpick');
    if (!host) return;
    const s = LjodState.read();
    document.body.dataset.font = s.font;

    LjodState.FONTS.forEach(function (f) {
      const b = R().h('button', 'btn ljod-fontbtn' + (s.font === f.id ? ' active' : ''));
      b.type = 'button';
      b.textContent = f.label;
      b.addEventListener('click', function () {
        const st = LjodState.read();
        st.font = f.id;
        LjodState.write(st);
        document.body.dataset.font = f.id;
        Array.prototype.forEach.call(host.children, function (c) { c.classList.remove('active'); });
        b.classList.add('active');
      });
      host.appendChild(b);
    });
  }

  /* ──────────────── Faner ──────────────── */

  function wireTabs() {
    const tabs = document.querySelectorAll('[data-tab]');
    const panes = document.querySelectorAll('[data-pane]');
    if (!tabs.length) return;
    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (x) {
          x.classList.toggle('active', x === t);
          x.setAttribute('aria-selected', x === t ? 'true' : 'false');
        });
        Array.prototype.forEach.call(panes, function (p) {
          p.hidden = p.dataset.pane !== t.dataset.tab;
        });
      });
    });
  }

  /* ──────────────── Stemmeveljar ──────────────── */

  /* Same stad og same form som fontveljaren. Er det berre éi stemme
     innspelt, viser vi ingenting — eit val med eitt alternativ er ikkje
     eit val, berre støy på ei side lærarar skal finne fram på. */
  function wireVoice() {
    const host = $('voicepick');
    if (!host) return;
    LjodAudio.voices().then(function (reg) {
      if (!reg || !Array.isArray(reg.voices) || reg.voices.length < 2) {
        const wrap = host.closest('[data-voice-section]');
        if (wrap) wrap.hidden = true;
        return;
      }
      const chosen = LjodState.read().voice || reg.default;
      reg.voices.forEach(function (v) {
        const b = R().h('button', 'btn ljod-fontbtn' + (chosen === v.id ? ' active' : ''));
        b.type = 'button';
        b.textContent = v.name || v.id;
        if (v.note) b.title = v.note;
        b.addEventListener('click', function () {
          const st = LjodState.read();
          st.voice = v.id;
          LjodState.write(st);
          Array.prototype.forEach.call(host.children, function (c) { c.classList.remove('active'); });
          b.classList.add('active');
        });
        host.appendChild(b);
      });
    });
  }

  /* ──────────────── Opne alle modusane ──────────────── */

  function wireAllModes() {
    const host = $('allmodes');
    if (!host) return;
    const box = R().h('input');
    box.type = 'checkbox';
    box.id = 'allModesBox';
    box.checked = LjodState.read().allModes;
    box.addEventListener('change', function () {
      const s = LjodState.read();
      s.allModes = box.checked;
      LjodState.write(s);
      refresh();
    });
    const lab = R().h('label', 'ljod-check');
    lab.htmlFor = 'allModesBox';
    lab.appendChild(box);
    lab.appendChild(R().h('span', null, 'Opne alle modusane'));
    host.appendChild(lab);
  }

  function init() {
    wireFont();
    wireVoice();
    wireAllModes();
    wireTabs();
    const s = LjodState.read();
    if (s.lastProfile) current = LjodState.getProfile(s.lastProfile);
    refresh();

    const print = document.getElementById('printLaerar');
    if (print) print.addEventListener('click', function () { window.print(); });
  }

  root.LjodMeny = { init: init, refresh: refresh };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
