/* ══════════════════════════════════════════════
   BOOT.JS — Phaser-oppsettet til Bokstavjakta

   Fire val her er meir gjennomtenkte enn dei ser ut:

   1. PHASER SITT LYDSYSTEM ER AV. LjodAudio eig all lyd i Ljodstigen —
      lydsprites, stemmepakkar og iOS-opplåsinga ligg der. To lydmotorar
      i same app er ein feil som ventar på å skje, og Phaser ville i
      tillegg lasta lyd på nytt i sitt eige format.

   2. devicePixelRatio ER KAPPA PÅ 2. Ein iPad Pro melder 3, og eit
      lerret i tre gonger oppløysing er ni gonger så mange pikslar å
      fylle kvar ramme. Skilnaden mellom 2 og 3 ser ingen; skilnaden i
      bildefrekvens gjer dei.

   3. AUTO, IKKJE WEBGL. Fell WebGL bort — gammal iPad, tapt kontekst,
      avslegen maskinvareakselerasjon — går Phaser til Canvas i staden
      for å vise ein svart skjerm.

   4. ROUND_PIXELS. Kenney-sprita er teikna på eit 64-rutenett; landar
      dei på halve pikslar, blir dei skisseaktige konturane uskarpe.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const ATLAS = 'jakta/atlas.png';
  const ATLAS_JSON = 'jakta/atlas.json';

  /* Verda er teikna på 64-rutenettet til Kenney. Vi viser 16×9 fliser,
     som gjev eit 16:9-bilete og ei figurstorleik der ein seksåring ser
     kvar han er utan å måtte leite. */
  const FLIS = 64;
  const RUTER_BREI = 16;
  const RUTER_HOG = 9;

  /* Hoppkjensla. Desse tre tala avgjer om spelet er godt, og dei er dei
     einaste som er verdt å justere etter at nokon har prøvd det. */
  const BASE_SKALA = 0.9;  // figuren mot ei 64-flis
  const HOPPKRAFT = 640;
  const COYOTE_MS = 110;   // du kan hoppe eit augeblink etter kanten
  const BUFFER_MS = 160;   // trykk rett før landing tel når du landar

  let game = null;

  function $(id) { return document.getElementById(id); }

  function feil(melding) {
    const boks = $('jakta-feil');
    const tekst = $('jakta-feil-tekst');
    if (tekst) tekst.textContent = melding;
    if (boks) boks.hidden = false;
    const lastar = $('jakta-lastar');
    if (lastar) lastar.hidden = true;
    console.warn('[Bokstavjakta] ' + melding);
  }

  /* ──────────────── Lastescene ──────────────── */

  const Lasting = {
    key: 'lasting',

    preload: function () {
      const bar = $('jakta-progress');
      this.load.atlas('kenney', ATLAS, ATLAS_JSON);
      this.load.on('progress', function (v) {
        if (bar) bar.style.width = Math.round(v * 100) + '%';
      });
      this.load.on('loaderror', function (f) {
        feil('Fekk ikkje lasta «' + f.key + '». Prøv å laste sida på nytt.');
      });
    },

    /* Ingen ventiing her inne. Fonten er venta ut FØR spelet blir laga
       — sjå start(). Startar ein ei scene frå ein promise inne i
       create(), blir kallet liggjande i køen til scenehandsamaren utan
       å bli utført, og eleven ser lastebiletet for alltid. */
    create: function () {
      JaktaGlyfar.addToPhaser(this, 'glyfar');
      const lastar = $('jakta-lastar');
      if (lastar) lastar.hidden = true;
      this.scene.start('prove');
    }
  };

  /* ──────────────── Prøvescene ────────────────
     Mellombels. Viser at atlaset, glyfane og fysikken lever, slik at
     vi kan måle CSP, bildefrekvens og trykk på iPad før det finst eit
     spel å måle dei på. Blir bytt ut av den ekte banescena. */

  const Prove = {
    key: 'prove',

    create: function () {
      const W = RUTER_BREI * FLIS;
      const H = RUTER_HOG * FLIS;

      this.cameras.main.setBackgroundColor('#f4f1ea');

      /* Ei stripe grunn langs botnen. */
      const grunn = this.physics.add.staticGroup();
      for (let x = 0; x < RUTER_BREI; x++) {
        grunn.create(x * FLIS + FLIS / 2, H - FLIS / 2, 'kenney', 'tile_grass')
          .setDisplaySize(FLIS, FLIS).refreshBody();
      }

      /* Nokre plattformer å hoppe på. */
      [[3, 6], [4, 6], [8, 5], [9, 5], [12, 4]].forEach(function (p) {
        grunn.create(p[0] * FLIS + FLIS / 2, p[1] * FLIS + FLIS / 2, 'kenney', 'tile')
          .setDisplaySize(FLIS, FLIS).refreshBody();
      }, this);

      /* Figuren. Éin ramme — Kenney har ingen gangesyklus — så rørsla
         må lagast prosedyralt. Her berre eit lite sprett i landinga. */
      this.spelar = this.physics.add.sprite(2 * FLIS, H - 3 * FLIS, 'kenney', 'character_roundGreen');
      /* setScale, ikkje setDisplaySize: skalaen er noko vi kjem til å
         pille på for sprett-effekten, og då må vi vite kva som er
         utgangspunktet. BASE er sanninga; squashen gongar med han. */
      this.spelar.setScale(BASE_SKALA);
      /* Kroppen i KJELDEPIKSLAR — Arcade skalerer han sjølv. Han er
         litt smalare og lågare enn sprita, så figuren ikkje hektar seg
         fast i kantar han visuelt ser ut til å komme forbi. */
      this.spelar.body.setSize(44, 56).setOffset(10, 8);
      this.spelar.setCollideWorldBounds(true);
      this.physics.add.collider(this.spelar, grunn);

      /* Nokre bokstavar på soklar, for å sjå at glyfane sit. */
      const bokstavar = ['s', 'o', 'l', 'm'];
      bokstavar.forEach(function (ch, i) {
        const x = (3 + i * 3.2) * FLIS;
        this.add.image(x, H - FLIS * 1.5, 'kenney', 'tile_block')
          .setDisplaySize(FLIS, FLIS);
        const b = this.add.image(x, H - FLIS * 2.4, 'glyfar', ch)
          .setDisplaySize(FLIS * 0.8, FLIS * 0.8);
        this.tweens.add({
          targets: b, y: b.y - 8, duration: 900 + i * 60,
          yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
      }, this);

      this.styring = JaktaStyring.lag(this);
      this.strekkNo = 1;
      this.sistPaaGrunn = -1e9;   // tidsstempel, ikkje teljar — sjå update()
      this.sistHoppTrykt = -1e9;

      /* Ei diskret markering av kvar sonene er. Ho ligg i lerretet og
         ikkje i DOM, fordi ho skal skalere saman med spelflata. */
      const sh = H * JaktaStyring.SONE_HOGD;
      const g = this.add.graphics().setScrollFactor(0).setDepth(100);
      g.lineStyle(2, 0x1a1a1a, 0.18);
      g.strokeRect(0, H - sh, W / 3, sh);
      g.strokeRect(W / 3, H - sh, W / 3, sh);
      g.strokeRect(2 * W / 3, H - sh, W / 3, sh);
      [['←', W / 6], ['→', W / 2], ['HOPP', 5 * W / 6]].forEach(function (m) {
        this.add.text(m[1], H - sh / 2, m[0], {
          fontFamily: 'Andika, Verdana, sans-serif',
          fontSize: '34px', color: '#1a1a1a'
        }).setOrigin(0.5).setAlpha(0.28).setScrollFactor(0).setDepth(100);
      }, this);

      /* Måletal vi treng på iPad. Lesne ut av testane, ikkje vist. */
      root.JaktaProve = { scene: this, fps: 0 };
      this.time.addEvent({
        delay: 500, loop: true,
        callback: function () { root.JaktaProve.fps = Math.round(this.game.loop.actualFps); },
        callbackScope: this
      });
    },

    update: function (tid, delta) {
      const s = this.spelar;
      if (!s) return;
      const inn = this.styring.les();
      const paaBakken = s.body.blocked.down;

      /* ── Vassrett ── */
      const fart = 300;
      if (inn.venstre && !inn.hogre) { s.setVelocityX(-fart); s.setFlipX(true); }
      else if (inn.hogre && !inn.venstre) { s.setVelocityX(fart); s.setFlipX(false); }
      else s.setVelocityX(0);

      /* ── Tilgjeving ──
         Desse to er ikkje pynt for målgruppa. Ein seksåring trykkjer
         hopp for seint når han når kanten, og for tidleg når han er på
         veg ned. Utan dei kjennest spelet ustyrleg, og feilen ser ut til
         å vere hans.

         TIDSSTEMPEL, IKKJE AKKUMULERT DELTA. Å trekkje delta frå ein
         teljar kvar ramme gjev eit vindauge som krympar og veks med
         bildefrekvensen: fell han til 30 fps på ein eldre iPad, blir
         110 ms plutseleg til noko heilt anna. Eit tidsstempel er det
         same talet uansett kor mange rammer som gjekk. */
      if (paaBakken) this.sistPaaGrunn = tid;
      if (inn.hoppTrykt) this.sistHoppTrykt = tid;

      const kanHoppe = (tid - (this.sistPaaGrunn || -1e9)) <= COYOTE_MS;
      const villeHoppe = (tid - (this.sistHoppTrykt || -1e9)) <= BUFFER_MS;

      if (kanHoppe && villeHoppe) {
        s.setVelocityY(-HOPPKRAFT);
        /* Begge må brukast opp, elles hoppar figuren igjen neste ramme. */
        this.sistPaaGrunn = -1e9;
        this.sistHoppTrykt = -1e9;
      }

      /* Slepper eleven hoppknappen tidleg, blir hoppet lågare. Gjev
         kontroll utan at nokon treng å lære seg noko. */
      if (!inn.hopp && s.body.velocity.y < -180) s.setVelocityY(-180);

      /* ── Sprett ──
         Kenney har ingen gangesyklus, så rørsla må lagast av forma:
         strekk i lufta, squash på bakken.

         Effekten gongar med BASE_SKALA i staden for å setje scaleY
         direkte. Set han direkte, overskriv han skalaen sprita blei
         sett opp med, fysikk-kroppen endrar storleik under føtene på
         figuren, og han blir pressa ned i bakken — hoppet såg ut til å
         vere på fire piksel. Det tok ei stund å finne. */
      const strekk = paaBakken ? 1 : 1.07;
      this.strekkNo = this.strekkNo + (strekk - this.strekkNo) * 0.2;
      s.setScale(BASE_SKALA / this.strekkNo, BASE_SKALA * this.strekkNo);

      /* ── Ingen død ──
         Fell figuren ut, kjem han opp att på siste faste grunn. Ingen
         liv, ingen «prøv igjen», ingenting tapt. */
      if (paaBakken) { this.trygg = { x: s.x, y: s.y }; }
      if (s.y > RUTER_HOG * FLIS + 160) {
        const t = this.trygg || { x: 2 * FLIS, y: RUTER_HOG * FLIS - 3 * FLIS };
        s.setPosition(t.x, t.y - FLIS);
        s.setVelocity(0, 0);
      }
    },

    shutdown: function () {
      if (this.styring) this.styring.riv();
    }
  };

  /* ──────────────── Oppstart ──────────────── */

  function start() {
    if (typeof Phaser === 'undefined') {
      feil('Spelmotoren blei ikkje lasta. Er du på nett?');
      return;
    }
    /* Fonten FØRST, spelet etterpå. Bokstavglyfane blir brende inn i ein
       tekstur éin gong, og gjer vi det før Andika er klar, står feil
       bokstavformer der resten av økta — utan at nokon oppdagar det,
       sidan fonten ser rett ut overalt elles i appen. */
    JaktaGlyfar.ready().then(function (harAndika) {
      if (!harAndika) {
        console.info('[Bokstavjakta] Andika er ikkje tilgjengeleg; bokstavane brukar fallback-fonten.');
      }
      lagSpel();
    });
  }

  function lagSpel() {
    const config = {
      type: Phaser.AUTO,
      parent: 'jakta-canvas',
      width: RUTER_BREI * FLIS,
      height: RUTER_HOG * FLIS,
      backgroundColor: '#f4f1ea',
      /* LjodAudio eig lyden. Sjå toppen av fila. */
      audio: { noAudio: true },
      banner: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      render: {
        antialias: true,
        roundPixels: true,
        powerPreference: 'low-power'
      },
      /* Ein iPad Pro melder 3. Ni gonger så mange pikslar per ramme for
         ein skilnad ingen ser. */
      resolution: Math.min(2, root.devicePixelRatio || 1),
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 1500 }, debug: false }
      },
      scene: [Lasting, Prove]
    };

    game = new Phaser.Game(config);
    root.JaktaGame = game;

    /* Mistar vi WebGL-konteksten — det skjer på iPad når fana har vore
       i bakgrunnen lenge — skal eleven få vite det, ikkje sjå ein svart
       firkant. */
    const cv = document.querySelector('#jakta-canvas canvas');
    if (cv) {
      cv.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        feil('Grafikken stoppa. Last sida på nytt for å halde fram.');
      });
    }
  }

  root.JaktaBoot = { start: start, FLIS: FLIS, RUTER_BREI: RUTER_BREI, RUTER_HOG: RUTER_HOG };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);
