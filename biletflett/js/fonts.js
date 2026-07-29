/* ══════════════════════════════════════
   FONTS.JS — Skrifttypar for BiletFlett
   Fontfilene ligg lokalt i biletflett/fonts/ (woff2, SIL Open Font License).
   Ingen CDN, ingen eksterne kall — verktøyet fungerer offline.

   Canvas teiknar ikkje med ein font før han er ferdig lasta, så app.js
   ventar på Fonts.load() før første render.
   ══════════════════════════════════════ */

const Fonts = (() => {

    const DIR = 'fonts/';

    /* Kvar face får eit vekt-INTERVALL i staden for éi vekt. Då finn
       nettlesaren alltid ein eksakt treff, og lagar aldri syntetisk feit
       tekst av display-fontane (som alt er tunge i utgangspunktet). */
    const FACES = [
        { family: 'Baloo 2',       weight: '500 900', file: 'baloo-2-latin-700-normal.woff2' },
        { family: 'Bebas Neue',    weight: '100 900', file: 'bebas-neue-latin-400-normal.woff2' },
        { family: 'Archivo Black', weight: '100 900', file: 'archivo-black-latin-400-normal.woff2' },
        { family: 'Fraunces',      weight: '500 900', file: 'fraunces-latin-700-normal.woff2' },
        { family: 'Nunito',        weight: '100 500', file: 'nunito-latin-400-normal.woff2' },
        { family: 'Nunito',        weight: '600 900', file: 'nunito-latin-700-normal.woff2' }
    ];

    /* Skrifttype-stablar. Systemfontane står att som reserve, slik at
       malane framleis teiknar lesbart om ei fontfil manglar. */
    const stack = {
        play:   "'Baloo 2', 'Trebuchet MS', system-ui, sans-serif",
        bold:   "'Archivo Black', 'Arial Black', system-ui, sans-serif",
        impact: "'Bebas Neue', Impact, 'Haettenschweiler', sans-serif",
        serif:  "'Fraunces', Georgia, 'Times New Roman', serif",
        body:   "'Nunito', 'Trebuchet MS', system-ui, sans-serif"
    };

    /* Naturleg vekt per stabel. Bebas Neue og Archivo Black er alt tunge
       og skal teiknast på 400; dei runde og seriffe treng 700 for tyngd. */
    const WEIGHTS = [
        [stack.impact, 400],
        [stack.bold,   400],
        [stack.play,   700],
        [stack.serif,  700],
        [stack.body,   400]
    ];

    function weightFor(fontStack) {
        const hit = WEIGHTS.find(w => w[0] === fontStack);
        return hit ? hit[1] : 700;
    }

    let pending = null;

    function load() {
        if (pending) return pending;
        if (!('FontFace' in window) || !document.fonts) {
            pending = Promise.resolve();
            return pending;
        }
        const jobs = FACES.map(f => {
            const face = new FontFace(f.family, `url(${DIR}${f.file}) format('woff2')`, {
                weight: f.weight, style: 'normal', display: 'swap'
            });
            return face.load()
                .then(loaded => { document.fonts.add(loaded); })
                .catch(() => { /* reservefonten i stabelen tek over */ });
        });
        pending = Promise.all(jobs).then(() => document.fonts.ready).then(() => undefined);
        return pending;
    }

    return { load, stack, weightFor };
})();
