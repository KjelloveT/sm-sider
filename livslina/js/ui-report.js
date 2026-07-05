/* Livslina — ui-report.js
 * Halvårsoppgjer (M3) og — seinare — sluttrapport (M6).
 */
window.LL = window.LL || {};

LL.uiReport = (function () {
  'use strict';

  function showHalfyear(summary) {
    document.getElementById('hyRound').textContent = summary.round.label + ' — oppgjer';

    // Inntekter / utgifter
    fillList('hyIncome', summary.income, false);
    fillList('hyExpense', summary.expense, true);
    document.getElementById('hyIncomeTotal').textContent = LL.util.kr(summary.incomeTotal);
    document.getElementById('hyExpenseTotal').textContent = LL.util.kr(summary.expenseTotal);

    // Statendringar
    const grid = document.getElementById('hyStats');
    grid.textContent = '';
    grid.appendChild(deltaBox('Konto', summary.moneyChange, true));
    grid.appendChild(deltaBox('Trivsel', summary.wellbeingChange, false));
    grid.appendChild(deltaBox('Energi', summary.energyChange, false));
    grid.appendChild(deltaBox('Karakter', summary.gradeChange, false, 1));

    document.getElementById('hyFactoid').textContent = summary.factoid;

    LL.main.showScreen('screen-halfyear');
    LL.util.hydrate(document.getElementById('screen-halfyear'));
  }

  function fillList(id, obj, isExpense) {
    const wrap = document.getElementById(id);
    wrap.textContent = '';
    const keys = Object.keys(obj).sort((a, b) => obj[b] - obj[a]);
    if (!keys.length) {
      const d = document.createElement('div'); d.className = 'll-budget-row';
      d.textContent = '—'; wrap.appendChild(d); return;
    }
    keys.forEach(k => {
      const div = document.createElement('div');
      div.className = 'll-budget-row';
      const l = document.createElement('span'); l.textContent = LL.economy.label(k);
      const v = document.createElement('strong');
      v.textContent = (isExpense ? '−' : '+') + LL.util.kr(obj[k]);
      div.append(l, v);
      wrap.appendChild(div);
    });
  }

  function deltaBox(label, val, isMoney, decimals) {
    const box = document.createElement('div');
    box.className = 'll-stat';
    const l = document.createElement('div'); l.className = 'll-stat-lbl'; l.textContent = label;
    const v = document.createElement('div'); v.className = 'll-stat-val';
    const rounded = decimals ? val.toFixed(decimals) : Math.round(val);
    const num = isMoney ? LL.util.kr(val) : (val >= 0 ? '+' : '') + rounded;
    v.textContent = (isMoney && val >= 0 ? '+' : '') + num;
    if (val < 0) v.classList.add('neg');
    box.append(l, v);
    return box;
  }

  function continueAfterHalfyear() {
    // advance() er allereie gjort i finishTerm; her berre navigerer vi vidare.
    const state = LL.state.get();
    if (state.finished) {
      if (LL.uiReport.showFinal) LL.uiReport.showFinal();
      else { LL.main.toast('Fase 1 fullført! Sluttrapport kjem snart.'); LL.main.enterHome(); }
    } else {
      LL.main.enterHome();
    }
  }

  // ════════════ SLUTTRAPPORT ════════════

  const BADGES = [
    { id: 'buffer', icon: 'gem', label: 'Bufferbyggjar', desc: 'Minst 20 000 kr spart', test: s => s.stats.savings >= 20000 },
    { id: 'frikort', icon: 'coins', label: 'Frikortmeister', desc: 'Tente pengar utan å gå over frikortgrensa', test: s => (s.totalWage || 0) >= 30000 && !s.flags.overFrikort },
    { id: 'fagbrev', icon: 'award', label: 'Fagbrev-kurs', desc: 'Sikra ein god læreplass', test: s => s.program.type === 'yrkesfag' && s.flags.laereplassBra },
    { id: 'studieklar', icon: 'book', label: 'Studieklar', desc: 'Studieførebuande med snitt 4+', test: s => s.program.type === 'studieforberedande' && s.stats.grades >= 4 },
    { id: 'balanse', icon: 'heart', label: 'Balansekunstnar', desc: 'Trivsel og energi aldri under 40', test: s => s.minWellbeing >= 40 && s.minEnergy >= 40 },
    { id: 'noysemd', icon: 'shield', label: 'Nøysemd', desc: 'Nøysam profil i minst 4 halvår', test: s => (s.noysamCount || 0) >= 4 },
    { id: 'pluss', icon: 'sparkles', label: 'Alltid i pluss', desc: 'Kontoen var aldri i minus', test: s => !s.wentNegative },
    { id: 'formue', icon: 'trophy', label: 'God start', desc: 'Over 30 000 kr i formue til slutt', test: s => (s.stats.money + s.stats.savings) >= 30000 }
  ];

  function showFinal() {
    const s = LL.state.get();
    const networth = s.stats.money + s.stats.savings;

    // Nøkkeltal
    const grid = document.getElementById('finalStats');
    grid.textContent = '';
    grid.appendChild(bigStat('Formue til slutt', LL.util.kr(networth), networth < 0));
    grid.appendChild(bigStat('Utdanning', s.program.name, false, true));
    grid.appendChild(bigStat('Karaktersnitt', s.stats.grades.toFixed(1), false));
    grid.appendChild(bigStat('Trivsel', Math.round(s.stats.wellbeing) + '/100', false));

    // Figur + diorama
    document.getElementById('finalDiorama').innerHTML = LL.artDiorama.svg(s);

    // Kurver
    document.getElementById('finalChart').innerHTML = chartSVG(s.ledger);

    // Vidare veg
    document.getElementById('finalPath').textContent = pathForward(s);

    // Vendepunkt
    renderTurningPoints(s, networth);

    // Merke
    renderBadges(s);

    // Lagre fullført løp éin gong
    if (!s._runSaved) {
      s._runSaved = true;
      const earned = BADGES.filter(b => b.test(s)).map(b => b.id);
      s.badges = earned;
      LL.storage.saveCompletedRun({
        program: s.program.name, programType: s.program.type,
        networth: Math.round(networth), grades: +s.stats.grades.toFixed(1),
        wellbeing: Math.round(s.stats.wellbeing), badges: earned,
        housing: s.housing
      });
      LL.storage.saveActive(s);
    }

    LL.main.showScreen('screen-final');
    LL.util.hydrate(document.getElementById('screen-final'));
  }

  function bigStat(label, val, neg, small) {
    const box = document.createElement('div');
    box.className = 'll-stat';
    const l = document.createElement('div'); l.className = 'll-stat-lbl'; l.textContent = label;
    const v = document.createElement('div'); v.className = 'll-stat-val' + (neg ? ' neg' : '');
    if (small) v.style.fontSize = '1.05rem';
    v.textContent = val;
    box.append(l, v);
    return box;
  }

  function pathForward(s) {
    const p = s.program;
    if (p.type === 'yrkesfag') {
      if (s.flags.laereplassBra) return 'Du sikra ein god læreplass. Som lærling får du løn medan du jobbar mot fagbrev — vegen mot ' + p.careers[0].toLowerCase() + ' er godt i gang.';
      return 'Du søkjer læreplass for å ta fagbrev. Karaktersnittet (' + s.stats.grades.toFixed(1) + ') og innsatsen din avgjer kor lett det blir.';
    }
    if (s.stats.grades >= 4) return 'Med snittet ditt (' + s.stats.grades.toFixed(1) + ') står dei fleste studia opne. Neste livsfase blir studielån, deltidsjobb og eige husvære.';
    return 'Snittet ditt (' + s.stats.grades.toFixed(1) + ') avgrensar nokre studieval, men mange dører er framleis opne. Neste fase: studium eller arbeid.';
  }

  function renderTurningPoints(s, networth) {
    const wrap = document.getElementById('finalTurning');
    wrap.textContent = '';
    const top = s.decisions.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
    if (!top.length) {
      const p = document.createElement('p'); p.className = 'll-note';
      p.textContent = 'Ingen store enkelthendingar denne gongen — økonomien vart forma av dei jamne, små vala.';
      wrap.appendChild(p);
      return;
    }
    top.forEach(d => {
      const div = document.createElement('div');
      div.className = 'll-turning';
      const t = document.createElement('div');
      const h = document.createElement('strong'); h.textContent = d.label;
      const cf = document.createElement('p'); cf.className = 'll-note';
      cf.textContent = 'Utan dette: ' + LL.util.kr(networth - d.delta) + ' i formue.';
      t.append(h, cf);
      const v = document.createElement('strong');
      v.className = 'll-turning-delta' + (d.delta < 0 ? ' neg' : '');
      v.textContent = (d.delta >= 0 ? '+' : '') + LL.util.kr(d.delta);
      div.append(t, v);
      wrap.appendChild(div);
    });
  }

  function renderBadges(s) {
    const wrap = document.getElementById('finalBadges');
    wrap.textContent = '';
    BADGES.forEach(b => {
      const earned = b.test(s);
      const card = document.createElement('div');
      card.className = 'll-badge' + (earned ? ' earned' : '');
      card.innerHTML = '<span class="ll-badge-ico" data-icon="' + b.icon + '" data-icon-size="22"></span>';
      const t = document.createElement('div');
      const h = document.createElement('strong'); h.textContent = b.label;
      const d = document.createElement('p'); d.className = 'll-note'; d.textContent = b.desc;
      t.append(h, d);
      card.appendChild(t);
      wrap.appendChild(card);
    });
  }

  // Enkel SVG-linjegraf: formue (networth) over tid
  function chartSVG(ledger) {
    if (!ledger || ledger.length < 2) return '<p class="ll-note">For lite data til graf.</p>';
    const W = 480, H = 200, padL = 44, padR = 12, padT = 14, padB = 26;
    const vals = ledger.map(e => e.networth != null ? e.networth : e.balance);
    let min = Math.min(0, ...vals), max = Math.max(...vals);
    if (max === min) max = min + 1;
    const n = vals.length;
    const x = i => padL + (i / (n - 1)) * (W - padL - padR);
    const y = v => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

    let pts = vals.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
    // nullinje
    const zeroY = y(0);
    // fyll under kurva
    const area = `M ${x(0)},${zeroY} ` + vals.map((v, i) => 'L ' + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ') + ` L ${x(n - 1)},${zeroY} Z`;

    return `<svg class="ll-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Formuekurve gjennom vidaregåande">
      <line x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>
      <path d="${area}" fill="var(--accent5)" opacity="0.5"/>
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      <text x="${padL - 6}" y="${y(max)}" text-anchor="end" font-size="11" fill="var(--muted)" dominant-baseline="middle">${LL.util.num(max)}</text>
      <text x="${padL - 6}" y="${zeroY}" text-anchor="end" font-size="11" fill="var(--muted)" dominant-baseline="middle">0</text>
      <text x="${padL}" y="${H - 8}" font-size="11" fill="var(--muted)">VG1</text>
      <text x="${W - padR}" y="${H - 8}" text-anchor="end" font-size="11" fill="var(--muted)">VG3</text>
    </svg>`;
  }

  function newGame() {
    LL.storage.clearActive();
    LL.uiSetup.renderStart();
    LL.main.showScreen('screen-start');
  }

  function init() {
    document.getElementById('hyContinue').addEventListener('click', continueAfterHalfyear);
    const exp = document.getElementById('finalExport');
    if (exp) exp.addEventListener('click', () => LL.storage.exportSave(LL.state.get()));
    const again = document.getElementById('finalAgain');
    if (again) again.addEventListener('click', newGame);
  }

  return { init, showHalfyear, showFinal };
})();
