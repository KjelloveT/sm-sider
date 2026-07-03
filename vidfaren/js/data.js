/* ══════════════════════════════════════════════
   LANDKJENNING — Geodata + oppgåvegenerering
   Lastar data/countries.json éin gong og byggjer
   firevalsoppgåver per modus og nivå. Held DOM utanfor.
   ══════════════════════════════════════════════ */

const GeoData = (function () {

  // Modus-definisjonar. `attr` = kva countries-felt oppgåva hentar svaret frå.
  // `visual` = sant for omriss/pin (map.js teiknar prompten).
  const MODES = {
    hovudstad: { id: 'hovudstad', label: 'Hovudstad', icon: 'landmark',
      blurb: 'Kva land har denne hovudstaden?',
      has: c => !!c.capital, prompt: c => c.capital, statKey: 'capitalCorrect' },
    fjell: { id: 'fjell', label: 'Høgaste fjell', icon: 'mountain',
      blurb: 'Kva land ligg dette fjellet i?',
      has: c => !!(c.highestPeak && c.highestPeak.name),
      prompt: c => c.highestPeak.name + (c.highestPeak.elev_m ? ` (${c.highestPeak.elev_m} moh.)` : ''),
      statKey: 'peakCorrect' },
    innsjo: { id: 'innsjo', label: 'Største innsjø', icon: 'waves',
      blurb: 'Kva land har denne innsjøen?',
      has: c => !!(c.largestLake && c.largestLake.name),
      prompt: c => c.largestLake.name + (c.largestLake.area_km2 ? ` (${c.largestLake.area_km2} km²)` : ''),
      statKey: 'lakeCorrect' },
    omriss: { id: 'omriss', label: 'Omriss', icon: 'shapes',
      blurb: 'Kva land har dette omrisset?', visual: true,
      has: c => !!c.path, statKey: 'outlineCorrect' },
    pin: { id: 'pin', label: 'Pin på kartet', icon: 'mapPin',
      blurb: 'Kva land peikar pinnen på?', visual: true,
      has: c => !!(c.path && c.latlng), statKey: 'pinCorrect' },
    flagg: { id: 'flagg', label: 'Flagg', icon: 'flag',
      blurb: 'Kva land har dette flagget?', visual: true,
      has: c => !!c.flag, statKey: 'flagCorrect' }
  };

  const LEVELS = {
    lett:      { id: 'lett',      label: 'Lett',      maxTier: 1, timeLimit: 18 },
    middels:   { id: 'middels',   label: 'Middels',   maxTier: 2, timeLimit: 15 },
    vanskeleg: { id: 'vanskeleg', label: 'Vanskeleg', maxTier: 3, timeLimit: 12 }
  };

  const ROUND_SIZE = 10;
  const W = 1000, H = 500; // same projeksjon som byggjeskriptet

  let all = [];          // alle land
  let byIso = {};        // iso2 -> land
  let loaded = false;

  async function load() {
    if (loaded) return all;
    const res = await fetch('data/countries.json');
    if (!res.ok) throw new Error('Klarte ikkje laste countries.json (' + res.status + ')');
    const json = await res.json();
    all = json.countries || [];
    byIso = {};
    all.forEach(c => { byIso[c.iso2] = c; });
    loaded = true;
    return all;
  }

  function get(iso2) { return byIso[iso2] || null; }

  // Ekvirektangulær projeksjon → punkt i viewBox-rommet (for pin).
  function project(lng, lat) {
    return { x: ((lng + 180) / 360) * W, y: ((90 - lat) / 180) * H };
  }

  /** Tal på land som har data for modusen innanfor nivået. */
  function poolFor(modeId, maxTier) {
    const m = MODES[modeId];
    return all.filter(c => c.tier <= maxTier && m.has(c));
  }

  function modeAvailable(modeId, maxTier) {
    return poolFor(modeId, maxTier).length >= 4;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Bygg distraktorar: føretrekk same region, fyll på med resten. */
  function pickDistractors(answer, n) {
    const sameRegion = shuffle(all.filter(c =>
      c.iso2 !== answer.iso2 && c.region === answer.region && c.name));
    const others = shuffle(all.filter(c =>
      c.iso2 !== answer.iso2 && c.region !== answer.region && c.name));
    return sameRegion.concat(others).slice(0, n);
  }

  /**
   * Generer ein runde med oppgåver.
   * @returns {Array<{ mode, answer, prompt, options: country[], correctIndex }>}
   */
  function buildRound(modeId, levelId) {
    const m = MODES[modeId];
    const lvl = LEVELS[levelId];
    const pool = shuffle(poolFor(modeId, lvl.maxTier));
    const picks = pool.slice(0, ROUND_SIZE);

    return picks.map(answer => {
      const distractors = pickDistractors(answer, 3);
      const options = shuffle([answer].concat(distractors));
      return {
        mode: modeId,
        answer,
        prompt: m.visual ? null : m.prompt(answer),
        options,
        correctIndex: options.findIndex(o => o.iso2 === answer.iso2)
      };
    });
  }

  return {
    MODES, LEVELS, ROUND_SIZE, W, H,
    load, get, project, poolFor, modeAvailable, buildRound, shuffle,
    get countries() { return all; }
  };
})();

if (typeof window !== 'undefined') window.GeoData = GeoData;
