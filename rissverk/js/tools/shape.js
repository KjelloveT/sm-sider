/* ══════════════════════════════════════════════
   SHAPE.JS — Rektangel, ellipse, linje og mangekant

   Alle fire verktøya er same handling: dra ei ramme, og lag ei form som
   fyller henne. Dei skil seg berre i kva geometri ramma blir omsett til,
   så dei deler heile drag-logikken og får kvar sin `build`-funksjon.

   Forma blir lagd inn i modellen med ein gong peikaren går ned, og
   oppdatert medan brukaren dreg. Å vente til peikaren slepp ville vore
   enklare, men då måtte forma teiknast to gonger — éin gong som ei
   førehandsvising i overlegget og éin gong for alvor — og dei to ville
   uunngåeleg drive frå kvarandre.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

(function () {
  'use strict';

  const MIN_SIZE = 0.5;      // dokumenteiningar — mindre er eit klikk, ikkje ei form

  let current = null;        // noden som blir teikna
  let anchor = null;         // punktet der draget tok til
  let builder = null;
  let undoSnapshot = null;

  /* ──────────────── Ramma under peikaren ──────────────── */

  /**
   * Rekk ut ramma frå ankeret til peikaren.
   * Skift gjer henne kvadratisk, Alt lèt ankeret vere midtpunktet.
   */
  function frameFrom(ctx) {
    let ax = anchor.x, ay = anchor.y;
    // Både rutenettet og kantane på det som alt står på flata. Ctrl slår
    // begge av, slik at ein kan teikne heilt fritt når ein vil det.
    const snapped = RV.snap.point(
      { x: RV.view.snapValue(ctx.x), y: RV.view.snapValue(ctx.y) }, ctx.ctrl);
    let px = snapped.x;
    let py = snapped.y;

    let w = px - ax;
    let h = py - ay;

    if (ctx.shift) {
      const s = Math.max(Math.abs(w), Math.abs(h));
      w = s * (w < 0 ? -1 : 1);
      h = s * (h < 0 ? -1 : 1);
    }

    if (ctx.alt) {
      return { x: ax - w, y: ay - h, w: w * 2, h: h * 2, x2: ax + w, y2: ay + h };
    }
    return {
      x: Math.min(ax, ax + w), y: Math.min(ay, ay + h),
      w: Math.abs(w), h: Math.abs(h),
      x2: ax + w, y2: ay + h
    };
  }

  /* ──────────────── Byggjarane ──────────────── */

  const BUILDERS = {
    rect: {
      type: 'rect',
      init: (f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, rx: 0, ry: 0 }),
      update: (geom, f) => {
        geom.x = f.x; geom.y = f.y; geom.w = f.w; geom.h = f.h;
        // Held avrundinga innanfor forma når ho blir dregen mindre.
        const max = Math.min(f.w, f.h) / 2;
        if (geom.rx > max) { geom.rx = max; geom.ry = max; }
      },
      valid: (f) => f.w > MIN_SIZE && f.h > MIN_SIZE
    },

    ellipse: {
      type: 'ellipse',
      init: (f) => ({ cx: f.x + f.w / 2, cy: f.y + f.h / 2, rx: f.w / 2, ry: f.h / 2 }),
      update: (geom, f) => {
        geom.cx = f.x + f.w / 2; geom.cy = f.y + f.h / 2;
        geom.rx = f.w / 2; geom.ry = f.h / 2;
      },
      valid: (f) => f.w > MIN_SIZE && f.h > MIN_SIZE
    },

    line: {
      type: 'line',
      init: (f) => ({ x1: anchor.x, y1: anchor.y, x2: f.x2, y2: f.y2 }),
      update: (geom, f) => { geom.x2 = f.x2; geom.y2 = f.y2; },
      valid: (f) => Math.hypot(f.x2 - anchor.x, f.y2 - anchor.y) > MIN_SIZE,
      // Ei linje utan strek er usynleg. Ho arvar difor fyllfargen som strek
      // når brukaren står med eit oppsett som ikkje har strek.
      style: (node) => {
        node.fill = { type: 'none' };
        if (!node.stroke || node.stroke.type === 'none') {
          node.stroke = { type: 'solid', color: '#1a1a1a', opacity: 1, width: 2, dash: '', cap: 'round', join: 'miter' };
        }
      }
    },

    poly: {
      type: 'poly',
      init: (f) => ({
        cx: f.x + f.w / 2, cy: f.y + f.h / 2,
        r1: Math.max(f.w, f.h) / 2, r2: Math.max(f.w, f.h) / 4,
        sides: settings.sides, star: settings.star, rotation: 0
      }),
      update: (geom, f) => {
        geom.cx = f.x + f.w / 2;
        geom.cy = f.y + f.h / 2;
        geom.r1 = Math.max(f.w, f.h) / 2;
        geom.r2 = geom.r1 * settings.innerRatio;
        geom.sides = settings.sides;
        geom.star = settings.star;
      },
      valid: (f) => Math.max(f.w, f.h) > MIN_SIZE
    }
  };

  /* Innstillingar for mangekanten. Dei ligg utanfor draget så brukaren
     kan endre talet på kantar i panelet og teikne fleire like former. */
  const settings = { sides: 5, star: false, innerRatio: 0.45 };

  function setPolySettings(next) {
    Object.assign(settings, next);
  }

  /* ──────────────── Draget ──────────────── */

  function beginTool(kind) {
    return {
      onDown: (ctx) => {
        undoSnapshot = RV.state.snapshot();
        RV.snap.begin([]);
        anchor = RV.snap.point(RV.view.snapPoint({ x: ctx.x, y: ctx.y }), ctx.ctrl);
        builder = BUILDERS[kind];

        const f = frameFrom(ctx);
        const node = RV.state.makeNode(builder.type, builder.init(f));
        if (builder.style) builder.style(node);
        RV.state.add(node, null);
        current = node;

        RV.state.setSelection([node.id]);
        RV.hit.invalidate();
        RV.state.emit('nodes');
      },

      onMove: (ctx) => {
        if (!current) return;
        builder.update(current.geom, frameFrom(ctx));
        RV.hit.invalidate();
        RV.state.emit('nodes');
      },

      onUp: (ctx) => {
        if (!current) return;
        const f = frameFrom(ctx);

        if (!builder.valid(f)) {
          // Eit reint klikk lagar ei form i standardstorleik der ein klikka.
          // Alternativet — å la klikket gjere ingenting — kjennest som om
          // verktøyet ikkje verkar.
          defaultSize(current, ctx);
        }

        RV.state.pushUndoSnapshot(undoSnapshot);
        RV.snap.end();
        RV.hit.invalidate();
        RV.state.emit('nodes');
        RV.state.emit('selection');

        current = null;
        builder = null;
        undoSnapshot = null;
        // Tilbake til markeringsverktøyet, så den nye forma kan justerast
        // med ein gong. Held brukaren Alt, blir verktøyet ståande.
        if (!ctx.alt) RV.tools.setActive('select');
      },

      onCancel: () => {
        if (current) {
          RV.state.remove(current.id);
          RV.hit.invalidate();
          RV.state.emit('nodes');
        }
        RV.snap.end();
        current = null;
        builder = null;
        undoSnapshot = null;
      }
    };
  }

  const DEFAULT = 80;

  function defaultSize(node, ctx) {
    const x = ctx.x, y = ctx.y;
    const g = node.geom;
    if (node.type === 'rect') {
      g.x = x - DEFAULT / 2; g.y = y - DEFAULT / 2; g.w = DEFAULT; g.h = DEFAULT;
    } else if (node.type === 'ellipse') {
      g.cx = x; g.cy = y; g.rx = DEFAULT / 2; g.ry = DEFAULT / 2;
    } else if (node.type === 'line') {
      g.x1 = x - DEFAULT / 2; g.y1 = y; g.x2 = x + DEFAULT / 2; g.y2 = y;
    } else if (node.type === 'poly') {
      g.cx = x; g.cy = y; g.r1 = DEFAULT / 2; g.r2 = (DEFAULT / 2) * settings.innerRatio;
    }
  }

  /* ──────────────── Registrering ──────────────── */

  RV.tools.register(Object.assign({
    id: 'rect', name: 'Rektangel', hint: 'Dra ei ramme. Skift gjev kvadrat, Alt teiknar frå midten.',
    icon: 'square', key: 'r', level: 'basic', cursor: 'crosshair'
  }, beginTool('rect')));

  RV.tools.register(Object.assign({
    id: 'ellipse', name: 'Ellipse', hint: 'Dra ei ramme. Skift gjev sirkel, Alt teiknar frå midten.',
    icon: 'circle', key: 'e', level: 'basic', cursor: 'crosshair'
  }, beginTool('ellipse')));

  RV.tools.register(Object.assign({
    id: 'line', name: 'Linje', hint: 'Dra frå eit punkt til eit anna. Skift låser til 45°-vinklar.',
    icon: 'minus', key: 'l', level: 'basic', cursor: 'crosshair'
  }, beginTool('line')));

  RV.tools.register(Object.assign({
    id: 'poly', name: 'Mangekant', hint: 'Dra ut ein mangekant eller ei stjerne. Tal på kantar står i panelet.',
    icon: 'star', key: 'y', level: 'basic', cursor: 'crosshair'
  }, beginTool('poly')));

  RV.shapeTool = { setPolySettings: setPolySettings, settings: settings };
})();
