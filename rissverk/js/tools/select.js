/* ══════════════════════════════════════════════
   SELECT.JS — Marker, flytt, skaler og roter

   Alle tre operasjonane gjer det same: dei reknar ut ÉI matrise i
   dokumentrommet og legg henne på kvar valt node. Å skrive dei kvar for
   seg — flytting som x/y, skalering som breidd/høgd — ville brote saman
   med ein gong noko var rotert eller låg i ei transformert gruppe.

   Under ei dra blir dei opphavlege matrisene halde i `origin`, og kvart
   musesteg reknar HEILE transformasjonen på nytt frå dei. Å leggje ein
   liten delta oppå den førre ville samla opp avrundingsfeil, og ei
   skalering ville ikkje lenger kunne dra seg tilbake til utgangspunktet
   om brukaren ombestemte seg midt i draget.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

(function () {
  'use strict';

  const DRAG_SLOP = 3;       // px før eit klikk blir rekna som ei dra
  const ROTATE_SNAP = 15;    // grader, når Skift er nede

  let mode = null;           // null | 'maybe' | 'move' | 'scale' | 'rotate' | 'marquee'
  let start = null;          // { x, y, stageX, stageY } der draget tok til
  let origin = null;         // opphavlege matriser og strekbreidder
  let handle = null;         // handtaket som blir drege
  let frame0 = null;         // ramma slik ho var då draget tok til
  let undoSnapshot = null;
  let moved = false;

  /* ──────────────── Hjelp ──────────────── */

  /**
   * Tek vare på tilstanden vi skal rekne ut frå gjennom heile draget.
   *
   * Strekbreiddene blir henta frå HEILE undertreet, ikkje berre frå
   * noden sjølv. Står «skaler strek med forma» av, rører skaleringa ved
   * kvar form inni ei gruppe, og utan ein full kopi å setje tilbake til
   * ville breiddene krympa litt for kvart musesteg i draget.
   */
  function captureOrigin() {
    origin = RV.state.topSelection().map((id) => {
      const strokes = {};
      RV.state.descendants(id).forEach((did) => {
        const n = RV.state.get(did);
        if (n && n.stroke && n.stroke.type !== 'none') strokes[did] = n.stroke.width;
      });
      return {
        id: id,
        transform: RV.matrix.clone(RV.state.get(id).transform),
        strokes: strokes
      };
    });
  }

  /** Set alt tilbake til slik det var før draget. */
  function restore() {
    origin.forEach((o) => {
      const node = RV.state.get(o.id);
      if (!node) return;
      node.transform = RV.matrix.clone(o.transform);
      Object.keys(o.strokes).forEach((did) => {
        const n = RV.state.get(did);
        if (n && n.stroke) n.stroke.width = o.strokes[did];
      });
    });
  }

  /** Nullstill, og legg så på ei ny matrise rekna frå utgangspunktet. */
  function applyDelta(worldDelta) {
    restore();
    origin.forEach(o => RV.state.applyWorld(o.id, worldDelta));
    RV.hit.invalidate();
    moved = true;
  }

  /** Matrisa frå ramma sitt rom til dokumentet. */
  function frameToWorld(f) {
    if (!f.oriented) return RV.matrix.identity();
    return RV.state.worldMatrix(f.ids[0]);
  }

  /** Peikarpunkt omsett til ramma sitt eige koordinatsystem. */
  function toFrame(f, stageX, stageY) {
    const inv = RV.matrix.invert(f.m);
    return inv ? RV.matrix.apply(inv, stageX, stageY) : { x: 0, y: 0 };
  }

  /* ──────────────── Peikar ned ──────────────── */

  function onDown(ctx) {
    moved = false;
    start = { x: ctx.x, y: ctx.y, stageX: ctx.stageX, stageY: ctx.stageY };
    undoSnapshot = RV.state.snapshot();

    // 1. Eit handtak på ramma har alltid forkjørsrett.
    const grabbed = RV.overlay.handleAt(ctx.stageX, ctx.stageY);
    if (grabbed) {
      handle = grabbed;
      frame0 = RV.overlay.frame();
      captureOrigin();
      mode = grabbed.kind;
      if (mode === 'rotate') {
        const c = centerWorld(frame0);
        start.angle = Math.atan2(ctx.y - c.y, ctx.x - c.x) * 180 / Math.PI;
        start.center = c;
      }
      RV.tools.updateCursor(RV.overlay.cursorFor(grabbed));
      return;
    }

    // 2. Noko under peikaren?
    const leaf = RV.hit.nodeAt(ctx.x, ctx.y);
    if (!leaf) {
      if (!ctx.shift) {
        RV.state.clearSelection();
        RV.state.emit('selection');
      }
      mode = 'marquee';
      return;
    }

    // Alt eller dobbeltklikk går INN i gruppa og tek sjølve forma.
    const goInside = ctx.alt || (ctx.event && ctx.event.detail >= 2);
    const target = goInside ? leaf : (RV.hit.outermost(leaf.id) || leaf);

    if (ctx.shift) {
      RV.state.toggleSelection(target.id);
    } else if (!RV.state.isSelected(target.id)) {
      RV.state.setSelection([target.id]);
    }
    RV.state.emit('selection');

    if (RV.state.isSelected(target.id)) {
      captureOrigin();
      // Ramma og snap-kandidatane blir rekna ut éin gong her, ikkje for
      // kvar musrørsle. Dei kan ikkje endre seg medan draget står på.
      start.box = RV.state.boundsOf(origin.map(o => o.id));
      RV.snap.begin(origin.map(o => o.id));
      mode = 'maybe';       // blir 'move' først når peikaren faktisk flyttar seg
    } else {
      mode = null;
    }
  }

  function centerWorld(f) {
    const w = frameToWorld(f);
    return RV.matrix.apply(w, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2);
  }

  /* ──────────────── Peikar rører seg ──────────────── */

  function onMove(ctx) {
    if (!mode) {
      hover(ctx);
      return;
    }

    if (mode === 'maybe') {
      const far = Math.abs(ctx.stageX - start.stageX) > DRAG_SLOP ||
                  Math.abs(ctx.stageY - start.stageY) > DRAG_SLOP;
      if (!far) return;
      mode = 'move';
    }

    if (mode === 'move') doMove(ctx);
    else if (mode === 'scale') doScale(ctx);
    else if (mode === 'rotate') doRotate(ctx);
    else if (mode === 'marquee') doMarquee(ctx);
  }

  /** Peikarform og lett omriss under peikaren når ingenting er i gang. */
  function hover(ctx) {
    const grabbed = RV.overlay.handleAt(ctx.stageX, ctx.stageY);
    if (grabbed) {
      RV.overlay.setHover(null);
      RV.tools.updateCursor(RV.overlay.cursorFor(grabbed));
    } else {
      const node = RV.hit.nodeAt(ctx.x, ctx.y);
      const id = node ? (RV.hit.outermost(node.id) || node).id : null;
      RV.overlay.setHover(id);
      RV.tools.updateCursor(id ? 'move' : 'default');
    }
    RV.state.emit('hover');
  }

  function doMove(ctx) {
    let dx = ctx.x - start.x;
    let dy = ctx.y - start.y;

    // Skift låser til den aksen brukaren har kome lengst langs.
    if (ctx.shift) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }

    /* Snappinga tek RAMMA, ikkje peikaren — det er kanten brukaren ser,
       og difor den han ventar skal leggje seg inntil ei linje. Ctrl slår
       ho av medan ein dreg, for dei gongene ein vil plassere fritt. */
    if (start.box) {
      const moved = { x: start.box.x + dx, y: start.box.y + dy, w: start.box.w, h: start.box.h };

      const grid = RV.view.snapPoint({ x: moved.x, y: moved.y });
      let gx = grid.x - moved.x;
      let gy = grid.y - moved.y;

      const objects = RV.snap.moveBox(moved, ctx.ctrl);
      // Rutenettet gjeld berre der objekt-snappinga ikkje alt tok tak.
      if (objects.dx) gx = objects.dx;
      if (objects.dy) gy = objects.dy;

      if (!ctx.shift || dx !== 0) dx += gx;
      if (!ctx.shift || dy !== 0) dy += gy;
    }

    applyDelta(RV.matrix.translate(dx, dy));
    RV.state.emit('nodes');
  }

  function doScale(ctx) {
    const f = frame0;
    const p = toFrame(f, ctx.stageX, ctx.stageY);
    const r = f.rect;

    // Fastpunktet er motsett hjørne — eller midten når Alt er nede.
    const fixedU = ctx.alt ? 0.5 : 1 - handle.u;
    const fixedV = ctx.alt ? 0.5 : 1 - handle.v;
    const fx = r.x + fixedU * r.w;
    const fy = r.y + fixedV * r.h;

    const hx = r.x + handle.u * r.w;
    const hy = r.y + handle.v * r.h;

    let sx = handle.u === 0.5 ? 1 : safeRatio(p.x - fx, hx - fx);
    let sy = handle.v === 0.5 ? 1 : safeRatio(p.y - fy, hy - fy);

    // Skift held forholdet — men berre når begge aksane faktisk er i spel.
    if (ctx.shift && handle.u !== 0.5 && handle.v !== 0.5) {
      const s = Math.max(Math.abs(sx), Math.abs(sy));
      sx = s * Math.sign(sx || 1);
      sy = s * Math.sign(sy || 1);
    }

    const w = frameToWorld(f);
    const inv = RV.matrix.invert(w);
    if (!inv) return;
    applyDelta(RV.matrix.mulAll([w, RV.matrix.scaleAround(sx, sy, fx, fy), inv]));
    RV.state.emit('nodes');
  }

  /* Ei form som er skrumpa til null i ei retning har ingen storleik å
     måle mot. Vi held henne på 1 i staden for å dele på null og sende
     heile matrisa til NaN. */
  function safeRatio(a, b) {
    return Math.abs(b) < 1e-9 ? 1 : a / b;
  }

  function doRotate(ctx) {
    const c = start.center;
    let angle = Math.atan2(ctx.y - c.y, ctx.x - c.x) * 180 / Math.PI - start.angle;
    if (ctx.shift) angle = Math.round(angle / ROTATE_SNAP) * ROTATE_SNAP;
    applyDelta(RV.matrix.rotate(angle, c.x, c.y));
    RV.state.emit('nodes');
  }

  function doMarquee(ctx) {
    const rect = {
      x: Math.min(start.stageX, ctx.stageX),
      y: Math.min(start.stageY, ctx.stageY),
      w: Math.abs(ctx.stageX - start.stageX),
      h: Math.abs(ctx.stageY - start.stageY)
    };
    RV.overlay.setMarquee(rect);

    const docRect = {
      x: Math.min(start.x, ctx.x),
      y: Math.min(start.y, ctx.y),
      w: Math.abs(ctx.x - start.x),
      h: Math.abs(ctx.y - start.y)
    };
    // Alt krev at forma ligg heilt inne i ramma, slik Illustrator gjer det.
    RV.state.setSelection(RV.hit.nodesInRect(docRect, ctx.alt));
    RV.state.emit('selection');
  }

  /* ──────────────── Peikar opp ──────────────── */

  function onUp() {
    if (mode === 'marquee') {
      RV.overlay.setMarquee(null);
      RV.state.emit('selection');
    } else if (moved && undoSnapshot) {
      // Først no veit vi at det faktisk blei ei endring å angre.
      RV.state.pushUndoSnapshot(undoSnapshot);
      RV.state.emit('nodes');
    }
    reset();
  }

  function onCancel() {
    if (moved && origin) {
      restore();
      RV.hit.invalidate();
      RV.state.emit('nodes');
    }
    RV.overlay.setMarquee(null);
    reset();
  }

  function reset() {
    mode = null;
    handle = null;
    origin = null;
    frame0 = null;
    undoSnapshot = null;
    moved = false;
    RV.snap.end();
    RV.tools.updateCursor();
  }

  function onLeave() {
    RV.overlay.setHover(null);
    reset();
  }

  RV.tools.register({
    id: 'select',
    name: 'Marker',
    hint: 'Vel, flytt, skaler og roter former.',
    icon: 'pointer',
    key: 'v',
    level: 'basic',
    cursor: 'default',
    onDown: onDown,
    onMove: onMove,
    onUp: onUp,
    onCancel: onCancel,
    onLeave: onLeave
  });
})();
