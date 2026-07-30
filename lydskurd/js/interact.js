/* ══════════════════════════════════════════════
   INTERACT.JS — Dra klipp og endre lengda på dei

   To handlingar bur her:
     • DRA    — flytt klippet langs tidslinja og mellom spor
     • TRIMME — dra i kanten for å vise meir eller mindre av kjelda

   Trimming rører aldri lyden. Han flyttar berre srcStart og srcLen,
   altså kva utsnitt av den uforandra kjelda klippet viser. Difor kjem
   alt tilbake om du dreg kanten ut att.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.interact = (function () {
  'use strict';

  const EDGE = 8;          // kor brei trimme-sona i kvar kant er, i pikslar
  const MIN_LEN = 0.02;    // eit klipp kan ikkje bli kortare enn dette

  let canvas = null;
  let drag = null;

  /* ──────────────── Kvar er peikaren? ──────────────── */

  function pointAt(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  /* Peikarfangst er ei hjelp, ikkje eit vilkår: greier vi ikkje å fange
     peikaren, skal draginga likevel gå. Difor er begge sidene skjerma. */
  function capture(e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* held fram utan */ }
  }

  function release(e) {
    try {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    } catch (err) { /* alt sleppt */ }
  }

  /**
   * Kva slags handling ville eit trykk her starte?
   * @returns {{clip, mode: 'move'|'trimStart'|'trimEnd'|'fadeIn'|'fadeOut'}|null}
   */
  function targetAt(p) {
    if (p.y <= LS.render.RULER_H) return null;
    const clip = LS.render.clipAt(p.x, p.y);
    if (!clip) return null;

    // Fade-greipa ligg øvst og har førsteretten der.
    const fade = LS.render.fadeHandleAt(clip, p.x, p.y);
    if (fade) return { clip: clip, mode: fade };

    const x0 = LS.render.timeToX(clip.timeStart);
    const x1 = LS.render.timeToX(clip.timeStart + clip.srcLen);

    // Er klippet svært smalt, ville trimme-sonene ete opp heile flata.
    if (x1 - x0 > EDGE * 3) {
      if (p.x <= x0 + EDGE) return { clip: clip, mode: 'trimStart' };
      if (p.x >= x1 - EDGE) return { clip: clip, mode: 'trimEnd' };
    }
    return { clip: clip, mode: 'move' };
  }

  function cursorFor(target) {
    if (!target) return '';
    if (target.mode === 'move') return 'grab';
    if (target.mode === 'fadeIn' || target.mode === 'fadeOut') return 'col-resize';
    return 'ew-resize';
  }

  /* ──────────────── Snapping ──────────────── */

  const SNAP_PX = 8;       // kor nær ein kant må vere før han dreg til seg

  /**
   * Kva tidspunkt er verdt å hekte seg fast i? Nullpunktet, spelehovudet,
   * rutenettet og kantane på alle andre klipp — dei same linjene auget
   * alt ser på skjermen, så snappinga kjennest føreseieleg.
   */
  function snapTargets(exceptClipId, near) {
    const view = LS.state.data.view;
    const step = LS.render.gridStep();
    const targets = [0, view.playhead];

    // Berre dei to nærmaste rutenettlinjene — resten er utan interesse.
    targets.push(Math.floor(near / step) * step, Math.ceil(near / step) * step);

    LS.state.data.clips.forEach((c) => {
      if (c.id === exceptClipId) return;
      targets.push(c.timeStart, LS.state.clipEnd(c));
    });
    return targets;
  }

  /**
   * Flyttar starttida slik at anten starten eller slutten av klippet
   * hektar seg i noko. Alt-tasten slår snappinga av.
   */
  function snapStart(desired, len, exceptId, off) {
    if (off) return desired;
    const tol = SNAP_PX / LS.state.data.view.pxPerSec;
    let best = desired;
    let bestDist = tol;

    [{ at: desired, shift: 0 }, { at: desired + len, shift: -len }].forEach((edge) => {
      snapTargets(exceptId, edge.at).forEach((t) => {
        const dist = Math.abs(edge.at - t);
        if (dist < bestDist) { bestDist = dist; best = t + edge.shift; }
      });
    });
    return best;
  }

  /** Snapping av ein enkelt kant, brukt når ein trimmar. */
  function snapEdge(desired, exceptId, off) {
    if (off) return desired;
    const tol = SNAP_PX / LS.state.data.view.pxPerSec;
    let best = desired;
    let bestDist = tol;
    snapTargets(exceptId, desired).forEach((t) => {
      const dist = Math.abs(desired - t);
      if (dist < bestDist) { bestDist = dist; best = t; }
    });
    return best;
  }

  /* ──────────────── Grenser ──────────────── */

  /** Kor langt kjelda rekk. Manglar ho, held vi oss til det klippet alt viser. */
  function sourceLength(clip) {
    const source = LS.audio.getSource(clip.sourceId);
    return source ? source.duration : clip.srcStart + clip.srcLen;
  }

  /* ──────────────── Draging ──────────────── */

  function begin(e) {
    const p = pointAt(e);
    const target = targetAt(p);
    if (!target) return;

    e.preventDefault();
    capture(e);

    LS.state.setSelection([target.clip.id]);

    drag = {
      mode: target.mode,
      clip: target.clip,
      startX: p.x,
      startY: p.y,
      moved: false,
      // Teke no, men lagt på angre-stakken først når noko flyttar seg.
      undoSnapshot: LS.state.snapshot(),
      // Utgangspunktet, så alt blir rekna frå originalen og ikkje steg for steg
      origTimeStart: target.clip.timeStart,
      origSrcStart: target.clip.srcStart,
      origSrcLen: target.clip.srcLen,
      origTrackId: target.clip.trackId,
      origFadeIn: target.clip.fadeIn || 0,
      origFadeOut: target.clip.fadeOut || 0
    };

    canvas.style.cursor = drag.mode === 'move' ? 'grabbing' : 'ew-resize';
    LS.uiClip.refresh();
    LS.render.schedule();
  }

  function moveClip(p, deltaSec, noSnap) {
    const clip = drag.clip;

    // Sporet under peikaren overtek klippet.
    const track = LS.render.trackAtY(p.y);
    const trackId = track ? track.id : clip.trackId;

    const wanted = Math.max(0, snapStart(drag.origTimeStart + deltaSec, clip.srcLen, clip.id, noSnap));

    // Klippet må få plass utan å hamne oppå noko anna på sporet.
    const fitted = LS.state.fitInTrack(trackId, wanted, clip.srcLen, clip.id);
    if (fitted == null) {
      // Sporet har ikkje eit stort nok hol — lat klippet bli der det var.
      drag.blocked = true;
      return;
    }

    drag.blocked = false;
    clip.trackId = trackId;
    clip.timeStart = fitted;
  }

  function trimStart(deltaSec, noSnap) {
    const clip = drag.clip;
    // Snappinga gjeld kanten slik han ligg på tidslinja; derifrå reknar
    // vi oss tilbake til kor mykje kanten eigentleg blei flytta.
    const wantedEdge = drag.origTimeStart + deltaSec;
    deltaSec = snapEdge(wantedEdge, clip.id, noSnap) - drag.origTimeStart;

    // Vi kan ikkje dra lenger venstre enn kjelda byrjar, og må late det
    // stå att minst MIN_LEN av klippet.
    const lo = -drag.origSrcStart;
    const hi = drag.origSrcLen - MIN_LEN;
    const d = LS.util.clamp(deltaSec, lo, hi);

    // Klippet skal heller ikkje kunne skyvast ut i negativ tid, eller
    // bakover inn i klippet som ligg føre på sporet.
    const gap = LS.state.gapAround(clip.trackId, drag.origTimeStart, clip.id);
    const limited = Math.max(d, gap[0] - drag.origTimeStart, -drag.origTimeStart);

    clip.srcStart = drag.origSrcStart + limited;
    clip.srcLen = drag.origSrcLen - limited;
    clip.timeStart = drag.origTimeStart + limited;
    // Blir klippet kortare enn fadane, må dei krympe med.
    LS.state.clampFades(clip);
  }

  function trimEnd(deltaSec, noSnap) {
    const clip = drag.clip;
    const wantedEdge = drag.origTimeStart + drag.origSrcLen + deltaSec;
    deltaSec = snapEdge(wantedEdge, clip.id, noSnap) - drag.origTimeStart - drag.origSrcLen;

    // Slutten kan ikkje strekkjast lenger enn kjelda rekk, og ikkje
    // framover inn i klippet som ligg etter på sporet.
    const gap = LS.state.gapAround(clip.trackId, drag.origTimeStart, clip.id);
    const roomLen = gap[1] - clip.timeStart;
    const maxLen = Math.min(sourceLength(clip) - drag.origSrcStart, roomLen);
    clip.srcLen = LS.util.clamp(drag.origSrcLen + deltaSec, MIN_LEN, Math.max(MIN_LEN, maxLen));
    LS.state.clampFades(clip);
  }

  /* Fadane blir dregne i sekund, ikkje i prosent, så eit klipp som seinare
     blir trimma ikkje får ei fading som plutseleg endrar lengd. */
  function fadeIn(deltaSec) {
    const clip = drag.clip;
    clip.fadeIn = Math.max(0, drag.origFadeIn + deltaSec);
    LS.state.clampFades(clip);
  }

  function fadeOut(deltaSec) {
    const clip = drag.clip;
    // Greipet ligg i høgre enden, så det å dra mot venstre gjer fadinga lengre.
    clip.fadeOut = Math.max(0, drag.origFadeOut - deltaSec);
    LS.state.clampFades(clip);
  }

  function move(e) {
    if (!drag) {
      // Ingen draging på gang — vis kva eit trykk ville gjort.
      const target = targetAt(pointAt(e));
      canvas.style.cursor = cursorFor(target);
      return;
    }

    const p = pointAt(e);
    const deltaSec = (p.x - drag.startX) / LS.state.data.view.pxPerSec;

    // Første røyrsle er det som gjer dette til ei endring verdt å angre.
    if (!drag.moved && (Math.abs(p.x - drag.startX) > 2 || Math.abs(p.y - drag.startY) > 2)) {
      drag.moved = true;
      LS.state.pushUndoSnapshot(drag.undoSnapshot);
    }

    // Alt-tasten slår snappinga av så lenge han er nede.
    const noSnap = e.altKey;
    if (drag.mode === 'move') moveClip(p, deltaSec, noSnap);
    else if (drag.mode === 'trimStart') trimStart(deltaSec, noSnap);
    else if (drag.mode === 'trimEnd') trimEnd(deltaSec, noSnap);
    else if (drag.mode === 'fadeIn') fadeIn(deltaSec);
    else fadeOut(deltaSec);

    LS.render.schedule();
  }

  function end(e) {
    if (!drag) return;
    release(e);

    const changed = drag.moved;
    const clip = drag.clip;
    drag = null;
    canvas.style.cursor = cursorFor(targetAt(pointAt(e)));

    if (changed) {
      // Sporteljinga i hovudkolonna og lengda på rullefeltet må reknast om.
      LS.state.emit('clips');
      if (LS.audio.isPlaying()) {
        // Grafen som spelar no kjenner ikkje den nye plasseringa.
        LS.uiToolbar.seek(LS.state.data.view.playhead);
      }
    } else {
      // Berre eit klikk. Ingenting blei lagt på angre-stakken, så det er
      // ingenting å rulle tilbake — utvalet er heile endringa.
      LS.uiClip.refresh();
      LS.render.schedule();
    }
  }

  function cancel(e) {
    if (!drag) return;
    // Avbrote av nettlesaren: legg klippet tilbake der det låg.
    const clip = drag.clip;
    clip.timeStart = drag.origTimeStart;
    clip.srcStart = drag.origSrcStart;
    clip.srcLen = drag.origSrcLen;
    clip.trackId = drag.origTrackId;
    clip.fadeIn = drag.origFadeIn;
    clip.fadeOut = drag.origFadeOut;
    const hadUndo = drag.moved;
    drag = null;
    canvas.style.cursor = '';
    if (hadUndo) LS.state.undo();
    LS.render.schedule();
    if (e) release(e);
  }

  /* ──────────────── Oppstart ──────────────── */

  function setup(node) {
    canvas = node;
    canvas.addEventListener('pointerdown', begin);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('pointerleave', () => { if (!drag) canvas.style.cursor = ''; });
  }

  return { setup, targetAt, EDGE, MIN_LEN };
})();
