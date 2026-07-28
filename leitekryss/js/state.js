/* Leitekryss — tilstand for det leitekrysset du arbeider med no. */
window.LK = window.LK || {};

LK.state = (function () {
  'use strict';

  const listeners = [];

  function defaultSettings() {
    return {
      difficulty: 'middels',      // lett | middels | vanskeleg
      size: 'auto',               // 'auto' eller tal
      allowCrossing: true,
      showWordList: 'liste',      // liste | tal | ingen
      showNameField: true,
      answerKey: true,
      uniquePerPupil: false
    };
  }

  const data = {
    id: null,                 // id i biblioteket, om det er lagra
    title: '',
    words: [],                // { id, text, word }  — text er slik læraren skreiv det
    grid: null,               // sjå LK.generator.build()
    names: [],                // elevnamn til utskrift
    nameSource: '',           // kort tekst om kvar namna kom frå
    settings: defaultSettings(),
    showAnswers: false        // berre førehandsvisinga på skjermen
  };

  /** Meld frå om at noko er endra. topic: 'words' | 'grid' | 'names' | 'settings' | 'library' | 'load' */
  function emit(topic) {
    listeners.forEach(fn => fn(topic, data));
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function addWord(text) {
    const entry = {
      id: LK.util.uuid(),
      text: String(text || '').trim(),
      word: LK.util.normalizeWord(text)
    };
    data.words.push(entry);
    return entry;
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
    data.grid = null;
  }

  function clearWords() {
    data.words = [];
    data.grid = null;
  }

  /** Ord som blei gøymde i gjeldande rutenett. */
  function placementOf(wordId) {
    if (!data.grid) return null;
    return data.grid.placements.find(p => p.wordId === wordId) || null;
  }

  /** Byt ut heile tilstanden (t.d. når eit lagra leitekryss blir opna). */
  function load(saved) {
    data.id = saved.id || null;
    data.title = saved.title || '';
    data.words = (saved.words || []).map(w => ({
      id: w.id || LK.util.uuid(),
      text: w.text || w.word || '',
      word: LK.util.normalizeWord(w.word || w.text)
    })).filter(w => w.word);
    data.grid = saved.grid || null;
    data.names = Array.isArray(saved.names) ? saved.names.slice() : [];
    data.nameSource = saved.nameSource || '';
    data.settings = Object.assign(defaultSettings(), saved.settings || {});
    data.showAnswers = false;
  }

  /** Serialiser til lagring og eksport (jf. AGENTS.md §5.2). */
  function serialize(name) {
    return {
      app: 'leitekryss',
      version: 1,
      id: data.id || LK.util.uuid(),
      name: name || data.title || 'Utan namn',
      date: new Date().toISOString(),
      title: data.title,
      words: data.words.map(w => ({ id: w.id, text: w.text, word: w.word })),
      grid: data.grid,
      names: data.names.slice(),
      nameSource: data.nameSource,
      settings: Object.assign({}, data.settings)
    };
  }

  return {
    data, emit, onChange, defaultSettings,
    addWord, getWord, updateWord, removeWord, clearWords,
    placementOf, load, serialize
  };
})();
