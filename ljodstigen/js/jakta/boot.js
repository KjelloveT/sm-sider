/* ══════════════════════════════════════════════
   BOOT.JS — Oppsett og banescene for Bokstavjakta

   FIRE VAL SOM ER MEIR GJENNOMTENKTE ENN DEI SER UT:

   1. PHASER SITT LYDSYSTEM ER AV. LjodAudio eig all lyd i Ljodstigen —
      lydsprites, stemmepakkar og iOS-opplåsinga ligg der. To lydmotorar
      i same app er ein feil som ventar på å skje.

   2. devicePixelRatio ER KAPPA PÅ 2. Ein iPad Pro melder 3, og ni gonger
      så mange pikslar per ramme for ein skilnad ingen ser.

   3. AUTO, IKKJE WEBGL. Fell WebGL bort, går Phaser til Canvas i staden
      for å vise ein svart skjerm.

   4. VERDA STÅR PÅ EIN FAST SOKKEL. Dei tre nedste radene er bakke i
      kvar einaste bane, lagde av byggjaren og ikkje av banefila. Verda
      blir bygd oppå. Kontrollane ligg over dei to nedste radene av
      sokkelen — det er berre jord der, ingenting eleven treng å sjå, og
      dermed slepp vi å ofre skjermplass på ei tom stripe.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const ATLAS = 'jakta/atlas.png';
  const ATLAS_JSON = 'jakta/atlas.json';

  const FLIS = 64;
  const RUTER_BREI = 16;
  const BANE_RADER = 7;        // det banefila teiknar
  const BASIS_RADER = 3;       // fast sokkel under, lik i kvar bane
  const RUTER_HOG = BANE_RADER + BASIS_RADER;

  const W = RUTER_BREI * FLIS;
  const H = RUTER_HOG * FLIS;

  let game = null;

  function $(id) { return document.getElementById(id); }

  function feil(melding) {
    const boks = $('jakta-feil'), tekst = $('jakta-feil-tekst'), lastar = $('jakta-lastar');
    if (tekst) tekst.textContent = melding;
    if (boks) boks.hidden = false;
    if (lastar) lastar.hidden = true;
    console.warn('[Bokstavjakta] ' + melding);
  }

  function profil() {
    const s = LjodState.read();
    let p = s.lastProfile ? LjodState.getProfile(s.lastProfile) : null;
    if (!p) p = s.profiles[0] || null;
    return p;
  }

  /* ──────────────── Lasting ──────────────── */

  /* ES6-KLASSER, IKKJE VANLEGE OBJEKT.
     Gjev ein Phaser eit vanleg objekt som scene, kopierer han berre dei
     kjende livssyklus-metodane — init, preload, create, update. Eigne
     hjelpemetodar blir stille borte, og feilen kjem først når noko kallar
     dei: «this.visOppdrag is not a function», midt i ei ferdig scene som
     ser ut til å ha lasta. */
  class Lasting extends Phaser.Scene {
    constructor() { super('lasting'); }

    preload() {
      const bar = $('jakta-progress');
      this.load.atlas('kenney', ATLAS, ATLAS_JSON);
      this.load.on('progress', function (v) { if (bar) bar.style.width = Math.round(v * 100) + '%'; });
      this.load.on('loaderror', function (f) {
        feil('Fekk ikkje lasta «' + f.key + '». Prøv å laste sida på nytt.');
      });
    }

    create() {
      JaktaGlyfar.addToPhaser(this, 'glyfar');
      const lastar = $('jakta-lastar');
      if (lastar) lastar.hidden = true;
      this.scene.start('bane', { baneId: root.JaktaStartBane || 'verd1-01' });
    }
  }

  /* ──────────────── Banescene ──────────────── */

  class Bane extends Phaser.Scene {
    constructor() { super('bane'); }

    init(data) {
      this.baneId = (data && data.baneId) || 'verd1-01';
    }

    create() {
      const scene = this;
      const def = JaktaBaner.hent(this.baneId);
      this.def = def;

      this.cameras.main.setBackgroundColor('#f4f1ea');

      /* Banefila teiknar berre det som står PÅ sokkelen; dei tre nedste
         radene legg byggjaren til. Sjå bane.js. */
      this.bane = JaktaBane.bygg(this, def.rutenett, { basisRader: BASIS_RADER });

      this.spelar = JaktaSpelar.lag(this, this.bane.start.x, this.bane.start.y, {
        farge: 'Green'
      });
      this.physics.add.collider(this.spelar.kropp, this.bane.faste);
      this.physics.world.setBounds(0, -200, W, H + 400);

      /* Bokstavane på soklane. Dei blir sette av oppdraget, ikkje av
         banefila: geometrien er fast, innhaldet er adaptivt. */
      this.profil = profil();
      if (!this.profil) {
        feil('Vel ein figur på Ljodstigen-sida først, så veit spelet kven som speler.');
        return;
      }
      this.oppdrag = JaktaOppdrag.lag(this.profil, this.bane.soklar, { type: def.type });
      if (!this.oppdrag) { feil('Fekk ikkje laga eit oppdrag til denne banen.'); return; }

      this.bane.soklar.forEach(function (s) {
        if (!s.bokstav) return;
        s.glyf = scene.add.image(s.x, s.y, 'glyfar', s.bokstav)
          .setDisplaySize(FLIS * 0.72, FLIS * 0.72).setDepth(9);
        scene.tweens.add({
          targets: s.glyf, y: s.y - 6, duration: 1000 + Math.random() * 300,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      });

      this.styring = JaktaStyring.lag(this);

      /* ── Lyd ──
         LjodAudio er alt lasta av sida. Første trykk låser opp
         AudioContext-en på iPad; det MÅ skje inne i ein trykk-handterar,
         og difor ligg kallet her og ikkje i create(). */
      this.input.once('pointerdown', function () { LjodAudio.unlock(); });

      this.hudTekst = $('jakta-oppdrag');
      this.lydKnapp = $('jakta-lyd');
      if (this.lydKnapp) {
        this.lydKnapp.onclick = function () { scene.spelOppgava(); };
      }

      this.visOppdrag();
      /* Litt pust før oppgåva blir lesen, så eleven rekk å sjå banen. */
      this.time.delayedCall(600, function () { scene.spelOppgava(); });

      /* Ei enkel ordlinje for ord-baner: ruter som fyllest etter kvart. */
      this.oppdaterHud();

      root.JaktaScene = this;
    }

    spelOppgava() {
      const ids = this.oppdrag ? this.oppdrag.lydForOppgava() : [];
      if (ids.length) LjodAudio.playSeq(ids, 200);
    }

    visOppdrag() {
      if (!this.hudTekst) return;
      this.hudTekst.textContent = this.oppdrag.type === 'ord'
        ? 'Finn bokstavane i ordet du høyrer'
        : 'Finn bokstaven du høyrer';
    }

    oppdaterHud() {
      if (!this.hudTekst || !this.oppdrag) return;
      if (this.oppdrag.type === 'ord' && this.oppdrag.ord) {
        const t = this.oppdrag.ord.letters.map(function (ch, i) {
          return i < this.oppdrag.steg ? ch : '_';
        }, this).join(' ');
        this.hudTekst.textContent = t;
      }
    }

    /* ──────────────── Plukking ──────────────── */

    proevSokkel(sokkel) {
      const scene = this;
      if (!this.oppdrag || sokkel.teken) return;
      const svar = this.oppdrag.plukk(sokkel);
      if (!svar) return;

      /* INGEN GLOBAL SPERRE. Det stod ei her på 700 ms for å hindre at
         same sokkel utløyste fleire gonger, men den jobben gjer
         inngangssporinga i update() betre. Sperra gjorde derimot skade:
         eit barn som bomma og straks sprang til rett sokkel fekk det
         rette svaret sitt stille ignorert.

         Det vi faktisk treng er berre å stoppe lyden som går, så to
         tilbakemeldingar ikkje snakkar oppå kvarandre. */
      LjodAudio.stop();

      if (svar.rett) {
        /* Bokstaven flyg opp og blir borte. */
        this.tweens.killTweensOf(sokkel.glyf);
        this.tweens.add({
          targets: sokkel.glyf, y: sokkel.y - 70, alpha: 0, scale: 1.6,
          duration: 520, ease: 'Quad.easeOut',
          onComplete: function () { sokkel.glyf.destroy(); }
        });
        sokkel.blokk.setTint(0xBAFCA2);
        LjodAudio.playSeq(['f_' + svar.ch, LjodRender.praiseId()], 160);
        this.oppdaterHud();

        if (this.oppdrag.ferdig) this.opneDoer();
        else this.time.delayedCall(900, function () { scene.spelOppgava(); });
      } else {
        /* Feil: bokstaven ristar, og eleven høyrer kva han skulle leite
           etter. Ingenting går tapt, ingen liv, ingen teljar som fell. */
        this.tweens.add({
          targets: sokkel.glyf, x: sokkel.x + 8, duration: 60,
          yoyo: true, repeat: 4
        });
        sokkel.blokk.setTint(0xFFC2C2);
        this.time.delayedCall(700, function () { sokkel.blokk.clearTint(); });
        LjodAudio.playSeq([LjodRender.nudgeId()].concat(this.oppdrag.lydForOppgava()), 200);
      }
      LjodState.saveProfile(this.profil);
    }

    opneDoer() {
      const scene = this;
      const d = this.bane.doer;
      if (!d) return;
      d.stengd = false;
      this.tweens.add({ targets: d, alpha: 1, scale: 1.1, duration: 400, yoyo: true, repeat: 1 });
      if (this.hudTekst) this.hudTekst.textContent = 'Gå til døra!';
    }

    fullfoer() {
      if (this.ferdig) return;
      this.ferdig = true;
      const scene = this;
      LjodMerke.check(this.profil);
      LjodState.saveProfile(this.profil);
      LjodAudio.play('r_okt');
      if (this.hudTekst) this.hudTekst.textContent = 'Godt jobba!';
      this.time.delayedCall(1400, function () {
        root.location.href = 'index.html';
      });
    }

    /* ──────────────── Løkka ──────────────── */

    update(tid, delta) {
      const s = this.spelar;
      if (!s || !this.oppdrag) return;

      s.oppdater(tid, delta, this.styring.les());
      s.bergOmFalt(RUTER_HOG * FLIS + 120);

      const k = s.kropp;

      /* Soklar. Vi brukar avstand og ikkje Arcade sin overlapp, fordi
         sokkelen ALT er ein fast kropp figuren står på — ein overlapp
         ville aldri utløysast.

         ÉIN FREISTNAD PER TILNÆRMING. Vi utløyser når eleven KJEM INN i
         sirkelen, ikkje medan han er der. Utan det blir eit feilsvar
         registrert på nytt kvar gong sperra går ut, så lenge han står i
         ro ved sokkelen — og eit barn som blir ståande og lurer ville
         samla opp ti feil han aldri gjorde. Det er læringsdata, ikkje
         berre ein teljar. */
      for (let i = 0; i < this.bane.soklar.length; i++) {
        const so = this.bane.soklar[i];
        if (so.teken || !so.glyf) continue;
        const inne = Phaser.Math.Distance.Between(k.x, k.y, so.x, so.y) < FLIS * 0.85;
        if (inne && !so.inne) this.proevSokkel(so);
        /* Litt slark ut att, så ein figur som vippar på grensa ikkje
           utløyser om og om igjen. */
        so.inne = inne || (so.inne &&
          Phaser.Math.Distance.Between(k.x, k.y, so.x, so.y) < FLIS * 1.15);
      }

      /* Myntar. Rein utforsking — ingen straff for å gå glipp av dei. */
      for (let i = 0; i < this.bane.myntar.length; i++) {
        const m = this.bane.myntar[i];
        if (m.teken) continue;
        if (Phaser.Math.Distance.Between(k.x, k.y, m.x, m.y) < FLIS * 0.7) {
          m.teken = true;
          this.tweens.add({
            targets: m.bilete, y: m.y - 40, alpha: 0, duration: 380,
            onComplete: function () { m.bilete.destroy(); }
          });
        }
      }

      /* Døra. */
      const d = this.bane.doer;
      if (d && !d.stengd && !this.ferdig &&
          Phaser.Math.Distance.Between(k.x, k.y, d.x, d.y) < FLIS * 0.8) {
        this.fullfoer();
      }
    }
  }

  /* ──────────────── Oppstart ──────────────── */

  function start() {
    if (typeof Phaser === 'undefined') {
      feil('Spelmotoren blei ikkje lasta. Er du på nett?');
      return;
    }
    /* Fonten FØRST. Blir glyfteksturen laga før Andika er klar, står
       feil bokstavformer der resten av økta — og det blir aldri
       oppdaga, sidan fonten ser rett ut overalt elles. */
    JaktaGlyfar.ready().then(function (harAndika) {
      if (!harAndika) console.info('[Bokstavjakta] Andika mangla; brukar fallback-fonten.');
      /* Lyden kan lastast parallelt med at spelet startar. */
      LjodAudio.load(null, { voice: LjodState.read().voice });
      lagSpel();
    });
  }

  function lagSpel() {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'jakta-canvas',
      width: W, height: H,
      backgroundColor: '#f4f1ea',
      audio: { noAudio: true },
      banner: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, roundPixels: true, powerPreference: 'low-power' },
      /* Fleire fingrar samstundes: å gå og hoppe på same tid er ikkje ein
         spesialmanøver, det er det ein gjer heile tida. */
      input: { activePointers: 3 },
      physics: { default: 'arcade', arcade: { gravity: { y: 1600 }, debug: false } },
      scene: [Lasting, Bane]
    });
    root.JaktaGame = game;

    const cv = document.querySelector('#jakta-canvas canvas');
    if (cv) {
      cv.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        feil('Grafikken stoppa. Last sida på nytt for å halde fram.');
      });
    }
  }

  root.JaktaBoot = {
    start: start, FLIS: FLIS, W: W, H: H,
    BANE_RADER: BANE_RADER, BASIS_RADER: BASIS_RADER
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
