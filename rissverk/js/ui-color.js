/* ══════════════════════════════════════════════
   UI-COLOR.JS — Fargeveljar

   Nettlesaren sin eigen <input type="color"> er ikkje brukande her:
   han ser ulik ut på kvart operativsystem, han sprengjer
   neobrutalisme-uttrykket, og han kan ikkje handtere gjennomsikt eller
   «ingen farge» — to ting eit teikneprogram ikkje klarer seg utan.

   Veljaren arbeider i HSV. Det er ikkje fordi HSV er ein betre
   fargemodell enn RGB, men fordi han lèt seg teikne som eit kvadrat og
   ei stripe: metting bortover, lysstyrke nedover, fargetone på sida.
   Ein RGB-veljar ville krevd tre skyvarar utan noka synleg samanheng.

   Veljaren er eit lån: han blir opna med `open()`, gjev frå seg fargar
   undervegs gjennom `onPick`, og hugsar ikkje kven som spurde.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.color = (function () {
  'use strict';

  let popEl, areaEl, cursorEl, hueEl, hueCursorEl;
  let previewEl, hexEl, alphaEl, swatchesEl;

  let hsv = { h: 210, s: 0.5, v: 0.9 };
  let alpha = 1;
  let onPick = null;
  let anchorEl = null;
  let dragging = null;

  /* Fargane frå temaet, i den rekkjefølgja dei er meint å brukast. */
  const THEME_VARS = [
    '--accent', '--accent2', '--accent3', '--accent4', '--accent5',
    '--bg', '--surface', '--text', '--border', '--muted'
  ];

  const EXTRA = ['#ffffff', '#000000'];

  /* ──────────────── Oppsett ──────────────── */

  function attach() {
    popEl = document.getElementById('colorPop');
    areaEl = document.getElementById('colorArea');
    cursorEl = document.getElementById('colorCursor');
    hueEl = document.getElementById('colorHue');
    hueCursorEl = document.getElementById('colorHueCursor');
    previewEl = document.getElementById('colorPreview');
    hexEl = document.getElementById('colorHex');
    alphaEl = document.getElementById('colorAlpha');
    swatchesEl = document.getElementById('colorSwatches');

    bindArea(areaEl, (u, v) => {
      hsv.s = u;
      hsv.v = 1 - v;
      emit();
    });

    bindArea(hueEl, (u) => {
      hsv.h = u * 360;
      emit();
    });

    areaEl.addEventListener('keydown', (e) => arrowKeys(e, 0.02, (du, dv) => {
      hsv.s = RV.util.clamp(hsv.s + du, 0, 1);
      hsv.v = RV.util.clamp(hsv.v - dv, 0, 1);
      emit();
    }));

    hueEl.addEventListener('keydown', (e) => arrowKeys(e, 4, (du) => {
      hsv.h = (hsv.h + du + 360) % 360;
      emit();
    }));

    hexEl.addEventListener('input', () => {
      const rgb = RV.util.hexToRgb(hexEl.value);
      if (!rgb) return;
      hsv = RV.util.rgbToHsv(rgb.r, rgb.g, rgb.b);
      emit(true);
    });

    alphaEl.addEventListener('input', () => {
      alpha = parseFloat(alphaEl.value);
      emit();
    });

    // Eit klikk utanfor lukkar veljaren — men ikkje klikket som opna han.
    document.addEventListener('pointerdown', (e) => {
      if (popEl.hidden) return;
      if (popEl.contains(e.target) || (anchorEl && anchorEl.contains(e.target))) return;
      close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !popEl.hidden) { close(); e.stopPropagation(); }
    });

    window.addEventListener('resize', () => { if (!popEl.hidden) place(); });
  }

  function arrowKeys(e, step, apply) {
    const map = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step]
    };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    apply(d[0], d[1]);
  }

  /** Dra i eit felt og få tilbake plasseringa som 0–1 i begge retningar. */
  function bindArea(el, apply) {
    function pick(e) {
      const r = el.getBoundingClientRect();
      apply(
        RV.util.clamp((e.clientX - r.left) / r.width, 0, 1),
        RV.util.clamp((e.clientY - r.top) / r.height, 0, 1)
      );
    }
    el.addEventListener('pointerdown', (e) => {
      dragging = el;
      RV.util.capturePointer(el, e);
      pick(e);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => { if (dragging === el) pick(e); });
    el.addEventListener('pointerup', (e) => {
      dragging = null;
      RV.util.releasePointer(el, e);
    });
  }

  /* ──────────────── Utsjånad ──────────────── */

  function currentHex() {
    const rgb = RV.util.hsvToRgb(hsv.h, hsv.s, hsv.v);
    return RV.util.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /** @param {boolean} fromHex hopp over å skrive i feltet brukaren skriv i */
  function emit(fromHex) {
    const hex = currentHex();
    paint(hex, fromHex);
    if (onPick) onPick(hex, alpha);
  }

  function paint(hex, skipHexField) {
    const pure = RV.util.hsvToRgb(hsv.h, 1, 1);
    areaEl.style.background =
      'linear-gradient(to top, #000, transparent), ' +
      'linear-gradient(to right, #fff, ' + RV.util.rgbToHex(pure.r, pure.g, pure.b) + ')';

    cursorEl.style.left = (hsv.s * 100) + '%';
    cursorEl.style.top = ((1 - hsv.v) * 100) + '%';
    hueCursorEl.style.left = (hsv.h / 360 * 100) + '%';

    previewEl.style.background = hex;
    previewEl.style.opacity = alpha;
    if (!skipHexField) hexEl.value = hex;
    alphaEl.value = alpha;

    areaEl.setAttribute('aria-valuenow', Math.round(hsv.v * 100));
    hueEl.setAttribute('aria-valuenow', Math.round(hsv.h));
  }

  /* ──────────────── Fargar frå temaet ──────────────── */

  function buildSwatches() {
    RV.util.clear(swatchesEl);
    const seen = {};

    THEME_VARS.concat([]).forEach((name) => {
      const hex = RV.util.themeColor(name);
      if (hex) addSwatch(hex, seen);
    });
    EXTRA.forEach(hex => addSwatch(hex, seen));
  }

  function addSwatch(hex, seen) {
    if (seen[hex]) return;
    seen[hex] = true;
    const btn = RV.util.el('button', 'rv-swatch rv-swatch-tiny');
    btn.type = 'button';
    btn.style.background = hex;
    btn.title = hex;
    btn.setAttribute('aria-label', 'Farge ' + hex);
    btn.addEventListener('click', () => {
      const rgb = RV.util.hexToRgb(hex);
      hsv = RV.util.rgbToHsv(rgb.r, rgb.g, rgb.b);
      emit();
    });
    swatchesEl.appendChild(btn);
  }

  /* ──────────────── Opne og lukke ──────────────── */

  /**
   * @param {HTMLElement} anchor knappen veljaren skal stå ved
   * @param {object} paint  { color, opacity } — fargen han skal starte på
   * @param {function} pick blir kalla med (hex, alpha) for kvar endring
   */
  function open(anchor, paint, pick) {
    anchorEl = anchor;
    onPick = pick;

    const rgb = RV.util.hexToRgb(paint && paint.color) || { r: 140, g: 200, b: 230 };
    hsv = RV.util.rgbToHsv(rgb.r, rgb.g, rgb.b);
    alpha = paint && paint.opacity != null ? paint.opacity : 1;

    buildSwatches();
    popEl.hidden = false;
    paintNow();
    place();
    hexEl.focus();
    hexEl.select();
  }

  function paintNow() {
    paint(currentHex());
  }

  /** Legg veljaren under knappen, men held han innanfor vindauget. */
  function place() {
    const r = anchorEl.getBoundingClientRect();
    const w = popEl.offsetWidth;
    const h = popEl.offsetHeight;

    let left = r.left;
    let top = r.bottom + 6;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);

    popEl.style.left = Math.max(8, left) + 'px';
    popEl.style.top = top + 'px';
  }

  function close() {
    popEl.hidden = true;
    onPick = null;
    anchorEl = null;
  }

  function isOpen() {
    return popEl && !popEl.hidden;
  }

  return { attach, open, close, isOpen };
})();
