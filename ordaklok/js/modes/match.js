/* Ordaklok — modus: Tevling (Boksekamp)
 * Ring med tau, scattered chips, smash-animasjon på match.
 * State-maskin: idle → selected → colliding (await) → burst (await) → clearing → idle
 */
(function (root) {
  'use strict';

  const State = OrdaklokState;
  const Storage = OrdaklokStorage;
  const Leitner = OrdaklokLeitner;

  // Pastell-palett for chips
  const CHIP_BG = [
    '#fff3cc', '#ffe1c2', '#d7f0d8', '#c9e7fb', '#e7d8fa',
    '#fde4f1', '#fff5b8', '#d2f1ef', '#ffe0b8', '#dde9f7'
  ];

  function build(list, queue, options, callbacks) {
    let mountEl, ringEl, ringLeft, ringRight, burstEl;
    let started = 0;
    let mistakes = 0;
    let matched = 0;
    let total = 0;
    let busy = false;
    let pendingTimers = [];
    let selected = null; // { side: 'eng'|'nor', chipEl, pairIdx }
    let chipsByPair = {}; // pairIdx -> { eng: chipEl, nor: chipEl }
    let isMobileLayout = false;
    let resizeHandler = null;

    function render(host) {
      mountEl = document.createElement('div');
      mountEl.className = 'bk-tev-area';
      host.appendChild(mountEl);

      started = Date.now();
      total = queue.length;

      // Ring-skall
      ringEl = document.createElement('div');
      ringEl.className = 'bk-ring';

      const ropeTop = document.createElement('div');
      ropeTop.className = 'bk-ring-rope top';
      const ropeBot = document.createElement('div');
      ropeBot.className = 'bk-ring-rope bottom';
      ringEl.appendChild(ropeTop);
      ringEl.appendChild(ropeBot);

      const flagLeft = document.createElement('div');
      flagLeft.className = 'bk-ring-flag left';
      flagLeft.textContent = (list.labelA || 'A').toUpperCase();
      const flagRight = document.createElement('div');
      flagRight.className = 'bk-ring-flag right';
      flagRight.textContent = (list.labelB || 'B').toUpperCase();
      ringEl.appendChild(flagLeft);
      ringEl.appendChild(flagRight);

      // Vyrde-dommar
      const vyrdeWrap = document.createElement('div');
      vyrdeWrap.className = 'bk-ring-vyrde';
      // Dommaren sit i eit rundt merke, så maskoten får ei eiga ramme rundt seg.
      const vBadge = document.createElement('div');
      vBadge.className = 'bk-ring-vyrde-badge';
      const vImg = Vyrde.create({ mood: 'surprised', alt: 'Vyrde dommar', className: 'bk-vyrde' });
      vBadge.appendChild(vImg);
      vyrdeWrap.appendChild(vBadge);
      const dommar = document.createElement('div');
      dommar.className = 'dommar-tag';
      dommar.textContent = 'DOMMAR';
      vyrdeWrap.appendChild(dommar);
      ringEl.appendChild(vyrdeWrap);

      // Chip-områder
      ringLeft = document.createElement('div');
      ringLeft.className = 'bk-ring-area left';
      ringRight = document.createElement('div');
      ringRight.className = 'bk-ring-area right';
      ringEl.appendChild(ringLeft);
      ringEl.appendChild(ringRight);

      // Burst-element (TREFF/BOM)
      burstEl = document.createElement('div');
      burstEl.className = 'bk-burst';
      ringEl.appendChild(burstEl);

      mountEl.appendChild(ringEl);

      // Bygg chips
      buildChips();

      // Reagér på resize for å re-scatter dersom layout-mode endrast
      resizeHandler = () => {
        const wasMobile = isMobileLayout;
        isMobileLayout = window.matchMedia('(max-width: 900px)').matches;
        if (wasMobile !== isMobileLayout) buildChips();
      };
      window.addEventListener('resize', resizeHandler);
    }

    function buildChips() {
      chipsByPair = {};
      ringLeft.innerHTML = '';
      ringRight.innerHTML = '';
      isMobileLayout = window.matchMedia('(max-width: 900px)').matches;

      const ordered = queue.map(q => q.idx);
      const shuffledA = State.shuffle(ordered.slice());
      const shuffledB = State.shuffle(ordered.slice());

      shuffledA.forEach((pairIdx, i) => {
        const chip = makeChip(list.pairs[pairIdx].a, pairIdx, 'eng', i);
        ringLeft.appendChild(chip);
        if (!chipsByPair[pairIdx]) chipsByPair[pairIdx] = {};
        chipsByPair[pairIdx].eng = chip;
      });
      shuffledB.forEach((pairIdx, i) => {
        const chip = makeChip(list.pairs[pairIdx].b, pairIdx, 'nor', i);
        ringRight.appendChild(chip);
        if (!chipsByPair[pairIdx]) chipsByPair[pairIdx] = {};
        chipsByPair[pairIdx].nor = chip;
      });
    }

    function makeChip(text, pairIdx, side, colorIdx) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'bk-chip side-' + side;
      chip.textContent = text;
      OrdaklokText.applyLengthClass(chip, text);
      chip.dataset.pairIdx = String(pairIdx);
      chip.dataset.side = side;
      chip.style.setProperty('--chip-bg', CHIP_BG[colorIdx % CHIP_BG.length]);
      const rot = (Math.random() * 8 - 4).toFixed(1);
      chip.style.setProperty('--rot', rot + 'deg');
      chip.addEventListener('click', () => onChipClick(chip, pairIdx, side));
      return chip;
    }

    function onChipClick(chip, pairIdx, side) {
      if (busy) return;
      if (chip.classList.contains('bk-matched')) return;
      if (chip.classList.contains('bk-colliding')) return;

      // Klikk på allereie valt → avvel
      if (selected && selected.chipEl === chip) {
        chip.classList.remove('bk-selected');
        selected = null;
        return;
      }

      // Klikk på same side → byt valt
      if (selected && selected.side === side) {
        selected.chipEl.classList.remove('bk-selected');
        selected = { side, chipEl: chip, pairIdx };
        chip.classList.add('bk-selected');
        return;
      }

      // Klikk på første chip
      if (!selected) {
        selected = { side, chipEl: chip, pairIdx };
        chip.classList.add('bk-selected');
        return;
      }

      // Klikk på motsett side med eksisterande val → kollisjon
      const first = selected;
      const second = { side, chipEl: chip, pairIdx };
      selected = null;
      const correct = first.pairIdx === second.pairIdx;
      runCollision(first, second, correct);
    }

    async function runCollision(first, second, correct) {
      busy = true;

      // Fjern selected-state (vil bli erstatta av colliding)
      first.chipEl.classList.remove('bk-selected');
      second.chipEl.classList.remove('bk-selected');

      // Kollisjonspunktet er midt mellom dei to chipsa — ikkje ring-sentrum.
      // Ringen kan vere svært høg når runden har mange par, og då ville
      // ring-sentrum ofte liggje utanfor synsfeltet.
      const ringRect = ringEl.getBoundingClientRect();
      const r1 = first.chipEl.getBoundingClientRect();
      const r2 = second.chipEl.getBoundingClientRect();
      const cx = (r1.left + r1.width / 2 + r2.left + r2.width / 2) / 2;
      const cy = (r1.top + r1.height / 2 + r2.top + r2.height / 2) / 2;

      // Flytt TREFF/BOM-bursten til same punkt
      burstEl.style.left = (cx - ringRect.left) + 'px';
      burstEl.style.top  = (cy - ringRect.top) + 'px';

      for (const item of [first, second]) {
        const r = item.chipEl.getBoundingClientRect();
        const chipCx = r.left + r.width / 2;
        const chipCy = r.top + r.height / 2;
        item.chipEl.style.setProperty('--dx', (cx - chipCx).toFixed(1) + 'px');
        item.chipEl.style.setProperty('--dy', (cy - chipCy).toFixed(1) + 'px');
        const spin = (Math.random() * 360 - 180) | 0;
        item.chipEl.style.setProperty('--spin', spin + 'deg');
      }

      // Tving reflow så CSS-variablane er committed FØR animasjonen startar
      void first.chipEl.offsetWidth;

      // Start smash på begge
      first.chipEl.classList.add('bk-colliding');
      second.chipEl.classList.add('bk-colliding');

      // Vent på begge animationend
      await Promise.all([first.chipEl, second.chipEl].map(el =>
        new Promise(resolve => {
          const onEnd = () => { el.removeEventListener('animationend', onEnd); resolve(); };
          el.addEventListener('animationend', onEnd);
        })
      ));

      // Vis burst
      burstEl.textContent = correct ? 'TREFF!' : 'BOM!';
      burstEl.style.color = correct ? '#4ade80' : '#fca5a5';
      burstEl.classList.remove('show');
      void burstEl.offsetWidth;
      burstEl.classList.add('show');

      await new Promise(resolve => {
        const onBurstEnd = () => { burstEl.removeEventListener('animationend', onBurstEnd); resolve(); };
        burstEl.addEventListener('animationend', onBurstEnd);
        // Fallback dersom animationend ikkje fyrer
        const t = setTimeout(() => { burstEl.removeEventListener('animationend', onBurstEnd); resolve(); }, 1300);
        pendingTimers.push(t);
      });
      burstEl.classList.remove('show');

      if (correct) {
        // Behald chips usynlege (bk-colliding forwards held dei på scale 0.3 opacity 0)
        // Marker som matched for tydeleg state
        first.chipEl.classList.add('bk-matched');
        second.chipEl.classList.add('bk-matched');
        matched++;

        // Leitner: rett
        const leitnerData = Storage.getLeitner(list.id);
        Leitner.recordResult(leitnerData, first.pairIdx, true);
        Storage.setLeitner(list.id, leitnerData);
        callbacks.onResult(first.pairIdx, { correct: true, peeked: false, time: 0 });
        callbacks.onAdvance && callbacks.onAdvance();

        busy = false;

        if (matched >= total) {
          const totalTime = Math.round((Date.now() - started) / 1000);
          callbacks.onFinish && callbacks.onFinish({ totalTime, mistakes });
        }
      } else {
        // BOM: send chips tilbake til opphavleg posisjon
        mistakes++;
        // Leitner: feil for begge involverte par
        const leitnerData = Storage.getLeitner(list.id);
        Leitner.recordResult(leitnerData, first.pairIdx, false);
        if (first.pairIdx !== second.pairIdx) Leitner.recordResult(leitnerData, second.pairIdx, false);
        Storage.setLeitner(list.id, leitnerData);
        callbacks.onResult(first.pairIdx, { correct: false, peeked: false, time: 0 });

        // Nullstill chips: fjern bk-colliding (transform går tilbake til base)
        first.chipEl.classList.remove('bk-colliding');
        second.chipEl.classList.remove('bk-colliding');
        first.chipEl.style.removeProperty('--dx');
        first.chipEl.style.removeProperty('--dy');
        first.chipEl.style.removeProperty('--spin');
        second.chipEl.style.removeProperty('--dx');
        second.chipEl.style.removeProperty('--dy');
        second.chipEl.style.removeProperty('--spin');

        busy = false;
      }
    }

    function cleanup() {
      pendingTimers.forEach(t => clearTimeout(t));
      pendingTimers = [];
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }
    }

    return { render, cleanup };
  }

  root.OrdaklokModeMatch = {
    id: 'match',
    label: 'Tevling',
    description: 'Par opp orda mot klokka. Smell saman rette par.',
    icon: OrdaklokState.ICONS.grid,
    supportsLeitner: false,
    mount(host, ctx) {
      const m = build(ctx.list, ctx.queue, ctx.options, ctx.callbacks);
      m.render(host);
      this._unmount = () => { m.cleanup && m.cleanup(); host.innerHTML = ''; };
    },
    unmount() { if (this._unmount) this._unmount(); }
  };
})(window);
