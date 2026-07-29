/* ══════════════════════════════════════
   TEMPLATES.JS — Data-drivne maldefinisjonar for BiletFlett
   Alle posisjonar er normaliserte (0..1) i høve til lerretet,
   så malane skalerer fritt mellom portrett/landskap/kvadrat.

   Fargar er Open Color-token ('green.7') eller paletnøklar
   ('accent', 'ink', …) — sjå js/palette.js. Rå hex er framleis lov
   der ein mal treng ein heilt bestemt farge, t.d. dei mørke
   festbakgrunnane som ligg utanfor Open Color-skalaen.

   Mal-skjema:
   {
     id, name, category: 'standard' | 'tema' | 'ungdom',
     orientation: 'portrait' | 'landscape' | 'square',
     palette: { bg, ink, accent, accent2, accent3 },
     background: { type:'solid'|'gradient'|'pattern', ... },   // valfri (default palette.bg)
     decor:  [ { type, layer:'back'|'front', ... } ],          // canvas-teikna pynt
     texts:  [ { id, x, y, w, text, size, font, color, align, weight, rotation, stroke, strokeW, shadow, bg } ],
     slots:  [ { x, y, w, h, frame:'plain'|'rounded'|'circle'|'polaroid', rotation, shadow } ]
   }
   ══════════════════════════════════════ */

