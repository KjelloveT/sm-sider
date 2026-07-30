/* ══════════════════════════════════════════════
   UI-CLIP.JS — Panelet for klippet du har valt

   Fade og klipp-volum kan dragast rett på canvasen, men ei canvas-draging
   er ikkje til å nå med tastatur. Difor finst dei same verdiane her, som
   vanlege skjemafelt — og her kan dei dessutan settast nøyaktig, noko som
   er vanskeleg med musa når ein er zooma langt ut.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.uiClip = (function () {
  'use strict';

  let panel = null;
  let title = null;
  let meta = null;
  let gainInput = null;
  let gainValue = null;
  let fadeInInput = null;
  let fadeOutInput = null;
  let nameInput = null;

  /** Klippet panelet gjeld — berre når nøyaktig eitt er valt. */
  function current() {
    const sel = LS.state.data.selection;
    if (sel.length !== 1) return null;
    return LS.state.getClip(sel[0]);
  }

  function afterChange(clip) {
    LS.state.clampFades(clip);
    syncFades(clip);
    // Endrar vi konvolutten under avspeling, må grafen byggjast om — han
    // er alt planlagd, og planlagde rampar kan ikkje skrivast om i etterkant.
    if (LS.audio.isPlaying()) LS.uiToolbar.seek(LS.state.data.view.playhead);
    LS.render.schedule();
  }

  function syncFades(clip) {
    fadeInInput.value = clip.fadeIn.toFixed(2);
    fadeOutInput.value = clip.fadeOut.toFixed(2);
    const max = clip.srcLen.toFixed(2);
    fadeInInput.max = max;
    fadeOutInput.max = max;
  }

  /** Teiknar panelet etter kva som er valt. */
  function refresh() {
    if (!panel) return;
    const clip = current();
    const many = LS.state.data.selection.length > 1;

    panel.hidden = !clip;
    if (!clip) {
      if (many) {
        panel.hidden = false;
        title.textContent = LS.state.data.selection.length + ' klipp valde';
        meta.textContent = 'Vel eitt klipp for å stille volum og fading.';
        panel.classList.add('ls-clip-panel-empty');
      }
      return;
    }

    panel.classList.remove('ls-clip-panel-empty');
    const source = LS.audio.getSource(clip.sourceId);
    title.textContent = 'Valt klipp';
    nameInput.value = clip.name;

    const trackIndex = LS.state.trackIndex(clip.trackId);
    meta.textContent = 'Spor ' + (trackIndex + 1)
      + ' · ' + LS.util.formatTime(clip.timeStart) + '–' + LS.util.formatTime(LS.state.clipEnd(clip))
      + ' · ' + clip.srcLen.toFixed(2).replace('.', ',') + ' s'
      + (source ? ' av «' + source.name + '»' : '');

    gainInput.value = clip.gain;
    gainValue.textContent = Math.round(clip.gain * 100) + '%';
    syncFades(clip);
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup() {
    panel = document.getElementById('clipPanel');
    title = document.getElementById('clipPanelTitle');
    meta = document.getElementById('clipPanelMeta');
    nameInput = document.getElementById('clipName');
    gainInput = document.getElementById('clipGain');
    gainValue = document.getElementById('clipGainValue');
    fadeInInput = document.getElementById('clipFadeIn');
    fadeOutInput = document.getElementById('clipFadeOut');

    nameInput.addEventListener('change', () => {
      const clip = current();
      if (!clip) return;
      clip.name = nameInput.value.trim() || 'Klipp';
      nameInput.value = clip.name;
      LS.render.schedule();
    });

    gainInput.addEventListener('pointerdown', () => LS.state.pushUndo());
    gainInput.addEventListener('input', () => {
      const clip = current();
      if (!clip) return;
      clip.gain = parseFloat(gainInput.value);
      gainValue.textContent = Math.round(clip.gain * 100) + '%';
      if (LS.audio.isPlaying()) LS.uiToolbar.seek(LS.state.data.view.playhead);
      LS.render.schedule();
    });
    gainInput.addEventListener('dblclick', () => {
      const clip = current();
      if (!clip) return;
      LS.state.pushUndo();
      clip.gain = 1;
      gainInput.value = 1;
      gainValue.textContent = '100%';
      if (LS.audio.isPlaying()) LS.uiToolbar.seek(LS.state.data.view.playhead);
      LS.render.schedule();
    });

    [[fadeInInput, 'fadeIn'], [fadeOutInput, 'fadeOut']].forEach(([input, field]) => {
      input.addEventListener('change', () => {
        const clip = current();
        if (!clip) return;
        LS.state.pushUndo();
        clip[field] = Math.max(0, parseFloat(input.value) || 0);
        afterChange(clip);
      });
    });

    document.getElementById('clipFadeClear').addEventListener('click', () => {
      const clip = current();
      if (!clip) return;
      LS.state.pushUndo();
      clip.fadeIn = 0;
      clip.fadeOut = 0;
      afterChange(clip);
    });

    refresh();
  }

  return { setup, refresh };
})();
