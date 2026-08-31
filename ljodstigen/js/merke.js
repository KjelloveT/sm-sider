/* ══════════════════════════════════════════════
   MERKE.JS — Prestasjonar og dagsstjerner

   Alle merka er laga slik at ALLE kan nå ALLE, før eller seinare. Ingen
   av dei krev feilfri rekkje, og ingen av dei krev fart. Eit merke for
   «ti rette på rad» eller «under to sekund» ville ekskludert nøyaktig
   den eleven verktøyet er til for.

   To av dei går motsett veg og premierer at eleven brukar tid:
   «Roleg og sikker» og «Tolmodig».
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Kvart merke: id, tittel, kva som skal til (synleg for eleven), og ein
     test. Testen får (p, a) der a er den adaptive tilstanden. */
  const BADGES = [
    {
      id: 'spire', title: 'Første spire', hint: 'Få ein bokstav til å spire',
      test: function (p, a) {
        return Object.keys(a.items).some(function (ch) { return a.items[ch].maxBox >= 2; });
      }
    },
    {
      id: 'sjufro', title: 'Sju frø', hint: 'Plant alle bokstavane i det første settet',
      test: function (p, a) {
        return LjodLetters.STEPS[0].every(function (ch) {
          return a.items[ch] && a.items[ch].maxBox >= 1;
        });
      }
    },
    {
      id: 'solstralen', title: 'Solstrålen', hint: 'Lyder ordet «sol»',
      test: function (p) { return (p.counters.words || []).indexOf('sol') !== -1; }
    },
    {
      id: 'ordbyggjar', title: 'Ordbyggjar', hint: 'Bygg ti ord',
      test: function (p) { return (p.counters.wordsBuilt || 0) >= 10; }
    },
    {
      id: 'tvillingane', title: 'Tvillingane', hint: 'Skil b og d ti gonger på rad',
      test: function (p) { return (p.counters.bdStreak || 0) >= 10; }
    },
    {
      id: 'rolegsikker', title: 'Roleg og sikker', hint: 'Ti rette der du tok deg god tid',
      test: function (p) { return (p.counters.slowRight || 0) >= 10; }
    },
    {
      id: 'tolmodig', title: 'Tolmodig', hint: 'Kom att til ein vanskeleg bokstav og fekk han rett',
      test: function (p) { return (p.counters.redeemed || []).length >= 1; }
    },
    {
      id: 'attkome', title: 'Attkomen', hint: 'Spel to dagar på rad',
      test: function (p) { return LjodState.streakDays(p) >= 2; }
    },
    {
      id: 'trufast', title: 'Trufast', hint: 'Spel fem dagar på rad',
      test: function (p) { return LjodState.streakDays(p) >= 5; }
    },
    {
      id: 'nysgjerrig', title: 'Nysgjerrig', hint: 'Prøv alle modusane du har opne',
      test: function (p, a) {
        const open = LjodAdaptive.unlockedModes(a);
        return open.length > 1 && open.every(function (m) {
          return a.modesSeen.indexOf(m.id) !== -1;
        });
      }
    },
    {
      id: 'heilehagen', title: 'Heile skogen', hint: 'Få alle 29 bokstavane til å bli tre',
      test: function (p, a) {
        return LjodLetters.ALPHABET.every(function (ch) {
          return a.items[ch] && a.items[ch].maxBox >= LjodAdaptive.MAX_BOX;
        });
      }
    }
  ];

  function ensure(p) {
    if (!p.counters || typeof p.counters !== 'object') p.counters = {};
    return p.counters;
  }

  /**
   * Registrer eit svar for merke-formål. Kallast rett etter
   * LjodAdaptive.record, med same argument.
   */
  function noteAnswer(p, ch, correct, latencyMs, chosen) {
    const c = ensure(p);
    const it = p.adaptive.items[ch];

    /* Roleg og sikker: rett, men eleven tok seg tid. Motsett av alle
       andre spel — her er det treige svaret det som blir premiert. */
    if (correct && latencyMs > LjodAdaptive.FAST_MS) c.slowRight = (c.slowRight || 0) + 1;

    /* Tolmodig: bokstaven har vore feil før, og no sit han. */
    if (correct && it && it.wrong > 0) {
      c.redeemed = c.redeemed || [];
      if (c.redeemed.indexOf(ch) === -1) c.redeemed.push(ch);
    }

    /* Tvillingane: rekkja tel berre oppgåver der b eller d faktisk var
       med i biletet. Andre oppgåver rører henne ikkje. */
    if (ch === 'b' || ch === 'd') {
      if (correct) c.bdStreak = (c.bdStreak || 0) + 1;
      else c.bdStreak = 0;
    } else if (!correct && (chosen === 'b' || chosen === 'd')) {
      c.bdStreak = 0;
    }
  }

  /** Registrer eit ferdig bygd ord. */
  function noteWord(p, text) {
    const c = ensure(p);
    c.wordsBuilt = (c.wordsBuilt || 0) + 1;
    c.words = c.words || [];
    if (c.words.indexOf(text) === -1) c.words.push(text);
  }

  /**
   * Sjå etter nye merke. Returnerer dei som blei opptente akkurat no,
   * slik at UI-et kan feire dei — resten er alt feira.
   */
  function check(p) {
    ensure(p);
    const won = [];
    BADGES.forEach(function (b) {
      if (p.badges.indexOf(b.id) !== -1) return;
      let got = false;
      try { got = !!b.test(p, p.adaptive); } catch (e) { got = false; }
      if (got) { p.badges.push(b.id); won.push(b); }
    });
    return won;
  }

  function all() { return BADGES.slice(); }
  function get(id) { return BADGES.filter(function (b) { return b.id === id; })[0] || null; }

  root.LjodMerke = { BADGES: BADGES, all: all, get: get, check: check, noteAnswer: noteAnswer, noteWord: noteWord };
})(window);
