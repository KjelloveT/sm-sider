/* Leitekryss — steg 3: vala som styrer korleis arket ser ut. */
window.LK = window.LK || {};

LK.uiSheet = (function () {
  'use strict';

  const state = LK.state;
  let dom = {};

  function init() {
    dom = {
      title: document.getElementById('titleInput'),
      wordList: document.getElementById('wordListSelect'),
      nameField: document.getElementById('nameFieldCheck'),
      answerKey: document.getElementById('answerKeyCheck'),
      unique: document.getElementById('uniqueCheck'),
      uniqueInfo: document.getElementById('uniqueInfo')
    };

    dom.title.addEventListener('input', () => {
      state.data.title = dom.title.value.trim();
    });
    dom.wordList.addEventListener('change', () => {
      state.data.settings.showWordList = dom.wordList.value;
    });
    dom.nameField.addEventListener('change', () => {
      state.data.settings.showNameField = dom.nameField.checked;
    });
    dom.answerKey.addEventListener('change', () => {
      state.data.settings.answerKey = dom.answerKey.checked;
    });
    dom.unique.addEventListener('change', () => {
      state.data.settings.uniquePerPupil = dom.unique.checked;
      renderUnique();
    });

    state.onChange(topic => {
      if (topic === 'load') sync();
      if (topic === 'names' || topic === 'load') renderUnique();
    });

    sync();
  }

  function sync() {
    const s = state.data.settings;
    dom.title.value = state.data.title;
    dom.wordList.value = s.showWordList;
    dom.nameField.checked = s.showNameField;
    dom.answerKey.checked = s.answerKey;
    dom.unique.checked = !!s.uniquePerPupil;
    renderUnique();
  }

  function renderUnique() {
    const hasNames = state.data.names.length > 0;
    dom.unique.disabled = !hasNames;
    dom.uniqueInfo.hidden = !state.data.settings.uniquePerPupil || !hasNames;
  }

  return { init, sync };
})();
