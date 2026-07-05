/* Livslina — ui-home.js
 * Heimeskjermen: diorama/figur, statspanel og livslinja (tidslinje).
 */
window.LL = window.LL || {};

LL.uiHome = (function () {
  'use strict';

  function render() {
    const s = LL.state.get();
    s.age = LL.state.currentRound() ? LL.state.currentRound().age : s.age;
    renderTimeline();
    renderFigure(s);
    renderStats(s);
    renderHeader(s);
    renderDiorama(s);
    renderPurchases(s);
    LL.util.hydrate(document.getElementById('screen-home'));
    check18(s);
  }

  function renderDiorama(s) {
    document.getElementById('homeDiorama').innerHTML = LL.artDiorama.svg(s);
  }

  function renderHeader(s) {
    const r = LL.state.currentRound();
    document.getElementById('homeRoundLabel').textContent = r ? r.label : '';
    document.getElementById('homeProgram').textContent =
      s.program.name + ' · ' + (s.housing === 'hybel' ? 'bur på hybel' : 'bur heime');
    const btn = document.getElementById('btnPlan');
    if (r && r.kind === 'summer') {
      btn.innerHTML = 'Sommaren <span data-icon="sun"></span>';
    } else {
      btn.innerHTML = 'Planlegg halvåret <span data-icon="arrowRight"></span>';
    }
    LL.util.hydrate(btn);
  }

  function renderFigure(s) {
    const fig = document.getElementById('homeFigure');
    // Diorama kjem i M5; for no viser vi figuren på plate.
    fig.innerHTML = LL.artDoll.svg(s.character, { ariaLabel: 'Figuren din', withPlate: true });
  }

  function renderStats(s) {
    const wrap = document.getElementById('homeStats');
    const st = s.stats;
    wrap.textContent = '';
    wrap.appendChild(statMoney('Konto', st.money, 'coins'));
    wrap.appendChild(statMoney(st.savingsIsBsu ? 'BSU' : 'Sparing', st.savings, 'gem'));
    wrap.appendChild(statMeter('Trivsel', st.wellbeing, 'heart'));
    wrap.appendChild(statMeter('Energi', st.energy, 'zap'));
    wrap.appendChild(statPlain('Karaktersnitt', st.grades.toFixed(1), 'award'));
  }

  function statMoney(label, val, iconName) {
    const box = document.createElement('div');
    box.className = 'll-stat';
    const l = document.createElement('div'); l.className = 'll-stat-lbl';
    l.innerHTML = '<span data-icon="' + iconName + '" data-icon-size="15"></span>' + label;
    const v = document.createElement('div'); v.className = 'll-stat-val';
    if (val < 0) v.classList.add('neg');
    v.textContent = LL.util.kr(val);
    box.append(l, v);
    return box;
  }

  function statPlain(label, val, iconName) {
    const box = document.createElement('div');
    box.className = 'll-stat';
    const l = document.createElement('div'); l.className = 'll-stat-lbl';
    l.innerHTML = '<span data-icon="' + iconName + '" data-icon-size="15"></span>' + label;
    const v = document.createElement('div'); v.className = 'll-stat-val'; v.textContent = val;
    box.append(l, v);
    return box;
  }

  function statMeter(label, val, iconName) {
    const box = document.createElement('div');
    box.className = 'll-stat';
    const l = document.createElement('div'); l.className = 'll-stat-lbl';
    l.innerHTML = '<span data-icon="' + iconName + '" data-icon-size="15"></span>' + label;
    const v = document.createElement('div'); v.className = 'll-stat-val'; v.textContent = Math.round(val);
    const m = document.createElement('div'); m.className = 'll-meter';
    const f = document.createElement('div'); f.className = 'll-meter-fill';
    if (val < 35) f.classList.add('warn');
    f.style.width = LL.util.clamp(val, 0, 100) + '%';
    m.appendChild(f);
    box.append(l, v, m);
    return box;
  }

  function renderTimeline() {
    const wrap = document.getElementById('homeTimeline');
    wrap.textContent = '';
    const rounds = LL.state.rounds();
    const idx = LL.state.get().roundIndex;
    rounds.forEach((r, i) => {
      const node = document.createElement('div');
      node.className = 'll-tl-node' + (r.kind === 'summer' ? ' summer' : '') +
        (i < idx ? ' done' : '') + (i === idx ? ' current' : '');
      const dot = document.createElement('div');
      dot.className = 'll-tl-dot';
      dot.innerHTML = '<span data-icon="' + (r.kind === 'summer' ? 'sun' : 'book') + '" data-icon-size="16"></span>';
      const lbl = document.createElement('div');
      lbl.className = 'll-tl-label';
      lbl.textContent = r.short;
      node.append(dot, lbl);
      wrap.appendChild(node);
    });
  }

  // ── Innkjøp / oppgraderingar ──
  function renderPurchases(s) {
    const wrap = document.getElementById('homePurchases');
    wrap.textContent = '';
    const items = [];

    if (s.possessions.bed !== 'seng') {
      const u = LL.data.node('upgrades.bed');
      items.push({ label: u.label, cost: u.gameValue, note: u.note,
        buy: () => { s.possessions.bed = 'seng'; s.stats.wellbeing = LL.util.clamp(s.stats.wellbeing + u.wellbeing, 0, 100); } });
    }
    if (s.possessions.desk !== 'gaming') {
      const u = LL.data.node('upgrades.gamingDesk');
      items.push({ label: u.label, cost: u.gameValue, note: u.note,
        buy: () => { s.possessions.desk = 'gaming'; s.stats.wellbeing = LL.util.clamp(s.stats.wellbeing + u.wellbeing, 0, 100); } });
    }
    if (!s.possessions.moped) {
      const bundle = LL.data.value('transport.usedMoped') + LL.data.value('transport.mopedLicenseCourse') + LL.data.value('transport.helmetAndGear');
      items.push({ label: 'Moped (med førarbevis og utstyr)', cost: bundle,
        note: 'Fridom og +trivsel, men forsikring og bensin kvar månad — og du slepp kollektivkortet.',
        special: 'moped' });
    }
    if (s.age >= 18 && !s.flags.hasLicense) {
      const c = LL.data.value('transport.driversLicenseB');
      items.push({ label: 'Førarkort klasse B', cost: c,
        note: 'Ein stor kostnad no — men opnar for bil i seinare livsfasar.',
        buy: () => { s.flags.hasLicense = true; s.stats.wellbeing = LL.util.clamp(s.stats.wellbeing + 4, 0, 100); } });
    }

    if (!items.length) {
      const p = document.createElement('p'); p.className = 'll-note';
      p.textContent = 'Ingenting å skaffe akkurat no.';
      wrap.appendChild(p);
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'll-purchase';
      const info = document.createElement('div');
      const h = document.createElement('strong'); h.textContent = item.label;
      const note = document.createElement('p'); note.className = 'll-note'; note.textContent = item.note || '';
      info.append(h, note);
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn';
      btn.textContent = LL.util.kr(item.cost);
      const affordable = s.stats.money >= item.cost;
      btn.disabled = !affordable;
      btn.addEventListener('click', () => {
        if (item.special === 'moped') { openMopedModal(s); return; }
        s.stats.money -= item.cost;
        item.buy();
        LL.storage.saveActive(s);
        LL.main.toast(item.label + ' kjøpt.');
        render();
      });
      card.append(info, btn);
      wrap.appendChild(card);
    });
  }

  function openMopedModal(s) {
    const bundle = LL.data.value('transport.usedMoped') + LL.data.value('transport.mopedLicenseCourse') + LL.data.value('transport.helmetAndGear');
    const trimmed = bundle - 2000;
    document.getElementById('mopedBundle').textContent = LL.util.kr(bundle);
    document.getElementById('mopedTrimmed').textContent = LL.util.kr(trimmed);
    const legal = document.getElementById('mopedBuyLegal');
    const trim = document.getElementById('mopedBuyTrimmed');
    legal.disabled = s.stats.money < bundle;
    trim.disabled = s.stats.money < trimmed;
    legal.onclick = () => { buyMoped(s, bundle, false); };
    trim.onclick = () => { buyMoped(s, trimmed, true); };
    LL.main.openModal('mopedModal');
  }

  function buyMoped(s, cost, trimmedVar) {
    s.stats.money -= cost;
    s.possessions.moped = true;
    if (trimmedVar) s.possessions.mopedTrimmed = true;
    if (trimmedVar) s.flags.mopedTrimmed = true;
    s.stats.wellbeing = LL.util.clamp(s.stats.wellbeing + 8, 0, 100);
    LL.storage.saveActive(s);
    LL.main.closeModal('mopedModal');
    LL.main.toast('Moped kjøpt!');
    render();
  }

  // ── 18-årsdag ──
  function check18(s) {
    if (s.age >= 18 && !s.flags.birthday18) {
      s.flags.birthday18 = true;
      LL.storage.saveActive(s);
      LL.main.openModal('birthdayModal');
    }
  }

  function init() {
    document.getElementById('bsuYes').addEventListener('click', () => {
      const s = LL.state.get();
      s.stats.savingsIsBsu = true;
      LL.storage.saveActive(s);
      LL.main.closeModal('birthdayModal');
      LL.main.toast('Sparinga di er no BSU.');
      render();
    });
    document.getElementById('bsuNo').addEventListener('click', () => LL.main.closeModal('birthdayModal'));
    document.getElementById('btnPlan').addEventListener('click', () => {
      const r = LL.state.currentRound();
      if (!r) return;
      if (r.kind === 'summer') {
        if (LL.uiSummer && LL.uiSummer.open) LL.uiSummer.open();
        else LL.main.toast('Sommar-mellomspelet kjem snart.');
      } else {
        if (LL.uiBudget && LL.uiBudget.open) LL.uiBudget.open();
        else LL.main.toast('Budsjettkortet kjem snart.');
      }
    });
  }

  return { init, render };
})();
