/* ══════════════════════════════════════════════
   RENDER.JS — Frå kode og design til ei scene

   Ingen av teiknarane kjenner QR-formatet. Dei får ei scene: ei liste
   med path-strengar, bilete og tekst, uttrykt i modul-einingar, og
   teiknar henne. Canvas-teiknaren og SVG-teiknaren les den SAME lista,
   så ein PNG og ein SVG av same kode er den same figuren — ikkje to
   figurar som liknar.

   Eininga er éin modul. Skaleringa til pikslar skjer heilt til slutt,
   i teiknaren, og ingen stad elles.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.render = (function () {
  'use strict';

  /* Ramma legg seg utanpå stillesona. Tala er tjukkleik og bandhøgd
     i modular — det er difor ei ramme ser like tjukk ut same kor mykje
     innhald koden har. */
  const FRAMES = {
    none:   { ring: 0,    band: 0,   radius: 0,   fillBand: false, tail: 0 },
    thin:   { ring: 0.6,  band: 3.4, radius: 0,   fillBand: false, tail: 0 },
    thick:  { ring: 1.5,  band: 4.0, radius: 0,   fillBand: true,  tail: 0 },
    label:  { ring: 0,    band: 4.0, radius: 1.2, fillBand: true,  tail: 0 },
    /* Snakkebobla treng å SJÅ ut som ei snakkeboble. Det krev tre ting
       samstundes: runde nok hjørne til at boksen les som ei boble, og ein
       hale som er stor nok til å bli sett og spiss nok til å peike. Ein
       hale på halvannan modul mot ein kode på førti forsvinn rett og slett. */
    speech: { ring: 1.2,  band: 4.2, radius: 4.5, fillBand: true,  tail: 5, tailBase: 7 }
  };

  const FRAME_STYLES = [
    { id: 'none', label: 'Ingen' },
    { id: 'thin', label: 'Tynn' },
    { id: 'thick', label: 'Tjukk' },
    { id: 'label', label: 'Etikett' },
    { id: 'speech', label: 'Snakkeboble' }
  ];

  /* ──────────────── Tekstbreidd ──────────────── */

  /* SVG kan ikkje måle tekst, canvas kan. Vi måler éin gong her og gjev
     begge teiknarane det same svaret, så teksten står likt i PNG og SVG. */
  let measureCtx = null;
  const FONT_STACK = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  function measureText(text, fontSize) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = '800 ' + fontSize + 'px ' + FONT_STACK;
    return measureCtx.measureText(text).width;
  }

  /* ──────────────── Scena ──────────────── */

  /**
   * @param {object} qr      frå VR.qr.build
   * @param {object} design  oppsettet
   * @param {object} logo    { kind: 'image'|'icon', dataUri|markup, ... } eller null
   */
  function buildScene(qr, design, logo) {
    const d = design;
    const f = FRAMES[d.frame.style] || FRAMES.none;
    const hasText = f.band > 0 && String(d.frame.text || '').trim() !== '';
    const band = hasText ? f.band : 0;
    const tail = f.tail || 0;

    const quiet = VR.util.clamp(d.quiet, 0, 8);
    const side = qr.size + quiet * 2;
    const w = side + f.ring * 2;
    const h = w + band + tail;

    const topBand = hasText && d.frame.textPos === 'top';
    const ox = f.ring + quiet;
    const oy = f.ring + quiet + (topBand ? band : 0);

    const scene = {
      w: w, h: h,
      unit: 1,
      bg: d.bg.transparent ? null : d.bg.color,
      defs: [],
      items: [],
      codeBox: { x: ox, y: oy, size: qr.size }
    };

    /* ── Fyll: flat farge eller ein overgang over kodeflata ── */
    const gradientId = 'vrFill';
    let gradientPaint = null;
    if (d.fill.type === 'linear' || d.fill.type === 'radial') {
      const cx = ox + qr.size / 2, cy = oy + qr.size / 2;
      const r = qr.size / 2;
      if (d.fill.type === 'linear') {
        const a = (d.fill.angle || 0) * Math.PI / 180;
        const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
        scene.defs.push({
          id: gradientId, type: 'linear',
          x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy,
          from: d.fill.color, to: d.fill.color2
        });
      } else {
        scene.defs.push({
          id: gradientId, type: 'radial',
          cx: cx, cy: cy, r: r * 1.15,
          from: d.fill.color, to: d.fill.color2
        });
      }
      gradientPaint = 'url:' + gradientId;
    }

    const target = d.fill.target || 'all';
    const modulePaint = (gradientPaint && (target === 'all' || target === 'module'))
      ? gradientPaint : d.fill.color;
    const eyeBase = (gradientPaint && (target === 'all' || target === 'eye'))
      ? gradientPaint : d.fill.color;
    const eyePaint = d.eye.sameColor ? eyeBase : d.eye.color;

    /* ── Ramma ── */
    if (f.ring > 0) {
      const R = f.radius;
      scene.items.push({
        type: 'path',
        rule: 'evenodd',
        fill: d.frame.color,
        d: VR.shapes.roundRect(0, 0, w, h - tail, [R, R, R, R]) +
           VR.shapes.roundRect(f.ring, f.ring, w - f.ring * 2, h - tail - f.ring * 2,
             [Math.max(0, R - f.ring), Math.max(0, R - f.ring), Math.max(0, R - f.ring), Math.max(0, R - f.ring)])
      });
    }

    /* ── Halen på snakkebobla ──
       Ho høyrer til ramma og ikkje til teksten: ei snakkeboble utan tekst
       er framleis ei snakkeboble. Ho overlappar kanten med ein modul så
       det ikkje blir ei skjøt, og spissen står inn mot venstre — ein hale
       rett ned les som ein trekant, ein skeiv hale les som ei boble. */
    if (tail) {
      const bodyBottom = h - tail;
      const baseW = f.tailBase || tail;
      const bx = f.ring + (w - f.ring * 2) * 0.2;
      const nn = VR.util.n;
      scene.items.push({
        type: 'path', fill: d.frame.color,
        d: 'M' + nn(bx) + ',' + nn(bodyBottom - 1) +
           'L' + nn(bx + baseW) + ',' + nn(bodyBottom - 1) +
           'L' + nn(bx + baseW * 0.18) + ',' + nn(bodyBottom + tail) + 'Z'
      });
    }

    /* ── Tekstbandet ── */
    if (hasText) {
      const bandY = topBand ? f.ring : (h - tail - f.ring - band);
      const bandX = f.ring;
      const bandW = w - f.ring * 2;

      if (f.fillBand) {
        const R = Math.max(0, f.radius - f.ring);
        const corners = topBand ? [R, R, 0, 0] : [0, 0, R, R];
        scene.items.push({
          type: 'path', fill: d.frame.color,
          d: VR.shapes.roundRect(bandX, bandY, bandW, band, corners)
        });
      }

      const text = String(d.frame.text).trim();
      const maxW = bandW * 0.86;
      let size = band * 0.58;
      const natural = measureText(text, size);
      if (natural > maxW && natural > 0) size = size * (maxW / natural);

      scene.items.push({
        type: 'text',
        text: text,
        x: bandX + bandW / 2,
        y: bandY + band / 2,
        size: size,
        width: Math.min(measureText(text, size), maxW),
        fill: f.fillBand ? VR.util.textColorOn(d.frame.color) : d.frame.color
      });
    }

    /* ── Kva modular logoen dekkjer ── */
    const skip = logoSkipFn(qr, d, logo, ox, oy);

    /* ── Modulane ── */
    const moduleSpec = Object.assign({}, d.module, {
      alignmentOwnShape: d.alignment.style !== 'module'
    });
    const modules = VR.shapes.modulesPath(qr, moduleSpec, ox, oy, skip, true);
    if (modules) scene.items.push({ type: 'path', fill: modulePaint, d: modules });

    /* ── Justeringsmønstera, når dei skal ha eiga form ── */
    if (d.alignment.style !== 'module') {
      const align = VR.shapes.alignmentPath(qr, d.alignment.style, ox, oy, d.module.radius);
      if (align) scene.items.push({ type: 'path', rule: 'evenodd', fill: modulePaint, d: align });
    }

    /* ── Augene ── */
    qr.eyes.forEach((eye) => {
      const x = ox + eye.col, y = oy + eye.row;
      scene.items.push({
        type: 'path', rule: 'evenodd', fill: eyePaint,
        d: VR.shapes.eyeFrame(d.eye.frame, x, y, d.module.radius)
      });
      scene.items.push({
        type: 'path', fill: eyePaint,
        d: VR.shapes.eyePupil(d.eye.pupil, x, y, d.module.radius)
      });
    });

    /* ── Logoen ── */
    if (logo) addLogo(scene, qr, d, logo, ox, oy);

    return scene;
  }

  /* ──────────────── Logoen ──────────────── */

  /* Firkanten logoen opptek, i modul-einingar. */
  function logoBox(qr, d, ox, oy) {
    const size = VR.util.clamp(d.logo.size, 0.05, VR.design.LIMITS.logoMax) * qr.size;
    const cx = ox + qr.size / 2;
    const cy = oy + qr.size / 2;
    return { x: cx - size / 2, y: cy - size / 2, size: size, cx: cx, cy: cy };
  }

  /* Platen bak logoen — og dermed òg det området modulane skal vike for. */
  function plateBox(qr, d, ox, oy) {
    const b = logoBox(qr, d, ox, oy);
    const pad = d.logo.plate === 'none' ? 0.08 : VR.util.clamp(d.logo.platePad, 0, 0.6);
    const grow = b.size * pad;
    return {
      x: b.x - grow, y: b.y - grow,
      size: b.size + grow * 2,
      cx: b.cx, cy: b.cy
    };
  }

  /**
   * Modulane under logoen blir ikkje teikna i staden for å bli teikna over.
   * Ein logo lagd oppå let modulkantane stikke fram rundt han, og
   * skannaren ser eit mønster som ikkje er der.
   */
  function logoSkipFn(qr, d, logo, ox, oy) {
    if (!logo || !d.logo.excavate) return null;
    const p = plateBox(qr, d, ox, oy);
    const round = d.logo.plate === 'circle';
    const r = p.size / 2;
    return function (row, col) {
      const mx = ox + col + 0.5, my = oy + row + 0.5;
      if (round) {
        const dx = mx - p.cx, dy = my - p.cy;
        return dx * dx + dy * dy <= (r + 0.35) * (r + 0.35);
      }
      return mx > p.x - 0.35 && mx < p.x + p.size + 0.35 &&
             my > p.y - 0.35 && my < p.y + p.size + 0.35;
    };
  }

  function addLogo(scene, qr, d, logo, ox, oy) {
    const b = logoBox(qr, d, ox, oy);
    const p = plateBox(qr, d, ox, oy);

    if (d.logo.plate === 'circle') {
      scene.items.push({
        type: 'path', fill: d.logo.plateColor,
        d: VR.shapes.circle(p.cx, p.cy, p.size / 2)
      });
    } else if (d.logo.plate === 'roundrect') {
      const R = p.size * 0.18;
      scene.items.push({
        type: 'path', fill: d.logo.plateColor,
        d: VR.shapes.roundRect(p.x, p.y, p.size, p.size, [R, R, R, R])
      });
    }

    if (logo.kind === 'icon') {
      scene.items.push({
        type: 'icon',
        markup: logo.markup,
        x: b.x, y: b.y, size: b.size,
        stroke: d.logo.color,
        weight: VR.util.clamp(d.logo.weight, 0.5, 4)
      });
    } else {
      /* Bilete blir lagde inn med sitt eige sideforhold, sentrert i ruta. */
      const ar = logo.aspect || 1;
      let iw = b.size, ih = b.size;
      if (ar > 1) ih = b.size / ar; else iw = b.size * ar;
      scene.items.push({
        type: 'image',
        href: logo.dataUri,
        img: logo.img,
        x: b.cx - iw / 2, y: b.cy - ih / 2, w: iw, h: ih
      });
    }
  }

  return { buildScene, FRAMES, FRAME_STYLES, FONT_STACK, logoBox, plateBox };
})();