const Templates = (() => {

    /* ---- Skrifttype-stablar (sjå js/fonts.js — lokale woff2-filer) ---- */
    const F = Fonts.stack;

    /* ---- Kortform for palettbygging ---- */
    const P = Palette.build;

    /* ---- Hjelpar: byggjer eit reint rutenett av slots ---- */
    function grid(cols, rows, m, g, frame) {
        m = m == null ? 0.045 : m;   // ytre marg
        g = g == null ? 0.025 : g;   // mellomrom
        const slots = [];
        const w = (1 - 2 * m - g * (cols - 1)) / cols;
        const h = (1 - 2 * m - g * (rows - 1)) / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                slots.push({
                    x: m + c * (w + g),
                    y: m + r * (h + g),
                    w, h,
                    frame: frame || 'plain'
                });
            }
        }
        return slots;
    }

    /* ════════ 8 STANDARD-OPPSETT (reine, utan pynt) ════════ */
    const NEUTRAL = P('white', 'gray.9', 'gray.7', 'gray.6', 'gray.3');

    const standard = [
        { id: 'std-2x2', name: '2×2 rutenett', category: 'standard', orientation: 'portrait',
          palette: NEUTRAL, slots: grid(2, 2) },
        { id: 'std-2x3', name: '2×3 rutenett', category: 'standard', orientation: 'portrait',
          palette: NEUTRAL, slots: grid(2, 3) },
        { id: 'std-3x3', name: '3×3 rutenett', category: 'standard', orientation: 'portrait',
          palette: NEUTRAL, slots: grid(3, 3) },
        { id: 'std-big2', name: 'Stor + 2 små', category: 'standard', orientation: 'portrait',
          palette: NEUTRAL, slots: [
            { x: 0.05, y: 0.05, w: 0.90, h: 0.55, frame: 'plain' },
            { x: 0.05, y: 0.63, w: 0.435, h: 0.32, frame: 'plain' },
            { x: 0.515, y: 0.63, w: 0.435, h: 0.32, frame: 'plain' }
          ] },
        { id: 'std-magasin', name: 'Magasin (1 stor + 3)', category: 'standard', orientation: 'landscape',
          palette: NEUTRAL, slots: [
            { x: 0.04, y: 0.05, w: 0.56, h: 0.90, frame: 'plain' },
            { x: 0.63, y: 0.05, w: 0.33, h: 0.283, frame: 'plain' },
            { x: 0.63, y: 0.358, w: 0.33, h: 0.283, frame: 'plain' },
            { x: 0.63, y: 0.666, w: 0.33, h: 0.284, frame: 'plain' }
          ] },
        { id: 'std-panorama', name: 'Panorama-stripe', category: 'standard', orientation: 'portrait',
          palette: NEUTRAL, slots: [
            { x: 0.05, y: 0.06, w: 0.90, h: 0.28, frame: 'plain' },
            { x: 0.05, y: 0.37, w: 0.90, h: 0.28, frame: 'plain' },
            { x: 0.05, y: 0.68, w: 0.90, h: 0.28, frame: 'plain' }
          ] },
        { id: 'std-enkelt', name: 'Eitt bilete', category: 'standard', orientation: 'portrait',
          palette: NEUTRAL, slots: [{ x: 0.06, y: 0.06, w: 0.88, h: 0.88, frame: 'plain' }] },
        { id: 'std-duo', name: 'To side om side', category: 'standard', orientation: 'landscape',
          palette: NEUTRAL, slots: [
            { x: 0.04, y: 0.06, w: 0.45, h: 0.88, frame: 'plain' },
            { x: 0.51, y: 0.06, w: 0.45, h: 0.88, frame: 'plain' }
          ] }
    ];

    /* ════════ 20 TEMA-MALAR (sprek, med redigerbar tekst) ════════ */
    const tema = [

        /* 1 — Tur til skogen */
        { id: 'tur-skog', name: 'Tur til skogen', category: 'tema', orientation: 'portrait',
          palette: P('lime.0', 'green.9', 'green.8', 'orange.9', 'lime.3'),
          background: { type: 'gradient', from: 'lime.0', to: 'green.1', layers: [
            { type: 'hillStack', colors: ['lime.2', 'green.3', 'green.5'], h: 0.46, alpha: 0.9, seed: 4 }
          ] },
          decor: [
            { type: 'glyph', layer: 'back', name: 'sun', x: 0.84, y: 0.12, size: 0.15, color: 'yellow.6', weight: 2.2 },
            { type: 'glyphScatter', layer: 'front', names: ['leaf', 'treePine', 'footprints'],
              count: 9, colors: ['green.8', 'orange.9', 'lime.7'], min: 0.045, max: 0.075, alpha: 0.85 },
            { type: 'frame', variant: 'tape-corners', color: 'orange.9' }
          ],
          texts: [
            { id: 'title', x: 0.08, y: 0.085, w: 0.84, text: 'Tur til skogen', size: 0.10, font: F.play, color: 'ink', align: 'center', rotation: -2 },
            { id: 'date', x: 0.08, y: 0.20, w: 0.84, text: 'Dato og stad', size: 0.038, font: F.body, color: 'accent', align: 'center' }
          ],
          slots: [
            { x: 0.10, y: 0.27, w: 0.50, h: 0.30, frame: 'polaroid', rotation: -3 },
            { x: 0.46, y: 0.40, w: 0.45, h: 0.27, frame: 'polaroid', rotation: 3 },
            { x: 0.13, y: 0.62, w: 0.48, h: 0.30, frame: 'polaroid', rotation: 2 },
            { x: 0.52, y: 0.66, w: 0.40, h: 0.26, frame: 'polaroid', rotation: -2 }
          ] },

        /* 2 — På tur: dagsoppsummering (tidslinje med bilettekst) */
        { id: 'tur-dagsoppsummering', name: 'Dagsoppsummering', category: 'tema', orientation: 'portrait',
          palette: P('orange.0', 'gray.9', 'orange.8', 'cyan.8', 'yellow.4'),
          background: { type: 'solid', color: 'orange.0', layers: [
            { type: 'patternTile', kind: 'plus', color: 'orange.2', scale: 0.055, alpha: 0.5 }
          ] },
          decor: [
            { type: 'ribbonBanner', x: 0.06, y: 0.05, w: 0.88, h: 0.10, color: 'accent' },
            { type: 'timeline', x: 0.20, color: 'accent' },
            { type: 'frame', variant: 'solid', color: 'ink' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.063, w: 0.88, text: 'Dagen vår', size: 0.07, font: F.bold, color: 'white', align: 'center' },
            { id: 'cap1', x: 0.30, y: 0.20, w: 0.62, text: 'Først …', size: 0.034, font: F.body, color: 'ink', align: 'left' },
            { id: 'cap2', x: 0.30, y: 0.40, w: 0.62, text: 'Så …', size: 0.034, font: F.body, color: 'ink', align: 'left' },
            { id: 'cap3', x: 0.30, y: 0.60, w: 0.62, text: 'Etterpå …', size: 0.034, font: F.body, color: 'ink', align: 'left' },
            { id: 'cap4', x: 0.30, y: 0.80, w: 0.62, text: 'Til slutt …', size: 0.034, font: F.body, color: 'ink', align: 'left' }
          ],
          slots: [
            { x: 0.06, y: 0.18, w: 0.20, h: 0.16, frame: 'rounded' },
            { x: 0.06, y: 0.38, w: 0.20, h: 0.16, frame: 'rounded' },
            { x: 0.06, y: 0.58, w: 0.20, h: 0.16, frame: 'rounded' },
            { x: 0.06, y: 0.78, w: 0.20, h: 0.16, frame: 'rounded' }
          ] },

        /* 3 — Strandtur / sommartur */
        { id: 'tur-strand', name: 'Strandtur', category: 'tema', orientation: 'landscape',
          palette: P('cyan.0', 'cyan.9', 'cyan.7', 'yellow.5', 'orange.4'),
          background: { type: 'gradient', from: 'cyan.1', to: 'yellow.0', layers: [
            { type: 'waveStack', colors: ['cyan.2', 'cyan.4', 'cyan.6'], h: 0.5, alpha: 0.95 }
          ] },
          decor: [
            { type: 'glyph', layer: 'back', name: 'sun', x: 0.93, y: 0.13, size: 0.10, color: 'yellow.6', weight: 2.2 },
            { type: 'glyphScatter', layer: 'front', names: ['shell', 'sailboat', 'umbrella'],
              count: 6, colors: ['cyan.8', 'orange.5', 'yellow.7'], min: 0.04, max: 0.065, alpha: 0.9 },
            { type: 'frame', variant: 'double', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'Sommar ved sjøen', size: 0.085, font: F.play, color: 'ink', align: 'center', rotation: -1 }
          ],
          slots: [
            { x: 0.08, y: 0.27, w: 0.40, h: 0.42, frame: 'polaroid', rotation: -3 },
            { x: 0.52, y: 0.24, w: 0.40, h: 0.34, frame: 'polaroid', rotation: 2 },
            { x: 0.56, y: 0.55, w: 0.34, h: 0.30, frame: 'polaroid', rotation: -2 }
          ] },

        /* 4 — Fjelltur */
        { id: 'tur-fjell', name: 'Fjelltur', category: 'tema', orientation: 'portrait',
          palette: P('gray.1', 'gray.9', 'blue.8', 'gray.5', 'orange.6'),
          background: { type: 'gradient', from: 'gray.1', to: 'blue.2', layers: [
            { type: 'peaks', colors: ['gray.3', 'blue.4', 'blue.7'], h: 0.52, seed: 9 }
          ] },
          decor: [
            { type: 'glyph', layer: 'back', name: 'cloudSun', x: 0.80, y: 0.14, size: 0.14, color: 'gray.6', weight: 2 },
            { type: 'glyph', layer: 'front', name: 'backpack', x: 0.10, y: 0.945, size: 0.09, color: 'orange.6', rotation: -8 },
            { type: 'glyph', layer: 'front', name: 'compass', x: 0.90, y: 0.945, size: 0.09, color: 'blue.8', rotation: 8 },
            { type: 'frame', variant: 'solid', color: 'ink' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'På toppen!', size: 0.11, font: F.impact, color: 'ink', align: 'center' },
            { id: 'sub', x: 0.06, y: 0.205, w: 0.88, text: 'Kor høgt kom vi?', size: 0.04, font: F.body, color: 'accent', align: 'center' }
          ],
          slots: [
            { x: 0.10, y: 0.30, w: 0.80, h: 0.34, frame: 'rounded' },
            { x: 0.10, y: 0.67, w: 0.385, h: 0.26, frame: 'rounded' },
            { x: 0.515, y: 0.67, w: 0.385, h: 0.26, frame: 'rounded' }
          ] },

        /* 5 — Gardsbesøk / dyr */
        { id: 'tur-gard', name: 'Gardsbesøk', category: 'tema', orientation: 'portrait',
          palette: P('yellow.0', 'orange.9', 'red.8', 'lime.8', 'yellow.5'),
          background: { type: 'solid', color: 'yellow.0', layers: [
            { type: 'blobField', colors: ['yellow.1', 'lime.1'], count: 3, alpha: 0.75, seed: 12 }
          ] },
          decor: [
            { type: 'grass', layer: 'back', color: 'lime.7', h: 0.16 },
            { type: 'polkaDots', layer: 'back', count: 26, color: 'yellow.3', r: 0.012 },
            { type: 'glyphScatter', layer: 'front', names: ['wheat', 'egg', 'bird'],
              count: 7, colors: ['orange.8', 'red.7', 'lime.8'], min: 0.045, max: 0.07, alpha: 0.9 },
            { type: 'frame', variant: 'scallop', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'På garden', size: 0.10, font: F.play, color: 'accent', align: 'center', rotation: -2 }
          ],
          slots: [
            { x: 0.09, y: 0.24, w: 0.40, h: 0.32, frame: 'polaroid', rotation: -3 },
            { x: 0.52, y: 0.24, w: 0.40, h: 0.32, frame: 'polaroid', rotation: 3 },
            { x: 0.30, y: 0.55, w: 0.42, h: 0.32, frame: 'polaroid', rotation: 1 }
          ] },

        /* 6 — Bursdag i barnehagen */
        { id: 'bursdag-barnehage', name: 'Bursdag i barnehagen', category: 'tema', orientation: 'portrait',
          palette: P('pink.0', 'pink.9', 'pink.6', 'blue.5', 'yellow.4'),
          background: { type: 'gradient', from: 'pink.0', to: 'pink.1', layers: [
            { type: 'blobField', colors: ['pink.2', 'blue.1', 'yellow.1'], count: 4, alpha: 0.6, seed: 5 }
          ] },
          decor: [
            { type: 'bunting', layer: 'back', y: 0.045, colors: ['pink.6', 'blue.5', 'yellow.4', 'green.5'] },
            { type: 'confetti', layer: 'back', count: 60, colors: ['pink.4', 'blue.3', 'yellow.3', 'green.3'] },
            { type: 'glyph', layer: 'front', name: 'cake', x: 0.13, y: 0.40, size: 0.13, color: 'pink.7', rotation: -8 },
            { type: 'glyph', layer: 'front', name: 'gift', x: 0.87, y: 0.42, size: 0.12, color: 'blue.6', rotation: 8 },
            { type: 'glyph', layer: 'front', name: 'partyPopper', x: 0.86, y: 0.88, size: 0.11, color: 'yellow.7' },
            { type: 'frame', variant: 'solid', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.10, y: 0.12, w: 0.80, text: 'Gratulerer med dagen!', size: 0.082, font: F.play, color: 'white', align: 'center', rotation: -2, bg: { color: 'accent', pad: 0.02 } },
            { id: 'name', x: 0.10, y: 0.62, w: 0.80, text: 'Namn', size: 0.075, font: F.bold, color: 'ink', align: 'center' },
            { id: 'age', x: 0.10, y: 0.72, w: 0.80, text: 'blir 4 år', size: 0.05, font: F.body, color: 'accent', align: 'center' }
          ],
          slots: [
            { x: 0.24, y: 0.27, w: 0.52, h: 0.33, frame: 'circle' }
          ] },

        /* 7 — Bursdagsbarnet (krone) */
        { id: 'bursdag-krone', name: 'Bursdagsbarnet', category: 'tema', orientation: 'portrait',
          palette: P('yellow.0', 'orange.9', 'yellow.7', 'red.7', 'violet.6'),
          background: { type: 'gradient', from: 'yellow.0', to: 'yellow.2', layers: [
            { type: 'blobField', colors: ['yellow.2', 'orange.1'], count: 3, alpha: 0.7, seed: 17 }
          ] },
          decor: [
            { type: 'sparkles', layer: 'back', count: 22, color: 'yellow.4' },
            { type: 'glyph', layer: 'front', name: 'crown', x: 0.5, y: 0.245, size: 0.20, color: 'yellow.7', weight: 2.2 },
            { type: 'glyphScatter', layer: 'front', names: ['star', 'sparkle'],
              count: 10, colors: ['red.6', 'violet.5', 'yellow.6'], min: 0.035, max: 0.055, alpha: 0.9 },
            { type: 'frame', variant: 'double', color: 'accent' }
          ],
          texts: [
            { id: 'age', x: 0.10, y: 0.60, w: 0.80, text: '4 år i dag', size: 0.12, font: F.impact, color: 'accent2', align: 'center' },
            { id: 'name', x: 0.10, y: 0.78, w: 0.80, text: 'Bursdagsbarnet', size: 0.06, font: F.play, color: 'ink', align: 'center' }
          ],
          slots: [
            { x: 0.27, y: 0.30, w: 0.46, h: 0.28, frame: 'circle' }
          ] },

        /* 8 — Bursdagsinvitasjon */
        { id: 'bursdag-invitasjon', name: 'Bursdagsinvitasjon', category: 'tema', orientation: 'portrait',
          palette: P('blue.0', 'blue.9', 'blue.7', 'red.6', 'yellow.5'),
          background: { type: 'solid', color: 'blue.0', layers: [
            { type: 'blobField', colors: ['blue.1', 'red.0'], count: 3, alpha: 0.8, seed: 21 }
          ] },
          decor: [
            { type: 'balloons', layer: 'back', x: 0.85, y: 0.20, colors: ['red.5', 'yellow.4', 'blue.5'] },
            { type: 'confetti', layer: 'back', count: 36, colors: ['blue.3', 'red.3', 'yellow.3'] },
            { type: 'glyph', layer: 'front', name: 'mailOpen', x: 0.12, y: 0.90, size: 0.10, color: 'accent', rotation: -6 },
            { type: 'glyph', layer: 'front', name: 'cake', x: 0.88, y: 0.90, size: 0.10, color: 'accent2', rotation: 6 },
            { type: 'frame', variant: 'solid', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.08, y: 0.08, w: 0.84, text: 'Du er invitert!', size: 0.085, font: F.play, color: 'accent', align: 'center', rotation: -2 },
            { id: 'name', x: 0.08, y: 0.60, w: 0.84, text: 'til Namn sin bursdag', size: 0.05, font: F.bold, color: 'ink', align: 'center' },
            { id: 'when', x: 0.08, y: 0.70, w: 0.84, text: 'Når: laurdag kl. 14', size: 0.04, font: F.body, color: 'ink', align: 'center' },
            { id: 'where', x: 0.08, y: 0.78, w: 0.84, text: 'Stad: heime hos oss', size: 0.04, font: F.body, color: 'ink', align: 'center' }
          ],
          slots: [
            { x: 0.22, y: 0.21, w: 0.56, h: 0.34, frame: 'rounded' }
          ] },

        /* 9 — Karneval / fest (mørk bakgrunn utanfor Open Color-skalaen) */
        { id: 'fest-karneval', name: 'Karneval', category: 'tema', orientation: 'landscape',
          palette: P('#1b1140', 'white', 'pink.5', 'teal.4', 'yellow.4'),
          background: { type: 'gradient', from: '#2a1a5e', to: '#120a2e', layers: [
            { type: 'blobField', colors: ['#3a2472', '#4b2d8c'], count: 3, alpha: 0.55, seed: 8 }
          ] },
          decor: [
            { type: 'confetti', layer: 'back', count: 80, colors: ['pink.5', 'teal.4', 'yellow.4', 'violet.4'] },
            { type: 'glyphScatter', layer: 'front', names: ['sparkles', 'music', 'star'],
              count: 8, colors: ['yellow.4', 'teal.3', 'pink.4'], min: 0.035, max: 0.055, alpha: 0.95 },
            { type: 'frame', variant: 'double', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'Karneval!', size: 0.105, font: F.impact, color: 'accent3', align: 'center', rotation: -2, shadow: true }
          ],
          slots: [
            { x: 0.07, y: 0.30, w: 0.27, h: 0.58, frame: 'rounded', rotation: -3 },
            { x: 0.37, y: 0.26, w: 0.27, h: 0.62, frame: 'rounded', rotation: 2 },
            { x: 0.67, y: 0.30, w: 0.27, h: 0.58, frame: 'rounded', rotation: -2 }
          ] },

        /* 10 — Første skuledag (tavle + kritt) */
        { id: 'skule-forste-dag', name: 'Første skuledag', category: 'tema', orientation: 'portrait',
          palette: P('#2f4a40', 'white', 'gray.0', 'yellow.4', 'red.5'),
          background: { type: 'solid', color: '#2f4a40', layers: [
            { type: 'patternTile', kind: 'grid', color: 'white', scale: 0.06, alpha: 0.07 }
          ] },
          decor: [
            { type: 'frame', variant: 'solid', color: 'orange.9', width: 0.04 },
            { type: 'scribbles', layer: 'front', count: 6, color: 'gray.0' },
            { type: 'glyph', layer: 'front', name: 'graduationCap', x: 0.14, y: 0.90, size: 0.10, color: 'yellow.4', rotation: -8 },
            { type: 'glyph', layer: 'front', name: 'bookOpen', x: 0.86, y: 0.90, size: 0.10, color: 'gray.0', rotation: 6 }
          ],
          texts: [
            { id: 'title', x: 0.08, y: 0.08, w: 0.84, text: 'Mitt første skuleår', size: 0.08, font: F.play, color: 'gray.0', align: 'center' },
            { id: 'name', x: 0.08, y: 0.66, w: 0.84, text: 'Namn', size: 0.07, font: F.bold, color: 'accent2', align: 'center' },
            { id: 'class', x: 0.08, y: 0.76, w: 0.84, text: 'Klasse 1A', size: 0.045, font: F.body, color: 'gray.0', align: 'center' }
          ],
          slots: [
            { x: 0.24, y: 0.22, w: 0.52, h: 0.40, frame: 'rounded' }
          ] },

        /* 11 — Skuleåret oppsummert (9-rutes + merkelapp) */
        { id: 'skule-aaret', name: 'Skuleåret vårt', category: 'tema', orientation: 'portrait',
          palette: P('grape.0', 'grape.9', 'grape.7', 'green.7', 'yellow.6'),
          background: { type: 'solid', color: 'grape.0', layers: [
            { type: 'patternTile', kind: 'dots', color: 'grape.3', scale: 0.05, alpha: 0.45 }
          ] },
          decor: [
            { type: 'ribbonBanner', x: 0.06, y: 0.045, w: 0.88, h: 0.09, color: 'accent' },
            { type: 'frame', variant: 'solid', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.057, w: 0.88, text: 'Året vårt', size: 0.06, font: F.bold, color: 'white', align: 'center' }
          ],
          slots: grid(3, 3, 0.06, 0.02).map(s => ({ ...s, y: 0.17 + (s.y - 0.06) * 0.78, h: s.h * 0.78, frame: 'rounded' })) },

        /* 12 — Klassen vår / vennskap */
        { id: 'skule-klassen', name: 'Klassen vår', category: 'tema', orientation: 'landscape',
          palette: P('red.0', 'red.9', 'red.6', 'blue.6', 'yellow.5'),
          background: { type: 'gradient', from: 'red.0', to: 'red.1', layers: [
            { type: 'blobField', colors: ['red.1', 'blue.0'], count: 3, alpha: 0.75, seed: 14 }
          ] },
          decor: [
            { type: 'hearts', layer: 'front', count: 14, colors: ['red.5', 'orange.5', 'blue.4'] },
            { type: 'glyph', layer: 'front', name: 'users', x: 0.08, y: 0.90, size: 0.09, color: 'accent2', alpha: 0.9 },
            { type: 'frame', variant: 'scallop', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'Klassen vår', size: 0.10, font: F.play, color: 'accent', align: 'center', rotation: -1 }
          ],
          slots: grid(3, 2, 0.06, 0.025).map(s => ({ ...s, y: 0.26 + (s.y - 0.06) * 0.66, h: s.h * 0.78, frame: 'circle' })) },

        /* 13 — Tema-prosjekt (stor ramme) */
        { id: 'skule-prosjekt', name: 'Tema-prosjekt', category: 'tema', orientation: 'portrait',
          palette: P('cyan.0', 'cyan.9', 'cyan.7', 'orange.6', 'green.7'),
          background: { type: 'solid', color: 'cyan.0', layers: [
            { type: 'patternTile', kind: 'grid', color: 'cyan.3', scale: 0.05, alpha: 0.4 }
          ] },
          decor: [
            { type: 'polkaDots', layer: 'back', count: 30, color: 'cyan.1', r: 0.018 },
            { type: 'glyph', layer: 'front', name: 'lightbulb', x: 0.10, y: 0.92, size: 0.09, color: 'accent2', rotation: -6 },
            { type: 'glyph', layer: 'front', name: 'microscope', x: 0.90, y: 0.92, size: 0.09, color: 'accent3', rotation: 6 },
            { type: 'frame', variant: 'double', color: 'accent' }
          ],
          texts: [
            { id: 'label', x: 0.08, y: 0.08, w: 0.84, text: 'TEMA:', size: 0.045, font: F.bold, color: 'accent', align: 'center' },
            { id: 'title', x: 0.08, y: 0.12, w: 0.84, text: 'Skriv emnet her', size: 0.085, font: F.impact, color: 'ink', align: 'center' }
          ],
          slots: grid(2, 2, 0.08, 0.03).map(s => ({ ...s, y: 0.28 + (s.y - 0.08) * 0.66, h: s.h * 0.78, frame: 'rounded' })) },

        /* 14 — Haust */
        { id: 'aar-haust', name: 'Haust', category: 'tema', orientation: 'portrait',
          palette: P('orange.0', 'orange.9', 'orange.8', 'yellow.7', 'red.7'),
          background: { type: 'gradient', from: 'orange.0', to: 'orange.2', layers: [
            { type: 'hillStack', colors: ['orange.1', 'orange.3'], h: 0.4, alpha: 0.85, seed: 6 }
          ] },
          decor: [
            { type: 'glyphScatter', layer: 'back', names: ['leaf', 'apple', 'treeDeciduous'],
              count: 12, colors: ['orange.7', 'red.7', 'yellow.7'], min: 0.04, max: 0.075, alpha: 0.8 },
            { type: 'frame', variant: 'tape-corners', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'Haust', size: 0.11, font: F.serif, color: 'ink', align: 'center' }
          ],
          slots: [
            { x: 0.12, y: 0.24, w: 0.46, h: 0.32, frame: 'polaroid', rotation: -3 },
            { x: 0.46, y: 0.40, w: 0.42, h: 0.30, frame: 'polaroid', rotation: 3 },
            { x: 0.20, y: 0.64, w: 0.50, h: 0.30, frame: 'polaroid', rotation: 1 }
          ] },

        /* 15 — Vinter / snø */
        { id: 'aar-vinter', name: 'Vinterglede', category: 'tema', orientation: 'portrait',
          palette: P('blue.0', 'blue.9', 'blue.5', 'blue.2', 'white'),
          background: { type: 'gradient', from: 'blue.0', to: 'blue.2', layers: [
            { type: 'hillStack', colors: ['white', 'blue.2', 'blue.3'], h: 0.44, alpha: 0.95, seed: 3 }
          ] },
          decor: [
            { type: 'snow', layer: 'front', count: 60, color: 'white' },
            { type: 'glyphScatter', layer: 'back', names: ['snowflake'],
              count: 7, colors: ['blue.3', 'blue.4'], min: 0.05, max: 0.09, alpha: 0.75 },
            { type: 'frame', variant: 'double', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'Vinterglede', size: 0.09, font: F.play, color: 'ink', align: 'center', rotation: -1 }
          ],
          slots: [
            { x: 0.10, y: 0.25, w: 0.80, h: 0.32, frame: 'rounded' },
            { x: 0.10, y: 0.61, w: 0.385, h: 0.30, frame: 'rounded' },
            { x: 0.515, y: 0.61, w: 0.385, h: 0.30, frame: 'rounded' }
          ] },

        /* 16 — Vår */
        { id: 'aar-vaar', name: 'Vår', category: 'tema', orientation: 'portrait',
          palette: P('green.0', 'green.9', 'green.7', 'pink.5', 'yellow.5'),
          background: { type: 'gradient', from: 'green.0', to: 'green.1', layers: [
            { type: 'hillStack', colors: ['green.1', 'green.3', 'green.5'], h: 0.42, alpha: 0.9, seed: 15 }
          ] },
          decor: [
            { type: 'glyphScatter', layer: 'front', names: ['flower2', 'bird'],
              count: 9, colors: ['pink.5', 'yellow.6', 'grape.5'], min: 0.04, max: 0.065, alpha: 0.9 },
            { type: 'frame', variant: 'scallop', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'Vår i lufta', size: 0.10, font: F.play, color: 'ink', align: 'center', rotation: -2 }
          ],
          slots: [
            { x: 0.10, y: 0.25, w: 0.40, h: 0.32, frame: 'polaroid', rotation: -3 },
            { x: 0.52, y: 0.25, w: 0.40, h: 0.32, frame: 'polaroid', rotation: 3 },
            { x: 0.30, y: 0.55, w: 0.42, h: 0.30, frame: 'polaroid', rotation: 1 }
          ] },

        /* 17 — Feiring (17. mai — teikna vimplar, ingen flagg-emoji) */
        { id: 'fest-feiring', name: 'Feiring (17. mai)', category: 'tema', orientation: 'portrait',
          palette: P('white', 'indigo.9', 'red.9', 'indigo.9', 'gray.1'),
          background: { type: 'solid', color: 'white', layers: [
            { type: 'arcBands', corner: 'tr', colors: ['gray.1', 'white'], count: 8, width: 0.5, alpha: 0.9 }
          ] },
          decor: [
            { type: 'bunting', layer: 'back', y: 0.045, colors: ['red.9', 'white', 'indigo.9'] },
            { type: 'streamers', layer: 'front', colors: ['red.9', 'indigo.9'] },
            { type: 'glyph', layer: 'front', name: 'partyPopper', x: 0.12, y: 0.92, size: 0.10, color: 'accent', rotation: -10 },
            { type: 'frame', variant: 'double', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.08, y: 0.12, w: 0.84, text: 'Hurra for dagen!', size: 0.085, font: F.impact, color: 'accent', align: 'center' }
          ],
          slots: [
            { x: 0.10, y: 0.26, w: 0.80, h: 0.34, frame: 'rounded' },
            { x: 0.10, y: 0.63, w: 0.385, h: 0.28, frame: 'rounded' },
            { x: 0.515, y: 0.63, w: 0.385, h: 0.28, frame: 'rounded' }
          ] },

        /* 18 — Jul / advent */
        { id: 'fest-jul', name: 'God jul', category: 'tema', orientation: 'portrait',
          palette: P('#0f3d2e', 'white', 'red.8', 'green.8', 'yellow.5'),
          background: { type: 'gradient', from: '#124a37', to: '#0a2c20', layers: [
            { type: 'hillStack', colors: ['#14513c', '#1a6349'], h: 0.4, alpha: 0.85, seed: 19 }
          ] },
          decor: [
            { type: 'snow', layer: 'front', count: 50, color: 'white' },
            { type: 'glyphScatter', layer: 'back', names: ['treePine', 'gift', 'star'],
              count: 9, colors: ['green.5', 'red.5', 'yellow.4'], min: 0.04, max: 0.07, alpha: 0.7 },
            { type: 'frame', variant: 'double', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.08, w: 0.88, text: 'God jul', size: 0.11, font: F.serif, color: 'accent3', align: 'center' }
          ],
          slots: [
            { x: 0.24, y: 0.24, w: 0.52, h: 0.34, frame: 'circle' },
            { x: 0.12, y: 0.62, w: 0.36, h: 0.28, frame: 'rounded', rotation: -3 },
            { x: 0.52, y: 0.62, w: 0.36, h: 0.28, frame: 'rounded', rotation: 3 }
          ] },

        /* 19 — Påske */
        { id: 'fest-paaske', name: 'God påske', category: 'tema', orientation: 'portrait',
          palette: P('yellow.0', 'orange.9', 'yellow.6', 'green.5', 'pink.4'),
          background: { type: 'gradient', from: 'yellow.0', to: 'yellow.1', layers: [
            { type: 'blobField', colors: ['yellow.1', 'pink.1', 'green.1'], count: 4, alpha: 0.65, seed: 27 }
          ] },
          decor: [
            { type: 'polkaDots', layer: 'back', count: 30, color: 'pink.2', r: 0.014 },
            { type: 'glyphScatter', layer: 'front', names: ['egg', 'flower2', 'rabbit'],
              count: 8, colors: ['pink.5', 'green.6', 'yellow.7'], min: 0.04, max: 0.065, alpha: 0.9 },
            { type: 'frame', variant: 'scallop', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'God påske', size: 0.10, font: F.play, color: 'ink', align: 'center', rotation: -2 }
          ],
          slots: [
            { x: 0.10, y: 0.25, w: 0.40, h: 0.32, frame: 'polaroid', rotation: -3 },
            { x: 0.52, y: 0.25, w: 0.40, h: 0.32, frame: 'polaroid', rotation: 3 },
            { x: 0.30, y: 0.55, w: 0.42, h: 0.30, frame: 'polaroid', rotation: 1 }
          ] },

        /* 20 — Minnebok */
        { id: 'minnebok', name: 'Mine beste minne', category: 'tema', orientation: 'portrait',
          palette: P('gray.0', 'gray.9', 'orange.8', 'teal.8', 'yellow.6'),
          background: { type: 'pattern', kind: 'paper', color: 'orange.0', color2: 'orange.1', layers: [
            { type: 'patternTile', kind: 'cross', color: 'orange.2', scale: 0.07, alpha: 0.25 }
          ] },
          decor: [
            { type: 'tape', layer: 'front', items: [
                { x: 0.18, y: 0.24, rot: -18 }, { x: 0.74, y: 0.30, rot: 14 },
                { x: 0.30, y: 0.66, rot: 8 }, { x: 0.80, y: 0.70, rot: -10 } ], color: 'accent3' },
            { type: 'glyph', layer: 'front', name: 'camera', x: 0.12, y: 0.10, size: 0.09, color: 'accent2', rotation: -8 },
            { type: 'frame', variant: 'solid', color: 'ink' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.06, w: 0.88, text: 'Mine beste minne', size: 0.075, font: F.serif, color: 'ink', align: 'center' },
            { id: 'date', x: 0.55, y: 0.90, w: 0.40, text: 'Sommaren 2026', size: 0.035, font: F.body, color: 'accent', align: 'right', rotation: -3 }
          ],
          slots: [
            { x: 0.10, y: 0.22, w: 0.42, h: 0.30, frame: 'polaroid', rotation: -4 },
            { x: 0.52, y: 0.26, w: 0.40, h: 0.28, frame: 'polaroid', rotation: 5 },
            { x: 0.14, y: 0.60, w: 0.40, h: 0.28, frame: 'polaroid', rotation: 3 },
            { x: 0.54, y: 0.62, w: 0.38, h: 0.26, frame: 'polaroid', rotation: -3 }
          ] }
    ];

    /* ════════ 6 MALAR FOR UNGDOMSSTEGET ════════
       Same motor, anna uttrykk: geometriske botnlag i staden for
       organiske, stram typografi (Bebas Neue / Archivo Black), dempa
       palettar med éin sterk aksent, og rutenett utan skeive polaroid-
       rammer. Meint for elevar som synest tema-malane blir barnslege. */
    const ungdom = [

        /* 1 — Prosjektframsyning */
        { id: 'ung-prosjekt', name: 'Prosjekt', category: 'ungdom', orientation: 'portrait',
          palette: P('gray.0', 'gray.9', 'indigo.7', 'gray.6', 'gray.2'),
          background: { type: 'solid', color: 'gray.0', layers: [
            { type: 'diagonalBands', colors: ['gray.2'], angle: -28, count: 7, ratio: 0.55, alpha: 0.9 },
            { type: 'arcBands', corner: 'tr', colors: ['indigo.2'], count: 5, width: 0.4, alpha: 0.7 }
          ] },
          decor: [
            { type: 'frame', variant: 'solid', color: 'ink', width: 0.012 }
          ],
          texts: [
            { id: 'label', x: 0.08, y: 0.075, w: 0.84, text: 'PROSJEKT', size: 0.032, font: F.body, weight: 700, color: 'accent', align: 'left' },
            { id: 'title', x: 0.08, y: 0.115, w: 0.84, text: 'Tittel på prosjektet', size: 0.078, font: F.impact, color: 'ink', align: 'left' },
            { id: 'sub', x: 0.08, y: 0.925, w: 0.84, text: 'Namn · Klasse · 2026', size: 0.030, font: F.body, color: 'accent2', align: 'left' }
          ],
          slots: grid(2, 2, 0.08, 0.028).map(s => ({ ...s, y: 0.245 + (s.y - 0.08) * 0.80, h: s.h * 0.80, frame: 'rounded' })) },

        /* 2 — Tidslinje */
        { id: 'ung-tidslinje', name: 'Tidslinje', category: 'ungdom', orientation: 'portrait',
          palette: P('gray.0', 'gray.9', 'teal.8', 'gray.6', 'gray.2'),
          background: { type: 'solid', color: 'gray.0', layers: [
            { type: 'patternTile', kind: 'grid', color: 'gray.4', scale: 0.042, alpha: 0.3 },
            { type: 'arcBands', corner: 'bl', colors: ['teal.1'], count: 9, width: 0.22, alpha: 0.4 }
          ] },
          decor: [
            { type: 'timeline', x: 0.22, color: 'accent' },
            { type: 'frame', variant: 'solid', color: 'ink', width: 0.012 }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.06, w: 0.88, text: 'TIDSLINJE', size: 0.075, font: F.impact, color: 'ink', align: 'left' },
            { id: 'cap1', x: 0.32, y: 0.225, w: 0.60, text: 'Hending 1 …', size: 0.032, font: F.body, color: 'ink', align: 'left' },
            { id: 'cap2', x: 0.32, y: 0.425, w: 0.60, text: 'Hending 2 …', size: 0.032, font: F.body, color: 'ink', align: 'left' },
            { id: 'cap3', x: 0.32, y: 0.625, w: 0.60, text: 'Hending 3 …', size: 0.032, font: F.body, color: 'ink', align: 'left' },
            { id: 'cap4', x: 0.32, y: 0.825, w: 0.60, text: 'Hending 4 …', size: 0.032, font: F.body, color: 'ink', align: 'left' }
          ],
          slots: [
            { x: 0.07, y: 0.205, w: 0.21, h: 0.155, frame: 'rounded' },
            { x: 0.07, y: 0.405, w: 0.21, h: 0.155, frame: 'rounded' },
            { x: 0.07, y: 0.605, w: 0.21, h: 0.155, frame: 'rounded' },
            { x: 0.07, y: 0.805, w: 0.21, h: 0.155, frame: 'rounded' }
          ] },

        /* 3 — Portrettserie (monokrom, stramt rutenett) */
        { id: 'ung-portrett', name: 'Portrettserie', category: 'ungdom', orientation: 'portrait',
          palette: P('gray.1', 'gray.9', 'gray.9', 'gray.6', 'gray.3'),
          background: { type: 'solid', color: 'gray.1', layers: [
            { type: 'patternTile', kind: 'dots', color: 'gray.5', scale: 0.038, alpha: 0.35 }
          ] },
          decor: [
            { type: 'frame', variant: 'solid', color: 'ink', width: 0.014 }
          ],
          texts: [
            { id: 'title', x: 0.07, y: 0.065, w: 0.86, text: 'PORTRETT', size: 0.072, font: F.impact, color: 'ink', align: 'center' },
            { id: 'sub', x: 0.07, y: 0.93, w: 0.86, text: 'Klassen vår · 2026', size: 0.030, font: F.body, color: 'accent2', align: 'center' }
          ],
          slots: grid(3, 3, 0.075, 0.022).map(s => ({ ...s, y: 0.185 + (s.y - 0.075) * 0.76, h: s.h * 0.76, frame: 'rounded' })) },

        /* 4 — Ekskursjon */
        { id: 'ung-ekskursjon', name: 'Ekskursjon', category: 'ungdom', orientation: 'landscape',
          palette: P('gray.0', 'gray.9', 'orange.8', 'gray.7', 'gray.2'),
          background: { type: 'gradient', from: 'gray.0', to: 'gray.2', layers: [
            { type: 'peaks', colors: ['gray.3', 'gray.5', 'gray.7'], h: 0.5, seed: 41 }
          ] },
          decor: [
            { type: 'glyph', layer: 'front', name: 'mapPin', x: 0.94, y: 0.10, size: 0.055, color: 'accent' },
            { type: 'frame', variant: 'solid', color: 'ink', width: 0.012 }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.065, w: 0.80, text: 'EKSKURSJON', size: 0.085, font: F.impact, color: 'ink', align: 'left' },
            { id: 'sub', x: 0.06, y: 0.175, w: 0.80, text: 'Stad og dato', size: 0.032, font: F.body, color: 'accent', align: 'left' }
          ],
          slots: [
            { x: 0.06, y: 0.27, w: 0.42, h: 0.62, frame: 'rounded' },
            { x: 0.51, y: 0.27, w: 0.43, h: 0.295, frame: 'rounded' },
            { x: 0.51, y: 0.595, w: 0.43, h: 0.295, frame: 'rounded' }
          ] },

        /* 5 — Framsyning (mørk, til projektor og skjerm) */
        { id: 'ung-framsyning', name: 'Framsyning', category: 'ungdom', orientation: 'landscape',
          palette: P('#16181c', 'white', 'yellow.5', 'gray.5', 'gray.7'),
          background: { type: 'gradient', from: '#1c1f25', to: '#101215', layers: [
            { type: 'diagonalBands', colors: ['#22262e'], angle: -22, count: 6, ratio: 0.5, alpha: 0.9 },
            { type: 'arcBands', corner: 'br', colors: ['#262a33'], count: 5, width: 0.32, alpha: 0.8 }
          ] },
          decor: [
            { type: 'frame', variant: 'double', color: 'accent' }
          ],
          texts: [
            { id: 'title', x: 0.06, y: 0.07, w: 0.88, text: 'TEMA FOR FRAMSYNINGA', size: 0.062, font: F.impact, color: 'accent', align: 'center' },
            { id: 'sub', x: 0.06, y: 0.90, w: 0.88, text: 'Namn · Klasse', size: 0.030, font: F.body, color: 'accent2', align: 'center' }
          ],
          slots: [
            { x: 0.06, y: 0.22, w: 0.275, h: 0.62, frame: 'rounded' },
            { x: 0.3625, y: 0.22, w: 0.275, h: 0.62, frame: 'rounded' },
            { x: 0.665, y: 0.22, w: 0.275, h: 0.62, frame: 'rounded' }
          ] },

        /* 6 — Fagrapport (roleg, mykje plass til tekst) */
        { id: 'ung-fagrapport', name: 'Fagrapport', category: 'ungdom', orientation: 'portrait',
          palette: P('white', 'gray.9', 'red.8', 'gray.6', 'gray.2'),
          background: { type: 'solid', color: 'white', layers: [
            { type: 'diagonalBands', colors: ['gray.1'], angle: 90, count: 2, ratio: 0.22, alpha: 1 }
          ] },
          decor: [
            { type: 'ribbonBanner', x: 0.06, y: 0.05, w: 0.55, h: 0.075, color: 'accent' },
            { type: 'frame', variant: 'solid', color: 'ink', width: 0.010 }
          ],
          texts: [
            { id: 'label', x: 0.08, y: 0.063, w: 0.50, text: 'FAGRAPPORT', size: 0.038, font: F.bold, color: 'white', align: 'left' },
            { id: 'title', x: 0.06, y: 0.16, w: 0.88, text: 'Overskrift', size: 0.070, font: F.impact, color: 'ink', align: 'left' },
            { id: 'cap1', x: 0.06, y: 0.535, w: 0.42, text: 'Bilettekst til venstre …', size: 0.028, font: F.body, color: 'accent2', align: 'left' },
            { id: 'cap2', x: 0.52, y: 0.535, w: 0.42, text: 'Bilettekst til høgre …', size: 0.028, font: F.body, color: 'accent2', align: 'left' },
            { id: 'sub', x: 0.06, y: 0.93, w: 0.88, text: 'Namn · Klasse · Fag', size: 0.028, font: F.body, color: 'accent2', align: 'left' }
          ],
          slots: [
            { x: 0.06, y: 0.265, w: 0.88, h: 0.245, frame: 'rounded' },
            { x: 0.06, y: 0.615, w: 0.42, h: 0.265, frame: 'rounded' },
            { x: 0.52, y: 0.615, w: 0.42, h: 0.265, frame: 'rounded' }
          ] }
    ];

    const all = [...standard, ...tema, ...ungdom];
    const byId = {};
    all.forEach(t => { byId[t.id] = t; });

    return {
        all,
        standard,
        tema,
        ungdom,
        get: (id) => byId[id],
        fonts: F
    };
})();
