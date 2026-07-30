/* ══════════════════════════════════════════════
   UI-TRACKS.JS — Sporhovuda til venstre for tidslinja

   Desse er vanleg DOM og ikkje canvas, av di dei inneheld skyveknappar
   og trykknappar som skal kunne nåast med tastatur og skjermlesar.
   Høgdene må halde nøyaktig takt med LS.render.TRACK_H, elles glir
   hovuda ut av kurs med banene sine.

   Merk at rørsle på ein skyveknapp IKKJE byggjer hovuda opp på nytt —
   då ville fokus hoppe ut av knappen midt i draginga. I staden blir
   verdien skriven rett i tilstanden, teksten oppdatert på staden, og
   lydgrafen justert levande gjennom LS.audio.applyMix().
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.uiTracks = (function () {
  'use strict';

  let host = null;

  function setHost(node) {
    host = node;
    host.style.setProperty('--ls-ruler-h', LS.render.RULER_H + 'px');
    host.style.setProperty('--ls-track-h', LS.render.TRACK_H + 'px');
  }

  /** Etter kvar endring i miksen: oppdater lyden som spelar og teikninga. */
  function mixChanged() {
    LS.audio.applyMix();
    LS.render.schedule();
  }

  /* Handterarane under slår sporet opp på ID i staden for å halde ein
     referanse til objektet. Grunnen er at angre byter ut heile tracks-
     lista med ferske objekt (sjå applySnapshot i state.js) — held vi ein
     gammal referanse, skriv skyveknappen til eit objekt som ikkje lenger
     er i bruk, og endringa blir tapt utan noka feilmelding. */
  function withTrack(trackId, fn) {
    const track = LS.state.getTrack(trackId);
    if (track) fn(track);
    return track;
  }

  function panText(pan) {
    const v = Math.round(pan * 100);
    if (v === 0) return 'midt';
    return (v < 0 ? 'V' : 'H') + ' ' + Math.abs(v);
  }

  /* ──────────────── Éin skyveknapp ──────────────── */

  function slider(opts) {
    const wrap = LS.util.el('div', 'ls-slider-row');

    const icon = LS.util.el('span', 'ls-slider-icon');
    icon.innerHTML = ICON(opts.icon, 14);
    icon.setAttribute('aria-hidden', 'true');

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'ls-slider';
    input.min = opts.min;
    input.max = opts.max;
    input.step = opts.step;
    input.value = opts.value;
    input.setAttribute('aria-label', opts.label);

    const out = LS.util.el('output', 'ls-slider-value', opts.format(opts.value));

    input.addEventListener('input', () => {
      const value = parseFloat(input.value);
      opts.onInput(value);
      out.textContent = opts.format(value);
      mixChanged();
    });
    // Eitt angre-steg per drag, ikkje eitt per piksel.
    input.addEventListener('pointerdown', () => LS.state.pushUndo());
    input.addEventListener('keydown', (e) => {
      if (e.key.indexOf('Arrow') === 0 || e.key === 'Home' || e.key === 'End') LS.state.pushUndo();
    });
    input.addEventListener('dblclick', () => {
      LS.state.pushUndo();
      input.value = opts.reset;
      opts.onInput(opts.reset);
      out.textContent = opts.format(opts.reset);
      mixChanged();
    });
    input.title = opts.label + ' — dobbeltklikk for å nullstille';

    wrap.appendChild(icon);
    wrap.appendChild(input);
    wrap.appendChild(out);
    return wrap;
  }

  /* ──────────────── Eitt sporhovud ──────────────── */

  function trackHead(track, index) {
    const box = LS.util.el('div', 'ls-track-head');
    box.dataset.trackId = track.id;

    /* --- Rad 1: nummer, namn, slett --- */
    const top = LS.util.el('div', 'ls-track-head-top');

    const num = LS.util.el('span', 'ls-track-num', String(index + 1));
    num.setAttribute('aria-hidden', 'true');

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'ls-track-name';
    name.value = track.name;
    name.maxLength = 40;
    name.setAttribute('aria-label', 'Namn på spor ' + (index + 1));
    name.addEventListener('change', () => {
      withTrack(track.id, (t) => {
        t.name = name.value.trim() || ('Spor ' + (index + 1));
        name.value = t.name;
      });
    });

    // Rekkjefølgje: to smale knappar stabla, så dei tek minimalt med breidd
    const order = LS.util.el('div', 'ls-track-order');
    [[-1, 'chevronUp', 'opp'], [1, 'chevronDown', 'ned']].forEach(([delta, icon, word]) => {
      const btn = LS.util.el('button', 'btn ls-order-btn');
      btn.type = 'button';
      btn.innerHTML = ICON(icon, 11);
      btn.setAttribute('aria-label', 'Flytt spor ' + (index + 1) + ' ' + word);
      btn.title = 'Flytt sporet ' + word;
      btn.disabled = delta < 0 ? index === 0 : index === LS.state.data.tracks.length - 1;
      btn.addEventListener('click', () => {
        LS.state.pushUndo();
        if (LS.state.moveTrack(track.id, delta)) LS.state.emit('tracks');
        else LS.state.undo();
      });
      order.appendChild(btn);
    });

    const removeBtn = LS.util.iconButton('trash2', null, 'btn ls-icon-btn ls-icon-btn-small ls-danger');
    removeBtn.setAttribute('aria-label', 'Slett spor ' + (index + 1));
    removeBtn.title = 'Slett sporet og klippa på det';
    removeBtn.addEventListener('click', () => {
      if (!LS.state.getTrack(track.id)) return;
      const count = LS.state.clipsOnTrack(track.id).length;
      if (count && !window.confirm('Slette sporet og ' + count + (count === 1 ? ' klipp' : ' klipp') + ' på det?')) return;
      LS.state.pushUndo();
      LS.state.removeTrack(track.id);
      LS.state.emit('tracks');
    });

    top.appendChild(num);
    top.appendChild(name);
    top.appendChild(order);
    top.appendChild(removeBtn);

    /* --- Rad 2: volum --- */
    const vol = slider({
      icon: 'volume', label: 'Volum på spor ' + (index + 1),
      min: 0, max: 1.5, step: 0.01, value: track.gain, reset: 1,
      format: v => Math.round(v * 100) + '%',
      onInput: v => withTrack(track.id, t => { t.gain = v; })
    });

    /* --- Rad 3: panorering, mute og solo --- */
    const bottom = LS.util.el('div', 'ls-track-bottom');
    const pan = slider({
      icon: 'arrowLeftRight', label: 'Panorering på spor ' + (index + 1),
      min: -1, max: 1, step: 0.02, value: track.pan, reset: 0,
      format: panText,
      onInput: v => withTrack(track.id, t => { t.pan = v; })
    });

    const muteBtn = LS.util.el('button', 'btn ls-tag-btn', 'M');
    muteBtn.type = 'button';
    muteBtn.title = 'Demp sporet';
    muteBtn.setAttribute('aria-label', 'Demp spor ' + (index + 1));
    muteBtn.setAttribute('aria-pressed', String(!!track.muted));
    muteBtn.classList.toggle('active', !!track.muted);
    muteBtn.addEventListener('click', () => {
      LS.state.pushUndo();
      const t = withTrack(track.id, (t) => { t.muted = !t.muted; });
      if (!t) return;
      muteBtn.setAttribute('aria-pressed', String(t.muted));
      muteBtn.classList.toggle('active', t.muted);
      box.classList.toggle('ls-track-silent', t.muted);
      mixChanged();
    });

    const soloBtn = LS.util.el('button', 'btn ls-tag-btn', 'S');
    soloBtn.type = 'button';
    soloBtn.title = 'Høyr berre dette sporet';
    soloBtn.setAttribute('aria-label', 'Solo på spor ' + (index + 1));
    soloBtn.setAttribute('aria-pressed', String(!!track.soloed));
    soloBtn.classList.toggle('active', !!track.soloed);
    soloBtn.addEventListener('click', () => {
      LS.state.pushUndo();
      withTrack(track.id, (t) => { t.soloed = !t.soloed; });
      // Solo verkar på alle spor samstundes, så heile lista må teiknast om.
      LS.state.emit('tracks');
    });

    bottom.appendChild(pan);
    bottom.appendChild(muteBtn);
    bottom.appendChild(soloBtn);

    box.appendChild(top);
    box.appendChild(vol);
    box.appendChild(bottom);

    // Blir sporet teia av at eit anna står i solo, skal det synast.
    const anySolo = LS.state.data.tracks.some(t => t.soloed);
    if (track.muted || (anySolo && !track.soloed)) box.classList.add('ls-track-silent');

    return box;
  }

  function render() {
    if (!host) return;
    host.textContent = '';

    const spacer = LS.util.el('div', 'ls-track-head-spacer');
    host.appendChild(spacer);

    LS.state.data.tracks.forEach((track, i) => {
      host.appendChild(trackHead(track, i));
    });
  }

  return { setHost, render };
})();
