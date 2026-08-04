/* Duldord — dagslogikk, fasitord og vurdering av gjett. */
(function (global) {
  'use strict';

  const ALPHABET = 'abcdefghijklmnopqrstuvwxyzæøå';
  const WORD_LENGTH = 5;
  const MAX_GUESSES = 6;

  const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'desember'];

  /** Talet på ord i denne årgangen. */
  function wordCount() {
    return global.DULDORD_WORDS.length;
  }

  /** Startdatoen som eit Date på lokal midnatt. */
  function startDate() {
    const [y, m, d] = global.DULDORD_START.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /**
   * Kor mange dagar sidan start. Begge datoane blir normaliserte til lokal
   * midnatt før subtraksjonen, og runda av — då gjer ikkje sommartid noko utslag.
   */
  function todayIndex() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((today - startDate()) / 86400000);
  }

  /** Datoen for ein gitt dagindeks. */
  function dateForIndex(index) {
    const d = startDate();
    d.setDate(d.getDate() + index);
    return d;
  }

  function formatDate(date) {
    return `${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  }

  /**
   * Fasitordet for ein dag. Orda ligg lett obfuskerte i datafila så dei ikkje
   * kan lesast rett ut av utviklarverktøya; her rullar vi dei tilbake.
   */
  function wordForIndex(index) {
    const encoded = global.DULDORD_WORDS[index];
    if (!encoded) return null;
    const shift = (index * 7 + 13) % ALPHABET.length;
    let out = '';
    for (const ch of encoded) {
      const p = ALPHABET.indexOf(ch);
      out += ALPHABET[(p - shift + ALPHABET.length) % ALPHABET.length];
    }
    return out;
  }

  /**
   * Vurderer eit gjett mot fasiten og gjev 'correct' | 'present' | 'absent'
   * per rute. To gjennomkøyringar: fyrst dei rette plassane, så resten mot
   * dei bokstavane som er att. Utan det ville «hallo» mot «halde» vist to
   * treff på l, sjølv om fasiten berre har éin.
   */
  function scoreGuess(guess, answer) {
    const result = new Array(WORD_LENGTH).fill('absent');
    const remaining = Object.create(null);

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guess[i] === answer[i]) {
        result[i] = 'correct';
      } else {
        remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
      }
    }
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === 'correct') continue;
      const ch = guess[i];
      if (remaining[ch] > 0) {
        result[i] = 'present';
        remaining[ch]--;
      }
    }
    return result;
  }

  /** Beste kjende status for ein bokstav, brukt til å farge tastaturet. */
  const RANK = { absent: 0, present: 1, correct: 2 };
  function letterStates(guesses, answer) {
    const map = Object.create(null);
    guesses.forEach(guess => {
      scoreGuess(guess, answer).forEach((state, i) => {
        const ch = guess[i];
        if (!(ch in map) || RANK[state] > RANK[map[ch]]) map[ch] = state;
      });
    });
    return map;
  }

  function isLetter(ch) {
    return ALPHABET.indexOf(ch) >= 0;
  }

  global.DuldordState = {
    ALPHABET, WORD_LENGTH, MAX_GUESSES,
    wordCount, todayIndex, dateForIndex, formatDate,
    wordForIndex, scoreGuess, letterStates, isLetter
  };
})(window);
