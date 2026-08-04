/* ══════════════════════════════════════════════
   TOOL-MANAGER.JS — Verktøyregister og peikarhendingar

   Kvart verktøy melder seg inn her med eit NIVÅ: 'basic' eller
   'advanced'. Brytaren «Avansert» filtrerer på det feltet, og ingen
   annan del av kodebasen treng vite at dei to modusane finst.

   Grunnen til at nivået ligg her frå første stund, og ikkje blir
   ettermontert når dei avanserte verktøya kjem: eit verktøy som er
   skrive utan å vite om nivået sitt, blir bunde opp i verktøyraden,
   hurtigtastane og panela på måtar som må plukkast frå kvarandre
   seinare. Feltet kostar ingenting no og sparer ein refaktorering.

   Verktøya sjølve rører aldri hendingar direkte. Dei får eit ferdig
   omrekna punkt i dokumentkoordinatar, og slepp å vite noko om zoom,
   panorering eller kva element hendinga kom frå.
   ══════════════════════════════════════════════ */
window.RV = window.RV || {};

RV.tools = (function () {
  'use strict';

  const registry = [];
  let activeId = null;
  let stageEl = null;
  let advanced = false;

  /* Panorering med mellomrom eller midtknappen kan skje oppå kva som
     helst anna verktøy, så han bur her og ikkje i eit eige verktøy. */
  let panning = null;
  let spaceDown = false;

  /* ──────────────── Registeret ──────────────── */

  /**
   * @param {object} tool
   *   id, name, icon, key, level ('basic'|'advanced'), cursor,
   *   onDown/onMove/onUp/onKey/onEnter/onLeave/onCancel — alle valfrie
   */
  function register(tool) {
    registry.push(Object.assign({ level: 'basic', cursor: 'default' }, tool));
  }

  function all() {
    return registry.slice();
  }

  /** Verktøya som skal synast i gjeldande modus. */
  function visible() {
    return registry.filter(t => advanced || t.level === 'basic');
  }

  function byId(id) {
    return registry.find(t => t.id === id) || null;
  }

  function byKey(key) {
    const k = String(key).toLowerCase();
    return visible().find(t => t.key === k) || null;
  }

  function active() {
    return byId(activeId);
  }

  function setActive(id) {
    const next = byId(id);
    if (!next || next.id === activeId) return;
    const prev = active();
    if (prev && prev.onLeave) prev.onLeave();
    activeId = next.id;
    if (next.onEnter) next.onEnter();
    updateCursor();
    RV.state.emit('tool');
  }

  /* ──────────────── Enkel og avansert ──────────────── */

  function isAdvanced() {
    return advanced;
  }

  function setAdvanced(on) {
    advanced = !!on;
    // Står brukaren i eit avansert verktøy når han slår av modusen,
    // må vi flytte han til noko som framleis finst.
    if (!advanced && active() && active().level === 'advanced') setActive('select');
    RV.state.emit('tool');
  }

  /* ──────────────── Peikar ──────────────── */

  function context(e) {
    const doc = RV.view.toDoc(e.clientX, e.clientY);
    const stage = RV.view.toStage(e.clientX, e.clientY);
    return {
      x: doc.x, y: doc.y,
      stageX: stage.x, stageY: stage.y,
      shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey,
      button: e.button, event: e
    };
  }

  function onPointerDown(e) {
    if (e.button === 2) return;                       // høgreklikk er ikkje vårt
    stageEl.focus({ preventScroll: true });

    if (e.button === 1 || spaceDown) {
      startPan(e);
      return;
    }

    capture(e);
    const tool = active();
    if (tool && tool.onDown) tool.onDown(context(e));
  }

  function capture(e) { RV.util.capturePointer(stageEl, e); }
  function release(e) { RV.util.releasePointer(stageEl, e); }

  function onPointerMove(e) {
    if (panning) {
      RV.view.panBy(e.clientX - panning.x, e.clientY - panning.y);
      panning.x = e.clientX;
      panning.y = e.clientY;
      RV.state.emit('view');
      return;
    }
    const tool = active();
    if (tool && tool.onMove) tool.onMove(context(e));
  }

  function onPointerUp(e) {
    if (panning) {
      endPan();
      return;
    }
    release(e);
    const tool = active();
    if (tool && tool.onUp) tool.onUp(context(e));
  }

  function startPan(e) {
    panning = { x: e.clientX, y: e.clientY };
    capture(e);
    stageEl.style.cursor = 'grabbing';
    e.preventDefault();
  }

  function endPan() {
    panning = null;
    updateCursor();
  }

  /* ──────────────── Rullehjul ──────────────── */

  /**
   * Ctrl (eller styreplata sin knip) zoomar; elles rullar vi flata.
   * Same oppsett som i Figma, og det som gjer minst skade når nokon
   * kjem frå eit anna program med feil forventning: å rulle litt for
   * langt er lettare å rette opp enn å zoome uventa.
   */
  function onWheel(e) {
    e.preventDefault();
    const stage = RV.view.toStage(e.clientX, e.clientY);

    if (e.ctrlKey || e.metaKey) {
      const factor = Math.pow(0.998, e.deltaY);
      RV.view.zoomBy(factor, stage.x, stage.y);
    } else if (e.shiftKey) {
      RV.view.panBy(-e.deltaY - e.deltaX, 0);
    } else {
      RV.view.panBy(-e.deltaX, -e.deltaY);
    }
    RV.state.emit('view');
  }

  /* ──────────────── Peikarform ──────────────── */

  function updateCursor(override) {
    if (!stageEl) return;
    if (override) { stageEl.style.cursor = override; return; }
    if (panning) { stageEl.style.cursor = 'grabbing'; return; }
    if (spaceDown) { stageEl.style.cursor = 'grab'; return; }
    const tool = active();
    stageEl.style.cursor = tool ? tool.cursor : 'default';
  }

  /* ──────────────── Tastar ──────────────── */

  function setSpace(down) {
    if (spaceDown === down) return;
    spaceDown = down;
    updateCursor();
  }

  /** Avbryt det som er i gang — Escape, eller når fokus går tapt. */
  function cancel() {
    const tool = active();
    if (tool && tool.onCancel) tool.onCancel();
    if (panning) endPan();
  }

  /* ──────────────── Oppkopling ──────────────── */

  function attach(stage) {
    stageEl = stage;
    stageEl.addEventListener('pointerdown', onPointerDown);
    stageEl.addEventListener('pointermove', onPointerMove);
    stageEl.addEventListener('pointerup', onPointerUp);
    stageEl.addEventListener('pointercancel', () => cancel());
    stageEl.addEventListener('wheel', onWheel, { passive: false });
    // Mus som forlèt flata skal ikkje late hover-omrisset stå att.
    stageEl.addEventListener('pointerleave', () => {
      if (!panning) { RV.overlay.setHover(null); RV.state.emit('hover'); }
    });
    stageEl.addEventListener('contextmenu', e => e.preventDefault());
  }

  return {
    register, all, visible, byId, byKey, active, setActive,
    isAdvanced, setAdvanced,
    attach, cancel, updateCursor, setSpace
  };
})();
