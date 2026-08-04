/* ══════════════════════════════════════════════
   SYMBOL.JS — Gjenbrukbare former

   Eit symbol er ei form du kan leggje ut mange stader og endre éin
   gong. Det er nyttig når ein lagar eit SETT: femten ikon som alle skal
   ha same ramme, eit diagram med tjue like boksar. Endrar du ramma,
   skal alle femten endre seg.

   Definisjonen ligg i `defs.symbols` som eit lite dokument for seg —
   med sine eigne nodar, si eiga rot og sitt eige tre. Instansane er
   nodar av typen `use` som berre peikar på han, og som ber si eiga
   matrise. Difor kostar hundre instansar av eit innfløkt symbol ikkje
   meir plass enn hundre matriser.

   REDIGERING går ikkje gjennom ein eigen modus. Du løyser opp éin
   instans, endrar han som ei vanleg form, og trykkjer «oppdater
   symbolet». Ein eigen redigeringsmodus ville krevd at heile
   grensesnittet — lag, markering, verktøy — visste at det stod i eit
   anna dokument enn teikninga. Denne vegen er nokre klikk lenger, men
   ho har ingen skjulte tilstandar brukaren kan gå seg vill i.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.symbol = (function () {
  'use strict';

  function all() {
    return RV.state.data.defs.symbols || (RV.state.data.defs.symbols = {});
  }

  function get(id) {
    return all()[id] || null;
  }

  /** Kjelde som render.js kan lese eit symbol sitt tre frå. */
  function sourceFor(sym) {
    return {
      get: id => sym.nodes[id] || null,
      listOf: id => (id ? (sym.children[id] || []) : sym.root)
    };
  }

  /* ──────────────── Lage symbol ──────────────── */

  /**
   * Gjer det valde om til eit symbol, og set ein instans i staden.
   * @returns {string|null} feilmelding, eller null
   */
  function create() {
    const ids = RV.state.topSelection();
    if (!ids.length) return 'Vel noko å lage symbol av.';
    if (ids.some(id => RV.state.get(id).type === 'use')) {
      return 'Det er alt eit symbol.';
    }

    const order = RV.state.data.root.filter(id => ids.indexOf(id) !== -1);
    if (order.length !== ids.length) {
      return 'Formene må liggje på øvste nivå.';
    }

    const box = RV.state.boundsOf(order);
    if (!box) return 'Fann ingen geometri å lage symbol av.';

    RV.state.pushUndo();

    /* Symbolet blir lagra med origo i sitt eige øvre venstre hjørne.
       Instansane treng då berre ei flytting for å hamne rett, og
       symbolet kan brukast i fleire teikningar utan å dra med seg
       plasseringa si frå den første. */
    const shift = RV.matrix.translate(-box.x, -box.y);

    const sym = { name: 'Symbol', nodes: {}, root: [], children: {}, w: box.w, h: box.h };
    order.forEach((id) => {
      const copy = copyTree(id, null, sym);
      const node = sym.nodes[copy];
      node.transform = RV.matrix.mul(shift, RV.state.worldMatrix(id));
      sym.root.push(copy);
    });

    const symId = RV.util.nextId('s');
    sym.name = RV.state.get(order[0]).name || 'Symbol';
    all()[symId] = sym;

    const instance = RV.state.makeNode('use', { symbol: symId });
    instance.name = sym.name;
    instance.fill = { type: 'none' };
    instance.stroke = { type: 'none' };
    instance.transform = RV.matrix.translate(box.x, box.y);

    const at = RV.state.data.root.indexOf(order[0]);
    order.forEach(id => RV.state.remove(id));
    RV.state.add(instance, null, at);
    RV.state.setSelection([instance.id]);

    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
    return null;
  }

  /** Kopierer ein node med alt under seg inn i symbolet sitt dokument. */
  function copyTree(id, parentId, sym) {
    const src = RV.state.get(id);
    const copy = JSON.parse(JSON.stringify(src));
    copy.parent = parentId;
    sym.nodes[copy.id] = copy;
    if (parentId) (sym.children[parentId] = sym.children[parentId] || []).push(copy.id);

    RV.state.listOf(id).forEach(cid => copyTree(cid, copy.id, sym));
    return copy.id;
  }

  /* ──────────────── Løyse opp ──────────────── */

  /**
   * Gjer ein instans om til vanlege former att.
   * Dei kjem inn nøyaktig der instansen stod, med instansen sin
   * matrise lagd på.
   */
  function detach() {
    const instances = RV.state.selectedNodes().filter(n => n.type === 'use');
    if (!instances.length) return 'Vel ein symbol-instans.';

    RV.state.pushUndo();
    const made = [];

    instances.forEach((instance) => {
      const sym = get(instance.geom.symbol);
      if (!sym) return;

      const at = RV.state.data.root.indexOf(instance.id);
      const outer = RV.state.worldMatrix(instance.id);

      sym.root.forEach((rootId, i) => {
        const id = pasteTree(sym, rootId, null, at + i);
        const node = RV.state.get(id);
        node.transform = RV.matrix.mul(outer, node.transform);
        made.push(id);
      });

      RV.state.remove(instance.id);
    });

    RV.state.setSelection(made);
    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
    return null;
  }

  function pasteTree(sym, id, parentId, index) {
    const src = sym.nodes[id];
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = RV.util.nextId('n');
    RV.state.add(copy, parentId, index);
    (sym.children[id] || []).forEach(cid => pasteTree(sym, cid, copy.id));
    return copy.id;
  }

  /* ──────────────── Oppdatere ──────────────── */

  /**
   * Skriv det valde inn i eit symbol som finst frå før — og dermed inn
   * i alle instansane av det.
   */
  function update(symId) {
    const sym = get(symId);
    if (!sym) return 'Symbolet finst ikkje lenger.';

    const ids = RV.state.topSelection();
    if (!ids.length) return 'Vel formene som skal bli det nye innhaldet.';

    const box = RV.state.boundsOf(ids);
    if (!box) return 'Fann ingen geometri.';

    RV.state.pushUndo();

    const shift = RV.matrix.translate(-box.x, -box.y);
    const next = { name: sym.name, nodes: {}, root: [], children: {}, w: box.w, h: box.h };
    const order = RV.state.data.root.filter(id => ids.indexOf(id) !== -1);

    order.forEach((id) => {
      const copy = copyTree(id, null, next);
      next.nodes[copy].transform = RV.matrix.mul(shift, RV.state.worldMatrix(id));
      next.root.push(copy);
    });

    all()[symId] = next;
    order.forEach(id => RV.state.remove(id));

    RV.hit.invalidate();
    RV.state.emit('nodes');
    RV.state.emit('selection');
    return null;
  }

  /* ──────────────── Rydding og oppslag ──────────────── */

  function collectGarbage() {
    const brukt = {};
    RV.state.walk((node) => {
      if (node.type === 'use' && node.geom.symbol) brukt[node.geom.symbol] = true;
    });
    Object.keys(all()).forEach((id) => {
      if (!brukt[id]) delete all()[id];
    });
  }

  /** Kor mange instansar eit symbol har. Vist i panelet. */
  function countInstances(symId) {
    let n = 0;
    RV.state.walk((node) => {
      if (node.type === 'use' && node.geom.symbol === symId) n += 1;
    });
    return n;
  }

  /** Ramma til eit symbol, i instansen sitt eige rom. */
  function bounds(symId) {
    const sym = get(symId);
    if (!sym) return null;

    const src = sourceFor(sym);
    let box = null;
    sym.root.forEach((id) => {
      const node = src.get(id);
      if (!node) return;
      const local = localBoundsIn(node, src);
      if (local) box = RV.geom.unionRect(box, RV.matrix.transformRect(node.transform, local));
    });
    return box;
  }

  /* Same utrekning som state.localBounds, men mot symbolet si eiga
     nodesamling. Vi kan ikkje kalle state-versjonen, for han slår opp
     i teikninga og finn ingenting der. */
  function localBoundsIn(node, src) {
    if (node.type === 'group') {
      let box = null;
      src.listOf(node.id).forEach((cid) => {
        const child = src.get(cid);
        if (!child) return;
        const cb = localBoundsIn(child, src);
        if (cb) box = RV.geom.unionRect(box, RV.matrix.transformRect(child.transform, cb));
      });
      return box;
    }
    if (node.type === 'image') {
      const g = node.geom;
      return { x: g.x, y: g.y, w: g.w, h: g.h };
    }
    const subpaths = RV.geom.toSubpaths(node);
    return subpaths.length ? RV.geom.boundsOfSubpaths(subpaths) : null;
  }

  /* ──────────────── Teikning ──────────────── */

  /** Legg symbol-definisjonane inn i defs. Kalla frå render.js. */
  function buildSymbols(defsEl) {
    const symbols = all();
    Object.keys(symbols).forEach((id) => {
      const sym = symbols[id];
      const src = sourceFor(sym);

      const g = RV.util.svg('g', { id: 'sym-' + id });
      sym.root.forEach((nodeId) => {
        const node = src.get(nodeId);
        if (node) g.appendChild(RV.render.buildFresh(node, src));
      });
      defsEl.appendChild(g);
    });
  }

  return {
    all, get, create, detach, update, collectGarbage,
    countInstances, bounds, buildSymbols, sourceFor
  };
})();
