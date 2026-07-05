/* Livslina — ui-setup.js
 * Start-skjerm og 4-stegs oppstartswizard (karakter, familie, linje, busituasjon).
 */
window.LL = window.LL || {};

LL.uiSetup = (function () {
  'use strict';

  let stepIndex = 0;
  const STEPS = ['character', 'family', 'line', 'housing'];
  let pendingHybelRoll = false;

  // ── Start-skjerm ──
  function renderStart() {
    const cont = document.getElementById('startContinue');
    if (cont) cont.hidden = !LL.storage.hasActive();
  }

  function showInfo() {
    const base = LL.data.getBase();
    const body = document.getElementById('infoModalBody');
    body.textContent = '';
    const p = document.createElement('p');
    p.textContent = base.priceLevelNote;
    body.appendChild(p);
    const ul = document.createElement('ul');
    ul.style.marginTop = '0.75rem';
    Object.values(base.sources).forEach(s => {
      const li = document.createElement('li');
      li.textContent = s.name;
      ul.appendChild(li);
    });
    body.appendChild(ul);
    LL.main.openModal('infoModal');
  }

  // ── Wizard-oppstart ──
  function startWizard() {
    LL.state.newGame({});
    stepIndex = 0;
    LL.main.showScreen('screen-setup');
    renderStep();
  }

  function renderSteps() {
    const wrap = document.getElementById('wizardSteps');
    const labels = ['Figur', 'Familie', 'Linje', 'Bustad'];
    wrap.textContent = '';
    labels.forEach((lbl, i) => {
      const d = document.createElement('div');
      d.className = 'll-wstep' + (i === stepIndex ? ' active' : (i < stepIndex ? ' done' : ''));
      d.textContent = (i + 1) + '. ' + lbl;
      wrap.appendChild(d);
    });
  }

  function renderStep() {
    renderSteps();
    document.querySelectorAll('.ll-wizard-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('wpanel-' + STEPS[stepIndex]);
    panel.classList.add('active');

    if (STEPS[stepIndex] === 'character') renderCharacter();
    if (STEPS[stepIndex] === 'family') renderFamily();
    if (STEPS[stepIndex] === 'line') renderLine();
    if (STEPS[stepIndex] === 'housing') renderHousing();

    updateNav();
  }

  function updateNav() {
    const back = document.getElementById('wizBack');
    const next = document.getElementById('wizNext');
    back.disabled = stepIndex === 0;
    const s = LL.state.get();
    let ready = true;
    if (STEPS[stepIndex] === 'line') ready = !!s.program;
    if (STEPS[stepIndex] === 'housing') ready = !!s.housing;
    next.disabled = !ready;
    next.innerHTML = stepIndex === STEPS.length - 1
      ? 'Start livslinja <span data-icon="play"></span>'
      : 'Neste <span data-icon="arrowRight"></span>';
    LL.util.hydrate(next);
  }

  function goNext() {
    if (stepIndex < STEPS.length - 1) {
      stepIndex++;
      renderStep();
    } else {
      finish();
    }
  }
  function goBack() {
    if (stepIndex > 0) { stepIndex--; renderStep(); }
  }

  // ── Steg 1: karakter ──
  function refreshDoll() {
    const stage = document.getElementById('dollStage');
    stage.innerHTML = LL.artDoll.svg(LL.state.get().character, { ariaLabel: 'Figuren din' });
  }

  function renderCharacter() {
    refreshDoll();
    const ch = LL.state.get().character;
    swatchRow('skinRow', LL.artDoll.SKIN_TONES, ch.skin, v => { ch.skin = v; refreshDoll(); }, 'Hudtone');
    swatchRow('hairRow', LL.artDoll.HAIR_COLORS, ch.hairColor, v => { ch.hairColor = v; refreshDoll(); }, 'Hårfarge');
    swatchRow('topRow', LL.artDoll.TOP_COLORS, ch.topColor, v => { ch.topColor = v; refreshDoll(); }, 'Farge på overdel');
    variantRow('hairStyleRow', LL.artDoll.HAIR_STYLES, ch.hair, v => { ch.hair = v; refreshDoll(); });
    variantRow('topStyleRow', LL.artDoll.TOP_STYLES, ch.top, v => { ch.top = v; refreshDoll(); });
  }

  function swatchRow(id, colors, current, onPick, label) {
    const row = document.getElementById(id);
    row.textContent = '';
    colors.forEach((hex, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'll-swatch';
      b.style.background = hex;
      b.setAttribute('aria-label', label + ' ' + (i + 1));
      b.setAttribute('aria-pressed', String(hex === current));
      b.addEventListener('click', () => {
        onPick(hex);
        row.querySelectorAll('.ll-swatch').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
      });
      row.appendChild(b);
    });
  }

  function variantRow(id, styles, current, onPick) {
    const row = document.getElementById(id);
    row.textContent = '';
    styles.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = s.label;
      b.setAttribute('aria-pressed', String(s.id === current));
      b.addEventListener('click', () => {
        onPick(s.id);
        row.querySelectorAll('.btn').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
      });
      row.appendChild(b);
    });
  }

  // ── Steg 2: familie (trekt) ──
  function renderFamily() {
    const s = LL.state.get();
    if (!s.family) drawFamily();
    else showFamilyCard();
  }

  function drawFamily() {
    const ids = LL.data.familyProfileIds();
    const id = LL.state.drawPick(ids);
    const prof = LL.data.familyProfile(id);
    LL.state.get().family = Object.assign({ id }, prof);
    showFamilyCard();
  }

  function showFamilyCard() {
    const s = LL.state.get();
    const f = s.family;
    const card = document.getElementById('familyCard');
    card.textContent = '';
    const h = document.createElement('h3');
    h.textContent = f.label;
    card.appendChild(h);
    const ul = document.createElement('ul');
    ul.className = 'll-family-facts';
    const rows = [
      ['Startkapital (sparte gåvepengar)', kr(f.startCapital)],
      ['Lommepengar (om du bur heime)', kr(f.allowancePerMonth) + '/mnd'],
      ['Foreldrebidrag (om du bur på hybel)', kr(f.parentContributionHybelPerMonth) + '/mnd'],
      ['Inntektsavhengig stipend', f.incomeDependentGrant === 'none' ? 'Nei (for høg familieinntekt)' : 'Ja, full sats']
    ];
    rows.forEach(([k, v]) => {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('strong'); b.textContent = v; b.style.float = 'right';
      li.append(a, b);
      ul.appendChild(li);
    });
    card.appendChild(ul);
    // startkapital settast på konto med det same
    s.stats.money = f.startCapital;
  }

  // ── Steg 3: linje ──
  function renderLine() {
    const grid = document.getElementById('lineGrid');
    grid.textContent = '';
    const chosen = LL.state.get().program;
    LL.data.getPrograms().forEach(p => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'll-line-card';
      card.setAttribute('aria-pressed', String(chosen && chosen.id === p.id));

      const type = document.createElement('span');
      type.className = 'll-line-type';
      type.textContent = p.type === 'yrkesfag' ? 'Yrkesfag' : 'Studieførebuande';
      const h = document.createElement('h4'); h.textContent = p.name;
      const blurb = document.createElement('p'); blurb.className = 'll-line-blurb'; blurb.textContent = p.blurb;
      const careers = document.createElement('p'); careers.className = 'll-line-careers';
      const cs = document.createElement('strong'); cs.textContent = 'Kan bli: ';
      careers.append(cs, document.createTextNode(p.careers.join(', ')));
      const grant = document.createElement('p'); grant.className = 'll-line-careers';
      grant.textContent = 'Utstyrsstipend: ' + kr(LL.data.equipmentGrant(p.equipmentGrantRate)) + '/år';

      card.append(type, h, blurb, careers, grant);
      card.addEventListener('click', () => selectLine(p, grid));
      grid.appendChild(card);
    });
  }

  function selectLine(p, grid) {
    const s = LL.state.get();
    s.program = p;
    pendingHybelRoll = true; // ny roll for hybel når vi går til steg 4
    grid.querySelectorAll('.ll-line-card').forEach(c => c.setAttribute('aria-pressed', 'false'));
    grid.querySelectorAll('.ll-line-card').forEach(c => {
      if (c.querySelector('h4').textContent === p.name) c.setAttribute('aria-pressed', 'true');
    });
    updateNav();
  }

  // ── Steg 4: busituasjon ──
  function renderHousing() {
    const s = LL.state.get();
    if (pendingHybelRoll) {
      s.hybelAvailable = LL.state.draw() < (s.program.hybelChance || 0);
      s.housing = 'heime';
      pendingHybelRoll = false;
    }
    const wrap = document.getElementById('housingBody');
    wrap.textContent = '';

    const intro = document.createElement('p');
    if (s.hybelAvailable) {
      intro.textContent = `${s.program.name} finst ikkje på ein skule nær heimen din. Du kan difor bu på hybel og få bortebuarstipend frå Lånekassen — eller pendle og bu heime.`;
    } else {
      intro.textContent = `${s.program.name} finst på ein skule i nærleiken, så du bur heime medan du går på skulen. (Hybel blir aktuelt i seinare livsfasar.)`;
    }
    wrap.appendChild(intro);

    const opts = document.createElement('div');
    opts.className = 'll-housing-opts';

    opts.appendChild(housingCard('heime', 'Bu heime',
      'Ingen husleige, foreldra dekkjer det meste. Lommepengar etter familieøkonomien.', s.housing));

    if (s.hybelAvailable) {
      opts.appendChild(housingCard('hybel', 'Bu på hybel',
        'Eigen hybel med husleige, mat og faste rekningar — men bortebuarstipend (' +
        kr(LL.data.value('grants.housingGrantPerMonth')) + '/mnd) og full fridom.', s.housing));
    }
    wrap.appendChild(opts);
    updateNav();
  }

  function housingCard(id, title, desc, current) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'll-housing-card';
    c.setAttribute('aria-pressed', String(id === current));
    const h = document.createElement('h4'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = desc;
    c.append(h, p);
    c.addEventListener('click', () => {
      LL.state.get().housing = id;
      document.querySelectorAll('.ll-housing-card').forEach(x => x.setAttribute('aria-pressed', 'false'));
      c.setAttribute('aria-pressed', 'true');
      updateNav();
    });
    return c;
  }

  // ── Fullfør ──
  function finish() {
    const s = LL.state.get();
    LL.storage.saveActive(s);
    LL.main.enterHome();
  }

  function kr(n) { return LL.util.kr(n); }

  function init() {
    document.getElementById('btnNewGame').addEventListener('click', startWizard);
    const cont = document.getElementById('startContinue');
    if (cont) cont.addEventListener('click', () => {
      const saved = LL.storage.loadActive();
      if (saved) { LL.state.load(saved); LL.main.enterHome(); }
    });
    document.getElementById('btnInfo').addEventListener('click', showInfo);
    const impBtn = document.getElementById('btnImport');
    const impFile = document.getElementById('importFile');
    if (impBtn && impFile) {
      impBtn.addEventListener('click', () => impFile.click());
      impFile.addEventListener('change', () => {
        if (!impFile.files.length) return;
        LL.storage.importSave(impFile.files[0])
          .then(obj => { LL.state.load(obj); LL.storage.saveActive(obj); LL.main.enterHome(); LL.main.toast('Livslinje importert.'); })
          .catch(err => LL.main.toast(err.message));
        impFile.value = '';
      });
    }
    document.getElementById('wizNext').addEventListener('click', goNext);
    document.getElementById('wizBack').addEventListener('click', goBack);
    const reroll = document.getElementById('familyReroll');
    if (reroll) reroll.addEventListener('click', () => { drawFamily(); });
  }

  return { init, renderStart };
})();
