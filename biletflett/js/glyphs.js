/* ══════════════════════════════════════
   GLYPHS.JS — Lucide-figurar teikna på canvas via Path2D

   Pynten i BiletFlett var tidlegare rein geometri (ein sol var ein
   sirkel med strekar ut frå). Her hentar vi i staden path-dataen frå
   det felles Lucide-settet i ../js/vyrdepil-icons.js og teiknar han
   direkte på lerretet. Ingen bilete, ingen nye avhengnader — berre
   vektorformer som skalerer fritt og tek farge frå malpaletten.

   Lucide-ikon er 24×24 med stroke-width 2, runde endar og skjøtar.
   Vi held oss til det: figurane blir streka, ikkje fylte, så dei ser
   like ut som ikona elles i Vyrdepil.
   ══════════════════════════════════════ */

const Glyphs = (() => {

    const VIEWBOX = 24;
    const cache = new Map();

    function markupFor(name) {
        const set = (typeof VyrdepilIcons !== 'undefined') ? VyrdepilIcons.ICON_PATHS : null;
        return set ? set[name] : null;
    }

    /* Gjer SVG-markup om til éin samla Path2D. Lucide brukar berre
       path/circle/ellipse/rect/line/polyline/polygon. */
    function toPath(markup) {
        const doc = new DOMParser().parseFromString(
            `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, 'image/svg+xml');
        const path = new Path2D();
        const num = (el, attr, dflt) => {
            const v = parseFloat(el.getAttribute(attr));
            return Number.isFinite(v) ? v : (dflt || 0);
        };
        const points = (el) => (el.getAttribute('points') || '')
            .trim().split(/[\s,]+/).map(Number);

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
                    const w = num(el, 'width'), h = num(el, 'height');
                    const r = num(el, 'rx');
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
                    const p = points(el);
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
        return path;
    }

    function get(name) {
        if (cache.has(name)) return cache.get(name);
        const markup = markupFor(name);
        let path = null;
        if (markup) {
            try { path = toPath(markup); } catch (e) { path = null; }
        }
        cache.set(name, path);
        return path;
    }

    function has(name) { return get(name) != null; }

    /* Teiknar eit ikon med sentrum i (cx, cy) og gitt storleik i pikslar.
       opts: { color, fill, alpha, rotation (grader), weight (strekbreidd
       i 24-eininga, som i Lucide) } */
    function draw(ctx, name, cx, cy, size, opts) {
        const path = get(name);
        if (!path) return false;
        const o = opts || {};
        const k = size / VIEWBOX;
        ctx.save();
        ctx.translate(cx, cy);
        if (o.rotation) ctx.rotate(o.rotation * Math.PI / 180);
        ctx.scale(k, k);
        ctx.translate(-VIEWBOX / 2, -VIEWBOX / 2);
        if (o.alpha != null) ctx.globalAlpha = o.alpha;
        if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(path); }
        ctx.lineWidth = o.weight || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = o.color || '#000000';
        ctx.stroke(path);
        ctx.restore();
        return true;
    }

    return { get, has, draw, VIEWBOX };
})();
