/* storage.js — tynn wrapper rundt VyrdepilStorage for Tidvis.
   Lagrar framgang (nivå/XP, opplåste merke, statistikk, oppsett) som
   éin tilstands-blokk under nøkkelen 'tidvis', og toppscore separat. */
(function () {
  'use strict';

  const GAME = 'tidvis';

  const DEFAULT_PROGRESS = {
    playerLevel: 1,
    xp: 0,
    unlocked: [],          // merke-id-ar
    levelCompletion: [0, 0, 0, 0],  // antal spursmål besvara per nivå (for opplåsing)
    stats: {
      totalCorrect: 0,
      totalAnswered: 0,
      bestStreak: 0,
      gamesPlayed: 0,
      level4Clean: false,  // nivå 4 fullført utan feil
      fastest: null        // raskaste svar (ms)
    },
    settings: {
      mode: 'les',
      direction: 'a2t',
      level: 0,
      total: 10,
      stillTarget: 'text',
      paraReprs: ['analog', 'text']
    },
    // oppsett for arbeidsark-eksporten (sjå sheet.js) — elevnamn blir aldri lagra
    exportSettings: null
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function deepMerge(base, over) {
    const out = clone(base);
    if (!over) return out;
    for (const k in over) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) {
        out[k] = deepMerge(base[k] || {}, over[k]);
      } else {
        out[k] = over[k];
      }
    }
    return out;
  }

  function hasStorage() {
    return typeof VyrdepilStorage !== 'undefined';
  }

  function getProgress() {
    if (!hasStorage()) return clone(DEFAULT_PROGRESS);
    const saved = VyrdepilStorage.getGameState(GAME);
    return deepMerge(DEFAULT_PROGRESS, saved);
  }

  function setProgress(progress) {
    if (!hasStorage()) return;
    VyrdepilStorage.setGameState(GAME, progress);
  }

  function getHighScore() {
    if (!hasStorage()) return 0;
    return VyrdepilStorage.getHighScore(GAME);
  }

  // returnerer true om dette vart ny rekord
  function saveHighScore(score) {
    if (!hasStorage()) return false;
    return VyrdepilStorage.saveHighScore(GAME, score);
  }

  function saveToHistory(entry) {
    if (!hasStorage()) return;
    VyrdepilStorage.saveToHistory(GAME, entry);
  }

  // eksportobjekt (§5.2) — for ev. seinare eksport/import
  function exportData() {
    return {
      app: GAME,
      version: 1,
      progress: getProgress(),
      highScore: getHighScore()
    };
  }

  window.TidvisStorage = {
    getProgress: getProgress,
    setProgress: setProgress,
    getHighScore: getHighScore,
    saveHighScore: saveHighScore,
    saveToHistory: saveToHistory,
    exportData: exportData,
    DEFAULT_PROGRESS: DEFAULT_PROGRESS
  };
})();
