/* ══════════════════════════════════════════════
   COLOR.JS — Fargeveljar

   Porta frå rissverk/js/ui-color.js. Grunngjevinga der held her òg:
   nettlesaren sin eigen <input type="color"> ser ulik ut på kvart
   operativsystem og bryt neobrutalisme-uttrykket fullstendig.

   Veljaren arbeider i HSV fordi HSV lèt seg teikne som eit kvadrat og
   ei stripe. Ein RGB-veljar ville krevd tre skyvarar utan synleg
   samanheng med fargen dei lagar.

   Han er eit lån: opnast med open(), gjev frå seg fargar undervegs
   gjennom onPick, og hugsar ikkje kven som spurde.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.color = (function () {
  'use strict';

  let popEl, areaEl, cursorEl, hueEl, hueCursorEl;
  let previewEl, hexEl, swatchesEl;

  let hsv = { h: 210, s: 0.5, v: 0.9 };
  let onPick = null;
  let anchorEl = null;
  let dragging = null;

  const THEME_VARS = [
    '--accent', '--accent2', '--accent3', '--accent4', '--accent5',
    '--bg', '--surface', '--text', '--border'
  ];

  /* Nokre fargar som er trygge på ein QR-kode, uavhengig av tema. */
  const EXTRA = ['#000000', '#1a1a1a', '#ffffff', '#14213d', '#2d6a4f', '#d90429'];

  function attach() {
    popEl = document.getElementById('colorPop');
    areaEl = document.getElementById('colorArea');
    cursorEl = document.getElementById('colorCursor');
    hueEl = document.getElementById('colorHue');
    hueCursorEl = document.getElementById('colorHueCursor');
    previewEl = document.getElementById('colorPreview');
    hexEl = document.getElementById('colorHex');
    swatchesEl = document.getElementById('colorSwatches');
    if (!popEl) return;

    bindArea(areaEl, (u, v) => { hsv.s = u; hsv.v = 1 - v; emit(); });
    bindArea(hueEl, (u) => { hsv.h = u * 360; emit(); });

    areaEl.addEventListener('keydown', (e) => arrowKeys(e, 0.02, (du, dv) => {
      hsv.s = VR.util.clamp(hsv.s + du, 0, 1);
      hsv.v = VR.util.clamp(hsv.v - dv, 0, 1);
      emit();
    }));

    hueEl.addEventListener('keydown', (e) => arrowKeys(e, 4, (du) => {
      hsv.h = (hsv.h + du + 360) % 360;
      emit();
    }));

    hexEl.addEventListener('input', () => {
      const rgb = VR.util.hexToRgb(hexEl.value);
      if (!rgb) return;
      hsv = VR.util.rgbToHsv(rgb.r, rgb.g, rgb.b);
      emit(true);
    });

    /* Eit klikk utanfor lukkar veljaren — men ikkje klikket som opna han. */
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

  function bindArea(node, apply) {
    function pick(e) {
      const r = node.getBoundingClientRect();
      apply(
        VR.util.clamp((e.clientX - r.left) / r.width, 0, 1),
        VR.util.clamp((e.clientY - r.top) / r.height, 0, 1)
      );
    }
    node.addEventListener('pointerdown', (e) => {
      dragging = node;
      VR.util.capturePointer(node, e);
      pick(e);
      e.preventDefault();
    });
    node.addEventListener('pointermove', (e) => { if (dragging === node) pick(e); });
    node.addEventListener('pointerup', (e) => {
      dragging = null;
      VR.util.releasePointer(node, e);
    });
  }

  function currentHex() {
    const rgb = VR.util.hsvToRgb(hsv.h, hsv.s, hsv.v);
    return VR.util.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function emit(fromHex) {
    const hex = currentHex();
    paint(hex, fromHex);
    if (onPick) onPick(hex);
  }

  function paint(hex, skipHexField) {
    const pure = VR.util.hsvToRgb(hsv.h, 1, 1);
    areaEl.style.background =
      'linear-gradient(to top, #000, transparent), ' +
      'linear-gradient(to right, #fff, ' + VR.util.rgbToHex(pure.r, pure.g, pure.b) + ')';

    cursorEl.style.left = (hsv.s * 100) + '%';
    cursorEl.style.top = ((1 - hsv.v) * 100) + '%';
    hueCursorEl.style.left = (hsv.h / 360 * 100) + '%';

    previewEl.style.background = hex;
    if (!skipHexField) hexEl.value = hex;

    areaEl.setAttribute('aria-valuenow', Math.round(hsv.v * 100));
    hueEl.setAttribute('aria-valuenow', Math.round(hsv.h));
  }

  function buildSwatches() {
    VR.util.clear(swatchesEl);
    const seen = {};
    THEME_VARS.forEach((name) => {
      const hex = VR.util.themeColor(name);
      if (hex) addSwatch(hex, seen);
    });
    EXTRA.forEach(hex => addSwatch(hex, seen));
  }

  function addSwatch(hex, seen) {
    if (seen[hex]) return;
    seen[hex] = true;
    const btn = VR.util.el('button', 'vr-swatch vr-swatch-tiny');
    btn.type = 'button';
    btn.style.background = hex;
    btn.title = hex;
    btn.setAttribute('aria-label', 'Farge ' + hex);
    btn.addEventListener('click', () => {
      const rgb = VR.util.hexToRgb(hex);
      hsv = VR.util.rgbToHsv(rgb.r, rgb.g, rgb.b);
      emit();
    });
    swatchesEl.appendChild(btn);
  }

  /**
   * @param {HTMLElement} anchor knappen veljaren skal stå ved
   * @param {string} startHex fargen han skal starte på
   * @param {function} pick blir kalla med hex for kvar endring
   */
  function open(anchor, startHex, pick) {
    if (!popEl) return;
    anchorEl = anchor;
    onPick = pick;

    const rgb = VR.util.hexToRgb(startHex) || { r: 26, g: 26, b: 26 };
    hsv = VR.util.rgbToHsv(rgb.r, rgb.g, rgb.b);

    buildSwatches();
    popEl.hidden = false;
    paint(currentHex());
    place();
    hexEl.focus();
    hexEl.select();
  }

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

  function isOpen() { return popEl && !popEl.hidden; }

  return { attach, open, close, isOpen };
})();
