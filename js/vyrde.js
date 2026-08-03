/* ==========================================================================
   Vyrde — maskoten til Vyrdepil
   --------------------------------------------------------------------------
   Held styr på sprite-arket _resources/vyrde.png (4 x 3 ansiktsuttrykk) og
   gjer det enkelt å byte uttrykk. Krev css/vyrde.css.

   Bruk i HTML:
     <span class="vyrde" data-vyrde="wave"></span>
     <span class="vyrde" data-vyrde="wave" data-vyrde-cycle></span>

   Bruk frå JS:
     const v = Vyrde.create({ mood: 'think', size: 90 });
     Vyrde.setMood(v, 'cool');
   ========================================================================== */
(function (global) {
  'use strict';

  const COLS = 4;

  /* Ruta til kvart uttrykk, lest radvis frå sprite-arket. */
  const MOODS = {
    wave: 0, happy: 1, think: 2, surprised: 3,
    shock: 4, angry: 5, sad: 6, tired: 7,
    dizzy: 8, wink: 9, scared: 10, cool: 11
  };

  /* Eldre/alternative namn som er i bruk rundt om i spela. */
  const ALIASES = {
    default: 'wave', hello: 'wave',
    cheer: 'happy', glad: 'happy',
    shout: 'surprised', oops: 'shock'
  };

  /* Logoen syklar gjennom dei fire uttrykka på fyrste lina i arket. */
  const LOGO_MOODS = ['wave', 'happy', 'think', 'surprised'];
  const CYCLE_MS = 30000;

  /* Same knep som neo-header.js: finn rota ut frå stien til dette scriptet. */
  const scriptTag = document.querySelector('script[src*="vyrde.js"]');
  const scriptSrc = scriptTag ? scriptTag.getAttribute('src') : '';
  const BASE = scriptSrc.startsWith('../') ? '../' : '';
  const SPRITE = BASE + '_resources/vyrde.png';

  function frameOf(mood) {
    const name = ALIASES[mood] || mood;
    return name in MOODS ? MOODS[name] : MOODS.wave;
  }

  /** Set uttrykk på eit .vyrde-element. */
  function setMood(el, mood) {
    if (!el) return;
    const frame = frameOf(mood);
    el.style.setProperty('--vyrde-col', frame % COLS);
    el.style.setProperty('--vyrde-row', Math.floor(frame / COLS));
    el.dataset.vyrde = ALIASES[mood] || mood;
    el.classList.add('is-changing');
    setTimeout(() => el.classList.remove('is-changing'), 180);
  }

  /** Lag biletet inne i eit .vyrde-element som ikkje har det frå før. */
  function fill(el) {
    if (el.querySelector('.vyrde-img')) return;
    const img = document.createElement('img');
    img.className = 'vyrde-img';
    img.src = el.dataset.vyrdeSrc || SPRITE;
    img.alt = el.dataset.vyrdeAlt || 'Vyrde, maskoten til Vyrdepil';
    img.decoding = 'async';
    el.appendChild(img);
  }

  /** Byggjer eit ferdig maskot-element. */
  function create(opts) {
    opts = opts || {};
    const el = document.createElement('span');
    el.className = 'vyrde' + (opts.className ? ' ' + opts.className : '');
    if (opts.alt) el.dataset.vyrdeAlt = opts.alt;
    if (opts.src) el.dataset.vyrdeSrc = opts.src;
    if (opts.size) el.style.width = typeof opts.size === 'number' ? opts.size + 'px' : opts.size;
    fill(el);
    setMood(el, opts.mood || 'wave');
    if (opts.cycle) cycle(el, opts.moods);
    return el;
  }

  /**
   * Lèt elementet skifte uttrykk med jamne mellomrom. Står brukaren i
   * «redusert rørsle», blir det med det fyrste uttrykket.
   */
  function cycle(el, moods, intervalMs) {
    const list = moods && moods.length ? moods : LOGO_MOODS;
    setMood(el, list[0]);
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let i = 0;
    const id = setInterval(() => {
      if (!el.isConnected) { clearInterval(id); return; }
      i = (i + 1) % list.length;
      setMood(el, list[i]);
    }, intervalMs || CYCLE_MS);
    return id;
  }

  /** Fyll alle .vyrde-element under root (fungerer òg i ein shadow root). */
  function hydrate(root) {
    (root || document).querySelectorAll('.vyrde').forEach(el => {
      fill(el);
      const moods = el.dataset.vyrdeCycle
        ? el.dataset.vyrdeCycle.split(/[,\s]+/).filter(Boolean)
        : null;
      if (el.dataset.vyrdeCycle !== undefined) cycle(el, moods);
      else setMood(el, el.dataset.vyrde || 'wave');
    });
  }

  global.Vyrde = { MOODS, ALIASES, LOGO_MOODS, SPRITE, create, setMood, cycle, hydrate, frameOf };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => hydrate());
  } else {
    hydrate();
  }
})(window);
