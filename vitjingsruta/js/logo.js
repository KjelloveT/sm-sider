/* ══════════════════════════════════════════════
   LOGO.JS — Merket midt i koden

   Tre kjelder: eit av dei felles Lucide-ikona, ein av Vyrdepil-logoane,
   eller ei fil brukaren lastar opp sjølv.

   Om opplasta SVG: ei SVG-fil er ikkje eit bilete, det er eit dokument
   som kan innehalde skript. Vi tek difor imot henne som markup, kastar
   alt som ikkje står på kvitlista under, og set saman fila på nytt frå
   det som blir att. Først då blir ho gjort om til ein data-URI. Er det
   noko som helst vi ikkje kjenner att, ryk det — kvitliste, ikkje
   svarteliste, fordi ei svarteliste alltid manglar det neste trikset.
   ══════════════════════════════════════════════ */
window.VR = window.VR || {};

VR.logo = (function () {
  'use strict';

  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  const MAX_RASTER_SIDE = 512;

  /* Ikon som passar til dei ulike innhaldstypane, lagt først i galleriet. */
  const SUGGESTED = ['wifi', 'link', 'mapPin', 'mail', 'phone', 'calendar',
    'contact', 'graduationCap', 'book', 'bookOpen', 'star', 'heart'];

  /* ──────────────── Innebygde ikon ──────────────── */

  function iconNames() {
    const all = Object.keys(VyrdepilIcons.ICON_PATHS).sort((a, b) => a.localeCompare(b, 'nn'));
    const first = SUGGESTED.filter(nm => VyrdepilIcons.has(nm));
    return first.concat(all.filter(nm => first.indexOf(nm) === -1));
  }

  function fromIcon(name) {
    const markup = VyrdepilIcons.ICON_PATHS[name];
    if (!markup) return null;
    return { kind: 'icon', name: name, markup: markup };
  }

  /* ──────────────── Bilete ──────────────── */

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Klarte ikkje lese biletet.'));
      img.src = src;
    });
  }

  /* Ein logo blir vist i eit felt på nokre få hundre pikslar. Ei fil på
     3000 px gjev ingenting att for det, men den ligg med i kvar einaste
     eksport og i kvar lagra oppsett-fil. */
  function shrink(img) {
    const side = Math.max(img.naturalWidth, img.naturalHeight);
    if (side <= MAX_RASTER_SIDE) return null;
    const k = MAX_RASTER_SIDE / side;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  async function fromDataUri(dataUri, vector) {
    const img = await loadImage(dataUri);
    return {
      kind: 'image',
      dataUri: dataUri,
      img: img,
      vector: !!vector,
      aspect: (img.naturalWidth || 1) / (img.naturalHeight || 1)
    };
  }

  /* ──────────────── SVG-sanitering ──────────────── */

  const OK_TAGS = {
    svg: 1, g: 1, path: 1, circle: 1, ellipse: 1, rect: 1, line: 1,
    polyline: 1, polygon: 1, defs: 1, linearGradient: 1, radialGradient: 1,
    stop: 1, clipPath: 1, title: 1, desc: 1
  };

  const OK_ATTRS = {
    d: 1, cx: 1, cy: 1, r: 1, rx: 1, ry: 1, x: 1, y: 1, x1: 1, y1: 1, x2: 1, y2: 1,
    width: 1, height: 1, points: 1, transform: 1, viewBox: 1, offset: 1,
    fill: 1, stroke: 1, opacity: 1, id: 1,
    'fill-rule': 1, 'clip-rule': 1, 'fill-opacity': 1, 'stroke-width': 1,
    'stroke-opacity': 1, 'stroke-linecap': 1, 'stroke-linejoin': 1,
    'stroke-dasharray': 1, 'stroke-miterlimit': 1,
    'stop-color': 1, 'stop-opacity': 1, 'clip-path': 1, 'gradientUnits': 1,
    'gradientTransform': 1, 'clipPathUnits': 1
  };

  /* Ein attributtverdi som peikar ut av dokumentet, eller inn i eit
     skript-skjema, blir kasta same kva attributten heiter. */
  function safeValue(name, value) {
    const v = String(value);
    if (/^on/i.test(name)) return false;
    if (/(javascript|data)\s*:/i.test(v)) return false;
    if (name === 'clip-path' || name === 'fill' || name === 'stroke') {
      /* url(#id) er greitt; url(http…) er ein ekstern henting. */
      if (/url\(\s*['"]?(?!#)/i.test(v)) return false;
    }
    if (/https?:\/\//i.test(v)) return false;
    return true;
  }

  function sanitizeSvg(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('Fila er ikkje gyldig SVG.');
    }
    const src = doc.documentElement;
    if (!src || src.nodeName.toLowerCase() !== 'svg') {
      throw new Error('Fila er ikkje gyldig SVG.');
    }

    const NS = 'http://www.w3.org/2000/svg';
    const out = document.implementation.createDocument(NS, 'svg', null);
    let removed = 0;

    function copyAttrs(from, to) {
      for (let i = 0; i < from.attributes.length; i++) {
        const a = from.attributes[i];
        const name = a.name;
        /* xmlns og version blir sette på nytt av oss uansett, så dei skal
           ikkje teljast som «fjerna» — talet er meint å fortelje brukaren
           kor mykje uventa som låg i fila. */
        if (name === 'xmlns' || name === 'version') continue;
        if (name.indexOf(':') !== -1 && name !== 'xml:space') { removed++; continue; }
        if (!OK_ATTRS[name]) { removed++; continue; }
        if (!safeValue(name, a.value)) { removed++; continue; }
        to.setAttribute(name, a.value);
      }
    }

    function walk(from, to) {
      for (let i = 0; i < from.childNodes.length; i++) {
        const node = from.childNodes[i];
        if (node.nodeType === 3) {
          if (to.nodeName === 'title' || to.nodeName === 'desc') {
            to.appendChild(out.createTextNode(node.nodeValue));
          }
          continue;
        }
        if (node.nodeType !== 1) continue;
        const tag = node.nodeName;
        if (!OK_TAGS[tag]) { removed++; continue; }
        const el = out.createElementNS(NS, tag);
        copyAttrs(node, el);
        to.appendChild(el);
        walk(node, el);
      }
    }

    const root = out.documentElement;
    copyAttrs(src, root);
    walk(src, root);

    /* Utan viewBox veit vi ikkje kva område innhaldet dekkjer, og
       skaleringa blir eit sjansespel. Vi lagar ein av breidd og høgd. */
    if (!root.getAttribute('viewBox')) {
      const w = parseFloat(src.getAttribute('width')) || 24;
      const h = parseFloat(src.getAttribute('height')) || 24;
      root.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    }
    root.setAttribute('xmlns', NS);

    const markup = new XMLSerializer().serializeToString(root);
    return { markup: markup, removed: removed };
  }

  /* ──────────────── Opplasting ──────────────── */

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('Klarte ikkje lese fila.'));
      fr.readAsText(file);
    });
  }

  function readFileDataUri(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('Klarte ikkje lese fila.'));
      fr.readAsDataURL(file);
    });
  }

  /**
   * @returns {Promise<{asset: object, note: string|null}>}
   */
  async function fromFile(file) {
    if (!file) throw new Error('Inga fil.');
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('Fila er større enn 4 MB. Vel ei mindre.');
    }

    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    if (isSvg) {
      const text = await readFileText(file);
      const clean = sanitizeSvg(text);
      const uri = 'data:image/svg+xml;base64,' +
        btoa(unescape(encodeURIComponent(clean.markup)));
      const asset = await fromDataUri(uri, true);
      asset.name = file.name;
      return {
        asset: asset,
        note: clean.removed
          ? 'SVG-en er reinska: ' + clean.removed + ' element eller attributt vart fjerna.'
          : null
      };
    }

    if (!/^image\//.test(file.type)) {
      throw new Error('Vel ei biletfil (PNG, JPG, WebP eller SVG).');
    }

    const uri = await readFileDataUri(file);
    let asset = await fromDataUri(uri, false);
    const smaller = shrink(asset.img);
    let note = null;
    if (smaller) {
      asset = await fromDataUri(smaller, false);
      note = 'Biletet er skalert ned til ' + MAX_RASTER_SIDE + ' px. Ein logo blir aldri vist større.';
    }
    asset.name = file.name;
    return { asset: asset, note: note };
  }

  /* ──────────────── Vyrdepil-logoar ──────────────── */

  /* PNG-ane i _resources/ ligg på same origin, så lerretet blir ikkje
     tainta og vi kan lese dei ut som data-URI. Det gjer den eksporterte
     fila sjølvberande — han verkar òg utan nett. */
  async function fromApp(href) {
    const img = await loadImage(href);
    const c = document.createElement('canvas');
    const side = Math.max(img.naturalWidth, img.naturalHeight);
    const k = side > MAX_RASTER_SIDE ? MAX_RASTER_SIDE / side : 1;
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return fromDataUri(c.toDataURL('image/png'), false);
  }

  return {
    iconNames, fromIcon, fromFile, fromApp, fromDataUri,
    sanitizeSvg, MAX_RASTER_SIDE
  };
})();
