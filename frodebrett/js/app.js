/* Frødebrett — oppstart, skjermnavigasjon, tastatur og standardfrøder. */
(function (root) {
  'use strict';

  const FB = root.FB;
  const S = FB.state;
  const Store = root.FrodebrettStorage;

  const App = {};

  App.init = function () {
    App.bindNavigation();
    FB.Board.bindTeamSetup();
    FB.Board.bindQuestionModal();
    FB.Board.bindGameControls();
    FB.Board.bindFinalRound();
    FB.Editor.bind();
    FB.Saved.bind();
    App.bindKeyboard();
    App.bindOverlayDismiss();
    App.loadSampleQuizzes();
    App.showScreen('game');
  };

  App.bindNavigation = function () {
    FB.el('btn-play').addEventListener('click', () => App.showScreen('game'));
    FB.el('btn-editor').addEventListener('click', () => App.showScreen('editor'));
    FB.el('btn-saved').addEventListener('click', () => App.showScreen('saved'));
    document.querySelectorAll('[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => App.showScreen(btn.dataset.goto));
    });
  };

  App.showScreen = function (name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const screen = FB.el(name + '-screen');
    if (screen) screen.classList.remove('hidden');
    S.currentScreen = name;

    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.screen === name);
    });

    if (name === 'game') FB.Board.loadQuizList();
    else if (name === 'saved') FB.Saved.render();
  };

  // ===== STANDARDFRØDER =====

  // Auk denne når innhaldet i json/-filene er endra, så alle får oppdaterte
  // standardfrøder — utan han ville berre heilt nye brukarar sett endringane.
  const SEED_VERSION = 2;

  App.loadSampleQuizzes = function () {
    const legacyTitles = ['Norsk geografi', 'Matte 5. trinn', 'Naturfag'];
    const defaultTitles = ['Blanda drops', 'Småtrinn'];

    Store.getQuizzes()
      .filter(q => legacyTitles.includes(q.title))
      .forEach(q => Store.deleteQuiz(q.id));

    const outdated = Store.getSeedVersion() < SEED_VERSION;
    const existing = new Set(Store.getQuizzes().map(q => q.title));
    if (!outdated && defaultTitles.every(t => existing.has(t))) return;

    Promise.all([
      fetch('json/frodebrett_Blanda_drops.json').then(r => r.json()),
      fetch('json/frodebrett_Småtrinn.json').then(r => r.json())
    ]).then(files => {
      files.forEach(fileData => {
        if (!fileData || !fileData.quiz) return;
        const quiz = fileData.quiz;
        // Standardfrødene har faste id-ar, så saveQuiz oppdaterer den lagra
        // kopien i staden for å lage ein duplikat.
        const titles = new Set(Store.getQuizzes().map(q => q.title));
        if (outdated || !titles.has(quiz.title)) Store.saveQuiz(quiz);
      });
      Store.setSeedVersion(SEED_VERSION);
      if (S.currentScreen === 'game') FB.Board.loadQuizList();
    }).catch(err => console.error('Klarte ikkje laste standardfrøder:', err));
  };

  // ===== TASTATUR =====

  App.bindKeyboard = function () {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 's' && S.currentScreen === 'editor') { e.preventDefault(); FB.Editor.saveQuiz(); }
        else if (k === 'n' && S.currentScreen === 'editor') { e.preventDefault(); FB.Editor.clear(); }
        return;
      }
      // Escape lukkar opne modalar uansett skjerm
      if (e.key === 'Escape') {
        if (FB.isOverlayOpen('preview-modal')) { FB.closeOverlay('preview-modal'); return; }
        if (FB.isOverlayOpen('winner-modal')) { FB.closeOverlay('winner-modal'); return; }
      }
      if (S.currentScreen === 'game') FB.Board.handleGameKeyboard(e);
    });
  };

  // Klikk på overlay-bakgrunn lukkar modalen
  App.bindOverlayDismiss = function () {
    document.querySelectorAll('.modal-overlay').forEach(ov => {
      ov.addEventListener('click', (e) => {
        if (e.target === ov) ov.classList.remove('open');
      });
    });
  };

  FB.App = App;

  document.addEventListener('DOMContentLoaded', () => App.init());
})(window);
