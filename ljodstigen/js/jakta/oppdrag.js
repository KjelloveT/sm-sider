/* ══════════════════════════════════════════════
   OPPDRAG.JS — Kva banen ber om

   Her møtest spelet og pedagogikken. Geometrien i banen er fast og lik
   kvar gong; KVA BOKSTAV som står på kvar sokkel blir avgjort her, av
   LjodAdaptive — same motor som dei fire andre modusane.

   Det tyder at plattformspelet arvar heile det pedagogiske arbeidet
   gratis: dei to klokkene, fartskravet, frustrasjonsvakta og — viktigast
   — forvekslingsregelen. `b` og `d` hamnar ikkje på to soklar ved sida
   av kvarandre før begge sit kvar for seg. Det er den regelen som lettast
   forsvinn når innhaldet flyttar til ein ny modus, og det er difor han
   ikkje blir skriven på nytt her.

   Eit rett plukk går inn i motoren som eit vanleg svar, med responstid.
   Hagen veks av å spele Bokstavjakta akkurat som av Lydfangst.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── FORVEKSLINGSVAKTA ──

     LjodAdaptive passar på at ein bokstav og distraktorane HANS ikkje er
     forvekslingspar. Men ein bane har fleire bokstavar frå fleire kall,
     og då kan `b` kome frå eitt kall og `d` frå eit anna — begge lovlege
     kvar for seg, og likevel side om side på to soklar.

     Målt før denne vakta: 2 av 400 baner i «rekkje» sette b mot d før
     nokon av dei sat. Det er sjeldan nok til aldri å bli oppdaga i
     testing, og ofte nok til å råke ein elev.

     Vakta er difor felles for ALT som legg ein bokstav i ein bane —
     mål, distraktorar og oppfylling. */
  function kanLeggjast(a, ch, alt) {
    return !alt.some(function (annan) {
      if (!LjodLetters.isConfusable(ch, annan)) return false;
      return !(LjodAdaptive.item(a, ch).maxBox >= 3 &&
               LjodAdaptive.item(a, annan).maxBox >= 3);
    });
  }

  /**
   * @param profil   frå LjodState
   * @param soklar   frå JaktaBane.bygg
   * @param opts     { type:'lyd'|'rekkje'|'ord', laasteBokstavar:[] }
   */
  function lag(profil, soklar, opts) {
    opts = opts || {};
    const a = profil.adaptive;
    const type = opts.type || 'lyd';
    /* Ein lærar kan låse bokstavane i sine eigne baner — «vi jobbar med
       s, o og l denne veka». Feltet er tomt som standard, og då vel
       motoren som vanleg. Svara går inn i motoren uansett; det er berre
       UTVALET som er fast. */
    const laaste = (opts.laasteBokstavar || []).filter(function (c) {
      return LjodLetters.get(c);
    });

    const o = {
      type: type,
      maal: [],        // bokstavane som skal plukkast, i rekkjefølgje
      steg: 0,
      ord: null,
      starta: 0,
      ferdig: false
    };

    /* Motoren vel målbokstaven og distraktorane. Vi treng like mange
       bokstavar som det er soklar, og fasiten må vere blant dei. */
    const q = LjodAdaptive.pick(a, { });
    if (!q) return null;

    if (type === 'rekkje') {
      /* Fleire enkeltbokstavar etter kvarandre. Kvar av dei blir valt av
         motoren for seg — ikkje trekt frå ei liste vi laga ein gong — så
         forvekslingsregelen held gjennom heile banen. Det er den regelen
         som lettast forsvinn når innhaldet flyttar til ein ny oppdragstype. */
      const tal = Math.min(3, soklar.length);
      const sett = [];
      for (let i = 0; i < tal * 3 && sett.length < tal; i++) {
        const v = LjodAdaptive.pick(a, {});
        if (!v) break;
        if (sett.indexOf(v.ch) === -1 && kanLeggjast(a, v.ch, sett)) sett.push(v.ch);
      }
      /* Motoren kan gje same bokstav fleire gonger — han er jo den som
         treng øving mest. Fyll opp med andre han har møtt. */
      while (sett.length < tal) {
        const rest = LjodAdaptive.activeLetters(a).filter(function (c) {
          return sett.indexOf(c) === -1 && kanLeggjast(a, c, sett);
        });
        if (!rest.length) break;
        sett.push(rest[Math.floor(Math.random() * rest.length)]);
      }
      o.maal = sett;
    }

    if (type === 'ord') {
      const pool = LjodWords.available(a.step, { clean: true, maxLen: soklar.length });
      const ord = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (ord) {
        o.ord = ord;
        o.maal = ord.letters.slice();
      }
    }
    if (!o.maal.length) {
      o.type = 'lyd';
      o.maal = [q.ch];
    }

    /* Har læraren låst bokstavane, overstyrer dei utvalet — men ikkje
       talet: ein bane med tre soklar skal framleis be om tre. */
    if (laaste.length) {
      o.maal = o.maal.map(function (_, i) { return laaste[i % laaste.length]; });
    }

    /* Fordel bokstavane på soklane. Måla først, så distraktorar frå
       motoren — dei er alt filtrerte for forvekslingar. */
    const brikker = [];
    o.maal.forEach(function (c) { if (brikker.indexOf(c) === -1) brikker.push(c); });
    const ekstra = (laaste.length ? laaste : q.options)
      .filter(function (c) { return brikker.indexOf(c) === -1; });
    while (brikker.length < soklar.length && ekstra.length) {
      const c = ekstra.shift();
      if (kanLeggjast(a, c, brikker)) brikker.push(c);
    }
    while (brikker.length < soklar.length) {
      /* Skulle motoren gje for få, fyller vi opp med bokstavar eleven har
         møtt — men aldri eit forvekslingspar. Ein tom sokkel er betre enn
         ein bane som trenar inn ei forveksling. */
      const alle = LjodAdaptive.activeLetters(a).filter(function (c) {
        return brikker.indexOf(c) === -1 && kanLeggjast(a, c, brikker);
      });
      if (!alle.length) break;
      brikker.push(alle[Math.floor(Math.random() * alle.length)]);
    }

    shuffle(brikker).forEach(function (ch, i) {
      if (soklar[i]) soklar[i].bokstav = ch;
    });
    o.soklar = soklar;
    o.starta = performance.now();

    /* ──────────────── Kva skal spelast no ──────────────── */

    o.gjeldande = function () { return o.maal[o.steg] || null; };

    o.lydForOppgava = function () {
      if (o.type === 'ord' && o.ord) return [o.ord.sound];
      const ch = o.gjeldande();
      return ch ? ['f_' + ch] : [];
    };

    /**
     * Eleven gjekk borti ein sokkel.
     * @returns { rett, ferdig, ch }
     */
    o.plukk = function (sokkel) {
      if (o.ferdig || !sokkel || sokkel.teken) return null;
      const vil = o.gjeldande();
      const rett = sokkel.bokstav === vil;
      const brukt = performance.now() - o.starta;

      /* Inn i motoren som eit heilt vanleg svar. Dette er koplinga som
         gjer Bokstavjakta til ein læringsmodus og ikkje eit spel ved
         sida av. */
      LjodAdaptive.record(a, vil, rett, brukt, rett ? null : sokkel.bokstav);
      LjodMerke.noteAnswer(profil, vil, rett, brukt, rett ? null : sokkel.bokstav);

      if (rett) {
        sokkel.teken = true;
        o.steg++;
        o.starta = performance.now();
        if (o.steg >= o.maal.length) {
          o.ferdig = true;
          if (o.type === 'ord' && o.ord) LjodMerke.noteWord(profil, o.ord.text);
        }
      }
      return { rett: rett, ferdig: o.ferdig, ch: sokkel.bokstav, venta: vil };
    };

    return o;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  root.JaktaOppdrag = { lag: lag };
})(window);
