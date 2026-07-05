/* Livslina — sim.js
 * Halvårs-simulering. ui-playback tikkar gjennom månadene; events kan skyte inn
 * mellom månadene (M4). Held term-kontekst med akkumulerte summar.
 */
window.LL = window.LL || {};

LL.sim = (function () {
  'use strict';

  const MONTHS_H = ['August', 'September', 'Oktober', 'November', 'Desember', 'Januar'];
  const MONTHS_V = ['Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli'];

  function monthNames(round) {
    return round.id.endsWith('h') ? MONTHS_H : MONTHS_V;
  }

  // Start eit halvår: bruk utstyrsstipend, nullstill akkumulatorar.
  function beginTerm(state) {
    const round = LL.state.currentRound();
    const ctx = {
      round: round,
      monthNames: monthNames(round),
      months: [],
      income: {},          // akkumulert per kategori
      expense: {},
      startMoney: state.stats.money,
      startWellbeing: state.stats.wellbeing,
      startEnergy: state.stats.energy,
      wageThisTerm: 0,
      grant: 0,
      tax: 0,
      eventLog: []
    };

    // Utstyrsstipend ved skulestart (haust)
    if (round.equipmentGrant && state.program) {
      const amt = LL.data.equipmentGrant(state.program.equipmentGrantRate);
      state.stats.money += amt;
      ctx.grant = amt;
      addCat(ctx.income, 'grant', amt);
    }
    // Nytt skuleår → nullstill årsløn for frikort-berekning (haust)
    if (round.equipmentGrant) state._yearWage = 0;

    return ctx;
  }

  // Køyr éin månad: bruk økonomi, oppdater saldo/stat, logg ledger.
  function stepMonth(state, ctx, monthIdx) {
    const b = LL.economy.monthlyBreakdown(state);

    for (const k in b.income) addCat(ctx.income, k, b.income[k]);
    for (const k in b.expense) addCat(ctx.expense, k, b.expense[k]);

    state.stats.money += b.net;

    // Sparing: flytt frå konto til sparing (om det er dekning)
    let saved = 0;
    if (b.savings > 0) {
      saved = b.savings;
      state.stats.money -= saved;
      state.stats.savings += saved;
    }

    // Renter på sparing (månadleg del av årsrente)
    const rate = state.stats.savingsIsBsu
      ? LL.data.value('savings.bsu.interestRate', null) || bsuRate()
      : (LL.data.node('savings.savingsAccount').interestRate || 0.035);
    if (state.stats.savings > 0) state.stats.savings += state.stats.savings * (rate / 12);

    // Løn → årsakkumulator (for frikort/skatt) + totalsum for merke
    if (b.income.wage) {
      ctx.wageThisTerm += b.income.wage;
      state._yearWage = (state._yearWage || 0) + b.income.wage;
      state.totalWage = (state.totalWage || 0) + b.income.wage;
    }

    // Stat-drift per månad
    state.stats.wellbeing += b.wellbeingPerMonth;
    state.stats.energy += b.energyPerMonth;
    if (state.stats.money < 0) { state.stats.wellbeing -= 2; state.wentNegative = true; } // pengestress
    clampStats(state);
    state.minWellbeing = Math.min(state.minWellbeing, state.stats.wellbeing);
    state.minEnergy = Math.min(state.minEnergy, state.stats.energy);

    const entry = {
      round: ctx.round.id,
      month: ctx.monthNames[monthIdx] || ('Månad ' + (monthIdx + 1)),
      income: b.incomeTotal,
      expense: b.expenseTotal,
      saved: saved,
      balance: state.stats.money,
      wellbeing: Math.round(state.stats.wellbeing),
      networth: Math.round(state.stats.money + state.stats.savings)
    };
    ctx.months.push(entry);
    state.ledger.push(entry);
    return entry;
  }

  function bsuRate() { return 0.06; }

  // Avslutt halvåret: skatt, karakterdrift, klamping, samandrag.
  function endTerm(state, ctx) {
    // Skatt på løn opptent i skuleåret
    const prev = (state._yearWage || 0) - ctx.wageThisTerm;
    const tax = LL.economy.taxOnWage(prev, ctx.wageThisTerm);
    if (tax > 0) {
      state.stats.money -= tax;
      ctx.tax = tax;
      addCat(ctx.expense, 'tax', tax);
      // marker at spelaren tente over frikortet (for skatt-att-kortet)
      if ((state._yearWage || 0) > LL.data.value('tax.taxFreeCardLimit')) state.flags.overFrikort = true;
    }

    // Karakterdrift (per halvår)
    const plan = state.plan || {};
    const avgEnergy = state.stats.energy;
    let dg = 0;
    if (avgEnergy < 40) dg -= 0.3;
    if (plan.jobHours >= 12) dg -= 0.2;
    if (plan.jobHours === 0 && avgEnergy > 60) dg += 0.1;
    if (state.flags.mistaForarbevis) { /* fråvær-effekt kan leggjast til seinare */ }
    state.stats.grades += dg;
    clampStats(state);

    const summary = {
      round: ctx.round,
      income: ctx.income,
      expense: ctx.expense,
      incomeTotal: LL.economy.sum(ctx.income),
      expenseTotal: LL.economy.sum(ctx.expense),
      grant: ctx.grant,
      tax: ctx.tax,
      moneyChange: state.stats.money - ctx.startMoney,
      wellbeingChange: state.stats.wellbeing - ctx.startWellbeing,
      energyChange: state.stats.energy - ctx.startEnergy,
      gradeChange: dg,
      eventLog: ctx.eventLog,
      factoid: factoid(state, ctx)
    };
    return summary;
  }

  // Gå til neste runde. Returnerer true om spelet er ferdig.
  function advance(state) {
    state.roundIndex++;
    state.plan = null;
    if (state.roundIndex >= LL.state.rounds().length) {
      state.finished = true;
      return true;
    }
    return false;
  }

  function factoid(state, ctx) {
    const facts = [];
    if (ctx.grant) facts.push('Utstyrsstipendet på ' + LL.util.kr(ctx.grant) + ' er gratis pengar alle elevar med ungdomsrett får — hugs å søkje.');
    if (state.plan && state.plan.profile === 'noysam') facts.push('Nøysam profil sparar deg for tusenlappar i året — men trivselen kostar litt.');
    if (state.plan && state.plan.savings > 0) facts.push('Faste sparetrekk veks med renters rente over tid.');
    if (ctx.tax > 0) facts.push('Du tente over frikortgrensa (' + LL.util.kr(LL.data.value('tax.taxFreeCardLimit')) + '), så no blir det trekt skatt.');
    if (state.housing === 'hybel') facts.push('På hybel ber du sjølv husleige, mat og faste rekningar — difor er bortebuarstipendet så viktig.');
    if (!facts.length) facts.push('Små faste val kvar månad blir til store summar over tre år.');
    return facts[Math.floor(LL.state.rng() * facts.length)];
  }

  function addCat(obj, key, val) { obj[key] = (obj[key] || 0) + val; }

  function clampStats(state) {
    const s = state.stats;
    s.wellbeing = LL.util.clamp(s.wellbeing, 0, 100);
    s.energy = LL.util.clamp(s.energy, 0, 100);
    s.grades = LL.util.clamp(s.grades, 1, 6);
  }

  return { beginTerm, stepMonth, endTerm, advance, monthNames };
})();
