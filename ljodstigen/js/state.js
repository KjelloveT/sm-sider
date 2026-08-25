/* ══════════════════════════════════════════════
   STATE.JS — Profilar og lagring i Ljodstigen

   All lagring går gjennom VyrdepilStorage (AGENTS.md §2). Ingen direkte
   localStorage her inne.

   FLEIRE PROFILAR PER EINING, fordi same iPad blir brukt av fleire
   elevar i løpet av ein dag. Profilen har INGEN fritekst: eleven vel
   ein figur frå ei fast liste. Då kan det ikkje hamne eit elevnamn i
   localStorage, uansett kva nokon skriv inn — for det finst ikkje noko
   å skrive i.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* Byte av namn på appen er eitt søk-og-erstatt herifrå. Namnet er
     mellombels — sjå toppen av planen. */
  const APP_ID = 'ljodstigen';
  const VERSION = 1;

  /* Plasshaldarfigurar: rein geometri, ingen teikning. Skal bytast ut
     når vi veit at spelet fungerer. Namna er valde, ikkje skrivne. */
  const AVATARS = [
    { id: 'sirkel',   name: 'Ringen',   shape: 'circle',   tone: 'accent'  },
    { id: 'firkant',  name: 'Steinen',  shape: 'square',   tone: 'accent2' },
    { id: 'trekant',  name: 'Fjellet',  shape: 'triangle', tone: 'accent3' },
    { id: 'rombe',    name: 'Droparen', shape: 'diamond',  tone: 'accent4' },
    { id: 'kross',    name: 'Krossen',  shape: 'cross',    tone: 'accent5' },
    { id: 'boge',     name: 'Bogen',    shape: 'arch',     tone: 'accent'  },
    { id: 'stjerne',  name: 'Stjerna',  shape: 'star',     tone: 'accent2' },
    { id: 'sekskant', name: 'Vaben',    shape: 'hex',      tone: 'accent3' }
  ];

  const FONTS = [
    { id: 'lesefont', label: 'Lesefont',    css: 'var(--ljod-font-read)' },
    { id: 'system',   label: 'Systemfont',  css: 'inherit' }
  ];

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function daysBetween(a, b) {
    return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000);
  }

  /* ──────────────── Rot ──────────────── */

  function blank() {
    return { app: APP_ID, version: VERSION, profiles: [], lastProfile: null,
             font: 'lesefont', allModes: false };
  }

  function read() {
    let raw = null;
    try { raw = VyrdepilStorage.getGameState(APP_ID); } catch (e) { raw = null; }
    if (!raw || typeof raw !== 'object') return blank();
    const s = blank();
    s.profiles = Array.isArray(raw.profiles) ? raw.profiles.map(hydrateProfile) : [];
    s.lastProfile = raw.lastProfile || null;
    s.font = raw.font === 'system' ? 'system' : 'lesefont';
    /* Opnar alle modusane uavhengig av kor langt eleven er komen.
       Innstillinga ligg på eininga, ikkje på profilen: ho handlar om
       kven som brukar maskina, ikkje om kva eleven kan. Progresjonen
       blir ikkje rørt — motoren reknar vidare som før. */
    s.allModes = raw.allModes === true;
    return s;
  }

  function write(s) {
    s.app = APP_ID;
    s.version = VERSION;
    try { VyrdepilStorage.setGameState(APP_ID, s); } catch (e) {
      console.warn('[Ljodstigen] fekk ikkje lagra:', e);
    }
  }

  /* ──────────────── Profilar ──────────────── */

  function hydrateProfile(p) {
    p = p || {};
    return {
      id: p.id || ('p' + Date.now()),
      avatar: p.avatar || AVATARS[0].id,
      created: p.created || today(),
      adaptive: LjodAdaptive.hydrate(p.adaptive),
      badges: Array.isArray(p.badges) ? p.badges : [],
      days: Array.isArray(p.days) ? p.days.slice(-40) : [],
      stars: (p.stars && typeof p.stars === 'object') ? p.stars : { date: null, ids: [] },
      lastModes: Array.isArray(p.lastModes) ? p.lastModes : [],
      /* Teljarar for merka. Held her, ikkje i den adaptive tilstanden:
         motoren skal handle om læring, ikkje om premiar. */
      counters: (p.counters && typeof p.counters === 'object') ? p.counters : {}
    };
  }

  function createProfile(avatarId) {
    const s = read();
    const p = hydrateProfile({ avatar: avatarId, created: today() });
    s.profiles.push(p);
    s.lastProfile = p.id;
    write(s);
    return p;
  }

  function deleteProfile(id) {
    const s = read();
    s.profiles = s.profiles.filter(function (p) { return p.id !== id; });
    if (s.lastProfile === id) s.lastProfile = s.profiles.length ? s.profiles[0].id : null;
    write(s);
  }

  function getProfile(id) {
    return read().profiles.filter(function (p) { return p.id === id; })[0] || null;
  }

  function saveProfile(p) {
    const s = read();
    const i = s.profiles.findIndex(function (x) { return x.id === p.id; });
    if (i === -1) s.profiles.push(p); else s.profiles[i] = p;
    s.lastProfile = p.id;
    write(s);
  }

  function avatarOf(id) {
    return AVATARS.filter(function (a) { return a.id === id; })[0] || AVATARS[0];
  }

  /* ──────────────── Dagsstjerner ──────────────── */

  /* Tente på INNSATS, ikkje på treffsikkerheit. Ingen av dei kan mistast
     ved å svare feil — det er heile poenget med å ha dei. */
  const STARS = [
    { id: 'spelt',   label: 'Du har spelt i dag' },
    { id: 'nymodus', label: 'Du prøvde noko nytt' },
    { id: 'attkome', label: 'Du kom att' }
  ];

  /** Kall når ei økt startar. Returnerer stjernene som blei tente no. */
  function startSession(p, modeId) {
    const t = today();
    if (p.stars.date !== t) p.stars = { date: t, ids: [] };
    const won = [];

    function give(id) {
      if (p.stars.ids.indexOf(id) === -1) { p.stars.ids.push(id); won.push(id); }
    }

    give('spelt');
    if (p.lastModes.length && p.lastModes.indexOf(modeId) === -1) give('nymodus');

    const prev = p.days[p.days.length - 1];
    if (prev && prev !== t && daysBetween(prev, t) === 1) give('attkome');

    if (p.days[p.days.length - 1] !== t) p.days.push(t);
    p.days = p.days.slice(-40);
    if (p.lastModes.indexOf(modeId) === -1) p.lastModes.push(modeId);
    if (p.adaptive.modesSeen.indexOf(modeId) === -1) p.adaptive.modesSeen.push(modeId);
    return won;
  }

  /** Kor mange dagar på rad, rekna bakover frå siste speledag. */
  function streakDays(p) {
    if (!p.days.length) return 0;
    let n = 1;
    for (let i = p.days.length - 1; i > 0; i--) {
      if (daysBetween(p.days[i - 1], p.days[i]) === 1) n++; else break;
    }
    return n;
  }

  root.LjodState = {
    APP_ID: APP_ID, VERSION: VERSION,
    AVATARS: AVATARS, FONTS: FONTS, STARS: STARS,
    today: today, daysBetween: daysBetween,
    read: read, write: write,
    createProfile: createProfile, deleteProfile: deleteProfile,
    getProfile: getProfile, saveProfile: saveProfile,
    avatarOf: avatarOf,
    startSession: startSession, streakDays: streakDays
  };
})(window);
