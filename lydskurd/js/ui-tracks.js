/* ══════════════════════════════════════════════
   UI-TRACKS.JS — Sporhovuda til venstre for tidslinja

   Desse er vanleg DOM og ikkje canvas, av di dei inneheld knappar og
   skyveknappar som skal kunne nåast med tastatur og skjermlesar.
   Høgdene må halde nøyaktig takt med LS.render.TRACK_H, elles glir
   hovuda ut av kurs med banene sine.
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

  function trackHead(track, index) {
    const box = LS.util.el('div', 'ls-track-head');
    box.dataset.trackId = track.id;

    const top = LS.util.el('div', 'ls-track-head-top');
    const num = LS.util.el('span', 'ls-track-num', String(index + 1));
    const name = LS.util.el('span', 'ls-track-name', track.name);
    name.title = track.name;
    top.appendChild(num);
    top.appendChild(name);

    const info = LS.util.el('div', 'ls-track-info');
    const count = LS.state.clipsOnTrack(track.id).length;
    info.textContent = count === 0 ? 'Tomt spor'
      : (count === 1 ? '1 klipp' : count + ' klipp');

    const actions = LS.util.el('div', 'ls-track-actions');
    const removeBtn = LS.util.iconButton('trash2', null, 'btn ls-icon-btn ls-icon-btn-small');
    removeBtn.setAttribute('aria-label', 'Slett ' + track.name);
    removeBtn.title = 'Slett sporet';
    removeBtn.addEventListener('click', () => {
      LS.state.pushUndo();
      LS.state.removeTrack(track.id);
      LS.state.emit('tracks');
    });
    actions.appendChild(removeBtn);

    box.appendChild(top);
    box.appendChild(info);
    box.appendChild(actions);
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
