/* Frødebrett — lagringslag (wrapper rundt VyrdepilStorage)
 * All state ligg under VyrdepilStorage.frodebrett.state = {
 *   quizzes: [ {id, title, categories:[{name, questions:[{points,question,answer}]}], final, created} ],
 *   teams:   [ {name} ]   // siste lagoppsett, valfritt
 * }
 */
(function (root) {
  'use strict';

  const GAME = 'frodebrett';

  function defaultState() {
    return { quizzes: [], teams: [], seedVersion: 0 };
  }

  function readState() {
    const s = VyrdepilStorage.getGameState(GAME);
    if (!s || typeof s !== 'object') return defaultState();
    return {
      quizzes: Array.isArray(s.quizzes) ? s.quizzes : [],
      teams: Array.isArray(s.teams) ? s.teams : [],
      seedVersion: typeof s.seedVersion === 'number' ? s.seedVersion : 0
    };
  }

  function writeState(state) {
    VyrdepilStorage.setGameState(GAME, state);
  }

  function generateId(prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
  }

  // ---- Frøde-CRUD ----

  function getQuizzes() {
    return readState().quizzes;
  }

  function saveQuiz(quiz) {
    const state = readState();
    const idx = state.quizzes.findIndex(q => q.id === quiz.id);
    if (idx >= 0) {
      state.quizzes[idx] = quiz;
    } else {
      if (!quiz.id) quiz.id = generateId('quiz');
      if (!quiz.created) quiz.created = new Date().toISOString();
      state.quizzes.push(quiz);
    }
    writeState(state);
    return true;
  }

  function deleteQuiz(quizId) {
    const state = readState();
    state.quizzes = state.quizzes.filter(q => q.id !== quizId);
    writeState(state);
    return true;
  }

  // ---- Standardfrøder ----

  function getSeedVersion() {
    return readState().seedVersion;
  }

  function setSeedVersion(v) {
    const state = readState();
    state.seedVersion = v;
    writeState(state);
    return true;
  }

  // ---- Lag (valfritt, siste oppsett) ----

  function getTeams() {
    return readState().teams;
  }

  function saveTeams(teams) {
    const state = readState();
    state.teams = teams;
    writeState(state);
    return true;
  }

  // ---- Eksport / import ----

  function exportData() {
    return {
      app: 'frodebrett',
      version: 1,
      quizzes: getQuizzes(),
      exported: new Date().toISOString()
    };
  }

  function importData(data) {
    if (data && Array.isArray(data.quizzes)) {
      const state = readState();
      state.quizzes = data.quizzes;
      writeState(state);
      return true;
    }
    return false;
  }

  function clearAll() {
    VyrdepilStorage.clearGame(GAME);
    return true;
  }

  root.FrodebrettStorage = {
    GAME,
    readState,
    writeState,
    generateId,
    getQuizzes,
    saveQuiz,
    deleteQuiz,
    getSeedVersion,
    setSeedVersion,
    getTeams,
    saveTeams,
    exportData,
    importData,
    clearAll
  };
})(window);
