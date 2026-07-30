/* ══════════════════════════════════════════════
   STATE.JS — Spor, klipp og visning for Lydskurd

   Her bur berre METADATA. Sjølve lyden (AudioBuffer) ligg i
   kjelderegisteret i audio.js, og klippa peikar dit med sourceId.

   Det er heile poenget med redigeringsmodellen: eit klipp er eit
   utsnitt av ei uforandra kjelde, ikkje ein kopi av lyden. Difor
   kostar eit angre-steg nokre kilobyte i staden for hundrevis av
   megabyte, og «del klipp» er berre eit nytt objekt i ei liste.
   ══════════════════════════════════════════════ */
window.LS = window.LS || {};

LS.state = (function () {
  'use strict';

  const listeners = [];
  const UNDO_LIMIT = 50;

  /* ──────────────── Standardverdiar ──────────────── */

  function defaultView() {
    return {
      pxPerSec: 80,      // zoomnivå
      scrollSec: 0,      // kor langt til venstre tidslinja er skrolla
      playhead: 0        // spelehovudet, i sekund
    };
  }

  function makeTrack(name) {
    return {
      id: LS.util.uuid(),
      name: name || 'Spor',
      gain: 1,
      pan: 0,
      muted: false,
      soloed: false
    };
  }

  /**
   * Eit klipp på tidslinja.
   *   srcStart/srcLen — utsnittet av kjelda, i sekund
   *   timeStart       — kvar utsnittet startar på tidslinja, i sekund
   */
  function makeClip(sourceId, trackId, timeStart, srcStart, srcLen, name) {
    return {
      id: LS.util.uuid(),
      sourceId: sourceId,
      trackId: trackId,
      name: name || 'Klipp',
      srcStart: srcStart || 0,
      srcLen: srcLen,
      timeStart: Math.max(0, timeStart || 0),
      gain: 1,
      fadeIn: 0,
      fadeOut: 0,
      reversed: false
    };
  }

  /* ──────────────── Tilstanden ──────────────── */

  const data = {
    title: '',
    tracks: [],
    clips: [],
    selection: [],     // klipp-id-ar
    masterGain: 1,
    view: defaultView()
  };

  const undoStack = [];
  const redoStack = [];

  /* ──────────────── Varsling ──────────────── */

  /** topic: 'tracks' | 'clips' | 'selection' | 'view' | 'load' | 'sources' */
  function emit(topic) {
    listeners.forEach(fn => fn(topic, data));
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  /* ──────────────── Spor ──────────────── */

  function addTrack(name) {
    const track = makeTrack(name || ('Spor ' + (data.tracks.length + 1)));
    data.tracks.push(track);
    return track;
  }

  function getTrack(id) {
    return data.tracks.find(t => t.id === id) || null;
  }

  function trackIndex(id) {
    return data.tracks.findIndex(t => t.id === id);
  }

  /**
   * Flyttar sporet opp eller ned i rekkjefølgja. Klippa følgjer med av seg
   * sjølv — dei peikar på sporet med trackId, ikkje på ein plass i lista.
   * @param {number} delta -1 for opp, 1 for ned
   */
  function moveTrack(id, delta) {
    const from = trackIndex(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= data.tracks.length) return false;
    const track = data.tracks[from];
    data.tracks.splice(from, 1);
    data.tracks.splice(to, 0, track);
    return true;
  }

  /** Fjernar sporet og alle klippa som ligg på det. */
  function removeTrack(id) {
    data.tracks = data.tracks.filter(t => t.id !== id);
    data.clips = data.clips.filter(c => c.trackId !== id);
    data.selection = data.selection.filter(cid => getClip(cid));
  }

  /* ──────────────── Klipp ──────────────── */

  function addClip(clip) {
    data.clips.push(clip);
    return clip;
  }

  function getClip(id) {
    return data.clips.find(c => c.id === id) || null;
  }

  function clipsOnTrack(trackId) {
    return data.clips.filter(c => c.trackId === trackId);
  }

  function removeClip(id) {
    data.clips = data.clips.filter(c => c.id !== id);
    data.selection = data.selection.filter(cid => cid !== id);
  }

  const MIN_CLIP_LEN = 0.02;

  /**
   * Held fadane innanfor klippet. Dei to kan møtast på midten, men aldri
   * krysse kvarandre — då ville konvolutten gå nedover og oppover
   * samstundes, og resultatet blitt uråd å lese både for auget og for
   * automasjonen i lydgrafen.
   */
  function clampFades(clip) {
    clip.fadeIn = LS.util.clamp(clip.fadeIn || 0, 0, clip.srcLen);
    clip.fadeOut = LS.util.clamp(clip.fadeOut || 0, 0, clip.srcLen);
    const sum = clip.fadeIn + clip.fadeOut;
    if (sum > clip.srcLen) {
      // Skaler begge ned i same forhold, så vippepunktet blir verande.
      const scale = clip.srcLen / sum;
      clip.fadeIn *= scale;
      clip.fadeOut *= scale;
    }
    return clip;
  }

  /**
   * Deler eit klipp i to ved ei tid på tidslinja.
   *
   * Ingen lyd blir kopiert — begge halvdelane peikar på same kjelde og
   * viser kvar sin del av henne. Difor er delinga like billeg for ei
   * fil på ti minutt som for ei på eitt sekund.
   *
   * @returns {object|null} den nye høgre halvdelen, eller null om
   *   snittet ikkje ligg inne i klippet
   */
  function splitClip(id, atTime) {
    const clip = getClip(id);
    if (!clip) return null;

    const leftLen = atTime - clip.timeStart;
    const rightLen = clip.srcLen - leftLen;
    // Snittet må liggje inne i klippet, og late att noko på begge sider.
    if (leftLen < MIN_CLIP_LEN || rightLen < MIN_CLIP_LEN) return null;

    const right = {
      id: LS.util.uuid(),
      sourceId: clip.sourceId,
      trackId: clip.trackId,
      name: clip.name,
      srcStart: clip.srcStart + leftLen,
      srcLen: rightLen,
      timeStart: atTime,
      gain: clip.gain,
      // Innfadinga høyrer til starten, utfadinga til slutten. Snittet
      // sjølv er hardt — det er meininga med å dele.
      fadeIn: 0,
      fadeOut: clip.fadeOut,
      reversed: clip.reversed
    };

    clip.srcLen = leftLen;
    clip.fadeOut = 0;
    if (clip.fadeIn > leftLen) clip.fadeIn = leftLen;
    if (right.fadeOut > rightLen) right.fadeOut = rightLen;

    // Rett etter originalen, så teikne-rekkjefølgja held seg.
    const at = data.clips.indexOf(clip);
    data.clips.splice(at + 1, 0, right);
    return right;
  }

  /* ──────────────── Ingen klipp oppå kvarandre ──────────────── */

  /* Eit spor er ei einaste rad med lyd. To klipp som ligg oppå kvarandre
     der ville summert seg til noko brukaren ikkje kan sjå, og som blir
     umogleg å plukke frå kvarandre etterpå. Difor held vi sporet ryddig:
     klipp kan liggje kant i kant, men aldri over kvarandre. Vil du ha to
     lydar samtidig, legg du dei på kvar sitt spor. */

  const EPS = 1e-6;   // slark, så kant-i-kant ikkje blir lese som overlapp

  /** Ledige mellomrom på sporet, i rekkjefølgje. Siste gap er ope utover. */
  function gapsOnTrack(trackId, exceptId) {
    const others = clipsOnTrack(trackId)
      .filter(c => c.id !== exceptId)
      .sort((a, b) => a.timeStart - b.timeStart);

    const gaps = [];
    let cursor = 0;
    others.forEach((c) => {
      if (c.timeStart > cursor + EPS) gaps.push([cursor, c.timeStart]);
      cursor = Math.max(cursor, clipEnd(c));
    });
    gaps.push([cursor, Infinity]);
    return gaps;
  }

  /**
   * Nærmaste starttid der eit klipp på `len` sekund får plass på sporet
   * utan å hamne oppå noko anna.
   *
   * @returns {number|null} null når sporet ikkje har eit stort nok hol
   */
  function fitInTrack(trackId, desiredStart, len, exceptId) {
    const wanted = Math.max(0, desiredStart);
    let best = null;
    let bestDist = Infinity;

    gapsOnTrack(trackId, exceptId).forEach((gap) => {
      if (gap[1] - gap[0] < len - EPS) return;      // holet er for lite
      const at = LS.util.clamp(wanted, gap[0], gap[1] - len);
      const dist = Math.abs(at - wanted);
      if (dist < bestDist) { bestDist = dist; best = at; }
    });
    return best;
  }

  /** Holet som omgjev denne tida — grensene ein kant kan trimmast til. */
  function gapAround(trackId, time, exceptId) {
    const gaps = gapsOnTrack(trackId, exceptId);
    for (let i = 0; i < gaps.length; i++) {
      if (time >= gaps[i][0] - EPS && time <= gaps[i][1] + EPS) return gaps[i];
    }
    return gaps[gaps.length - 1];
  }

  /** Ligg dette spennet oppå eit anna klipp? Gjev klippet som er i vegen. */
  function blockerAt(trackId, start, end, exceptId) {
    return clipsOnTrack(trackId).find(c =>
      c.id !== exceptId && start < clipEnd(c) - EPS && end > c.timeStart + EPS) || null;
  }

  /** Klipp som tida går tvers gjennom — altså dei som kan delast der. */
  function clipsAcross(atTime) {
    return data.clips.filter(c =>
      atTime > c.timeStart + MIN_CLIP_LEN &&
      atTime < clipEnd(c) - MIN_CLIP_LEN);
  }

  /** Der klippet sluttar på tidslinja. */
  function clipEnd(clip) {
    return clip.timeStart + clip.srcLen;
  }

  /** Første ledige tid på sporet, så importerte filer ikkje legg seg oppå kvarandre. */
  function trackEnd(trackId) {
    return clipsOnTrack(trackId).reduce((max, c) => Math.max(max, clipEnd(c)), 0);
  }

  /** Samla lengd på prosjektet, i sekund. */
  function duration() {
    return data.clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
  }

  /* ──────────────── Utval ──────────────── */

  function isSelected(clipId) {
    return data.selection.indexOf(clipId) !== -1;
  }

  function setSelection(clipIds) {
    data.selection = (clipIds || []).slice();
  }

  function toggleSelection(clipId) {
    const i = data.selection.indexOf(clipId);
    if (i === -1) data.selection.push(clipId);
    else data.selection.splice(i, 1);
  }

  function clearSelection() {
    data.selection = [];
  }

  /* ──────────────── Angre og gjer om ──────────────── */

  /* Berre metadata blir snapshotta — visning og utval er med vilje utanfor,
     så eit angre-steg ikkje flyttar blikket til brukaren. */
  function snapshot() {
    return JSON.stringify({
      title: data.title,
      tracks: data.tracks,
      clips: data.clips,
      masterGain: data.masterGain
    });
  }

  function applySnapshot(json) {
    const snap = JSON.parse(json);
    data.title = snap.title;
    data.tracks = snap.tracks;
    data.clips = snap.clips;
    data.masterGain = snap.masterGain;
    data.selection = data.selection.filter(id => getClip(id));
  }

  /** Kall FØR ei endring som skal kunne angrast. */
  function pushUndo() {
    pushUndoSnapshot(snapshot());
  }

  /**
   * Som pushUndo, men med eit snapshot du har teke sjølv på eit tidlegare
   * tidspunkt. Draginga brukar dette: ho tek eit snapshot når peikaren går
   * ned, men legg det ikkje på stakken før noko faktisk har flytta seg.
   * Elles ville kvart uskuldige klikk fylt opp angre-historikken.
   */
  function pushUndoSnapshot(json) {
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

  /* ──────────────── Visning ──────────────── */

  const MIN_PX_PER_SEC = 4;
  const MAX_PX_PER_SEC = 600;

  function setZoom(pxPerSec) {
    data.view.pxPerSec = LS.util.clamp(pxPerSec, MIN_PX_PER_SEC, MAX_PX_PER_SEC);
  }

  function setScroll(seconds) {
    data.view.scrollSec = Math.max(0, seconds || 0);
  }

  function setPlayhead(seconds) {
    data.view.playhead = Math.max(0, seconds || 0);
  }

  /* ──────────────── Nullstilling ──────────────── */

  function reset() {
    data.title = '';
    data.tracks = [];
    data.clips = [];
    data.selection = [];
    data.masterGain = 1;
    data.view = defaultView();
    undoStack.length = 0;
    redoStack.length = 0;
  }

  return {
    data, emit, onChange,
    makeTrack, makeClip,
    addTrack, getTrack, trackIndex, moveTrack, removeTrack,
    addClip, getClip, clipsOnTrack, removeClip, clipEnd, trackEnd, duration,
    splitClip, clipsAcross, clampFades, MIN_CLIP_LEN,
    gapsOnTrack, fitInTrack, gapAround, blockerAt,
    isSelected, setSelection, toggleSelection, clearSelection,
    pushUndo, pushUndoSnapshot, snapshot, undo, redo, canUndo, canRedo,
    setZoom, setScroll, setPlayhead, reset,
    MIN_PX_PER_SEC, MAX_PX_PER_SEC
  };
})();
