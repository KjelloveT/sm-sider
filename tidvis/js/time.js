/* time.js — tidsmodell, nivå-generering, nynorsk tekstuttrykk,
   digital format, distraktorar og samanlikning.
   Tid = { h: 1..12, m: 0..59 } (12-timars analog domene). */
(function () {
  'use strict';

  // klokkenamn for heile timar (index = time 1..12)
  const HOUR_NAMES = ['', 'eitt', 'to', 'tre', 'fire', 'fem', 'seks', 'sju',
                      'åtte', 'ni', 'ti', 'elleve', 'tolv'];

  // talord 1..29 (til vilkårlege minutt på nivå 4)
  const NUM_WORDS = ['', 'eitt', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte',
    'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten',
    'sytten', 'atten', 'nitten', 'tjue', 'tjueein', 'tjueto', 'tjuetre',
    'tjuefire', 'tjuefem', 'tjueseks', 'tjuesju', 'tjueåtte', 'tjueni'];

  // tillatne minutt per nivå (0-indeksert nivå)
  const LEVEL_MINUTES = [
    [0, 30],                                  // nivå 1: heile & halve
    [0, 15, 30, 45],                          // nivå 2: kvart
    [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], // nivå 3: fem & ti
    null                                      // nivå 4: alle minutt (0..59)
  ];

  // snap-steg for minuttvisaren under draging i "still visarane". Vi snappar til
  // 5 min på nivå 1–3 (naturleg «klikk» rundt skiva — alle måltidene ligg på
  // 5-min-merke), og til 1 min på nivå 4 («alle minutt») der eleven må treffe
  // kvart minutt. Rettleiing er uansett eksakt (TidvisTime.equals).
  const LEVEL_SNAP = [5, 5, 5, 1];

  function hourName(h) {
    const idx = ((h - 1 + 12) % 12) + 1;
    return HOUR_NAMES[idx];
  }
  function nextHour(h) { return (h % 12) + 1; }

  function clampLevel(level) {
    return Math.max(0, Math.min(3, level | 0));
  }

  // Tilfeldigheitskjelda kan bytast ut (sjå setRng) slik at arbeidsark-eksporten
  // kan generere reproduserbare oppgåvesett frå eit seed. Spelet rører aldri dette.
  let rand = Math.random;

  function randomInt(n) { return Math.floor(rand() * n); }

  function randomTime(level) {
    level = clampLevel(level);
    const h = randomInt(12) + 1; // 1..12
    let m;
    const mins = LEVEL_MINUTES[level];
    if (mins) m = mins[randomInt(mins.length)];
    else m = randomInt(60);
    return { h: h, m: m };
  }

  // nynorsk tekstuttrykk for ei tid
  function toText(t) {
    const h = t.h, m = t.m;
    const nm = hourName(nextHour(h));
    const cur = hourName(h);
    switch (m) {
      case 0:  return 'klokka ' + cur;
      case 5:  return 'fem over ' + cur;
      case 10: return 'ti over ' + cur;
      case 15: return 'kvart over ' + cur;
      case 20: return 'ti på halv ' + nm;
      case 25: return 'fem på halv ' + nm;
      case 30: return 'halv ' + nm;
      case 35: return 'fem over halv ' + nm;
      case 40: return 'ti over halv ' + nm;
      case 45: return 'kvart på ' + nm;
      case 50: return 'ti på ' + nm;
      case 55: return 'fem på ' + nm;
      default:
        // vilkårleg minutt (nivå 4)
        if (m < 30) return NUM_WORDS[m] + ' over ' + cur;
        return NUM_WORDS[60 - m] + ' på ' + nm;
    }
  }

  // digital HH:MM — fungerer for både 12t (h:1–12) og 24t (h:0–23)
  // sidan vi berre paddar h direkte: "03:30" eller "15:30"
  function toDigital(t) {
    const hh = String(t.h).padStart(2, '0');
    const mm = String(t.m).padStart(2, '0');
    return hh + ':' + mm;
  }

  // generer tilfeldig tid i 24-timars domene (h: 0–23)
  // toText/equals/analogvisarar brukar h%12 og handterer dette korrekt
  function randomTime24(level) {
    level = clampLevel(level);
    const h = randomInt(24); // 0..23
    let m;
    const mins = LEVEL_MINUTES[level];
    if (mins) m = mins[randomInt(mins.length)];
    else m = randomInt(60);
    return { h: h, m: m };
  }

  function equals(a, b) {
    return a && b && (a.h % 12) === (b.h % 12) && a.m === b.m;
  }

  // unik nøkkel for ei tid — basert på 12t-posisjon (0–11:mm)
  // slik at t.h=3 og t.h=15 har same nøkkel og aldri begge er alternativ
  function key(t) { return (t.h % 12) + ':' + t.m; }

  // generer n distinkte feil-tider nær fasiten, innanfor nivået
  // støttar 24t-tider: nær time-distraktoren held seg i 24t-domenet
  function distractorTimes(correct, level, n) {
    level = clampLevel(level);
    const mins = LEVEL_MINUTES[level];
    const use24 = correct.h === 0 || correct.h > 12; // 24t-tid
    const out = [];
    const seen = {};
    seen[key(correct)] = true;
    let guard = 0;
    while (out.length < n && guard < 200) {
      guard++;
      let cand;
      const roll = rand();
      if (roll < 0.55) {
        // same time, anna minutt frå nivået
        let m;
        if (mins) m = mins[randomInt(mins.length)];
        else {
          const delta = [1, 2, 3, 5, 5, 10][randomInt(6)] * (rand() < 0.5 ? -1 : 1);
          m = ((correct.m + delta) % 60 + 60) % 60;
        }
        cand = { h: correct.h, m: m };
      } else if (roll < 0.8) {
        // nær time, same minutt — hald domenet (12t vs 24t)
        const dh = rand() < 0.5 ? 1 : -1;
        if (use24) {
          const h = (correct.h + dh + 24) % 24;
          cand = { h: h, m: correct.m };
        } else {
          cand = { h: ((correct.h - 1 + dh + 12) % 12) + 1, m: correct.m };
        }
      } else {
        // heilt ny tid frå same domene
        cand = use24 ? randomTime24(level) : randomTime(level);
      }
      const k = key(cand);
      if (!seen[k]) { seen[k] = true; out.push(cand); }
    }
    // fallback
    while (out.length < n) {
      const h = use24
        ? (correct.h + out.length + 1) % 24
        : ((correct.h + out.length) % 12) + 1;
      const cand = { h: h, m: correct.m };
      const k = key(cand);
      if (!seen[k]) { seen[k] = true; out.push(cand); }
      else break;
    }
    return out;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  window.TidvisTime = {
    randomTime: randomTime,
    randomTime24: randomTime24,
    toText: toText,
    toDigital: toDigital,
    equals: equals,
    key: key,
    distractorTimes: distractorTimes,
    shuffle: shuffle,
    // byt tilfeldigheitskjelde (t.d. ein seeda PRNG) — kall resetRng etterpå
    setRng: function (fn) { rand = fn || Math.random; },
    resetRng: function () { rand = Math.random; },
    snapStep: function (level) { return LEVEL_SNAP[clampLevel(level)]; },
    levelMinutes: function (level) { return LEVEL_MINUTES[clampLevel(level)]; },
    LEVEL_NAMES: ['Heile & halve', 'Kvart', 'Fem & ti', 'Alle minutt'],
    LEVEL_HINTS: ['klokka 3 · halv 4', 'kvart på / over', 'fem over · ti på', 'kvart minutt']
  };
})();
