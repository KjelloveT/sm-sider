/* ══════════════════════════════════════════════
   UI-TOOLBAR.JS — Transport, zoom og hurtigtastar

   Spelehovudet blir flytta i ei requestAnimationFrame-løkke som les
   posisjonen frå lydklokka. Løkka teiknar berre; ho avgjer ingenting
   om kvar lyden er.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.uiToolbar = (function () {
  'use strict';

  let playBtn = null;
  let stopBtn = null;
  let homeBtn = null;
  let timeLabel = null;
  let splitBtn = null;
  let deleteBtn = null;
  let undoBtn = null;
  let redoBtn = null;
  let zoomInBtn = null;
  let zoomOutBtn = null;

  let onFollow = null;      // main.js skrollar tidslinja etter spelehovudet
  let onZoom = null;        // main.js eig rullefeltet og må rekne om att breidda
  let rafId = 0;

  /* ──────────────── Knappeutsjånad ──────────────── */

  function setPlayIcon(isPlaying) {
    playBtn.textContent = '';
    const span = LS.util.el('span');
    span.innerHTML = ICON(isPlaying ? 'pause' : 'play', 16);
    playBtn.appendChild(span);
    playBtn.appendChild(document.createTextNode(isPlaying ? 'Pause' : 'Spel'));
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Spel av');
    playBtn.classList.toggle('active', isPlaying);
  }

  function updateTime() {
    const now = LS.audio.isPlaying() ? LS.audio.currentTime() : LS.state.data.view.playhead;
    timeLabel.textContent = LS.util.formatTime(now) + ' / ' + LS.util.formatTime(LS.state.duration());
  }

  function updateButtons() {
    const view = LS.state.data.view;
    const hasAudio = LS.state.data.clips.length > 0;
    zoomInBtn.disabled = view.pxPerSec >= LS.state.MAX_PX_PER_SEC;
    zoomOutBtn.disabled = view.pxPerSec <= LS.state.MIN_PX_PER_SEC;
    playBtn.disabled = !hasAudio;
    stopBtn.disabled = !hasAudio && !LS.audio.isPlaying();
    homeBtn.disabled = !hasAudio;
    // Saksa er berre nyttig når spelehovudet faktisk står i eit klipp.
    splitBtn.disabled = !LS.state.clipsAcross(view.playhead).length;
    deleteBtn.disabled = !LS.state.data.selection.length;
    undoBtn.disabled = !LS.state.canUndo();
    redoBtn.disabled = !LS.state.canRedo();
    setPlayIcon(LS.audio.isPlaying());
    updateTime();
  }

  /* ──────────────── Løkka som flyttar spelehovudet ──────────────── */

  function tick() {
    if (!LS.audio.isPlaying()) { rafId = 0; return; }

    const now = LS.audio.currentTime();
    const end = LS.state.duration();

    if (now >= end) {
      // Ferdig med heile prosjektet — legg spelehovudet på slutten og stopp.
      LS.audio.pause();
      LS.state.setPlayhead(end);
      updateButtons();
      LS.render.schedule();
      rafId = 0;
      return;
    }

    LS.state.setPlayhead(now);
    if (onFollow) onFollow(now);
    updateTime();
    LS.render.schedule();
    rafId = requestAnimationFrame(tick);
  }

  function startTicking() {
    if (rafId) return;
    rafId = requestAnimationFrame(tick);
  }

  /* ──────────────── Transport ──────────────── */

  function play() {
    if (!LS.state.data.clips.length) {
      LS.util.toast('Hent inn lyd før du spelar av.');
      return;
    }
    // Står spelehovudet på slutten, byrjar vi forfrå i staden for å teie.
    let from = LS.state.data.view.playhead;
    if (from >= LS.state.duration() - 0.01) from = 0;

    LS.audio.play(from).then((ok) => {
      if (!ok) {
        LS.util.toast('Klarte ikkje starte avspelinga.');
        return;
      }
      updateButtons();
      startTicking();
    });
  }

  function pause() {
    const at = LS.audio.pause();
    LS.state.setPlayhead(at);
    updateButtons();
    LS.render.schedule();
  }

  function toggle() {
    if (LS.audio.isPlaying()) pause();
    else play();
  }

  /** Stoppar og går tilbake dit avspelinga blei starta. */
  function stop() {
    const back = LS.audio.isPlaying() ? LS.audio.anchorTime() : 0;
    LS.audio.stop();
    LS.state.setPlayhead(back);
    if (onFollow) onFollow(back);
    updateButtons();
    LS.render.schedule();
  }

  function toStart() {
    const wasPlaying = LS.audio.isPlaying();
    LS.audio.stop();
    LS.state.setPlayhead(0);
    if (onFollow) onFollow(0);
    if (wasPlaying) play();
    else { updateButtons(); LS.render.schedule(); }
  }

  /** Flytt spelehovudet, og hopp i lyden dersom det spelar. */
  function seek(seconds) {
    const time = Math.max(0, seconds);
    LS.state.setPlayhead(time);
    if (LS.audio.isPlaying()) {
      LS.audio.play(time).then(() => { updateButtons(); startTicking(); });
    } else {
      updateButtons();
    }
    LS.render.schedule();
  }

  /* ──────────────── Del ved spelehovudet ──────────────── */

  /**
   * Har du valt klipp, blir berre dei delte. Har du ikkje valt noko,
   * blir alt spelehovudet går tvers gjennom delt — det er som å setje
   * saksa rett ned gjennom heile stabelen.
   */
  function splitAtPlayhead() {
    const at = LS.audio.isPlaying() ? LS.audio.currentTime() : LS.state.data.view.playhead;
    let targets = LS.state.clipsAcross(at);

    const selection = LS.state.data.selection;
    if (selection.length) {
      const chosen = targets.filter(c => LS.state.isSelected(c.id));
      // Går spelehovudet ikkje gjennom noko av det valde, seier vi frå
      // i staden for å dele noko brukaren ikkje peika på.
      if (!chosen.length) {
        LS.util.toast('Spelehovudet går ikkje gjennom det valde klippet.');
        return;
      }
      targets = chosen;
    }

    if (!targets.length) {
      LS.util.toast('Sett spelehovudet midt i eit klipp for å dele det.');
      return;
    }

    LS.state.pushUndo();
    const halves = [];
    targets.forEach((clip) => {
      const right = LS.state.splitClip(clip.id, at);
      if (right) halves.push(clip.id, right.id);
    });

    LS.state.setSelection(halves);
    LS.state.emit('clips');
    LS.util.toast(targets.length === 1 ? 'Klippet er delt.' : targets.length + ' klipp er delte.');
  }

  /* ──────────────── Slett, kopier og lim ──────────────── */

  /* Eiga utklippstavle, ikkje systemet si. Vi kopierer berre metadata
     — lyden ligg allereie i kjelderegisteret og treng ikkje flyttast. */
  let clipboard = null;

  function selectedClips() {
    return LS.state.data.selection.map(id => LS.state.getClip(id)).filter(Boolean);
  }

  function removeSelected() {
    const clips = selectedClips();
    if (!clips.length) {
      LS.util.toast('Vel eit klipp først — klikk på det.');
      return;
    }
    LS.state.pushUndo();
    clips.forEach(c => LS.state.removeClip(c.id));
    LS.state.clearSelection();
    LS.state.emit('clips');
    LS.util.toast(clips.length === 1 ? 'Klippet er sletta.' : clips.length + ' klipp er sletta.');
  }

  function copySelected(quiet) {
    const clips = selectedClips();
    if (!clips.length) {
      if (!quiet) LS.util.toast('Vel eit klipp først — klikk på det.');
      return false;
    }
    // Vi lagrar plasseringane relativt til det første klippet, så
    // innbyrdes avstand og sporfordeling overlever ei liming.
    const baseTime = Math.min.apply(null, clips.map(c => c.timeStart));
    clipboard = {
      baseTime: baseTime,
      items: clips.map(c => ({
        clip: JSON.parse(JSON.stringify(c)),
        trackIndex: LS.state.trackIndex(c.trackId)
      }))
    };
    return true;
  }

  function cutSelected() {
    if (!copySelected(true)) {
      LS.util.toast('Vel eit klipp først — klikk på det.');
      return;
    }
    const n = clipboard.items.length;
    LS.state.pushUndo();
    selectedClips().forEach(c => LS.state.removeClip(c.id));
    LS.state.clearSelection();
    LS.state.emit('clips');
    LS.util.toast(n === 1 ? 'Klippet er klipt ut.' : n + ' klipp er klipte ut.');
  }

  function paste() {
    if (!clipboard || !clipboard.items.length) {
      LS.util.toast('Ingenting å lime inn enno.');
      return;
    }
    const at = LS.state.data.view.playhead;
    LS.state.pushUndo();

    const fresh = [];
    clipboard.items.forEach((item) => {
      // Er sporet borte sidan kopieringa, hamnar klippet på det siste.
      const index = Math.min(item.trackIndex, LS.state.data.tracks.length - 1);
      const track = LS.state.data.tracks[index];
      if (!track) return;

      const copy = JSON.parse(JSON.stringify(item.clip));
      copy.id = LS.util.uuid();
      copy.trackId = track.id;
      copy.timeStart = Math.max(0, at + (item.clip.timeStart - clipboard.baseTime));
      LS.state.addClip(copy);
      fresh.push(copy.id);
    });

    LS.state.setSelection(fresh);
    LS.state.emit('clips');
    LS.util.toast(fresh.length === 1 ? 'Klippet er limt inn.' : fresh.length + ' klipp er limte inn.');
  }

  /* ──────────────── Angre og gjer om ──────────────── */

  function undo() {
    if (!LS.state.undo()) {
      LS.util.toast('Ingenting å angre.');
      return;
    }
    LS.state.emit('clips');
  }

  function redo() {
    if (!LS.state.redo()) {
      LS.util.toast('Ingenting å gjere om.');
      return;
    }
    LS.state.emit('clips');
  }

  /* ──────────────── Hurtigtastar ──────────────── */

  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;

      // Ctrl-snarvegane først, så dei ikkje blir slukte av dei enkle tastane.
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        else if (k === 'y') { e.preventDefault(); redo(); }
        else if (k === 'c') { e.preventDefault(); if (copySelected()) LS.util.toast('Kopiert.'); }
        else if (k === 'x') { e.preventDefault(); cutSelected(); }
        else if (k === 'v') { e.preventDefault(); paste(); }
        return;
      }
      if (e.altKey) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelected();
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Home') {
        e.preventDefault();
        toStart();
      } else if (e.key === 'End') {
        e.preventDefault();
        LS.audio.stop();
        seek(LS.state.duration());
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        splitAtPlayhead();
      }
    });
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup(refs) {
    playBtn = document.getElementById('playBtn');
    stopBtn = document.getElementById('stopBtn');
    homeBtn = document.getElementById('homeBtn');
    timeLabel = document.getElementById('timeLabel');
    splitBtn = document.getElementById('splitBtn');
    deleteBtn = document.getElementById('deleteBtn');
    undoBtn = document.getElementById('undoBtn');
    redoBtn = document.getElementById('redoBtn');
    zoomInBtn = document.getElementById('zoomInBtn');
    zoomOutBtn = document.getElementById('zoomOutBtn');

    onFollow = refs.onFollow || null;
    onZoom = refs.onZoom || null;

    playBtn.addEventListener('click', toggle);
    stopBtn.addEventListener('click', stop);
    homeBtn.addEventListener('click', toStart);
    splitBtn.addEventListener('click', splitAtPlayhead);
    deleteBtn.addEventListener('click', removeSelected);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    zoomInBtn.addEventListener('click', () => onZoom && onZoom(1.5, null));
    zoomOutBtn.addEventListener('click', () => onZoom && onZoom(1 / 1.5, null));

    // Sluttar lyden av andre grunnar, skal knappane følgje med.
    LS.audio.setOnEnded(() => { updateButtons(); LS.render.schedule(); });

    bindKeys();
    updateButtons();
  }

  return {
    setup, play, pause, toggle, stop, toStart, seek,
    splitAtPlayhead, removeSelected, copySelected, cutSelected, paste, undo, redo,
    updateButtons, updateTime
  };
})();
