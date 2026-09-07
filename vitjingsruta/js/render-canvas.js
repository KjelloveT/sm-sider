/* ══════════════════════════════════════════════
   RENDER-CANVAS.JS — Scena teikna på eit lerret

   Path2D tek imot SVG-path-data slik han står. Det er heile grunnen til
   at scena kan vere path-strengar: canvas og SVG les det same.

   Ikon frå Lucide er strekteikningar, ikkje fyll. Omgjeringa frå markup
   til Path2D er den same som i biletflett/js/glyphs.js.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.canvasRender = (function () {
  'use strict';

  const ICON_VIEWBOX = 24;
  const iconCache = new Map();

  /* Lucide brukar berre path/circle/ellipse/rect/line/polyline/polygon. */
  function iconPath(markup) {
    if (iconCache.has(markup)) return iconCache.get(markup);
    let path = null;
    try {
      const doc = new DOMParser().parseFromString(
        '<svg xmlns="http://www.w3.org/2000/svg">' + markup + '</svg>', 'image/svg+xml');
      path = new Path2D();
      const num = (el, attr) => {
        const v = parseFloat(el.getAttribute(attr));
        return Number.isFinite(v) ? v : 0;
      };
      const pts = (el) => (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);

      for (const el of doc.documentElement.children) {
        const sub = new Path2D();
        switch (el.tagName) {
          case 'path':
            sub.addPath(new Path2D(el.getAttribute('d') || ''));
            break;
          case 'circle':
            sub.arc(num(el, 'cx'), num(el, 'cy'), num(el, 'r'), 0, Math.PI * 2);
            break;
          case 'ellipse':
            sub.ellipse(num(el, 'cx'), num(el, 'cy'), num(el, 'rx'), num(el, 'ry'), 0, 0, Math.PI * 2);
            break;
          case 'rect': {
            const x = num(el, 'x'), y = num(el, 'y');
            const w = num(el, 'width'), h = num(el, 'height'), r = num(el, 'rx');
            if (r > 0 && typeof sub.roundRect === 'function') sub.roundRect(x, y, w, h, r);
            else sub.rect(x, y, w, h);
            break;
          }
          case 'line':
            sub.moveTo(num(el, 'x1'), num(el, 'y1'));
            sub.lineTo(num(el, 'x2'), num(el, 'y2'));
            break;
          case 'polyline':
          case 'polygon': {
            const p = pts(el);
            if (p.length >= 4) {
              sub.moveTo(p[0], p[1]);
              for (let i = 2; i + 1 < p.length; i += 2) sub.lineTo(p[i], p[i + 1]);
              if (el.tagName === 'polygon') sub.closePath();
            }
            break;
          }
          default:
            break;
        }
        path.addPath(sub);
      }
    } catch (err) {
      path = null;
    }
    iconCache.set(markup, path);
    return path;
  }

  function paint(ctx, scene, value, scale) {
    if (typeof value === 'string' && value.indexOf('url:') === 0) {
      const id = value.slice(4);
      const def = scene.defs.filter(x => x.id === id)[0];
      if (!def) return '#000000';
      let g;
      if (def.type === 'linear') {
        g = ctx.createLinearGradient(def.x1 * scale, def.y1 * scale, def.x2 * scale, def.y2 * scale);
      } else {
        g = ctx.createRadialGradient(def.cx * scale, def.cy * scale, 0,
          def.cx * scale, def.cy * scale, def.r * scale);
      }
      g.addColorStop(0, def.from);
      g.addColorStop(1, def.to);
      return g;
    }
    return value;
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} scene
   * @param {number} pixelWidth  breidda på det ferdige biletet
   */
  function draw(canvas, scene, pixelWidth) {
    const scale = pixelWidth / scene.w;
    canvas.width = Math.round(scene.w * scale);
    canvas.height = Math.round(scene.h * scale);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (scene.bg) {
      ctx.fillStyle = scene.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    scene.items.forEach((item) => {
      ctx.save();
      switch (item.type) {
        case 'path': {
          if (!item.d) break;
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          ctx.fillStyle = paint(ctx, scene, item.fill, 1);
          /* Gradientane er rekna i modul-einingar, og transformasjonen
             skalerer dei med resten. */
          ctx.fill(new Path2D(item.d), item.rule === 'evenodd' ? 'evenodd' : 'nonzero');
          break;
        }
        case 'image': {
          if (!item.img) break;
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(item.img, item.x, item.y, item.w, item.h);
          break;
        }
        case 'icon': {
          const path = iconPath(item.markup);
          if (!path) break;
          const k = item.size / ICON_VIEWBOX;
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          ctx.translate(item.x, item.y);
          ctx.scale(k, k);
          ctx.lineWidth = item.weight;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = item.stroke;
          ctx.stroke(path);
          break;
        }
        case 'text': {
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          ctx.fillStyle = item.fill;
          ctx.font = '800 ' + item.size + 'px ' + VR.render.FONT_STACK;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.text, item.x, item.y, item.width);
          break;
        }
        default:
          break;
      }
      ctx.restore();
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return canvas;
  }

  /** Teiknar på eit friskt lerret utan å røre det som står på skjermen. */
  function toCanvas(scene, pixelWidth) {
    return draw(document.createElement('canvas'), scene, pixelWidth);
  }

  return { draw, toCanvas };
})();
