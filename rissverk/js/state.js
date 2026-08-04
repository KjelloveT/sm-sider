/* ══════════════════════════════════════════════
   STATE.JS — Teikninga, laga og angre-historikken

   Modellen er ei FLAT liste med nodar, pluss to kart som held
   trestrukturen: `children` seier kva som ligg inni ei gruppe, og
   `root` seier rekkjefølgja på øvste nivå.

   Alternativet — å la kvar node ha ei liste med barn i seg — ser
   ryddigare ut, men gjer oppslag dyrt. Ein editor slår opp nodar etter id
   heile tida: ved treffdeteksjon, ved markering, ved kvar einaste
   opptegning. Med eit flatt kart er det eit oppslag; med eit tre måtte vi
   gå gjennom heile strukturen kvar gong.

   Rekkjefølgja i listene er TEIKNEREKKJEFØLGJE: første element ligg
   bakerst. Det er same rekkjefølgje som i SVG-fila, så eksporten blir
   ei rett fram gjennomgang, men motsett av det lagpanelet viser — der
   ventar folk å sjå det øvste laget øvst.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.state = (function () {
  'use strict';

  const listeners = [];
  const UNDO_LIMIT = 60;

  /* ──────────────── Standardverdiar ──────────────── */

  function defaultDoc() {
    return { width: 512, height: 512, bg: null };
  }

  function defaultView() {
    return { zoom: 1, panX: 0, panY: 0, grid: false, gridSize: 16, snap: true };
  }

  /** Stilen nye former får. Endrar brukaren fyllet, følgjer neste form etter. */
  function defaultStyle() {
    return {
      fill: { type: 'solid', color: '#8ecae6', opacity: 1 },
      stroke: { type: 'solid', color: '#1a1a1a', opacity: 1, width: 2, dash: '', cap: 'butt', join: 'miter' }
    };
  }

  /* ──────────────── Tilstanden ──────────────── */

  const data = {
    title: '',
    doc: defaultDoc(),
    nodes: {},           // id → node
    root: [],            // id-ar på øvste nivå, bakarst først
    children: {},        // gruppe-id → id-ar, bakarst først
    defs: { gradients: {}, symbols: {} },
    selection: [],       // node-id-ar
    view: defaultView(),
    style: defaultStyle(),
    scaleStrokes: true   // skal strekbreidda følgje med når ein skalerer?
  };

  const undoStack = [];
  const redoStack = [];

  /* ──────────────── Varsling ──────────────── */

  /** topic: 'nodes' | 'selection' | 'view' | 'doc' | 'style' | 'load' */
  function emit(topic) {
    listeners.forEach(fn => fn(topic, data));
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  /* ──────────────── Nodar ──────────────── */

  /**
   * Ein node er ei form, ei gruppe eller eit bilete. Alle ber same
   * ytre felt; det er berre `geom` som skifter med typen.
   */
  function makeNode(type, geom, style) {
    const s = style || data.style;
    return {
      id: RV.util.nextId('n'),
      type: type,
      name: defaultName(type),
      parent: null,
      visible: true,
      locked: false,
      opacity: 1,
      transform: RV.matrix.identity(),
      fill: cloneStyle(s.fill),
      stroke: cloneStyle(s.stroke),
      geom: geom || {}
    };
  }

  function cloneStyle(part) {
    return part ? JSON.parse(JSON.stringify(part)) : { type: 'none' };
  }

  const TYPE_NAMES = {
    rect: 'Rektangel', ellipse: 'Ellipse', line: 'Linje',
    poly: 'Mangekant', path: 'Sti', group: 'Gruppe',
    text: 'Tekst', image: 'Bilete', use: 'Instans'
  };

  const typeCounts = {};
  function defaultName(type) {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    return (TYPE_NAMES[type] || 'Objekt') + ' ' + typeCounts[type];
  }

  function get(id) {
    return data.nodes[id] || null;
  }

  /** Syskenlista som noden ligg i — root, eller barna til gruppa hans. */
  function siblingsOf(id) {
    const node = get(id);
    if (!node) return data.root;
    return node.parent ? (data.children[node.parent] || []) : data.root;
  }

  function listOf(parentId) {
    if (!parentId) return data.root;
    if (!data.children[parentId]) data.children[parentId] = [];
    return data.children[parentId];
  }

  /**
   * Legg noden inn i teikninga.
   * @param {string|null} parentId gruppa han skal inn i, eller null for øvste nivå
   * @param {number} [index] plass i lista; utan han hamnar han fremst (øvst)
   */
  function add(node, parentId, index) {
    node.parent = parentId || null;
    data.nodes[node.id] = node;
    const list = listOf(parentId);
    if (index == null || index >= list.length) list.push(node.id);
    else list.splice(Math.max(0, index), 0, node.id);
    return node;
  }

  /** Fjernar noden og alt som ligg inni han. */
  function remove(id) {
    const node = get(id);
    if (!node) return;
    (data.children[id] || []).slice().forEach(remove);
    delete data.children[id];
    const list = siblingsOf(id);
    const i = list.indexOf(id);
    if (i !== -1) list.splice(i, 1);
    delete data.nodes[id];
    const s = data.selection.indexOf(id);
    if (s !== -1) data.selection.splice(s, 1);
  }

  /** Alle nodar under `id`, inkludert han sjølv. */
  function descendants(id, out) {
    out = out || [];
    out.push(id);
    (data.children[id] || []).forEach(child => descendants(child, out));
    return out;
  }

  /** Sant når `maybeAncestor` ligg over `id` i treet. */
  function isAncestor(maybeAncestor, id) {
    let node = get(id);
    while (node && node.parent) {
      if (node.parent === maybeAncestor) return true;
      node = get(node.parent);
    }
    return false;
  }

  /** Alle nodar i teiknerekkjefølgje, djupaste sist innanfor kvar gruppe. */
  function walk(fn, parentId) {
    listOf(parentId).forEach((id) => {
      const node = get(id);
      if (!node) return;
      fn(node);
      if (node.type === 'group') walk(fn, id);
    });
  }

  /* ──────────────── Transformasjonar ──────────────── */

  /**
   * Matrisa som tek noden frå sine eigne koordinatar til dokumentet —
   * altså hans eigen transformasjon med alle gruppene over lagt utanpå.
   */
  function worldMatrix(id) {
    const chain = [];
    let node = get(id);
    while (node) {
      chain.unshift(node.transform);
      node = node.parent ? get(node.parent) : null;
    }
    return RV.matrix.mulAll(chain);
  }

  /** Matrisa til foreldra åleine — den vi må vende for å setje ein ny lokal transform. */
  function parentMatrix(id) {
    const node = get(id);
    return node && node.parent ? worldMatrix(node.parent) : RV.matrix.identity();
  }

  /**
   * Legg ein transformasjon på noden, uttrykt i DOKUMENTKOORDINATAR.
   *
   * Utan denne omrekninga ville ei form inni ei rotert gruppe flytta seg
   * på skrå når brukaren drog henne rett til høgre — modellen ville lagt
   * flyttinga på i gruppa sitt skeive koordinatsystem. Vi vender difor
   * foreldrematrisa, gjer jobben i dokumentet, og set resultatet tilbake.
   */
  function applyWorld(id, worldDelta) {
    const node = get(id);
    if (!node) return;
    const pm = parentMatrix(id);
    const inv = RV.matrix.invert(pm);
    if (!inv) return;
    node.transform = RV.matrix.mulAll([inv, worldDelta, pm, node.transform]);
    if (data.scaleStrokes) return;

    /* Strekbreidda skal stå imot skaleringa: rekn henne ned like mykje.
       Dette må gå gjennom HEILE undertreet. Ei gruppe har ingen strek
       sjølv, så gjorde vi det berre på noden, ville valet stille slutta
       å verke i det brukaren grupperte formene sine. */
    const s = RV.matrix.meanScale(worldDelta);
    if (!s || Math.abs(s - 1) < 1e-9) return;
    descendants(id).forEach((did) => {
      const n = get(did);
      if (n && n.stroke && n.stroke.type !== 'none') n.stroke.width = n.stroke.width / s;
    });
  }

  /* ──────────────── Rammer ──────────────── */

  /** Ramma til noden i sine eigne koordinatar, utan transformasjon. */
  function localBounds(node) {
    if (node.type === 'use') return RV.symbol.bounds(node.geom.symbol);

    if (node.type === 'group') {
      let box = null;
      (data.children[node.id] || []).forEach((cid) => {
        const child = get(cid);
        if (!child) return;
        const cb = localBounds(child);
        if (cb) box = RV.geom.unionRect(box, RV.matrix.transformRect(child.transform, cb));
      });
      // Ei maske gjer at berre det som ligg innanfor henne er synleg.
      // Ramma må følgje det ein SER, ikkje det som er gøymt bak kanten.
      if (box && node.clip) {
        const limit = RV.clip.clipBounds(node);
        if (limit) box = intersectRect(box, limit);
      }
      return box;
    }
    if (node.type === 'image') {
      const g = node.geom;
      return { x: g.x, y: g.y, w: g.w, h: g.h };
    }

    if (node.type === 'text') return textBounds(node);
    const subpaths = RV.geom.toSubpaths(node);
    return subpaths.length ? RV.geom.boundsOfSubpaths(subpaths) : null;
  }

  /** Den felles delen av to rammer. Tom ramme når dei ikkje møtest. */
  function intersectRect(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const w = Math.min(a.x + a.w, b.x + b.w) - x;
    const h = Math.min(a.y + a.h, b.y + b.h) - y;
    return w > 0 && h > 0 ? { x: x, y: y, w: w, h: h } : a;
  }

  /**
   * Ramma om ein tekst.
   *
   * Vi spør SJØLVE ELEMENTET gjennom getBBox(). Det er den einaste
   * måten å få eksakte tal: breidda på ein tekst kjem an på fonten som
   * faktisk er installert, på kerning og på ligaturar, og alt det veit
   * berre nettlesaren. getBBox gjev ramma i nodens eige koordinatsystem,
   * altså nøyaktig det localBounds skal gje.
   *
   * Er elementet ikkje teikna — skjult lag, eller like etter innlasting
   * før første opptegning — fell vi tilbake på eit overslag. Det er
   * grovt, men det held forma på plass til ho blir teikna og målt.
   */
  function textBounds(node) {
    const el = RV.render && RV.render.elementOf ? RV.render.elementOf(node.id) : null;
    if (el && el.getBBox && el.isConnected) {
      try {
        const box = el.getBBox();
        if (box.width || box.height) {
          return { x: box.x, y: box.y, w: box.width, h: box.height };
        }
      } catch (e) { /* ikkje teikna enno */ }
    }

    const g = node.geom;
    const lines = String(g.text || '').split('\n');
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
    // ~0,55 em per teikn er eit brukbart snitt for proporsjonale fontar.
    const w = longest * g.size * 0.55;
    const h = lines.length * g.size * (g.lineHeight || 1.25);
    const x = g.align === 'middle' ? g.x - w / 2 : (g.align === 'end' ? g.x - w : g.x);
    return { x: x, y: g.y - g.size * 0.8, w: w, h: h };
  }

  /** Ramma i dokumentkoordinatar, akseparallell. */
  function worldBounds(id) {
    const node = get(id);
    if (!node) return null;
    const local = localBounds(node);
    if (!local) return null;
    return RV.matrix.transformRect(worldMatrix(id), local);
  }

  /** Samla ramme om fleire nodar. */
  function boundsOf(ids) {
    let box = null;
    ids.forEach((id) => { box = RV.geom.unionRect(box, worldBounds(id)); });
    return box;
  }

  function selectionBounds() {
    return boundsOf(data.selection);
  }

  /* ──────────────── Markering ──────────────── */

  function isSelected(id) {
    return data.selection.indexOf(id) !== -1;
  }

  function setSelection(ids) {
    data.selection = (ids || []).filter(id => get(id));
  }

  function toggleSelection(id) {
    const i = data.selection.indexOf(id);
    if (i === -1) data.selection.push(id);
    else data.selection.splice(i, 1);
  }

  function clearSelection() {
    data.selection = [];
  }

  function selectedNodes() {
    return data.selection.map(get).filter(Boolean);
  }

  /**
   * Markerte nodar utan dei som alt har ein markert forelder.
   * Ei transformasjon som blir lagd på både gruppa og barnet ville
   * verka to gonger på barnet, så alle operasjonar går gjennom denne.
   */
  function topSelection() {
    return data.selection.filter(id =>
      !data.selection.some(other => other !== id && isAncestor(other, id)));
  }

  /* ──────────────── Grupper ──────────────── */

  /**
   * Samlar det markerte i ei ny gruppe.
   * Gruppa hamnar der det fremste medlemmet låg, så teikninga ser lik ut
   * etterpå. Ho får identitetsmatrise: medlemmene held sine eigne
   * transformasjonar, og gruppa legg berre eit lag utanpå.
   */
  function group(ids) {
    const members = ids.filter(id => get(id));
    if (members.length < 2) return null;

    // Alle må liggje i same forelder — elles ville grupperinga flytta
    // former ut av gruppene sine og endra utsjånaden.
    const parent = get(members[0]).parent;
    if (members.some(id => get(id).parent !== parent)) return null;

    const list = listOf(parent);
    const frontIndex = Math.max.apply(null, members.map(id => list.indexOf(id)));

    const g = makeNode('group', {});
    g.fill = { type: 'none' };
    g.stroke = { type: 'none' };
    add(g, parent, frontIndex + 1);

    // Behald innbyrdes rekkjefølgje frå den gamle lista.
    const ordered = list.filter(id => members.indexOf(id) !== -1);
    ordered.forEach((id) => {
      const i = list.indexOf(id);
      if (i !== -1) list.splice(i, 1);
      get(id).parent = g.id;
      listOf(g.id).push(id);
    });
    return g;
  }

  /**
   * Løyser opp gruppa. Medlemmene tek gruppa sin transformasjon med seg,
   * så dei blir liggjande nøyaktig der dei såg ut til å liggje.
   */
  function ungroup(id) {
    const g = get(id);
    if (!g || g.type !== 'group') return [];
    const parent = g.parent;
    const list = listOf(parent);
    const at = list.indexOf(id);
    const members = (data.children[id] || []).slice();

    members.forEach((cid, i) => {
      const child = get(cid);
      child.parent = parent;
      child.transform = RV.matrix.mul(g.transform, child.transform);
      list.splice(at + i, 0, cid);
    });

    delete data.children[id];
    const self = list.indexOf(id);
    if (self !== -1) list.splice(self, 1);
    delete data.nodes[id];
    const s = data.selection.indexOf(id);
    if (s !== -1) data.selection.splice(s, 1);
    return members;
  }

  /* ──────────────── Rekkjefølgje ──────────────── */

  /**
   * @param {string} where 'up' | 'down' | 'front' | 'back'
   * Flyttar innanfor si eiga syskenliste. Ei form kan ikkje hoppe ut av
   * gruppa si berre fordi ho blir sendt heilt fram.
   */
  function reorder(id, where) {
    const list = siblingsOf(id);
    const from = list.indexOf(id);
    if (from === -1) return false;
    let to = from;
    if (where === 'up') to = from + 1;
    else if (where === 'down') to = from - 1;
    else if (where === 'front') to = list.length - 1;
    else if (where === 'back') to = 0;
    if (to === from || to < 0 || to >= list.length) return false;
    list.splice(from, 1);
    list.splice(to, 0, id);
    return true;
  }

  /** Flyttar noden til ein ny forelder og plass — brukt av dra-og-slepp i lagpanelet. */
  function moveTo(id, parentId, index) {
    const node = get(id);
    if (!node) return false;
    if (parentId === id || isAncestor(id, parentId)) return false;  // ingen sløyfer

    const world = worldMatrix(id);
    const oldList = siblingsOf(id);
    const i = oldList.indexOf(id);
    if (i !== -1) oldList.splice(i, 1);

    node.parent = parentId || null;
    const list = listOf(parentId);
    list.splice(RV.util.clamp(index == null ? list.length : index, 0, list.length), 0, id);

    // Behald plasseringa på skjermen sjølv om det nye foreldret er transformert.
    const inv = RV.matrix.invert(parentMatrix(id));
    if (inv) node.transform = RV.matrix.mul(inv, world);
    return true;
  }

  /* ──────────────── Kopiering ──────────────── */

  /** Djup kopi av noden med alt innhald, med nye id-ar. */
  function duplicate(id, parentId, index) {
    const src = get(id);
    if (!src) return null;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = RV.util.nextId('n');
    copy.name = src.name;
    add(copy, parentId === undefined ? src.parent : parentId, index);

    (data.children[id] || []).forEach((cid) => duplicate(cid, copy.id));
    return copy;
  }

  /* ──────────────── Angre og gjer om ──────────────── */

  /* Visning og markering er med vilje utanfor snapshottet: eit angre-steg
     skal endre teikninga, ikkje flytte blikket eller kaste det brukaren
     står og arbeider med. */
  function snapshot() {
    return JSON.stringify({
      title: data.title,
      doc: data.doc,
      nodes: data.nodes,
      root: data.root,
      children: data.children,
      defs: data.defs
    });
  }

  function applySnapshot(json) {
    const snap = JSON.parse(json);
    data.title = snap.title;
    data.doc = snap.doc;
    data.nodes = snap.nodes;
    data.root = snap.root;
    data.children = snap.children;
    data.defs = snap.defs;
    data.selection = data.selection.filter(id => get(id));
  }

  /** Kall FØR ei endring som skal kunne angrast. */
  function pushUndo() {
    pushUndoSnapshot(snapshot());
  }

  /**
   * Som pushUndo, men med eit snapshot teke tidlegare. Draginga brukar
   * dette: ho tek eit snapshot når peikaren går ned, men legg det ikkje
   * på stakken før noko faktisk har flytta seg. Elles ville kvart
   * uskuldige klikk fylt opp historikken.
   */
  function pushUndoSnapshot(json) {
    if (undoStack.length && undoStack[undoStack.length - 1] === json) return;
    undoStack.push(json);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack.length = 0;
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(snapshot());
    applySnapshot(undoStack.pop());
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(snapshot());
    applySnapshot(redoStack.pop());
    return true;
  }

  /* ──────────────── Dokument og visning ──────────────── */

  function setDoc(width, height, bg) {
    data.doc.width = RV.util.clamp(Math.round(width), 16, 8000);
    data.doc.height = RV.util.clamp(Math.round(height), 16, 8000);
    data.doc.bg = bg || null;
  }

  function isEmpty() {
    return data.root.length === 0;
  }

  /* ──────────────── Nullstilling og innlasting ──────────────── */

  function reset() {
    data.title = '';
    data.doc = defaultDoc();
    data.nodes = {};
    data.root = [];
    data.children = {};
    data.defs = { gradients: {}, symbols: {} };
    data.selection = [];
    undoStack.length = 0;
    redoStack.length = 0;
  }

  /** Byter ut heile teikninga — brukt når ei prosjektfil blir opna. */
  function load(payload) {
    reset();
    data.title = payload.title || '';
    data.doc = Object.assign(defaultDoc(), payload.doc || {});
    data.nodes = payload.nodes || {};
    data.root = payload.root || [];
    data.children = payload.children || {};
    data.defs = Object.assign({ gradients: {}, symbols: {} }, payload.defs || {});
    RV.util.seedIds(Object.keys(data.nodes));
  }

  return {
    data, emit, onChange,
    defaultStyle, makeNode, get, add, remove, listOf, siblingsOf,
    descendants, isAncestor, walk,
    worldMatrix, parentMatrix, applyWorld,
    localBounds, worldBounds, boundsOf, selectionBounds,
    isSelected, setSelection, toggleSelection, clearSelection,
    selectedNodes, topSelection,
    group, ungroup, reorder, moveTo, duplicate,
    snapshot, pushUndo, pushUndoSnapshot, undo, redo, canUndo, canRedo,
    setDoc, isEmpty, reset, load
  };
})();
