/* Livslina — ui-budget.js
 * Budsjettkortet: planlegg halvåret (jobb, forbruksprofil, aktivitetar, sparing)
 * med live månadsoppstilling.
 */
window.LL = window.LL || {};

LL.uiBudget = (function () {
  'use strict';

  let draft = null;

  function open() {
    const state = LL.state.get();
    state.age = LL.state.currentRound().age;
    draft = state.plan ? Object.assign({}, state.plan) : LL.economy.defaultPlan();
    draft.activities = (draft.activities || []).slice();
    renderControls();
    recompute();
    LL.main.showScreen('screen-budget');
    LL.util.hydrate(document.getElementById('screen-budget'));
  }

  function renderControls() {
    // Jobb
    btnGroup('budgetJob', LL.economy.jobOptions().map(o => ({ val: o.hours, label: o.label })),
      draft.jobHours, v => { draft.jobHours = v; recompute(); });
    // Forbruksprofil
    btnGroup('budgetProfile', Object.keys(LL.economy.PROFILES).map(k => ({ val: k, label: LL.economy.PROFILES[k].label })),
      draft.profile, v => { draft.profile = v; recompute(); });
    // Sparing
    btnGroup('budgetSavings', LL.economy.savingsOptions().map(v => ({ val: v, label: v === 0 ? 'Ingen' : LL.util.kr(v) + '/mnd' })),
      draft.savings, v => { draft.savings = v; recompute(); });
    // Aktivitetar (fleirval)
    const wrap = document.getElementById('budgetActivities');
    wrap.textContent = '';
    LL.economy.activities().forEach(a => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = a.label + ' (' + LL.util.kr(a.monthly) + ')';
      const on = draft.activities.includes(a.id);
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', () => {
        const i = draft.activities.indexOf(a.id);
        if (i === -1) draft.activities.push(a.id); else draft.activities.splice(i, 1);
        b.setAttribute('aria-pressed', String(draft.activities.includes(a.id)));
        recompute();
      });
      wrap.appendChild(b);
    });
  }

  function btnGroup(id, opts, current, onPick) {
    const row = document.getElementById(id);
    row.textContent = '';
    opts.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = o.label;
      b.setAttribute('aria-pressed', String(o.val === current));
      b.addEventListener('click', () => {
        onPick(o.val);
        row.querySelectorAll('.btn').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
      });
      row.appendChild(b);
    });
  }

  function recompute() {
    const state = LL.state.get();
    const preview = Object.assign({}, state, { plan: draft, age: LL.state.currentRound().age });
    const b = LL.economy.monthlyBreakdown(preview);

    // Oppstilling
    const inc = document.getElementById('budgetIncome');
    const exp = document.getElementById('budgetExpense');
    inc.innerHTML = ''; exp.innerHTML = '';
    for (const k in b.income) inc.appendChild(row(LL.economy.label(k), b.income[k], false));
    for (const k in b.expense) exp.appendChild(row(LL.economy.label(k), b.expense[k], true));

    document.getElementById('budgetIncomeTotal').textContent = LL.util.kr(b.incomeTotal);
    document.getElementById('budgetExpenseTotal').textContent = LL.util.kr(b.expenseTotal);
    const net = document.getElementById('budgetNet');
    net.textContent = (b.net >= 0 ? '+' : '') + LL.util.kr(b.net) + '/mnd';
    net.className = 'll-stat-val' + (b.net < 0 ? ' neg' : '');

    const savLine = document.getElementById('budgetSavingsLine');
    savLine.textContent = b.savings > 0
      ? 'Sparetrekk: ' + LL.util.kr(b.savings) + '/mnd → sparekonto'
      : 'Ingen fast sparing denne perioden.';

    // Frikort-projeksjon
    const wageMonth = (b.income.wage || 0);
    const yearWage = (state._yearWage || 0) + wageMonth * (LL.state.currentRound().months || 6);
    const limit = LL.data.value('tax.taxFreeCardLimit');
    const warn = document.getElementById('budgetFrikort');
    if (wageMonth > 0) {
      warn.hidden = false;
      if (yearWage > limit) {
        warn.textContent = '⚠ Med denne jobbinga passerer du frikortgrensa (' + LL.util.kr(limit) + ') i år — då blir det trekt skatt på det overskytande.';
      } else {
        warn.textContent = 'Estimert årsløn: ' + LL.util.kr(yearWage) + ' — under frikortgrensa (' + LL.util.kr(limit) + '), så du slepp skatt.';
      }
    } else {
      warn.hidden = true;
    }
  }

  function row(label, val, isExpense) {
    const div = document.createElement('div');
    div.className = 'll-budget-row';
    const l = document.createElement('span'); l.textContent = label;
    const v = document.createElement('strong'); v.textContent = (isExpense ? '−' : '+') + LL.util.kr(val);
    div.append(l, v);
    return div;
  }

  function confirm() {
    const state = LL.state.get();
    state.plan = draft;
    if (draft.profile === 'noysam') state.noysamCount = (state.noysamCount || 0) + 1;
    // Hjørne-slot i dioramaet følgjer fritidsvalet
    if (draft.activities.includes('sport') || draft.activities.includes('gym')) state.possessions.hobby = 'trening';
    else if (draft.activities.includes('kultur')) state.possessions.hobby = 'gitar';
    else state.possessions.hobby = 'plante';
    LL.storage.saveActive(state);
    LL.uiPlayback.startTerm();
  }

  function init() {
    document.getElementById('budgetRun').addEventListener('click', confirm);
    document.getElementById('budgetBack').addEventListener('click', () => LL.main.enterHome());
  }

  return { init, open };
})();
