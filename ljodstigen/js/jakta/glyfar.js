/* ══════════════════════════════════════════════
   GLYFAR.JS — Bokstavane som tekstur

   Kenney-pakkane har handteikna SIFFER, men ikkje ein einaste bokstav.
   Bokstavane må vi lage sjølve — og dei skal vere Andika, ikkje ein
   scribble-font som matchar kunststilen. Heile grunnen til at Andika kom
   inn var at bokstavformene må vere pedagogisk rette; ein handteikna
   bokstav ville vore feil av nøyaktig same grunn som Segoe UI var det.
   Reine glyfar på ein skisseaktig sokkel er eit medvite stilbrot.

   Vi rendrar alle 29 éin gong til ein tekstur i staden for å bruke
   Phaser sin add.text() per bokstav: teksturen blir laga ferdig, og
   spelet slepp tekst-rendring midt i ei ramme.

   KRITISK: vent på document.fonts.ready før dette køyrer. Rendrar vi før
   Andika er lasta, brenner vi Verdana-glyfar inn i teksturen — og det
   blir aldri oppdaga, fordi fonten ser rett ut overalt elles i appen.
   ══════════════════════════════════════════════ */
(function (root) {
  'use strict';

  const CELL = 128;          // same rutenett som Kenney-sprita
  const KEY = 'glyfar';

  /* Storleiken er sett etter versalhøgda, ikkje etter cellene: bokstavar
     med underlengd (g, j, p, y) skal ikkje bli mindre enn resten berre
     fordi dei stikk under grunnlinja. */
  const FONT_PX = 82;

  function font() {
    /* Same stakk som resten av appen. Fell Andika bort, er Verdana
       framleis til å skilje I frå l — sjå css/style.css. */
    return FONT_PX + 'px Andika, Verdana, Geneva, sans-serif';
  }

  /**
   * Teiknar alle bokstavane til eit lerret og returnerer
   * { canvas, frames } der frames er { ch: {x,y,w,h} }.
   * @param opts { upper:bool, colour:string }
   */
  function draw(opts) {
    opts = opts || {};
    const letters = LjodLetters.ALPHABET;
    const cols = 8;
    const rows = Math.ceil(letters.length / cols);

    const cv = document.createElement('canvas');
    cv.width = cols * CELL;
    cv.height = rows * CELL;
    const g = cv.getContext('2d');

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font();

    const frames = {};
    letters.forEach(function (ch, i) {
      const cx = (i % cols) * CELL;
      const cy = Math.floor(i / cols) * CELL;
      const glyph = opts.upper ? LjodLetters.get(ch).up : ch;

      /* Kontur under fyllet, så bokstaven held seg lesbar uansett kva
         han ligg oppå — himmel, stein eller ein farga sokkel. */
      g.lineWidth = 10;
      g.lineJoin = 'round';
      g.strokeStyle = '#1a1a1a';
      g.strokeText(glyph, cx + CELL / 2, cy + CELL / 2);
      g.fillStyle = opts.colour || '#ffffff';
      g.fillText(glyph, cx + CELL / 2, cy + CELL / 2);

      frames[ch] = { x: cx, y: cy, w: CELL, h: CELL };
    });

    return { canvas: cv, frames: frames, cell: CELL };
  }

  /**
   * Legg glyfane inn som ein Phaser-tekstur med namngjevne rammer.
   * Rammenamnet er sjølve bokstaven, så `sprite.setFrame('s')` verkar.
   */
  function addToPhaser(scene, key, opts) {
    key = key || KEY;
    const made = draw(opts);
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.addCanvas(key, made.canvas);
    Object.keys(made.frames).forEach(function (ch) {
      const f = made.frames[ch];
      tex.add(ch, 0, f.x, f.y, f.w, f.h);
    });
    return key;
  }

  /** Har nettlesaren faktisk Andika, eller fell vi tilbake? */
  function andikaKlar() {
    try { return document.fonts.check('16px Andika'); } catch (e) { return false; }
  }

  /**
   * Ventar til Andika faktisk er tilgjengeleg. Resolvar med true/false.
   *
   * `document.fonts.ready` åleine er IKKJE nok, og det er ei felle som
   * ser ut som om ho verkar: lovnaden løyser seg når dei *ventande*
   * fontlastingane er ferdige. Ein font som ingen har bede om enno er
   * ikkje ventande — og <link rel="preload"> hentar fila utan å melde
   * henne inn i FontFaceSet. Så `ready` løyser seg med ein gong, `check`
   * svarar false, og vi brenner fallback-fonten inn i teksturen for godt.
   *
   * `document.fonts.load()` ber eksplisitt om fonten og resolvar først
   * når han er klar til bruk. Storleiken i strengen må vere sett, elles
   * matchar ikkje førespurnaden noka @font-face-regel.
   */
  function ready() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
    /* Berre Andika i førespurnaden, ikkje heile fallback-stakken:
       load() ville elles prøvd å laste systemfontane òg. */
    return document.fonts.load(FONT_PX + 'px Andika', 'Ss')
      .then(function () { return document.fonts.ready; })
      .then(function () { return andikaKlar(); })
      .catch(function () { return false; });
  }

  root.JaktaGlyfar = {
    CELL: CELL, KEY: KEY,
    draw: draw, addToPhaser: addToPhaser,
    ready: ready, andikaKlar: andikaKlar
  };
})(window);
