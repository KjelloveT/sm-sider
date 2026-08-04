/* ══════════════════════════════════════════════
   SVG-IMPORT.JS — Les SVG-filer inn i modellen

   TRYGGLEIK FØRST. Ei SVG-fil er ikkje eit bilete — det er eit
   dokument som kan innehalde skript, hendingshandterarar og lenkjer ut
   på nettet. Ei fil brukaren har henta ned frå ein eller annan stad kan
   ikkje reknast som venleg.

   Difor tre reglar som ikkje skal fråvikast:
     1. Fila blir lesen med DOMParser i modusen `image/svg+xml`, aldri
        med innerHTML. Ho blir dermed aldri knytt til sida vår, og
        ingenting i henne blir køyrt.
     2. Vi les BERRE dei elementa og attributta vi kjenner. Alt anna —
        <script>, <foreignObject>, on*-attributt, href ut av fila —
        blir ikkje avvist, det blir aldri sett på i det heile.
     3. Ingenting frå fila hamnar i DOM-en vår direkte. Vi byggjer nye
        nodar i vår eigen modell, av tal vi har lese og validert.

   GEOMETRI: alt blir kubiske bézier-kurver. Bogar (A) blir rekna om,
   kvadratiske kurver (Q/T) blir rekna om, og former som <circle> og
   <polygon> blir tekne inn som dei formene vi alt har. Ei fil frå eit
   anna program kjem dermed inn som noko brukaren kan redigere punkt
   for punkt, ikkje som ein ugjennomtrengeleg klump.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.svgImport = (function () {
  'use strict';

  /* Element vi kan lese. Alt utanfor lista blir hoppa over — ei kvitliste
     tryggjer oss mot alt vi ikkje har tenkt på, i staden for berre mot
     det vi kom på å svarteliste. */
  const SHAPES = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'];
  const CONTAINERS = ['g', 'svg', 'a'];

  /* ──────────────── Inngang ──────────────── */

  /**
   * @param {string} text innhaldet i fila
   * @returns {{error:string}|{nodes:number, bounds:object}}
   */
  function parse(text, options) {
    const opts = options || {};

    let doc;
    try {
      doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    } catch (e) {
      return { error: 'Klarte ikkje å lese fila.' };
    }

    if (doc.querySelector('parsererror')) {
      return { error: 'Fila er ikkje ein gyldig SVG.' };
    }

    const root = doc.documentElement;
    if (!root || root.localName !== 'svg') {
      return { error: 'Fila inneheld ingen SVG.' };
    }

    // Ei viewBox fortel kva koordinatsystem fila er teikna i. Vi legg
    // henne inn som ein transform, så innhaldet kjem inn i rett storleik
    // sjølv om fila er teikna i eit heilt anna talområde enn vårt.
    const fit = fitTransform(root, opts);

    const group = RV.state.makeNode('group', {});
    group.name = opts.name || 'Importert';
    group.fill = { type: 'none' };
    group.stroke = { type: 'none' };
    group.transform = fit;
    RV.state.add(group, null);

    const count = { n: 0 };
    walk(root, group.id, inheritedFrom(root), count);

    if (!count.n) {
      RV.state.remove(group.id);
      return { error: 'Fann ingen former i fila.' };
    }

    // Ein einsleg form treng ikkje gruppe rundt seg.
    if (count.n === 1 && RV.state.listOf(group.id).length === 1) {
      RV.state.ungroup(group.id);
    }

    return { nodes: count.n };
  }

  /**
   * Matrisa som legg fila inn i teikninga vår.
   *
   * Fila blir tilpassa flata BEGGE vegar — opp så vel som ned. Det er
   * ikkje sjølvsagt, for eit teikneprogram kunne like gjerne halde på
   * den naturlege storleiken. Men grunnen til at nokon importerer ein
   * SVG hit er at han skal arbeide med han: eit Lucide-ikon på 24 × 24
   * ville blitt ein knappenålsprikk midt på ei flate på 512, og
   * brukaren måtte zoome inn og skalere opp kvar einaste gong.
   *
   * Vi lèt det stå att litt luft rundt, så ein ser med ein gong at heile
   * fila kom med.
   */
  const FILL_RATIO = 0.8;

  function fitTransform(root, opts) {
    const box = viewBox(root);
    const doc = RV.state.data.doc;

    if (!box) return RV.matrix.identity();

    const scale = Math.min((doc.width * FILL_RATIO) / box.w, (doc.height * FILL_RATIO) / box.h);
    const w = box.w * scale;
    const h = box.h * scale;
    const at = opts.at || { x: (doc.width - w) / 2, y: (doc.height - h) / 2 };

    return RV.matrix.mulAll([
      RV.matrix.translate(at.x, at.y),
      RV.matrix.scale(scale, scale),
      RV.matrix.translate(-box.x, -box.y)
    ]);
  }

  function viewBox(root) {
    const raw = root.getAttribute('viewBox');
    if (raw) {
      const n = raw.trim().split(/[\s,]+/).map(parseFloat);
      if (n.length === 4 && n.every(v => !isNaN(v)) && n[2] > 0 && n[3] > 0) {
        return { x: n[0], y: n[1], w: n[2], h: n[3] };
      }
    }
    const w = length(root.getAttribute('width'));
    const h = length(root.getAttribute('height'));
    if (w > 0 && h > 0) return { x: 0, y: 0, w: w, h: h };
    return null;
  }

  /** Les ei lengd, og hopp over eininga. Prosent gjev vi opp på. */
  function length(raw) {
    if (!raw) return 0;
    if (/%$/.test(raw)) return 0;
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : n;
  }

  /* ──────────────── Gjennomgang ──────────────── */

  function walk(el, parentId, inherited, count) {
    Array.from(el.children).forEach((child) => {
      const tag = child.localName;

      if (CONTAINERS.indexOf(tag) !== -1) {
        const style = inheritedFrom(child, inherited);
        const transform = RV.matrix.fromString(child.getAttribute('transform'));

        // Ei tom gruppe er berre støy i lagpanelet.
        if (!child.children.length) return;

        const group = RV.state.makeNode('group', {});
        group.name = child.getAttribute('id') || 'Gruppe';
        group.fill = { type: 'none' };
        group.stroke = { type: 'none' };
        group.transform = transform;
        RV.state.add(group, parentId);

        const before = count.n;
        walk(child, group.id, style, count);
        if (count.n === before) RV.state.remove(group.id);
        return;
      }

      if (SHAPES.indexOf(tag) !== -1) {
        const node = buildShape(child, inherited);
        if (node) {
          RV.state.add(node, parentId);
          count.n += 1;
        }
        return;
      }

      // Alt anna — script, style, metadata, text, image, use, defs,
      // foreignObject — blir hoppa over. Vi rører det ikkje.
    });
  }

  /* ──────────────── Stil ──────────────── */

  /* SVG har to måtar å seie det same: presentasjonsattributt
     (fill="red") og style-eigenskapar (style="fill:red"). Style vinn
     over attributtet, og begge blir arva nedover. Vi må lese begge, og
     i rett rekkjefølgje, elles kjem filer frå Illustrator og Inkscape
     inn med feil fargar — dei to programma skriv kvar sin variant. */

  const STYLE_KEYS = ['fill', 'stroke', 'stroke-width', 'stroke-opacity',
                      'fill-opacity', 'opacity', 'stroke-dasharray',
                      'stroke-linecap', 'stroke-linejoin', 'display'];

  function inheritedFrom(el, parent) {
    const out = Object.assign({}, parent || {});
    const inline = parseStyle(el.getAttribute('style'));

    STYLE_KEYS.forEach((key) => {
      const value = inline[key] != null ? inline[key] : el.getAttribute(key);
      if (value != null && value !== '') out[key] = String(value).trim();
    });
    return out;
  }

  function parseStyle(raw) {
    const out = {};
    if (!raw) return out;
    String(raw).split(';').forEach((part) => {
      const at = part.indexOf(':');
      if (at === -1) return;
      out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
    });
    return out;
  }

  /**
   * Ein farge frå fila til vår eigen form.
   * `url(#...)` — altså gradientar og mønster — tek vi ikkje inn enno.
   * Vi lèt dei bli grå i staden for å late som ingenting: ein synleg
   * plassholdar er lettare å oppdage enn ei form som blei borte.
   */
  function paint(value, fallback, opacity) {
    if (value == null) return fallback;
    const v = String(value).trim().toLowerCase();
    if (v === 'none' || v === 'transparent') return { type: 'none' };
    if (v.indexOf('url(') === 0) return { type: 'solid', color: '#999999', opacity: 1 };
    if (v === 'currentcolor') return { type: 'solid', color: '#1a1a1a', opacity: 1 };

    const hex = toHex(v);
    if (!hex) return fallback;
    const a = opacity == null ? 1 : RV.util.clamp(parseFloat(opacity), 0, 1);
    return { type: 'solid', color: hex, opacity: isNaN(a) ? 1 : a };
  }

  /* Fargenamn og rgb() blir omsette av nettlesaren sjølv, gjennom
     util.themeColor sin same teknikk — men på ein frittståande node som
     aldri blir vist. Vi slepp dermed å halde ei liste over 147
     fargenamn i koden. */
  const probe = document.createElement('span');

  function toHex(value) {
    if (/^#[0-9a-f]{3}$/i.test(value) || /^#[0-9a-f]{6}$/i.test(value)) {
      const c = RV.util.hexToRgb(value);
      return c ? RV.util.rgbToHex(c.r, c.g, c.b) : null;
    }
    probe.style.color = '';
    probe.style.color = value;
    if (!probe.style.color) return null;       // nettlesaren avviste verdien
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    const m = computed.match(/[\d.]+/g);
    return m && m.length >= 3 ? RV.util.rgbToHex(+m[0], +m[1], +m[2]) : null;
  }

  function applyStyle(node, style) {
    node.fill = paint(style.fill, { type: 'solid', color: '#000000', opacity: 1 }, style['fill-opacity']);
    node.stroke = paint(style.stroke, { type: 'none' }, style['stroke-opacity']);

    if (node.stroke.type !== 'none') {
      const w = parseFloat(style['stroke-width']);
      node.stroke.width = isNaN(w) ? 1 : Math.max(0, w);
      node.stroke.dash = style['stroke-dasharray'] && style['stroke-dasharray'] !== 'none'
        ? style['stroke-dasharray'] : '';
      node.stroke.cap = ['butt', 'round', 'square'].indexOf(style['stroke-linecap']) !== -1
        ? style['stroke-linecap'] : 'butt';
      node.stroke.join = ['miter', 'round', 'bevel'].indexOf(style['stroke-linejoin']) !== -1
        ? style['stroke-linejoin'] : 'miter';
    }

    const o = parseFloat(style.opacity);
    node.opacity = isNaN(o) ? 1 : RV.util.clamp(o, 0, 1);
    if (style.display === 'none') node.visible = false;
  }

  /* ──────────────── Former ──────────────── */

  function buildShape(el, inherited) {
    const style = inheritedFrom(el, inherited);
    const tag = el.localName;
    const num = name => length(el.getAttribute(name));

    let node = null;

    if (tag === 'rect') {
      const w = num('width'), h = num('height');
      if (w <= 0 || h <= 0) return null;
      const rx = num('rx') || num('ry');
      node = RV.state.makeNode('rect', {
        x: num('x'), y: num('y'), w: w, h: h,
        rx: rx, ry: num('ry') || rx
      });

    } else if (tag === 'circle') {
      const r = num('r');
      if (r <= 0) return null;
      node = RV.state.makeNode('ellipse', { cx: num('cx'), cy: num('cy'), rx: r, ry: r });

    } else if (tag === 'ellipse') {
      const rx = num('rx'), ry = num('ry');
      if (rx <= 0 || ry <= 0) return null;
      node = RV.state.makeNode('ellipse', { cx: num('cx'), cy: num('cy'), rx: rx, ry: ry });

    } else if (tag === 'line') {
      node = RV.state.makeNode('line', {
        x1: num('x1'), y1: num('y1'), x2: num('x2'), y2: num('y2')
      });

    } else if (tag === 'polyline' || tag === 'polygon') {
      const points = parsePoints(el.getAttribute('points'));
      if (points.length < 2) return null;
      node = RV.state.makeNode('path', {
        subpaths: [RV.geom.makeSubpath(
          points.map(p => RV.geom.makePoint(p.x, p.y)), tag === 'polygon')]
      });

    } else if (tag === 'path') {
      const subpaths = parsePathData(el.getAttribute('d'));
      if (!subpaths.length) return null;
      node = RV.state.makeNode('path', { subpaths: subpaths });
    }

    if (!node) return null;

    node.name = el.getAttribute('id') || node.name;
    node.transform = RV.matrix.fromString(el.getAttribute('transform'));
    applyStyle(node, style);

    // Ei linje eller ein open sti utan strek er usynleg. Har fila
    // ikkje sagt noko om strek, arvar ho fyllet i staden for å bli borte.
    if (tag === 'line' && node.stroke.type === 'none') {
      node.stroke = node.fill.type !== 'none'
        ? Object.assign({}, node.fill, { width: 1, dash: '', cap: 'butt', join: 'miter' })
        : { type: 'solid', color: '#1a1a1a', opacity: 1, width: 1, dash: '', cap: 'butt', join: 'miter' };
      node.fill = { type: 'none' };
    }

    return node;
  }

  function parsePoints(raw) {
    if (!raw) return [];
    const n = String(raw).trim().split(/[\s,]+/).map(parseFloat).filter(v => !isNaN(v));
    const out = [];
    for (let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i], y: n[i + 1] });
    return out;
  }

  /* ──────────────── d-attributtet ──────────────── */

  /**
   * Les path-data. Alle ti kommandoane, i både stor og liten bokstav.
   *
   * Dette er den einaste staden i kodebasen der SVG-syntaksen sine
   * finurlegheiter må handterast: tal kan skiljast med komma, mellomrom
   * eller berre eit minusteikn; ein kommando kan følgjast av fleire sett
   * med tal; og etter M kjem implisitte L-ar. Det er difor lesinga er
   * skriven som ein eigen liten tokeniserar i staden for eit regulært
   * uttrykk — eit uttrykk som dekkjer alt dette ville ikkje vore mogleg
   * å lese for eit menneske.
   */
  function parsePathData(d) {
    if (!d) return [];

    const tokens = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
    if (!tokens) return [];

    const subpaths = [];
    let sp = null;
    let cmd = null;
    let i = 0;

    let cx = 0, cy = 0;          // gjeldande punkt
    let sx = 0, sy = 0;          // starten på delstien
    let lastCtrl = null;         // til S og T
    let lastCmd = null;

    const next = () => parseFloat(tokens[i++]);
    const isNum = t => t != null && !/[a-zA-Z]/.test(t);

    const push = (x, y) => {
      const p = RV.geom.makePoint(x, y, 'corner');
      sp.points.push(p);
      return p;
    };

    const curveTo = (c1x, c1y, c2x, c2y, x, y) => {
      const from = sp.points[sp.points.length - 1];
      from.ox = c1x; from.oy = c1y;
      const p = push(x, y);
      p.ix = c2x; p.iy = c2y;
      // Eit punkt med handtak på begge sider som ligg på line er mjukt.
      if (sp.points.length > 2) markSmooth(sp.points[sp.points.length - 2]);
      return p;
    };

    while (i < tokens.length) {
      if (!isNum(tokens[i])) {
        cmd = tokens[i++];
      } else if (cmd === 'M') {
        cmd = 'L';                 // implisitt L etter M
      } else if (cmd === 'm') {
        cmd = 'l';
      }

      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      const ox = rel ? cx : 0;
      const oy = rel ? cy : 0;

      /* Ein sti MÅ byrje med M. Gjer han ikkje det, er fila ugyldig —
         og sidan ho kjem utanfrå, kan vi ikkje rekne med at ho er det
         ho gjev seg ut for. Vi et eitt teikn om gongen til ein M dukkar
         opp, i staden for å stole på at det neste er eit tal. */
      if (!sp && C !== 'M') { i++; continue; }

      if (C === 'M') {
        if (sp && sp.points.length > 1) subpaths.push(sp);
        cx = next() + ox; cy = next() + oy;
        sx = cx; sy = cy;
        sp = RV.geom.makeSubpath([], false);
        push(cx, cy);

      } else if (C === 'L') {
        cx = next() + ox; cy = next() + oy;
        push(cx, cy);

      } else if (C === 'H') {
        cx = next() + ox;
        push(cx, cy);

      } else if (C === 'V') {
        cy = next() + oy;
        push(cx, cy);

      } else if (C === 'C') {
        const c1x = next() + ox, c1y = next() + oy;
        const c2x = next() + ox, c2y = next() + oy;
        const x = next() + ox, y = next() + oy;
        curveTo(c1x, c1y, c2x, c2y, x, y);
        lastCtrl = { x: c2x, y: c2y };
        cx = x; cy = y;

      } else if (C === 'S') {
        // Første kontrollpunkt er spegelen av det førre.
        const mirror = (lastCmd === 'C' || lastCmd === 'S') && lastCtrl
          ? { x: 2 * cx - lastCtrl.x, y: 2 * cy - lastCtrl.y }
          : { x: cx, y: cy };
        const c2x = next() + ox, c2y = next() + oy;
        const x = next() + ox, y = next() + oy;
        curveTo(mirror.x, mirror.y, c2x, c2y, x, y);
        lastCtrl = { x: c2x, y: c2y };
        cx = x; cy = y;

      } else if (C === 'Q') {
        const qx = next() + ox, qy = next() + oy;
        const x = next() + ox, y = next() + oy;
        const c = RV.geom.quadToCubic(cx, cy, qx, qy, x, y);
        curveTo(c[2], c[3], c[4], c[5], x, y);
        lastCtrl = { x: qx, y: qy };
        cx = x; cy = y;

      } else if (C === 'T') {
        const q = (lastCmd === 'Q' || lastCmd === 'T') && lastCtrl
          ? { x: 2 * cx - lastCtrl.x, y: 2 * cy - lastCtrl.y }
          : { x: cx, y: cy };
        const x = next() + ox, y = next() + oy;
        const c = RV.geom.quadToCubic(cx, cy, q.x, q.y, x, y);
        curveTo(c[2], c[3], c[4], c[5], x, y);
        lastCtrl = q;
        cx = x; cy = y;

      } else if (C === 'A') {
        const rx = next(), ry = next(), rot = next();
        const large = next(), sweep = next();
        const x = next() + ox, y = next() + oy;
        RV.geom.arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y)
          .forEach(c => curveTo(c[2], c[3], c[4], c[5], c[6], c[7]));
        cx = x; cy = y;

      } else if (C === 'Z') {
        if (sp) {
          sp.closed = true;
          // Endar stien på same punkt som han byrja, er det siste punktet
          // ein dublett som Z gjer overflødig.
          const last = sp.points[sp.points.length - 1];
          if (sp.points.length > 2 && Math.abs(last.x - sx) < 1e-6 && Math.abs(last.y - sy) < 1e-6) {
            sp.points[0].ix = last.ix;
            sp.points[0].iy = last.iy;
            sp.points.pop();
          }
          subpaths.push(sp);
          sp = null;
        }
        cx = sx; cy = sy;

      } else {
        i++;   // ukjend kommando — hopp over eitt teikn og prøv vidare
        continue;
      }

      if (C !== 'C' && C !== 'S' && C !== 'Q' && C !== 'T') lastCtrl = null;
      lastCmd = C;

      // Ein ny delsti må startast etter Z om det kjem fleire tal.
      if (!sp && i < tokens.length && isNum(tokens[i])) {
        sp = RV.geom.makeSubpath([], false);
        push(cx, cy);
      }
    }

    if (sp && sp.points.length > 1) subpaths.push(sp);
    return subpaths.filter(s => s.points.length >= 2);
  }

  /** Merkjer eit punkt som mjukt når handtaka ligg på line gjennom det. */
  function markSmooth(p) {
    if (!p) return;
    const inX = p.x - p.ix, inY = p.y - p.iy;
    const outX = p.ox - p.x, outY = p.oy - p.y;
    if ((inX === 0 && inY === 0) || (outX === 0 && outY === 0)) return;
    const cross = inX * outY - inY * outX;
    const scale = Math.hypot(inX, inY) * Math.hypot(outX, outY);
    if (scale && Math.abs(cross) / scale < 0.02) p.type = 'smooth';
  }

  return { parse, parsePathData, toHex };
})();
