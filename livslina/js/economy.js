/* Livslina — economy.js
 * Datadriven månadsberekning: inntekter, utgifter, skatt, sparing.
 * Alle kronebeløp kjem frå grunndata.json via LL.data.
 */
window.LL = window.LL || {};

LL.economy = (function () {
  'use strict';

  const WEEKS_PER_MONTH = 4.33;
  // Del av SIFO-posten «leik og mediebruk» som ein heimebuande ungdom faktisk
  // betaler sjølv (resten dekkjer foreldra). Realistisk speleforenkling.
  const HOME_PLAY_FACTOR = 0.4;

  // Forbruksprofilar (gjeld klede + leik/mediebruk)
  const PROFILES = {
    noysam: { label: 'Nøysam', mult: 0.7, wellbeingPerMonth: -1 },
    sifo:   { label: 'SIFO-nivå', mult: 1.0, wellbeingPerMonth: 0 },
    raus:   { label: 'Raus', mult: 1.4, wellbeingPerMonth: 1 }
  };

  // Fritidsaktivitetar (månadsutgift + trivsel/mnd)
  function activities() {
    return [
      { id: 'gym', label: 'Treningssenter', monthly: LL.data.value('leisure.gymYouthPerMonth'), wellbeing: 1.2, energy: 0.4 },
      { id: 'sport', label: 'Idrettslag', monthly: LL.data.value('leisure.sportsClubPerYear') / 12, wellbeing: 1.5, energy: 0.2 },
      { id: 'kultur', label: 'Kulturskule/korps', monthly: LL.data.value('leisure.cultureSchoolPerYear') / 12, wellbeing: 1.5, energy: -0.1 },
      { id: 'gaming', label: 'Gaming', monthly: LL.data.value('leisure.gamingPerMonth'), wellbeing: 1.0, energy: -0.3 }
    ];
  }

  function jobOptions() {
    return [
      { hours: 0, label: 'Ingen jobb' },
      { hours: 6, label: 'Laurdagsjobb (6 t/veke)' },
      { hours: 12, label: 'Mykje jobb (12 t/veke)' }
    ];
  }

  function savingsOptions() { return [0, 250, 500, 1000]; }

  function hourlyWage(state) {
    return state.age >= 18
      ? LL.data.value('work.hourlyWage18plus')
      : LL.data.value('work.hourlyWageUnder18');
  }

  // Aldersvariant for SIFO-postar
  function ageVariant(age) { return age >= 18 ? 'gameValue18plus' : 'gameValue14_17'; }

  function defaultPlan() {
    return { jobHours: 0, profile: 'sifo', activities: [], savings: 0 };
  }

  // Full månadsoppstilling gjeve state + plan. Returnerer breakdown-objekt.
  function monthlyBreakdown(state) {
    const plan = state.plan || defaultPlan();
    const age = state.age;
    const wageVar = ageVariant(age);
    const prof = PROFILES[plan.profile] || PROFILES.sifo;
    const hybel = state.housing === 'hybel';
    const f = state.family;

    const income = {};
    const expense = {};

    // ── Inntekter ──
    const wage = plan.jobHours * WEEKS_PER_MONTH * hourlyWage(state);
    if (wage > 0) income.wage = wage;

    if (hybel) {
      if (f.parentContributionHybelPerMonth) income.parents = f.parentContributionHybelPerMonth;
      income.housingGrant = LL.data.value('grants.housingGrantPerMonth');
    } else if (f.allowancePerMonth) {
      income.allowance = f.allowancePerMonth;
    }
    if (f.incomeDependentGrant && f.incomeDependentGrant !== 'none') {
      const g = LL.data.node('grants.incomeDependentGrantPerMonth');
      const rate = g ? (g[f.incomeDependentGrant] || g.rateFull) : 0;
      if (rate) income.studyGrant = rate;
    }

    // ── Utgifter ──
    // Felles for begge busituasjonar: mobil og transport.
    expense.mobile = LL.data.value('monthlyCosts.mobileSubscription');
    if (state.possessions.moped) {
      expense.transport = LL.data.value('transport.mopedFuelPerMonth');
      expense.mopedInsurance = LL.data.value('transport.mopedInsurancePerYear') / 12;
    } else {
      expense.transport = LL.data.value('monthlyCosts.publicTransportYouth', 'gameValue14_17');
    }
    if (state.possessions.phoneInsurance) {
      expense.phoneInsurance = LL.data.value('events.phoneInsurancePerMonth');
    }

    // Fritidsaktivitetar (vald i budsjettkortet)
    const acts = activities();
    let actCost = 0;
    (plan.activities || []).forEach(id => {
      const a = acts.find(x => x.id === id);
      if (a) actCost += a.monthly;
    });
    if (actCost > 0) expense.activities = actCost;

    if (hybel) {
      // Full sjølvhushaldning — spelaren ber alt sjølv.
      expense.clothing = LL.data.value('monthlyCosts.clothing', wageVar) * prof.mult;
      expense.personalCare = LL.data.value('monthlyCosts.personalCare', wageVar);
      expense.playAndMedia = LL.data.value('monthlyCosts.playAndMedia', wageVar) * prof.mult;
      expense.rent = LL.data.value('housing.hybelRent');
      expense.food = LL.data.value('monthlyCosts.food', 'gameValue14_17');
      const h = LL.data.node('householdCostsSinglePerson');
      expense.household = (h.otherGroceries + h.householdItems + h.furniture + h.mediaAndLeisure);
    } else {
      // Bur heime: foreldra dekkjer klede, personleg pleie, mat og det meste av
      // media. Spelaren betaler eigne fritidspengar (del av SIFO-posten), skalert
      // med forbruksprofilen.
      expense.ownMoney = LL.data.value('monthlyCosts.playAndMedia', wageVar) * HOME_PLAY_FACTOR * prof.mult;
    }

    // Russebuss-andel (fordelt over halvåra fram til russetida)
    if (state.flags.russBuss) {
      expense.russBus = LL.data.value('leisure.russBus') / 24; // fordelt over ~24 mnd
    }

    const incomeTotal = sum(income);
    const expenseTotal = sum(expense);

    return {
      income, expense, incomeTotal, expenseTotal,
      net: incomeTotal - expenseTotal,
      savings: plan.savings || 0,
      wellbeingPerMonth: prof.wellbeingPerMonth + activityWellbeing(plan),
      energyPerMonth: jobEnergy(plan) + activityEnergy(plan)
    };
  }

  function activityWellbeing(plan) {
    const acts = activities();
    let w = 0;
    (plan.activities || []).forEach(id => { const a = acts.find(x => x.id === id); if (a) w += a.wellbeing; });
    return w;
  }
  function activityEnergy(plan) {
    const acts = activities();
    let e = 0;
    (plan.activities || []).forEach(id => { const a = acts.find(x => x.id === id); if (a) e += a.energy; });
    return e;
  }
  function jobEnergy(plan) {
    if (plan.jobHours >= 12) return -2;
    if (plan.jobHours >= 6) return -1;
    return 1; // roleg halvår gjev overskot
  }

  // Skatt: gjeve årsakkumulert løn og kor mykje som alt er skattlagt,
  // returner ny skatt for denne perioden.
  function taxOnWage(prevYearWage, newWage) {
    const limit = LL.data.value('tax.taxFreeCardLimit');
    const rate = 0.25;
    const before = Math.max(0, prevYearWage - limit) * rate;
    const after = Math.max(0, (prevYearWage + newWage) - limit) * rate;
    return Math.max(0, after - before);
  }

  function sum(obj) { let t = 0; for (const k in obj) t += obj[k]; return t; }

  // Etikettar for kategori-nøklar (norsk)
  const LABELS = {
    wage: 'Løn', parents: 'Foreldrebidrag', housingGrant: 'Bortebuarstipend',
    allowance: 'Lommepengar', studyGrant: 'Inntektsavh. stipend', grant: 'Utstyrsstipend',
    tax: 'Skatt',
    clothing: 'Klede og sko', personalCare: 'Personleg pleie', playAndMedia: 'Fritid og medium',
    mobile: 'Mobil', transport: 'Transport', mopedInsurance: 'Mopedforsikring',
    ownMoney: 'Eigne fritidspengar',
    phoneInsurance: 'Mobilforsikring', activities: 'Fritidsaktivitetar',
    rent: 'Husleige', food: 'Mat', household: 'Hushald', russBus: 'Russebuss',
    events: 'Uventa hendingar'
  };
  function label(key) { return LABELS[key] || key; }

  return {
    PROFILES, WEEKS_PER_MONTH,
    activities, jobOptions, savingsOptions, hourlyWage, defaultPlan,
    monthlyBreakdown, taxOnWage, label, ageVariant, sum
  };
})();
