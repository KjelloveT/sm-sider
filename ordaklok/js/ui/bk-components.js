/* ══════════════════════════════════════════════════════════════
   BK-COMPONENTS.JS — Felleskomponentar for Boksekamp-stil
   DOM-byggjarar: header, scoreboard, sunburst, stamp, bubble, Vyrde
   ══════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const Icons = root.BKIcons;

  /* ── Header (mørk + gull-trim) ─────────────────────────── */
  function header(opts) {
    opts = opts || {};
    const el = document.createElement('header');
    el.className = 'bk-header';

    const logo = document.createElement('a');
    logo.className = 'bk-header-logo';
    logo.href = opts.homeHref || 'index.html';
    const iconEl = Icons.create('megaphone', 32);
    iconEl.classList.add('bk-logo-icon');
    logo.appendChild(iconEl);
    const title = document.createElement('span');
    title.className = 'bk-header-title';
    title.textContent = opts.title || 'ORDAKLOK';
    logo.appendChild(title);

    el.appendChild(logo);

    const spacer = document.createElement('div');
    spacer.className = 'bk-header-spacer';
    el.appendChild(spacer);

    if (opts.extra) el.appendChild(opts.extra);

    return el;
  }

  /* ── Topbar (tilbake + tittel + meta) ───────────────────── */
  function topbar(opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'bk-topbar';

    const back = document.createElement('a');
    back.className = 'bk-topbar-back';
    back.href = opts.backHref || 'index.html';
    back.appendChild(Icons.create('arrow-left', 16));
    const backText = document.createElement('span');
    backText.textContent = opts.backText || 'Tilbake';
    back.appendChild(backText);
    el.appendChild(back);

    if (opts.title) {
      const t = document.createElement('span');
      t.className = 'bk-topbar-title';
      t.textContent = opts.title;
      el.appendChild(t);
    }

    const spacer = document.createElement('span');
    spacer.className = 'bk-topbar-spacer';
    el.appendChild(spacer);

    if (opts.meta) {
      const m = document.createElement('span');
      m.className = 'bk-topbar-meta';
      m.id = opts.metaId || '';
      m.textContent = opts.meta;
      el.appendChild(m);
    }

    return el;
  }

  /* ── Scoreboard (HUD) ───────────────────────────────────── */
  /* Cellene: { label, value, id?, kind? ("treff"|"bom"|"plain") } */
  function scoreboard(opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'bk-scoreboard';
    if (opts.intensity === 'full') el.classList.add('bk-sb-full');

    (opts.cells || []).forEach(c => {
      const cell = document.createElement('div');
      cell.className = 'bk-sb-cell';
      const lbl = document.createElement('span');
      lbl.className = 'bk-sb-label';
      lbl.textContent = c.label;
      const val = document.createElement('span');
      val.className = 'bk-sb-value';
      if (c.kind === 'treff') val.classList.add('bk-sb-treff');
      if (c.kind === 'bom')   val.classList.add('bk-sb-bom');
      if (c.id) val.id = c.id;
      val.textContent = c.value;
      cell.appendChild(lbl);
      cell.appendChild(val);
      el.appendChild(cell);
    });

    const sp = document.createElement('span');
    sp.className = 'bk-sb-spacer';
    el.appendChild(sp);

    if (opts.quitId) {
      const q = document.createElement('button');
      q.className = 'bk-sb-quit';
      q.id = opts.quitId;
      q.textContent = opts.quitText || 'Avbryt';
      el.appendChild(q);
    }

    return el;
  }

  /* ── Sunburst-wrap ──────────────────────────────────────── */
  /* level: "calm" | "default" | "full" */
  function withSunburst(content, level) {
    const wrap = document.createElement('div');
    wrap.className = 'bk-sunburst';
    if (level === 'calm') wrap.classList.add('bk-sun-calm');
    if (level === 'full') wrap.classList.add('bk-sun-full');
    if (content) wrap.appendChild(content);
    return wrap;
  }

  /* ── Stempel / badge ────────────────────────────────────── */
  function stamp(text, opts) {
    opts = opts || {};
    const el = document.createElement('span');
    el.className = 'bk-stamp';
    if (opts.color) el.classList.add('bk-stamp-' + opts.color);
    if (opts.size === 'lg') el.classList.add('bk-stamp-lg');
    if (opts.size === 'xl') el.classList.add('bk-stamp-xl');
    if (opts.rotate != null) el.style.setProperty('--stamp-rot', opts.rotate + 'deg');
    if (opts.icon) {
      el.appendChild(Icons.create(opts.icon, opts.iconSize || 14));
    }
    const t = document.createElement('span');
    t.textContent = text;
    el.appendChild(t);
    return el;
  }

  /* ── Boble (Vyrde snakkar) ──────────────────────────────── */
  /* tail: "left" | "right" | "down" */
  function bubble(text, tail) {
    const el = document.createElement('div');
    el.className = 'bk-bubble bk-bubble-' + (tail || 'left');
    el.textContent = text;
    return el;
  }

  /* ── Vyrde-maskoten ─────────────────────────────────────── */
  /* Byggjer på den felles komponenten i js/vyrde.js, som klipper eitt
     ansiktsuttrykk ut av sprite-arket _resources/vyrde.png.
     mood: sjå Vyrde.MOODS — t.d. "wave", "happy", "think", "surprised",
     "angry", "sad", "tired", "wink", "cool". */
  function vyrde(opts) {
    opts = opts || {};
    return root.Vyrde.create({
      mood: opts.mood || 'wave',
      size: opts.size,
      alt: opts.alt || 'Vyrde',
      src: opts.src,
      className: 'bk-vyrde'
    });
  }

  /** Byt ansiktsuttrykk på eit element laga med vyrde(). */
  function setVyrdeMood(el, mood) {
    root.Vyrde.setMood(el, mood);
  }

  function vyrdeWithBubble(opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'bk-vyrde-with-bubble';
    if (opts.reverse) wrap.classList.add('reverse');

    const v = vyrde({ mood: opts.mood, size: opts.size });
    wrap.appendChild(v);

    if (opts.text) {
      const b = bubble(opts.text, opts.reverse ? 'right' : 'left');
      wrap.appendChild(b);
    }
    return wrap;
  }

  /* ── Modal-utility ──────────────────────────────────────── */
  function openModal(el)  { if (el) el.classList.add('open'); }
  function closeModal(el) { if (el) el.classList.remove('open'); }

  function wireModal(overlayEl, opts) {
    opts = opts || {};
    if (!overlayEl) return;
    overlayEl.addEventListener('click', e => {
      if (e.target === overlayEl) closeModal(overlayEl);
    });
    if (opts.closeBtnId) {
      const btn = document.getElementById(opts.closeBtnId);
      if (btn) btn.addEventListener('click', () => closeModal(overlayEl));
    }
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlayEl.classList.contains('open')) {
        closeModal(overlayEl);
      }
    });
  }

  root.BKComponents = {
    header,
    topbar,
    scoreboard,
    withSunburst,
    stamp,
    bubble,
    vyrde,
    setVyrdeMood,
    vyrdeWithBubble,
    openModal,
    closeModal,
    wireModal
  };
})(typeof window !== 'undefined' ? window : this);
