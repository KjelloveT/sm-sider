/* ══════════════════════════════════════════════
   VALIDATOR.JS — Er banen mogleg å fullføre?

   Brukt to stader: på dei innebygde banene, og medan ein lærar teiknar
   ein bane i Banelagar. Ein sokkel som ikkje kan nåast er ein bane som
   ikkje kan fullførast, og det ser ein ikkje ved å sjå på eit rutenett —
   verken som lærar eller som den som skreiv banefila.

   NÅBARHEIT ER DEN EINE SJEKKEN SOM BETYR NOKO. Resten — talet på
   startpunkt, lovlege teikn, like lange rader — er ting ein oppdagar med
   ein gong. At sokkel nummer fire ligg tre fliser over næraste plattform
   oppdagar ein når ein elev sit fast.

   MODELLEN AV HOPPET er med vilje litt strengare enn spelet:
   figuren når 153 px, altså 2,4 fliser, men vi reknar 2. Ein bane som så
   vidt går an er ein bane som ikkje går an for ein seksåring.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const LOVLEGE = '.#_=P@DcT ';
  const FAST = '#_=P';          // teikn ein kan stå på

  /* Kor langt figuren når. Fliser, ikkje pikslar. */
  const HOPP_OPP = 2;
  const HOPP_UT = 4;            // vassrett rekkjevidd i eit hopp
  const FALL_NED = 99;          // fall er gratis

  function erFast(rader, x, y) {
    if (y < 0 || y >= rader.length) return y >= rader.length;   // sokkelen under
    const rad = rader[y];
    if (x < 0 || x >= rad.length) return false;
    return FAST.indexOf(rad[x]) !== -1;
  }

  /** Kan figuren STÅ her? Ledig rute med noko fast rett under. */
  function kanStaa(rader, x, y) {
    if (y < 0 || y >= rader.length) return false;
    const rad = rader[y];
    if (x < 0 || x >= rad.length) return false;
    if (FAST.indexOf(rad[x]) !== -1) return false;      // ruta er sjølv fast
    return erFast(rader, x, y + 1);
  }

  /**
   * Alle ruter figuren kan nå frå startpunktet.
   * Flomfyll der kanten mellom to ruter er «kan hoppe dit».
   */
  function naabare(rader, start) {
    const sett = new Set();
    const ko = [start];
    const nokkel = function (p) { return p.x + ',' + p.y; };
    sett.add(nokkel(start));

    while (ko.length) {
      const no = ko.shift();
      /* Gå sidelengs på same nivå, og fall ned. */
      for (let dx = -HOPP_UT; dx <= HOPP_UT; dx++) {
        for (let dy = -HOPP_OPP; dy <= FALL_NED; dy++) {
          if (dx === 0 && dy === 0) continue;
          /* Å gå langt sidelengs OG høgt opp i same hopp går ikkje.
             Figuren når 2,4 fliser opp og 300 px/s sidelengs, så eit hopp
             til topps gjev kring halvparten av den vassrette rekkjevidda:
             han må lande i apeks. HOPP_UT + dy gjev 3 fliser ved eitt steg
             opp og 2 ved to — litt strengare enn fysikken, som er rett
             veg å bomme. */
          if (dy < 0 && Math.abs(dx) > HOPP_UT + dy) continue;
          const x = no.x + dx, y = no.y + dy;
          if (y > rader.length) continue;
          const p = { x: x, y: y };
          const n = nokkel(p);
          if (sett.has(n)) continue;
          if (!kanStaa(rader, x, y)) continue;
          sett.add(n);
          ko.push(p);
        }
      }
    }
    return sett;
  }

  /**
   * @param tekst  banegitteret
   * @returns { ok, feil:[], aatvaring:[] }
   */
  function sjekk(tekst) {
    const feil = [];
    const aatvaring = [];
    const rader = String(tekst).replace(/\r/g, '').split('\n')
      .filter(function (l) { return l.trim().length > 0 && l.trim().slice(0, 2) !== '//'; });

    if (!rader.length) return { ok: false, feil: ['Banen er tom.'], aatvaring: [] };

    /* Ulovlege teikn — med posisjon, så ein finn dei att. */
    rader.forEach(function (rad, y) {
      for (let x = 0; x < rad.length; x++) {
        if (LOVLEGE.indexOf(rad[x]) === -1) {
          feil.push('Ukjent teikn «' + rad[x] + '» på rad ' + (y + 1) + ', kolonne ' + (x + 1) + '.');
        }
      }
    });

    const breidder = rader.map(function (r) { return r.length; });
    if (new Set(breidder).size > 1) {
      feil.push('Radene er ulike lange: ' + Array.from(new Set(breidder)).join(', ') + '.');
    }

    const tel = function (t) {
      return rader.reduce(function (n, r) { return n + r.split(t).length - 1; }, 0);
    };
    const nStart = tel('@'), nDoer = tel('D'), nSokkel = tel('P');
    if (nStart !== 1) feil.push('Banen må ha nøyaktig eitt startpunkt (@), fann ' + nStart + '.');
    if (nDoer !== 1) feil.push('Banen må ha nøyaktig éi dør (D), fann ' + nDoer + '.');
    if (nSokkel < 1) feil.push('Banen må ha minst éin bokstavsokkel (P).');

    if (feil.length) return { ok: false, feil: feil, aatvaring: aatvaring };

    /* ── Nåbarheit ── */
    let start = null;
    rader.forEach(function (rad, y) {
      const x = rad.indexOf('@');
      if (x !== -1) start = { x: x, y: y };
    });

    /* Startpunktet må stå på noko. Gjer det ikkje, fell figuren til
       sokkelen — så vi flyttar startpunktet dit før flomfyllet. */
    let sy = start.y;
    while (sy + 1 < rader.length && !erFast(rader, start.x, sy + 1)) sy++;
    const naa = naabare(rader, { x: start.x, y: sy });

    const utanfor = [];
    rader.forEach(function (rad, y) {
      for (let x = 0; x < rad.length; x++) {
        const t = rad[x];
        if (t !== 'P' && t !== 'D' && t !== 'c') continue;
        /* Ein sokkel blir nådd frå ruta ved sida av eller over han. */
        const naboar = t === 'P'
          ? [{ x: x, y: y - 1 }, { x: x - 1, y: y }, { x: x + 1, y: y }]
          : [{ x: x, y: y }, { x: x, y: y + 1 }];
        const naadd = naboar.some(function (p) { return naa.has(p.x + ',' + p.y); });
        if (!naadd) utanfor.push({ t: t, x: x, y: y });
      }
    });

    utanfor.forEach(function (u) {
      const kva = u.t === 'P' ? 'Bokstavsokkelen' : (u.t === 'D' ? 'Døra' : 'Mynten');
      const melding = kva + ' på rad ' + (u.y + 1) + ', kolonne ' + (u.x + 1) +
        ' kan ikkje nåast. Figuren hoppar to fliser opp.';
      /* Ein mynt som ikkje kan nåast er like alvorleg som ein sokkel.
         Ei av dei tre stjernene krev ALLE myntane, så ein stranda mynt
         gjer stjerna uoppnåeleg — og regelen for merke og stjerner i
         Ljodstigen er at alle skal kunne nå alle. */
      feil.push(melding);
    });

    return { ok: feil.length === 0, feil: feil, aatvaring: aatvaring };
  }

  root.JaktaValidator = {
    sjekk: sjekk, naabare: naabare, kanStaa: kanStaa,
    LOVLEGE: LOVLEGE, FAST: FAST, HOPP_OPP: HOPP_OPP, HOPP_UT: HOPP_UT
  };
})(window);
