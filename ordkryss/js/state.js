/* Ordkryss — tilstand for det kryssordet du arbeider med no. */
window.OK = window.OK || {};

OK.state = (function () {
  'use strict';

  const listeners = [];

  const data = {
    id: null,               // id i biblioteket, om det er lagra
    title: '',
    words: [],              // { id, answer, clue, locked, freestanding }
    layout: null,           // { cols, rows, placements, crossings, unplaced }
    names: [],              // elevnamn til utskrift
    nameSource: '',         // kort tekst om kvar namna kom frå
    settings: { showNameField: true, answerKey: true },
    showAnswers: false      // berre førehandsvisinga på skjermen
  };

  /** Meld frå om at noko er endra. topic: 'words' | 'layout' | 'names' | 'settings' | 'library' */
  function emit(topic) {
    listeners.forEach(fn => fn(topic, data));
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function addWord(answer, clue) {
    const word = {
      id: OK.util.uuid(),
      answer: answer,
      clue: clue || '',
      locked: false,
      freestanding: false
    };
    data.words.push(word);
    return word;
  }

  function getWord(id) {
    return data.words.find(w => w.id === id) || null;
  }

  function updateWord(id, changes) {
    const word = getWord(id);
    if (!word) return null;
    Object.assign(word, changes);
    return word;
  }

  function removeWord(id) {
    data.words = data.words.filter(w => w.id !== id);
    if (data.layout) {
      data.layout.placements = data.layout.placements.filter(p => p.wordId !== id);
      data.layout.unplaced = data.layout.unplaced.filter(w => w.id !== id);
    }
  }

  function clearWords() {
    data.words = [];
    data.layout = null;
  }

  /** Plasseringa til eit ord i gjeldande layout. */
  function placementOf(wordId) {
    if (!data.layout) return null;
    return data.layout.placements.find(p => p.wordId === wordId) || null;
  }

  /** Plasseringane som skal låsast fast ved neste generering. */
  function lockedPlacements() {
    if (!data.layout) return [];
    return data.layout.placements.filter(p => {
      const word = getWord(p.wordId);
      return word && word.locked;
    });
  }

  /** Byt ut heile tilstanden (t.d. når eit lagra kryssord blir opna). */
  function load(saved) {
    data.id = saved.id || null;
    data.title = saved.title || '';
    data.words = (saved.words || []).map(w => ({
      id: w.id || OK.util.uuid(),
      answer: OK.util.normalizeAnswer(w.answer),
      clue: w.clue || '',
      locked: !!w.locked,
      freestanding: !!w.freestanding
    }));
    data.layout = saved.layout || null;
    data.names = Array.isArray(saved.names) ? saved.names.slice() : [];
    data.nameSource = saved.nameSource || '';
    data.settings = Object.assign({ showNameField: true, answerKey: true }, saved.settings || {});
    data.showAnswers = false;
  }

  /** Serialiser til lagring og eksport (jf. AGENTS.md §5.2). */
  function serialize(name) {
    return {
      app: 'ordkryss',
      version: 1,
      id: data.id || OK.util.uuid(),
      name: name || data.title || 'Utan namn',
      date: new Date().toISOString(),
      title: data.title,
      words: data.words.map(w => ({
        id: w.id, answer: w.answer, clue: w.clue,
        locked: w.locked, freestanding: w.freestanding
      })),
      layout: data.layout,
      names: data.names.slice(),
      nameSource: data.nameSource,
      settings: Object.assign({}, data.settings)
    };
  }

  return {
    data, emit, onChange,
    addWord, getWord, updateWord, removeWord, clearWords,
    placementOf, lockedPlacements, load, serialize
  };
})();
