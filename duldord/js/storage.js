/* Duldord — lagring. All lagring går gjennom VyrdepilStorage, aldri localStorage direkte. */
(function (global) {
  'use strict';

  const GAME = 'duldord';
  const VERSION = 1;

  /**
   * Lagra form:
   * { version: 1, days: { "<dagindeks>": { guesses: [...], status: 'playing'|'won'|'lost' } } }
   * Dagindeksen er nøkkel, ikkje datoen, så eit årsskifte i ordlista ikkje rotar det til.
   */
  function load() {
    const raw = VyrdepilStorage.getGameState(GAME);
    if (!raw || raw.version !== VERSION || typeof raw.days !== 'object' || raw.days === null) {
      return { version: VERSION, days: {} };
    }
    return raw;
  }

  function save(data) {
    VyrdepilStorage.setGameState(GAME, data);
  }

  function getDay(index) {
    const day = load().days[String(index)];
    if (!day || !Array.isArray(day.guesses)) return null;
    return day;
  }

  function saveDay(index, guesses, status) {
    const data = load();
    data.days[String(index)] = { guesses: guesses.slice(), status };
    save(data);
  }

  /** Alle spelte dagar som eit oppslag frå dagindeks til status. */
  function allDays() {
    return load().days;
  }

  /**
   * Statistikk rekna ut frå dei lagra dagane, så ho aldri kjem i utakt med
   * det som faktisk er spelt. Rekkja tel berre samanhengande dagar bakover
   * frå den siste dagen som er ferdigspelt.
   */
  function stats(todayIndex) {
    const days = allDays();
    const dist = [0, 0, 0, 0, 0, 0];
    let played = 0, won = 0;

    Object.keys(days).forEach(key => {
      const day = days[key];
      if (day.status === 'playing') return;
      played++;
      if (day.status === 'won') {
        won++;
        dist[day.guesses.length - 1]++;
      }
    });

    // Gjeldande rekkje: gå bakover frå i dag. Ein dag som ikkje er spelt i det
    // heile bryt rekkja på same måte som ein tapt dag.
    let streak = 0;
    let start = todayIndex;
    const todayDay = days[String(todayIndex)];
    if (!todayDay || todayDay.status === 'playing') start = todayIndex - 1;
    for (let i = start; i >= 0; i--) {
      const day = days[String(i)];
      if (day && day.status === 'won') streak++;
      else break;
    }

    let best = 0, run = 0;
    for (let i = 0; i <= todayIndex; i++) {
      const day = days[String(i)];
      if (day && day.status === 'won') { run++; if (run > best) best = run; }
      else run = 0;
    }

    return { played, won, dist, streak, best };
  }

  global.DuldordStorage = { getDay, saveDay, allDays, stats };
})(window);
