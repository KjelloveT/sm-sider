/* ══════════════════════════════════════════════
   TRIM.JS — Skjer klippet til

   Vi kastar aldri lyd. Å skjere til er berre å flytte to tal, så du kan
   dra grensene ut att i morgon og få heile opptaket tilbake. Difor er
   det heller ikkje farleg å skjere hardt: blir det for kort, dreg du
   berre handtaket ut igjen.

   Endringane slår inn med ein gong — det er ingen «bruk»-knapp som kan
   gløymast. «Heile klippet» set alt tilbake.
   ══════════════════════════════════════════════ */
window.LB = window.LB || {};

LB.trim = (function () {
  'use strict';

  const HANDLE_GRAB = 14;        // kor mange pikslar unna eit handtak du kan ta

  let overlay = null;
  let canvas = null;
  let titleNode = null;
  let hintNode = null;
  let lengthNode = null;
  let startInput = null;
  let endInput = null;
  let currentId = null;
  let dragging = null;           // 'start' | 'end' | null

  /* ──────────────── Teikning ──────────────── */

  function take() { return currentId ? LB.state.get(currentId) : null; }

  function draw() {
    const t = take();
    if (!t || !canvas.clientWidth) return;

    const ratio = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const styles = getComputedStyle(document.body);
    const ink = styles.getPropertyValue('--text').trim() || '#000000';
    const accent = styles.getPropertyValue('--accent').trim() || '#000000';
    const border = styles.getPropertyValue('--border').trim() || '#000000';

    const seconds = t.buffer.duration;
    const peaks = LB.audio.peaks(t.buffer, Math.max(1, Math.floor(w)));
    const mid = h / 2;

    for (let x = 0; x < Math.floor(w); x++) {
      const at = (x / w) * seconds;
      const inside = at >= t.start && at <= t.end;
      ctx.fillStyle = inside ? accent : ink;
      ctx.globalAlpha = inside ? 1 : 0.2;
      const top = mid - peaks[x * 2 + 1] * (mid - 4);
      const bottom = mid - peaks[x * 2] * (mid - 4);
      ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
    }
    ctx.globalAlpha = 1;

    // Midtlinja, så det synest kor stille er stille.
    ctx.fillStyle = border;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, mid, w, 1);
    ctx.globalAlpha = 1;

    [t.start, t.end].forEach((at) => {
      const x = (at / seconds) * w;
      ctx.fillStyle = border;
      ctx.fillRect(Math.max(0, Math.min(w - 3, x - 1.5)), 0, 3, h);
      ctx.fillRect(Math.max(0, Math.min(w - 12, x - 6)), 0, 12, 8);
      ctx.fillRect(Math.max(0, Math.min(w - 12, x - 6)), h - 8, 12, 8);
    });
  }

  /* ──────────────── Tal og felt ──────────────── */

  function syncFields() {
    const t = take();
    if (!t) return;
    startInput.value = t.start.toFixed(2);
    endInput.value = t.end.toFixed(2);
    startInput.max = t.buffer.duration.toFixed(2);
    endInput.max = t.buffer.duration.toFixed(2);
    lengthNode.textContent = LB.util.formatSeconds(LB.state.lengthOf(t));
    hintNode.textContent = 'Heile opptaket er ' + LB.util.formatSeconds(t.buffer.duration)
      + '. Dra i handtaka, eller skriv tala under.';
  }

  function setTrim(start, end) {
    if (!currentId) return;
    LB.state.setTrim(currentId, start, end);
    syncFields();
    draw();
  }

  /* ──────────────── Drag i kurva ──────────────── */

  function secondsAt(event) {
    const t = take();
    const rect = canvas.getBoundingClientRect();
    const share = LB.util.clamp((event.clientX - rect.left) / rect.width, 0, 1);
    return share * t.buffer.duration;
  }

  function onPointerDown(event) {
    const t = take();
    if (!t) return;
    const rect = canvas.getBoundingClientRect();
    const perSecond = rect.width / t.buffer.duration;
    const x = event.clientX - rect.left;
    const startX = t.start * perSecond;
    const endX = t.end * perSecond;

    // Ligg du mellom handtaka, tek du det næraste. Elles tek du den sida
    // du står på — det er alltid det du meiner.
    if (Math.abs(x - startX) <= HANDLE_GRAB || Math.abs(x - endX) <= HANDLE_GRAB) {
      dragging = Math.abs(x - startX) <= Math.abs(x - endX) ? 'start' : 'end';
    } else {
      dragging = x < startX ? 'start' : (x > endX ? 'end' : (x - startX < endX - x ? 'start' : 'end'));
    }
    canvas.setPointerCapture(event.pointerId);
    onPointerMove(event);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    const t = take();
    const at = secondsAt(event);
    if (dragging === 'start') setTrim(Math.min(at, t.end - 0.02), t.end);
    else setTrim(t.start, Math.max(at, t.start + 0.02));
  }

  function onPointerUp(event) {
    if (!dragging) return;
    dragging = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch (e) {}
  }

  /* ──────────────── Knappane ──────────────── */

  function playSelection() {
    const t = take();
    if (!t) return;
    LB.audio.play(t.buffer, t.start, t.end);
  }

  function playAll() {
    const t = take();
    if (!t) return;
    LB.audio.play(t.buffer, 0, t.buffer.duration);
  }

  function auto() {
    const t = take();
    if (!t) return;
    const bounds = LB.audio.speechBounds(t.buffer);
    setTrim(bounds.start, bounds.end);
  }

  function whole() {
    const t = take();
    if (!t) return;
    setTrim(0, t.buffer.duration);
  }

  /* ──────────────── Opne og lukke ──────────────── */

  function open(id) {
    const t = LB.state.get(id);
    if (!t) return;
    currentId = id;
    const item = LB.state.itemById(id);
    titleNode.textContent = 'Skjer til: ' + (item ? item.label : id);
    LB.util.openModal(overlay);
    syncFields();
    draw();
    // Modalen kan ha fått si endelege breidde først etter at nettlesaren
    // har lagt han ut, så vi teiknar ein gong til når layouten er sett.
    requestAnimationFrame(draw);
  }

  function close() {
    LB.audio.stop();
    currentId = null;
    LB.util.closeModal(overlay);
  }

  function setup() {
    overlay = document.getElementById('trimOverlay');
    canvas = document.getElementById('trimCanvas');
    titleNode = document.getElementById('trimTitle');
    hintNode = document.getElementById('trimHint');
    lengthNode = document.getElementById('trimLength');
    startInput = document.getElementById('trimStart');
    endInput = document.getElementById('trimEnd');

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    startInput.addEventListener('change', () => {
      const t = take();
      if (!t) return;
      setTrim(parseFloat(startInput.value) || 0, t.end);
    });
    endInput.addEventListener('change', () => {
      const t = take();
      if (!t) return;
      setTrim(t.start, parseFloat(endInput.value) || t.buffer.duration);
    });

    document.getElementById('trimPlay').addEventListener('click', playSelection);
    document.getElementById('trimPlayAll').addEventListener('click', playAll);
    document.getElementById('trimAuto').addEventListener('click', auto);
    document.getElementById('trimWhole').addEventListener('click', whole);
    document.getElementById('trimDone').addEventListener('click', close);
    document.getElementById('trimClose').addEventListener('click', close);
    LB.util.bindOverlayClose(overlay);

    window.addEventListener('resize', () => { if (currentId) draw(); });
  }

  return { setup, open, redraw: draw };
})();
