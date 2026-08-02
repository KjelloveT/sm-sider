/* clock.js — analog urskive (SVG) med statisk + interaktiv (dra visarane)
   modus, og digital LCD. Fargar via CSS-variablar (style) slik at begge
   tema fungerer. Port frå designet sin clock.jsx. */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const C = 120, R = 112;

  function S(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  // Utskriftspalett: på papir gjev CSS-variablane gråtoner eller ingenting, så
  // vi byter til litterale verdiar — svart strek på kvitt, ingen aksentfargar.
  const PRINT_PALETTE = {
    'var(--ink)':     '#1a1a1a',
    'var(--surface)': '#ffffff',
    'var(--shadow)':  'none',
    'var(--teal)':    '#1a1a1a',
    'var(--pink)':    '#1a1a1a',
    'var(--yellow)':  '#1a1a1a',
    'var(--blue)':    '#1a1a1a',
    'var(--purple)':  '#1a1a1a'
  };
  function paletteFor(print) {
    if (!print) return function (token) { return token; };
    return function (token) { return PRINT_PALETTE[token] || '#1a1a1a'; };
  }

  function setStroke(el, v) { el.style.stroke = v; }
  function setFill(el, v) { el.style.fill = v; }

  function handAngle(t) { return { hour: ((t.h % 12) + t.m / 60) * 30, min: t.m * 6 }; }

  // byggjer ein visar-gruppe (omriss + farga kjerne + valfri gripeknott)
  function buildHand(opts) {
    const g = S('g');
    const pal = opts.pal || function (t) { return t; };
    const tail = opts.tail != null ? opts.tail : 22;
    const outer = S('line', {
      x1: C, y1: C + tail, x2: C, y2: C - opts.len,
      'stroke-width': opts.outerW, 'stroke-linecap': 'round'
    });
    setStroke(outer, pal('var(--ink)'));
    if (opts.dashed) { outer.setAttribute('stroke-dasharray', '2 9'); outer.setAttribute('opacity', '.5'); }
    g.appendChild(outer);
    if (!opts.dashed) {
      const core = S('line', {
        x1: C, y1: C + tail, x2: C, y2: C - opts.len,
        'stroke-width': opts.innerW, 'stroke-linecap': 'round'
      });
      setStroke(core, pal(opts.color));
      g.appendChild(core);
    }
    if (opts.handle) {
      const knob = S('circle', { cx: C, cy: C - opts.len, r: 13, 'stroke-width': 3.5 });
      setFill(knob, pal('var(--surface)')); setStroke(knob, pal('var(--ink)'));
      knob.classList.add('tv-knob');
      const dot = S('circle', { cx: C, cy: C - opts.len, r: 3.4 });
      setFill(dot, pal('var(--ink)'));
      g.appendChild(knob); g.appendChild(dot);
    }
    return g;
  }

  // statisk eller interaktiv analog klokke
  function analog(opts) {
    opts = opts || {};
    const size = opts.size || 240;
    const accent = 'var(--' + (opts.accent || 'pink') + ')';
    const print = !!opts.print;
    const pal = paletteFor(print);
    const showHands = opts.hands !== false;   // 'Teikn visarane' vil ha tom skive
    const state = { h: opts.h != null ? opts.h : 10, m: opts.m != null ? opts.m : 8 };

    const svg = S('svg', { viewBox: '0 0 240 240', width: size, height: size });
    svg.style.display = 'block'; svg.style.maxWidth = '100%'; svg.style.height = 'auto'; svg.style.touchAction = 'none';

    // skugge + skive (skuggen droppast på papir)
    if (!print) {
      const shadow = S('circle', { cx: C + 7, cy: C + 7, r: R }); setFill(shadow, 'var(--shadow)'); svg.appendChild(shadow);
    }
    const face = S('circle', { cx: C, cy: C, r: R, 'stroke-width': 6.5 }); setFill(face, pal('var(--surface)')); setStroke(face, pal('var(--ink)')); svg.appendChild(face);
    const ring = S('circle', { cx: C, cy: C, r: R - 12, fill: 'none', 'stroke-width': 1.4, opacity: .25 }); setStroke(ring, pal('var(--ink)')); svg.appendChild(ring);

    // tick-merke
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      const a = (i * 6) * Math.PI / 180;
      const r1 = R - (big ? 18 : 9), r2 = R - 4;
      const line = S('line', {
        x1: C + r1 * Math.sin(a), y1: C - r1 * Math.cos(a),
        x2: C + r2 * Math.sin(a), y2: C - r2 * Math.cos(a),
        'stroke-width': big ? 5 : 2.4, 'stroke-linecap': 'round'
      });
      setStroke(line, pal('var(--ink)')); svg.appendChild(line);
    }
    // tal 1..12
    for (let n = 1; n <= 12; n++) {
      const a = (n * 30) * Math.PI / 180, rr = R - 36;
      const txt = S('text', {
        x: C + rr * Math.sin(a), y: C - rr * Math.cos(a),
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-weight': '700', 'font-size': '24'
      });
      txt.style.fontFamily = print ? 'Georgia, "Times New Roman", serif' : 'var(--serif)';
      setFill(txt, pal('var(--ink)'));
      txt.textContent = String(n);
      svg.appendChild(txt);
    }

    // mål-visarar (ghost)
    if (opts.target) {
      const ta = handAngle(opts.target);
      const th = buildHand({ angle: 0, len: 62, outerW: 11, dashed: true, pal: pal });
      th.setAttribute('transform', 'rotate(' + ta.hour + ' ' + C + ' ' + C + ')'); svg.appendChild(th);
      const tm = buildHand({ angle: 0, len: 92, outerW: 8, dashed: true, pal: pal });
      tm.setAttribute('transform', 'rotate(' + ta.min + ' ' + C + ' ' + C + ')'); svg.appendChild(tm);
    }

    // aktive visarar
    let hourG = null, minG = null;
    if (showHands) {
      hourG = buildHand({ len: 60, outerW: 15, innerW: 7, color: 'var(--teal)', handle: !!opts.draggable, pal: pal });
      minG = buildHand({ len: 92, outerW: 11, innerW: 5, color: accent, handle: !!opts.draggable, pal: pal });
      // teikn minuttvisaren (lang) først, så timevisaren (kort) ligg oppå og ikkje blir skjult
      svg.appendChild(minG); svg.appendChild(hourG);
    }

    // nav — står att sjølv utan visarar, som teiknepunkt for eleven
    const nav = S('circle', { cx: C, cy: C, r: 11 }); setFill(nav, pal('var(--ink)')); svg.appendChild(nav);
    const navDot = S('circle', { cx: C, cy: C, r: 4.5 }); setFill(navDot, pal('var(--surface)')); svg.appendChild(navDot);

    function render() {
      if (!showHands) return;
      const a = handAngle(state);
      hourG.setAttribute('transform', 'rotate(' + a.hour + ' ' + C + ' ' + C + ')');
      minG.setAttribute('transform', 'rotate(' + a.min + ' ' + C + ' ' + C + ')');
    }
    render();

    // ---- interaksjon ----
    if (opts.draggable) {
      const snap = opts.snapStep || 1;
      let dragging = null; // 'hour' | 'min'

      function angleAt(ev) {
        const rect = svg.getBoundingClientRect();
        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        const dx = ev.clientX - cx, dy = ev.clientY - cy;
        let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
        if (deg < 0) deg += 360;
        return deg;
      }
      function nearestHand(ev) {
        // vel visaren med tipp nærast peikaren
        const rect = svg.getBoundingClientRect();
        const scale = rect.width / 240;
        function tip(len, angle) {
          const rad = angle * Math.PI / 180;
          return {
            x: rect.left + (C + len * Math.sin(rad)) * scale,
            y: rect.top + (C - len * Math.cos(rad)) * scale
          };
        }
        const a = handAngle(state);
        const ph = tip(60, a.hour), pm = tip(92, a.min);
        const dh = Math.hypot(ev.clientX - ph.x, ev.clientY - ph.y);
        const dm = Math.hypot(ev.clientX - pm.x, ev.clientY - pm.y);
        return dm <= dh ? 'min' : 'hour';
      }
      function applyAngle(deg) {
        if (dragging === 'min') {
          let m = Math.round(deg / 6);
          m = Math.round(m / snap) * snap;
          m = ((m % 60) + 60) % 60;
          state.m = m;
        } else {
          // timevisar → vel time (0..12). Behald minutt.
          let hf = deg / 30; // 0..12
          let h = Math.floor(hf + 1e-6);
          h = ((h % 12) + 12) % 12;
          if (h === 0) h = 12;
          state.h = h;
        }
        render();
        if (opts.onChange) opts.onChange({ h: state.h, m: state.m });
      }
      svg.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        dragging = nearestHand(ev);
        if (svg.setPointerCapture) try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
        applyAngle(angleAt(ev));
      });
      svg.addEventListener('pointermove', function (ev) {
        if (!dragging) return;
        applyAngle(angleAt(ev));
      });
      function end() { dragging = null; }
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);
      svg.style.cursor = 'grab';
    }

    return {
      el: svg,
      getTime: function () { return { h: state.h, m: state.m }; },
      setTime: function (h, m) { state.h = h; state.m = m; render(); }
    };
  }

  // digital retro-LCD
  function lcd(opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'lcd';
    const time = document.createElement('div');
    time.className = 'lcd__time';
    if (opts.size) time.style.fontSize = opts.size;
    const ghost = document.createElement('span');
    ghost.className = 'ghost'; ghost.setAttribute('aria-hidden', 'true'); ghost.textContent = '88:88';
    const val = document.createElement('span');
    val.className = 'val'; val.textContent = opts.time || '09:45';
    time.appendChild(ghost); time.appendChild(val);
    const label = document.createElement('div');
    label.className = 'lcd__label'; label.textContent = opts.label || 'DIGITAL';
    wrap.appendChild(time); wrap.appendChild(label);
    return wrap;
  }

  window.TidvisClock = { analog: analog, lcd: lcd };
})();
