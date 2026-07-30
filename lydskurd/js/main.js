/* ══════════════════════════════════════════════
   MAIN.JS — Kopling mellom grensesnitt og modular

   Held ingen eigen tilstand. Alt som skal hugsast bur i state.js,
   all lyd i audio.js, og alt som er synleg blir teikna av render.js.
   ══════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Grensa der ei nettleserfane byrjar å bli utrygg. 15 minutt stereo
     i 48 kHz er kring 345 MB, og då er vi alt langt ute på kanten. */
  const WARN_SECONDS = 15 * 60;

  let canvas = null;
  let scrollBox = null;
  let spacer = null;
  let emptyNote = null;
  let memoryNote = null;

  /* ──────────────── Oppdatering av heile flata ──────────────── */

  function syncScrollWidth() {
    const view = LS.state.data.view;
    // Litt luft etter siste klipp, så det går an å dra noko lenger ut.
    const seconds = Math.max(LS.state.duration() + 10, 30);
    spacer.style.width = Math.round(seconds * view.pxPerSec) + 'px';
    spacer.style.height = LS.render.height() + 'px';
  }

  function refresh() {
    LS.render.resize(scrollBox.clientWidth);
    LS.uiTracks.render();
    LS.uiClip.refresh();
    syncScrollWidth();
    LS.render.schedule();
    updateNotes();
    updateButtons();
  }

  function updateNotes() {
    const hasClips = LS.state.data.clips.length > 0;
    emptyNote.hidden = hasClips;

    const seconds = LS.audio.totalSeconds();
    if (seconds > WARN_SECONDS) {
      memoryNote.hidden = false;
      memoryNote.textContent =
        'Du har ' + LS.util.formatTime(seconds, 0) + ' lyd i minnet (' +
        LS.util.formatBytes(LS.audio.totalBytes()) +
        '). Over dette kan fana bli treg eller stoppe — vurder å eksportere og halde fram i eit nytt prosjekt.';
    } else {
      memoryNote.hidden = true;
    }
  }

  function updateButtons() {
    LS.uiToolbar.updateButtons();
  }

  /* ──────────────── Skrolling som følgjer spelehovudet ──────────────── */

  /**
   * Held spelehovudet synleg under avspeling. Vi flyttar biletet eit
   * heilt hopp om gongen i staden for å skyve det pikselvis — det er
   * langt lettare å lese enn ei tidslinje som glir konstant.
   */
  function followPlayhead(seconds) {
    const view = LS.state.data.view;
    const widthSec = scrollBox.clientWidth / view.pxPerSec;
    const left = view.scrollSec;
    const right = left + widthSec;

    if (seconds >= left + widthSec * 0.9) {
      setScrollTo(seconds - widthSec * 0.15);
    } else if (seconds < left) {
      setScrollTo(seconds - widthSec * 0.15);
    } else if (seconds > right) {
      setScrollTo(seconds - widthSec * 0.15);
    }
  }

  function setScrollTo(seconds) {
    const view = LS.state.data.view;
    syncScrollWidth();
    scrollBox.scrollLeft = Math.max(0, seconds) * view.pxPerSec;
    LS.state.setScroll(scrollBox.scrollLeft / view.pxPerSec);
  }

  /* ──────────────── Import ──────────────── */

  /**
   * Les inn filer og legg dei som klipp.
   * @param {File[]} files
   * @param {object|null} target { trackId, time } — der brukaren slepte dei
   */
  function importFiles(files, target) {
    const audioFiles = Array.from(files).filter(f => /^audio\//.test(f.type) || /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba|webm)$/i.test(f.name));
    if (!audioFiles.length) {
      LS.util.toast('Fann ingen lydfiler. Prøv mp3, wav eller ogg.');
      return;
    }
    if (!LS.audio.isSupported()) {
      LS.util.toast('Nettlesaren din støttar ikkje Web Audio.');
      return;
    }

    LS.util.toast(audioFiles.length === 1
      ? 'Les inn lyd …'
      : 'Les inn ' + audioFiles.length + ' filer …');

    let trackId = target && target.trackId;
    let time = target ? Math.max(0, target.time) : null;

    // Filene blir lagde inn i tur og orden, så rekkjefølgja blir føreseieleg.
    audioFiles.reduce((chain, file) => chain.then(() => {
      return LS.audio.decodeFile(file).then((source) => {
        if (!LS.state.data.tracks.length) LS.state.addTrack();
        let track = trackId ? LS.state.getTrack(trackId) : null;
        if (!track) track = LS.state.data.tracks[0];

        const wanted = time == null ? LS.state.trackEnd(track.id) : time;
        // Slepp du fila oppå noko som alt ligg der, glir ho til næraste
        // ledige plass i staden for å leggje seg over.
        let start = LS.state.fitInTrack(track.id, wanted, source.duration, null);
        if (start == null) {
          // Ikkje plass på sporet — legg klippet etter alt som ligg der.
          start = LS.state.trackEnd(track.id);
        }
        const clip = LS.state.makeClip(source.id, track.id, start, 0, source.duration, source.name);
        LS.state.addClip(clip);

        // Neste fil legg seg etter denne, uansett korleis den første kom inn.
        trackId = track.id;
        time = start + source.duration;

        LS.state.emit('clips');
      });
    }), Promise.resolve())
      .then(() => LS.util.toast('Lyden er lagt inn.'))
      .catch((err) => LS.util.toast(err.message || 'Klarte ikkje lese lydfila.'));
  }

  /* ──────────────── Drag og slepp ──────────────── */

  function bindDrop() {
    const zone = document.getElementById('editor');

    ['dragenter', 'dragover'].forEach(type => {
      zone.addEventListener(type, (e) => {
        if (!e.dataTransfer || Array.from(e.dataTransfer.types).indexOf('Files') === -1) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        zone.classList.add('ls-drop-active');
      });
    });

    ['dragleave', 'dragend'].forEach(type => {
      zone.addEventListener(type, (e) => {
        if (e.target !== zone && zone.contains(e.relatedTarget)) return;
        zone.classList.remove('ls-drop-active');
      });
    });

    zone.addEventListener('drop', (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      zone.classList.remove('ls-drop-active');

      // Punktet der fila blei slept avgjer spor og starttid.
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const track = (x >= 0 && y >= 0) ? LS.render.trackAtY(y) : null;
      const target = track ? { trackId: track.id, time: LS.render.xToTime(x) } : null;

      importFiles(e.dataTransfer.files, target);
    });
  }

  /* ──────────────── Zoom og skrolling ──────────────── */

  function applyZoom(factor, anchorX) {
    const view = LS.state.data.view;
    // Hald tida under peikaren i ro, så zooming ikkje kastar deg ut av kurs.
    const x = anchorX == null ? scrollBox.clientWidth / 2 : anchorX;
    const anchorTime = LS.render.xToTime(x);

    LS.state.setZoom(view.pxPerSec * factor);
    LS.state.setScroll(anchorTime - x / view.pxPerSec);

    syncScrollWidth();
    scrollBox.scrollLeft = view.scrollSec * view.pxPerSec;
    LS.state.setScroll(scrollBox.scrollLeft / view.pxPerSec);
    LS.render.schedule();
    updateButtons();
  }

  function bindZoomAndScroll() {
    scrollBox.addEventListener('scroll', () => {
      LS.state.setScroll(scrollBox.scrollLeft / LS.state.data.view.pxPerSec);
      LS.render.schedule();
    });

    // Ctrl + hjul zoomar, slik ein er van med frå kart og biletprogram.
    scrollBox.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      applyZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left);
    }, { passive: false });
  }

  /* ──────────────── Spelehovudet ──────────────── */

  function bindPlayhead() {
    let scrubbing = false;

    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y > LS.render.RULER_H) return;     // klipp-interaksjon kjem i eit seinare steg

      scrubbing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* held fram utan fangst */ }
      LS.uiToolbar.seek(LS.render.xToTime(e.clientX - rect.left));
    });

    // Dra i tidslinjalen for å leite seg fram. Under draginga flyttar vi
    // berre merket — å starte lyden på nytt for kvar piksel ville knirke.
    canvas.addEventListener('pointermove', (e) => {
      if (!scrubbing) return;
      const rect = canvas.getBoundingClientRect();
      LS.state.setPlayhead(Math.max(0, LS.render.xToTime(e.clientX - rect.left)));
      LS.uiToolbar.updateTime();
      LS.render.schedule();
    });

    function endScrub(e) {
      if (!scrubbing) return;
      scrubbing = false;
      try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      } catch (err) { /* alt sleppt */ }
      LS.uiToolbar.seek(LS.state.data.view.playhead);
    }
    canvas.addEventListener('pointerup', endScrub);
    canvas.addEventListener('pointercancel', endScrub);
  }

  /* ──────────────── Oppstart ──────────────── */

  function bindToolbar() {
    const fileInput = document.getElementById('importFile');
    document.getElementById('importBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) importFiles(fileInput.files, null);
      fileInput.value = '';
    });

    document.getElementById('addTrackBtn').addEventListener('click', () => {
      LS.state.pushUndo();
      LS.state.addTrack();
      LS.state.emit('tracks');
    });
  }

  function start() {
    canvas = document.getElementById('lanesCanvas');
    scrollBox = document.getElementById('lanesScroll');
    spacer = document.getElementById('lanesSpacer');
    emptyNote = document.getElementById('emptyNote');
    memoryNote = document.getElementById('memoryNote');

    LS.render.setCanvas(canvas);
    LS.uiTracks.setHost(document.getElementById('trackHeads'));

    if (!LS.audio.isSupported()) {
      LS.util.toast('Nettlesaren din støttar ikkje Web Audio. Lydskurd treng ein nyare nettlesar.');
    }

    // To spor frå start — dei fleste vil leggje noko oppå noko anna.
    LS.state.addTrack();
    LS.state.addTrack();

    LS.state.onChange(() => refresh());

    LS.uiMix.setup();
    LS.uiClip.setup();
    LS.uiExport.setup();
    LS.uiProject.setup();
    LS.uiToolbar.setup({ onFollow: followPlayhead, onZoom: applyZoom });

    LS.interact.setup(canvas);

    bindToolbar();
    bindDrop();
    bindZoomAndScroll();
    bindPlayhead();

    if (window.ResizeObserver) {
      new ResizeObserver(() => refresh()).observe(scrollBox);
    } else {
      window.addEventListener('resize', refresh);
    }

    // Temabyte endrar alle fargane på canvasen.
    new MutationObserver(() => LS.render.schedule())
      .observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    refresh();
  }

  document.addEventListener('DOMContentLoaded', start);
})();
