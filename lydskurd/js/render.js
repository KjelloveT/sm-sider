/* ══════════════════════════════════════════════
   RENDER.JS — Teiknar tidslinja på canvas

   Alt som er synleg i redigeringsflata — tidslinjal, spor-baner,
   klipp, bølgjeform og spelehovud — blir teikna her. Sporhovuda til
   venstre er derimot vanleg DOM, fordi dei har knappar og skyveknappar
   som skal kunne nåast med tastaturet.

   Canvasen er berre så brei som vindauget. Skrolling skjer ved at vi
   teiknar på nytt med ei anna starttid, ikkje ved å lage ein enorm
   canvas — nettlesarar har eit tak på nokre titusen pikslar.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.render = (function () {
  'use strict';

  const RULER_H = 34;
  const TRACK_H = 118;      // rom nok til namn, volum, panorering og M/S i hovudet
  const CLIP_HEAD_H = 18;
  const SHADOW = 4;
  const FADE_BAND = 16;     // høgda på bandet der fade-greipa kan takast
  const HANDLE = 7;         // halve breidda på eit greip

  /* Fire klippfargar som går på omgang etter spor, med den tekstfargen
     kvar av dei krev. Sjå AGENTS.md §3.2 — feil par gjev usynleg tekst.
     --accent2 er med vilje halden utanfor: han er reservert til
     spelehovudet og til kanten rundt valde klipp, og eit klipp med
     accent2-fyll ville då fått ein usynleg utvalskant. */
  const CLIP_COLORS = [
    { fill: '--accent',  text: '--text-on-accent' },
    { fill: '--accent3', text: '--text-on-light-accent' },
    { fill: '--accent4', text: '--text-on-light-accent' },
    { fill: '--accent5', text: '--text-on-light-accent' }
  ];

  let canvas = null;
  let ctx2d = null;
  let cssWidth = 0;
  let cssHeight = 0;

  /* ──────────────── Oppsett ──────────────── */

  function setCanvas(node) {
    canvas = node;
    ctx2d = node.getContext('2d');
  }

  /** Tilpassar canvasen til containeren og til skjermens pikseltettleik. */
  function resize(widthCss) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const trackCount = Math.max(1, LS.state.data.tracks.length);
    cssWidth = Math.max(120, Math.floor(widthCss));
    cssHeight = RULER_H + trackCount * TRACK_H;

    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function height() { return cssHeight; }
  function width() { return cssWidth; }
  function trackHeight() { return TRACK_H; }
  function rulerHeight() { return RULER_H; }

  /* ──────────────── Koordinatar ──────────────── */

  function timeToX(seconds) {
    const view = LS.state.data.view;
    return (seconds - view.scrollSec) * view.pxPerSec;
  }

  function xToTime(x) {
    const view = LS.state.data.view;
    return view.scrollSec + x / view.pxPerSec;
  }

  function trackTop(index) {
    return RULER_H + index * TRACK_H;
  }

  /** Kva spor ligg under denne y-verdien? Null over tidslinjalen. */
  function trackAtY(y) {
    if (y < RULER_H) return null;
    const index = Math.floor((y - RULER_H) / TRACK_H);
    return LS.state.data.tracks[index] || null;
  }

  /** Øvste klipp under punktet, eller null. */
  function clipAt(x, y) {
    const track = trackAtY(y);
    if (!track) return null;
    const time = xToTime(x);
    const hits = LS.state.clipsOnTrack(track.id)
      .filter(c => time >= c.timeStart && time <= LS.state.clipEnd(c));
    return hits.length ? hits[hits.length - 1] : null;
  }

  /**
   * Ligg punktet på eit fade-greip? Greipa bur i eit smalt band under
   * namnebandet, så resten av klippehøgda framleis er fri til å dra og
   * trimme.
   * @returns {'fadeIn'|'fadeOut'|null}
   */
  function fadeHandleAt(clip, x, y) {
    const index = LS.state.trackIndex(clip.trackId);
    if (index === -1) return null;

    const bodyTop = trackTop(index) + 6 + CLIP_HEAD_H;
    if (y < bodyTop || y > bodyTop + FADE_BAND) return null;

    const pps = LS.state.data.view.pxPerSec;
    const x0 = timeToX(clip.timeStart);
    const x1 = x0 + clip.srcLen * pps;

    const inX = x0 + Math.max(0, clip.fadeIn || 0) * pps;
    const outX = x1 - Math.max(0, clip.fadeOut || 0) * pps;

    // Ligg dei to oppå kvarandre, vinn den som er nærast peikaren.
    const dIn = Math.abs(x - inX);
    const dOut = Math.abs(x - outX);
    if (dIn <= HANDLE && dIn <= dOut) return 'fadeIn';
    if (dOut <= HANDLE) return 'fadeOut';
    return null;
  }

  /* ──────────────── Fargar ──────────────── */

  /* Temaet kan bytast når som helst, så fargane blir lesne på nytt for
     kvar full teikning. Éin getComputedStyle per frame er billeg nok. */
  function readColors() {
    const cs = getComputedStyle(document.body);
    const get = (name) => cs.getPropertyValue(name).trim() || '#000';
    const colors = {
      bg: get('--bg'),
      surface: get('--surface'),
      text: get('--text'),
      border: get('--border'),
      muted: get('--muted'),
      shadow: get('--shadow'),
      accent2: get('--accent2'),
      clips: CLIP_COLORS.map(c => ({ fill: get(c.fill), text: get(c.text) }))
    };
    return colors;
  }

  /* ──────────────── Tidslinjal ──────────────── */

  const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

  /** Minste steg som gjev minst 64 px mellom to merke. */
  function tickStep(pxPerSec) {
    for (let i = 0; i < TICK_STEPS.length; i++) {
      if (TICK_STEPS[i] * pxPerSec >= 64) return TICK_STEPS[i];
    }
    return TICK_STEPS[TICK_STEPS.length - 1];
  }

  function drawRuler(c) {
    const view = LS.state.data.view;
    const step = tickStep(view.pxPerSec);
    const minor = step / 4;

    c.fillStyle = colors.surface;
    c.fillRect(0, 0, cssWidth, RULER_H);

    c.strokeStyle = colors.border;
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, RULER_H - 1.5);
    c.lineTo(cssWidth, RULER_H - 1.5);
    c.stroke();

    const firstMinor = Math.floor(view.scrollSec / minor) * minor;
    const lastTime = xToTime(cssWidth);

    c.lineWidth = 1;
    c.strokeStyle = colors.muted;
    c.beginPath();
    for (let t = firstMinor; t <= lastTime; t += minor) {
      if (t < 0) continue;
      const x = Math.round(timeToX(t)) + 0.5;
      c.moveTo(x, RULER_H - 9);
      c.lineTo(x, RULER_H - 3);
    }
    c.stroke();

    const firstMajor = Math.floor(view.scrollSec / step) * step;
    c.lineWidth = 2;
    c.strokeStyle = colors.border;
    c.fillStyle = colors.text;
    c.font = '700 11px "Segoe UI", system-ui, sans-serif';
    c.textBaseline = 'top';
    c.textAlign = 'left';
    c.beginPath();
    for (let t = firstMajor; t <= lastTime; t += step) {
      if (t < 0) continue;
      const x = Math.round(timeToX(t)) + 0.5;
      c.moveTo(x, RULER_H - 15);
      c.lineTo(x, RULER_H - 3);
    }
    c.stroke();
    for (let t = firstMajor; t <= lastTime; t += step) {
      if (t < 0) continue;
      const label = step < 1 ? LS.util.formatTime(t, 2) : LS.util.formatTick(t);
      c.fillText(label, Math.round(timeToX(t)) + 4, 5);
    }
  }

  /* ──────────────── Spor-baner ──────────────── */

  function drawLanes(c) {
    const tracks = LS.state.data.tracks;
    for (let i = 0; i < tracks.length; i++) {
      const top = trackTop(i);
      c.fillStyle = i % 2 === 0 ? colors.bg : colors.surface;
      c.fillRect(0, top, cssWidth, TRACK_H);
      c.strokeStyle = colors.border;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, top + TRACK_H - 1);
      c.lineTo(cssWidth, top + TRACK_H - 1);
      c.stroke();
    }

    // Rutenett i takt med tidslinjalen, så auget kan følgje tida nedover.
    const view = LS.state.data.view;
    const step = tickStep(view.pxPerSec);
    const lastTime = xToTime(cssWidth);
    const first = Math.floor(view.scrollSec / step) * step;
    c.strokeStyle = colors.muted;
    c.globalAlpha = 0.35;
    c.lineWidth = 1;
    c.beginPath();
    for (let t = first; t <= lastTime; t += step) {
      if (t < 0) continue;
      const x = Math.round(timeToX(t)) + 0.5;
      c.moveTo(x, RULER_H);
      c.lineTo(x, cssHeight);
    }
    c.stroke();
    c.globalAlpha = 1;
  }

  /* ──────────────── Klipp ──────────────── */

  function drawWaveform(c, clip, source, x0, x1, top, bottom) {
    const peaks = source.peaks;
    if (!peaks) return;

    const view = LS.state.data.view;
    const mid = (top + bottom) / 2;
    const half = (bottom - top) / 2 - 2;
    const clipX = timeToX(clip.timeStart);
    const secPerPx = 1 / view.pxPerSec;

    c.beginPath();
    for (let x = Math.floor(x0); x < x1; x++) {
      const tIn = (x - clipX) * secPerPx;
      const from = clip.srcStart + tIn;
      const range = LS.peaks.rangeAt(peaks, from, from + secPerPx);
      const yTop = mid - range.max * half;
      const yBot = mid - range.min * half;
      const px = x + 0.5;
      c.moveTo(px, yTop);
      c.lineTo(px, Math.max(yBot, yTop + 1));
    }
    c.stroke();
  }

  /**
   * Teiknar inn- og utfading som skraverte kilar over bølgjeforma, med eit
   * firkanta greip på vippepunktet. Kilen dekkjer det som blir dempa bort,
   * så det er lett å sjå kor mykje lyd fadinga faktisk et opp.
   */
  function drawFades(c, clip, palette, x, w, bodyTop, bodyBottom) {
    const pps = LS.state.data.view.pxPerSec;
    const fadeIn = Math.max(0, clip.fadeIn || 0);
    const fadeOut = Math.max(0, clip.fadeOut || 0);
    if (!fadeIn && !fadeOut) return;

    c.save();
    c.beginPath();
    c.rect(x, bodyTop, w, bodyBottom - bodyTop);
    c.clip();

    c.fillStyle = colors.border;
    c.globalAlpha = 0.42;
    if (fadeIn > 0) {
      const fw = fadeIn * pps;
      c.beginPath();
      c.moveTo(x, bodyTop);
      c.lineTo(x + fw, bodyTop);
      c.lineTo(x, bodyBottom);
      c.closePath();
      c.fill();
    }
    if (fadeOut > 0) {
      const fw = fadeOut * pps;
      c.beginPath();
      c.moveTo(x + w, bodyTop);
      c.lineTo(x + w - fw, bodyTop);
      c.lineTo(x + w, bodyBottom);
      c.closePath();
      c.fill();
    }
    c.globalAlpha = 1;

    // Sjølve konvolutt-linja
    c.strokeStyle = palette.text;
    c.lineWidth = 2;
    c.beginPath();
    if (fadeIn > 0) {
      c.moveTo(x, bodyBottom);
      c.lineTo(x + fadeIn * pps, bodyTop);
    }
    if (fadeOut > 0) {
      c.moveTo(x + w - fadeOut * pps, bodyTop);
      c.lineTo(x + w, bodyBottom);
    }
    c.stroke();
    c.restore();

    // Greipa — små firkantar, som resten av designspråket
    const handles = [];
    if (fadeIn > 0) handles.push(x + fadeIn * pps);
    if (fadeOut > 0) handles.push(x + w - fadeOut * pps);
    handles.forEach((hx) => {
      c.fillStyle = palette.fill;
      c.fillRect(hx - 4, bodyTop, 8, 8);
      c.strokeStyle = colors.border;
      c.lineWidth = 2;
      c.strokeRect(hx - 4, bodyTop + 1, 8, 8);
    });
  }

  function drawClip(c, clip, trackIdx) {
    const source = LS.audio.getSource(clip.sourceId);
    const palette = colors.clips[trackIdx % colors.clips.length];

    const x = timeToX(clip.timeStart);
    const w = clip.srcLen * LS.state.data.view.pxPerSec;
    if (x + w < -SHADOW || x > cssWidth) return;   // heilt utanfor biletet

    const top = trackTop(trackIdx) + 6;
    const bottom = trackTop(trackIdx) + TRACK_H - 8;
    const h = bottom - top;
    const selected = LS.state.isSelected(clip.id);

    // Hard skugge, ingen mjuking — neobrutalisme.
    c.fillStyle = colors.shadow;
    c.fillRect(x + SHADOW, top + SHADOW, w, h);

    c.fillStyle = palette.fill;
    c.fillRect(x, top, w, h);

    // Namneband øvst
    c.fillStyle = colors.border;
    c.globalAlpha = 0.18;
    c.fillRect(x, top, w, CLIP_HEAD_H);
    c.globalAlpha = 1;

    // Bølgjeforma, klipt til klippet
    c.save();
    c.beginPath();
    c.rect(x, top + CLIP_HEAD_H, w, h - CLIP_HEAD_H);
    c.clip();
    c.strokeStyle = palette.text;
    c.lineWidth = 1;
    const x0 = Math.max(0, x);
    const x1 = Math.min(cssWidth, x + w);
    if (source && x1 > x0) {
      drawWaveform(c, clip, source, x0, x1, top + CLIP_HEAD_H + 3, bottom - 3);
    }
    c.restore();

    // Fade-konvolutt oppå bølgjeforma
    drawFades(c, clip, palette, x, w, top + CLIP_HEAD_H, bottom);

    // Kantlinje
    c.strokeStyle = selected ? colors.accent2 : colors.border;
    c.lineWidth = selected ? 5 : 3;
    c.strokeRect(x + c.lineWidth / 2, top + c.lineWidth / 2, w - c.lineWidth, h - c.lineWidth);

    // Namn
    if (w > 44) {
      c.save();
      c.beginPath();
      c.rect(x + 5, top, w - 10, CLIP_HEAD_H);
      c.clip();
      c.fillStyle = palette.text;
      c.font = '700 11px "Segoe UI", system-ui, sans-serif';
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillText(clip.name, x + 7, top + CLIP_HEAD_H / 2 + 1);
      c.restore();
    }
  }

  function drawClips(c) {
    const tracks = LS.state.data.tracks;
    for (let i = 0; i < tracks.length; i++) {
      const clips = LS.state.clipsOnTrack(tracks[i].id);
      for (let j = 0; j < clips.length; j++) drawClip(c, clips[j], i);
    }
  }

  /* ──────────────── Spelehovud ──────────────── */

  function drawPlayhead(c) {
    const x = Math.round(timeToX(LS.state.data.view.playhead)) + 0.5;
    if (x < -8 || x > cssWidth + 8) return;

    c.strokeStyle = colors.accent2;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, RULER_H - 12);
    c.lineTo(x, cssHeight);
    c.stroke();

    // Trekant-handtak i tidslinjalen
    c.fillStyle = colors.accent2;
    c.beginPath();
    c.moveTo(x - 6, RULER_H - 14);
    c.lineTo(x + 6, RULER_H - 14);
    c.lineTo(x, RULER_H - 3);
    c.closePath();
    c.fill();
    c.strokeStyle = colors.border;
    c.lineWidth = 1.5;
    c.stroke();
  }

  /* ──────────────── Full teikning ──────────────── */

  let colors = null;
  let frameQueued = false;

  function draw() {
    if (!ctx2d) return;
    colors = readColors();
    const c = ctx2d;

    c.clearRect(0, 0, cssWidth, cssHeight);
    c.fillStyle = colors.bg;
    c.fillRect(0, 0, cssWidth, cssHeight);

    drawLanes(c);
    drawClips(c);
    drawRuler(c);
    drawPlayhead(c);
  }

  /** Teikn ved neste bilete — trygt å kalle mange gonger på rad. */
  function schedule() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(() => {
      frameQueued = false;
      draw();
    });
  }

  return {
    setCanvas, resize, draw, schedule,
    timeToX, xToTime, trackTop, trackAtY, clipAt, fadeHandleAt,
    gridStep: () => tickStep(LS.state.data.view.pxPerSec),
    height, width, trackHeight, rulerHeight,
    RULER_H, TRACK_H
  };
})();
