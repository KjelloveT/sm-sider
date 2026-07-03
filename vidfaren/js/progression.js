/* ══════════════════════════════════════════════
   VIDFAREN — Progresjon: poeng, statistikk og merke
   Tilstand via VyrdepilStorage.getGameState/setGameState('vidfaren').
   Beste runde-skår via VyrdepilStorage.saveHighScore('vidfaren').
   Mønster lånt frå heimsank/js/progression.js.
   ══════════════════════════════════════════════ */

const Progression = (function () {
  const GAME_KEY = 'vidfaren';
  const STATE_VERSION = 1;

  // Merke. ico = nøkkel i icons.js, color = .b-*-klasse, hint = vilkår.
  const BADGES = [
    // Rette totalt
    { id: 'rett10',  name: '10 rette',  ico: 'check',  color: 'b-teal',   hint: 'Svar rett på 10 oppgåver' },
    { id: 'rett50',  name: '50 rette',  ico: 'check',  color: 'b-blue',   hint: 'Svar rett på 50 oppgåver' },
    { id: 'rett100', name: '100 rette', ico: 'target', color: 'b-pink',   hint: 'Svar rett på 100 oppgåver' },
    { id: 'rett250', name: '250 rette', ico: 'target', color: 'b-purple', hint: 'Svar rett på 250 oppgåver' },
    { id: 'rett500', name: '500 rette', ico: 'crown',  color: 'b-yellow', hint: 'Svar rett på 500 oppgåver' },
    // Per modus
    { id: 'hovudstadmeister', name: 'Hovudstadmeister', ico: 'landmark', color: 'b-blue',   hint: '100 rette hovudstader' },
    { id: 'fjellgeit',        name: 'Fjellgeit',        ico: 'mountain', color: 'b-teal',   hint: '50 rette fjell' },
    { id: 'innsjokjennar',    name: 'Innsjøkjennar',    ico: 'waves',    color: 'b-blue',   hint: '50 rette innsjøar' },
    { id: 'silhuettsjaa',     name: 'Silhuett-sjåar',   ico: 'shapes',   color: 'b-pink',   hint: '50 rette omriss' },
    { id: 'kartlos',          name: 'Kartlos',          ico: 'mapPin',   color: 'b-purple', hint: '50 rette på kartet' },
    { id: 'flaggkjennar',     name: 'Flaggkjennar',     ico: 'flag',     color: 'b-teal',   hint: '50 rette flagg' },
    { id: 'flaggmeister',     name: 'Flaggmeister',     ico: 'flag',     color: 'b-yellow', hint: '150 rette flagg' },
    // Streak
    { id: 'streak10', name: '10 på rad', ico: 'flame', color: 'b-yellow', hint: 'Få 10 rette på rad' },
    { id: 'streak25', name: '25 på rad', ico: 'flame', color: 'b-pink',   hint: 'Få 25 rette på rad' },
    // Plettfrie rundar
    { id: 'plettfri',   name: 'Plettfri',        ico: 'star',   color: 'b-yellow', hint: 'Fullfør ein runde utan feil' },
    { id: 'plettfri10', name: 'Ti plettfrie',    ico: 'medal',  color: 'b-purple', hint: 'Ti plettfrie rundar' },
    // Vanskeleg
    { id: 'vrien100', name: 'Vrien 100', ico: 'zap', color: 'b-blue',   hint: '100 rette på middels/vanskeleg' },
    { id: 'vrien250', name: 'Vrien 250', ico: 'zap', color: 'b-purple', hint: '250 rette på middels/vanskeleg' },
    // Verdsdelar
    { id: 'europa',  name: 'Europakjennar', ico: 'compass', color: 'b-teal',   hint: '25 rette land i Europa' },
    { id: 'afrika',  name: 'Afrikakjennar', ico: 'compass', color: 'b-yellow', hint: '25 rette land i Afrika' },
    { id: 'asia',    name: 'Asiakjennar',   ico: 'compass', color: 'b-pink',   hint: '25 rette land i Asia' },
    { id: 'amerika', name: 'Amerikakjennar',ico: 'compass', color: 'b-blue',   hint: '25 rette land i Amerika' },
    { id: 'oseania', name: 'Oseaniakjennar',ico: 'compass', color: 'b-purple', hint: '15 rette land i Oseania' },
    { id: 'verdsborgar', name: 'Verdsborgar', ico: 'globe', color: 'b-yellow', hint: 'Kjenn alle verdsdelane' },
    // Uthald
    { id: 'ihuga', name: 'Ihuga', ico: 'award', color: 'b-teal', hint: 'Spel 25 rundar' }
  ];

  const rc = (s, r) => (s.stats.regionCorrect && s.stats.regionCorrect[r]) || 0;
  const PREDICATES = {
    rett10:  s => s.stats.totalCorrect >= 10,
    rett50:  s => s.stats.totalCorrect >= 50,
    rett100: s => s.stats.totalCorrect >= 100,
    rett250: s => s.stats.totalCorrect >= 250,
    rett500: s => s.stats.totalCorrect >= 500,
    hovudstadmeister: s => s.stats.capitalCorrect >= 100,
    fjellgeit:        s => s.stats.peakCorrect >= 50,
    innsjokjennar:    s => s.stats.lakeCorrect >= 50,
    silhuettsjaa:     s => s.stats.outlineCorrect >= 50,
    kartlos:          s => s.stats.pinCorrect >= 50,
    flaggkjennar:     s => s.stats.flagCorrect >= 50,
    flaggmeister:     s => s.stats.flagCorrect >= 150,
    streak10: s => s.stats.bestStreak >= 10,
    streak25: s => s.stats.bestStreak >= 25,
    plettfri:   s => s.stats.perfectRounds >= 1,
    plettfri10: s => s.stats.perfectRounds >= 10,
    vrien100: s => s.stats.correctHard >= 100,
    vrien250: s => s.stats.correctHard >= 250,
    europa:  s => rc(s, 'Europa') >= 25,
    afrika:  s => rc(s, 'Afrika') >= 25,
    asia:    s => rc(s, 'Asia') >= 25,
    amerika: s => rc(s, 'Amerika') >= 25,
    oseania: s => rc(s, 'Oseania') >= 15,
    verdsborgar: s => rc(s, 'Europa') >= 25 && rc(s, 'Afrika') >= 25 && rc(s, 'Asia') >= 25
      && rc(s, 'Amerika') >= 25 && rc(s, 'Oseania') >= 15,
    ihuga: s => s.stats.roundsPlayed >= 25
  };

  let state = null;

  function freshState() {
    return {
      version: STATE_VERSION,
      earnedTotal: 0,
      badges: [],
      stats: {
        totalCorrect: 0,
        correctHard: 0,
        capitalCorrect: 0,
        peakCorrect: 0,
        lakeCorrect: 0,
        outlineCorrect: 0,
        pinCorrect: 0,
        flagCorrect: 0,
        bestStreak: 0,
        perfectRounds: 0,
        roundsPlayed: 0,
        regionCorrect: {}
      }
    };
  }

  function load() {
    let stored = null;
    try { stored = VyrdepilStorage.getGameState(GAME_KEY); }
    catch (e) { console.error('Progression load feila:', e); }

    if (stored && stored.version) {
      state = stored;
      const fresh = freshState();
      if (!state.stats) state.stats = fresh.stats;
      // Defensiv utfylling av nye felt
      for (const k in fresh.stats) {
        if (state.stats[k] == null) state.stats[k] = fresh.stats[k];
      }
      if (!state.stats.regionCorrect) state.stats.regionCorrect = {};
      if (!Array.isArray(state.badges)) state.badges = [];
      return state;
    }
    state = freshState();
    save();
    return state;
  }

  function save() {
    try { VyrdepilStorage.setGameState(GAME_KEY, state); }
    catch (e) { console.error('Progression save feila:', e); }
  }

  function ensure() { if (!state) load(); return state; }

  // ---- Poeng ----
  function getEarnedTotal() { return ensure().earnedTotal; }
  function getHighScore() {
    try { return VyrdepilStorage.getHighScore(GAME_KEY) || 0; } catch (e) { return 0; }
  }

  // ---- Registrering ----
  const MODE_STAT = {
    hovudstad: 'capitalCorrect', fjell: 'peakCorrect', innsjo: 'lakeCorrect',
    omriss: 'outlineCorrect', pin: 'pinCorrect', flagg: 'flagCorrect'
  };

  /** Registrer eitt rett svar. Lagrar ikkje (vent til runde-slutt). */
  function recordCorrect({ mode, level, region }) {
    ensure();
    state.stats.totalCorrect += 1;
    if (level === 'middels' || level === 'vanskeleg') state.stats.correctHard += 1;
    const key = MODE_STAT[mode];
    if (key) state.stats[key] += 1;
    if (region) {
      state.stats.regionCorrect[region] = (state.stats.regionCorrect[region] || 0) + 1;
    }
  }

  function noteStreak(streak) {
    ensure();
    if (streak > state.stats.bestStreak) state.stats.bestStreak = streak;
  }

  /** Avslutt ein runde: legg til skår, tel runde, lagre høgaste. */
  function finishRound({ score, correct, total }) {
    ensure();
    state.stats.roundsPlayed += 1;
    if (total > 0 && correct === total) state.stats.perfectRounds += 1;
    state.earnedTotal += score;
    let record = false;
    try { record = VyrdepilStorage.saveHighScore(GAME_KEY, score); } catch (e) {}
    save();
    return { record };
  }

  // ---- Merke ----
  function hasBadge(id) { return ensure().badges.includes(id); }

  /** Evaluer alle merke; returner nye som vart oppnådde. */
  function evaluate() {
    ensure();
    const earned = [];
    for (const badge of BADGES) {
      if (state.badges.includes(badge.id)) continue;
      const pred = PREDICATES[badge.id];
      if (pred && pred(state)) {
        state.badges.push(badge.id);
        earned.push(badge);
      }
    }
    if (earned.length > 0) save();
    return earned;
  }

  function getStats() { return ensure().stats; }

  return {
    BADGES,
    load, save,
    getEarnedTotal, getHighScore, getStats,
    recordCorrect, noteStreak, finishRound,
    hasBadge, evaluate
  };
})();

if (typeof window !== 'undefined') window.Progression = Progression;
