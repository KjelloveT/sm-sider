/* Livslina — ui-summer.js
 * Sommar-mellomspel: vel sommarjobb, sjå løna, eitt sommar-hendingskort, vidare.
 */
window.LL = window.LL || {};

LL.uiSummer = (function () {
  'use strict';

  let weeks = 3;
  let ctx = null;

  function open() {
    const s = LL.state.get();
    s.age = LL.state.currentRound().age;
    weeks = 3;
    renderOptions();
    LL.main.showScreen('screen-summer');
    document.getElementById('summerRound').textContent = LL.state.currentRound().label;
    LL.util.hydrate(document.getElementById('screen-summer'));
  }

  function renderOptions() {
    const opts = LL.data.node('work.summerJob').weeksOptions;
    const row = document.getElementById('summerWeeks');
    row.textContent = '';
    opts.forEach(w => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn';
      b.textContent = w === 0 ? 'Fri heile sommaren' : w + ' veker jobb';
      b.setAttribute('aria-pressed', String(w === weeks));
      b.addEventListener('click', () => { weeks = w; renderOptions(); });
      row.appendChild(b);
    });
    updatePreview();
  }

  function updatePreview() {
    const s = LL.state.get();
    const hpw = LL.data.node('work.summerJob').hoursPerWeek;
    const wage = weeks * hpw * LL.economy.hourlyWage(s);
    const el = document.getElementById('summerPreview');
    if (weeks === 0) {
      el.textContent = 'Du tek fri og ladar batteria — god trivsel, men inga inntekt.';
    } else {
      el.textContent = 'Du tener om lag ' + LL.util.kr(wage) + ' (' + (weeks * hpw) + ' timar), men det kostar litt energi.';
    }
  }

  function run() {
    const s = LL.state.get();
    const hpw = LL.data.node('work.summerJob').hoursPerWeek;
    const wage = weeks * hpw * LL.economy.hourlyWage(s);
    const prevWage = s._yearWage || 0;

    ctx = { round: LL.state.currentRound(), income: {}, expense: {}, eventLog: [], wageThisTerm: 0 };

    if (wage > 0) {
      s.stats.money += wage;
      s._yearWage = prevWage + wage;
      s.stats.energy = LL.util.clamp(s.stats.energy - (weeks >= 6 ? 12 : 6), 0, 100);
      ctx.income.wage = wage;
    } else {
      s.stats.wellbeing = LL.util.clamp(s.stats.wellbeing + 6, 0, 100);
      s.stats.energy = LL.util.clamp(s.stats.energy + 10, 0, 100);
    }

    // Sommar-hending, deretter oppgjer
    LL.events.showSummerEvent(s, ctx, () => finishSummer(s, prevWage));
  }

  function finishSummer(s, prevWage) {
    // Skatt på sommarløn (inkl. ev. ekstravakter frå hendinga)
    const newWage = (s._yearWage || 0) - prevWage;
    const tax = LL.economy.taxOnWage(prevWage, newWage);
    if (tax > 0) {
      s.stats.money -= tax;
      if ((s._yearWage || 0) > LL.data.value('tax.taxFreeCardLimit')) s.flags.overFrikort = true;
    }

    // Ledger-innslag for kurvene i sluttrapporten
    s.ledger.push({
      round: ctx.round.id, month: ctx.round.label,
      income: (ctx.income.wage || 0), expense: tax, saved: 0, balance: s.stats.money
    });

    LL.sim.advance(s);
    LL.storage.saveActive(s);
    LL.main.enterHome();
    LL.main.toast('Sommaren er over — ' + LL.state.currentRound().label + ' ventar.');
  }

  function init() {
    const run0 = document.getElementById('summerRun');
    if (run0) run0.addEventListener('click', run);
  }

  return { init, open };
})();
